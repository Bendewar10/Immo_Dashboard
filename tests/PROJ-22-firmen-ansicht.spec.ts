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

// Kontakte mit vorab gesetzter Normalisierung (KI-Lauf wird hier nicht getestet,
// der ist durch Integrationstests abgedeckt) + ein Roh-Fallback + einer ohne Firma
async function seedContacts(token: string, userId: string) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/contacts`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify([
      {
        user_id: userId,
        first_name: 'QA22 Anna',
        last_name: 'Alpha',
        employer: 'McKinsey',
        employer_normalized: 'QA22 McKinsey & Company',
        employer_normalized_source: 'ai',
        job_title: 'Partner',
        last_contacted_at: new Date('2026-06-01').toISOString(),
      },
      {
        user_id: userId,
        first_name: 'QA22 Bernd',
        last_name: 'Beta',
        employer: 'McKinsey & Co.',
        employer_normalized: 'QA22 McKinsey & Company',
        employer_normalized_source: 'ai',
        job_title: 'Associate',
        last_contacted_at: null,
      },
      {
        user_id: userId,
        first_name: 'QA22 Clara',
        last_name: 'Gamma',
        employer: 'QA22 Bain Capital',
        employer_normalized: null,
        employer_normalized_source: null,
        job_title: null,
        last_contacted_at: null,
      },
      {
        user_id: userId,
        first_name: 'QA22 David',
        last_name: 'Delta',
        employer: null,
        employer_normalized: null,
        employer_normalized_source: null,
        job_title: null,
        last_contacted_at: null,
      },
    ]),
  })
  const json = await res.json()
  if (!res.ok || !Array.isArray(json)) {
    throw new Error(`Seed fehlgeschlagen (${res.status}): ${JSON.stringify(json).slice(0, 200)}`)
  }
  return json as { id: string; first_name: string }[]
}

async function seedInteraction(token: string, userId: string, contactId: string) {
  await fetch(`${SUPABASE_URL}/rest/v1/interactions`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify([
      { user_id: userId, contact_id: contactId, occurred_at: '2026-06-01', channel: 'meeting' },
    ]),
  })
}

async function cleanupContacts(token: string) {
  await fetch(`${SUPABASE_URL}/rest/v1/contacts?first_name=like.QA22*`, {
    method: 'DELETE',
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
  })
}

async function clickCompany(page: Page, company: string) {
  await page
    .getByRole('button', { name: `Alle Kontakte bei ${company} anzeigen` })
    .first()
    .click()
}

async function login(page: Page) {
  // Ein Retry gegen Supabase-Auth-Rate-Limit (Suite macht pro Lauf ~20 Passwort-Logins)
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
  await page.goto('/contacts')
  await expect(page.getByText('QA22 Anna Alpha')).toBeVisible({ timeout: 15000 })
}

test.describe.serial('PROJ-22 Firmen-Ansicht', () => {
  let token: string
  let userId: string

  test.beforeAll(async () => {
    token = await getToken()
    userId = await getUserId(token)
    await cleanupContacts(token)
    const seeded = await seedContacts(token, userId)
    const anna = seeded.find((c) => c.first_name === 'QA22 Anna')
    if (anna) await seedInteraction(token, userId, anna.id)
  })

  test.afterAll(async () => {
    await cleanupContacts(token)
  })

  test('Klick auf Firmennamen filtert Liste und zeigt Header-Karte', async ({ page }) => {
    await login(page)
    await clickCompany(page, 'QA22 McKinsey & Company')

    await expect(page.getByText('QA22 Anna Alpha')).toBeVisible()
    await expect(page.getByText('QA22 Bernd Beta')).toBeVisible()
    await expect(page.getByText('QA22 Clara Gamma')).toBeHidden()
    await expect(page.getByText('QA22 David Delta')).toBeHidden()

    // Header-Karte: Name, Anzahl, letzter Touchpoint
    await expect(page.getByText('2 Kontakte')).toBeVisible()
    // Datumsformat variiert je nach ICU der Browser-Build (1.6.2026 vs. 01.06.2026)
    await expect(page.getByText(/Letzter Touchpoint: 0?1\.0?6\.2026/)).toBeVisible()
  })

  test('Schreibweisen-Varianten erscheinen unter einem normalisierten Namen', async ({ page }) => {
    await login(page)
    // Anna (roh "McKinsey") und Bernd (roh "McKinsey & Co.") teilen die Gruppe
    await page.getByRole('combobox').filter({ hasText: 'Firma wählen' }).click()
    const option = page.getByRole('option', { name: /QA22 McKinsey & Company/ })
    await expect(option).toBeVisible()
    await expect(option).toContainText('2')
    await option.click()

    await expect(page.getByText('QA22 Anna Alpha')).toBeVisible()
    await expect(page.getByText('QA22 Bernd Beta')).toBeVisible()
  })

  test('Header-Karte zeigt Mini-Timeline mit Interaktionen', async ({ page }) => {
    await login(page)
    await clickCompany(page, 'QA22 McKinsey & Company')

    await expect(page.getByText(/0?1\.0?6\.2026/).first()).toBeVisible()
    await expect(page.getByText('Treffen')).toBeVisible()
  })

  test('Firma ohne Interaktionen zeigt Empty State in Header-Karte', async ({ page }) => {
    await login(page)
    await clickCompany(page, 'QA22 Bain Capital')

    await expect(page.getByText('Noch keine Interaktionen').first()).toBeVisible()
  })

  test('X auf Header-Karte hebt Firmen-Filter auf', async ({ page }) => {
    await login(page)
    await clickCompany(page, 'QA22 McKinsey & Company')
    await expect(page.getByText('QA22 Clara Gamma')).toBeHidden()

    await page.getByRole('button', { name: 'Firmen-Filter aufheben' }).click()
    await expect(page.getByText('QA22 Clara Gamma')).toBeVisible()
    await expect(page.getByText('2 Kontakte')).toBeHidden()
  })

  test('Firmen-Filter kombiniert sich mit anderen Filtern (UND)', async ({ page }) => {
    await login(page)
    await clickCompany(page, 'QA22 McKinsey & Company')
    await page.getByPlaceholder('Name suchen...').fill('Anna')

    await expect(page.getByText('QA22 Anna Alpha')).toBeVisible()
    await expect(page.getByText('QA22 Bernd Beta')).toBeHidden()
  })

  test('Kontakt ohne Firma: kein Klick-Target, in keiner Gruppe', async ({ page }) => {
    await login(page)
    const davidCard = page.locator('div').filter({ hasText: /^QA22 David Delta/ }).first()
    await expect(davidCard.getByRole('button', { name: /Alle Kontakte bei/ })).toHaveCount(0)

    await page.getByRole('combobox').filter({ hasText: 'Firma wählen' }).click()
    await page.getByPlaceholder('Firma suchen...').fill('QA22')
    await expect(page.getByRole('option', { name: /QA22 McKinsey & Company/ })).toBeVisible()
    await expect(page.getByRole('option', { name: /David/ })).toHaveCount(0)
  })

  test('Roh-Fallback: Kontakt ohne Normalisierung erscheint unter rohem Namen', async ({ page }) => {
    await login(page)
    await page.getByRole('combobox').filter({ hasText: 'Firma wählen' }).click()
    await page.getByPlaceholder('Firma suchen...').fill('QA22 Bain')
    const option = page.getByRole('option', { name: /QA22 Bain Capital/ })
    await expect(option).toBeVisible()
    await option.click()

    await expect(page.getByText('QA22 Clara Gamma')).toBeVisible()
    await expect(page.getByText('QA22 Anna Alpha')).toBeHidden()
  })

  test('Einzelkontakt-Firma funktioniert identisch', async ({ page }) => {
    await login(page)
    await clickCompany(page, 'QA22 Bain Capital')
    await expect(page.getByText('1 Kontakt', { exact: true })).toBeVisible()
    await expect(page.getByText('QA22 Clara Gamma')).toBeVisible()
  })

  // Bewusst letzter Test: ändert Claras Gruppierung dauerhaft (kein UI-Reset,
  // weil der anschließende echte KI-Lauf QA22-Prefixe unvorhersehbar gruppiert);
  // afterAll-Cleanup löscht die Seed-Kontakte ohnehin
  test('Manuelle Korrektur am Kontakt verschiebt ihn in andere Firmen-Gruppe', async ({ page }) => {
    await login(page)
    await page.getByText('QA22 Clara Gamma').click()
    const normalizedInput = page.getByLabel('Firma (normalisiert)')
    await expect(normalizedInput).toBeVisible()
    await normalizedInput.fill('QA22 McKinsey & Company')
    await page.getByRole('button', { name: 'Speichern' }).click()

    await expect(normalizedInput).toBeHidden()
    await clickCompany(page, 'QA22 McKinsey & Company')
    await expect(page.getByText('QA22 Clara Gamma')).toBeVisible()
    await expect(page.getByText('3 Kontakte')).toBeVisible()
  })
})
