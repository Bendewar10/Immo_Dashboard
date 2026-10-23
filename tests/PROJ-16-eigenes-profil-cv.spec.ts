import path from 'node:path'
import { test, expect, type Page } from '@playwright/test'

const EMAIL = process.env.QA_TEST_EMAIL!
const PASSWORD = process.env.QA_TEST_PASSWORD!
const SUPABASE_URL = process.env.QA_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_ANON_KEY =
  process.env.QA_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const AI_TIMEOUT = 60000
const TEST_CV_PATH = path.join(__dirname, 'fixtures', 'test-cv.pdf')

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

async function restGet(token: string, path: string) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
  })
  return res.json()
}

async function seedEmployment(token: string, userId: string, employer: string) {
  await fetch(`${SUPABASE_URL}/rest/v1/user_employment`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ user_id: userId, employer }),
  })
}

async function wipeProfile(token: string, userId: string) {
  await fetch(`${SUPABASE_URL}/rest/v1/user_education?user_id=eq.${userId}`, {
    method: 'DELETE',
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
  })
  await fetch(`${SUPABASE_URL}/rest/v1/user_employment?user_id=eq.${userId}`, {
    method: 'DELETE',
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
  })
  await fetch(`${SUPABASE_URL}/rest/v1/user_profile?user_id=eq.${userId}`, {
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

async function gotoLebenslauf(page: Page) {
  await page.goto('/profil/lebenslauf')
  await expect(page.getByText('Lädt...')).toHaveCount(0)
}

test.describe.serial('PROJ-16: Eigenes Profil (CV)', () => {
  test.setTimeout(90000)

  let token: string
  let userId: string

  test.beforeAll(async () => {
    token = await getToken()
    userId = await getUserId(token)
  })

  test.beforeEach(async () => {
    await wipeProfile(token, userId)
  })

  test.afterAll(async () => {
    await wipeProfile(token, userId)
  })

  test('AC: "Mein Lebenslauf" entry point on /profil links to /profil/lebenslauf', async ({ page }) => {
    await login(page)
    await page.goto('/profil')
    await page.getByText('Mein Lebenslauf').click()
    await expect(page).toHaveURL('http://localhost:3000/profil/lebenslauf')
  })

  test('AC: empty state shown when no profile data exists', async ({ page }) => {
    await login(page)
    await gotoLebenslauf(page)
    await expect(page.getByText('Noch kein Profil angelegt.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'CV hochladen' })).toBeVisible()
    await expect(page.getByRole('button', { name: '+ Ausbildung hinzufügen' })).toBeVisible()
    await expect(page.getByRole('button', { name: '+ Berufserfahrung hinzufügen' })).toBeVisible()
  })

  test('AC: empty institution shows validation error, entry not created', async ({ page }) => {
    await login(page)
    await gotoLebenslauf(page)
    await page.getByRole('button', { name: '+ Ausbildung hinzufügen' }).click()
    await page.getByRole('button', { name: 'Speichern' }).click()
    await expect(page.getByText('Institution ist erforderlich')).toBeVisible()
  })

  test('AC: manual education entry is saved and listed', async ({ page }) => {
    await login(page)
    await gotoLebenslauf(page)
    await page.getByRole('button', { name: '+ Ausbildung hinzufügen' }).click()
    await page.getByLabel('Institution').fill('RWTH Aachen')
    await page.getByLabel('Abschluss').fill('M.Sc. Maschinenbau')
    await page.getByRole('button', { name: 'Speichern' }).click()
    await expect(page.getByText('RWTH Aachen')).toBeVisible()
    await expect(page.getByText('M.Sc. Maschinenbau')).toBeVisible()
  })

  test('AC: end date before start date shows validation error (education)', async ({ page }) => {
    await login(page)
    await gotoLebenslauf(page)
    await page.getByRole('button', { name: '+ Ausbildung hinzufügen' }).click()
    await page.getByLabel('Institution').fill('RWTH Aachen')
    await page.getByLabel('Startdatum').fill('2020-01-01')
    await page.getByLabel('Enddatum').fill('2019-01-01')
    await page.getByRole('button', { name: 'Speichern' }).click()
    await expect(page.getByText('Enddatum darf nicht vor dem Startdatum liegen')).toBeVisible()
  })

  test('AC: editing an education entry persists new values', async ({ page }) => {
    await login(page)
    await gotoLebenslauf(page)
    await page.getByRole('button', { name: '+ Ausbildung hinzufügen' }).click()
    await page.getByLabel('Institution').fill('RWTH Aachen')
    await page.getByRole('button', { name: 'Speichern' }).click()
    await expect(page.getByText('RWTH Aachen')).toBeVisible()

    await page.getByText('RWTH Aachen').click()
    await expect(page.getByLabel('Institution')).toHaveValue('RWTH Aachen')
    await page.getByLabel('Institution').fill('RWTH Aachen (geändert)')
    await page.getByRole('button', { name: 'Speichern' }).click()
    await expect(page.getByText('RWTH Aachen (geändert)')).toBeVisible()
  })

  test('AC: deleting an education entry removes only that entry', async ({ page }) => {
    // Seed an employment entry so the page stays in the full layout (not the
    // top-level empty state) once the education entry is deleted, letting us
    // assert the per-section empty message.
    await seedEmployment(token, userId, 'McKinsey & Company')

    await login(page)
    await gotoLebenslauf(page)
    await page.getByRole('button', { name: '+ Ausbildung hinzufügen' }).click()
    await page.getByLabel('Institution').fill('RWTH Aachen')
    await page.getByRole('button', { name: 'Speichern' }).click()
    await expect(page.getByText('RWTH Aachen')).toBeVisible()

    await page.getByRole('button', { name: 'Ausbildung löschen' }).click()
    await expect(page.getByText('RWTH Aachen')).toHaveCount(0)
    await expect(page.getByText('Noch keine Ausbildung hinterlegt.')).toBeVisible()
  })

  test('AC: manual employment entry is saved and listed', async ({ page }) => {
    // Empty state only offers an "Ausbildung" entry point (see BUG-1 in QA
    // results) — seed an education row to reach the full layout where the
    // "+ Berufserfahrung hinzufügen" button exists.
    await fetch(`${SUPABASE_URL}/rest/v1/user_education`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ user_id: userId, institution: 'Platzhalter-Uni' }),
    })

    await login(page)
    await gotoLebenslauf(page)
    await page.getByRole('button', { name: '+ Berufserfahrung hinzufügen' }).click()
    await page.getByLabel('Arbeitgeber').fill('McKinsey & Company')
    await page.getByLabel('Rolle').fill('Senior Consultant')
    await page.getByRole('button', { name: 'Speichern' }).click()
    await expect(page.getByText('McKinsey & Company')).toBeVisible()
    await expect(page.getByText('Senior Consultant')).toBeVisible()
  })

  test('AC: non-PDF file upload shows validation error', async ({ page }) => {
    await login(page)
    await gotoLebenslauf(page)
    await page.getByRole('button', { name: 'CV hochladen' }).click()

    const buffer = Buffer.from('not a pdf')
    await page.getByLabel('Lebenslauf-PDF').setInputFiles({
      name: 'test.txt',
      mimeType: 'text/plain',
      buffer,
    })
    await expect(page.getByText('Bitte eine PDF-Datei hochladen.')).toBeVisible()
  })

  test('AC: uploading a CV parses it and shows an editable review before saving', async ({ page }) => {
    await login(page)
    await gotoLebenslauf(page)
    await page.getByRole('button', { name: 'CV hochladen' }).click()
    await page.getByLabel('Lebenslauf-PDF').setInputFiles(TEST_CV_PATH)

    await expect(page.getByText('Erkannte Lebenslauf-Daten prüfen')).toBeVisible({ timeout: AI_TIMEOUT })
    await expect(page.getByRole('button', { name: 'Bestätigen' })).toBeVisible()

    await page.getByRole('button', { name: 'Bestätigen' }).click()
    await expect(page.getByText('Erkannte Lebenslauf-Daten prüfen')).toHaveCount(0, { timeout: AI_TIMEOUT })

    await expect(async () => {
      const profile = await restGet(token, `user_profile?user_id=eq.${userId}`)
      expect(profile).toHaveLength(1)
      expect(profile[0].cv_file_path).toContain(userId)
    }).toPass({ timeout: AI_TIMEOUT })
  })

  test('AC: cancelling the CV review dialog saves nothing', async ({ page }) => {
    await login(page)
    await gotoLebenslauf(page)
    await page.getByRole('button', { name: 'CV hochladen' }).click()
    await page.getByLabel('Lebenslauf-PDF').setInputFiles(TEST_CV_PATH)

    await expect(page.getByText('Erkannte Lebenslauf-Daten prüfen')).toBeVisible({ timeout: AI_TIMEOUT })
    await page.getByRole('button', { name: 'Abbrechen' }).click()
    await expect(page.getByText('Erkannte Lebenslauf-Daten prüfen')).toHaveCount(0)

    const profile = await restGet(token, `user_profile?user_id=eq.${userId}`)
    expect(profile).toHaveLength(0)
    const education = await restGet(token, `user_education?user_id=eq.${userId}`)
    expect(education).toHaveLength(0)
  })

  test('SECURITY: profile data is not returned without owner authentication (RLS)', async () => {
    await wipeProfile(token, userId)
    await fetch(`${SUPABASE_URL}/rest/v1/user_profile`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ user_id: userId, headline: 'RLS Test Headline' }),
    })

    const res = await fetch(`${SUPABASE_URL}/rest/v1/user_profile?user_id=eq.${userId}`, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
    })
    const rows = await res.json()
    expect(rows).toHaveLength(0)

    const ownRows = await restGet(token, `user_profile?user_id=eq.${userId}`)
    expect(ownRows).toHaveLength(1)
  })
})
