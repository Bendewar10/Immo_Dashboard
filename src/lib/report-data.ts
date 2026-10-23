import { Contact } from '@/lib/contacts'
import { Interaction } from '@/lib/interactions'
import {
  computeCategoryDistribution,
  computeChannelDistribution,
  computeStrengthDistribution,
  DistributionEntry,
} from '@/lib/analytics'

// --- Scheduling helper -------------------------------------------------------

// Letzter Sonntag im Monat: heute ist Sonntag UND in 7 Tagen ist ein anderer Monat.
export function isLastSundayOfMonth(now: Date): boolean {
  if (now.getDay() !== 0) return false
  const inSevenDays = new Date(now)
  inSevenDays.setDate(inSevenDays.getDate() + 7)
  return inSevenDays.getMonth() !== now.getMonth()
}

// --- Month helpers -----------------------------------------------------------

function yearMonth(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function previousYearMonth(date: Date): string {
  const prev = new Date(date.getFullYear(), date.getMonth() - 1, 1)
  return yearMonth(prev)
}

function monthLabel(date: Date): string {
  return date.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })
}

// occurred_at ist 'YYYY-MM-DD', created_at/next_followup_at sind ISO-Timestamps —
// die ersten 7 bzw. 10 Zeichen genügen für Monats-/Datumsvergleiche (lexikografisch sortierbar).
function inMonth(isoDate: string, ym: string): boolean {
  return isoDate.slice(0, 7) === ym
}

// --- Report metrics ----------------------------------------------------------

export interface ReportMetrics {
  monthLabel: string
  totalContacts: number
  newContactsThisMonth: number
  interactionsThisMonth: number
  interactionsPrevMonth: number
  interactionDelta: number
  showDelta: boolean
  isQuietMonth: boolean
  channelThisMonth: DistributionEntry[]
  categoryDistribution: DistributionEntry[]
  strengthDistribution: DistributionEntry[]
  overdueCount: number
  overdueCoreCount: number
}

// Erwartet ALLE Kontakte des Nutzers und die Interactions ab Beginn des Vormonats.
export function buildReportMetrics(
  contacts: Contact[],
  interactions: Interaction[],
  now: Date
): ReportMetrics {
  const currentYM = yearMonth(now)
  const prevYM = previousYearMonth(now)
  const currentMonthStart = `${currentYM}-01`
  const today = now.toISOString().slice(0, 10)

  const thisMonthInteractions = interactions.filter((i) => inMonth(i.occurred_at, currentYM))
  const prevMonthInteractions = interactions.filter((i) => inMonth(i.occurred_at, prevYM))

  const newContactsThisMonth = contacts.filter((c) => inMonth(c.created_at, currentYM)).length
  const contactExistedBeforeThisMonth = contacts.some((c) => c.created_at.slice(0, 7) < currentYM)

  const overdue = contacts.filter((c) => c.next_followup_at !== null && c.next_followup_at <= today)
  const overdueCoreCount = overdue.filter((c) => c.strength === 1).length

  const interactionsThisMonth = thisMonthInteractions.length
  const interactionsPrevMonth = prevMonthInteractions.length

  return {
    monthLabel: monthLabel(now),
    totalContacts: contacts.length,
    newContactsThisMonth,
    interactionsThisMonth,
    interactionsPrevMonth,
    interactionDelta: interactionsThisMonth - interactionsPrevMonth,
    // Δ nur zeigen, wenn es Historie gibt (Vormonat hatte Aktivität ODER es gab schon vorher Kontakte)
    showDelta: interactionsPrevMonth > 0 || contactExistedBeforeThisMonth,
    isQuietMonth: interactionsThisMonth === 0 && newContactsThisMonth === 0,
    channelThisMonth: computeChannelDistribution(thisMonthInteractions),
    categoryDistribution: computeCategoryDistribution(contacts),
    strengthDistribution: computeStrengthDistribution(contacts),
    overdueCount: overdue.length,
    overdueCoreCount,
  }
}

// Beginn des Vormonats als 'YYYY-MM-DD' — für die Interactions-Query im Job.
export function previousMonthStartDate(now: Date): string {
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  return `${yearMonth(prev)}-01`
}
