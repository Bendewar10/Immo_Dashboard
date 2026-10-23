import { test, expect, type Page } from '@playwright/test'

const EMAIL = process.env.QA_TEST_EMAIL!
const PASSWORD = process.env.QA_TEST_PASSWORD!
const SUPABASE_URL = process.env.QA_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_ANON_KEY =
  process.env.QA_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const AI_TIMEOUT = 60_000

async function getToken() {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  })
  return ((await res.json()) as { access_token: string }).access_token
}

async function getUserId(token: string) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
  })
  return ((await res.json()) as { id: string }).id
}

async function seedEmployment(token: string, userId: string) {
  await fetch(`${SUPABASE_URL}/rest/v1/user_employment`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ user_id: userId, employer: 'McKinsey & Company', job_title: 'Consultant', city: 'München' }),
  })
}

async function wipeProfile(token: string, userId: string) {
  for (const table of ['user_education', 'user_employment', 'user_profile']) {
    await fetch(`${SUPABASE_URL}/rest/v1/${table}?user_id=eq.${userId}`, {
      method: 'DELETE',
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
    })
  }
}

async function createContact(token: string, userId: string, firstName: string) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/contacts`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify({
      user_id: userId,
      first_name: firstName,
      employer: 'McKinsey & Company',
      job_title: 'Partner',
      city: 'München',
    }),
  })
  const [contact] = (await res.json()) as Array<{ id: string }>
  return contact.id
}

async function deleteContact(token: string, contactId: string) {
  await fetch(`${SUPABASE_URL}/rest/v1/contacts?id=eq.${contactId}`, {
    method: 'DELETE',
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
  })
}

async function login(page: Page) {
  await page.goto('/login')
  await page.waitForLoadState('networkidle')
  await page.getByLabel('Email').fill(EMAIL)
  await page.getByLabel('Passwort').fill(PASSWORD)
  await page.getByRole('button', { name: 'Login' }).click()
  await expect(page).toHaveURL('http://localhost:3000/dashboard')
}

test.describe.serial('PROJ-17: Gemeinsamkeiten-Feld', () => {
  test.setTimeout(90_000)

  let token: string
  let userId: string
  let contactId: string
  const contactName = `Gemeinsamkeiten-Test ${Date.now()}`

  test.beforeAll(async () => {
    token = await getToken()
    userId = await getUserId(token)
    await wipeProfile(token, userId)
    await seedEmployment(token, userId)
    contactId = await createContact(token, userId, contactName)
  })

  test.afterAll(async () => {
    await deleteContact(token, contactId)
    await wipeProfile(token, userId)
  })

  test('AC: Gemeinsamkeiten-Sektion erscheint beim Öffnen eines bestehenden Kontakts', async ({ page }) => {
    await login(page)
    await page.goto('/contacts')
    await page.getByText(contactName, { exact: true }).click()
    await expect(page.getByText('Gemeinsamkeiten', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'KI-Analyse starten' })).toBeVisible()
  })

  test('AC: KI-Analyse startet und zeigt Ergebnis an', async ({ page }) => {
    await login(page)
    await page.goto('/contacts')
    await page.getByText(contactName, { exact: true }).click()
    await page.getByRole('button', { name: 'KI-Analyse starten' }).click()
    await expect(page.getByRole('button', { name: 'Analysiere...' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Neu analysieren' })).toBeVisible({ timeout: AI_TIMEOUT })
    const resultBox = page.locator('p.whitespace-pre-line')
    await expect(resultBox).toBeVisible({ timeout: AI_TIMEOUT })
    const text = await resultBox.innerText()
    expect(text.trim().length).toBeGreaterThan(5)
  })

  test('AC: Kontaktkarte zeigt Gemeinsamkeiten-Badge nach erfolgreicher Analyse', async ({ page }) => {
    await login(page)
    await page.goto('/contacts')
    const card = page.locator('.cursor-pointer', { hasText: contactName })
    await expect(card.getByText('Gemeinsamkeiten', { exact: true })).toBeVisible()
  })

  test('AC: Neu analysieren Button überschreibt vorheriges Ergebnis', async ({ page }) => {
    await login(page)
    await page.goto('/contacts')
    await page.getByText(contactName, { exact: true }).click()
    await expect(page.getByRole('button', { name: 'Neu analysieren' })).toBeVisible()
    await page.getByRole('button', { name: 'Neu analysieren' }).click()
    await expect(page.getByRole('button', { name: 'Analysiere...' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Neu analysieren' })).toBeVisible({ timeout: AI_TIMEOUT })
  })

  test('AC: Fehler wenn kein Profil vorhanden — klare Fehlermeldung', async ({ page }) => {
    await wipeProfile(token, userId)
    await login(page)
    await page.goto('/contacts')
    await page.getByText(contactName, { exact: true }).click()
    await page.getByRole('button', { name: /Analyse starten|Neu analysieren/ }).click()
    await expect(page.getByText('Kein Profil vorhanden')).toBeVisible({ timeout: 15_000 })
    await seedEmployment(token, userId)
  })

  test('AC: Gemeinsamkeiten-Sektion nicht sichtbar beim Anlegen eines neuen Kontakts', async ({ page }) => {
    await login(page)
    await page.goto('/contacts')
    await page.getByRole('button', { name: 'Kontakt hinzufügen' }).click()
    const section = page.locator('button', { hasText: 'KI-Analyse starten' })
    await expect(section).toHaveCount(0)
  })
})
