'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Contact, STRENGTH_LABELS, getCompanyName, getFullName } from '@/lib/contacts'
import { Project, formatDateRange } from '@/lib/projects'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Check, Copy, MapPin, MessageCircle } from 'lucide-react'

// Auswahl-Deckel pro Batch (Kosten-/Laufzeit-Bremse, siehe Spec)
export const CITY_TRIP_BATCH_LIMIT = 20
// So viele KI-Aufrufe laufen gleichzeitig
const CONCURRENCY = 3

export function matchesCity(contactCity: string | null, projectCity: string): boolean {
  if (!contactCity) return false
  return contactCity.trim().toLowerCase() === projectCity.trim().toLowerCase()
}

// Nachhol-Bedarf zuerst: nie kontaktiert ganz oben, dann ältester letzter Kontakt
export function sortByNeglect(a: Contact, b: Contact): number {
  if (!a.last_contacted_at && !b.last_contacted_at) return 0
  if (!a.last_contacted_at) return -1
  if (!b.last_contacted_at) return 1
  return a.last_contacted_at.localeCompare(b.last_contacted_at)
}

// wa.me braucht Ländervorwahl ohne führende Nullen; deutsche 0-Prefix-Nummern -> +49
export function buildWhatsAppLink(phone: string, text: string): string | null {
  let digits = phone.replace(/[^\d+]/g, '')
  if (digits.startsWith('+')) digits = digits.slice(1)
  else if (digits.startsWith('00')) digits = digits.slice(2)
  else if (digits.startsWith('0')) digits = `49${digits.slice(1)}`
  if (digits.length < 8) return null
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`
}

interface DraftState {
  status: 'loading' | 'ok' | 'error'
  text: string
  logged: boolean
}

interface CityTripSectionProps {
  project: Project
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('de-DE')
}

export function CityTripSection({ project }: CityTripSectionProps) {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [limitHint, setLimitHint] = useState(false)
  const [phase, setPhase] = useState<'select' | 'review'>('select')
  const [drafts, setDrafts] = useState<Map<string, DraftState>>(new Map())
  const [isGenerating, setIsGenerating] = useState(false)
  const [batchError, setBatchError] = useState<string | null>(null)

  useEffect(() => {
    supabase
      .from('contacts')
      .select('*')
      .then(({ data }) => {
        setContacts((data as Contact[]) ?? [])
        setIsLoading(false)
      })
  }, [])

  const city = project.city?.trim() ?? ''

  const localContacts = useMemo(
    () => contacts.filter((c) => matchesCity(c.city, city)).sort(sortByNeglect),
    [contacts, city]
  )

  const timeframe = formatDateRange(project.start_date, project.end_date)

  function toggle(contactId: string) {
    setLimitHint(false)
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(contactId)) {
        next.delete(contactId)
      } else if (next.size >= CITY_TRIP_BATCH_LIMIT) {
        setLimitHint(true)
        return prev
      } else {
        next.add(contactId)
      }
      return next
    })
  }

  async function fetchDraft(contactId: string): Promise<void> {
    setDrafts((prev) =>
      new Map(prev).set(contactId, { status: 'loading', text: '', logged: false })
    )
    try {
      const res = await fetch('/api/draft-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contactId,
          occasionType: 'citytrip',
          city,
          timeframe: timeframe ?? undefined,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setDrafts((prev) =>
        new Map(prev).set(contactId, { status: 'ok', text: json.text as string, logged: false })
      )
    } catch {
      setDrafts((prev) =>
        new Map(prev).set(contactId, { status: 'error', text: '', logged: false })
      )
    }
  }

  async function generateDrafts() {
    if (selected.size === 0 || isGenerating) return
    setBatchError(null)
    setIsGenerating(true)
    setPhase('review')

    // Gestaffelt: einfacher Pool mit begrenzter Parallelität
    const ids = [...selected]
    let index = 0
    async function worker() {
      while (index < ids.length) {
        const id = ids[index++]
        await fetchDraft(id)
      }
    }
    try {
      await Promise.all(Array.from({ length: Math.min(CONCURRENCY, ids.length) }, worker))
    } catch {
      setBatchError('Entwürfe konnten nicht erstellt werden. Bitte erneut versuchen.')
    } finally {
      setIsGenerating(false)
    }
  }

  function updateDraftText(contactId: string, text: string) {
    setDrafts((prev) => {
      const current = prev.get(contactId)
      if (!current) return prev
      return new Map(prev).set(contactId, { ...current, text })
    })
  }

  async function logInteraction(contact: Contact) {
    const current = drafts.get(contact.id)
    if (!current || current.logged) return
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) return
    const { error } = await supabase.from('interactions').insert({
      contact_id: contact.id,
      user_id: userData.user.id,
      occurred_at: new Date().toISOString().slice(0, 10),
      channel: 'message',
      note: `City-Trip ${city}: Nachricht geschickt`,
    })
    if (!error) {
      setDrafts((prev) => new Map(prev).set(contact.id, { ...current, logged: true }))
    }
  }

  async function copyDraft(contactId: string) {
    const draft = drafts.get(contactId)
    if (!draft?.text) return
    try {
      await navigator.clipboard.writeText(draft.text)
    } catch {
      // Copy fehlgeschlagen (Browser-Restriktion) — Text bleibt im Feld markierbar
    }
  }

  if (isLoading) return null

  const contactById = new Map(contacts.map((c) => [c.id, c]))

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <MapPin className="size-4 text-primary" />
          <h2 className="text-sm font-semibold">
            City-Trip{city ? `: Kontakte in ${city}` : ''}
          </h2>
          {localContacts.length > 0 && (
            <Badge variant="secondary">{localContacts.length}</Badge>
          )}
        </div>
        {phase === 'select' && localContacts.length > 0 && (
          <Button
            size="sm"
            disabled={selected.size === 0 || isGenerating}
            onClick={generateDrafts}
          >
            Nachrichten entwerfen{selected.size > 0 ? ` (${selected.size})` : ''}
          </Button>
        )}
        {phase === 'review' && (
          <Button
            size="sm"
            variant="outline"
            disabled={isGenerating}
            onClick={() => {
              setPhase('select')
              setDrafts(new Map())
              setSelected(new Set())
            }}
          >
            Neue Auswahl
          </Button>
        )}
      </div>

      {!city ? (
        <p className="text-sm text-muted-foreground">
          Projekt-Stadt pflegen, um Kontakte vor Ort zu sehen.
        </p>
      ) : localContacts.length === 0 ? (
        <p className="text-sm text-muted-foreground">Keine Kontakte in {city}.</p>
      ) : phase === 'select' ? (
        <>
          {limitHint && (
            <Alert className="py-2">
              <AlertDescription className="text-xs">
                Maximal {CITY_TRIP_BATCH_LIMIT} Kontakte pro Batch — Auswahl begrenzt.
              </AlertDescription>
            </Alert>
          )}
          <div className="space-y-2">
            {localContacts.map((contact) => (
              <label
                key={contact.id}
                className="flex cursor-pointer items-center gap-3 rounded-md border p-2"
              >
                <Checkbox
                  checked={selected.has(contact.id)}
                  onCheckedChange={() => toggle(contact.id)}
                  aria-label={`${getFullName(contact)} auswählen`}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{getFullName(contact)}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {[getCompanyName(contact), contact.job_title].filter(Boolean).join(' · ')}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {contact.strength && (
                    <Badge variant="outline">{STRENGTH_LABELS[contact.strength]}</Badge>
                  )}
                  <span className="text-xs text-muted-foreground">
                    {contact.last_contacted_at
                      ? `Zuletzt: ${formatDate(contact.last_contacted_at)}`
                      : 'Nie kontaktiert'}
                  </span>
                </div>
              </label>
            ))}
          </div>
        </>
      ) : (
        <div className="space-y-3">
          {batchError && (
            <Alert variant="destructive" className="py-2">
              <AlertDescription className="text-xs">{batchError}</AlertDescription>
            </Alert>
          )}
          {[...drafts.entries()].map(([contactId, draft]) => {
            const contact = contactById.get(contactId)
            if (!contact) return null
            const waLink =
              contact.phone && draft.status === 'ok'
                ? buildWhatsAppLink(contact.phone, draft.text)
                : null
            return (
              <div key={contactId} className="space-y-2 rounded-md border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium">{getFullName(contact)}</p>
                  {draft.logged && (
                    <Badge variant="secondary" className="gap-1">
                      <Check className="size-3" /> Geloggt
                    </Badge>
                  )}
                </div>

                {draft.status === 'loading' ? (
                  <p className="text-sm text-muted-foreground">Entwurf wird erstellt...</p>
                ) : draft.status === 'error' ? (
                  <div className="flex items-center gap-2">
                    <p className="text-sm text-destructive">Entwurf fehlgeschlagen.</p>
                    <Button size="sm" variant="outline" onClick={() => void fetchDraft(contactId)}>
                      Erneut versuchen
                    </Button>
                  </div>
                ) : (
                  <>
                    <Textarea
                      value={draft.text}
                      onChange={(e) => updateDraftText(contactId, e.target.value)}
                      rows={3}
                    />
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" onClick={() => void copyDraft(contactId)}>
                        <Copy className="size-4" /> Kopieren
                      </Button>
                      {waLink && (
                        <Button size="sm" variant="outline" asChild>
                          <a href={waLink} target="_blank" rel="noopener noreferrer">
                            <MessageCircle className="size-4" /> WhatsApp
                          </a>
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={draft.logged}
                        onClick={() => void logInteraction(contact)}
                      >
                        Als Nachricht loggen
                      </Button>
                    </div>
                  </>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
