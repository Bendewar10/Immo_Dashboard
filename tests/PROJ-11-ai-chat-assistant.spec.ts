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
  employer?: string | null
  next_followup_at?: string | null
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

async function getContact(token: string, contactId: string) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/contacts?id=eq.${contactId}&select=*`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
  })
  const rows = await res.json()
  return rows[0] ?? null
}

async function getInteractions(token: string, contactId: string) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/interactions?contact_id=eq.${contactId}&select=*`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
  })
  return res.json()
}

async function findContactByName(token: string, userId: string, firstNameToken: string) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/contacts?user_id=eq.${userId}&first_name=ilike.${encodeURIComponent(`%${firstNameToken}%`)}&select=*`,
    { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` } }
  )
  return res.json()
}

async function wipeAllContacts(token: string, userId: string) {
  await fetch(`${SUPABASE_URL}/rest/v1/contacts?user_id=eq.${userId}`, {
    method: 'DELETE',
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
  })
}

async function wipeChatData(token: string, userId: string) {
  // Deleting conversations cascades chat_messages and pending_actions via FK.
  await fetch(`${SUPABASE_URL}/rest/v1/conversations?user_id=eq.${userId}`, {
    method: 'DELETE',
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
  })
}

function isoOffset(days: number) {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

async function login(page: Page) {
  await page.goto('/login')
  await page.waitForLoadState('networkidle')
  await page.getByLabel('Email').fill(EMAIL)
  await page.getByLabel('Passwort').fill(PASSWORD)
  await page.getByRole('button', { name: 'Login' }).click()
  await expect(page).toHaveURL('http://localhost:3000/dashboard')
}

async function openChat(page: Page) {
  await page.waitForLoadState('networkidle')
  await page.getByRole('button', { name: 'Chat öffnen' }).click()
  await expect(page.getByText('Assistent')).toBeVisible({ timeout: 10000 })
  // Known bug (PROJ-11 QA, High): the history GET fetch can resolve after a fast
  // send and clobber the optimistic message (setMessages replaces instead of merges).
  // Wait for the loading indicator to clear (a real UI signal) instead of relying on
  // network-idle timing, so this regression suite tests the feature, not the race.
  await expect(page.getByText('Lädt...')).toHaveCount(0, { timeout: 10000 })
}

async function ensureSidebarOpen(page: Page) {
  const newChatButton = page.getByRole('button', { name: 'Neuer Chat' })
  if (await newChatButton.isVisible().catch(() => false)) return
  await page.getByRole('button', { name: 'Chat-Liste einblenden' }).click()
  await expect(newChatButton).toBeVisible()
}

async function sendMessage(page: Page, text: string) {
  const textarea = page.getByPlaceholder('Nachricht an den Assistenten...')
  await textarea.fill(text)
  await textarea.press('Enter')
}

const AI_TIMEOUT = 30000

test.describe.serial('PROJ-11: AI Chat Assistant', () => {
  test.setTimeout(60000)

  let token: string
  let userId: string

  test.beforeAll(async () => {
    token = await getToken()
    userId = await getUserId(token)
  })

  test.beforeEach(async () => {
    await wipeAllContacts(token, userId)
    await wipeChatData(token, userId)
  })

  test.afterAll(async () => {
    await wipeAllContacts(token, userId)
    await wipeChatData(token, userId)
  })

  test('AC: empty chat shows greeting and example prompts', async ({ page }) => {
    await login(page)
    await openChat(page)
    await expect(page.getByText('Frag mich was zu deinen Kontakten')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Wer hat diese Woche Geburtstag?' })).toBeVisible()
  })

  test('AC: aggregate question is answered from real account data', async ({ page }) => {
    await seedContact(token, userId, 'Petra Klein', { next_followup_at: isoOffset(-5) })
    await seedContact(token, userId, 'Stefan Wagner', { next_followup_at: isoOffset(30) })

    await login(page)
    await openChat(page)
    await sendMessage(page, 'Wie viele Kontakte habe ich insgesamt und wie viele davon sind überfällig?')

    const reply = page.locator('[data-testid="chat-message"]').nth(1)
    await expect(reply).toContainText('2', { timeout: AI_TIMEOUT })
  })

  test('AC: logging an interaction via chat is applied directly, no confirmation', async ({ page }) => {
    const contactId = await seedContact(token, userId, 'Jonas Bauer')

    await login(page)
    await openChat(page)
    await sendMessage(page, 'Ich hab grad mit Jonas Bauer telefoniert, log das bitte.')
    await expect(page.locator('[data-testid="chat-message"]').nth(1)).toBeVisible({ timeout: AI_TIMEOUT })
    await expect(page.locator('[data-testid="pending-action-card"]')).toHaveCount(0)

    await expect
      .poll(async () => (await getInteractions(token, contactId)).length, { timeout: AI_TIMEOUT })
      .toBeGreaterThan(0)
  })

  test('AC: setting a follow-up via chat is applied directly, no confirmation', async ({ page }) => {
    const contactId = await seedContact(token, userId, 'Lena Hoffmann')
    const target = isoOffset(10)

    await login(page)
    await openChat(page)
    await sendMessage(page, `Setz das Follow-up für Lena Hoffmann auf ${target}.`)
    await expect(page.locator('[data-testid="chat-message"]').nth(1)).toBeVisible({ timeout: AI_TIMEOUT })
    await expect(page.locator('[data-testid="pending-action-card"]')).toHaveCount(0)

    await expect
      .poll(async () => (await getContact(token, contactId))?.next_followup_at?.slice(0, 10), { timeout: AI_TIMEOUT })
      .toBe(target)
  })

  test('AC: creating a contact via chat is applied directly, no confirmation', async ({ page }) => {
    await login(page)
    await openChat(page)
    await sendMessage(page, 'Leg einen neuen Kontakt namens Felix Neumann an.')
    await expect(page.locator('[data-testid="chat-message"]').nth(1)).toBeVisible({ timeout: AI_TIMEOUT })
    await expect(page.locator('[data-testid="pending-action-card"]')).toHaveCount(0)

    await expect
      .poll(async () => (await findContactByName(token, userId, 'Felix')).length, { timeout: AI_TIMEOUT })
      .toBeGreaterThan(0)
  })

  test('AC: overwriting a filled field requires confirmation before it is changed', async ({ page }) => {
    const contactId = await seedContact(token, userId, 'Tobias Schreiber', { employer: 'OldCorp' })

    await login(page)
    await openChat(page)
    await sendMessage(page, 'Ändere den Arbeitgeber von Tobias Schreiber auf NewCorp.')

    const card = page.locator('[data-testid="pending-action-card"]')
    await expect(card).toBeVisible({ timeout: AI_TIMEOUT })
    await expect(card).toContainText('OldCorp')
    await expect(card).toContainText('NewCorp')

    expect((await getContact(token, contactId)).employer).toBe('OldCorp')

    await card.getByRole('button', { name: 'Bestätigen' }).click()
    await expect(card).toHaveCount(0, { timeout: AI_TIMEOUT })
    await expect
      .poll(async () => (await getContact(token, contactId)).employer, { timeout: AI_TIMEOUT })
      .toBe('NewCorp')
  })

  test('AC: ambiguous name match asks for clarification instead of acting', async ({ page }) => {
    await seedContact(token, userId, 'Mara Becker', { employer: 'Initech' })
    await seedContact(token, userId, 'Mara Vogel', { employer: 'Globex' })

    await login(page)
    await openChat(page)
    await sendMessage(page, 'Lösch den Kontakt Mara.')

    const reply = page.locator('[data-testid="chat-message"]').nth(1)
    await expect(reply).toBeVisible({ timeout: AI_TIMEOUT })
    await expect(reply).toContainText('Initech')
    await expect(reply).toContainText('Globex')
    await expect(page.locator('[data-testid="pending-action-card"]')).toHaveCount(0)
  })

  test('AC: declining a proposed deletion makes no change', async ({ page }) => {
    const contactId = await seedContact(token, userId, 'Sabine Wolf')

    await login(page)
    await openChat(page)
    await sendMessage(page, 'Lösch den Kontakt Sabine Wolf.')

    const card = page.locator('[data-testid="pending-action-card"]')
    await expect(card).toBeVisible({ timeout: AI_TIMEOUT })
    await card.getByRole('button', { name: 'Abbrechen' }).click()
    await expect(card).toHaveCount(0, { timeout: AI_TIMEOUT })

    expect(await getContact(token, contactId)).not.toBeNull()
  })

  test('AC: confirming a proposed deletion removes the contact', async ({ page }) => {
    const contactId = await seedContact(token, userId, 'Markus Lehmann')

    await login(page)
    await openChat(page)
    await sendMessage(page, 'Lösch den Kontakt Markus Lehmann.')

    const card = page.locator('[data-testid="pending-action-card"]')
    await expect(card).toBeVisible({ timeout: AI_TIMEOUT })
    await card.getByRole('button', { name: 'Bestätigen' }).click()
    await expect(card).toHaveCount(0, { timeout: AI_TIMEOUT })

    await expect.poll(async () => getContact(token, contactId), { timeout: AI_TIMEOUT }).toBeNull()
  })

  test('AC: bulk delete proposes all matching contacts and confirmation removes them all', async ({ page }) => {
    const id1 = await seedContact(token, userId, 'Anna Krüger')
    const id2 = await seedContact(token, userId, 'Paul Richter')

    await login(page)
    await openChat(page)
    await sendMessage(page, 'Lösch alle Kontakte ohne Follow-up-Termin.')

    const card = page.locator('[data-testid="pending-action-card"]')
    await expect(card).toBeVisible({ timeout: AI_TIMEOUT })
    await expect(card).toContainText('Anna Krüger')
    await expect(card).toContainText('Paul Richter')

    await card.getByRole('button', { name: 'Bestätigen' }).click()
    await expect(card).toHaveCount(0, { timeout: AI_TIMEOUT })

    await expect.poll(async () => getContact(token, id1), { timeout: AI_TIMEOUT }).toBeNull()
    expect(await getContact(token, id2)).toBeNull()
  })

  test('AC: chat history persists across a page reload', async ({ page }) => {
    await login(page)
    await openChat(page)
    await sendMessage(page, 'Wie viele Kontakte habe ich?')
    await expect(page.locator('[data-testid="chat-message"]').nth(1)).toBeVisible({ timeout: AI_TIMEOUT })

    await page.reload()
    await openChat(page)
    await expect(page.getByText('Wie viele Kontakte habe ich?').first()).toBeVisible()
  })

  test('AC: clearing the active conversation asks for confirmation, then empties the panel and the DB', async ({
    page,
  }) => {
    await login(page)
    await openChat(page)
    await sendMessage(page, 'Wie viele Kontakte habe ich?')
    await expect(page.locator('[data-testid="chat-message"]').nth(1)).toBeVisible({ timeout: AI_TIMEOUT })

    await page.getByRole('button', { name: 'Verlauf löschen' }).click()
    await expect(page.getByText('Verlauf löschen?')).toBeVisible()
    await page.getByRole('button', { name: 'Abbrechen' }).click()
    await expect(page.locator('[data-testid="chat-message"]')).toHaveCount(2)

    await page.getByRole('button', { name: 'Verlauf löschen' }).click()
    await page.getByRole('button', { name: 'Löschen' }).click()
    await expect(page.locator('[data-testid="chat-message"]')).toHaveCount(0)
    await expect(page.getByText('Frag mich was zu deinen Kontakten')).toBeVisible()

    await page.reload()
    await openChat(page)
    await expect(page.getByText('Frag mich was zu deinen Kontakten')).toBeVisible()
  })

  test('AC: new chat starts a separate conversation, both appear in the sidebar', async ({ page }) => {
    await login(page)
    await openChat(page)
    await sendMessage(page, 'Wie viele Kontakte habe ich?')
    await expect(page.locator('[data-testid="chat-message"]').nth(1)).toBeVisible({ timeout: AI_TIMEOUT })

    await ensureSidebarOpen(page)
    await page.getByRole('button', { name: 'Neuer Chat' }).click()
    await expect(page.getByText('Frag mich was zu deinen Kontakten')).toBeVisible()
    await sendMessage(page, 'Wer hat diese Woche Geburtstag?')
    await expect(page.locator('[data-testid="chat-message"]').nth(1)).toBeVisible({ timeout: AI_TIMEOUT })

    await ensureSidebarOpen(page)
    await expect(page.locator('[data-testid="conversation-item"]')).toHaveCount(2)
    await expect(page.getByTestId('conversation-item').filter({ hasText: 'Wie viele Kontakte habe ich?' })).toBeVisible()
    await expect(page.getByTestId('conversation-item').filter({ hasText: 'Wer hat diese Woche Geburtstag?' })).toBeVisible()
  })

  test('AC: switching conversation in the sidebar loads that conversation\'s messages', async ({ page }) => {
    await login(page)
    await openChat(page)
    await sendMessage(page, 'Wie viele Kontakte habe ich?')
    await expect(page.locator('[data-testid="chat-message"]').nth(1)).toBeVisible({ timeout: AI_TIMEOUT })

    await ensureSidebarOpen(page)
    await page.getByRole('button', { name: 'Neuer Chat' }).click()
    await sendMessage(page, 'Wer hat diese Woche Geburtstag?')
    await expect(page.locator('[data-testid="chat-message"]').nth(1)).toBeVisible({ timeout: AI_TIMEOUT })

    await ensureSidebarOpen(page)
    await page.getByTestId('conversation-item').filter({ hasText: 'Wie viele Kontakte habe ich?' }).click()
    await expect(page.getByText('Wie viele Kontakte habe ich?').first()).toBeVisible()
    await expect(page.locator('[data-testid="chat-message"]')).toHaveCount(2)
  })

  test('AC: deleting the active conversation switches to another one, or to a fresh new chat if none remain', async ({
    page,
  }) => {
    await login(page)
    await openChat(page)
    await sendMessage(page, 'Wie viele Kontakte habe ich?')
    await expect(page.locator('[data-testid="chat-message"]').nth(1)).toBeVisible({ timeout: AI_TIMEOUT })

    await page.getByRole('button', { name: 'Verlauf löschen' }).click()
    await page.getByRole('button', { name: 'Löschen' }).click()
    await expect(page.locator('[data-testid="conversation-item"]')).toHaveCount(0)
    await expect(page.getByText('Frag mich was zu deinen Kontakten')).toBeVisible()
  })

  test('Security: unauthenticated request to /api/chat is blocked', async ({ request }) => {
    const res = await request.post('http://localhost:3000/api/chat', {
      data: { content: 'Hallo' },
      maxRedirects: 0,
    })
    expect([401, 307, 308]).toContain(res.status())
  })

  test('Security: confirming a non-existent or already-resolved pending action is rejected', async ({
    page,
  }) => {
    await login(page)
    const res = await page.request.post('/api/chat/confirm', {
      data: { pendingActionId: '00000000-0000-0000-0000-000000000000', decision: 'confirm' },
    })
    expect(res.status()).toBe(409)
  })

  test('Security: unauthenticated request to DELETE /api/chat/conversations/:id is blocked', async ({ request }) => {
    const res = await request.delete(
      'http://localhost:3000/api/chat/conversations/00000000-0000-0000-0000-000000000000',
      { maxRedirects: 0 }
    )
    expect([401, 307, 308]).toContain(res.status())
  })

  test('Security: deleting a non-existent or unowned conversation returns 404', async ({ page }) => {
    await login(page)
    const res = await page.request.delete(
      '/api/chat/conversations/00000000-0000-0000-0000-000000000000'
    )
    expect(res.status()).toBe(404)
  })

  test('Security: invalid decision value is rejected', async ({ page }) => {
    await login(page)
    const res = await page.request.post('/api/chat/confirm', {
      data: { pendingActionId: '00000000-0000-0000-0000-000000000000', decision: 'maybe' },
    })
    expect(res.status()).toBe(400)
  })
})
