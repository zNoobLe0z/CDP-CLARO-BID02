import { createClient } from '@supabase/supabase-js'
import { config } from '../../lib/config'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

// Não inicializar um projeto real no modo de demonstração.
export const authClient =
  !config.demo && url && key
    ? createClient(url, key, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: false,
        },
      })
    : null
