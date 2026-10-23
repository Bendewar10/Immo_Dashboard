'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Contact, getFullName } from '@/lib/contacts'
import { CHANNEL_LABELS, type Channel } from '@/lib/interactions'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Building2, X } from 'lucide-react'

interface CompanyHeaderCardProps {
  company: string
  contacts: Contact[]
  onClear: () => void
}

interface TimelineEntry {
  id: string
  contact_id: string
  occurred_at: string
  channel: Channel
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('de-DE')
}

export function CompanyHeaderCard({ company, contacts, onClear }: CompanyHeaderCardProps) {
  const [timeline, setTimeline] = useState<TimelineEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const contactIds = contacts.map((c) => c.id)
  const idsKey = contactIds.join(',')

  useEffect(() => {
    if (contactIds.length === 0) {
      setTimeline([])
      setIsLoading(false)
      return
    }
    let cancelled = false
    setIsLoading(true)
    supabase
      .from('interactions')
      .select('id, contact_id, occurred_at, channel')
      .in('contact_id', contactIds)
      .order('occurred_at', { ascending: false })
      .limit(5)
      .then(({ data }) => {
        if (cancelled) return
        setTimeline((data as TimelineEntry[]) ?? [])
        setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey])

  const lastTouchpoint = contacts.reduce<string | null>((latest, c) => {
    if (!c.last_contacted_at) return latest
    return !latest || c.last_contacted_at > latest ? c.last_contacted_at : latest
  }, null)

  const contactNameById = new Map(contacts.map((c) => [c.id, getFullName(c)]))

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardHeader className="flex flex-row items-start justify-between space-y-0 p-4 pb-2">
        <div className="flex min-w-0 items-center gap-2">
          <Building2 className="size-5 shrink-0 text-primary" />
          <CardTitle className="truncate text-lg" title={company}>
            {company}
          </CardTitle>
          <Badge variant="secondary" className="shrink-0">
            {contacts.length} {contacts.length === 1 ? 'Kontakt' : 'Kontakte'}
          </Badge>
        </div>
        <Button variant="ghost" size="icon" aria-label="Firmen-Filter aufheben" onClick={onClear}>
          <X className="size-4" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-2 p-4 pt-0 text-sm">
        <p className="text-muted-foreground">
          Letzter Touchpoint:{' '}
          {lastTouchpoint ? formatDate(lastTouchpoint) : 'Noch keine Interaktionen'}
        </p>
        {isLoading ? (
          <p className="text-muted-foreground">Lädt Interaktionen...</p>
        ) : timeline.length === 0 ? (
          <p className="text-muted-foreground">Noch keine Interaktionen</p>
        ) : (
          <ul className="space-y-1">
            {timeline.map((entry) => (
              <li key={entry.id} className="flex items-center gap-2">
                <span className="w-20 shrink-0 text-muted-foreground">
                  {formatDate(entry.occurred_at)}
                </span>
                <Badge variant="outline" className="shrink-0">
                  {CHANNEL_LABELS[entry.channel]}
                </Badge>
                <span className="truncate">
                  {contactNameById.get(entry.contact_id) ?? 'Unbekannter Kontakt'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
