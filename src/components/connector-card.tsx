'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import type { ConnectorDefinition, ConnectorTokenStatus } from '@/lib/connectors/registry'
import { ConnectorLogo } from '@/lib/connectors/logos'

interface ConnectorCardProps {
  connector: ConnectorDefinition
  tokenStatus: ConnectorTokenStatus | null
  onDisconnected: (provider: string) => void
}

export function ConnectorCard({ connector, tokenStatus, onDisconnected }: ConnectorCardProps) {
  const [isDisconnecting, setIsDisconnecting] = useState(false)

  async function handleDisconnect() {
    setIsDisconnecting(true)
    try {
      const res = await fetch('/api/connectors/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: connector.id }),
      })
      if (!res.ok) throw new Error()
      onDisconnected(connector.id)
      toast.success(`${connector.name}-Verbindung getrennt`)
    } catch {
      toast.error('Trennen fehlgeschlagen — bitte erneut versuchen')
    } finally {
      setIsDisconnecting(false)
    }
  }

  const isConnected = tokenStatus?.status === 'active'
  const isExpired = tokenStatus?.status === 'expired'
  const isComingSoon = connector.availability === 'coming_soon'

  return (
    <Card
      data-testid={`connector-card-${connector.id}`}
      className={isComingSoon ? 'opacity-60' : ''}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border/40 bg-white shadow-sm dark:bg-zinc-900">
              <ConnectorLogo id={connector.id} />
            </div>
            <div>
              <CardTitle className="text-base">{connector.name}</CardTitle>
              <CardDescription className="text-xs">{connector.description}</CardDescription>
            </div>
          </div>
          <div className="shrink-0">
            {isComingSoon && <Badge variant="secondary">Coming Soon</Badge>}
            {isConnected && (
              <Badge className="bg-green-600 hover:bg-green-600 text-white">Verbunden</Badge>
            )}
            {isExpired && <Badge variant="destructive">Abgelaufen</Badge>}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {isConnected && tokenStatus && (
          <div className="rounded-md bg-muted px-3 py-2 text-xs">
            <p className="font-medium text-foreground">{tokenStatus.accountEmail}</p>
            <p className="text-muted-foreground">
              Verbunden seit{' '}
              {new Date(tokenStatus.connectedAt).toLocaleDateString('de-DE', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
              })}
            </p>
          </div>
        )}

        {isExpired && (
          <p className="text-xs text-destructive">
            Verbindung abgelaufen — bitte neu verbinden.
          </p>
        )}

        {isComingSoon ? (
          <Button size="sm" disabled className="w-full">
            Verbinden
          </Button>
        ) : isConnected ? (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="sm" variant="outline" className="w-full">
                Trennen
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{connector.name}-Verbindung trennen</AlertDialogTitle>
                <AlertDialogDescription>
                  Alle gespeicherten Tokens werden gelöscht. Du kannst dich jederzeit neu verbinden.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                <AlertDialogAction onClick={handleDisconnect} disabled={isDisconnecting}>
                  {isDisconnecting ? 'Trennen...' : 'Ja, trennen'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : (
          <Button
            size="sm"
            className="w-full"
            onClick={() => {
              window.location.href = `/api/connectors/${connector.id}`
            }}
          >
            Verbinden
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
