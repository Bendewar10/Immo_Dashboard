'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { PageHeader } from '@/components/page-header'
import { ConnectorCard } from '@/components/connector-card'
import { Skeleton } from '@/components/ui/skeleton'
import { CONNECTOR_REGISTRY } from '@/lib/connectors/registry'
import type { ConnectorTokenStatus } from '@/lib/connectors/registry'

function SearchParamsHandler() {
  const searchParams = useSearchParams()

  useEffect(() => {
    const connected = searchParams.get('connected')
    const error = searchParams.get('error')

    if (connected) {
      const name = connected.charAt(0).toUpperCase() + connected.slice(1)
      toast.success(`${name} erfolgreich verbunden`)
      window.history.replaceState({}, '', '/einstellungen/konnektoren')
    }
    if (error === 'csrf') {
      toast.error('Sicherheitsfehler — bitte erneut versuchen')
      window.history.replaceState({}, '', '/einstellungen/konnektoren')
    }
    if (error === 'cancelled') {
      toast.info('Verbindung abgebrochen')
      window.history.replaceState({}, '', '/einstellungen/konnektoren')
    }
    if (error === 'token_exchange') {
      toast.error('Verbindung fehlgeschlagen — bitte erneut versuchen')
      window.history.replaceState({}, '', '/einstellungen/konnektoren')
    }
  }, [searchParams])

  return null
}

export default function KonnektorenPage() {
  const [tokenStatuses, setTokenStatuses] = useState<ConnectorTokenStatus[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetch('/api/connectors/status')
      .then((res) => (res.ok ? res.json() : []))
      .then((data: ConnectorTokenStatus[]) => setTokenStatuses(data ?? []))
      .catch(() => setTokenStatuses([]))
      .finally(() => setIsLoading(false))
  }, [])

  function handleDisconnected(provider: string) {
    setTokenStatuses((prev) => prev.filter((s) => s.provider !== provider))
  }

  return (
    <div className="w-full max-w-5xl space-y-6">
      <Suspense>
        <SearchParamsHandler />
      </Suspense>

      <PageHeader
        title="Konnektoren"
        description="Verbinde externe Dienste, um mehr aus Bambi herauszuholen."
      />

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-44 rounded-xl" />
          <Skeleton className="h-44 rounded-xl" />
          <Skeleton className="h-44 rounded-xl" />
          <Skeleton className="h-44 rounded-xl" />
          <Skeleton className="h-44 rounded-xl" />
          <Skeleton className="h-44 rounded-xl" />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CONNECTOR_REGISTRY.map((connector) => {
            const status = tokenStatuses.find((s) => s.provider === connector.id) ?? null
            return (
              <ConnectorCard
                key={connector.id}
                connector={connector}
                tokenStatus={status}
                onDisconnected={handleDisconnected}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}
