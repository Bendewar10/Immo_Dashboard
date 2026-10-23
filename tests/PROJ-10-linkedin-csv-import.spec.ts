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

async function seedContact(token: string, userId: string, fields: Record<string, unknown>) {
  await fetch(`${SUPABASE_URL}/rest/v1/contacts`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({ user_id: userId, ...fields }),
  })
}

async function cleanupContacts(token: string) {
  // contact_events rows cascade-delete with their contact (ON DELETE CASCADE), no separate cleanup needed
  await fetch(`${SUPABASE_URL}/rest/v1/contacts?first_name=like.QA10*`, {
    method: 'DELETE',
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
  })
}

async function getContactIdByName(token: string, firstName: string) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/contacts?first_name=eq.${encodeURIComponent(firstName)}&select=id`,
    { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` } }
  )
  const [contact] = await res.json()
  return contact.id as string
}

async function getOpenEventTypes(token: string, contactId: string) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/contact_events?contact_id=eq.${contactId}&dismissed_at=is.null&select=type`,
    { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` } }
  )
  const rows: { type: string }[] = await res.json()
  return rows.map((r) => r.type).sort()
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

function csvFile(name: string, content: string) {
  return { name, mimeType: 'text/csv', buffer: Buffer.from(content, 'utf-8') }
}

const HEADER = 'First Name,Last Name,URL,Email Address,Company,Position,Connected On'

test.describe.serial('PROJ-10: LinkedIn-CSV-Import', () => {
  let token: string
  let userId: string

  test.beforeAll(async () => {
    token = await getToken()
    userId = await getUserId(token)
    await cleanupContacts(token)
    await seedContact(token, userId, {
      first_name: 'QA10ExistingMatch',
      category: 'private',
      employer: 'OldCo',
    })
  })

  test.afterAll(async () => {
    await cleanupContacts(token)
  })

  test('AC: invalid file without LinkedIn header shows error, no import attempted', async ({ page }) => {
    await login(page)
    await page.getByRole('button', { name: 'LinkedIn importieren' }).click()
    await page
      .getByLabel('LinkedIn-CSV-Datei')
      .setInputFiles(csvFile('bad.csv', 'not,a,linkedin,export\nfoo,bar,baz'))
    await expect(page.getByText('Keine gültige LinkedIn-Export-Datei.')).toBeVisible()
    await page.getByRole('button', { name: 'Schließen' }).click()
  })

  test('AC: preview shows grouped review lists with occasion tag, cancel applies no changes', async ({ page }) => {
    await login(page)
    await page.getByRole('button', { name: 'LinkedIn importieren' }).click()
    const csv = [
      HEADER,
      'QA10ExistingMatch,,https://linkedin.com/in/qa10-existing,,NewCo,,01 Jan 2026',
      'QA10CancelNew,Person,https://linkedin.com/in/qa10-cancel,,,,01 Jan 2026',
      ',Nobody,,,,,01 Jan 2026',
    ].join('\n')
    await page.getByLabel('LinkedIn-CSV-Datei').setInputFiles(csvFile('preview.csv', csv))

    await expect(page.getByText('Neue Kontakte (1)')).toBeVisible()
    await expect(page.getByText('Veränderungen (1)')).toBeVisible()
    await expect(page.getByText('Jobwechsel')).toBeVisible()
    await expect(page.getByText('0 unverändert')).toBeVisible()
    await expect(page.getByText('1 übersprungen (kein Vorname)')).toBeVisible()

    await page.getByRole('button', { name: 'Abbrechen' }).click()
    await expect(page.getByText('QA10CancelNew')).not.toBeVisible()
  })

  test('AC: first-time fill of a previously empty field shows "Neu erfasst" instead of an occasion tag', async ({
    page,
  }) => {
    await login(page)
    await page.getByRole('button', { name: 'LinkedIn importieren' }).click()
    const csv = [HEADER, 'QA10ExistingMatch,,,,,QA10NewTitle,01 Jan 2026'].join('\n')
    await page.getByLabel('LinkedIn-CSV-Datei').setInputFiles(csvFile('new-fill.csv', csv))
    await expect(page.getByText('Veränderungen (1)')).toBeVisible()
    await expect(page.getByText('Neu erfasst')).toBeVisible()
    await expect(page.getByText('Beförderung')).not.toBeVisible()
    await page.getByRole('button', { name: 'Abbrechen' }).click()
  })

  test('AC: unchecking a new-contact row excludes it from saving on confirm', async ({ page }) => {
    await login(page)
    await page.getByRole('button', { name: 'LinkedIn importieren' }).click()
    const csv = [
      HEADER,
      'QA10ExcludedNew,Person,https://linkedin.com/in/qa10-excluded,,,,01 Jan 2026',
    ].join('\n')
    await page.getByLabel('LinkedIn-CSV-Datei').setInputFiles(csvFile('excluded.csv', csv))
    await expect(page.getByText('Neue Kontakte (1)')).toBeVisible()

    await page.getByLabel('QA10ExcludedNew Person übernehmen').click()
    await page.getByRole('button', { name: 'Bestätigen' }).click()
    await expect(page.getByText('0 neu, 0 aktualisiert, 0 unverändert, 0 übersprungen.')).toBeVisible()
    await page.getByRole('button', { name: 'Schließen' }).click()
    await expect(page.getByText('QA10ExcludedNew')).not.toBeVisible()
  })

  test('AC: unchecking a change row excludes all of that person\'s field updates from saving', async ({ page }) => {
    await login(page)
    await page.getByRole('button', { name: 'LinkedIn importieren' }).click()
    const csv = [
      HEADER,
      'QA10ExistingMatch,,https://linkedin.com/in/qa10-existing,,SkippedCo,,01 Jan 2026',
    ].join('\n')
    await page.getByLabel('LinkedIn-CSV-Datei').setInputFiles(csvFile('skip-change.csv', csv))
    await expect(page.getByText('Veränderungen (1)')).toBeVisible()

    await page.getByLabel('Änderungen für QA10ExistingMatch übernehmen').click()
    await page.getByRole('button', { name: 'Bestätigen' }).click()
    await expect(page.getByText('0 neu, 0 aktualisiert, 0 unverändert, 0 übersprungen.')).toBeVisible()
    await page.getByRole('button', { name: 'Schließen' }).click()

    await page.getByText('QA10ExistingMatch', { exact: true }).click()
    await expect(page.getByLabel('Arbeitgeber')).toHaveValue('OldCo')
    await page.getByRole('button', { name: 'Abbrechen' }).click()

    // AC (Persistenz für Dashboard): excluded change row -> no contact_events row written
    const contactId = await getContactIdByName(token, 'QA10ExistingMatch')
    expect(await getOpenEventTypes(token, contactId)).toEqual([])
  })

  test('AC (Persistenz für Dashboard): a first-time fill ("Neu erfasst") writes no contact_events row', async ({
    page,
  }) => {
    await login(page)
    await page.getByRole('button', { name: 'LinkedIn importieren' }).click()
    const csv = [HEADER, 'QA10ExistingMatch,,,,,QA10ConfirmedNewTitle,01 Jan 2026'].join('\n')
    await page.getByLabel('LinkedIn-CSV-Datei').setInputFiles(csvFile('confirm-new-fill.csv', csv))
    await expect(page.getByText('Neu erfasst')).toBeVisible()

    await page.getByRole('button', { name: 'Bestätigen' }).click()
    await expect(page.getByText(/aktualisiert/)).toBeVisible()
    await page.getByRole('button', { name: 'Schließen' }).click()

    const contactId = await getContactIdByName(token, 'QA10ExistingMatch')
    expect(await getOpenEventTypes(token, contactId)).toEqual([])
  })

  test('AC: editing a value in the preview before confirming saves the edited value, not the CSV value', async ({
    page,
  }) => {
    await login(page)
    await page.getByRole('button', { name: 'LinkedIn importieren' }).click()
    const csv = [
      HEADER,
      'QA10ExistingMatch,,https://linkedin.com/in/qa10-existing,,NewCo,,01 Jan 2026',
    ].join('\n')
    await page.getByLabel('LinkedIn-CSV-Datei').setInputFiles(csvFile('edit.csv', csv))
    await expect(page.getByText('Veränderungen (1)')).toBeVisible()

    await page.locator('input[value="NewCo"]').fill('CorrectedCo')
    await page.getByRole('button', { name: 'Bestätigen' }).click()
    await expect(page.getByText('0 neu, 1 aktualisiert, 0 unverändert, 0 übersprungen.')).toBeVisible()
    await page.getByRole('button', { name: 'Schließen' }).click()

    await page.getByText('QA10ExistingMatch', { exact: true }).click()
    await expect(page.getByLabel('Arbeitgeber')).toHaveValue('CorrectedCo')
    await page.getByRole('button', { name: 'Abbrechen' }).click()
  })

  test('AC: confirming import creates new contacts and updates matched ones, leaves other fields untouched', async ({
    page,
  }) => {
    await login(page)
    await page.getByRole('button', { name: 'LinkedIn importieren' }).click()
    const csv = [
      HEADER,
      'QA10ExistingMatch,,https://linkedin.com/in/qa10-existing,,NewCo,,01 Jan 2026',
      'QA10BrandNew,Person,https://linkedin.com/in/qa10-new,new@example.com,Acme,Dev,01 Jan 2026',
    ].join('\n')
    await page.getByLabel('LinkedIn-CSV-Datei').setInputFiles(csvFile('import.csv', csv))
    await expect(page.getByText('Neue Kontakte (1)')).toBeVisible()

    await page.getByRole('button', { name: 'Bestätigen' }).click()
    await expect(page.getByText('1 neu, 1 aktualisiert, 0 unverändert, 0 übersprungen.')).toBeVisible()
    await page.getByRole('button', { name: 'Schließen' }).click()

    await expect(page.getByText('QA10BrandNew Person')).toBeVisible()

    await page.getByText('QA10ExistingMatch', { exact: true }).click()
    await expect(page.getByLabel('Arbeitgeber')).toHaveValue('NewCo')
    const categoryTrigger = page.getByLabel('Kontakttyp')
    await expect(categoryTrigger).toContainText('Privat')
    await page.getByRole('button', { name: 'Abbrechen' }).click()

    // AC (Persistenz für Dashboard): confirmed employer change with non-empty old value writes a Jobwechsel event
    const contactId = await getContactIdByName(token, 'QA10ExistingMatch')
    expect(await getOpenEventTypes(token, contactId)).toContain('Jobwechsel')
  })

  test('AC: re-uploading the same file afterwards reports no further updates (idempotent)', async ({ page }) => {
    await login(page)
    await page.getByRole('button', { name: 'LinkedIn importieren' }).click()
    const csv = [
      HEADER,
      'QA10ExistingMatch,,https://linkedin.com/in/qa10-existing,,NewCo,,01 Jan 2026',
      'QA10BrandNew,Person,https://linkedin.com/in/qa10-new,new@example.com,Acme,Dev,01 Jan 2026',
    ].join('\n')
    await page.getByLabel('LinkedIn-CSV-Datei').setInputFiles(csvFile('reimport.csv', csv))

    await expect(page.getByText('Neue Kontakte')).not.toBeVisible()
    await expect(page.getByText('Veränderungen')).not.toBeVisible()
    await expect(page.getByText('2 unverändert')).toBeVisible()
  })
})
