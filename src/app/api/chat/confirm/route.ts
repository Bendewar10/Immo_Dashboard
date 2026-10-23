import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { EMPLOYER_NORMALIZATION_RESET } from '@/lib/contacts'

const requestSchema = z.object({
  pendingActionId: z.string().uuid(),
  decision: z.enum(['confirm', 'decline']),
})

async function reply(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  userId: string,
  conversationId: string,
  content: string
) {
  const { data, error } = await supabase
    .from('chat_messages')
    .insert({ user_id: userId, conversation_id: conversationId, role: 'assistant', content })
    .select()
    .single()
  if (error || !data) throw new Error('Antwort konnte nicht gespeichert werden.')
  return data
}

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
  const { pendingActionId, decision } = parsed.data

  const { data: pendingAction } = await supabase
    .from('pending_actions')
    .select('*')
    .eq('id', pendingActionId)
    .eq('user_id', userId)
    .eq('status', 'pending')
    .single()

  if (!pendingAction) {
    return NextResponse.json(
      { error: 'Diese Aktion ist nicht mehr ausführbar (bereits bestätigt, abgelehnt oder abgelaufen).' },
      { status: 409 }
    )
  }

  try {
    if (decision === 'decline') {
      await supabase.from('pending_actions').update({ status: 'declined' }).eq('id', pendingActionId)
      const message = await reply(supabase, userId, pendingAction.conversation_id, 'Okay, abgebrochen — es wurde nichts geändert.')
      return NextResponse.json({ message })
    }

    const payload = pendingAction.payload as Record<string, unknown>

    if (pendingAction.action_type === 'delete_contact') {
      const { error, count } = await supabase
        .from('contacts')
        .delete({ count: 'exact' })
        .eq('id', payload.contactId as string)
        .eq('user_id', userId)
      if (error) throw new Error(error.message)
      if (!count) {
        await supabase.from('pending_actions').update({ status: 'expired' }).eq('id', pendingActionId)
        const message = await reply(supabase, userId, pendingAction.conversation_id, 'Dieser Kontakt existiert nicht mehr — nichts zu löschen.')
        return NextResponse.json({ message })
      }
      await supabase.from('pending_actions').update({ status: 'confirmed' }).eq('id', pendingActionId)
      const message = await reply(supabase, userId, pendingAction.conversation_id, 'Erledigt — der Kontakt wurde gelöscht.')
      return NextResponse.json({ message })
    }

    if (pendingAction.action_type === 'delete_interaction') {
      const { error, count } = await supabase
        .from('interactions')
        .delete({ count: 'exact' })
        .eq('id', payload.interactionId as string)
        .eq('user_id', userId)
      if (error) throw new Error(error.message)
      if (!count) {
        await supabase.from('pending_actions').update({ status: 'expired' }).eq('id', pendingActionId)
        const message = await reply(supabase, userId, pendingAction.conversation_id, 'Dieser Kontaktmoment existiert nicht mehr — nichts zu löschen.')
        return NextResponse.json({ message })
      }
      await supabase.from('pending_actions').update({ status: 'confirmed' }).eq('id', pendingActionId)
      const message = await reply(supabase, userId, pendingAction.conversation_id, 'Erledigt — der Kontaktmoment wurde gelöscht.')
      return NextResponse.json({ message })
    }

    if (pendingAction.action_type === 'overwrite_contact_field') {
      const field = payload.field as string
      const updatePayload =
        field === 'employer'
          ? { [field]: payload.newValue, ...EMPLOYER_NORMALIZATION_RESET }
          : { [field]: payload.newValue }
      const { error, count } = await supabase
        .from('contacts')
        .update(updatePayload, { count: 'exact' })
        .eq('id', payload.contactId as string)
        .eq('user_id', userId)
      if (error) throw new Error(error.message)
      if (!count) {
        await supabase.from('pending_actions').update({ status: 'expired' }).eq('id', pendingActionId)
        const message = await reply(supabase, userId, pendingAction.conversation_id, 'Dieser Kontakt existiert nicht mehr — Feld wurde nicht geändert.')
        return NextResponse.json({ message })
      }
      await supabase.from('pending_actions').update({ status: 'confirmed' }).eq('id', pendingActionId)
      const message = await reply(supabase, userId, pendingAction.conversation_id, 'Erledigt — das Feld wurde geändert.')
      return NextResponse.json({ message })
    }

    if (pendingAction.action_type === 'bulk_delete_contacts') {
      const contactIds = payload.contactIds as string[]
      const { error, count } = await supabase
        .from('contacts')
        .delete({ count: 'exact' })
        .in('id', contactIds)
        .eq('user_id', userId)
      if (error) throw new Error(error.message)
      await supabase.from('pending_actions').update({ status: 'confirmed' }).eq('id', pendingActionId)
      const message = await reply(supabase, userId, pendingAction.conversation_id, `Erledigt — ${count ?? 0} Kontakte wurden gelöscht.`)
      return NextResponse.json({ message })
    }

    return NextResponse.json({ error: 'Unbekannter Aktionstyp.' }, { status: 500 })
  } catch (err) {
    console.error('DEBUG chat confirm error:', err)
    return NextResponse.json({ error: 'Aktion konnte nicht ausgeführt werden.' }, { status: 500 })
  }
}
