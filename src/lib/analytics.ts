import { Category, CATEGORY_LABELS, Contact, Strength, STRENGTH_LABELS } from '@/lib/contacts'
import { Channel, CHANNEL_LABELS, Interaction } from '@/lib/interactions'

export type AnalyticsPeriod = 30 | 90 | 365

export const ANALYTICS_PERIODS: { value: AnalyticsPeriod; label: string }[] = [
  { value: 30, label: '30 Tage' },
  { value: 90, label: '90 Tage' },
  { value: 365, label: '12 Monate' },
]

export const MIN_INTERACTIONS_FOR_INSIGHTS = 3

export function periodStartDate(period: AnalyticsPeriod): Date {
  const start = new Date()
  start.setDate(start.getDate() - period)
  return start
}

export interface DistributionEntry {
  key: string
  label: string
  count: number
}

export function computeCategoryDistribution(contacts: Contact[]): DistributionEntry[] {
  const counts = new Map<string, number>()
  for (const contact of contacts) {
    const key = contact.category ?? 'none'
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return [...counts.entries()].map(([key, count]) => ({
    key,
    label: key === 'none' ? 'Ohne Kategorie' : CATEGORY_LABELS[key as Category],
    count,
  }))
}

export function computeStrengthDistribution(contacts: Contact[]): DistributionEntry[] {
  const counts = new Map<string, number>()
  for (const contact of contacts) {
    const key = contact.strength ? String(contact.strength) : 'none'
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return [...counts.entries()].map(([key, count]) => ({
    key,
    label: key === 'none' ? 'Ohne Stärke' : STRENGTH_LABELS[Number(key) as Strength],
    count,
  }))
}

export function computeOverdueCount(contacts: Contact[]): number {
  const today = new Date().toISOString().slice(0, 10)
  return contacts.filter((c) => c.next_followup_at !== null && c.next_followup_at <= today).length
}

export function computeChannelDistribution(interactions: Interaction[]): DistributionEntry[] {
  const counts = new Map<Channel, number>()
  for (const interaction of interactions) {
    counts.set(interaction.channel, (counts.get(interaction.channel) ?? 0) + 1)
  }
  return [...counts.entries()].map(([key, count]) => ({
    key,
    label: CHANNEL_LABELS[key],
    count,
  }))
}

export interface NetworkInsightsPayload {
  period: AnalyticsPeriod
  totalContacts: number
  totalInteractions: number
  overdueCount: number
  categoryDistribution: DistributionEntry[]
  strengthDistribution: DistributionEntry[]
  channelDistribution: DistributionEntry[]
}

export interface TrendBucket {
  bucketStart: string
  label: string
  count: number
}

// 30/90 Tage -> wöchentliche Buckets, 365 Tage -> monatliche Buckets
export function computeInteractionsTrend(
  interactions: Interaction[],
  period: AnalyticsPeriod
): TrendBucket[] {
  const grouping = period === 365 ? 'month' : 'week'
  const buckets = new Map<string, number>()

  for (const interaction of interactions) {
    const date = new Date(interaction.occurred_at)
    const bucketKey =
      grouping === 'month'
        ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
        : startOfWeek(date).toISOString().slice(0, 10)
    buckets.set(bucketKey, (buckets.get(bucketKey) ?? 0) + 1)
  }

  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([bucketStart, count]) => ({
      bucketStart,
      label: grouping === 'month' ? formatMonthLabel(bucketStart) : formatWeekLabel(bucketStart),
      count,
    }))
}

function startOfWeek(date: Date): Date {
  const result = new Date(date)
  const day = result.getDay()
  const diff = (day === 0 ? -6 : 1) - day // Montag als Wochenstart
  result.setDate(result.getDate() + diff)
  result.setHours(0, 0, 0, 0)
  return result
}

function formatWeekLabel(isoDate: string): string {
  const date = new Date(isoDate)
  return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })
}

function formatMonthLabel(bucketKey: string): string {
  const [year, month] = bucketKey.split('-')
  const date = new Date(Number(year), Number(month) - 1, 1)
  return date.toLocaleDateString('de-DE', { month: 'short', year: '2-digit' })
}

/** Refine 2026-07-03: serverseitig berechnet (Google-Token darf nicht in den Browser), Response-Contract für /api/analytics/meeting-frequency. */
export interface MeetingFrequencyEntry {
  contactId: string
  first_name: string
  last_name: string | null
  photo_url: string | null
  count: number
}

export interface MeetingFrequencyResponse {
  googleConnected: boolean
  entries: MeetingFrequencyEntry[]
  error?: boolean
}
