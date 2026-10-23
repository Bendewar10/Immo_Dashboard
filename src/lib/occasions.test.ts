import { describe, it, expect } from 'vitest'
import { computeOccasionSections, nextBirthdayOccurrence, UPCOMING_WINDOW_DAYS } from './occasions'
import type { Contact } from './contacts'

const TODAY = new Date(2026, 5, 15) // 2026-06-15

function makeContact(overrides: Partial<Contact>): Contact {
  return {
    id: overrides.id ?? 'id',
    first_name: overrides.first_name ?? 'Test',
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
    created_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function isoOffset(days: number) {
  const d = new Date(TODAY)
  d.setDate(d.getDate() + days)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

describe('computeOccasionSections', () => {
  it('puts an overdue follow-up in todaySection', () => {
    const contact = makeContact({ next_followup_at: isoOffset(-3) })
    const { todaySection, upcomingSection } = computeOccasionSections([contact], TODAY)
    expect(todaySection).toHaveLength(1)
    expect(todaySection[0].badges).toEqual(['followup'])
    expect(upcomingSection).toHaveLength(0)
  })

  it(`includes a follow-up due in exactly ${UPCOMING_WINDOW_DAYS} days (upper window boundary)`, () => {
    const contact = makeContact({ next_followup_at: isoOffset(UPCOMING_WINDOW_DAYS) })
    const { upcomingSection } = computeOccasionSections([contact], TODAY)
    expect(upcomingSection).toHaveLength(1)
  })

  it(`excludes a follow-up due in ${UPCOMING_WINDOW_DAYS + 1} days (just outside the window)`, () => {
    const contact = makeContact({ next_followup_at: isoOffset(UPCOMING_WINDOW_DAYS + 1) })
    const { todaySection, upcomingSection } = computeOccasionSections([contact], TODAY)
    expect(todaySection).toHaveLength(0)
    expect(upcomingSection).toHaveLength(0)
  })

  it('sorts upcomingSection chronologically by occasion date', () => {
    const far = makeContact({ id: 'far', next_followup_at: isoOffset(12) })
    const near = makeContact({ id: 'near', next_followup_at: isoOffset(2) })
    const { upcomingSection } = computeOccasionSections([far, near], TODAY)
    expect(upcomingSection.map((o) => o.contact.id)).toEqual(['near', 'far'])
  })

  it('uses the earlier of two badge dates for sorting when a contact has both', () => {
    // birthday lands sooner than the follow-up, so this contact should sort before a closer-but-single-badge contact
    const both = makeContact({
      id: 'both',
      next_followup_at: isoOffset(10),
      birthday: `2000-${isoOffset(3).slice(5)}`,
    })
    const single = makeContact({ id: 'single', next_followup_at: isoOffset(5) })
    const { upcomingSection } = computeOccasionSections([both, single], TODAY)
    expect(upcomingSection.map((o) => o.contact.id)).toEqual(['both', 'single'])
  })

  it('detects a birthday today', () => {
    const contact = makeContact({ birthday: `1990-${isoOffset(0).slice(5)}` })
    const { todaySection } = computeOccasionSections([contact], TODAY)
    expect(todaySection).toHaveLength(1)
    expect(todaySection[0].badges).toEqual(['birthday'])
  })

  it('wraps a birthday across the year boundary', () => {
    const newYearsEve = new Date(2026, 11, 28) // 2026-12-28
    const contact = makeContact({ birthday: '2000-01-05' }) // 8 days later, wraps into 2027
    const { upcomingSection } = computeOccasionSections([contact], newYearsEve)
    expect(upcomingSection).toHaveLength(1)
  })

  it('falls back Feb 29 to Feb 28 in a non-leap year', () => {
    const occurrence = nextBirthdayOccurrence('2000-02-29', new Date(2026, 1, 1)) // 2026 is not a leap year
    expect(occurrence.getMonth()).toBe(1) // February
    expect(occurrence.getDate()).toBe(28)
  })

  it('puts a contact with neither follow-up nor birthday in no section', () => {
    const contact = makeContact({})
    const { todaySection, upcomingSection } = computeOccasionSections([contact], TODAY)
    expect(todaySection).toHaveLength(0)
    expect(upcomingSection).toHaveLength(0)
  })

  it('returns empty sections for an empty contact list', () => {
    const { todaySection, upcomingSection } = computeOccasionSections([], TODAY)
    expect(todaySection).toEqual([])
    expect(upcomingSection).toEqual([])
  })
})
