import { anthropic } from '@ai-sdk/anthropic'
import { generateText } from 'ai'
import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'

export async function POST() {
  const supabase = await createSupabaseServerClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) {
    return NextResponse.json({ error: 'Nicht eingeloggt.' }, { status: 401 })
  }
  const userId = userData.user.id

  const [{ data: profile }, { data: education }, { data: employment }, { data: projects }] =
    await Promise.all([
      supabase.from('user_profile').select('headline, skills, languages').eq('user_id', userId).maybeSingle(),
      supabase.from('user_education').select('institution, degree, field_of_study, start_date, end_date').eq('user_id', userId),
      supabase.from('user_employment').select('employer, job_title, start_date, end_date').eq('user_id', userId).order('start_date', { ascending: false }),
      supabase.from('projects').select('title, client, start_date, end_date, status').eq('user_id', userId).order('start_date', { ascending: false }).limit(5),
    ])

  const hasData = (education?.length ?? 0) > 0 || (employment?.length ?? 0) > 0
  if (!hasData) {
    return NextResponse.json({ bio: null })
  }

  const parts: string[] = []

  if (profile?.headline) parts.push(`Headline: ${profile.headline}`)

  if (employment && employment.length > 0) {
    const jobs = employment
      .slice(0, 4)
      .map((e) => `${e.job_title ?? ''}${e.job_title && e.employer ? ' bei ' : ''}${e.employer ?? ''}`.trim())
      .filter(Boolean)
    if (jobs.length > 0) parts.push(`Berufserfahrung: ${jobs.join(', ')}`)
  }

  if (education && education.length > 0) {
    const edu = education
      .slice(0, 3)
      .map((e) => `${e.degree ?? ''}${e.degree && e.institution ? ' an der ' : ''}${e.institution ?? ''}`.trim())
      .filter(Boolean)
    if (edu.length > 0) parts.push(`Ausbildung: ${edu.join(', ')}`)
  }

  if (profile?.skills && profile.skills.length > 0) {
    parts.push(`Skills: ${profile.skills.slice(0, 6).join(', ')}`)
  }

  if (profile?.languages && profile.languages.length > 0) {
    parts.push(`Sprachen: ${profile.languages.join(', ')}`)
  }

  if (projects && projects.length > 0) {
    const projectNames = projects.map((p) => p.client ? `${p.title} (${p.client})` : p.title).join(', ')
    parts.push(`Aktuelle/letzte Projekte: ${projectNames}`)
  }

  const context = parts.join('\n')

  try {
    const { text } = await generateText({
      model: anthropic('claude-sonnet-4-6'),
      providerOptions: { anthropic: { cacheControl: { type: 'ephemeral' } } },
      prompt: `Erstelle eine prägnante berufliche Kurzbeschreibung (2-3 Sätze, auf Deutsch, in der dritten Person oder als neutraler Steckbrief) basierend auf diesen Profildaten:\n\n${context}\n\nDie Beschreibung soll für einen KI-Assistenten als Kontext dienen, der dem Nutzer bei der Netzwerkpflege hilft. Fokus auf aktuelle Rolle, Background und Expertise. Kein Marketing-Sprech.`,
      maxOutputTokens: 150,
    })

    const bio = text.trim()

    await supabase
      .from('user_profile')
      .upsert({ user_id: userId, bio, bio_updated_at: new Date().toISOString() }, { onConflict: 'user_id' })

    return NextResponse.json({ bio })
  } catch {
    return NextResponse.json({ error: 'Bio konnte nicht generiert werden.' }, { status: 502 })
  }
}
