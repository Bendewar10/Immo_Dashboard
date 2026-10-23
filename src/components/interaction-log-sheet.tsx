'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { CHANNEL_LABELS, Interaction } from '@/lib/interactions'
import { Contact, getFullName } from '@/lib/contacts'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Pencil, Trash2 } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { ScrollArea } from '@/components/ui/scroll-area'
import { InteractionFormDialog } from '@/components/interaction-form-dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('de-DE')
}

interface InteractionLogSheetProps {
  contact: Contact | null
  onOpenChange: (open: boolean) => void
}

export function InteractionLogSheet({ contact, onOpenChange }: InteractionLogSheetProps) {
  const [interactions, setInteractions] = useState<Interaction[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [editingInteraction, setEditingInteraction] = useState<Interaction | null>(null)
  const [deletingInteraction, setDeletingInteraction] = useState<Interaction | null>(null)

  function loadInteractions(contactId: string) {
    setIsLoading(true)
    return supabase
      .from('interactions')
      .select('*')
      .eq('contact_id', contactId)
      .order('occurred_at', { ascending: false })
      .then(({ data }) => {
        setInteractions(data ?? [])
        setIsLoading(false)
      })
  }

  useEffect(() => {
    if (contact) {
      void Promise.resolve().then(() => loadInteractions(contact.id))
    }
  }, [contact])

  function openCreate() {
    setEditingInteraction(null)
    setFormOpen(true)
  }

  function openEdit(interaction: Interaction) {
    setEditingInteraction(interaction)
    setFormOpen(true)
  }

  async function confirmDelete() {
    if (!deletingInteraction || !contact) return
    await supabase.from('interactions').delete().eq('id', deletingInteraction.id)
    setDeletingInteraction(null)
    loadInteractions(contact.id)
  }

  return (
    <>
      <Sheet open={!!contact} onOpenChange={onOpenChange}>
        <SheetContent className="flex flex-col gap-4">
          <SheetHeader>
            <SheetTitle>Verlauf: {contact ? getFullName(contact) : ''}</SheetTitle>
          </SheetHeader>

          <Button onClick={openCreate} className="mx-4">
            Kontaktmoment hinzufügen
          </Button>

          <ScrollArea className="flex-1 px-4">
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Lädt...</p>
            ) : interactions.length === 0 ? (
              <p className="text-sm text-muted-foreground">Noch keine Kontaktmomente.</p>
            ) : (
              <div className="space-y-3">
                {interactions.map((interaction) => (
                  <div
                    key={interaction.id}
                    data-testid="interaction-entry"
                    className="rounded-md border p-3 text-sm"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{formatDate(interaction.occurred_at)}</span>
                        <Badge variant="secondary">{CHANNEL_LABELS[interaction.channel]}</Badge>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Bearbeiten"
                          onClick={() => openEdit(interaction)}
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Löschen"
                          onClick={() => setDeletingInteraction(interaction)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </div>
                    {interaction.note && (
                      <p className="mt-2 text-muted-foreground">{interaction.note}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </SheetContent>
      </Sheet>

      {contact && (
        <InteractionFormDialog
          open={formOpen}
          onOpenChange={setFormOpen}
          contactId={contact.id}
          interaction={editingInteraction}
          onSaved={() => loadInteractions(contact.id)}
        />
      )}

      <AlertDialog
        open={!!deletingInteraction}
        onOpenChange={(open) => !open && setDeletingInteraction(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Kontaktmoment löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Dieser Eintrag wird unwiderruflich gelöscht.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Löschen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
