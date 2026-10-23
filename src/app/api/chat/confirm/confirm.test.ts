import { describe, it, expect, vi, beforeEach } from 'vitest'

const {
  getUserMock,
  pendingFetchMock,
  pendingUpdateMock,
  contactsDeleteMock,
  contactsBulkDeleteMock,
  contactsUpdateMock,
  interactionsDeleteMock,
  chatInsertMock,
} = vi.hoisted(() => ({
  getUserMock: vi.fn(),
  pendingFetchMock: vi.fn(),
  pendingUpdateMock: vi.fn(),
  contactsDeleteMock: vi.fn(),
  contactsBulkDeleteMock: vi.fn(),
  contactsUpdateMock: vi.fn(),
  interactionsDeleteMock: vi.fn(),
  chatInsertMock: vi.fn(),
}))

vi.mock('@/lib/supabase-server', () => ({
  createSupabaseServerClient: async () => ({
    auth: { getUser: getUserMock },
    from: (table: string) => {
      if (table === 'pending_actions') {
        return {
          select: () => ({ eq: () => ({ eq: () => ({ eq: () => ({ single: pendingFetchMock }) }) }) }),
          update: () => ({ eq: pendingUpdateMock }),
        }
      }
      if (table === 'contacts') {
        return {
          delete: () => ({
            eq: () => ({ eq: contactsDeleteMock }),
            in: () => ({ eq: contactsBulkDeleteMock }),
          }),
          update: () => ({ eq: () => ({ eq: contactsUpdateMock }) }),
        }
      }
      if (table === 'interactions') {
        return { delete: () => ({ eq: () => ({ eq: interactionsDeleteMock }) }) }
      }
      return {
        insert: (row: { role: string; content: string }) => ({
          select: () => ({ single: () => chatInsertMock(row) }),
        }),
      }
    },
  }),
}))

import { POST } from './route'

function makeRequest(body: unknown) {
  return new Request('http://localhost/api/chat/confirm', { method: 'POST', body: JSON.stringify(body) })
}

const VALID_ID = '550e8400-e29b-41d4-a716-446655440000'

describe('POST /api/chat/confirm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    pendingUpdateMock.mockResolvedValue({ error: null })
    chatInsertMock.mockImplementation((row) => Promise.resolve({ data: { id: 'm1', ...row, created_at: 'now' }, error: null }))
  })

  it('returns 401 when not authenticated', async () => {
    getUserMock.mockResolvedValue({ data: { user: null } })
    const res = await POST(makeRequest({ pendingActionId: VALID_ID, decision: 'confirm' }))
    expect(res.status).toBe(401)
  })

  it('returns 400 for invalid decision', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } })
    const res = await POST(makeRequest({ pendingActionId: VALID_ID, decision: 'maybe' }))
    expect(res.status).toBe(400)
  })

  it('returns 409 when the pending action no longer exists', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } })
    pendingFetchMock.mockResolvedValue({ data: null })
    const res = await POST(makeRequest({ pendingActionId: VALID_ID, decision: 'confirm' }))
    expect(res.status).toBe(409)
  })

  it('declines without changing any data', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } })
    pendingFetchMock.mockResolvedValue({ data: { id: VALID_ID, action_type: 'delete_contact', payload: { contactId: 'c1' } } })

    const res = await POST(makeRequest({ pendingActionId: VALID_ID, decision: 'decline' }))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.message.content).toContain('abgebrochen')
    expect(contactsDeleteMock).not.toHaveBeenCalled()
  })

  it('confirms delete_contact and deletes the contact', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } })
    pendingFetchMock.mockResolvedValue({ data: { id: VALID_ID, action_type: 'delete_contact', payload: { contactId: 'c1' } } })
    contactsDeleteMock.mockResolvedValue({ error: null, count: 1 })

    const res = await POST(makeRequest({ pendingActionId: VALID_ID, decision: 'confirm' }))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.message.content).toContain('wurde gelöscht')
  })

  it('reports the contact as already gone when count is 0', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } })
    pendingFetchMock.mockResolvedValue({ data: { id: VALID_ID, action_type: 'delete_contact', payload: { contactId: 'c1' } } })
    contactsDeleteMock.mockResolvedValue({ error: null, count: 0 })

    const res = await POST(makeRequest({ pendingActionId: VALID_ID, decision: 'confirm' }))
    const json = await res.json()

    expect(json.message.content).toContain('existiert nicht mehr')
  })

  it('confirms delete_interaction and deletes the interaction', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } })
    pendingFetchMock.mockResolvedValue({ data: { id: VALID_ID, action_type: 'delete_interaction', payload: { interactionId: 'i1' } } })
    interactionsDeleteMock.mockResolvedValue({ error: null, count: 1 })

    const res = await POST(makeRequest({ pendingActionId: VALID_ID, decision: 'confirm' }))
    const json = await res.json()

    expect(json.message.content).toContain('wurde gelöscht')
  })

  it('confirms overwrite_contact_field and updates the field', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } })
    pendingFetchMock.mockResolvedValue({
      data: { id: VALID_ID, action_type: 'overwrite_contact_field', payload: { contactId: 'c1', field: 'employer', newValue: 'Acme' } },
    })
    contactsUpdateMock.mockResolvedValue({ error: null, count: 1 })

    const res = await POST(makeRequest({ pendingActionId: VALID_ID, decision: 'confirm' }))
    const json = await res.json()

    expect(json.message.content).toContain('geändert')
  })

  it('confirms bulk_delete_contacts and deletes all listed contacts', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } })
    pendingFetchMock.mockResolvedValue({
      data: { id: VALID_ID, action_type: 'bulk_delete_contacts', payload: { contactIds: ['c1', 'c2'] } },
    })
    contactsBulkDeleteMock.mockResolvedValue({ error: null, count: 2 })

    const res = await POST(makeRequest({ pendingActionId: VALID_ID, decision: 'confirm' }))
    const json = await res.json()

    expect(json.message.content).toContain('2 Kontakte')
  })
})
