import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  extractProfileSnapshot,
  shouldScrapeProfile,
  formatSnapshotForPrompt,
  maybeEnrichContactProfile,
  scrapeLinkedInProfile,
  PROFILE_COOLDOWN_DAYS,
  type RawProfileItem,
  type EnrichableContact,
} from './linkedin-profile'
import type { SupabaseClient } from '@supabase/supabase-js'

const NOW = new Date('2026-07-01T12:00:00.000Z')

const rawItem: RawProfileItem = {
  headline: 'Partner at McKinsey | Strategy',
  about: 'Helping clients win.',
  location: { linkedinText: 'Munich, Bavaria, Germany', parsed: { city: 'Munich' } },
  currentPosition: [
    { position: 'Partner', companyName: 'McKinsey & Company', location: 'Munich', duration: '3 yrs' },
  ],
  experience: [
    { position: 'Partner', companyName: 'McKinsey & Company', duration: '3 yrs' },
    { position: 'Associate', companyName: 'BCG', duration: '2 yrs' },
  ],
  education: [
    { schoolName: 'LMU München', degree: 'MBA', fieldOfStudy: 'Business', period: '2013 - 2015' },
  ],
  topSkills: ['Strategy', 'M&A'],
}

describe('extractProfileSnapshot', () => {
  it('maps raw item into compact snapshot', () => {
    const s = extractProfileSnapshot(rawItem, NOW)
    expect(s.headline).toBe('Partner at McKinsey | Strategy')
    expect(s.employer).toBe('McKinsey & Company')
    expect(s.jobTitle).toBe('Partner')
    expect(s.city).toBe('Munich')
    expect(s.location).toBe('Munich, Bavaria, Germany')
    expect(s.experience).toHaveLength(2)
    expect(s.education[0].school).toBe('LMU München')
    expect(s.topSkills).toEqual(['Strategy', 'M&A'])
    expect(s.scrapedAt).toBe(NOW.toISOString())
  })

  it('falls back to skills[].name when topSkills missing', () => {
    const s = extractProfileSnapshot({ skills: [{ name: 'SQL' }, { name: '' }] }, NOW)
    expect(s.topSkills).toEqual(['SQL'])
  })

  it('handles empty/missing fields without throwing', () => {
    const s = extractProfileSnapshot({}, NOW)
    expect(s.employer).toBeNull()
    expect(s.jobTitle).toBeNull()
    expect(s.city).toBeNull()
    expect(s.currentPositions).toEqual([])
    expect(s.education).toEqual([])
    expect(s.topSkills).toEqual([])
  })

  it('uses parsed city as location fallback when linkedinText missing', () => {
    const s = extractProfileSnapshot({ location: { parsed: { city: 'Berlin' } } }, NOW)
    expect(s.location).toBe('Berlin')
    expect(s.city).toBe('Berlin')
  })
})

describe('shouldScrapeProfile', () => {
  it('scrapes when never scraped', () => {
    expect(shouldScrapeProfile(null, NOW)).toBe(true)
  })
  it('skips within cooldown', () => {
    const recent = new Date(NOW.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString()
    expect(shouldScrapeProfile(recent, NOW)).toBe(false)
  })
  it('scrapes after cooldown', () => {
    const old = new Date(NOW.getTime() - (PROFILE_COOLDOWN_DAYS + 1) * 24 * 60 * 60 * 1000).toISOString()
    expect(shouldScrapeProfile(old, NOW)).toBe(true)
  })
  it('scrapes when timestamp unparseable', () => {
    expect(shouldScrapeProfile('not-a-date', NOW)).toBe(true)
  })
})

describe('formatSnapshotForPrompt', () => {
  it('renders headline, current role, education and skills', () => {
    const text = formatSnapshotForPrompt(extractProfileSnapshot(rawItem, NOW))
    expect(text).toContain('Headline: Partner at McKinsey')
    expect(text).toContain('Aktuell: Partner bei McKinsey & Company (3 yrs)')
    expect(text).toContain('Ausbildung: MBA Business an LMU München (2013 - 2015)')
    expect(text).toContain('Skills: Strategy, M&A')
  })
})

// ---- maybeEnrichContactProfile ----

function makeSupabaseMock() {
  const updateEq = vi.fn().mockResolvedValue({ error: null })
  const update = vi.fn(() => ({ eq: updateEq }))
  const supabase = { from: vi.fn(() => ({ update })) } as unknown as SupabaseClient
  return { supabase, update, updateEq }
}

const baseContact: EnrichableContact = {
  id: 'c1',
  employer: null,
  job_title: null,
  city: null,
  linkedin_url: 'https://linkedin.com/in/klaus',
  linkedin_profile: null,
  linkedin_profile_at: null,
}

describe('maybeEnrichContactProfile', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('skips when no token', async () => {
    const { supabase, update } = makeSupabaseMock()
    const res = await maybeEnrichContactProfile(supabase, baseContact, undefined, NOW)
    expect(res.scraped).toBe(false)
    expect(update).not.toHaveBeenCalled()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('skips when contact has no linkedin_url', async () => {
    const { supabase } = makeSupabaseMock()
    const res = await maybeEnrichContactProfile(supabase, { ...baseContact, linkedin_url: null }, 'tok', NOW)
    expect(res.scraped).toBe(false)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('skips scrape within cooldown but returns existing snapshot', async () => {
    const existing = extractProfileSnapshot(rawItem, NOW)
    const recent = new Date(NOW.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString()
    const { supabase } = makeSupabaseMock()
    const res = await maybeEnrichContactProfile(
      supabase,
      { ...baseContact, linkedin_profile: existing, linkedin_profile_at: recent },
      'tok',
      NOW
    )
    expect(res.scraped).toBe(false)
    expect(res.snapshot).toBe(existing)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('scrapes, fills only empty fields, stores snapshot', async () => {
    ;(fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => [rawItem],
    })
    const { supabase, update, updateEq } = makeSupabaseMock()
    const res = await maybeEnrichContactProfile(supabase, baseContact, 'tok', NOW)
    expect(res.scraped).toBe(true)
    expect(res.contact.employer).toBe('McKinsey & Company')
    expect(res.contact.job_title).toBe('Partner')
    expect(res.contact.city).toBe('Munich')
    const payload = update.mock.calls[0][0] as Record<string, unknown>
    expect(payload.employer).toBe('McKinsey & Company')
    expect(payload.linkedin_profile).toBeTruthy()
    expect(payload.linkedin_profile_at).toBe(NOW.toISOString())
    expect(updateEq).toHaveBeenCalledWith('id', 'c1')
  })

  it('never overwrites existing visible fields', async () => {
    ;(fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => [rawItem],
    })
    const { supabase, update } = makeSupabaseMock()
    const contact = { ...baseContact, employer: 'MeineFirma', job_title: 'CEO', city: 'Hamburg' }
    const res = await maybeEnrichContactProfile(supabase, contact, 'tok', NOW)
    expect(res.contact.employer).toBe('MeineFirma')
    const payload = update.mock.calls[0][0] as Record<string, unknown>
    expect(payload.employer).toBeUndefined()
    expect(payload.job_title).toBeUndefined()
    expect(payload.city).toBeUndefined()
    expect(payload.linkedin_profile).toBeTruthy()
  })

  it('sets cooldown but no snapshot when profile empty', async () => {
    ;(fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, json: async () => [] })
    const { supabase, update } = makeSupabaseMock()
    const res = await maybeEnrichContactProfile(supabase, baseContact, 'tok', NOW)
    expect(res.scraped).toBe(true)
    expect(res.snapshot).toBeNull()
    const payload = update.mock.calls[0][0] as Record<string, unknown>
    expect(payload.linkedin_profile_at).toBe(NOW.toISOString())
    expect(payload.linkedin_profile).toBeUndefined()
  })

  it('is graceful on scrape error (no cooldown, retriable)', async () => {
    ;(fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false, status: 429 })
    const { supabase, update } = makeSupabaseMock()
    const res = await maybeEnrichContactProfile(supabase, baseContact, 'tok', NOW)
    expect(res.scraped).toBe(false)
    expect(update).not.toHaveBeenCalled()
  })
})

describe('scrapeLinkedInProfile', () => {
  beforeEach(() => vi.stubGlobal('fetch', vi.fn()))
  afterEach(() => vi.unstubAllGlobals())

  it('returns first dataset item', async () => {
    ;(fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, json: async () => [rawItem] })
    const item = await scrapeLinkedInProfile('https://linkedin.com/in/x', 'tok')
    expect(item).toEqual(rawItem)
  })

  it('throws on non-ok response', async () => {
    ;(fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false, status: 500 })
    await expect(scrapeLinkedInProfile('https://linkedin.com/in/x', 'tok')).rejects.toThrow()
  })

  it('returns null on empty dataset', async () => {
    ;(fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, json: async () => [] })
    expect(await scrapeLinkedInProfile('https://linkedin.com/in/x', 'tok')).toBeNull()
  })
})