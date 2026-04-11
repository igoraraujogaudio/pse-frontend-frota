// =============================================================================
// STUB TEMPORÁRIO — NÃO USAR EM CÓDIGO NOVO DE FROTA
// =============================================================================
// Este arquivo existe para que os módulos ainda não migrados (admin,
// vehicles API routes, etc.) continuem compilando.
// Todos os services de FROTA já usam apiClient via proxy.
//
// TODO: Migrar os módulos restantes para apiClient e deletar este arquivo.
// =============================================================================

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Re-export createClient para compatibilidade
export { createClient } from '@supabase/supabase-js'

/**
 * Cria um client Supabase autenticado com o token do usuário.
 * Usado pelas API routes que ainda acessam Supabase diretamente.
 */
export function createClientWithAuth(token?: string) {
  if (token) {
    return createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    })
  }
  return supabase
}
