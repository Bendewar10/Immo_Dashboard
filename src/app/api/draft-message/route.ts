import { anthropic } from '@ai-sdk/anthropic'
import { generateText } from 'ai'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { CATEGORY_LABELS, STRENGTH_LABELS, type Category, type Strength } from '@/lib/contacts'

const requestSchema = z
  .object({
    contactId: z.string().uuid(),
    occasionType: z.enum(['followup', 'birthday', 'Jobwechsel', 'Beförderung', 'citytrip']),
    tone: z.string().trim().max(200).optional(),
    // City-Trip-Kontext (PROJ-14)
    city: z.string().trim().max(100).optional(),
    timeframe: z.string().trim().max(100).optional(),
  })
  .refine((data) => data.occasionType !== 'citytrip' || !!data.city, {
    message: 'city ist für citytrip erforderlich',
  })

const MAX_DRAFT_LENGTH = 300

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
  const { contactId, occasionType, tone, city, timeframe } = parsed.data

  const [{ data: contact }, { data: userProfile }] = await Promise.all([
    supabase
      .from('contacts')
      .select('first_name, last_name, notes, context, employer, job_title, city, category, strength')
      .eq('id', contactId)
      .single(),
    supabase
      .from('user_profile')
      .select('bio, goals_text')
      .eq('user_id', userData.user.id)
      .maybeSingle(),
  ])

  if (!contact) {
    return NextResponse.json({ error: 'Kontakt nicht gefunden.' }, { status: 404 })
  }

  const profileDetails = [
    contact.last_name ? `Nachname: ${contact.last_name}` : null,
    contact.job_title && contact.employer
      ? `${contact.job_title} bei ${contact.employer}`
      : contact.job_title || contact.employer || null,
    contact.city ? `wohnt in ${contact.city}` : null,
    contact.category ? `Kategorie: ${CATEGORY_LABELS[contact.category as Category]}` : null,
    contact.strength ? `Beziehung: ${STRENGTH_LABELS[contact.strength as Strength]}` : null,
    contact.context,
    contact.notes,
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

  const userContextParts: string[] = []
  if (userProfile?.bio) userContextParts.push(`Profil des Absenders: ${userProfile.bio}`)
  if (userProfile?.goals_text) userContextParts.push(`Karriereziele des Absenders: ${userProfile.goals_text}`)
  const userContextInstruction =
    userContextParts.length > 0
      ? ` Nutze bei Bedarf diesen Kontext über den Absender: ${userContextParts.join('. ')}.`
      : ''

  const MIN_STYLE_NOTE_LENGTH = 20
  const { data: styleRows } = await supabase
    .from('interactions')
    .select('note')
    .not('note', 'is', null)
    .order('occurred_at', { ascending: false })
    .limit(20)

  const styleExamples = (styleRows ?? [])
    .map((row) => row.note)
    .filter((note): note is string => Boolean(note) && note.trim().length > MIN_STYLE_NOTE_LENGTH)
    .slice(0, 5)

  const styleInstruction =
    styleExamples.length > 0
      ? ` Schreib im selben Schreibstil wie diese eigenen früheren Notizen: ${styleExamples.join(' / ')}.`
      : ''

  const toneInstruction = tone ? ` Zusätzliche Anweisung zum Ton/Stil dieser Nachricht: ${tone}.` : ''

  const prompt =
    occasionType === 'citytrip'
      ? `Schreib eine sehr kurze, lockere Nachricht (1-2 Sätze, auf Deutsch, per Du) an ${contact.first_name}: Ich bin beruflich${
          timeframe ? ` im Zeitraum ${timeframe}` : ' demnächst regelmäßig'
        } in ${city} und würde mich gern spontan auf einen Kaffee oder Abendessen treffen. ${
          profileDetails ? `Kontext zur Person: ${profileDetails}.` : ''
        }${
          recentNotes.length > 0
            ? ` Letzte Notizen über frühere Kontakte: ${recentNotes.join(' / ')}.`
            : ''
        } Knüpf wenn möglich an Kontext und Notizen an.${styleInstruction}${userContextInstruction}${toneInstruction}`
      : occasionType === 'birthday'
      ? `Schreib eine sehr kurze, herzliche Geburtstagsnachricht (1-2 Sätze, auf Deutsch, per Du) an ${contact.first_name}. ${
          profileDetails ? `Kontext zur Person: ${profileDetails}.` : ''
        }${styleInstruction}${userContextInstruction}${toneInstruction}`
      : occasionType === 'Jobwechsel' || occasionType === 'Beförderung'
        ? `Schreib eine sehr kurze, herzliche Glückwunsch-Nachricht (1-2 Sätze, auf Deutsch, per Du) an ${contact.first_name} zu ${
            occasionType === 'Jobwechsel' ? 'seinem/ihrem neuen Job' : 'seiner/ihrer Beförderung'
          }. ${profileDetails ? `Kontext zur Person: ${profileDetails}.` : ''}${styleInstruction}${userContextInstruction}${toneInstruction}`
        : `Schreib eine sehr kurze, lockere Nachricht (1-2 Sätze, auf Deutsch, per Du), um sich bei ${contact.first_name} zu melden. ${
            profileDetails ? `Kontext zur Person: ${profileDetails}.` : ''
          }${
            recentNotes.length > 0
              ? ` Letzte Notizen über frühere Kontakte: ${recentNotes.join(' / ')}.`
              : ''
          } Knüpf wenn möglich an Kontext und Notizen an.${styleInstruction}${userContextInstruction}${toneInstruction}`

  try {
    const { text } = await generateText({
      model: anthropic('claude-sonnet-4-6'),
      prompt,
      maxOutputTokens: 120,
      providerOptions: { anthropic: { cacheControl: { type: 'ephemeral' } } },
    })
    return NextResponse.json({ text: text.trim().slice(0, MAX_DRAFT_LENGTH) })
  } catch {
    return NextResponse.json({ error: 'Vorschlag konnte nicht generiert werden.' }, { status: 502 })
  }
}
