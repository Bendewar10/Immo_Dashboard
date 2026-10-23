import { describe, it, expect, vi, beforeEach } from 'vitest'

const { getUserMock, conversationsLimitMock } = vi.hoisted(() => ({
  getUserMock: vi.fn(),
  conversationsLimitMock: vi.fn(),
}))

vi.mock('@/lib/supabase-server', () => ({
  createSupabaseServerClient: async () => ({
    auth: { getUser: getUserMock },
    from: () => ({
      select: () => ({ eq: () => ({ order: () => ({ limit: conversationsLimitMock }) }) }),
    }),
  }),
}))

import { GET } from './route'

describe('GET /api/chat/conversations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    conversationsLimitMock.mockResolvedValue({ data: [] })
  })

  it('returns 401 when not authenticated', async () => {
    getUserMock.mockResolvedValue({ data: { user: null } })
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it('returns conversations ordered most-recently-updated first', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } })
    conversationsLimitMock.mockResolvedValue({
      data: [
        { id: 'c1', title: 'Frage zu Tom', updated_at: '2026-06-29T10:00:00Z' },
        { id: 'c2', title: 'Geburtstage', updated_at: '2026-06-28T10:00:00Z' },
      ],
    })

    const res = await GET()
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.conversations).toHaveLength(2)
    expect(json.conversations[0].id).toBe('c1')
  })

  it('returns an empty list when the user has no conversations yet', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } })
    const res = await GET()
    const json = await res.json()
    expect(json.conversations).toEqual([])
  })
})
