import { describe, it, expect, vi, beforeEach } from 'vitest'

const { getUserMock, enrichMock } = vi.hoisted(() => ({
  getUserMock: vi.fn(),
  enrichMock: vi.fn(),
}))

vi.mock('@/lib/supabase-server', () => ({
  createSupabaseServerClient: async () => ({ auth: { getUser: getUserMock } }),
}))
vi.mock('@/lib/supabase-admin', () => ({
  createSupabaseAdminClient: () => ({}),
}))
vi.mock('@/lib/photo-enrichment', () => ({ enrichUserPhotos: enrichMock }))

import { POST } from './route'

describe('POST /api/enrich-photos', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.APIFY_TOKEN = 'apify_api_test'
  })

  it('returns 401 when not authenticated', async () => {
    getUserMock.mockResolvedValue({ data: { user: null } })
    const res = await POST()
    expect(res.status).toBe(401)
    expect(enrichMock).not.toHaveBeenCalled()
  })

  it('returns 503 when APIFY_TOKEN is not configured', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } })
    delete process.env.APIFY_TOKEN
    const res = await POST()
    expect(res.status).toBe(503)
    expect(enrichMock).not.toHaveBeenCalled()
  })

  it('runs enrichment and returns the result for an authenticated user', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } })
    enrichMock.mockResolvedValue({ candidates: 3, scraped: 3, photosSet: 2, errors: 0 })
    const res = await POST()
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.photosSet).toBe(2)
    expect(enrichMock).toHaveBeenCalledWith(expect.anything(), 'u1', 'apify_api_test')
  })

  it('returns 502 when enrichment throws', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } })
    enrichMock.mockRejectedValue(new Error('boom'))
    const res = await POST()
    expect(res.status).toBe(502)
  })
})
