import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { getValidGoogleAccessToken } from '@/lib/connectors/google-token'
import { MeetingGroup, TodayMeetingsResponse } from '@/lib/meetings'

const querySchema = z.object({
  from: z.string().datetime(),
  to: z.string().datetime(),
})

interface GoogleEvent {
  id: string
  summary?: string
  start?: { dateTime?: string; date?: string }
  end?: { dateTime?: string; date?: string }
  location?: string
  attendees?: { email?: string }[]
}

export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Nicht eingeloggt.' }, { status: 401 })
  }

  const parsed = querySchema.safeParse({
    from: request.nextUrl.searchParams.get('from'),
    to: request.nextUrl.searchParams.get('to'),
  })
  if (!parsed.success) {
    return NextResponse.json({ error: 'Ungültige Anfrage.' }, { status: 400 })
  }
  const { from, to } = parsed.data

  const accessToken = await getValidGoogleAccessToken(supabase, user.id)
  if (!accessToken) {
    const response: TodayMeetingsResponse = { googleConnected: false, meetings: [] }
    return NextResponse.json(response)
  }

  const eventsUrl = new URL('https://www.googleapis.com/calendar/v3/calendars/primary/events')
  eventsUrl.searchParams.set('timeMin', from)
  eventsUrl.searchParams.set('timeMax', to)
  eventsUrl.searchParams.set('singleEvents', 'true')
  eventsUrl.searchParams.set('orderBy', 'startTime')

  let events: GoogleEvent[]
  try {
    const eventsRes = await fetch(eventsUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!eventsRes.ok) {
      const response: TodayMeetingsResponse = { googleConnected: true, meetings: [], error: true }
      return NextResponse.json(response)
    }
    const data = await eventsRes.json()
    events = (data.items ?? []) as GoogleEvent[]
  } catch {
    const response: TodayMeetingsResponse = { googleConnected: true, meetings: [], error: true }
    return NextResponse.json(response)
  }

  const attendeeEmails = new Set<string>()
  for (const event of events) {
    for (const attendee of event.attendees ?? []) {
      if (attendee.email) attendeeEmails.add(attendee.email.toLowerCase())
    }
  }

  const contactsByEmail = new Map<
    string,
    { id: string; first_name: string; last_name: string | null; photo_url: string | null; last_contacted_at: string | null }
  >()
  if (attendeeEmails.size > 0) {
    const { data: contacts } = await supabase
      .from('contacts')
      .select('id, first_name, last_name, photo_url, last_contacted_at, email')
      .not('email', 'is', null)

    for (const contact of contacts ?? []) {
      if (contact.email) contactsByEmail.set(contact.email.toLowerCase(), contact)
    }
  }

  const meetingsWithSortKey: { meeting: MeetingGroup; sortKey: string }[] = []
  for (const event of events) {
    const matchedContacts = (event.attendees ?? [])
      .map((attendee) => (attendee.email ? contactsByEmail.get(attendee.email.toLowerCase()) : undefined))
      .filter((contact): contact is NonNullable<typeof contact> => Boolean(contact))

    if (matchedContacts.length === 0) continue

    meetingsWithSortKey.push({
      meeting: {
        id: event.id,
        title: event.summary || 'Ohne Titel',
        date: (event.start?.dateTime ?? event.start?.date ?? '').slice(0, 10),
        startTime: event.start?.dateTime ?? null,
        endTime: event.end?.dateTime ?? null,
        isAllDay: !event.start?.dateTime,
        location: event.location ?? null,
        contacts: matchedContacts.map((c) => ({
          id: c.id,
          first_name: c.first_name,
          last_name: c.last_name,
          photo_url: c.photo_url,
          last_contacted_at: c.last_contacted_at,
        })),
      },
      sortKey: event.start?.dateTime ?? event.start?.date ?? '',
    })
  }

  meetingsWithSortKey.sort((a, b) => a.sortKey.localeCompare(b.sortKey))
  const meetings = meetingsWithSortKey.map((m) => m.meeting)

  const response: TodayMeetingsResponse = { googleConnected: true, meetings }
  return NextResponse.json(response)
}
