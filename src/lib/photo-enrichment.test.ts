import { describe, it, expect } from 'vitest'
import {
  chunk,
  shouldAttempt,
  extractPhotoUrl,
  buildPhotoLookup,
  findPhoto,
  normalizeLinkedInUrl,
  publicIdentifierOf,
  ATTEMPT_COOLDOWN_DAYS,
} from './photo-enrichment'

describe('chunk', () => {
  it('splits into fixed-size batches', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]])
  })

  it('returns empty array for empty input', () => {
    expect(chunk([], 50)).toEqual([])
  })
})

describe('shouldAttempt', () => {
  const now = new Date('2026-07-01T00:00:00Z')

  it('attempts when never tried before', () => {
    expect(shouldAttempt(null, now)).toBe(true)
  })

  it('does not attempt when tried recently (within cooldown)', () => {
    const recent = new Date('2026-06-20T00:00:00Z').toISOString()
    expect(shouldAttempt(recent, now)).toBe(false)
  })

  it('attempts again when last try is older than cooldown', () => {
    const old = new Date('2026-01-01T00:00:00Z').toISOString()
    expect(shouldAttempt(old, now)).toBe(true)
  })

  it('attempts when timestamp is unparseable', () => {
    expect(shouldAttempt('not-a-date', now)).toBe(true)
  })

  it('respects the default cooldown constant', () => {
    const justInside = new Date(now.getTime() - (ATTEMPT_COOLDOWN_DAYS - 1) * 86400000).toISOString()
    const justOutside = new Date(now.getTime() - (ATTEMPT_COOLDOWN_DAYS + 1) * 86400000).toISOString()
    expect(shouldAttempt(justInside, now)).toBe(false)
    expect(shouldAttempt(justOutside, now)).toBe(true)
  })
})

describe('extractPhotoUrl', () => {
  it('prefers profilePicture.url', () => {
    expect(extractPhotoUrl({ profilePicture: { url: 'https://x/a.jpg' }, photo: 'https://x/b.jpg' })).toBe(
      'https://x/a.jpg'
    )
  })

  it('falls back to photo', () => {
    expect(extractPhotoUrl({ photo: 'https://x/b.jpg' })).toBe('https://x/b.jpg')
  })

  it('returns null when no photo present', () => {
    expect(extractPhotoUrl({})).toBeNull()
  })

  it('rejects non-http values', () => {
    expect(extractPhotoUrl({ photo: 'data:image/png;base64,xxx' })).toBeNull()
  })
})

describe('normalizeLinkedInUrl', () => {
  it('strips trailing slash, query, hash and lowercases', () => {
    expect(normalizeLinkedInUrl('https://www.LinkedIn.com/in/Yisa-Wu/?utm=1#x')).toBe(
      'https://linkedin.com/in/yisa-wu'
    )
  })
})

describe('publicIdentifierOf', () => {
  it('extracts the /in/ segment', () => {
    expect(publicIdentifierOf('https://www.linkedin.com/in/yisa-wu-462aa4226/')).toBe(
      'yisa-wu-462aa4226'
    )
  })

  it('returns null when no /in/ segment', () => {
    expect(publicIdentifierOf('https://example.com/foo')).toBeNull()
  })
})

describe('buildPhotoLookup + findPhoto', () => {
  it('matches by linkedinUrl echoed in the result', () => {
    const lookup = buildPhotoLookup([
      { linkedinUrl: 'https://www.linkedin.com/in/a', profilePicture: { url: 'https://x/a.jpg' } },
    ])
    expect(findPhoto(lookup, 'https://www.linkedin.com/in/a')).toBe('https://x/a.jpg')
  })

  it('matches via originalQuery.query (queries input field)', () => {
    const lookup = buildPhotoLookup([
      { originalQuery: { query: 'https://www.linkedin.com/in/b' }, photo: 'https://x/b.jpg' },
    ])
    expect(findPhoto(lookup, 'https://www.linkedin.com/in/b')).toBe('https://x/b.jpg')
  })

  it('matches via publicIdentifier when url differs (www/slash)', () => {
    const lookup = buildPhotoLookup([
      { publicIdentifier: 'Yisa-Wu', profilePicture: { url: 'https://x/y.jpg' } },
    ])
    expect(findPhoto(lookup, 'https://linkedin.com/in/yisa-wu/')).toBe('https://x/y.jpg')
  })

  it('returns null when candidate has no match', () => {
    const lookup = buildPhotoLookup([
      { linkedinUrl: 'https://www.linkedin.com/in/a', photo: 'https://x/a.jpg' },
    ])
    expect(findPhoto(lookup, 'https://www.linkedin.com/in/other')).toBeNull()
  })

  it('skips items without a photo', () => {
    const lookup = buildPhotoLookup([{ linkedinUrl: 'https://www.linkedin.com/in/a' }])
    expect(lookup.size).toBe(0)
  })
})
