// =============================================================================
// STUB TEMPORÁRIO — NÃO USAR EM CÓDIGO NOVO DE FROTA
// =============================================================================
// Este arquivo existe para que os módulos ainda não migrados (admin,
// almoxarifado, obras, sesmt, etc.) continuem compilando.
// Todos os services de FROTA já usam apiClient via proxy.
//
// TODO: Migrar os módulos restantes para apiClient e deletar este arquivo.
// =============================================================================

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
