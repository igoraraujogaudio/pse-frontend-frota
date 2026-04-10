import { supabase } from '@/lib/supabase'

// ============================================================================
// TIPOS PARA GRUPOS DE CHECKLIST
// ============================================================================

export interface ChecklistGrupo {
  id: string
  grupo_nome: string
  grupo_descricao?: string
  grupo_categoria: 'epi' | 'ferramental' | 'equipamento' | 'documento' | 'outro'
  requer_laudo: boolean
  obrigatorio: boolean
  permite_qualquer_item: boolean
  ordem_exibicao: number
  ativo: boolean
  criado_em: string
  atualizado_em: string
}

export interface ChecklistGrupoItem {
  id: string
  grupo_id: string
  item_catalogo_id: string
  obrigatorio_no_grupo: boolean
  ordem_no_grupo: number
  ativo: boolean
  criado_em: string
  atualizado_em: string
}

export interface ChecklistGrupoCompleto extends ChecklistGrupo {
  itens_do_grupo: Array<{
    id: string
    item_catalogo_id: string
    item_catalogo_nome: string
    item_catalogo_codigo: string
    item_catalogo_descricao?: string
    obrigatorio_no_grupo: boolean
    ordem_no_grupo: number
    ativo: boolean
  }>
  total_itens_grupo: number
}

export interface FormChecklistGrupo {
  grupo_nome: string
  grupo_descricao?: string
  grupo_categoria: 'epi' | 'ferramental' | 'equipamento' | 'documento' | 'outro'
  requer_laudo: boolean
  obrigatorio: boolean
  permite_qualquer_item: boolean
  ordem_exibicao: number
  ativo: boolean
}

export interface FormChecklistGrupoItem {
  grupo_id: string
  item_catalogo_id: string
  obrigatorio_no_grupo: boolean
  ordem_no_grupo: number
  ativo: boolean
}

export interface ItemCatalogo {
  id: string
  codigo: string
  nome: string
  descricao?: string
  categoria: string
  subcategoria?: string
  unidade_medida: string
  valor_unitario?: number
  fornecedor?: string
  validade?: string
  observacoes?: string
  requer_certificacao: boolean
  requer_laudo: boolean
  NCM?: number
  ativo: boolean
  criado_em: string
  atualizado_em: string
}

// ============================================================================
// SERVIÇO PARA GRUPOS DE CHECKLIST
// ============================================================================

export const checklistGrupoService = {
  // ============================================================================
  // GRUPOS DE CHECKLIST
  // ============================================================================

  async getGruposChecklist(filtros?: {
    categoria?: string
    ativo?: boolean
    grupo_nome?: string
  }): Promise<ChecklistGrupo[]> {
    let query = supabase
      .from('checklist_grupos_itens')
      .select('*')
      .order('ordem_exibicao', { ascending: true })

    if (filtros?.categoria) {
      query = query.eq('grupo_categoria', filtros.categoria)
    }
    if (filtros?.ativo !== undefined) {
      query = query.eq('ativo', filtros.ativo)
    }
    if (filtros?.grupo_nome) {
      query = query.ilike('grupo_nome', `%${filtros.grupo_nome}%`)
    }

    const { data, error } = await query

    if (error) throw error
    return data || []
  },

  async getGrupoChecklistById(id: string): Promise<ChecklistGrupoCompleto | null> {
    const { data, error } = await supabase
      .from('view_checklist_grupos_completos')
      .select('*')
      .eq('grupo_id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null
      throw error
    }

    return data
  },

  async criarGrupoChecklist(dados: FormChecklistGrupo): Promise<ChecklistGrupo> {
    const { data, error } = await supabase
      .from('checklist_grupos_itens')
      .insert({
        grupo_nome: dados.grupo_nome,
        grupo_descricao: dados.grupo_descricao,
        grupo_categoria: dados.grupo_categoria,
        requer_laudo: dados.requer_laudo,
        obrigatorio: dados.obrigatorio,
        permite_qualquer_item: dados.permite_qualquer_item,
        ordem_exibicao: dados.ordem_exibicao,
        ativo: dados.ativo ?? true
      })
      .select()
      .single()

    if (error) throw error
    return data
  },

  async atualizarGrupoChecklist(id: string, dados: Partial<FormChecklistGrupo>): Promise<ChecklistGrupo> {
    const { data, error } = await supabase
      .from('checklist_grupos_itens')
      .update({
        grupo_nome: dados.grupo_nome,
        grupo_descricao: dados.grupo_descricao,
        grupo_categoria: dados.grupo_categoria,
        requer_laudo: dados.requer_laudo,
        obrigatorio: dados.obrigatorio,
        permite_qualquer_item: dados.permite_qualquer_item,
        ordem_exibicao: dados.ordem_exibicao,
        ativo: dados.ativo,
        atualizado_em: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data
  },

  async excluirGrupoChecklist(id: string): Promise<void> {
    const { error } = await supabase
      .from('checklist_grupos_itens')
      .delete()
      .eq('id', id)

    if (error) throw error
  },

  // ============================================================================
  // ITENS DOS GRUPOS DE CHECKLIST
  // ============================================================================

  async getItensGrupoChecklist(grupoId: string): Promise<ChecklistGrupoItem[]> {
    const { data, error } = await supabase
      .from('checklist_grupos_itens_catalogo')
      .select('*')
      .eq('grupo_id', grupoId)
      .eq('ativo', true)
      .order('ordem_no_grupo', { ascending: true })

    if (error) throw error
    return data || []
  },

  async getItemGrupoChecklistById(id: string): Promise<ChecklistGrupoItem | null> {
    const { data, error } = await supabase
      .from('checklist_grupos_itens_catalogo')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null
      throw error
    }

    return data
  },

  async adicionarItemGrupoChecklist(dados: FormChecklistGrupoItem): Promise<ChecklistGrupoItem> {
    const { data, error } = await supabase
      .from('checklist_grupos_itens_catalogo')
      .insert({
        grupo_id: dados.grupo_id,
        item_catalogo_id: dados.item_catalogo_id,
        obrigatorio_no_grupo: dados.obrigatorio_no_grupo,
        ordem_no_grupo: dados.ordem_no_grupo,
        ativo: dados.ativo ?? true
      })
      .select()
      .single()

    if (error) throw error
    return data
  },

  async atualizarItemGrupoChecklist(id: string, dados: Partial<FormChecklistGrupoItem>): Promise<ChecklistGrupoItem> {
    const { data, error } = await supabase
      .from('checklist_grupos_itens_catalogo')
      .update({
        obrigatorio_no_grupo: dados.obrigatorio_no_grupo,
        ordem_no_grupo: dados.ordem_no_grupo,
        ativo: dados.ativo,
        atualizado_em: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data
  },

  async excluirItemGrupoChecklist(id: string): Promise<void> {
    const { error } = await supabase
      .from('checklist_grupos_itens_catalogo')
      .delete()
      .eq('id', id)

    if (error) throw error
  },

  async reordenarItensGrupo(grupoId: string, itens: Array<{ id: string; ordem_no_grupo: number }>): Promise<void> {
    const updates = itens.map(item => 
      supabase
        .from('checklist_grupos_itens_catalogo')
        .update({ ordem_no_grupo: item.ordem_no_grupo })
        .eq('id', item.id)
    )

    const results = await Promise.all(updates)
    
    for (const result of results) {
      if (result.error) throw result.error
    }
  },

  // ============================================================================
  // UTILITÁRIOS
  // ============================================================================

  async getItensCatalogoDisponiveisParaGrupo(grupoId?: string): Promise<ItemCatalogo[]> {
    let query = supabase
      .from('itens_catalogo')
      .select('*')
      .eq('ativo', true)
      .order('nome', { ascending: true })

    // Se for para editar um grupo existente, excluir itens já adicionados
    if (grupoId) {
      const { data: itensExistentes } = await supabase
        .from('checklist_grupos_itens_catalogo')
        .select('item_catalogo_id')
        .eq('grupo_id', grupoId)
        .eq('ativo', true)

      if (itensExistentes && itensExistentes.length > 0) {
        const idsExistentes = itensExistentes.map(item => item.item_catalogo_id)
        query = query.not('id', 'in', `(${idsExistentes.join(',')})`)
      }
    }

    const { data, error } = await query

    if (error) throw error
    return data || []
  },

  // ============================================================================
  // AGRUPAMENTO AUTOMÁTICO
  // ============================================================================

  async gerarGruposAutomaticamente(): Promise<Array<{
    grupo_nome: string
    grupo_descricao: string
    grupo_categoria: string
    itens: ItemCatalogo[]
  }>> {
    // Buscar todos os itens do catálogo ativos
    const { data: itens, error } = await supabase
      .from('itens_catalogo')
      .select('*')
      .eq('ativo', true)
      .order('nome', { ascending: true })

    if (error) throw error

    const gruposSugeridos = new Map<string, {
      grupo_nome: string
      grupo_descricao: string
      grupo_categoria: string
      itens: ItemCatalogo[]
    }>()

    // Lógica de agrupamento automático baseada em nomenclatura
    for (const item of itens || []) {
      const nomeBase = this.extrairNomeBase(item.nome)
      
      if (nomeBase && nomeBase.length > 3) { // Só agrupa nomes com mais de 3 caracteres
        const chave = `${nomeBase}_${item.categoria}`
        
        if (!gruposSugeridos.has(chave)) {
          gruposSugeridos.set(chave, {
            grupo_nome: nomeBase,
            grupo_descricao: `${nomeBase} - variações por tamanho/tipo`,
            grupo_categoria: item.categoria,
            itens: []
          })
        }
        
        gruposSugeridos.get(chave)!.itens.push(item)
      }
    }

    // Filtrar apenas grupos com mais de 1 item
    return Array.from(gruposSugeridos.values())
      .filter(grupo => grupo.itens.length > 1)
      .sort((a, b) => b.itens.length - a.itens.length)
  },

  extrairNomeBase(nomeCompleto: string): string | null {
    // Padrões comuns para extrair nome base
    const padroes = [
      // Botina cano longo 40 -> Botina cano longo
      /^([^0-9]+?)\s+\d+$/,
      // Capacete Classe A -> Capacete
      /^([^A-Z]+?)\s+[A-Z]$/,
      // Óculos Proteção UV -> Óculos Proteção
      /^([^A-Z]+?)\s+[A-Z]{2,}$/,
      // Luva Nitrílica Tamanho M -> Luva Nitrílica
      /^([^T]+?)\s+Tamanho/,
      // Cinto Segurança 2 pontos -> Cinto Segurança
      /^([^0-9]+?)\s+\d+\s+pontos/
    ]

    for (const padrao of padroes) {
      const match = nomeCompleto.match(padrao)
      if (match && match[1]) {
        return match[1].trim()
      }
    }

    // Se não encontrou padrão, tentar dividir por palavras e pegar as primeiras
    const palavras = nomeCompleto.split(' ')
    if (palavras.length >= 2) {
      // Pegar as primeiras 2-3 palavras
      return palavras.slice(0, Math.min(3, palavras.length - 1)).join(' ')
    }

    return null
  },

  // ============================================================================
  // INTEGRAÇÃO COM CHECKLIST POR CONTRATO
  // ============================================================================

  async adicionarGrupoChecklistContrato(dados: {
    contrato_id: string
    grupo_id: string
    item_id: string
    item_nome: string
    item_descricao?: string
    item_categoria: string
    obrigatorio: boolean
    requer_laudo: boolean
    requer_inventario: boolean
    ordem_exibicao: number
  }): Promise<void> {
    const { error } = await supabase
      .from('checklist_items_contrato')
      .insert({
        contrato_id: dados.contrato_id,
        grupo_id: dados.grupo_id,
        item_id: dados.item_id,
        item_nome: dados.item_nome,
        item_descricao: dados.item_descricao,
        item_categoria: dados.item_categoria,
        obrigatorio: dados.obrigatorio,
        requer_laudo: dados.requer_laudo,
        requer_inventario: dados.requer_inventario,
        ordem_exibicao: dados.ordem_exibicao,
        ativo: true
      })

    if (error) throw error
  }
}
