import { anthropic } from '@ai-sdk/anthropic'
import { generateText } from 'ai'
import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import {
  formatSnapshotForPrompt,
  maybeEnrichContactProfile,
  type EnrichableContact,
} from '@/lib/linkedin-profile'

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createSupabaseServerClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) {
    return NextResponse.json({ error: 'Nicht eingeloggt.' }, { status: 401 })
  }

  const { id: contactId } = await params

  if (!contactId || !/^[0-9a-f-]{36}$/.test(contactId)) {
    return NextResponse.json({ error: 'Ungültige Kontakt-ID.' }, { status: 400 })
  }

  const [{ data: contact }, { data: profile }, { data: education }, { data: employment }] =
    await Promise.all([
      supabase
        .from('contacts')
        .select(
          'id, first_name, last_name, employer, job_title, city, context, notes, linkedin_url, linkedin_profile, linkedin_profile_at'
        )
        .eq('id', contactId)
        .single(),
      supabase
        .from('user_profile')
        .select('headline, skills, languages')
        .eq('user_id', userData.user.id)
        .single(),
      supabase
        .from('user_education')
        .select('institution, degree, field_of_study, city, start_date, end_date')
        .eq('user_id', userData.user.id)
        .order('start_date', { ascending: false }),
      supabase
        .from('user_employment')
        .select('employer, job_title, city, start_date, end_date')
        .eq('user_id', userData.user.id)
        .order('start_date', { ascending: false }),
    ])

  if (!contact) {
    return NextResponse.json({ error: 'Kontakt nicht gefunden.' }, { status: 404 })
  }

  // On-demand LinkedIn-Profil-Enrichment (Best-Effort, PROJ-20-Erweiterung):
  // scraped bei Bedarf (Cooldown), füllt leere Felder, liefert Snapshot als KI-Kontext.
  // Fehler brechen die Analyse nie ab — sie läuft dann auf den vorhandenen Daten weiter.
  const enrichable: EnrichableContact = {
    id: contact.id,
    employer: contact.employer ?? null,
    job_title: contact.job_title ?? null,
    city: contact.city ?? null,
    linkedin_url: contact.linkedin_url ?? null,
    linkedin_profile: (contact.linkedin_profile as EnrichableContact['linkedin_profile']) ?? null,
    linkedin_profile_at: contact.linkedin_profile_at ?? null,
  }
  const { contact: enriched, snapshot } = await maybeEnrichContactProfile(
    supabase,
    enrichable,
    process.env.APIFY_TOKEN
  )

  const hasProfileData =
    profile || (education && education.length > 0) || (employment && employment.length > 0)
  if (!hasProfileData) {
    return NextResponse.json(
      { error: 'Kein Profil vorhanden. Bitte zuerst CV hochladen.' },
      { status: 422 }
    )
  }

  const myProfile = [
    profile?.headline ? `Headline: ${profile.headline}` : null,
    employment && employment.length > 0
      ? `Berufserfahrung: ${employment.map((e) => `${e.job_title ?? ''} bei ${e.employer}${e.city ? ` (${e.city})` : ''}`).join(', ')}`
      : null,
    education && education.length > 0
      ? `Ausbildung: ${education.map((e) => `${e.degree ?? e.field_of_study ?? ''} an ${e.institution}${e.city ? ` (${e.city})` : ''}`).join(', ')}`
      : null,
    profile?.skills && profile.skills.length > 0 ? `Skills: ${profile.skills.join(', ')}` : null,
    profile?.languages && profile.languages.length > 0
      ? `Sprachen: ${profile.languages.join(', ')}`
      : null,
  ]
    .filter(Boolean)
    .join('\n')

  const contactName = [contact.first_name, contact.last_name].filter(Boolean).join(' ')
  const contactProfile = [
    enriched.employer && enriched.job_title
      ? `${enriched.job_title} bei ${enriched.employer}`
      : enriched.employer || enriched.job_title || null,
    enriched.city ? `Standort: ${enriched.city}` : null,
    contact.context ? `Kontext: ${contact.context}` : null,
    contact.notes ? `Notizen: ${contact.notes}` : null,
    snapshot ? formatSnapshotForPrompt(snapshot) : null,
  ]
    .filter(Boolean)
    .join('\n')

  if (!contactProfile.trim()) {
    return NextResponse.json(
      { error: 'Zu wenig Kontaktinformationen für eine Analyse. Bitte Kontakt zuerst ergänzen.' },
      { status: 422 }
    )
  }

  const prompt = `Du analysierst Gemeinsamkeiten zwischen mir und einem Kontakt, um persönliche Anknüpfungspunkte für Gespräche und Nachrichten zu identifizieren.

Mein Profil:
${myProfile}

Kontakt: ${contactName}
${contactProfile}

Identifiziere konkrete Gemeinsamkeiten: gleiche Arbeitgeber, Branchen, Städte, Universitäten, Skills, Netzwerke oder gemeinsame Themen die sich aus dem Kontext ergeben. Schreib 2-4 kurze, prägnante Stichpunkte auf Deutsch. Nur echte Überschneidungen — keine Vermutungen. Falls keine erkennbaren Gemeinsamkeiten existieren, schreib: "Keine direkten Gemeinsamkeiten erkennbar."`

  try {
    const { text } = await generateText({
      model: anthropic('claude-sonnet-4-6'),
      prompt,
      maxOutputTokens: 200,
      providerOptions: { anthropic: { cacheControl: { type: 'ephemeral' } } },
    })

    const result = text.trim()

    await supabase.from('contacts').update({ commonalities: result }).eq('id', contactId)

    return NextResponse.json({ commonalities: result })
  } catch {
    return NextResponse.json(
      { error: 'Analyse konnte nicht durchgeführt werden.' },
      { status: 502 }
    )
  }
}
