import { test, expect } from '@playwright/test'

test.describe('PROJ-2: Auth (Login) — network failure', () => {
  test('AC7: network failure on login shows error, keeps form values', async ({ page }) => {
    await page.route('**/auth/v1/token**', (route) => route.abort('failed'))

    await page.goto('/login')
    await page.getByLabel('Email').fill('test@example.com')
    await page.getByLabel('Passwort').fill('some-password')
    await page.getByRole('button', { name: 'Login' }).click()

    await expect(
      page.getByText('Verbindung zu Supabase fehlgeschlagen. Bitte erneut versuchen.')
    ).toBeVisible()
    await expect(page.getByLabel('Email')).toHaveValue('test@example.com')
    await expect(page.getByLabel('Passwort')).toHaveValue('some-password')
  })
})
