import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createClientWithAuth } from '@/lib/supabase';

// ============================================================================
// API PARA DEVOLVER/DESMOBILIZAR VEÍCULO
// ============================================================================

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      veiculo_id,
      tipo_operacao,
      motivo,
      observacoes,
    } = body;

    // Validações obrigatórias
    if (!veiculo_id) {
      return NextResponse.json(
        { error: 'ID do veículo é obrigatório' },
        { status: 400 }
      );
    }

    if (!tipo_operacao) {
      return NextResponse.json(
        { error: 'Tipo de operação é obrigatório' },
        { status: 400 }
      );
    }

    if (!motivo || motivo.trim() === '') {
      return NextResponse.json(
        { error: 'Motivo é obrigatório' },
        { status: 400 }
      );
    }

    // Tipos de operação válidos
    const tiposValidos = ['devolvido', 'desmobilizado'];
    if (!tiposValidos.includes(tipo_operacao)) {
      return NextResponse.json(
        { error: 'Tipo de operação inválido. Use "devolvido" ou "desmobilizado"' },
        { status: 400 }
      );
    }

    // Obter token de autorização
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Token de autorização não fornecido' }, { status: 401 });
    }
    
    const token = authHeader.replace('Bearer ', '');
    const supabase = createClientWithAuth(token);
    
    // Obter usuário logado
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    // Buscar dados do funcionário
    const { data: funcionario, error: funcionarioError } = await supabase
      .from('usuarios')
      .select('id')
      .eq('auth_usuario_id', user.id)
      .single();

    if (funcionarioError || !funcionario) {
      return NextResponse.json({ error: 'Funcionário não encontrado' }, { status: 404 });
    }

    // Criar cliente Supabase com service role para operações administrativas
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Verificar se o veículo existe e não está devolvido/desmobilizado
    const { data: veiculo, error: veiculoError } = await supabaseAdmin
      .from('veiculos')
      .select('*')
      .eq('id', veiculo_id)
      .not('status', 'in', '(devolvido,desmobilizado)')
      .single();

    if (veiculoError || !veiculo) {
      return NextResponse.json(
        { error: 'Veículo não encontrado' },
        { status: 404 }
      );
    }

    // Log detalhado da operação
    const timestamp = new Date().toISOString();
    console.log('🚗 OPERAÇÃO DE VEÍCULO:', {
      timestamp,
      operacao: tipo_operacao,
      veiculo: {
        id: veiculo.id,
        placa: veiculo.placa,
        modelo: veiculo.modelo,
        status_atual: veiculo.status,
        contrato_id: veiculo.contrato_id,
        base_id: veiculo.base_id
      },
      dados_operacao: {
        motivo: motivo.trim(),
        observacoes: observacoes?.trim() || null
      }
    });

    // Criar snapshot na tabela de devolvidos/desmobilizados
    console.log('🔄 Criando snapshot do veículo...');
    const { data: snapshot, error: snapshotError } = await supabaseAdmin
      .from('veiculos_devolvidos_desmobilizados')
      .insert({
        veiculo_id: veiculo_id,
        placa: veiculo.placa,
        modelo: veiculo.modelo,
        marca_equipamento: veiculo.marca_equipamento,
        ano_fabricacao: veiculo.ano_fabricacao,
        ano_modelo: veiculo.ano_modelo,
        renavam: veiculo.renavam,
        chassis: veiculo.chassis,
        numero_crlv: veiculo.numero_crlv,
        tipo_modelo: veiculo.tipo_modelo,
        tipo_veiculo: veiculo.tipo_veiculo,
        versao: veiculo.versao,
        propriedade: veiculo.propriedade,
        condicao: veiculo.condicao,
        valor_aluguel: veiculo.valor_aluguel,
        tipo_combustivel: veiculo.tipo_combustivel,
        equipamentos: veiculo.equipamentos,
        rastreador: veiculo.rastreador,
        quilometragem_atual: veiculo.quilometragem_atual,
        ultima_manutencao: veiculo.ultima_manutencao,
        proxima_manutencao: veiculo.proxima_manutencao,
        prefixo_fixo: veiculo.prefixo_fixo,
        contrato_id: veiculo.contrato_id,
        base_id: veiculo.base_id,
        supervisor_id: veiculo.supervisor_id,
        equipe_id: veiculo.equipe_id,
        tipo_operacao: tipo_operacao,
        motivo: motivo.trim(),
        observacoes: observacoes?.trim() || null,
        processado_por: funcionario.id
      })
      .select('id')
      .single();

    console.log('📊 Resultado do snapshot:', { snapshot, snapshotError });

    if (snapshotError) {
      console.error('❌ Erro ao criar snapshot:', snapshotError);
      return NextResponse.json(
        { error: 'Erro ao criar snapshot: ' + snapshotError.message },
        { status: 500 }
      );
    }

    // Atualizar status do veículo na tabela principal
    console.log('🔄 Atualizando status do veículo...');
    console.log('📝 Dados do UPDATE:', {
      veiculo_id,
      novo_status: tipo_operacao,
      timestamp: new Date().toISOString()
    });
    
    const { data: updateResult, error: updateError } = await supabaseAdmin
      .from('veiculos')
      .update({
        status: tipo_operacao,
        atualizado_em: new Date().toISOString()
      })
      .eq('id', veiculo_id)
      .select('id, status, atualizado_em');

    console.log('📊 Resultado do UPDATE:', { updateResult, updateError });
    
    // Verificar se o status foi realmente alterado
    if (updateResult && updateResult.length > 0) {
      const veiculoAtualizado = updateResult[0];
      console.log('🔍 Verificação do status:', {
        status_esperado: tipo_operacao,
        status_atual: veiculoAtualizado.status,
        status_alterado: veiculoAtualizado.status === tipo_operacao
      });
    }

    if (updateError) {
      console.error('❌ Erro ao atualizar status do veículo:', updateError);
      return NextResponse.json(
        { error: 'Erro ao atualizar status: ' + updateError.message },
        { status: 500 }
      );
    }

    if (!updateResult || updateResult.length === 0) {
      console.error('❌ Nenhum veículo foi atualizado');
      return NextResponse.json(
        { error: 'Nenhum veículo foi atualizado' },
        { status: 500 }
      );
    }

    // Verificação adicional: buscar o veículo novamente para confirmar a alteração
    console.log('🔍 Verificação adicional: buscando veículo após UPDATE...');
    const { data: veiculoVerificacao, error: verificacaoError } = await supabaseAdmin
      .from('veiculos')
      .select('id, status, atualizado_em')
      .eq('id', veiculo_id)
      .single();

    console.log('📊 Verificação adicional:', { veiculoVerificacao, verificacaoError });
    
    if (veiculoVerificacao && veiculoVerificacao.status !== tipo_operacao) {
      console.error('❌ PROBLEMA: Status não foi alterado!', {
        status_esperado: tipo_operacao,
        status_atual: veiculoVerificacao.status,
        veiculo_id
      });
      return NextResponse.json(
        { error: `Status não foi alterado. Esperado: ${tipo_operacao}, Atual: ${veiculoVerificacao.status}` },
        { status: 500 }
      );
    }

    console.log('✅ Veículo devolvido/desmobilizado com sucesso:', {
      snapshot_id: snapshot.id,
      veiculo_atualizado: updateResult[0],
      timestamp: new Date().toISOString(),
      operacao: tipo_operacao,
      veiculo_placa: veiculo.placa,
      processado_por: funcionario.id
    });

    return NextResponse.json({
      success: true,
      message: `Veículo ${veiculo.placa} ${tipo_operacao === 'devolvido' ? 'devolvido' : 'desmobilizado'} com sucesso`,
      data: {
        veiculo_id: veiculo_id,
        veiculo_placa: veiculo.placa,
        tipo_operacao: tipo_operacao,
        snapshot_id: snapshot.id,
        veiculo_atualizado: updateResult[0],
        timestamp: new Date().toISOString(),
        motivo: motivo.trim(),
        observacoes: observacoes?.trim() || null,
        processado_por: funcionario.id
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

