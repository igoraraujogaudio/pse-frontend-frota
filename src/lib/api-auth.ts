// lib/api-auth.ts — Helper reutilizável para validação de auth em API Routes
// Requisitos: 4.2, 4.3, 4.5, 4.6, 12.2, 12.4
//
// Uso:
//   const auth = await authenticateRequest();
//   if (auth instanceof NextResponse) return auth; // 401
//   const { user, supabase } = auth;
//
//   const denied = await requirePermission(user.id, 'almoxarifado.estoque.editar');
//   if (denied) return denied; // 403

import { NextResponse } from 'next/server';
import { createServerSupabase } from './supabase-server';
import { supabaseAdmin } from './supabase-admin';
import type { SupabaseClient, User } from '@supabase/supabase-js';

/**
 * Resultado de autenticação bem-sucedida.
 */
export interface AuthResult {
  user: User;
  supabase: SupabaseClient;
}

/**
 * Valida o JWT do cookie e retorna o usuário autenticado.
 *
 * @returns `{ user, supabase }` em caso de sucesso, ou `NextResponse` 401 em caso de falha.
 */
export async function authenticateRequest(): Promise<AuthResult | NextResponse> {
  const supabase = await createServerSupabase();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  return { user, supabase };
}

/**
 * Verifica se o usuário possui uma permissão específica via RPC `tem_permissao`.
 *
 * @param authId - UUID do auth.users (user.id)
 * @param permissionCode - Código da permissão (ex: 'almoxarifado.estoque.editar')
 * @returns `true` se permitido, `false` caso contrário.
 */
export async function checkPermission(authId: string, permissionCode: string): Promise<boolean> {
  const { data } = await supabaseAdmin.rpc('tem_permissao', {
    p_auth_id: authId,
    p_codigo: permissionCode,
  });

  return data === true;
}

/**
 * Verifica permissão e retorna resposta 403 se negada.
 *
 * @param authId - UUID do auth.users (user.id)
 * @param permissionCode - Código da permissão (ex: 'almoxarifado.estoque.editar')
 * @returns `null` se permitido, ou `NextResponse` 403 se negado.
 */
export async function requirePermission(authId: string, permissionCode: string): Promise<NextResponse | null> {
  const allowed = await checkPermission(authId, permissionCode);

  if (!allowed) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
  }

  return null;
}
