export type ChatRole = 'user' | 'assistant'
export type PendingActionStatus = 'pending' | 'confirmed' | 'declined' | 'expired'

export interface ChatMessage {
  id: string
  role: ChatRole
  content: string
  created_at: string
}

export interface PendingAction {
  id: string
  chat_message_id: string
  action_type: string
  summary: string
  status: PendingActionStatus
  created_at: string
}

export interface Conversation {
  id: string
  title: string
  updated_at: string
}

export const CHAT_HISTORY_LIMIT = 50
export const CONVERSATIONS_LIMIT = 50
export const CONVERSATION_TITLE_MAX_LENGTH = 40

export const CHAT_EXAMPLE_PROMPTS = [
  'Wer hat diese Woche Geburtstag?',
  'Wann hatte ich zuletzt Kontakt mit Tom?',
  'Hab grad mit Anna telefoniert, log das.',
]
