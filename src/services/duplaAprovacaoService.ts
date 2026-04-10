import { supabase } from '@/lib/supabase'
import { SolicitacaoItem } from '@/types'
import { estoqueService } from './estoqueService'

export interface DuplaAprovacaoStatus {
  solicitacao_id: string
  status_geral: string
  aprovado_almoxarifado: boolean
  aprovado_sesmt: boolean
  dupla_aprovacao_completa: boolean
  aprovador_almoxarifado_nome?: string
  aprovador_sesmt_nome?: string
  data_aprovacao_almoxarifado?: string
  data_aprovacao_sesmt?: string
}

export interface AprovacaoAlmoxarifadoParams {
  solicitacaoId: string
  aprovadorId: string
  quantidadeAprovada?: number
  observacoes?: string
}

export interface AprovacaoSESMTParams {
  solicitacaoId: string
  aprovadorId: string
  observacoes?: string
}

export interface RejeicaoParams {
  solicitacaoId: string
  rejeitadorId: string
  motivo: string
  tipoRejeicao?: 'almoxarifado' | 'sesmt' | 'geral'
}

export const duplaAprovacaoService = {
  // ============================================================================
  // APROVAÇÃO NO ALMOXARIFADO
  // ============================================================================

  async aprovarAlmoxarifado(params: AprovacaoAlmoxarifadoParams): Promise<SolicitacaoItem> {
    const { solicitacaoId, aprovadorId, quantidadeAprovada, observacoes } = params

    console.log(`🔄 [DUPLA APROVAÇÃO] Aprovando no Almoxarifado:`, {
      solicitacaoId,
      aprovadorId,
      quantidadeAprovada,
      observacoes
    })

    try {
      // Chamar função SQL para aprovar no Almoxarifado
      const { data, error } = await supabase.rpc('aprovar_solicitacao_almoxarifado', {
        p_solicitacao_id: solicitacaoId,
        p_aprovador_id: aprovadorId,
        p_quantidade_aprovada: quantidadeAprovada,
        p_observacoes: observacoes
      })
      
      // Suppress unused variable warning
      void data

      if (error) {
        console.error('❌ Erro ao aprovar no Almoxarifado:', error)
        throw error
      }

      console.log('✅ Solicitação aprovada no Almoxarifado')

      // Buscar a solicitação atualizada
      const solicitacaoAtualizada = await this.getSolicitacaoById(solicitacaoId)

      // Se dupla aprovação completa (status = aprovada), verificar estoque
      if (solicitacaoAtualizada.status === 'aprovada') {
        try {
          const disp = await estoqueService.getEstoqueDisponivel(solicitacaoAtualizada.item_id, solicitacaoAtualizada.base_id)
          if (disp < (solicitacaoAtualizada.quantidade_aprovada || 0)) {
            await supabase.from('solicitacoes_itens')
              .update({ status: 'aguardando_estoque', atualizado_em: new Date().toISOString() })
              .eq('id', solicitacaoId)
            solicitacaoAtualizada.status = 'aguardando_estoque'
            console.log('⏳ Sem estoque suficiente — movida para aguardando_estoque')
          }
        } catch (e) { console.warn('⚠️ Erro ao verificar estoque após aprovação:', e) }
      }

      return solicitacaoAtualizada

    } catch (error) {
      console.error('❌ Erro na aprovação do Almoxarifado:', error)
      throw error
    }
  },

  // ============================================================================
  // APROVAÇÃO NO SESMT
  // ============================================================================

  async aprovarSESMT(params: AprovacaoSESMTParams): Promise<SolicitacaoItem> {
    const { solicitacaoId, aprovadorId, observacoes } = params

    console.log(`🔄 [DUPLA APROVAÇÃO] Aprovando no SESMT:`, {
      solicitacaoId,
      aprovadorId,
      observacoes
    })

    try {
      // Chamar função SQL para aprovar no SESMT
      const { data, error } = await supabase.rpc('aprovar_solicitacao_sesmt', {
        p_solicitacao_id: solicitacaoId,
        p_aprovador_id: aprovadorId,
        p_observacoes: observacoes
      })
      
      // Suppress unused variable warning
      void data

      if (error) {
        console.error('❌ Erro ao aprovar no SESMT:', error)
        throw error
      }

      console.log('✅ Solicitação aprovada no SESMT')

      // Buscar a solicitação atualizada
      const solicitacaoAtualizada = await this.getSolicitacaoById(solicitacaoId)

      // Se dupla aprovação completa (status = aprovada), verificar estoque
      if (solicitacaoAtualizada.status === 'aprovada') {
        try {
          const disp = await estoqueService.getEstoqueDisponivel(solicitacaoAtualizada.item_id, solicitacaoAtualizada.base_id)
          if (disp < (solicitacaoAtualizada.quantidade_aprovada || 0)) {
            await supabase.from('solicitacoes_itens')
              .update({ status: 'aguardando_estoque', atualizado_em: new Date().toISOString() })
              .eq('id', solicitacaoId)
            solicitacaoAtualizada.status = 'aguardando_estoque'
            console.log('⏳ Sem estoque suficiente — movida para aguardando_estoque')
          }
        } catch (e) { console.warn('⚠️ Erro ao verificar estoque após aprovação:', e) }
      }

      return solicitacaoAtualizada

    } catch (error) {
      console.error('❌ Erro na aprovação do SESMT:', error)
      throw error
    }
  },

  // ============================================================================
  // REJEIÇÃO DE SOLICITAÇÃO
  // ============================================================================

  async rejeitarSolicitacao(params: RejeicaoParams): Promise<SolicitacaoItem> {
    const { solicitacaoId, rejeitadorId, motivo, tipoRejeicao = 'geral' } = params

    console.log(`🔄 [DUPLA APROVAÇÃO] Rejeitando solicitação:`, {
      solicitacaoId,
      rejeitadorId,
      motivo,
      tipoRejeicao
    })

    try {
      // Buscar status atual antes de rejeitar
      const { data: solicitacaoAtual, error: erroBusca } = await supabase
        .from('solicitacoes_itens')
        .select('status, motivo_rejeicao')
        .eq('id', solicitacaoId)
        .single()

      if (erroBusca) {
        console.error('❌ Erro ao buscar solicitação atual:', erroBusca)
      } else {
        console.log('📋 Status antes da rejeição:', solicitacaoAtual)
      }

      // Chamar função SQL para rejeitar
      console.log('🔥 Chamando função SQL rejeitar_solicitacao_dupla_aprovacao...')
      const { data, error } = await supabase.rpc('rejeitar_solicitacao_dupla_aprovacao', {
        p_solicitacao_id: solicitacaoId,
        p_rejeitador_id: rejeitadorId,
        p_motivo: motivo,
        p_tipo_rejeicao: tipoRejeicao
      })
      
      console.log('📥 Resposta da função SQL:', { data, error })

      if (error) {
        console.error('❌ Erro ao rejeitar solicitação:', error)
        throw error
      }

      console.log('✅ Solicitação rejeitada')

      // Buscar a solicitação atualizada para confirmar o status
      const solicitacaoAtualizada = await this.getSolicitacaoById(solicitacaoId)
      console.log('📋 Status após a rejeição:', {
        id: solicitacaoAtualizada?.id,
        status: solicitacaoAtualizada?.status,
        motivo_rejeicao: solicitacaoAtualizada?.motivo_rejeicao,
        rejeitado_almoxarifado_por: solicitacaoAtualizada?.rejeitado_almoxarifado_por,
        rejeitado_almoxarifado_em: solicitacaoAtualizada?.rejeitado_almoxarifado_em
      })
      
      return solicitacaoAtualizada

    } catch (error) {
      console.error('❌ Erro na rejeição:', error)
      throw error
    }
  },

  // ============================================================================
  // VERIFICAR STATUS DA DUPLA APROVAÇÃO
  // ============================================================================

  async getStatusDuplaAprovacao(solicitacaoId: string): Promise<DuplaAprovacaoStatus | null> {
    try {
      const { data, error } = await supabase.rpc('obter_status_dupla_aprovacao', {
        p_solicitacao_id: solicitacaoId
      })

      if (error) {
        console.error('❌ Erro ao obter status da dupla aprovação:', error)
        throw error
      }

      return data?.[0] || null

    } catch (error) {
      console.error('❌ Erro ao buscar status:', error)
      throw error
    }
  },

  // ============================================================================
  // BUSCAR SOLICITAÇÃO COMPLETA COM DUPLA APROVAÇÃO
  // ============================================================================

  async getSolicitacaoById(solicitacaoId: string): Promise<SolicitacaoItem> {
    try {
      // Buscar direto da tabela solicitacoes_itens para evitar problema de múltiplas linhas na view
      const { data, error } = await supabase
        .from('solicitacoes_itens')
        .select(`
          *,
          item:itens_estoque!item_id(id, codigo, nome, categoria, unidade_medida, estoque_atual, estoque_minimo, requer_laudo, requer_rastreabilidade, requer_ca),
          solicitante:usuarios!solicitante_id(id, nome, matricula),
          destinatario:usuarios!destinatario_id(id, nome, matricula),
          destinatario_equipe:equipes!destinatario_equipe_id(id, nome, operacao),
          responsavel_equipe:usuarios!responsavel_equipe_id(id, nome, matricula),
          aprovador_almoxarifado:usuarios!aprovado_almoxarifado_por(id, nome),
          aprovador_sesmt:usuarios!aprovado_sesmt_por(id, nome),
          entregador:usuarios!entregue_por(id, nome),
          base_destino:bases!base_id(id, nome, codigo)
        `)
        .eq('id', solicitacaoId)
        .maybeSingle()

      if (error) {
        console.error('❌ Erro ao buscar solicitação:', error)
        throw error
      }

      if (!data) {
        throw new Error('Solicitação não encontrada')
      }

      return data as unknown as SolicitacaoItem

    } catch (error) {
      console.error('❌ Erro ao buscar solicitação:', error)
      throw error
    }
  },

  // ============================================================================
  // BUSCAR SOLICITAÇÕES PENDENTES DE APROVAÇÃO
  // ============================================================================

  async getSolicitacoesPendentes(filtros?: {
    baseId?: string
    contratoId?: string
    tipoAprovacao?: 'almoxarifado' | 'sesmt' | 'ambas'
  }): Promise<SolicitacaoItem[]> {
    try {
      let query = supabase
        .from('view_solicitacoes_dupla_aprovacao')
        .select('*')

      // Aplicar filtros
      if (filtros?.baseId) {
        query = query.eq('base_id', filtros.baseId)
      }

      if (filtros?.contratoId) {
        query = query.eq('contrato_origem_id', filtros.contratoId)
      }

      // Filtro por tipo de aprovação pendente
      if (filtros?.tipoAprovacao) {
        switch (filtros.tipoAprovacao) {
          case 'almoxarifado':
            // Solicitações que precisam de aprovação do Almoxarifado (status = 'pendente' e sem aprovação do Almoxarifado)
            query = query
              .eq('status', 'pendente')
              .is('aprovado_almoxarifado_por', null)
            break
          case 'sesmt':
            // Solicitações que precisam de aprovação SESMT:
            // - Status 'pendente' (ainda não aprovadas pelo Almoxarifado)
            // - Status 'pendente' mas já aprovadas pelo Almoxarifado (dupla_aprovacao_completa = false)
            query = query
              .eq('status', 'pendente')
              .not('aprovado_almoxarifado_por', 'is', null)
              .is('aprovado_sesmt_por', null)
              .eq('dupla_aprovacao_completa', false)
            break
          case 'ambas':
            // Qualquer solicitação que precisa de aprovação (status = 'pendente')
            query = query.eq('status', 'pendente')
            break
        }
      } else {
        // Se não especificado, buscar todas as pendentes de dupla aprovação
        query = query.eq('status', 'pendente')
      }

      const { data, error } = await query.order('criado_em', { ascending: false })

      if (error) {
        console.error('❌ Erro ao buscar solicitações pendentes:', error)
        throw error
      }

      return data || []

    } catch (error) {
      console.error('❌ Erro ao buscar solicitações pendentes:', error)
      throw error
    }
  },

  // ============================================================================
  // BUSCAR TODAS AS SOLICITAÇÕES (PENDENTES + APROVADAS)
  // ============================================================================

  async getTodasSolicitacoes(filtros?: {
    baseId?: string
    contratoId?: string
    dataInicio?: string
    dataFim?: string
    status?: string
      search?: string
  }): Promise<SolicitacaoItem[]> {
    try {
      let query = supabase
        .from('view_solicitacoes_dupla_aprovacao')
        .select('*')

      // Aplicar filtro de status
      if (filtros?.status && filtros.status !== 'todas') {
        query = query.eq('status', filtros.status)
      } else {
        // Se não especificado, buscar todos os status
        query = query.in('status', ['pendente', 'aprovada', 'rejeitada', 'aguardando_estoque', 'entregue', 'devolvida'])
      }

      console.log('🔍 [DUPLA APROVAÇÃO] Filtros aplicados:', {
        status: filtros?.status,
        search: filtros?.search,
        baseId: filtros?.baseId,
        contratoId: filtros?.contratoId
      })

      // DEBUG: Verificar query antes de executar
      console.log('🔍 [DUPLA APROVAÇÃO] Query antes de executar:', query)

      // Aplicar filtro de busca
      if (filtros?.search && filtros.search.trim()) {
        const searchTerm = `%${filtros.search.trim()}%`
        console.log('🔍 [DUPLA APROVAÇÃO] Aplicando busca:', searchTerm)
        query = query.or(`item_nome.ilike.${searchTerm},solicitante_nome.ilike.${searchTerm},destinatario_nome.ilike.${searchTerm}`)
      }

      // Aplicar outros filtros
      if (filtros?.baseId) {
        query = query.eq('base_id', filtros.baseId)
      }

      if (filtros?.contratoId) {
        query = query.eq('contrato_origem_id', filtros.contratoId)
      }

      if (filtros?.dataInicio) {
        query = query.gte('criado_em', filtros.dataInicio)
      }

      if (filtros?.dataFim) {
        query = query.lte('criado_em', filtros.dataFim)
      }

      const { data, error } = await query.order('criado_em', { ascending: false })

      console.log('🔍 [DUPLA APROVAÇÃO] Resultado da query:', {
        dataLength: data?.length || 0,
        error: error?.message || 'Nenhum erro',
        firstItem: data?.[0]?.id || 'Nenhum item'
      })

      if (error) {
        console.error('❌ Erro ao buscar todas as solicitações:', error)
        throw error
      }

      return data || []

    } catch (error) {
      console.error('❌ Erro ao buscar todas as solicitações:', error)
      throw error
    }
  },

  async getSolicitacoesAprovadas(filtros?: {
    baseId?: string
    contratoId?: string
    dataInicio?: string
    dataFim?: string
  }): Promise<SolicitacaoItem[]> {
    try {
      let query = supabase
        .from('view_solicitacoes_dupla_aprovacao')
        .select('*')
        .eq('dupla_aprovacao_completa', true)
        .eq('status', 'aprovada')

      // Aplicar filtros
      if (filtros?.baseId) {
        query = query.eq('base_id', filtros.baseId)
      }

      if (filtros?.contratoId) {
        query = query.eq('contrato_origem_id', filtros.contratoId)
      }

      if (filtros?.dataInicio) {
        query = query.gte('aprovado_almoxarifado_em', filtros.dataInicio)
      }

      if (filtros?.dataFim) {
        query = query.lte('aprovado_almoxarifado_em', filtros.dataFim)
      }

      const { data, error } = await query.order('aprovado_almoxarifado_em', { ascending: false })

      if (error) {
        console.error('❌ Erro ao buscar solicitações aprovadas:', error)
        throw error
      }

      return data || []

    } catch (error) {
      console.error('❌ Erro ao buscar solicitações aprovadas:', error)
      throw error
    }
  },

  // ============================================================================
  // VERIFICAR PERMISSÕES DE APROVAÇÃO
  // ============================================================================

  async verificarPermissaoAprovacao(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    usuarioId: string, 
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    tipoAprovacao: 'almoxarifado' | 'sesmt'
  ): Promise<boolean> {
    // Por enquanto, sempre retorna true - sem verificação de nível de acesso
    // A verificação de permissão será feita pelo sistema de permissões modulares
    return true
  },

  // ============================================================================
  // ESTATÍSTICAS DE DUPLA APROVAÇÃO
  // ============================================================================

  async getEstatisticasDuplaAprovacao(filtros?: {
    baseId?: string
    contratoId?: string
    dataInicio?: string
    dataFim?: string
  }): Promise<{
    total: number
    pendentes: number
    aprovadas_almoxarifado: number
    aprovadas_sesmt: number
    dupla_aprovacao_completa: number
    rejeitadas: number
  }> {
    try {
      let query = supabase
        .from('view_solicitacoes_dupla_aprovacao')
        .select('id, status, aprovado_almoxarifado, aprovado_sesmt, dupla_aprovacao_completa')

      // Aplicar filtros
      if (filtros?.baseId) {
        query = query.eq('base_id', filtros.baseId)
      }

      if (filtros?.contratoId) {
        query = query.eq('contrato_origem_id', filtros.contratoId)
      }

      if (filtros?.dataInicio) {
        query = query.gte('criado_em', filtros.dataInicio)
      }

      if (filtros?.dataFim) {
        query = query.lte('criado_em', filtros.dataFim)
      }

      const { data, error } = await query

      if (error) {
        console.error('❌ Erro ao buscar estatísticas:', error)
        throw error
      }

      const solicitacoes = data || []

      return {
        total: solicitacoes.length,
        pendentes: solicitacoes.filter(s => s.status === 'pendente').length,
        aprovadas_almoxarifado: solicitacoes.filter(s => s.aprovado_almoxarifado).length,
        aprovadas_sesmt: solicitacoes.filter(s => s.aprovado_sesmt).length,
        dupla_aprovacao_completa: solicitacoes.filter(s => s.dupla_aprovacao_completa).length,
        rejeitadas: solicitacoes.filter(s => s.status === 'rejeitada').length
      }

    } catch (error) {
      console.error('❌ Erro ao buscar estatísticas:', error)
      throw error
    }
  }
}
