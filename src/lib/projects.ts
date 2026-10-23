export type ProjectStatus = 'active' | 'done'
export type ParticipantRole = 'partner' | 'project_manager' | 'case_team' | 'client' | 'other'

export const STATUS_LABELS: Record<ProjectStatus, string> = {
  active: 'Aktiv',
  done: 'Beendet',
}

export const ROLE_LABELS: Record<ParticipantRole, string> = {
  partner: 'Partner',
  project_manager: 'Project Manager',
  case_team: 'Case Team',
  client: 'Client',
  other: 'Sonstige',
}

export interface Project {
  id: string
  title: string
  client: string | null
  city: string | null
  start_date: string | null
  end_date: string | null
  status: ProjectStatus
  notes: string | null
  created_at: string
}

export interface ProjectParticipant {
  id: string
  project_id: string
  contact_id: string
  role: ParticipantRole
  role_other: string | null
  created_at: string
}

export function getParticipantRoleLabel(participant: Pick<ProjectParticipant, 'role' | 'role_other'>) {
  return participant.role === 'other' && participant.role_other
    ? participant.role_other
    : ROLE_LABELS[participant.role]
}

export function formatDateRange(startDate: string | null, endDate: string | null) {
  if (!startDate && !endDate) return null
  const format = (value: string) => new Date(value).toLocaleDateString('de-DE')
  if (startDate && endDate) return `${format(startDate)} – ${format(endDate)}`
  if (startDate) return `seit ${format(startDate)}`
  return `bis ${format(endDate!)}`
}
