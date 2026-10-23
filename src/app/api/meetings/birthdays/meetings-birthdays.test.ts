import { describe, it, expect, vi, beforeEach } from 'vitest'

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
            is: () => contactsSelectMock(),
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

describe('GET /api/meetings/birthdays', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    contactsSelectMock.mockResolvedValue({ data: [] })
  })

  it('returns 401 when not authenticated', async () => {
    getUserMock.mockResolvedValue({ data: { user: null } })
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it('returns googleConnected: false when no valid token exists', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } })
    getValidGoogleAccessTokenMock.mockResolvedValue(null)
    const res = await GET()
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json).toEqual({ googleConnected: false, suggestions: [] })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('returns error: true when the Google Calendar API call fails', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } })
    getValidGoogleAccessTokenMock.mockResolvedValue('valid-token')
    fetchMock.mockResolvedValue({ ok: false })
    const res = await GET()
    const json = await res.json()
    expect(json.googleConnected).toBe(true)
    expect(json.error).toBe(true)
  })

  it('matches a birthday event ("Geburtstag von X") against a contact with no birthday set', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } })
    getValidGoogleAccessTokenMock.mockResolvedValue('valid-token')
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [{ summary: 'Geburtstag von Anna Müller', start: { date: '2026-09-15' } }],
      }),
    })
    contactsSelectMock.mockResolvedValue({
      data: [{ id: 'c1', first_name: 'Anna', last_name: 'Müller' }],
    })
    const res = await GET()
    const json = await res.json()
    expect(json.suggestions).toEqual([{ contactId: 'c1', first_name: 'Anna', last_name: 'Müller', month: 9, day: 15 }])
  })

  it('matches an English-style birthday event ("X\'s Birthday") by first name when unambiguous', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } })
    getValidGoogleAccessTokenMock.mockResolvedValue('valid-token')
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [{ summary: "Ben's Birthday", start: { date: '2026-11-02' } }],
      }),
    })
    contactsSelectMock.mockResolvedValue({
      data: [{ id: 'c2', first_name: 'Ben', last_name: null }],
    })
    const res = await GET()
    const json = await res.json()
    expect(json.suggestions).toEqual([{ contactId: 'c2', first_name: 'Ben', last_name: null, month: 11, day: 2 }])
  })

  it('skips ambiguous first-name matches (two contacts share the same first name)', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } })
    getValidGoogleAccessTokenMock.mockResolvedValue('valid-token')
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [{ summary: "Anna's Birthday", start: { date: '2026-09-15' } }],
      }),
    })
    contactsSelectMock.mockResolvedValue({
      data: [
        { id: 'c1', first_name: 'Anna', last_name: 'Müller' },
        { id: 'c3', first_name: 'Anna', last_name: 'Schmidt' },
      ],
    })
    const res = await GET()
    const json = await res.json()
    expect(json.suggestions).toEqual([])
  })

  it('ignores non-all-day events even if the title matches the birthday pattern', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } })
    getValidGoogleAccessTokenMock.mockResolvedValue('valid-token')
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [{ summary: 'Geburtstag von Anna', start: { dateTime: '2026-09-15T10:00:00Z' } }],
      }),
    })
    contactsSelectMock.mockResolvedValue({
      data: [{ id: 'c1', first_name: 'Anna', last_name: null }],
    })
    const res = await GET()
    const json = await res.json()
    expect(json.suggestions).toEqual([])
  })

  it('ignores events whose title does not match the birthday pattern', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } })
    getValidGoogleAccessTokenMock.mockResolvedValue('valid-token')
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [{ summary: 'Team Offsite', start: { date: '2026-09-15' } }],
      }),
    })
    contactsSelectMock.mockResolvedValue({ data: [] })
    const res = await GET()
    const json = await res.json()
    expect(json.suggestions).toEqual([])
  })

  it('deduplicates suggestions when multiple events match the same contact', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } })
    getValidGoogleAccessTokenMock.mockResolvedValue('valid-token')
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [
          { summary: 'Geburtstag von Anna Müller', start: { date: '2026-09-15' } },
          { summary: 'Geburtstag von Anna Müller', start: { date: '2026-09-15' } },
        ],
      }),
    })
    contactsSelectMock.mockResolvedValue({
      data: [{ id: 'c1', first_name: 'Anna', last_name: 'Müller' }],
    })
    const res = await GET()
    const json = await res.json()
    expect(json.suggestions).toHaveLength(1)
  })
})
