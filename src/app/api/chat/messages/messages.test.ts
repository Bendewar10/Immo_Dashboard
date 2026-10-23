import { describe, it, expect, vi, beforeEach } from 'vitest'

const { getUserMock, messagesLimitMock, pendingLimitMock, latestConversationMock, conversationFetchMock } =
  vi.hoisted(() => ({
    getUserMock: vi.fn(),
    messagesLimitMock: vi.fn(),
    pendingLimitMock: vi.fn(),
    latestConversationMock: vi.fn(),
    conversationFetchMock: vi.fn(),
  }))

vi.mock('@/lib/supabase-server', () => ({
  createSupabaseServerClient: async () => ({
    auth: { getUser: getUserMock },
    from: (table: string) => {
      if (table === 'chat_messages') {
        return { select: () => ({ eq: () => ({ order: () => ({ limit: messagesLimitMock }) }) }) }
      }
      if (table === 'conversations') {
        return {
          select: () => ({
            eq: () => ({
              order: () => ({ limit: () => ({ single: latestConversationMock }) }),
              eq: () => ({ single: conversationFetchMock }),
            }),
          }),
        }
      }
      return {
        select: () => ({ eq: () => ({ eq: () => ({ order: () => ({ limit: pendingLimitMock }) }) }) }),
      }
    },
  }),
}))

import { GET } from './route'

function makeRequest(query = '') {
  return new Request(`http://localhost/api/chat/messages${query}`)
}

describe('GET /api/chat/messages', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    messagesLimitMock.mockResolvedValue({ data: [] })
    pendingLimitMock.mockResolvedValue({ data: [] })
    latestConversationMock.mockResolvedValue({ data: null })
    conversationFetchMock.mockResolvedValue({ data: { id: 'conv-1' } })
  })

  it('returns 401 when not authenticated', async () => {
    getUserMock.mockResolvedValue({ data: { user: null } })
    const res = await GET(makeRequest())
    expect(res.status).toBe(401)
  })

  it('returns an empty conversation when the user has none yet', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } })
    const res = await GET(makeRequest())
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.conversationId).toBeNull()
    expect(json.messages).toEqual([])
    expect(json.pendingAction).toBeNull()
  })

  it('auto-selects the most recently updated conversation when none is specified', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } })
    latestConversationMock.mockResolvedValue({ data: { id: 'conv-auto' } })
    conversationFetchMock.mockResolvedValue({ data: { id: 'conv-auto' } })
    messagesLimitMock.mockResolvedValue({
      data: [
        { id: 'm2', role: 'assistant', content: 'zweite', created_at: '2026-06-29T10:01:00Z' },
        { id: 'm1', role: 'user', content: 'erste', created_at: '2026-06-29T10:00:00Z' },
      ],
    })

    const res = await GET(makeRequest())
    const json = await res.json()

    expect(json.conversationId).toBe('conv-auto')
    expect(json.messages.map((m: { id: string }) => m.id)).toEqual(['m1', 'm2'])
  })

  it('returns 404 when the requested conversationId is not found/owned', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } })
    conversationFetchMock.mockResolvedValue({ data: null })
    const res = await GET(makeRequest('?conversationId=550e8400-e29b-41d4-a716-446655440000'))
    expect(res.status).toBe(404)
  })

  it('returns the open pending action when one exists', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } })
    pendingLimitMock.mockResolvedValue({
      data: [{ id: 'p1', chat_message_id: 'm1', action_type: 'delete_contact', summary: 'Löschen?', status: 'pending', created_at: 'now' }],
    })

    const res = await GET(makeRequest('?conversationId=conv-1'))
    const json = await res.json()

    expect(json.pendingAction.id).toBe('p1')
  })
})
