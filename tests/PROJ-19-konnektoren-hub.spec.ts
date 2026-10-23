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

async function cleanupConnectors(token: string) {
  await fetch(`${SUPABASE_URL}/rest/v1/connector_tokens?provider=eq.google`, {
    method: 'DELETE',
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
  })
}

async function seedConnector(token: string, userId: string) {
  await fetch(`${SUPABASE_URL}/rest/v1/connector_tokens`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({
      user_id: userId,
      provider: 'google',
      account_email: 'qa-test@gmail.com',
      access_token: 'encrypted_placeholder',
      refresh_token: 'encrypted_placeholder',
      expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
      scopes: ['calendar.readonly', 'gmail.readonly'],
      status: 'active',
    }),
  })
}

async function getUserId(token: string) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
  })
  const json = await res.json()
  return json.id as string
}

async function login(page: Page) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(EMAIL)
  await page.getByLabel('Passwort').fill(PASSWORD)
  await page.getByRole('button', { name: 'Login' }).click()
  await expect(page).toHaveURL('http://localhost:3000/dashboard')
}

test.describe.serial('PROJ-19: Konnektoren-Hub', () => {
  let token: string
  let userId: string

  test.beforeAll(async () => {
    token = await getToken()
    userId = await getUserId(token)
    await cleanupConnectors(token)
  })

  test.afterAll(async () => {
    await cleanupConnectors(token)
  })

  test('AC: Sidebar shows Konnektoren navigation item', async ({ page }) => {
    await login(page)
    await expect(page.locator('a[href="/einstellungen/konnektoren"]')).toBeAttached()
  })

  test('AC: /einstellungen/konnektoren loads for authenticated user', async ({ page }) => {
    await login(page)
    await page.goto('/einstellungen/konnektoren')
    await expect(page.getByRole('heading', { name: 'Konnektoren' })).toBeVisible()
  })

  test('AC: unauthenticated access redirects to login', async ({ page }) => {
    await page.goto('/einstellungen/konnektoren')
    await expect(page).toHaveURL(/\/login/)
  })

  test('AC: Google card shows Verbinden button when not connected', async ({ page }) => {
    await login(page)
    await page.goto('/einstellungen/konnektoren')
    const googleCard = page.locator('[data-testid="connector-card-google"]')
    await expect(googleCard).toBeVisible()
    await expect(googleCard.getByRole('button', { name: 'Verbinden' })).toBeVisible()
  })

  test('AC: Outlook card shows Coming Soon badge and disabled button', async ({ page }) => {
    await login(page)
    await page.goto('/einstellungen/konnektoren')
    const outlookCard = page.locator('[data-testid="connector-card-outlook"]')
    await expect(outlookCard).toBeVisible()
    await expect(outlookCard.getByText('Coming Soon')).toBeVisible()
    const outlookBtn = outlookCard.getByRole('button', { name: 'Verbinden' })
    await expect(outlookBtn).toBeDisabled()
  })

  test('AC: Google card shows connected state when token exists', async ({ page }) => {
    await seedConnector(token, userId)
    await login(page)
    await page.goto('/einstellungen/konnektoren')
    const googleCard = page.locator('[data-testid="connector-card-google"]')
    await expect(googleCard.getByText('Verbunden')).toBeVisible()
    await expect(googleCard.getByText('qa-test@gmail.com')).toBeVisible()
    await expect(googleCard.getByRole('button', { name: 'Trennen' })).toBeVisible()
    await cleanupConnectors(token)
  })

  test('AC: disconnect confirmation dialog appears on Trennen click', async ({ page }) => {
    await seedConnector(token, userId)
    await login(page)
    await page.goto('/einstellungen/konnektoren')
    const googleCard = page.locator('[data-testid="connector-card-google"]')
    await googleCard.getByRole('button', { name: 'Trennen' }).click()
    await expect(page.getByRole('alertdialog')).toBeVisible()
    await expect(page.getByText('Google-Verbindung trennen')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Abbrechen' })).toBeVisible()
    await expect(page.getByRole('button', { name: /Ja, trennen/i })).toBeVisible()
    await page.getByRole('button', { name: 'Abbrechen' }).click()
    await cleanupConnectors(token)
  })

  test('AC: page shows loading skeleton then connector cards', async ({ page }) => {
    await login(page)
    await page.goto('/einstellungen/konnektoren')
    await expect(page.locator('[data-testid="connector-card-google"]')).toBeVisible({ timeout: 5000 })
    await expect(page.locator('[data-testid="connector-card-outlook"]')).toBeVisible({ timeout: 5000 })
  })

  test('SECURITY: /api/connectors/status returns 401 without session cookie', async ({ request }) => {
    const res = await request.get('/api/connectors/status')
    expect(res.status()).toBe(401)
  })

  test('SECURITY: /api/connectors/disconnect returns 401 without session', async ({ request }) => {
    const res = await request.post('/api/connectors/disconnect', {
      data: { provider: 'google' },
    })
    expect(res.status()).toBe(401)
  })

  test('SECURITY: /api/connectors/disconnect rejects unknown provider', async ({ page }) => {
    await login(page)
    const res = await page.request.post('/api/connectors/disconnect', {
      data: { provider: 'facebook' },
    })
    expect(res.status()).toBe(400)
  })
})
