import { createClient } from '@supabase/supabase-js'

// Service-Role-Client: nur serverseitig in geschützten Hintergrund-Jobs (z.B. Cron)
// verwenden — umgeht RLS. Der Key darf NIEMALS mit NEXT_PUBLIC_ exponiert werden.
export function createSupabaseAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceRoleKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.')
  }

  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
