import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { getUserMock, getValidGoogleAccessTokenMock, contactsSelectMock, fetchMock } = vi.hoisted(() => ({
  getUserMock: vi.fn(),
  getValidGoogleAccessTokenMock: vi.fn(),
  contactsSelectMock: vi.fn(),
  fetchMock: vi.fn(),
}))

vi.mock('@/lib/supabase-server', () => ({
  createSupabaseServerClient: async () => ({
    auth: { getUser: getUserMock },
    from: (table: string) => {
      if (table === 'contacts') {
        return {
          select: () => ({
            not: () => contactsSelectMock(),
          }),
        }
      }
      return {}
    },
  }),
}))

vi.mock('@/lib/connectors/google-token', () => ({
  getValidGoogleAccessToken: getValidGoogleAccessTokenMock,
}))

vi.stubGlobal('fetch', fetchMock)

import { GET } from './route'

function makeRequest(params: Record<string, string>) {
  const url = new URL('http://localhost/api/meetings/today')
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value)
  return new NextRequest(url)
}

const VALID_RANGE = {
  from: '2026-07-02T00:00:00.000Z',
  to: '2026-07-02T23:59:59.999Z',
}

describe('GET /api/meetings/today', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    contactsSelectMock.mockResolvedValue({ data: [] })
  })

  it('returns 401 when not authenticated', async () => {
    getUserMock.mockResolvedValue({ data: { user: null } })
    const res = await GET(makeRequest(VALID_RANGE))
    expect(res.status).toBe(401)
  })

  it('returns 400 for invalid query params', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } })
    const res = await GET(makeRequest({ from: 'not-a-date', to: VALID_RANGE.to }))
    expect(res.status).toBe(400)
  })

  it('returns googleConnected: false when no valid token exists', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } })
    getValidGoogleAccessTokenMock.mockResolvedValue(null)
    const res = await GET(makeRequest(VALID_RANGE))
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json).toEqual({ googleConnected: false, meetings: [] })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('returns error: true when the Google Calendar API call fails', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } })
    getValidGoogleAccessTokenMock.mockResolvedValue('valid-token')
    fetchMock.mockResolvedValue({ ok: false })
    const res = await GET(makeRequest(VALID_RANGE))
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.googleConnected).toBe(true)
    expect(json.error).toBe(true)
  })

  it('excludes events with no matched contact', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } })
    getValidGoogleAccessTokenMock.mockResolvedValue('valid-token')
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [
          {
            id: 'ev1',
            summary: 'Unknown meeting',
            start: { dateTime: '2026-07-02T10:00:00Z' },
            attendees: [{ email: 'stranger@example.com' }],
          },
        ],
      }),
    })
    contactsSelectMock.mockResolvedValue({ data: [] })
    const res = await GET(makeRequest(VALID_RANGE))
    const json = await res.json()
    expect(json.meetings).toEqual([])
  })

  it('matches attendees by email (case-insensitive) and groups multiple contacts under one meeting', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } })
    getValidGoogleAccessTokenMock.mockResolvedValue('valid-token')
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [
          {
            id: 'ev1',
            summary: 'Client Sync',
            start: { dateTime: '2026-07-02T10:00:00Z' },
            attendees: [{ email: 'Anna@Example.com' }, { email: 'ben@example.com' }, { email: 'stranger@example.com' }],
          },
        ],
      }),
    })
    contactsSelectMock.mockResolvedValue({
      data: [
        { id: 'c1', first_name: 'Anna', last_name: null, photo_url: null, email: 'anna@example.com' },
        { id: 'c2', first_name: 'Ben', last_name: null, photo_url: null, email: 'ben@example.com' },
      ],
    })
    const res = await GET(makeRequest(VALID_RANGE))
    const json = await res.json()
    expect(json.meetings).toHaveLength(1)
    expect(json.meetings[0].contacts).toHaveLength(2)
    expect(json.meetings[0].contacts.map((c: { id: string }) => c.id).sort()).toEqual(['c1', 'c2'])
  })

  it('marks events without a dateTime as all-day', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } })
    getValidGoogleAccessTokenMock.mockResolvedValue('valid-token')
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [
          {
            id: 'ev1',
            summary: 'All day thing',
            start: { date: '2026-07-02' },
            attendees: [{ email: 'anna@example.com' }],
          },
        ],
      }),
    })
    contactsSelectMock.mockResolvedValue({
      data: [{ id: 'c1', first_name: 'Anna', last_name: null, photo_url: null, email: 'anna@example.com' }],
    })
    const res = await GET(makeRequest(VALID_RANGE))
    const json = await res.json()
    expect(json.meetings[0].isAllDay).toBe(true)
    expect(json.meetings[0].startTime).toBeNull()
  })

  it('includes end time, location, and calendar date; passes through last_contacted_at (Refine 2026-07-03)', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } })
    getValidGoogleAccessTokenMock.mockResolvedValue('valid-token')
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [
          {
            id: 'ev1',
            summary: 'Client Sync',
            start: { dateTime: '2026-07-02T10:00:00+02:00' },
            end: { dateTime: '2026-07-02T11:00:00+02:00' },
            location: 'München',
            attendees: [{ email: 'anna@example.com' }],
          },
        ],
      }),
    })
    contactsSelectMock.mockResolvedValue({
      data: [
        { id: 'c1', first_name: 'Anna', last_name: null, photo_url: null, last_contacted_at: '2026-06-01T00:00:00Z', email: 'anna@example.com' },
      ],
    })
    const res = await GET(makeRequest(VALID_RANGE))
    const json = await res.json()
    expect(json.meetings[0].date).toBe('2026-07-02')
    expect(json.meetings[0].endTime).toBe('2026-07-02T11:00:00+02:00')
    expect(json.meetings[0].location).toBe('München')
    expect(json.meetings[0].contacts[0].last_contacted_at).toBe('2026-06-01T00:00:00Z')
  })

  it('sets endTime and location to null when absent from the Google event', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } })
    getValidGoogleAccessTokenMock.mockResolvedValue('valid-token')
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [
          {
            id: 'ev1',
            summary: 'All day thing',
            start: { date: '2026-07-02' },
            attendees: [{ email: 'anna@example.com' }],
          },
        ],
      }),
    })
    contactsSelectMock.mockResolvedValue({
      data: [{ id: 'c1', first_name: 'Anna', last_name: null, photo_url: null, last_contacted_at: null, email: 'anna@example.com' }],
    })
    const res = await GET(makeRequest(VALID_RANGE))
    const json = await res.json()
    expect(json.meetings[0].date).toBe('2026-07-02')
    expect(json.meetings[0].endTime).toBeNull()
    expect(json.meetings[0].location).toBeNull()
    expect(json.meetings[0].contacts[0].last_contacted_at).toBeNull()
  })

  it('sorts meetings chronologically by start time', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } })
    getValidGoogleAccessTokenMock.mockResolvedValue('valid-token')
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [
          {
            id: 'later',
            summary: 'Later',
            start: { dateTime: '2026-07-02T15:00:00Z' },
            attendees: [{ email: 'anna@example.com' }],
          },
          {
            id: 'earlier',
            summary: 'Earlier',
            start: { dateTime: '2026-07-02T09:00:00Z' },
            attendees: [{ email: 'anna@example.com' }],
          },
        ],
      }),
    })
    contactsSelectMock.mockResolvedValue({
      data: [{ id: 'c1', first_name: 'Anna', last_name: null, photo_url: null, email: 'anna@example.com' }],
    })
    const res = await GET(makeRequest(VALID_RANGE))
    const json = await res.json()
    expect(json.meetings.map((m: { id: string }) => m.id)).toEqual(['earlier', 'later'])
  })
})
