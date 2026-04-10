'use client'

import { supabase } from '@/lib/supabase'

/**
 * Hook personalizado para usar o cliente Supabase
 * Garante que apenas uma instância seja usada em toda a aplicação
 */
export function useSupabase() {
  return supabase
}


