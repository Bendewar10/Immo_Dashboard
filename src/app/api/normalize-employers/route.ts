import { anthropic } from '@ai-sdk/anthropic'
import { generateObject } from 'ai'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createSupabaseServerClient } from '@/lib/supabase-server'

// Pro Lauf maximal so viele unterschiedliche Rohnamen normalisieren (Kosten-/Token-Deckel);
// Rest wird beim nächsten Trigger nachgeholt.
const BATCH_LIMIT = 150

// In-Memory-Rate-Limit pro Nutzer (Sliding Window). Gilt pro warmer Instanz —
// für Single-User-Schutz gegen KI-Kosten-Spam ausreichend, kein Redis nötig.
const RATE_LIMIT_MAX = 5
const RATE_LIMIT_WINDOW_MS = 60_000
const requestLog = new Map<string, number[]>()

function isRateLimited(userId: string): boolean {
  const now = Date.now()
  const recent = (requestLog.get(userId) ?? []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS)
  if (recent.length >= RATE_LIMIT_MAX) {
    requestLog.set(userId, recent)
    return true
  }
  recent.push(now)
  requestLog.set(userId, recent)
  return false
}

const mappingSchema = z.object({
  mappings: z.array(
    z.object({
      raw: z.string(),
      canonical: z.string(),
    })
  ),
})

export async function POST() {
  const supabase = await createSupabaseServerClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) {
    return NextResponse.json({ error: 'Nicht eingeloggt.' }, { status: 401 })
  }

  if (isRateLimited(userData.user.id)) {
    return NextResponse.json(
      { error: 'Zu viele Anfragen. Bitte kurz warten.' },
      { status: 429 }
    )
  }

  const { data: rows, error: selectError } = await supabase
    .from('contacts')
    .select('employer, employer_normalized')
    .eq('user_id', userData.user.id)
    .not('employer', 'is', null)

  if (selectError) {
    return NextResponse.json({ error: 'Kontakte konnten nicht geladen werden.' }, { status: 500 })
  }

  const pending = new Set<string>()
  const known = new Set<string>()
  for (const row of rows ?? []) {
    if (!row.employer?.trim()) continue
    if (row.employer_normalized) {
      known.add(row.employer_normalized)
    } else {
      // Unverändert übernehmen, damit das spätere .in('employer', ...) exakt matcht
      pending.add(row.employer)
    }
  }

  if (pending.size === 0) {
    return NextResponse.json({ normalized: 0 })
  }

  const batch = [...pending].slice(0, BATCH_LIMIT)

  const prompt = `Du normalisierst Firmennamen für ein persönliches Kontakt-Tool. Ordne jedem Rohnamen den kanonischen Firmennamen zu.

Regeln:
- Schreibweisen-Varianten derselben Firma bekommen denselben kanonischen Namen (z.B. "McKinsey", "McKinsey & Company", "McKinsey & Co." → "McKinsey & Company")
- Nutze den offiziellen, gebräuchlichen Firmennamen als kanonische Form
- VERSCHIEDENE Firmen mit ähnlichem Namen NIEMALS zusammenfassen (z.B. "Bain & Company" und "Bain Capital" sind zwei verschiedene Firmen)
- Im Zweifel den Rohnamen unverändert als kanonisch übernehmen
- Bevorzuge bereits bekannte kanonische Namen, wenn sie zur selben Firma gehören

Bereits bekannte kanonische Namen:
${known.size > 0 ? [...known].map((name) => `- ${name}`).join('\n') : '- (noch keine)'}

Zu normalisierende Rohnamen:
${batch.map((name) => `- ${name}`).join('\n')}

Gib für JEDEN Rohnamen genau ein Mapping zurück.`

  let mappings: { raw: string; canonical: string }[]
  try {
    const { object } = await generateObject({
      model: anthropic('claude-haiku-4-5-20251001'),
      schema: mappingSchema,
      prompt,
    })
    mappings = object.mappings
  } catch {
    return NextResponse.json(
      { error: 'Normalisierung konnte nicht durchgeführt werden.' },
      { status: 502 }
    )
  }

  // KI-Antwort absichern: nur angefragte Rohnamen übernehmen,
  // fehlende Rohnamen identisch mappen (gelten dann als erledigt, kein Dauer-Pending)
  const batchSet = new Set(batch)
  const canonicalByRaw = new Map<string, string>()
  for (const { raw, canonical } of mappings) {
    if (batchSet.has(raw) && canonical.trim()) {
      canonicalByRaw.set(raw, canonical.trim())
    }
  }
  for (const raw of batch) {
    if (!canonicalByRaw.has(raw)) canonicalByRaw.set(raw, raw)
  }

  // Updates pro kanonischem Namen bündeln; nur unnormalisierte Kontakte anfassen
  // (manuelle Korrekturen haben employer_normalized gesetzt und bleiben unberührt)
  const rawsByCanonical = new Map<string, string[]>()
  for (const [raw, canonical] of canonicalByRaw) {
    const raws = rawsByCanonical.get(canonical) ?? []
    raws.push(raw)
    rawsByCanonical.set(canonical, raws)
  }

  const normalizedAt = new Date().toISOString()
  for (const [canonical, raws] of rawsByCanonical) {
    const { error: updateError } = await supabase
      .from('contacts')
      .update({
        employer_normalized: canonical,
        employer_normalized_source: 'ai',
        employer_normalized_at: normalizedAt,
      })
      .eq('user_id', userData.user.id)
      .is('employer_normalized', null)
      .in('employer', raws)

    if (updateError) {
      return NextResponse.json(
        { error: 'Normalisierung konnte nicht gespeichert werden.' },
        { status: 500 }
      )
    }
  }

  return NextResponse.json({ normalized: canonicalByRaw.size })
}
