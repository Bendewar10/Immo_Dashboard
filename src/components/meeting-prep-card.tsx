'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { MeetingContact, MeetingGroup, formatDayLabel, needsPostMeetingNudge } from '@/lib/meetings'
import { getFullName } from '@/lib/contacts'
import { Check, Clock, Sparkles } from 'lucide-react'

interface MeetingPrepCardProps {
  meeting: MeetingGroup
  onLogInteraction: (contactId: string) => void
}

function getInitials(contact: MeetingContact) {
  const first = contact.first_name?.[0] ?? ''
  const last = contact.last_name?.[0] ?? ''
  return (first + last).toUpperCase() || '?'
}

function formatTime(startTime: string | null, isAllDay: boolean) {
  if (isAllDay) return 'Ganztägig'
  if (!startTime) return null
  return new Date(startTime).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
}

function ContactPrepRow({
  contact,
  showNudge,
  onLogInteraction,
}: {
  contact: MeetingContact
  showNudge: boolean
  onLogInteraction: () => void
}) {
  const [summary, setSummary] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handlePrepare() {
    setIsGenerating(true)
    setError(null)
    try {
      const res = await fetch('/api/meeting-prep', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contactId: contact.id }),
      })
      if (!res.ok) {
        setError('Zusammenfassung konnte nicht generiert werden. Bitte erneut versuchen.')
        return
      }
      const data = await res.json()
      setSummary(data.text)
    } catch {
      setError('Zusammenfassung konnte nicht generiert werden. Bitte erneut versuchen.')
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="space-y-2 rounded-lg border p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Avatar className="h-8 w-8 shrink-0">
            {contact.photo_url && <AvatarImage src={contact.photo_url} alt={getFullName(contact)} />}
            <AvatarFallback className="bg-primary/10 text-xs font-medium text-primary">
              {getInitials(contact)}
            </AvatarFallback>
          </Avatar>
          <span className="truncate text-sm font-medium">{getFullName(contact)}</span>
        </div>
        <Button size="sm" variant="outline" onClick={handlePrepare} disabled={isGenerating} className="shrink-0 gap-1.5">
          <Sparkles className="size-3.5" />
          {isGenerating ? 'Generiere...' : 'Vorbereiten'}
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {summary && <p className="text-sm text-muted-foreground">{summary}</p>}

      {showNudge && (
        <div className="flex items-center justify-between gap-2 border-t pt-2">
          <span className="text-xs text-muted-foreground">Interaktion loggen?</span>
          <Button size="sm" variant="ghost" onClick={onLogInteraction} className="h-7 gap-1.5 text-xs">
            <Check className="size-3.5" />
            Kontaktiert
          </Button>
        </div>
      )}
    </div>
  )
}

export function MeetingPrepCard({ meeting, onLogInteraction }: MeetingPrepCardProps) {
  const time = formatTime(meeting.startTime, meeting.isAllDay)
  const dayLabel = formatDayLabel(meeting.date)

  return (
    <Card className="rounded-xl">
      <CardHeader className="space-y-1 p-4">
        <h3 className="text-base font-semibold leading-tight">{meeting.title}</h3>
        {(time || dayLabel) && (
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Clock className="size-3.5" />
            {time}
            {dayLabel && <span className="font-medium text-foreground">· {dayLabel}</span>}
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-2 p-4 pt-0">
        {meeting.contacts.map((contact) => (
          <ContactPrepRow
            key={contact.id}
            contact={contact}
            showNudge={needsPostMeetingNudge(meeting, contact)}
            onLogInteraction={() => onLogInteraction(contact.id)}
          />
        ))}
      </CardContent>
    </Card>
  )
}
