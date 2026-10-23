import { describe, it, expect } from 'vitest'
import { formatDayLabel, needsPostMeetingNudge, MeetingGroup, MeetingContact } from './meetings'

const NOW = new Date('2026-07-02T14:00:00Z') // Donnerstag

function makeMeeting(overrides: Partial<MeetingGroup> = {}): MeetingGroup {
  return {
    id: 'ev1',
    title: 'Sync',
    date: '2026-07-02',
    startTime: '2026-07-02T10:00:00Z',
    endTime: '2026-07-02T11:00:00Z',
    isAllDay: false,
    location: null,
    contacts: [],
    ...overrides,
  }
}

function makeContact(overrides: Partial<MeetingContact> = {}): MeetingContact {
  return {
    id: 'c1',
    first_name: 'Anna',
    last_name: null,
    photo_url: null,
    last_contacted_at: null,
    ...overrides,
  }
}

describe('formatDayLabel', () => {
  it('returns null for today', () => {
    expect(formatDayLabel('2026-07-02', NOW)).toBeNull()
  })

  it('returns "Morgen" for tomorrow', () => {
    expect(formatDayLabel('2026-07-03', NOW)).toBe('Morgen')
  })

  it('returns the weekday name from the day after tomorrow onward', () => {
    expect(formatDayLabel('2026-07-04', NOW)).toBe('Samstag')
  })
})

describe('needsPostMeetingNudge', () => {
  it('is false for all-day meetings', () => {
    const meeting = makeMeeting({ isAllDay: true, endTime: null })
    expect(needsPostMeetingNudge(meeting, makeContact(), NOW)).toBe(false)
  })

  it('is false when the meeting has no end time', () => {
    const meeting = makeMeeting({ endTime: null })
    expect(needsPostMeetingNudge(meeting, makeContact(), NOW)).toBe(false)
  })

  it('is false for a meeting on a future day', () => {
    const meeting = makeMeeting({ date: '2026-07-03', endTime: '2026-07-03T11:00:00Z' })
    expect(needsPostMeetingNudge(meeting, makeContact(), NOW)).toBe(false)
  })

  it('is false when the meeting has not ended yet', () => {
    const meeting = makeMeeting({ endTime: '2026-07-02T15:00:00Z' }) // NOW is 14:00
    expect(needsPostMeetingNudge(meeting, makeContact(), NOW)).toBe(false)
  })

  it('is true for an ended meeting today when the contact has never been logged', () => {
    const meeting = makeMeeting({ endTime: '2026-07-02T11:00:00Z' })
    expect(needsPostMeetingNudge(meeting, makeContact({ last_contacted_at: null }), NOW)).toBe(true)
  })

  it('is true when the last logged interaction is before the meeting ended', () => {
    const meeting = makeMeeting({ endTime: '2026-07-02T11:00:00Z' })
    const contact = makeContact({ last_contacted_at: '2026-06-01T00:00:00Z' })
    expect(needsPostMeetingNudge(meeting, contact, NOW)).toBe(true)
  })

  it('is false when the contact was already logged after the meeting ended', () => {
    const meeting = makeMeeting({ endTime: '2026-07-02T11:00:00Z' })
    const contact = makeContact({ last_contacted_at: '2026-07-02T12:00:00Z' })
    expect(needsPostMeetingNudge(meeting, contact, NOW)).toBe(false)
  })
})
