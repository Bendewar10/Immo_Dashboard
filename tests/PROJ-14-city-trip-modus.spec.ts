import { test, expect, type Page } from '@playwright/test'

const EMAIL = process.env.QA_TEST_EMAIL!
const PASSWORD = process.env.QA_TEST_PASSWORD!
const SUPABASE_URL = process.env.QA_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_ANON_KEY =
  process.env.QA_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const CITY = 'QA14 Teststadt'

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

async function rest(
  token: string,
  path: string,
  init: RequestInit & { headers?: Record<string, string> } = {}
) {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...init.headers,
    },
  })
}

async function seed(token: string, userId: string) {
  const projectsRes = await rest(token, 'projects', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify([
      {
        user_id: userId,
        title: 'QA14 Case mit Stadt',
        city: CITY,
        start_date: '2026-07-01',
        end_date: '2026-09-30',
        status: 'active',
      },
      {
        user_id: userId,
        title: 'QA14 Case ohne Stadt',
        city: null,
        start_date: null,
        end_date: null,
        status: 'active',
      },
      {
        user_id: userId,
        title: 'QA14 Case leere Stadt',
        city: 'QA14 Leerstadt',
        start_date: null,
        end_date: null,
        status: 'active',
      },
    ]),
  })
  const projects = (await projectsRes.json()) as { id: string; title: string }[]
  if (!Array.isArray(projects)) {
    throw new Error(`Projekt-Seed fehlgeschlagen: ${JSON.stringify(projects).slice(0, 200)}`)
  }

  const contactsRes = await rest(token, 'contacts', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify([
      {
        user_id: userId,
        first_name: 'QA14 Anna',
        last_name: 'MitTelefon',
        city: CITY,
        phone: '+49 170 1234567',
        strength: 1,
        employer: 'QA14 Firma',
        last_contacted_at: '2026-01-15T00:00:00Z',
      },
      {
        user_id: userId,
        first_name: 'QA14 Bernd',
        last_name: 'OhneTelefon',
        city: ` ${CITY.toLowerCase()} `,
        phone: null,
        strength: null,
        employer: null,
        last_contacted_at: null,
      },
      {
        user_id: userId,
        first_name: 'QA14 Clara',
        last_name: 'AndereStadt',
        city: 'QA14 Anderswo',
        phone: null,
        strength: null,
        employer: null,
        last_contacted_at: null,
      },
      // Bulk-Insert: alle Rows brauchen identische Keys (PostgREST PGRST102)
    ]),
  })
  if (!contactsRes.ok) {
    throw new Error(`Kontakt-Seed fehlgeschlagen: ${await contactsRes.text()}`)
  }

  return {
    projectWithCity: projects.find((p) => p.title === 'QA14 Case mit Stadt')!.id,
    projectNoCity: projects.find((p) => p.title === 'QA14 Case ohne Stadt')!.id,
    projectEmptyCity: projects.find((p) => p.title === 'QA14 Case leere Stadt')!.id,
  }
}

async function cleanup(token: string) {
  await rest(token, 'projects?title=like.QA14*', { method: 'DELETE' })
  await rest(token, 'contacts?first_name=like.QA14*', { method: 'DELETE' })
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
}

// Draft-API mocken: deterministisch + keine KI-Kosten im Test
async function mockDraftApi(page: Page, opts: { failFor?: string } = {}) {
  await page.route('**/api/draft-message', async (route) => {
    const body = route.request().postDataJSON() as { contactId: string }
    if (opts.failFor && body.contactId === opts.failFor) {
      await route.fulfill({ status: 502, json: { error: 'KI down' } })
      return
    }
    await route.fulfill({ status: 200, json: { text: `Mock-Entwurf für ${body.contactId}` } })
  })
}

test.describe.serial('PROJ-14 City-Trip-Modus', () => {
  let token: string
  let userId: string
  let ids: { projectWithCity: string; projectNoCity: string; projectEmptyCity: string }

  test.beforeAll(async () => {
    token = await getToken()
    userId = await getUserId(token)
    await cleanup(token)
    ids = await seed(token, userId)
  })

  test.afterAll(async () => {
    await cleanup(token)
  })

  test('AC (Refine 2026-07-03): Dashboard zeigt keinen Auto-Trigger-Hinweis, wenn Google nicht verbunden ist', async ({
    page,
  }) => {
    // QA account has no connector_tokens row for google (same fixture as PROJ-21/PROJ-6/PROJ-8) -> keine Kalender-Termine geladen,
    // daher kein Match möglich, obwohl ein aktives Projekt mit passender Stadt existiert (ids.projectWithCity, siehe beforeAll-Seed)
    await login(page)
    await expect(page.getByText(/^Termin in .+ — /)).toHaveCount(0)
  })

  test('Sektion zeigt Vor-Ort-Kontakte (case-insensitive Match), sortiert nach Nachhol-Bedarf', async ({ page }) => {
    await login(page)
    await page.goto(`/profil/${ids.projectWithCity}`)

    await expect(page.getByRole('heading', { name: `City-Trip: Kontakte in ${CITY}` })).toBeVisible()
    await expect(page.getByText('QA14 Anna MitTelefon')).toBeVisible()
    await expect(page.getByText('QA14 Bernd OhneTelefon')).toBeVisible()
    await expect(page.getByText('QA14 Clara AndereStadt')).toBeHidden()

    // nie kontaktiert (Bernd) vor ältestem Kontakt (Anna)
    const rows = page.getByText(/QA14 (Anna MitTelefon|Bernd OhneTelefon)/)
    expect(await rows.first().textContent()).toContain('Bernd')
    await expect(page.getByText('Nie kontaktiert')).toBeVisible()
    await expect(page.getByText(/Zuletzt: 15\.0?1\.2026/)).toBeVisible()
  })

  test('Projekt ohne Stadt zeigt Pflege-Hinweis', async ({ page }) => {
    await login(page)
    await page.goto(`/profil/${ids.projectNoCity}`)
    await expect(
      page.getByText('Projekt-Stadt pflegen, um Kontakte vor Ort zu sehen.')
    ).toBeVisible()
  })

  test('Stadt ohne Kontakte zeigt Empty State', async ({ page }) => {
    await login(page)
    await page.goto(`/profil/${ids.projectEmptyCity}`)
    await expect(page.getByText('Keine Kontakte in QA14 Leerstadt.')).toBeVisible()
  })

  test('Button inaktiv ohne Auswahl, aktiv mit Auswahl', async ({ page }) => {
    await login(page)
    await page.goto(`/profil/${ids.projectWithCity}`)
    const button = page.getByRole('button', { name: /Nachrichten entwerfen/ })
    await expect(button).toBeDisabled()
    await page.getByLabel('QA14 Anna MitTelefon auswählen').click()
    await expect(button).toBeEnabled()
  })

  test('Batch-Draft: Review mit editierbarem Entwurf, Copy immer, WhatsApp nur mit Telefon', async ({ page }) => {
    await login(page)
    await mockDraftApi(page)
    await page.goto(`/profil/${ids.projectWithCity}`)

    await page.getByLabel('QA14 Anna MitTelefon auswählen').click()
    await page.getByLabel('QA14 Bernd OhneTelefon auswählen').click()
    await page.getByRole('button', { name: /Nachrichten entwerfen/ }).click()

    const drafts = page.getByRole('textbox')
    await expect(drafts).toHaveCount(2)
    await expect(drafts.first()).toHaveValue(/Mock-Entwurf/)

    // Entwurf editierbar
    await drafts.first().fill('Angepasster Text')
    await expect(drafts.first()).toHaveValue('Angepasster Text')

    // Copy-Buttons für beide, WhatsApp nur einmal (Anna hat Telefon)
    await expect(page.getByRole('button', { name: 'Kopieren' })).toHaveCount(2)
    await expect(page.getByRole('link', { name: 'WhatsApp' })).toHaveCount(1)
  })

  test('Fehlgeschlagener Draft zeigt Retry, andere bleiben nutzbar', async ({ page }) => {
    await login(page)
    // Bernds Kontakt-ID holen
    const res = await rest(token, `contacts?first_name=eq.${encodeURIComponent('QA14 Bernd')}&select=id`)
    const [bernd] = (await res.json()) as { id: string }[]
    await mockDraftApi(page, { failFor: bernd.id })
    await page.goto(`/profil/${ids.projectWithCity}`)

    await page.getByLabel('QA14 Anna MitTelefon auswählen').click()
    await page.getByLabel('QA14 Bernd OhneTelefon auswählen').click()
    await page.getByRole('button', { name: /Nachrichten entwerfen/ }).click()

    await expect(page.getByText('Entwurf fehlgeschlagen.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Erneut versuchen' })).toBeVisible()
    await expect(page.getByRole('textbox').first()).toHaveValue(/Mock-Entwurf/)

    // Retry mit funktionierender API
    await page.unroute('**/api/draft-message')
    await mockDraftApi(page)
    await page.getByRole('button', { name: 'Erneut versuchen' }).click()
    await expect(page.getByRole('textbox')).toHaveCount(2)
  })

  test('Als Nachricht loggen erzeugt Interaktion, markiert Eintrag, verhindert Doppel-Log', async ({ page }) => {
    await login(page)
    await mockDraftApi(page)
    await page.goto(`/profil/${ids.projectWithCity}`)

    await page.getByLabel('QA14 Anna MitTelefon auswählen').click()
    await page.getByRole('button', { name: /Nachrichten entwerfen/ }).click()
    await expect(page.getByRole('textbox')).toHaveCount(1)

    const logButton = page.getByRole('button', { name: 'Als Nachricht loggen' })
    await logButton.click()
    await expect(page.getByText('Geloggt')).toBeVisible()
    await expect(logButton).toBeDisabled()

    // Interaktion in DB angekommen (Kanal message, City-Trip-Notiz)
    const contactRes = await rest(
      token,
      `contacts?first_name=eq.${encodeURIComponent('QA14 Anna')}&select=id`
    )
    const [anna] = (await contactRes.json()) as { id: string }[]
    const interactionsRes = await rest(
      token,
      `interactions?contact_id=eq.${anna.id}&select=channel,note`
    )
    const interactions = (await interactionsRes.json()) as { channel: string; note: string }[]
    expect(interactions.some((i) => i.channel === 'message' && i.note.includes('City-Trip'))).toBe(
      true
    )
  })

  test('Auswahl-Deckel: mehr als 20 nicht wählbar, Hinweis erscheint', async ({ page }) => {
    // 21 zusätzliche Kontakte in der Stadt anlegen
    const extra = Array.from({ length: 21 }, (_, i) => ({
      user_id: userId,
      first_name: `QA14 Extra${String(i).padStart(2, '0')}`,
      city: CITY,
    }))
    await rest(token, 'contacts', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify(extra),
    })

    await login(page)
    await page.goto(`/profil/${ids.projectWithCity}`)
    const checkboxes = page.getByRole('checkbox')
    await expect(checkboxes.first()).toBeVisible()
    const count = await checkboxes.count()
    for (let i = 0; i < count; i++) {
      await checkboxes.nth(i).click()
    }

    await expect(page.getByText(/Maximal 20 Kontakte pro Batch/)).toBeVisible()
    await expect(page.getByRole('button', { name: /Nachrichten entwerfen \(20\)/ })).toBeVisible()
  })
})
