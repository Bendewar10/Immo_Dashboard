import { describe, it, expect } from 'vitest'
import { Contact } from '@/lib/contacts'
import { Interaction } from '@/lib/interactions'
import { buildReportMetrics, isLastSundayOfMonth, previousMonthStartDate } from '@/lib/report-data'

function contact(overrides: Partial<Contact>): Contact {
  return {
    id: 'c',
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
    created_at: '2026-06-10T00:00:00+00:00',
    ...overrides,
  }
}

function interaction(overrides: Partial<Interaction>): Interaction {
  return {
    id: 'i',
    contact_id: 'c',
    project_id: null,
    occurred_at: '2026-06-05',
    channel: 'call',
    note: null,
    created_at: '2026-06-05T00:00:00+00:00',
    ...overrides,
  }
}

describe('isLastSundayOfMonth', () => {
  it('is true on the last Sunday of the month (28 Jun 2026)', () => {
    expect(isLastSundayOfMonth(new Date(2026, 5, 28))).toBe(true)
  })

  it('is false on an earlier Sunday (21 Jun 2026)', () => {
    expect(isLastSundayOfMonth(new Date(2026, 5, 21))).toBe(false)
  })

  it('is false on a non-Sunday (27 Jun 2026, Saturday)', () => {
    expect(isLastSundayOfMonth(new Date(2026, 5, 27))).toBe(false)
  })
})

describe('previousMonthStartDate', () => {
  it('returns the first day of the previous month', () => {
    expect(previousMonthStartDate(new Date(2026, 5, 15))).toBe('2026-05-01')
  })

  it('wraps across year boundary', () => {
    expect(previousMonthStartDate(new Date(2026, 0, 10))).toBe('2025-12-01')
  })
})

describe('buildReportMetrics', () => {
  const now = new Date(2026, 5, 28)

  it('computes monthly counts, delta and overdue core', () => {
    const contacts = [
      contact({ id: 'c1', created_at: '2026-06-10T00:00:00+00:00', strength: 1, category: 'colleague', next_followup_at: '2026-06-20T00:00:00+00:00' }),
      contact({ id: 'c2', created_at: '2026-04-01T00:00:00+00:00', strength: 2, next_followup_at: null }),
    ]
    const interactions = [
      interaction({ id: 'i1', occurred_at: '2026-06-05', channel: 'call' }),
      interaction({ id: 'i2', occurred_at: '2026-06-12', channel: 'meeting' }),
      interaction({ id: 'i3', occurred_at: '2026-05-20', channel: 'call' }),
    ]

    const m = buildReportMetrics(contacts, interactions, now)

    expect(m.totalContacts).toBe(2)
    expect(m.newContactsThisMonth).toBe(1)
    expect(m.interactionsThisMonth).toBe(2)
    expect(m.interactionsPrevMonth).toBe(1)
    expect(m.interactionDelta).toBe(1)
    expect(m.showDelta).toBe(true)
    expect(m.isQuietMonth).toBe(false)
    expect(m.overdueCount).toBe(1)
    expect(m.overdueCoreCount).toBe(1)
    expect(m.channelThisMonth).toContainEqual({ key: 'call', label: 'Call', count: 1 })
    expect(m.channelThisMonth).toContainEqual({ key: 'meeting', label: 'Treffen', count: 1 })
  })

  it('flags a quiet month with no activity', () => {
    const contacts = [contact({ id: 'c1', created_at: '2026-03-01T00:00:00+00:00' })]
    const m = buildReportMetrics(contacts, [], now)
    expect(m.isQuietMonth).toBe(true)
    expect(m.interactionsThisMonth).toBe(0)
  })

  it('suppresses delta in the first month (no prior history)', () => {
    const contacts = [
      contact({ id: 'c1', created_at: '2026-06-02T00:00:00+00:00' }),
      contact({ id: 'c2', created_at: '2026-06-15T00:00:00+00:00' }),
    ]
    const interactions = [interaction({ id: 'i1', occurred_at: '2026-06-10' })]
    const m = buildReportMetrics(contacts, interactions, now)
    expect(m.showDelta).toBe(false)
    expect(m.newContactsThisMonth).toBe(2)
  })
})
