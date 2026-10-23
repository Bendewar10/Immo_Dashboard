'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { ContactOccasion } from '@/lib/occasions'
import { buildCalendarLink } from '@/lib/external-links'
import { Contact, getFullName } from '@/lib/contacts'
import { Calendar, Check, Sparkles } from 'lucide-react'

const BADGE_LABELS = {
  followup: 'Follow-up',
  birthday: 'Geburtstag',
} as const

const BADGE_STYLES = {
  followup: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300',
  birthday: 'border-pink-200 bg-pink-50 text-pink-700 dark:border-pink-800 dark:bg-pink-950 dark:text-pink-300',
} as const

interface OccasionCardProps {
  occasion: ContactOccasion
  onLogInteraction: () => void
  onOpenCard: () => void
}

function formatDate(value: string | null) {
  if (!value) return null
  return new Date(value).toLocaleDateString('de-DE')
}

function getInitials(contact: Contact) {
  const first = contact.first_name?.[0] ?? ''
  const last = contact.last_name?.[0] ?? ''
  return (first + last).toUpperCase() || '?'
}

export function OccasionCard({ occasion, onLogInteraction, onOpenCard }: OccasionCardProps) {
  const { contact, badges, followupDate, birthdayDate } = occasion
  const [draftText, setDraftText] = useState<string | null>(null)
  const [tone, setTone] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [draftError, setDraftError] = useState<string | null>(null)
  const [copyError, setCopyError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const primaryType = badges[0]

  async function handleCopyDraft() {
    if (!draftText) return
    setCopyError(null)
    try {
      await navigator.clipboard.writeText(draftText)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopyError('Kopieren nicht möglich. Bitte Text manuell markieren.')
    }
  }

  async function handleGenerateDraft() {
    setIsGenerating(true)
    setDraftError(null)
    try {
      const res = await fetch('/api/draft-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contactId: contact.id,
          occasionType: primaryType,
          tone: tone.trim() || undefined,
        }),
      })
      if (!res.ok) {
        setDraftError('Vorschlag konnte nicht generiert werden. Bitte erneut versuchen.')
        return
      }
      const data = await res.json()
      setDraftText(data.text)
    } catch {
      setDraftError('Vorschlag konnte nicht generiert werden. Bitte erneut versuchen.')
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <Card className="rounded-xl transition-all hover:-translate-y-0.5 hover:shadow-md">
      <CardHeader className="flex flex-row items-start gap-3 space-y-0 p-4">
        <Avatar className="h-10 w-10 shrink-0 cursor-pointer" onClick={onOpenCard}>
          {contact.photo_url && <AvatarImage src={contact.photo_url} alt={getFullName(contact)} />}
          <AvatarFallback className="bg-primary/10 text-sm font-medium text-primary">
            {getInitials(contact)}
          </AvatarFallback>
        </Avatar>

        <div className="min-w-0 flex-1">
          <h3
            className="line-clamp-1 cursor-pointer text-base font-semibold leading-tight hover:underline"
            onClick={onOpenCard}
          >
            {getFullName(contact)}
          </h3>
          {contact.job_title || contact.employer ? (
            <p className="truncate text-sm text-muted-foreground">
              {[contact.job_title, contact.employer].filter(Boolean).join(' · ')}
            </p>
          ) : null}
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1">
          {badges.map((badge) => (
            <Badge key={badge} variant="outline" className={BADGE_STYLES[badge]}>
              {BADGE_LABELS[badge]}
            </Badge>
          ))}
        </div>
      </CardHeader>

      <CardContent className="space-y-3 p-4 pt-0 text-sm">
        {badges.includes('birthday') && birthdayDate && (
          <p className="text-muted-foreground">Geburtstag: {formatDate(birthdayDate)}</p>
        )}
        {badges.includes('followup') && followupDate && (
          <p className="text-muted-foreground">Follow-up: {formatDate(followupDate)}</p>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={onLogInteraction} className="gap-1.5">
            <Check className="size-3.5" />
            Kontaktiert
          </Button>
          <Button size="sm" variant="outline" onClick={handleGenerateDraft} disabled={isGenerating} className="gap-1.5">
            <Sparkles className="size-3.5" />
            {isGenerating ? 'Generiere...' : 'Vorschlag'}
          </Button>
          {badges.includes('followup') && followupDate && (
            <Button size="sm" variant="ghost" asChild className="gap-1.5">
              <a
                href={buildCalendarLink(`Follow-up: ${getFullName(contact)}`, followupDate)}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Calendar className="size-3.5" />
                Kalender
              </a>
            </Button>
          )}
          {badges.includes('birthday') && birthdayDate && (
            <Button size="sm" variant="ghost" asChild className="gap-1.5">
              <a
                href={buildCalendarLink(`Geburtstag: ${getFullName(contact)}`, birthdayDate)}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Calendar className="size-3.5" />
                Kalender
              </a>
            </Button>
          )}
        </div>

        {draftError && <p className="text-destructive">{draftError}</p>}

        {draftText && (
          <div className="space-y-2 rounded-lg border bg-muted/40 p-3">
            <Textarea
              value={draftText}
              onChange={(e) => setDraftText(e.target.value)}
              className="min-h-[70px] bg-background text-sm"
            />
            <div className="flex flex-wrap items-center gap-2">
              <Input
                placeholder="Ton anpassen, z.B. lockerer / auf Englisch / kürzer"
                value={tone}
                onChange={(e) => setTone(e.target.value)}
                className="h-8 flex-1 min-w-[180px] text-sm"
              />
              <Button
                size="sm"
                variant="outline"
                onClick={handleGenerateDraft}
                disabled={isGenerating}
                className="gap-1.5"
              >
                <Sparkles className="size-3.5" />
                {isGenerating ? 'Generiere...' : 'Neu generieren'}
              </Button>
            </div>
            <Button size="sm" variant="outline" onClick={handleCopyDraft} className="gap-1.5">
              {copied ? <><Check className="size-3.5" />Kopiert!</> : 'Kopieren'}
            </Button>
            {copyError && <p className="text-destructive">{copyError}</p>}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
