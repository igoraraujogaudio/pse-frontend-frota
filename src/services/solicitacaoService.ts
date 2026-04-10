import { supabase } from '@/lib/supabase'
import type { SolicitacaoItem } from '@/types'

export const solicitacaoService = {
  // ============================================================================
  // SOLICITAÇÕES PARA CONTRATO DE ORIGEM
  // ============================================================================

  async criarSolicitacaoContratoOrigem(
    solicitanteId: string,
    itemId: string,
    quantidade: number,
    justificativa: string,
    prioridade: 'baixa' | 'normal' | 'alta' | 'urgente' = 'normal'
  ): Promise<string> {
    const { data, error } = await supabase.rpc('criar_solicitacao_contrato_origem', {
      p_solicitante_id: solicitanteId,
      p_item_id: itemId,
      p_quantidade: quantidade,
      p_justificativa: justificativa,
      p_prioridade: prioridade
    });

    if (error) throw error;
    return data;
  },

  async getSolicitacoesPorContratoOrigem(contratoId: string): Promise<SolicitacaoItem[]> {
    const { data, error } = await supabase
      .from('view_solicitacoes_contrato_origem')
      .select('*')
      .eq('contrato_origem_id', contratoId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async getSolicitacoesPorBase(baseId: string): Promise<SolicitacaoItem[]> {
    const { data, error } = await supabase
      .from('solicitacoes_itens')
      .select(`
        *,
        item:itens_estoque(*),
        solicitante:usuarios!solicitante_id(id, nome, matricula),
        aprovado_almoxarifado_por:usuarios!aprovado_almoxarifado_por(id, nome),
        base:bases!base_id(id, nome, codigo)
      `)
      .eq('base_id', baseId)
      .order('criado_em', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async aprovarSolicitacaoOrigem(
    solicitacaoId: string,
    aprovadorId: string,
    observacoes?: string
  ): Promise<void> {
    const { error } = await supabase.rpc('aprovar_solicitacao_origem', {
      p_solicitacao_id: solicitacaoId,
      p_aprovador_id: aprovadorId,
      p_observacoes: observacoes
    });

    if (error) throw error;
  },

  async rejeitarSolicitacaoOrigem(
    solicitacaoId: string,
    aprovadorId: string,
    motivo: string
  ): Promise<void> {
    const { error } = await supabase.rpc('rejeitar_solicitacao_origem', {
      p_solicitacao_id: solicitacaoId,
      p_aprovador_id: aprovadorId,
      p_motivo: motivo
    });

    if (error) throw error;
  },

  // ============================================================================
  // SOLICITAÇÕES TRADICIONAIS (COMPATIBILIDADE)
  // ============================================================================

  async getSolicitacoesPendentes(startDate?: Date, endDate?: Date): Promise<SolicitacaoItem[]> {
    let query = supabase
      .from('solicitacoes_itens')
      .select(`
        *,
        item:itens_estoque(*),
        solicitante:usuarios!solicitante_id(id, nome, matricula),
        aprovado_almoxarifado_por:usuarios!aprovado_almoxarifado_por(id, nome),
        base:bases!base_id(id, nome, codigo)
      `)
      .eq('status', 'pendente')
      .order('criado_em', { ascending: false });

    if (startDate && endDate) {
      query = query
        .gte('criado_em', startDate.toISOString())
        .lte('criado_em', endDate.toISOString());
    }

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
  },

  async getSolicitacao(id: string): Promise<SolicitacaoItem | null> {
    const { data, error } = await supabase
      .from('solicitacoes_itens')
      .select(`
        *,
        item:itens_estoque(*),
        solicitante:usuarios!solicitante_id(id, nome, matricula),
        aprovado_almoxarifado_por:usuarios!aprovado_almoxarifado_por(id, nome),
        entregue_por:usuarios!entregue_por(id, nome),
        base:bases!base_id(id, nome, codigo)
      `)
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }
    return data;
  },

  async aprovarSolicitacao(
    id: string,
    aprovadorId: string,
    quantidadeAprovada?: number,
    observacoes?: string
  ): Promise<void> {
    const { error } = await supabase
      .from('solicitacoes_itens')
      .update({
        status: 'aprovada',
        aprovado_almoxarifado_por: aprovadorId,
        aprovado_almoxarifado_em: new Date().toISOString(),
        quantidade_aprovada: quantidadeAprovada,
        observacoes: observacoes,
        atualizado_em: new Date().toISOString()
      })
      .eq('id', id);

    if (error) throw error;
  },

  async rejeitarSolicitacao(
    id: string,
    aprovadorId: string,
    motivo: string
  ): Promise<void> {
    const { error } = await supabase
      .from('solicitacoes_itens')
      .update({
        status: 'rejeitada',
        aprovado_almoxarifado_por: aprovadorId,
        aprovado_almoxarifado_em: new Date().toISOString(),
        motivo_rejeicao: motivo,
        atualizado_em: new Date().toISOString()
      })
      .eq('id', id);

    if (error) throw error;
  },

  async marcarComoEntregue(
    id: string,
    entregadorId: string,
    quantidadeEntregue: number,
    observacoes?: string
  ): Promise<void> {
    const { error } = await supabase
      .from('solicitacoes_itens')
      .update({
        status: 'entregue',
        entregue_por: entregadorId,
        entregue_em: new Date().toISOString(),
        quantidade_entregue: quantidadeEntregue,
        observacoes: observacoes,
        atualizado_em: new Date().toISOString()
      })
      .eq('id', id);

    if (error) throw error;
  },

  // ============================================================================
  // RELATÓRIOS E ESTATÍSTICAS
  // ============================================================================

  async getEstatisticasSolicitacoes(contratoId?: string, baseId?: string) {
    let query = supabase
      .from('solicitacoes_itens')
      .select('status, prioridade');

    // Nota: contratoId não está disponível diretamente em solicitacoes_itens
    // Se necessário, fazer join com usuarios->contratos

    if (baseId) {
      query = query.eq('base_id', baseId);
    }

    const { data, error } = await query;

    if (error) throw error;

    const stats = {
      total: data?.length || 0,
      pendentes: data?.filter(s => s.status === 'pendente').length || 0,
      aprovadas: data?.filter(s => s.status === 'aprovada').length || 0,
      rejeitadas: data?.filter(s => s.status === 'rejeitada').length || 0,
      entregues: data?.filter(s => s.status === 'entregue').length || 0,
      por_prioridade: {
        urgente: data?.filter(s => s.prioridade === 'urgente').length || 0,
        alta: data?.filter(s => s.prioridade === 'alta').length || 0,
        normal: data?.filter(s => s.prioridade === 'normal').length || 0,
        baixa: data?.filter(s => s.prioridade === 'baixa').length || 0
      }
    };

    return stats;
  },

  async getSolicitacoesPorUsuario(usuarioId: string, startDate?: Date, endDate?: Date): Promise<SolicitacaoItem[]> {
    let query = supabase
      .from('solicitacoes_itens')
      .select(`
        *,
        item:itens_estoque(*),
        solicitante:usuarios!solicitante_id(id, nome, matricula),
        aprovado_almoxarifado_por:usuarios!aprovado_almoxarifado_por(id, nome),
        base:bases!base_id(id, nome, codigo)
      `)
      .eq('solicitante_id', usuarioId)
      .order('criado_em', { ascending: false });

    if (startDate && endDate) {
      query = query
        .gte('criado_em', startDate.toISOString())
        .lte('criado_em', endDate.toISOString());
    }

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
  },

  async getSolicitacoesComFiltro(filtros: {
    status?: string;
    startDate?: Date;
    endDate?: Date;
    contratoId?: string;
    baseId?: string;
    usuarioId?: string;
  }): Promise<SolicitacaoItem[]> {
    let query = supabase
      .from('solicitacoes_itens')
      .select(`
        *,
        item:itens_estoque(*),
        solicitante:usuarios!solicitante_id(id, nome, matricula),
        aprovado_almoxarifado_por:usuarios!aprovado_almoxarifado_por(id, nome),
        base:bases!base_id(id, nome, codigo)
      `)
      .order('criado_em', { ascending: false });

    if (filtros.status) {
      query = query.eq('status', filtros.status);
    }

    if (filtros.startDate && filtros.endDate) {
      query = query
        .gte('criado_em', filtros.startDate.toISOString())
        .lte('criado_em', filtros.endDate.toISOString());
    }

    // Nota: contratoId não está disponível diretamente em solicitacoes_itens
    // Se necessário, fazer join com usuarios->contratos

    if (filtros.baseId) {
      query = query.eq('base_id', filtros.baseId);
    }

    if (filtros.usuarioId) {
      query = query.eq('solicitante_id', filtros.usuarioId);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
  },

  // ============================================================================
  // NOTIFICAÇÕES E ALERTAS
  // ============================================================================

  async getSolicitacoesPendentesAprovacao(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _usuarioId: string
  ): Promise<{
    pendentes: SolicitacaoItem[];
  }> {
    // Buscar todas as solicitações pendentes
    const { data: pendentes, error } = await supabase
      .from('solicitacoes_itens')
      .select(`
        *,
        item:itens_estoque(*),
        solicitante:usuarios!solicitante_id(id, nome, matricula),
        aprovado_almoxarifado_por:usuarios!aprovado_almoxarifado_por(id, nome),
        base:bases!base_id(id, nome, codigo)
      `)
      .eq('status', 'pendente')
      .order('criado_em', { ascending: false });

    if (error) throw error;

    return {
      pendentes: pendentes || []
    };
  }
}
