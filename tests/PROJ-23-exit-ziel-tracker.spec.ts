import { test, expect, type Page } from '@playwright/test'

const EMAIL = process.env.QA_TEST_EMAIL!
const PASSWORD = process.env.QA_TEST_PASSWORD!
const SUPABASE_URL = process.env.QA_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_ANON_KEY =
  process.env.QA_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

async function getToken() {
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
    })
    const json = await res.json()
    if (json.access_token) return json.access_token as string
    if (res.status === 429) {
      await new Promise((r) => setTimeout(r, 15000))
      continue
    }
    throw new Error(`Login fehlgeschlagen (${res.status}): ${JSON.stringify(json).slice(0, 200)}`)
  }
  throw new Error('Login fehlgeschlagen: Rate-Limit nach 3 Versuchen')
}

async function getUserId(token: string) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
  })
  const json = await res.json()
  return json.id as string
}

async function seedContacts(token: string, userId: string) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/contacts`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify([
      {
        user_id: userId,
        first_name: 'QA23 Anna',
        employer: 'QA23 Alpha',
        employer_normalized: 'QA23 Alpha Consulting',
        employer_normalized_source: 'ai',
        strength: 1,
        last_contacted_at: '2026-06-10T00:00:00Z',
      },
      {
        user_id: userId,
        first_name: 'QA23 Bernd',
        employer: 'QA23 Alpha Consulting',
        employer_normalized: 'QA23 Alpha Consulting',
        employer_normalized_source: 'ai',
        strength: 3,
        last_contacted_at: null,
      },
    ]),
  })
  if (!res.ok) {
    throw new Error(`Seed fehlgeschlagen (${res.status}): ${await res.text()}`)
  }
}

async function cleanup(token: string) {
  await fetch(`${SUPABASE_URL}/rest/v1/exit_targets?company_name=like.QA23*`, {
    method: 'DELETE',
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
  })
  await fetch(`${SUPABASE_URL}/rest/v1/contacts?first_name=like.QA23*`, {
    method: 'DELETE',
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
  })
}

async function login(page: Page) {
  for (let attempt = 0; attempt < 2; attempt++) {
    await page.goto('/login')
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
  await page.goto('/profil/lebenslauf')
  await expect(page.getByRole('heading', { name: 'Exit-Ziele' })).toBeVisible({ timeout: 15000 })
}

async function addTargetViaInput(page: Page, name: string) {
  const input = page.getByPlaceholder('Zielfirma hinzufügen (Enter bestätigt)...')
  await input.fill(name)
  await input.press('Enter')
}

test.describe.serial('PROJ-23 Exit-Ziel-Tracker', () => {
  let token: string
  let userId: string

  test.beforeAll(async () => {
    token = await getToken()
    userId = await getUserId(token)
    await cleanup(token)
    await seedContacts(token, userId)
  })

  test.afterAll(async () => {
    await cleanup(token)
  })

  test('Empty State erklärt den Zweck der Sektion', async ({ page }) => {
    await login(page)
    await expect(page.getByText(/Zielfirmen für deinen Exit erfassen/)).toBeVisible()
  })

  test('Autocomplete zeigt Netzwerk-Firmen mit Kontakt-Anzahl; Auswahl legt Ziel mit Abdeckung an', async ({ page }) => {
    await login(page)
    const input = page.getByPlaceholder('Zielfirma hinzufügen (Enter bestätigt)...')
    await input.fill('QA23 Alpha')

    const suggestion = page.getByRole('option', { name: /QA23 Alpha Consulting/ })
    await expect(suggestion).toBeVisible()
    await expect(suggestion).toContainText('2 Kontakte')
    await suggestion.click()

    // Karte mit Abdeckung + Stärke-Verteilung + Touchpoint
    await expect(page.getByText('2 Kontakte')).toBeVisible()
    await expect(page.getByText('1× Stark')).toBeVisible()
    await expect(page.getByText('1× Locker')).toBeVisible()
    await expect(page.getByText(/Letzter Touchpoint: 10\.0?6\.2026|Letzter Touchpoint: 10\.06\.2026/)).toBeVisible()
  })

  test('Freitext-Firma ohne Kontakte wird mit Hinweis angelegt', async ({ page }) => {
    await login(page)
    await addTargetViaInput(page, 'QA23 Wunschfirma GmbH')

    await expect(page.getByText('QA23 Wunschfirma GmbH')).toBeVisible()
    await expect(page.getByText('Keine Kontakte — Netzwerk aufbauen')).toBeVisible()
  })

  test('Duplikat wird verhindert (case-insensitive) und Hinweis angezeigt', async ({ page }) => {
    await login(page)
    await addTargetViaInput(page, ' qa23 wunschfirma gmbh ')

    await expect(page.getByText(/bereits als Zielfirma erfasst/)).toBeVisible()
  })

  test('Sortierung: Firma mit Kontakten vor Firma ohne Kontakte', async ({ page }) => {
    await login(page)
    const cards = page.getByText(/QA23 Alpha Consulting|QA23 Wunschfirma GmbH/)
    const first = await cards.first().textContent()
    expect(first).toContain('QA23 Alpha Consulting')
  })

  test('Klick auf Karte mit Kontakten springt in Firmen-Drilldown (PROJ-22)', async ({ page }) => {
    await login(page)
    await page.getByText('QA23 Alpha Consulting', { exact: true }).click()

    await expect(page).toHaveURL(/\/contacts\?firma=QA23(%20|\+)Alpha(%20|\+)Consulting/)
    // Firmen-Header-Karte des Drilldowns aktiv
    await expect(page.getByText('QA23 Anna')).toBeVisible()
    await expect(page.getByText('QA23 Bernd')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Firmen-Filter aufheben' })).toBeVisible()
  })

  test('Klick auf Karte ohne Kontakte macht keinen Drilldown-Sprung', async ({ page }) => {
    await login(page)
    await page.getByText('QA23 Wunschfirma GmbH', { exact: true }).click()
    await page.waitForTimeout(500)
    await expect(page).toHaveURL(/\/profil\/lebenslauf/)
  })

  test('Leere Eingabe legt kein Ziel an', async ({ page }) => {
    await login(page)
    const input = page.getByPlaceholder('Zielfirma hinzufügen (Enter bestätigt)...')
    await input.fill('   ')
    await input.press('Enter')
    // weiterhin genau die zwei bestehenden Ziele
    await expect(page.getByText('QA23 Alpha Consulting', { exact: true })).toBeVisible()
    await expect(page.getByText('QA23 Wunschfirma GmbH', { exact: true })).toBeVisible()
  })

  test('Löschen entfernt Ziel nach Bestätigungsdialog', async ({ page }) => {
    await login(page)
    await page
      .getByRole('button', { name: 'Zielfirma QA23 Wunschfirma GmbH löschen' })
      .click()
    await expect(page.getByText('Zielfirma löschen?')).toBeVisible()
    await page.getByRole('button', { name: 'Löschen' }).click()

    await expect(page.getByText('QA23 Wunschfirma GmbH')).toBeHidden()
    // anderes Ziel bleibt
    await expect(page.getByText('QA23 Alpha Consulting', { exact: true })).toBeVisible()
  })
})
