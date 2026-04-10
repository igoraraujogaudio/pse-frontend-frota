import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { searchParams } = new URL(request.url);
    const baseIds = searchParams.get('baseIds')?.split(',').filter(Boolean) || [];

    if (baseIds.length === 0) {
      return NextResponse.json({ error: 'Base IDs são obrigatórios' }, { status: 400 });
    }

    // ============================================================================
    // 1. ITENS AGUARDANDO ESTOQUE E ABAIXO DO MÍNIMO
    // ============================================================================
    const { data: itensCompra, error: itensError } = await supabase.rpc(
      'obter_itens_para_compra',
      { p_base_ids: baseIds }
    );

    if (itensError) {
      console.error('Erro ao buscar itens para compra:', itensError);
    }

    // ============================================================================
    // 2. ITENS POR TEMPO DE ENTREGA (Lead Time)
    // ============================================================================
    const { data: itensPorTempo, error: tempoError } = await supabase.rpc(
      'obter_itens_por_tempo_entrega',
      { p_base_ids: baseIds }
    );

    if (tempoError) {
      console.error('Erro ao buscar itens por tempo de entrega:', tempoError);
    }

    // ============================================================================
    // 3. TOP 3 ITENS MAIS SOLICITADOS
    // ============================================================================
    const { data: top3Itens, error: top3Error } = await supabase.rpc(
      'obter_top_itens_solicitados',
      { p_base_ids: baseIds, p_limite: 3 }
    );

    if (top3Error) {
      console.error('Erro ao buscar top 3 itens:', top3Error);
    }

    return NextResponse.json({
      itensCompra: itensCompra || [],
      itensPorTempo: itensPorTempo || [],
      top3Itens: top3Itens || [],
    });

  } catch (error) {
    console.error('Erro na API de compras:', error);
    return NextResponse.json(
      { error: 'Erro ao processar solicitação' },
      { status: 500 }
    );
  }
}
