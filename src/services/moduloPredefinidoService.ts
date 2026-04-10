import { supabase } from '@/lib/supabase'
import type {
  ModuloPredefinidoCargo,
  ModuloPredefinidoItem,
  FormModuloPredefinidoCargo,
  FormModuloPredefinidoItemComGrupo,
  FiltrosModulosPredefinidos,
  FiltrosGruposEntrega,
  GrupoEntregaNovoFuncionario,
  FormGrupoEntregaNovoFuncionario,
  ItemEstoque,
  User
} from '@/types'

export const moduloPredefinidoService = {
  // ============================================================================
  // MÓDULOS PRÉ-DEFINIDOS POR CARGO
  // ============================================================================

  async getModulosPredefinidos(filtros?: FiltrosModulosPredefinidos): Promise<ModuloPredefinidoCargo[]> {
    console.log('🔄 [SERVICE] Carregando módulos pré-definidos...', filtros)
    let query = supabase
      .from('view_modulos_predefinidos_completo')
      .select('*')
      .order('nome_modulo', { ascending: true })

    if (filtros?.contrato_id) {
      query = query.eq('contrato_id', filtros.contrato_id)
    }

    if (filtros?.cargo_id) {
      query = query.eq('cargo_id', filtros.cargo_id)
    }

    if (filtros?.ativo !== undefined) {
      query = query.eq('modulo_ativo', filtros.ativo)
    }

    if (filtros?.nome_modulo) {
      query = query.ilike('nome_modulo', `%${filtros.nome_modulo}%`)
    }

    const { data: modulos, error } = await query

    if (error) {
      console.error('❌ [SERVICE] Erro ao carregar módulos:', error)
      throw error
    }
    
    console.log('✅ [SERVICE] Módulos carregados:', modulos?.length || 0)
    
    // Carregar itens para cada módulo
    if (modulos && modulos.length > 0) {
      const modulosComItens = await Promise.all(
        modulos.map(async (modulo) => {
          // Usar modulo_id se disponível, senão usar id (compatibilidade com versões antigas)
          const moduloId = modulo.modulo_id || modulo.id
          
          if (!moduloId || moduloId === 'undefined') {
            console.warn('⚠️ [SERVICE] Módulo com ID inválido:', { modulo_id: modulo.modulo_id, id: modulo.id })
            return { ...modulo, itens: [] }
          }

          const { data: itens, error: itensError } = await supabase
            .from('modulos_predefinidos_itens')
            .select(`
              *,
              item_estoque:itens_estoque(
          *,
          base:bases(*)
        ),
              item_catalogo:itens_catalogo(*),
              grupo_item:grupos_itens(*),
              variacao_item:varicoes_itens(*)
            `)
            .eq('modulo_id', moduloId)
            .order('ordem', { ascending: true })

          if (itensError) {
            console.error('❌ [SERVICE] Erro ao carregar itens do módulo:', moduloId, itensError)
            return { ...modulo, itens: [] }
          }

          // Mapear campos da view para a interface esperada
          return { 
            ...modulo, 
            ativo: modulo.modulo_ativo, // Mapear modulo_ativo para ativo
            itens: itens || [] 
          }
        })
      )
      
      console.log('📦 [SERVICE] Módulos com itens carregados:', modulosComItens.length)
      return modulosComItens
    }
    
    return (modulos || []).map(modulo => ({
      ...modulo,
      ativo: modulo.modulo_ativo // Mapear modulo_ativo para ativo
    }))
  },

  async getModuloPredefinido(id: string): Promise<ModuloPredefinidoCargo | null> {
    if (!id || id === 'undefined') {
      console.warn('⚠️ [SERVICE] ID inválido para buscar módulo:', id)
      return null
    }

    const { data, error } = await supabase
      .from('modulos_predefinidos_cargo')
      .select(`
        *,
        contrato:contratos(id, nome, codigo),
        cargo:cargos(id, nome),
        criado_por_info:usuarios!modulos_predefinidos_cargo_criado_por_fkey(id, nome),
        itens:modulos_predefinidos_itens(
          *,
          item_estoque:itens_estoque(
          *,
          base:bases(*)
        ),
        item_catalogo:itens_catalogo(*),
        grupo_item:grupos_itens(*),
        variacao_item:varicoes_itens(*)
        )
      `)
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null
      throw error
    }

    return data
  },

  async criarModuloPredefinido(
    dados: FormModuloPredefinidoCargo,
    criadoPor: string
  ): Promise<ModuloPredefinidoCargo> {
    const { data, error } = await supabase
      .from('modulos_predefinidos_cargo')
      .insert({
        ...dados,
        criado_por: criadoPor,
        ativo: dados.ativo ?? true
      })
      .select(`
        *,
        contrato:contratos(id, nome, codigo),
        cargo:cargos(id, nome),
        criado_por_info:usuarios!modulos_predefinidos_cargo_criado_por_fkey(id, nome)
      `)
      .single()

    if (error) throw error
    return data
  },

  async atualizarModuloPredefinido(
    id: string,
    dados: Partial<FormModuloPredefinidoCargo>
  ): Promise<ModuloPredefinidoCargo> {
    if (!id || id === 'undefined') {
      throw new Error('ID do módulo é obrigatório para atualização')
    }

    const { data, error } = await supabase
      .from('modulos_predefinidos_cargo')
      .update({
        ...dados,
        atualizado_em: new Date().toISOString()
      })
      .eq('id', id)
      .select(`
        *,
        contrato:contratos(id, nome, codigo),
        cargo:cargos(id, nome),
        criado_por_info:usuarios!modulos_predefinidos_cargo_criado_por_fkey(id, nome)
      `)
      .single()

    if (error) throw error
    return data
  },

  async excluirModuloPredefinido(id: string): Promise<void> {
    if (!id || id === 'undefined') {
      throw new Error('ID do módulo é obrigatório para exclusão')
    }

    const { error } = await supabase
      .from('modulos_predefinidos_cargo')
      .delete()
      .eq('id', id)

    if (error) throw error
  },

  // ============================================================================
  // ITENS DOS MÓDULOS PRÉ-DEFINIDOS
  // ============================================================================

  async getItensModulo(moduloId: string): Promise<ModuloPredefinidoItem[]> {
    if (!moduloId || moduloId === 'undefined') {
      console.warn('⚠️ [SERVICE] moduloId inválido:', moduloId)
      return []
    }

    const { data, error } = await supabase
      .from('modulos_predefinidos_itens')
      .select(`
        *,
        item_estoque:itens_estoque(
          *,
          base:bases(*)
        ),
        item_catalogo:itens_catalogo(*),
        grupo_item:grupos_itens(
          *,
          variacoes:varicoes_itens(
            *,
            item_catalogo:itens_catalogo(*)
          )
        ),
        variacao_item:varicoes_itens(
          *,
          item_catalogo:itens_catalogo(*)
        )
      `)
      .eq('modulo_id', moduloId)
      .order('ordem', { ascending: true })

    if (error) throw error
    return data || []
  },

  async adicionarItemModulo(dados: FormModuloPredefinidoItemComGrupo): Promise<ModuloPredefinidoItem> {
    // Debug: verificar dados antes de enviar
    console.log('🔍 [SERVICE DEBUG] Dados recebidos:', dados)
    console.log('🔍 [SERVICE DEBUG] modulo_id:', dados.modulo_id)
    
    // Verificar se modulo_id está presente
    if (!dados.modulo_id) {
      console.error('❌ [SERVICE ERROR] modulo_id é obrigatório mas não foi fornecido')
      throw new Error('ID do módulo é obrigatório para adicionar item')
    }
    
    // Preparar dados para inserção - remover campos com valor 'none'
    const dadosInsert: Record<string, unknown> = {
      modulo_id: dados.modulo_id,
      item_catalogo_id: dados.item_catalogo_id || null,
      item_estoque_id: dados.item_estoque_id || null,
      quantidade_padrao: dados.quantidade_padrao,
      obrigatorio: dados.obrigatorio,
      observacoes: dados.observacoes,
      ordem: dados.ordem ?? 0,
      grupo_item_id: dados.grupo_item_id && dados.grupo_item_id !== 'none' ? dados.grupo_item_id : null,
      variacao_item_id: dados.variacao_item_id && dados.variacao_item_id !== 'none' ? dados.variacao_item_id : null,
    }

    const { data, error } = await supabase
      .from('modulos_predefinidos_itens')
      .insert(dadosInsert)
      .select(`
        *,
        item_estoque:itens_estoque(
          *,
          base:bases(*)
        ),
        item_catalogo:itens_catalogo(*),
        grupo_item:grupos_itens(*),
        variacao_item:varicoes_itens(*)
      `)
      .single()

    if (error) throw error
    return data
  },

  async atualizarItemModulo(
    id: string,
    dados: Partial<FormModuloPredefinidoItemComGrupo>
  ): Promise<ModuloPredefinidoItem> {
    const { data, error } = await supabase
      .from('modulos_predefinidos_itens')
      .update({
        ...dados,
        atualizado_em: new Date().toISOString()
      })
      .eq('id', id)
      .select(`
        *,
        item_estoque:itens_estoque(
          *,
          base:bases(*)
        ),
        item_catalogo:itens_catalogo(*),
        grupo_item:grupos_itens(*),
        variacao_item:varicoes_itens(*)
      `)
      .single()

    if (error) throw error
    return data
  },

  async removerItemModulo(id: string): Promise<void> {
    const { error } = await supabase
      .from('modulos_predefinidos_itens')
      .delete()
      .eq('id', id)

    if (error) throw error
  },

  async reordenarItensModulo(itens: { id: string; ordem: number }[]): Promise<void> {
    const updates = itens.map(item => 
      supabase
        .from('modulos_predefinidos_itens')
        .update({ ordem: item.ordem })
        .eq('id', item.id)
    )

    const results = await Promise.all(updates)
    
    for (const result of results) {
      if (result.error) throw result.error
    }
  },

  // ============================================================================
  // CARGOS
  // ============================================================================

  // ============================================================================
  // GRUPOS DE ENTREGA PARA NOVOS FUNCIONÁRIOS
  // ============================================================================

  async getGruposEntrega(filtros?: FiltrosGruposEntrega): Promise<GrupoEntregaNovoFuncionario[]> {
    let query = supabase
      .from('view_grupos_entrega_completo')
      .select('*')
      .order('funcionario_nome', { ascending: true })

    if (filtros?.funcionario_id) {
      query = query.eq('funcionario_id', filtros.funcionario_id)
    }

    if (filtros?.cargo_id) {
      query = query.eq('cargo_id', filtros.cargo_id)
    }

    if (filtros?.status) {
      query = query.eq('status', filtros.status)
    }

    // Filtro de data removido - não aplicável para esta view

    const { data, error } = await query

    if (error) throw error
    return data || []
  },

  async getGrupoEntrega(id: string): Promise<GrupoEntregaNovoFuncionario | null> {
    const { data, error } = await supabase
      .from('grupos_entrega_novo_funcionario')
      .select(`
        *,
        funcionario:usuarios!grupos_entrega_novo_funcionario_funcionario_id_fkey(id, nome, matricula),
        cargo:cargos(id, nome),
        modulo_predefinido:modulos_predefinidos_cargo(*),
        criado_por_info:usuarios!grupos_entrega_novo_funcionario_criado_por_fkey(id, nome),
        aprovado_por_info:usuarios!grupos_entrega_novo_funcionario_aprovado_por_fkey(id, nome),
        entregue_por_info:usuarios!grupos_entrega_novo_funcionario_entregue_por_fkey(id, nome),
        solicitacoes:solicitacoes_itens(
          *,
          item:itens_estoque(*),
          solicitante:usuarios!solicitacoes_itens_solicitante_id_fkey(id, nome),
          destinatario:usuarios!solicitacoes_itens_destinatario_id_fkey(id, nome)
        )
      `)
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null
      throw error
    }

    return data
  },

  async criarGrupoEntrega(
    dados: FormGrupoEntregaNovoFuncionario,
    criadoPor: string
  ): Promise<GrupoEntregaNovoFuncionario> {
    const { data, error } = await supabase
      .from('grupos_entrega_novo_funcionario')
      .insert({
        ...dados,
        criado_por: criadoPor
      })
      .select(`
        *,
        funcionario:usuarios!grupos_entrega_novo_funcionario_funcionario_id_fkey(id, nome, matricula),
        cargo:cargos(id, nome),
        modulo_predefinido:modulos_predefinidos_cargo(*),
        criado_por_info:usuarios!grupos_entrega_novo_funcionario_criado_por_fkey(id, nome)
      `)
      .single()

    if (error) throw error
    return data
  },

  async criarSolicitacoesModuloPredefinido(
    grupoId: string,
    moduloId: string,
    solicitanteId: string,
    destinatarioId: string,
    motivo?: string
  ): Promise<number> {
    const { data, error } = await supabase.rpc('criar_solicitacoes_modulo_predefinido', {
      p_grupo_id: grupoId,
      p_modulo_id: moduloId,
      p_solicitante_id: solicitanteId,
      p_destinatario_id: destinatarioId,
      p_motivo: motivo || 'Entrega para novo funcionário'
    })

    if (error) throw error
    return data || 0
  },

  async aprovarGrupoEntrega(
    grupoId: string,
    aprovadorId: string,
    observacoes?: string
  ): Promise<number> {
    const { data, error } = await supabase.rpc('aprovar_grupo_entrega_novo_funcionario', {
      p_grupo_id: grupoId,
      p_aprovador_id: aprovadorId,
      p_observacoes: observacoes
    })

    if (error) throw error
    return data || 0
  },

  async entregarGrupoEntrega(
    grupoId: string,
    entregadorId: string,
    observacoes?: string
  ): Promise<number> {
    const { data, error } = await supabase.rpc('entregar_grupo_entrega_novo_funcionario', {
      p_grupo_id: grupoId,
      p_entregador_id: entregadorId,
      p_observacoes: observacoes
    })

    if (error) throw error
    return data || 0
  },

  async cancelarGrupoEntrega(
    grupoId: string,
    motivo: string
  ): Promise<void> {
    const { error } = await supabase
      .from('grupos_entrega_novo_funcionario')
      .update({
        status: 'cancelado',
        observacoes: motivo,
        atualizado_em: new Date().toISOString()
      })
      .eq('id', grupoId)

    if (error) throw error
  },

  // ============================================================================
  // UTILITÁRIOS
  // ============================================================================

  async getModulosPorCargo(cargoId: string, contratoId?: string): Promise<ModuloPredefinidoCargo[]> {
    let query = supabase
      .from('modulos_predefinidos_cargo')
      .select(`
        *,
        contrato:contratos(id, nome, codigo),
        cargo:cargos(id, nome),
        criado_por_info:usuarios!modulos_predefinidos_cargo_criado_por_fkey(id, nome),
        itens:modulos_predefinidos_itens(
          *,
          item_estoque:itens_estoque(
          *,
          base:bases(*)
        ),
        item_catalogo:itens_catalogo(*),
        grupo_item:grupos_itens(*),
        variacao_item:varicoes_itens(*)
        )
      `)
      .eq('cargo_id', cargoId)
      .eq('ativo', true)
      .order('nome_modulo', { ascending: true })

    if (contratoId) {
      query = query.eq('contrato_id', contratoId)
    }

    const { data, error } = await query

    if (error) throw error
    return data || []
  },

  async getItensDisponiveisParaModulo(moduloId?: string): Promise<ItemEstoque[]> {
    let query = supabase
      .from('itens_catalogo')
      .select('*')
      .eq('ativo', true)
      .order('nome', { ascending: true })

    // Se for para editar um módulo existente, excluir itens já adicionados
    if (moduloId && moduloId !== 'undefined') {
      const { data: itensExistentes } = await supabase
        .from('modulos_predefinidos_itens')
        .select('item_catalogo_id')
        .eq('modulo_id', moduloId)

      if (itensExistentes && itensExistentes.length > 0) {
        const idsExistentes = itensExistentes
          .map(item => item.item_catalogo_id)
          .filter(id => id && id !== '') // Filtrar IDs vazios ou nulos
        
        if (idsExistentes.length > 0) {
          query = query.not('id', 'in', `(${idsExistentes.join(',')})`)
        }
      }
    }

    const { data, error } = await query

    if (error) throw error
    return data || []
  },

  async getFuncionariosDisponiveis(): Promise<User[]> {
    console.log('🔄 [SERVICE] Carregando funcionários disponíveis...')
    const { data, error } = await supabase
      .from('usuarios')
      .select('id, nome, matricula, cargo, status')
      .eq('status', 'ativo')
      .order('nome', { ascending: true })

    if (error) {
      console.error('❌ [SERVICE] Erro ao carregar funcionários:', error)
      throw error
    }
    
    console.log('✅ [SERVICE] Funcionários carregados:', data?.length || 0)
    console.log('📦 [SERVICE] Primeiro funcionário:', data?.[0])
    return (data || []).map((user: unknown) => ({
      id: (user as Record<string, unknown>).id as string,
      nome: (user as Record<string, unknown>).nome as string,
      status: (user as Record<string, unknown>).status as string,
      email: (user as Record<string, unknown>).email as string || '',
      nivel_acesso: (user as Record<string, unknown>).nivel_acesso as string || 'funcionario'
    }))
  },

  async getCargosDisponiveis(): Promise<Array<{ id: string; nome: string }>> {
    console.log('🔄 [SERVICE] Carregando cargos disponíveis...')
    const { data, error } = await supabase
      .from('cargos')
      .select('id, nome')
      .eq('ativo', true)
      .order('nome', { ascending: true })

    if (error) {
      console.error('❌ [SERVICE] Erro ao carregar cargos:', error)
      throw error
    }
    
    console.log('✅ [SERVICE] Cargos carregados:', data?.length || 0)
    console.log('📦 [SERVICE] Primeiro cargo:', data?.[0])
    return data || []
  },

  async getContratosDisponiveis(): Promise<Array<{ id: string; nome: string; codigo: string }>> {
    console.log('🔄 [SERVICE] Carregando contratos disponíveis...')
    const { data, error } = await supabase
      .from('contratos')
      .select('id, nome, codigo')
      .eq('status', 'ativo')
      .order('nome', { ascending: true })

    if (error) {
      console.error('❌ [SERVICE] Erro ao carregar contratos:', error)
      throw error
    }
    
    console.log('✅ [SERVICE] Contratos carregados:', data?.length || 0)
    console.log('📦 [SERVICE] Primeiro contrato:', data?.[0])
    return data || []
  },

}
