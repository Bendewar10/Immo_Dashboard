import { describe, it, expect, vi, beforeEach } from 'vitest'

const { generateTextMock } = vi.hoisted(() => ({ generateTextMock: vi.fn() }))
vi.mock('ai', () => ({ generateText: generateTextMock }))

const {
  getUserMock,
  contactSingleMock,
  profileSingleMock,
  educationBuilderMock,
  employmentBuilderMock,
  updateContactMock,
} = vi.hoisted(() => ({
  getUserMock: vi.fn(),
  contactSingleMock: vi.fn(),
  profileSingleMock: vi.fn(),
  educationBuilderMock: vi.fn(),
  employmentBuilderMock: vi.fn(),
  updateContactMock: vi.fn(),
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
          update: () => ({
            eq: updateContactMock,
          }),
        }
      }
      if (table === 'user_profile') {
        return {
          select: () => ({
            eq: () => ({
              single: profileSingleMock,
            }),
          }),
        }
      }
      if (table === 'user_education') {
        return {
          select: () => ({
            eq: () => ({
              order: educationBuilderMock,
            }),
          }),
        }
      }
      if (table === 'user_employment') {
        return {
          select: () => ({
            eq: () => ({
              order: employmentBuilderMock,
            }),
          }),
        }
      }
      return {}
    },
  }),
}))

import { POST } from './route'

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000'

function makeRequest(id: string = VALID_UUID) {
  return {
    request: new Request(`http://localhost/api/contacts/${id}/commonalities`, { method: 'POST' }),
    params: Promise.resolve({ id }),
  }
}

const fullContact = {
  id: VALID_UUID,
  first_name: 'Klaus',
  last_name: 'Müller',
  employer: 'McKinsey',
  job_title: 'Partner',
  city: 'München',
  context: 'Gemeinsames Projekt 2021',
  notes: null,
}

const fullProfile = {
  headline: 'Strategy Consultant',
  skills: ['Excel', 'Python'],
  languages: ['Deutsch', 'Englisch'],
}

const education = [
  { institution: 'LMU München', degree: 'MBA', field_of_study: null, city: 'München', start_date: '2015-09-01', end_date: '2017-06-01' },
]

const employment = [
  { employer: 'McKinsey', job_title: 'Consultant', city: 'München', start_date: '2017-09-01', end_date: null },
]

describe('POST /api/contacts/[id]/commonalities', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    updateContactMock.mockResolvedValue({ error: null })
  })

  it('returns 401 when not authenticated', async () => {
    getUserMock.mockResolvedValue({ data: { user: null } })
    const { request, params } = makeRequest()
    const res = await POST(request, { params })
    expect(res.status).toBe(401)
  })

  it('returns 400 for malformed contact ID', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } })
    const { request, params } = makeRequest('not-a-uuid')
    const res = await POST(request, { params })
    expect(res.status).toBe(400)
  })

  it('returns 404 when contact not found (or not owned)', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } })
    contactSingleMock.mockResolvedValue({ data: null })
    profileSingleMock.mockResolvedValue({ data: fullProfile })
    educationBuilderMock.mockResolvedValue({ data: education })
    employmentBuilderMock.mockResolvedValue({ data: employment })
    const { request, params } = makeRequest()
    const res = await POST(request, { params })
    expect(res.status).toBe(404)
  })

  it('returns 422 when no CV profile data exists', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } })
    contactSingleMock.mockResolvedValue({ data: fullContact })
    profileSingleMock.mockResolvedValue({ data: null })
    educationBuilderMock.mockResolvedValue({ data: [] })
    employmentBuilderMock.mockResolvedValue({ data: [] })
    const { request, params } = makeRequest()
    const res = await POST(request, { params })
    expect(res.status).toBe(422)
    const json = await res.json()
    expect(json.error).toContain('Kein Profil')
  })

  it('returns 422 when contact has no analyzable fields', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } })
    contactSingleMock.mockResolvedValue({
      data: { ...fullContact, employer: null, job_title: null, city: null, context: null, notes: null },
    })
    profileSingleMock.mockResolvedValue({ data: fullProfile })
    educationBuilderMock.mockResolvedValue({ data: education })
    employmentBuilderMock.mockResolvedValue({ data: employment })
    const { request, params } = makeRequest()
    const res = await POST(request, { params })
    expect(res.status).toBe(422)
    const json = await res.json()
    expect(json.error).toContain('Zu wenig Kontaktinformationen')
  })

  it('returns commonalities and saves to DB on success', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } })
    contactSingleMock.mockResolvedValue({ data: fullContact })
    profileSingleMock.mockResolvedValue({ data: fullProfile })
    educationBuilderMock.mockResolvedValue({ data: education })
    employmentBuilderMock.mockResolvedValue({ data: employment })
    generateTextMock.mockResolvedValue({ text: '• Beide bei McKinsey\n• Beide in München' })

    const { request, params } = makeRequest()
    const res = await POST(request, { params })
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.commonalities).toBe('• Beide bei McKinsey\n• Beide in München')
    expect(updateContactMock).toHaveBeenCalledWith('id', VALID_UUID)
  })

  it('includes employment and education in the AI prompt', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } })
    contactSingleMock.mockResolvedValue({ data: fullContact })
    profileSingleMock.mockResolvedValue({ data: fullProfile })
    educationBuilderMock.mockResolvedValue({ data: education })
    employmentBuilderMock.mockResolvedValue({ data: employment })
    generateTextMock.mockResolvedValue({ text: '• Beide bei McKinsey' })

    const { request, params } = makeRequest()
    await POST(request, { params })

    const promptArg = generateTextMock.mock.calls[0][0].prompt as string
    expect(promptArg).toContain('McKinsey')
    expect(promptArg).toContain('LMU München')
    expect(promptArg).toContain('Klaus Müller')
  })

  it('works with only employment data (no profile row, no education)', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } })
    contactSingleMock.mockResolvedValue({ data: fullContact })
    profileSingleMock.mockResolvedValue({ data: null })
    educationBuilderMock.mockResolvedValue({ data: [] })
    employmentBuilderMock.mockResolvedValue({ data: employment })
    generateTextMock.mockResolvedValue({ text: '• Beide bei McKinsey' })

    const { request, params } = makeRequest()
    const res = await POST(request, { params })
    expect(res.status).toBe(200)
  })

  it('returns 502 when AI provider fails', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } })
    contactSingleMock.mockResolvedValue({ data: fullContact })
    profileSingleMock.mockResolvedValue({ data: fullProfile })
    educationBuilderMock.mockResolvedValue({ data: education })
    employmentBuilderMock.mockResolvedValue({ data: employment })
    generateTextMock.mockRejectedValue(new Error('provider down'))

    const { request, params } = makeRequest()
    const res = await POST(request, { params })
    expect(res.status).toBe(502)
  })

  it('trims whitespace from AI response before saving', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } })
    contactSingleMock.mockResolvedValue({ data: fullContact })
    profileSingleMock.mockResolvedValue({ data: fullProfile })
    educationBuilderMock.mockResolvedValue({ data: education })
    employmentBuilderMock.mockResolvedValue({ data: employment })
    generateTextMock.mockResolvedValue({ text: '  • Beide bei McKinsey  \n  ' })

    const { request, params } = makeRequest()
    const res = await POST(request, { params })
    const json = await res.json()
    expect(json.commonalities).toBe('• Beide bei McKinsey')
  })
})
