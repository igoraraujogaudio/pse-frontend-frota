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
        stats: { total: 0, pendente_sesmt: 0, aprovada_sesmt: 0, dupla_completa: 0, rejeitada: 0 },
        pagination: { page: 1, pageSize: 50, total: 0 }, bases: [], contratos: []
      });
    }

    // ── Parâmetros de filtro ──
    const status = searchParams.get('status') || 'todas';
    const tipoAprovacao = searchParams.get('tipoAprovacao') || 'pendente_sesmt';
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
      q = q.in('base_id', filteredBaseIds);
      
      // Filtro por tipo de aprovação SESMT
      if (tipoAprovacao === 'pendente_sesmt') {
        // Solicitações pendentes de aprovação SESMT:
        // - Status 'pendente'
        // - Ainda não aprovadas pelo SESMT (independente do almoxarifado)
        q = q.eq('status', 'pendente')
          .is('aprovado_sesmt_por', null);
      } else if (tipoAprovacao === 'aprovada_sesmt') {
        // Aprovadas pelo SESMT mas ainda não completa (aguardando almoxarifado)
        q = q.eq('status', 'pendente')
          .not('aprovado_sesmt_por', 'is', null)
          .is('aprovado_almoxarifado_por', null);
      } else if (tipoAprovacao === 'dupla_completa') {
        // Dupla aprovação completa
        q = q.in('status', ['aprovada', 'aguardando_estoque', 'entregue'])
          .not('aprovado_almoxarifado_por', 'is', null)
          .not('aprovado_sesmt_por', 'is', null);
      } else if (status !== 'todas') {
        // Filtro por status específico
        q = q.eq('status', status);
      }
      
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
      aprovador_sesmt:usuarios!aprovado_sesmt_por(id, nome),
      entregador:usuarios!entregue_por(id, nome),
      base_destino:bases!base_id(id, nome, codigo)
    `;

    // Stats query: todas as solicitações nas bases do usuário
    let statsQ = supabase.from('solicitacoes_itens')
      .select('status, aprovado_almoxarifado_por, aprovado_sesmt_por', { count: 'exact', head: false })
      .in('base_id', filteredBaseIds);
    if (inicio && fim) statsQ = statsQ.gte('criado_em', inicio).lte('criado_em', fim);

    const [
      { data: statsData },
      { count: totalCount },
      { data: solicitacoes, error: dataError },
      { data: contratosData },
    ] = await Promise.all([
      statsQ,
      // Quando há busca textual, o count real será calculado após o filtro
      search
        ? Promise.resolve({ count: 0 })
        : applyFilters(supabase.from('solicitacoes_itens').select('id', { count: 'exact', head: true })),
      // Quando há busca textual, buscar TODOS os registros (sem range) para filtrar depois
      search
        ? applyFilters(supabase.from('solicitacoes_itens').select(selectFields))
            .order('criado_em', { ascending: false })
        : applyFilters(supabase.from('solicitacoes_itens').select(selectFields))
            .order('criado_em', { ascending: false }).range(from, to),
      supabase.from('contratos').select('id, nome, codigo')
        .in('id', userContractIds.length > 0 ? userContractIds : noId).eq('ativo', true).order('nome'),
    ]);

    if (dataError) {
      console.error('❌ Erro ao buscar solicitações SESMT:', dataError);
      return NextResponse.json({ error: 'Erro ao buscar solicitações' }, { status: 500 });
    }

    // Calcular estatísticas SESMT
    const stats = {
      total: statsData?.length || 0,
      // Pendentes SESMT: status pendente + não aprovado SESMT (independente do almoxarifado)
      pendente_sesmt: statsData?.filter((s: { status: string; aprovado_sesmt_por: unknown }) => 
        s.status === 'pendente' && 
        !s.aprovado_sesmt_por
      ).length || 0,
      // Aprovadas SESMT: aprovado SESMT mas ainda não completa
      aprovada_sesmt: statsData?.filter((s: { status: string; aprovado_sesmt_por: unknown; aprovado_almoxarifado_por: unknown }) => 
        s.status === 'pendente' && 
        s.aprovado_sesmt_por && 
        !s.aprovado_almoxarifado_por
      ).length || 0,
      // Dupla completa: ambos aprovados
      dupla_completa: statsData?.filter((s: { aprovado_almoxarifado_por: unknown; aprovado_sesmt_por: unknown; status: string }) => 
        s.aprovado_almoxarifado_por && 
        s.aprovado_sesmt_por &&
        ['aprovada', 'aguardando_estoque', 'entregue'].includes(s.status)
      ).length || 0,
      // Rejeitadas
      rejeitada: statsData?.filter((s: { status: string }) => s.status === 'rejeitada').length || 0,
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

    // Filtro de busca textual (server-side)
    let resultados = sols;
    if (search) {
      const q = search.toLowerCase();
      resultados = resultados.filter((s: { item?: { nome?: string; codigo?: string }; solicitante?: { nome?: string; matricula?: string }; destinatario?: { nome?: string; matricula?: string }; motivo_solicitacao?: string; base_destino?: { nome?: string }; grupo_entrega?: { funcionario?: { nome?: string } }; modulo_predefinido?: { nome_modulo?: string }; numero_solicitacao?: string; destinatario_equipe?: { nome?: string }; [key: string]: unknown }) =>
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
        (s.destinatario_equipe?.nome || '').toLowerCase().includes(q)
      );
    }

    // Quando há busca textual, paginar manualmente após o filtro
    const finalTotal = search ? resultados.length : (totalCount || 0);
    const paginatedResults = search ? resultados.slice(from, to + 1) : resultados;

    return NextResponse.json({
      success: true,
      data: paginatedResults,
      stats,
      pagination: { page, pageSize, total: finalTotal },
      bases: basesData || [],
      contratos: contratosData || [],
    });
  } catch (error) {
    console.error('❌ Erro ao buscar solicitações SESMT:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
