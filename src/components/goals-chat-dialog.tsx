'use client'

import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ScrollArea } from '@/components/ui/scroll-area'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface GoalsChatDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: (goalsText: string) => void
}

export function GoalsChatDialog({ open, onOpenChange, onSaved }: GoalsChatDialogProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [done, setDone] = useState(false)
  const [goalsSummary, setGoalsSummary] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open && messages.length === 0) {
      void sendMessages([])
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => {
    if (!open) {
      setMessages([])
      setInput('')
      setDone(false)
      setGoalsSummary(null)
      setError(null)
    }
  }, [open])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  async function sendMessages(msgs: Message[]) {
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/goals-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: msgs }),
      })
      if (!res.ok) throw new Error('fetch failed')
      const data = (await res.json()) as { done: boolean; message: string; goalsSummary?: string }
      setMessages((prev) => [...prev, { role: 'assistant', content: data.message }])
      if (data.done && data.goalsSummary) {
        setDone(true)
        setGoalsSummary(data.goalsSummary)
      }
    } catch {
      setError('Verbindung fehlgeschlagen. Bitte erneut versuchen.')
    } finally {
      setIsLoading(false)
    }
  }

  async function handleSend() {
    const text = input.trim()
    if (!text || isLoading || done) return
    const userMsg: Message = { role: 'user', content: text }
    const nextMessages = [...messages, userMsg]
    setMessages(nextMessages)
    setInput('')
    await sendMessages(nextMessages)
  }

  async function handleConfirm() {
    if (!goalsSummary) return
    setIsSaving(true)
    setError(null)
    try {
      const { data: userData } = await supabase.auth.getUser()
      if (!userData.user) throw new Error('not logged in')
      const { error: upsertError } = await supabase.from('user_profile').upsert(
        {
          user_id: userData.user.id,
          goals_text: goalsSummary,
          goals_updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      )
      if (upsertError) throw upsertError
      onSaved(goalsSummary)
      onOpenChange(false)
    } catch {
      setError('Speichern fehlgeschlagen. Bitte erneut versuchen.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[80vh] flex-col sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Karriereziele festlegen</DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-1">
          <div className="space-y-3 py-2">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                    msg.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-foreground'
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
                  …
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        </ScrollArea>

        {done && goalsSummary && (
          <div className="rounded-md border bg-muted/50 p-3 text-sm">
            <p className="mb-1 text-xs font-medium text-muted-foreground">Zusammenfassung deiner Ziele:</p>
            <p>{goalsSummary}</p>
          </div>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {!done ? (
          <div className="flex gap-2 pt-1">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void handleSend() } }}
              placeholder="Antwort eingeben…"
              disabled={isLoading}
              className="flex-1"
              aria-label="Antwort"
            />
            <Button onClick={handleSend} disabled={isLoading || !input.trim()}>
              Senden
            </Button>
          </div>
        ) : (
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
              Abbrechen
            </Button>
            <Button onClick={handleConfirm} disabled={isSaving}>
              {isSaving ? 'Speichern…' : 'Ziele speichern'}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}
