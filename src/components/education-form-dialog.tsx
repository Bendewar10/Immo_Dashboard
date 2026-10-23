'use client'

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

import { supabase } from '@/lib/supabase'
import { EducationEntry } from '@/lib/user-profile'
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
import { Alert, AlertDescription } from '@/components/ui/alert'

const educationSchema = z
  .object({
    institution: z.string().trim().min(1, 'Institution ist erforderlich').max(200, 'Max. 200 Zeichen'),
    degree: z.string().trim().max(200, 'Max. 200 Zeichen').optional(),
    field_of_study: z.string().trim().max(200, 'Max. 200 Zeichen').optional(),
    city: z.string().trim().max(100, 'Max. 100 Zeichen').optional(),
    start_date: z.string().optional(),
    end_date: z.string().optional(),
  })
  .refine((values) => !values.start_date || !values.end_date || values.end_date >= values.start_date, {
    message: 'Enddatum darf nicht vor dem Startdatum liegen',
    path: ['end_date'],
  })

type EducationFormValues = z.infer<typeof educationSchema>

interface EducationFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  entry?: EducationEntry | null
  onSaved: () => void
}

export function EducationFormDialog({ open, onOpenChange, entry, onSaved }: EducationFormDialogProps) {
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const form = useForm<EducationFormValues>({
    resolver: zodResolver(educationSchema),
    defaultValues: {
      institution: '',
      degree: '',
      field_of_study: '',
      city: '',
      start_date: '',
      end_date: '',
    },
  })

  useEffect(() => {
    if (open) {
      setSubmitError(null)
      form.reset({
        institution: entry?.institution ?? '',
        degree: entry?.degree ?? '',
        field_of_study: entry?.field_of_study ?? '',
        city: entry?.city ?? '',
        start_date: entry?.start_date ?? '',
        end_date: entry?.end_date ?? '',
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, entry])

  async function onSubmit(values: EducationFormValues) {
    setSubmitError(null)
    setIsSubmitting(true)

    try {
      const payload = {
        institution: values.institution,
        degree: values.degree || null,
        field_of_study: values.field_of_study || null,
        city: values.city || null,
        start_date: values.start_date || null,
        end_date: values.end_date || null,
      }

      const { data: userData } = await supabase.auth.getUser()
      if (!userData.user) {
        setSubmitError('Nicht eingeloggt.')
        return
      }

      const { error } = entry
        ? await supabase.from('user_education').update(payload).eq('id', entry.id)
        : await supabase.from('user_education').insert({ ...payload, user_id: userData.user.id })

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
          <DialogTitle>{entry ? 'Ausbildung bearbeiten' : 'Ausbildung hinzufügen'}</DialogTitle>
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
              name="institution"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Institution</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="degree"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Abschluss</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="field_of_study"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Fachrichtung</FormLabel>
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
