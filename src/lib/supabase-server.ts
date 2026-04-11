// STUB TEMPORÁRIO — módulos não-frota ainda importam deste arquivo
// TODO: Migrar para apiClient e deletar
import { supabase } from './supabase'
export function createServerSupabase() { return supabase }
export { supabase as supabaseServer } from './supabase'
