import { supabase } from '@/lib/supabase'
import type { Base } from '@/types'

export interface ItemCatalogo {
  id: string
  codigo: string
  nome: string
  descricao?: string
  categoria: 'epi' | 'ferramental' | 'consumivel' | 'equipamento'
  subcategoria?: string
  unidade_medida: string
  valor_unitario?: number
  fornecedor?: string
  validade?: string
  observacoes?: string
  requer_certificacao: boolean
  requer_laudo: boolean
  requer_rastreabilidade: boolean
  requer_ca: boolean
  NCM?: number
  ativo: boolean
  criado_em: string
  atualizado_em: string
}

export interface ItemEstoqueCompleto {
  // Dados do catálogo (nomes das colunas da view)
  item_estoque_id: string  // ID do item em itens_estoque
  item_catalogo_id: string
  item_codigo: string
  item_nome: string
  item_descricao?: string
  categoria: 'epi' | 'ferramental' | 'consumivel' | 'equipamento'
  subcategoria?: string
  unidade_medida: string
  valor_unitario?: number
  fornecedor?: string
  validade?: string
  requer_certificacao: boolean
  requer_laudo: boolean
  requer_rastreabilidade: boolean
  requer_ca: boolean
  NCM?: number
  
  // Dados específicos da base
  base_id: string
  base_nome: string
  base_codigo: string
  estoque_minimo: number
  estoque_atual: number
  status_estoque: 'ativo' | 'inativo' | 'descontinuado'
  localizacao_base?: string
  observacoes_base?: string
  
  // Agregações (quando múltiplas bases)
  total_estoque?: number
  total_minimo?: number
  bases_com_estoque?: Array<{
    base_id: string
    base_nome: string
    estoque_atual: number
    estoque_minimo: number
  }>
}

export interface EstoqueStatsCatalogo {
  total_itens: number
  itens_abaixo_minimo: number
  total_categorias: { [key: string]: number }
  valor_total: number
  itens_por_base: { [key: string]: number }
}

export const catalogoService = {
  /**
   * Verificar se um item tem estoque em alguma base
   */
  async verificarEstoqueItem(itemCatalogoId: string): Promise<{
    temEstoque: boolean;
    basesComEstoque: Array<{
      base_id: string;
      base_nome: string;
      estoque_atual: number;
    }>;
  }> {
    try {
      const { data, error } = await supabase
        .from('itens_estoque')
        .select(`
          base_id,
          estoque_atual,
          base:bases!base_id(nome)
        `)
        .eq('item_catalogo_id', itemCatalogoId)
        .gt('estoque_atual', 0)
        .eq('status', 'ativo');

      if (error) {
        console.error('Erro ao verificar estoque do item:', error);
        throw error;
      }

      const basesComEstoque = data?.map(item => ({
        base_id: item.base_id,
        base_nome: (item.base as unknown as Base)?.nome || 'Base desconhecida',
        estoque_atual: item.estoque_atual
      })) || [];

      return {
        temEstoque: basesComEstoque.length > 0,
        basesComEstoque
      };
    } catch (error) {
      console.error('Erro ao verificar estoque do item:', error);
      throw error;
    }
  },

  /**
   * Excluir item do catálogo e de todas as bases (apenas se não tiver estoque)
   */
  async excluirItemCompleto(itemCatalogoId: string): Promise<{
    success: boolean;
    message: string;
    basesComEstoque?: Array<{
      base_id: string;
      base_nome: string;
      estoque_atual: number;
    }>;
  }> {
    try {
      // 1. Verificar se tem estoque em alguma base
      const verificacaoEstoque = await this.verificarEstoqueItem(itemCatalogoId);
      
      if (verificacaoEstoque.temEstoque) {
        return {
          success: false,
          message: 'Não é possível excluir o item pois ele possui estoque em uma ou mais bases',
          basesComEstoque: verificacaoEstoque.basesComEstoque
        };
      }

      // 2. Excluir de todas as bases (itens_estoque)
      const { error: estoqueError } = await supabase
        .from('itens_estoque')
        .delete()
        .eq('item_catalogo_id', itemCatalogoId);

      if (estoqueError) {
        console.error('Erro ao excluir itens do estoque:', estoqueError);
        throw estoqueError;
      }

      // 3. Excluir do catálogo
      const { error: catalogoError } = await supabase
        .from('itens_catalogo')
        .delete()
        .eq('id', itemCatalogoId);

      if (catalogoError) {
        console.error('Erro ao excluir item do catálogo:', catalogoError);
        throw catalogoError;
      }

      return {
        success: true,
        message: 'Item excluído com sucesso do catálogo e de todas as bases'
      };
    } catch (error) {
      console.error('Erro ao excluir item completo:', error);
      throw error;
    }
  },

  /**
   * Buscar todos os itens do catálogo com suas quantidades por base
   */
  async getItensCatalogoComEstoque(baseId?: string): Promise<ItemEstoqueCompleto[]> {
    try {
      // SEMPRE buscar todos os itens do catálogo primeiro
      const { data: itensCatalogo, error: catalogoError } = await supabase
        .from('itens_catalogo')
        .select('*')
        .eq('ativo', true)
        .order('nome')

      if (catalogoError) {
        console.error('Erro ao buscar itens do catálogo:', catalogoError)
        throw catalogoError
      }

      if (!itensCatalogo || itensCatalogo.length === 0) {
        return []
      }

      // Buscar todos os estoques de uma vez (otimizado)
      const { data: todosEstoques, error: estoqueError } = await supabase
        .from('itens_estoque')
        .select(`
          id,
          item_catalogo_id,
          base_id,
          estoque_atual,
          estoque_minimo,
          localizacao_base,
          observacoes_base,
          base:bases(nome, codigo)
        `)
        .eq('status', 'ativo')

      if (estoqueError) {
        console.error('Erro ao buscar estoques:', estoqueError)
        throw estoqueError
      }

      // Para cada item do catálogo, montar o resultado
      const itensComEstoque = itensCatalogo.map(itemCatalogo => {
        let estoqueAtual = 0
        let estoqueMinimo = 0
        let baseNome = ''
        let baseCodigo = ''
        let localizacaoBase = ''
        let observacoesBase = ''
        const basesComEstoque: Array<{
          base_id: string
          base_nome: string
          estoque_atual: number
          estoque_minimo: number
        }> = []

        // Filtrar estoques deste item
        const estoquesDoItem = todosEstoques?.filter(estoque => 
          estoque.item_catalogo_id === itemCatalogo.id
        ) || []

        if (baseId && baseId !== 'todos') {
          // Base específica selecionada
          const estoqueBase = estoquesDoItem.find(estoque => estoque.base_id === baseId)
          if (estoqueBase) {
            estoqueAtual = estoqueBase.estoque_atual || 0
            estoqueMinimo = estoqueBase.estoque_minimo || 0
            baseNome = (estoqueBase.base as { nome?: string; codigo?: string })?.nome || ''
            baseCodigo = (estoqueBase.base as { nome?: string; codigo?: string })?.codigo || ''
            localizacaoBase = estoqueBase.localizacao_base || ''
            observacoesBase = estoqueBase.observacoes_base || ''
          }
        } else {
          // Todas as bases - agregar
          estoqueAtual = estoquesDoItem.reduce((total, item) => total + (item.estoque_atual || 0), 0)
          estoqueMinimo = estoquesDoItem.reduce((total, item) => total + (item.estoque_minimo || 0), 0)
          baseNome = 'Todas as Bases'
          baseCodigo = 'TODAS'
          
          // Coletar informações de cada base
          estoquesDoItem.forEach(item => {
            basesComEstoque.push({
              base_id: item.base_id,
              base_nome: (item.base as { nome?: string; codigo?: string })?.nome || '',
              estoque_atual: item.estoque_atual || 0,
              estoque_minimo: item.estoque_minimo || 0
            })
          })
        }

        // Obter o item_estoque_id correto
        let itemEstoqueId = ''
        console.log('🔍 [SERVICE DEBUG] Item:', itemCatalogo.nome, 'Base:', baseId)
        console.log('🔍 [SERVICE DEBUG] Estoques do item:', estoquesDoItem)
        
        if (baseId && baseId !== 'todos') {
          // Base específica - pegar o ID do item_estoque desta base
          const estoqueBase = estoquesDoItem.find(estoque => estoque.base_id === baseId)
          console.log('🔍 [SERVICE DEBUG] Estoque base encontrado:', estoqueBase)
          itemEstoqueId = estoqueBase?.id || ''
        } else {
          // Todas as bases - pegar o primeiro item_estoque_id encontrado
          itemEstoqueId = estoquesDoItem[0]?.id || ''
        }
        
        console.log('🔍 [SERVICE DEBUG] itemEstoqueId final:', itemEstoqueId)

        return {
          // Dados do catálogo
          item_estoque_id: itemEstoqueId, // ID do item em itens_estoque
          item_catalogo_id: itemCatalogo.id,
          item_codigo: itemCatalogo.codigo,
          item_nome: itemCatalogo.nome,
          item_descricao: itemCatalogo.descricao,
          categoria: itemCatalogo.categoria,
          subcategoria: itemCatalogo.subcategoria,
          unidade_medida: itemCatalogo.unidade_medida,
          valor_unitario: itemCatalogo.valor_unitario,
          fornecedor: itemCatalogo.fornecedor,
          validade: itemCatalogo.validade,
          requer_certificacao: itemCatalogo.requer_certificacao,
          requer_laudo: itemCatalogo.requer_laudo,
          requer_rastreabilidade: itemCatalogo.requer_rastreabilidade,
          requer_ca: itemCatalogo.requer_ca,
          NCM: itemCatalogo.NCM,
          
          // Dados específicos da base
          base_id: baseId || 'todas',
          base_nome: baseNome,
          base_codigo: baseCodigo,
          estoque_minimo: estoqueMinimo,
          estoque_atual: estoqueAtual,
          status_estoque: 'ativo' as const,
          localizacao_base: localizacaoBase,
          observacoes_base: observacoesBase,
          
          // Para agregação (quando múltiplas bases)
          total_estoque: baseId === 'todos' ? estoqueAtual : undefined,
          total_minimo: baseId === 'todos' ? estoqueMinimo : undefined,
          bases_com_estoque: baseId === 'todos' ? basesComEstoque : undefined
        } as ItemEstoqueCompleto
      })

      return itensComEstoque
    } catch (error) {
      console.error('Erro no catalogoService.getItensCatalogoComEstoque:', error)
      throw error
    }
  },

  /**
   * Buscar itens do catálogo agregados por base (para visualização "todas as bases")
   * @param baseIds - IDs das bases para filtrar (opcional). Se não fornecido, busca todas as bases.
   */
  async getItensCatalogoAgregados(baseIds?: string[]): Promise<ItemEstoqueCompleto[]> {
    try {
      // Buscar todos os itens do catálogo
      const { data: itensCatalogo, error: catalogoError } = await supabase
        .from('itens_catalogo')
        .select('*')
        .eq('ativo', true)
        .order('nome')

      if (catalogoError) {
        console.error('Erro ao buscar itens do catálogo:', catalogoError)
        throw catalogoError
      }

      if (!itensCatalogo || itensCatalogo.length === 0) {
        return []
      }

      // Buscar estoques - filtrar por bases se fornecido
      let queryEstoque = supabase
        .from('itens_estoque')
        .select(`
          id,
          item_catalogo_id,
          base_id,
          estoque_atual,
          estoque_minimo,
          localizacao_base,
          observacoes_base,
          base:bases(nome, codigo)
        `)
        .eq('status', 'ativo')

      // Aplicar filtro de bases se fornecido
      if (baseIds && baseIds.length > 0) {
        queryEstoque = queryEstoque.in('base_id', baseIds)
      }

      const { data: todosEstoques, error: estoqueError } = await queryEstoque

      if (estoqueError) {
        console.error('Erro ao buscar estoques:', estoqueError)
        throw estoqueError
      }

      // Para cada item do catálogo, montar o resultado agregado
      const itensComEstoque = itensCatalogo.map(itemCatalogo => {
        // Filtrar estoques deste item
        const estoquesDoItem = todosEstoques?.filter(estoque => 
          estoque.item_catalogo_id === itemCatalogo.id
        ) || []

        // Agregar totais de todas as bases (filtradas)
        const estoqueAtual = estoquesDoItem.reduce((total, item) => total + (item.estoque_atual || 0), 0)
        const estoqueMinimo = estoquesDoItem.reduce((total, item) => total + (item.estoque_minimo || 0), 0)
        
        // Coletar informações de cada base
        const basesComEstoque: Array<{
          base_id: string
          base_nome: string
          estoque_atual: number
          estoque_minimo: number
        }> = []
        
        estoquesDoItem.forEach(item => {
          basesComEstoque.push({
            base_id: item.base_id,
            base_nome: (item.base as { nome?: string; codigo?: string })?.nome || '',
            estoque_atual: item.estoque_atual || 0,
            estoque_minimo: item.estoque_minimo || 0
          })
        })

        return {
          // Dados do catálogo
          item_estoque_id: estoquesDoItem[0]?.id || '',
          item_catalogo_id: itemCatalogo.id,
          item_codigo: itemCatalogo.codigo,
          item_nome: itemCatalogo.nome,
          item_descricao: itemCatalogo.descricao,
          categoria: itemCatalogo.categoria,
          subcategoria: itemCatalogo.subcategoria,
          unidade_medida: itemCatalogo.unidade_medida,
          valor_unitario: itemCatalogo.valor_unitario,
          fornecedor: itemCatalogo.fornecedor,
          validade: itemCatalogo.validade,
          requer_certificacao: itemCatalogo.requer_certificacao,
          requer_laudo: itemCatalogo.requer_laudo,
          requer_rastreabilidade: itemCatalogo.requer_rastreabilidade,
          requer_ca: itemCatalogo.requer_ca,
          NCM: itemCatalogo.NCM,
          
          // Dados agregados
          base_id: 'todas',
          base_nome: 'Todas as Bases',
          base_codigo: 'TODAS',
          estoque_minimo: estoqueMinimo,
          estoque_atual: estoqueAtual,
          status_estoque: 'ativo' as const,
          localizacao_base: '',
          observacoes_base: '',
          
          // Agregação
          total_estoque: estoqueAtual,
          total_minimo: estoqueMinimo,
          bases_com_estoque: basesComEstoque
        } as ItemEstoqueCompleto
      })

      return itensComEstoque
    } catch (error) {
      console.error('Erro no catalogoService.getItensCatalogoAgregados:', error)
      throw error
    }
  },

  /**
   * Buscar itens por categoria
   */
  async getItensPorCategoria(
    categoria: ItemCatalogo['categoria'], 
    baseId?: string
  ): Promise<ItemEstoqueCompleto[]> {
    try {
      // Buscar todos os itens e filtrar por categoria
      const todosItens = await this.getItensCatalogoComEstoque(baseId)
      
      // Filtrar por categoria
      return todosItens.filter(item => item.categoria === categoria)
    } catch (error) {
      console.error('Erro no catalogoService.getItensPorCategoria:', error)
      throw error
    }
  },

  /**
   * Buscar item específico do catálogo
   */
  async getItemCatalogo(itemId: string): Promise<ItemCatalogo | null> {
    try {
      const { data, error } = await supabase
        .from('itens_catalogo')
        .select('*')
        .eq('id', itemId)
        .eq('ativo', true)
        .single()

      if (error) {
        console.error('Erro ao buscar item do catálogo:', error)
        throw error
      }

      return data
    } catch (error) {
      console.error('Erro no catalogoService.getItemCatalogo:', error)
      throw error
    }
  },

  /**
   * Buscar itens disponíveis para uma base específica
   */
  async getItensDisponiveisParaBase(baseId: string): Promise<ItemEstoqueCompleto[]> {
    try {
      const { data, error } = await supabase.rpc('buscar_itens_disponiveis_para_base', {
        p_base_id: baseId
      })

      if (error) {
        console.error('Erro ao buscar itens disponíveis para base:', error)
        throw error
      }

      return data || []
    } catch (error) {
      console.error('Erro no catalogoService.getItensDisponiveisParaBase:', error)
      throw error
    }
  },

  /**
   * Adicionar item do catálogo a uma base
   */
  async adicionarItemABase(
    itemCatalogoId: string,
    baseId: string,
    estoqueMinimo: number = 0,
    estoqueAtual: number = 0,
    localizacaoBase?: string,
    observacoesBase?: string
  ): Promise<void> {
    try {
      // Buscar dados do catálogo para preencher campos obrigatórios
      const { data: itemCatalogo, error: catalogoError } = await supabase
        .from('itens_catalogo')
        .select('codigo, nome, categoria, unidade_medida, requer_laudo, requer_rastreabilidade, requer_ca, NCM, valor_unitario')
        .eq('id', itemCatalogoId)
        .single()

      if (catalogoError || !itemCatalogo) {
        console.error('Erro ao buscar dados do catálogo:', catalogoError)
        throw catalogoError
      }

      // Validar campos obrigatórios
      if (!itemCatalogo.codigo || !itemCatalogo.nome || !itemCatalogo.categoria) {
        throw new Error('Item do catálogo não possui todos os campos obrigatórios preenchidos')
      }

      // Inserir diretamente na tabela itens_estoque
      // Garantir valores padrão para campos que podem ser NULL
      const { error } = await supabase
        .from('itens_estoque')
        .insert({
          // Campos obrigatórios da tabela original
          codigo: itemCatalogo.codigo,
          nome: itemCatalogo.nome,
          categoria: itemCatalogo.categoria,
          unidade_medida: itemCatalogo.unidade_medida || 'UN', // Valor padrão se NULL
          requer_laudo: itemCatalogo.requer_laudo || false,
          requer_rastreabilidade: itemCatalogo.requer_rastreabilidade || false,
          requer_ca: itemCatalogo.requer_ca || false,
          NCM: itemCatalogo.NCM || null, // NCM pode ser NULL
          valor_unitario: itemCatalogo.valor_unitario || null,
          // Campos do novo sistema
          item_catalogo_id: itemCatalogoId,
          base_id: baseId,
          estoque_atual: estoqueAtual,
          estoque_minimo: estoqueMinimo,
          localizacao_base: localizacaoBase,
          observacoes_base: observacoesBase,
          status: 'ativo'
        })

      if (error) {
        console.error('Erro ao adicionar item à base:', error)
        throw error
      }
    } catch (error) {
      console.error('Erro no catalogoService.adicionarItemABase:', error)
      throw error
    }
  },

  /**
   * Calcular estatísticas do estoque baseado no catálogo
   * @param baseId - ID da base específica ou 'todos' para agregar
   * @param baseIds - IDs das bases para filtrar quando baseId for 'todos' ou undefined
   */
  async getEstatisticasEstoque(baseId?: string, baseIds?: string[]): Promise<EstoqueStatsCatalogo> {
    try {
      const itens = baseId && baseId !== 'todos' 
        ? await this.getItensCatalogoComEstoque(baseId)
        : await this.getItensCatalogoAgregados(baseIds)

      const stats: EstoqueStatsCatalogo = {
        total_itens: itens.length,
        itens_abaixo_minimo: 0,
        total_categorias: {},
        valor_total: 0,
        itens_por_base: {}
      }

      itens.forEach(item => {
        // Contar itens abaixo do mínimo
        const estoqueAtual = baseId && baseId !== 'todos' 
          ? item.estoque_atual 
          : (item.total_estoque || item.estoque_atual)
        
        const estoqueMinimo = baseId && baseId !== 'todos' 
          ? item.estoque_minimo 
          : (item.total_minimo || item.estoque_minimo)

        if (estoqueAtual < estoqueMinimo) {
          stats.itens_abaixo_minimo++
        }

        // Contar por categoria
        stats.total_categorias[item.categoria] = (stats.total_categorias[item.categoria] || 0) + 1

        // Calcular valor total
        const valorUnitario = item.valor_unitario || 0
        stats.valor_total += estoqueAtual * valorUnitario

        // Contar por base (apenas se não for agregação)
        if (baseId && baseId !== 'todos') {
          stats.itens_por_base[item.base_nome] = (stats.itens_por_base[item.base_nome] || 0) + 1
        }
      })

      return stats
    } catch (error) {
      console.error('Erro no catalogoService.getEstatisticasEstoque:', error)
      throw error
    }
  },

  /**
   * Buscar itens com estoque baixo
   * @param baseId - ID da base específica ou 'todos' para agregar
   * @param baseIds - IDs das bases para filtrar quando baseId for 'todos' ou undefined
   */
  async getItensEstoqueBaixo(baseId?: string, baseIds?: string[]): Promise<ItemEstoqueCompleto[]> {
    try {
      const itens = baseId && baseId !== 'todos' 
        ? await this.getItensCatalogoComEstoque(baseId)
        : await this.getItensCatalogoAgregados(baseIds)

      return itens.filter(item => {
        const estoqueAtual = baseId && baseId !== 'todos' 
          ? item.estoque_atual 
          : (item.total_estoque || item.estoque_atual)
        
        const estoqueMinimo = baseId && baseId !== 'todos' 
          ? item.estoque_minimo 
          : (item.total_minimo || item.estoque_minimo)

        return estoqueAtual < estoqueMinimo
      })
    } catch (error) {
      console.error('Erro no catalogoService.getItensEstoqueBaixo:', error)
      throw error
    }
  },

  /**
   * Buscar itens que requerem laudo
   * @param baseId - ID da base específica ou 'todos' para agregar
   * @param baseIds - IDs das bases para filtrar quando baseId for 'todos' ou undefined
   */
  async getItensRequeremLaudo(baseId?: string, baseIds?: string[]): Promise<ItemEstoqueCompleto[]> {
    try {
      const itens = baseId && baseId !== 'todos' 
        ? await this.getItensCatalogoComEstoque(baseId)
        : await this.getItensCatalogoAgregados(baseIds)

      return itens.filter(item => item.requer_laudo)
    } catch (error) {
      console.error('Erro no catalogoService.getItensRequeremLaudo:', error)
      throw error
    }
  },

  /**
   * Buscar todos os itens do catálogo (sem informações de estoque)
   */
  async getTodosItensCatalogo(): Promise<ItemCatalogo[]> {
    try {
      const { data, error } = await supabase
        .from('itens_catalogo')
        .select('*')
        .order('nome')

      if (error) {
        console.error('Erro ao buscar itens do catálogo:', error)
        throw error
      }

      return data || []
    } catch (error) {
      console.error('Erro no catalogoService.getTodosItensCatalogo:', error)
      throw error
    }
  },

  /**
   * Criar novo item no catálogo
   */
  async criarItemCatalogo(item: Omit<ItemCatalogo, 'id' | 'criado_em' | 'atualizado_em'>): Promise<ItemCatalogo> {
    try {
      const { data, error } = await supabase
        .from('itens_catalogo')
        .insert({
          ...item,
          ativo: item.ativo !== undefined ? item.ativo : true
        })
        .select()
        .single()

      if (error) {
        console.error('Erro ao criar item no catálogo:', error)
        throw error
      }

      return data
    } catch (error) {
      console.error('Erro no catalogoService.criarItemCatalogo:', error)
      throw error
    }
  },

  /**
   * Atualizar item do catálogo
   */
  async atualizarItemCatalogo(
    itemId: string,
    updates: Partial<Omit<ItemCatalogo, 'id' | 'criado_em' | 'atualizado_em'>>
  ): Promise<ItemCatalogo> {
    try {
      const { data, error } = await supabase
        .from('itens_catalogo')
        .update({
          ...updates,
          atualizado_em: new Date().toISOString()
        })
        .eq('id', itemId)
        .select()
        .single()

      if (error) {
        console.error('Erro ao atualizar item do catálogo:', error)
        throw error
      }

      return data
    } catch (error) {
      console.error('Erro no catalogoService.atualizarItemCatalogo:', error)
      throw error
    }
  },

  /**
   * Aplicar edições do catálogo a todas as bases que têm o item
   */
  async aplicarEdicoesABases(
    itemCatalogoId: string,
    camposParaSincronizar: Array<'codigo' | 'nome' | 'categoria' | 'unidade_medida' | 'NCM' | 'requer_laudo' | 'valor_unitario'>
  ): Promise<{ basesAtualizadas: number }> {
    try {
      // Buscar dados atualizados do catálogo
      const { data: itemCatalogo, error: catalogoError } = await supabase
        .from('itens_catalogo')
        .select('codigo, nome, categoria, unidade_medida, NCM, requer_laudo, requer_rastreabilidade, requer_ca, valor_unitario')
        .eq('id', itemCatalogoId)
        .single()

      if (catalogoError || !itemCatalogo) {
        console.error('Erro ao buscar item do catálogo:', catalogoError)
        throw catalogoError
      }

      // Preparar objeto de atualização
      const updates: Record<string, string | number | boolean | null> = {}
      if (camposParaSincronizar.includes('codigo')) {
        updates.codigo = itemCatalogo.codigo
      }
      if (camposParaSincronizar.includes('nome')) {
        updates.nome = itemCatalogo.nome
      }
      if (camposParaSincronizar.includes('categoria')) {
        updates.categoria = itemCatalogo.categoria
      }
      if (camposParaSincronizar.includes('unidade_medida')) {
        updates.unidade_medida = itemCatalogo.unidade_medida
      }
      if (camposParaSincronizar.includes('NCM')) {
        updates.NCM = itemCatalogo.NCM
      }
      if (camposParaSincronizar.includes('valor_unitario')) {
        updates.valor_unitario = itemCatalogo.valor_unitario
      }
      
      // SEMPRE atualizar campos de exigência, mesmo que não estejam explicitamente na lista
      updates.requer_laudo = itemCatalogo.requer_laudo
      updates.requer_rastreabilidade = itemCatalogo.requer_rastreabilidade
      updates.requer_ca = itemCatalogo.requer_ca

      updates.atualizado_em = new Date().toISOString()

      // Atualizar todos os itens_estoque que referenciam este item do catálogo
      const { data, error } = await supabase
        .from('itens_estoque')
        .update(updates)
        .eq('item_catalogo_id', itemCatalogoId)
        .select('id')

      if (error) {
        console.error('Erro ao aplicar edições às bases:', error)
        throw error
      }

      return {
        basesAtualizadas: data?.length || 0
      }
    } catch (error) {
      console.error('Erro no catalogoService.aplicarEdicoesABases:', error)
      throw error
    }
  },

  /**
   * Buscar bases que têm um item específico vinculado
   */
  async getBasesComItem(itemCatalogoId: string): Promise<Array<{
    base_id: string
    base_nome: string
    base_codigo: string
    estoque_atual: number
  }>> {
    try {
      const { data, error } = await supabase
        .from('itens_estoque')
        .select(`
          base_id,
          estoque_atual,
          base:bases(id, nome, codigo)
        `)
        .eq('item_catalogo_id', itemCatalogoId)
        .eq('status', 'ativo')

      if (error) {
        console.error('Erro ao buscar bases com item:', error)
        throw error
      }

      return (data || []).map(item => ({
        base_id: item.base_id,
        base_nome: (item.base as unknown as Base)?.nome || 'Base desconhecida',
        base_codigo: (item.base as unknown as Base)?.codigo || '',
        estoque_atual: item.estoque_atual || 0
      }))
    } catch (error) {
      console.error('Erro no catalogoService.getBasesComItem:', error)
      throw error
    }
  },

  /**
   * Sincronizar todos os itens do catálogo com uma base específica
   * PASSO 1: Vincular todos os itens não vinculados usando adicionarItemABase (mesma função da linha do item)
   * PASSO 2: Sincronizar campos de todos os itens vinculados
   */
  async sincronizarTodosItensComBase(baseId: string): Promise<{
    success: boolean
    base_id: string
    total_itens_catalogo: number
    itens_ja_vinculados: number
    itens_vinculados: number
    message: string
  }> {
    try {
      // PASSO 1: Buscar todos os itens ativos do catálogo
      const { data: itensCatalogo, error: catalogoError } = await supabase
        .from('itens_catalogo')
        .select('id')
        .eq('ativo', true)

      if (catalogoError) {
        console.error('Erro ao buscar itens do catálogo:', catalogoError)
        throw catalogoError
      }

      const totalItensCatalogo = itensCatalogo?.length || 0

      // PASSO 2: Buscar itens já vinculados a esta base
      const { data: itensJaVinculados, error: vinculadosError } = await supabase
        .from('itens_estoque')
        .select('item_catalogo_id')
        .eq('base_id', baseId)
        .eq('status', 'ativo')

      if (vinculadosError) {
        console.error('Erro ao buscar itens vinculados:', vinculadosError)
        throw vinculadosError
      }

      const idsJaVinculados = new Set(itensJaVinculados?.map(item => item.item_catalogo_id) || [])

      // PASSO 3: Vincular itens não vinculados em lote
      const itensParaVincular = itensCatalogo?.filter(item => !idsJaVinculados.has(item.id)) || []
      let itensVinculados = 0

      if (itensParaVincular.length > 0) {
        console.log(`🔄 [SINCRONIZAÇÃO] Base nova detectada! Vinculando ${itensParaVincular.length} itens do catálogo...`)
        
        // Buscar dados completos dos itens do catálogo em lotes para evitar URL muito longa
        const batchSize = 50 // Processar em lotes de 50 itens
        let itensCatalogoCompletos: Pick<ItemCatalogo, 'id' | 'codigo' | 'nome' | 'categoria' | 'unidade_medida' | 'requer_laudo' | 'requer_rastreabilidade' | 'requer_ca' | 'NCM' | 'valor_unitario'>[] = []
        const totalBatches = Math.ceil(itensParaVincular.length / batchSize)
        
        for (let i = 0; i < itensParaVincular.length; i += batchSize) {
          const batch = itensParaVincular.slice(i, i + batchSize)
          const batchIds = batch.map(item => item.id)
          const currentBatch = Math.floor(i / batchSize) + 1
          
          console.log(`📦 [SINCRONIZAÇÃO] Processando lote ${currentBatch}/${totalBatches} (${batch.length} itens)`)
          
          const { data: batchData, error: batchError } = await supabase
            .from('itens_catalogo')
            .select('id, codigo, nome, categoria, unidade_medida, requer_laudo, requer_rastreabilidade, requer_ca, NCM, valor_unitario')
            .in('id', batchIds)
            .eq('ativo', true)

          if (batchError) {
            console.error(`Erro ao buscar lote ${currentBatch} do catálogo:`, batchError)
            throw batchError
          }
          
          if (batchData) {
            itensCatalogoCompletos = [...itensCatalogoCompletos, ...batchData]
            console.log(`✅ [SINCRONIZAÇÃO] Lote ${currentBatch}/${totalBatches} concluído`)
          }
        }

        // Preparar dados para inserção em lote
        const itensParaInserir = (itensCatalogoCompletos || [])
          .filter(item => item.codigo && item.nome && item.categoria) // Filtrar apenas itens válidos
          .map(item => ({
            item_catalogo_id: item.id,
            base_id: baseId,
            codigo: item.codigo,
            nome: item.nome,
            categoria: item.categoria,
            unidade_medida: item.unidade_medida || 'UN', // Valor padrão se NULL
            requer_laudo: item.requer_laudo || false,
            requer_rastreabilidade: item.requer_rastreabilidade || false,
            requer_ca: item.requer_ca || false,
            NCM: item.NCM || null,
            valor_unitario: item.valor_unitario || null,
            estoque_atual: 0,
            estoque_minimo: 0,
            status: 'ativo' as const
          }))

        if (itensParaInserir.length > 0) {
          // Inserir em lotes de 100 para evitar timeout
          const batchSize = 100
          for (let i = 0; i < itensParaInserir.length; i += batchSize) {
            const batch = itensParaInserir.slice(i, i + batchSize)
            const { error: insertError } = await supabase
              .from('itens_estoque')
              .insert(batch)

            if (insertError) {
              console.error(`Erro ao inserir lote ${i / batchSize + 1}:`, insertError)
              // Erro já logado, continuar com próximo lote
            } else {
              itensVinculados += batch.length
            }
          }
        }
      }

      // PASSO 4: Sincronizar campos de TODOS os itens vinculados (novos e existentes)
      const { data: itensEstoque, error: estoqueError } = await supabase
        .from('itens_estoque')
        .select(`
          id,
          item_catalogo_id,
          item_catalogo:itens_catalogo!item_catalogo_id(codigo, nome, categoria, unidade_medida, requer_laudo, NCM, valor_unitario)
        `)
        .eq('base_id', baseId)
        .eq('status', 'ativo')

      if (estoqueError) {
        console.error('Erro ao buscar itens de estoque para sincronizar:', estoqueError)
        // Não falhar a sincronização se houver erro ao buscar
      } else if (itensEstoque && itensEstoque.length > 0) {
        // Atualizar campos sincronizáveis de cada item de estoque com os valores do catálogo
        const updates = itensEstoque.map(item => {
          const catalogo = item.item_catalogo as unknown as { 
            codigo?: string | null
            nome?: string | null
            categoria?: string | null
            unidade_medida?: string | null
            requer_laudo?: boolean | null
            NCM?: number | null
            valor_unitario?: number | null
          }
          
          // Só atualizar campos que têm valores válidos no catálogo
          const updateData: Record<string, unknown> = {
            atualizado_em: new Date().toISOString()
          }
          
          if (catalogo.codigo) updateData.codigo = catalogo.codigo
          if (catalogo.nome) updateData.nome = catalogo.nome
          if (catalogo.categoria) updateData.categoria = catalogo.categoria
          if (catalogo.unidade_medida) updateData.unidade_medida = catalogo.unidade_medida
          updateData.requer_laudo = catalogo.requer_laudo ?? false
          updateData.NCM = catalogo.NCM ?? null
          updateData.valor_unitario = catalogo.valor_unitario ?? null
          
          return supabase
            .from('itens_estoque')
            .update(updateData)
            .eq('id', item.id)
        })

        // Executar todas as atualizações em paralelo
        const results = await Promise.allSettled(updates)
        const errors = results.filter(r => r.status === 'rejected')
        
        if (errors.length > 0) {
          console.warn(`Aviso: ${errors.length} item(ns) não tiveram campos sincronizados`)
        } else {
          console.log(`✅ Campos sincronizados para ${itensEstoque.length} item(ns)`)
        }
      }

      // Retornar resultado
      const message = itensParaVincular.length > 0 
        ? `✅ Base nova configurada! Vinculados ${itensVinculados} itens do catálogo à base ${baseId}. ${idsJaVinculados.size} itens já estavam vinculados.`
        : `Base ${baseId} já está sincronizada. Todos os ${totalItensCatalogo} itens do catálogo já estão vinculados.`

      return {
        success: true,
        base_id: baseId,
        total_itens_catalogo: totalItensCatalogo,
        itens_ja_vinculados: idsJaVinculados.size,
        itens_vinculados: itensVinculados,
        message
      }
    } catch (error) {
      console.error('Erro no catalogoService.sincronizarTodosItensComBase:', error)
      throw error
    }
  }
}
