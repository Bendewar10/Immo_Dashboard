import { anthropic } from '@ai-sdk/anthropic'
import { generateObject } from 'ai'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createSupabaseServerClient } from '@/lib/supabase-server'

const messageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string(),
})

const requestSchema = z.object({
  messages: z.array(messageSchema),
})

const responseSchema = z.object({
  done: z.boolean().describe('true wenn genug Information für eine Zusammenfassung vorhanden ist und der Nutzer bestätigen soll'),
  message: z.string().describe('Nachricht an den Nutzer — entweder eine gezielte Folgefrage oder die Zusammenfassung zur Bestätigung'),
  goalsSummary: z.string().optional().describe('Kompakte 2-3-Satz-Zusammenfassung der Karriereziele, nur befüllen wenn done=true'),
})

const GOALS_SYSTEM_PROMPT = `Du bist ein persönlicher Karriere-Coach in einem Netzwerkpflege-Tool für Strategieberater (MBB-Kontext). Deine Aufgabe: In einem kurzen, freundlichen Gespräch die wichtigsten Karriereziele des Nutzers herausfinden.

Gesprächsstruktur (halte dich strikt daran):
1. Erste Frage: Was ist der nächste große Move — Exit (PE/Startup/Industrie), Partner-Track, Sabbatical/Educational Leave, Auslandsprojekt, oder etwas anderes?
2. Zweite Frage: Welcher Zeithorizont ist vorgestellt?
3. Optional eine dritte, gezielte Folgefrage basierend auf den Antworten (z. B. Zielbranchen, spezifisches Zielunternehmen, welche Kontakte fehlen noch)
4. Nach 2-3 Nutzerantworten: Zusammenfassung erstellen und done=true setzen

Regeln:
- Stelle immer exakt eine Frage pro Nachricht — nie mehrere gleichzeitig
- Maximal 3 Fragen insgesamt, dann Zusammenfassung
- Antworte auf Deutsch, per Du, kurz und freundlich, ohne Floskeln
- Die goalsSummary (nur wenn done=true) soll eine kompakte 2-3-Satz-Zusammenfassung sein, die ein KI-Assistent als Kontext nutzen kann: konkret, umsetzbar, ohne Weichspüler`

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
  const { messages } = parsed.data

  const userMessageCount = messages.filter((m) => m.role === 'user').length

  const systemWithHint =
    userMessageCount >= 3
      ? `${GOALS_SYSTEM_PROMPT}\n\nHINWEIS: Der Nutzer hat bereits ${userMessageCount} Fragen beantwortet. Erstelle jetzt die Zusammenfassung (done=true).`
      : GOALS_SYSTEM_PROMPT

  try {
    const { object } = await generateObject({
      model: anthropic('claude-sonnet-4-6'),
      schema: responseSchema,
      system: systemWithHint,
      messages: messages.length > 0 ? messages : [{ role: 'user', content: 'Start' }],
      providerOptions: { anthropic: { cacheControl: { type: 'ephemeral' } } },
    })

    return NextResponse.json(object)
  } catch {
    return NextResponse.json({ error: 'Antwort konnte nicht generiert werden.' }, { status: 502 })
  }
}
