'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { MIN_INTERACTIONS_FOR_INSIGHTS, NetworkInsightsPayload } from '@/lib/analytics'

interface NetworkInsightsCardProps {
  payload: NetworkInsightsPayload
}

export function NetworkInsightsCard({ payload }: NetworkInsightsCardProps) {
  const [insightText, setInsightText] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canGenerate = payload.totalInteractions >= MIN_INTERACTIONS_FOR_INSIGHTS

  async function handleGenerate() {
    setIsGenerating(true)
    setError(null)
    try {
      const res = await fetch('/api/network-insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ period: payload.period }),
      })
      if (!res.ok) {
        setError('Insights konnten nicht generiert werden. Bitte erneut versuchen.')
        return
      }
      const data = await res.json()
      setInsightText(data.text)
    } catch {
      setError('Insights konnten nicht generiert werden. Bitte erneut versuchen.')
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <Card className="rounded-xl">
      <CardHeader>
        <CardTitle className="text-base">Insights</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {!canGenerate ? (
          <p className="text-muted-foreground">
            Noch nicht genug Daten für Insights — mindestens {MIN_INTERACTIONS_FOR_INSIGHTS} Kontaktmomente im
            gewählten Zeitraum nötig.
          </p>
        ) : (
          <Button size="sm" onClick={handleGenerate} disabled={isGenerating}>
            {isGenerating ? 'Generiere...' : 'Insights generieren'}
          </Button>
        )}

        {error && <p className="text-destructive">{error}</p>}
        {insightText && <p className="rounded-md border p-3 text-muted-foreground">{insightText}</p>}
      </CardContent>
    </Card>
  )
}
