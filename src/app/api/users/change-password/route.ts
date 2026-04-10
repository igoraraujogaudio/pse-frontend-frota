import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: NextRequest) {
  const { userId, newPassword, authUserId } = await req.json();

  if (!userId || !newPassword) {
    return NextResponse.json({ error: 'Dados obrigatórios ausentes.' }, { status: 400 });
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

  // Atualiza a senha do usuário
  const { error } = await supabaseAdmin.auth.admin.updateUserById(authUserIdToUse, {
    password: newPassword,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // Atualiza o status para 'active' e remove a obrigatoriedade de mudança de senha
  const { error: updateError } = await supabaseAdmin
    .from('usuarios')
    .update({ 
      status: 'active',
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