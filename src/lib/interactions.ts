export type Channel = 'meeting' | 'call' | 'message' | 'event'

export const CHANNEL_LABELS: Record<Channel, string> = {
  meeting: 'Treffen',
  call: 'Call',
  message: 'Nachricht',
  event: 'Event',
}

export interface Interaction {
  id: string
  contact_id: string
  project_id: string | null
  occurred_at: string
  channel: Channel
  note: string | null
  created_at: string
}
