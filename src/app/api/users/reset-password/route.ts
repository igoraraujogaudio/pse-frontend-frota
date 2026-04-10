import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: NextRequest) {
  const { auth_user_id, newPassword, admin_id, reason, user_id } = await req.json();

  if (!user_id) {
    return NextResponse.json({ error: "user_id é obrigatório" }, { status: 400 });
  }

  if (!newPassword) {
    return NextResponse.json({ error: "newPassword é obrigatório" }, { status: 400 });
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Timeout para operações do Supabase (30 segundos)
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('Operação timeout após 30 segundos')), 30000);
  });

  try {
    // Se temos auth_user_id, tentar usar ele primeiro
    if (auth_user_id) {
      const authOperation = supabaseAdmin.auth.admin.getUserById(auth_user_id);
      const { data: authUser, error: getUserError } = await Promise.race([
        authOperation,
        timeoutPromise
      ]) as { data: { user: { id: string } } | null; error: { message: string } | null };
      
      if (!getUserError && authUser?.user) {
        // Usuário existe no Auth, apenas atualizar senha
        const updateOperation = supabaseAdmin.auth.admin.updateUserById(auth_user_id, {
          password: newPassword,
        });
        const { error } = await Promise.race([
          updateOperation,
          timeoutPromise
        ]) as { data: { user: { id: string } } | null; error: { message: string } | null };

        if (error) {
          console.error(`Erro ao atualizar senha do usuário ${auth_user_id}:`, error);
          return NextResponse.json({ error: error.message }, { status: 400 });
        }

        // Log de redefinição
        const { data: userData } = await supabaseAdmin
          .from('usuarios')
          .select('id')
          .eq('auth_usuario_id', auth_user_id)
          .single();

        if (userData && admin_id) {
          try {
            await supabaseAdmin.from('logs_redefinicao_senha').insert({
              usuario_id: userData.id,
              admin_id,
              motivo: reason || 'Reset de senha via painel administrativo',
              redefinido_em: new Date().toISOString(),
            });
          } catch (logError) {
            console.warn('Aviso: Não foi possível inserir log de redefinição de senha:', logError);
          }
        }

        return NextResponse.json({ success: true });
      }
    }

    // Se chegou aqui, auth_user_id não existe ou é inválido, buscar usuário na tabela
    console.log(`Usuário não encontrado no Auth ou sem auth_usuario_id. Buscando usuário na tabela: ${user_id}`);
    
    // Buscar dados do usuário na tabela usuarios pelo user_id
    const userOperation = supabaseAdmin
      .from('usuarios')
      .select('email, nome, id')
      .eq('id', user_id)
      .single();
    
    const { data: userData, error: userError } = await Promise.race([
      userOperation,
      timeoutPromise
        ]) as { data: Record<string, unknown>, error: { message: string } | null };
      
    console.log(`Resultado da busca na tabela usuarios:`, { userData, userError, user_id });
      
    if (userError || !userData) {
      console.error(`Erro ao buscar dados do usuário: ${user_id}`, userError);
      return NextResponse.json({ 
        error: `Usuário não encontrado na tabela usuarios. ID: ${user_id}. Erro: ${userError?.message || 'Dados não encontrados'}` 
      }, { status: 404 });
    }
    
    console.log(`Usuário encontrado na tabela:`, { 
      id: (userData as Record<string, unknown>).id, 
      nome: (userData as Record<string, unknown>).nome, 
      email: (userData as Record<string, unknown>).email 
    });
    
    // Verificar se tem email válido
    if (!(userData as Record<string, unknown>).email || String((userData as Record<string, unknown>).email).trim() === '') {
      console.error(`Usuário sem email válido: ${user_id}`, { nome: (userData as Record<string, unknown>).nome, email: (userData as Record<string, unknown>).email });
      return NextResponse.json({ 
        error: `Usuário ${(userData as Record<string, unknown>).nome || user_id} não possui email válido (email: "${(userData as Record<string, unknown>).email || 'vazio'}")` 
      }, { status: 400 });
    }
    
    // Tentar criar novo usuário no Auth
    const createOperation = supabaseAdmin.auth.admin.createUser({
      email: (userData as Record<string, unknown>).email as string,
      password: newPassword,
      email_confirm: true,
    });
    
    const { data: newAuthUser, error: createError } = await Promise.race([
      createOperation,
      timeoutPromise
        ]) as { data: Record<string, unknown>, error: { message: string, code?: string } | null };
    
    let authUserId;
    
    if (createError) {
      // Se o erro for "email já existe", buscar o usuário existente
      if (createError.message.includes('already been registered') || createError.code === 'email_exists') {
        console.log(`Usuário já existe no Auth: ${(userData as Record<string, unknown>).email}. Buscando usuário existente...`);
        
        // Buscar usuário existente pelo email
        const listOperation = supabaseAdmin.auth.admin.listUsers({
          page: 1,
          perPage: 1000
        });
        
        const { data: existingUsers, error: listError } = await Promise.race([
          listOperation,
          timeoutPromise
        ]) as { data: { user: { id: string } } | null; error: { message: string } | null };
        
        if (listError) {
          console.error(`Erro ao listar usuários: ${listError.message}`);
          return NextResponse.json({ 
            error: `Erro ao buscar usuário existente: ${listError.message}` 
          }, { status: 400 });
        }
        
        const existingUser = existingUsers?.user && Array.isArray(existingUsers.user) ? existingUsers.user.find((u: { email: string }) => u.email === (userData as Record<string, unknown>).email) : null;
        
        if (!existingUser) {
          console.error(`Usuário não encontrado na lista: ${(userData as Record<string, unknown>).email}`);
          return NextResponse.json({ 
            error: `Usuário com email ${(userData as Record<string, unknown>).email} não encontrado no sistema de autenticação` 
          }, { status: 404 });
        }
        
        authUserId = existingUser.id;
        console.log(`Usuário existente encontrado: ${(userData as Record<string, unknown>).email} (${authUserId})`);
        
        // Atualizar senha do usuário existente
        const updatePasswordOperation = supabaseAdmin.auth.admin.updateUserById(authUserId, {
          password: newPassword,
        });
        
        const { error: updatePasswordError } = await Promise.race([
          updatePasswordOperation,
          timeoutPromise
        ]) as { data: { user: { id: string } } | null; error: { message: string } | null };
        
        if (updatePasswordError) {
          console.error(`Erro ao atualizar senha: ${updatePasswordError.message}`);
          return NextResponse.json({ 
            error: `Erro ao atualizar senha do usuário existente: ${updatePasswordError.message}` 
          }, { status: 400 });
        }
        
      } else {
        console.error(`Erro ao criar usuário no Auth: ${userData.email}`, createError);
        return NextResponse.json({ 
          error: `Erro ao criar usuário no sistema de autenticação: ${createError?.message}` 
        }, { status: 400 });
      }
    } else {
      // Usuário criado com sucesso
        authUserId = ((newAuthUser as Record<string, unknown>).user as Record<string, unknown>)?.id;
      console.log(`Usuário criado com sucesso no Auth: ${(userData as Record<string, unknown>).email} (${authUserId})`);
    }
    
    // Atualizar o auth_usuario_id na tabela usuarios com o ID correto
    const updateAuthIdOperation = supabaseAdmin
      .from('usuarios')
      .update({ auth_usuario_id: authUserId })
      .eq('id', (userData as Record<string, unknown>).id);
    
    const { error: updateError } = await Promise.race([
      updateAuthIdOperation,
      timeoutPromise
        ]) as { error: { message: string } | null };
    
    if (updateError) {
      console.error(`Erro ao atualizar auth_usuario_id: ${authUserId}`, updateError);
      // Não falha aqui, pois o usuário foi criado/encontrado no Auth com sucesso
    }
    
    console.log(`auth_usuario_id atualizado: ${userData.email} -> ${authUserId}`);
    
    // Continuar com o log de redefinição
    const { data: updatedUserData } = await supabaseAdmin
      .from('usuarios')
      .select('id')
      .eq('auth_usuario_id', authUserId)
      .single();
    
    if (updatedUserData && admin_id) {
      try {
        await supabaseAdmin.from('logs_redefinicao_senha').insert({
          usuario_id: updatedUserData.id,
          admin_id,
          motivo: reason || 'Usuário recriado/encontrado no Auth durante reset de senha',
          redefinido_em: new Date().toISOString(),
        });
      } catch (logError) {
        console.warn('Aviso: Não foi possível inserir log de redefinição de senha:', logError);
      }
    }
    
    return NextResponse.json({ 
      success: true, 
      message: `Usuário ${(userData as Record<string, unknown>).nome} foi encontrado/recriado no sistema de autenticação e senha definida com sucesso.` 
    });

  } catch (error) {
    console.error('Erro geral na API de reset de senha:', error);
    return NextResponse.json({ 
      error: `Erro interno do servidor: ${error instanceof Error ? error.message : 'Erro desconhecido'}` 
    }, { status: 500 });
  }
} 