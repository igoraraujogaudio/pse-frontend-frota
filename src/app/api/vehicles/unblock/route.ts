import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createClientWithAuth } from '@/lib/supabase';

// ============================================================================
// API PARA DESBLOQUEAR VEÍCULO
// ============================================================================

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
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

    // Verificar se o veículo existe e está bloqueado
    const { data: veiculo, error: veiculoError } = await supabaseAdmin
      .from('veiculos')
      .select('*')
      .eq('id', veiculo_id)
      .eq('status', 'bloqueado')
      .single();

    if (veiculoError || !veiculo) {
      return NextResponse.json(
        { error: 'Veículo não encontrado ou não está bloqueado' },
        { status: 404 }
      );
    }

    // Chamar função do banco para desbloquear veículo
    console.log('🔄 Desbloqueando veículo...');
    const { data: desbloqueioResult, error: desbloqueioError } = await supabaseAdmin
      .rpc('desbloquear_veiculo', {
        p_veiculo_id: veiculo_id,
        p_novo_status: novo_status,
        p_observacoes: observacoes?.trim() || null,
        p_desbloqueado_por: funcionario.id
      });

    if (desbloqueioError) {
      console.error('❌ Erro ao desbloquear veículo:', desbloqueioError);
      return NextResponse.json(
        { error: 'Erro ao desbloquear veículo: ' + desbloqueioError.message },
        { status: 500 }
      );
    }

    console.log('✅ Veículo desbloqueado com sucesso:', {
      veiculo_id,
      novo_status,
      veiculo_placa: veiculo.placa,
      desbloqueado_por: funcionario.id
    });

    return NextResponse.json({
      success: true,
      message: `Veículo ${veiculo.placa} desbloqueado com sucesso`,
      data: {
        veiculo_id: veiculo_id,
        veiculo_placa: veiculo.placa,
        novo_status: novo_status,
        desbloqueado: desbloqueioResult,
        timestamp: new Date().toISOString(),
        observacoes: observacoes?.trim() || null,
        desbloqueado_por: funcionario.id
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




