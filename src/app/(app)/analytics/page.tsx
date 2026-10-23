'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Contact } from '@/lib/contacts'
import { Interaction } from '@/lib/interactions'
import {
  ANALYTICS_PERIODS,
  AnalyticsPeriod,
  computeCategoryDistribution,
  computeChannelDistribution,
  computeInteractionsTrend,
  computeOverdueCount,
  computeStrengthDistribution,
  MeetingFrequencyResponse,
  NetworkInsightsPayload,
  periodStartDate,
} from '@/lib/analytics'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DistributionChartCard } from '@/components/distribution-chart-card'
import { OverdueCounterCard } from '@/components/overdue-counter-card'
import { InteractionsTrendChart } from '@/components/interactions-trend-chart'
import { ChannelDistributionChart } from '@/components/channel-distribution-chart'
import { MeetingFrequencyCard } from '@/components/meeting-frequency-card'
import { NetworkInsightsCard } from '@/components/network-insights-card'
import { PageHeader } from '@/components/page-header'

export default function AnalyticsPage() {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [interactions, setInteractions] = useState<Interaction[]>([])
  const [period, setPeriod] = useState<AnalyticsPeriod>(90)
  const [isLoading, setIsLoading] = useState(true)
  const [meetingFrequency, setMeetingFrequency] = useState<MeetingFrequencyResponse | null>(null)

  useEffect(() => {
    supabase
      .from('contacts')
      .select('*')
      .then(({ data }) => {
        setContacts(data ?? [])
        setIsLoading(false)
      })
  }, [])

  useEffect(() => {
    supabase
      .from('interactions')
      .select('*')
      .gte('occurred_at', periodStartDate(period).toISOString().slice(0, 10))
      .then(({ data }) => setInteractions(data ?? []))
  }, [period])

  useEffect(() => {
    fetch(`/api/analytics/meeting-frequency?period=${period}`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data: MeetingFrequencyResponse) => setMeetingFrequency(data))
      .catch(() => setMeetingFrequency({ googleConnected: false, entries: [] }))
  }, [period])

  const categoryDistribution = useMemo(() => computeCategoryDistribution(contacts), [contacts])
  const strengthDistribution = useMemo(() => computeStrengthDistribution(contacts), [contacts])
  const overdueCount = useMemo(() => computeOverdueCount(contacts), [contacts])
  const channelDistribution = useMemo(() => computeChannelDistribution(interactions), [interactions])
  const interactionsTrend = useMemo(
    () => computeInteractionsTrend(interactions, period),
    [interactions, period]
  )

  const insightsPayload: NetworkInsightsPayload = {
    period,
    totalContacts: contacts.length,
    totalInteractions: interactions.length,
    overdueCount,
    categoryDistribution,
    strengthDistribution,
    channelDistribution,
  }

  const periodTabs = (
    <Tabs value={String(period)} onValueChange={(value) => setPeriod(Number(value) as AnalyticsPeriod)}>
      <TabsList>
        {ANALYTICS_PERIODS.map((option) => (
          <TabsTrigger key={option.value} value={String(option.value)}>
            {option.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  )

  if (contacts.length === 0 && !isLoading) {
    return (
      <div className="w-full max-w-5xl space-y-6">
        <PageHeader title="Analytics" action={periodTabs} />
        <p className="text-sm text-muted-foreground">
          Noch keine Kontakte vorhanden — sobald du Kontakte und Kontaktmomente erfasst hast, siehst du hier
          Auswertungen zu deinem Netzwerk.
        </p>
      </div>
    )
  }

  return (
    <div className="w-full max-w-5xl space-y-6">
      <PageHeader title="Analytics" action={periodTabs} />

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <DistributionChartCard title="Kategorien" data={categoryDistribution} />
        <DistributionChartCard title="Beziehungsstärke" data={strengthDistribution} />
        <OverdueCounterCard count={overdueCount} />
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <InteractionsTrendChart data={interactionsTrend} />
        <ChannelDistributionChart data={channelDistribution} />
      </section>

      <MeetingFrequencyCard data={meetingFrequency} />

      <NetworkInsightsCard key={period} payload={insightsPayload} />
    </div>
  )
}
