import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// ============================================================================
// API PARA REATIVAR VEÍCULO DEVOLVIDO/DESMOBILIZADO
// ============================================================================

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      veiculo_id,
      novo_status = 'disponivel',
      observacoes,
    } = body;

    // Validações obrigatórias
    if (!veiculo_id) {
      return NextResponse.json(
        { error: 'ID do veículo é obrigatório' },
        { status: 400 }
      );
    }

    // Status válidos
    const statusValidos = ['disponivel', 'operacao', 'manutenção'];
    if (!statusValidos.includes(novo_status)) {
      return NextResponse.json(
        { error: 'Status inválido. Use "disponivel", "operacao" ou "manutenção"' },
        { status: 400 }
      );
    }

    // Criar cliente Supabase com service role
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Verificar se o veículo existe e está devolvido/desmobilizado
    const { data: veiculo, error: veiculoError } = await supabaseAdmin
      .from('veiculos')
      .select('*')
      .eq('id', veiculo_id)
      .in('status', ['devolvido', 'desmobilizado'])
      .single();

    if (veiculoError || !veiculo) {
      return NextResponse.json(
        { error: 'Veículo não encontrado ou não está devolvido/desmobilizado' },
        { status: 404 }
      );
    }

    // Buscar registro de devolução/desmobilização
    const { data: veiculoDevolvido, error: devolvidoError } = await supabaseAdmin
      .from('veiculos_devolvidos_desmobilizados')
      .select(`
        id,
        veiculo_id,
        placa,
        tipo_operacao,
        pode_reativar
      `)
      .eq('veiculo_id', veiculo_id)
      .eq('pode_reativar', true)
      .order('data_devolucao_desmobilizacao', { ascending: false })
      .limit(1)
      .single();

    if (devolvidoError || !veiculoDevolvido) {
      return NextResponse.json(
        { error: 'Registro de devolução/desmobilização não encontrado' },
        { status: 404 }
      );
    }

    console.log('🔍 Veículo devolvido/desmobilizado encontrado:');
    console.log('  - ID:', veiculo.id);
    console.log('  - Placa:', veiculo.placa);
    console.log('  - Status atual:', veiculo.status);
    console.log('  - Tipo operação:', veiculoDevolvido.tipo_operacao);

    // Executar reativação
    const { data: resultado, error: reativacaoError } = await supabaseAdmin
      .rpc('reativar_veiculo', {
        p_veiculo_id: veiculo_id,
        p_novo_status: novo_status,
        p_observacoes: observacoes,
        p_reativado_por: null // TODO: Implementar autenticação do usuário
      });

    if (reativacaoError) {
      console.error('Erro ao reativar veículo:', reativacaoError);
      return NextResponse.json(
        { error: 'Erro ao reativar veículo: ' + reativacaoError.message },
        { status: 500 }
      );
    }

    console.log('✅ Veículo reativado com sucesso:', resultado);

    return NextResponse.json({
      success: true,
      message: `Veículo ${veiculo.placa} reativado com sucesso`,
      data: {
        veiculo_id: veiculo_id,
        novo_status: novo_status,
        reativado: resultado
      }
    });

  } catch (error) {
    console.error('Erro interno:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

