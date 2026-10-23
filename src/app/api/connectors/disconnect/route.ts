import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { decrypt } from '@/lib/connectors/encryption'

const schema = z.object({
  provider: z.enum(['google', 'microsoft-365', 'linkedin', 'whatsapp', 'apple-calendar']),
})

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Nicht eingeloggt.' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Ungültige Anfrage.' }, { status: 400 })
  }

  const { provider } = parsed.data

  const { data: tokenRow } = await supabase
    .from('connector_tokens')
    .select('access_token')
    .eq('user_id', user.id)
    .eq('provider', provider)
    .single()

  await supabase
    .from('connector_tokens')
    .delete()
    .eq('user_id', user.id)
    .eq('provider', provider)

  if (tokenRow && provider === 'google') {
    try {
      const decrypted = decrypt(tokenRow.access_token)
      await fetch(
        `https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(decrypted)}`,
        { method: 'POST' }
      )
    } catch {
      return NextResponse.json(
        { warning: 'Lokal getrennt — Google-Widerruf fehlgeschlagen. Bitte manuell in Google-Kontoeinstellungen widerrufen.' },
        { status: 200 }
      )
    }
  }

  return NextResponse.json({ success: true })
}
