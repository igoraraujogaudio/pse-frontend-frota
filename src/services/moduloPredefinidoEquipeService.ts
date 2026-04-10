import { supabase } from '@/lib/supabase'

export interface ModuloPredefinidoEquipe {
  id: string
  operacao_id?: string
  nome_modulo: string
  descricao?: string
  criado_por: string
  ativo: boolean
  criado_em: string
  atualizado_em: string
  operacao_nome?: string
  operacao_codigo?: string
  criado_por_nome?: string
  total_itens?: number
  itens_obrigatorios?: number
  itens?: ItemModuloEquipe[]
}

export interface ItemModuloEquipe {
  id: string
  modulo_id: string
  item_estoque_id?: string
  item_catalogo_id?: string
  grupo_item_id?: string
  variacao_item_id?: string
  quantidade_padrao: number
  obrigatorio: boolean
  ordem: number
  observacoes?: string
  ativo: boolean
  item_catalogo?: {
    id: string
    codigo: string
    nome: string
    categoria: string
    unidade_medida: string
    descricao?: string
    ativo: boolean
  }
  item_estoque?: {
    id: string
    codigo: string
    nome: string
    categoria: string
    unidade_medida: string
    estoque_atual: number
    estoque_minimo: number
    base_id: string
    requer_laudo: boolean
  }
  grupo_item?: {
    id: string
    nome_grupo: string
    categoria: string
    descricao?: string
    ativo: boolean
  }
  criado_em?: string
  atualizado_em?: string
  
  // Dados relacionados da view
  item_codigo?: string
  item_nome?: string
  item_categoria?: string
  item_unidade_medida?: string
  item_estoque_atual?: number
  item_estoque_minimo?: number
  item_base_id?: string
  grupo_nome?: string
  grupo_categoria?: string
  variacao_nome?: string
  variacao_codigo?: string
}

export interface CriarModuloEquipeParams {
  operacao_id?: string
  nome_modulo: string
  descricao?: string
  criado_por: string
}

export interface AdicionarItemModuloEquipeParams {
  modulo_id: string
  item_estoque_id?: string
  item_catalogo_id?: string
  grupo_item_id?: string
  variacao_item_id?: string
  quantidade_padrao?: number
  obrigatorio?: boolean
  ordem?: number
  observacoes?: string
}

export class ModuloPredefinidoEquipeService {
  /**
   * Buscar módulos pré-definidos de equipes
   */
  async getModulosPredefinidosEquipe(filters: {
    operacao_id?: string
    ativo?: boolean
  } = {}): Promise<ModuloPredefinidoEquipe[]> {
    try {
      console.log('🔄 [SERVICE] Carregando módulos pré-definidos por contrato...', filters)
      
      let query = supabase
        .from('v_modulos_predefinidos_equipe_completos')
        .select('*')
        .order('nome_modulo', { ascending: true })

      if (filters.operacao_id) {
        query = query.eq('operacao_id', filters.operacao_id)
      }

      if (filters.ativo !== undefined) {
        query = query.eq('ativo', filters.ativo)
      }

      const { data: modulos, error } = await query

      if (error) {
        console.error('❌ [SERVICE] Erro ao carregar módulos por contrato:', error)
        throw error
      }
      
      console.log('✅ [SERVICE] Módulos por contrato carregados:', modulos?.length || 0)
      
      // Carregar itens para cada módulo
      if (modulos && modulos.length > 0) {
        const modulosComItens = await Promise.all(
          modulos.map(async (modulo) => {
            if (!modulo.id || modulo.id === 'undefined') {
              console.warn('⚠️ [SERVICE] Módulo com ID inválido:', { id: modulo.id })
              return { ...modulo, itens: [] }
            }

            const { data: itens, error: itensError } = await supabase
              .from('modulos_predefinidos_itens_equipe')
              .select(`
                *,
                item_catalogo:itens_catalogo(*),
                item_estoque:itens_estoque(
                  *,
                  base:bases(*)
                ),
                grupo_item:grupos_itens(*),
                variacao_item:varicoes_itens(*)
              `)
              .eq('modulo_id', modulo.id)
              .eq('ativo', true)
              .order('ordem', { ascending: true })

            if (itensError) {
              console.error('❌ [SERVICE] Erro ao carregar itens do módulo:', modulo.id, itensError)
              return { ...modulo, itens: [] }
            }

            return { 
              ...modulo, 
              itens: itens || [],
              total_itens: itens?.length || 0
            }
          })
        )
        
        console.log('📦 [SERVICE] Módulos com itens carregados:', modulosComItens.length)
        return modulosComItens
      }
      
      return (modulos || []).map(modulo => ({
        ...modulo,
        itens: [],
        total_itens: 0
      }))
    } catch (error) {
      console.error('❌ [SERVICE] Erro ao carregar módulos por contrato:', error)
      throw error
    }
  }

  /**
   * Buscar módulos de uma operação específica
   */
  async getModulosPorOperacao(operacaoId: string): Promise<ModuloPredefinidoEquipe[]> {
    return this.getModulosPredefinidosEquipe({ operacao_id: operacaoId, ativo: true })
  }

  /**
   * Buscar módulo por ID
   */
  async getModuloEquipeById(moduloId: string): Promise<ModuloPredefinidoEquipe | null> {
    try {
      const { data, error } = await supabase
        .from('v_modulos_predefinidos_equipe_completos')
        .select('*')
        .eq('id', moduloId)
        .single()

      if (error) throw error
      return data
    } catch (error) {
      console.error('❌ [SERVICE] Erro ao buscar módulo por contrato:', error)
      throw error
    }
  }

  /**
   * Criar novo módulo pré-definido para contrato
   */
  static async criarModuloEquipe(params: CriarModuloEquipeParams): Promise<ModuloPredefinidoEquipe> {
    try {
      console.log('🔄 [SERVICE] Criando módulo por contrato:', params)
      
      const { data, error } = await supabase
        .from('modulos_predefinidos_equipe')
        .insert({
          operacao_id: params.operacao_id,
          nome_modulo: params.nome_modulo,
          descricao: params.descricao,
          criado_por: params.criado_por
        })
        .select()
        .single()

      if (error) throw error

      console.log('✅ [SERVICE] Módulo por contrato criado:', data.id)
      return data
    } catch (error) {
      console.error('❌ [SERVICE] Erro ao criar módulo por contrato:', error)
      throw error
    }
  }

  /**
   * Atualizar módulo por contrato
   */
  async atualizarModuloEquipe(
    moduloId: string, 
    updates: Partial<CriarModuloEquipeParams>
  ): Promise<ModuloPredefinidoEquipe> {
    try {
      const { data, error } = await supabase
        .from('modulos_predefinidos_equipe')
        .update(updates)
        .eq('id', moduloId)
        .select()
        .single()

      if (error) throw error
      return data
    } catch (error) {
      console.error('❌ [SERVICE] Erro ao atualizar módulo por contrato:', error)
      throw error
    }
  }

  /**
   * Desativar módulo por contrato
   */
  async desativarModuloEquipe(moduloId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('modulos_predefinidos_equipe')
        .update({ ativo: false })
        .eq('id', moduloId)

      if (error) throw error
      console.log('✅ [SERVICE] Módulo por contrato desativado:', moduloId)
    } catch (error) {
      console.error('❌ [SERVICE] Erro ao desativar módulo por contrato:', error)
      throw error
    }
  }

  /**
   * Buscar itens de um módulo por contrato
   */
  async getItensModuloEquipe(moduloId: string): Promise<ItemModuloEquipe[]> {
    try {
      console.log('🔄 [SERVICE] Carregando itens do módulo por contrato:', moduloId)
      
      const { data, error } = await supabase
        .from('v_modulos_predefinidos_itens_equipe_completos')
        .select('*')
        .eq('modulo_id', moduloId)
        .order('ordem', { ascending: true })
        .order('obrigatorio', { ascending: false })

      if (error) throw error

      console.log('✅ [SERVICE] Itens do módulo por contrato carregados:', data?.length || 0)
      return data || []
    } catch (error) {
      console.error('❌ [SERVICE] Erro ao carregar itens do módulo por contrato:', error)
      throw error
    }
  }

  /**
   * Adicionar item ao módulo por contrato
   */
  async adicionarItemModuloEquipe(params: AdicionarItemModuloEquipeParams): Promise<ItemModuloEquipe> {
    try {
      console.log('🔄 [SERVICE] Adicionando item ao módulo por contrato:', params)
      
      const { data, error } = await supabase
        .from('modulos_predefinidos_itens_equipe')
        .insert({
          modulo_id: params.modulo_id,
          item_estoque_id: params.item_estoque_id,
          item_catalogo_id: params.item_catalogo_id,
          grupo_item_id: params.grupo_item_id,
          variacao_item_id: params.variacao_item_id,
          quantidade_padrao: params.quantidade_padrao || 1,
          obrigatorio: params.obrigatorio !== false,
          ordem: params.ordem || 0,
          observacoes: params.observacoes
        })
        .select()
        .single()

      if (error) throw error

      console.log('✅ [SERVICE] Item adicionado ao módulo por contrato:', data.id)
      return data
    } catch (error) {
      console.error('❌ [SERVICE] Erro ao adicionar item ao módulo por contrato:', error)
      throw error
    }
  }

  /**
   * Atualizar item do módulo por contrato
   */
  async atualizarItemModuloEquipe(
    itemId: string,
    updates: Partial<AdicionarItemModuloEquipeParams>
  ): Promise<ItemModuloEquipe> {
    try {
      const { data, error } = await supabase
        .from('modulos_predefinidos_itens_equipe')
        .update(updates)
        .eq('id', itemId)
        .select()
        .single()

      if (error) throw error
      return data
    } catch (error) {
      console.error('❌ [SERVICE] Erro ao atualizar item do módulo por contrato:', error)
      throw error
    }
  }

  /**
   * Remover item do módulo por contrato
   */
  async removerItemModuloEquipe(itemId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('modulos_predefinidos_itens_equipe')
        .update({ ativo: false })
        .eq('id', itemId)

      if (error) throw error
      console.log('✅ [SERVICE] Item removido do módulo por contrato:', itemId)
    } catch (error) {
      console.error('❌ [SERVICE] Erro ao remover item do módulo por contrato:', error)
      throw error
    }
  }

  /**
   * Buscar grupos de itens disponíveis (mesmos grupos usados por funcionários)
   */
  async getGruposItens(): Promise<Array<{
    id: string
    nome_grupo: string
    categoria: string
    descricao?: string
    ativo: boolean
  }>> {
    try {
      const { data, error } = await supabase
        .from('grupos_itens')
        .select('id, nome_grupo, categoria, descricao, ativo')
        .eq('ativo', true)
        .order('nome_grupo', { ascending: true })

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('❌ [SERVICE] Erro ao carregar grupos de itens:', error)
      throw error
    }
  }

  /**
   * Buscar variações de um grupo de itens
   */
  async getVariacoesGrupo(grupoId: string): Promise<Array<{
    id: string
    nome_variacao: string
    codigo_variacao?: string
    item_estoque_id: string
    item_estoque?: {
      codigo: string
      nome: string
      estoque_atual: number
    }[]
  }>> {
    try {
      const { data, error } = await supabase
        .from('varicoes_itens')
        .select(`
          id,
          nome_variacao,
          codigo_variacao,
          item_estoque_id,
          item_estoque:itens_estoque!item_estoque_id(
            codigo,
            nome,
            estoque_atual
          )
        `)
        .eq('grupo_id', grupoId)
        .eq('ativo', true)
        .order('nome_variacao', { ascending: true })

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('❌ [SERVICE] Erro ao carregar variações do grupo:', error)
      throw error
    }
  }

  /**
   * Buscar itens do catálogo disponíveis para módulos por contrato
   */
  async getItensDisponiveisParaModuloEquipe(moduloId?: string): Promise<Array<{
    id: string
    codigo: string
    nome: string
    categoria: string
    unidade_medida: string
    descricao?: string
    ativo: boolean
  }>> {
    try {
      let query = supabase
        .from('itens_catalogo')
        .select('*')
        .eq('ativo', true)
        .order('nome', { ascending: true })

      // Se for para editar um módulo existente, excluir itens já adicionados
      if (moduloId && moduloId !== 'undefined') {
        const { data: itensExistentes } = await supabase
          .from('modulos_predefinidos_itens_equipe')
          .select('item_catalogo_id')
          .eq('modulo_id', moduloId)
          .eq('ativo', true)

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
    } catch (error) {
      console.error('❌ [SERVICE] Erro ao buscar itens do catálogo para módulo por contrato:', error)
      throw error
    }
  }

  /**
   * Buscar itens de estoque disponíveis (mantido para compatibilidade)
   */
  async getItensEstoque(filters: {
    base_id?: string
    categoria?: string
    ativo?: boolean
  } = {}): Promise<Array<{
    id: string
    codigo: string
    nome: string
    categoria: string
    unidade_medida: string
    estoque_atual: number
    estoque_minimo: number
    base_id: string
    requer_laudo: boolean
  }>> {
    try {
      let query = supabase
        .from('itens_estoque')
        .select('id, codigo, nome, categoria, unidade_medida, estoque_atual, estoque_minimo, base_id, requer_laudo')
        .eq('status', 'ativo')
        .order('nome', { ascending: true })

      if (filters.base_id) {
        query = query.eq('base_id', filters.base_id)
      }

      if (filters.categoria) {
        query = query.eq('categoria', filters.categoria)
      }

      const { data, error } = await query

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('❌ [SERVICE] Erro ao carregar itens de estoque:', error)
      throw error
    }
  }

  /**
   * Buscar itens do catálogo
   */
  async getItensCatalogo(filters: {
    categoria?: string
    ativo?: boolean
  } = {}): Promise<Array<{
    id: string
    codigo: string
    nome: string
    categoria: string
    unidade_medida: string
    valor_unitario?: number
    requer_laudo: boolean
  }>> {
    try {
      let query = supabase
        .from('itens_catalogo')
        .select('id, codigo, nome, categoria, unidade_medida, valor_unitario, requer_laudo')
        .eq('ativo', true)
        .order('nome', { ascending: true })

      if (filters.categoria) {
        query = query.eq('categoria', filters.categoria)
      }

      const { data, error } = await query

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('❌ [SERVICE] Erro ao carregar itens do catálogo:', error)
      throw error
    }
  }
}

export const moduloPredefinidoEquipeService = new ModuloPredefinidoEquipeService()



