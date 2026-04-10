// API Route: /api/auth/login
// Requisitos: 12.1, 12.3
//
// Aceita login via email ou matrícula.
// Se matrícula: resolve email via RPC get_email_by_matricula().
// Autentica via signInWithPassword e seta cookie httpOnly automaticamente
// via createServerSupabase().

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerSupabase } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabase-admin';

const loginSchema = z.object({
  identifier: z
    .string()
    .min(1, 'Identificador é obrigatório')
    .trim(),
  password: z
    .string()
    .min(1, 'Senha é obrigatória'),
});

function isEmail(value: string): boolean {
  return value.includes('@');
}

export async function POST(req: NextRequest) {
  // 1. Validar input com Zod
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 });
  }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Dados inválidos', details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const { identifier, password } = parsed.data;

  // 2. Resolver email — se não for email, tratar como matrícula
  let email: string;

  if (isEmail(identifier)) {
    email = identifier;
  } else {
    // Usar service_role para chamar RPC (usuário ainda não está autenticado)
    const { data, error } = await supabaseAdmin.rpc('get_email_by_matricula', {
      p_matricula: identifier,
    });

    if (error || !data) {
      return NextResponse.json(
        { error: 'Matrícula não encontrada ou usuário inativo' },
        { status: 401 },
      );
    }

    email = data as string;
  }

  // 3. Autenticar via signInWithPassword (cookie httpOnly setado automaticamente)
  const supabase = await createServerSupabase();
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (authError || !authData.user) {
    return NextResponse.json(
      { error: 'Credenciais inválidas' },
      { status: 401 },
    );
  }

  // 4. Buscar dados do usuário na tabela usuarios
  const { data: userData, error: userError } = await supabaseAdmin
    .from('usuarios')
    .select('id, nome, email, matricula, cargo, status, perfil_acesso_id, contrato_origem_id')
    .eq('auth_id', authData.user.id)
    .single();

  if (userError || !userData) {
    return NextResponse.json(
      { error: 'Usuário não encontrado no sistema' },
      { status: 401 },
    );
  }

  return NextResponse.json({
    user: userData,
    session: {
      access_token: authData.session?.access_token,
      expires_at: authData.session?.expires_at,
    },
  });
}
