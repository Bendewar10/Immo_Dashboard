import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { getValidGoogleAccessToken } from '@/lib/connectors/google-token'
import {
  BirthdaySuggestion,
  BirthdaySuggestionsResponse,
  extractCandidateName,
  isBirthdayEventTitle,
  normalizeName,
} from '@/lib/birthday-suggestions'

const LOOKAHEAD_DAYS = 365

interface GoogleEvent {
  summary?: string
  start?: { date?: string; dateTime?: string }
}

interface ContactCandidate {
  id: string
  first_name: string
  last_name: string | null
}

export async function GET() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Nicht eingeloggt.' }, { status: 401 })
  }

  const accessToken = await getValidGoogleAccessToken(supabase, user.id)
  if (!accessToken) {
    const response: BirthdaySuggestionsResponse = { googleConnected: false, suggestions: [] }
    return NextResponse.json(response)
  }

  const from = new Date()
  from.setHours(0, 0, 0, 0)
  const to = new Date(from)
  to.setDate(to.getDate() + LOOKAHEAD_DAYS)

  const eventsUrl = new URL('https://www.googleapis.com/calendar/v3/calendars/primary/events')
  eventsUrl.searchParams.set('timeMin', from.toISOString())
  eventsUrl.searchParams.set('timeMax', to.toISOString())
  eventsUrl.searchParams.set('singleEvents', 'true')
  eventsUrl.searchParams.set('orderBy', 'startTime')

  let events: GoogleEvent[]
  try {
    const eventsRes = await fetch(eventsUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!eventsRes.ok) {
      const response: BirthdaySuggestionsResponse = { googleConnected: true, suggestions: [], error: true }
      return NextResponse.json(response)
    }
    const data = await eventsRes.json()
    events = (data.items ?? []) as GoogleEvent[]
  } catch {
    const response: BirthdaySuggestionsResponse = { googleConnected: true, suggestions: [], error: true }
    return NextResponse.json(response)
  }

  const birthdayEvents = events
    .filter((event) => event.start?.date && event.summary && isBirthdayEventTitle(event.summary))
    .map((event) => ({
      candidateName: extractCandidateName(event.summary!),
      date: event.start!.date!,
    }))
    .filter((event): event is { candidateName: string; date: string } => Boolean(event.candidateName))

  if (birthdayEvents.length === 0) {
    const response: BirthdaySuggestionsResponse = { googleConnected: true, suggestions: [] }
    return NextResponse.json(response)
  }

  const { data: contacts } = await supabase
    .from('contacts')
    .select('id, first_name, last_name')
    .is('birthday', null)

  const byFullName = new Map<string, ContactCandidate>()
  const byFirstName = new Map<string, ContactCandidate[]>()
  for (const contact of (contacts ?? []) as ContactCandidate[]) {
    const fullName = normalizeName([contact.first_name, contact.last_name].filter(Boolean).join(' '))
    byFullName.set(fullName, contact)
    const firstName = normalizeName(contact.first_name)
    byFirstName.set(firstName, [...(byFirstName.get(firstName) ?? []), contact])
  }

  const suggestionsByContactId = new Map<string, BirthdaySuggestion>()
  for (const event of birthdayEvents) {
    const normalizedCandidate = normalizeName(event.candidateName)
    let matched: ContactCandidate | undefined = byFullName.get(normalizedCandidate)
    if (!matched) {
      const firstNameMatches = byFirstName.get(normalizedCandidate)
      if (firstNameMatches?.length === 1) matched = firstNameMatches[0]
    }
    if (!matched || suggestionsByContactId.has(matched.id)) continue

    const [, month, day] = event.date.split('-').map(Number)
    suggestionsByContactId.set(matched.id, {
      contactId: matched.id,
      first_name: matched.first_name,
      last_name: matched.last_name,
      month,
      day,
    })
  }

  const response: BirthdaySuggestionsResponse = {
    googleConnected: true,
    suggestions: Array.from(suggestionsByContactId.values()),
  }
  return NextResponse.json(response)
}
