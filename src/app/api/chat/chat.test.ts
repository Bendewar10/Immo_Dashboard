import { describe, it, expect, vi, beforeEach } from 'vitest'

const { generateTextMock } = vi.hoisted(() => ({ generateTextMock: vi.fn() }))
vi.mock('ai', async () => {
  const actual = await vi.importActual<typeof import('ai')>('ai')
  return { ...actual, generateText: generateTextMock }
})

const {
  getUserMock,
  historyLimitMock,
  insertMessageMock,
  pendingLimitMock,
  conversationFetchMock,
  conversationInsertMock,
  userProfileMaybeSingleMock,
} = vi.hoisted(() => ({
  getUserMock: vi.fn(),
  historyLimitMock: vi.fn(),
  insertMessageMock: vi.fn(),
  pendingLimitMock: vi.fn(),
  conversationFetchMock: vi.fn(),
  conversationInsertMock: vi.fn(),
  userProfileMaybeSingleMock: vi.fn(),
}))

vi.mock('@/lib/supabase-server', () => ({
  createSupabaseServerClient: async () => ({
    auth: { getUser: getUserMock },
    from: (table: string) => {
      if (table === 'chat_messages') {
        return {
          select: () => ({ eq: () => ({ order: () => ({ limit: historyLimitMock }) }) }),
          insert: (row: { role: string; content: string }) => ({
            select: () => ({ single: () => insertMessageMock(row) }),
          }),
        }
      }
      if (table === 'conversations') {
        return {
          select: () => ({ eq: () => ({ eq: () => ({ single: conversationFetchMock }) }) }),
          insert: (row: { title: string }) => ({ select: () => ({ single: () => conversationInsertMock(row) }) }),
          update: () => ({ eq: () => Promise.resolve({ error: null }) }),
        }
      }
      if (table === 'user_profile') {
        return {
          select: () => ({ eq: () => ({ maybeSingle: userProfileMaybeSingleMock }) }),
        }
      }
      return {
        select: () => ({ eq: () => ({ eq: () => ({ order: () => ({ limit: pendingLimitMock }) }) }) }),
      }
    },
  }),
}))

import { POST } from './route'

function makeRequest(body: unknown) {
  return new Request('http://localhost/api/chat', { method: 'POST', body: JSON.stringify(body) })
}

describe('POST /api/chat', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    historyLimitMock.mockResolvedValue({ data: [] })
    pendingLimitMock.mockResolvedValue({ data: [] })
    userProfileMaybeSingleMock.mockResolvedValue({ data: null })
    conversationInsertMock.mockImplementation((row) =>
      Promise.resolve({ data: { id: 'conv-new', ...row }, error: null })
    )
    insertMessageMock.mockImplementation((row) =>
      Promise.resolve({ data: { id: `id-${row.role}`, ...row, created_at: 'now' }, error: null })
    )
  })

  it('returns 401 when not authenticated', async () => {
    getUserMock.mockResolvedValue({ data: { user: null } })
    const res = await POST(makeRequest({ content: 'Hallo' }))
    expect(res.status).toBe(401)
  })

  it('returns 400 for empty content', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } })
    const res = await POST(makeRequest({ content: '' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for content over 4000 characters', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } })
    const res = await POST(makeRequest({ content: 'x'.repeat(4001) }))
    expect(res.status).toBe(400)
  })

  it('returns 404 when conversationId is given but not found/owned', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } })
    conversationFetchMock.mockResolvedValue({ data: null })
    const res = await POST(makeRequest({ content: 'Hallo', conversationId: '550e8400-e29b-41d4-a716-446655440000' }))
    expect(res.status).toBe(404)
  })

  it('creates a new conversation when no conversationId is given, saves the user message, calls the AI, and returns the assistant reply with no pending action', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } })
    generateTextMock.mockResolvedValue({ text: 'Du hast aktuell 0 Kontakte.' })

    const res = await POST(makeRequest({ content: 'Wie viele Kontakte habe ich?' }))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(conversationInsertMock).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Wie viele Kontakte habe ich?' })
    )
    expect(json.conversationId).toBe('conv-new')
    expect(insertMessageMock).toHaveBeenCalledWith(
      expect.objectContaining({ role: 'user', content: 'Wie viele Kontakte habe ich?', conversation_id: 'conv-new' })
    )
    expect(json.message.content).toBe('Du hast aktuell 0 Kontakte.')
    expect(json.pendingAction).toBeNull()
  })

  it('reuses an existing conversation when conversationId is given', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } })
    const conversationId = '550e8400-e29b-41d4-a716-446655440000'
    conversationFetchMock.mockResolvedValue({ data: { id: conversationId } })
    generateTextMock.mockResolvedValue({ text: 'Klar, sag mir mehr.' })

    const res = await POST(makeRequest({ content: 'Noch eine Frage', conversationId }))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(conversationInsertMock).not.toHaveBeenCalled()
    expect(json.conversationId).toBe(conversationId)
  })

  it('returns the open pending action created during this turn', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } })
    generateTextMock.mockResolvedValue({ text: 'Ich warte auf deine Bestätigung.' })
    pendingLimitMock.mockResolvedValue({
      data: [{ id: 'p1', chat_message_id: 'id-user', action_type: 'delete_contact', summary: 'Löschen?', status: 'pending', created_at: 'now' }],
    })

    const res = await POST(makeRequest({ content: 'Lösch Tom.' }))
    const json = await res.json()

    expect(json.pendingAction.id).toBe('p1')
  })

  it('returns 502 when the AI call fails', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } })
    generateTextMock.mockRejectedValue(new Error('provider down'))

    const res = await POST(makeRequest({ content: 'Hallo' }))
    expect(res.status).toBe(502)
  })
})
