import { describe, it, expect, vi, beforeEach } from 'vitest'

const { listUsersMock, fromMock } = vi.hoisted(() => ({
  listUsersMock: vi.fn(),
  fromMock: vi.fn(),
}))
vi.mock('@/lib/supabase-admin', () => ({
  createSupabaseAdminClient: () => ({
    auth: { admin: { listUsers: listUsersMock } },
    from: fromMock,
  }),
}))

const { isLastSundayMock } = vi.hoisted(() => ({ isLastSundayMock: vi.fn() }))
vi.mock('@/lib/report-data', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/report-data')>()
  return { ...actual, isLastSundayOfMonth: isLastSundayMock }
})

const { genSectionsMock } = vi.hoisted(() => ({ genSectionsMock: vi.fn() }))
vi.mock('@/lib/report-ai', () => ({ generateReportSections: genSectionsMock }))

const { renderPdfMock } = vi.hoisted(() => ({ renderPdfMock: vi.fn() }))
vi.mock('@/lib/report-pdf', () => ({ renderReportPdf: renderPdfMock }))

const { sendMailMock } = vi.hoisted(() => ({ sendMailMock: vi.fn() }))
vi.mock('@/lib/report-mailer', () => ({ sendReportMail: sendMailMock }))

import { GET } from './route'

const SECRET = 'test-secret'

function thenable(data: unknown) {
  const builder: Record<string, unknown> = {}
  builder.select = () => builder
  builder.eq = () => builder
  builder.gte = () => builder
  builder.then = (resolve: (v: { data: unknown }) => void) => resolve({ data })
  return builder
}

function makeRequest(opts: { secret?: string; force?: boolean } = {}) {
  const url = `http://localhost/api/cron/monthly-report${opts.force ? '?force=1' : ''}`
  const headers: Record<string, string> = {}
  if (opts.secret) headers.authorization = `Bearer ${opts.secret}`
  return new Request(url, { headers })
}

describe('GET /api/cron/monthly-report', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.CRON_SECRET = SECRET
    isLastSundayMock.mockReturnValue(true)
    listUsersMock.mockResolvedValue({ data: { users: [{ id: 'u1', email: 'owner@example.com' }] }, error: null })
    genSectionsMock.mockResolvedValue({
      executiveSummary: 'Kurz.',
      activity: 'Aktiv.',
      relationshipHealth: 'Gesund.',
      recommendation: 'Mach X.',
    })
    renderPdfMock.mockResolvedValue(Buffer.from('pdf'))
    sendMailMock.mockResolvedValue(undefined)
  })

  it('returns 401 without a bearer secret', async () => {
    const res = await GET(makeRequest())
    expect(res.status).toBe(401)
    expect(sendMailMock).not.toHaveBeenCalled()
  })

  it('returns 401 with a wrong secret', async () => {
    const res = await GET(makeRequest({ secret: 'nope' }))
    expect(res.status).toBe(401)
  })

  it('skips when it is not the last Sunday and not forced', async () => {
    isLastSundayMock.mockReturnValue(false)
    const res = await GET(makeRequest({ secret: SECRET }))
    const json = await res.json()
    expect(json.skipped).toBeDefined()
    expect(sendMailMock).not.toHaveBeenCalled()
  })

  it('generates and sends a report for a user with contacts (forced)', async () => {
    isLastSundayMock.mockReturnValue(false)
    fromMock.mockImplementation((table: string) =>
      thenable(table === 'contacts' ? [{ id: 'c1', name: 'A', created_at: '2026-06-01T00:00:00+00:00', strength: 1, category: 'business', next_followup_at: null }] : [])
    )

    const res = await GET(makeRequest({ secret: SECRET, force: true }))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(genSectionsMock).toHaveBeenCalledOnce()
    expect(renderPdfMock).toHaveBeenCalledOnce()
    expect(sendMailMock).toHaveBeenCalledOnce()
    expect(json.results).toContainEqual({ user: 'owner@example.com', status: 'sent' })
  })

  it('skips a user with no contacts, no mail sent', async () => {
    fromMock.mockImplementation(() => thenable([]))
    const res = await GET(makeRequest({ secret: SECRET }))
    const json = await res.json()

    expect(sendMailMock).not.toHaveBeenCalled()
    expect(json.results).toContainEqual({ user: 'owner@example.com', status: 'skipped-no-contacts' })
  })
})
