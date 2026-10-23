import { tool } from 'ai'
import { z } from 'zod'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { CATEGORY_LABELS, EMPLOYER_NORMALIZATION_RESET, getFullName } from '@/lib/contacts'
import { CHANNEL_LABELS, Channel } from '@/lib/interactions'
import {
  computeCategoryDistribution,
  computeChannelDistribution,
  computeOverdueCount,
  computeStrengthDistribution,
  periodStartDate,
} from '@/lib/analytics'
import { nextBirthdayOccurrence } from '@/lib/occasions'

type SupabaseServer = Awaited<ReturnType<typeof createSupabaseServerClient>>

const EDITABLE_FIELDS = [
  'first_name',
  'last_name',
  'category',
  'strength',
  'employer',
  'job_title',
  'email',
  'linkedin_url',
  'context',
  'notes',
  'city',
  'phone',
  'birthday',
  'followup_interval_days',
] as const
type EditableField = (typeof EDITABLE_FIELDS)[number]

const FIELD_LABELS: Record<EditableField, string> = {
  first_name: 'Vorname',
  last_name: 'Nachname',
  category: 'Kategorie',
  strength: 'Beziehungsstärke',
  employer: 'Arbeitgeber',
  job_title: 'Jobtitel',
  email: 'E-Mail',
  linkedin_url: 'LinkedIn-URL',
  context: 'Kontext',
  notes: 'Notizen',
  city: 'Stadt',
  phone: 'Telefon',
  birthday: 'Geburtstag',
  followup_interval_days: 'Follow-up-Intervall (Tage)',
}

function parseFieldValue(field: EditableField, value: string): { ok: true; parsed: string | number } | { ok: false; error: string } {
  if (field === 'strength') {
    if (!['1', '2', '3'].includes(value)) {
      return { ok: false, error: 'Beziehungsstärke muss 1 (Kern), 2 (Mittel) oder 3 (Locker) sein.' }
    }
    return { ok: true, parsed: Number(value) }
  }
  if (field === 'category') {
    if (!(value in CATEGORY_LABELS)) {
      return { ok: false, error: `Kategorie muss eine von ${Object.keys(CATEGORY_LABELS).join(', ')} sein.` }
    }
    return { ok: true, parsed: value }
  }
  if (field === 'followup_interval_days') {
    const n = Number(value)
    if (!Number.isInteger(n) || n <= 0) {
      return { ok: false, error: 'Follow-up-Intervall muss eine positive Ganzzahl sein.' }
    }
    return { ok: true, parsed: n }
  }
  if (field === 'birthday') {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return { ok: false, error: 'Geburtstag muss im Format YYYY-MM-DD sein.' }
    }
    return { ok: true, parsed: value }
  }
  return { ok: true, parsed: value.trim().slice(0, 300) }
}

async function expirePendingActions(supabase: SupabaseServer, conversationId: string) {
  await supabase
    .from('pending_actions')
    .update({ status: 'expired' })
    .eq('conversation_id', conversationId)
    .eq('status', 'pending')
}

interface CreatePendingActionArgs {
  userId: string
  conversationId: string
  chatMessageId: string
  actionType: 'delete_contact' | 'delete_interaction' | 'overwrite_contact_field' | 'bulk_delete_contacts'
  summary: string
  payload: Record<string, unknown>
}

async function createPendingAction(supabase: SupabaseServer, args: CreatePendingActionArgs) {
  await expirePendingActions(supabase, args.conversationId)
  const { data, error } = await supabase
    .from('pending_actions')
    .insert({
      user_id: args.userId,
      conversation_id: args.conversationId,
      chat_message_id: args.chatMessageId,
      action_type: args.actionType,
      summary: args.summary,
      payload: args.payload,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

const CHAT_SYSTEM_PROMPT_BASE = `Du bist ein persönlicher Assistent für ein Beziehungspflege-Tool (kein klassisches CRM). Du hilfst dem Nutzer, Fragen zu seinen Kontakten zu beantworten und Aktionen auszuführen. Antworte immer auf Deutsch, per Du, kurz und konkret.

Regeln:
- Nutze die bereitgestellten Werkzeuge, um echte Daten abzufragen — rate niemals Daten, die du nicht über ein Werkzeug bekommen hast.
- Wenn eine Namenssuche mehrere passende Kontakte liefert, frage den Nutzer, welchen er meint, bevor du eine Aktion ausführst (nenne Unterscheidungsmerkmale wie Nachname/Arbeitgeber).
- Wenn der Nutzer eine Aktion verlangt, die löscht, ein vorhandenes Feld überschreibt oder mehrere Kontakte betrifft (Bulk), MUSST du dafür das passende Werkzeug aufrufen (propose_delete_contact / propose_delete_interaction / propose_bulk_delete_contacts / update_contact_field) — frag NIEMALS nur im Klartext nach Bestätigung, ohne das Werkzeug aufgerufen zu haben. Die Bestätigungs-UI entsteht ausschließlich durch den Werkzeug-Aufruf.
- Wenn ein Werkzeug "pending_confirmation" zurückgibt, ist noch NICHTS passiert — erkläre dem Nutzer kurz, dass du auf seine Bestätigung wartest (die Bestätigungskarte zeigt die UI bereits an, du musst die Aktion nicht nochmal beschreiben).
- Wenn ein Werkzeug "applied" oder "created" zurückgibt, ist die Aktion bereits ausgeführt — bestätige das kurz.
- Bei fehlenden Pflichtangaben (z.B. Kontaktname fehlt) frag gezielt nach, statt zu raten.
- Antworte als reiner Fließtext ohne Markdown.`

export const CHAT_SYSTEM_PROMPT = CHAT_SYSTEM_PROMPT_BASE

export function buildChatSystemPrompt(userContext?: {
  bio?: string | null
  goals?: string | null
}): string {
  if (!userContext?.bio && !userContext?.goals) return CHAT_SYSTEM_PROMPT_BASE
  const parts = [CHAT_SYSTEM_PROMPT_BASE, '\nKontext über den Nutzer selbst:']
  if (userContext.bio) parts.push(`Berufliches Profil: ${userContext.bio}`)
  if (userContext.goals) parts.push(`Karriereziele: ${userContext.goals}`)
  return parts.join('\n')
}

export function buildChatTools(
  supabase: SupabaseServer,
  userId: string,
  conversationId: string,
  chatMessageId: string
) {
  return {
    list_contacts: tool({
      description:
        'Sucht/filtert Kontakte des Nutzers. Nutze query für Namens-/Arbeitgeber-Suche, overdueOnly für überfällige Kontakte, missingFollowupOnly für Kontakte ohne Follow-up-Termin, category/strength zum Filtern. Gibt eine Liste mit id, Name und Kerndaten zurück.',
      inputSchema: z.object({
        query: z.string().optional().describe('Such-Text für Vor-/Nachname oder Arbeitgeber'),
        category: z.enum(['colleague', 'alumni', 'extern', 'private', 'other']).optional(),
        strength: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
        overdueOnly: z.boolean().optional(),
        missingFollowupOnly: z.boolean().optional(),
        limit: z.number().int().min(1).max(100).optional(),
      }),
      execute: async ({ query, category, strength, overdueOnly, missingFollowupOnly, limit }) => {
        let q = supabase
          .from('contacts')
          .select('id, first_name, last_name, employer, category, strength, next_followup_at, last_contacted_at')
          .eq('user_id', userId)

        if (query) {
          q = q.or(`first_name.ilike.%${query}%,last_name.ilike.%${query}%,employer.ilike.%${query}%`)
        }
        if (category) q = q.eq('category', category)
        if (strength) q = q.eq('strength', strength)
        if (missingFollowupOnly) q = q.is('next_followup_at', null)
        if (overdueOnly) q = q.lte('next_followup_at', new Date().toISOString().slice(0, 10))

        const { data, error } = await q.limit(limit ?? 20)
        if (error) return { error: error.message }

        return {
          count: data?.length ?? 0,
          contacts: (data ?? []).map((c) => ({
            id: c.id,
            name: getFullName(c),
            employer: c.employer,
            category: c.category,
            strength: c.strength,
            nextFollowupAt: c.next_followup_at,
            lastContactedAt: c.last_contacted_at,
          })),
        }
      },
    }),

    get_contact_interactions: tool({
      description: 'Holt Details zu einem einzelnen Kontakt inkl. der letzten 5 Kontaktmomente. contactId vorher über list_contacts ermitteln.',
      inputSchema: z.object({ contactId: z.string().uuid() }),
      execute: async ({ contactId }) => {
        const { data: contact } = await supabase
          .from('contacts')
          .select('*')
          .eq('id', contactId)
          .eq('user_id', userId)
          .single()
        if (!contact) return { error: 'Kontakt nicht gefunden.' }

        const { data: interactions } = await supabase
          .from('interactions')
          .select('occurred_at, channel, note')
          .eq('contact_id', contactId)
          .order('occurred_at', { ascending: false })
          .limit(5)

        return {
          contact: {
            id: contact.id,
            name: getFullName(contact),
            employer: contact.employer,
            jobTitle: contact.job_title,
            city: contact.city,
            category: contact.category,
            strength: contact.strength,
            notes: contact.notes,
            context: contact.context,
            lastContactedAt: contact.last_contacted_at,
            nextFollowupAt: contact.next_followup_at,
          },
          recentInteractions: (interactions ?? []).map((i) => ({
            date: i.occurred_at,
            channel: CHANNEL_LABELS[i.channel as Channel],
            note: i.note,
          })),
        }
      },
    }),

    list_upcoming_birthdays: tool({
      description: 'Listet Kontakte, deren Geburtstag innerhalb der nächsten N Tage liegt (Standard 30).',
      inputSchema: z.object({ withinDays: z.number().int().min(1).max(366).optional() }),
      execute: async ({ withinDays }) => {
        const window = withinDays ?? 30
        const { data } = await supabase
          .from('contacts')
          .select('id, first_name, last_name, birthday')
          .eq('user_id', userId)
          .not('birthday', 'is', null)
        const today = new Date()
        const matches = (data ?? [])
          .map((c) => {
            const next = nextBirthdayOccurrence(c.birthday as string, today)
            const days = Math.round((next.getTime() - today.getTime()) / 86400000)
            return { contact: c, next, days }
          })
          .filter((m) => m.days >= 0 && m.days <= window)
          .sort((a, b) => a.days - b.days)

        return {
          count: matches.length,
          birthdays: matches.map((m) => ({
            name: getFullName(m.contact),
            date: m.next.toISOString().slice(0, 10),
            inDays: m.days,
          })),
        }
      },
    }),

    get_network_stats: tool({
      description: 'Liefert aggregierte Statistiken über alle Kontakte/Kontaktmomente (Kategorie-/Stärke-Verteilung, überfällige Kontakte, Kanal-Verteilung) für einen Zeitraum.',
      inputSchema: z.object({ periodDays: z.union([z.literal(30), z.literal(90), z.literal(365)]).optional() }),
      execute: async ({ periodDays }) => {
        const period = periodDays ?? 30
        const [{ data: contacts }, { data: interactions }] = await Promise.all([
          supabase.from('contacts').select('*').eq('user_id', userId),
          supabase
            .from('interactions')
            .select('*')
            .eq('user_id', userId)
            .gte('occurred_at', periodStartDate(period).toISOString().slice(0, 10)),
        ])
        const safeContacts = contacts ?? []
        const safeInteractions = interactions ?? []
        return {
          totalContacts: safeContacts.length,
          overdueCount: computeOverdueCount(safeContacts as never),
          categoryDistribution: computeCategoryDistribution(safeContacts as never),
          strengthDistribution: computeStrengthDistribution(safeContacts as never),
          interactionsInPeriod: safeInteractions.length,
          channelDistribution: computeChannelDistribution(safeInteractions as never),
        }
      },
    }),

    log_interaction: tool({
      description: 'Legt einen neuen Kontaktmoment (Interaktion) für einen Kontakt an. Wird sofort ausgeführt, keine Bestätigung nötig.',
      inputSchema: z.object({
        contactId: z.string().uuid(),
        channel: z.enum(['meeting', 'call', 'message', 'event']),
        note: z.string().max(1000).optional(),
        occurredAt: z.string().optional().describe('Datum YYYY-MM-DD, Standard: heute'),
      }),
      execute: async ({ contactId, channel, note, occurredAt }) => {
        const date = occurredAt ?? new Date().toISOString().slice(0, 10)
        const { data: contact } = await supabase
          .from('contacts')
          .select('id, first_name, last_name, last_contacted_at')
          .eq('id', contactId)
          .eq('user_id', userId)
          .single()
        if (!contact) return { error: 'Kontakt nicht gefunden.' }

        const { error } = await supabase
          .from('interactions')
          .insert({ contact_id: contactId, user_id: userId, channel, note: note ?? null, occurred_at: date })
        if (error) return { error: error.message }

        if (!contact.last_contacted_at || date >= contact.last_contacted_at) {
          await supabase.from('contacts').update({ last_contacted_at: date }).eq('id', contactId)
        }

        return { status: 'applied', summary: `Kontaktmoment (${CHANNEL_LABELS[channel]}) am ${date} mit ${getFullName(contact)} angelegt.` }
      },
    }),

    set_followup: tool({
      description: 'Setzt das Follow-up-Datum eines Kontakts. Wird sofort ausgeführt, keine Bestätigung nötig.',
      inputSchema: z.object({
        contactId: z.string().uuid(),
        nextFollowupAt: z.string().describe('Datum YYYY-MM-DD'),
      }),
      execute: async ({ contactId, nextFollowupAt }) => {
        const { data: contact } = await supabase
          .from('contacts')
          .select('id, first_name, last_name')
          .eq('id', contactId)
          .eq('user_id', userId)
          .single()
        if (!contact) return { error: 'Kontakt nicht gefunden.' }

        const { error } = await supabase
          .from('contacts')
          .update({ next_followup_at: nextFollowupAt })
          .eq('id', contactId)
        if (error) return { error: error.message }

        return { status: 'applied', summary: `Follow-up für ${getFullName(contact)} auf ${nextFollowupAt} gesetzt.` }
      },
    }),

    create_contact: tool({
      description: 'Legt einen neuen Kontakt an. Wird sofort ausgeführt, keine Bestätigung nötig. Mindestens firstName ist Pflicht.',
      inputSchema: z.object({
        firstName: z.string().min(1),
        lastName: z.string().optional(),
        employer: z.string().optional(),
        jobTitle: z.string().optional(),
        email: z.string().optional(),
        phone: z.string().optional(),
        city: z.string().optional(),
        category: z.enum(['colleague', 'alumni', 'extern', 'private', 'other']).optional(),
        strength: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
      }),
      execute: async (input) => {
        const { data, error } = await supabase
          .from('contacts')
          .insert({
            user_id: userId,
            first_name: input.firstName,
            last_name: input.lastName ?? null,
            employer: input.employer ?? null,
            job_title: input.jobTitle ?? null,
            email: input.email ?? null,
            phone: input.phone ?? null,
            city: input.city ?? null,
            category: input.category ?? null,
            strength: input.strength ?? null,
          })
          .select()
          .single()
        if (error) return { error: error.message }
        return { status: 'created', contactId: data.id, summary: `Kontakt ${getFullName(data)} angelegt.` }
      },
    }),

    update_contact_field: tool({
      description: `Ändert ein Feld eines Kontakts (${EDITABLE_FIELDS.join(', ')}). Ist das Feld aktuell leer, wird sofort geschrieben. Hat das Feld bereits einen Wert, wird stattdessen eine Bestätigung erzeugt (pending_confirmation) — das Feld wird NICHT direkt überschrieben.`,
      inputSchema: z.object({
        contactId: z.string().uuid(),
        field: z.enum(EDITABLE_FIELDS),
        value: z.string().describe('Neuer Wert als Text'),
      }),
      execute: async ({ contactId, field, value }) => {
        const { data: contact } = await supabase
          .from('contacts')
          .select('*')
          .eq('id', contactId)
          .eq('user_id', userId)
          .single()
        if (!contact) return { error: 'Kontakt nicht gefunden.' }

        const parsed = parseFieldValue(field as EditableField, value)
        if (!parsed.ok) return { error: parsed.error }

        const currentValue = contact[field]
        const fieldLabel = FIELD_LABELS[field as EditableField]
        const name = getFullName(contact)

        if (currentValue === null || currentValue === '') {
          const updatePayload =
            field === 'employer'
              ? { [field]: parsed.parsed, ...EMPLOYER_NORMALIZATION_RESET }
              : { [field]: parsed.parsed }
          const { error } = await supabase.from('contacts').update(updatePayload).eq('id', contactId)
          if (error) return { error: error.message }
          return { status: 'applied', summary: `${fieldLabel} von ${name} auf "${parsed.parsed}" gesetzt.` }
        }

        const summary = `${fieldLabel} von ${name} ändern: "${currentValue}" → "${parsed.parsed}"`
        const pending = await createPendingAction(supabase, {
          userId,
          conversationId,
          chatMessageId,
          actionType: 'overwrite_contact_field',
          summary,
          payload: { contactId, field, newValue: parsed.parsed },
        })
        return { status: 'pending_confirmation', pendingActionId: pending.id, summary }
      },
    }),

    propose_delete_contact: tool({
      description: 'Schlägt das Löschen eines Kontakts vor. Löscht NICHT direkt — erzeugt eine Bestätigungsanfrage.',
      inputSchema: z.object({ contactId: z.string().uuid() }),
      execute: async ({ contactId }) => {
        const { data: contact } = await supabase
          .from('contacts')
          .select('id, first_name, last_name')
          .eq('id', contactId)
          .eq('user_id', userId)
          .single()
        if (!contact) return { error: 'Kontakt nicht gefunden.' }

        const summary = `Kontakt ${getFullName(contact)} wird unwiderruflich gelöscht (inkl. aller Kontaktmomente).`
        const pending = await createPendingAction(supabase, {
          userId,
          conversationId,
          chatMessageId,
          actionType: 'delete_contact',
          summary,
          payload: { contactId },
        })
        return { status: 'pending_confirmation', pendingActionId: pending.id, summary }
      },
    }),

    propose_delete_interaction: tool({
      description: 'Schlägt das Löschen eines einzelnen Kontaktmoments vor. Löscht NICHT direkt — erzeugt eine Bestätigungsanfrage.',
      inputSchema: z.object({ interactionId: z.string().uuid() }),
      execute: async ({ interactionId }) => {
        const { data: interaction } = await supabase
          .from('interactions')
          .select('id, occurred_at, channel, contact_id, contacts!inner(first_name, last_name)')
          .eq('id', interactionId)
          .eq('user_id', userId)
          .single()
        if (!interaction) return { error: 'Kontaktmoment nicht gefunden.' }

        const contactRow = (interaction as unknown as { contacts: { first_name: string; last_name: string | null } }).contacts
        const summary = `Kontaktmoment vom ${interaction.occurred_at} (${CHANNEL_LABELS[interaction.channel as Channel]}) mit ${getFullName(contactRow)} wird gelöscht.`
        const pending = await createPendingAction(supabase, {
          userId,
          conversationId,
          chatMessageId,
          actionType: 'delete_interaction',
          summary,
          payload: { interactionId },
        })
        return { status: 'pending_confirmation', pendingActionId: pending.id, summary }
      },
    }),

    propose_bulk_delete_contacts: tool({
      description: 'Schlägt das Löschen mehrerer Kontakte vor (z.B. nach einer list_contacts-Filterung). Löscht NICHT direkt — erzeugt eine Bestätigungsanfrage mit Liste und Anzahl.',
      inputSchema: z.object({ contactIds: z.array(z.string().uuid()).min(1).max(100) }),
      execute: async ({ contactIds }) => {
        const { data: contacts } = await supabase
          .from('contacts')
          .select('id, first_name, last_name')
          .in('id', contactIds)
          .eq('user_id', userId)
        if (!contacts || contacts.length === 0) return { error: 'Keine passenden Kontakte gefunden.' }

        const names = contacts.map((c) => getFullName(c))
        const summary = `${contacts.length} Kontakte werden unwiderruflich gelöscht: ${names.join(', ')}.`
        const pending = await createPendingAction(supabase, {
          userId,
          conversationId,
          chatMessageId,
          actionType: 'bulk_delete_contacts',
          summary,
          payload: { contactIds: contacts.map((c) => c.id) },
        })
        return { status: 'pending_confirmation', pendingActionId: pending.id, summary, count: contacts.length }
      },
    }),
  }
}

export type { EditableField }
