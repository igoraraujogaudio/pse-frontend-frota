import { supabase } from '@/lib/supabase'

export interface AlmoxarifadoNotification {
  id: string
  checklist_id: string
  item_id: string
  usuario_id: string
  item_titulo: string
  observacoes?: string
  status: 'pendente' | 'liberado' | 'rejeitado'
  liberado_por?: string
  liberado_em?: string
  motivo_liberacao?: string
  criado_em: string
  atualizado_em: string
  // Campos extras para melhor apresentação
  solicitante_nome?: string
  quantidade?: number
  categoria?: string
  // Campos de rastreamento de usuários
  aprovado_almoxarifado_por?: string
  aprovado_em?: string
  entregue_por?: string
  entregue_em?: string
  // Nomes dos usuários para exibição
  aprovador_nome?: string
  entregador_nome?: string
}

export interface AlmoxarifadoStats {
  pendentes: number
  liberados_hoje: number
  rejeitados_hoje: number
  total_mes: number
}

export interface AlmoxarifadoPerformanceReport {
  total_solicitacoes: number
  liberadas: number
  rejeitadas: number
  pendentes: number
  tempo_medio_resposta: number // horas
  taxa_liberacao: number // percentual
}

export const almoxarifadoService = {
  async getNotificacoesPendentes(): Promise<AlmoxarifadoNotification[]> {
    const { data, error } = await supabase
      .from('almoxarifado_notificacoes')
      .select('*')
      .eq('status', 'pendente')
      .order('criado_em', { ascending: false })

    if (error) throw error
    return data || []
  },

  async getHistoricoLiberacoes(limit = 50): Promise<AlmoxarifadoNotification[]> {
    // Primeiro tentar buscar da tabela almoxarifado_notificacoes
    try {
      const { data, error } = await supabase
        .from('almoxarifado_notificacoes')
        .select('*')
        .in('status', ['liberado', 'rejeitado'])
        .order('criado_em', { ascending: false })
        .limit(limit)

      if (error) throw error
      
      console.log(`[DEBUG] getHistoricoLiberacoes (almoxarifado_notificacoes): resultado=${data?.length || 0}`)
      
      if (data && data.length > 0) {
        return data
      }
    } catch (error) {
      console.log('[DEBUG] Erro ao buscar de almoxarifado_notificacoes, tentando estoque_solicitacoes:', error)
    }

    // Fallback: buscar da tabela estoque_solicitacoes (que já existe)
    try {
      const { data, error } = await supabase
        .from('solicitacoes_itens')
        .select(`
          id, item_id, solicitante_id, quantidade_solicitada, prioridade, status,
          motivo_solicitacao, observacoes, criado_em, atualizado_em,
          aprovado_almoxarifado_em, entregue_em, aprovado_almoxarifado_por, entregue_por
        `)
        .in('status', ['aprovada', 'rejeitada', 'entregue'])
        .order('criado_em', { ascending: false })
        .limit(limit)

      if (error) throw error
      
      console.log(`[DEBUG] getHistoricoLiberacoes (solicitacoes_itens): resultado=${data?.length || 0}`)
      
      // Buscar informações complementares
      const itemIds = Array.from(new Set(data.map(item => item.item_id).filter(Boolean)))
      const userIds = Array.from(new Set([
        ...data.map(item => item.solicitante_id).filter(Boolean),
        ...data.map(item => item.aprovado_almoxarifado_por).filter(Boolean),
        ...data.map(item => item.entregue_por).filter(Boolean)
      ]))

      // Buscar dados dos itens
      let itensData: Array<{ id: string; codigo: string; nome: string; categoria: string }> = []
      if (itemIds.length > 0) {
        try {
          const result = await supabase
            .from('itens_estoque')
            .select('id, codigo, nome, categoria')
            .in('id', itemIds)
          itensData = result.data || []
        } catch (error) {
          console.log('[DEBUG] Erro ao buscar itens:', error)
        }
      }

      // Buscar dados dos usuários  
      let usuariosData: Array<{ id: string; nome: string; email: string }> = []
      if (userIds.length > 0) {
        try {
          const result = await supabase
            .from('usuarios')
            .select('id, nome, email')
            .in('id', userIds)
          usuariosData = result.data || []
        } catch (error) {
          console.log('[DEBUG] Erro ao buscar usuários:', error)
        }
      }

      const itensMap = new Map((itensData || []).map(item => [item.id, item]))
      const usuariosMap = new Map((usuariosData || []).map(user => [user.id, user]))

      // Converter para o formato esperado com dados enriquecidos
      return (data || []).map(item => {
        const itemInfo = itensMap.get(item.item_id)
        const solicitante = usuariosMap.get(item.solicitante_id)
        const responsavel = usuariosMap.get(item.aprovado_almoxarifado_por || item.entregue_por)

        let itemTitulo = 'Item não identificado'
        if (itemInfo) {
          itemTitulo = `${itemInfo.codigo || ''} - ${itemInfo.nome || 'Item'}`.trim()
          if (itemTitulo.startsWith('- ')) itemTitulo = itemTitulo.substring(2)
        } else {
          itemTitulo = `Item ${item.item_id?.substring(0, 8) || 'N/A'}`
        }

        return {
          id: item.id,
          checklist_id: item.item_id || '',
          item_id: item.item_id || '',
          usuario_id: item.solicitante_id || '',
          item_titulo: itemTitulo,
          observacoes: item.observacoes || item.motivo_solicitacao || '',
          status: item.status === 'aprovada' ? 'liberado' : item.status === 'rejeitada' ? 'rejeitado' : 'liberado',
          liberado_por: responsavel?.nome || responsavel?.email || `Usuário ${(item.aprovado_almoxarifado_por || item.entregue_por)?.substring(0, 8) || 'Sistema'}`,
          liberado_em: item.aprovado_almoxarifado_em || item.entregue_em || item.criado_em,
          motivo_liberacao: item.observacoes || item.motivo_solicitacao || '',
          criado_em: item.criado_em,
          atualizado_em: item.atualizado_em,
          // Dados extras para melhor apresentação
          solicitante_nome: solicitante?.nome || solicitante?.email || `Usuário ${item.solicitante_id?.substring(0, 8) || 'N/A'}`,
          quantidade: item.quantidade_solicitada || 0,
          categoria: itemInfo?.categoria || 'N/A',
          // Campos de rastreamento de usuários
          aprovado_almoxarifado_por: item.aprovado_almoxarifado_por || '',
          aprovado_em: item.aprovado_almoxarifado_em || '',
          entregue_por: item.entregue_por || '',
          entregue_em: item.entregue_em || '',
          // Nomes dos usuários para exibição
          aprovador_nome: usuariosMap.get(item.aprovado_almoxarifado_por)?.nome || usuariosMap.get(item.aprovado_almoxarifado_por)?.email || `Usuário ${item.aprovado_almoxarifado_por?.substring(0, 8) || 'N/A'}`,
          entregador_nome: usuariosMap.get(item.entregue_por)?.nome || usuariosMap.get(item.entregue_por)?.email || `Usuário ${item.entregue_por?.substring(0, 8) || 'N/A'}`
        }
      })
    } catch (error) {
      console.error('[DEBUG] Erro ao buscar de estoque_solicitacoes:', error)
      return []
    }
  },

  async getHistoricoLiberacoesPeriodo(periodo: 'hoje' | 'semana' | 'mes' | 'todos' = 'mes', limit = 200): Promise<AlmoxarifadoNotification[]> {
    let dataInicio: string | null = null
    const hoje = new Date()
    if (periodo === 'hoje') {
      const start = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate())
      dataInicio = start.toISOString()
    } else if (periodo === 'semana') {
      const start = new Date(hoje.getTime() - 7 * 24 * 60 * 60 * 1000)
      dataInicio = start.toISOString()
    } else if (periodo === 'mes') {
      const start = new Date(hoje.getFullYear(), hoje.getMonth(), 1)
      dataInicio = start.toISOString()
    }

    // Primeiro tentar buscar da tabela almoxarifado_notificacoes
    try {
      let query = supabase
        .from('almoxarifado_notificacoes')
        .select('*')
        .in('status', ['liberado', 'rejeitado'])
        .order('criado_em', { ascending: false })
        .limit(limit)

      // Se não for 'todos', aplicar filtro de data
      if (dataInicio && periodo !== 'todos') {
        query = query.gte('criado_em', dataInicio)
      }

      const { data, error } = await query
      if (error) throw error
      
      // Log para debug
      console.log(`[DEBUG] getHistoricoLiberacoesPeriodo (almoxarifado_notificacoes): periodo=${periodo}, dataInicio=${dataInicio}, resultado=${data?.length || 0}`)
      
      if (data && data.length > 0) {
        return data
      }
    } catch (error) {
      console.log('[DEBUG] Erro ao buscar de almoxarifado_notificacoes, tentando estoque_solicitacoes:', error)
    }

         // Fallback: buscar da tabela estoque_solicitacoes (que já existe)
     try {
       let query = supabase
         .from('estoque_solicitacoes')
         .select(`
           id, item_id, solicitante_id, quantidade_solicitada, prioridade, status,
           motivo_solicitacao, observacoes, criado_em, atualizado_em,
           aprovado_almoxarifado_em, entregue_em, aprovado_almoxarifado_por, entregue_por
         `)
         .in('status', ['aprovada', 'rejeitada', 'entregue'])
         .order('criado_em', { ascending: false })
         .limit(limit)

       // Se não for 'todos', aplicar filtro de data
       if (dataInicio && periodo !== 'todos') {
         query = query.gte('criado_em', dataInicio)
       }

       const { data, error } = await query
       if (error) throw error
       
       // Log para debug
       console.log(`[DEBUG] getHistoricoLiberacoesPeriodo (estoque_solicitacoes): periodo=${periodo}, dataInicio=${dataInicio}, resultado=${data?.length || 0}`)
       
       // Buscar informações complementares
       const itemIds = Array.from(new Set(data.map(item => item.item_id).filter(Boolean)))
       const userIds = Array.from(new Set([
         ...data.map(item => item.solicitante_id).filter(Boolean),
         ...data.map(item => item.aprovado_almoxarifado_por).filter(Boolean),
         ...data.map(item => item.entregue_por).filter(Boolean)
       ]))

       // Buscar dados dos itens
       let itensData: Array<{ id: string; codigo: string; nome: string; categoria: string }> = []
       if (itemIds.length > 0) {
         try {
           const result = await supabase
             .from('itens_estoque')
             .select('id, codigo, nome, categoria')
             .in('id', itemIds)
           itensData = result.data || []
         } catch (error) {
           console.log('[DEBUG] Erro ao buscar itens:', error)
         }
       }

       // Buscar dados dos usuários  
       let usuariosData: Array<{ id: string; nome: string; email: string }> = []
       if (userIds.length > 0) {
         try {
           const result = await supabase
             .from('usuarios')
             .select('id, nome, email')
             .in('id', userIds)
           usuariosData = result.data || []
         } catch (error) {
           console.log('[DEBUG] Erro ao buscar usuários:', error)
         }
       }

       const itensMap = new Map((itensData || []).map(item => [item.id, item]))
       const usuariosMap = new Map((usuariosData || []).map(user => [user.id, user]))

       // Converter para o formato esperado com dados enriquecidos
       return (data || []).map(item => {
         const itemInfo = itensMap.get(item.item_id)
         const solicitante = usuariosMap.get(item.solicitante_id)
         const responsavel = usuariosMap.get(item.aprovado_almoxarifado_por || item.entregue_por)

         let itemTitulo = 'Item não identificado'
         if (itemInfo) {
           itemTitulo = `${itemInfo.codigo || ''} - ${itemInfo.nome || 'Item'}`.trim()
           if (itemTitulo.startsWith('- ')) itemTitulo = itemTitulo.substring(2)
         } else {
           itemTitulo = `Item ${item.item_id?.substring(0, 8) || 'N/A'}`
         }

         return {
           id: item.id,
           checklist_id: item.item_id || '',
           item_id: item.item_id || '',
           usuario_id: item.solicitante_id || '',
           item_titulo: itemTitulo,
           observacoes: item.observacoes || item.motivo_solicitacao || '',
           status: item.status === 'aprovada' ? 'liberado' : item.status === 'rejeitada' ? 'rejeitado' : 'liberado',
           liberado_por: responsavel?.nome || responsavel?.email || `Usuário ${(item.aprovado_almoxarifado_por || item.entregue_por)?.substring(0, 8) || 'Sistema'}`,
          liberado_em: item.aprovado_almoxarifado_em || item.entregue_em || item.criado_em,
           motivo_liberacao: item.observacoes || item.motivo_solicitacao || '',
           criado_em: item.criado_em,
           atualizado_em: item.atualizado_em,
           // Dados extras para melhor apresentação
           solicitante_nome: solicitante?.nome || solicitante?.email || `Usuário ${item.solicitante_id?.substring(0, 8) || 'N/A'}`,
           quantidade: item.quantidade_solicitada || 0,
           categoria: itemInfo?.categoria || 'N/A',
           // Campos de rastreamento de usuários
           aprovado_almoxarifado_por: item.aprovado_almoxarifado_por || '',
           aprovado_em: item.aprovado_almoxarifado_em || '',
           entregue_por: item.entregue_por || '',
           entregue_em: item.entregue_em || '',
           // Nomes dos usuários para exibição
           aprovador_nome: usuariosMap.get(item.aprovado_almoxarifado_por)?.nome || usuariosMap.get(item.aprovado_almoxarifado_por)?.email || `Usuário ${item.aprovado_almoxarifado_por?.substring(0, 8) || 'N/A'}`,
           entregador_nome: usuariosMap.get(item.entregue_por)?.nome || usuariosMap.get(item.entregue_por)?.email || `Usuário ${item.entregue_por?.substring(0, 8) || 'N/A'}`
         }
       })
     } catch (error) {
       console.error('[DEBUG] Erro ao buscar de estoque_solicitacoes:', error)
       return []
     }
  },

  async getEstatisticas(): Promise<AlmoxarifadoStats> {
    const hoje = new Date().toISOString().split('T')[0]
    const inicioMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
      .toISOString()
      .split('T')[0]

    const [pend, libHoje, rejHoje, totalMes] = await Promise.all([
      supabase
        .from('almoxarifado_notificacoes')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pendente'),
      supabase
        .from('almoxarifado_notificacoes')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'liberado')
        .gte('liberado_em', hoje),
      supabase
        .from('almoxarifado_notificacoes')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'rejeitado')
        .gte('liberado_em', hoje),
      supabase
        .from('almoxarifado_notificacoes')
        .select('id', { count: 'exact', head: true })
        .gte('criado_em', inicioMes),
    ])

    return {
      pendentes: pend.count || 0,
      liberados_hoje: libHoje.count || 0,
      rejeitados_hoje: rejHoje.count || 0,
      total_mes: totalMes.count || 0,
    }
  },

  async getRelatorioPerformance(periodo: 'semana' | 'mes' | 'trimestre' = 'mes'): Promise<AlmoxarifadoPerformanceReport> {
    let dataInicio: string
    const hoje = new Date()
    switch (periodo) {
      case 'semana':
        dataInicio = new Date(hoje.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
        break
      case 'trimestre':
        dataInicio = new Date(hoje.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString()
        break
      default:
        dataInicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString()
    }

    const { data, error } = await supabase
      .from('almoxarifado_notificacoes')
      .select('*')
      .gte('criado_em', dataInicio)

    if (error) throw error
    const notificacoes = data || []
    const total = notificacoes.length
    const liberadas = notificacoes.filter(n => n.status === 'liberado').length
    const rejeitadas = notificacoes.filter(n => n.status === 'rejeitado').length
    const pendentes = notificacoes.filter(n => n.status === 'pendente').length

    const processadas = notificacoes.filter(n => n.liberado_em)
    const tempoMedioMs = processadas.length > 0
      ? processadas.reduce((acc, n) => {
          const criado = new Date(n.criado_em).getTime()
          const liberado = new Date(n.liberado_em as string).getTime()
          return acc + (liberado - criado)
        }, 0) / processadas.length
      : 0
    const tempoMedioHoras = tempoMedioMs / (1000 * 60 * 60)
    const taxaLiberacao = total > 0 ? (liberadas / total) * 100 : 0

    return {
      total_solicitacoes: total,
      liberadas,
      rejeitadas,
      pendentes,
      tempo_medio_resposta: Math.round(tempoMedioHoras * 100) / 100,
      taxa_liberacao: Math.round(taxaLiberacao * 100) / 100,
    }
  },

  // Método de debug para verificar dados
  async debugNotificacoes(): Promise<{ total: number; porStatus: Record<string, number>; amostra: Array<{ id: string; status: string; [key: string]: unknown }> }> {
    try {
      // Primeiro tentar a tabela almoxarifado_notificacoes
      try {
        const { count: total, error: countError } = await supabase
          .from('almoxarifado_notificacoes')
          .select('*', { count: 'exact', head: true })

        if (countError) {
          console.log('[DEBUG] Tabela almoxarifado_notificacoes não existe ou erro:', countError)
          throw new Error('Tabela não existe')
        }

        // Verificar por status
        const { data: statusData, error: statusError } = await supabase
          .from('almoxarifado_notificacoes')
          .select('status')

        if (statusError) {
          console.log('[DEBUG] Erro ao buscar status de almoxarifado_notificacoes:', statusError)
          throw new Error('Erro ao buscar status')
        }

        const porStatus = (statusData || []).reduce((acc: Record<string, number>, item: { status: string }) => {
          acc[item.status] = (acc[item.status] || 0) + 1
          return acc
        }, {})

        // Buscar amostra de dados
        const { data: amostra, error: amostraError } = await supabase
          .from('almoxarifado_notificacoes')
          .select('*')
          .limit(5)

        if (amostraError) {
          console.log('[DEBUG] Erro ao buscar amostra de almoxarifado_notificacoes:', amostraError)
        }

        console.log('[DEBUG] Debug almoxarifado_notificacoes:', { total, porStatus, amostra: amostra || [] })
        
        return {
          total: total || 0,
          porStatus,
          amostra: amostra || []
        }
      } catch {
        console.log('[DEBUG] Fallback para estoque_solicitacoes...')
      }

      // Fallback: usar estoque_solicitacoes
      const { count: total, error: countError } = await supabase
        .from('estoque_solicitacoes')
        .select('*', { count: 'exact', head: true })

      if (countError) {
        console.error('[DEBUG] Erro ao contar estoque_solicitacoes:', countError)
        return { total: 0, porStatus: {}, amostra: [] }
      }

      // Verificar por status
      const { data: statusData, error: statusError } = await supabase
        .from('estoque_solicitacoes')
        .select('status')

      if (statusError) {
        console.error('[DEBUG] Erro ao buscar status de estoque_solicitacoes:', statusError)
        return { total: total || 0, porStatus: {}, amostra: [] }
      }

      const porStatus = (statusData || []).reduce((acc: Record<string, number>, item: { status: string }) => {
        acc[item.status] = (acc[item.status] || 0) + 1
        return acc
      }, {})

      // Buscar amostra de dados
      const { data: amostra, error: amostraError } = await supabase
        .from('estoque_solicitacoes')
        .select('*')
        .limit(5)

      if (amostraError) {
        console.log('[DEBUG] Erro ao buscar amostra de estoque_solicitacoes:', amostraError)
      }

      console.log('[DEBUG] Debug estoque_solicitacoes:', { total, porStatus, amostra: amostra || [] })
      
      return {
        total: total || 0,
        porStatus,
        amostra: amostra || []
      }
    } catch (error) {
      console.error('[DEBUG] Erro geral no debug:', error)
      return { total: 0, porStatus: {}, amostra: [] }
    }
  },
}


