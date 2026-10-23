import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { encrypt } from '@/lib/connectors/encryption'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
const CONNECTORS_PAGE = `${APP_URL}/einstellungen/konnektoren`

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  if (error || !code) {
    return NextResponse.redirect(`${CONNECTORS_PAGE}?error=cancelled`)
  }

  const cookieStore = await cookies()
  const savedState = cookieStore.get('oauth_state')?.value
  cookieStore.delete('oauth_state')

  if (!savedState || savedState !== state) {
    return NextResponse.redirect(`${CONNECTORS_PAGE}?error=csrf`)
  }

  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(`${APP_URL}/login`)
  }

  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: `${APP_URL}/api/connectors/google/callback`,
        grant_type: 'authorization_code',
      }),
    })

    if (!tokenRes.ok) {
      return NextResponse.redirect(`${CONNECTORS_PAGE}?error=token_exchange`)
    }

    const tokens = await tokenRes.json()

    const idPayload = JSON.parse(
      Buffer.from(tokens.id_token.split('.')[1], 'base64url').toString('utf8')
    )
    const accountEmail = idPayload.email as string
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString()
    const now = new Date().toISOString()

    await supabase.from('connector_tokens').upsert(
      {
        user_id: user.id,
        provider: 'google',
        account_email: accountEmail,
        access_token: encrypt(tokens.access_token),
        refresh_token: tokens.refresh_token ? encrypt(tokens.refresh_token) : null,
        expires_at: expiresAt,
        scopes: ['calendar.readonly', 'gmail.readonly'],
        status: 'active',
        connected_at: now,
        updated_at: now,
      },
      { onConflict: 'user_id,provider' }
    )

    return NextResponse.redirect(`${CONNECTORS_PAGE}?connected=google`)
  } catch {
    return NextResponse.redirect(`${CONNECTORS_PAGE}?error=token_exchange`)
  }
}
