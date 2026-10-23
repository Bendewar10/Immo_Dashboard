import { describe, it, expect, vi, beforeEach } from 'vitest'

const { getUserMock, fromMock } = vi.hoisted(() => ({
  getUserMock: vi.fn(),
  fromMock: vi.fn(),
}))

vi.mock('@/lib/supabase-server', () => ({
  createSupabaseServerClient: async () => ({
    auth: { getUser: getUserMock },
    from: fromMock,
  }),
}))

import { GET } from './route'

const mockRow = {
  provider: 'google',
  account_email: 'test@gmail.com',
  status: 'active',
  connected_at: '2026-07-01T00:00:00Z',
}

describe('GET /api/connectors/status', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fromMock.mockReturnValue({
      select: () => ({ eq: () => ({ data: [mockRow] }) }),
    })
  })

  it('returns 401 when not authenticated', async () => {
    getUserMock.mockResolvedValue({ data: { user: null } })
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it('returns mapped connector statuses for authenticated user', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } })
    const res = await GET()
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json).toEqual([
      {
        provider: 'google',
        accountEmail: 'test@gmail.com',
        status: 'active',
        connectedAt: '2026-07-01T00:00:00Z',
      },
    ])
  })

  it('returns empty array when no connectors connected', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } })
    fromMock.mockReturnValue({
      select: () => ({ eq: () => ({ data: [] }) }),
    })
    const res = await GET()
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json).toEqual([])
  })
})
