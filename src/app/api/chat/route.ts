import { anthropic } from '@ai-sdk/anthropic'
import { generateText, stepCountIs } from 'ai'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { buildChatTools, buildChatSystemPrompt } from '@/lib/chat-server'
import { CONVERSATION_TITLE_MAX_LENGTH } from '@/lib/chat'

const requestSchema = z.object({
  content: z.string().trim().min(1).max(4000),
  conversationId: z.string().uuid().optional(),
})

const HISTORY_CONTEXT_LIMIT = 20

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) {
    return NextResponse.json({ error: 'Nicht eingeloggt.' }, { status: 401 })
  }
  const userId = userData.user.id

  const parsed = requestSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Ungültige Anfrage.' }, { status: 400 })
  }
  const { content, conversationId: requestedConversationId } = parsed.data

  let conversationId: string
  if (requestedConversationId) {
    const { data: conversation } = await supabase
      .from('conversations')
      .select('id')
      .eq('id', requestedConversationId)
      .eq('user_id', userId)
      .single()
    if (!conversation) {
      return NextResponse.json({ error: 'Konversation nicht gefunden.' }, { status: 404 })
    }
    conversationId = requestedConversationId
  } else {
    const { data: conversation, error: conversationError } = await supabase
      .from('conversations')
      .insert({ user_id: userId, title: content.slice(0, CONVERSATION_TITLE_MAX_LENGTH) })
      .select()
      .single()
    if (conversationError || !conversation) {
      return NextResponse.json({ error: 'Konversation konnte nicht angelegt werden.' }, { status: 500 })
    }
    conversationId = conversation.id
  }

  const { data: history } = await supabase
    .from('chat_messages')
    .select('role, content')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(HISTORY_CONTEXT_LIMIT)

  const { data: userMessage, error: insertError } = await supabase
    .from('chat_messages')
    .insert({ user_id: userId, conversation_id: conversationId, role: 'user', content })
    .select()
    .single()
  if (insertError || !userMessage) {
    return NextResponse.json({ error: 'Nachricht konnte nicht gespeichert werden.' }, { status: 500 })
  }

  const { data: userProfile } = await supabase
    .from('user_profile')
    .select('bio, goals_text')
    .eq('user_id', userId)
    .maybeSingle()

  const systemPrompt = buildChatSystemPrompt({
    bio: userProfile?.bio,
    goals: userProfile?.goals_text,
  })

  const tools = buildChatTools(supabase, userId, conversationId, userMessage.id)

  try {
    const { text } = await generateText({
      model: anthropic('claude-sonnet-4-6'),
      system: systemPrompt,
      messages: [...(history ?? []).reverse(), { role: 'user' as const, content }],
      tools,
      stopWhen: stepCountIs(5),
      providerOptions: { anthropic: { cacheControl: { type: 'ephemeral' } } },
    })

    const { data: assistantMessage, error: assistantError } = await supabase
      .from('chat_messages')
      .insert({ user_id: userId, conversation_id: conversationId, role: 'assistant', content: text.trim() })
      .select()
      .single()
    if (assistantError || !assistantMessage) {
      return NextResponse.json({ error: 'Antwort konnte nicht gespeichert werden.' }, { status: 500 })
    }

    await supabase.from('conversations').update({ updated_at: new Date().toISOString() }).eq('id', conversationId)

    const { data: pendingActions } = await supabase
      .from('pending_actions')
      .select('id, chat_message_id, action_type, summary, status, created_at')
      .eq('conversation_id', conversationId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(1)

    return NextResponse.json({
      conversationId,
      message: assistantMessage,
      pendingAction: pendingActions?.[0] ?? null,
    })
  } catch (err) {
    console.error('DEBUG chat AI error:', err)
    return NextResponse.json({ error: 'Antwort konnte nicht generiert werden.' }, { status: 502 })
  }
}
