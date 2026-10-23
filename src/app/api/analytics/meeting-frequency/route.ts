import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { getValidGoogleAccessToken } from '@/lib/connectors/google-token'
import { MeetingFrequencyEntry, MeetingFrequencyResponse } from '@/lib/analytics'

const querySchema = z.object({
  period: z.coerce.number().refine((value) => [30, 90, 365].includes(value), 'Ungültiger Zeitraum.'),
})

const TOP_N = 10

interface GoogleEvent {
  attendees?: { email?: string }[]
}

interface ContactCandidate {
  id: string
  first_name: string
  last_name: string | null
  photo_url: string | null
  email: string | null
}

export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Nicht eingeloggt.' }, { status: 401 })
  }

  const parsed = querySchema.safeParse({ period: request.nextUrl.searchParams.get('period') })
  if (!parsed.success) {
    return NextResponse.json({ error: 'Ungültige Anfrage.' }, { status: 400 })
  }
  const { period } = parsed.data

  const accessToken = await getValidGoogleAccessToken(supabase, user.id)
  if (!accessToken) {
    const response: MeetingFrequencyResponse = { googleConnected: false, entries: [] }
    return NextResponse.json(response)
  }

  const timeMax = new Date()
  const timeMin = new Date()
  timeMin.setDate(timeMin.getDate() - period)

  const eventsUrl = new URL('https://www.googleapis.com/calendar/v3/calendars/primary/events')
  eventsUrl.searchParams.set('timeMin', timeMin.toISOString())
  eventsUrl.searchParams.set('timeMax', timeMax.toISOString())
  eventsUrl.searchParams.set('singleEvents', 'true')

  let events: GoogleEvent[]
  try {
    const eventsRes = await fetch(eventsUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!eventsRes.ok) {
      const response: MeetingFrequencyResponse = { googleConnected: true, entries: [], error: true }
      return NextResponse.json(response)
    }
    const data = await eventsRes.json()
    events = (data.items ?? []) as GoogleEvent[]
  } catch {
    const response: MeetingFrequencyResponse = { googleConnected: true, entries: [], error: true }
    return NextResponse.json(response)
  }

  const attendeeEmails = new Set<string>()
  for (const event of events) {
    for (const attendee of event.attendees ?? []) {
      if (attendee.email) attendeeEmails.add(attendee.email.toLowerCase())
    }
  }

  const contactsByEmail = new Map<string, ContactCandidate>()
  if (attendeeEmails.size > 0) {
    const { data: contacts } = await supabase
      .from('contacts')
      .select('id, first_name, last_name, photo_url, email')
      .not('email', 'is', null)

    for (const contact of (contacts ?? []) as ContactCandidate[]) {
      if (contact.email) contactsByEmail.set(contact.email.toLowerCase(), contact)
    }
  }

  const countsByContactId = new Map<string, { contact: ContactCandidate; count: number }>()
  for (const event of events) {
    for (const attendee of event.attendees ?? []) {
      if (!attendee.email) continue
      const contact = contactsByEmail.get(attendee.email.toLowerCase())
      if (!contact) continue
      const existing = countsByContactId.get(contact.id)
      countsByContactId.set(contact.id, { contact, count: (existing?.count ?? 0) + 1 })
    }
  }

  const entries: MeetingFrequencyEntry[] = Array.from(countsByContactId.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, TOP_N)
    .map(({ contact, count }) => ({
      contactId: contact.id,
      first_name: contact.first_name,
      last_name: contact.last_name,
      photo_url: contact.photo_url,
      count,
    }))

  const response: MeetingFrequencyResponse = { googleConnected: true, entries }
  return NextResponse.json(response)
}
