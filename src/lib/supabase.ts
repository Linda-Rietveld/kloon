import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('VITE_SUPABASE_URL en VITE_SUPABASE_ANON_KEY zijn verplicht in .env.local.')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
