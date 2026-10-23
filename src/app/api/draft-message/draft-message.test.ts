import { describe, it, expect, vi, beforeEach } from 'vitest'

const { generateTextMock } = vi.hoisted(() => ({ generateTextMock: vi.fn() }))
vi.mock('ai', () => ({ generateText: generateTextMock }))

const {
  getUserMock,
  contactSingleMock,
  interactionsBuilderMock,
  styleNotesBuilderMock,
  userProfileMaybeSingleMock,
} = vi.hoisted(() => ({
  getUserMock: vi.fn(),
  contactSingleMock: vi.fn(),
  interactionsBuilderMock: vi.fn(),
  styleNotesBuilderMock: vi.fn(),
  userProfileMaybeSingleMock: vi.fn(),
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
      if (table === 'user_profile') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: userProfileMaybeSingleMock,
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
          not: () => ({
            order: () => ({
              limit: styleNotesBuilderMock,
            }),
          }),
        }),
      }
    },
  }),
}))

import { POST } from './route'

function makeRequest(body: unknown) {
  return new Request('http://localhost/api/draft-message', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

describe('POST /api/draft-message', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    interactionsBuilderMock.mockResolvedValue({ data: [] })
    styleNotesBuilderMock.mockResolvedValue({ data: [] })
    userProfileMaybeSingleMock.mockResolvedValue({ data: null })
  })

  it('returns 401 when not authenticated', async () => {
    getUserMock.mockResolvedValue({ data: { user: null } })
    const res = await POST(makeRequest({ contactId: '550e8400-e29b-41d4-a716-446655440000', occasionType: 'followup' }))
    expect(res.status).toBe(401)
  })

  it('returns 400 for invalid input', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } })
    const res = await POST(makeRequest({ contactId: 'not-a-uuid', occasionType: 'followup' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for an occasionType outside the four accepted values', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } })
    const res = await POST(makeRequest({ contactId: '550e8400-e29b-41d4-a716-446655440000', occasionType: 'anniversary' }))
    expect(res.status).toBe(400)
  })

  it('returns 404 when contact is not found (or not owned)', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } })
    contactSingleMock.mockResolvedValue({ data: null })
    const res = await POST(makeRequest({ contactId: '550e8400-e29b-41d4-a716-446655440000', occasionType: 'followup' }))
    expect(res.status).toBe(404)
  })

  it('returns generated text for a valid follow-up request', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } })
    contactSingleMock.mockResolvedValue({ data: { first_name: 'Anna', notes: null, context: 'Sport' } })
    generateTextMock.mockResolvedValue({ text: 'Hey Anna, lange nichts gehört!' })

    const res = await POST(makeRequest({ contactId: '550e8400-e29b-41d4-a716-446655440000', occasionType: 'followup' }))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.text).toBe('Hey Anna, lange nichts gehört!')
  })

  it('generates a Jobwechsel congratulation message', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } })
    contactSingleMock.mockResolvedValue({ data: { first_name: 'Anna', notes: null, context: null } })
    generateTextMock.mockResolvedValue({ text: 'Hey Anna, Glückwunsch zum neuen Job!' })

    const res = await POST(makeRequest({ contactId: '550e8400-e29b-41d4-a716-446655440000', occasionType: 'Jobwechsel' }))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.text).toBe('Hey Anna, Glückwunsch zum neuen Job!')
    const promptArg = generateTextMock.mock.calls[0][0].prompt as string
    expect(promptArg).toContain('neuen Job')
  })

  it('generates a Beförderung congratulation message', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } })
    contactSingleMock.mockResolvedValue({ data: { first_name: 'Anna', notes: null, context: null } })
    generateTextMock.mockResolvedValue({ text: 'Hey Anna, Glückwunsch zur Beförderung!' })

    const res = await POST(makeRequest({ contactId: '550e8400-e29b-41d4-a716-446655440000', occasionType: 'Beförderung' }))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.text).toBe('Hey Anna, Glückwunsch zur Beförderung!')
    const promptArg = generateTextMock.mock.calls[0][0].prompt as string
    expect(promptArg).toContain('Beförderung')
  })

  it('returns 502 when the AI provider call fails', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } })
    contactSingleMock.mockResolvedValue({ data: { first_name: 'Anna', notes: null, context: null } })
    generateTextMock.mockRejectedValue(new Error('provider down'))

    const res = await POST(makeRequest({ contactId: '550e8400-e29b-41d4-a716-446655440000', occasionType: 'birthday' }))
    expect(res.status).toBe(502)
  })

  it('includes style examples (>20 chars, max 5) from notes across all contacts in the prompt', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } })
    contactSingleMock.mockResolvedValue({ data: { first_name: 'Anna', notes: null, context: null } })
    styleNotesBuilderMock.mockResolvedValue({
      data: [
        { note: 'Kurz' },
        { note: 'Lange Notiz über das letzte Treffen beim Kaffee' },
        { note: 'Noch eine ausführliche Notiz zum Telefonat von letzter Woche' },
      ],
    })
    generateTextMock.mockResolvedValue({ text: 'Hey Anna!' })

    await POST(makeRequest({ contactId: '550e8400-e29b-41d4-a716-446655440000', occasionType: 'followup' }))

    const promptArg = generateTextMock.mock.calls[0][0].prompt as string
    expect(promptArg).toContain('Lange Notiz über das letzte Treffen beim Kaffee')
    expect(promptArg).toContain('Noch eine ausführliche Notiz zum Telefonat von letzter Woche')
    expect(promptArg).not.toContain('Kurz')
  })

  it('generates without style examples when no note meets the minimum length', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } })
    contactSingleMock.mockResolvedValue({ data: { first_name: 'Anna', notes: null, context: null } })
    styleNotesBuilderMock.mockResolvedValue({ data: [{ note: 'Kurzer Call' }] })
    generateTextMock.mockResolvedValue({ text: 'Hey Anna!' })

    const res = await POST(makeRequest({ contactId: '550e8400-e29b-41d4-a716-446655440000', occasionType: 'followup' }))
    expect(res.status).toBe(200)
    const promptArg = generateTextMock.mock.calls[0][0].prompt as string
    expect(promptArg).not.toContain('selben Schreibstil')
  })

  it('includes the tone instruction in the prompt when tone is provided', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } })
    contactSingleMock.mockResolvedValue({ data: { first_name: 'Anna', notes: null, context: null } })
    generateTextMock.mockResolvedValue({ text: 'Hi Anna, long time no talk!' })

    const res = await POST(
      makeRequest({
        contactId: '550e8400-e29b-41d4-a716-446655440000',
        occasionType: 'followup',
        tone: 'lockerer, auf Englisch',
      })
    )
    expect(res.status).toBe(200)
    const promptArg = generateTextMock.mock.calls[0][0].prompt as string
    expect(promptArg).toContain('lockerer, auf Englisch')
  })

  it('treats a whitespace-only tone like no tone at all', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } })
    contactSingleMock.mockResolvedValue({ data: { first_name: 'Anna', notes: null, context: null } })
    generateTextMock.mockResolvedValue({ text: 'Hey Anna!' })

    const res = await POST(
      makeRequest({ contactId: '550e8400-e29b-41d4-a716-446655440000', occasionType: 'followup', tone: '   ' })
    )
    expect(res.status).toBe(200)
    const promptArg = generateTextMock.mock.calls[0][0].prompt as string
    expect(promptArg).not.toContain('Zusätzliche Anweisung zum Ton')
  })

  it('returns 400 when tone exceeds the max length', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } })
    const res = await POST(
      makeRequest({
        contactId: '550e8400-e29b-41d4-a716-446655440000',
        occasionType: 'followup',
        tone: 'a'.repeat(201),
      })
    )
    expect(res.status).toBe(400)
  })

  // PROJ-14: City-Trip-Anlass
  it('generates a citytrip message with city and timeframe in the prompt', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } })
    contactSingleMock.mockResolvedValue({ data: { first_name: 'Anna', notes: null, context: null } })
    generateTextMock.mockResolvedValue({ text: 'Hey Anna, bin bald in München!' })

    const res = await POST(
      makeRequest({
        contactId: '550e8400-e29b-41d4-a716-446655440000',
        occasionType: 'citytrip',
        city: 'München',
        timeframe: 'Jul 2026 – Sep 2026',
      })
    )
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.text).toBe('Hey Anna, bin bald in München!')
    const promptArg = generateTextMock.mock.calls[0][0].prompt as string
    expect(promptArg).toContain('München')
    expect(promptArg).toContain('Jul 2026 – Sep 2026')
    expect(promptArg).toContain('Kaffee')
  })

  it('generates a citytrip message without timeframe (city only)', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } })
    contactSingleMock.mockResolvedValue({ data: { first_name: 'Anna', notes: null, context: null } })
    generateTextMock.mockResolvedValue({ text: 'Hey Anna!' })

    const res = await POST(
      makeRequest({
        contactId: '550e8400-e29b-41d4-a716-446655440000',
        occasionType: 'citytrip',
        city: 'Hamburg',
      })
    )
    expect(res.status).toBe(200)
    const promptArg = generateTextMock.mock.calls[0][0].prompt as string
    expect(promptArg).toContain('Hamburg')
    expect(promptArg).toContain('demnächst regelmäßig')
  })

  it('returns 400 for citytrip without city', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } })
    const res = await POST(
      makeRequest({
        contactId: '550e8400-e29b-41d4-a716-446655440000',
        occasionType: 'citytrip',
      })
    )
    expect(res.status).toBe(400)
  })
})
