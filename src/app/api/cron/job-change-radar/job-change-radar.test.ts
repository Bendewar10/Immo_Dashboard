import { describe, it, expect, vi, beforeEach } from 'vitest'

const { runRadarMock, listUsersMock } = vi.hoisted(() => ({
  runRadarMock: vi.fn(),
  listUsersMock: vi.fn(),
}))

vi.mock('@/lib/job-change-radar', () => ({ runJobChangeRadar: runRadarMock }))
vi.mock('@/lib/supabase-admin', () => ({
  createSupabaseAdminClient: () => ({
    auth: { admin: { listUsers: listUsersMock } },
  }),
}))

import { GET } from './route'

function makeRequest(opts: { secret?: string; force?: boolean } = {}) {
  const url = `http://localhost/api/cron/job-change-radar${opts.force ? '?force=1' : ''}`
  const headers = new Headers()
  if (opts.secret) headers.set('authorization', `Bearer ${opts.secret}`)
  return new Request(url, { headers })
}

describe('GET /api/cron/job-change-radar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.unstubAllEnvs()
    vi.stubEnv('CRON_SECRET', 'test-secret')
    vi.stubEnv('APIFY_TOKEN', 'test-token')
    listUsersMock.mockResolvedValue({ data: { users: [{ id: 'u1' }] }, error: null })
    runRadarMock.mockResolvedValue({
      candidates: 2,
      scraped: 2,
      updated: 1,
      eventsCreated: 1,
      errors: 0,
    })
  })

  it('returns 401 without valid secret', async () => {
    const res = await GET(makeRequest({ secret: 'wrong' }))
    expect(res.status).toBe(401)
  })

  it('returns 401 when CRON_SECRET missing', async () => {
    vi.stubEnv('CRON_SECRET', '')
    const res = await GET(makeRequest({ secret: '' }))
    expect(res.status).toBe(401)
  })

  it('returns 503 when APIFY_TOKEN missing', async () => {
    vi.stubEnv('APIFY_TOKEN', '')
    const res = await GET(makeRequest({ secret: 'test-secret' }))
    expect(res.status).toBe(503)
  })

  it('skips outside the second day of month (without force)', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-15T05:00:00Z'))
    const res = await GET(makeRequest({ secret: 'test-secret' }))
    const json = await res.json()
    expect(json.skipped).toBeDefined()
    expect(runRadarMock).not.toHaveBeenCalled()
    vi.useRealTimers()
  })

  it('runs on the second day of month for every user', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-02T05:00:00Z'))
    listUsersMock.mockResolvedValue({ data: { users: [{ id: 'u1' }, { id: 'u2' }] }, error: null })

    const res = await GET(makeRequest({ secret: 'test-secret' }))
    const json = await res.json()

    expect(json.ran).toBe(true)
    expect(runRadarMock).toHaveBeenCalledTimes(2)
    expect(json.results).toHaveLength(2)
    expect(json.results[0].eventsCreated).toBe(1)
    vi.useRealTimers()
  })

  it('runs with ?force=1 regardless of date', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-15T05:00:00Z'))
    const res = await GET(makeRequest({ secret: 'test-secret', force: true }))
    const json = await res.json()
    expect(json.ran).toBe(true)
    vi.useRealTimers()
  })

  it('continues with other users when one fails', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-02T05:00:00Z'))
    listUsersMock.mockResolvedValue({ data: { users: [{ id: 'u1' }, { id: 'u2' }] }, error: null })
    runRadarMock
      .mockRejectedValueOnce(new Error('apify down'))
      .mockResolvedValueOnce({ candidates: 1, scraped: 1, updated: 0, eventsCreated: 0, errors: 0 })

    const res = await GET(makeRequest({ secret: 'test-secret' }))
    const json = await res.json()

    expect(json.results[0].status).toBe('error')
    expect(json.results[1].status).toBe('ok')
    vi.useRealTimers()
  })

  it('returns 500 when users cannot be listed', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-02T05:00:00Z'))
    listUsersMock.mockResolvedValue({ data: null, error: { message: 'boom' } })
    const res = await GET(makeRequest({ secret: 'test-secret' }))
    expect(res.status).toBe(500)
    vi.useRealTimers()
  })
})
