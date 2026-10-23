'use client'

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

import { supabase } from '@/lib/supabase'
import {
  Contact,
  CATEGORY_LABELS,
  STRENGTH_LABELS,
  STRENGTH_DEFAULT_INTERVAL_DAYS,
  getFullName,
  type Category,
  type Strength,
} from '@/lib/contacts'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { PhotoLightbox } from '@/components/photo-lightbox'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Sparkles } from 'lucide-react'
import { Separator } from '@/components/ui/separator'

function today() {
  return new Date().toISOString().slice(0, 10)
}

const contactSchema = z.object({
  first_name: z.string().trim().min(1, 'Vorname ist erforderlich').max(100, 'Max. 100 Zeichen'),
  last_name: z.string().trim().max(100, 'Max. 100 Zeichen').optional(),
  category: z.enum(['colleague', 'alumni', 'extern', 'private', 'other']).optional(),
  strength: z.enum(['none', '1', '2', '3']).optional(),
  employer: z.string().trim().max(100, 'Max. 100 Zeichen').optional(),
  employer_normalized: z.string().trim().max(100, 'Max. 100 Zeichen').optional(),
  job_title: z.string().trim().max(100, 'Max. 100 Zeichen').optional(),
  email: z
    .union([z.literal(''), z.string().trim().max(200, 'Max. 200 Zeichen').email('Ungültige E-Mail-Adresse')])
    .optional(),
  context: z.string().trim().max(500, 'Max. 500 Zeichen').optional(),
  notes: z.string().trim().max(2000, 'Max. 2000 Zeichen').optional(),
  city: z.string().trim().max(100, 'Max. 100 Zeichen').optional(),
  phone: z.string().trim().max(30, 'Max. 30 Zeichen').optional(),
  linkedin_url: z
    .union([z.literal(''), z.string().trim().max(300, 'Max. 300 Zeichen').url('Ungültige URL')])
    .optional(),
  birthday: z
    .string()
    .optional()
    .refine((value) => !value || value <= today(), 'Geburtstag darf nicht in der Zukunft liegen'),
  followup_interval_days: z.string().optional(),
})

type ContactFormValues = z.infer<typeof contactSchema>

interface ContactFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  contact?: Contact | null
  onSaved: () => void
}

export function ContactFormDialog({ open, onOpenChange, contact, onSaved }: ContactFormDialogProps) {
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [commonalities, setCommonalities] = useState<string | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analyzeError, setAnalyzeError] = useState<string | null>(null)

  const form = useForm<ContactFormValues>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      first_name: '',
      last_name: '',
      category: undefined,
      strength: undefined,
      employer: '',
      employer_normalized: '',
      job_title: '',
      email: '',
      context: '',
      notes: '',
      city: '',
      phone: '',
      linkedin_url: '',
      birthday: '',
      followup_interval_days: '',
    },
  })

  useEffect(() => {
    if (open) {
      setSubmitError(null)
      setCommonalities(contact?.commonalities ?? null)
      setAnalyzeError(null)
      form.reset({
        first_name: contact?.first_name ?? '',
        last_name: contact?.last_name ?? '',
        category: (contact?.category as Category) ?? undefined,
        strength: contact ? (contact.strength ? (String(contact.strength) as '1' | '2' | '3') : 'none') : undefined,
        employer: contact?.employer ?? '',
        employer_normalized: contact?.employer_normalized ?? '',
        job_title: contact?.job_title ?? '',
        email: contact?.email ?? '',
        context: contact?.context ?? '',
        notes: contact?.notes ?? '',
        city: contact?.city ?? '',
        phone: contact?.phone ?? '',
        linkedin_url: contact?.linkedin_url ?? '',
        birthday: contact?.birthday ?? '',
        followup_interval_days: contact?.followup_interval_days
          ? String(contact.followup_interval_days)
          : '',
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, contact])

  function handleStrengthChange(value: string) {
    if (value === 'none') {
      form.setValue('strength', 'none')
      if (!form.formState.dirtyFields.followup_interval_days) {
        form.setValue('followup_interval_days', '')
      }
      return
    }
    form.setValue('strength', value as '1' | '2' | '3')
    if (!form.formState.dirtyFields.followup_interval_days) {
      const days = STRENGTH_DEFAULT_INTERVAL_DAYS[Number(value) as Strength]
      form.setValue('followup_interval_days', String(days))
    }
  }

  async function analyzeCommonalities() {
    if (!contact?.id) return
    setIsAnalyzing(true)
    setAnalyzeError(null)
    try {
      const res = await fetch(`/api/contacts/${contact.id}/commonalities`, { method: 'POST' })
      const json = await res.json()
      if (!res.ok) {
        setAnalyzeError(json.error ?? 'Analyse fehlgeschlagen.')
      } else {
        setCommonalities(json.commonalities)
        onSaved()
      }
    } catch {
      setAnalyzeError('Verbindung fehlgeschlagen. Bitte erneut versuchen.')
    } finally {
      setIsAnalyzing(false)
    }
  }

  async function onSubmit(values: ContactFormValues) {
    setSubmitError(null)
    setIsSubmitting(true)

    try {
      // Firmen-Normalisierung (PROJ-22):
      // - Manuell geändertes Normalisierungs-Feld gewinnt und ist für die KI tabu
      // - Geänderter Arbeitgeber setzt die Normalisierung zurück (neue Faktenlage),
      //   der Batch-Endpunkt normalisiert dann neu
      const employerValue = values.employer || null
      const normalizedValue = values.employer_normalized?.trim() || null
      const employerChanged = employerValue !== (contact?.employer ?? null)
      const normalizedEdited = normalizedValue !== (contact?.employer_normalized ?? null)

      let normalizationFields = {}
      if (normalizedEdited) {
        normalizationFields = {
          employer_normalized: normalizedValue,
          employer_normalized_source: normalizedValue ? 'manual' : null,
          employer_normalized_at: normalizedValue ? new Date().toISOString() : null,
        }
      } else if (employerChanged) {
        normalizationFields = {
          employer_normalized: null,
          employer_normalized_source: null,
          employer_normalized_at: null,
        }
      }

      const payload = {
        first_name: values.first_name,
        last_name: values.last_name || null,
        category: values.category ?? null,
        strength: values.strength && values.strength !== 'none' ? Number(values.strength) : null,
        employer: employerValue,
        ...normalizationFields,
        job_title: values.job_title || null,
        email: values.email || null,
        context: values.context || null,
        notes: values.notes || null,
        city: values.city || null,
        phone: values.phone || null,
        linkedin_url: values.linkedin_url || null,
        birthday: values.birthday || null,
        followup_interval_days: values.followup_interval_days
          ? Number(values.followup_interval_days)
          : null,
      }

      const { data: userData } = await supabase.auth.getUser()
      if (!userData.user) {
        setSubmitError('Nicht eingeloggt.')
        return
      }

      const { error, status } = contact
        ? await supabase.from('contacts').update(payload).eq('id', contact.id)
        : await supabase.from('contacts').insert({ ...payload, user_id: userData.user.id })

      if (error && status === 0) {
        setSubmitError('Verbindung zu Supabase fehlgeschlagen. Bitte erneut versuchen.')
        return
      }

      if (error) {
        setSubmitError('Speichern fehlgeschlagen. Bitte erneut versuchen.')
        return
      }

      onOpenChange(false)
      onSaved()
    } catch {
      setSubmitError('Verbindung zu Supabase fehlgeschlagen. Bitte erneut versuchen.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{contact ? 'Kontakt bearbeiten' : 'Kontakt hinzufügen'}</DialogTitle>
        </DialogHeader>

        {contact && (
          <div className="flex justify-center">
            <Avatar
              className={cn('h-20 w-20', contact.photo_url && 'cursor-zoom-in')}
              onClick={contact.photo_url ? () => setLightboxOpen(true) : undefined}
            >
              {contact.photo_url && (
                <AvatarImage src={contact.photo_url} alt={getFullName(contact)} />
              )}
              <AvatarFallback className="bg-primary/10 text-lg font-medium text-primary">
                {((contact.first_name?.[0] ?? '') + (contact.last_name?.[0] ?? '')).toUpperCase() || '?'}
              </AvatarFallback>
            </Avatar>
          </div>
        )}

        {contact && (
          <PhotoLightbox
            src={contact.photo_url}
            alt={getFullName(contact)}
            open={lightboxOpen}
            onOpenChange={setLightboxOpen}
          />
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {submitError && (
              <Alert variant="destructive">
                <AlertDescription>{submitError}</AlertDescription>
              </Alert>
            )}

            <FormField
              control={form.control}
              name="first_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Vorname</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="last_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nachname</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Kontakttyp</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Kontakttyp wählen" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="strength"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Beziehungsstärke</FormLabel>
                  <Select onValueChange={handleStrengthChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Stärke wählen" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">Keine</SelectItem>
                      {([3, 2, 1] as const).map((v) => (
                        <SelectItem key={v} value={String(v)}>
                          {STRENGTH_LABELS[v]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="employer"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Arbeitgeber</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {contact && (
              <FormField
                control={form.control}
                name="employer_normalized"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Firma (normalisiert)</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Wird automatisch von KI gesetzt"
                        {...field}
                      />
                    </FormControl>
                    <p className="text-xs text-muted-foreground">
                      Gruppiert den Kontakt in der Firmen-Ansicht. Manuelle Änderung wird von der
                      KI nicht überschrieben.
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="job_title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Jobtitel</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>E-Mail</FormLabel>
                  <FormControl>
                    <Input type="text" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="context"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Kontext</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notizen</FormLabel>
                  <FormControl>
                    <Textarea {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="city"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Stadt</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Telefonnummer</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="linkedin_url"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>LinkedIn-URL</FormLabel>
                  <FormControl>
                    <Input type="url" placeholder="https://www.linkedin.com/in/..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="birthday"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Geburtstag</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="followup_interval_days"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Follow-up-Intervall (Tage)</FormLabel>
                  <FormControl>
                    <Input type="number" min={1} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {contact && (
              <>
                <Separator />
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="flex items-center gap-1.5 text-sm font-medium">
                      <Sparkles className="size-4 text-violet-500" />
                      Gemeinsamkeiten
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={isAnalyzing}
                      onClick={analyzeCommonalities}
                    >
                      {isAnalyzing
                        ? 'Analysiere...'
                        : commonalities
                          ? 'Neu analysieren'
                          : 'KI-Analyse starten'}
                    </Button>
                  </div>
                  {analyzeError && (
                    <Alert variant="destructive">
                      <AlertDescription>{analyzeError}</AlertDescription>
                    </Alert>
                  )}
                  {commonalities && !analyzeError && (
                    <p className="whitespace-pre-line rounded-md bg-violet-50 p-3 text-sm text-violet-900 dark:bg-violet-950 dark:text-violet-100">
                      {commonalities}
                    </p>
                  )}
                  {!commonalities && !analyzeError && !isAnalyzing && (
                    <p className="text-xs text-muted-foreground">
                      KI vergleicht dein CV mit dem Kontaktprofil und findet Anknüpfungspunkte.
                    </p>
                  )}
                </div>
              </>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Abbrechen
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Wird gespeichert...' : 'Speichern'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
