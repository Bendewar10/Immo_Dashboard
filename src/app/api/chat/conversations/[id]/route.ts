import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createSupabaseServerClient } from '@/lib/supabase-server'

const paramsSchema = z.object({ id: z.string().uuid() })

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createSupabaseServerClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) {
    return NextResponse.json({ error: 'Nicht eingeloggt.' }, { status: 401 })
  }

  const parsed = paramsSchema.safeParse(await params)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Ungültige Konversations-ID.' }, { status: 400 })
  }

  const { error, count } = await supabase
    .from('conversations')
    .delete({ count: 'exact' })
    .eq('id', parsed.data.id)
    .eq('user_id', userData.user.id)

  if (error) {
    return NextResponse.json({ error: 'Konversation konnte nicht gelöscht werden.' }, { status: 500 })
  }
  if (!count) {
    return NextResponse.json({ error: 'Konversation nicht gefunden.' }, { status: 404 })
  }

  return NextResponse.json({ success: true })
}
