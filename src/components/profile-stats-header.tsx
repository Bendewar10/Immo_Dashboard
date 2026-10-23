'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, CardContent } from '@/components/ui/card'

interface Stats {
  totalContacts: number | null
  dueFollowups: number | null
  totalParticipants: number | null
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

function StatTile({ label, value }: { label: string; value: number | null }) {
  return (
    <Card className="rounded-xl">
      <CardContent className="space-y-1 p-4 text-center">
        <p className="text-2xl font-semibold">{value === null ? '–' : value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  )
}

export function ProfileStatsHeader() {
  const [stats, setStats] = useState<Stats>({
    totalContacts: null,
    dueFollowups: null,
    totalParticipants: null,
  })

  useEffect(() => {
    async function load() {
      const [contactsResult, dueResult, participantsResult] = await Promise.all([
        supabase.from('contacts').select('id', { count: 'exact', head: true }),
        supabase
          .from('contacts')
          .select('id', { count: 'exact', head: true })
          .not('next_followup_at', 'is', null)
          .lte('next_followup_at', today()),
        supabase.from('project_participants').select('contact_id'),
      ])

      setStats({
        totalContacts: contactsResult.count ?? 0,
        dueFollowups: dueResult.count ?? 0,
        totalParticipants: participantsResult.data
          ? new Set(participantsResult.data.map((row) => row.contact_id)).size
          : 0,
      })
    }

    void load()
  }, [])

  return (
    <div className="grid grid-cols-3 gap-4">
      <StatTile label="Kontakte gesamt" value={stats.totalContacts} />
      <StatTile label="Fällige Follow-ups" value={stats.dueFollowups} />
      <StatTile label="Beteiligte gesamt über alle Cases" value={stats.totalParticipants} />
    </div>
  )
}
