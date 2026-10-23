import { test, expect, type Page } from '@playwright/test'

const EMAIL = process.env.QA_TEST_EMAIL!
const PASSWORD = process.env.QA_TEST_PASSWORD!
const SUPABASE_URL = process.env.QA_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_ANON_KEY =
  process.env.QA_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

async function getToken() {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  })
  const json = await res.json()
  return json.access_token as string
}

async function getUserId(token: string) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
  })
  const json = await res.json()
  return json.id as string
}

async function seedContact(token: string, userId: string, name: string) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/contacts`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify({ user_id: userId, first_name: name, followup_interval_days: 10 }),
  })
  const [contact] = await res.json()
  return contact.id as string
}

async function seedInteractions(
  token: string,
  userId: string,
  contactId: string,
  rows: { occurred_at: string; channel: string; note?: string }[]
) {
  await fetch(`${SUPABASE_URL}/rest/v1/interactions`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(rows.map((r) => ({ ...r, contact_id: contactId, user_id: userId }))),
  })
}

async function getContact(token: string, contactId: string) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/contacts?id=eq.${contactId}`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
  })
  const [contact] = await res.json()
  return contact as { last_contacted_at: string | null; next_followup_at: string | null }
}

async function cleanupContacts(token: string) {
  await fetch(`${SUPABASE_URL}/rest/v1/contacts?first_name=like.QA5*`, {
    method: 'DELETE',
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
  })
}

async function login(page: Page) {
  // Ein Retry gegen Supabase-Auth-Rate-Limit (Suite macht pro Lauf viele Passwort-Logins)
  for (let attempt = 0; attempt < 2; attempt++) {
    await page.goto('/login')
    await page.waitForLoadState('networkidle')
    await page.getByLabel('Email').fill(EMAIL)
    await page.getByLabel('Passwort').fill(PASSWORD)
    await page.getByRole('button', { name: 'Login' }).click()
    try {
      await expect(page).toHaveURL('http://localhost:3000/dashboard', { timeout: 10000 })
      break
    } catch (e) {
      if (attempt === 1) throw e
      await page.waitForTimeout(15000)
    }
  }
  await page.goto('/contacts')
  await expect(async () => {
    expect(await page.getByText('Lädt...').count()).toBe(0)
  }).toPass({ timeout: 10000 })
}

function uniqueName(label: string) {
  return `QA5 ${label} ${Date.now()}-${Math.floor(Math.random() * 10000)}`
}

async function openHistory(page: Page, name: string) {
  const card = page.locator('.cursor-pointer', { hasText: name })
  await card.getByRole('button', { name: 'Verlauf anzeigen' }).click()
  await expect(page.getByText(`Verlauf: ${name}`)).toBeVisible()
}

function entries(page: Page) {
  return page.getByTestId('interaction-entry')
}

test.describe.serial('PROJ-5: Interaktions-Log', () => {
  let token: string
  let userId: string

  test.beforeAll(async () => {
    token = await getToken()
    userId = await getUserId(token)
    await cleanupContacts(token)
  })

  test.afterAll(async () => {
    await cleanupContacts(token)
  })

  test('AC: add interaction with date+channel, optional note saved', async ({ page }) => {
    const name = uniqueName('Add')
    await seedContact(token, userId, name)
    await login(page)
    await openHistory(page, name)

    await page.getByRole('button', { name: 'Kontaktmoment hinzufügen' }).click()
    await page.getByLabel('Kanal').click()
    await page.getByRole('option', { name: 'Call' }).click()
    await page.getByLabel('Notiz').fill('Kurzes Update-Gespräch')
    await page.getByRole('button', { name: 'Speichern' }).click()

    await expect(entries(page)).toHaveCount(1)
    await expect(entries(page).first()).toContainText('Call')
    await expect(entries(page).first()).toContainText('Kurzes Update-Gespräch')
  })

  test('AC: missing channel shows validation error, not saved', async ({ page }) => {
    const name = uniqueName('NoChannel')
    await seedContact(token, userId, name)
    await login(page)
    await openHistory(page, name)

    await page.getByRole('button', { name: 'Kontaktmoment hinzufügen' }).click()
    await page.getByRole('button', { name: 'Speichern' }).click()
    await expect(page.getByText('Kanal ist erforderlich')).toBeVisible()
    await expect(entries(page)).toHaveCount(0)
  })

  test('AC: future date shows validation error, not saved', async ({ page }) => {
    const name = uniqueName('FutureDate')
    await seedContact(token, userId, name)
    await login(page)
    await openHistory(page, name)

    await page.getByRole('button', { name: 'Kontaktmoment hinzufügen' }).click()
    const future = new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10)
    await page.getByLabel('Datum').fill(future)
    await page.getByLabel('Kanal').click()
    await page.getByRole('option', { name: 'Event' }).click()
    await page.getByRole('button', { name: 'Speichern' }).click()

    await expect(page.getByText('Datum darf nicht in der Zukunft liegen')).toBeVisible()
    await expect(entries(page)).toHaveCount(0)
  })

  test('AC: empty state shown when contact has no interactions yet', async ({ page }) => {
    const name = uniqueName('Empty')
    await seedContact(token, userId, name)
    await login(page)
    await openHistory(page, name)
    await expect(page.getByText('Noch keine Kontaktmomente.')).toBeVisible()
  })

  test('AC: history lists multiple interactions newest first', async ({ page }) => {
    const name = uniqueName('Sort')
    const contactId = await seedContact(token, userId, name)
    await seedInteractions(token, userId, contactId, [
      { occurred_at: '2026-06-01', channel: 'call' },
      { occurred_at: '2026-06-10', channel: 'meeting' },
    ])

    await login(page)
    await openHistory(page, name)
    await expect(entries(page)).toHaveCount(2)
    await expect(entries(page).nth(0)).toContainText('Treffen')
    await expect(entries(page).nth(1)).toContainText('Call')
  })

  test('AC: edit pre-fills form and persists new values', async ({ page }) => {
    const name = uniqueName('Edit')
    const contactId = await seedContact(token, userId, name)
    await seedInteractions(token, userId, contactId, [
      { occurred_at: '2026-06-01', channel: 'call', note: 'Original' },
    ])

    await login(page)
    await openHistory(page, name)
    await entries(page).first().getByRole('button', { name: 'Bearbeiten' }).click()
    await expect(page.getByLabel('Notiz')).toHaveValue('Original')
    await page.getByLabel('Kanal').click()
    await page.getByRole('option', { name: 'Treffen' }).click()
    await page.getByLabel('Notiz').fill('Geändert')
    await page.getByRole('button', { name: 'Speichern' }).click()

    await expect(entries(page)).toHaveCount(1)
    await expect(entries(page).first()).toContainText('Treffen')
    await expect(entries(page).first()).toContainText('Geändert')
  })

  test('AC: delete shows confirmation dialog before removing entry', async ({ page }) => {
    const name = uniqueName('Delete')
    const contactId = await seedContact(token, userId, name)
    await seedInteractions(token, userId, contactId, [
      { occurred_at: '2026-06-01', channel: 'call', note: 'Zum Löschen' },
    ])

    await login(page)
    await openHistory(page, name)
    await entries(page).first().getByRole('button', { name: 'Löschen' }).click()
    await expect(page.getByText('Kontaktmoment löschen?')).toBeVisible()

    const deleteResponse = page.waitForResponse(
      (res) => res.url().includes('/rest/v1/interactions') && res.request().method() === 'DELETE'
    )
    await page.getByRole('button', { name: 'Löschen' }).last().click()
    await deleteResponse
    await expect(entries(page)).toHaveCount(0)
    await expect(page.getByText('Noch keine Kontaktmomente.')).toBeVisible()
  })

  test('AC: last_contacted_at/next_followup_at recompute on insert, edit and delete', async ({ page }) => {
    const name = uniqueName('Trigger')
    const contactId = await seedContact(token, userId, name)

    await login(page)
    await openHistory(page, name)

    // insert older + newer entry
    await page.getByRole('button', { name: 'Kontaktmoment hinzufügen' }).click()
    await page.getByLabel('Datum').fill('2026-06-01')
    await page.getByLabel('Kanal').click()
    await page.getByRole('option', { name: 'Call' }).click()
    await page.getByRole('button', { name: 'Speichern' }).click()
    await expect(entries(page)).toHaveCount(1)

    await page.getByRole('button', { name: 'Kontaktmoment hinzufügen' }).click()
    await page.getByLabel('Datum').fill('2026-06-10')
    await page.getByLabel('Kanal').click()
    await page.getByRole('option', { name: 'Treffen' }).click()
    await page.getByRole('button', { name: 'Speichern' }).click()
    await expect(entries(page)).toHaveCount(2)

    await expect(async () => {
      const contact = await getContact(token, contactId)
      expect(contact.last_contacted_at?.slice(0, 10)).toBe('2026-06-10')
      expect(contact.next_followup_at?.slice(0, 10)).toBe('2026-06-20')
    }).toPass({ timeout: 5000 })

    // delete the newest entry -> falls back to the older one
    await entries(page).filter({ hasText: 'Treffen' }).getByRole('button', { name: 'Löschen' }).click()
    const deleteResponse = page.waitForResponse(
      (res) => res.url().includes('/rest/v1/interactions') && res.request().method() === 'DELETE'
    )
    await page.getByRole('button', { name: 'Löschen' }).last().click()
    await deleteResponse
    await expect(entries(page)).toHaveCount(1)

    await expect(async () => {
      const contact = await getContact(token, contactId)
      expect(contact.last_contacted_at?.slice(0, 10)).toBe('2026-06-01')
      expect(contact.next_followup_at?.slice(0, 10)).toBe('2026-06-11')
    }).toPass({ timeout: 5000 })

    // delete the last remaining entry -> clears to null
    await entries(page).filter({ hasText: 'Call' }).getByRole('button', { name: 'Löschen' }).click()
    const deleteResponse2 = page.waitForResponse(
      (res) => res.url().includes('/rest/v1/interactions') && res.request().method() === 'DELETE'
    )
    await page.getByRole('button', { name: 'Löschen' }).last().click()
    await deleteResponse2
    await expect(entries(page)).toHaveCount(0)

    await expect(async () => {
      const contact = await getContact(token, contactId)
      expect(contact.last_contacted_at).toBeNull()
      expect(contact.next_followup_at).toBeNull()
    }).toPass({ timeout: 5000 })
  })

  test('AC: network failure on save shows error, keeps form values', async ({ page }) => {
    const name = uniqueName('NetFail')
    await seedContact(token, userId, name)
    await login(page)
    await openHistory(page, name)

    await page.getByRole('button', { name: 'Kontaktmoment hinzufügen' }).click()
    await page.route('**/rest/v1/interactions**', (route) => route.abort('failed'))
    await page.getByLabel('Kanal').click()
    await page.getByRole('option', { name: 'Event' }).click()
    await page.getByLabel('Notiz').fill('Sollte erhalten bleiben')
    await page.getByRole('button', { name: 'Speichern' }).click()

    await expect(
      page.getByText('Verbindung zu Supabase fehlgeschlagen. Bitte erneut versuchen.')
    ).toBeVisible()
    await expect(page.getByLabel('Notiz')).toHaveValue('Sollte erhalten bleiben')
  })
})
