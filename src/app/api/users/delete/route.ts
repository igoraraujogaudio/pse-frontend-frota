import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function DELETE(req: NextRequest) {
  try {
    const { userId } = await req.json();

    if (!userId) {
      return NextResponse.json({ error: 'ID do usuário é obrigatório' }, { status: 400 });
    }

    // Cria client admin para operações privilegiadas
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 1. Buscar o usuário para obter o auth_usuario_id
    const { data: usuario, error: fetchError } = await supabaseAdmin
      .from('usuarios')
      .select('auth_usuario_id, nome, email, nivel_acesso')
      .eq('id', userId)
      .single();

    if (fetchError) {
      console.error('Erro ao buscar usuário:', fetchError);
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });
    }

    // Verificar se o usuário não é admin ou diretor (proteção adicional)
    if (['admin', 'diretor'].includes(usuario.nivel_acesso)) {
      return NextResponse.json({ 
        error: 'Não é possível excluir usuários administradores ou diretores' 
      }, { status: 403 });
    }

    // 2. Remover relacionamentos primeiro (para evitar constraint errors)
    
    // Remover associações com contratos
    const { error: contratoError } = await supabaseAdmin
      .from('usuario_contratos')
      .delete()
      .eq('usuario_id', userId);

    if (contratoError) {
      console.error('Erro ao remover associações com contratos:', contratoError);
    }

    // Remover associações com bases
    const { error: baseError } = await supabaseAdmin
      .from('usuario_bases')
      .delete()
      .eq('usuario_id', userId);

    if (baseError) {
      console.error('Erro ao remover associações com bases:', baseError);
    }


    // Remover permissões específicas do usuário
    const { error: permissaoError } = await supabaseAdmin
      .from('usuario_funcionalidades')
      .delete()
      .eq('usuario_id', userId);

    if (permissaoError) {
      console.error('Erro ao remover permissões específicas:', permissaoError);
    }

    // 3. Remover da tabela usuarios
    const { error: deleteUserError } = await supabaseAdmin
      .from('usuarios')
      .delete()
      .eq('id', userId);

    if (deleteUserError) {
      console.error('Erro ao excluir usuário da tabela usuarios:', deleteUserError);
      return NextResponse.json({ 
        error: 'Erro ao excluir usuário do sistema' 
      }, { status: 500 });
    }

    // 4. Remover do Supabase Auth (se tiver auth_usuario_id)
    if (usuario.auth_usuario_id) {
      const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(
        usuario.auth_usuario_id
      );

      if (authDeleteError) {
        console.error('Erro ao excluir usuário do auth:', authDeleteError);
        // Não retornamos erro aqui pois o usuário já foi removido da tabela
        // Apenas logamos o erro
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: `Usuário ${usuario.nome} (${usuario.email}) excluído com sucesso do sistema e do auth.`,
      deletedUser: {
        id: userId,
        nome: usuario.nome,
        email: usuario.email
      }
    });

  } catch (error) {
    console.error('Erro interno ao excluir usuário:', error);
    return NextResponse.json({ 
      error: 'Erro interno do servidor' 
    }, { status: 500 });
  }
}
