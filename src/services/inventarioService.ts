import { supabase } from '@/lib/supabase'
import {
  TipoItem,
  InventarioFuncionario,
  InventarioEquipe,
  ItemEquipe,
  LaudoItemEquipe
} from '@/types/almoxarifado'

export class InventarioService {

  // =============================================
  // TIPOS DE ITENS
  // =============================================

  async getTiposItens(): Promise<TipoItem[]> {
    const { data, error } = await supabase
      .from('tipos_itens')
      .select('*')
      .order('nome')

    if (error) throw error
    return data || []
  }

  async createTipoItem(tipoItem: Omit<TipoItem, 'id' | 'criado_em' | 'atualizado_em'>): Promise<TipoItem> {
    const { data, error } = await supabase
      .from('tipos_itens')
      .insert([tipoItem])
      .select()
      .single()

    if (error) throw error
    return data
  }

  async updateTipoItem(id: string, updates: Partial<TipoItem>): Promise<TipoItem> {
    const { data, error } = await supabase
      .from('tipos_itens')
      .update({ ...updates, atualizado_em: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data
  }

  async deleteTipoItem(id: string): Promise<void> {
    const { error } = await supabase
      .from('tipos_itens')
      .delete()
      .eq('id', id)

    if (error) throw error
  }

  // =============================================
  // INVENTÁRIO FUNCIONÁRIOS
  // =============================================

  async getInventarioFuncionarios(): Promise<InventarioFuncionario[]> {
    console.log('🔍 [INVENTARIO SERVICE] Buscando inventários de funcionários...')

    // Buscar com JOINs para trazer dados do funcionário e item
    // Inventário mostra apenas itens EM USO (devolvidos ficam no histórico)
    const { data, error } = await supabase
      .from('inventario_funcionario')
      .select(`
        *,
        funcionario:usuarios!inventario_funcionario_funcionario_id_fkey(id, nome, matricula),
        item_estoque:itens_estoque!item_estoque_id(nome, codigo, categoria)
      `)
      .eq('status', 'em_uso')
      .order('data_entrega', { ascending: false })

    if (error) {
      console.error('❌ [INVENTARIO SERVICE] Erro ao buscar inventários de funcionários:', error)
      throw error
    }

    console.log('✅ [INVENTARIO SERVICE] Inventários de funcionários encontrados:', data?.length || 0)

    return data || []
  }


  async createInventarioFuncionario(inventario: Omit<InventarioFuncionario, 'id' | 'criado_em' | 'atualizado_em'>): Promise<InventarioFuncionario> {
    const { data, error } = await supabase
      .from('inventario_funcionario')
      .insert([inventario])
      .select()
      .single()

    if (error) throw error
    return data
  }

  async updateInventarioFuncionario(id: string, updates: Partial<InventarioFuncionario>): Promise<InventarioFuncionario> {
    const { data, error } = await supabase
      .from('inventario_funcionario')
      .update({ ...updates, atualizado_em: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data
  }

  async deleteInventarioFuncionario(id: string): Promise<void> {
    const { error } = await supabase
      .from('inventario_funcionario')
      .delete()
      .eq('id', id)

    if (error) throw error
  }

  async getInventarioByFuncionario(funcionarioId: string): Promise<InventarioFuncionario[]> {
    console.log('🔍 [INVENTARIO SERVICE] Buscando inventário do funcionário:', funcionarioId)

    const { data, error } = await supabase
      .from('inventario_funcionario')
      .select(`
        *,
        funcionario:usuarios!inventario_funcionario_funcionario_id_fkey(id, nome, matricula),
        item_estoque:itens_estoque!item_estoque_id(nome, codigo, categoria)
      `)
      .eq('funcionario_id', funcionarioId)
      .eq('status', 'em_uso')
      .order('data_entrega', { ascending: false })

    if (error) {
      console.error('❌ [INVENTARIO SERVICE] Erro ao buscar inventário do funcionário:', error)
      throw error
    }

    console.log('✅ [INVENTARIO SERVICE] Inventário do funcionário encontrado:', data?.length || 0)
    return data || []
  }

  // =============================================
  // INVENTÁRIO EQUIPES
  // =============================================

  async getInventarioEquipes(): Promise<InventarioEquipe[]> {
    console.log('🔍 [INVENTARIO SERVICE] Buscando inventários de equipes...')

    // Inventário mostra apenas itens ATIVOS (devolvidos ficam no histórico)
    const { data, error } = await supabase
      .from('inventario_equipe')
      .select(`
        *,
        equipe:equipes(nome, status),
        item_estoque:itens_estoque(nome, codigo, categoria)
      `)
      .eq('status', 'ativo')
      .order('data_entrega', { ascending: false })

    if (error) {
      console.error('❌ [INVENTARIO SERVICE] Erro ao buscar inventários de equipes:', error)
      console.error('❌ [INVENTARIO SERVICE] Detalhes do erro:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint
      })
      throw error
    }

    console.log('✅ [INVENTARIO SERVICE] Inventários de equipes encontrados:', data?.length || 0)
    console.log('📊 [INVENTARIO SERVICE] Primeiros dados:', data?.slice(0, 2))

    return data || []
  }

  async createInventarioEquipe(inventario: Omit<InventarioEquipe, 'id' | 'criado_em' | 'atualizado_em'>): Promise<InventarioEquipe> {
    console.log('🔥 [INVENTARIO SERVICE] Tentando criar inventário de equipe:', inventario)

    // Preparar dados para inserção, removendo campos undefined
    const inventarioLimpo: Record<string, string | number | null | undefined> = {
      equipe_id: inventario.equipe_id,
      item_estoque_id: inventario.item_estoque_id,
      quantidade_total: inventario.quantidade_total,
      quantidade_disponivel: inventario.quantidade_disponivel,
      quantidade_em_uso: inventario.quantidade_em_uso,
      data_entrega: inventario.data_entrega,
      status: inventario.status,
      responsavel_equipe: inventario.responsavel_equipe,
    }

    // Adicionar campos opcionais apenas se existirem
    if (inventario.local_armazenamento) {
      inventarioLimpo.local_armazenamento = inventario.local_armazenamento
    }
    if (inventario.observacoes) {
      inventarioLimpo.observacoes = inventario.observacoes
    }
    // Adicionar campos de laudo se existirem
    if (inventario.numero_laudo) {
      inventarioLimpo.numero_laudo = inventario.numero_laudo
    }
    if (inventario.validade_laudo) {
      inventarioLimpo.validade_laudo = inventario.validade_laudo
    }

    const { data, error } = await supabase
      .from('inventario_equipe')
      .insert([inventarioLimpo])
      .select()
      .single()

    if (error) {
      console.error('❌ [INVENTARIO SERVICE] Erro ao criar inventário de equipe:', error)
      console.error('❌ [INVENTARIO SERVICE] Detalhes do erro:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint
      })

      // Se o erro for sobre campos que não existem, informar sobre o script SQL
      if (error.message?.includes('numero_laudo') || error.message?.includes('validade_laudo')) {
        throw new Error(
          'As colunas numero_laudo e validade_laudo não existem na tabela inventario_equipe. ' +
          'Execute o script SQL: ADICIONAR_COLUNAS_LAUDO_INVENTARIO_EQUIPE.sql'
        )
      }

      throw error
    }

    console.log('✅ [INVENTARIO SERVICE] Inventário de equipe criado com sucesso:', data)
    return data
  }

  async updateInventarioEquipe(id: string, updates: Partial<InventarioEquipe>): Promise<InventarioEquipe> {
    const { data, error } = await supabase
      .from('inventario_equipe')
      .update({ ...updates, atualizado_em: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data
  }

  async deleteInventarioEquipe(id: string): Promise<void> {
    const { error } = await supabase
      .from('inventario_equipe')
      .delete()
      .eq('id', id)

    if (error) throw error
  }

  async getInventarioByEquipe(equipeId: string): Promise<InventarioEquipe[]> {
    console.log('🔍 [INVENTARIO SERVICE] Buscando inventário da equipe:', equipeId)

    // Inventário mostra apenas itens ATIVOS (devolvidos ficam no histórico)
    const { data, error } = await supabase
      .from('inventario_equipe')
      .select(`
        *,
        equipe:equipes(nome, status),
        item_estoque:itens_estoque(nome, codigo, categoria)
      `)
      .eq('equipe_id', equipeId)
      .eq('status', 'ativo')
      .order('data_entrega', { ascending: false })

    if (error) {
      console.error('❌ [INVENTARIO SERVICE] Erro ao buscar inventário da equipe:', error)
      throw error
    }

    console.log('✅ [INVENTARIO SERVICE] Inventário da equipe encontrado:', data?.length || 0)
    console.log('📋 [INVENTARIO SERVICE] Primeiros registros:', data?.slice(0, 3))
    return data || []
  }

  // =============================================
  // ESTATÍSTICAS
  // =============================================

  async getStats(contratoIds?: string[]): Promise<{
    equipes_total: number
    equipes_atualizadas: number
    funcionarios_total: number
    funcionarios_atualizados: number
    itens_distribuidos: number
    laudos_vencendo: number
  }> {
    try {
      // Buscar inventários de funcionários (sem JOIN para evitar erros)
      const { data: funcionariosData, error: funcionariosError } = await supabase
        .from('inventario_funcionario')
        .select('id, status, funcionario_id')

      if (funcionariosError) {
        console.error('Erro ao buscar estatísticas de funcionários:', funcionariosError)
        // Não lançar erro, apenas retornar valores zerados
        return {
          equipes_total: 0,
          equipes_atualizadas: 0,
          funcionarios_total: 0,
          funcionarios_atualizados: 0,
          itens_distribuidos: 0,
          laudos_vencendo: 0
        }
      }

      // Buscar inventários de equipes (sem JOIN para evitar erros)
      const { data: equipesData, error: equipesError } = await supabase
        .from('inventario_equipe')
        .select('id, status, equipe_id')

      if (equipesError) {
        console.error('Erro ao buscar estatísticas de equipes:', equipesError)
        // Não lançar erro, apenas retornar valores zerados
        return {
          equipes_total: 0,
          equipes_atualizadas: 0,
          funcionarios_total: 0,
          funcionarios_atualizados: 0,
          itens_distribuidos: 0,
          laudos_vencendo: 0
        }
      }

      let funcionarios = funcionariosData || []
      let equipes = equipesData || []

      // Se houver filtro por contratos, buscar informações dos funcionários e equipes separadamente
      if (contratoIds && contratoIds.length > 0) {
        // Buscar funcionários dos inventários
        const funcionarioIds = [...new Set(funcionarios.map(inv => inv.funcionario_id))]
        if (funcionarioIds.length > 0) {
          const { data: usuariosData } = await supabase
            .from('usuarios')
            .select('id, contrato_origem_id')
            .in('id', funcionarioIds)

          const funcionariosPermitidos = usuariosData?.filter(u =>
            u.contrato_origem_id && contratoIds.includes(u.contrato_origem_id)
          ).map(u => u.id) || []

          funcionarios = funcionarios.filter(inv => funcionariosPermitidos.includes(inv.funcionario_id))
        }

        // Buscar equipes dos inventários
        const equipeIds = [...new Set(equipes.map(inv => inv.equipe_id))]
        if (equipeIds.length > 0) {
          const { data: equipesData } = await supabase
            .from('equipes')
            .select('id, contrato_id')
            .in('id', equipeIds)

          const equipesPermitidas = equipesData?.filter(e =>
            e.contrato_id && contratoIds.includes(e.contrato_id)
          ).map(e => e.id) || []

          equipes = equipes.filter(inv => equipesPermitidas.includes(inv.equipe_id))
        }
      }

      // Contar itens distribuídos (status em_uso ou ativo)
      const itensDistribuidos = funcionarios.filter(inv => inv.status === 'em_uso').length +
        equipes.filter(inv => inv.status === 'ativo').length

      // Contar laudos vencendo (próximos 30 dias)
      const { data: laudosData } = await supabase
        .from('inventario_funcionario')
        .select('validade_laudo')
        .not('validade_laudo', 'is', null)

      const { data: laudosEquipesData } = await supabase
        .from('inventario_equipe')
        .select('validade_laudo')
        .not('validade_laudo', 'is', null)

      const hoje = new Date()
      const proximos30Dias = new Date(hoje.getTime() + 30 * 24 * 60 * 60 * 1000)

      const laudosVencendo = [
        ...(laudosData || []),
        ...(laudosEquipesData || [])
      ].filter(item => {
        if (!item.validade_laudo) return false
        try {
          const validade = new Date(item.validade_laudo)
          return validade >= hoje && validade <= proximos30Dias
        } catch {
          return false
        }
      }).length

      return {
        equipes_total: equipes.length,
        equipes_atualizadas: equipes.filter(inv => inv.status === 'ativo').length,
        funcionarios_total: funcionarios.length,
        funcionarios_atualizados: funcionarios.filter(inv => inv.status === 'em_uso' || inv.status === 'finalizado').length,
        itens_distribuidos: itensDistribuidos,
        laudos_vencendo: laudosVencendo
      }
    } catch (error) {
      console.error('Erro ao buscar estatísticas:', error)
      return {
        equipes_total: 0,
        equipes_atualizadas: 0,
        funcionarios_total: 0,
        funcionarios_atualizados: 0,
        itens_distribuidos: 0,
        laudos_vencendo: 0
      }
    }
  }

  // =============================================
  // ITENS DA EQUIPE (COM LAUDOS)
  // =============================================

  async getItensEquipe(): Promise<ItemEquipe[]> {
    const { data, error } = await supabase
      .from('itens_equipe')
      .select(`
        *,
        equipe:equipes(nome, status, local),
        tipo_item:tipos_itens(*),
        responsavel_atual_info:usuarios!responsavel_atual(nome)
      `)
      .order('criado_em', { ascending: false })

    if (error) throw error
    return data || []
  }

  async createItemEquipe(item: Omit<ItemEquipe, 'id' | 'criado_em' | 'atualizado_em'>): Promise<ItemEquipe> {
    // Generate unique code when item is issued to team
    if (!item.codigo_patrimonio) {
      const uniqueCode = await this.generateUniqueItemCode(item.tipo_item_id)
      item.codigo_patrimonio = uniqueCode
    }

    const { data, error } = await supabase
      .from('itens_equipe')
      .insert([item])
      .select()
      .single()

    if (error) throw error
    return data
  }

  async updateItemEquipe(id: string, updates: Partial<ItemEquipe>): Promise<ItemEquipe> {
    const { data, error } = await supabase
      .from('itens_equipe')
      .update({ ...updates, atualizado_em: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data
  }

  async deleteItemEquipe(id: string): Promise<void> {
    const { error } = await supabase
      .from('itens_equipe')
      .delete()
      .eq('id', id)

    if (error) throw error
  }

  // =============================================
  // LAUDOS TÉCNICOS
  // =============================================

  async getLaudosForItem(itemId: string): Promise<LaudoItemEquipe[]> {
    const { data, error } = await supabase
      .from('laudos_itens_equipe')
      .select('*')
      .eq('item_equipe_id', itemId)
      .order('data_vencimento', { ascending: true })

    if (error) throw error
    return data || []
  }

  /**
   * Busca todos os laudos vencendo (próximos 30 dias) do inventário
   * Inclui laudos de funcionários, equipes e itens específicos da equipe
   */
  async getLaudosVencendo(contratoIds?: string[]): Promise<Array<{
    id: string
    tipo: 'funcionario' | 'equipe' | 'item_equipe'
    item_nome?: string
    item_codigo?: string
    funcionario_nome?: string
    funcionario_matricula?: string
    funcionario_contrato?: string
    equipe_nome?: string
    equipe_contrato?: string
    numero_laudo?: string
    validade_laudo: string
    data_vencimento?: string
    status: 'vencido' | 'vencendo' | 'em_dia'
    dias_restantes: number
    categoria?: string
  }>> {
    try {
      const hoje = new Date()
      hoje.setHours(0, 0, 0, 0)

      const laudos: Array<{
        id: string
        tipo: 'funcionario' | 'equipe' | 'item_equipe'
        item_nome?: string
        item_codigo?: string
        funcionario_nome?: string
        funcionario_matricula?: string
        funcionario_contrato?: string
        funcionario_id?: string
        equipe_nome?: string
        equipe_contrato?: string
        equipe_id?: string
        numero_laudo?: string
        validade_laudo: string
        data_vencimento?: string
        status: 'vencido' | 'vencendo' | 'em_dia'
        dias_restantes: number
        categoria?: string
      }> = []

      // Limite de IDs para usar filtro .in() na URL (para evitar URLs muito longas que causam erro 413)
      const MAX_IDS_FOR_IN_FILTER = 100

      // Buscar laudos de inventário de funcionários (todos os laudos, não apenas vencendo)
      let funcionarioIdsPermitidos: string[] | null = null

      if (contratoIds && contratoIds.length > 0) {
        // Buscar funcionários dos contratos permitidos
        const { data: funcionariosPermitidos } = await supabase
          .from('usuarios')
          .select('id')
          .in('contrato_origem_id', contratoIds)

        if (funcionariosPermitidos && funcionariosPermitidos.length > 0) {
          funcionarioIdsPermitidos = funcionariosPermitidos.map(f => f.id)
        } else {
          // Se não há funcionários permitidos, retornar array vazio
          return []
        }
      }

      // Se há muitos IDs, buscar todos e filtrar em memória para evitar URL muito longa
      let queryFuncionarios = supabase
        .from('inventario_funcionario')
        .select(`
          id,
          numero_laudo,
          validade_laudo,
          funcionario_id,
          funcionario:usuarios!inventario_funcionario_funcionario_id_fkey(
            id,
            nome,
            matricula,
            contrato_origem:contratos!contrato_origem_id(id, nome)
          ),
          item_estoque:itens_estoque!item_estoque_id(nome, codigo, categoria)
        `)
        .not('validade_laudo', 'is', null)

      if (funcionarioIdsPermitidos) {
        if (funcionarioIdsPermitidos.length <= MAX_IDS_FOR_IN_FILTER) {
          // Usar filtro .in() se houver poucos IDs
          queryFuncionarios = queryFuncionarios.in('funcionario_id', funcionarioIdsPermitidos)
        }
        // Se houver muitos IDs, não aplicar o filtro aqui - vamos filtrar em memória depois
      }

      const { data: laudosFuncionarios, error: errorFuncionarios } = await queryFuncionarios

      if (errorFuncionarios) {
        console.error('Erro ao buscar laudos de funcionários:', errorFuncionarios)
      } else if (laudosFuncionarios) {
        // Filtrar em memória se necessário (quando há muitos IDs)
        let laudosFuncionariosFiltrados = laudosFuncionarios
        if (funcionarioIdsPermitidos && funcionarioIdsPermitidos.length > MAX_IDS_FOR_IN_FILTER) {
          const funcionarioIdsSet = new Set(funcionarioIdsPermitidos)
          laudosFuncionariosFiltrados = laudosFuncionarios.filter(l =>
            funcionarioIdsSet.has(l.funcionario_id)
          )
        }

        for (const laudo of laudosFuncionariosFiltrados) {
          if (!laudo.validade_laudo) continue

          const validade = new Date(laudo.validade_laudo)
          validade.setHours(0, 0, 0, 0)
          const diasRestantes = Math.ceil((validade.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24))

          // Determinar status: vencido, vencendo (próximos 30 dias), ou em_dia
          let status: 'vencido' | 'vencendo' | 'em_dia'
          if (diasRestantes < 0) {
            status = 'vencido'
          } else if (diasRestantes <= 30) {
            status = 'vencendo'
          } else {
            status = 'em_dia'
          }

          const funcionario = laudo.funcionario as { id?: string; nome?: string; matricula?: string; contrato_origem?: { id?: string; nome?: string } } | null
          const itemEstoque = laudo.item_estoque as { nome?: string; codigo?: string; categoria?: string } | null
          
          laudos.push({
            id: laudo.id,
            tipo: 'funcionario' as const,
            item_nome: itemEstoque?.nome,
            item_codigo: itemEstoque?.codigo,
            funcionario_nome: funcionario?.nome,
            funcionario_matricula: funcionario?.matricula,
            funcionario_contrato: funcionario?.contrato_origem?.nome,
            funcionario_id: laudo.funcionario_id,
            numero_laudo: laudo.numero_laudo,
            validade_laudo: laudo.validade_laudo,
            status,
            dias_restantes: diasRestantes,
            categoria: itemEstoque?.categoria
          })
        }
      }

      // Buscar laudos de inventário de equipes (todos os laudos, não apenas vencendo)
      let equipeIdsPermitidos: string[] | null = null

      if (contratoIds && contratoIds.length > 0) {
        // Buscar equipes dos contratos permitidos
        const { data: equipesPermitidas } = await supabase
          .from('equipes')
          .select('id')
          .in('contrato_id', contratoIds)

        if (equipesPermitidas && equipesPermitidas.length > 0) {
          equipeIdsPermitidos = equipesPermitidas.map(e => e.id)
        }
      }

      // Se há muitos IDs, buscar todos e filtrar em memória para evitar URL muito longa
      let queryEquipes = supabase
        .from('inventario_equipe')
        .select(`
          id,
          numero_laudo,
          validade_laudo,
          equipe_id,
          item_estoque:itens_estoque(nome, codigo, categoria),
          equipe:equipes(
            nome,
            contrato:contratos!contrato_id(id, nome)
          )
        `)
        .not('validade_laudo', 'is', null)

      if (equipeIdsPermitidos) {
        if (equipeIdsPermitidos.length <= MAX_IDS_FOR_IN_FILTER) {
          // Usar filtro .in() se houver poucos IDs
          queryEquipes = queryEquipes.in('equipe_id', equipeIdsPermitidos)
        }
        // Se houver muitos IDs, não aplicar o filtro aqui - vamos filtrar em memória depois
      }

      const { data: laudosEquipes, error: errorEquipes } = await queryEquipes

      if (errorEquipes) {
        console.error('Erro ao buscar laudos de equipes:', errorEquipes)
      } else if (laudosEquipes) {
        // Filtrar em memória se necessário (quando há muitos IDs)
        let laudosEquipesFiltrados = laudosEquipes
        if (equipeIdsPermitidos && equipeIdsPermitidos.length > MAX_IDS_FOR_IN_FILTER) {
          const equipeIdsSet = new Set(equipeIdsPermitidos)
          laudosEquipesFiltrados = laudosEquipes.filter(l =>
            equipeIdsSet.has(l.equipe_id)
          )
        }

        for (const laudo of laudosEquipesFiltrados) {
          if (!laudo.validade_laudo) continue

          const validade = new Date(laudo.validade_laudo)
          validade.setHours(0, 0, 0, 0)
          const diasRestantes = Math.ceil((validade.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24))

          // Determinar status: vencido, vencendo (próximos 30 dias), ou em_dia
          let status: 'vencido' | 'vencendo' | 'em_dia'
          if (diasRestantes < 0) {
            status = 'vencido'
          } else if (diasRestantes <= 30) {
            status = 'vencendo'
          } else {
            status = 'em_dia'
          }

          const itemEstoque = laudo.item_estoque as { nome?: string; codigo?: string; categoria?: string } | null
          const equipe = laudo.equipe as { nome?: string; contrato?: { id?: string; nome?: string } } | null
          
          laudos.push({
            id: laudo.id,
            tipo: 'equipe' as const,
            item_nome: itemEstoque?.nome,
            item_codigo: itemEstoque?.codigo,
            equipe_nome: equipe?.nome,
            equipe_contrato: equipe?.contrato?.nome,
            equipe_id: laudo.equipe_id,
            numero_laudo: laudo.numero_laudo,
            validade_laudo: laudo.validade_laudo,
            status,
            dias_restantes: diasRestantes,
            categoria: itemEstoque?.categoria
          })
        }
      }

      // Buscar laudos de itens específicos da equipe (laudos_itens_equipe)
      try {
        // Primeiro, buscar os IDs dos itens_equipe permitidos (se houver filtro de contratos)
        let itemEquipeIdsPermitidos: string[] | null = null
        let deveBuscarLaudos = true

        if (contratoIds && contratoIds.length > 0) {
          // Filtrar por contratos através das equipes
          const { data: equipesPermitidas, error: errorEquipesPermitidas } = await supabase
            .from('equipes')
            .select('id')
            .in('contrato_id', contratoIds)

          if (errorEquipesPermitidas) {
            console.error('Erro ao buscar equipes permitidas:', errorEquipesPermitidas)
            deveBuscarLaudos = false
          } else if (equipesPermitidas && equipesPermitidas.length > 0) {
            const equipeIds = equipesPermitidas.map(e => e.id)

            // Se há muitos IDs, buscar todos e filtrar em memória para evitar URL muito longa
            let queryItensEquipePermitidos = supabase
              .from('itens_equipe')
              .select('id, equipe_id')

            if (equipeIds.length <= MAX_IDS_FOR_IN_FILTER) {
              // Usar filtro .in() se houver poucos IDs
              queryItensEquipePermitidos = queryItensEquipePermitidos.in('equipe_id', equipeIds)
            }
            // Se houver muitos IDs, não aplicar o filtro aqui - vamos filtrar em memória depois

            const { data: itensEquipePermitidos, error: errorItensEquipePermitidos } = await queryItensEquipePermitidos

            if (errorItensEquipePermitidos) {
              console.error('Erro ao buscar itens de equipe permitidos:', errorItensEquipePermitidos)
              deveBuscarLaudos = false
            } else if (itensEquipePermitidos && itensEquipePermitidos.length > 0) {
              // Filtrar em memória se necessário (quando há muitos IDs)
              let itensEquipeFiltrados = itensEquipePermitidos
              if (equipeIds.length > MAX_IDS_FOR_IN_FILTER) {
                const equipeIdsSet = new Set(equipeIds)
                itensEquipeFiltrados = itensEquipePermitidos.filter(i =>
                  equipeIdsSet.has(i.equipe_id)
                )
              }

              itemEquipeIdsPermitidos = itensEquipeFiltrados.map(i => i.id)
            } else {
              // Se não há itens permitidos, pular esta parte
              itemEquipeIdsPermitidos = []
              deveBuscarLaudos = false
            }
          } else {
            // Se não há equipes permitidas, pular esta parte
            itemEquipeIdsPermitidos = []
            deveBuscarLaudos = false
          }
        }

        // Se há filtro de contratos e não há itens permitidos, pular
        if (itemEquipeIdsPermitidos !== null && itemEquipeIdsPermitidos.length === 0) {
          deveBuscarLaudos = false
        }

        if (deveBuscarLaudos) {
          // Construir query simplificada
          let queryItensEquipe = supabase
            .from('laudos_itens_equipe')
            .select(`
              id,
              numero_laudo,
              data_vencimento,
              item_equipe_id
            `)
            .not('data_vencimento', 'is', null)

          // Aplicar filtro de itens permitidos se houver
          // Se há muitos IDs, buscar todos e filtrar em memória para evitar URL muito longa
          if (itemEquipeIdsPermitidos && itemEquipeIdsPermitidos.length > 0) {
            if (itemEquipeIdsPermitidos.length <= MAX_IDS_FOR_IN_FILTER) {
              // Usar filtro .in() se houver poucos IDs
              queryItensEquipe = queryItensEquipe.in('item_equipe_id', itemEquipeIdsPermitidos)
            }
            // Se houver muitos IDs, não aplicar o filtro aqui - vamos filtrar em memória depois
          }

          let laudosItensEquipe: Array<{
            id: string
            numero_laudo?: string
            data_vencimento: string
            item_equipe_id: string
          }> | null = null
          let errorItensEquipe: (Error & { details?: string; hint?: string; code?: string }) | { message: string; details?: string; hint?: string; code?: string } | null = null

          try {
            const result = await queryItensEquipe
            laudosItensEquipe = result.data
            errorItensEquipe = result.error
          } catch (networkError) {
            console.error('Erro de rede ao buscar laudos de itens da equipe:', networkError)
            errorItensEquipe = networkError instanceof Error ? networkError : { message: String(networkError) }
          }

          if (errorItensEquipe) {
            // Verificar se o erro tem propriedades antes de logar
            const hasProperties = errorItensEquipe && Object.keys(errorItensEquipe).length > 0
            console.error('Erro ao buscar laudos de itens da equipe:', {
              hasProperties,
              message: errorItensEquipe?.message,
              details: errorItensEquipe?.details,
              hint: errorItensEquipe?.hint,
              code: errorItensEquipe?.code,
              fullError: errorItensEquipe,
              errorType: typeof errorItensEquipe,
              errorString: String(errorItensEquipe)
            })
            // Continuar mesmo com erro, não quebrar o fluxo
          } else if (laudosItensEquipe && laudosItensEquipe.length > 0) {
            // Filtrar em memória se necessário (quando há muitos IDs)
            let laudosItensEquipeFiltrados = laudosItensEquipe
            if (itemEquipeIdsPermitidos && itemEquipeIdsPermitidos.length > MAX_IDS_FOR_IN_FILTER) {
              const itemEquipeIdsSet = new Set(itemEquipeIdsPermitidos)
              laudosItensEquipeFiltrados = laudosItensEquipe.filter(l =>
                itemEquipeIdsSet.has(l.item_equipe_id)
              )
            }

            // Buscar informações dos itens_equipe em lote
            const itemEquipeIds = [...new Set(laudosItensEquipeFiltrados.map(l => l.item_equipe_id))]

            const { data: itensEquipeData, error: errorItensEquipeData } = await supabase
              .from('itens_equipe')
              .select(`
                id,
                codigo_patrimonio,
                tipo_item_id,
                equipe_id
              `)
              .in('id', itemEquipeIds)

            if (errorItensEquipeData) {
              console.error('Erro ao buscar dados dos itens da equipe:', errorItensEquipeData)
            } else {
              // Buscar informações dos tipos de itens
              const tipoItemIds = [...new Set((itensEquipeData || []).map(i => i.tipo_item_id).filter(Boolean))]
              let tiposItensMap = new Map<string, { nome?: string; codigo?: string; categoria?: string }>()

              if (tipoItemIds.length > 0) {
                const { data: tiposItensData } = await supabase
                  .from('tipos_itens')
                  .select('id, nome, codigo, categoria')
                  .in('id', tipoItemIds)

                if (tiposItensData) {
                  tiposItensMap = new Map(tiposItensData.map(t => [t.id, t]))
                }
              }

              // Buscar informações das equipes
              const equipeIds = [...new Set((itensEquipeData || []).map(i => i.equipe_id).filter(Boolean))]
              let equipesMap = new Map<string, { nome?: string }>()

              if (equipeIds.length > 0) {
                const { data: equipesData } = await supabase
                  .from('equipes')
                  .select('id, nome')
                  .in('id', equipeIds)

                if (equipesData) {
                  equipesMap = new Map(equipesData.map(e => [e.id, e]))
                }
              }

              // Criar mapa de itens_equipe
              const itensEquipeMap = new Map(
                (itensEquipeData || []).map(item => [item.id, item])
              )

              // Processar laudos
              for (const laudo of laudosItensEquipeFiltrados) {
                if (!laudo.data_vencimento) continue

                const validade = new Date(laudo.data_vencimento)
                validade.setHours(0, 0, 0, 0)
                const diasRestantes = Math.ceil((validade.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24))

                // Determinar status: vencido, vencendo (próximos 30 dias), ou em_dia
                let status: 'vencido' | 'vencendo' | 'em_dia'
                if (diasRestantes < 0) {
                  status = 'vencido'
                } else if (diasRestantes <= 30) {
                  status = 'vencendo'
                } else {
                  status = 'em_dia'
                }

                const itemEquipe = itensEquipeMap.get(laudo.item_equipe_id)
                const tipoItem = itemEquipe?.tipo_item_id ? tiposItensMap.get(itemEquipe.tipo_item_id) : null
                const equipe = itemEquipe?.equipe_id ? equipesMap.get(itemEquipe.equipe_id) : null

                laudos.push({
                  id: laudo.id,
                  tipo: 'item_equipe',
                  item_nome: tipoItem?.nome,
                  item_codigo: itemEquipe?.codigo_patrimonio || tipoItem?.codigo,
                  equipe_nome: equipe?.nome,
                  numero_laudo: laudo.numero_laudo,
                  validade_laudo: laudo.data_vencimento,
                  data_vencimento: laudo.data_vencimento,
                  status,
                  dias_restantes: diasRestantes,
                  categoria: tipoItem?.categoria
                })
              }
            }
          }
        }
      } catch (error) {
        console.error('Erro ao processar laudos de itens da equipe:', {
          error,
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          type: typeof error,
          stringified: JSON.stringify(error, Object.getOwnPropertyNames(error))
        })
        // Continuar mesmo com erro, não quebrar o fluxo
      }

      // Ordenar por status (vencidos primeiro, depois vencendo, depois em dia) e depois por dias restantes
      laudos.sort((a, b) => {
        const statusOrder = { vencido: 0, vencendo: 1, em_dia: 2 }
        const statusDiff = statusOrder[a.status] - statusOrder[b.status]
        if (statusDiff !== 0) return statusDiff
        return a.dias_restantes - b.dias_restantes
      })

      return laudos
    } catch (error) {
      console.error('Erro ao buscar laudos vencendo:', error)
      return []
    }
  }

  async createLaudo(laudo: Omit<LaudoItemEquipe, 'id' | 'criado_em' | 'atualizado_em'>): Promise<LaudoItemEquipe> {
    const { data, error } = await supabase
      .from('laudos_itens_equipe')
      .insert([laudo])
      .select()
      .single()

    if (error) throw error
    return data
  }

  async updateLaudo(id: string, updates: Partial<LaudoItemEquipe>): Promise<LaudoItemEquipe> {
    const { data, error } = await supabase
      .from('laudos_itens_equipe')
      .update({ ...updates, atualizado_em: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data
  }

  async deleteLaudo(id: string): Promise<void> {
    const { error } = await supabase
      .from('laudos_itens_equipe')
      .delete()
      .eq('id', id)

    if (error) throw error
  }

  // =============================================
  // FUNÇÕES ESPECIAIS
  // =============================================

  /**
   * Gera um código único para itens quando são alocados para equipes
   * Formato: TIPO-YYYYMMDD-XXXX (onde XXXX é um número sequencial)
   */
  async generateUniqueItemCode(tipoItemId: string): Promise<string> {
    // Get item type info
    const { data: tipoItem, error: tipoError } = await supabase
      .from('tipos_itens')
      .select('codigo, categoria')
      .eq('id', tipoItemId)
      .single()

    if (tipoError) throw tipoError

    // Get current date
    const today = new Date()
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '')

    // Get count of items created today for this type
    const { count, error: countError } = await supabase
      .from('itens_equipe')
      .select('*', { count: 'exact', head: true })
      .eq('tipo_item_id', tipoItemId)
      .gte('criado_em', today.toISOString().slice(0, 10))

    if (countError) throw countError

    const sequence = (count || 0) + 1
    const sequenceStr = sequence.toString().padStart(4, '0')

    return `${tipoItem.codigo}-${dateStr}-${sequenceStr}`
  }

  /**
   * Busca itens disponíveis para solicitação de EPI
   * Inclui veículos e outros itens do inventário
   */
  async getItensDisponiveisEPI(): Promise<Array<TipoItem & { quantidade_disponivel: number }>> {
    // Get all item types
    const tiposItens = await this.getTiposItens()

    // Get available quantities from team inventory
    const { data: inventarioEquipes, error } = await supabase
      .from('inventario_equipe')
      .select('tipo_item_id, quantidade_disponivel')
      .eq('status', 'ativo')

    if (error) throw error

    // Calculate available quantities for each item type
    const itensComQuantidade = tiposItens.map(tipo => {
      const quantidadeDisponivel = inventarioEquipes
        ?.filter(inv => inv.tipo_item_id === tipo.id)
        ?.reduce((sum, inv) => sum + (inv.quantidade_disponivel || 0), 0) || 0

      return {
        ...tipo,
        quantidade_disponivel: quantidadeDisponivel
      }
    })

    return itensComQuantidade
  }

  /**
   * Atualiza quantidades quando itens são solicitados via EPI
   */
  async atualizarQuantidadeEPI(tipoItemId: string, quantidade: number): Promise<void> {
    // Find team inventory items for this type
    const { data: inventarios, error } = await supabase
      .from('inventario_equipe')
      .select('id, quantidade_disponivel')
      .eq('tipo_item_id', tipoItemId)
      .eq('status', 'ativo')
      .order('quantidade_disponivel', { ascending: false })

    if (error) throw error

    // Update quantities starting from the inventory with most available
    let remainingQuantity = quantidade

    for (const inventario of inventarios || []) {
      if (remainingQuantity <= 0) break

      const quantidadeParaReduzir = Math.min(remainingQuantity, inventario.quantidade_disponivel)
      const novaQuantidadeDisponivel = inventario.quantidade_disponivel - quantidadeParaReduzir

      await supabase
        .from('inventario_equipe')
        .update({
          quantidade_disponivel: novaQuantidadeDisponivel,
          quantidade_em_uso: inventario.quantidade_disponivel - novaQuantidadeDisponivel + (inventario.quantidade_disponivel - novaQuantidadeDisponivel)
        })
        .eq('id', inventario.id)

      remainingQuantity -= quantidadeParaReduzir
    }

    if (remainingQuantity > 0) {
      throw new Error(`Quantidade insuficiente disponível para o item ${tipoItemId}`)
    }
  }
}

export const inventarioService = new InventarioService()
