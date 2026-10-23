'use client'

import Link from 'next/link'
import { Project, formatDateRange } from '@/lib/projects'
import { Contact } from '@/lib/contacts'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'

function getInitials(contact: Pick<Contact, 'first_name' | 'last_name'>) {
  const first = contact.first_name?.[0] ?? ''
  const last = contact.last_name?.[0] ?? ''
  return (first + last).toUpperCase() || '?'
}

export interface ProjectCardParticipant {
  id: string
  contact: Pick<Contact, 'id' | 'first_name' | 'last_name'>
}

interface ProjectCardProps {
  project: Project
  participants: ProjectCardParticipant[]
}

export function ProjectCard({ project, participants }: ProjectCardProps) {
  const visibleParticipants = participants.slice(0, 4)
  const overflowCount = participants.length - visibleParticipants.length
  const dateRange = formatDateRange(project.start_date, project.end_date)

  return (
    <Link href={`/profil/${project.id}`}>
      <Card className="cursor-pointer rounded-xl transition-all hover:-translate-y-0.5 hover:shadow-md">
        <CardHeader className="space-y-1 p-4">
          <h3 className="line-clamp-2 text-base font-semibold leading-tight">{project.title}</h3>
          {project.client || project.city ? (
            <p className="truncate text-sm text-muted-foreground">
              {[project.client, project.city].filter(Boolean).join(' · ')}
            </p>
          ) : null}
        </CardHeader>

        <CardContent className="space-y-3 p-4 pt-0 text-sm">
          {dateRange && <p className="text-muted-foreground">{dateRange}</p>}

          {participants.length > 0 && (
            <div className="flex items-center gap-1">
              {visibleParticipants.map((participant) => (
                <Avatar key={participant.id} className="h-7 w-7 border-2 border-background">
                  <AvatarFallback className="bg-primary/10 text-xs font-medium text-primary">
                    {getInitials(participant.contact)}
                  </AvatarFallback>
                </Avatar>
              ))}
              {overflowCount > 0 && (
                <Badge variant="secondary" className="ml-1">
                  +{overflowCount}
                </Badge>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  )
}
