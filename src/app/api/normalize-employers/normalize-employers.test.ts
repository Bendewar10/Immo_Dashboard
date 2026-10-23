import { describe, it, expect, vi, beforeEach } from 'vitest'

const { generateObjectMock } = vi.hoisted(() => ({ generateObjectMock: vi.fn() }))
vi.mock('ai', () => ({ generateObject: generateObjectMock }))

const { getUserMock, selectResultMock, updateMock, updateCalls } = vi.hoisted(() => {
  const updateCalls: {
    payload: Record<string, unknown>
    filters: Record<string, unknown>
  }[] = []
  return {
    getUserMock: vi.fn(),
    selectResultMock: vi.fn(),
    updateMock: vi.fn(),
    updateCalls,
  }
})

vi.mock('@/lib/supabase-server', () => ({
  createSupabaseServerClient: async () => ({
    auth: { getUser: getUserMock },
    from: () => ({
      select: () => ({
        eq: () => ({
          not: selectResultMock,
        }),
      }),
      update: (payload: Record<string, unknown>) => ({
        eq: (col: string, value: unknown) => ({
          is: (isCol: string, isValue: unknown) => ({
            in: (inCol: string, inValues: unknown) => {
              updateCalls.push({
                payload,
                filters: { [col]: value, [isCol]: isValue, [inCol]: inValues },
              })
              return updateMock()
            },
          }),
        }),
      }),
    }),
  }),
}))

import { POST } from './route'

describe('POST /api/normalize-employers', () => {
  // Uhr pro Test über das Rate-Limit-Fenster hinaus vorstellen,
  // damit das In-Memory-Limit nicht zwischen Tests überläuft
  let clock = 0
  beforeEach(() => {
    vi.clearAllMocks()
    updateCalls.length = 0
    updateMock.mockResolvedValue({ error: null })
    clock += 61_000
    vi.spyOn(Date, 'now').mockImplementation(() => clock)
  })

  it('returns 401 when not authenticated', async () => {
    getUserMock.mockResolvedValue({ data: { user: null } })
    const res = await POST()
    expect(res.status).toBe(401)
  })

  it('returns 500 when contacts cannot be loaded', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } })
    selectResultMock.mockResolvedValue({ data: null, error: { message: 'boom' } })
    const res = await POST()
    expect(res.status).toBe(500)
  })

  it('returns normalized: 0 without AI call when nothing is pending', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } })
    selectResultMock.mockResolvedValue({
      data: [
        { employer: 'McKinsey', employer_normalized: 'McKinsey & Company' },
        { employer: '   ', employer_normalized: null },
      ],
      error: null,
    })
    const res = await POST()
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.normalized).toBe(0)
    expect(generateObjectMock).not.toHaveBeenCalled()
  })

  it('normalizes pending employers and groups updates by canonical name', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } })
    selectResultMock.mockResolvedValue({
      data: [
        { employer: 'McKinsey', employer_normalized: null },
        { employer: 'McKinsey & Co.', employer_normalized: null },
        { employer: 'Bain Capital', employer_normalized: null },
      ],
      error: null,
    })
    generateObjectMock.mockResolvedValue({
      object: {
        mappings: [
          { raw: 'McKinsey', canonical: 'McKinsey & Company' },
          { raw: 'McKinsey & Co.', canonical: 'McKinsey & Company' },
          { raw: 'Bain Capital', canonical: 'Bain Capital' },
        ],
      },
    })

    const res = await POST()
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.normalized).toBe(3)
    expect(updateCalls).toHaveLength(2)

    const mckinsey = updateCalls.find(
      (c) => c.payload.employer_normalized === 'McKinsey & Company'
    )
    expect(mckinsey).toBeDefined()
    expect(mckinsey!.filters.user_id).toBe('u1')
    expect(mckinsey!.filters.employer_normalized).toBeNull()
    expect(mckinsey!.filters.employer).toEqual(['McKinsey', 'McKinsey & Co.'])
    expect(mckinsey!.payload.employer_normalized_source).toBe('ai')
  })

  it('passes known canonical names and pending raws to the AI prompt', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } })
    selectResultMock.mockResolvedValue({
      data: [
        { employer: 'BCG', employer_normalized: null },
        { employer: 'McKinsey', employer_normalized: 'McKinsey & Company' },
      ],
      error: null,
    })
    generateObjectMock.mockResolvedValue({
      object: { mappings: [{ raw: 'BCG', canonical: 'Boston Consulting Group' }] },
    })

    await POST()

    const promptArg = generateObjectMock.mock.calls[0][0].prompt as string
    expect(promptArg).toContain('McKinsey & Company')
    expect(promptArg).toContain('BCG')
  })

  it('falls back to identity mapping when AI omits a raw name', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } })
    selectResultMock.mockResolvedValue({
      data: [
        { employer: 'Siemens AG', employer_normalized: null },
        { employer: 'Vergessen GmbH', employer_normalized: null },
      ],
      error: null,
    })
    generateObjectMock.mockResolvedValue({
      object: { mappings: [{ raw: 'Siemens AG', canonical: 'Siemens' }] },
    })

    const res = await POST()
    const json = await res.json()

    expect(json.normalized).toBe(2)
    const identity = updateCalls.find(
      (c) => c.payload.employer_normalized === 'Vergessen GmbH'
    )
    expect(identity).toBeDefined()
    expect(identity!.filters.employer).toEqual(['Vergessen GmbH'])
    expect(res.status).toBe(200)
  })

  it('ignores hallucinated raw names not in the batch', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } })
    selectResultMock.mockResolvedValue({
      data: [{ employer: 'BCG', employer_normalized: null }],
      error: null,
    })
    generateObjectMock.mockResolvedValue({
      object: {
        mappings: [
          { raw: 'BCG', canonical: 'Boston Consulting Group' },
          { raw: 'Erfunden AG', canonical: 'Halluzination GmbH' },
        ],
      },
    })

    const res = await POST()
    const json = await res.json()

    expect(json.normalized).toBe(1)
    expect(
      updateCalls.some((c) => c.payload.employer_normalized === 'Halluzination GmbH')
    ).toBe(false)
    expect(res.status).toBe(200)
  })

  it('returns 502 when the AI provider fails', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } })
    selectResultMock.mockResolvedValue({
      data: [{ employer: 'BCG', employer_normalized: null }],
      error: null,
    })
    generateObjectMock.mockRejectedValue(new Error('provider down'))

    const res = await POST()
    expect(res.status).toBe(502)
  })

  it('returns 429 when rate limit is exceeded within the window', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'rate-limit-user' } } })
    selectResultMock.mockResolvedValue({ data: [], error: null })

    for (let i = 0; i < 5; i++) {
      const res = await POST()
      expect(res.status).toBe(200)
    }
    const res = await POST()
    expect(res.status).toBe(429)
  })

  it('returns 500 when saving fails', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } })
    selectResultMock.mockResolvedValue({
      data: [{ employer: 'BCG', employer_normalized: null }],
      error: null,
    })
    generateObjectMock.mockResolvedValue({
      object: { mappings: [{ raw: 'BCG', canonical: 'Boston Consulting Group' }] },
    })
    updateMock.mockResolvedValue({ error: { message: 'db down' } })

    const res = await POST()
    expect(res.status).toBe(500)
  })
})
