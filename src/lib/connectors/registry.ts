export type ConnectorAvailability = 'available' | 'coming_soon'
export type TokenStatus = 'active' | 'expired'

export interface ConnectorDefinition {
  id: string
  name: string
  description: string
  scopes: string[]
  availability: ConnectorAvailability
}

export interface ConnectorTokenStatus {
  provider: string
  status: TokenStatus
  accountEmail: string
  connectedAt: string
}

export const CONNECTOR_REGISTRY: ConnectorDefinition[] = [
  {
    id: 'google',
    name: 'Google',
    description: 'Google Calendar & Gmail — Kalender-Events und E-Mails lesen',
    scopes: ['calendar.readonly', 'gmail.readonly'],
    availability: 'available',
  },
  {
    id: 'microsoft-365',
    name: 'Microsoft 365',
    description: 'Outlook-Kalender, E-Mails und Teams-Nachrichten (Office 365)',
    scopes: ['Calendars.Read', 'Mail.Read', 'Chat.Read'],
    availability: 'coming_soon',
  },
  {
    id: 'linkedin',
    name: 'LinkedIn',
    description: 'Berufsprofil anreichern und gemeinsame Verbindungen erkennen',
    scopes: ['r_liteprofile', 'r_network'],
    availability: 'coming_soon',
  },
  {
    id: 'whatsapp',
    name: 'WhatsApp',
    description: 'Kontakte schnell per Deep-Link anschreiben',
    scopes: ['deep_link'],
    availability: 'coming_soon',
  },
  {
    id: 'apple-calendar',
    name: 'Apple Kalender',
    description: 'iCloud-Kalender für iPhone-Nutzer synchronisieren (CalDAV)',
    scopes: ['caldav.readonly'],
    availability: 'coming_soon',
  },
]
