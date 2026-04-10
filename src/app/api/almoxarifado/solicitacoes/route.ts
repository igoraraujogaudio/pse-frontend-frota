import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const userId = searchParams.get('userId');
    if (!userId) {
      return NextResponse.json({ error: 'ID do usuário não fornecido' }, { status: 401 });
    }

    const supabase = createClient();

    // ── ROUND 1: dados do usuário + contratos + bases diretas (paralelo) ──
    const { data: userData, error: userError } = await supabase
      .from('usuarios')
      .select('id, nivel_acesso')
      .eq('auth_usuario_id', userId)
      .single();

    if (userError || !userData) {
      return NextResponse.json({ error: 'Dados do usuário não encontrados' }, { status: 404 });
    }

    const [{ data: userContracts }, { data: userBasesData }] = await Promise.all([
      supabase.from('usuario_contratos').select('contrato_id').eq('usuario_id', userData.id).eq('ativo', true),
      supabase.from('usuario_bases').select('base_id').eq('usuario_id', userData.id).eq('ativo', true),
    ]);

    const userContractIds = userContracts?.map(uc => uc.contrato_id) || [];
    const noId = ['00000000-0000-0000-0000-000000000000'];

    const { data: basesData } = await supabase
      .from('bases')
      .select('id, nome, codigo, contrato_id')
      .in('contrato_id', userContractIds.length > 0 ? userContractIds : noId)
      .eq('ativa', true)
      .order('nome');

    const allUserBaseIds = [...new Set([
      ...(basesData?.map(b => b.id) || []),
      ...(userBasesData?.map(ub => ub.base_id) || []),
    ])];

    if (allUserBaseIds.length === 0) {
      return NextResponse.json({
        success: true, data: [],
        stats: { total: 0, pendente: 0, aprovada: 0, rejeitada: 0, aguardando_estoque: 0, entregue: 0, devolvida: 0 },
        pagination: { page: 1, pageSize: 50, total: 0 }, bases: [], contratos: []
      });
    }

    // ── Parâmetros de filtro ──
    const status = searchParams.get('status') || 'todas';
    const search = searchParams.get('search') || '';
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '50');
    const baseId = searchParams.get('baseId');
    const contratoId = searchParams.get('contratoId');
    const dataInicio = searchParams.get('dataInicio');
    const dataFim = searchParams.get('dataFim');

    let inicio: string | null = null;
    let fim: string | null = null;
    if (dataInicio && dataFim) {
      inicio = new Date(dataInicio).toISOString();
      fim = new Date(dataFim).toISOString();
    }

    // Resolver bases filtradas
    let filteredBaseIds = allUserBaseIds;
    if (baseId && baseId !== 'todas') {
      filteredBaseIds = [baseId];
    } else if (contratoId && contratoId !== 'todos') {
      const basesDoContrato = basesData?.filter(b => b.contrato_id === contratoId).map(b => b.id) || [];
      if (basesDoContrato.length > 0) filteredBaseIds = basesDoContrato;
    }

    // Helper para aplicar filtros comuns
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const applyFilters = <T extends Record<string, any>>(q: T): T => {
      q = status !== 'todas' ? q.eq('status', status) : q.not('status', 'eq', 'cancelada');
      q = q.in('base_id', filteredBaseIds);
      if (inicio && fim) q = q.gte('criado_em', inicio).lte('criado_em', fim);
      return q;
    };

    // ── ROUND 2: stats + count + data (paralelo) ──
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const selectFields = `
      *,
      item:itens_estoque!item_id(id, codigo, nome, categoria, unidade_medida, estoque_atual, estoque_minimo, requer_laudo),
      solicitante:usuarios!solicitante_id(id, nome, matricula),
      destinatario:usuarios!destinatario_id(id, nome, matricula),
      destinatario_equipe:equipes!destinatario_equipe_id(id, nome, operacao),
      responsavel_equipe:usuarios!responsavel_equipe_id(id, nome, matricula),
      aprovador_almoxarifado:usuarios!aprovado_almoxarifado_por(id, nome),
      entregador:usuarios!entregue_por(id, nome),
      supervisor_entrega:usuarios!entregue_a_supervisor_id(id, nome, matricula),
      base_destino:bases!base_id(id, nome, codigo)
    `;

    // Stats query: bases do usuário, sem filtro de status/data (mostra totais globais)
    let statsQ = supabase.from('solicitacoes_itens').select('status', { count: 'exact', head: false })
      .not('status', 'eq', 'cancelada').in('base_id', filteredBaseIds);
    if (inicio && fim) statsQ = statsQ.gte('criado_em', inicio).lte('criado_em', fim);

    // Quando há busca textual, precisamos buscar TODOS os registros para filtrar corretamente,
    // pois a busca é feita em campos de joins (nome do item, solicitante, etc.)
    // que não podem ser filtrados via query do Supabase diretamente.
    const hasSearch = !!search;

    // Se tem busca: buscar tudo (sem range) para filtrar depois e paginar manualmente
    // Se não tem busca: usar paginação normal do Supabase
    const dataQuery = applyFilters(supabase.from('solicitacoes_itens').select(selectFields))
      .order('criado_em', { ascending: false });
    if (!hasSearch) {
      dataQuery.range(from, to);
    }

    const [
      { data: statsData },
      { count: totalCount },
      { data: solicitacoes, error: dataError },
      { data: contratosData },
    ] = await Promise.all([
      statsQ,
      // Quando tem busca, o count real será calculado após o filtro textual
      hasSearch
        ? Promise.resolve({ count: 0 })
        : applyFilters(supabase.from('solicitacoes_itens').select('id', { count: 'exact', head: true })),
      dataQuery,
      supabase.from('contratos').select('id, nome, codigo')
        .in('id', userContractIds.length > 0 ? userContractIds : noId).eq('ativo', true).order('nome'),
    ]);

    if (dataError) {
      console.error('❌ Erro ao buscar solicitações:', dataError);
      return NextResponse.json({ error: 'Erro ao buscar solicitações' }, { status: 500 });
    }

    const stats = {
      total: statsData?.length || 0,
      pendente: statsData?.filter(s => s.status === 'pendente').length || 0,
      aprovada: statsData?.filter(s => s.status === 'aprovada').length || 0,
      rejeitada: statsData?.filter(s => s.status === 'rejeitada').length || 0,
      aguardando_estoque: statsData?.filter(s => s.status === 'aguardando_estoque').length || 0,
      entregue: statsData?.filter(s => s.status === 'entregue').length || 0,
      devolvida: statsData?.filter(s => s.status === 'devolvida').length || 0,
    };

    // ── ROUND 3: batch load grupos + módulos (em vez de N+1) ──
    const sols = (solicitacoes || []) as Array<{ grupo_entrega_id?: string; modulo_predefinido_id?: string; [key: string]: unknown }>;
    const grupoIds = [...new Set(sols.filter(s => s.grupo_entrega_id).map(s => s.grupo_entrega_id))];
    const moduloIds = [...new Set(sols.filter(s => s.modulo_predefinido_id).map(s => s.modulo_predefinido_id))];

    const [gruposResult, modulosResult] = await Promise.all([
      grupoIds.length > 0
        ? supabase.from('grupos_entrega_novo_funcionario').select(`
            *, funcionario:usuarios!funcionario_id(id, nome, matricula),
            cargo:cargos(id, nome),
            modulo_predefinido:modulos_predefinidos_cargo(id, nome_modulo, descricao, ativo)
          `).in('id', grupoIds)
        : Promise.resolve({ data: [] }),
      moduloIds.length > 0
        ? supabase.from('modulos_predefinidos_cargo').select('id, nome_modulo, descricao, ativo').in('id', moduloIds)
        : Promise.resolve({ data: [] }),
    ]);

    const gruposMap = new Map((gruposResult.data || []).map(g => [g.id, g]));
    const modulosMap = new Map((modulosResult.data || []).map(m => [m.id, m]));

    for (const sol of sols) {
      if (sol.grupo_entrega_id && gruposMap.has(sol.grupo_entrega_id)) {
        sol.grupo_entrega = gruposMap.get(sol.grupo_entrega_id);
      }
      if (sol.modulo_predefinido_id && modulosMap.has(sol.modulo_predefinido_id)) {
        sol.modulo_predefinido = modulosMap.get(sol.modulo_predefinido_id);
      }
    }

    // Filtro de busca textual (server-side) — aplicado ANTES da paginação
    let resultados = sols;
    if (search) {
      const q = search.toLowerCase();
      resultados = resultados.filter((s: { item?: { nome?: string; codigo?: string }; solicitante?: { nome?: string; matricula?: string }; destinatario?: { nome?: string; matricula?: string }; motivo_solicitacao?: string; base_destino?: { nome?: string }; grupo_entrega?: { funcionario?: { nome?: string } }; modulo_predefinido?: { nome_modulo?: string }; numero_solicitacao?: string; destinatario_equipe?: { nome?: string; operacao?: string }; responsavel_equipe?: { nome?: string; matricula?: string }; [key: string]: unknown }) =>
        (s.item?.nome || '').toLowerCase().includes(q) ||
        (s.solicitante?.nome || '').toLowerCase().includes(q) ||
        (s.solicitante?.matricula || '').toLowerCase().includes(q) ||
        (s.destinatario?.nome || '').toLowerCase().includes(q) ||
        (s.destinatario?.matricula || '').toLowerCase().includes(q) ||
        (s.motivo_solicitacao || '').toLowerCase().includes(q) ||
        (s.base_destino?.nome || '').toLowerCase().includes(q) ||
        (s.grupo_entrega?.funcionario?.nome || '').toLowerCase().includes(q) ||
        (s.modulo_predefinido?.nome_modulo || '').toLowerCase().includes(q) ||
        (s.numero_solicitacao || '').toLowerCase().includes(q) ||
        (s.destinatario_equipe?.nome || '').toLowerCase().includes(q) ||
        (s.destinatario_equipe?.operacao || '').toLowerCase().includes(q) ||
        (s.responsavel_equipe?.nome || '').toLowerCase().includes(q) ||
        (s.responsavel_equipe?.matricula || '').toLowerCase().includes(q) ||
        (s.item?.codigo || '').toLowerCase().includes(q)
      );
    }

    // Quando tem busca, paginar manualmente após o filtro textual
    const finalTotal = hasSearch ? resultados.length : (totalCount || 0);
    const finalData = hasSearch ? resultados.slice(from, to + 1) : resultados;

    return NextResponse.json({
      success: true,
      data: finalData,
      stats,
      pagination: { page, pageSize, total: finalTotal },
      bases: basesData || [],
      contratos: contratosData || [],
    });
  } catch (error) {
    console.error('❌ Erro ao buscar solicitações:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
