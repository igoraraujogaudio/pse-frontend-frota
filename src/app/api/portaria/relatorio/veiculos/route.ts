import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient();
    const { searchParams } = new URL(request.url);
    const contratoIds = searchParams.get('contratoIds')?.split(',').filter(Boolean);
    
    // Buscar movimentações de veículos do dia atual
    const hoje = new Date();
    const inicioHoje = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
    const fimHoje = new Date(inicioHoje);
    fimHoje.setDate(fimHoje.getDate() + 1);

    console.log('📅 [API VEÍCULOS] Filtro de data:');
    console.log('📅 [API VEÍCULOS] Hoje:', hoje.toISOString());
    console.log('📅 [API VEÍCULOS] Início:', inicioHoje.toISOString());
    console.log('📅 [API VEÍCULOS] Fim:', fimHoje.toISOString());

    let query = supabase
      .from('movimentacoes_veiculos')
      .select(`
        id,
        tipo,
        data_movimentacao,
        quilometragem,
        observacoes,
        tipo_veiculo,
        veiculo_id,
        carro_particular_id,
        colaborador_id,
        veiculo:veiculos!inner (
          placa,
          modelo,
          marca_equipamento,
          contrato_id,
          status
        ),
        colaborador:usuarios!movimentacoes_veiculos_colaborador_id_fkey (
          nome,
          matricula
        )
      `)
      .gte('data_movimentacao', inicioHoje.toISOString())
      .lt('data_movimentacao', fimHoje.toISOString())
      .order('data_movimentacao', { ascending: false });

    // Primeiro buscar apenas veículos ativos dos contratos do usuário
    let veiculosAtivos = supabase
      .from('veiculos')
      .select('id')
      .not('status', 'in', '(devolvido,desmobilizado)');
    
    // Aplicar filtro de contratos se fornecido
    if (contratoIds && contratoIds.length > 0) {
      veiculosAtivos = veiculosAtivos.in('contrato_id', contratoIds);
    } else if (contratoIds && contratoIds.length === 0) {
      // Se usuário não tem contratos, não mostrar nenhum veículo
      veiculosAtivos = veiculosAtivos.eq('contrato_id', 'never-match-this-id');
    }

    const { data: veiculosIds, error: veiculosError } = await veiculosAtivos;
    
    if (veiculosError) {
      throw veiculosError;
    }

    // Filtrar movimentações apenas dos veículos ativos
    if (veiculosIds && veiculosIds.length > 0) {
      const idsAtivos = veiculosIds.map(v => v.id);
      query = query.in('veiculo_id', idsAtivos);
    } else {
      // Se não há veículos ativos, não mostrar nenhuma movimentação
      query = query.eq('veiculo_id', 'never-match-this-id');
    }

    const { data: movimentacoes, error } = await query;

    if (error) {
      throw error;
    }

    console.log('📊 [API VEÍCULOS] Movimentações encontradas:', movimentacoes?.length || 0);
    if (movimentacoes && movimentacoes.length > 0) {
      console.log('📊 [API VEÍCULOS] Primeira movimentação:', movimentacoes[0]);
    }

    return NextResponse.json({
      success: true,
      data: movimentacoes || []
    });
  } catch (error) {
    console.error('Erro ao buscar movimentações de veículos:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}