import { anthropic } from '@ai-sdk/anthropic'
import { generateText } from 'ai'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { CATEGORY_LABELS, STRENGTH_LABELS, type Category, type Strength } from '@/lib/contacts'

const requestSchema = z.object({
  contactId: z.string().uuid(),
})

const MAX_SUMMARY_LENGTH = 400

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
  const { contactId } = parsed.data

  const { data: contact } = await supabase
    .from('contacts')
    .select('first_name, notes, context, employer, job_title, city, category, strength, commonalities')
    .eq('id', contactId)
    .single()

  if (!contact) {
    return NextResponse.json({ error: 'Kontakt nicht gefunden.' }, { status: 404 })
  }

  const profileDetails = [
    contact.job_title && contact.employer
      ? `${contact.job_title} bei ${contact.employer}`
      : contact.job_title || contact.employer || null,
    contact.city ? `wohnt in ${contact.city}` : null,
    contact.category ? `Kategorie: ${CATEGORY_LABELS[contact.category as Category]}` : null,
    contact.strength ? `Beziehung: ${STRENGTH_LABELS[contact.strength as Strength]}` : null,
    contact.commonalities ? `Gemeinsamkeiten: ${contact.commonalities}` : null,
    contact.context,
  ]
    .filter((value): value is string => Boolean(value))
    .join('. ')

  const { data: interactions } = await supabase
    .from('interactions')
    .select('note, occurred_at')
    .eq('contact_id', contactId)
    .order('occurred_at', { ascending: false })
    .limit(3)

  const recentNotes = (interactions ?? [])
    .map((i) => i.note)
    .filter((note): note is string => Boolean(note))

  const prompt =
    recentNotes.length > 0
      ? `Fasse in 2-3 kurzen Sätzen (Deutsch) für ${contact.first_name} zusammen, worum es zuletzt ging, als Vorbereitung auf ein gleich anstehendes Treffen. ${
          profileDetails ? `Kontext zur Person: ${profileDetails}.` : ''
        } Letzte Notizen über frühere Kontakte: ${recentNotes.join(' / ')}.`
      : `Schreib 1-2 kurze Sätze (Deutsch) als Vorbereitung auf ein gleich anstehendes Treffen mit ${contact.first_name} — es gibt noch keine bisherige Interaktions-Historie. ${
          profileDetails ? `Nutze diesen Kontext zur Person: ${profileDetails}.` : 'Weise darauf hin, dass es noch keine bisherige Historie gibt.'
        }`

  try {
    const { text } = await generateText({
      model: anthropic('claude-sonnet-4-6'),
      prompt,
      maxOutputTokens: 160,
      providerOptions: { anthropic: { cacheControl: { type: 'ephemeral' } } },
    })
    return NextResponse.json({ text: text.trim().slice(0, MAX_SUMMARY_LENGTH) })
  } catch {
    return NextResponse.json({ error: 'Zusammenfassung konnte nicht generiert werden.' }, { status: 502 })
  }
}
