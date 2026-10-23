'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Contact } from '@/lib/contacts'
import { computeOccasionSections } from '@/lib/occasions'
import { ContactEvent, groupOpenEvents } from '@/lib/contact-events'
import { TodayMeetingsResponse } from '@/lib/meetings'
import { BirthdaySuggestion, BirthdaySuggestionsResponse, toBirthdayFieldValue } from '@/lib/birthday-suggestions'
import { findCityTripMatches } from '@/lib/city-trip-match'
import { OccasionCard } from '@/components/occasion-card'
import { ImportEventCard } from '@/components/import-event-card'
import { MeetingPrepCard } from '@/components/meeting-prep-card'
import { BirthdaySuggestionCard } from '@/components/birthday-suggestion-card'
import { InteractionFormDialog } from '@/components/interaction-form-dialog'
import { ContactFormDialog } from '@/components/contact-form-dialog'
import { PageHeader } from '@/components/page-header'

export default function DashboardPage() {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [events, setEvents] = useState<ContactEvent[]>([])
  const [meetingsData, setMeetingsData] = useState<TodayMeetingsResponse | null>(null)
  const [activeProjects, setActiveProjects] = useState<{ id: string; title: string; city: string | null; status: string }[]>([])
  const [birthdaySuggestions, setBirthdaySuggestions] = useState<BirthdaySuggestion[]>([])
  const [savingSuggestionContactId, setSavingSuggestionContactId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loggingContactId, setLoggingContactId] = useState<string | null>(null)
  const [dismissingEventIds, setDismissingEventIds] = useState<string[] | null>(null)
  const [openCardContact, setOpenCardContact] = useState<Contact | null>(null)

  function loadContacts() {
    return supabase
      .from('contacts')
      .select('*')
      .then(({ data }) => {
        setContacts(data ?? [])
        setIsLoading(false)
      })
  }

  function loadEvents() {
    return supabase
      .from('contact_events')
      .select('*')
      .then(({ data, error }) => {
        setEvents(error ? [] : data ?? [])
      })
  }

  const MEETINGS_WINDOW_DAYS = 3

  function loadMeetings() {
    const windowStart = new Date()
    windowStart.setHours(0, 0, 0, 0)
    const windowEnd = new Date()
    windowEnd.setDate(windowEnd.getDate() + (MEETINGS_WINDOW_DAYS - 1))
    windowEnd.setHours(23, 59, 59, 999)
    const params = new URLSearchParams({ from: windowStart.toISOString(), to: windowEnd.toISOString() })
    return fetch(`/api/meetings/today?${params.toString()}`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data: TodayMeetingsResponse) => setMeetingsData(data))
      .catch(() => setMeetingsData({ googleConnected: false, meetings: [] }))
  }

  function loadBirthdaySuggestions() {
    return fetch('/api/meetings/birthdays')
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data: BirthdaySuggestionsResponse) => setBirthdaySuggestions(data.suggestions))
      .catch(() => setBirthdaySuggestions([]))
  }

  function loadActiveProjects() {
    return supabase
      .from('projects')
      .select('id, title, city, status')
      .eq('status', 'active')
      .then(({ data }) => setActiveProjects(data ?? []))
  }

  useEffect(() => {
    void loadContacts()
    void loadEvents()
    void loadMeetings()
    void loadBirthdaySuggestions()
    void loadActiveProjects()
  }, [])

  async function handleAcceptBirthdaySuggestion(suggestion: BirthdaySuggestion) {
    setSavingSuggestionContactId(suggestion.contactId)
    const { error } = await supabase
      .from('contacts')
      .update({ birthday: toBirthdayFieldValue(suggestion.month, suggestion.day) })
      .eq('id', suggestion.contactId)
    setSavingSuggestionContactId(null)
    if (!error) {
      setBirthdaySuggestions((prev) => prev.filter((s) => s.contactId !== suggestion.contactId))
      loadContacts()
    }
  }

  const { todaySection, upcomingSection } = useMemo(() => computeOccasionSections(contacts), [contacts])
  const eventGroups = useMemo(() => groupOpenEvents(events, contacts), [events, contacts])
  const cityTripMatches = useMemo(
    () => findCityTripMatches(meetingsData?.meetings ?? [], activeProjects, contacts),
    [meetingsData, activeProjects, contacts]
  )

  const hasAnyOccasion = todaySection.length > 0 || upcomingSection.length > 0

  function openInteractionForOccasion(contact: Contact) {
    setDismissingEventIds(null)
    setLoggingContactId(contact.id)
  }

  function openInteractionForEventGroup(group: { contact: Contact; events: ContactEvent[] }) {
    setDismissingEventIds(group.events.map((e) => e.id))
    setLoggingContactId(group.contact.id)
  }

  function openInteractionForMeetingContact(contactId: string) {
    setDismissingEventIds(null)
    setLoggingContactId(contactId)
  }

  async function handleInteractionSaved() {
    setLoggingContactId(null)
    if (dismissingEventIds) {
      await supabase
        .from('contact_events')
        .update({ dismissed_at: new Date().toISOString() })
        .in('id', dismissingEventIds)
      setDismissingEventIds(null)
    }
    loadContacts()
    loadEvents()
  }

  const totalDue = todaySection.length
  const totalUpcoming = upcomingSection.length
  const totalEvents = eventGroups.length

  return (
    <div className="w-full max-w-5xl space-y-8">
      <PageHeader title="Dashboard" description="Fällige Follow-ups und aktuelle Anlässe" />

      {meetingsData && !meetingsData.googleConnected && (
        <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
          Google Kalender verbinden, um Termine hier zu sehen —{' '}
          <Link href="/einstellungen/konnektoren" className="underline hover:text-foreground">
            zu den Konnektoren
          </Link>
        </div>
      )}

      {meetingsData?.googleConnected && meetingsData.error && (
        <div className="rounded-xl border border-dashed p-4 text-sm text-destructive">
          Termine konnten nicht geladen werden. Bitte später erneut versuchen.
        </div>
      )}

      {meetingsData?.googleConnected && !meetingsData.error && meetingsData.meetings.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold">Termine</h2>
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
              {meetingsData.meetings.length}
            </span>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {meetingsData.meetings.map((meeting) => (
              <MeetingPrepCard
                key={meeting.id}
                meeting={meeting}
                onLogInteraction={openInteractionForMeetingContact}
              />
            ))}
          </div>
        </section>
      )}

      {cityTripMatches.map((match) => (
        <div key={match.projectId} className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
          Termin in {match.city} — {match.contactCount} {match.contactCount === 1 ? 'Kontakt' : 'Kontakte'} vor Ort im
          Projekt{' '}
          <Link href={`/profil/${match.projectId}`} className="underline hover:text-foreground">
            {match.projectTitle}
          </Link>
        </div>
      ))}

      {birthdaySuggestions.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold">Geburtstage aus dem Kalender</h2>
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
              {birthdaySuggestions.length}
            </span>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {birthdaySuggestions.map((suggestion) => (
              <BirthdaySuggestionCard
                key={suggestion.contactId}
                suggestion={suggestion}
                onAccept={handleAcceptBirthdaySuggestion}
                isSaving={savingSuggestionContactId === suggestion.contactId}
              />
            ))}
          </div>
        </section>
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Lädt...</p>
      ) : !hasAnyOccasion && totalEvents === 0 ? (
        <div className="rounded-xl border border-dashed p-8 text-center">
          <p className="text-base font-medium">Alles im Blick</p>
          <p className="mt-1 text-sm text-muted-foreground">Aktuell keine fälligen Follow-ups oder Anlässe.</p>
        </div>
      ) : (
        <>
          {todaySection.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold">Heute & überfällig</h2>
                <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
                  {totalDue}
                </span>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {todaySection.map((occasion) => (
                  <OccasionCard
                    key={occasion.contact.id}
                    occasion={occasion}
                    onLogInteraction={() => openInteractionForOccasion(occasion.contact)}
                    onOpenCard={() => setOpenCardContact(occasion.contact)}
                  />
                ))}
              </div>
            </section>
          )}

          {upcomingSection.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold">Nächste 14 Tage</h2>
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                  {totalUpcoming}
                </span>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {upcomingSection.map((occasion) => (
                  <OccasionCard
                    key={occasion.contact.id}
                    occasion={occasion}
                    onLogInteraction={() => openInteractionForOccasion(occasion.contact)}
                    onOpenCard={() => setOpenCardContact(occasion.contact)}
                  />
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {eventGroups.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold">Kürzlich erkannt</h2>
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
              {totalEvents}
            </span>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {eventGroups.map((group) => (
              <ImportEventCard
                key={group.contact.id}
                group={group}
                onLogInteraction={() => openInteractionForEventGroup(group)}
              />
            ))}
          </div>
        </section>
      )}

      {loggingContactId && (
        <InteractionFormDialog
          open={!!loggingContactId}
          onOpenChange={(open) => !open && setLoggingContactId(null)}
          contactId={loggingContactId}
          interaction={null}
          onSaved={handleInteractionSaved}
        />
      )}

      <ContactFormDialog
        open={!!openCardContact}
        onOpenChange={(open) => !open && setOpenCardContact(null)}
        contact={openCardContact}
        onSaved={() => {
          setOpenCardContact(null)
          loadContacts()
        }}
      />
    </div>
  )
}
