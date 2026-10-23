'use client'

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

import { supabase } from '@/lib/supabase'
import { EmploymentEntry } from '@/lib/user-profile'
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

const employmentSchema = z
  .object({
    employer: z.string().trim().min(1, 'Arbeitgeber ist erforderlich').max(200, 'Max. 200 Zeichen'),
    job_title: z.string().trim().max(200, 'Max. 200 Zeichen').optional(),
    city: z.string().trim().max(100, 'Max. 100 Zeichen').optional(),
    start_date: z.string().optional(),
    end_date: z.string().optional(),
    description: z.string().trim().max(500, 'Max. 500 Zeichen').optional(),
  })
  .refine((values) => !values.start_date || !values.end_date || values.end_date >= values.start_date, {
    message: 'Enddatum darf nicht vor dem Startdatum liegen',
    path: ['end_date'],
  })

type EmploymentFormValues = z.infer<typeof employmentSchema>

interface EmploymentFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  entry?: EmploymentEntry | null
  onSaved: () => void
}

export function EmploymentFormDialog({ open, onOpenChange, entry, onSaved }: EmploymentFormDialogProps) {
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const form = useForm<EmploymentFormValues>({
    resolver: zodResolver(employmentSchema),
    defaultValues: {
      employer: '',
      job_title: '',
      city: '',
      start_date: '',
      end_date: '',
      description: '',
    },
  })

  useEffect(() => {
    if (open) {
      setSubmitError(null)
      form.reset({
        employer: entry?.employer ?? '',
        job_title: entry?.job_title ?? '',
        city: entry?.city ?? '',
        start_date: entry?.start_date ?? '',
        end_date: entry?.end_date ?? '',
        description: entry?.description ?? '',
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, entry])

  async function onSubmit(values: EmploymentFormValues) {
    setSubmitError(null)
    setIsSubmitting(true)

    try {
      const payload = {
        employer: values.employer,
        job_title: values.job_title || null,
        city: values.city || null,
        start_date: values.start_date || null,
        end_date: values.end_date || null,
        description: values.description || null,
      }

      const { data: userData } = await supabase.auth.getUser()
      if (!userData.user) {
        setSubmitError('Nicht eingeloggt.')
        return
      }

      const { error } = entry
        ? await supabase.from('user_employment').update(payload).eq('id', entry.id)
        : await supabase.from('user_employment').insert({ ...payload, user_id: userData.user.id })

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
          <DialogTitle>{entry ? 'Berufserfahrung bearbeiten' : 'Berufserfahrung hinzufügen'}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {submitError && (
              <Alert variant="destructive">
                <AlertDescription>{submitError}</AlertDescription>
              </Alert>
            )}

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

            <FormField
              control={form.control}
              name="job_title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Rolle</FormLabel>
                  <FormControl>
                    <Input {...field} />
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
              name="start_date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Startdatum</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="end_date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Enddatum</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Beschreibung</FormLabel>
                  <FormControl>
                    <Textarea {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

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
