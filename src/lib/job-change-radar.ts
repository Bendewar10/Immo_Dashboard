import type { SupabaseClient } from '@supabase/supabase-js'
import {
  APIFY_ACTOR,
  BULK_CHUNK,
  chunk,
  normalizeLinkedInUrl,
  publicIdentifierOf,
} from './photo-enrichment'
import {
  extractProfileSnapshot,
  type ProfileSnapshot,
  type RawProfileItem,
} from './linkedin-profile'
import { EMPLOYER_NORMALIZATION_RESET } from './contacts'

// PROJ-24: Job-Change-Radar — monatlicher Vergleich LinkedIn-Profil vs. Kontaktdaten.
// Erkennung ist eine pure Funktion (detectJobChange); der Orchestrator scraped
// gedeckelt-rotierend (ältester Profil-Stand zuerst) und erzeugt contact_events.

export const RADAR_MAX_PER_RUN = 100

export type RadarEventType = 'Jobwechsel' | 'Beförderung'

export interface RadarContact {
  id: string
  employer: string | null
  job_title: string | null
  linkedin_url: string
  linkedin_profile_at: string | null
}

export interface RadarDetection {
  // Feld-Updates für den Kontakt (ohne Snapshot-Felder); leer = nichts zu tun
  updates: Record<string, unknown>
  eventType: RadarEventType | null
}

export interface RadarResult {
  candidates: number
  scraped: number
  updated: number
  eventsCreated: number
  errors: number
}

function sameName(a: string | null, b: string | null): boolean {
  return (a ?? '').trim().toLowerCase() === (b ?? '').trim().toLowerCase()
}

// Kernvergleich (Semantik wie CSV-Import PROJ-10):
// - anderer Arbeitgeber + alter vorhanden  -> Jobwechsel + employer/job_title-Update + Normalisierungs-Reset
// - gleicher Arbeitgeber, anderer Titel + alter vorhanden -> Beförderung + job_title-Update
// - leere Kontaktfelder werden nur befüllt, ohne Event
// - Snapshot ohne Arbeitgeber-Info fasst vorhandene Werte nie an
export function detectJobChange(
  contact: Pick<RadarContact, 'employer' | 'job_title'>,
  snapshot: ProfileSnapshot
): RadarDetection {
  const newEmployer = snapshot.employer
  const newTitle = snapshot.jobTitle
  const updates: Record<string, unknown> = {}
  let eventType: RadarEventType | null = null

  if (newEmployer && !sameName(newEmployer, contact.employer)) {
    if (contact.employer) {
      eventType = 'Jobwechsel'
    }
    updates.employer = newEmployer
    Object.assign(updates, EMPLOYER_NORMALIZATION_RESET)
    if (newTitle && !sameName(newTitle, contact.job_title)) {
      updates.job_title = newTitle
    }
    return { updates, eventType }
  }

  if (newTitle && !sameName(newTitle, contact.job_title)) {
    if (contact.job_title) {
      eventType = 'Beförderung'
    }
    updates.job_title = newTitle
  }

  return { updates, eventType }
}

// Apify-Items tragen die Rückreferenz zur angefragten URL in wechselnden Feldern
type RadarApifyItem = RawProfileItem & {
  linkedinUrl?: string | null
  publicIdentifier?: string | null
  originalQuery?: { url?: string | null; query?: string | null } | null
}

export function buildProfileLookup(items: RadarApifyItem[]): Map<string, RawProfileItem> {
  const map = new Map<string, RawProfileItem>()
  for (const item of items) {
    const keys = [item.linkedinUrl, item.originalQuery?.url, item.originalQuery?.query]
    for (const key of keys) {
      if (key) map.set(normalizeLinkedInUrl(key), item)
    }
    if (item.publicIdentifier) map.set(`id:${item.publicIdentifier.toLowerCase()}`, item)
  }
  return map
}

export function findProfileItem(
  lookup: Map<string, RawProfileItem>,
  candidateUrl: string
): RawProfileItem | null {
  const byUrl = lookup.get(normalizeLinkedInUrl(candidateUrl))
  if (byUrl) return byUrl
  const id = publicIdentifierOf(candidateUrl)
  return id ? (lookup.get(`id:${id}`) ?? null) : null
}

async function scrapeBatch(urls: string[], token: string): Promise<RadarApifyItem[]> {
  const endpoint = `https://api.apify.com/v2/acts/${APIFY_ACTOR}/run-sync-get-dataset-items?token=${encodeURIComponent(token)}`
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      queries: urls,
      profileScraperMode: 'Profile details no email ($4 per 1k)',
    }),
  })
  if (!res.ok) throw new Error(`Apify run failed: ${res.status}`)
  const data = await res.json()
  return Array.isArray(data) ? (data as RadarApifyItem[]) : []
}

// Orchestrator für EINEN Nutzer. Admin-Client (RLS umgangen) — Aufrufer
// autorisiert (Cron: Secret-geschützt). Fehler eines Batches stoppen den Lauf nicht.
export async function runJobChangeRadar(
  admin: SupabaseClient,
  userId: string,
  token: string,
  now: Date = new Date()
): Promise<RadarResult> {
  const result: RadarResult = { candidates: 0, scraped: 0, updated: 0, eventsCreated: 0, errors: 0 }

  const { data, error } = await admin
    .from('contacts')
    .select('id, employer, job_title, linkedin_url, linkedin_profile_at')
    .eq('user_id', userId)
    .not('linkedin_url', 'is', null)
    .order('linkedin_profile_at', { ascending: true, nullsFirst: true })
    .limit(RADAR_MAX_PER_RUN)

  if (error) throw error
  const candidates = (data ?? []) as RadarContact[]
  result.candidates = candidates.length
  if (candidates.length === 0) return result

  // Offene Events laden, um Duplikate zu vermeiden
  const { data: openEvents } = await admin
    .from('contact_events')
    .select('contact_id, type')
    .eq('user_id', userId)
    .is('dismissed_at', null)
  const openKeys = new Set(
    ((openEvents ?? []) as { contact_id: string; type: string }[]).map(
      (e) => `${e.contact_id}:${e.type}`
    )
  )

  const nowIso = now.toISOString()

  for (const batch of chunk(candidates, BULK_CHUNK)) {
    let lookup: Map<string, RawProfileItem>
    try {
      const items = await scrapeBatch(batch.map((c) => c.linkedin_url), token)
      result.scraped += batch.length
      lookup = buildProfileLookup(items)
    } catch {
      // Batch-Fehler: Zeitstempel NICHT setzen — nächster Lauf versucht dieselben
      // Kontakte erneut (Rotation bleibt fair, kein halber Zustand).
      result.errors += batch.length
      continue
    }

    for (const contact of batch) {
      try {
        const item = findProfileItem(lookup, contact.linkedin_url)
        if (!item) {
          // Profil privat/gelöscht: Zeitstempel setzen, sonst blockiert der
          // Kontakt dauerhaft das Monats-Budget
          await admin
            .from('contacts')
            .update({ linkedin_profile_at: nowIso })
            .eq('id', contact.id)
          continue
        }

        const snapshot = extractProfileSnapshot(item, now)
        const detection = detectJobChange(contact, snapshot)

        await admin
          .from('contacts')
          .update({
            linkedin_profile: snapshot,
            linkedin_profile_at: nowIso,
            ...detection.updates,
          })
          .eq('id', contact.id)
        if (Object.keys(detection.updates).length > 0) result.updated += 1

        if (detection.eventType && !openKeys.has(`${contact.id}:${detection.eventType}`)) {
          const { error: eventError } = await admin.from('contact_events').insert({
            contact_id: contact.id,
            user_id: userId,
            type: detection.eventType,
          })
          if (eventError) throw eventError
          openKeys.add(`${contact.id}:${detection.eventType}`)
          result.eventsCreated += 1
        }
      } catch {
        result.errors += 1
      }
    }
  }

  return result
}
