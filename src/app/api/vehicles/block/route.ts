import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createClientWithAuth } from '@/lib/supabase';

// ============================================================================
// API PARA BLOQUEAR VEÍCULO
// ============================================================================

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      veiculo_id,
      motivo,
      observacoes,
      bloqueio_origem_contrato_id, // ID do contrato que originou o bloqueio
    } = body;

    // Validações obrigatórias
    if (!veiculo_id) {
      return NextResponse.json(
        { error: 'ID do veículo é obrigatório' },
        { status: 400 }
      );
    }

    if (!motivo || motivo.trim() === '') {
      return NextResponse.json(
        { error: 'Motivo é obrigatório' },
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

    // Verificar se o veículo existe e não está bloqueado
    const { data: veiculo, error: veiculoError } = await supabaseAdmin
      .from('veiculos')
      .select('*')
      .eq('id', veiculo_id)
      .neq('status', 'bloqueado')
      .single();

    if (veiculoError || !veiculo) {
      return NextResponse.json(
        { error: 'Veículo não encontrado ou já está bloqueado' },
        { status: 404 }
      );
    }

    // Log detalhado da operação
    const timestamp = new Date().toISOString();
    console.log('🚗 BLOQUEIO DE VEÍCULO:', {
      timestamp,
      veiculo: {
        id: veiculo.id,
        placa: veiculo.placa,
        modelo: veiculo.modelo,
        status_atual: veiculo.status,
        contrato_id: veiculo.contrato_id,
        base_id: veiculo.base_id
      },
      dados_bloqueio: {
        motivo: motivo.trim(),
        observacoes: observacoes?.trim() || null,
        bloqueio_origem_contrato_id: bloqueio_origem_contrato_id || null
      }
    });

    // Chamar função do banco para bloquear veículo
    console.log('🔄 Bloqueando veículo...');
    console.log('📋 Parâmetros da função:', {
      p_veiculo_id: veiculo_id,
      p_motivo: motivo.trim(),
      p_observacoes: observacoes?.trim() || null,
      p_bloqueio_origem_contrato_id: bloqueio_origem_contrato_id || null,
      p_processado_por: funcionario.id
    });
    
    const { data: bloqueioResult, error: bloqueioError } = await supabaseAdmin
      .rpc('bloquear_veiculo', {
        p_veiculo_id: veiculo_id,
        p_motivo: motivo.trim(),
        p_observacoes: observacoes?.trim() || null,
        p_bloqueio_origem_contrato_id: bloqueio_origem_contrato_id || null,
        p_processado_por: funcionario.id
      });

    console.log('📊 Resultado do bloqueio:', { 
      bloqueioResult, 
      bloqueioError,
      errorCode: bloqueioError?.code,
      errorMessage: bloqueioError?.message,
      errorDetails: bloqueioError?.details,
      errorHint: bloqueioError?.hint
    });

    if (bloqueioError) {
      console.error('❌ Erro ao bloquear veículo:', {
        error: bloqueioError,
        code: bloqueioError.code,
        message: bloqueioError.message,
        details: bloqueioError.details,
        hint: bloqueioError.hint
      });
      return NextResponse.json(
        { 
          error: 'Erro ao bloquear veículo: ' + bloqueioError.message,
          details: bloqueioError.details,
          hint: bloqueioError.hint
        },
        { status: 500 }
      );
    }

    // Verificação adicional: buscar o veículo novamente para confirmar a alteração
    console.log('🔍 Verificação adicional: buscando veículo após bloqueio...');
    const { data: veiculoVerificacao, error: verificacaoError } = await supabaseAdmin
      .from('veiculos')
      .select('id, status, atualizado_em')
      .eq('id', veiculo_id)
      .single();

    console.log('📊 Verificação adicional:', { veiculoVerificacao, verificacaoError });
    
    if (veiculoVerificacao && veiculoVerificacao.status !== 'bloqueado') {
      console.error('❌ PROBLEMA: Status não foi alterado pela função!', {
        status_esperado: 'bloqueado',
        status_atual: veiculoVerificacao.status,
        veiculo_id,
        bloqueio_id: bloqueioResult
      });
      
      // Tentar atualizar diretamente como fallback
      console.log('🔄 Tentando atualizar status diretamente como fallback...');
      const { error: updateDirectError, data: updateDirectData } = await supabaseAdmin
        .from('veiculos')
        .update({ 
          status: 'bloqueado',
          atualizado_em: new Date().toISOString()
        })
        .eq('id', veiculo_id)
        .select('id, status, atualizado_em')
        .single();
      
      if (updateDirectError) {
        console.error('❌ Erro ao atualizar status diretamente:', updateDirectError);
        return NextResponse.json(
          { 
            error: `Status não foi alterado. Esperado: bloqueado, Atual: ${veiculoVerificacao.status}`,
            details: 'A função bloquear_veiculo não atualizou o status e a atualização direta também falhou',
            directUpdateError: updateDirectError.message
          },
          { status: 500 }
        );
      }
      
      console.log('✅ Status atualizado diretamente com sucesso:', updateDirectData);
      // Continuar com o fluxo normal, usando os dados da atualização direta
      veiculoVerificacao.status = updateDirectData.status;
      veiculoVerificacao.atualizado_em = updateDirectData.atualizado_em;
    }

    console.log('✅ Veículo bloqueado com sucesso:', {
      bloqueio_id: bloqueioResult,
      veiculo_atualizado: veiculoVerificacao,
      timestamp: new Date().toISOString(),
      veiculo_placa: veiculo.placa,
      processado_por: funcionario.id
    });

    return NextResponse.json({
      success: true,
      message: `Veículo ${veiculo.placa} bloqueado com sucesso`,
      data: {
        veiculo_id: veiculo_id,
        veiculo_placa: veiculo.placa,
        bloqueio_id: bloqueioResult,
        veiculo_atualizado: veiculoVerificacao,
        timestamp: new Date().toISOString(),
        motivo: motivo.trim(),
        observacoes: observacoes?.trim() || null,
        bloqueio_origem_contrato_id: bloqueio_origem_contrato_id || null,
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

