import { describe, it, expect } from 'vitest'
import { formatDateRange, getParticipantRoleLabel } from './projects'

describe('formatDateRange', () => {
  it('returns null when neither date is set', () => {
    expect(formatDateRange(null, null)).toBeNull()
  })

  it('formats a full range', () => {
    expect(formatDateRange('2026-01-15', '2026-03-20')).toBe('15.1.2026 – 20.3.2026')
  })

  it('formats start-only as "seit"', () => {
    expect(formatDateRange('2026-01-15', null)).toBe('seit 15.1.2026')
  })

  it('formats end-only as "bis"', () => {
    expect(formatDateRange(null, '2026-03-20')).toBe('bis 20.3.2026')
  })
})

describe('getParticipantRoleLabel', () => {
  it('returns the fixed label for non-other roles', () => {
    expect(getParticipantRoleLabel({ role: 'partner', role_other: null })).toBe('Partner')
  })

  it('returns the free-text label for "other" when set', () => {
    expect(getParticipantRoleLabel({ role: 'other', role_other: 'Externer Advisor' })).toBe(
      'Externer Advisor'
    )
  })

  it('falls back to "Sonstige" when "other" has no free text', () => {
    expect(getParticipantRoleLabel({ role: 'other', role_other: null })).toBe('Sonstige')
  })
})
