import { anthropic } from '@ai-sdk/anthropic'
import { generateObject } from 'ai'
import { z } from 'zod'
import { DistributionEntry } from '@/lib/analytics'
import { ReportMetrics } from '@/lib/report-data'

export const reportSectionsSchema = z.object({
  executiveSummary: z.string(),
  activity: z.string(),
  relationshipHealth: z.string(),
  recommendation: z.string(),
})

export type ReportSections = z.infer<typeof reportSectionsSchema>

function formatList(entries: DistributionEntry[]): string {
  if (entries.length === 0) return 'keine'
  return entries.map((e) => `${e.label}: ${e.count}`).join(', ')
}

function buildPrompt(metrics: ReportMetrics): string {
  const deltaLine = metrics.showDelta
    ? `- Kontaktmomente Vormonat: ${metrics.interactionsPrevMonth} (Δ ${metrics.interactionDelta >= 0 ? '+' : ''}${metrics.interactionDelta})`
    : `- Kein Vormonatsvergleich verfügbar (erster Berichtszeitraum) — keine Δ-Aussagen treffen`

  return `Du bist ein scharfsinniger Strategieberater (Stil eines Top-Beratungshauses) und analysierst das persönliche Beziehungsnetzwerk deines Klienten für ${metrics.monthLabel}. Es ist KEIN Vertriebs-CRM, sondern private Beziehungspflege.

Daten:
- Kontakte gesamt: ${metrics.totalContacts}
- Neue Kontakte diesen Monat: ${metrics.newContactsThisMonth}
- Kontaktmomente diesen Monat: ${metrics.interactionsThisMonth}
${deltaLine}
- Kontaktmomente nach Kanal (diesen Monat): ${formatList(metrics.channelThisMonth)}
- Kontakte nach Kategorie: ${formatList(metrics.categoryDistribution)}
- Kontakte nach Beziehungsstärke: ${formatList(metrics.strengthDistribution)}
- Aktuell überfällige Kontakte: ${metrics.overdueCount} (davon Kernkontakte: ${metrics.overdueCoreCount})
${metrics.isQuietMonth ? '- HINWEIS: Ruhiger Monat (keine Aktivität). Schreib im sanften Anstoß-Ton, nicht als Statistik.' : ''}

Liefere vier Abschnitte auf Deutsch, per Du, in klarem Berater-Ton:
- executiveSummary: 1-2 Sätze, die Kernaussage des Monats auf den Punkt.
- activity: 2-3 Sätze zur Aktivität (Volumen, Kanäle, Veränderung).
- relationshipHealth: 2-3 Sätze zu Beziehungs-Gesundheit/Risiken — welche Tiers/Kategorien werden vernachlässigt, was bedeuten überfällige Kernkontakte. Nenne keine einzelnen Personen, nur aggregierte Kategorien/Stärken.
- recommendation: 1-3 konkrete Handlungsempfehlungen für den nächsten Monat.

Strikt an die echten Zahlen halten, keine erfundenen Details, keine generischen Plattitüden ohne Datenbezug. Reiner Fließtext pro Abschnitt, kein Markdown, keine Überschriften, keine Aufzählungszeichen.`
}

export async function generateReportSections(metrics: ReportMetrics): Promise<ReportSections> {
  const { object } = await generateObject({
    model: anthropic('claude-haiku-4-5-20251001'),
    schema: reportSectionsSchema,
    prompt: buildPrompt(metrics),
    maxOutputTokens: 700,
    providerOptions: { anthropic: { cacheControl: { type: 'ephemeral' } } },
  })
  return object
}
