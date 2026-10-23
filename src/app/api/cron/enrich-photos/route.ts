import { NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase-admin'
import { enrichUserPhotos } from '@/lib/photo-enrichment'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

// PROJ-20: Monatlicher Cron — reichert bei allen Nutzern fotolose Kontakte
// (mit LinkedIn-URL) mit Profilbildern an. Cron läuft täglich, führt aber nur
// am 1. des Monats aus (?force=1 zum manuellen Test, weiterhin Secret-geschützt).
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET
  const authHeader = request.headers.get('authorization')
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  const token = process.env.APIFY_TOKEN
  if (!token) {
    return NextResponse.json({ error: 'APIFY_TOKEN not configured.' }, { status: 503 })
  }

  const now = new Date()
  const force = new URL(request.url).searchParams.get('force') === '1'
  if (!force && now.getUTCDate() !== 1) {
    return NextResponse.json({ skipped: 'not first day of month' })
  }

  const admin = createSupabaseAdminClient()
  const { data: usersData, error: usersError } = await admin.auth.admin.listUsers()
  if (usersError) {
    return NextResponse.json({ error: 'Could not list users.' }, { status: 500 })
  }

  const results: { user: string; status: string; photosSet?: number }[] = []
  for (const user of usersData.users) {
    try {
      const r = await enrichUserPhotos(admin, user.id, token, now)
      results.push({ user: user.id, status: 'ok', photosSet: r.photosSet })
    } catch (err) {
      // Ein Fehler bei einem Nutzer darf die anderen nicht stoppen.
      console.error(`enrich-photos cron failed for ${user.id}:`, err)
      results.push({ user: user.id, status: 'error' })
    }
  }

  return NextResponse.json({ ran: true, results })
}
