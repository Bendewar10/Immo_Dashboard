import { Contact } from '@/lib/contacts'

export type ContactEventType = 'Jobwechsel' | 'Beförderung'

export interface ContactEvent {
  id: string
  contact_id: string
  type: ContactEventType
  detected_at: string
  dismissed_at: string | null
}

export interface ContactEventGroup {
  contact: Contact
  events: ContactEvent[]
  types: ContactEventType[]
}

export function groupOpenEvents(events: ContactEvent[], contacts: Contact[]): ContactEventGroup[] {
  const byContact = new Map<string, ContactEvent[]>()

  for (const event of events) {
    if (event.dismissed_at) continue
    const list = byContact.get(event.contact_id) ?? []
    list.push(event)
    byContact.set(event.contact_id, list)
  }

  const groups: ContactEventGroup[] = []
  for (const [contactId, contactEvents] of byContact) {
    const contact = contacts.find((c) => c.id === contactId)
    if (!contact) continue
    groups.push({
      contact,
      events: contactEvents,
      types: [...new Set(contactEvents.map((e) => e.type))],
    })
  }
  return groups
}
