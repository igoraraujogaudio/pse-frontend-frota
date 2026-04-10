import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// ============================================================================
// API PARA LISTAR VEÍCULOS DEVOLVIDOS/DESMOBILIZADOS
// ============================================================================

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const search = searchParams.get('search') || '';
    const tipo_operacao = searchParams.get('tipo_operacao') || '';
    const base_id = searchParams.get('base_id') || '';
    const contrato_nome = searchParams.get('contrato_id') || ''; // Recebe nome do contrato, não ID
    const data_inicio = searchParams.get('data_inicio') || '';
    const data_fim = searchParams.get('data_fim') || '';
    const apenas_reativaveis = searchParams.get('apenas_reativaveis') === 'true';

    // Debug: Log dos parâmetros recebidos
    console.log('🔍 API Debug - Parâmetros recebidos:', {
      page, limit, search, tipo_operacao, base_id, contrato_nome, data_inicio, data_fim, apenas_reativaveis
    });

    // Criar cliente Supabase
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Construir query base usando a view
    let query = supabase
      .from('v_veiculos_devolvidos_desmobilizados_relatorio')
      .select('*')
      .order('data_devolucao_desmobilizacao', { ascending: false });

    // Debug: Log da query inicial
    console.log('🔍 API Debug - Query inicial construída para view v_veiculos_devolvidos_desmobilizados_relatorio');

    // Aplicar filtros
    if (search) {
      query = query.or(`placa.ilike.%${search}%,modelo.ilike.%${search}%,marca_equipamento.ilike.%${search}%`);
    }

    if (tipo_operacao) {
      query = query.eq('tipo_operacao', tipo_operacao);
    }

    if (base_id) {
      query = query.eq('base_id', base_id);
    }

    if (contrato_nome) {
      console.log('🔍 Aplicando filtro de contrato:', contrato_nome);
      query = query.eq('contrato_nome', contrato_nome);
    }

    if (data_inicio) {
      query = query.gte('data_devolucao_desmobilizacao', data_inicio);
    }

    if (data_fim) {
      query = query.lte('data_devolucao_desmobilizacao', data_fim);
    }

    if (apenas_reativaveis) {
      query = query.eq('pode_reativar', true);
    }

    // Contar total de registros usando a view
    const countQuery = supabase
      .from('v_veiculos_devolvidos_desmobilizados_relatorio')
      .select('*', { count: 'exact', head: true });
    
    // Aplicar os mesmos filtros para o count
    if (search) {
      countQuery.or(`placa.ilike.%${search}%,modelo.ilike.%${search}%,marca_equipamento.ilike.%${search}%`);
    }
    if (tipo_operacao) {
      countQuery.eq('tipo_operacao', tipo_operacao);
    }
    if (base_id) {
      countQuery.eq('base_id', base_id);
    }
    if (contrato_nome) {
      console.log('🔍 Aplicando filtro de contrato no count:', contrato_nome);
      countQuery.eq('contrato_nome', contrato_nome);
    }
    if (data_inicio) {
      countQuery.gte('data_devolucao_desmobilizacao', data_inicio);
    }
    if (data_fim) {
      countQuery.lte('data_devolucao_desmobilizacao', data_fim);
    }
    if (apenas_reativaveis) {
      countQuery.eq('pode_reativar', true);
    }
    
    const { count, error: countError } = await countQuery;
    
    if (countError) {
      console.error('Erro ao contar veículos devolvidos/desmobilizados:', countError);
      return NextResponse.json(
        { error: 'Erro ao contar registros' },
        { status: 500 }
      );
    }

    // Aplicar paginação
    const offset = (page - 1) * limit;
    query = query.range(offset, offset + limit - 1);

    // Executar query
    const { data: veiculosDevolvidosDesmobilizados, error } = await query;

    if (error) {
      console.error('Erro ao buscar veículos devolvidos/desmobilizados:', error);
      return NextResponse.json(
        { error: 'Erro ao buscar veículos devolvidos/desmobilizados' },
        { status: 500 }
      );
    }

    // Debug: Log dos resultados
    console.log('🔍 API Debug - Resultados encontrados:', {
      total: veiculosDevolvidosDesmobilizados?.length || 0,
      totalCount: count,
      filtros_aplicados: { search, tipo_operacao, contrato_nome, base_id },
      primeiros3: veiculosDevolvidosDesmobilizados?.slice(0, 3).map(v => ({
        placa: v.placa,
        tipo_operacao: v.tipo_operacao,
        contrato_nome: v.contrato_nome,
        contrato_id: v.contrato_id
      })),
      contratos_unicos: [...new Set(veiculosDevolvidosDesmobilizados?.map(v => v.contrato_nome).filter(Boolean))]
    });

    // Calcular informações de paginação
    const totalPages = Math.ceil((count || 0) / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    return NextResponse.json({
      success: true,
      data: veiculosDevolvidosDesmobilizados,
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


