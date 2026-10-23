import { test, expect, type Page } from '@playwright/test'

const EMAIL = process.env.QA_TEST_EMAIL!
const PASSWORD = process.env.QA_TEST_PASSWORD!

async function login(page: Page) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(EMAIL)
  await page.getByLabel('Passwort').fill(PASSWORD)
  await page.getByRole('button', { name: 'Login' }).click()
  await expect(page).toHaveURL('http://localhost:3000/dashboard')
  await expect(async () => {
    expect(await page.getByText('Lädt...').count()).toBe(0)
  }).toPass({ timeout: 10000 })
}

test.describe.serial('PROJ-21: Meeting-Prep-Sektion im Dashboard', () => {
  test('AC: not connected -> shows hint with link to Konnektoren, no "Termine" section', async ({ page }) => {
    // QA account has no connector_tokens row for google (verified before writing this suite) -> real "not connected" state
    await login(page)
    await expect(page.getByText('Google Kalender verbinden, um Termine hier zu sehen')).toBeVisible()
    const link = page.getByRole('link', { name: 'zu den Konnektoren' })
    await expect(link).toBeVisible()
    await expect(link).toHaveAttribute('href', '/einstellungen/konnektoren')
    await expect(page.getByRole('heading', { name: 'Termine', exact: true })).toHaveCount(0)
  })

  test('AC: hint link navigates to the Konnektoren page', async ({ page }) => {
    await login(page)
    await page.getByRole('link', { name: 'zu den Konnektoren' }).click()
    await expect(page).toHaveURL('http://localhost:3000/einstellungen/konnektoren')
  })

  test('Security: unauthenticated request to /api/meetings/today is blocked', async ({ request }) => {
    const res = await request.get(
      'http://localhost:3000/api/meetings/today?from=2026-07-02T00:00:00.000Z&to=2026-07-02T23:59:59.999Z',
      { maxRedirects: 0 }
    )
    expect([401, 307, 308]).toContain(res.status())
  })

  test('Security: unauthenticated request to /api/meeting-prep is blocked', async ({ request }) => {
    const res = await request.post('http://localhost:3000/api/meeting-prep', {
      data: { contactId: '00000000-0000-0000-0000-000000000000' },
      maxRedirects: 0,
    })
    expect([401, 307, 308]).toContain(res.status())
  })

  test("Security: authenticated user cannot get a meeting-prep summary for another user's contact (RLS)", async ({
    page,
  }) => {
    await login(page)
    // contact id belongs to a different Supabase user (bennewroly@gmail.com), not the QA account — same fixture used by PROJ-6's equivalent test
    const res = await page.request.post('http://localhost:3000/api/meeting-prep', {
      data: { contactId: '7a7f3b5a-bfd1-4dc3-bd21-ce243cff2918' },
    })
    expect(res.status()).toBe(404)
  })

  test('Security: authenticated request to /api/meetings/today never returns raw tokens', async ({ page }) => {
    await login(page)
    const res = await page.request.get(
      'http://localhost:3000/api/meetings/today?from=2026-07-02T00:00:00.000Z&to=2026-07-02T23:59:59.999Z'
    )
    const json = await res.json()
    const bodyText = JSON.stringify(json)
    expect(bodyText).not.toContain('access_token')
    expect(bodyText).not.toContain('refresh_token')
  })
})
