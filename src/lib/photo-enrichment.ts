import type { SupabaseClient } from '@supabase/supabase-js'

// PROJ-20: LinkedIn Foto-Enrichment.
// Holt Profilbilder über Apify (harvestapi/linkedin-profile-scraper), lädt sie
// herunter, legt sie im public Bucket `contact-photos` ab und setzt bei den
// Kontakten NUR `photo_url` (nie andere Felder, nie ein vorhandenes Foto).

export const APIFY_ACTOR = 'harvestapi~linkedin-profile-scraper'
export const PHOTO_BUCKET = 'contact-photos'
export const BULK_CHUNK = 50
// Max. Kontakte pro Ausführung — begrenzt Laufzeit/Kosten; Rest holt der nächste Lauf/Cron.
export const MAX_PER_RUN = 100
// Fotoloser Kontakt wird erst nach dieser Zeit erneut versucht (Kostenbremse).
export const ATTEMPT_COOLDOWN_DAYS = 90

export interface PhotoCandidate {
  id: string
  linkedin_url: string
  photo_attempted_at: string | null
}

interface ApifyItem {
  linkedinUrl?: string | null
  publicIdentifier?: string | null
  originalQuery?: { url?: string | null; query?: string | null } | null
  profilePicture?: { url?: string | null } | null
  photo?: string | null
}

export interface EnrichResult {
  candidates: number
  scraped: number
  photosSet: number
  errors: number
}

// Splitte ein Array in Bündel fester Größe.
export function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

// Soll ein Kontakt (erneut) versucht werden? Nie versucht ODER Versuch alt genug.
export function shouldAttempt(
  attemptedAt: string | null,
  now: Date = new Date(),
  cooldownDays: number = ATTEMPT_COOLDOWN_DAYS
): boolean {
  if (!attemptedAt) return true
  const attempted = new Date(attemptedAt).getTime()
  if (Number.isNaN(attempted)) return true
  const ageDays = (now.getTime() - attempted) / (1000 * 60 * 60 * 24)
  return ageDays >= cooldownDays
}

// Bestes Profilbild aus einem Apify-Item ziehen (nur echte http-URLs).
export function extractPhotoUrl(item: ApifyItem): string | null {
  const url = item?.profilePicture?.url ?? item?.photo ?? null
  return typeof url === 'string' && url.startsWith('http') ? url : null
}

// LinkedIn-URL normalisieren: Query/Hash/Trailing-Slash weg, klein, ohne www.
export function normalizeLinkedInUrl(url: string): string {
  return url
    .trim()
    .toLowerCase()
    .replace(/[?#].*$/, '')
    .replace(/\/+$/, '')
    .replace(/^https?:\/\/www\./, 'https://')
}

// Public Identifier (letztes Segment nach /in/) aus einer LinkedIn-URL ziehen.
export function publicIdentifierOf(url: string): string | null {
  const match = normalizeLinkedInUrl(url).match(/\/in\/([^/]+)/)
  return match ? match[1] : null
}

// Lookup aus Apify-Items bauen: mehrere Schlüssel pro Treffer (normalisierte
// URLs aus linkedinUrl/originalQuery + publicIdentifier) -> Bild-URL. Das
// LinkedIn-REST-Ergebnis liefert die Rückreferenz je nach Input-Feld
// unterschiedlich (originalQuery.query vs .url), daher mehrgleisig.
export function buildPhotoLookup(items: ApifyItem[]): Map<string, string> {
  const map = new Map<string, string>()
  for (const item of items) {
    const photo = extractPhotoUrl(item)
    if (!photo) continue
    const keys = [
      item.linkedinUrl,
      item.originalQuery?.url,
      item.originalQuery?.query,
    ]
    for (const key of keys) {
      if (key) map.set(normalizeLinkedInUrl(key), photo)
    }
    if (item.publicIdentifier) map.set(`id:${item.publicIdentifier.toLowerCase()}`, photo)
  }
  return map
}

// Foto für eine Kandidaten-URL im Lookup finden (URL zuerst, dann Identifier).
export function findPhoto(lookup: Map<string, string>, candidateUrl: string): string | null {
  const byUrl = lookup.get(normalizeLinkedInUrl(candidateUrl))
  if (byUrl) return byUrl
  const id = publicIdentifierOf(candidateUrl)
  return id ? (lookup.get(`id:${id}`) ?? null) : null
}

// Ruft den Apify-Actor synchron für ein Bündel LinkedIn-URLs auf und gibt die
// Dataset-Items zurück. Nutzt run-sync-get-dataset-items (ein Aufruf, Bulk).
async function scrapeBatch(urls: string[], token: string): Promise<ApifyItem[]> {
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
  return Array.isArray(data) ? (data as ApifyItem[]) : []
}

// Lädt ein Bild herunter und legt es im public Bucket ab; gibt die public URL zurück.
async function storePhoto(
  admin: SupabaseClient,
  userId: string,
  contactId: string,
  photoUrl: string
): Promise<string> {
  const imgRes = await fetch(photoUrl)
  if (!imgRes.ok) throw new Error(`photo download failed: ${imgRes.status}`)
  const contentType = imgRes.headers.get('content-type') ?? 'image/jpeg'
  const buffer = Buffer.from(await imgRes.arrayBuffer())
  const path = `${userId}/${contactId}.jpg`

  const { error: uploadError } = await admin.storage
    .from(PHOTO_BUCKET)
    .upload(path, buffer, { contentType, upsert: true })
  if (uploadError) throw uploadError

  return admin.storage.from(PHOTO_BUCKET).getPublicUrl(path).data.publicUrl
}

// Kern-Orchestrator: reichert fotolose Kontakte EINES Nutzers an.
// Verwendet den Admin-Client (RLS umgangen) — Aufrufer muss den Nutzer
// autorisieren (Route: eingeloggter Nutzer; Cron: Secret-geschützt).
export async function enrichUserPhotos(
  admin: SupabaseClient,
  userId: string,
  token: string,
  now: Date = new Date()
): Promise<EnrichResult> {
  const result: EnrichResult = { candidates: 0, scraped: 0, photosSet: 0, errors: 0 }

  const { data, error } = await admin
    .from('contacts')
    .select('id, linkedin_url, photo_attempted_at')
    .eq('user_id', userId)
    .not('linkedin_url', 'is', null)
    .is('photo_url', null)

  if (error) throw error

  const candidates = ((data ?? []) as PhotoCandidate[])
    .filter((c) => c.linkedin_url && shouldAttempt(c.photo_attempted_at, now))
    .slice(0, MAX_PER_RUN)

  result.candidates = candidates.length
  if (candidates.length === 0) return result

  const attemptedAt = now.toISOString()

  for (const batch of chunk(candidates, BULK_CHUNK)) {
    const urls = batch.map((c) => c.linkedin_url)
    let lookup: Map<string, string>
    try {
      const items = await scrapeBatch(urls, token)
      result.scraped += batch.length
      lookup = buildPhotoLookup(items)
    } catch {
      // Ganzer Batch fehlgeschlagen: als Versuch markieren, damit der Cron nicht
      // sofort erneut denselben Batch scrapet; nächster Lauf nach Cooldown.
      result.errors += batch.length
      await admin
        .from('contacts')
        .update({ photo_attempted_at: attemptedAt })
        .in('id', batch.map((c) => c.id))
      continue
    }

    for (const candidate of batch) {
      const photoUrl = findPhoto(lookup, candidate.linkedin_url)
      const updates: { photo_attempted_at: string; photo_url?: string } = {
        photo_attempted_at: attemptedAt,
      }
      try {
        if (photoUrl) {
          updates.photo_url = await storePhoto(admin, userId, candidate.id, photoUrl)
        }
        // photo_url nur setzen wenn noch leer (idempotent gegen parallele Läufe).
        await admin
          .from('contacts')
          .update(updates)
          .eq('id', candidate.id)
          .is('photo_url', null)
        if (updates.photo_url) result.photosSet += 1
      } catch {
        result.errors += 1
        await admin
          .from('contacts')
          .update({ photo_attempted_at: attemptedAt })
          .eq('id', candidate.id)
      }
    }
  }

  return result
}
