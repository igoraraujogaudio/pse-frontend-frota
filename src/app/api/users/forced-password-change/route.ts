import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: NextRequest) {
  const { userId, newPassword, authUserId } = await req.json();

  if (!userId || !newPassword) {
    return NextResponse.json({ error: 'Dados obrigatórios ausentes.' }, { status: 400 });
  }

  if (newPassword.length < 6) {
    return NextResponse.json({ error: 'A senha deve ter pelo menos 6 caracteres.' }, { status: 400 });
  }

  // Validação adicional de segurança
  const hasUpperCase = /[A-Z]/.test(newPassword);
  const hasLowerCase = /[a-z]/.test(newPassword);
  const hasNumbers = /\d/.test(newPassword);

  if (!hasUpperCase || !hasLowerCase || !hasNumbers) {
    return NextResponse.json({ 
      error: 'A senha deve conter pelo menos uma letra maiúscula, uma minúscula e um número.' 
    }, { status: 400 });
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Buscar o auth_usuario_id se não foi fornecido
  let authUserIdToUse = authUserId;
  if (!authUserIdToUse) {
    const { data: userData, error: userError } = await supabaseAdmin
      .from('usuarios')
      .select('auth_usuario_id')
      .eq('id', userId)
      .single();

    if (userError || !userData) {
      return NextResponse.json({ error: 'Usuário não encontrado.' }, { status: 404 });
    }

    authUserIdToUse = userData.auth_usuario_id;
  }

  if (!authUserIdToUse) {
    return NextResponse.json({ error: 'ID de autenticação não encontrado.' }, { status: 400 });
  }

  // Atualiza a senha do usuário usando API REST direta (para evitar timeout do SDK)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  
  // Criar AbortController para timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 segundos
  
  try {
    const response = await fetch(`${supabaseUrl}/auth/v1/admin/users/${authUserIdToUse}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceRoleKey}`,
        'apikey': serviceRoleKey
      },
      body: JSON.stringify({
        password: newPassword
      }),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: `Erro HTTP ${response.status}` }));
      return NextResponse.json({ 
        error: errorData.message || errorData.error_description || `Erro HTTP ${response.status}` 
      }, { status: response.status });
    }

    // Verificar se a resposta está ok
    const result = await response.json();
    if (result.error) {
      return NextResponse.json({ error: result.error.message || result.error }, { status: 400 });
    }
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && (error.name === 'AbortError' || error.name === 'TimeoutError')) {
      return NextResponse.json({ 
        error: 'Timeout ao atualizar senha. O servidor demorou muito para responder.' 
      }, { status: 504 });
    }
    console.error('Erro ao atualizar senha:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Erro desconhecido ao atualizar senha' 
    }, { status: 500 });
  }

  // Atualiza os campos na tabela usuarios
  const { error: updateError } = await supabaseAdmin
    .from('usuarios')
    .update({ 
      deve_mudar_senha: false,
      senha_alterada: true,
      data_ultima_alteracao_senha: new Date().toISOString(),
      forcar_mudanca_senha: false
    })
    .eq('id', userId);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
