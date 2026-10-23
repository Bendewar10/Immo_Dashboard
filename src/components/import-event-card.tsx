'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { ContactEventGroup } from '@/lib/contact-events'
import { Contact, getFullName } from '@/lib/contacts'
import { Check, Sparkles } from 'lucide-react'

interface ImportEventCardProps {
  group: ContactEventGroup
  onLogInteraction: () => void
}

function getInitials(contact: Contact) {
  const first = contact.first_name?.[0] ?? ''
  const last = contact.last_name?.[0] ?? ''
  return (first + last).toUpperCase() || '?'
}

export function ImportEventCard({ group, onLogInteraction }: ImportEventCardProps) {
  const { contact, types } = group
  const [draftText, setDraftText] = useState<string | null>(null)
  const [tone, setTone] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [draftError, setDraftError] = useState<string | null>(null)
  const [copyError, setCopyError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const primaryType = types[0]

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
        <Avatar className="h-10 w-10 shrink-0">
          <AvatarFallback className="bg-primary/10 text-sm font-medium text-primary">
            {getInitials(contact)}
          </AvatarFallback>
        </Avatar>

        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-1 text-base font-semibold leading-tight">{getFullName(contact)}</h3>
          {contact.job_title || contact.employer ? (
            <p className="truncate text-sm text-muted-foreground">
              {[contact.job_title, contact.employer].filter(Boolean).join(' · ')}
            </p>
          ) : null}
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1">
          {types.map((type) => (
            <Badge key={type} variant="outline" className="border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-300">
              {type}
            </Badge>
          ))}
        </div>
      </CardHeader>

      <CardContent className="space-y-3 p-4 pt-0 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={onLogInteraction} className="gap-1.5">
            <Check className="size-3.5" />
            Kontaktiert
          </Button>
          <Button size="sm" variant="outline" onClick={handleGenerateDraft} disabled={isGenerating} className="gap-1.5">
            <Sparkles className="size-3.5" />
            {isGenerating ? 'Generiere...' : 'Vorschlag'}
          </Button>
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
