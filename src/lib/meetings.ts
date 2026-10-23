export interface MeetingContact {
  id: string
  first_name: string
  last_name: string | null
  photo_url: string | null
  last_contacted_at: string | null
}

export interface MeetingGroup {
  id: string
  title: string
  date: string
  startTime: string | null
  endTime: string | null
  isAllDay: boolean
  location: string | null
  contacts: MeetingContact[]
}

export interface TodayMeetingsResponse {
  googleConnected: boolean
  meetings: MeetingGroup[]
  error?: boolean
}

/** Refine 2026-07-03: "Heute" -> null (kein Label), "Morgen" -> 'Morgen', danach Wochentagsname. */
export function formatDayLabel(dateStr: string, now: Date = new Date()) {
  const [year, month, day] = dateStr.split('-').map(Number)
  const eventDay = new Date(year, month - 1, day)
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)
  const diffDays = Math.round((eventDay.getTime() - today.getTime()) / 86_400_000)
  if (diffDays === 0) return null
  if (diffDays === 1) return 'Morgen'
  return eventDay.toLocaleDateString('de-DE', { weekday: 'long' })
}

/** Refine 2026-07-03: Post-Meeting-Nudge nur für heutige, nicht-ganztägige, bereits beendete Termine ohne Log seit Terminende. */
export function needsPostMeetingNudge(meeting: MeetingGroup, contact: MeetingContact, now: Date = new Date()) {
  if (meeting.isAllDay || !meeting.endTime) return false
  if (formatDayLabel(meeting.date, now) !== null) return false
  const endTime = new Date(meeting.endTime).getTime()
  if (endTime > now.getTime()) return false
  if (!contact.last_contacted_at) return true
  return new Date(contact.last_contacted_at).getTime() < endTime
}
