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

type SeedFields = {
  category?: string | null
  strength?: number | null
  next_followup_at?: string | null
}

async function seedContact(token: string, userId: string, name: string, fields: SeedFields = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/contacts`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify({ user_id: userId, first_name: name, ...fields }),
  })
  const [contact] = await res.json()
  return contact.id as string
}

async function seedInteraction(
  token: string,
  userId: string,
  contactId: string,
  occurredAt: string,
  channel: string
) {
  await fetch(`${SUPABASE_URL}/rest/v1/interactions`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ user_id: userId, contact_id: contactId, occurred_at: occurredAt, channel }),
  })
}

// PROJ-8 aggregiert über ALLE Kontakte/Interactions des Accounts (anders als bisherige Specs,
// die nur ihre eigenen Prefix-Kontakte aufräumen) -- braucht daher einen vollständigen Reset
// des dedizierten QA-Test-Accounts für deterministische Schwellenwert-/Diagramm-Tests.
async function wipeAllContacts(token: string, userId: string) {
  await fetch(`${SUPABASE_URL}/rest/v1/contacts?user_id=eq.${userId}`, {
    method: 'DELETE',
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
  })
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

function isoOffset(days: number) {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

async function login(page: Page) {
  await page.goto('/login')
  await page.waitForLoadState('networkidle')
  await page.getByLabel('Email').fill(EMAIL)
  await page.getByLabel('Passwort').fill(PASSWORD)
  await page.getByRole('button', { name: 'Login' }).click()
  await expect(page).toHaveURL('http://localhost:3000/dashboard')
}

async function gotoAnalytics(page: Page) {
  await page.goto('/analytics')
  await expect(page.getByRole('heading', { name: 'Analytics', exact: true })).toBeVisible()
}

test.describe.serial('PROJ-8: Netzwerk-Analytics', () => {
  let token: string
  let userId: string

  test.beforeAll(async () => {
    token = await getToken()
    userId = await getUserId(token)
  })

  test.beforeEach(async () => {
    await wipeAllContacts(token, userId)
  })

  test.afterAll(async () => {
    await wipeAllContacts(token, userId)
  })

  test('AC: nav link reaches /analytics', async ({ page }) => {
    await login(page)
    await page.getByRole('link', { name: 'Analytics' }).click()
    await expect(page).toHaveURL('http://localhost:3000/analytics')
  })

  test('AC: empty state shown when user has no contacts', async ({ page }) => {
    await login(page)
    await page.goto('/analytics')
    await expect(page.getByText('Noch keine Kontakte vorhanden')).toBeVisible()
  })

  test('AC: snapshot charts reflect category/strength distribution and overdue count', async ({ page }) => {
    await seedContact(token, userId, 'QA8 Colleague', { category: 'colleague', strength: 1 })
    await seedContact(token, userId, 'QA8 NoCategory', { next_followup_at: isoOffset(-2) })
    await login(page)
    await gotoAnalytics(page)

    await expect(page.getByText('Kollege', { exact: true }).first()).toBeVisible()
    await expect(page.getByText(/Ohne\s*Kategorie/).first()).toBeVisible()
    await expect(page.getByText(/Ohne\s*Stärke/).first()).toBeVisible()
    await expect(page.getByText('Stark', { exact: true }).first()).toBeVisible()
    await expect(page.getByTestId('overdue-count')).toHaveText('1')
  })

  test('AC: default period is 90 days and tabs switch correctly', async ({ page }) => {
    await seedContact(token, userId, 'QA8 PeriodContact')
    await login(page)
    await gotoAnalytics(page)

    await expect(page.getByRole('tab', { name: '90 Tage' })).toHaveAttribute('aria-selected', 'true')
    await page.getByRole('tab', { name: '30 Tage' }).click()
    await expect(page.getByRole('tab', { name: '30 Tage' })).toHaveAttribute('aria-selected', 'true')
    await page.getByRole('tab', { name: '12 Monate' }).click()
    await expect(page.getByRole('tab', { name: '12 Monate' })).toHaveAttribute('aria-selected', 'true')
  })

  test('AC: fewer than 3 interactions in period shows hint instead of generate button', async ({ page }) => {
    const contactId = await seedContact(token, userId, 'QA8 FewInteractions')
    await seedInteraction(token, userId, contactId, today(), 'call')
    await seedInteraction(token, userId, contactId, today(), 'meeting')
    await login(page)
    await gotoAnalytics(page)

    await expect(page.getByText('Noch nicht genug Daten für Insights')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Insights generieren' })).toHaveCount(0)
  })

  test('AC: enough interactions shows generate button; click generates insight text', async ({ page }) => {
    const contactId = await seedContact(token, userId, 'QA8 EnoughInteractions')
    await seedInteraction(token, userId, contactId, today(), 'call')
    await seedInteraction(token, userId, contactId, today(), 'meeting')
    await seedInteraction(token, userId, contactId, today(), 'message')
    await login(page)
    await gotoAnalytics(page)

    await page.route('**/api/network-insights', async (route) => {
      await new Promise((r) => setTimeout(r, 300))
      await route.fulfill({ status: 200, json: { text: 'Du hattest 3 Kontaktmomente, gut verteilt.' } })
    })

    const genButton = page.getByRole('button', { name: 'Insights generieren' })
    await expect(genButton).toBeVisible()
    await genButton.click()
    await expect(page.getByRole('button', { name: 'Generiere...' })).toBeVisible()
    await expect(page.getByText('Du hattest 3 Kontaktmomente, gut verteilt.')).toBeVisible()
  })

  test('AC: failed insight request shows error, charts remain usable', async ({ page }) => {
    const contactId = await seedContact(token, userId, 'QA8 InsightError')
    await seedInteraction(token, userId, contactId, today(), 'call')
    await seedInteraction(token, userId, contactId, today(), 'meeting')
    await seedInteraction(token, userId, contactId, today(), 'message')
    await login(page)
    await gotoAnalytics(page)

    await page.route('**/api/network-insights', (route) =>
      route.fulfill({ status: 502, json: { error: 'Insights konnten nicht generiert werden.' } })
    )

    await page.getByRole('button', { name: 'Insights generieren' }).click()
    await expect(
      page.getByText('Insights konnten nicht generiert werden. Bitte erneut versuchen.')
    ).toBeVisible()
    await expect(page.getByRole('tab', { name: '30 Tage' })).toBeEnabled()
  })

  test('AC: switching period clears a previously generated insight', async ({ page }) => {
    const contactId = await seedContact(token, userId, 'QA8 PeriodClear')
    await seedInteraction(token, userId, contactId, today(), 'call')
    await seedInteraction(token, userId, contactId, today(), 'meeting')
    await seedInteraction(token, userId, contactId, today(), 'message')
    await login(page)
    await gotoAnalytics(page)

    await page.route('**/api/network-insights', (route) =>
      route.fulfill({ status: 200, json: { text: 'Alter Insight-Text' } })
    )

    await page.getByRole('button', { name: 'Insights generieren' }).click()
    await expect(page.getByText('Alter Insight-Text')).toBeVisible()

    await page.getByRole('tab', { name: '30 Tage' }).click()
    await expect(page.getByText('Alter Insight-Text')).toHaveCount(0)
  })

  test('Security: unauthenticated request to /api/network-insights is blocked', async ({ request }) => {
    const res = await request.post('http://localhost:3000/api/network-insights', {
      data: { period: 90 },
      maxRedirects: 0,
    })
    expect([401, 307, 308]).toContain(res.status())
  })

  test('Security: invalid period value is rejected', async ({ page }) => {
    await login(page)
    const res = await page.request.post('http://localhost:3000/api/network-insights', {
      data: { period: 7 },
    })
    expect(res.status()).toBe(400)
  })

  test('AC (Refine 2026-07-03): "Top-Kontakte nach Meeting-Häufigkeit" shows a not-connected hint with link to Konnektoren', async ({
    page,
  }) => {
    // QA account has no connector_tokens row for google (same fixture as PROJ-21/PROJ-6) -> real "not connected" state
    await login(page)
    await gotoAnalytics(page)
    await expect(page.getByText('Top-Kontakte nach Meeting-Häufigkeit')).toBeVisible()
    await expect(page.getByText('Google Kalender verbinden, um Meeting-Häufigkeit zu sehen')).toBeVisible()
    const link = page.getByRole('link', { name: 'zu den Konnektoren' })
    await expect(link).toHaveAttribute('href', '/einstellungen/konnektoren')
  })

  test('Security: unauthenticated request to /api/analytics/meeting-frequency is blocked', async ({ request }) => {
    const res = await request.get('http://localhost:3000/api/analytics/meeting-frequency?period=90', {
      maxRedirects: 0,
    })
    expect([401, 307, 308]).toContain(res.status())
  })

  test('Security: authenticated request to /api/analytics/meeting-frequency never returns raw tokens', async ({
    page,
  }) => {
    await login(page)
    const res = await page.request.get('http://localhost:3000/api/analytics/meeting-frequency?period=90')
    const json = await res.json()
    const bodyText = JSON.stringify(json)
    expect(bodyText).not.toContain('access_token')
    expect(bodyText).not.toContain('refresh_token')
  })
})
