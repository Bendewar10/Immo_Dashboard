import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { createSupabaseAdminClient } from '@/lib/supabase-admin'
import { enrichUserPhotos } from '@/lib/photo-enrichment'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

// PROJ-20: Reichert die fotolosen Kontakte des eingeloggten Nutzers an.
// Wird vom LinkedIn-CSV-Import fire-and-forget angestoßen.
export async function POST() {
  const supabase = await createSupabaseServerClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) {
    return NextResponse.json({ error: 'Nicht eingeloggt.' }, { status: 401 })
  }

  const token = process.env.APIFY_TOKEN
  if (!token) {
    return NextResponse.json({ error: 'Foto-Enrichment ist nicht konfiguriert.' }, { status: 503 })
  }

  try {
    const admin = createSupabaseAdminClient()
    const result = await enrichUserPhotos(admin, userData.user.id, token)
    return NextResponse.json(result)
  } catch {
    return NextResponse.json({ error: 'Foto-Enrichment fehlgeschlagen.' }, { status: 502 })
  }
}
