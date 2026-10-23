import { createSupabaseServerClient } from '@/lib/supabase-server'
import { decrypt, encrypt } from '@/lib/connectors/encryption'

const REFRESH_BUFFER_MS = 60_000

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>

export async function getValidGoogleAccessToken(
  supabase: SupabaseServerClient,
  userId: string
): Promise<string | null> {
  const { data: tokenRow } = await supabase
    .from('connector_tokens')
    .select('access_token, refresh_token, expires_at, status')
    .eq('user_id', userId)
    .eq('provider', 'google')
    .maybeSingle()

  if (!tokenRow || tokenRow.status !== 'active') {
    return null
  }

  const expiresAt = new Date(tokenRow.expires_at).getTime()
  if (expiresAt - Date.now() > REFRESH_BUFFER_MS) {
    return decrypt(tokenRow.access_token)
  }

  if (!tokenRow.refresh_token) {
    await supabase.from('connector_tokens').update({ status: 'expired' }).eq('user_id', userId).eq('provider', 'google')
    return null
  }

  try {
    const refreshRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        refresh_token: decrypt(tokenRow.refresh_token),
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        grant_type: 'refresh_token',
      }),
    })

    if (!refreshRes.ok) {
      await supabase.from('connector_tokens').update({ status: 'expired' }).eq('user_id', userId).eq('provider', 'google')
      return null
    }

    const refreshed = await refreshRes.json()
    const newExpiresAt = new Date(Date.now() + refreshed.expires_in * 1000).toISOString()

    await supabase
      .from('connector_tokens')
      .update({
        access_token: encrypt(refreshed.access_token),
        expires_at: newExpiresAt,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('provider', 'google')

    return refreshed.access_token as string
  } catch {
    await supabase.from('connector_tokens').update({ status: 'expired' }).eq('user_id', userId).eq('provider', 'google')
    return null
  }
}
