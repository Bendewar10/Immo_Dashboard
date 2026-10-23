import { Contact, Strength, getCompanyName } from '@/lib/contacts'

export interface ExitTarget {
  id: string
  company_name: string
  created_at: string
}

export interface ExitTargetCoverage {
  contactCount: number
  strengthCounts: Record<Strength, number>
  lastTouchpoint: string | null
}

function normalizeName(name: string) {
  return name.trim().toLowerCase()
}

// Match über denselben Anzeigenamen wie der Firmen-Drilldown (PROJ-22):
// normalisiert, sonst roher employer — case-insensitive und getrimmt
export function computeCoverage(
  target: Pick<ExitTarget, 'company_name'>,
  contacts: Contact[]
): ExitTargetCoverage {
  const targetName = normalizeName(target.company_name)
  const matched = contacts.filter((contact) => {
    const company = getCompanyName(contact)
    return company !== null && normalizeName(company) === targetName
  })

  const strengthCounts: Record<Strength, number> = { 1: 0, 2: 0, 3: 0 }
  let lastTouchpoint: string | null = null
  for (const contact of matched) {
    if (contact.strength) strengthCounts[contact.strength] += 1
    if (contact.last_contacted_at && (!lastTouchpoint || contact.last_contacted_at > lastTouchpoint)) {
      lastTouchpoint = contact.last_contacted_at
    }
  }

  return { contactCount: matched.length, strengthCounts, lastTouchpoint }
}

// Meiste Kontakte zuerst, Firmen ohne Kontakte zuletzt; bei Gleichstand alphabetisch
export function sortTargetsByCoverage<T extends ExitTarget>(
  targets: T[],
  coverageById: Map<string, ExitTargetCoverage>
): T[] {
  return [...targets].sort((a, b) => {
    const countA = coverageById.get(a.id)?.contactCount ?? 0
    const countB = coverageById.get(b.id)?.contactCount ?? 0
    return countB - countA || a.company_name.localeCompare(b.company_name)
  })
}

export function isDuplicateTarget(companyName: string, targets: ExitTarget[]): boolean {
  const name = normalizeName(companyName)
  return targets.some((t) => normalizeName(t.company_name) === name)
}
