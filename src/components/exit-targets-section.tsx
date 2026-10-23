'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Contact, STRENGTH_LABELS, getCompanyName, type Strength } from '@/lib/contacts'
import {
  ExitTarget,
  computeCoverage,
  isDuplicateTarget,
  sortTargetsByCoverage,
} from '@/lib/exit-targets'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Target, Trash2 } from 'lucide-react'

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('de-DE')
}

export function ExitTargetsSection() {
  const router = useRouter()
  const [targets, setTargets] = useState<ExitTarget[]>([])
  const [contacts, setContacts] = useState<Contact[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [input, setInput] = useState('')
  const [suggestionsOpen, setSuggestionsOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deletingTarget, setDeletingTarget] = useState<ExitTarget | null>(null)

  useEffect(() => {
    void Promise.all([
      supabase.from('exit_targets').select('*'),
      supabase
        .from('contacts')
        .select('id, first_name, last_name, employer, employer_normalized, strength, last_contacted_at'),
    ]).then(([targetsRes, contactsRes]) => {
      setTargets((targetsRes.data as ExitTarget[]) ?? [])
      setContacts((contactsRes.data as Contact[]) ?? [])
      setIsLoading(false)
    })
  }, [])

  const coverageById = useMemo(() => {
    const map = new Map(targets.map((t) => [t.id, computeCoverage(t, contacts)]))
    return map
  }, [targets, contacts])

  const sortedTargets = useMemo(
    () => sortTargetsByCoverage(targets, coverageById),
    [targets, coverageById]
  )

  // Vorschläge: bekannte Firmen aus dem Netzwerk, ohne bereits erfasste Ziele
  const suggestions = useMemo(() => {
    const counts = new Map<string, number>()
    for (const contact of contacts) {
      const name = getCompanyName(contact)
      if (!name) continue
      counts.set(name, (counts.get(name) ?? 0) + 1)
    }
    const term = input.trim().toLowerCase()
    return [...counts.entries()]
      .filter(([name]) => !isDuplicateTarget(name, targets))
      .filter(([name]) => !term || name.toLowerCase().includes(term))
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
      .slice(0, 8)
  }, [contacts, targets, input])

  async function addTarget(rawName: string) {
    const name = rawName.trim()
    setError(null)
    if (!name) return
    if (name.length > 100) {
      setError('Firmenname darf max. 100 Zeichen lang sein.')
      return
    }
    if (isDuplicateTarget(name, targets)) {
      setError(`„${name}" ist bereits als Zielfirma erfasst.`)
      return
    }

    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) {
      setError('Nicht eingeloggt.')
      return
    }

    const { data, error: insertError } = await supabase
      .from('exit_targets')
      .insert({ user_id: userData.user.id, company_name: name })
      .select()
      .single()

    if (insertError || !data) {
      setError('Speichern fehlgeschlagen. Bitte erneut versuchen.')
      return
    }

    setTargets((prev) => [...prev, data as ExitTarget])
    setInput('')
    setSuggestionsOpen(false)
  }

  async function confirmDelete() {
    if (!deletingTarget) return
    setError(null)
    const { error: deleteError } = await supabase
      .from('exit_targets')
      .delete()
      .eq('id', deletingTarget.id)
    if (deleteError) {
      setError('Löschen fehlgeschlagen. Bitte erneut versuchen.')
    } else {
      setTargets((prev) => prev.filter((t) => t.id !== deletingTarget.id))
    }
    setDeletingTarget(null)
  }

  function openDrilldown(target: ExitTarget) {
    const coverage = coverageById.get(target.id)
    if (!coverage || coverage.contactCount === 0) return
    router.push(`/contacts?firma=${encodeURIComponent(target.company_name)}`)
  }

  if (isLoading) return null

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1.5">
        <Target className="size-4 text-primary" />
        <h2 className="text-sm font-semibold">Exit-Ziele</h2>
      </div>

      <Popover open={suggestionsOpen} onOpenChange={setSuggestionsOpen}>
        <Command shouldFilter={false} className="overflow-visible rounded-md border">
          <PopoverAnchor asChild>
            <div>
              <CommandInput
                placeholder="Zielfirma hinzufügen (Enter bestätigt)..."
                value={input}
                onValueChange={(value) => {
                  setInput(value)
                  setSuggestionsOpen(value.trim().length > 0)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && input.trim()) {
                    e.preventDefault()
                    void addTarget(input)
                  }
                }}
              />
            </div>
          </PopoverAnchor>
          <PopoverContent
            className="w-[--radix-popover-trigger-width] min-w-[280px] p-0"
            align="start"
            onOpenAutoFocus={(e) => e.preventDefault()}
          >
            <CommandList>
              <CommandEmpty>
                Keine bekannte Firma — Enter legt „{input.trim()}“ als Ziel an
              </CommandEmpty>
              <CommandGroup heading="Aus deinem Netzwerk">
                {suggestions.map((s) => (
                  <CommandItem key={s.name} value={s.name} onSelect={() => void addTarget(s.name)}>
                    <span className="truncate">{s.name}</span>
                    <span className="ml-auto pl-2 text-xs text-muted-foreground">
                      {s.count} {s.count === 1 ? 'Kontakt' : 'Kontakte'}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </PopoverContent>
        </Command>
      </Popover>

      {error && (
        <Alert variant="destructive" className="py-2">
          <AlertDescription className="text-xs">{error}</AlertDescription>
        </Alert>
      )}

      {sortedTargets.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Zielfirmen für deinen Exit erfassen — du siehst pro Firma, wie gut dein Netzwerk dort
          schon trägt.
        </p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {sortedTargets.map((target) => {
            const coverage = coverageById.get(target.id)!
            const hasContacts = coverage.contactCount > 0
            return (
              <Card
                key={target.id}
                onClick={() => openDrilldown(target)}
                className={
                  hasContacts
                    ? 'cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-md'
                    : undefined
                }
              >
                <CardContent className="space-y-2 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="min-w-0 truncate text-sm font-medium" title={target.company_name}>
                      {target.company_name}
                    </p>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 shrink-0"
                      aria-label={`Zielfirma ${target.company_name} löschen`}
                      onClick={(e) => {
                        e.stopPropagation()
                        setDeletingTarget(target)
                      }}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>

                  {hasContacts ? (
                    <>
                      <div className="flex flex-wrap items-center gap-1">
                        <Badge variant="secondary">
                          {coverage.contactCount}{' '}
                          {coverage.contactCount === 1 ? 'Kontakt' : 'Kontakte'}
                        </Badge>
                        {([1, 2, 3] as Strength[]).map((s) =>
                          coverage.strengthCounts[s] > 0 ? (
                            <Badge key={s} variant="outline">
                              {coverage.strengthCounts[s]}× {STRENGTH_LABELS[s]}
                            </Badge>
                          ) : null
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {coverage.lastTouchpoint
                          ? `Letzter Touchpoint: ${formatDate(coverage.lastTouchpoint)}`
                          : 'Noch keine Interaktionen'}
                      </p>
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Keine Kontakte — Netzwerk aufbauen
                    </p>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <AlertDialog
        open={!!deletingTarget}
        onOpenChange={(open) => !open && setDeletingTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Zielfirma löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              {deletingTarget?.company_name} wird aus deinen Exit-Zielen entfernt.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Löschen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
