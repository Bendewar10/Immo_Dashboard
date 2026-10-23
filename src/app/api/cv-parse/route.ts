import { anthropic } from '@ai-sdk/anthropic'
import { generateObject } from 'ai'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createSupabaseServerClient } from '@/lib/supabase-server'

const requestSchema = z.object({
  storagePath: z.string().min(1),
})

// Postgres `date` columns reject partial dates like "2014" — Claude is asked
// for full YYYY-MM-DD, but this transform is a server-side safety net that
// nulls out anything that isn't, instead of letting one bad date break the
// whole batch insert on the client.
const isoDateOrNull = z
  .string()
  .nullable()
  .transform((value) => (value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null))

const educationSchema = z.object({
  institution: z.string(),
  degree: z.string().nullable(),
  field_of_study: z.string().nullable(),
  city: z.string().nullable(),
  start_date: isoDateOrNull,
  end_date: isoDateOrNull,
})

const employmentSchema = z.object({
  employer: z.string(),
  job_title: z.string().nullable(),
  city: z.string().nullable(),
  start_date: isoDateOrNull,
  end_date: isoDateOrNull,
  description: z.string().nullable(),
})

const cvSchema = z.object({
  headline: z.string().nullable(),
  education: z.array(educationSchema),
  employment: z.array(employmentSchema),
  skills: z.array(z.string()),
  languages: z.array(z.string()),
})

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
  const { storagePath } = parsed.data

  const { data: file, error: downloadError } = await supabase.storage.from('cv-uploads').download(storagePath)
  if (downloadError || !file) {
    return NextResponse.json({ error: 'Datei nicht gefunden.' }, { status: 404 })
  }

  const base64Pdf = Buffer.from(await file.arrayBuffer()).toString('base64')

  try {
    const { object } = await generateObject({
      model: anthropic('claude-sonnet-4-6'),
      schema: cvSchema,
      providerOptions: { anthropic: { cacheControl: { type: 'ephemeral' } } },
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Extrahiere die strukturierten Lebenslauf-Daten aus diesem PDF auf Deutsch: Kurzbeschreibung/Headline, Ausbildung (Institution, Abschluss, Fachrichtung, Stadt, Zeitraum), Berufserfahrung (Arbeitgeber, Rolle, Stadt, Zeitraum, kurze Beschreibung), Skills und Sprachen. Felder ohne Information als null, Listen ohne erkennbare Einträge als leeres Array. Wichtig für start_date/end_date: IMMER im Format YYYY-MM-DD, nie nur eine Jahreszahl oder Jahr-Monat. Wenn das CV nur ein Jahr nennt (z. B. "2014"), nutze den 1. Januar dieses Jahres (also "2014-01-01"). Wenn gar kein Datum erkennbar ist, gib null zurück — niemals einen unvollständigen String.',
            },
            { type: 'file', data: base64Pdf, mediaType: 'application/pdf' },
          ],
        },
      ],
    })

    return NextResponse.json(object)
  } catch {
    return NextResponse.json({ error: 'Lebenslauf konnte nicht ausgelesen werden.' }, { status: 502 })
  }
}
