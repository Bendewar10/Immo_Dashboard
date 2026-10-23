import { createBrowserClient } from '@supabase/ssr'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. Set them in .env.local.'
  )
}

// Uses createBrowserClient (not createClient) so the session is stored in
// cookies instead of localStorage — middleware.ts reads the session from
// cookies to enforce route protection server-side.
export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey)
