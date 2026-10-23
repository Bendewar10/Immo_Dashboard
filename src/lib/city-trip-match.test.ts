import { describe, it, expect } from 'vitest'
import { matchesEventLocationToProjectCity, findCityTripMatches } from './city-trip-match'

describe('matchesEventLocationToProjectCity', () => {
  it('matches when the city is a substring of the location, case-insensitive', () => {
    expect(matchesEventLocationToProjectCity('Konferenzraum, München', 'münchen')).toBe(true)
    expect(matchesEventLocationToProjectCity('MÜNCHEN HQ', 'München')).toBe(true)
  })

  it('trims whitespace before comparing', () => {
    expect(matchesEventLocationToProjectCity('  München  ', '  münchen  ')).toBe(true)
  })

  it('does not match unrelated locations', () => {
    expect(matchesEventLocationToProjectCity('Berlin Office', 'München')).toBe(false)
  })

  it('returns false for empty location or city', () => {
    expect(matchesEventLocationToProjectCity('', 'München')).toBe(false)
    expect(matchesEventLocationToProjectCity('München', '')).toBe(false)
  })
})

describe('findCityTripMatches', () => {
  const projects = [
    { id: 'p1', title: 'Projekt A', city: 'München', status: 'active' },
    { id: 'p2', title: 'Projekt B', city: 'Berlin', status: 'active' },
    { id: 'p3', title: 'Projekt C (abgeschlossen)', city: 'München', status: 'done' },
    { id: 'p4', title: 'Projekt D (keine Stadt)', city: null, status: 'active' },
  ]
  const contacts = [
    { city: 'München' },
    { city: 'München' },
    { city: 'Berlin' },
    { city: null },
  ]

  it('matches active projects whose city appears in a meeting location', () => {
    const meetings = [{ location: 'Kunde, München' }]
    const matches = findCityTripMatches(meetings, projects, contacts)
    expect(matches).toEqual([{ projectId: 'p1', projectTitle: 'Projekt A', city: 'München', contactCount: 2 }])
  })

  it('ignores done projects even if the city matches', () => {
    const meetings = [{ location: 'München' }]
    const matches = findCityTripMatches(meetings, projects, contacts)
    expect(matches.find((m) => m.projectId === 'p3')).toBeUndefined()
  })

  it('ignores projects without a city', () => {
    const meetings = [{ location: 'irgendwo' }]
    const matches = findCityTripMatches(meetings, projects, contacts)
    expect(matches.find((m) => m.projectId === 'p4')).toBeUndefined()
  })

  it('returns one match per project, not per meeting', () => {
    const meetings = [{ location: 'München Termin 1' }, { location: 'München Termin 2' }]
    const matches = findCityTripMatches(meetings, projects, contacts)
    expect(matches.filter((m) => m.projectId === 'p1')).toHaveLength(1)
  })

  it('returns a separate match per project when multiple projects match', () => {
    const meetings = [{ location: 'München' }, { location: 'Berlin' }]
    const matches = findCityTripMatches(meetings, projects, contacts)
    expect(matches.map((m) => m.projectId).sort()).toEqual(['p1', 'p2'])
  })

  it('returns an empty list when no meeting has a location', () => {
    const meetings = [{ location: null }]
    const matches = findCityTripMatches(meetings, projects, contacts)
    expect(matches).toEqual([])
  })

  it('counts zero contacts correctly when no contact lives in the matched city', () => {
    const meetings = [{ location: 'Berlin' }]
    const matches = findCityTripMatches(meetings, projects, [{ city: 'Hamburg' }])
    expect(matches).toEqual([{ projectId: 'p2', projectTitle: 'Projekt B', city: 'Berlin', contactCount: 0 }])
  })
})
