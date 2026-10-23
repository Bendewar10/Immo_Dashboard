'use client'

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

import { supabase } from '@/lib/supabase'
import { CHANNEL_LABELS, Interaction, type Channel } from '@/lib/interactions'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const NO_PROJECT = 'none'

function today() {
  return new Date().toISOString().slice(0, 10)
}

const interactionSchema = z.object({
  occurred_at: z
    .string()
    .min(1, 'Datum ist erforderlich')
    .refine((value) => value <= today(), 'Datum darf nicht in der Zukunft liegen'),
  channel: z.enum(['meeting', 'call', 'message', 'event'], {
    error: 'Kanal ist erforderlich',
  }),
  note: z.string().trim().max(2000, 'Max. 2000 Zeichen').optional(),
  project_id: z.string().optional(),
})

type InteractionFormValues = z.infer<typeof interactionSchema>

interface InteractionFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  contactId: string
  interaction?: Interaction | null
  onSaved: () => void
}

export function InteractionFormDialog({
  open,
  onOpenChange,
  contactId,
  interaction,
  onSaved,
}: InteractionFormDialogProps) {
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [projects, setProjects] = useState<Project[]>([])

  const form = useForm<InteractionFormValues>({
    resolver: zodResolver(interactionSchema),
    defaultValues: {
      occurred_at: today(),
      channel: undefined,
      note: '',
      project_id: NO_PROJECT,
    },
  })

  useEffect(() => {
    if (open) {
      setSubmitError(null)
      form.reset({
        occurred_at: interaction?.occurred_at ?? today(),
        channel: (interaction?.channel as Channel) ?? undefined,
        note: interaction?.note ?? '',
        project_id: interaction?.project_id ?? NO_PROJECT,
      })
      supabase
        .from('projects')
        .select('*')
        .then(({ data }) => setProjects(data ?? []))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, interaction])

  async function onSubmit(values: InteractionFormValues) {
    setSubmitError(null)
    setIsSubmitting(true)

    try {
      const payload = {
        occurred_at: values.occurred_at,
        channel: values.channel,
        note: values.note || null,
        project_id: values.project_id && values.project_id !== NO_PROJECT ? values.project_id : null,
      }

      const { data: userData } = await supabase.auth.getUser()
      if (!userData.user) {
        setSubmitError('Nicht eingeloggt.')
        return
      }

      const { error, status } = interaction
        ? await supabase.from('interactions').update(payload).eq('id', interaction.id)
        : await supabase
            .from('interactions')
            .insert({ ...payload, contact_id: contactId, user_id: userData.user.id })

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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {interaction ? 'Kontaktmoment bearbeiten' : 'Kontaktmoment hinzufügen'}
          </DialogTitle>
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
              name="occurred_at"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Datum</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="channel"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Kanal</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Kanal wählen" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {Object.entries(CHANNEL_LABELS).map(([value, label]) => (
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
              name="project_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Projekt</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Kein Projekt" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={NO_PROJECT}>Kein Projekt</SelectItem>
                      {projects.map((project) => (
                        <SelectItem key={project.id} value={project.id}>
                          {project.title}
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
              name="note"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notiz</FormLabel>
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
