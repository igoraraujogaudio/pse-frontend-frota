import { createClient as createSupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Create client with custom fetch that removes anon key from authorization header
export const supabase = createSupabaseClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    storageKey: 'pse-auth-token'
  },
  global: {
    fetch: async (url, options = {}) => {
      const headers = new Headers(options.headers)
      
      // Se o header authorization contém a anon key, remove-o
      const authHeader = headers.get('authorization')
      if (authHeader && authHeader.includes(supabaseAnonKey)) {
        headers.delete('authorization')
      }
      
      return fetch(url, {
        ...options,
        headers
      })
    }
  },
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  }
})

// Server-side client for API routes
export function createClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseAnonKey
  return createSupabaseClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
}

// Server-side client with JWT token for API routes
export function createClientWithAuth(jwt: string) {
  return createSupabaseClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${jwt}`
      }
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
}