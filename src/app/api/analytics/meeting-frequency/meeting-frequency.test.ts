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

function makeRequest(period: string) {
  const url = new URL('http://localhost/api/analytics/meeting-frequency')
  url.searchParams.set('period', period)
  return new NextRequest(url)
}

describe('GET /api/analytics/meeting-frequency', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    contactsSelectMock.mockResolvedValue({ data: [] })
  })

  it('returns 401 when not authenticated', async () => {
    getUserMock.mockResolvedValue({ data: { user: null } })
    const res = await GET(makeRequest('90'))
    expect(res.status).toBe(401)
  })

  it('returns 400 for an invalid period', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } })
    const res = await GET(makeRequest('45'))
    expect(res.status).toBe(400)
  })

  it('returns googleConnected: false when no valid token exists', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } })
    getValidGoogleAccessTokenMock.mockResolvedValue(null)
    const res = await GET(makeRequest('90'))
    const json = await res.json()
    expect(json).toEqual({ googleConnected: false, entries: [] })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('returns error: true when the Google Calendar API call fails', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } })
    getValidGoogleAccessTokenMock.mockResolvedValue('valid-token')
    fetchMock.mockResolvedValue({ ok: false })
    const res = await GET(makeRequest('90'))
    const json = await res.json()
    expect(json.googleConnected).toBe(true)
    expect(json.error).toBe(true)
  })

  it('counts meetings per matched contact and sorts descending', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } })
    getValidGoogleAccessTokenMock.mockResolvedValue('valid-token')
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [
          { attendees: [{ email: 'anna@example.com' }] },
          { attendees: [{ email: 'anna@example.com' }] },
          { attendees: [{ email: 'ben@example.com' }] },
          { attendees: [{ email: 'stranger@example.com' }] },
        ],
      }),
    })
    contactsSelectMock.mockResolvedValue({
      data: [
        { id: 'c1', first_name: 'Anna', last_name: null, photo_url: null, email: 'anna@example.com' },
        { id: 'c2', first_name: 'Ben', last_name: null, photo_url: null, email: 'ben@example.com' },
      ],
    })
    const res = await GET(makeRequest('90'))
    const json = await res.json()
    expect(json.entries).toEqual([
      { contactId: 'c1', first_name: 'Anna', last_name: null, photo_url: null, count: 2 },
      { contactId: 'c2', first_name: 'Ben', last_name: null, photo_url: null, count: 1 },
    ])
  })

  it('matches attendee emails case-insensitively', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } })
    getValidGoogleAccessTokenMock.mockResolvedValue('valid-token')
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ items: [{ attendees: [{ email: 'Anna@Example.com' }] }] }),
    })
    contactsSelectMock.mockResolvedValue({
      data: [{ id: 'c1', first_name: 'Anna', last_name: null, photo_url: null, email: 'anna@example.com' }],
    })
    const res = await GET(makeRequest('90'))
    const json = await res.json()
    expect(json.entries).toHaveLength(1)
    expect(json.entries[0].count).toBe(1)
  })

  it('limits the result to the top 10 contacts', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } })
    getValidGoogleAccessTokenMock.mockResolvedValue('valid-token')
    const contacts = Array.from({ length: 12 }, (_, i) => ({
      id: `c${i}`,
      first_name: `Contact${i}`,
      last_name: null,
      photo_url: null,
      email: `contact${i}@example.com`,
    }))
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ items: contacts.map((c) => ({ attendees: [{ email: c.email }] })) }),
    })
    contactsSelectMock.mockResolvedValue({ data: contacts })
    const res = await GET(makeRequest('365'))
    const json = await res.json()
    expect(json.entries).toHaveLength(10)
  })

  it('excludes attendees with no matching contact', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } })
    getValidGoogleAccessTokenMock.mockResolvedValue('valid-token')
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ items: [{ attendees: [{ email: 'stranger@example.com' }] }] }),
    })
    contactsSelectMock.mockResolvedValue({ data: [] })
    const res = await GET(makeRequest('30'))
    const json = await res.json()
    expect(json.entries).toEqual([])
  })
})
