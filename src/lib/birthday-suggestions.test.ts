import { describe, it, expect } from 'vitest'
import {
  toBirthdayFieldValue,
  formatBirthdaySuggestionDate,
  isBirthdayEventTitle,
  extractCandidateName,
  normalizeName,
} from './birthday-suggestions'

describe('toBirthdayFieldValue', () => {
  it('pads month and day, uses placeholder year 2000', () => {
    expect(toBirthdayFieldValue(9, 5)).toBe('2000-09-05')
    expect(toBirthdayFieldValue(12, 25)).toBe('2000-12-25')
  })

  it('handles Feb 29 (2000 is a leap year)', () => {
    expect(toBirthdayFieldValue(2, 29)).toBe('2000-02-29')
  })
})

describe('formatBirthdaySuggestionDate', () => {
  it('formats month/day in German long form', () => {
    expect(formatBirthdaySuggestionDate(9, 15)).toBe('15. September')
  })
})

describe('isBirthdayEventTitle', () => {
  it('matches German, English, and emoji patterns', () => {
    expect(isBirthdayEventTitle('Geburtstag von Anna')).toBe(true)
    expect(isBirthdayEventTitle("Ben's Birthday")).toBe(true)
    expect(isBirthdayEventTitle('🎂 Clara')).toBe(true)
  })

  it('does not match unrelated titles', () => {
    expect(isBirthdayEventTitle('Team Offsite')).toBe(false)
  })
})

describe('extractCandidateName', () => {
  it('strips "Geburtstag von" prefix', () => {
    expect(extractCandidateName('Geburtstag von Anna Müller')).toBe('Anna Müller')
  })

  it('strips "\'s Birthday" suffix', () => {
    expect(extractCandidateName("Ben's Birthday")).toBe('Ben')
  })

  it('strips bare "Birthday" and emoji', () => {
    expect(extractCandidateName('🎂 Clara Birthday')).toBe('Clara')
  })

  it('returns null when nothing remains after stripping', () => {
    expect(extractCandidateName('Birthday')).toBeNull()
    expect(extractCandidateName('🎂')).toBeNull()
  })
})

describe('normalizeName', () => {
  it('trims and lowercases', () => {
    expect(normalizeName('  Anna Müller  ')).toBe('anna müller')
  })
})
