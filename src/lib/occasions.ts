import { Contact } from '@/lib/contacts'

export type OccasionBadge = 'followup' | 'birthday'

export interface ContactOccasion {
  contact: Contact
  badges: OccasionBadge[]
  followupDate: string | null
  birthdayDate: string | null
}

function toDateOnly(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function daysBetween(from: Date, to: Date) {
  return Math.round((toDateOnly(to).getTime() - toDateOnly(from).getTime()) / 86400000)
}

function isLeapYear(year: number) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
}

function resolveBirthdayDay(month: number, day: number, year: number) {
  return month === 2 && day === 29 && !isLeapYear(year) ? 28 : day
}

export function nextBirthdayOccurrence(birthday: string, today: Date): Date {
  const [, month, day] = birthday.split('-').map(Number)
  const thisYear = today.getFullYear()
  const candidate = new Date(thisYear, month - 1, resolveBirthdayDay(month, day, thisYear))
  if (toDateOnly(candidate) < toDateOnly(today)) {
    const nextYear = thisYear + 1
    return new Date(nextYear, month - 1, resolveBirthdayDay(month, day, nextYear))
  }
  return candidate
}

export const UPCOMING_WINDOW_DAYS = 14

export function computeOccasionSections(contacts: Contact[], today: Date = new Date()) {
  const todaySection: ContactOccasion[] = []
  const upcoming: { occasion: ContactOccasion; sortDate: Date }[] = []

  for (const contact of contacts) {
    const todayBadges: OccasionBadge[] = []
    const upcomingBadges: OccasionBadge[] = []
    let upcomingSortDate: Date | null = null

    if (contact.next_followup_at) {
      const followupDate = new Date(contact.next_followup_at)
      const followupDays = daysBetween(today, followupDate)
      if (followupDays <= 0) {
        todayBadges.push('followup')
      } else if (followupDays <= UPCOMING_WINDOW_DAYS) {
        upcomingBadges.push('followup')
        upcomingSortDate = followupDate
      }
    }

    if (contact.birthday) {
      const nextOccurrence = nextBirthdayOccurrence(contact.birthday, today)
      const birthdayDays = daysBetween(today, nextOccurrence)
      if (birthdayDays === 0) {
        todayBadges.push('birthday')
      } else if (birthdayDays <= UPCOMING_WINDOW_DAYS) {
        upcomingBadges.push('birthday')
        if (!upcomingSortDate || nextOccurrence < upcomingSortDate) {
          upcomingSortDate = nextOccurrence
        }
      }
    }

    if (todayBadges.length > 0) {
      todaySection.push({
        contact,
        badges: todayBadges,
        followupDate: contact.next_followup_at,
        birthdayDate: contact.birthday,
      })
    }
    if (upcomingBadges.length > 0 && upcomingSortDate) {
      upcoming.push({
        occasion: {
          contact,
          badges: upcomingBadges,
          followupDate: contact.next_followup_at,
          birthdayDate: contact.birthday,
        },
        sortDate: upcomingSortDate,
      })
    }
  }

  upcoming.sort((a, b) => a.sortDate.getTime() - b.sortDate.getTime())

  return { todaySection, upcomingSection: upcoming.map((u) => u.occasion) }
}
