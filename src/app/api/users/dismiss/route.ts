import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// ============================================================================
// API PARA DEMITIR FUNCIONÁRIO
// ============================================================================

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      usuario_id,
      data_demissao,
      tipo_demissao = 'sem_justa_causa',
      observacoes,
    } = body;

    // Validações obrigatórias
    if (!usuario_id) {
      return NextResponse.json(
        { error: 'ID do usuário é obrigatório' },
        { status: 400 }
      );
    }

    // Motivo da demissão foi REMOVIDO completamente

    // Tipos de demissão válidos
    const tiposValidos = ['sem_justa_causa', 'com_justa_causa', 'pedido_demissao', 'aposentadoria', 'falecimento', 'outros'];
    if (!tiposValidos.includes(tipo_demissao)) {
      return NextResponse.json(
        { error: 'Tipo de demissão inválido' },
        { status: 400 }
      );
    }

    // Criar cliente Supabase com service role para operações administrativas
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Verificar se o usuário existe e está ativo
    const { data: usuario, error: usuarioError } = await supabaseAdmin
      .from('usuarios')
      .select('*, auth_usuario_id')
      .eq('id', usuario_id)
      .eq('status', 'ativo')
      .single();

    if (usuarioError || !usuario) {
      return NextResponse.json(
        { error: 'Usuário não encontrado ou já inativo' },
        { status: 404 }
      );
    }

    console.log('🔍 Usuário encontrado:');
    console.log('  - ID da tabela usuarios:', usuario.id);
    console.log('  - Nome:', usuario.nome);
    console.log('  - Email:', usuario.email);
    console.log('  - auth_usuario_id:', usuario.auth_usuario_id);
    console.log('  - Status:', usuario.status);

    // Verificar se já não está demitido (usando tabela usuarios com status)
    if (usuario.status === 'demitido') {
      return NextResponse.json(
        { error: 'Funcionário já está demitido' },
        { status: 400 }
      );
    }

    // 1. Verificar se funcionário tem itens no inventário
    const { data: inventarioCheck, error: inventarioError } = await supabaseAdmin
      .rpc('verificar_inventario_funcionario', {
        p_usuario_id: usuario_id
      });

    if (inventarioError) {
      console.error('Erro ao verificar inventário:', inventarioError);
      return NextResponse.json(
        { error: 'Erro interno ao verificar inventário' },
        { status: 500 }
      );
    }

    // 2. Se tem itens pendentes, bloquear demissão
    if (inventarioCheck && inventarioCheck.tem_itens) {
      return NextResponse.json(
        { 
          error: 'Demissão bloqueada',
          motivo: inventarioCheck.mensagem_erro,
          itens_pendentes: inventarioCheck.itens_pendentes,
          total_itens: inventarioCheck.total_itens,
          acao_necessaria: 'O funcionário deve devolver todos os itens do inventário antes da demissão'
        },
        { status: 400 }
      );
    }

    // 3. Executar demissão com validação completa
    const { data: demissaoResult, error: demissaoError } = await supabaseAdmin
      .rpc('demitir_funcionario_com_validacao', {
        p_usuario_id: usuario_id,
        p_data_demissao: data_demissao || new Date().toISOString().split('T')[0],
        p_tipo_demissao: tipo_demissao,
        p_observacoes: observacoes,
        p_demitido_por: null
      });

    if (demissaoError) {
      console.error('Erro ao demitir funcionário:', demissaoError);
      return NextResponse.json(
        { 
          error: 'Erro interno ao processar demissão',
          detalhes: demissaoError.message,
          codigo: demissaoError.code
        },
        { status: 500 }
      );
    }

    // 4. Verificar se a demissão foi bem-sucedida
    // A função RPC retorna um array, então pegamos o primeiro elemento
    const resultado = Array.isArray(demissaoResult) ? demissaoResult[0] : demissaoResult;
    
    if (!resultado || !resultado.sucesso) {
      console.error('Demissão falhou:', resultado);
      return NextResponse.json(
        { 
          error: 'Demissão não autorizada',
          motivo: resultado?.mensagem || 'Erro desconhecido',
          detalhes: resultado
        },
        { status: 400 }
      );
    }

    console.log('✅ Demissão bem-sucedida:', resultado);

    // 5. DELETAR usuário completamente do Supabase Auth
    if (usuario.auth_usuario_id) {
      try {
        console.log('🗑️ DELETANDO usuário do Auth:');
        console.log('  - ID da tabela usuarios:', usuario.id);
        console.log('  - ID do Auth (auth_usuario_id):', usuario.auth_usuario_id);
        
        const { data, error } = await supabaseAdmin.auth.admin.deleteUser(usuario.auth_usuario_id);

        if (error) {
          console.error('❌ Erro ao deletar usuário:', error.message);
          console.error('❌ Detalhes do erro:', error);
          console.warn('⚠️ Aviso: Não foi possível deletar o usuário do Auth');
        } else {
          console.log('✅ Usuário DELETADO com sucesso do Auth:', data);
        }
      } catch (authError) {
        console.error('❌ Erro ao deletar usuário do Auth:', authError);
        console.warn('⚠️ Aviso: Erro ao deletar usuário do Auth');
      }
    } else {
      console.warn('⚠️ Usuário não possui auth_usuario_id, pulando deleção do Auth');
      console.log('  - ID da tabela usuarios:', usuario.id);
      console.log('  - auth_usuario_id:', usuario.auth_usuario_id);
    }

    return NextResponse.json({
      success: true,
      message: 'Funcionário demitido com sucesso',
      funcionario_demitido_id: usuario_id,
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        matricula: usuario.matricula,
        email: usuario.email
      }
    });

  } catch (error) {
    console.error('Erro na API de demissão:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// ============================================================================
// API PARA REATIVAR FUNCIONÁRIO
// ============================================================================

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      usuario_id,
      observacoes_reativacao,
      nova_senha,
    } = body;

    // Validações obrigatórias
    if (!usuario_id) {
      return NextResponse.json(
        { error: 'ID do usuário é obrigatório' },
        { status: 400 }
      );
    }

    // Criar cliente Supabase com service role
    const supabaseAdmin = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Verificar se o funcionário está demitido (usando tabela usuarios com status)
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

    // Executar função de reativação (SOFT DELETE)
    const { error: reativacaoError } = await supabaseAdmin
      .rpc('reativar_funcionario_soft_delete', {
        p_usuario_id: usuario_id,
        p_reativado_por: null, // TODO: Implementar autenticação
        p_observacoes_reativacao: observacoes_reativacao,
        p_nova_senha: nova_senha
      });

    if (reativacaoError) {
      console.error('Erro ao reativar funcionário:', reativacaoError);
      return NextResponse.json(
        { error: 'Erro interno ao processar reativação' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Funcionário reativado com sucesso',
      usuario: {
        id: funcionarioDemitido.id,
        nome: funcionarioDemitido.nome,
        matricula: funcionarioDemitido.matricula,
        email: funcionarioDemitido.email
      }
    });

  } catch (error) {
    console.error('Erro na API de reativação:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
