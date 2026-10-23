export interface CityTripMatch {
  projectId: string
  projectTitle: string
  city: string
  contactCount: number
}

/** Refine 2026-07-03: Termin-Location (Freitext) enthält die Projekt-Stadt als Teilstring, case-insensitive/getrimmt — kein Geo-Matching. */
export function matchesEventLocationToProjectCity(location: string, city: string): boolean {
  const normalizedLocation = location.trim().toLowerCase()
  const normalizedCity = city.trim().toLowerCase()
  if (!normalizedLocation || !normalizedCity) return false
  return normalizedLocation.includes(normalizedCity)
}

interface MatchableProject {
  id: string
  title: string
  city: string | null
  status: string
}

interface MatchableMeeting {
  location: string | null
}

interface MatchableContact {
  city: string | null
}

function countContactsInCity(contacts: MatchableContact[], city: string): number {
  const normalizedCity = city.trim().toLowerCase()
  return contacts.filter((c) => c.city && c.city.trim().toLowerCase() === normalizedCity).length
}

/** Ein Treffer pro Projekt (nicht pro Termin) — nur aktive Projekte mit gesetzter Stadt werden berücksichtigt. */
export function findCityTripMatches(
  meetings: MatchableMeeting[],
  projects: MatchableProject[],
  contacts: MatchableContact[]
): CityTripMatch[] {
  const matches: CityTripMatch[] = []
  for (const project of projects) {
    if (project.status !== 'active' || !project.city) continue
    const hasMatch = meetings.some((meeting) => meeting.location && matchesEventLocationToProjectCity(meeting.location, project.city!))
    if (hasMatch) {
      matches.push({
        projectId: project.id,
        projectTitle: project.title,
        city: project.city,
        contactCount: countContactsInCity(contacts, project.city),
      })
    }
  }
  return matches
}
