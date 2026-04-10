import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// ============================================================================
// API PARA REATIVAR FUNCIONÁRIO DEMITIDO
// ============================================================================

export async function PUT(request: NextRequest) {
  try {
    const { usuario_id, observacoes_reativacao } = await request.json();

    if (!usuario_id) {
      return NextResponse.json(
        { error: 'ID do usuário é obrigatório' },
        { status: 400 }
      );
    }

    // Criar cliente Supabase com service role
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Verificar se o funcionário está demitido
    const { data: funcionarioDemitido, error: demitidoError } = await supabaseAdmin
      .from('usuarios')
      .select('*')
      .eq('id', usuario_id)
      .eq('status', 'demitido')
      .single();

    if (demitidoError || !funcionarioDemitido) {
      return NextResponse.json(
        { error: 'Funcionário não encontrado ou não está demitido' },
        { status: 404 }
      );
    }

    // 1. Reativar funcionário na tabela usuarios (soft delete)
    const { data: reativacaoResult, error: reativacaoError } = await supabaseAdmin
      .from('usuarios')
      .update({
        status: 'ativo',
        data_demissao: null,
        tipo_demissao: null,
        observacoes_demissao: null,
        demitido_por: null,
        atualizado_em: new Date().toISOString()
      })
      .eq('id', usuario_id)
      .eq('status', 'demitido')
      .select('id, auth_usuario_id')
      .single();

    if (reativacaoError) {
      console.error('Erro ao reativar funcionário:', reativacaoError);
      return NextResponse.json(
        { error: 'Erro interno ao processar reativação' },
        { status: 500 }
      );
    }

    // 2. Verificar se a reativação foi bem-sucedida
    if (!reativacaoResult) {
      return NextResponse.json(
        { error: 'Funcionário não pôde ser reativado' },
        { status: 400 }
      );
    }

    // 3. RECRIAR usuário no Supabase Auth (já que foi deletado na demissão)
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      
      console.log('🔄 RECRIANDO usuário no Auth:', funcionarioDemitido.email);
      
      const authResponse = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${serviceRoleKey}`,
          'Content-Type': 'application/json',
          'apikey': serviceRoleKey || ''
        },
        body: JSON.stringify({
          email: funcionarioDemitido.email,
          password: 'TempPassword123!', // Senha temporária
          email_confirm: true,
          user_metadata: {
            nome: funcionarioDemitido.nome,
            matricula: funcionarioDemitido.matricula,
            cpf: funcionarioDemitido.cpf
          }
        })
      });

      console.log('Resposta do Admin API (CREATE):', authResponse.status, authResponse.statusText);
      
      if (!authResponse.ok) {
        const errorText = await authResponse.text();
        console.error('❌ Erro ao recriar usuário:', errorText);
        console.warn('⚠️ Aviso: Não foi possível recriar o usuário no Auth');
      } else {
        const newUser = await authResponse.json();
        console.log('✅ Usuário RECRIADO com sucesso no Supabase Auth:', newUser.id);
        
        // Atualizar o auth_usuario_id na tabela usuarios
        await supabaseAdmin
          .from('usuarios')
          .update({ auth_usuario_id: newUser.id })
          .eq('id', usuario_id);
      }
    } catch (authError) {
      console.error('❌ Erro ao recriar usuário no Auth:', authError);
      console.warn('⚠️ Aviso: Erro ao recriar usuário no Auth');
    }

    // 4. Registrar no histórico de demissões
    try {
      await supabaseAdmin
        .from('historico_demissoes')
        .insert({
          usuario_id: usuario_id,
          data_demissao: funcionarioDemitido.data_demissao,
          tipo_demissao: funcionarioDemitido.tipo_demissao,
          observacoes: funcionarioDemitido.observacoes_demissao,
          demitido_por: funcionarioDemitido.demitido_por,
          data_reativacao: new Date().toISOString().split('T')[0],
          observacoes_reativacao: observacoes_reativacao,
          reativado_por: null // TODO: Implementar autenticação
        });
    } catch (historicoError) {
      console.warn('Aviso: Erro ao registrar reativação no histórico:', historicoError);
    }

    return NextResponse.json({
      success: true,
      message: 'Funcionário reativado com sucesso',
      usuario_id: usuario_id
    });

  } catch (error) {
    console.error('Erro na API de reativação:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
