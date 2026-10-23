export interface BirthdaySuggestion {
  contactId: string
  first_name: string
  last_name: string | null
  month: number
  day: number
}

export interface BirthdaySuggestionsResponse {
  googleConnected: boolean
  suggestions: BirthdaySuggestion[]
  error?: boolean
}

/** contacts.birthday ist ein volles Datum, aber nur Monat/Tag zählen (siehe nextBirthdayOccurrence in occasions.ts) — Platzhalter-Jahr 2000 (Schaltjahr, deckt 29. Februar ab). */
export function toBirthdayFieldValue(month: number, day: number) {
  return `2000-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export function formatBirthdaySuggestionDate(month: number, day: number) {
  return new Date(2000, month - 1, day).toLocaleDateString('de-DE', { day: 'numeric', month: 'long' })
}

const BIRTHDAY_TITLE_PATTERN = /geburtstag|birthday|🎂/i

export function isBirthdayEventTitle(title: string) {
  return BIRTHDAY_TITLE_PATTERN.test(title)
}

/** "Geburtstag von Anna Müller" -> "Anna Müller", "Ben's Birthday" -> "Ben". Rein textuelle Bereinigung, kein Namens-Wissen. */
export function extractCandidateName(title: string): string | null {
  const name = title
    .replace(/🎂/g, '')
    .replace(/geburtstag\s*(von)?/gi, '')
    .replace(/'s\s*birthday/gi, '')
    .replace(/\bbirthday\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
  return name || null
}

export function normalizeName(value: string) {
  return value.trim().toLowerCase()
}
