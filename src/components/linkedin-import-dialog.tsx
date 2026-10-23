'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Contact, EMPLOYER_NORMALIZATION_RESET } from '@/lib/contacts'
import {
  parseLinkedInCsv,
  computeImportPlan,
  FIELD_LABELS,
  type FieldDiff,
  type Occasion,
} from '@/lib/linkedin-import'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'

interface LinkedInImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  contacts: Contact[]
  onImported: () => void
}

const BATCH_SIZE = 50

interface NewContactRow {
  first_name: string
  last_name: string | null
  linkedin_url: string | null
  email: string
  employer: string
  job_title: string
  included: boolean
}

interface EditableDiff extends FieldDiff {
  value: string
}

interface ChangeRow {
  contactId: string
  name: string
  occasions: Occasion[]
  diffs: EditableDiff[]
  included: boolean
}

interface Counts {
  unchangedCount: number
  skippedCount: number
}

export function LinkedInImportDialog({
  open,
  onOpenChange,
  contacts,
  onImported,
}: LinkedInImportDialogProps) {
  const [newContactRows, setNewContactRows] = useState<NewContactRow[] | null>(null)
  const [changeRows, setChangeRows] = useState<ChangeRow[] | null>(null)
  const [counts, setCounts] = useState<Counts | null>(null)
  const [parseError, setParseError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const hasPlan = newContactRows !== null

  function reset() {
    setNewContactRows(null)
    setChangeRows(null)
    setCounts(null)
    setParseError(null)
    setSubmitError(null)
    setSuccessMessage(null)
  }

  function handleClose(nextOpen: boolean) {
    if (!nextOpen) reset()
    onOpenChange(nextOpen)
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    reset()
    const text = await file.text()
    const result = parseLinkedInCsv(text)
    if (!result) {
      setParseError('Keine gültige LinkedIn-Export-Datei.')
      return
    }
    const plan = computeImportPlan(result, contacts)
    setNewContactRows(
      plan.newContacts.map((row) => ({
        first_name: row.first_name,
        last_name: row.last_name,
        linkedin_url: row.linkedin_url,
        email: row.email ?? '',
        employer: row.employer ?? '',
        job_title: row.job_title ?? '',
        included: true,
      }))
    )
    setChangeRows(
      plan.changes.map((change) => ({
        contactId: change.contactId,
        name: change.name,
        occasions: change.occasions,
        included: true,
        diffs: change.diffs.map((diff) => ({ ...diff, value: diff.newValue })),
      }))
    )
    setCounts({ unchangedCount: plan.unchangedCount, skippedCount: plan.skippedCount })
  }

  function updateNewContactField(index: number, field: 'employer' | 'job_title' | 'email', value: string) {
    setNewContactRows((rows) => rows && rows.map((row, i) => (i === index ? { ...row, [field]: value } : row)))
  }

  function toggleNewContact(index: number) {
    setNewContactRows((rows) => rows && rows.map((row, i) => (i === index ? { ...row, included: !row.included } : row)))
  }

  function toggleChange(index: number) {
    setChangeRows((rows) => rows && rows.map((row, i) => (i === index ? { ...row, included: !row.included } : row)))
  }

  function updateChangeDiffValue(rowIndex: number, diffIndex: number, value: string) {
    setChangeRows(
      (rows) =>
        rows &&
        rows.map((row, i) =>
          i === rowIndex
            ? { ...row, diffs: row.diffs.map((d, j) => (j === diffIndex ? { ...d, value } : d)) }
            : row
        )
    )
  }

  async function handleConfirm() {
    if (!newContactRows || !changeRows) return
    setIsSubmitting(true)
    setSubmitError(null)

    try {
      const { data: userData } = await supabase.auth.getUser()
      if (!userData.user) {
        setSubmitError('Nicht eingeloggt.')
        return
      }

      const contactsToInsert = newContactRows
        .filter((row) => row.included)
        .map((row) => ({
          first_name: row.first_name,
          last_name: row.last_name,
          linkedin_url: row.linkedin_url,
          email: row.email || null,
          employer: row.employer || null,
          job_title: row.job_title || null,
          user_id: userData.user.id,
        }))

      for (let i = 0; i < contactsToInsert.length; i += BATCH_SIZE) {
        const { error } = await supabase.from('contacts').insert(contactsToInsert.slice(i, i + BATCH_SIZE))
        if (error) throw error
      }

      const includedChanges = changeRows.filter((row) => row.included)
      for (const change of includedChanges) {
        const updates: Record<string, string | null> = {}
        for (const diff of change.diffs) {
          updates[diff.field] = diff.value
        }
        if ('employer' in updates) {
          Object.assign(updates, EMPLOYER_NORMALIZATION_RESET)
        }
        const { error } = await supabase.from('contacts').update(updates).eq('id', change.contactId)
        if (error) throw error
      }

      const eventsToInsert = includedChanges.flatMap((change) =>
        change.occasions.map((type) => ({
          contact_id: change.contactId,
          user_id: userData.user.id,
          type,
        }))
      )
      for (let i = 0; i < eventsToInsert.length; i += BATCH_SIZE) {
        const { error } = await supabase.from('contact_events').insert(eventsToInsert.slice(i, i + BATCH_SIZE))
        if (error) throw error
      }

      // Foto-Enrichment (PROJ-20): fehlende Profilfotos im Hintergrund nachladen.
      // Fire-and-forget — Import-Erfolg hängt nicht am Foto-Laden.
      const hasPhotoCandidates =
        contactsToInsert.some((c) => c.linkedin_url) || includedChanges.length > 0
      if (hasPhotoCandidates) {
        fetch('/api/enrich-photos', { method: 'POST' }).catch(() => {})
      }

      setSuccessMessage(
        `${contactsToInsert.length} neu, ${includedChanges.length} aktualisiert, ${counts?.unchangedCount ?? 0} unverändert, ${counts?.skippedCount ?? 0} übersprungen.` +
          (hasPhotoCandidates ? ' Fehlende Profilfotos werden im Hintergrund geladen.' : '')
      )
      setNewContactRows(null)
      setChangeRows(null)
      onImported()
    } catch {
      setSubmitError('Import fehlgeschlagen. Bitte erneut versuchen.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>LinkedIn-Kontakte importieren</DialogTitle>
        </DialogHeader>

        {!hasPlan && !successMessage && (
          <div className="space-y-4">
            <input
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              aria-label="LinkedIn-CSV-Datei"
              className="text-sm"
            />
            {parseError && (
              <Alert variant="destructive">
                <AlertDescription>{parseError}</AlertDescription>
              </Alert>
            )}
          </div>
        )}

        {hasPlan && (
          <ScrollArea className="max-h-[60vh]">
            <div className="space-y-6 pr-4 text-sm">
              {newContactRows!.length > 0 && (
                <div className="space-y-3">
                  <h3 className="font-medium">Neue Kontakte ({newContactRows!.length})</h3>
                  {newContactRows!.map((row, index) => (
                    <div key={index} className="flex items-start gap-3 rounded-md border p-3">
                      <Checkbox
                        checked={row.included}
                        onCheckedChange={() => toggleNewContact(index)}
                        aria-label={`${row.first_name} ${row.last_name ?? ''} übernehmen`}
                        className="mt-1"
                      />
                      <div className="flex-1 space-y-2">
                        <p className="font-medium">
                          {row.first_name} {row.last_name ?? ''}
                        </p>
                        <div className="grid grid-cols-3 gap-2">
                          <Input
                            placeholder="Arbeitgeber"
                            value={row.employer}
                            onChange={(e) => updateNewContactField(index, 'employer', e.target.value)}
                          />
                          <Input
                            placeholder="Position"
                            value={row.job_title}
                            onChange={(e) => updateNewContactField(index, 'job_title', e.target.value)}
                          />
                          <Input
                            placeholder="E-Mail"
                            value={row.email}
                            onChange={(e) => updateNewContactField(index, 'email', e.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {changeRows!.length > 0 && (
                <div className="space-y-3">
                  <h3 className="font-medium">Veränderungen ({changeRows!.length})</h3>
                  {changeRows!.map((row, rowIndex) => (
                    <div key={row.contactId} className="flex items-start gap-3 rounded-md border p-3">
                      <Checkbox
                        checked={row.included}
                        onCheckedChange={() => toggleChange(rowIndex)}
                        aria-label={`Änderungen für ${row.name} übernehmen`}
                        className="mt-1"
                      />
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{row.name}</p>
                          {row.occasions.map((occasion) => (
                            <Badge key={occasion} variant="secondary">
                              {occasion}
                            </Badge>
                          ))}
                        </div>
                        {row.diffs.map((diff, diffIndex) => (
                          <div key={diff.field} className="flex items-center gap-2">
                            <span className="w-28 shrink-0 text-muted-foreground">{FIELD_LABELS[diff.field]}</span>
                            {diff.oldValue ? (
                              <span className="shrink-0 text-muted-foreground">{diff.oldValue} →</span>
                            ) : (
                              <Badge variant="outline" className="shrink-0">
                                Neu erfasst
                              </Badge>
                            )}
                            <Input
                              value={diff.value}
                              onChange={(e) => updateChangeDiffValue(rowIndex, diffIndex, e.target.value)}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="space-y-1 text-muted-foreground">
                <p>{counts?.unchangedCount ?? 0} unverändert</p>
                <p>{counts?.skippedCount ?? 0} übersprungen (kein Vorname)</p>
              </div>

              {submitError && (
                <Alert variant="destructive">
                  <AlertDescription>{submitError}</AlertDescription>
                </Alert>
              )}
            </div>
          </ScrollArea>
        )}

        {successMessage && <p className="text-sm">{successMessage}</p>}

        <DialogFooter>
          {hasPlan ? (
            <>
              <Button type="button" variant="outline" onClick={() => handleClose(false)}>
                Abbrechen
              </Button>
              <Button onClick={handleConfirm} disabled={isSubmitting}>
                {isSubmitting ? 'Speichere...' : 'Bestätigen'}
              </Button>
            </>
          ) : (
            <Button type="button" variant="outline" onClick={() => handleClose(false)}>
              Schließen
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
