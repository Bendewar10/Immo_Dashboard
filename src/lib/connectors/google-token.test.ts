import { describe, it, expect, vi, beforeEach } from 'vitest'

const { fetchMock, selectChainMock, updateEqMock } = vi.hoisted(() => ({
  fetchMock: vi.fn(),
  selectChainMock: vi.fn(),
  updateEqMock: vi.fn(),
}))

vi.mock('@/lib/connectors/encryption', () => ({
  encrypt: (s: string) => `enc:${s}`,
  decrypt: (s: string) => s.replace(/^enc:/, ''),
}))

vi.stubGlobal('fetch', fetchMock)

import { getValidGoogleAccessToken } from './google-token'

function makeSupabaseMock() {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: selectChainMock,
          }),
        }),
      }),
      update: () => ({
        eq: () => ({
          eq: updateEqMock,
        }),
      }),
    }),
  } as any
}

describe('getValidGoogleAccessToken', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    updateEqMock.mockResolvedValue({})
  })

  it('returns null when no token row exists', async () => {
    selectChainMock.mockResolvedValue({ data: null })
    const result = await getValidGoogleAccessToken(makeSupabaseMock(), 'u1')
    expect(result).toBeNull()
  })

  it('returns null when token status is not active', async () => {
    selectChainMock.mockResolvedValue({
      data: { access_token: 'enc:abc', refresh_token: 'enc:ref', expires_at: new Date(Date.now() + 10000).toISOString(), status: 'expired' },
    })
    const result = await getValidGoogleAccessToken(makeSupabaseMock(), 'u1')
    expect(result).toBeNull()
  })

  it('returns decrypted access token when not close to expiry', async () => {
    selectChainMock.mockResolvedValue({
      data: {
        access_token: 'enc:valid-token',
        refresh_token: 'enc:ref',
        expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
        status: 'active',
      },
    })
    const result = await getValidGoogleAccessToken(makeSupabaseMock(), 'u1')
    expect(result).toBe('valid-token')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('refreshes the token when close to expiry and refresh succeeds', async () => {
    selectChainMock.mockResolvedValue({
      data: {
        access_token: 'enc:old-token',
        refresh_token: 'enc:ref-token',
        expires_at: new Date(Date.now() + 1000).toISOString(),
        status: 'active',
      },
    })
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: 'fresh-token', expires_in: 3600 }),
    })
    const result = await getValidGoogleAccessToken(makeSupabaseMock(), 'u1')
    expect(result).toBe('fresh-token')
    expect(fetchMock).toHaveBeenCalledWith(
      'https://oauth2.googleapis.com/token',
      expect.objectContaining({ method: 'POST' })
    )
  })

  it('marks token as expired and returns null when refresh fails', async () => {
    selectChainMock.mockResolvedValue({
      data: {
        access_token: 'enc:old-token',
        refresh_token: 'enc:ref-token',
        expires_at: new Date(Date.now() + 1000).toISOString(),
        status: 'active',
      },
    })
    fetchMock.mockResolvedValue({ ok: false })
    const result = await getValidGoogleAccessToken(makeSupabaseMock(), 'u1')
    expect(result).toBeNull()
    expect(updateEqMock).toHaveBeenCalled()
  })

  it('returns null without calling fetch when no refresh token is available and access token expired', async () => {
    selectChainMock.mockResolvedValue({
      data: {
        access_token: 'enc:old-token',
        refresh_token: null,
        expires_at: new Date(Date.now() + 1000).toISOString(),
        status: 'active',
      },
    })
    const result = await getValidGoogleAccessToken(makeSupabaseMock(), 'u1')
    expect(result).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
