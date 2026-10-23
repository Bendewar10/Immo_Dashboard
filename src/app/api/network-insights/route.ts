import { anthropic } from '@ai-sdk/anthropic'
import { generateText } from 'ai'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import {
  computeCategoryDistribution,
  computeChannelDistribution,
  computeOverdueCount,
  computeStrengthDistribution,
  MIN_INTERACTIONS_FOR_INSIGHTS,
  periodStartDate,
} from '@/lib/analytics'
import { Contact } from '@/lib/contacts'
import { Interaction } from '@/lib/interactions'

const requestSchema = z.object({
  period: z.union([z.literal(30), z.literal(90), z.literal(365)]),
})

const MAX_INSIGHT_LENGTH = 600

function formatList(entries: { label: string; count: number }[]): string {
  return entries.map((e) => `${e.label}: ${e.count}`).join(', ')
}

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) {
    return NextResponse.json({ error: 'Nicht eingeloggt.' }, { status: 401 })
  }

  const parsed = requestSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Ungültige Anfrage.' }, { status: 400 })
  }
  const { period } = parsed.data

  // Zahlen werden serverseitig aus den eigenen Daten neu berechnet (RLS-geschützt),
  // statt dem Client-Payload zu vertrauen — verhindert manipulierte/veraltete Zahlen im KI-Prompt.
  const [{ data: contacts }, { data: interactions }] = await Promise.all([
    supabase.from('contacts').select('*'),
    supabase
      .from('interactions')
      .select('*')
      .gte('occurred_at', periodStartDate(period).toISOString().slice(0, 10)),
  ])

  const safeContacts = (contacts ?? []) as Contact[]
  const safeInteractions = (interactions ?? []) as Interaction[]

  if (safeInteractions.length < MIN_INTERACTIONS_FOR_INSIGHTS) {
    return NextResponse.json({ error: 'Nicht genug Daten für Insights.' }, { status: 400 })
  }

  const categoryDistribution = computeCategoryDistribution(safeContacts)
  const strengthDistribution = computeStrengthDistribution(safeContacts)
  const channelDistribution = computeChannelDistribution(safeInteractions)
  const overdueCount = computeOverdueCount(safeContacts)
  const periodLabel = period === 365 ? 'letzten 12 Monate' : `letzten ${period} Tage`

  const prompt = `Du analysierst aggregierte Statistiken eines persönlichen Beziehungsnetzwerks (kein CRM). Daten für die ${periodLabel}:
- Kontakte gesamt: ${safeContacts.length}
- Kontakte nach Kategorie: ${formatList(categoryDistribution)}
- Kontakte nach Beziehungsstärke: ${formatList(strengthDistribution)}
- Aktuell überfällige Kontakte: ${overdueCount}
- Kontaktmomente im Zeitraum: ${safeInteractions.length}
- Kontaktmomente nach Kanal: ${formatList(channelDistribution)}

Schreib auf Deutsch, per Du, 2-4 Sätze, die sich konkret auf diese Zahlen beziehen (was lief gut, was fällt auf), gefolgt von genau einem konkreten Verbesserungsvorschlag. Nenne keine einzelnen Personen, nur die aggregierten Kategorien/Stärken. Keine generischen Plattitüden ohne Bezug zu den Zahlen. Antworte als reiner Fließtext ohne Markdown, ohne Überschriften, ohne Sternchen/Aufzählungszeichen.`

  try {
    const { text } = await generateText({
      model: anthropic('claude-sonnet-4-6'),
      prompt,
      maxOutputTokens: 220,
      providerOptions: { anthropic: { cacheControl: { type: 'ephemeral' } } },
    })
    return NextResponse.json({ text: text.trim().slice(0, MAX_INSIGHT_LENGTH) })
  } catch (err) {
    console.error('DEBUG network-insights AI error:', err)
    return NextResponse.json({ error: 'Insights konnten nicht generiert werden.' }, { status: 502 })
  }
}
