import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { CONVERSATIONS_LIMIT } from '@/lib/chat'

export async function GET() {
  const supabase = await createSupabaseServerClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) {
    return NextResponse.json({ error: 'Nicht eingeloggt.' }, { status: 401 })
  }

  const { data: conversations } = await supabase
    .from('conversations')
    .select('id, title, updated_at')
    .eq('user_id', userData.user.id)
    .order('updated_at', { ascending: false })
    .limit(CONVERSATIONS_LIMIT)

  return NextResponse.json({ conversations: conversations ?? [] })
}
