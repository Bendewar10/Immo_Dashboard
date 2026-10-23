import type { SupabaseClient } from '@supabase/supabase-js'
import { APIFY_ACTOR } from './photo-enrichment'

// PROJ-20 (Erweiterung): On-Demand LinkedIn-Profildaten-Enrichment.
// Derselbe Apify-Actor/Modus wie das Foto-Enrichment liefert das ganze Profil.
// Dieses Modul zieht daraus einen kompakten Snapshot, füllt NUR leere sichtbare
// Kontaktfelder (employer/job_title/city) und speichert den Snapshot als
// KI-Kontext (contacts.linkedin_profile). Ausgelöst wird das ausschließlich
// on-demand über den Gemeinsamkeiten-Knopf (PROJ-17), mit Cooldown als Kostenbremse.

// Fotoloser Kostenrahmen: Snapshot wird erst nach dieser Zeit erneut gescraped.
export const PROFILE_COOLDOWN_DAYS = 90

// Kompakter, normalisierter Profil-Snapshot (das, was die KI wirklich braucht).
export interface ProfileSnapshot {
  headline: string | null
  location: string | null
  employer: string | null
  jobTitle: string | null
  city: string | null
  about: string | null
  currentPositions: { position: string | null; company: string | null; duration: string | null }[]
  experience: { position: string | null; company: string | null; duration: string | null }[]
  education: { school: string | null; degree: string | null; field: string | null; period: string | null }[]
  topSkills: string[]
  scrapedAt: string
}

// Lose typisiertes Roh-Item aus dem Apify-Actor (nur die genutzten Felder).
interface RawPosition {
  position?: string | null
  companyName?: string | null
  location?: string | null
  duration?: string | null
}
interface RawEducation {
  schoolName?: string | null
  degree?: string | null
  fieldOfStudy?: string | null
  period?: string | null
}
export interface RawProfileItem {
  headline?: string | null
  about?: string | null
  location?: { linkedinText?: string | null; parsed?: { city?: string | null } | null } | null
  currentPosition?: RawPosition[] | null
  experience?: RawPosition[] | null
  education?: RawEducation[] | null
  topSkills?: string[] | null
  skills?: { name?: string | null }[] | null
}

function clean(value: string | null | undefined): string | null {
  const v = (value ?? '').trim()
  return v.length > 0 ? v : null
}

function mapPositions(list: RawPosition[] | null | undefined, limit: number) {
  return (list ?? []).slice(0, limit).map((p) => ({
    position: clean(p.position),
    company: clean(p.companyName),
    duration: clean(p.duration),
  }))
}

// Roh-Item -> kompakter Snapshot. Pure Funktion (unit-testbar).
export function extractProfileSnapshot(
  item: RawProfileItem,
  now: Date = new Date()
): ProfileSnapshot {
  const current = mapPositions(item.currentPosition, 3)
  const topCurrent = current[0]
  const city = clean(item.location?.parsed?.city) ?? null
  const location = clean(item.location?.linkedinText) ?? city

  const topSkills = (item.topSkills ?? [])
    .map((s) => clean(s))
    .filter((s): s is string => Boolean(s))
  const skillFallback = (item.skills ?? [])
    .map((s) => clean(s?.name))
    .filter((s): s is string => Boolean(s))

  return {
    headline: clean(item.headline),
    location,
    employer: topCurrent?.company ?? null,
    jobTitle: topCurrent?.position ?? null,
    city,
    about: clean(item.about),
    currentPositions: current,
    experience: mapPositions(item.experience, 5),
    education: (item.education ?? []).slice(0, 5).map((e) => ({
      school: clean(e.schoolName),
      degree: clean(e.degree),
      field: clean(e.fieldOfStudy),
      period: clean(e.period),
    })),
    topSkills: (topSkills.length > 0 ? topSkills : skillFallback).slice(0, 10),
    scrapedAt: now.toISOString(),
  }
}

// Soll das Profil (erneut) gescraped werden? Nie gescraped ODER Cooldown abgelaufen.
export function shouldScrapeProfile(
  profileAt: string | null,
  now: Date = new Date(),
  cooldownDays: number = PROFILE_COOLDOWN_DAYS
): boolean {
  if (!profileAt) return true
  const at = new Date(profileAt).getTime()
  if (Number.isNaN(at)) return true
  const ageDays = (now.getTime() - at) / (1000 * 60 * 60 * 24)
  return ageDays >= cooldownDays
}

// Snapshot -> Prompt-Text (Deutsch) für die Gemeinsamkeiten-KI.
export function formatSnapshotForPrompt(snapshot: ProfileSnapshot): string {
  const lines: string[] = ['LinkedIn-Profil (automatisch ergänzt):']
  if (snapshot.headline) lines.push(`Headline: ${snapshot.headline}`)
  const currentTop = snapshot.currentPositions[0]
  if (currentTop && (currentTop.position || currentTop.company)) {
    lines.push(
      `Aktuell: ${[currentTop.position, currentTop.company].filter(Boolean).join(' bei ')}${
        currentTop.duration ? ` (${currentTop.duration})` : ''
      }`
    )
  }
  if (snapshot.location) lines.push(`Standort: ${snapshot.location}`)
  if (snapshot.experience.length > 0) {
    lines.push(
      `Werdegang: ${snapshot.experience
        .filter((e) => e.position || e.company)
        .map((e) => `${[e.position, e.company].filter(Boolean).join(' bei ')}${e.duration ? ` (${e.duration})` : ''}`)
        .join('; ')}`
    )
  }
  if (snapshot.education.length > 0) {
    lines.push(
      `Ausbildung: ${snapshot.education
        .filter((e) => e.school)
        .map((e) => `${[e.degree, e.field].filter(Boolean).join(' ')} an ${e.school}${e.period ? ` (${e.period})` : ''}`.trim())
        .join('; ')}`
    )
  }
  if (snapshot.topSkills.length > 0) lines.push(`Skills: ${snapshot.topSkills.join(', ')}`)
  if (snapshot.about) lines.push(`Über: ${snapshot.about.slice(0, 400)}`)
  return lines.join('\n')
}

// Ruft den Apify-Actor synchron für EINE LinkedIn-URL auf, gibt das erste
// Dataset-Item zurück (oder null). Gleicher Actor/Modus wie das Foto-Enrichment.
export async function scrapeLinkedInProfile(
  url: string,
  token: string
): Promise<RawProfileItem | null> {
  const endpoint = `https://api.apify.com/v2/acts/${APIFY_ACTOR}/run-sync-get-dataset-items?token=${encodeURIComponent(token)}`
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      queries: [url],
      profileScraperMode: 'Profile details no email ($4 per 1k)',
    }),
  })
  if (!res.ok) throw new Error(`Apify profile scrape failed: ${res.status}`)
  const data = await res.json()
  const items = Array.isArray(data) ? (data as RawProfileItem[]) : []
  return items[0] ?? null
}

// Was die aufrufende Route über den Kontakt weiß (nur relevante Felder).
export interface EnrichableContact {
  id: string
  employer: string | null
  job_title: string | null
  city: string | null
  linkedin_url: string | null
  linkedin_profile: ProfileSnapshot | null
  linkedin_profile_at: string | null
}

export interface EnrichProfileResult {
  contact: EnrichableContact
  snapshot: ProfileSnapshot | null
  scraped: boolean
}

// On-demand-Orchestrator: scraped bei Bedarf (Cooldown), füllt NUR leere
// sichtbare Felder, speichert Snapshot. Best-Effort — wirft nie nach außen.
// Nutzt den übergebenen Supabase-Client (RLS: eigener Kontakt).
export async function maybeEnrichContactProfile(
  supabase: SupabaseClient,
  contact: EnrichableContact,
  token: string | undefined,
  now: Date = new Date()
): Promise<EnrichProfileResult> {
  const existing = contact.linkedin_profile ?? null

  if (!token || !contact.linkedin_url) {
    return { contact, snapshot: existing, scraped: false }
  }
  if (!shouldScrapeProfile(contact.linkedin_profile_at, now)) {
    return { contact, snapshot: existing, scraped: false }
  }

  let snapshot: ProfileSnapshot | null
  try {
    const item = await scrapeLinkedInProfile(contact.linkedin_url, token)
    snapshot = item ? extractProfileSnapshot(item, now) : null
  } catch {
    // Harter Fehler (Netz/Kontingent): Cooldown NICHT setzen, damit der nächste
    // Klick erneut versucht. Analyse läuft graceful auf vorhandenen Daten weiter.
    return { contact, snapshot: existing, scraped: false }
  }

  const nowIso = now.toISOString()

  if (!snapshot) {
    // Profil ohne Daten (privat/gelöscht): Cooldown setzen, um Re-Scrape-Spam zu bremsen.
    await supabase.from('contacts').update({ linkedin_profile_at: nowIso }).eq('id', contact.id)
    return {
      contact: { ...contact, linkedin_profile_at: nowIso },
      snapshot: existing,
      scraped: true,
    }
  }

  const updates: Record<string, unknown> = {
    linkedin_profile: snapshot,
    linkedin_profile_at: nowIso,
  }
  const merged: EnrichableContact = {
    ...contact,
    linkedin_profile: snapshot,
    linkedin_profile_at: nowIso,
  }
  // Nur leere sichtbare Felder füllen — nie nutzergepflegte Werte überschreiben.
  if (!contact.employer && snapshot.employer) {
    updates.employer = snapshot.employer
    merged.employer = snapshot.employer
  }
  if (!contact.job_title && snapshot.jobTitle) {
    updates.job_title = snapshot.jobTitle
    merged.job_title = snapshot.jobTitle
  }
  if (!contact.city && snapshot.city) {
    updates.city = snapshot.city
    merged.city = snapshot.city
  }

  await supabase.from('contacts').update(updates).eq('id', contact.id)
  return { contact: merged, snapshot, scraped: true }
}
