import { describe, it, expect, vi, beforeEach } from 'vitest'

const { generateTextMock } = vi.hoisted(() => ({ generateTextMock: vi.fn() }))
vi.mock('ai', () => ({ generateText: generateTextMock }))

const { getUserMock, contactsMock, interactionsMock } = vi.hoisted(() => ({
  getUserMock: vi.fn(),
  contactsMock: vi.fn(),
  interactionsMock: vi.fn(),
}))

vi.mock('@/lib/supabase-server', () => ({
  createSupabaseServerClient: async () => ({
    auth: { getUser: getUserMock },
    from: (table: string) => {
      if (table === 'contacts') {
        return { select: () => contactsMock() }
      }
      return { select: () => ({ gte: () => interactionsMock() }) }
    },
  }),
}))

import { POST } from './route'

function makeRequest(body: unknown) {
  return new Request('http://localhost/api/network-insights', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

const manyInteractions = [
  { channel: 'call', occurred_at: '2026-06-01' },
  { channel: 'call', occurred_at: '2026-06-02' },
  { channel: 'meeting', occurred_at: '2026-06-03' },
]

describe('POST /api/network-insights', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    contactsMock.mockResolvedValue({ data: [{ category: 'business', strength: 1, next_followup_at: null }] })
    interactionsMock.mockResolvedValue({ data: manyInteractions })
  })

  it('returns 401 when not authenticated', async () => {
    getUserMock.mockResolvedValue({ data: { user: null } })
    const res = await POST(makeRequest({ period: 90 }))
    expect(res.status).toBe(401)
  })

  it('returns 400 for invalid period', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } })
    const res = await POST(makeRequest({ period: 7 }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when fewer than 3 interactions exist in the period', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } })
    interactionsMock.mockResolvedValue({ data: [manyInteractions[0]] })
    const res = await POST(makeRequest({ period: 90 }))
    expect(res.status).toBe(400)
  })

  it('returns generated text when enough data exists', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } })
    generateTextMock.mockResolvedValue({ text: 'Business-Kontakte liefen gut, Investoren vernachlässigt.' })

    const res = await POST(makeRequest({ period: 90 }))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.text).toBe('Business-Kontakte liefen gut, Investoren vernachlässigt.')
  })

  it('returns 502 when the AI provider call fails', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } })
    generateTextMock.mockRejectedValue(new Error('provider down'))

    const res = await POST(makeRequest({ period: 90 }))
    expect(res.status).toBe(502)
  })
})
