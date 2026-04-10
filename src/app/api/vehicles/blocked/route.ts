import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// ============================================================================
// API PARA LISTAR VEÍCULOS BLOQUEADOS
// ============================================================================

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const search = searchParams.get('search') || '';
    const base_id = searchParams.get('base_id') || '';
    const contrato_nome = searchParams.get('contrato_id') || ''; // Recebe nome do contrato, não ID
    const data_inicio = searchParams.get('data_inicio') || '';
    const data_fim = searchParams.get('data_fim') || '';
    const apenas_desbloqueaveis = searchParams.get('apenas_desbloqueaveis') === 'true';

    // Debug: Log dos parâmetros recebidos
    console.log('🔍 API Debug - Parâmetros recebidos:', {
      page, limit, search, base_id, contrato_nome, data_inicio, data_fim, apenas_desbloqueaveis
    });

    // Criar cliente Supabase
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Construir query base usando a view
    let query = supabase
      .from('v_veiculos_bloqueados_relatorio')
      .select('*')
      .order('data_bloqueio', { ascending: false });

    // Debug: Log da query inicial
    console.log('🔍 API Debug - Query inicial construída para view v_veiculos_bloqueados_relatorio');

    // Aplicar filtros
    if (search) {
      query = query.or(`placa.ilike.%${search}%,modelo.ilike.%${search}%,marca_equipamento.ilike.%${search}%`);
    }

    if (base_id) {
      query = query.eq('base_id', base_id);
    }

    if (contrato_nome) {
      console.log('🔍 Aplicando filtro de contrato:', contrato_nome);
      query = query.eq('contrato_atual_nome', contrato_nome);
    }

    if (data_inicio) {
      query = query.gte('data_bloqueio', data_inicio);
    }

    if (data_fim) {
      query = query.lte('data_bloqueio', data_fim);
    }

    if (apenas_desbloqueaveis) {
      query = query.eq('pode_desbloquear', true);
    }

    // Contar total de registros usando a view
    const countQuery = supabase
      .from('v_veiculos_bloqueados_relatorio')
      .select('*', { count: 'exact', head: true });
    
    // Aplicar os mesmos filtros para o count
    if (search) {
      countQuery.or(`placa.ilike.%${search}%,modelo.ilike.%${search}%,marca_equipamento.ilike.%${search}%`);
    }
    if (base_id) {
      countQuery.eq('base_id', base_id);
    }
    if (contrato_nome) {
      console.log('🔍 Aplicando filtro de contrato no count:', contrato_nome);
      countQuery.eq('contrato_atual_nome', contrato_nome);
    }
    if (data_inicio) {
      countQuery.gte('data_bloqueio', data_inicio);
    }
    if (data_fim) {
      countQuery.lte('data_bloqueio', data_fim);
    }
    if (apenas_desbloqueaveis) {
      countQuery.eq('pode_desbloquear', true);
    }
    
    const { count, error: countError } = await countQuery;
    
    if (countError) {
      console.error('Erro ao contar veículos bloqueados:', countError);
      return NextResponse.json(
        { error: 'Erro ao contar registros' },
        { status: 500 }
      );
    }

    // Aplicar paginação
    const offset = (page - 1) * limit;
    query = query.range(offset, offset + limit - 1);

    // Executar query
    const { data: veiculosBloqueados, error } = await query;

    if (error) {
      console.error('Erro ao buscar veículos bloqueados:', error);
      return NextResponse.json(
        { error: 'Erro ao buscar veículos bloqueados' },
        { status: 500 }
      );
    }

    // Debug: Log dos resultados
    console.log('🔍 API Debug - Resultados encontrados:', {
      total: veiculosBloqueados?.length || 0,
      totalCount: count,
      filtros_aplicados: { search, contrato_nome, base_id },
      primeiros3: veiculosBloqueados?.slice(0, 3).map(v => ({
        placa: v.placa,
        contrato_atual_nome: v.contrato_atual_nome,
        bloqueio_origem_contrato_nome: v.bloqueio_origem_contrato_nome
      }))
    });

    // Calcular informações de paginação
    const totalPages = Math.ceil((count || 0) / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    return NextResponse.json({
      success: true,
      data: veiculosBloqueados,
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




