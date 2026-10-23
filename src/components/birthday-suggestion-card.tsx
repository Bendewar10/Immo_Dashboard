'use client'

import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Cake } from 'lucide-react'
import { BirthdaySuggestion, formatBirthdaySuggestionDate } from '@/lib/birthday-suggestions'
import { getFullName } from '@/lib/contacts'

interface BirthdaySuggestionCardProps {
  suggestion: BirthdaySuggestion
  onAccept: (suggestion: BirthdaySuggestion) => void
  isSaving: boolean
}

export function BirthdaySuggestionCard({ suggestion, onAccept, isSaving }: BirthdaySuggestionCardProps) {
  return (
    <Card className="rounded-xl">
      <CardHeader className="flex flex-row items-center gap-3 space-y-0 p-4">
        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-1 text-base font-semibold leading-tight">{getFullName(suggestion)}</h3>
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Cake className="size-3.5" />
            {formatBirthdaySuggestionDate(suggestion.month, suggestion.day)}
          </p>
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <Button size="sm" onClick={() => onAccept(suggestion)} disabled={isSaving} className="gap-1.5">
          {isSaving ? 'Speichere...' : 'Übernehmen'}
        </Button>
      </CardContent>
    </Card>
  )
}
