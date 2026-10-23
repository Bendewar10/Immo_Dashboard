import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface OverdueCounterCardProps {
  count: number
}

export function OverdueCounterCard({ count }: OverdueCounterCardProps) {
  return (
    <Card className="rounded-xl">
      <CardHeader>
        <CardTitle className="text-base">Aktuell überfällig</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-4xl font-semibold" data-testid="overdue-count">
          {count}
        </p>
        <p className="text-sm text-muted-foreground">
          {count === 0 ? 'Alles im Blick.' : 'Kontakte mit fälligem Follow-up.'}
        </p>
      </CardContent>
    </Card>
  )
}
