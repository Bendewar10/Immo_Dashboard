import { describe, it, expect } from 'vitest'
import type { ProfileSnapshot } from '@/lib/linkedin-profile'
import { buildProfileLookup, detectJobChange, findProfileItem } from '@/lib/job-change-radar'

function makeSnapshot(overrides: Partial<ProfileSnapshot>): ProfileSnapshot {
  return {
    headline: null,
    location: null,
    employer: null,
    jobTitle: null,
    city: null,
    about: null,
    currentPositions: [],
    experience: [],
    education: [],
    topSkills: [],
    scrapedAt: '2026-07-02T00:00:00Z',
    ...overrides,
  }
}

describe('detectJobChange', () => {
  it('erkennt Jobwechsel: anderer Arbeitgeber, alter vorhanden', () => {
    const result = detectJobChange(
      { employer: 'McKinsey & Company', job_title: 'Associate' },
      makeSnapshot({ employer: 'KKR', jobTitle: 'Principal' })
    )
    expect(result.eventType).toBe('Jobwechsel')
    expect(result.updates.employer).toBe('KKR')
    expect(result.updates.job_title).toBe('Principal')
    // Normalisierungs-Reset (PROJ-22) bei employer-Änderung
    expect(result.updates.employer_normalized).toBeNull()
    expect(result.updates.employer_normalized_source).toBeNull()
  })

  it('erkennt Beförderung: gleicher Arbeitgeber, anderer Titel, alter vorhanden', () => {
    const result = detectJobChange(
      { employer: 'McKinsey & Company', job_title: 'Associate' },
      makeSnapshot({ employer: 'McKinsey & Company', jobTitle: 'Engagement Manager' })
    )
    expect(result.eventType).toBe('Beförderung')
    expect(result.updates).toEqual({ job_title: 'Engagement Manager' })
  })

  it('Erstbefüllung leerer Felder erzeugt kein Event', () => {
    const result = detectJobChange(
      { employer: null, job_title: null },
      makeSnapshot({ employer: 'BCG', jobTitle: 'Partner' })
    )
    expect(result.eventType).toBeNull()
    expect(result.updates.employer).toBe('BCG')
    expect(result.updates.job_title).toBe('Partner')
  })

  it('identische Daten: kein Event, kein Update', () => {
    const result = detectJobChange(
      { employer: 'BCG', job_title: 'Partner' },
      makeSnapshot({ employer: 'BCG', jobTitle: 'Partner' })
    )
    expect(result.eventType).toBeNull()
    expect(result.updates).toEqual({})
  })

  it('Vergleich ist case-insensitive und trimmt (keine Pseudo-Wechsel)', () => {
    const result = detectJobChange(
      { employer: 'McKinsey & Company', job_title: 'Associate' },
      makeSnapshot({ employer: '  mckinsey & company ', jobTitle: 'ASSOCIATE' })
    )
    expect(result.eventType).toBeNull()
    expect(result.updates).toEqual({})
  })

  it('Snapshot ohne Arbeitgeber-Info fasst vorhandene Werte nicht an', () => {
    const result = detectJobChange(
      { employer: 'BCG', job_title: 'Partner' },
      makeSnapshot({ employer: null, jobTitle: null })
    )
    expect(result.eventType).toBeNull()
    expect(result.updates).toEqual({})
  })

  it('nur Titel neu, alter Titel leer: befüllen ohne Event', () => {
    const result = detectJobChange(
      { employer: 'BCG', job_title: null },
      makeSnapshot({ employer: 'BCG', jobTitle: 'Partner' })
    )
    expect(result.eventType).toBeNull()
    expect(result.updates).toEqual({ job_title: 'Partner' })
  })

  it('Jobwechsel auch wenn neuer Titel fehlt (nur employer-Update)', () => {
    const result = detectJobChange(
      { employer: 'BCG', job_title: 'Partner' },
      makeSnapshot({ employer: 'KKR', jobTitle: null })
    )
    expect(result.eventType).toBe('Jobwechsel')
    expect(result.updates.employer).toBe('KKR')
    expect(result.updates.job_title).toBeUndefined()
  })
})

describe('buildProfileLookup / findProfileItem', () => {
  it('findet Items über linkedinUrl, originalQuery und publicIdentifier', () => {
    const items = [
      { headline: 'A', linkedinUrl: 'https://www.linkedin.com/in/anna-alpha/' },
      { headline: 'B', originalQuery: { query: 'https://linkedin.com/in/bernd-beta' } },
      { headline: 'C', publicIdentifier: 'Clara-Gamma' },
    ]
    const lookup = buildProfileLookup(items)

    expect(findProfileItem(lookup, 'https://linkedin.com/in/anna-alpha')?.headline).toBe('A')
    expect(findProfileItem(lookup, 'https://www.linkedin.com/in/bernd-beta/')?.headline).toBe('B')
    expect(findProfileItem(lookup, 'https://linkedin.com/in/clara-gamma')?.headline).toBe('C')
    expect(findProfileItem(lookup, 'https://linkedin.com/in/unbekannt')).toBeNull()
  })
})
