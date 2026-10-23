import { describe, it, expect } from 'vitest'
import { groupOpenEvents, type ContactEvent } from './contact-events'
import type { Contact } from './contacts'

function makeContact(id: string): Contact {
  return {
    id,
    first_name: `Contact-${id}`,
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
  }
}

function makeEvent(overrides: Partial<ContactEvent>): ContactEvent {
  return {
    id: overrides.id ?? 'event-id',
    contact_id: overrides.contact_id ?? 'contact-1',
    type: overrides.type ?? 'Jobwechsel',
    detected_at: overrides.detected_at ?? '2026-06-15T00:00:00.000Z',
    dismissed_at: overrides.dismissed_at ?? null,
  }
}

describe('groupOpenEvents', () => {
  it('groups multiple open events of the same contact into one group with both types', () => {
    const contact = makeContact('c1')
    const events = [
      makeEvent({ id: 'e1', contact_id: 'c1', type: 'Jobwechsel' }),
      makeEvent({ id: 'e2', contact_id: 'c1', type: 'Beförderung' }),
    ]
    const groups = groupOpenEvents(events, [contact])
    expect(groups).toHaveLength(1)
    expect(groups[0].contact.id).toBe('c1')
    expect(groups[0].events).toHaveLength(2)
    expect(groups[0].types).toEqual(['Jobwechsel', 'Beförderung'])
  })

  it('excludes dismissed events entirely', () => {
    const contact = makeContact('c1')
    const events = [makeEvent({ id: 'e1', contact_id: 'c1', dismissed_at: '2026-06-16T00:00:00.000Z' })]
    const groups = groupOpenEvents(events, [contact])
    expect(groups).toHaveLength(0)
  })

  it('drops a group if a dismissed event leaves no open events for that contact', () => {
    const contact = makeContact('c1')
    const events = [
      makeEvent({ id: 'e1', contact_id: 'c1', dismissed_at: '2026-06-16T00:00:00.000Z' }),
      makeEvent({ id: 'e2', contact_id: 'c1', dismissed_at: '2026-06-16T00:00:00.000Z' }),
    ]
    const groups = groupOpenEvents(events, [contact])
    expect(groups).toHaveLength(0)
  })

  it('keeps a partially dismissed group with only the remaining open event', () => {
    const contact = makeContact('c1')
    const events = [
      makeEvent({ id: 'e1', contact_id: 'c1', type: 'Jobwechsel', dismissed_at: '2026-06-16T00:00:00.000Z' }),
      makeEvent({ id: 'e2', contact_id: 'c1', type: 'Beförderung', dismissed_at: null }),
    ]
    const groups = groupOpenEvents(events, [contact])
    expect(groups).toHaveLength(1)
    expect(groups[0].types).toEqual(['Beförderung'])
  })

  it('produces separate groups for different contacts', () => {
    const contacts = [makeContact('c1'), makeContact('c2')]
    const events = [
      makeEvent({ id: 'e1', contact_id: 'c1' }),
      makeEvent({ id: 'e2', contact_id: 'c2' }),
    ]
    const groups = groupOpenEvents(events, contacts)
    expect(groups.map((g) => g.contact.id).sort()).toEqual(['c1', 'c2'])
  })

  it('skips events whose contact no longer exists in the given contact list', () => {
    const events = [makeEvent({ id: 'e1', contact_id: 'deleted-contact' })]
    const groups = groupOpenEvents(events, [])
    expect(groups).toHaveLength(0)
  })

  it('returns an empty array for no events', () => {
    expect(groupOpenEvents([], [makeContact('c1')])).toEqual([])
  })
})
