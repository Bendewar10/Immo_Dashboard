import { describe, it, expect } from 'vitest'
import { sortByStartDateDesc, formatEntryDateRange } from './user-profile'

describe('sortByStartDateDesc', () => {
  it('sorts entries by start_date descending', () => {
    const entries = [
      { id: 'a', start_date: '2020-01-01' },
      { id: 'b', start_date: '2023-06-01' },
      { id: 'c', start_date: '2021-09-01' },
    ]
    expect(sortByStartDateDesc(entries).map((e) => e.id)).toEqual(['b', 'c', 'a'])
  })

  it('puts entries without a start_date last', () => {
    const entries = [
      { id: 'a', start_date: null },
      { id: 'b', start_date: '2022-01-01' },
    ]
    expect(sortByStartDateDesc(entries).map((e) => e.id)).toEqual(['b', 'a'])
  })

  it('does not mutate the input array', () => {
    const entries = [
      { id: 'a', start_date: '2020-01-01' },
      { id: 'b', start_date: '2023-06-01' },
    ]
    const original = [...entries]
    sortByStartDateDesc(entries)
    expect(entries).toEqual(original)
  })

  it('handles an empty array', () => {
    expect(sortByStartDateDesc([])).toEqual([])
  })
})

describe('formatEntryDateRange (re-exported formatDateRange)', () => {
  it('formats a full range', () => {
    expect(formatEntryDateRange('2020-01-15', '2023-06-20')).toBe('15.1.2020 – 20.6.2023')
  })

  it('returns null when neither date is set', () => {
    expect(formatEntryDateRange(null, null)).toBeNull()
  })
})
