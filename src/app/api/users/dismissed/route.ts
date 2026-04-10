import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// ============================================================================
// API PARA LISTAR FUNCIONÁRIOS DEMITIDOS
// ============================================================================

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const search = searchParams.get('search') || '';
    const tipo_demissao = searchParams.get('tipo_demissao') || '';
    const base_id = searchParams.get('base_id') || '';
    const contrato_id = searchParams.get('contrato_id') || '';
    const data_inicio = searchParams.get('data_inicio') || '';
    const data_fim = searchParams.get('data_fim') || '';
    const apenas_reativaveis = searchParams.get('apenas_reativaveis') === 'true';

    // Criar cliente Supabase
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Construir query base usando a view
    let query = supabase
      .from('funcionarios_demitidos_view')
      .select('*')
      .order('data_demissao', { ascending: false });

    // Aplicar filtros
    if (search) {
      query = query.or(`nome.ilike.%${search}%,matricula.ilike.%${search}%,email.ilike.%${search}%`);
    }

    if (tipo_demissao) {
      query = query.eq('tipo_demissao', tipo_demissao);
    }

    if (base_id) {
      query = query.eq('base_id', base_id);
    }

    if (contrato_id) {
      query = query.eq('contrato_id', contrato_id);
    }

    if (data_inicio) {
      query = query.gte('data_demissao', data_inicio);
    }

    if (data_fim) {
      query = query.lte('data_demissao', data_fim);
    }

    // Remover filtro apenas_reativaveis pois não existe mais na nova estrutura
    // Todos os funcionários demitidos podem ser reativados

    // Contar total de registros usando a view
    const countQuery = supabase
      .from('funcionarios_demitidos_view')
      .select('*', { count: 'exact', head: true });
    
    // Aplicar os mesmos filtros para o count
    if (search) {
      countQuery.or(`nome.ilike.%${search}%,matricula.ilike.%${search}%,cpf.ilike.%${search}%`);
    }
    if (tipo_demissao) {
      countQuery.eq('tipo_demissao', tipo_demissao);
    }
    if (base_id) {
      countQuery.eq('base_id', base_id);
    }
    if (contrato_id) {
      countQuery.eq('contrato_id', contrato_id);
    }
    if (data_inicio) {
      countQuery.gte('data_demissao', data_inicio);
    }
    if (data_fim) {
      countQuery.lte('data_demissao', data_fim);
    }
    // Remover filtro apenas_reativaveis do count também
    
    const { count, error: countError } = await countQuery;
    
    if (countError) {
      console.error('Erro ao contar funcionários demitidos:', countError);
      return NextResponse.json(
        { error: 'Erro ao contar registros' },
        { status: 500 }
      );
    }

    // Aplicar paginação
    const offset = (page - 1) * limit;
    query = query.range(offset, offset + limit - 1);

    // Executar query
    const { data: funcionariosDemitidos, error } = await query;

    if (error) {
      console.error('Erro ao buscar funcionários demitidos:', error);
      return NextResponse.json(
        { error: 'Erro ao buscar funcionários demitidos' },
        { status: 500 }
      );
    }

    // Calcular informações de paginação
    const totalPages = Math.ceil((count || 0) / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    return NextResponse.json({
      success: true,
      data: funcionariosDemitidos || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages,
        hasNextPage,
        hasPrevPage
      },
      filters: {
        search,
        tipo_demissao,
        base_id,
        contrato_id,
        data_inicio,
        data_fim,
        apenas_reativaveis
      }
    });

  } catch (error) {
    console.error('Erro na API de listagem:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// ============================================================================
// API PARA OBTER ESTATÍSTICAS DE FUNCIONÁRIOS DEMITIDOS
// ============================================================================

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    if (action !== 'stats') {
      return NextResponse.json(
        { error: 'Ação não reconhecida' },
        { status: 400 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Buscar estatísticas usando a função criada
    const { data: stats, error: statsError } = await supabase
      .rpc('estatisticas_demissoes');

    if (statsError) {
      console.error('Erro ao buscar estatísticas:', statsError);
      return NextResponse.json(
        { error: 'Erro ao buscar estatísticas' },
        { status: 500 }
      );
    }

    // Usar estatísticas da função
    const estatisticas = stats?.[0] || {
      total_demissoes: 0,
      total_reativacoes: 0,
      demissoes_por_tipo: {},
      demissoes_por_mes: {},
      demissoes_por_base: {}
    };

    return NextResponse.json({
      success: true,
      estatisticas
    });

  } catch (error) {
    console.error('Erro na API de estatísticas:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
