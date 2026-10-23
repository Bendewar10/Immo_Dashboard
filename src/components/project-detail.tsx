'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
  Project,
  ProjectParticipant,
  STATUS_LABELS,
  formatDateRange,
  getParticipantRoleLabel,
} from '@/lib/projects'
import { Contact, getFullName } from '@/lib/contacts'
import { CHANNEL_LABELS, Channel } from '@/lib/interactions'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Trash2 } from 'lucide-react'
import { CityTripSection } from '@/components/city-trip-section'
import { ProjectFormDialog } from '@/components/project-form-dialog'
import { ProjectParticipantDialog } from '@/components/project-participant-dialog'
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

interface ParticipantRow extends ProjectParticipant {
  contact: Pick<Contact, 'id' | 'first_name' | 'last_name'>
}

interface LogEntry {
  id: string
  occurred_at: string
  channel: Channel
  note: string | null
  contact: Pick<Contact, 'id' | 'first_name' | 'last_name'>
}

function getInitials(contact: Pick<Contact, 'first_name' | 'last_name'>) {
  const first = contact.first_name?.[0] ?? ''
  const last = contact.last_name?.[0] ?? ''
  return (first + last).toUpperCase() || '?'
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('de-DE')
}

interface ProjectDetailProps {
  projectId: string
}

export function ProjectDetail({ projectId }: ProjectDetailProps) {
  const router = useRouter()
  const [project, setProject] = useState<Project | null>(null)
  const [participants, setParticipants] = useState<ParticipantRow[]>([])
  const [log, setLog] = useState<LogEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [editOpen, setEditOpen] = useState(false)
  const [participantDialogOpen, setParticipantDialogOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [removingParticipant, setRemovingParticipant] = useState<ParticipantRow | null>(null)

  function loadProject() {
    return supabase.from('projects').select('*').eq('id', projectId).single().then(({ data }) => {
      setProject(data ?? null)
    })
  }

  function loadParticipants() {
    return supabase
      .from('project_participants')
      .select('*, contact:contacts(id, first_name, last_name)')
      .eq('project_id', projectId)
      .then(({ data }) => {
        setParticipants((data as ParticipantRow[]) ?? [])
      })
  }

  function loadLog() {
    return supabase
      .from('interactions')
      .select('id, occurred_at, channel, note, contact:contacts(id, first_name, last_name)')
      .eq('project_id', projectId)
      .order('occurred_at', { ascending: false })
      .then(({ data }) => {
        setLog((data as unknown as LogEntry[]) ?? [])
      })
  }

  useEffect(() => {
    setIsLoading(true)
    Promise.all([loadProject(), loadParticipants(), loadLog()]).then(() => setIsLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId])

  async function toggleStatus() {
    if (!project) return
    const nextStatus = project.status === 'active' ? 'done' : 'active'
    await supabase.from('projects').update({ status: nextStatus }).eq('id', project.id)
    loadProject()
  }

  async function confirmDelete() {
    if (!project) return
    await supabase.from('projects').delete().eq('id', project.id)
    router.push('/profil')
  }

  async function confirmRemoveParticipant() {
    if (!removingParticipant) return
    await supabase.from('project_participants').delete().eq('id', removingParticipant.id)
    setRemovingParticipant(null)
    loadParticipants()
  }

  if (isLoading) return <p className="text-sm text-muted-foreground">Lädt...</p>
  if (!project) return <p className="text-sm text-muted-foreground">Projekt nicht gefunden.</p>

  const dateRange = formatDateRange(project.start_date, project.end_date)
  const excludedContactIds = participants.map((p) => p.contact_id)

  return (
    <div className="w-full max-w-4xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold">{project.title}</h1>
            <Badge variant={project.status === 'active' ? 'default' : 'secondary'}>
              {STATUS_LABELS[project.status]}
            </Badge>
          </div>
          {project.client || project.city ? (
            <p className="text-sm text-muted-foreground">
              {[project.client, project.city].filter(Boolean).join(' · ')}
            </p>
          ) : null}
          {dateRange && <p className="text-sm text-muted-foreground">{dateRange}</p>}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={toggleStatus}>
            {project.status === 'active' ? 'Als beendet markieren' : 'Als aktiv markieren'}
          </Button>
          <Button variant="outline" onClick={() => setEditOpen(true)}>
            Bearbeiten
          </Button>
          <Button variant="outline" className="text-destructive" onClick={() => setDeleteOpen(true)}>
            Löschen
          </Button>
        </div>
      </div>

      {project.notes && <p className="whitespace-pre-wrap text-sm">{project.notes}</p>}

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Beteiligte</h2>
          <Button size="sm" onClick={() => setParticipantDialogOpen(true)}>
            Beteiligten hinzufügen
          </Button>
        </div>

        {participants.length === 0 ? (
          <p className="text-sm text-muted-foreground">Noch keine Beteiligten.</p>
        ) : (
          <div className="space-y-2">
            {participants.map((participant) => (
              <div
                key={participant.id}
                className="flex items-center justify-between gap-2 rounded-md border p-2"
              >
                <div className="flex items-center gap-2">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-primary/10 text-xs font-medium text-primary">
                      {getInitials(participant.contact)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium">{getFullName(participant.contact)}</span>
                  <Badge variant="secondary">{getParticipantRoleLabel(participant)}</Badge>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Beteiligten entfernen"
                  onClick={() => setRemovingParticipant(participant)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <CityTripSection project={project} />

      <div className="space-y-3">
        <h2 className="text-sm font-semibold">Projekt-Log</h2>
        {log.length === 0 ? (
          <p className="text-sm text-muted-foreground">Noch keine verknüpften Momente.</p>
        ) : (
          <div className="space-y-3">
            {log.map((entry) => (
              <div key={entry.id} className="rounded-md border p-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{formatDate(entry.occurred_at)}</span>
                  <Badge variant="secondary">{CHANNEL_LABELS[entry.channel]}</Badge>
                  <span className="text-muted-foreground">{getFullName(entry.contact)}</span>
                </div>
                {entry.note && <p className="mt-2 text-muted-foreground">{entry.note}</p>}
              </div>
            ))}
          </div>
        )}
      </div>

      <ProjectFormDialog open={editOpen} onOpenChange={setEditOpen} project={project} onSaved={loadProject} />

      <ProjectParticipantDialog
        open={participantDialogOpen}
        onOpenChange={setParticipantDialogOpen}
        projectId={project.id}
        excludedContactIds={excludedContactIds}
        onSaved={loadParticipants}
      />

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Projekt löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              {project.title} wird unwiderruflich gelöscht. Verknüpfte Interaktionen bleiben erhalten.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Löschen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!removingParticipant} onOpenChange={(open) => !open && setRemovingParticipant(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Beteiligten entfernen?</AlertDialogTitle>
            <AlertDialogDescription>
              Nur die Zuordnung wird entfernt. Der Kontakt und seine Interaktionen bleiben unverändert.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRemoveParticipant}>Entfernen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
