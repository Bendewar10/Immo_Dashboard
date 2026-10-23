'use client'

import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { MeetingFrequencyEntry, MeetingFrequencyResponse } from '@/lib/analytics'
import { getFullName } from '@/lib/contacts'

interface MeetingFrequencyCardProps {
  data: MeetingFrequencyResponse | null
}

function getInitials(entry: MeetingFrequencyEntry) {
  const first = entry.first_name?.[0] ?? ''
  const last = entry.last_name?.[0] ?? ''
  return (first + last).toUpperCase() || '?'
}

export function MeetingFrequencyCard({ data }: MeetingFrequencyCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Top-Kontakte nach Meeting-Häufigkeit</CardTitle>
      </CardHeader>
      <CardContent>
        {!data || !data.googleConnected ? (
          <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
            Google Kalender verbinden, um Meeting-Häufigkeit zu sehen —{' '}
            <Link href="/einstellungen/konnektoren" className="underline hover:text-foreground">
              zu den Konnektoren
            </Link>
          </div>
        ) : data.error ? (
          <p className="text-sm text-destructive">Meeting-Daten konnten nicht geladen werden.</p>
        ) : data.entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">Keine Meetings mit bekannten Kontakten im gewählten Zeitraum.</p>
        ) : (
          <ul className="space-y-3">
            {data.entries.map((entry) => (
              <li key={entry.contactId} className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <Avatar className="h-7 w-7 shrink-0">
                    {entry.photo_url && <AvatarImage src={entry.photo_url} alt={getFullName(entry)} />}
                    <AvatarFallback className="bg-primary/10 text-xs font-medium text-primary">
                      {getInitials(entry)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="truncate text-sm font-medium">{getFullName(entry)}</span>
                </div>
                <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                  {entry.count} {entry.count === 1 ? 'Meeting' : 'Meetings'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
