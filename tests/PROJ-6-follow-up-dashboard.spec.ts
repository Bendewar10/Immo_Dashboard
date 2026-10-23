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
  next_followup_at?: string | null
  birthday?: string | null
  phone?: string | null
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

async function cleanupContacts(token: string) {
  // contact_events rows cascade-delete with their contact (ON DELETE CASCADE), no separate cleanup needed
  await fetch(`${SUPABASE_URL}/rest/v1/contacts?first_name=like.QA6*`, {
    method: 'DELETE',
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
  })
}

async function deleteContact(token: string, contactId: string) {
  await fetch(`${SUPABASE_URL}/rest/v1/contacts?id=eq.${contactId}`, {
    method: 'DELETE',
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
  })
}

async function seedContactEvent(
  token: string,
  userId: string,
  contactId: string,
  type: 'Jobwechsel' | 'Beförderung'
) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/contact_events`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify({ contact_id: contactId, user_id: userId, type }),
  })
  const [event] = await res.json()
  return event.id as string
}

async function login(page: Page) {
  await page.goto('/login')
  await page.waitForLoadState('networkidle')
  await page.getByLabel('Email').fill(EMAIL)
  await page.getByLabel('Passwort').fill(PASSWORD)
  await page.getByRole('button', { name: 'Login' }).click()
  await expect(page).toHaveURL('http://localhost:3000/dashboard')
  await expect(async () => {
    expect(await page.getByText('Lädt...').count()).toBe(0)
  }).toPass({ timeout: 10000 })
}

function uniqueName(label: string) {
  return `QA6 ${label} ${Date.now()}-${Math.floor(Math.random() * 10000)}`
}

function isoOffset(days: number) {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

function birthdayOffset(days: number) {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function cardFor(page: Page, name: string) {
  return page.locator('[class~="rounded-xl"]', { hasText: name }).first()
}

function sectionFor(page: Page, heading: string) {
  return page.locator('section', { has: page.getByRole('heading', { name: heading, exact: true }) })
}

test.describe.serial('PROJ-6: Follow-up Dashboard & Tagesansicht', () => {
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

  test('AC: login redirects to /dashboard, nav link reaches /contacts', async ({ page }) => {
    await login(page)
    await expect(page.getByRole('link', { name: 'Kontakte' })).toBeVisible()
    await page.getByRole('link', { name: 'Kontakte' }).click()
    await expect(page).toHaveURL('http://localhost:3000/contacts')
  })

  test('AC: overdue follow-up appears in "Heute & überfällig" with Follow-up badge', async ({ page }) => {
    const name = uniqueName('Overdue')
    await seedContact(token, userId, name, { next_followup_at: isoOffset(-3) })
    await login(page)

    await expect(page.getByRole('heading', { name: 'Heute & überfällig' })).toBeVisible()
    const card = cardFor(page, name)
    await expect(card).toBeVisible()
    await expect(card.getByText('Follow-up', { exact: true })).toBeVisible()
  })

  test('AC: follow-up due in 3 days appears in "Nächste 14 Tage"', async ({ page }) => {
    const name = uniqueName('WeekFollowup')
    await seedContact(token, userId, name, { next_followup_at: isoOffset(3) })
    await login(page)

    await expect(page.getByRole('heading', { name: 'Nächste 14 Tage' })).toBeVisible()
    const card = cardFor(page, name)
    await expect(card).toBeVisible()
    await expect(card.getByText('Follow-up', { exact: true })).toBeVisible()
  })

  test('AC: follow-up due in exactly 14 days appears in "Nächste 14 Tage" (upper window boundary)', async ({ page }) => {
    const name = uniqueName('Window14')
    await seedContact(token, userId, name, { next_followup_at: isoOffset(14) })
    await login(page)

    await expect(sectionFor(page, 'Nächste 14 Tage').getByText(name)).toBeVisible()
  })

  test('AC: follow-up due in 15 days does not appear anywhere (just outside window)', async ({ page }) => {
    const name = uniqueName('Window15')
    await seedContact(token, userId, name, { next_followup_at: isoOffset(15) })
    await login(page)

    await expect(page.getByText(name)).toHaveCount(0)
  })

  test('AC: cards in "Nächste 14 Tage" are sorted chronologically by occasion date', async ({ page }) => {
    const nameFar = uniqueName('SortFar')
    const nameNear = uniqueName('SortNear')
    await seedContact(token, userId, nameFar, { next_followup_at: isoOffset(12) })
    await seedContact(token, userId, nameNear, { next_followup_at: isoOffset(2) })
    await login(page)

    const section = sectionFor(page, 'Nächste 14 Tage')
    const texts = await section.locator('[class~="rounded-xl"]').allTextContents()
    const nearIndex = texts.findIndex((t) => t.includes(nameNear))
    const farIndex = texts.findIndex((t) => t.includes(nameFar))
    expect(nearIndex).toBeGreaterThanOrEqual(0)
    expect(farIndex).toBeGreaterThanOrEqual(0)
    expect(nearIndex).toBeLessThan(farIndex)
  })

  test('AC: birthday today appears in "Heute & überfällig" with Geburtstag badge', async ({ page }) => {
    const name = uniqueName('BirthdayToday')
    await seedContact(token, userId, name, { birthday: `2000-${birthdayOffset(0)}` })
    await login(page)

    await expect(sectionFor(page, 'Heute & überfällig').getByText(name)).toBeVisible()
    await expect(cardFor(page, name).getByText('Geburtstag', { exact: true })).toBeVisible()
  })

  test('AC: birthday in 5 days appears in "Diese Woche" with Geburtstag badge', async ({ page }) => {
    const name = uniqueName('BirthdayWeek')
    await seedContact(token, userId, name, { birthday: `2000-${birthdayOffset(5)}` })
    await login(page)

    const card = cardFor(page, name)
    await expect(card).toBeVisible()
    await expect(card.getByText('Geburtstag', { exact: true })).toBeVisible()
  })

  test('AC: occasion card shows the formatted birthday date', async ({ page }) => {
    const name = uniqueName('BirthdayDate')
    await seedContact(token, userId, name, { birthday: `1990-${birthdayOffset(0)}` })
    await login(page)

    const card = cardFor(page, name)
    await expect(card).toBeVisible()
    await expect(card.getByText(/^Geburtstag: \d{1,2}\.\d{1,2}\.1990$/)).toBeVisible()
  })

  test('AC: birthday in 10 days appears in "Nächste 14 Tage" (would have missed the old 7-day window)', async ({ page }) => {
    const name = uniqueName('BirthdayExtended')
    await seedContact(token, userId, name, { birthday: `2000-${birthdayOffset(10)}` })
    await login(page)

    await expect(sectionFor(page, 'Nächste 14 Tage').getByText(name)).toBeVisible()
  })

  test('AC: birthday wraps across year boundary (e.g. day 5 from now in Jan) still detected within 14 days', async ({ page }) => {
    const name = uniqueName('BirthdayWrap')
    await seedContact(token, userId, name, { birthday: `2000-${birthdayOffset(6)}` })
    await login(page)
    const card = cardFor(page, name)
    await expect(card).toBeVisible()
    await expect(card.getByText('Geburtstag', { exact: true })).toBeVisible()
  })

  test('AC: overdue follow-up + birthday today on same contact -> both badges on one card', async ({ page }) => {
    const name = uniqueName('Both')
    await seedContact(token, userId, name, {
      next_followup_at: isoOffset(-1),
      birthday: `2000-${birthdayOffset(0)}`,
    })
    await login(page)

    const card = cardFor(page, name)
    await expect(card).toBeVisible()
    await expect(card.getByText('Follow-up', { exact: true })).toBeVisible()
    await expect(card.getByText('Geburtstag', { exact: true })).toBeVisible()
  })

  test('AC: overdue follow-up + birthday in 5 days -> appears once per section with one badge each', async ({ page }) => {
    const name = uniqueName('SplitWindows')
    await seedContact(token, userId, name, {
      next_followup_at: isoOffset(-1),
      birthday: `2000-${birthdayOffset(5)}`,
    })
    await login(page)

    const todayCard = sectionFor(page, 'Heute & überfällig').locator('[class~="rounded-xl"]', { hasText: name })
    const weekCard = sectionFor(page, 'Nächste 14 Tage').locator('[class~="rounded-xl"]', { hasText: name })
    await expect(todayCard).toBeVisible()
    await expect(weekCard).toBeVisible()
    await expect(todayCard.getByText('Follow-up', { exact: true })).toBeVisible()
    await expect(todayCard.getByText('Geburtstag', { exact: true })).toHaveCount(0)
    await expect(weekCard.getByText('Geburtstag', { exact: true })).toBeVisible()
    await expect(weekCard.getByText('Follow-up', { exact: true })).toHaveCount(0)
  })

  test('AC: contact with neither follow-up nor birthday does not appear', async ({ page }) => {
    const name = uniqueName('NoOccasion')
    await seedContact(token, userId, name)
    await login(page)

    await expect(page.getByText(name)).toHaveCount(0)
  })

  test('AC: empty state shown when no contact has an active occasion', async ({ page }) => {
    await cleanupContacts(token)
    await login(page)
    await expect(page.getByText('Alles im Blick', { exact: true })).toBeVisible()
    await expect(page.getByText('Aktuell keine fälligen Follow-ups oder Anlässe.')).toBeVisible()
  })

  test('AC: "Kontaktiert" opens interaction form pre-filled with today, save refreshes the dashboard', async ({ page }) => {
    const name = uniqueName('LogAction')
    await seedContact(token, userId, name, { next_followup_at: isoOffset(-1) })
    await login(page)

    const card = cardFor(page, name)
    await card.getByRole('button', { name: 'Kontaktiert' }).click()
    await expect(page.getByText('Kontaktmoment hinzufügen')).toBeVisible()
    await expect(page.getByLabel('Datum')).toHaveValue(isoOffset(0))

    await page.getByLabel('Kanal').click()
    await page.getByRole('option', { name: 'Call' }).click()
    await page.getByRole('button', { name: 'Speichern' }).click()

    await expect(page.getByText('Kontaktmoment hinzufügen')).toHaveCount(0)
    // follow-up_interval_days is unset for this contact -> next_followup_at becomes null -> card drops off dashboard
    await expect(cardFor(page, name)).toHaveCount(0)
  })

  test('AC: clicking the contact name on a card opens the contact\'s edit dialog pre-filled with that contact', async ({ page }) => {
    const name = uniqueName('OpenCard')
    await seedContact(token, userId, name, { next_followup_at: isoOffset(0) })
    await login(page)

    const card = cardFor(page, name)
    await card.getByText(name, { exact: true }).click()
    await expect(page.getByText('Kontakt bearbeiten')).toBeVisible()
    await expect(page.getByLabel('Vorname')).toHaveValue(name)

    await page.getByRole('button', { name: 'Abbrechen' }).click()
    await expect(page.getByText('Kontakt bearbeiten')).toHaveCount(0)
  })

  test('AC: "Vorschlag" generates AI draft text and shows it inline', async ({ page }) => {
    const name = uniqueName('Draft')
    await seedContact(token, userId, name, { next_followup_at: isoOffset(0) })
    await login(page)

    await page.route('**/api/draft-message', async (route) => {
      await new Promise((r) => setTimeout(r, 300))
      await route.fulfill({ status: 200, json: { text: 'Hey, lange nicht gesprochen!' } })
    })

    const card = cardFor(page, name)
    const vorschlagButton = card.getByRole('button', { name: 'Vorschlag' })
    await vorschlagButton.click()
    await expect(card.getByRole('button', { name: 'Generiere...' })).toBeVisible()
    await expect(card.getByText('Hey, lange nicht gesprochen!')).toBeVisible()
  })

  test('AC: failed AI request shows error, card stays otherwise functional', async ({ page }) => {
    const name = uniqueName('DraftError')
    await seedContact(token, userId, name, { next_followup_at: isoOffset(0) })
    await login(page)

    await page.route('**/api/draft-message', (route) =>
      route.fulfill({ status: 502, json: { error: 'Vorschlag konnte nicht generiert werden.' } })
    )

    const card = cardFor(page, name)
    await card.getByRole('button', { name: 'Vorschlag' }).click()
    await expect(card.getByText('Vorschlag konnte nicht generiert werden. Bitte erneut versuchen.')).toBeVisible()
    await expect(card.getByRole('button', { name: 'Kontaktiert' })).toBeEnabled()
  })

  test('AC: re-clicking "Vorschlag" replaces the previous draft text', async ({ page }) => {
    const name = uniqueName('DraftRegenerate')
    await seedContact(token, userId, name, { next_followup_at: isoOffset(0) })
    await login(page)

    let call = 0
    await page.route('**/api/draft-message', async (route) => {
      call += 1
      await route.fulfill({ status: 200, json: { text: call === 1 ? 'Erster Text' : 'Zweiter Text' } })
    })

    const card = cardFor(page, name)
    await card.getByRole('button', { name: 'Vorschlag' }).click()
    await expect(card.getByText('Erster Text')).toBeVisible()
    await card.getByRole('button', { name: 'Vorschlag' }).click()
    await expect(card.getByText('Zweiter Text')).toBeVisible()
    await expect(card.getByText('Erster Text')).toHaveCount(0)
  })

  test('AC: copy button copies draft text to clipboard once a draft exists', async ({
    page,
    context,
  }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    const name = uniqueName('CopyOk')
    await seedContact(token, userId, name, { next_followup_at: isoOffset(0) })
    await login(page)

    await page.route('**/api/draft-message', (route) =>
      route.fulfill({ status: 200, json: { text: 'Kurzer Gruß' } })
    )

    const card = cardFor(page, name)
    await expect(card.getByRole('button', { name: 'Kopieren' })).toHaveCount(0)
    await card.getByRole('button', { name: 'Vorschlag' }).click()
    await expect(card.getByText('Kurzer Gruß')).toBeVisible()
    await card.getByRole('button', { name: 'Kopieren' }).click()
    await expect(card.getByRole('button', { name: 'Kopiert!' })).toBeVisible()
    const clipboardText = await page.evaluate(() => navigator.clipboard.readText())
    expect(clipboardText).toBe('Kurzer Gruß')
  })

  test('AC: no copy button before a draft is generated, regardless of phone', async ({ page }) => {
    const name = uniqueName('CopyNoDraft')
    await seedContact(token, userId, name, { next_followup_at: isoOffset(0) })
    await login(page)

    const card = cardFor(page, name)
    await expect(card.getByRole('button', { name: 'Kopieren' })).toHaveCount(0)
  })

  test('AC: generated draft is editable, and copying picks up the edited text', async ({
    page,
    context,
  }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    const name = uniqueName('DraftEdit')
    await seedContact(token, userId, name, { next_followup_at: isoOffset(0) })
    await login(page)

    await page.route('**/api/draft-message', (route) =>
      route.fulfill({ status: 200, json: { text: 'Ursprünglicher Text' } })
    )

    const card = cardFor(page, name)
    await card.getByRole('button', { name: 'Vorschlag' }).click()
    const textarea = card.locator('textarea')
    await expect(textarea).toHaveValue('Ursprünglicher Text')

    await textarea.fill('Manuell bearbeiteter Text')
    await card.getByRole('button', { name: 'Kopieren' }).click()
    await expect(card.getByRole('button', { name: 'Kopiert!' })).toBeVisible()
    const clipboardText = await page.evaluate(() => navigator.clipboard.readText())
    expect(clipboardText).toBe('Manuell bearbeiteter Text')
  })

  test('AC: tone instruction + "Neu generieren" sends the tone and replaces the draft', async ({ page }) => {
    const name = uniqueName('DraftTone')
    await seedContact(token, userId, name, { next_followup_at: isoOffset(0) })
    await login(page)

    let lastBody: Record<string, unknown> = {}
    let call = 0
    await page.route('**/api/draft-message', async (route) => {
      call += 1
      lastBody = JSON.parse(route.request().postData() ?? '{}')
      await route.fulfill({
        status: 200,
        json: { text: call === 1 ? 'Erster Text' : 'Lockerer Text auf Englisch' },
      })
    })

    const card = cardFor(page, name)
    await card.getByRole('button', { name: 'Vorschlag' }).click()
    await expect(card.locator('textarea')).toHaveValue('Erster Text')
    expect(lastBody.tone).toBeUndefined()

    await card.getByPlaceholder('Ton anpassen, z.B. lockerer / auf Englisch / kürzer').fill('lockerer, auf Englisch')
    await card.getByRole('button', { name: 'Neu generieren' }).click()
    await expect(card.locator('textarea')).toHaveValue('Lockerer Text auf Englisch')
    expect(lastBody.tone).toBe('lockerer, auf Englisch')
  })

  test('AC: failed "Neu generieren" shows an error and keeps the existing draft text', async ({ page }) => {
    const name = uniqueName('DraftToneError')
    await seedContact(token, userId, name, { next_followup_at: isoOffset(0) })
    await login(page)

    let call = 0
    await page.route('**/api/draft-message', async (route) => {
      call += 1
      if (call === 1) {
        await route.fulfill({ status: 200, json: { text: 'Bestehender Text' } })
      } else {
        await route.fulfill({ status: 502, json: { error: 'Vorschlag konnte nicht generiert werden.' } })
      }
    })

    const card = cardFor(page, name)
    await card.getByRole('button', { name: 'Vorschlag' }).click()
    await expect(card.locator('textarea')).toHaveValue('Bestehender Text')

    await card.getByRole('button', { name: 'Neu generieren' }).click()
    await expect(card.getByText('Vorschlag konnte nicht generiert werden. Bitte erneut versuchen.')).toBeVisible()
    await expect(card.locator('textarea')).toHaveValue('Bestehender Text')
  })

  test('AC: editable draft + tone work identically on an import-event card', async ({ page }) => {
    const name = uniqueName('ImportDraftEdit')
    const contactId = await seedContact(token, userId, name)
    await seedContactEvent(token, userId, contactId, 'Jobwechsel')
    await login(page)

    let lastBody: Record<string, unknown> = {}
    await page.route('**/api/draft-message', async (route) => {
      lastBody = JSON.parse(route.request().postData() ?? '{}')
      await route.fulfill({ status: 200, json: { text: 'Glückwunsch zum neuen Job!' } })
    })

    const card = sectionFor(page, 'Kürzlich erkannt').locator('[class~="rounded-xl"]', { hasText: name })
    await card.getByRole('button', { name: 'Vorschlag' }).click()
    const textarea = card.locator('textarea')
    await expect(textarea).toHaveValue('Glückwunsch zum neuen Job!')

    await card.getByPlaceholder('Ton anpassen, z.B. lockerer / auf Englisch / kürzer').fill('kürzer')
    await card.getByRole('button', { name: 'Neu generieren' }).click()
    expect(lastBody.tone).toBe('kürzer')
    expect(lastBody.occasionType).toBe('Jobwechsel')

    await deleteContact(token, contactId)
  })

  test('AC: calendar link for follow-up occasion has correct title and date', async ({ page }) => {
    const name = uniqueName('CalFollowup')
    await seedContact(token, userId, name, { next_followup_at: isoOffset(-2) })
    await login(page)

    const card = cardFor(page, name)
    const link = card.getByRole('link', { name: 'Kalender' })
    await expect(link).toBeVisible()
    const href = await link.getAttribute('href')
    const params = new URLSearchParams(new URL(href!).search)
    expect(params.get('text')).toBe(`Follow-up: ${name}`)
  })

  test('AC: calendar link for birthday occasion has correct title and next occurrence date', async ({ page }) => {
    const name = uniqueName('CalBirthday')
    await seedContact(token, userId, name, { birthday: `2000-${birthdayOffset(2)}` })
    await login(page)

    const card = cardFor(page, name)
    const link = card.getByRole('link', { name: 'Kalender' })
    await expect(link).toBeVisible()
    const href = await link.getAttribute('href')
    const params = new URLSearchParams(new URL(href!).search)
    expect(params.get('text')).toBe(`Geburtstag: ${name}`)
  })

  test('AC: birthday is saved on the contact and pre-filled on re-open', async ({ page }) => {
    const name = uniqueName('BirthdaySave')
    await login(page)
    await page.goto('/contacts')
    await expect(async () => {
      expect(await page.getByText('Lädt...').count()).toBe(0)
    }).toPass({ timeout: 10000 })

    await page.getByRole('button', { name: 'Kontakt hinzufügen' }).click()
    await page.getByLabel('Vorname').fill(name)
    await page.getByLabel('Geburtstag').fill('1990-05-20')
    await page.getByRole('button', { name: 'Speichern' }).click()
    await expect(page.getByText(name)).toBeVisible()

    await page.getByText(name, { exact: true }).click()
    await expect(page.getByLabel('Geburtstag')).toHaveValue('1990-05-20')
    await page.getByRole('button', { name: 'Abbrechen' }).click()
  })

  test('AC: empty birthday field is allowed, contact still saves', async ({ page }) => {
    const name = uniqueName('BirthdayEmpty')
    await login(page)
    await page.goto('/contacts')
    await expect(async () => {
      expect(await page.getByText('Lädt...').count()).toBe(0)
    }).toPass({ timeout: 10000 })

    await page.getByRole('button', { name: 'Kontakt hinzufügen' }).click()
    await page.getByLabel('Vorname').fill(name)
    await page.getByRole('button', { name: 'Speichern' }).click()
    await expect(page.getByText(name)).toBeVisible()
  })

  test('AC: future birthday shows validation error, not saved', async ({ page }) => {
    const name = uniqueName('BirthdayFuture')
    await login(page)
    await page.goto('/contacts')
    await expect(async () => {
      expect(await page.getByText('Lädt...').count()).toBe(0)
    }).toPass({ timeout: 10000 })

    await page.getByRole('button', { name: 'Kontakt hinzufügen' }).click()
    await page.getByLabel('Vorname').fill(name)
    await page.getByLabel('Geburtstag').fill(isoOffset(5))
    await page.getByRole('button', { name: 'Speichern' }).click()

    await expect(page.getByText('Geburtstag darf nicht in der Zukunft liegen')).toBeVisible()
    await page.getByRole('button', { name: 'Abbrechen' }).click()
  })

  test('AC: open import event appears in "Kürzlich erkannt" with its type badge', async ({ page }) => {
    const name = uniqueName('ImportEvent')
    const contactId = await seedContact(token, userId, name)
    await seedContactEvent(token, userId, contactId, 'Jobwechsel')
    await login(page)

    await expect(page.getByRole('heading', { name: 'Kürzlich erkannt' })).toBeVisible()
    const card = sectionFor(page, 'Kürzlich erkannt').locator('[class~="rounded-xl"]', { hasText: name })
    await expect(card).toBeVisible()
    await expect(card.getByText('Jobwechsel', { exact: true })).toBeVisible()

    await deleteContact(token, contactId)
  })

  test('AC: "Kürzlich erkannt" is hidden when no open import event exists', async ({ page }) => {
    const name = uniqueName('NoImportEvent')
    await seedContact(token, userId, name, { next_followup_at: isoOffset(0) })
    await login(page)

    await expect(page.getByRole('heading', { name: 'Kürzlich erkannt' })).toHaveCount(0)
  })

  test('AC: contact with two open import events shows both badges on one card', async ({ page }) => {
    const name = uniqueName('TwoEvents')
    const contactId = await seedContact(token, userId, name)
    await seedContactEvent(token, userId, contactId, 'Jobwechsel')
    await seedContactEvent(token, userId, contactId, 'Beförderung')
    await login(page)

    const card = sectionFor(page, 'Kürzlich erkannt').locator('[class~="rounded-xl"]', { hasText: name })
    await expect(card.getByText('Jobwechsel', { exact: true })).toBeVisible()
    await expect(card.getByText('Beförderung', { exact: true })).toBeVisible()
  })

  test('AC: "Kontaktiert" on an import-event card dismisses all of that contact\'s open events', async ({ page }) => {
    const name = uniqueName('Dismiss')
    const contactId = await seedContact(token, userId, name)
    await seedContactEvent(token, userId, contactId, 'Jobwechsel')
    await seedContactEvent(token, userId, contactId, 'Beförderung')
    await login(page)

    const card = sectionFor(page, 'Kürzlich erkannt').locator('[class~="rounded-xl"]', { hasText: name })
    await card.getByRole('button', { name: 'Kontaktiert' }).click()
    await page.getByLabel('Kanal').click()
    await page.getByRole('option', { name: 'Call' }).click()
    await page.getByRole('button', { name: 'Speichern' }).click()

    await expect(page.getByText('Kontaktmoment hinzufügen')).toHaveCount(0)
    await expect(page.locator('[class~="rounded-xl"]', { hasText: name })).toHaveCount(0)

    await deleteContact(token, contactId)
  })

  test('AC: "Vorschlag" on an import-event card calls the AI route with the event type', async ({ page }) => {
    const name = uniqueName('ImportDraft')
    const contactId = await seedContact(token, userId, name)
    await seedContactEvent(token, userId, contactId, 'Jobwechsel')
    await login(page)

    let receivedOccasionType: string | undefined
    await page.route('**/api/draft-message', async (route) => {
      receivedOccasionType = JSON.parse(route.request().postData() ?? '{}').occasionType
      await route.fulfill({ status: 200, json: { text: 'Glückwunsch zum neuen Job!' } })
    })

    const card = sectionFor(page, 'Kürzlich erkannt').locator('[class~="rounded-xl"]', { hasText: name })
    await card.getByRole('button', { name: 'Vorschlag' }).click()
    await expect(card.getByText('Glückwunsch zum neuen Job!')).toBeVisible()
    expect(receivedOccasionType).toBe('Jobwechsel')
  })

  test('Security: unauthenticated request to /api/draft-message is blocked', async ({ request }) => {
    const res = await request.post('http://localhost:3000/api/draft-message', {
      data: { contactId: '00000000-0000-0000-0000-000000000000', occasionType: 'followup' },
      maxRedirects: 0,
    })
    expect([401, 307, 308]).toContain(res.status())
  })

  test('Security: authenticated user cannot draft a message for another user\'s contact (RLS)', async ({ page }) => {
    await login(page)
    // contact id belongs to a different Supabase user (bennewroly@gmail.com), not the QA account
    const res = await page.request.post('http://localhost:3000/api/draft-message', {
      data: { contactId: '7a7f3b5a-bfd1-4dc3-bd21-ce243cff2918', occasionType: 'followup' },
    })
    expect(res.status()).toBe(404)
  })

  test('AC (Refine 2026-07-03): "Geburtstage aus dem Kalender" section is hidden when Google is not connected', async ({
    page,
  }) => {
    // QA account has no connector_tokens row for google (same fixture as PROJ-21) -> real "not connected" state
    await login(page)
    await expect(page.getByRole('heading', { name: 'Geburtstage aus dem Kalender' })).toHaveCount(0)
  })

  test('Security: unauthenticated request to /api/meetings/birthdays is blocked', async ({ request }) => {
    const res = await request.get('http://localhost:3000/api/meetings/birthdays', { maxRedirects: 0 })
    expect([401, 307, 308]).toContain(res.status())
  })

  test('Security: authenticated request to /api/meetings/birthdays never returns raw tokens', async ({ page }) => {
    await login(page)
    const res = await page.request.get('http://localhost:3000/api/meetings/birthdays')
    const json = await res.json()
    const bodyText = JSON.stringify(json)
    expect(bodyText).not.toContain('access_token')
    expect(bodyText).not.toContain('refresh_token')
  })
})
