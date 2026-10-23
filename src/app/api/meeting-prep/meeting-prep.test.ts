import { describe, it, expect, vi, beforeEach } from 'vitest'

const { generateTextMock } = vi.hoisted(() => ({ generateTextMock: vi.fn() }))
vi.mock('ai', () => ({ generateText: generateTextMock }))

const { getUserMock, contactSingleMock, interactionsBuilderMock } = vi.hoisted(() => ({
  getUserMock: vi.fn(),
  contactSingleMock: vi.fn(),
  interactionsBuilderMock: vi.fn(),
}))

vi.mock('@/lib/supabase-server', () => ({
  createSupabaseServerClient: async () => ({
    auth: { getUser: getUserMock },
    from: (table: string) => {
      if (table === 'contacts') {
        return {
          select: () => ({
            eq: () => ({
              single: contactSingleMock,
            }),
          }),
        }
      }
      return {
        select: () => ({
          eq: () => ({
            order: () => ({
              limit: interactionsBuilderMock,
            }),
          }),
        }),
      }
    },
  }),
}))

import { POST } from './route'

function makeRequest(body: unknown) {
  return new Request('http://localhost/api/meeting-prep', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

describe('POST /api/meeting-prep', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    interactionsBuilderMock.mockResolvedValue({ data: [] })
  })

  it('returns 401 when not authenticated', async () => {
    getUserMock.mockResolvedValue({ data: { user: null } })
    const res = await POST(makeRequest({ contactId: '550e8400-e29b-41d4-a716-446655440000' }))
    expect(res.status).toBe(401)
  })

  it('returns 400 for invalid contactId', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } })
    const res = await POST(makeRequest({ contactId: 'not-a-uuid' }))
    expect(res.status).toBe(400)
  })

  it('returns 404 when contact is not found (or not owned)', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } })
    contactSingleMock.mockResolvedValue({ data: null })
    const res = await POST(makeRequest({ contactId: '550e8400-e29b-41d4-a716-446655440000' }))
    expect(res.status).toBe(404)
  })

  it('generates a summary using recent interaction notes', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } })
    contactSingleMock.mockResolvedValue({ data: { first_name: 'Anna', notes: null, context: null, commonalities: null } })
    interactionsBuilderMock.mockResolvedValue({ data: [{ note: 'Letztes Mal über den neuen Job gesprochen' }] })
    generateTextMock.mockResolvedValue({ text: 'Zuletzt ging es um ihren neuen Job.' })

    const res = await POST(makeRequest({ contactId: '550e8400-e29b-41d4-a716-446655440000' }))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.text).toBe('Zuletzt ging es um ihren neuen Job.')
    const promptArg = generateTextMock.mock.calls[0][0].prompt as string
    expect(promptArg).toContain('neuen Job gesprochen')
  })

  it('generates a summary noting no prior history when there are no interactions', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } })
    contactSingleMock.mockResolvedValue({ data: { first_name: 'Anna', notes: null, context: null, commonalities: null } })
    interactionsBuilderMock.mockResolvedValue({ data: [] })
    generateTextMock.mockResolvedValue({ text: 'Noch keine bisherige Historie mit Anna.' })

    const res = await POST(makeRequest({ contactId: '550e8400-e29b-41d4-a716-446655440000' }))
    expect(res.status).toBe(200)
    const promptArg = generateTextMock.mock.calls[0][0].prompt as string
    expect(promptArg).toContain('noch keine bisherige')
  })

  it('includes commonalities in the prompt when present', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } })
    contactSingleMock.mockResolvedValue({
      data: { first_name: 'Anna', notes: null, context: null, commonalities: 'Beide aus München' },
    })
    generateTextMock.mockResolvedValue({ text: 'Hey Anna!' })

    await POST(makeRequest({ contactId: '550e8400-e29b-41d4-a716-446655440000' }))
    const promptArg = generateTextMock.mock.calls[0][0].prompt as string
    expect(promptArg).toContain('Beide aus München')
  })

  it('returns 502 when the AI provider call fails', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } })
    contactSingleMock.mockResolvedValue({ data: { first_name: 'Anna', notes: null, context: null, commonalities: null } })
    generateTextMock.mockRejectedValue(new Error('provider down'))

    const res = await POST(makeRequest({ contactId: '550e8400-e29b-41d4-a716-446655440000' }))
    expect(res.status).toBe(502)
  })
})
