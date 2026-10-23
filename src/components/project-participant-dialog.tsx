'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Contact, getFullName } from '@/lib/contacts'
import { ParticipantRole, ROLE_LABELS } from '@/lib/projects'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { cn } from '@/lib/utils'

interface ProjectParticipantDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
  excludedContactIds: string[]
  onSaved: () => void
}

export function ProjectParticipantDialog({
  open,
  onOpenChange,
  projectId,
  excludedContactIds,
  onSaved,
}: ProjectParticipantDialogProps) {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null)
  const [role, setRole] = useState<ParticipantRole | ''>('')
  const [roleOther, setRoleOther] = useState('')
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (open) {
      setSelectedContactId(null)
      setRole('')
      setRoleOther('')
      setSubmitError(null)
      supabase
        .from('contacts')
        .select('*')
        .then(({ data }) => setContacts(data ?? []))
    }
  }, [open])

  const availableContacts = contacts.filter((contact) => !excludedContactIds.includes(contact.id))

  async function handleSubmit() {
    if (!selectedContactId || !role) {
      setSubmitError('Bitte Kontakt und Rolle wählen.')
      return
    }

    setSubmitError(null)
    setIsSubmitting(true)

    try {
      const { data: userData } = await supabase.auth.getUser()
      if (!userData.user) {
        setSubmitError('Nicht eingeloggt.')
        return
      }

      const { error } = await supabase.from('project_participants').insert({
        project_id: projectId,
        contact_id: selectedContactId,
        user_id: userData.user.id,
        role,
        role_other: role === 'other' ? roleOther || null : null,
      })

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
          <DialogTitle>Beteiligten hinzufügen</DialogTitle>
        </DialogHeader>

        {submitError && (
          <Alert variant="destructive">
            <AlertDescription>{submitError}</AlertDescription>
          </Alert>
        )}

        <Command className="rounded-md border">
          <CommandInput placeholder="Kontakt suchen..." />
          <CommandList>
            <CommandEmpty>Kein Kontakt gefunden.</CommandEmpty>
            <CommandGroup>
              {availableContacts.map((contact) => (
                <CommandItem
                  key={contact.id}
                  value={getFullName(contact)}
                  onSelect={() => setSelectedContactId(contact.id)}
                  className={cn(selectedContactId === contact.id && 'bg-accent')}
                >
                  {getFullName(contact)}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>

        <Select value={role} onValueChange={(value) => setRole(value as ParticipantRole)}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Rolle wählen" />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(ROLE_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {role === 'other' && (
          <Input
            placeholder="Rolle angeben..."
            value={roleOther}
            onChange={(e) => setRoleOther(e.target.value)}
          />
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button type="button" disabled={isSubmitting} onClick={handleSubmit}>
            {isSubmitting ? 'Wird gespeichert...' : 'Hinzufügen'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
