'use client'

import { CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { TrendBucket } from '@/lib/analytics'

const chartConfig: ChartConfig = {
  count: {
    label: 'Kontaktmomente',
    color: 'var(--chart-1)',
  },
}

interface InteractionsTrendChartProps {
  data: TrendBucket[]
}

export function InteractionsTrendChart({ data }: InteractionsTrendChartProps) {
  return (
    <Card className="rounded-xl">
      <CardHeader>
        <CardTitle className="text-base">Kontaktmomente über Zeit</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="text-sm text-muted-foreground">Keine Kontaktmomente im gewählten Zeitraum.</p>
        ) : (
          <ChartContainer config={chartConfig} className="aspect-auto h-[200px] w-full">
            <LineChart data={data} margin={{ left: 8, right: 8 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={24} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Line dataKey="count" type="monotone" stroke="var(--color-count)" strokeWidth={2} dot />
            </LineChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}
