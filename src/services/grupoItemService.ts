import { supabase } from '@/lib/supabase'
import type {
  GrupoItem,
  VariacaoItem,
  GrupoItemCompleto,
  VariacaoItemCompleto,
  FormGrupoItem,
  FormVariacaoItem,
  ItemEstoque
} from '@/types'

export const grupoItemService = {
  // ============================================================================
  // GRUPOS DE ITENS
  // ============================================================================

  async getGruposItens(filtros?: {
    categoria?: string
    ativo?: boolean
    nome_grupo?: string
  }): Promise<GrupoItem[]> {
    let query = supabase
      .from('grupos_itens')
      .select(`
        *,
        criado_por_usuario:usuarios!criado_por(id, nome),
        variacoes:varicoes_itens(
          *,
          item_catalogo:itens_catalogo(*)
        )
      `)
      .order('nome_grupo', { ascending: true })

    if (filtros?.categoria) {
      query = query.eq('categoria', filtros.categoria)
    }
    if (filtros?.ativo !== undefined) {
      query = query.eq('ativo', filtros.ativo)
    }
    if (filtros?.nome_grupo) {
      query = query.ilike('nome_grupo', `%${filtros.nome_grupo}%`)
    }

    const { data, error } = await query

    if (error) throw error
    
    return data || []
  },

  async getGrupoItemById(id: string): Promise<GrupoItemCompleto | null> {
    const { data, error } = await supabase
      .from('grupos_itens')
      .select(`
        *,
        criado_por_usuario:usuarios!criado_por(id, nome),
        variacoes:varicoes_itens(
          *,
          item_catalogo:itens_catalogo(*)
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

  async criarGrupoItem(dados: FormGrupoItem & { criado_por: string }): Promise<GrupoItem> {
    const { data, error } = await supabase
      .from('grupos_itens')
      .insert({
        nome_grupo: dados.nome_grupo,
        descricao: dados.descricao,
        categoria: dados.categoria,
        ativo: dados.ativo ?? true,
        criado_por: dados.criado_por
      })
      .select()
      .single()

    if (error) throw error
    return data
  },

  async atualizarGrupoItem(id: string, dados: Partial<FormGrupoItem>): Promise<GrupoItem> {
    const { data, error } = await supabase
      .from('grupos_itens')
      .update({
        nome_grupo: dados.nome_grupo,
        descricao: dados.descricao,
        categoria: dados.categoria,
        ativo: dados.ativo,
        atualizado_em: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data
  },

  async excluirGrupoItem(id: string): Promise<void> {
    const { error } = await supabase
      .from('grupos_itens')
      .delete()
      .eq('id', id)

    if (error) throw error
  },

  // ============================================================================
  // VARIAÇÕES DE ITENS
  // ============================================================================

  async getVariacoesGrupo(grupoId: string): Promise<VariacaoItemCompleto[]> {
    const { data, error } = await supabase
      .from('view_varicoes_itens_completo')
      .select('*')
      .eq('grupo_id', grupoId)
      .eq('variacao_ativa', true)
      .order('ordem', { ascending: true })

    if (error) throw error
    return data || []
  },

  async getVariacaoById(id: string): Promise<VariacaoItemCompleto | null> {
    const { data, error } = await supabase
      .from('view_varicoes_itens_completo')
      .select('*')
      .eq('variacao_id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null
      throw error
    }

    return data
  },

  async adicionarVariacaoItem(dados: FormVariacaoItem): Promise<VariacaoItem> {
    console.log('=== SERVICE DEBUG ===')
    console.log('dados recebidos:', dados)
    console.log('grupo_id:', dados.grupo_id)
    console.log('====================')
    
    const insertData = {
      grupo_id: dados.grupo_id,
      item_catalogo_id: dados.item_catalogo_id,
      nome_variacao: dados.nome_variacao,
      codigo_variacao: dados.codigo_variacao || null,
      ordem: dados.ordem || 0,
      ativo: dados.ativo ?? true
    }
    
    console.log('insertData:', insertData)
    
    const { data, error } = await supabase
      .from('varicoes_itens')
      .insert(insertData)
      .select()
      .single()

    if (error) throw error
    return data
  },

  async atualizarVariacaoItem(id: string, dados: Partial<FormVariacaoItem>): Promise<VariacaoItem> {
    const { data, error } = await supabase
      .from('varicoes_itens')
      .update({
        nome_variacao: dados.nome_variacao,
        codigo_variacao: dados.codigo_variacao,
        ordem: dados.ordem,
        ativo: dados.ativo,
        atualizado_em: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data
  },

  async excluirVariacaoItem(id: string): Promise<void> {
    const { error } = await supabase
      .from('varicoes_itens')
      .delete()
      .eq('id', id)

    if (error) throw error
  },

  // ============================================================================
  // UTILITÁRIOS
  // ============================================================================

  async getItensDisponiveisParaGrupo(grupoId?: string): Promise<ItemEstoque[]> {
    let query = supabase
      .from('itens_catalogo')
      .select('*')
      .eq('ativo', true)
      .order('nome', { ascending: true })

    // Se for para editar um grupo existente, excluir itens já adicionados
    if (grupoId) {
      const { data: itensExistentes } = await supabase
        .from('varicoes_itens')
        .select('item_catalogo_id')
        .eq('grupo_id', grupoId)

      if (itensExistentes && itensExistentes.length > 0) {
        const idsExistentes = itensExistentes.map(item => item.item_catalogo_id).filter(id => id)
        if (idsExistentes.length > 0) {
          query = query.not('id', 'in', `(${idsExistentes.join(',')})`)
        }
      }
    }

    const { data, error } = await query

    if (error) throw error
    return data || []
  },

  async getVariacoesDisponiveisGrupo(grupoId: string): Promise<VariacaoItemCompleto[]> {
    const { data, error } = await supabase
      .rpc('get_varicoes_disponiveis_grupo', { p_grupo_id: grupoId })

    if (error) throw error
    return data || []
  },

  // ============================================================================
  // INTEGRAÇÃO COM MÓDULOS PRÉ-DEFINIDOS
  // ============================================================================

  async adicionarItemGrupoModulo(dados: {
    modulo_id: string
    grupo_item_id: string
    quantidade_padrao: number
    obrigatorio: boolean
    observacoes?: string
    ordem?: number
  }): Promise<{ id: string; modulo_id: string; grupo_item_id: string; quantidade_padrao: number; obrigatorio: boolean; observacoes?: string; ordem: number }> {
    const { data, error } = await supabase
      .from('modulos_predefinidos_itens')
      .insert({
        modulo_id: dados.modulo_id,
        grupo_item_id: dados.grupo_item_id,
        quantidade_padrao: dados.quantidade_padrao,
        obrigatorio: dados.obrigatorio,
        observacoes: dados.observacoes,
        ordem: dados.ordem ?? 0
      })
      .select()
      .single()

    if (error) throw error
    return data
  },

  async adicionarVariacaoModulo(dados: {
    modulo_id: string
    variacao_item_id: string
    quantidade_padrao: number
    obrigatorio: boolean
    observacoes?: string
    ordem?: number
  }): Promise<{ id: string; modulo_id: string; variacao_item_id: string; quantidade_padrao: number; obrigatorio: boolean; observacoes?: string; ordem: number }> {
    const { data, error } = await supabase
      .from('modulos_predefinidos_itens')
      .insert({
        modulo_id: dados.modulo_id,
        variacao_item_id: dados.variacao_item_id,
        quantidade_padrao: dados.quantidade_padrao,
        obrigatorio: dados.obrigatorio,
        observacoes: dados.observacoes,
        ordem: dados.ordem ?? 0
      })
      .select()
      .single()

    if (error) throw error
    return data
  },

  // ============================================================================
  // INTEGRAÇÃO COM SOLICITAÇÕES - BUSCAR ITEM DE ESTOQUE A PARTIR DE VARIAÇÃO
  // ============================================================================

  /**
   * Busca o item de estoque correspondente a uma variação em uma base específica
   * Fluxo: variacao_id → item_catalogo_id → item_estoque_id (filtrado por base)
   */
  async getItemEstoqueFromVariacao(
    variacaoId: string,
    baseId: string
  ): Promise<ItemEstoque | null> {
    const { data, error } = await supabase
      .rpc('get_item_estoque_from_variacao', {
        p_variacao_id: variacaoId,
        p_base_id: baseId
      })
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null
      throw error
    }

    return data as ItemEstoque | null
  },

  /**
   * Busca variações de um grupo com informações de estoque para uma base específica
   * Útil para mostrar disponibilidade ao criar solicitações
   */
  async getVariacoesComEstoquePorBase(
    grupoId: string,
    baseId: string
  ): Promise<Array<{
    variacao_id: string
    nome_variacao: string
    codigo_variacao: string
    item_catalogo_id: string
    item_codigo: string
    item_nome: string
    estoque_atual: number
    ordem: number
  }>> {
    const { data, error } = await supabase
      .rpc('get_varicoes_disponiveis_grupo', {
        p_grupo_id: grupoId,
        p_base_id: baseId
      })

    if (error) throw error
    return data || []
  },

  /**
   * Busca todos os grupos com suas variações e estoque para uma base
   * Útil para interface de seleção em solicitações
   */
  async getGruposComEstoquePorBase(baseId: string): Promise<Array<{
    id: string
    nome_grupo: string
    descricao?: string
    categoria: string
    ativo: boolean
    variacoes: Array<{
      variacao_id: string
      nome_variacao: string
      codigo_variacao: string
      item_catalogo_id: string
      item_codigo: string
      item_nome: string
      estoque_atual: number
      ordem: number
    }>
  }>> {
    // Buscar todos os grupos ativos
    const grupos = await this.getGruposItens({ ativo: true })
    
    // Para cada grupo, buscar variações com estoque da base
    const gruposCompletos = await Promise.all(
      grupos.map(async (grupo) => {
        const variacoes = await this.getVariacoesComEstoquePorBase(grupo.id, baseId)
        
        return {
          id: grupo.id,
          nome_grupo: grupo.nome_grupo,
          descricao: grupo.descricao,
          categoria: grupo.categoria,
          ativo: grupo.ativo,
          variacoes
        }
      })
    )
    
    // Filtrar grupos que têm variações disponíveis
    return gruposCompletos.filter(g => g.variacoes && g.variacoes.length > 0)
  }
}
