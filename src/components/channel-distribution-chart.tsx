'use client'

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { DistributionEntry } from '@/lib/analytics'

const chartConfig: ChartConfig = {
  count: {
    label: 'Anzahl',
    color: 'var(--chart-2)',
  },
}

interface ChannelDistributionChartProps {
  data: DistributionEntry[]
}

export function ChannelDistributionChart({ data }: ChannelDistributionChartProps) {
  return (
    <Card className="rounded-xl">
      <CardHeader>
        <CardTitle className="text-base">Kontaktmomente nach Kanal</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="text-sm text-muted-foreground">Keine Kontaktmomente im gewählten Zeitraum.</p>
        ) : (
          <ChartContainer config={chartConfig} className="aspect-auto h-[200px] w-full">
            <BarChart data={data} margin={{ left: 8, right: 8 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={24} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="count" fill="var(--color-count)" radius={4} />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}
