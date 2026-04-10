import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// ============================================================================
// API PARA ESTATÍSTICAS DE DEMISSÕES
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const dataInicio = searchParams.get('data_inicio');
    const dataFim = searchParams.get('data_fim');

    // Criar cliente Supabase
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Buscar estatísticas usando a função criada
    const { data, error } = await supabase.rpc('estatisticas_demissoes', {
      p_data_inicio: dataInicio || null,
      p_data_fim: dataFim || null
    });

    if (error) {
      console.error('Erro ao buscar estatísticas:', error);
      return NextResponse.json(
        { error: 'Erro ao buscar estatísticas' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      statistics: data[0] || {
        total_demissoes: 0,
        total_reativacoes: 0,
        demissoes_por_tipo: {},
        demissoes_por_mes: {},
        demissoes_por_base: {}
      }
    });

  } catch (error) {
    console.error('Erro na API de estatísticas:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
