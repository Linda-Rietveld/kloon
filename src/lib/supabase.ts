import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const supabaseConfigError = !supabaseUrl || !supabaseAnonKey
  ? 'Vercel mist VITE_SUPABASE_URL en/of VITE_SUPABASE_ANON_KEY.'
  : ''

export const supabase = createClient(
  supabaseUrl ?? 'https://placeholder.supabase.co',
  supabaseAnonKey ?? 'missing-supabase-anon-key',
)
