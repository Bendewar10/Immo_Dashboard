import { describe, it, expect, vi, beforeEach } from 'vitest'

const { getUserMock, deleteConversationMock } = vi.hoisted(() => ({
  getUserMock: vi.fn(),
  deleteConversationMock: vi.fn(),
}))

vi.mock('@/lib/supabase-server', () => ({
  createSupabaseServerClient: async () => ({
    auth: { getUser: getUserMock },
    from: () => ({
      delete: () => ({ eq: () => ({ eq: deleteConversationMock }) }),
    }),
  }),
}))

import { DELETE } from './route'

function makeRequest() {
  return new Request('http://localhost/api/chat/conversations/x', { method: 'DELETE' })
}

const VALID_ID = '550e8400-e29b-41d4-a716-446655440000'

describe('DELETE /api/chat/conversations/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    deleteConversationMock.mockResolvedValue({ error: null, count: 1 })
  })

  it('returns 401 when not authenticated', async () => {
    getUserMock.mockResolvedValue({ data: { user: null } })
    const res = await DELETE(makeRequest(), { params: Promise.resolve({ id: VALID_ID }) })
    expect(res.status).toBe(401)
  })

  it('returns 400 for an invalid conversation id', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } })
    const res = await DELETE(makeRequest(), { params: Promise.resolve({ id: 'not-a-uuid' }) })
    expect(res.status).toBe(400)
  })

  it('returns 404 when the conversation does not exist or is not owned', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } })
    deleteConversationMock.mockResolvedValue({ error: null, count: 0 })
    const res = await DELETE(makeRequest(), { params: Promise.resolve({ id: VALID_ID }) })
    expect(res.status).toBe(404)
  })

  it('deletes the conversation and returns success', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } })
    const res = await DELETE(makeRequest(), { params: Promise.resolve({ id: VALID_ID }) })
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
  })

  it('returns 500 when the delete fails', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } })
    deleteConversationMock.mockResolvedValue({ error: { message: 'db error' }, count: null })
    const res = await DELETE(makeRequest(), { params: Promise.resolve({ id: VALID_ID }) })
    expect(res.status).toBe(500)
  })
})
