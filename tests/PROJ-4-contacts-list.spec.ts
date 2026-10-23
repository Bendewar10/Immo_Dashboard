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

async function seedContacts(token: string, userId: string) {
  const now = Date.now()
  const minus5 = new Date(now - 5 * 86400000).toISOString()
  const plus10 = new Date(now + 10 * 86400000).toISOString()
  await fetch(`${SUPABASE_URL}/rest/v1/contacts`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify([
      { user_id: userId, first_name: 'QA4 Alpha Overdue', category: 'colleague', strength: 1, next_followup_at: minus5, city: 'Berlin', employer: 'BCG', job_title: 'Partner' },
      { user_id: userId, first_name: 'QA4 Future Friend', category: 'private', strength: 3, next_followup_at: plus10, city: 'Hamburg', employer: null, job_title: null },
      { user_id: userId, first_name: 'QA4 NoFollowup Business', category: 'extern', strength: 2, next_followup_at: null, city: null, employer: 'McKinsey', job_title: 'Associate' },
    ]),
  })
}

async function cleanupContacts(token: string) {
  await fetch(`${SUPABASE_URL}/rest/v1/contacts?first_name=like.QA4*`, {
    method: 'DELETE',
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
  })
}

async function login(page: Page) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(EMAIL)
  await page.getByLabel('Passwort').fill(PASSWORD)
  await page.getByRole('button', { name: 'Login' }).click()
  await expect(page).toHaveURL('http://localhost:3000/dashboard')
  await page.goto('/contacts')
  await expect(async () => {
    expect(await page.getByText('Lädt...').count()).toBe(0)
  }).toPass({ timeout: 10000 })
}

test.describe.serial('PROJ-4: Kontaktliste & Filter', () => {
  let token: string

  test.beforeAll(async () => {
    token = await getToken()
    const userId = await getUserId(token)
    await cleanupContacts(token)
    await seedContacts(token, userId)
  })

  test.afterAll(async () => {
    await cleanupContacts(token)
  })

  test('AC1: cards show name, category, strength, follow-up info', async ({ page }) => {
    await login(page)
    const card = page.locator('.cursor-pointer', { hasText: 'QA4 Alpha Overdue' })
    await expect(card.getByText('Kollege')).toBeVisible()
    await expect(card.getByText('Stark')).toBeVisible()
    await expect(card.getByText(/Nächstes Follow-up/)).toBeVisible()
  })

  test('AC2: cards sorted by next_followup_at ascending, null last', async ({ page }) => {
    await login(page)
    const names = await page.locator('h3').allTextContents()
    const overdueIdx = names.indexOf('QA4 Alpha Overdue')
    const futureIdx = names.indexOf('QA4 Future Friend')
    const noneIdx = names.indexOf('QA4 NoFollowup Business')
    expect(overdueIdx).toBeLessThan(futureIdx)
    expect(futureIdx).toBeLessThan(noneIdx)
  })

  test('AC3: overdue contact is highlighted', async ({ page }) => {
    await login(page)
    await expect(page.getByText('(überfällig)')).toBeVisible()
    const overdueCount = await page.getByText('(überfällig)').count()
    expect(overdueCount).toBe(1)
  })

  test('AC4: category filter shows only matching contacts', async ({ page }) => {
    await login(page)
    await page.getByText('Alle Typen').click()
    await page.getByRole('option', { name: 'Kollege' }).click()
    await expect(page.getByText('QA4 Alpha Overdue')).toBeVisible()
    await expect(page.getByText('QA4 Future Friend')).not.toBeVisible()
    await expect(page.getByText('QA4 NoFollowup Business')).not.toBeVisible()
  })

  test('AC5: strength filter shows only matching contacts', async ({ page }) => {
    await login(page)
    await page.getByText('Alle Stärken').click()
    await page.getByRole('option', { name: 'Locker' }).click()
    await expect(page.getByText('QA4 Future Friend')).toBeVisible()
    await expect(page.getByText('QA4 Alpha Overdue')).not.toBeVisible()
  })

  test('AC6: category + strength filters combine with AND', async ({ page }) => {
    await login(page)
    await page.getByText('Alle Typen').click()
    await page.getByRole('option', { name: 'Kollege' }).click()
    await page.getByText('Alle Stärken').click()
    await page.getByRole('option', { name: 'Locker' }).click()
    await expect(page.getByText('Keine Kontakte zu diesen Filtern.')).toBeVisible()
  })

  test('AC7: name search filters live, case-insensitive', async ({ page }) => {
    await login(page)
    await page.getByPlaceholder('Name suchen...').fill('overdue')
    await expect(page.getByText('QA4 Alpha Overdue')).toBeVisible()
    await expect(page.getByText('QA4 Future Friend')).not.toBeVisible()
  })

  test('AC8: no-results state shown when filters yield nothing', async ({ page }) => {
    await login(page)
    await page.getByPlaceholder('Name suchen...').fill('zzz-no-such-contact-zzz')
    await expect(page.getByText('Keine Kontakte zu diesen Filtern.')).toBeVisible()
  })

  test('AC: city filter shows only contacts in that city, AND-combinable, excludes no-city contacts', async ({ page }) => {
    await login(page)
    await page.getByPlaceholder('Stadt suchen...').fill('berlin')
    await expect(page.getByText('QA4 Alpha Overdue')).toBeVisible()
    await expect(page.getByText('QA4 Future Friend')).not.toBeVisible()
    await expect(page.getByText('QA4 NoFollowup Business')).not.toBeVisible()
  })

  test('AC: city filter + category filter combine with AND', async ({ page }) => {
    await login(page)
    await page.getByPlaceholder('Stadt suchen...').fill('hamburg')
    await page.getByText('Alle Typen').click()
    await page.getByRole('option', { name: 'Kollege' }).click()
    await expect(page.getByText('Keine Kontakte zu diesen Filtern.')).toBeVisible()
  })

  test('AC10: clicking a card opens the edit form pre-filled', async ({ page }) => {
    await login(page)
    await page.getByText('QA4 Alpha Overdue').click()
    await expect(page.getByLabel('Vorname')).toHaveValue('QA4 Alpha Overdue')
    await page.getByRole('button', { name: 'Abbrechen' }).click()
  })

  test('AC (Refine 2026-07-01): company/title search matches employer, excludes contacts without it', async ({ page }) => {
    await login(page)
    await page.getByPlaceholder('Firma/Titel suchen...').fill('bcg')
    await expect(page.getByText('QA4 Alpha Overdue')).toBeVisible()
    await expect(page.getByText('QA4 Future Friend')).not.toBeVisible()
    await expect(page.getByText('QA4 NoFollowup Business')).not.toBeVisible()
  })

  test('AC (Refine 2026-07-01): company/title search matches job_title (OR with employer)', async ({ page }) => {
    await login(page)
    await page.getByPlaceholder('Firma/Titel suchen...').fill('associate')
    await expect(page.getByText('QA4 NoFollowup Business')).toBeVisible()
    await expect(page.getByText('QA4 Alpha Overdue')).not.toBeVisible()
  })

  test('AC (Refine 2026-07-01): company/title search + category filter combine with AND', async ({ page }) => {
    await login(page)
    await page.getByPlaceholder('Firma/Titel suchen...').fill('bcg')
    await page.getByText('Alle Typen').click()
    await page.getByRole('option', { name: 'Extern' }).click()
    await expect(page.getByText('Keine Kontakte zu diesen Filtern.')).toBeVisible()
  })

  test('AC (Refine 2026-07-01): whitespace-only company search is treated as no filter', async ({ page }) => {
    await login(page)
    await page.getByPlaceholder('Firma/Titel suchen...').fill('   ')
    await expect(page.getByText('QA4 Alpha Overdue')).toBeVisible()
    await expect(page.getByText('QA4 Future Friend')).toBeVisible()
    await expect(page.getByText('QA4 NoFollowup Business')).toBeVisible()
  })
})
