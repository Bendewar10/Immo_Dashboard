'use client'

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

import { supabase } from '@/lib/supabase'
import { Project } from '@/lib/projects'
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

const projectSchema = z
  .object({
    title: z.string().trim().min(1, 'Titel ist erforderlich').max(200, 'Max. 200 Zeichen'),
    client: z.string().trim().max(100, 'Max. 100 Zeichen').optional(),
    city: z.string().trim().max(100, 'Max. 100 Zeichen').optional(),
    start_date: z.string().optional(),
    end_date: z.string().optional(),
    notes: z.string().trim().max(2000, 'Max. 2000 Zeichen').optional(),
  })
  .refine((values) => !values.start_date || !values.end_date || values.end_date >= values.start_date, {
    message: 'Enddatum darf nicht vor dem Startdatum liegen',
    path: ['end_date'],
  })

type ProjectFormValues = z.infer<typeof projectSchema>

interface ProjectFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  project?: Project | null
  onSaved: () => void
}

export function ProjectFormDialog({ open, onOpenChange, project, onSaved }: ProjectFormDialogProps) {
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const form = useForm<ProjectFormValues>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      title: '',
      client: '',
      city: '',
      start_date: '',
      end_date: '',
      notes: '',
    },
  })

  useEffect(() => {
    if (open) {
      setSubmitError(null)
      form.reset({
        title: project?.title ?? '',
        client: project?.client ?? '',
        city: project?.city ?? '',
        start_date: project?.start_date ?? '',
        end_date: project?.end_date ?? '',
        notes: project?.notes ?? '',
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, project])

  async function onSubmit(values: ProjectFormValues) {
    setSubmitError(null)
    setIsSubmitting(true)

    try {
      const payload = {
        title: values.title,
        client: values.client || null,
        city: values.city || null,
        start_date: values.start_date || null,
        end_date: values.end_date || null,
        notes: values.notes || null,
      }

      const { data: userData } = await supabase.auth.getUser()
      if (!userData.user) {
        setSubmitError('Nicht eingeloggt.')
        return
      }

      const { error, status } = project
        ? await supabase.from('projects').update(payload).eq('id', project.id)
        : await supabase
            .from('projects')
            .insert({ ...payload, status: 'active', user_id: userData.user.id })

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
          <DialogTitle>{project ? 'Projekt bearbeiten' : 'Projekt anlegen'}</DialogTitle>
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
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Titel</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="client"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Kunde</FormLabel>
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
