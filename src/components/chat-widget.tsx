'use client'

import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, type Variants } from 'framer-motion'
import { MessageSquare, PanelLeft, Plus, Send, Sparkles, Trash2, X } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
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
} from '@/components/ui/alert-dialog'
import { cn } from '@/lib/utils'
import { CHAT_EXAMPLE_PROMPTS, ChatMessage, Conversation, PendingAction } from '@/lib/chat'

const MOBILE_BREAKPOINT_PX = 640

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
}

const containerVariants: Variants = {
  hidden: { opacity: 0, y: 20, scale: 0.95, transformOrigin: 'bottom right' },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: 'spring', damping: 25, stiffness: 300, staggerChildren: 0.05 },
  },
  exit: { opacity: 0, y: 20, scale: 0.95, transition: { duration: 0.2 } },
}

const messageVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 500, damping: 30 } },
}

function AssistantAvatar({ className }: { className?: string }) {
  return (
    <Avatar className={cn('border border-border/40 shadow-sm', className)}>
      <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/5 text-primary">
        <Sparkles className="size-4" />
      </AvatarFallback>
    </Avatar>
  )
}

export function ChatWidget() {
  const [open, setOpen] = useState(false)
  const [hasLoadedHistory, setHasLoadedHistory] = useState(false)
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null)
  const [input, setInput] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [isConfirming, setIsConfirming] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const [lastFailedContent, setLastFailedContent] = useState<string | null>(null)
  const [isDeletingConversation, setIsDeletingConversation] = useState(false)
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const [deletingMessageId, setDeletingMessageId] = useState<string | null>(null)
  const scrollAnchorRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open && window.innerWidth >= MOBILE_BREAKPOINT_PX) {
      setSidebarOpen(true)
    }
  }, [open])

  useEffect(() => {
    if (!open || hasLoadedHistory) return
    setIsLoadingHistory(true)
    Promise.all([
      fetch('/api/chat/conversations').then((res) => res.json()),
      fetch('/api/chat/messages').then((res) => res.json()),
    ])
      .then(([conversationsData, messagesData]) => {
        setConversations(conversationsData.conversations ?? [])
        setActiveConversationId(messagesData.conversationId ?? null)
        // Guard against a fast send completing before this fetch resolves: only
        // apply the fetched history if nothing has been added locally since.
        setMessages((prev) => (prev.length > 0 ? prev : messagesData.messages ?? []))
        setPendingAction(messagesData.pendingAction ?? null)
        setHasLoadedHistory(true)
      })
      .catch(() => setSendError('Verlauf konnte nicht geladen werden.'))
      .finally(() => setIsLoadingHistory(false))
  }, [open, hasLoadedHistory])

  useEffect(() => {
    scrollAnchorRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, pendingAction, isSending])

  function closeSidebarOnMobile() {
    if (typeof window !== 'undefined' && window.innerWidth < MOBILE_BREAKPOINT_PX) {
      setSidebarOpen(false)
    }
  }

  async function selectConversation(id: string) {
    if (id === activeConversationId) {
      closeSidebarOnMobile()
      return
    }
    setIsLoadingHistory(true)
    setSendError(null)
    try {
      const res = await fetch(`/api/chat/messages?conversationId=${id}`)
      if (!res.ok) throw new Error('request failed')
      const data = await res.json()
      setActiveConversationId(data.conversationId ?? null)
      setMessages(data.messages ?? [])
      setPendingAction(data.pendingAction ?? null)
    } catch {
      setSendError('Konversation konnte nicht geladen werden.')
    } finally {
      setIsLoadingHistory(false)
      closeSidebarOnMobile()
    }
  }

  function startNewChat() {
    setActiveConversationId(null)
    setMessages([])
    setPendingAction(null)
    setSendError(null)
    closeSidebarOnMobile()
  }

  function refreshConversations() {
    fetch('/api/chat/conversations')
      .then((res) => res.json())
      .then((data) => setConversations(data.conversations ?? []))
      .catch(() => {})
  }

  async function sendMessage(content: string) {
    const trimmed = content.trim()
    if (!trimmed || isSending) return

    const optimisticMessage: ChatMessage = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content: trimmed,
      created_at: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, optimisticMessage])
    setInput('')
    setSendError(null)
    setIsSending(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: trimmed, conversationId: activeConversationId ?? undefined }),
      })
      if (!res.ok) throw new Error('request failed')
      const data = await res.json()
      setMessages((prev) => [...prev, data.message])
      setPendingAction(data.pendingAction ?? null)
      setActiveConversationId(data.conversationId ?? null)
      setLastFailedContent(null)
      refreshConversations()
    } catch {
      setSendError('Antwort konnte nicht geladen werden.')
      setLastFailedContent(trimmed)
    } finally {
      setIsSending(false)
    }
  }

  async function respondToPendingAction(decision: 'confirm' | 'decline') {
    if (!pendingAction) return
    setIsConfirming(true)
    setSendError(null)
    try {
      const res = await fetch('/api/chat/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pendingActionId: pendingAction.id, decision }),
      })
      if (!res.ok) throw new Error('request failed')
      const data = await res.json()
      setMessages((prev) => [...prev, data.message])
      setPendingAction(null)
    } catch {
      setSendError(
        decision === 'confirm'
          ? 'Aktion konnte nicht bestätigt werden.'
          : 'Ablehnung konnte nicht übermittelt werden.'
      )
    } finally {
      setIsConfirming(false)
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    void sendMessage(input)
  }

  async function deleteMessage(messageId: string) {
    setDeletingMessageId(messageId)
    try {
      const res = await fetch(`/api/chat/messages/${messageId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('request failed')
      setMessages((prev) => prev.filter((m) => m.id !== messageId))
    } catch {
      setSendError('Nachricht konnte nicht gelöscht werden.')
    } finally {
      setDeletingMessageId(null)
    }
  }

  async function deleteActiveConversation() {
    if (!activeConversationId) return
    setIsDeletingConversation(true)
    setSendError(null)
    try {
      const res = await fetch(`/api/chat/conversations/${activeConversationId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('request failed')
      const remaining = conversations.filter((c) => c.id !== activeConversationId)
      setConversations(remaining)
      if (remaining.length > 0) {
        await selectConversation(remaining[0].id)
      } else {
        startNewChat()
      }
    } catch {
      setSendError('Konversation konnte nicht gelöscht werden.')
    } finally {
      setIsDeletingConversation(false)
      setShowClearConfirm(false)
    }
  }

  const isEmpty = hasLoadedHistory && messages.length === 0 && !pendingAction

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-4">
      <AnimatePresence>
        {open && (
          <motion.div
            key="chat-window"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className={cn(
              'relative flex h-[488px] overflow-hidden rounded-2xl border border-border/40 bg-background/60 shadow-2xl backdrop-blur-xl ring-1 ring-white/10 transition-[width] duration-200',
              sidebarOpen ? 'w-[380px] sm:w-[640px]' : 'w-[380px]'
            )}
          >
            {sidebarOpen && (
              <div
                className={cn(
                  'flex flex-col border-r border-border/40 bg-background/70 backdrop-blur-xl',
                  'absolute inset-y-0 left-0 z-20 w-full sm:static sm:z-auto sm:w-[220px]'
                )}
              >
                <div className="flex items-center justify-between border-b border-border/40 p-3">
                  <span className="text-sm font-semibold">Chats</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Neuer Chat"
                    className="h-7 w-7 rounded-full"
                    onClick={startNewChat}
                  >
                    <Plus className="size-4" />
                  </Button>
                </div>
                <div className="flex-1 overflow-y-auto p-2">
                  {conversations.length === 0 ? (
                    <p className="p-2 text-xs text-muted-foreground">Noch keine Chats.</p>
                  ) : (
                    <div className="flex flex-col gap-1">
                      {conversations.map((conversation) => (
                        <button
                          key={conversation.id}
                          data-testid="conversation-item"
                          onClick={() => selectConversation(conversation.id)}
                          className={cn(
                            'truncate rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-muted/60',
                            conversation.id === activeConversationId ? 'bg-primary/10 font-medium text-primary' : ''
                          )}
                        >
                          {conversation.title || 'Neuer Chat'}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="flex flex-1 flex-col">
              <div className="relative overflow-hidden border-b border-border/40 bg-muted/30 p-4">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-primary/5 opacity-50" />
                <div className="relative z-10 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={sidebarOpen ? 'Chat-Liste ausblenden' : 'Chat-Liste einblenden'}
                      className="h-8 w-8 rounded-full hover:bg-background/50"
                      onClick={() => setSidebarOpen((prev) => !prev)}
                    >
                      <PanelLeft className="size-4" />
                    </Button>
                    <AssistantAvatar className="h-10 w-10" />
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">Assistent</h3>
                      <span className="text-xs text-muted-foreground">Online</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {!isEmpty && activeConversationId && (
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Verlauf löschen"
                        className="h-8 w-8 rounded-full hover:bg-background/50"
                        onClick={() => setShowClearConfirm(true)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Chat schließen"
                      className="h-8 w-8 rounded-full hover:bg-background/50"
                      onClick={() => setOpen(false)}
                    >
                      <X className="size-4" />
                    </Button>
                  </div>
                </div>
              </div>

              <div className="flex flex-1 flex-col gap-3 overflow-y-auto bg-gradient-to-b from-background/20 to-background/40 p-4">
                {isLoadingHistory ? (
                  <p className="text-sm text-muted-foreground">Lädt...</p>
                ) : isEmpty ? (
                  <div className="space-y-4">
                    <div className="flex gap-3">
                      <AssistantAvatar className="h-8 w-8" />
                      <div className="max-w-[85%] rounded-2xl rounded-tl-none border border-border/20 bg-muted/50 px-4 py-2.5 text-sm shadow-sm backdrop-blur-sm">
                        Frag mich was zu deinen Kontakten, oder bitte mich, etwas für dich zu erledigen.
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      {CHAT_EXAMPLE_PROMPTS.map((prompt) => (
                        <Button
                          key={prompt}
                          variant="outline"
                          className="h-auto justify-start rounded-xl text-left text-sm"
                          onClick={() => setInput(prompt)}
                        >
                          {prompt}
                        </Button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <>
                    {messages.map((message) => (
                      <motion.div
                        key={message.id}
                        data-testid="chat-message"
                        variants={messageVariants}
                        initial="hidden"
                        animate="visible"
                        className={cn(
                          'group flex gap-3',
                          message.role === 'user' ? 'flex-row-reverse self-end' : ''
                        )}
                      >
                        {message.role === 'assistant' && <AssistantAvatar className="h-8 w-8" />}
                        <div
                          className={cn(
                            'flex max-w-[85%] flex-col gap-1',
                            message.role === 'user' ? 'items-end' : ''
                          )}
                        >
                          <div
                            className={cn(
                              'rounded-2xl px-4 py-2.5 text-sm shadow-sm',
                              message.role === 'user'
                                ? 'rounded-tr-none bg-primary text-primary-foreground'
                                : 'rounded-tl-none border border-border/20 bg-muted/50 backdrop-blur-sm'
                            )}
                          >
                            <p className="whitespace-pre-wrap">{message.content}</p>
                          </div>
                          <div
                            className={cn(
                              'flex items-center gap-1 px-1',
                              message.role === 'user' ? 'flex-row-reverse' : ''
                            )}
                          >
                            <span className="text-[10px] text-muted-foreground">
                              {formatTime(message.created_at)}
                            </span>
                            {!message.id.startsWith('temp-') && (
                              <button
                                aria-label="Nachricht löschen"
                                disabled={deletingMessageId === message.id}
                                onClick={() => deleteMessage(message.id)}
                                className="opacity-0 transition-opacity group-hover:opacity-100 disabled:cursor-not-allowed"
                              >
                                <Trash2 className="size-3 text-muted-foreground hover:text-destructive" />
                              </button>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    ))}

                    {pendingAction && pendingAction.status === 'pending' && (
                      <div
                        data-testid="pending-action-card"
                        className="rounded-2xl border border-amber-300/60 bg-amber-50/80 p-3 text-sm shadow-sm backdrop-blur-sm dark:border-amber-800/60 dark:bg-amber-950/60"
                      >
                        <p className="font-medium">Bestätigung nötig</p>
                        <p className="mt-1 text-muted-foreground">{pendingAction.summary}</p>
                        <div className="mt-3 flex gap-2">
                          <Button
                            size="sm"
                            className="rounded-full"
                            disabled={isConfirming}
                            onClick={() => respondToPendingAction('confirm')}
                          >
                            Bestätigen
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="rounded-full"
                            disabled={isConfirming}
                            onClick={() => respondToPendingAction('decline')}
                          >
                            Abbrechen
                          </Button>
                        </div>
                      </div>
                    )}

                    {isSending && (
                      <div className="flex gap-3">
                        <AssistantAvatar className="h-8 w-8" />
                        <div className="flex h-10 w-16 items-center justify-center gap-1 rounded-2xl rounded-tl-none border border-border/20 bg-muted/50 px-4 py-3 shadow-sm backdrop-blur-sm">
                          <span className="size-1.5 animate-bounce rounded-full bg-foreground/40 [animation-delay:-0.3s]" />
                          <span className="size-1.5 animate-bounce rounded-full bg-foreground/40 [animation-delay:-0.15s]" />
                          <span className="size-1.5 animate-bounce rounded-full bg-foreground/40" />
                        </div>
                      </div>
                    )}
                  </>
                )}

                {sendError && (
                  <div className="flex items-center justify-between gap-2 rounded-xl border border-destructive/50 bg-destructive/10 p-2 text-sm text-destructive">
                    <span>{sendError}</span>
                    {lastFailedContent && (
                      <Button size="sm" variant="outline" onClick={() => sendMessage(lastFailedContent)}>
                        Erneut senden
                      </Button>
                    )}
                  </div>
                )}
                <div ref={scrollAnchorRef} />
              </div>

              <div className="border-t border-border/40 bg-background/60 p-3 backdrop-blur-md">
                <form className="relative flex items-center gap-2" onSubmit={handleSubmit}>
                  <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Nachricht an den Assistenten..."
                    aria-label="Chat-Nachricht"
                    className="flex-1 rounded-full border border-border/40 bg-background/50 px-4 py-2.5 text-sm outline-none transition-all placeholder:text-muted-foreground focus:border-primary/50 focus:bg-background focus:ring-2 focus:ring-primary/10"
                  />
                  <Button
                    type="submit"
                    size="icon"
                    disabled={isSending || !input.trim()}
                    className="h-10 w-10 rounded-full shadow-lg transition-transform hover:scale-105"
                  >
                    <Send className="size-4" />
                  </Button>
                </form>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setOpen((prev) => !prev)}
        aria-label={open ? 'Chat schließen' : 'Chat öffnen'}
        className={cn(
          'group relative flex h-14 w-14 items-center justify-center rounded-full shadow-2xl transition-all duration-300',
          open
            ? 'rotate-90 bg-destructive text-destructive-foreground'
            : 'bg-primary text-primary-foreground hover:shadow-primary/25'
        )}
      >
        <span className="absolute inset-0 -z-10 rounded-full bg-inherit opacity-20 blur-xl transition-opacity duration-300 group-hover:opacity-40" />
        {open ? <X className="size-6" /> : <MessageSquare className="size-6" />}
      </motion.button>

      <AlertDialog open={showClearConfirm} onOpenChange={setShowClearConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Verlauf löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Diese Konversation wird unwiderruflich gelöscht. Diese Aktion kann nicht rückgängig gemacht werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingConversation}>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={deleteActiveConversation} disabled={isDeletingConversation}>
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
