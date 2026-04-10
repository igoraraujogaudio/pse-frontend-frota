import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// ============================================================================
// API PARA HISTÓRICO COMPLETO DE VEÍCULOS BLOQUEADOS (ATIVOS E DESBLOQUEADOS)
// ============================================================================

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const search = searchParams.get('search') || '';
    const contrato_id = searchParams.get('contrato_id') || '';
    const data_inicio = searchParams.get('data_inicio') || '';
    const data_fim = searchParams.get('data_fim') || '';
    const status_bloqueio = searchParams.get('status_bloqueio') || ''; // 'bloqueado' ou 'desbloqueado' ou vazio para todos

    // Criar cliente Supabase
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Construir query base usando a view de histórico
    let query = supabase
      .from('v_veiculos_bloqueados_historico')
      .select('*')
      .order('data_bloqueio', { ascending: false })
      .order('created_at', { ascending: false });

    // Aplicar filtros
    if (search) {
      query = query.or(`placa.ilike.%${search}%,modelo.ilike.%${search}%,marca_equipamento.ilike.%${search}%`);
    }

    if (contrato_id) {
      query = query.eq('contrato_atual_nome', contrato_id);
    }

    if (data_inicio) {
      query = query.gte('data_bloqueio', data_inicio);
    }

    if (data_fim) {
      query = query.lte('data_bloqueio', data_fim);
    }

    if (status_bloqueio) {
      query = query.eq('status_bloqueio', status_bloqueio);
    }

    // Contar total de registros
    const countQuery = supabase
      .from('v_veiculos_bloqueados_historico')
      .select('*', { count: 'exact', head: true });
    
    // Aplicar os mesmos filtros para o count
    if (search) {
      countQuery.or(`placa.ilike.%${search}%,modelo.ilike.%${search}%,marca_equipamento.ilike.%${search}%`);
    }
    if (contrato_id) {
      countQuery.eq('contrato_atual_nome', contrato_id);
    }
    if (data_inicio) {
      countQuery.gte('data_bloqueio', data_inicio);
    }
    if (data_fim) {
      countQuery.lte('data_bloqueio', data_fim);
    }
    if (status_bloqueio) {
      countQuery.eq('status_bloqueio', status_bloqueio);
    }
    
    const { count, error: countError } = await countQuery;
    
    if (countError) {
      console.error('Erro ao contar histórico:', countError);
      return NextResponse.json(
        { error: 'Erro ao contar registros' },
        { status: 500 }
      );
    }

    // Aplicar paginação
    const offset = (page - 1) * limit;
    query = query.range(offset, offset + limit - 1);

    // Executar query
    const { data: historico, error } = await query;

    if (error) {
      console.error('Erro ao buscar histórico:', error);
      return NextResponse.json(
        { error: 'Erro ao buscar histórico de bloqueios' },
        { status: 500 }
      );
    }

    // Calcular informações de paginação
    const totalPages = Math.ceil((count || 0) / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    return NextResponse.json({
      success: true,
      data: historico,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages,
        hasNextPage,
        hasPrevPage
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




