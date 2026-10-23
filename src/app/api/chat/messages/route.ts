import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { CHAT_HISTORY_LIMIT } from '@/lib/chat'

export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) {
    return NextResponse.json({ error: 'Nicht eingeloggt.' }, { status: 401 })
  }
  const userId = userData.user.id

  let conversationId = new URL(request.url).searchParams.get('conversationId')

  if (!conversationId) {
    const { data: latest } = await supabase
      .from('conversations')
      .select('id')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .single()
    conversationId = latest?.id ?? null
  }

  if (!conversationId) {
    return NextResponse.json({ conversationId: null, messages: [], pendingAction: null })
  }

  const { data: conversation } = await supabase
    .from('conversations')
    .select('id')
    .eq('id', conversationId)
    .eq('user_id', userId)
    .single()
  if (!conversation) {
    return NextResponse.json({ error: 'Konversation nicht gefunden.' }, { status: 404 })
  }

  const [{ data: messages }, { data: pendingActions }] = await Promise.all([
    supabase
      .from('chat_messages')
      .select('id, role, content, created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(CHAT_HISTORY_LIMIT),
    supabase
      .from('pending_actions')
      .select('id, chat_message_id, action_type, summary, status, created_at')
      .eq('conversation_id', conversationId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(1),
  ])

  return NextResponse.json({
    conversationId,
    messages: (messages ?? []).reverse(),
    pendingAction: pendingActions?.[0] ?? null,
  })
}
