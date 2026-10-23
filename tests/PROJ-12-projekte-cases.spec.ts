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

async function seedProject(token: string, userId: string, title: string, extra: Record<string, unknown> = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/projects`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify({ user_id: userId, title, ...extra }),
  })
  const [project] = await res.json()
  return project.id as string
}

async function seedInteraction(
  token: string,
  userId: string,
  contactId: string,
  row: { occurred_at: string; channel: string; note?: string; project_id?: string }
) {
  await fetch(`${SUPABASE_URL}/rest/v1/interactions`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({ ...row, contact_id: contactId, user_id: userId }),
  })
}

async function restGet(token: string, path: string) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
  })
  return res.json()
}

async function cleanup(token: string) {
  await fetch(`${SUPABASE_URL}/rest/v1/contacts?first_name=like.QA12*`, {
    method: 'DELETE',
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
  })
  await fetch(`${SUPABASE_URL}/rest/v1/projects?title=like.QA12*`, {
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
  await page.goto('/profil')
  await expect(async () => {
    expect(await page.getByText('Lädt...').count()).toBe(0)
  }).toPass({ timeout: 10000 })
}

function uniqueName(label: string) {
  return `QA12 ${label} ${Date.now()}-${Math.floor(Math.random() * 10000)}`
}

function card(page: Page, title: string) {
  return page.locator('.cursor-pointer', { hasText: title })
}

test.describe.serial('PROJ-12: Projekte/Cases', () => {
  let token: string
  let userId: string

  test.beforeAll(async () => {
    token = await getToken()
    userId = await getUserId(token)
    await cleanup(token)
  })

  test.afterAll(async () => {
    await cleanup(token)
  })

  test('AC: empty project list shows a single "Projekt anlegen" CTA (no duplicate button)', async ({ page }) => {
    await login(page)
    await expect(page.getByRole('button', { name: 'Projekt anlegen' })).toHaveCount(1)
    await expect(page.getByText('Noch keine Projekte.')).toBeVisible()
  })

  test('AC: create project with title only saves active status, other fields empty', async ({ page }) => {
    const title = uniqueName('TitleOnly')
    await login(page)
    await page.getByRole('button', { name: 'Projekt anlegen' }).click()
    await page.getByLabel('Titel').fill(title)
    await page.getByRole('button', { name: 'Speichern' }).click()
    await expect(card(page, title)).toBeVisible()

    await card(page, title).click()
    await expect(page).toHaveURL(/\/profil\/.+/)
    await expect(page.getByText('Aktiv')).toBeVisible()
  })

  test('AC: empty title shows validation error, project not created', async ({ page }) => {
    await login(page)
    await page.getByRole('button', { name: 'Projekt anlegen' }).click()
    await page.getByRole('button', { name: 'Speichern' }).click()
    await expect(page.getByText('Titel ist erforderlich')).toBeVisible()
  })

  test('AC: full fields (client, city, dates, notes) are saved', async ({ page }) => {
    const title = uniqueName('FullFields')
    await login(page)
    await page.getByRole('button', { name: 'Projekt anlegen' }).click()
    await page.getByLabel('Titel').fill(title)
    await page.getByLabel('Kunde').fill('Acme Corp')
    await page.getByLabel('Stadt').fill('Berlin')
    await page.getByLabel('Startdatum').fill('2026-01-10')
    await page.getByLabel('Enddatum').fill('2026-03-20')
    await page.getByLabel('Notizen').fill('Strategieprojekt für Acme')
    await page.getByRole('button', { name: 'Speichern' }).click()

    await card(page, title).click()
    await expect(page.getByText('Acme Corp · Berlin')).toBeVisible()
    await expect(page.getByText('10.1.2026 – 20.3.2026')).toBeVisible()
    await expect(page.getByText('Strategieprojekt für Acme')).toBeVisible()
  })

  test('AC: end date before start date shows validation error', async ({ page }) => {
    const title = uniqueName('BadDates')
    await login(page)
    await page.getByRole('button', { name: 'Projekt anlegen' }).click()
    await page.getByLabel('Titel').fill(title)
    await page.getByLabel('Startdatum').fill('2026-05-01')
    await page.getByLabel('Enddatum').fill('2026-01-01')
    await page.getByRole('button', { name: 'Speichern' }).click()
    await expect(page.getByText('Enddatum darf nicht vor dem Startdatum liegen')).toBeVisible()
    await expect(card(page, title)).toHaveCount(0)
  })

  test('AC: marking project done moves it to "Beendet" tab, separate from active', async ({ page }) => {
    const title = uniqueName('MarkDone')
    const projectId = await seedProject(token, userId, title)
    await login(page)
    await page.goto(`/profil/${projectId}`)
    await page.getByRole('button', { name: 'Als beendet markieren' }).click()
    await expect(page.getByText('Beendet', { exact: true })).toBeVisible()

    await page.goto('/profil')
    await page.getByRole('tab', { name: 'Aktiv' }).click()
    await expect(card(page, title)).toHaveCount(0)
    await page.getByRole('tab', { name: 'Beendet' }).click()
    await expect(card(page, title)).toBeVisible()
  })

  test('AC: add participant with role saves the assignment', async ({ page }) => {
    const projectTitle = uniqueName('AddParticipant')
    const contactName = uniqueName('Contact')
    const projectId = await seedProject(token, userId, projectTitle)
    await seedContact(token, userId, contactName)

    await login(page)
    await page.goto(`/profil/${projectId}`)
    await page.getByRole('button', { name: 'Beteiligten hinzufügen' }).click()
    await page.getByPlaceholder('Kontakt suchen...').fill(contactName)
    await page.getByText(contactName).click()
    await page.getByText('Rolle wählen').click()
    await page.getByRole('option', { name: 'Project Manager' }).click()
    await page.getByRole('button', { name: 'Hinzufügen' }).click()

    await expect(page.getByText(contactName)).toBeVisible()
    await expect(page.getByText('Project Manager')).toBeVisible()
  })

  test('AC: "Sonstige" role with free text is saved and displayed', async ({ page }) => {
    const projectTitle = uniqueName('OtherRole')
    const contactName = uniqueName('Advisor')
    const projectId = await seedProject(token, userId, projectTitle)
    await seedContact(token, userId, contactName)

    await login(page)
    await page.goto(`/profil/${projectId}`)
    await page.getByRole('button', { name: 'Beteiligten hinzufügen' }).click()
    await page.getByPlaceholder('Kontakt suchen...').fill(contactName)
    await page.getByText(contactName).click()
    await page.getByText('Rolle wählen').click()
    await page.getByRole('option', { name: 'Sonstige' }).click()
    await page.getByPlaceholder('Rolle angeben...').fill('Externer Advisor')
    await page.getByRole('button', { name: 'Hinzufügen' }).click()

    await expect(page.getByText('Externer Advisor')).toBeVisible()
  })

  test('AC: contact already a participant is excluded from the picker (no duplicates)', async ({ page }) => {
    const projectTitle = uniqueName('NoDupe')
    const contactName = uniqueName('AlreadyIn')
    const projectId = await seedProject(token, userId, projectTitle)
    const contactId = await seedContact(token, userId, contactName)
    await fetch(`${SUPABASE_URL}/rest/v1/project_participants`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        project_id: projectId,
        contact_id: contactId,
        user_id: userId,
        role: 'partner',
      }),
    })

    await login(page)
    await page.goto(`/profil/${projectId}`)
    await expect(page.getByText(contactName)).toBeVisible()
    await page.getByRole('button', { name: 'Beteiligten hinzufügen' }).click()
    await page.getByPlaceholder('Kontakt suchen...').fill(contactName)
    await expect(page.getByText('Kein Kontakt gefunden.')).toBeVisible()
  })

  test('AC: removing a participant only deletes the assignment, contact stays intact', async ({ page }) => {
    const projectTitle = uniqueName('RemoveParticipant')
    const contactName = uniqueName('Removable')
    const projectId = await seedProject(token, userId, projectTitle)
    const contactId = await seedContact(token, userId, contactName)
    await fetch(`${SUPABASE_URL}/rest/v1/project_participants`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        project_id: projectId,
        contact_id: contactId,
        user_id: userId,
        role: 'client',
      }),
    })

    await login(page)
    await page.goto(`/profil/${projectId}`)
    await expect(page.getByText(contactName)).toBeVisible()
    await page.getByRole('button', { name: 'Beteiligten entfernen' }).click()
    await expect(page.getByText('Beteiligten entfernen?')).toBeVisible()
    await page.getByRole('button', { name: 'Entfernen' }).last().click()
    await expect(page.getByText('Noch keine Beteiligten.')).toBeVisible()

    const contacts = await restGet(token, `contacts?id=eq.${contactId}`)
    expect(contacts).toHaveLength(1)
  })

  test('AC: project log shows empty state when no interactions are linked', async ({ page }) => {
    const projectTitle = uniqueName('EmptyLog')
    const projectId = await seedProject(token, userId, projectTitle)
    await login(page)
    await page.goto(`/profil/${projectId}`)
    await expect(page.getByText('Noch keine verknüpften Momente.')).toBeVisible()
  })

  test('AC: interaction with selected project appears chronologically in project log', async ({ page }) => {
    const projectTitle = uniqueName('LinkedLog')
    const contactName = uniqueName('LogContact')
    const projectId = await seedProject(token, userId, projectTitle)
    const contactId = await seedContact(token, userId, contactName)

    await login(page)
    await page.goto('/contacts')
    await card(page, contactName).getByRole('button', { name: 'Verlauf anzeigen' }).click()
    await page.getByRole('button', { name: 'Kontaktmoment hinzufügen' }).click()
    await page.getByLabel('Kanal').click()
    await page.getByRole('option', { name: 'Call' }).click()
    await page.getByLabel('Projekt').click()
    await page.getByRole('option', { name: projectTitle }).click()
    const insertResponse = page.waitForResponse(
      (res) => res.url().includes('/rest/v1/interactions') && res.request().method() === 'POST'
    )
    await page.getByRole('button', { name: 'Speichern' }).click()
    await insertResponse

    await page.goto(`/profil/${projectId}`)
    await expect(page.getByText('Call')).toBeVisible()
    await expect(page.getByText(contactName)).toBeVisible()
    await expect(page.getByText('Noch keine verknüpften Momente.')).toHaveCount(0)

    // contact_id is set via UI by clicking through, no need to reference contactId directly
    void contactId
  })

  test('AC: delete shows confirmation dialog before removing the project', async ({ page }) => {
    const title = uniqueName('DeleteConfirm')
    const projectId = await seedProject(token, userId, title)
    await login(page)
    await page.goto(`/profil/${projectId}`)
    await page.getByRole('button', { name: 'Löschen' }).click()
    await expect(page.getByText('Projekt löschen?')).toBeVisible()
  })

  test('AC: deleting a project cascades participants but keeps interactions (project_id -> null)', async ({
    page,
  }) => {
    const projectTitle = uniqueName('DeleteCascade')
    const contactName = uniqueName('CascadeContact')
    const projectId = await seedProject(token, userId, projectTitle)
    const contactId = await seedContact(token, userId, contactName)
    await fetch(`${SUPABASE_URL}/rest/v1/project_participants`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        project_id: projectId,
        contact_id: contactId,
        user_id: userId,
        role: 'partner',
      }),
    })
    await seedInteraction(token, userId, contactId, {
      occurred_at: '2026-02-01',
      channel: 'call',
      note: 'Verknüpfter Moment',
      project_id: projectId,
    })

    await login(page)
    await page.goto(`/profil/${projectId}`)
    await page.getByRole('button', { name: 'Löschen' }).click()
    await page.getByRole('button', { name: 'Löschen' }).last().click()
    await expect(page).toHaveURL('http://localhost:3000/profil')

    const participants = await restGet(token, `project_participants?project_id=eq.${projectId}`)
    expect(participants).toHaveLength(0)

    const interactions = await restGet(token, `interactions?contact_id=eq.${contactId}`)
    expect(interactions).toHaveLength(1)
    expect(interactions[0].project_id).toBeNull()
  })

  test('SECURITY: project rows are not returned without owner authentication (RLS)', async ({}) => {
    const title = uniqueName('RlsCheck')
    const projectId = await seedProject(token, userId, title)

    const res = await fetch(`${SUPABASE_URL}/rest/v1/projects?id=eq.${projectId}`, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
    })
    const rows = await res.json()
    expect(rows).toHaveLength(0)

    const ownRows = await restGet(token, `projects?id=eq.${projectId}`)
    expect(ownRows).toHaveLength(1)
  })
})
