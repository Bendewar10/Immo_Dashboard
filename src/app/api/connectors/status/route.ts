import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'

export async function GET() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Nicht eingeloggt.' }, { status: 401 })
  }

  const { data } = await supabase
    .from('connector_tokens')
    .select('provider, account_email, status, connected_at')
    .eq('user_id', user.id)

  const statuses = (data ?? []).map((row) => ({
    provider: row.provider,
    status: row.status,
    accountEmail: row.account_email,
    connectedAt: row.connected_at,
  }))

  return NextResponse.json(statuses)
}
