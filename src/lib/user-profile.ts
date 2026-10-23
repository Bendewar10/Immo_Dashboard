export interface UserProfile {
  id: string
  headline: string | null
  skills: string[]
  languages: string[]
  cv_file_path: string | null
  cv_uploaded_at: string | null
  bio: string | null
  bio_updated_at: string | null
  goals_text: string | null
  goals_updated_at: string | null
  created_at: string
  updated_at: string
}

export interface EducationEntry {
  id: string
  institution: string
  degree: string | null
  field_of_study: string | null
  city: string | null
  start_date: string | null
  end_date: string | null
  created_at: string
}

export interface EmploymentEntry {
  id: string
  employer: string
  job_title: string | null
  city: string | null
  start_date: string | null
  end_date: string | null
  description: string | null
  created_at: string
}

export { formatDateRange as formatEntryDateRange } from '@/lib/projects'

export function sortByStartDateDesc<T extends { start_date: string | null }>(entries: T[]): T[] {
  return [...entries].sort((a, b) => {
    if (!a.start_date && !b.start_date) return 0
    if (!a.start_date) return 1
    if (!b.start_date) return -1
    return b.start_date.localeCompare(a.start_date)
  })
}
