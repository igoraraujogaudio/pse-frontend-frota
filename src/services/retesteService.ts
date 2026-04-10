import { supabase } from '@/lib/supabase';

export interface ItemDescartado {
  id: string;
  item_estoque_id: string;
  funcionario_id: string;
  historico_funcionario_id?: string;
  base_id: string;
  nome_item: string;
  codigo_item: string;
  categoria: string;
  quantidade: number;
  valor_unitario: number;
  valor_total: number;
  motivo_descarte: string;
  condicao_descarte: 'danificado' | 'perdido' | 'vencido' | 'defeituoso' | 'outros';
  data_descarte: string;
  responsavel_descarte: string;
  aprovador_descarte?: string;
  evidencia_descarte_url?: string;
  observacoes_descarte?: string;
  status: 'descartado' | 'em_reteste' | 'recuperado' | 'confirmado_descarte';
  pode_reteste: boolean;
  criado_em: string;
  atualizado_em: string;
}

export interface ItemReteste {
  id: string;
  item_descartado_id: string;
  motivo_reteste: string;
  data_entrada_reteste: string;
  data_prevista_saida?: string;
  data_conclusao_reteste?: string;
  responsavel_reteste: string;
  tecnico_responsavel?: string;
  local_reteste?: string;
  tipo_reteste: 'calibracao' | 'manutencao' | 'inspecao' | 'teste_funcional' | 'outros';
  status: 'pendente' | 'em_reteste' | 'aprovado' | 'reprovado' | 'cancelado';
  resultado_reteste?: string;
  observacoes_reteste?: string;
  numero_laudo?: string;
  validade_laudo?: string;
  arquivo_laudo_url?: string;
  custo_reteste: number;
  criado_em: string;
  atualizado_em: string;
}

export interface HistoricoReteste {
  id: string;
  item_reteste_id: string;
  usuario_id: string;
  acao: 'iniciado' | 'pausado' | 'retomado' | 'concluido' | 'cancelado' | 'aprovado' | 'reprovado';
  observacoes?: string;
  data_acao: string;
}

export interface ItemRetesteCompleto {
  id: string;
  item_estoque_id: string;
  funcionario_id?: string;
  base_id: string;
  equipe_id?: string;
  prefixo?: string;
  quantidade: number;
  motivo_reteste: string;
  data_entrada_reteste: string;
  data_conclusao?: string;
  status: 'em_reteste' | 'aprovado' | 'reprovado';
  observacoes_reteste?: string;
  numero_laudo?: string;
  origem: 'devolucao' | 'estoque' | 'reenvio';
  reteste_anterior_id?: string;
  responsavel_reteste?: string;
  usuario_conclusao?: string;
  criado_em: string;
  nome_item: string;
  codigo_item: string;
  categoria: string;
  valor_unitario: number;
  valor_total: number;
  base_nome: string;
  funcionario_nome?: string;
  funcionario_matricula?: string;
  responsavel_nome: string;
  usuario_conclusao_nome?: string;
  equipe_nome?: string;
}

export const retesteService = {
  // ============================================================================
  // ITENS DESCARTADOS
  // ============================================================================

  async getItensDescartados(): Promise<ItemDescartado[]> {
    const { data, error } = await supabase
      .from('vw_itens_descartados_completo')
      .select('*')
      .order('data_descarte', { ascending: false });

    if (error) throw error;
    return data as ItemDescartado[];
  },

  async getItemDescartadoById(id: string): Promise<ItemDescartado> {
    const { data, error } = await supabase
      .from('itens_descartados')
      .select(`
        *,
        funcionario:usuarios!funcionario_id(nome, matricula),
        responsavel:usuarios!responsavel_descarte(nome),
        aprovador:usuarios!aprovador_descarte(nome),
        base:bases!base_id(nome),
        item_estoque:itens_estoque!item_estoque_id(nome, codigo)
      `)
      .eq('id', id)
      .single();

    if (error) throw error;
    return data as ItemDescartado;
  },

  async descartarItem(params: {
    item_estoque_id: string;
    funcionario_id: string;
    historico_funcionario_id?: string;
    base_id: string;
    motivo_descarte: string;
    condicao_descarte: 'danificado' | 'perdido' | 'vencido' | 'defeituoso' | 'outros';
    responsavel_descarte: string;
    evidencia_url?: string;
    observacoes?: string;
  }): Promise<{ success: boolean; message: string; descarte_id?: string }> {
    const { data, error } = await supabase.rpc('descartar_item', {
      p_item_estoque_id: params.item_estoque_id,
      p_funcionario_id: params.funcionario_id,
      p_historico_funcionario_id: params.historico_funcionario_id || null,
      p_base_id: params.base_id,
      p_motivo_descarte: params.motivo_descarte,
      p_condicao_descarte: params.condicao_descarte,
      p_responsavel_descarte: params.responsavel_descarte,
      p_evidencia_url: params.evidencia_url || null,
      p_observacoes: params.observacoes || null
    });

    if (error) throw error;
    return data;
  },

  // ============================================================================
  // ITENS EM RETESTE
  // ============================================================================

  async getItensReteste(): Promise<ItemReteste[]> {
    const { data, error } = await supabase
      .from('vw_itens_reteste_completo')
      .select('*')
      .order('data_entrada_reteste', { ascending: false });

    if (error) throw error;
    return data as ItemReteste[];
  },

  async getItemRetesteById(id: string): Promise<ItemReteste> {
    const { data, error } = await supabase
      .from('itens_reteste')
      .select(`
        *,
        item_descartado:itens_descartados!item_descartado_id(
          *,
          funcionario:usuarios!funcionario_id(nome, matricula),
          base:bases!base_id(nome)
        ),
        responsavel:usuarios!responsavel_reteste(nome),
        tecnico:usuarios!tecnico_responsavel(nome)
      `)
      .eq('id', id)
      .single();

    if (error) throw error;
    return data as ItemReteste;
  },

  async criarRetesteAutomatico(params: {
    item_estoque_id: string;
    funcionario_id: string;
    historico_funcionario_id?: string;
    base_id: string;
    motivo_reteste: string;
    responsavel_reteste: string;
    equipe_id?: string;
    prefixo?: string;
  }): Promise<{ success: boolean; message: string; reteste_id?: string }> {
    const { data: result, error } = await supabase.rpc('enviar_para_reteste_devolucao', {
      p_item_estoque_id: params.item_estoque_id,
      p_funcionario_id: params.funcionario_id || null,
      p_historico_funcionario_id: params.historico_funcionario_id || null,
      p_base_id: params.base_id,
      p_quantidade: 1,
      p_motivo: params.motivo_reteste,
      p_responsavel: params.responsavel_reteste,
      p_equipe_id: params.equipe_id || null,
      p_prefixo: params.prefixo || null
    });

    if (error) throw error;
    return result;
  },

  async iniciarReteste(params: {
    reteste_id: string;
    tipo_reteste: 'calibracao' | 'manutencao' | 'inspecao' | 'teste_funcional' | 'outros';
    data_prevista?: string;
    local_reteste?: string;
    tecnico_responsavel?: string;
  }): Promise<{ success: boolean; message: string }> {
    const { data: result, error } = await supabase.rpc('iniciar_reteste', {
      p_reteste_id: params.reteste_id,
      p_tipo_reteste: params.tipo_reteste,
      p_data_prevista: params.data_prevista || null,
      p_local_reteste: params.local_reteste || null,
      p_tecnico_responsavel: params.tecnico_responsavel || null
    });

    if (error) throw error;
    return result;
  },

  async concluirReteste(params: {
    reteste_id: string;
    status: 'aprovado' | 'reprovado';
    resultado: string;
    observacoes?: string;
    numero_laudo?: string;
    validade_laudo?: string;
    arquivo_laudo_url?: string;
    custo_reteste?: number;
    usuario_conclusao?: string;
  }): Promise<{ success: boolean; message: string }> {
    const { data: result, error } = await supabase.rpc('concluir_reteste', {
      p_reteste_id: params.reteste_id,
      p_status: params.status,
      p_resultado: params.resultado,
      p_observacoes: params.observacoes || null,
      p_numero_laudo: params.numero_laudo || null,
      p_validade_laudo: params.validade_laudo || null,
      p_arquivo_laudo_url: params.arquivo_laudo_url || null,
      p_custo_reteste: params.custo_reteste || 0,
      p_usuario_conclusao: params.usuario_conclusao || null
    });

    if (error) throw error;
    return result;
  },

  async cancelarReteste(retesteId: string, motivo: string, usuarioId: string): Promise<{ success: boolean; message: string }> {
    const { error } = await supabase
      .from('itens_reteste')
      .update({
        status: 'cancelado',
        observacoes_reteste: motivo,
        data_conclusao_reteste: new Date().toISOString()
      })
      .eq('id', retesteId);

    if (error) throw error;

    // Registrar no histórico
    await supabase
      .from('historico_reteste')
      .insert({
        item_reteste_id: retesteId,
        usuario_id: usuarioId,
        acao: 'cancelado',
        observacoes: motivo
      });

    return { success: true, message: 'Reteste cancelado com sucesso' };
  },

  // ============================================================================
  // HISTÓRICO DE RETESTE
  // ============================================================================

  async getHistoricoReteste(itemRetesteId: string): Promise<HistoricoReteste[]> {
    const { data, error } = await supabase
      .from('historico_reteste')
      .select(`
        *,
        usuario:usuarios!usuario_id(nome)
      `)
      .eq('item_reteste_id', itemRetesteId)
      .order('data_acao', { ascending: false });

    if (error) throw error;
    return data as HistoricoReteste[];
  },

  async registrarAcaoReteste(params: {
    item_reteste_id: string;
    usuario_id: string;
    acao: 'iniciado' | 'pausado' | 'retomado' | 'concluido' | 'cancelado' | 'aprovado' | 'reprovado';
    observacoes?: string;
  }): Promise<HistoricoReteste> {
    const { data: result, error } = await supabase
      .from('historico_reteste')
      .insert({
        item_reteste_id: params.item_reteste_id,
        usuario_id: params.usuario_id,
        acao: params.acao,
        observacoes: params.observacoes || null
      })
      .select()
      .single();

    if (error) throw error;
    return result as HistoricoReteste;
  },

  // ============================================================================
  // RELATÓRIOS E ESTATÍSTICAS
  // ============================================================================

  async getEstatisticasReteste(): Promise<{
    totalDescartados: number;
    emReteste: number;
    aprovados: number;
    reprovados: number;
    valorTotalDescartado: number;
    valorTotalRecuperado: number;
  }> {
    const [descartados, retestes] = await Promise.all([
      supabase.from('itens_descartados').select('valor_total, status'),
      supabase.from('itens_reteste').select('status')
    ]);

    if (descartados.error) throw descartados.error;
    if (retestes.error) throw retestes.error;

    const totalDescartados = descartados.data.length;
    const emReteste = retestes.data.filter(r => r.status === 'em_reteste').length;
    const aprovados = retestes.data.filter(r => r.status === 'aprovado').length;
    const reprovados = retestes.data.filter(r => r.status === 'reprovado').length;
    
    const valorTotalDescartado = descartados.data.reduce((sum, item) => sum + item.valor_total, 0);
    const valorTotalRecuperado = descartados.data
      .filter(item => item.status === 'recuperado')
      .reduce((sum, item) => sum + item.valor_total, 0);

    return {
      totalDescartados,
      emReteste,
      aprovados,
      reprovados,
      valorTotalDescartado,
      valorTotalRecuperado
    };
  },

  async getItensVencendoReteste(dias: number = 7): Promise<ItemReteste[]> {
    const dataLimite = new Date();
    dataLimite.setDate(dataLimite.getDate() + dias);

    const { data, error } = await supabase
      .from('vw_itens_reteste_completo')
      .select('*')
      .eq('status', 'em_reteste')
      .lte('data_prevista_saida', dataLimite.toISOString().split('T')[0])
      .order('data_prevista_saida', { ascending: true });

    if (error) throw error;
    return data as ItemReteste[];
  },

  // ============================================================================
  // INTEGRAÇÃO COM SISTEMA DE DEVOLUÇÕES
  // ============================================================================

  async processarDevolucaoComDescarte(params: {
    historico_funcionario_id: string;
    condicao_devolucao: 'bom' | 'regular' | 'danificado' | 'perdido';
    observacoes_devolucao: string;
    responsavel_devolucao: string;
    evidencia_url?: string;
    descartar_item: boolean;
    motivo_descarte?: string;
  }): Promise<{ success: boolean; message: string; descarte_id?: string }> {
    // Primeiro, processar a devolução normal
    const { data: historico, error: historicoError } = await supabase
      .from('historico_funcionarios')
      .update({
        status: 'devolvido',
        data_devolucao: new Date().toISOString(),
        condicao_devolucao: params.condicao_devolucao,
        observacoes_devolucao: params.observacoes_devolucao,
        responsavel_devolucao: params.responsavel_devolucao
      })
      .eq('id', params.historico_funcionario_id)
      .select(`
        *,
        item:itens_estoque!item_id(*),
        funcionario:usuarios!funcionario_id(*)
      `)
      .single();

    if (historicoError) throw historicoError;

    // Se deve descartar o item
    if (params.descartar_item && params.condicao_devolucao !== 'bom') {
      const descarteResult = await this.descartarItem({
        item_estoque_id: historico.item_id,
        funcionario_id: historico.funcionario_id,
        historico_funcionario_id: params.historico_funcionario_id,
        base_id: historico.item.base_id,
        motivo_descarte: params.motivo_descarte || `Item ${params.condicao_devolucao} na devolução`,
        condicao_descarte: params.condicao_devolucao === 'danificado' ? 'danificado' : 
                          params.condicao_devolucao === 'perdido' ? 'perdido' : 'defeituoso',
        responsavel_descarte: params.responsavel_devolucao,
        evidencia_url: params.evidencia_url,
        observacoes: params.observacoes_devolucao
      });

      return {
        success: true,
        message: 'Devolução processada e item descartado com sucesso',
        descarte_id: descarteResult.descarte_id
      };
    }

    return {
      success: true,
      message: 'Devolução processada com sucesso'
    };
  },

  // ============================================================================
  // NOVOS MÉTODOS — CONTROLE COMPLETO DE RETESTE
  // ============================================================================

  async enviarEstoqueParaReteste(params: {
    item_estoque_id: string;
    base_id: string;
    quantidade: number;
    motivo: string;
    responsavel: string;
  }): Promise<{ success: boolean; message: string; reteste_id?: string; disponivel?: number }> {
    const { data, error } = await supabase.rpc('enviar_estoque_para_reteste', {
      p_item_estoque_id: params.item_estoque_id,
      p_base_id: params.base_id,
      p_quantidade: params.quantidade,
      p_motivo: params.motivo,
      p_responsavel: params.responsavel
    });
    if (error) throw error;
    return data;
  },

  async concluirRetesteV2(params: {
    reteste_id: string;
    status: 'aprovado' | 'reprovado';
    observacoes: string;
    numero_laudo?: string;
    usuario_conclusao: string;
  }): Promise<{ success: boolean; message: string }> {
    const { data, error } = await supabase.rpc('concluir_reteste_v2', {
      p_reteste_id: params.reteste_id,
      p_status: params.status,
      p_observacoes: params.observacoes,
      p_numero_laudo: params.numero_laudo || null,
      p_usuario_conclusao: params.usuario_conclusao
    });
    if (error) throw error;
    return data;
  },

  async descartarItemReteste(params: {
    reteste_id: string;
    motivo: string;
    responsavel: string;
  }): Promise<{ success: boolean; message: string }> {
    const { data, error } = await supabase.rpc('descartar_item_reteste', {
      p_reteste_id: params.reteste_id,
      p_motivo: params.motivo,
      p_responsavel: params.responsavel
    });
    if (error) throw error;
    return data;
  },

  async reenviarParaReteste(params: {
    reteste_id: string;
    motivo: string;
    responsavel: string;
  }): Promise<{ success: boolean; message: string; reteste_id?: string }> {
    const { data, error } = await supabase.rpc('reenviar_para_reteste', {
      p_reteste_id: params.reteste_id,
      p_motivo: params.motivo,
      p_responsavel: params.responsavel
    });
    if (error) throw error;
    return data;
  },

  async getItensRetesteComFiltros(params: {
    base_id?: string;
    status?: string;
    search?: string;
  }): Promise<ItemRetesteCompleto[]> {
    let query = supabase
      .from('vw_itens_reteste_completo')
      .select('*')
      .order('data_entrada_reteste', { ascending: false });

    if (params.base_id) query = query.eq('base_id', params.base_id);
    if (params.status) query = query.eq('status', params.status);
    if (params.search) {
      query = query.or(`nome_item.ilike.%${params.search}%,codigo_item.ilike.%${params.search}%,funcionario_nome.ilike.%${params.search}%,funcionario_matricula.ilike.%${params.search}%`);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data as ItemRetesteCompleto[];
  },

  async getEstatisticasRetestePeriodo(params?: {
    data_inicio?: string;
    data_fim?: string;
  }): Promise<{
    totalEmReteste: number;
    aprovadosPeriodo: number;
    reprovadosPeriodo: number;
    aguardandoAvaliacao: number;
    valorTotalEmReteste: number;
  }> {
    // Get all items in retest (em_reteste)
    const { data: emReteste, error: errReteste } = await supabase
      .from('vw_itens_reteste_completo')
      .select('*')
      .eq('status', 'em_reteste');
    if (errReteste) throw errReteste;

    // Get concluded items in period
    let queryAprovados = supabase
      .from('vw_itens_reteste_completo')
      .select('*')
      .eq('status', 'aprovado');
    let queryReprovados = supabase
      .from('vw_itens_reteste_completo')
      .select('*')
      .eq('status', 'reprovado');

    if (params?.data_inicio) {
      queryAprovados = queryAprovados.gte('data_conclusao', params.data_inicio);
      queryReprovados = queryReprovados.gte('data_conclusao', params.data_inicio);
    }
    if (params?.data_fim) {
      queryAprovados = queryAprovados.lte('data_conclusao', params.data_fim);
      queryReprovados = queryReprovados.lte('data_conclusao', params.data_fim);
    }

    const [aprovados, reprovados] = await Promise.all([queryAprovados, queryReprovados]);
    if (aprovados.error) throw aprovados.error;
    if (reprovados.error) throw reprovados.error;

    const totalEmReteste = emReteste?.length || 0;
    const valorTotalEmReteste = (emReteste || []).reduce((sum: number, item: { valor_total?: number }) => sum + (item.valor_total || 0), 0);

    return {
      totalEmReteste,
      aprovadosPeriodo: aprovados.data?.length || 0,
      reprovadosPeriodo: reprovados.data?.length || 0,
      aguardandoAvaliacao: totalEmReteste,
      valorTotalEmReteste
    };
  },

  async getItensComReteste(baseId: string): Promise<{ item_estoque_id: string; quantidade_reteste: number }[]> {
    const { data, error } = await supabase
      .from('itens_reteste')
      .select('item_estoque_id, quantidade')
      .eq('status', 'em_reteste')
      .eq('base_id', baseId);

    if (error) throw error;

    // Aggregate quantities by item
    const map = new Map<string, number>();
    (data || []).forEach((item: { item_estoque_id: string; quantidade: number }) => {
      const current = map.get(item.item_estoque_id) || 0;
      map.set(item.item_estoque_id, current + item.quantidade);
    });

    return Array.from(map.entries()).map(([item_estoque_id, quantidade_reteste]) => ({
      item_estoque_id,
      quantidade_reteste
    }));
  }
};
