import { test, expect } from '@playwright/test'

test.describe('PROJ-2: Auth (Login)', () => {
  test('AC4: unauthenticated visit to protected route redirects to /login', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL('/login')
  })

  test('AC3: empty form submit shows validation errors, no request sent', async ({ page }) => {
    await page.goto('/login')
    await page.getByRole('button', { name: 'Login' }).click()
    await expect(page.getByText('Email ist erforderlich')).toBeVisible()
    await expect(page.getByText('Passwort ist erforderlich')).toBeVisible()
  })

  test('AC2: wrong credentials show error message, fields keep their values', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('Email').fill('nonexistent@example.com')
    await page.getByLabel('Passwort').fill('wrong-password')
    await page.getByRole('button', { name: 'Login' }).click()
    await expect(page.getByText('Email oder Passwort falsch.')).toBeVisible()
    await expect(page.getByLabel('Email')).toHaveValue('nonexistent@example.com')
    await expect(page.getByLabel('Passwort')).toHaveValue('wrong-password')
  })
})
