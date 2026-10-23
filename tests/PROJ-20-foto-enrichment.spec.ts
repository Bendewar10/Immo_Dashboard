import { test, expect, type Page } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'

const EMAIL = process.env.QA_TEST_EMAIL!
const PASSWORD = process.env.QA_TEST_PASSWORD!

// Ein öffentlich erreichbares Foto im contact-photos-Bucket (Seed-Bild).
const PHOTO_URL =
  'https://srxatexcffjebolqttaq.supabase.co/storage/v1/object/public/contact-photos/b45ccb9d-1efd-4c22-a77d-a37639c53fbc/yisa-wu.jpg'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

async function qaUserId(): Promise<string> {
  const { data, error } = await admin.auth.admin.listUsers()
  if (error) throw error
  const user = data.users.find((u) => u.email === EMAIL)
  if (!user) throw new Error(`QA user ${EMAIL} not found`)
  return user.id
}

async function login(page: Page) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(EMAIL)
  await page.getByLabel('Passwort').fill(PASSWORD)
  await page.getByRole('button', { name: 'Login' }).click()
  await expect(page).toHaveURL('http://localhost:3000/dashboard')
  await page.goto('/contacts')
}

function cardFor(page: Page, name: string) {
  return page.locator('.cursor-pointer', { hasText: name })
}

const withPhotoName = `QA-Photo ${Date.now()}`
const noPhotoName = `QA-NoPhoto ${Date.now()}`
const createdIds: string[] = []

test.describe.serial('PROJ-20: LinkedIn Foto-Enrichment', () => {
  test.beforeAll(async () => {
    const userId = await qaUserId()
    const { data, error } = await admin
      .from('contacts')
      .insert([
        { user_id: userId, first_name: withPhotoName, photo_url: PHOTO_URL },
        { user_id: userId, first_name: noPhotoName },
      ])
      .select('id')
    if (error) throw error
    for (const row of data ?? []) createdIds.push(row.id)
  })

  test.afterAll(async () => {
    if (createdIds.length) await admin.from('contacts').delete().in('id', createdIds)
  })

  test('AC8: clicking a contact photo opens the enlarged lightbox', async ({ page }) => {
    await login(page)
    const card = cardFor(page, withPhotoName)
    await expect(card).toBeVisible()
    // Avatar mit Foto klickbar (cursor-zoom-in), Klick öffnet Lightbox-Dialog.
    await card.locator('.cursor-zoom-in').click()
    await expect(page.getByRole('dialog').getByRole('img')).toBeVisible()
  })

  test('AC9: a contact without a photo shows initials, no image', async ({ page }) => {
    await login(page)
    const card = cardFor(page, noPhotoName)
    await expect(card).toBeVisible()
    // Kein <img> im Karten-Avatar → Fallback auf Initialen.
    await expect(card.getByRole('img')).toHaveCount(0)
  })
})
