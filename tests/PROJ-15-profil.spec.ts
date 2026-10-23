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

async function seedContact(
  token: string,
  userId: string,
  name: string,
  fields: { next_followup_at?: string | null } = {}
) {
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

async function seedProject(token: string, userId: string, title: string) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/projects`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify({ user_id: userId, title }),
  })
  const [project] = await res.json()
  return project.id as string
}

async function seedParticipant(token: string, userId: string, projectId: string, contactId: string) {
  await fetch(`${SUPABASE_URL}/rest/v1/project_participants`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ project_id: projectId, contact_id: contactId, user_id: userId, role: 'partner' }),
  })
}

async function wipeAllContacts(token: string, userId: string) {
  await fetch(`${SUPABASE_URL}/rest/v1/contacts?user_id=eq.${userId}`, {
    method: 'DELETE',
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
  })
}

async function wipeAllProjects(token: string, userId: string) {
  // project_participants cascade-deletes with the project (ON DELETE CASCADE)
  await fetch(`${SUPABASE_URL}/rest/v1/projects?user_id=eq.${userId}`, {
    method: 'DELETE',
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
  })
}

function isoOffset(days: number) {
  return new Date(Date.now() + days * 86400000).toISOString().slice(0, 10)
}

async function login(page: Page) {
  await page.goto('/login')
  await page.waitForLoadState('networkidle')
  await page.getByLabel('Email').fill(EMAIL)
  await page.getByLabel('Passwort').fill(PASSWORD)
  await page.getByRole('button', { name: 'Login' }).click()
  await expect(page).toHaveURL('http://localhost:3000/dashboard')
}

async function gotoProfil(page: Page) {
  await page.goto('/profil')
  await expect(async () => {
    expect(await page.getByText('–').count()).toBe(0)
  }).toPass({ timeout: 10000 })
}

function statTile(page: Page, label: string) {
  return page.locator('div', { has: page.getByText(label, { exact: true }) }).last()
}

function uniqueName(label: string) {
  return `QA15 ${label} ${Date.now()}-${Math.floor(Math.random() * 10000)}`
}

test.describe.serial('PROJ-15: Profil', () => {
  let token: string
  let userId: string

  test.beforeAll(async () => {
    token = await getToken()
    userId = await getUserId(token)
  })

  test.beforeEach(async () => {
    await wipeAllProjects(token, userId)
    await wipeAllContacts(token, userId)
  })

  test.afterAll(async () => {
    await wipeAllProjects(token, userId)
    await wipeAllContacts(token, userId)
  })

  test('AC: nav shows "Profil" label linking to /profil, route renders the case list', async ({ page }) => {
    await login(page)
    await page.getByRole('link', { name: 'Profil' }).click()
    await expect(page).toHaveURL('http://localhost:3000/profil')
    await expect(page.getByRole('button', { name: 'Projekt anlegen' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Projekte' })).toHaveCount(0)
  })

  test('AC: /profil/[id] renders project detail correctly', async ({ page }) => {
    const title = uniqueName('Detail')
    const projectId = await seedProject(token, userId, title)
    await login(page)
    await page.goto(`/profil/${projectId}`)
    await expect(page.getByRole('heading', { name: title })).toBeVisible()
  })

  test('AC: stats header renders 3 tiles with correct labels', async ({ page }) => {
    await login(page)
    await gotoProfil(page)
    await expect(page.getByText('Kontakte gesamt')).toBeVisible()
    await expect(page.getByText('Fällige Follow-ups')).toBeVisible()
    await expect(page.getByText('Beteiligte gesamt über alle Cases')).toBeVisible()
  })

  test('AC: Kontakte gesamt reflects total contact count, Fällige Follow-ups is 0 when none are due', async ({
    page,
  }) => {
    await seedContact(token, userId, uniqueName('A'))
    await seedContact(token, userId, uniqueName('B'))
    await seedContact(token, userId, uniqueName('C'), { next_followup_at: isoOffset(10) })

    await login(page)
    await gotoProfil(page)
    await expect(statTile(page, 'Kontakte gesamt')).toContainText('3')
    await expect(statTile(page, 'Fällige Follow-ups')).toContainText('0')
  })

  test('AC: contact with next_followup_at in the past is counted as due', async ({ page }) => {
    await seedContact(token, userId, uniqueName('Overdue'), { next_followup_at: isoOffset(-3) })
    await seedContact(token, userId, uniqueName('Today'), { next_followup_at: isoOffset(0) })

    await login(page)
    await gotoProfil(page)
    await expect(statTile(page, 'Fällige Follow-ups')).toContainText('2')
  })

  test('AC: contact with next_followup_at in the future is NOT counted as due', async ({ page }) => {
    await seedContact(token, userId, uniqueName('Future'), { next_followup_at: isoOffset(5) })

    await login(page)
    await gotoProfil(page)
    await expect(statTile(page, 'Fällige Follow-ups')).toContainText('0')
  })

  test('AC: same contact as participant in 2 different projects counts once (dedupe)', async ({ page }) => {
    const contactId = await seedContact(token, userId, uniqueName('SharedParticipant'))
    const projectA = await seedProject(token, userId, uniqueName('ProjA'))
    const projectB = await seedProject(token, userId, uniqueName('ProjB'))
    await seedParticipant(token, userId, projectA, contactId)
    await seedParticipant(token, userId, projectB, contactId)

    await login(page)
    await gotoProfil(page)
    await expect(statTile(page, 'Beteiligte gesamt über alle Cases')).toContainText('1')
  })

  test('AC: zero-state shows 0 for all 3 stats with no contacts/projects/participants', async ({ page }) => {
    await login(page)
    await gotoProfil(page)
    await expect(statTile(page, 'Kontakte gesamt')).toContainText('0')
    await expect(statTile(page, 'Fällige Follow-ups')).toContainText('0')
    await expect(statTile(page, 'Beteiligte gesamt über alle Cases')).toContainText('0')
  })

  test('SECURITY: stats only reflect the authenticated user\'s own data (RLS)', async ({ page }) => {
    await seedContact(token, userId, uniqueName('Owned'))

    const res = await fetch(`${SUPABASE_URL}/rest/v1/contacts?select=id`, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
    })
    const rows = await res.json()
    expect(rows).toHaveLength(0)

    await login(page)
    await gotoProfil(page)
    await expect(statTile(page, 'Kontakte gesamt')).toContainText('1')
  })
})
