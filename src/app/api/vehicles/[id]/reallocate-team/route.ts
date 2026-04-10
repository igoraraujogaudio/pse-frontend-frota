import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createClientWithAuth } from '@/lib/supabase';

// ============================================================================
// API PARA REALOCAR EQUIPE DO VEÍCULO
// ============================================================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const vehicleId = resolvedParams.id;
    const { targetTeamId } = await request.json();

    // Validações obrigatórias
    if (!vehicleId) {
      return NextResponse.json(
        { error: 'ID do veículo é obrigatório' },
        { status: 400 }
      );
    }

    // targetTeamId pode ser null (para remover da equipe) ou string (para alocar a nova equipe)

    // Obter token de autorização
    const authHeader = request.headers.get('authorization');
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
      .select('id, nome')
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

    // Buscar dados atuais do veículo
    const { data: veiculo, error: veiculoError } = await supabaseAdmin
      .from('veiculos')
      .select(`
        *,
        equipe:equipes(id, nome, prefixo_fixo),
        contrato:contratos(id, nome)
      `)
      .eq('id', vehicleId)
      .single();

    if (veiculoError || !veiculo) {
      return NextResponse.json(
        { error: 'Veículo não encontrado' },
        { status: 404 }
      );
    }

    const timestamp = new Date().toISOString();
    console.log('🚗 REALOCAÇÃO DE EQUIPE DO VEÍCULO:', {
      timestamp,
      veiculo: {
        id: veiculo.id,
        placa: veiculo.placa,
        modelo: veiculo.modelo,
        equipe_atual: veiculo.equipe_id ? {
          id: veiculo.equipe?.id,
          nome: veiculo.equipe?.nome || veiculo.equipe?.prefixo_fixo
        } : null
      },
      operacao: {
        target_team_id: targetTeamId,
        acao: targetTeamId ? 'realocar' : 'remover'
      },
      usuario: {
        id: funcionario.id,
        nome: funcionario.nome
      }
    });

    // Se targetTeamId for fornecido, validar se a equipe existe
    let targetTeam = null;
    if (targetTeamId) {
      const { data: team, error: teamError } = await supabaseAdmin
        .from('equipes')
        .select('id, nome, prefixo_fixo')
        .eq('id', targetTeamId)
        .single();

      if (teamError || !team) {
        return NextResponse.json(
          { error: 'Equipe de destino não encontrada' },
          { status: 404 }
        );
      }

      targetTeam = team;

      // Verificar se a equipe de destino já tem um veículo alocado
      const { data: existingVehicle, error: existingVehicleError } = await supabaseAdmin
        .from('veiculos')
        .select('id, placa')
        .eq('equipe_id', targetTeamId)
        .neq('id', vehicleId); // Excluir o próprio veículo se estiver sendo realocado

      if (existingVehicleError) {
        console.error('❌ Erro ao verificar veículo existente:', existingVehicleError);
        return NextResponse.json(
          { error: 'Erro ao verificar equipe de destino' },
          { status: 500 }
        );
      }

      if (existingVehicle && existingVehicle.length > 0) {
        return NextResponse.json(
          { 
            error: `A equipe ${team.nome || team.prefixo_fixo} já possui o veículo ${existingVehicle[0].placa} alocado. Cada equipe só pode ter 1 veículo.` 
          },
          { status: 400 }
        );
      }
    }

    // Executar a realocação
    console.log('🔄 Executando realocação...');
    
    // Determinar o novo status baseado na ação
    const newStatus = targetTeamId ? 'operacao' : 'disponivel';
    
    const { data: updatedVehicle, error: updateError } = await supabaseAdmin
      .from('veiculos')
      .update({ 
        equipe_id: targetTeamId,
        status: newStatus,
        atualizado_em: timestamp
      })
      .eq('id', vehicleId)
      .select(`
        *,
        equipe:equipes(id, nome, prefixo_fixo)
      `)
      .single();

    if (updateError) {
      console.error('❌ Erro ao atualizar veículo:', updateError);
      return NextResponse.json(
        { error: 'Erro ao realocar equipe do veículo: ' + updateError.message },
        { status: 500 }
      );
    }

    // Log da operação
    console.log('✅ Realocação realizada com sucesso:', {
      veiculo_atualizado: updatedVehicle,
      equipe_anterior: veiculo.equipe_id ? {
        id: veiculo.equipe?.id,
        nome: veiculo.equipe?.nome || veiculo.equipe?.prefixo_fixo
      } : null,
      equipe_nova: targetTeam ? {
        id: targetTeam.id,
        nome: targetTeam.nome || targetTeam.prefixo_fixo
      } : null
    });

    // Determinar mensagem de sucesso
    let successMessage = '';
    if (targetTeamId) {
      if (veiculo.equipe_id) {
        successMessage = `Veículo ${veiculo.placa} transferido da equipe ${veiculo.equipe?.nome} para a equipe ${targetTeam?.nome}`;
      } else {
        successMessage = `Veículo ${veiculo.placa} alocado à equipe ${targetTeam?.nome}`;
      }
    } else {
      if (veiculo.equipe_id) {
        successMessage = `Veículo ${veiculo.placa} removido da equipe ${veiculo.equipe?.nome}`;
      } else {
        successMessage = `Veículo ${veiculo.placa} já estava sem equipe alocada`;
      }
    }

    return NextResponse.json({
      success: true,
      message: successMessage,
      data: {
        vehicle: updatedVehicle,
        previous_team: veiculo.equipe_id ? {
          id: veiculo.equipe?.id,
          nome: veiculo.equipe?.nome || veiculo.equipe?.prefixo_fixo
        } : null,
        new_team: targetTeam ? {
          id: targetTeam.id,
          nome: targetTeam.nome || targetTeam.prefixo_fixo
        } : null
      }
    });

  } catch (error) {
    console.error('💥 Erro interno na realocação de equipe:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
