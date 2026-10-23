import { describe, it, expect } from 'vitest'
import { Contact } from '@/lib/contacts'
import {
  ExitTarget,
  computeCoverage,
  isDuplicateTarget,
  sortTargetsByCoverage,
} from '@/lib/exit-targets'

function makeContact(overrides: Partial<Contact>): Contact {
  return {
    id: crypto.randomUUID(),
    first_name: 'Test',
    last_name: null,
    category: null,
    strength: null,
    employer: null,
    job_title: null,
    email: null,
    linkedin_url: null,
    photo_url: null,
    context: null,
    notes: null,
    city: null,
    phone: null,
    birthday: null,
    followup_interval_days: null,
    last_contacted_at: null,
    next_followup_at: null,
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

function makeTarget(company_name: string, id = crypto.randomUUID()): ExitTarget {
  return { id, company_name, created_at: '2026-07-01T00:00:00Z' }
}

describe('computeCoverage', () => {
  it('matches contacts via normalized employer name', () => {
    const contacts = [
      makeContact({ employer: 'McKinsey', employer_normalized: 'McKinsey & Company', strength: 1 }),
      makeContact({ employer: 'McKinsey & Co.', employer_normalized: 'McKinsey & Company', strength: 3 }),
      makeContact({ employer: 'BCG', employer_normalized: 'Boston Consulting Group' }),
    ]
    const coverage = computeCoverage(makeTarget('McKinsey & Company'), contacts)
    expect(coverage.contactCount).toBe(2)
    expect(coverage.strengthCounts).toEqual({ 1: 1, 2: 0, 3: 1 })
  })

  it('falls back to raw employer when no normalization exists', () => {
    const contacts = [makeContact({ employer: 'Bain Capital', employer_normalized: null })]
    const coverage = computeCoverage(makeTarget('Bain Capital'), contacts)
    expect(coverage.contactCount).toBe(1)
  })

  it('matches case-insensitively and trims whitespace', () => {
    const contacts = [makeContact({ employer: 'McKinsey' })]
    const coverage = computeCoverage(makeTarget('  mckinsey '), contacts)
    expect(coverage.contactCount).toBe(1)
  })

  it('returns the latest touchpoint across matched contacts', () => {
    const contacts = [
      makeContact({ employer: 'X', last_contacted_at: '2026-05-01T00:00:00Z' }),
      makeContact({ employer: 'X', last_contacted_at: '2026-06-15T00:00:00Z' }),
      makeContact({ employer: 'Y', last_contacted_at: '2026-07-01T00:00:00Z' }),
    ]
    const coverage = computeCoverage(makeTarget('X'), contacts)
    expect(coverage.lastTouchpoint).toBe('2026-06-15T00:00:00Z')
  })

  it('returns empty coverage when nothing matches', () => {
    const coverage = computeCoverage(makeTarget('Unbekannt AG'), [
      makeContact({ employer: 'McKinsey' }),
      makeContact({ employer: null }),
    ])
    expect(coverage.contactCount).toBe(0)
    expect(coverage.lastTouchpoint).toBeNull()
  })

  it('ignores contacts without any company', () => {
    const coverage = computeCoverage(makeTarget(''), [makeContact({ employer: null })])
    expect(coverage.contactCount).toBe(0)
  })
})

describe('sortTargetsByCoverage', () => {
  it('sorts by contact count desc, no-contact targets last, ties alphabetically', () => {
    const a = makeTarget('Alpha GmbH', 'a')
    const b = makeTarget('Beta AG', 'b')
    const c = makeTarget('Gamma SE', 'c')
    const coverage = new Map([
      ['a', { contactCount: 0, strengthCounts: { 1: 0, 2: 0, 3: 0 }, lastTouchpoint: null }],
      ['b', { contactCount: 3, strengthCounts: { 1: 0, 2: 0, 3: 0 }, lastTouchpoint: null }],
      ['c', { contactCount: 3, strengthCounts: { 1: 0, 2: 0, 3: 0 }, lastTouchpoint: null }],
    ])
    const sorted = sortTargetsByCoverage([a, b, c], coverage)
    expect(sorted.map((t) => t.id)).toEqual(['b', 'c', 'a'])
  })
})

describe('isDuplicateTarget', () => {
  it('detects duplicates case-insensitively and trimmed', () => {
    const targets = [makeTarget('McKinsey & Company')]
    expect(isDuplicateTarget(' mckinsey & company ', targets)).toBe(true)
    expect(isDuplicateTarget('Bain Capital', targets)).toBe(false)
  })
})
