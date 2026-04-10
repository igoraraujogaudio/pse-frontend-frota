import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';

export async function GET() {
  try {
    const supabase = createClient();
    
    // Buscar movimentações de chaves do dia atual
    const hoje = new Date();
    const inicioHoje = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
    const fimHoje = new Date(inicioHoje);
    fimHoje.setDate(fimHoje.getDate() + 1);

    console.log('📅 [API CHAVES] Filtro de data:');
    console.log('📅 [API CHAVES] Hoje:', hoje.toISOString());
    console.log('📅 [API CHAVES] Início:', inicioHoje.toISOString());
    console.log('📅 [API CHAVES] Fim:', fimHoje.toISOString());

    const { data: movimentacoes, error } = await supabase
      .from('movimentacoes_chaves')
      .select(`
        id,
        tipo,
        data_movimentacao,
        observacoes,
        colaborador:usuarios!movimentacoes_chaves_colaborador_id_fkey (
          nome,
          matricula
        ),
        chave:chaves_veiculos (
          codigo,
          veiculo:veiculos (
            placa,
            modelo,
            marca
          )
        )
      `)
      .gte('data_movimentacao', inicioHoje.toISOString())
      .lt('data_movimentacao', fimHoje.toISOString())
      .order('data_movimentacao', { ascending: false });

    if (error) {
      throw error;
    }

    console.log('📊 [API CHAVES] Movimentações encontradas:', movimentacoes?.length || 0);
    if (movimentacoes && movimentacoes.length > 0) {
      console.log('📊 [API CHAVES] Primeira movimentação:', movimentacoes[0]);
    }

    return NextResponse.json({
      success: true,
      data: movimentacoes || []
    });
  } catch (error) {
    console.error('Erro ao buscar movimentações de chaves:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}