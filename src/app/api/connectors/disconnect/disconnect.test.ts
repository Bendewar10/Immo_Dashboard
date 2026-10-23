import { describe, it, expect, vi, beforeEach } from 'vitest'

const { getUserMock, fromMock, fetchMock } = vi.hoisted(() => ({
  getUserMock: vi.fn(),
  fromMock: vi.fn(),
  fetchMock: vi.fn(),
}))

vi.mock('@/lib/supabase-server', () => ({
  createSupabaseServerClient: async () => ({
    auth: { getUser: getUserMock },
    from: fromMock,
  }),
}))

vi.mock('@/lib/connectors/encryption', () => ({
  decrypt: (s: string) => s,
}))

vi.stubGlobal('fetch', fetchMock)

import { POST } from './route'

function makeRequest(body: unknown) {
  return new Request('http://localhost/api/connectors/disconnect', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/connectors/disconnect', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fromMock.mockReturnValue({
      select: () => ({
        eq: () => ({
          eq: () => ({
            single: () => ({ data: { access_token: 'enc_token' } }),
          }),
        }),
      }),
      delete: () => ({
        eq: () => ({ eq: () => ({}) }),
      }),
    })
    fetchMock.mockResolvedValue({ ok: true })
  })

  it('returns 401 when not authenticated', async () => {
    getUserMock.mockResolvedValue({ data: { user: null } })
    const res = await POST(makeRequest({ provider: 'google' }) as NextRequest)
    expect(res.status).toBe(401)
  })

  it('returns 400 for invalid provider', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } })
    const res = await POST(makeRequest({ provider: 'facebook' }) as NextRequest)
    expect(res.status).toBe(400)
  })

  it('returns 400 for missing body', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } })
    const req = new Request('http://localhost/api/connectors/disconnect', {
      method: 'POST',
      body: 'not-json',
    })
    const res = await POST(req as NextRequest)
    expect(res.status).toBe(400)
  })

  it('disconnects google and calls revoke', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } })
    const res = await POST(makeRequest({ provider: 'google' }) as NextRequest)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('oauth2.googleapis.com/revoke'),
      expect.objectContaining({ method: 'POST' })
    )
  })

  it('returns warning when google revoke fails but still deletes locally', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } })
    fetchMock.mockRejectedValue(new Error('network'))
    const res = await POST(makeRequest({ provider: 'google' }) as NextRequest)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.warning).toBeDefined()
  })
})

// NextRequest type alias for cast
type NextRequest = Parameters<typeof POST>[0]
