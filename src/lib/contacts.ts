export type Category = 'colleague' | 'alumni' | 'extern' | 'private' | 'other'
export type Strength = 1 | 2 | 3

export const CATEGORY_LABELS: Record<Category, string> = {
  colleague: 'Kollege',
  alumni: 'Alumni',
  extern: 'Extern',
  private: 'Privat',
  other: 'Sonstige',
}

export const STRENGTH_LABELS: Record<Strength, string> = {
  1: 'Stark',
  2: 'Mittel',
  3: 'Locker',
}

export const STRENGTH_DEFAULT_INTERVAL_DAYS: Record<Strength, number> = {
  1: 14,
  2: 30,
  3: 90,
}

export interface Contact {
  id: string
  first_name: string
  last_name: string | null
  category: Category | null
  strength: Strength | null
  employer: string | null
  employer_normalized?: string | null
  employer_normalized_source?: 'ai' | 'manual' | null
  employer_normalized_at?: string | null
  job_title: string | null
  email: string | null
  linkedin_url: string | null
  photo_url: string | null
  context: string | null
  notes: string | null
  city: string | null
  phone: string | null
  birthday: string | null
  followup_interval_days: number | null
  last_contacted_at: string | null
  next_followup_at: string | null
  commonalities?: string | null
  created_at: string
}

export function getFullName(contact: Pick<Contact, 'first_name' | 'last_name'>) {
  return contact.last_name ? `${contact.first_name} ${contact.last_name}` : contact.first_name
}

// Bei jeder employer-Änderung mitschreiben: Normalisierung zurücksetzen (neuer
// Arbeitgeber = neue Faktenlage), der Batch-Endpunkt normalisiert danach neu
export const EMPLOYER_NORMALIZATION_RESET = {
  employer_normalized: null,
  employer_normalized_source: null,
  employer_normalized_at: null,
} as const

// Anzeige-/Gruppierungsname der Firma: normalisiert, sonst roher employer (Fallback bei KI-Ausfall)
export function getCompanyName(
  contact: Pick<Contact, 'employer' | 'employer_normalized'>
): string | null {
  return contact.employer_normalized ?? contact.employer ?? null
}
