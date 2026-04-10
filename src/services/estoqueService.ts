import { supabase } from '@/lib/supabase'
import type {
  ItemEstoque,
  MovimentacaoEstoque,
  RelatorioEstoque,
  SolicitacaoItem,
  HistoricoFuncionario,
  NotaFiscal,
  ItemNotaFiscal
} from '@/types'

interface SupabaseError {
  message?: string;
  details?: string;
  hint?: string;
  code?: string;
}

// Utility function to serialize errors for better logging
function serializeError(error: unknown): Record<string, unknown> {
  if (!error) return { message: 'No error provided' }
  
// Handle Supabase errors
  if ((error as SupabaseError).message || (error as SupabaseError).details || (error as SupabaseError).hint || (error as SupabaseError).code) {
    return {
      message: (error as SupabaseError).message,
      details: (error as SupabaseError).details,
      hint: (error as SupabaseError).hint,
      code: (error as SupabaseError).code,
      fullError: error
    }
  }
  
  // Handle standard JavaScript errors
  if (error instanceof Error) {
    return {
      message: error.message,
      stack: error.stack,
      name: error.name,
      fullError: error
    }
  }
  
  // Handle other types of errors
  return {
    message: (error as Error)?.message || 'Erro desconhecido',
    stack: (error as Error)?.stack,
    name: (error as Error)?.name,
    fullError: error
  }
}

// Interface for RPC function return data
// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface SolicitacaoReativada {
  item_nome: string
  estoque_atual: number
  quantidade_necessaria: number
}

export interface EstoqueStats {
  // Estatísticas básicas
  total_itens: number
  itens_baixo_estoque: number
  itens_criticos: number
  valor_total_estoque: number
  
  // Estatísticas por categoria
  estatisticas_por_categoria: Record<string, {
    total: number
    baixo_estoque: number
    criticos: number
    valor_total: number
  }>
  
  // Solicitações
  solicitacoes_pendentes: number
  solicitacoes_aprovadas: number
  solicitacoes_entregues_hoje: number
  
  // Movimentações
  movimentacoes_hoje: number
  movimentacoes_mes: number
  
  // Inventário
  itens_em_inventario: number
  funcionarios_com_inventario: number
  
  // Histórico
  historico_entregas_hoje: number
  historico_entregas_mes: number
  
  // Timestamps
  atualizado_em: string
  periodo_consulta: {
    hoje: string
    inicio_mes: string
  }
}

export const estoqueService = {
  // ============================================================================
  // ESTOQUE POR BASE
  // ============================================================================

  async getEstoquePorBase(baseId: string): Promise<ItemEstoque[]> {
    const { data, error } = await supabase
      .from('itens_estoque')
      .select(`
        *,
        base:bases(*),
        item_catalogo:itens_catalogo!item_catalogo_id(requer_laudo, codigo, nome, categoria)
      `)
      .eq('base_id', baseId)
      .eq('status', 'ativo')
      .order('nome');

    if (error) throw error;

    // Mapear os dados para incluir requer_laudo do catálogo
    interface ItemComCatalogo extends ItemEstoque {
      item_catalogo?: {
        requer_laudo?: boolean
        codigo?: string
        nome?: string
        categoria?: string
      } | null
    }

    const itensMapeados = (data || [] as ItemComCatalogo[]).map((item) => {
      const itemCatalogo = item.item_catalogo as { requer_laudo?: boolean; codigo?: string; nome?: string; categoria?: string } | null;
      
      return {
        ...item,
        requer_laudo: itemCatalogo?.requer_laudo || item.requer_laudo || false,
        codigo: itemCatalogo?.codigo || item.codigo,
        nome: itemCatalogo?.nome || item.nome,
        categoria: itemCatalogo?.categoria || item.categoria,
      };
    }).sort((a, b) => {
      const nomeA = a.nome || '';
      const nomeB = b.nome || '';
      return nomeA.localeCompare(nomeB);
    });

    return itensMapeados;
  },

  async getItensPorCategoria(categoria: ItemEstoque['categoria'], baseId?: string): Promise<ItemEstoque[]> {
    let query = supabase
      .from('itens_estoque')
      .select(`
        *,
        base:bases(*),
        item_catalogo:itens_catalogo!item_catalogo_id(requer_laudo, codigo, nome, categoria)
      `)
      .eq('status', 'ativo');

    if (baseId) {
      query = query.eq('base_id', baseId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Erro ao buscar itens por categoria:', error);
      throw error;
    }

    // Mapear os dados para incluir requer_laudo do catálogo e filtrar por categoria
    interface ItemComCatalogo extends ItemEstoque {
      item_catalogo?: {
        requer_laudo?: boolean
        codigo?: string
        nome?: string
        categoria?: string
      } | null
    }

    const itensMapeados = (data || [] as ItemComCatalogo[]).map((item) => {
      const itemCatalogo = item.item_catalogo as { requer_laudo?: boolean; codigo?: string; nome?: string; categoria?: string } | null;
      const categoriaItem = itemCatalogo?.categoria || item.categoria;
      
      // Filtrar por categoria (pode vir do catálogo ou do estoque)
      if (categoriaItem !== categoria) {
        return null;
      }

      return {
        ...item,
        requer_laudo: itemCatalogo?.requer_laudo || item.requer_laudo || false,
        codigo: itemCatalogo?.codigo || item.codigo,
        nome: itemCatalogo?.nome || item.nome,
        categoria: categoriaItem,
      };
    }).filter((item): item is ItemEstoque => item !== null)
      .sort((a, b) => {
        const nomeA = a.nome || '';
        const nomeB = b.nome || '';
        return nomeA.localeCompare(nomeB);
      });

    return itensMapeados;
  },

  // ============================================================================
  // CRUD OPERATIONS
  // ============================================================================

  async createItem(itemData: Omit<ItemEstoque, 'id' | 'criado_em' | 'atualizado_em'>): Promise<ItemEstoque> {
    const { data, error } = await supabase
      .from('itens_estoque')
      .insert({
        ...itemData,
        criado_em: new Date().toISOString(),
        atualizado_em: new Date().toISOString()
      })
      .select(`
        *,
        base:bases(*)
      `)
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Criar item no estoque a partir de um item do catálogo
   */
  async createItemFromCatalogo(itemCatalogoId: string, baseId: string): Promise<ItemEstoque> {
    try {
      // Buscar dados do item do catálogo
      const { data: itemCatalogo, error: catalogoError } = await supabase
        .from('itens_catalogo')
        .select('*')
        .eq('id', itemCatalogoId)
        .single()

      if (catalogoError) {
        console.error('Erro ao buscar item do catálogo:', catalogoError)
        throw catalogoError
      }

      if (!itemCatalogo) {
        throw new Error('Item do catálogo não encontrado')
      }

      // Criar item no estoque com estoque zero
      // Estoque mínimo e máximo devem ser definidos por base, não vêm do catálogo
      const itemEstoqueData = {
        item_catalogo_id: itemCatalogoId,
        base_id: baseId,
        codigo: itemCatalogo.codigo,
        nome: itemCatalogo.nome,
        descricao: itemCatalogo.descricao,
        categoria: itemCatalogo.categoria,
        subcategoria: itemCatalogo.subcategoria,
        unidade_medida: itemCatalogo.unidade_medida,
        estoque_minimo: 0, // Estoque mínimo é definido por base, não vem do catálogo
        estoque_atual: 0, // Estoque zero inicial
        valor_unitario: itemCatalogo.valor_unitario,
        fornecedor: itemCatalogo.fornecedor,
        localizacao: itemCatalogo.localizacao,
        status: 'ativo' as const,
        requer_certificacao: itemCatalogo.requer_certificacao || false,
        requer_laudo: itemCatalogo.requer_laudo || false,
        validade: itemCatalogo.validade,
        observacoes: `Item criado automaticamente a partir do catálogo em ${new Date().toLocaleDateString()}`
      }

      const { data, error } = await supabase
        .from('itens_estoque')
        .insert({
          ...itemEstoqueData,
          criado_em: new Date().toISOString(),
          atualizado_em: new Date().toISOString()
        })
        .select(`
          *,
          base:bases(*)
        `)
        .single()

      if (error) {
        console.error('Erro ao criar item no estoque:', error)
        throw error
      }

      console.log('✅ Item criado no estoque com sucesso:', data)
      return data
    } catch (error) {
      console.error('Erro no createItemFromCatalogo:', error)
      throw error
    }
  },

  async updateItem(itemId: string, updates: Partial<ItemEstoque>): Promise<ItemEstoque> {
    const { data, error } = await supabase
      .from('itens_estoque')
      .update({
        ...updates,
        atualizado_em: new Date().toISOString()
      })
      .eq('id', itemId)
      .select(`
        *,
        base:bases(*)
      `)
      .single();

    if (error) throw error;
    return data;
  },

  async deleteItem(itemId: string): Promise<void> {
    const { error } = await supabase
      .from('itens_estoque')
      .delete()
      .eq('id', itemId);

    if (error) throw error;
  },

  async transferirItemEntreBases(
    itemId: string,
    baseOrigemId: string,
    baseId: string,
    quantidade: number,
    usuarioId: string,
    motivo: string
  ): Promise<void> {
    const { error } = await supabase.rpc('transferir_item_entre_bases', {
      p_item_id: itemId,
      p_base_origem_id: baseOrigemId,
      p_base_id: baseId,
      p_quantidade: quantidade,
      p_usuario_id: usuarioId,
      p_motivo: motivo
    });

    if (error) throw error;
  },

  async getRelatorioEstoqueBases(): Promise<{
    base_nome: string;
    base_codigo: string;
    total_itens: number;
    itens_baixo_estoque: number;
    valor_total_estoque: number;
  }[]> {
    const { data, error } = await supabase.rpc('relatorio_estoque_bases');

    if (error) throw error;
    return data || [];
  },

  async getMovimentacoesPorBase(baseId: string): Promise<MovimentacaoEstoque[]> {
    const { data, error } = await supabase
      .from('movimentacoes_estoque')
      .select(`
        *,
        item:itens_estoque!item_id(id, codigo, nome, categoria, unidade_medida, estoque_atual, estoque_minimo, requer_laudo),
        usuario:usuarios!movimentacoes_estoque_usuario_id_fkey(id, nome),
        base:bases(*)
      `)
      .eq('base_id', baseId)
      .order('criado_em', { ascending: false })
      .limit(100);

    if (error) throw error;
    return data || [];
  },

  async createItemEstoque(item: Omit<ItemEstoque, 'id' | 'criado_em' | 'atualizado_em'>): Promise<ItemEstoque> {
    const { data, error } = await supabase
      .from('itens_estoque')
      .insert([item])
      .select(`
        *,
        base:bases(*)
      `)
      .single();

    if (error) throw error;
    return data;
  },

  async getRelatorioEstoque(): Promise<RelatorioEstoque[]> {
    const { data, error } = await supabase
      .from('itens_estoque')
      .select(`
        id, codigo, nome, categoria, estoque_atual, estoque_minimo,
        valor_unitario, criado_em
      `)
      .eq('status', 'ativo')
      .order('nome')

    if (error) throw error

    const base = data || []

    const itensComMov = await Promise.all(
      base.map(async (item) => {
        const { data: lastMov } = await supabase
          .from('movimentacoes_estoque')
          .select('criado_em')
          .eq('item_id', item.id)
          .order('criado_em', { ascending: false })
          .limit(1)
          .single()

        const ultima = lastMov?.criado_em
        const diasSemMov = ultima
          ? Math.floor((Date.now() - new Date(ultima).getTime()) / (1000 * 60 * 60 * 24))
          : undefined

        let status: RelatorioEstoque['status_estoque']
        if (item.estoque_atual === 0) status = 'zerado'
        else if (item.estoque_atual <= item.estoque_minimo * 0.5) status = 'critico'
        else if (item.estoque_atual <= item.estoque_minimo) status = 'baixo'
        else status = 'normal'

        return {
          item_id: item.id,
          codigo: item.codigo,
          nome: item.nome,
          categoria: item.categoria,
          estoque_atual: item.estoque_atual,
          estoque_minimo: item.estoque_minimo,
          valor_unitario: item.valor_unitario,
          valor_total: item.estoque_atual * (item.valor_unitario || 0),
          status_estoque: status,
          ultima_movimentacao: ultima,
          dias_sem_movimentacao: diasSemMov,
        } as RelatorioEstoque
      })
    )

    return itensComMov
  },

  async atualizarEstoqueMinimo(itemId: string, estoqueMinimo: number): Promise<void> {
    const { error } = await supabase
      .from('itens_estoque')
      .update({ 
        estoque_minimo: estoqueMinimo,
        atualizado_em: new Date().toISOString()
      })
      .eq('id', itemId)

    if (error) throw error
  },

  async uploadEvidencia(file: File): Promise<string> {
    const timestamp = Date.now()
    const sanitized = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
    const fileName = `${timestamp}_${sanitized}`

    const { data, error } = await supabase.storage
      .from('solicitacao-evidencias')
      .upload(fileName, file, {
        contentType: file.type || 'application/octet-stream',
        upsert: false,
      })

    if (error) throw error

    const { data: urlData } = supabase.storage
      .from('solicitacao-evidencias')
      .getPublicUrl(data.path)

    return urlData.publicUrl
  },

  async getHistoricoFuncionario(funcionarioId: string): Promise<HistoricoFuncionario[]> {
    const { data, error } = await supabase
      .from('historico_funcionarios')
      .select(`
        id, funcionario_id, item_id, quantidade, tipo_movimentacao, data_entrega,
        data_devolucao, status, condicao_entrega, condicao_devolucao,
        observacoes_entrega, observacoes_devolucao, responsavel_entrega,
        responsavel_devolucao, solicitante_original_id, criado_em, atualizado_em,
        item:itens_estoque!inner(
          id, codigo, nome, categoria, unidade_medida
        ),
        solicitante_original:usuarios!historico_funcionarios_solicitante_original_id_fkey(id, nome, matricula),
        responsavel_entrega_usuario:usuarios!historico_funcionarios_responsavel_entrega_fkey(id, nome, matricula),
        responsavel_devolucao_usuario:usuarios!historico_funcionarios_responsavel_devolucao_fkey(id, nome, matricula)
      `)
      .eq('funcionario_id', funcionarioId)
      .order('criado_em', { ascending: false })

    if (error) throw error
    
    // Transformar os dados para garantir que o tipo esteja correto
    interface HistoricoRow {
      solicitante_original?: Array<{ id: string; nome: string; matricula?: string }> | { id: string; nome: string; matricula?: string };
      responsavel_entrega?: string;
      responsavel_entrega_usuario?: Array<{ id: string; nome: string; matricula?: string }> | { id: string; nome: string; matricula?: string } | null;
      responsavel_devolucao?: string;
      responsavel_devolucao_usuario?: Array<{ id: string; nome: string; matricula?: string }> | { id: string; nome: string; matricula?: string } | null;
      [key: string]: unknown;
    }

    return (data || []).map((item: HistoricoRow) => {
      const solicitante = Array.isArray(item.solicitante_original) 
        ? item.solicitante_original[0] 
        : item.solicitante_original;
      
      const responsavelEntrega = Array.isArray(item.responsavel_entrega_usuario)
        ? item.responsavel_entrega_usuario[0]
        : item.responsavel_entrega_usuario;
      
      const responsavelDevolucao = Array.isArray(item.responsavel_devolucao_usuario)
        ? item.responsavel_devolucao_usuario[0]
        : item.responsavel_devolucao_usuario;

      return {
        ...item,
        solicitante_original: solicitante,
        responsavel_entrega: responsavelEntrega?.nome || item.responsavel_entrega || '-',
        responsavel_devolucao: responsavelDevolucao?.nome || item.responsavel_devolucao || '-'
      };
    }) as HistoricoFuncionario[]
  },

  async getMovimentacoesPorFuncionario(funcionarioId: string): Promise<MovimentacaoEstoque[]> {
    const { data, error } = await supabase
      .from('movimentacoes_estoque')
      .select(`
        id, item_id, tipo, quantidade, quantidade_anterior, quantidade_atual,
        motivo, documento_referencia, usuario_id, solicitante_id, local_origem,
        local_destino, base_id, observacoes, criado_em, itens_estoque!inner(
          id, codigo, nome, categoria, unidade_medida
        )
      `)
      .eq('usuario_id', funcionarioId)
      .order('criado_em', { ascending: false })

    if (error) throw error
    return data || []
  },

  async getMovimentacoesPorPeriodo(dataInicio: string, dataFim: string): Promise<MovimentacaoEstoque[]> {
    const { data, error } = await supabase
      .from('movimentacoes_estoque')
      .select(`
        *,
        item:itens_estoque!item_id(id, codigo, nome, categoria, unidade_medida, estoque_atual, estoque_minimo, requer_laudo, valor_unitario),
        usuario:usuarios!movimentacoes_estoque_usuario_id_fkey(*),
        solicitante:usuarios!movimentacoes_estoque_solicitante_id_fkey(*),
        base:bases(*)
      `)
      .gte('criado_em', `${dataInicio}T00:00:00.000Z`)
      .lte('criado_em', `${dataFim}T23:59:59.999Z`)
      .order('criado_em', { ascending: false })

    if (error) throw error
    return data || []
  },

  /**
   * Obter estatísticas completas do estoque
   */
  async getEstatisticas(): Promise<EstoqueStats> {
    const hoje = new Date().toISOString().split('T')[0]
    const inicioMes = new Date().toISOString().split('T')[0].substring(0, 7) + '-01'

    console.log('📊 [WEB] Buscando estatísticas completas do estoque...')

    try {
      // Buscar todos os itens ativos para fazer comparações no JavaScript
      const { data: itensAtivos, error: itensError } = await supabase
        .from('itens_estoque')
        .select('id, estoque_atual, estoque_minimo, valor_unitario, categoria')
        .eq('status', 'ativo')

      if (itensError) {
        console.error('❌ [WEB] Erro ao buscar itens do estoque:', itensError)
        throw itensError
      }

      // Calcular estatísticas básicas no JavaScript
      const totalItens = itensAtivos?.length || 0
      const itensBaixoEstoque = itensAtivos?.filter(item => 
        item.estoque_atual <= item.estoque_minimo
      ).length || 0
      const itensCriticos = itensAtivos?.filter(item => 
        item.estoque_atual === 0
      ).length || 0

      // Calcular valor total do estoque
      const valorTotal = itensAtivos?.reduce((acc, item) => {
        return acc + (item.estoque_atual * (item.valor_unitario || 0))
      }, 0) || 0

      // Estatísticas por categoria
      const estatisticasPorCategoria = itensAtivos?.reduce((acc, item) => {
        if (!acc[item.categoria]) {
          acc[item.categoria] = {
            total: 0,
            baixo_estoque: 0,
            criticos: 0,
            valor_total: 0
          }
        }
        acc[item.categoria].total++
        if (item.estoque_atual <= item.estoque_minimo) {
          acc[item.categoria].baixo_estoque++
        }
        if (item.estoque_atual === 0) {
          acc[item.categoria].criticos++
        }
        acc[item.categoria].valor_total += item.estoque_atual * (item.valor_unitario || 0)
        return acc
      }, {} as Record<string, { total: number; baixo_estoque: number; criticos: number; valor_total: number }>) || {}

      // Buscar outras estatísticas do backend
      const queries = await Promise.all([
        // Solicitações pendentes
        supabase
          .from('solicitacoes_itens')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'pendente'),
        
        // Solicitações aprovadas
        supabase
          .from('solicitacoes_itens')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'aprovada'),
        
        // Solicitações entregues hoje
        supabase
          .from('solicitacoes_itens')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'entregue')
          .gte('entregue_em', hoje),
        
        // Movimentações hoje
        supabase
          .from('movimentacoes_estoque')
          .select('id', { count: 'exact', head: true })
          .gte('criado_em', hoje),
        
        // Movimentações este mês
        supabase
          .from('movimentacoes_estoque')
          .select('id', { count: 'exact', head: true })
          .gte('criado_em', inicioMes),
        
        // Itens em inventário de funcionários
        supabase
          .from('inventario_funcionario')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'em_uso'),
        
        // Funcionários com itens em inventário
        supabase
          .from('inventario_funcionario')
          .select('funcionario_id', { count: 'exact', head: true })
          .eq('status', 'em_uso')
          .not('funcionario_id', 'is', null),
        
        // Histórico de entregas hoje
        supabase
          .from('historico_funcionarios')
          .select('id', { count: 'exact', head: true })
          .eq('tipo_movimentacao', 'entrega')
          .gte('data_entrega', hoje),
        
        // Histórico de entregas este mês
        supabase
          .from('historico_funcionarios')
          .select('id', { count: 'exact', head: true })
          .eq('tipo_movimentacao', 'entrega')
          .gte('data_entrega', inicioMes)
      ])

      const [
        solicitacoesPendentes,
        solicitacoesAprovadas,
        solicitacoesEntreguesHoje,
        movimentacoesHoje,
        movimentacoesMes,
        itensInventario,
        funcionariosComInventario,
        historicoEntregasHoje,
        historicoEntregasMes
      ] = queries

      console.log('✅ [WEB] Estatísticas carregadas com sucesso')

      return {
        // Estatísticas básicas
        total_itens: totalItens,
        itens_baixo_estoque: itensBaixoEstoque,
        itens_criticos: itensCriticos,
        valor_total_estoque: valorTotal,
        
        // Estatísticas por categoria
        estatisticas_por_categoria: estatisticasPorCategoria,
        
        // Solicitações
        solicitacoes_pendentes: solicitacoesPendentes.count || 0,
        solicitacoes_aprovadas: solicitacoesAprovadas.count || 0,
        solicitacoes_entregues_hoje: solicitacoesEntreguesHoje.count || 0,
        
        // Movimentações
        movimentacoes_hoje: movimentacoesHoje.count || 0,
        movimentacoes_mes: movimentacoesMes.count || 0,
        
        // Inventário
        itens_em_inventario: itensInventario.count || 0,
        funcionarios_com_inventario: funcionariosComInventario.count || 0,
        
        // Histórico
        historico_entregas_hoje: historicoEntregasHoje.count || 0,
        historico_entregas_mes: historicoEntregasMes.count || 0,
        
        // Timestamps
        atualizado_em: new Date().toISOString(),
        periodo_consulta: {
          hoje,
          inicio_mes: inicioMes
        }
      }
    } catch (error) {
      console.error('❌ [WEB] Erro ao buscar estatísticas:', error)
      throw error
    }
  },

  async criarSolicitacao(params: {
    item_id: string
    solicitante_id: string // Quem está fazendo a solicitação
    destinatario_id: string // Quem vai receber o item
    base_id: string // Base de onde puxar o estoque
    quantidade_solicitada: number
    prioridade: SolicitacaoItem['prioridade']
    tipo_troca: SolicitacaoItem['tipo_troca']
    motivo_solicitacao: string
    evidenciaFile?: File
    assinatura_digital?: string
    assinatura_nome?: string
    data_necessidade?: string
    observacoes?: string
  }): Promise<SolicitacaoItem> {
    let evidencia_url: string | undefined
    let evidencia_tipo: 'foto' | 'arquivo' | undefined

    if (params.evidenciaFile) {
      evidencia_url = await this.uploadEvidencia(params.evidenciaFile)
      evidencia_tipo = params.evidenciaFile.type?.startsWith('image/') ? 'foto' : 'arquivo'
    }

    const insertData: Record<string, unknown> = {
      item_id: params.item_id,
      solicitante_id: params.solicitante_id, // Quem está fazendo a solicitação
      destinatario_id: params.destinatario_id, // Quem vai receber o item
      base_id: params.base_id, // Base de onde puxar o estoque
      quantidade_solicitada: params.quantidade_solicitada,
      prioridade: params.prioridade,
      tipo_troca: params.tipo_troca,
      motivo_solicitacao: params.motivo_solicitacao,
      assinatura_digital: params.assinatura_digital,
      assinatura_nome: params.assinatura_nome,
    }

    if (evidencia_url) {
      insertData.evidencia_url = evidencia_url
      insertData.evidencia_tipo = evidencia_tipo
    }
    if (params.data_necessidade) insertData.data_necessidade = params.data_necessidade
    if (params.observacoes) insertData.observacoes = params.observacoes

    const { data, error } = await supabase
      .from('solicitacoes_itens')
      .insert(insertData)
      .select('*')
      .single()

    if (error) throw error
    return data as unknown as SolicitacaoItem
  },

  async criarSolicitacaoEquipe(params: {
    item_id: string
    solicitante_id: string
    destinatario_equipe_id: string
    responsavel_equipe_id: string
    base_id: string
    quantidade_solicitada: number
    prioridade: SolicitacaoItem['prioridade']
    tipo_troca: SolicitacaoItem['tipo_troca']
    motivo_solicitacao: string
    observacoes?: string
    tipo_solicitacao?: string
  }): Promise<SolicitacaoItem> {
    console.log('🔄 [SERVICE] Criando solicitação de equipe:', params)
    
    const insertData = {
      item_id: params.item_id,
      solicitante_id: params.solicitante_id,
      destinatario_equipe_id: params.destinatario_equipe_id,
      responsavel_equipe_id: params.responsavel_equipe_id,
      base_id: params.base_id,
      quantidade_solicitada: params.quantidade_solicitada,
      prioridade: params.prioridade,
      tipo_troca: params.tipo_troca,
      motivo_solicitacao: params.motivo_solicitacao,
      observacoes: params.observacoes,
      tipo_solicitacao: params.tipo_solicitacao || 'individual'
    }

    console.log('📦 [SERVICE] Dados para inserção:', insertData)

    // Tentar inserção sem select primeiro para evitar triggers
    const { error: insertError } = await supabase
      .from('solicitacoes_itens')
      .insert(insertData)

    if (insertError) {
      console.error('❌ [SERVICE] Erro ao inserir solicitação de equipe:', insertError)
      throw insertError
    }

    // Buscar a solicitação criada separadamente
    const { data, error: selectError } = await supabase
      .from('solicitacoes_itens')
      .select('id, item_id, solicitante_id, destinatario_equipe_id, responsavel_equipe_id, base_id, quantidade_solicitada, prioridade, tipo_troca, motivo_solicitacao, observacoes, tipo_solicitacao, status, criado_em')
      .eq('item_id', insertData.item_id)
      .eq('solicitante_id', insertData.solicitante_id)
      .eq('destinatario_equipe_id', insertData.destinatario_equipe_id)
      .eq('responsavel_equipe_id', insertData.responsavel_equipe_id)
      .order('criado_em', { ascending: false })
      .limit(1)
      .single()

    if (selectError) {
      console.error('❌ [SERVICE] Erro ao buscar solicitação criada:', selectError)
      throw selectError
    }
    
    console.log('✅ [SERVICE] Solicitação de equipe criada:', data)
    return data as unknown as SolicitacaoItem
  },

  async getSolicitacaoById(id: string): Promise<SolicitacaoItem> {
    const { data: solicitacao, error } = await supabase
      .from('solicitacoes_itens')
      .select(`
        *,
        item:itens_estoque!item_id(id, codigo, nome, categoria, unidade_medida, estoque_atual, estoque_minimo, requer_laudo, requer_rastreabilidade, requer_ca),
        solicitante:usuarios!solicitante_id(id, nome, matricula),
        destinatario:usuarios!destinatario_id(id, nome, matricula),
        destinatario_equipe:equipes!destinatario_equipe_id(id, nome, operacao),
        responsavel_equipe:usuarios!responsavel_equipe_id(id, nome, matricula),
        aprovador_almoxarifado:usuarios!aprovado_almoxarifado_por(id, nome),
        entregador:usuarios!entregue_por(id, nome),
        supervisor_entrega:usuarios!entregue_a_supervisor_id(id, nome, matricula),
        base_destino:bases!base_id(id, nome, codigo)
      `)
      .eq('id', id)
      .maybeSingle()

    if (error) throw error
    if (!solicitacao) throw new Error('Solicitação não encontrada')

    return solicitacao as unknown as SolicitacaoItem
  },

  async criarSolicitacoesParaEquipe(
    moduloPredefinidoId: string,
    equipeId: string,
    responsavelEquipeId: string,
    baseId: string,
    solicitanteId: string,
    motivoSolicitacao: string,
    observacoes?: string
  ): Promise<number> {
    try {
      console.log('🔄 Criando solicitações para equipe:', {
        moduloPredefinidoId,
        equipeId,
        responsavelEquipeId,
        baseId,
        solicitanteId,
        motivoSolicitacao
      })

      // Buscar itens do módulo pré-definido de equipes usando a view completa
      const { data: itensModulo, error: itensError } = await supabase
        .from('v_modulos_predefinidos_itens_equipe_completos')
        .select('*')
        .eq('modulo_id', moduloPredefinidoId)
        .eq('ativo', true)

      if (itensError) throw itensError

      if (!itensModulo || itensModulo.length === 0) {
        throw new Error('Nenhum item encontrado no módulo pré-definido de equipes')
      }

      console.log('📦 Itens do módulo encontrados:', itensModulo.length)
      console.log('📋 Detalhes dos itens:', itensModulo.map(item => ({
        id: item.id,
        item_codigo: item.item_codigo,
        item_nome: item.item_nome,
        item_estoque_id: item.item_estoque_id,
        item_catalogo_id: item.item_catalogo_id,
        grupo_item_id: item.grupo_item_id,
        variacao_item_id: item.variacao_item_id,
        base_id: item.item_base_id
      })))

      // Criar solicitações para cada item
      const solicitacoesCriadas = []
      
      for (const itemModulo of itensModulo) {
        let itemEstoqueId = itemModulo.item_estoque_id
        
        // Se for item de catálogo, buscar o item_estoque correspondente na base
        if (itemModulo.item_catalogo_id && !itemEstoqueId) {
          console.log('🔍 Buscando item_estoque para item_catalogo_id:', itemModulo.item_catalogo_id, 'na base:', baseId)
          
          const { data: itemEstoque, error: estoqueError } = await supabase
            .from('itens_estoque')
            .select('id')
            .eq('item_catalogo_id', itemModulo.item_catalogo_id)
            .eq('base_id', baseId)
            .single()
          
          if (estoqueError || !itemEstoque) {
            console.warn('⚠️ Item de catálogo não encontrado na base selecionada:', itemModulo.item_nome)
            continue
          }
          
          itemEstoqueId = itemEstoque.id
          console.log('✅ Item_estoque encontrado:', itemEstoqueId)
        }
        
        // Se for grupo ou variação, buscar o item_estoque correspondente
        if ((itemModulo.grupo_item_id || itemModulo.variacao_item_id) && !itemEstoqueId) {
          console.log('🔍 Buscando item_estoque para grupo/variação:', { 
            grupo_item_id: itemModulo.grupo_item_id, 
            variacao_item_id: itemModulo.variacao_item_id, 
            base_id: baseId 
          })
          
          let query = supabase
            .from('itens_estoque')
            .select('id')
            .eq('base_id', baseId)
          
          if (itemModulo.grupo_item_id) {
            query = query.eq('grupo_item_id', itemModulo.grupo_item_id)
          }
          if (itemModulo.variacao_item_id) {
            query = query.eq('variacao_item_id', itemModulo.variacao_item_id)
          }
          
          const { data: itemEstoque, error: estoqueError } = await query.single()
          
          if (estoqueError || !itemEstoque) {
            console.warn('⚠️ Item de grupo/variação não encontrado na base selecionada:', itemModulo.item_nome)
            continue
          }
          
          itemEstoqueId = itemEstoque.id
          console.log('✅ Item_estoque encontrado para grupo/variação:', itemEstoqueId)
        }
        
        // Se ainda não tem item_estoque_id, pular
        if (!itemEstoqueId) {
          console.warn('⚠️ Não foi possível encontrar item_estoque_id para:', itemModulo.item_nome)
          continue
        }

        const solicitacaoData = {
          item_id: itemEstoqueId,
          solicitante_id: solicitanteId,
          destinatario_equipe_id: equipeId,
          responsavel_equipe_id: responsavelEquipeId,
          base_id: baseId,
          quantidade_solicitada: itemModulo.quantidade_padrao,
          prioridade: 'normal' as const,
          tipo_troca: 'fornecimento' as const,
          motivo_solicitacao: motivoSolicitacao,
          observacoes: observacoes,
          tipo_solicitacao: 'individual' as const
        }

        const { data: solicitacao, error: solicitacaoError } = await supabase
          .from('solicitacoes_itens')
          .insert(solicitacaoData)
          .select()
          .single()

        if (solicitacaoError) {
          console.error('❌ Erro ao criar solicitação:', solicitacaoError)
          throw solicitacaoError
        }

        solicitacoesCriadas.push(solicitacao)
        console.log('✅ Solicitação criada:', solicitacao.id)
      }

      console.log('🎉 Total de solicitações criadas:', solicitacoesCriadas.length)
      return solicitacoesCriadas.length

    } catch (error) {
      console.error('❌ Erro ao criar solicitações para equipe:', error)
      throw error
    }
  },

  async getSolicitacoesPorStatus(status: SolicitacaoItem['status']): Promise<SolicitacaoItem[]> {
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
        entregador:usuarios!entregue_por(id, nome),
        base_destino:bases!base_id(id, nome, codigo)
      `)
      .eq('status', status)
      .order('criado_em', { ascending: false })

    if (error) throw error
    
    // Carregar dados relacionados aos grupos de entrega se existirem
    const solicitacoesComGrupos = await Promise.all((data || []).map(async (solicitacao) => {
      if (solicitacao.grupo_entrega_id) {
        try {
          const { data: grupoData } = await supabase
            .from('grupos_entrega_novo_funcionario')
            .select(`
              *,
              funcionario:usuarios!funcionario_id(id, nome, matricula),
              cargo:cargos(id, nome),
              modulo_predefinido:modulos_predefinidos_cargo(id, nome_modulo, descricao, ativo)
            `)
            .eq('id', solicitacao.grupo_entrega_id)
            .single()
          
          if (grupoData) {
            solicitacao.grupo_entrega = grupoData
          }
        } catch (error) {
          // Ignorar erro se a tabela não existir ainda
          console.warn('Tabela grupos_entrega_novo_funcionario não encontrada:', error)
        }
      }
      
      if (solicitacao.modulo_predefinido_id) {
        try {
          const { data: moduloData } = await supabase
            .from('modulos_predefinidos_cargo')
            .select('id, nome_modulo, descricao, ativo')
            .eq('id', solicitacao.modulo_predefinido_id)
            .single()
          
          if (moduloData) {
            solicitacao.modulo_predefinido = moduloData
          }
        } catch (error) {
          // Ignorar erro se a tabela não existir ainda
          console.warn('Tabela modulos_predefinidos_cargo não encontrada:', error)
        }
      }
      
      return solicitacao
    }))
    
    return solicitacoesComGrupos
  },

  async getAllSolicitacoes(): Promise<SolicitacaoItem[]> {
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
        entregador:usuarios!entregue_por(id, nome),
        base_destino:bases!base_id(id, nome, codigo)
      `)
      .order('criado_em', { ascending: false })

    if (error) throw error
    
    // Carregar dados relacionados aos grupos de entrega se existirem
    const solicitacoesComGrupos = await Promise.all((data || []).map(async (solicitacao) => {
      if (solicitacao.grupo_entrega_id) {
        try {
          const { data: grupoData } = await supabase
            .from('grupos_entrega_novo_funcionario')
            .select(`
              *,
              funcionario:usuarios!funcionario_id(id, nome, matricula),
              cargo:cargos(id, nome),
              modulo_predefinido:modulos_predefinidos_cargo(id, nome_modulo, descricao, ativo)
            `)
            .eq('id', solicitacao.grupo_entrega_id)
            .single()
          
          if (grupoData) {
            solicitacao.grupo_entrega = grupoData
          }
        } catch (error) {
          // Ignorar erro se a tabela não existir ainda
          console.warn('Tabela grupos_entrega_novo_funcionario não encontrada:', error)
        }
      }
      
      if (solicitacao.modulo_predefinido_id) {
        try {
          const { data: moduloData } = await supabase
            .from('modulos_predefinidos_cargo')
            .select('id, nome_modulo, descricao, ativo')
            .eq('id', solicitacao.modulo_predefinido_id)
            .single()
          
          if (moduloData) {
            solicitacao.modulo_predefinido = moduloData
          }
        } catch (error) {
          // Ignorar erro se a tabela não existir ainda
          console.warn('Tabela modulos_predefinidos_cargo não encontrada:', error)
        }
      }
      
      return solicitacao
    }))
    
    return solicitacoesComGrupos
  },

  async movimentarEstoque(mov: {
    item_id: string
    tipo: MovimentacaoEstoque['tipo']
    quantidade: number
    motivo: string
    documento_referencia?: string
    usuario_id: string
    solicitante_id?: string
    destinatario_id?: string // ✅ ADICIONADO: quem está saindo/recebendo o item
    local_origem?: string
    local_destino?: string
    observacoes?: string
    base_id?: string
  }): Promise<MovimentacaoEstoque> {
    // Buscar item - item_id já identifica unicamente o item na base correta
    const { data: item, error: itemError } = await supabase
      .from('itens_estoque')
      .select('estoque_atual, base_id')
      .eq('id', mov.item_id)
      .single()

    if (itemError) {
      console.error('❌ [ESTOQUE] Erro ao buscar item:', itemError)
      throw itemError
    }
    if (!item) throw new Error('Item não encontrado')

    // Usar base_id do item encontrado, ou o base_id passado se fornecido
    const baseIdParaMovimentacao = mov.base_id || item.base_id

    const quantidadeAnterior = item.estoque_atual ?? 0
    let novaQuantidade: number
    switch (mov.tipo) {
      case 'entrada':
        novaQuantidade = quantidadeAnterior + mov.quantidade
        break
      case 'saida':
        novaQuantidade = quantidadeAnterior - mov.quantidade
        break
      case 'ajuste':
        novaQuantidade = mov.quantidade
        break
      case 'devolucao':
        novaQuantidade = quantidadeAnterior + mov.quantidade
        break
      case 'transferencia':
        novaQuantidade = quantidadeAnterior - mov.quantidade
        break
      default:
        throw new Error('Tipo de movimentação inválido')
    }

    if ((mov.tipo === 'saida' || mov.tipo === 'transferencia') && novaQuantidade < 0) {
      throw new Error('Estoque insuficiente para esta operação')
    }

    // O trigger atualizar_estoque_automatico (AFTER INSERT em movimentacoes_estoque)
    // é o único responsável por atualizar itens_estoque.estoque_atual

    const { data: movData, error: movError } = await supabase
      .from('movimentacoes_estoque')
      .insert({
        ...mov,
        destinatario_id: mov.destinatario_id, // ✅ ADICIONADO: quem está saindo/recebendo o item
        quantidade_anterior: quantidadeAnterior,
        quantidade_atual: novaQuantidade,
        base_id: baseIdParaMovimentacao, // ✅ Base do item ou base especificada
        criado_em: new Date().toISOString(),
      })
      .select('*')
      .single()

    if (movError) throw movError

    // Se o estoque aumentou (entrada, devolução, ajuste positivo), verificar se há solicitações aguardando
    const estoqueAumentou = novaQuantidade > quantidadeAnterior
    if (estoqueAumentou) {
      try {
        console.log(`🔄 [ESTOQUE] Estoque aumentou para ${novaQuantidade}, verificando solicitações aguardando...`)
        await this.reativarSolicitacoesComEstoque()
      } catch (reativarError) {
        console.warn('⚠️ [ESTOQUE] Erro ao verificar solicitações aguardando:', reativarError)
        // Não falha a movimentação se a verificação falhar
      }
    }

    return movData as unknown as MovimentacaoEstoque
  },

  async getEstoqueDisponivel(itemId: string, baseId?: string): Promise<number> {
    try {
      console.log(`🔍 [WEB] Buscando estoque para item ${itemId}${baseId ? ` na base ${baseId}` : ''}`)
      
      // Primeiro, vamos verificar se o item existe e obter informações detalhadas
      const { data: itemInfo, error: itemError } = await supabase
        .from('itens_estoque')
        .select('id, nome, estoque_atual, base_id, item_catalogo_id')
        .eq('id', itemId)
        .single()

      if (itemError) {
        console.error(`❌ [WEB] Erro ao buscar item ${itemId}:`, itemError)
        return 0
      }

      if (!itemInfo) {
        console.log(`⚠️ [WEB] Item ${itemId} não encontrado na tabela itens_estoque`)
        return 0
      }

      console.log(`📋 [WEB] Item encontrado:`, {
        id: itemInfo.id,
        nome: itemInfo.nome,
        estoque_atual: itemInfo.estoque_atual,
        base_id: itemInfo.base_id,
        item_catalogo_id: itemInfo.item_catalogo_id
      })

      // Se baseId foi especificado, verificar se o item pertence à base correta
      if (baseId && itemInfo.base_id !== baseId) {
        console.log(`⚠️ [WEB] Item ${itemId} não pertence à base ${baseId}. Base do item: ${itemInfo.base_id}`)
        console.log(`🔄 [WEB] Buscando item equivalente na base ${baseId}...`)
        
        // Buscar o mesmo item (mesmo item_catalogo_id) na base correta
        const { data: itemCorreto, error: itemCorretoError } = await supabase
          .from('itens_estoque')
          .select('id, nome, estoque_atual, base_id, item_catalogo_id')
          .eq('item_catalogo_id', itemInfo.item_catalogo_id)
          .eq('base_id', baseId)
          .single()

        if (itemCorretoError) {
          console.error(`❌ [WEB] Erro ao buscar item equivalente na base ${baseId}:`, itemCorretoError)
          return 0
        }

        if (!itemCorreto) {
          console.log(`⚠️ [WEB] Item equivalente não encontrado na base ${baseId}`)
          return 0
        }

        console.log(`✅ [WEB] Item equivalente encontrado na base correta:`, {
          id: itemCorreto.id,
          nome: itemCorreto.nome,
          estoque_atual: itemCorreto.estoque_atual,
          base_id: itemCorreto.base_id,
          item_catalogo_id: itemCorreto.item_catalogo_id
        })

        const estoqueDisponivel = itemCorreto.estoque_atual || 0
        console.log(`📦 [WEB] Estoque disponível para item ${itemId} na base ${baseId}: ${estoqueDisponivel}`)
        return estoqueDisponivel
      }

      const estoqueDisponivel = itemInfo.estoque_atual || 0
      console.log(`📦 [WEB] Estoque disponível para item ${itemId}${baseId ? ` na base ${baseId}` : ''}: ${estoqueDisponivel}`)
      
      return estoqueDisponivel
    } catch (error) {
      console.error(`❌ [WEB] Erro ao calcular estoque disponível:`, error)
      return 0
    }
  },

  async aprovarSolicitacao(
    solicitacaoId: string,
    aprovadorId: string,
    quantidadeAprovada: number,
    observacoes?: string,
    baseIdAlternativa?: string
  ): Promise<SolicitacaoItem> {
    const status = quantidadeAprovada > 0 ? 'aprovada' : 'rejeitada'
    const timestamp = new Date().toISOString()

    console.log(`🔄 [WEB] Iniciando aprovação da solicitação:`, { 
      solicitacaoId, 
      aprovadorId, 
      quantidadeAprovada, 
      status,
      timestamp 
    })

    try {
      // Buscar a solicitação original primeiro para validação
      const solicitacaoOriginal = await this.getSolicitacaoById(solicitacaoId)
      
      if (solicitacaoOriginal.status !== 'pendente') {
        throw new Error(`Solicitação já foi processada. Status atual: ${solicitacaoOriginal.status}`)
      }

      console.log(`✅ [WEB] Solicitação validada e pendente`)
      
      // Determinar qual base usar para verificação de estoque
      const baseIdParaVerificacao = baseIdAlternativa || solicitacaoOriginal.base_id
      const baseMudou = baseIdAlternativa && baseIdAlternativa !== solicitacaoOriginal.base_id
      
      console.log(`📋 [WEB] Dados da solicitação:`, {
        id: solicitacaoOriginal.id,
        item_id: solicitacaoOriginal.item_id,
        base_id_original: solicitacaoOriginal.base_id,
        base_id_verificacao: baseIdParaVerificacao,
        base_mudou: baseMudou,
        quantidade_solicitada: solicitacaoOriginal.quantidade_solicitada,
        quantidade_aprovada: quantidadeAprovada
      })

      // Verificar estoque disponível antes da aprovação
      if (quantidadeAprovada > 0) {
        console.log(`🔍 [WEB] Verificando estoque antes da aprovação:`, {
          item_id: solicitacaoOriginal.item_id,
          base_id_original: solicitacaoOriginal.base_id,
          base_id_verificacao: baseIdParaVerificacao,
          quantidade_aprovada: quantidadeAprovada
        })
        
        const estoqueDisponivel = await this.getEstoqueDisponivel(solicitacaoOriginal.item_id, baseIdParaVerificacao)
        
        console.log(`📊 [WEB] Resultado da verificação de estoque:`, {
          estoque_disponivel: estoqueDisponivel,
          quantidade_aprovada: quantidadeAprovada,
          tem_estoque_suficiente: estoqueDisponivel >= quantidadeAprovada
        })
        
        if (estoqueDisponivel < quantidadeAprovada) {
          console.log(`⚠️ [WEB] Estoque insuficiente: disponível=${estoqueDisponivel}, solicitado=${quantidadeAprovada}`)
          
          // Atualizar status para "aguardando_estoque" em vez de aprovar
          const { error: updateError } = await supabase
            .from('solicitacoes_itens')
            .update({
              status: 'aguardando_estoque',
              quantidade_aprovada: quantidadeAprovada,
              aprovado_almoxarifado_por: aprovadorId,
              aprovado_almoxarifado_em: timestamp,
              observacoes: observacoes || '',
              atualizado_em: timestamp
            })
            .eq('id', solicitacaoId)

          if (updateError) {
            console.error(`❌ [WEB] Erro ao atualizar para aguardando_estoque:`, updateError)
            throw updateError
          }

          console.log(`✅ [WEB] Solicitação movida para "aguardando_estoque" devido a estoque insuficiente`)
          
          // Aguardar sincronização e retornar
          await new Promise(resolve => setTimeout(resolve, 300))
          const solicitacaoAtualizada = await this.getSolicitacaoById(solicitacaoId)
          return solicitacaoAtualizada
        } else {
          console.log(`✅ [WEB] Estoque suficiente para aprovação: disponível=${estoqueDisponivel}, solicitado=${quantidadeAprovada}`)
        }
      }

      // Se há estoque suficiente ou é rejeição, aprovar normalmente
      const dadosAtualizacao: {
        status: string;
        quantidade_aprovada: number;
        aprovado_almoxarifado_por: string;
        aprovado_almoxarifado_em: string;
        observacoes: string;
        atualizado_em: string;
        base_id?: string;
        item_id?: string;
      } = {
        status: status,
        quantidade_aprovada: quantidadeAprovada,
        aprovado_almoxarifado_por: aprovadorId,
        aprovado_almoxarifado_em: timestamp,
        observacoes: observacoes || '',
        atualizado_em: timestamp
      }

      // Se a base mudou, atualizar também a base e buscar o item correto
      if (baseMudou) {
        console.log(`🔄 [WEB] Base mudou de ${solicitacaoOriginal.base_id} para ${baseIdAlternativa}`)
        
        // Buscar o item na nova base
        const { data: itemOriginal } = await supabase
          .from('itens_estoque')
          .select('item_catalogo_id')
          .eq('id', solicitacaoOriginal.item_id)
          .single()

        if (itemOriginal) {
          const { data: itemNovaBase } = await supabase
            .from('itens_estoque')
            .select('id')
            .eq('item_catalogo_id', itemOriginal.item_catalogo_id)
            .eq('base_id', baseIdAlternativa)
            .single()

          if (itemNovaBase) {
            dadosAtualizacao.base_id = baseIdAlternativa
            dadosAtualizacao.item_id = itemNovaBase.id
            console.log(`✅ [WEB] Item atualizado para nova base: ${itemNovaBase.id}`)
          } else {
            console.log(`⚠️ [WEB] Item não encontrado na nova base, mantendo base original`)
          }
        }
      }

      const { error: updateError } = await supabase
        .from('solicitacoes_itens')
        .update(dadosAtualizacao)
        .eq('id', solicitacaoId)

      if (updateError) {
        console.error(`❌ [WEB] Erro ao aprovar solicitação:`, updateError)
        throw updateError
      }

      console.log(`✅ [WEB] Solicitação aprovada com sucesso`)

      // Aguardar sincronização
      await new Promise(resolve => setTimeout(resolve, 300))

      const solicitacaoAtualizada = await this.getSolicitacaoById(solicitacaoId)
      console.log(`✅ [WEB] Solicitação aprovada com sucesso:`, solicitacaoAtualizada.id)
      
      // Verificar se há outras solicitações que podem ser reativadas
      await this.verificarSolicitacoesAguardandoEstoque()
      
      return solicitacaoAtualizada

    } catch (error) {
      console.error(`❌ [WEB] Erro ao aprovar solicitação:`, error)
      throw error
    }
  },

  async entregarItem(
    solicitacaoId: string,
    entregadorId: string,
    quantidadeEntregue: number,
    condicaoEntrega: HistoricoFuncionario['condicao_entrega'] = 'novo',
    observacoesEntrega?: string,
    numeroLaudo?: string,
    validadeLaudo?: string,
    dataVencimento?: string,
    baseIdEntrega?: string,
    biometricData?: {
      template: string;
      quality: number;
      image_base64?: string;
    },
    numerosRastreabilidade?: string[],
    numeroCa?: string,
    validadeCa?: string
  ): Promise<{ solicitacao: SolicitacaoItem; historico?: HistoricoFuncionario }> {
    const timestamp = new Date().toISOString()

    console.log(`🚚 [WEB] Iniciando entrega de item:`, { 
      solicitacaoId, 
      entregadorId, 
      quantidadeEntregue, 
      condicaoEntrega,
      baseIdEntrega,
      timestamp 
    })

    try {
      // Buscar solicitação original para validação
      const solicitacao = await this.getSolicitacaoById(solicitacaoId)
      
      if (!['aprovada', 'aguardando_estoque'].includes(solicitacao.status)) {
        throw new Error(`Solicitação deve estar aprovada ou aguardando estoque para entrega. Status atual: ${solicitacao.status}`)
      }

      if (quantidadeEntregue > (solicitacao.quantidade_aprovada || 0)) {
        throw new Error(`Quantidade a entregar (${quantidadeEntregue}) maior que aprovada (${solicitacao.quantidade_aprovada})`)
      }

      // Validação: se o item requer laudo, os campos de laudo são obrigatórios
      if (solicitacao.item?.requer_laudo) {
        if (!numeroLaudo || numeroLaudo.trim() === '') {
          throw new Error('Este item requer laudo técnico. O número do laudo é obrigatório.')
        }
        if (!validadeLaudo || validadeLaudo.trim() === '') {
          throw new Error('Este item requer laudo técnico. A validade do laudo é obrigatória.')
        }
      }

      // Determinar qual base usar para a entrega
      const baseIdParaEntrega = baseIdEntrega || solicitacao.base_id
      
      console.log(`✅ [WEB] Solicitação validada para entrega`)
      console.log(`🔍 [WEB] Dados da solicitação:`, {
        item_id: solicitacao.item_id,
        base_id_original: solicitacao.base_id,
        base_id_entrega: baseIdParaEntrega,
        quantidade_aprovada: solicitacao.quantidade_aprovada
      })

      // SEMPRE buscar o item correto na base selecionada e atualizar, mesmo que seja o mesmo
      // Primeiro, buscar o item_catalogo_id do item original da solicitação
      const { data: itemOriginal } = await supabase
        .from('itens_estoque')
        .select('item_catalogo_id, base_id')
        .eq('id', solicitacao.item_id)
        .maybeSingle()

      if (!itemOriginal?.item_catalogo_id) {
        throw new Error('item_catalogo_id do item original não encontrado. Verifique se o item da solicitação existe no estoque.')
      }

      console.log(`🔍 [WEB] Item original da solicitação:`, {
        item_id: solicitacao.item_id,
        item_catalogo_id: itemOriginal.item_catalogo_id,
        base_id_original: itemOriginal.base_id,
        base_id_solicitacao: solicitacao.base_id,
        base_id_entrega: baseIdParaEntrega
      })

      // SEMPRE buscar o item na base selecionada via item_catalogo_id
      console.log(`🔄 [WEB] Buscando item correto na base ${baseIdParaEntrega}...`)
      
      const { data: itemNaBaseEntrega, error: itemError } = await supabase
        .from('itens_estoque')
        .select('id, estoque_atual, base_id, nome, item_catalogo_id')
        .eq('item_catalogo_id', itemOriginal.item_catalogo_id)
        .eq('base_id', baseIdParaEntrega)
        .maybeSingle()

      if (itemError || !itemNaBaseEntrega) {
        console.error('❌ [WEB] Item não encontrado na base de entrega via item_catalogo_id:', { 
          item_catalogo_id: itemOriginal.item_catalogo_id,
          base_id: baseIdParaEntrega, 
          error: itemError 
        })
        throw new Error(`Item do catálogo não encontrado na base selecionada. Verifique se o item existe na base ${baseIdParaEntrega}.`)
      }

      const itemEstoque = itemNaBaseEntrega
      const itemIdAtualizado = itemNaBaseEntrega.id
      const baseIdAtualizado = baseIdParaEntrega
      
      console.log(`🔄 [WEB] Item encontrado na base de entrega:`, {
        item_id_original: solicitacao.item_id,
        item_id_atualizado: itemIdAtualizado,
        item_catalogo_id: itemNaBaseEntrega.item_catalogo_id,
        nome: itemNaBaseEntrega.nome,
        estoque_atual: itemNaBaseEntrega.estoque_atual,
        base_id: itemNaBaseEntrega.base_id
      })
      
      // SEMPRE atualizar item_id e base_id da solicitação, mesmo que sejam os mesmos
      console.log(`📝 [WEB] Atualizando solicitação com item_id e base_id da base selecionada...`)
      const { error: updateSolicitacaoError } = await supabase
        .from('solicitacoes_itens')
        .update({
          item_id: itemIdAtualizado,
          base_id: baseIdAtualizado,
          atualizado_em: timestamp
        })
        .eq('id', solicitacaoId)

      if (updateSolicitacaoError) {
        console.error('❌ [WEB] Erro ao atualizar solicitação com item_id/base_id:', updateSolicitacaoError)
        throw new Error(`Erro ao atualizar solicitação: ${updateSolicitacaoError.message}`)
      }
      
      // Verificar se a atualização foi persistida
      const { data: solicitacaoVerificada, error: verifyError } = await supabase
        .from('solicitacoes_itens')
        .select('item_id, base_id')
        .eq('id', solicitacaoId)
        .single()

      if (verifyError || !solicitacaoVerificada) {
        throw new Error('Erro ao verificar atualização da solicitação')
      }

      if (solicitacaoVerificada.item_id !== itemIdAtualizado || solicitacaoVerificada.base_id !== baseIdAtualizado) {
        console.error('❌ [WEB] Atualização não foi persistida corretamente:', {
          esperado: { item_id: itemIdAtualizado, base_id: baseIdAtualizado },
          atual: { item_id: solicitacaoVerificada.item_id, base_id: solicitacaoVerificada.base_id }
        })
        throw new Error('A solicitação não foi atualizada corretamente com o novo item_id e base_id')
      }
      
      console.log(`✅ [WEB] Solicitação atualizada e verificada: item_id=${itemIdAtualizado}, base_id=${baseIdAtualizado}`)

      // TypeScript: garantir que itemEstoque tem os campos necessários
      const itemEstoqueFinal = itemEstoque as unknown as ItemEstoque

      console.log(`📦 [WEB] Estoque atual do item:`, {
        nome: itemEstoqueFinal.nome,
        estoque_atual: itemEstoqueFinal.estoque_atual,
        base_id: itemEstoqueFinal.base_id
      })

      // Verificar estoque novamente ANTES de qualquer atualização ou chamada RPC
      // Isso garante que temos o valor mais recente
      const { data: estoqueAtualizado, error: estoqueError } = await supabase
        .from('itens_estoque')
        .select('estoque_atual, nome')
        .eq('id', itemEstoqueFinal.id)
        .eq('base_id', baseIdParaEntrega)
        .single()

      if (estoqueError || !estoqueAtualizado) {
        throw new Error('Erro ao verificar estoque atualizado')
      }

      if (estoqueAtualizado.estoque_atual < quantidadeEntregue) {
        throw new Error(`Estoque insuficiente. Disponível: ${estoqueAtualizado.estoque_atual}, Solicitado: ${quantidadeEntregue}`)
      }

      console.log(`✅ [WEB] Estoque verificado antes da entrega:`, {
        estoque_atual: estoqueAtualizado.estoque_atual,
        quantidade_entregue: quantidadeEntregue
      })

      // Verificar se item_id e base_id estão corretos na solicitação
      // (já foram atualizados acima com os valores da base selecionada)
      if (itemEstoqueFinal.id !== itemIdAtualizado || baseIdParaEntrega !== baseIdAtualizado) {
        console.warn(`⚠️ [WEB] Inconsistência detectada - itemEstoqueFinal.id=${itemEstoqueFinal.id}, itemIdAtualizado=${itemIdAtualizado}, baseIdParaEntrega=${baseIdParaEntrega}, baseIdAtualizado=${baseIdAtualizado}`)
      } else {
        console.log(`✅ [WEB] Solicitação está com item_id e base_id corretos para a entrega`)
      }

      // Verificação FINAL do estoque imediatamente antes da chamada RPC
      // Isso garante que temos o valor mais recente antes de chamar a função
      const { data: estoqueFinal, error: estoqueFinalError } = await supabase
        .from('itens_estoque')
        .select('estoque_atual, nome')
        .eq('id', itemEstoqueFinal.id)
        .eq('base_id', baseIdParaEntrega)
        .single()

      if (estoqueFinalError || !estoqueFinal) {
        throw new Error('Erro ao verificar estoque final antes da entrega')
      }

      if (estoqueFinal.estoque_atual < quantidadeEntregue) {
        throw new Error(`Estoque insuficiente no momento da entrega. Disponível: ${estoqueFinal.estoque_atual}, Solicitado: ${quantidadeEntregue}`)
      }

      console.log(`✅ [WEB] Estoque final verificado antes da chamada RPC:`, {
        estoque_atual: estoqueFinal.estoque_atual,
        quantidade_entregue: quantidadeEntregue,
        item_id: itemEstoqueFinal.id,
        base_id: baseIdParaEntrega
      })

      // Verificar status da solicitação antes de chamar RPC (evita processamento duplicado)
      const { data: solicitacaoAtual, error: solicitacaoError } = await supabase
        .from('solicitacoes_itens')
        .select('status, quantidade_entregue')
        .eq('id', solicitacaoId)
        .single()

      if (solicitacaoError || !solicitacaoAtual) {
        throw new Error('Erro ao verificar status da solicitação antes da entrega')
      }

      if (solicitacaoAtual.status === 'entregue') {
        throw new Error('Esta solicitação já foi entregue anteriormente')
      }

      if (solicitacaoAtual.status !== 'aprovada' && solicitacaoAtual.status !== 'aguardando_estoque') {
        throw new Error(`Solicitação deve estar aprovada ou aguardando estoque. Status atual: ${solicitacaoAtual.status}`)
      }

      console.log(`✅ [WEB] Status da solicitação verificado: ${solicitacaoAtual.status}`)

      // Verificação CRÍTICA: Confirmar que a solicitação tem o item_id e base_id corretos antes de chamar RPC
      // Isso é especialmente importante quando a base mudou
      const { data: solicitacaoFinal, error: solicitacaoFinalError } = await supabase
        .from('solicitacoes_itens')
        .select('item_id, base_id')
        .eq('id', solicitacaoId)
        .single()

      if (solicitacaoFinalError || !solicitacaoFinal) {
        throw new Error('Erro ao verificar item_id e base_id da solicitação antes da entrega')
      }

      // Se os valores não estão corretos, atualizar novamente
      if (solicitacaoFinal.item_id !== itemIdAtualizado || solicitacaoFinal.base_id !== baseIdAtualizado) {
        console.warn(`⚠️ [WEB] Solicitação ainda não está atualizada. item_id esperado: ${itemIdAtualizado}, atual: ${solicitacaoFinal.item_id}. base_id esperado: ${baseIdAtualizado}, atual: ${solicitacaoFinal.base_id}`)
        console.log(`🔄 [WEB] Atualizando solicitação novamente...`)
        
        const { error: reupdateError } = await supabase
          .from('solicitacoes_itens')
          .update({
            item_id: itemIdAtualizado,
            base_id: baseIdAtualizado,
            atualizado_em: timestamp
          })
          .eq('id', solicitacaoId)

        if (reupdateError) {
          console.error('❌ [WEB] Erro ao reatualizar solicitação:', reupdateError)
          throw new Error(`Erro ao atualizar solicitação com item_id e base_id corretos: ${reupdateError.message}`)
        }

        // Aguardar um pouco para garantir que a atualização foi commitada
        await new Promise(resolve => setTimeout(resolve, 100))

        // Verificar novamente
        const { data: solicitacaoRecheck, error: recheckError } = await supabase
          .from('solicitacoes_itens')
          .select('item_id, base_id')
          .eq('id', solicitacaoId)
          .single()

        if (recheckError || !solicitacaoRecheck) {
          throw new Error('Erro ao verificar atualização da solicitação')
        }

        if (solicitacaoRecheck.item_id !== itemIdAtualizado || solicitacaoRecheck.base_id !== baseIdAtualizado) {
          console.error('❌ [WEB] Solicitação ainda não está atualizada após reatualização:', {
            esperado: { item_id: itemIdAtualizado, base_id: baseIdAtualizado },
            atual: { item_id: solicitacaoRecheck.item_id, base_id: solicitacaoRecheck.base_id }
          })
          throw new Error(`A solicitação não foi atualizada corretamente. item_id esperado: ${itemIdAtualizado}, atual: ${solicitacaoRecheck.item_id}. base_id esperado: ${baseIdAtualizado}, atual: ${solicitacaoRecheck.base_id}`)
        }

        console.log(`✅ [WEB] Solicitação confirmada atualizada: item_id=${itemIdAtualizado}, base_id=${baseIdAtualizado}`)
      } else {
        console.log(`✅ [WEB] Solicitação já está com item_id e base_id corretos: item_id=${itemIdAtualizado}, base_id=${baseIdAtualizado}`)
      }

      // Verificar se é entrega para equipe ou funcionário
      const isEntregaEquipe = solicitacao.destinatario_equipe_id !== null
      
      if (isEntregaEquipe) {
        console.log('🏢 [WEB] Entregando para equipe:', solicitacao.destinatario_equipe?.nome)
        
        // Usar função específica para equipes
        // Converter validadeLaudo para formato date quando houver valor
        // A validade do laudo é a data de vencimento, então usamos ela como data_vencimento
        let validadeLaudoFormatted: string | null = null
        if (validadeLaudo && validadeLaudo.trim() !== '') {
          // Converter string para Date e depois para formato ISO (YYYY-MM-DD)
          const dateObj = new Date(validadeLaudo)
          if (!isNaN(dateObj.getTime())) {
            validadeLaudoFormatted = dateObj.toISOString().split('T')[0] // Formato YYYY-MM-DD
          }
        }
        
        // Converter dataVencimento para formato date quando houver valor
        // Se não houver validadeLaudo, usar dataVencimento
        let dataVencimentoFormatted: string | null = null
        if (!validadeLaudoFormatted && dataVencimento && dataVencimento.trim() !== '') {
          // Converter string para Date e depois para formato ISO (YYYY-MM-DD)
          const dateObj = new Date(dataVencimento)
          if (!isNaN(dateObj.getTime())) {
            dataVencimentoFormatted = dateObj.toISOString().split('T')[0] // Formato YYYY-MM-DD
          }
        }
        
        // Se houver validadeLaudo, usar ela como data_vencimento também
        // (a validade do laudo é a data de vencimento)
        const dataVencimentoFinal = validadeLaudoFormatted || dataVencimentoFormatted || null
        
        // Sempre passar todos os parâmetros, incluindo p_data_vencimento (mesmo que seja null)
        // Isso garante que usamos a função correta (a que tem numero_solicitacao)
        // Quando p_data_vencimento é null, o PostgreSQL deve usar a função com tipo date
        // Formatar validade do CA se houver
        let validadeCaFormatted: string | null = null
        if (validadeCa && validadeCa.trim() !== '') {
          const dateObj = new Date(validadeCa)
          if (!isNaN(dateObj.getTime())) {
            validadeCaFormatted = dateObj.toISOString().split('T')[0]
          }
        }

        const { data: resultadoEquipe, error: transactionError } = await supabase.rpc('entregar_item_para_equipe', {
          p_solicitacao_id: solicitacaoId,
          p_entregador_id: entregadorId,
          p_quantidade_entregue: quantidadeEntregue,
          p_condicao_entrega: condicaoEntrega,
          p_observacoes_entrega: observacoesEntrega || '',
          p_entregue_em: timestamp,
          p_atualizado_em: timestamp,
          p_numero_laudo: numeroLaudo || null,
          p_validade_laudo: validadeLaudoFormatted || null,
          p_data_vencimento: dataVencimentoFinal,
          p_numeros_rastreabilidade: numerosRastreabilidade && numerosRastreabilidade.length > 0 ? numerosRastreabilidade : [],
          p_numero_ca: numeroCa || null,
          p_validade_ca: validadeCaFormatted
        })

        if (transactionError) {
          // Log detalhado do erro para debug
          console.error(`❌ [WEB] ============================================`)
          console.error(`❌ [WEB] ERRO NA ENTREGA PARA EQUIPE`)
          console.error(`❌ [WEB] ============================================`)
          console.error(`❌ [WEB] Código do erro:`, transactionError.code)
          console.error(`❌ [WEB] Mensagem:`, transactionError.message)
          console.error(`❌ [WEB] Detalhes:`, transactionError.details)
          console.error(`❌ [WEB] Hint:`, transactionError.hint)
          console.error(`❌ [WEB] Erro completo:`, JSON.stringify(transactionError, null, 2))
          
          // Se for erro de ambiguidade de função, mostrar funções conflitantes
          if (transactionError.code === 'PGRST203' || transactionError.message?.includes('Could not choose the best candidate function')) {
            console.error(`❌ [WEB] ============================================`)
            console.error(`❌ [WEB] ERRO DE AMBIGUIDADE DE FUNÇÃO`)
            console.error(`❌ [WEB] ============================================`)
            console.error(`❌ [WEB] Existem múltiplas funções com o mesmo nome mas parâmetros diferentes`)
            console.error(`❌ [WEB] Mensagem completa:`, transactionError.message)
            console.error(`❌ [WEB] ============================================`)
          }
          
          // Se for erro de estoque insuficiente, mostrar detalhes
          if (transactionError.code === 'P0001' || transactionError.message?.includes('estoque disponível')) {
            console.error(`❌ [WEB] ============================================`)
            console.error(`❌ [WEB] ERRO DE ESTOQUE INSUFICIENTE`)
            console.error(`❌ [WEB] ============================================`)
            console.error(`❌ [WEB] Mensagem:`, transactionError.message)
            console.error(`❌ [WEB] Parâmetros enviados:`, {
              p_solicitacao_id: solicitacaoId,
              p_item_id: itemEstoqueFinal.id,
              p_base_id: baseIdParaEntrega,
              p_quantidade_entregue: quantidadeEntregue,
              estoque_verificado_antes: estoqueFinal.estoque_atual
            })
            console.error(`❌ [WEB] ============================================`)
          }
          
          console.error(`❌ [WEB] Stack trace:`, new Error().stack)
          console.error(`❌ [WEB] ============================================`)
          
          throw transactionError
        } else {
          console.log(`✅ [WEB] Entrega para equipe concluída:`, resultadoEquipe)
        }
      } else {
        console.log('👤 [WEB] Entregando para funcionário:', solicitacao.destinatario?.nome)
        
        // Buscar estado atual da solicitação para log
        const { data: solicitacaoParaLog } = await supabase
          .from('solicitacoes_itens')
          .select('item_id, base_id')
          .eq('id', solicitacaoId)
          .maybeSingle()
        
        // Log detalhado antes de chamar RPC
        console.log(`📋 [WEB] Dados que serão enviados para a função RPC:`, {
          p_solicitacao_id: solicitacaoId,
          p_entregador_id: entregadorId,
          p_quantidade_entregue: quantidadeEntregue,
          item_id_esperado: itemIdAtualizado,
          base_id_esperado: baseIdAtualizado,
          item_id_solicitacao_atual: solicitacaoParaLog?.item_id,
          base_id_solicitacao_atual: solicitacaoParaLog?.base_id,
          item_estoque_id: itemEstoqueFinal.id,
          item_estoque_base_id: itemEstoqueFinal.base_id,
          item_estoque_nome: itemEstoqueFinal.nome
        })
        
        // Verificar uma última vez se o item existe na base antes de chamar RPC
        const { data: itemVerificacaoFinal, error: itemVerificacaoError } = await supabase
          .from('itens_estoque')
          .select('id, nome, estoque_atual, base_id')
          .eq('id', itemEstoqueFinal.id)
          .eq('base_id', itemEstoqueFinal.base_id)
          .maybeSingle()

        if (itemVerificacaoError || !itemVerificacaoFinal) {
          console.error('❌ [WEB] Item não encontrado na verificação final antes da RPC:', {
            item_id: itemIdAtualizado,
            base_id: baseIdAtualizado,
            error: itemVerificacaoError
          })
          throw new Error(`Item não encontrado na base antes da entrega. item_id: ${itemIdAtualizado}, base_id: ${baseIdAtualizado}`)
        }

        console.log(`✅ [WEB] Item confirmado existente antes da RPC:`, {
          id: itemVerificacaoFinal.id,
          nome: itemVerificacaoFinal.nome,
          estoque_atual: itemVerificacaoFinal.estoque_atual,
          base_id: itemVerificacaoFinal.base_id
        })
        
        // Usar função original para funcionários
        // Converter validadeLaudo para formato date quando houver valor
        let validadeLaudoFormatted: string | null = null
        if (validadeLaudo && validadeLaudo.trim() !== '') {
          // Converter string para Date e depois para formato ISO (YYYY-MM-DD)
          const dateObj = new Date(validadeLaudo)
          if (!isNaN(dateObj.getTime())) {
            validadeLaudoFormatted = dateObj.toISOString().split('T')[0] // Formato YYYY-MM-DD
          }
        }
        
        // Formatar validade do CA se houver (funcionário)
        let validadeCaFormattedFunc: string | null = null
        if (validadeCa && validadeCa.trim() !== '') {
          const dateObj = new Date(validadeCa)
          if (!isNaN(dateObj.getTime())) {
            validadeCaFormattedFunc = dateObj.toISOString().split('T')[0]
          }
        }

        const { error: transactionError } = await supabase.rpc('entregar_item_estoque', {
          p_solicitacao_id: solicitacaoId,
          p_entregador_id: entregadorId,
          p_quantidade_entregue: quantidadeEntregue,
          p_condicao_entrega: condicaoEntrega,
          p_observacoes_entrega: observacoesEntrega || '',
          p_entregue_em: timestamp,
          p_atualizado_em: timestamp,
          p_numero_laudo: numeroLaudo || null,
          p_validade_laudo: validadeLaudoFormatted || null,
          p_numeros_rastreabilidade: numerosRastreabilidade && numerosRastreabilidade.length > 0 ? numerosRastreabilidade : [],
          p_numero_ca: numeroCa || null,
          p_validade_ca: validadeCaFormattedFunc
        })

        if (transactionError) {
          // Log detalhado do erro para debug
          console.error(`❌ [WEB] ============================================`)
          console.error(`❌ [WEB] ERRO NA ENTREGA PARA FUNCIONÁRIO`)
          console.error(`❌ [WEB] ============================================`)
          console.error(`❌ [WEB] Código do erro:`, transactionError.code)
          console.error(`❌ [WEB] Mensagem:`, transactionError.message)
          console.error(`❌ [WEB] Detalhes:`, transactionError.details)
          console.error(`❌ [WEB] Hint:`, transactionError.hint)
          console.error(`❌ [WEB] Erro completo:`, JSON.stringify(transactionError, null, 2))
          console.error(`❌ [WEB] Stack trace:`, new Error().stack)
          console.error(`❌ [WEB] ============================================`)
          
          throw transactionError
        } else {
          console.log(`✅ [WEB] Entrega para funcionário concluída`)
        }
      }

      // Aguardar sincronização
      await new Promise(resolve => setTimeout(resolve, 300))

      const updated = await this.getSolicitacaoById(solicitacaoId)
      
      // Se houver dados biométricos, salvar na solicitação e no log
      if (biometricData && updated) {
        console.log(`🔐 [WEB] Salvando confirmação biométrica...`)
        
        try {
          // Atualizar solicitação com dados biométricos
          const { error: biometricUpdateError } = await supabase
            .from('solicitacoes_itens')
            .update({
              confirmacao_biometrica_template: biometricData.template,
              confirmacao_biometrica_qualidade: biometricData.quality,
              confirmacao_biometrica_imagem_base64: biometricData.image_base64 || null,
              confirmacao_biometrica_em: timestamp,
              confirmacao_biometrica_por: updated.destinatario_id || null,
            })
            .eq('id', solicitacaoId)

          if (biometricUpdateError) {
            console.warn('⚠️ [WEB] Erro ao salvar confirmação biométrica na solicitação:', biometricUpdateError)
          } else {
            console.log('✅ [WEB] Confirmação biométrica salva na solicitação')
          }

          // Registrar no log imutável
          const destinatarioId = updated.destinatario_id || updated.destinatario_equipe_id
          if (destinatarioId) {
            const { error: logError } = await supabase
              .from('log_entregas_biometricas')
              .insert({
                solicitacao_id: solicitacaoId,
                destinatario_id: destinatarioId,
                entregador_id: entregadorId,
                base_id: baseIdParaEntrega,
                template: biometricData.template,
                qualidade: biometricData.quality,
                imagem_base64: biometricData.image_base64 || null,
                item_id: itemEstoqueFinal.id,
                quantidade_entregue: quantidadeEntregue,
                condicao_entrega: condicaoEntrega,
                observacoes_entrega: observacoesEntrega || null,
                criado_por: entregadorId,
              })

            if (logError) {
              console.warn('⚠️ [WEB] Erro ao registrar log biométrico:', logError)
            } else {
              console.log('✅ [WEB] Log biométrico registrado com sucesso')
            }
          }
        } catch (biometricError) {
          console.error('❌ [WEB] Erro ao processar dados biométricos:', biometricError)
          // Não falha a entrega se houver erro ao salvar biometria
        }
      }
      
      console.log(`✅ [WEB] Item entregue com sucesso:`, updated.id)
      
      return { solicitacao: updated, historico: undefined }

    } catch (error: unknown) {
      const err = error as Error & { code?: string; message?: string; details?: string; hint?: string; fullError?: unknown; stack?: string }
      console.error(`❌ [WEB] ============================================`)
      console.error(`❌ [WEB] ERRO GERAL AO ENTREGAR ITEM`)
      console.error(`❌ [WEB] ============================================`)
      console.error(`❌ [WEB] Tipo do erro:`, err?.constructor?.name || typeof error)
      console.error(`❌ [WEB] Código do erro:`, err?.code)
      console.error(`❌ [WEB] Mensagem:`, err?.message)
      console.error(`❌ [WEB] Detalhes:`, err?.details)
      console.error(`❌ [WEB] Hint:`, err?.hint)
      console.error(`❌ [WEB] Erro completo (serializado):`, serializeError(error))
      console.error(`❌ [WEB] Erro completo (JSON):`, JSON.stringify(error, Object.getOwnPropertyNames(error), 2))
      
      // Se for erro de ambiguidade de função, mostrar funções conflitantes
      if (err?.code === 'PGRST203' || err?.message?.includes('Could not choose the best candidate function')) {
        console.error(`❌ [WEB] ============================================`)
        console.error(`❌ [WEB] 🔴 ERRO DE AMBIGUIDADE DE FUNÇÃO 🔴`)
        console.error(`❌ [WEB] ============================================`)
        console.error(`❌ [WEB] Existem múltiplas funções com o mesmo nome mas parâmetros diferentes`)
        console.error(`❌ [WEB] Mensagem completa:`, err?.message)
        if (err?.fullError) {
          console.error(`❌ [WEB] Full Error:`, JSON.stringify(err.fullError, null, 2))
        }
        console.error(`❌ [WEB] ============================================`)
        console.error(`❌ [WEB] SOLUÇÃO: Execute o script CORRIGIR_AMBIGUIDADE_ENTREGAR_ITEM_EQUIPE.sql`)
        console.error(`❌ [WEB] ============================================`)
      }
      
      // Se for erro de estoque insuficiente, mostrar detalhes
      if (err?.code === 'P0001' || err?.message?.includes('estoque disponível') || err?.message?.includes('estoque insuficiente')) {
        console.error(`❌ [WEB] ============================================`)
        console.error(`❌ [WEB] 🔴 ERRO DE ESTOQUE INSUFICIENTE 🔴`)
        console.error(`❌ [WEB] ============================================`)
        console.error(`❌ [WEB] Mensagem:`, err?.message)
        console.error(`❌ [WEB] Isso pode indicar que:`)
        console.error(`❌ [WEB] 1. O estoque foi debitado por outra transação`)
        console.error(`❌ [WEB] 2. Há um trigger debitando estoque duas vezes`)
        console.error(`❌ [WEB] 3. Há múltiplas chamadas simultâneas da função`)
        console.error(`❌ [WEB] ============================================`)
      }
      
      // Mostrar stack trace
      if (err?.stack) {
        console.error(`❌ [WEB] Stack trace:`, err.stack)
      } else {
        console.error(`❌ [WEB] Stack trace (gerado):`, new Error().stack)
      }
      
      console.error(`❌ [WEB] ============================================`)
      
      throw error
    }
  },

  /**
   * Processar devolução de item
   */
  async processarDevolucao(
    historicoId: string,
    condicaoDevolucao: HistoricoFuncionario['condicao_devolucao'],
    observacoesDevolucao?: string,
    responsavelDevolucaoId?: string,
    evidenciaFile?: File
  ): Promise<HistoricoFuncionario> {
    const timestamp = new Date().toISOString()

    console.log(`📤 [WEB] Iniciando devolução de item:`, { 
      historicoId, 
      condicaoDevolucao, 
      responsavelDevolucaoId,
      timestamp 
    })

    try {
      // Buscar histórico
      const { data: historico, error: histError } = await supabase
        .from('historico_funcionarios')
        .select('*')
        .eq('id', historicoId)
        .single()

      if (histError) throw histError
      if (!historico) throw new Error('Histórico não encontrado')

      // Upload da evidência se fornecida
      let evidenciaUrl: string | undefined
      if (evidenciaFile) {
        evidenciaUrl = await this.uploadEvidencia(evidenciaFile)
      }

      // Determinar status baseado na condição
      let novoStatus: HistoricoFuncionario['status']
      switch (condicaoDevolucao) {
        case 'bom':
        case 'regular':
          novoStatus = 'devolvido'
          break
        case 'danificado':
          novoStatus = 'danificado'
          break
        case 'perdido':
          novoStatus = 'perdido'
          break
        case 'reteste':
          novoStatus = 'reteste'
          break
        default:
          novoStatus = 'devolvido'
      }

      // Atualizar histórico
      const updateData: Record<string, unknown> = {
        data_devolucao: timestamp,
        status: novoStatus,
        condicao_devolucao: condicaoDevolucao,
        observacoes_devolucao: observacoesDevolucao,
        responsavel_devolucao: responsavelDevolucaoId,
        atualizado_em: timestamp
      }

      if (evidenciaUrl) {
        updateData.evidencia_devolucao_url = evidenciaUrl
      }

      const { data: histAtualizado, error: updateError } = await supabase
        .from('historico_funcionarios')
        .update(updateData)
        .eq('id', historicoId)
        .select(`
          *,
          itens_estoque!inner(id, codigo, nome, categoria, unidade_medida)
        `)
        .single()

      if (updateError) throw updateError

      // Registrar movimentação de devolução no estoque apenas se item estiver em bom estado
      if (condicaoDevolucao === 'bom' || condicaoDevolucao === 'regular') {
        await this.movimentarEstoque({
          item_id: historico.item_id,
          tipo: 'devolucao',
          quantidade: historico.quantidade,
          motivo: `Devolução de item em condição: ${condicaoDevolucao}`,
          documento_referencia: historicoId,
          usuario_id: responsavelDevolucaoId || historico.responsavel_entrega,
          observacoes: observacoesDevolucao,
          base_id: historico.base_id
        })
      }
      
      // Para itens em reteste, criar registro separado (não volta ao estoque)
      console.log(`🔍 [DEBUG] condicaoDevolucao:`, condicaoDevolucao, typeof condicaoDevolucao)
      console.log(`🔍 [DEBUG] condicaoDevolucao === 'reteste':`, condicaoDevolucao === 'reteste')
      
      if (condicaoDevolucao === 'reteste') {
        console.log(`🔍 [DEBUG] Entrando no bloco de reteste...`)
        const { error: retesteError } = await supabase
          .from('itens_reteste')
          .insert({
            item_estoque_id: historico.item_id,
            funcionario_id: historico.funcionario_id,
            historico_funcionario_id: historicoId,
            quantidade: historico.quantidade,
            motivo_reteste: observacoesDevolucao || 'Item enviado para reteste',
            responsavel_reteste: responsavelDevolucaoId || historico.responsavel_entrega,
            status: 'em_reteste',
            observacoes: observacoesDevolucao
          })

        if (retesteError) {
          console.error(`❌ [WEB] Erro ao criar registro de reteste:`, retesteError)
        } else {
          console.log(`✅ [WEB] Item ${historico.item_id} registrado para reteste - não volta ao estoque`)
        }
      } else {
        console.log(`🔍 [DEBUG] NÃO entrou no bloco de reteste. condicaoDevolucao:`, condicaoDevolucao)
      }

      console.log(`✅ [WEB] Devolução processada com sucesso:`, histAtualizado.id)
      return histAtualizado
    } catch (error) {
      console.error(`❌ [WEB] Erro ao processar devolução:`, error)
      throw error
    }
  },

  /**
   * Processar troca automática de item danificado/perdido
   */
  async processarTrocaAutomatica(
    historicoOriginalId: string,
    condicaoDevolucao: 'danificado' | 'perdido',
    observacoesDevolucao: string,
    responsavelId: string,
    evidenciaFile?: File,
    assinaturaDigital?: string
  ): Promise<{ devolucao: HistoricoFuncionario; novaSolicitacao: SolicitacaoItem }> {
    const timestamp = new Date().toISOString()

    console.log(`🔄 [WEB] Iniciando troca automática:`, { 
      historicoOriginalId, 
      condicaoDevolucao, 
      responsavelId,
      timestamp 
    })

    try {
      // 1. Buscar dados do histórico original
      const { data: historicoOriginal, error: histError } = await supabase
        .from('historico_funcionarios')
        .select(`
          *,
          itens_estoque!inner(id, nome, codigo, categoria)
        `)
        .eq('id', historicoOriginalId)
        .single()

      if (histError) throw histError
      if (!historicoOriginal) throw new Error('Histórico não encontrado')

      // 2. Processar devolução
      const devolucaoProcessada = await this.processarDevolucao(
        historicoOriginalId,
        condicaoDevolucao,
        observacoesDevolucao,
        responsavelId,
        evidenciaFile
      )

      // 3. Criar nova solicitação automaticamente
      const prioridade = condicaoDevolucao === 'perdido' ? 'urgente' : 'alta'
      const motivoTroca = `Substituição automática - item ${condicaoDevolucao}. Ref: ${historicoOriginalId}`
      
      const novaSolicitacao = await this.criarSolicitacao({
        item_id: historicoOriginal.item_id,
        solicitante_id: responsavelId, // Quem está fazendo a solicitação (responsável pela devolução)
        destinatario_id: historicoOriginal.funcionario_id, // Quem vai receber o novo item
        base_id: historicoOriginal.base_id, // Base de onde puxar o estoque
        quantidade_solicitada: historicoOriginal.quantidade,
        prioridade,
        tipo_troca: 'troca',
        motivo_solicitacao: motivoTroca,
        evidenciaFile,
        assinatura_digital: assinaturaDigital,
        assinatura_nome: `Troca automática por ${responsavelId}`,
        observacoes: `Troca automática devido à condição: ${condicaoDevolucao}. ${observacoesDevolucao}`,
        data_necessidade: timestamp // Urgente
      })

      // 4. Se configurado para aprovação automática, aprovar imediatamente
      try {
        // Verificar se deve aprovar automaticamente (itens críticos ou urgentes)
        const itemCritico = ['epi'].includes(historicoOriginal.itens_estoque.categoria)
        const urgente = condicaoDevolucao === 'perdido'
        
        if (itemCritico || urgente) {
          console.log('🔄 [WEB] Aprovando solicitação de troca automaticamente...')
          await this.aprovarSolicitacao(
            novaSolicitacao.id,
            responsavelId,
            historicoOriginal.quantidade,
            `Aprovação automática - substituição de item ${condicaoDevolucao}`
          )
        }
      } catch (approveError) {
        console.warn('⚠️ [WEB] Não foi possível aprovar automaticamente:', approveError)
        // Não falha o processo, apenas registra o aviso
      }

      console.log(`✅ [WEB] Troca automática processada com sucesso`)
      return {
        devolucao: devolucaoProcessada,
        novaSolicitacao
      }
    } catch (error) {
      console.error(`❌ [WEB] Erro ao processar troca automática:`, error)
      throw error
    }
  },

  /**
   * Processar devolução de item do inventário com estados específicos
   */
  async processarDevolucaoInventario(
    historicoId: string,
    condicao: 'bom' | 'reteste' | 'descarte',
    observacoes?: string,
    responsavelId?: string
  ): Promise<HistoricoFuncionario> {
    const timestamp = new Date().toISOString()

    console.log(`📤 [WEB] Processando devolução de inventário:`, { 
      historicoId, 
      condicao, 
      responsavelId,
      timestamp 
    })

    try {
      // Buscar histórico
      const { data: historico, error: histError } = await supabase
        .from('historico_funcionarios')
        .select('*')
        .eq('id', historicoId)
        .single()

      if (histError) throw histError
      if (!historico) throw new Error('Histórico não encontrado')

      // Determinar status baseado na condição
      let novoStatus: HistoricoFuncionario['status']
      let condicaoDevolucao: string
      
      switch (condicao) {
        case 'bom':
          novoStatus = 'devolvido'
          condicaoDevolucao = 'bom'
          break
        case 'reteste':
          novoStatus = 'reteste'
          condicaoDevolucao = 'reteste'
          break
        case 'descarte':
          novoStatus = 'danificado'
          condicaoDevolucao = 'danificado'
          break
        default:
          novoStatus = 'devolvido'
          condicaoDevolucao = 'bom'
      }

      // Atualizar histórico
      const updateData: Record<string, unknown> = {
        data_devolucao: timestamp,
        status: novoStatus,
        condicao_devolucao: condicaoDevolucao,
        observacoes_devolucao: observacoes,
        responsavel_devolucao: responsavelId,
        atualizado_em: timestamp
      }

      const { data: histAtualizado, error: updateError } = await supabase
        .from('historico_funcionarios')
        .update(updateData)
        .eq('id', historicoId)
        .select(`
          *,
          itens_estoque!inner(id, codigo, nome, categoria, unidade_medida)
        `)
        .single()

      if (updateError) throw updateError

      // Registrar movimentação de devolução no estoque apenas se item estiver em bom estado
      if (condicao === 'bom') {
        await this.movimentarEstoque({
          item_id: historico.item_id,
          tipo: 'devolucao',
          quantidade: historico.quantidade,
          motivo: `Devolução de item em bom estado`,
          documento_referencia: historicoId,
          usuario_id: responsavelId || historico.responsavel_entrega,
          observacoes: observacoes,
          base_id: historico.base_id
        })
      }
      
      // Para itens em reteste, criar registro separado (não volta ao estoque)
      if (condicao === 'reteste') {
        const { error: retesteError } = await supabase
          .from('itens_reteste')
          .insert({
            item_estoque_id: historico.item_id,
            funcionario_id: historico.funcionario_id,
            historico_funcionario_id: historicoId,
            quantidade: historico.quantidade,
            motivo_reteste: observacoes || 'Item enviado para reteste',
            responsavel_reteste: responsavelId || historico.responsavel_entrega,
            status: 'em_reteste',
            observacoes: observacoes
          })

        if (retesteError) {
          console.error(`❌ [WEB] Erro ao criar registro de reteste:`, retesteError)
        } else {
          console.log(`✅ [WEB] Item ${historico.item_id} registrado para reteste - não volta ao estoque`)
        }
      }

      console.log(`✅ [WEB] Devolução de inventário processada com sucesso:`, histAtualizado.id)
      return histAtualizado
    } catch (error) {
      console.error(`❌ [WEB] Erro ao processar devolução de inventário:`, error)
      throw error
    }
  },

  // Métodos para Cotações (desabilitado por enquanto)
  /*
  async getCotacoes(): Promise<Cotacao[]> {
    const { data, error } = await supabase
      .from('cotacoes')
      .select(`
        id, numero, item_nome, descricao, quantidade, unidade, categoria, prioridade,
        status, data_solicitacao, data_resposta, data_validade, usuario_id, solicitante_id,
        aprovador_id, fornecedor, valor_total, observacoes, created_at, updated_at,
        criado_em, atualizado_em
      `)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  },

  async criarCotacao(cotacao: Partial<Cotacao>): Promise<Cotacao> {
    const { data, error } = await supabase
      .from('cotacoes')
      .insert({
        ...cotacao,
        status: cotacao.status || 'pendente',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select('*')
      .single()

    if (error) throw error
    return data as unknown as Cotacao
  },

  async aprovarCotacao(cotacaoId: string): Promise<void> {
    const { error } = await supabase
      .from('cotacoes')
      .update({
        status: 'aprovada',
        updated_at: new Date().toISOString()
      })
      .eq('id', cotacaoId)

    if (error) throw error
  },

  async rejeitarCotacao(cotacaoId: string, motivo: string): Promise<void> {
    const { error } = await supabase
      .from('cotacoes')
      .update({
        status: 'rejeitada',
        observacoes: motivo,
        updated_at: new Date().toISOString()
      })
      .eq('id', cotacaoId)

    if (error) throw error
  },

  // Métodos para Solicitações de Compra
  async getSolicitacoesCompra(): Promise<SolicitacaoCompra[]> {
    const { data, error } = await supabase
      .from('solicitacoes_compra')
      .select(`
        id, item_nome, descricao, quantidade, unidade, categoria, prioridade,
        justificativa, fornecedor_sugerido, status, usuario_id, aprovador_id,
        observacoes, motivo_rejeicao, valor_estimado, data_necessidade,
        aprovado_em, created_at, updated_at
      `)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  },

  async criarSolicitacaoCompra(solicitacao: Partial<SolicitacaoCompra>): Promise<SolicitacaoCompra> {
    const { data, error } = await supabase
      .from('solicitacoes_compra')
      .insert({
        ...solicitacao,
        status: solicitacao.status || 'pendente',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select('*')
      .single()

    if (error) throw error
    return data as unknown as SolicitacaoCompra
  },
  */



  async rejeitarSolicitacao(solicitacaoId: string, rejeitadorId: string, motivo: string): Promise<void> {
    const timestamp = new Date().toISOString()

    console.log(`❌ [WEB] Iniciando rejeição da solicitação:`, { 
      solicitacaoId, 
      rejeitadorId, 
      motivo,
      timestamp 
    })

    try {
      // Buscar a solicitação original primeiro para validação
      const solicitacaoOriginal = await this.getSolicitacaoById(solicitacaoId)
      
      if (solicitacaoOriginal.status !== 'pendente') {
        throw new Error(`Solicitação já foi processada. Status atual: ${solicitacaoOriginal.status}`)
      }

      if (!motivo || motivo.trim() === '') {
        throw new Error('Motivo da rejeição é obrigatório')
      }

      console.log(`✅ [WEB] Solicitação validada para rejeição`)

      // Usar transação para garantir atomicidade
      const { error: transactionError } = await supabase.rpc('rejeitar_solicitacao_estoque', {
        p_solicitacao_id: solicitacaoId,
        p_rejeitador_id: rejeitadorId,
        p_motivo: motivo.trim(),
        p_rejeitado_em: timestamp,
        p_atualizado_em: timestamp
      })

      if (transactionError) {
        console.error(`❌ [WEB] Erro na transação:`, transactionError)
        
        // Fallback: tentar updates individuais
        console.log(`🔄 [WEB] Tentando fallback com updates individuais...`)
        
        const updatePromises = [
          supabase.from('solicitacoes_itens').update({ status: 'rejeitada' }).eq('id', solicitacaoId),
          supabase.from('solicitacoes_itens').update({ aprovado_almoxarifado_por: rejeitadorId }).eq('id', solicitacaoId),
          supabase.from('solicitacoes_itens').update({ aprovado_almoxarifado_em: timestamp }).eq('id', solicitacaoId),
          supabase.from('solicitacoes_itens').update({ motivo_rejeicao: motivo.trim() }).eq('id', solicitacaoId),
          supabase.from('solicitacoes_itens').update({ atualizado_em: timestamp }).eq('id', solicitacaoId)
        ]

        const updateResults = await Promise.allSettled(updatePromises)
        const updateErrors = updateResults.filter(r => r.status === 'rejected')
        
        if (updateErrors.length > 0) {
          console.error(`❌ [WEB] Alguns updates falharam:`, updateErrors)
          throw new Error(`Falha na rejeição: ${updateErrors.length} campos não puderam ser atualizados`)
        }
        
        console.log(`✅ [WEB] Fallback executado com sucesso`)
      } else {
        console.log(`✅ [WEB] Transação executada com sucesso`)
      }

      // Aguardar sincronização
      await new Promise(resolve => setTimeout(resolve, 300))

      console.log(`✅ [WEB] Solicitação rejeitada com sucesso:`, solicitacaoId)

    } catch (error) {
      console.error(`❌ [WEB] Erro ao rejeitar solicitação:`, error)
      throw error
    }
  },



  async getHistoricoAprovacoes(usuarioId: string, periodo: 'hoje' | 'semana' | 'mes' | 'todos' = 'mes'): Promise<SolicitacaoItem[]> {
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

    let query = supabase
      .from('solicitacoes_itens')
      .select('*')
      .eq('aprovado_almoxarifado_por', usuarioId)
      .order('aprovado_almoxarifado_em', { ascending: false })

    if (dataInicio && periodo !== 'todos') {
      query = query.gte('aprovado_almoxarifado_em', dataInicio)
    }

    const { data, error } = await query
    if (error) throw error
    return data || []
  },

  async getHistoricoEntregas(usuarioId: string, periodo: 'hoje' | 'semana' | 'mes' | 'todos' = 'mes'): Promise<SolicitacaoItem[]> {
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

    let query = supabase
      .from('solicitacoes_itens')
      .select('*')
      .eq('entregue_por', usuarioId)
      .order('entregue_em', { ascending: false })

    if (dataInicio && periodo !== 'todos') {
      query = query.gte('entregue_em', dataInicio)
    }

    const { data, error } = await query
    if (error) throw error
    return data || []
  },

  async criarItemEstoque(item: Omit<ItemEstoque, 'id' | 'criado_em' | 'atualizado_em'>): Promise<ItemEstoque> {
    const { data, error } = await supabase
      .from('itens_estoque')
      .insert({
        ...item,
        criado_em: new Date().toISOString(),
        atualizado_em: new Date().toISOString()
      })
      .select('*')
      .single()

    if (error) throw error
    return data as unknown as ItemEstoque
  },

  async reativarSolicitacoesComEstoque(): Promise<{ reativadas: number; movidas: number }> {
    return this.verificarSolicitacoesAguardandoEstoque()
  },

  async processarNotaFiscal(
    notaFiscal: Omit<NotaFiscal, 'id' | 'criado_em' | 'atualizado_em'>,
    itens: Omit<ItemNotaFiscal, 'id' | 'nota_fiscal_id'>[]
  ): Promise<NotaFiscal> {
    const { data: nf, error: nfError } = await supabase
      .from('notas_fiscais')
      .insert({
        ...notaFiscal,
        criado_em: new Date().toISOString(),
        atualizado_em: new Date().toISOString()
      })
      .select('*')
      .single()

    if (nfError) throw nfError

    // Inserir itens da NF
    const itensComNF = itens.map(item => ({
      ...item,
      nota_fiscal_id: nf.id
    }))

    const { error: itensError } = await supabase
      .from('itens_nota_fiscal')
      .insert(itensComNF)

    if (itensError) throw itensError

    // Processar entrada no estoque para cada item
    // NÃO usar movimentarEstoque pois ele atualiza manualmente E o trigger também atualiza (duplicação)
    // Inserir movimentações diretamente e deixar o trigger atualizar o estoque automaticamente
    for (const item of itens) {
      if (item.item_id) {
        // Buscar estoque atual do item
        const { data: itemAtual, error: itemAtualError } = await supabase
          .from('itens_estoque')
          .select('estoque_atual')
          .eq('id', item.item_id)
          .eq('base_id', notaFiscal.base_id)
          .single()
        
        if (itemAtualError) throw itemAtualError
        
        const quantidadeAnterior = itemAtual?.estoque_atual || 0
        const quantidadeAtual = quantidadeAnterior + item.quantidade
        
        // Inserir movimentação diretamente (o trigger atualizará o estoque automaticamente)
        const { error: movError } = await supabase
          .from('movimentacoes_estoque')
          .insert({
            item_id: item.item_id,
            tipo: 'entrada',
            quantidade: item.quantidade,
            quantidade_anterior: quantidadeAnterior,
            quantidade_atual: quantidadeAtual,
            motivo: `Entrada NF ${nf.numero}`,
            documento_referencia: nf.numero,
            usuario_id: nf.usuario_recebimento,
            base_id: notaFiscal.base_id,
            observacoes: `Entrada por Nota Fiscal ${nf.numero}`,
            criado_em: new Date().toISOString()
          })
        
        if (movError) throw movError
      }
    }

    return nf
  },

  /**
   * Processar recebimento de transferência entre bases
   * Cria registro de transferência e adiciona itens ao estoque da base destino
   * NÃO debita da base origem (para bases sem sistema)
   */
  async processarRecebimentoTransferencia(
    dadosTransferencia: {
      base_origem_id: string
      base_destino_id: string
      numero_transferencia?: string
      data_recebimento: string
      observacoes?: string
      usuario_recebimento: string
      contrato_destino_id?: string
    },
    itens: Array<{
      item_id?: string
      codigo_item?: string
      descricao: string
      quantidade: number
      valor_unitario: number
      valor_total: number
      unidade: string
      observacoes?: string
    }>
  ): Promise<void> {
    // Gerar número de transferência se não fornecido (apenas para referência na movimentação)
    let numeroTransferenciaBase = dadosTransferencia.numero_transferencia
    if (!numeroTransferenciaBase) {
      const { data: numeroData, error: numeroError } = await supabase
        .rpc('gerar_numero_transferencia')
      
      if (numeroError) throw numeroError
      numeroTransferenciaBase = numeroData
    }

    // Validar itens na base destino
    for (const item of itens) {
      if (!item.item_id) {
        throw new Error(`Item "${item.descricao}" não possui ID válido. Selecione um item do estoque.`)
      }

      // Apenas verificar se o item existe na base destino (onde vamos adicionar)
      const { data: itemDestino, error: itemError } = await supabase
        .from('itens_estoque')
        .select('id, base_id')
        .eq('id', item.item_id)
        .eq('base_id', dadosTransferencia.base_destino_id)
        .single()

      if (itemError || !itemDestino) {
        throw new Error(`Item "${item.descricao}" não encontrado na base destino`)
      }
    }

    // Buscar nomes das bases para local_origem e local_destino
    const { data: baseOrigem } = await supabase
      .from('bases')
      .select('nome')
      .eq('id', dadosTransferencia.base_origem_id)
      .single()
    
    const { data: baseDestino } = await supabase
      .from('bases')
      .select('nome')
      .eq('id', dadosTransferencia.base_destino_id)
      .single()

    // Inserir registros de transferência usando função SQL que desabilita triggers
    // A função desabilita temporariamente os triggers para evitar validações de estoque na origem
    for (const item of itens) {
      const { error: transfError } = await supabase.rpc('criar_transferencia_recebimento', {
        p_numero_transferencia: numeroTransferenciaBase,
        p_item_estoque_id: item.item_id, // Item da base DESTINO
        p_quantidade: item.quantidade,
        p_valor_unitario: item.valor_unitario,
        p_base_origem_id: dadosTransferencia.base_origem_id,
        p_base_destino_id: dadosTransferencia.base_destino_id,
        p_data_recebimento: dadosTransferencia.data_recebimento,
        p_solicitante_id: dadosTransferencia.usuario_recebimento,
        p_recebido_por_id: dadosTransferencia.usuario_recebimento,
        p_motivo: `Recebimento de transferência entre bases - ${numeroTransferenciaBase}`,
        p_contrato_destino_id: dadosTransferencia.contrato_destino_id || null,
        p_observacoes_recebimento: item.observacoes || dadosTransferencia.observacoes || null
      })

      if (transfError) {
        console.error('Erro ao criar registro de transferência:', transfError)
        throw new Error(`Erro ao criar registro de transferência: ${transfError.message}`)
      }
    }

    // Processar movimentações de estoque para cada item
    // NÃO usar movimentarEstoque pois ele atualiza manualmente E o trigger também atualiza (duplicação)
    // Inserir movimentações diretamente e deixar o trigger atualizar o estoque automaticamente
    for (const item of itens) {
      // Validar item_id antes de processar
      if (!item.item_id) {
        console.error('Item sem ID válido:', item)
        continue // Pular item sem ID (já validado anteriormente, mas TypeScript precisa disso)
      }
      
      // Buscar estoque atual do item na base destino
      const { data: itemAtual, error: itemAtualError } = await supabase
        .from('itens_estoque')
        .select('estoque_atual')
        .eq('id', item.item_id)
        .eq('base_id', dadosTransferencia.base_destino_id)
        .single()
      
      if (itemAtualError) throw itemAtualError
      
      const quantidadeAnterior = itemAtual?.estoque_atual || 0
      const quantidadeAtual = quantidadeAnterior + item.quantidade
      
      // Inserir movimentação diretamente (o trigger atualizará o estoque automaticamente)
      const { error: movError } = await supabase
        .from('movimentacoes_estoque')
        .insert({
          item_id: item.item_id,
          tipo: 'entrada',
          quantidade: item.quantidade,
          quantidade_anterior: quantidadeAnterior,
          quantidade_atual: quantidadeAtual,
          motivo: `Recebimento de transferência ${numeroTransferenciaBase} da base ${baseOrigem?.nome || dadosTransferencia.base_origem_id}`,
          documento_referencia: numeroTransferenciaBase,
          usuario_id: dadosTransferencia.usuario_recebimento,
          base_id: dadosTransferencia.base_destino_id,
          local_origem: baseOrigem?.nome || dadosTransferencia.base_origem_id,
          local_destino: baseDestino?.nome || dadosTransferencia.base_destino_id,
          observacoes: item.observacoes || dadosTransferencia.observacoes || undefined,
          criado_em: new Date().toISOString()
        })
      
      if (movError) throw movError
    }
  },

  // ============================================================================
  // NOTAS FISCAIS
  // ============================================================================

  async getNotasFiscais(): Promise<NotaFiscal[]> {
    try {
      console.log('🔍 Buscando notas fiscais...')
      
      // Primeiro, buscar apenas os dados básicos da tabela notas_fiscais
      const { data, error } = await supabase
        .from('notas_fiscais')
        .select('*')
        .order('criado_em', { ascending: false })

      if (error) {
        console.error('❌ Erro na query básica:', error)
        throw error
      }

      console.log('✅ Dados básicos encontrados:', data?.length || 0, 'notas fiscais')

      // Se não há dados, retornar array vazio
      if (!data || data.length === 0) {
        console.log('ℹ️ Nenhuma nota fiscal encontrada')
        return []
      }

      // Agora buscar os relacionamentos para cada NF
      const notasComRelacionamentos = await Promise.all(
        data.map(async (nf) => {
          try {
            // Buscar itens da NF
            const { data: itens } = await supabase
              .from('itens_nota_fiscal')
              .select('*')
              .eq('nota_fiscal_id', nf.id)

            // Buscar dados da base
            const { data: base } = await supabase
              .from('bases')
              .select('nome')
              .eq('id', nf.base_id)
              .single()

            // Buscar dados do usuário de recebimento
            const { data: usuarioRecebimento } = await supabase
              .from('usuarios')
              .select('nome, email')
              .eq('id', nf.usuario_recebimento)
              .single()

            // Buscar dados do usuário de conferência (se existir)
            let usuarioConferencia = null
            if (nf.usuario_conferencia) {
              const { data: confData } = await supabase
                .from('usuarios')
                .select('nome, email')
                .eq('id', nf.usuario_conferencia)
                .single()
              usuarioConferencia = confData
            }

            return {
              ...nf,
              itens: itens || [],
              base: base || null,
              usuario_recebimento: usuarioRecebimento || null,
              usuario_conferencia: usuarioConferencia
            }
          } catch (relError) {
            console.error('❌ Erro ao buscar relacionamentos para NF', nf.id, ':', relError)
            // Retornar NF sem relacionamentos em caso de erro
            return {
              ...nf,
              itens: [],
              base: null,
              usuario_recebimento: null,
              usuario_conferencia: null
            }
          }
        })
      )

      console.log('✅ Notas fiscais processadas:', notasComRelacionamentos.length)
      return notasComRelacionamentos
    } catch (error) {
      console.error('❌ Erro geral ao buscar notas fiscais:', error)
      throw error
    }
  },

  async getNotaFiscalById(id: string): Promise<NotaFiscal> {
    const { data, error } = await supabase
      .from('notas_fiscais')
      .select(`
        *,
        itens:itens_nota_fiscal(
          *,
          item:itens_estoque(nome, codigo, unidade_medida)
        ),
        base:bases(nome)
      `)
      .eq('id', id)
      .single()

    if (error) throw error

    // Buscar dados dos usuários separadamente para evitar conflito de relacionamentos
    if (data.usuario_recebimento) {
      const { data: usuarioRecebimento } = await supabase
        .from('usuarios')
        .select('nome, email')
        .eq('id', data.usuario_recebimento)
        .single()
      
      if (usuarioRecebimento) {
        data.usuario_recebimento = usuarioRecebimento
      }
    }

    if (data.usuario_conferencia) {
      const { data: usuarioConferencia } = await supabase
        .from('usuarios')
        .select('nome, email')
        .eq('id', data.usuario_conferencia)
        .single()
      
      if (usuarioConferencia) {
        data.usuario_conferencia = usuarioConferencia
      }
    }

    // Processar itens para mapear dados do item de estoque
    if (data.itens) {
      data.itens = data.itens.map((item: ItemNotaFiscal) => ({
        ...item,
        descricao: item.item?.nome || item.descricao || 'Item não encontrado',
        codigo_item: item.item?.codigo || item.codigo_item || 'N/A',
        unidade: item.item?.unidade_medida || item.unidade || 'UN'
      }))
    }

    return data
  },

  async updateNotaFiscal(id: string, updates: Partial<NotaFiscal>): Promise<NotaFiscal> {
    // Atualizar dados da NF
    const { error } = await supabase
      .from('notas_fiscais')
      .update({
        ...updates,
        atualizado_em: new Date().toISOString()
      })
      .eq('id', id)

    if (error) throw error

    // Retornar dados completos da NF (incluindo itens)
    return await this.getNotaFiscalById(id)
  },

  async updateItensNotaFiscal(notaFiscalId: string, itens: Array<{
    id: string
    quantidade: number
    valor_unitario: number
    valor_total: number
    observacoes: string
    isNew?: boolean
    isDeleted?: boolean
    item_id?: string
    codigo_item?: string
    descricao?: string
    unidade?: string
  }>): Promise<void> {
    for (const item of itens) {
      if (item.isDeleted) {
        // Excluir item da NF
        const { error } = await supabase
          .from('itens_nota_fiscal')
          .delete()
          .eq('id', item.id)

        if (error) throw error
      } else if (item.isNew) {
        // Criar novo item na NF
        const { error } = await supabase
          .from('itens_nota_fiscal')
          .insert({
            nota_fiscal_id: notaFiscalId,
            item_id: item.item_id || null,
            codigo_item: item.codigo_item || null,
            descricao: item.descricao || '',
            quantidade: item.quantidade,
            valor_unitario: item.valor_unitario,
            valor_total: item.valor_total,
            unidade: item.unidade || 'UN',
            observacoes: item.observacoes || null
          })

        if (error) throw error
      } else {
        // Atualizar item existente
        const { error } = await supabase
          .from('itens_nota_fiscal')
          .update({
            quantidade: item.quantidade,
            valor_unitario: item.valor_unitario,
            valor_total: item.valor_total,
            observacoes: item.observacoes || null,
            atualizado_em: new Date().toISOString()
          })
          .eq('id', item.id)

        if (error) throw error
      }
    }
  },

  async adjustarEstoquePorDiferenca(
    itemId: string, 
    quantidadeDiferenca: number, 
    motivo: string, 
    usuarioId: string
  ): Promise<void> {
    const { error } = await supabase
      .from('movimentacoes_estoque')
      .insert({
        item_id: itemId,
        tipo: quantidadeDiferenca > 0 ? 'entrada' : 'saida',
        quantidade: Math.abs(quantidadeDiferenca),
        quantidade_anterior: 0, // Será atualizado pelo trigger
        quantidade_atual: 0, // Será atualizado pelo trigger
        motivo: motivo,
        usuario_id: usuarioId,
        criado_em: new Date().toISOString()
      })

    if (error) throw error
  },

  async deleteArquivoNotaFiscal(notaFiscalId: string): Promise<void> {
    // Buscar dados da NF para obter o arquivo atual
    const { data: nf, error: fetchError } = await supabase
      .from('notas_fiscais')
      .select('arquivo_url')
      .eq('id', notaFiscalId)
      .single()

    if (fetchError) throw fetchError

    if (nf?.arquivo_url) {
      // Extrair o caminho do arquivo da URL
      const url = new URL(nf.arquivo_url)
      const filePath = url.pathname.split('/').slice(-2).join('/') // Pega as últimas 2 partes do path

      // Deletar arquivo do storage
      const { error: deleteError } = await supabase.storage
        .from('notas-fiscais')
        .remove([filePath])

      if (deleteError) {
        console.warn('Erro ao deletar arquivo do storage:', deleteError)
        // Não falha a operação se não conseguir deletar do storage
      }
    }

    // Remover referência do arquivo na NF
    const { error: updateError } = await supabase
      .from('notas_fiscais')
      .update({ 
        arquivo_url: null,
        atualizado_em: new Date().toISOString()
      })
      .eq('id', notaFiscalId)

    if (updateError) throw updateError
  },

  async uploadArquivoNotaFiscal(notaFiscalId: string, file: File): Promise<string> {
    // Validar tipo de arquivo
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png']
    if (!allowedTypes.includes(file.type)) {
      throw new Error('Tipo de arquivo não permitido. Use PDF, JPG ou PNG.')
    }

    // Validar tamanho do arquivo (50MB)
    const maxSize = 50 * 1024 * 1024 // 50MB
    if (file.size > maxSize) {
      throw new Error('Arquivo muito grande. Tamanho máximo: 50MB.')
    }

    // Gerar nome único para o arquivo
    const fileExt = file.name.split('.').pop()
    const fileName = `nf_${notaFiscalId}_${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`
    const filePath = `notas-fiscais/${fileName}`

    // Upload para o bucket
    const { error: uploadError } = await supabase.storage
      .from('notas-fiscais')
      .upload(filePath, file)

    if (uploadError) {
      throw new Error(`Erro no upload: ${uploadError.message}`)
    }

    // Obter URL pública
    const { data: urlData } = supabase.storage
      .from('notas-fiscais')
      .getPublicUrl(filePath)

    // Atualizar NF com nova URL do arquivo
    const { error: updateError } = await supabase
      .from('notas_fiscais')
      .update({ 
        arquivo_url: urlData.publicUrl,
        atualizado_em: new Date().toISOString()
      })
      .eq('id', notaFiscalId)

    if (updateError) throw updateError

    return urlData.publicUrl
  },

  async updateStatusNotaFiscal(id: string, status: NotaFiscal['status'], usuarioConferencia?: string): Promise<NotaFiscal> {
    const { data, error } = await supabase
      .from('notas_fiscais')
      .update({
        status,
        usuario_conferencia: usuarioConferencia || null,
        atualizado_em: new Date().toISOString()
      })
      .eq('id', id)
      .select('*')
      .single()

    if (error) throw error
    return data
  },

  /**
   * Cancelar solicitação aprovada (reverter aprovação)
   */
  async cancelarSolicitacaoAprovada(solicitacaoId: string, motivoCancelamento: string, responsavelId: string): Promise<SolicitacaoItem> {
    try {
      console.log('🔄 Cancelando solicitação aprovada:', solicitacaoId)
      
      // Buscar dados da solicitação
      const { data: solicitacao, error: solicitacaoError } = await supabase
        .from('solicitacoes_itens')
        .select('*')
        .eq('id', solicitacaoId)
        .in('status', ['aprovada', 'aguardando_estoque'])
        .single()

      if (solicitacaoError) throw solicitacaoError
      if (!solicitacao) throw new Error('Solicitação não encontrada ou não pode ser cancelada')

      // Se já foi entregue, não pode cancelar
      if (solicitacao.status === 'entregue') {
        throw new Error('Não é possível cancelar uma solicitação já entregue')
      }

      // Atualizar status para cancelada
      const { data: solicitacaoCancelada, error: updateError } = await supabase
        .from('solicitacoes_itens')
        .update({ 
          status: 'cancelada',
          motivo_cancelamento: motivoCancelamento,
          responsavel_cancelamento: responsavelId,
          data_cancelamento: new Date().toISOString(),
          atualizado_em: new Date().toISOString()
        })
        .eq('id', solicitacaoId)
        .select('*')
        .single()

      if (updateError) throw updateError

      console.log('✅ Solicitação cancelada com sucesso')
      return solicitacaoCancelada
    } catch (error) {
      console.error('❌ Erro ao cancelar solicitação aprovada:', error)
      throw error
    }
  },

  /**
   * Processar devolução com troca de item
   */
  async processarDevolucaoComTroca(
    solicitacaoId: string,
    itemDevolvidoId: string,
    novoItemId: string,
    quantidadeDevolvida: number,
    motivoDevolucao: string,
    observacoes: string,
    responsavelId: string
  ): Promise<{ devolucao: MovimentacaoEstoque; novaSolicitacao: SolicitacaoItem }> {
    try {
      console.log('🔄 Processando devolução com troca:', { solicitacaoId, itemDevolvidoId, novoItemId })

      // 1. Buscar dados da solicitação original (PRIMEIRO sem filtro de status para verificar se existe)
      const { data: solicitacaoOriginal, error: solicitacaoError } = await supabase
        .from('solicitacoes_itens')
        .select('*')
        .eq('id', solicitacaoId)
        .single()

      if (solicitacaoError) {
        console.error('❌ Erro ao buscar solicitação:', solicitacaoError)
        throw new Error(`Solicitação não encontrada. Verifique se o ID está correto: ${solicitacaoId}`)
      }
      
      if (!solicitacaoOriginal) {
        throw new Error('Solicitação não encontrada')
      }

      // Verificar se o status é válido para troca/correção
      const statusValidos = ['aprovada', 'entregue', 'aguardando_estoque']
      if (!statusValidos.includes(solicitacaoOriginal.status)) {
        throw new Error(`Não é possível corrigir esta solicitação. Status atual: ${solicitacaoOriginal.status}. Status válidos: ${statusValidos.join(', ')}`)
      }

      console.log('✅ Solicitação encontrada:', { 
        id: solicitacaoOriginal.id, 
        status: solicitacaoOriginal.status,
        item_id: solicitacaoOriginal.item_id 
      })

      // 2. Buscar dados do item devolvido
      const { data: itemDevolvido, error: itemError } = await supabase
        .from('itens_estoque')
        .select('estoque_atual')
        .eq('id', itemDevolvidoId)
        .single()

      if (itemError) throw itemError

      // 3. Registrar devolução do item original
      const { data: devolucao, error: devolucaoError } = await supabase
        .from('movimentacoes_estoque')
        .insert({
          item_id: itemDevolvidoId,
          tipo: 'devolucao',
          quantidade: quantidadeDevolvida,
          quantidade_anterior: itemDevolvido?.estoque_atual || 0,
          quantidade_atual: (itemDevolvido?.estoque_atual || 0) + quantidadeDevolvida,
          motivo: `Devolução com troca: ${motivoDevolucao}`,
          usuario_id: responsavelId,
          solicitante_id: solicitacaoOriginal.solicitante_id,
          destinatario_id: solicitacaoOriginal.destinatario_id,
          solicitacao_id: solicitacaoId, // ✅ UUID da solicitação
          numero_solicitacao: solicitacaoOriginal.numero_solicitacao, // ✅ Número formatado
          documento_referencia: `SOL-${solicitacaoId}`,
          observacoes: observacoes,
          criado_em: new Date().toISOString()
        })
        .select('*')
        .single()

      if (devolucaoError) throw devolucaoError

      // 4. Atualizar estoque do item devolvido
      const novoEstoqueDevolvido = (itemDevolvido?.estoque_atual || 0) + quantidadeDevolvida

      await supabase
        .from('itens_estoque')
        .update({ 
          estoque_atual: novoEstoqueDevolvido,
          atualizado_em: new Date().toISOString()
        })
        .eq('id', itemDevolvidoId)

      // 5. Criar nova solicitação como PENDENTE para passar pela dupla aprovação
      const timestamp = new Date().toISOString()
      
      // Criar solicitação como PENDENTE (não aprovada automaticamente)
      const { data: novaSolicitacao, error: novaSolicitacaoError } = await supabase
        .from('solicitacoes_itens')
        .insert({
          item_id: novoItemId,
          solicitante_id: solicitacaoOriginal.solicitante_id,
          destinatario_id: solicitacaoOriginal.destinatario_id,
          destinatario_equipe_id: solicitacaoOriginal.destinatario_equipe_id || null, // ✅ CORRIGIDO: Incluir equipe (ou null)
          responsavel_equipe_id: solicitacaoOriginal.responsavel_equipe_id || null, // ✅ CORRIGIDO: Incluir responsável da equipe (ou null)
          base_id: solicitacaoOriginal.base_id, // ✅ CORRIGIDO: Incluir base
          quantidade_solicitada: quantidadeDevolvida, // Mesma quantidade que foi entregue
          quantidade_aprovada: null, // ✅ CORRIGIDO: Não aprovar automaticamente, deve passar pela dupla aprovação
          status: 'pendente', // ✅ CORRIGIDO: Status pendente para passar pela dupla aprovação (Almoxarifado + SESMT)
          prioridade: 'alta',
          tipo_troca: 'troca',
          motivo_solicitacao: `Troca por devolução: ${motivoDevolucao}`,
          observacoes: `Troca automática. Item original: ${itemDevolvidoId}. ${observacoes}`,
          // ✅ CORRIGIDO: Não preencher campos de aprovação - deve passar pela dupla aprovação
          data_necessidade: timestamp,
          criado_em: timestamp,
          atualizado_em: timestamp
        })
        .select('*')
        .single()

      if (novaSolicitacaoError) throw novaSolicitacaoError

      // ✅ CORRIGIDO: Não processar movimentação de estoque automaticamente
      // A movimentação de estoque só deve acontecer após a aprovação da solicitação
      // através do fluxo normal de aprovação (Almoxarifado + SESMT)
      console.log('✅ Nova solicitação criada como PENDENTE para dupla aprovação')

      // 6. Remover item antigo do inventário do funcionário (se estava entregue)
      // Isso é feito apenas para registrar a devolução, mas o novo item só será
      // adicionado ao inventário após a aprovação e entrega da nova solicitação
      if (solicitacaoOriginal.destinatario_id) {
        const { data: inventarioAntigo } = await supabase
          .from('inventario_funcionario')
          .select('*')
          .eq('funcionario_id', solicitacaoOriginal.destinatario_id)
          .eq('item_estoque_id', itemDevolvidoId)
          .eq('status', 'em_uso')
          .order('data_entrega', { ascending: false })
          .limit(1)
          .single()

        if (inventarioAntigo) {
          // Atualizar status do item antigo para devolvido
          await supabase
            .from('inventario_funcionario')
            .update({
              status: 'devolvido',
              data_devolucao: timestamp,
              observacoes_devolucao: `Devolvido para troca. Nova solicitação: ${novaSolicitacao.id}`,
              responsavel_devolucao: responsavelId,
              atualizado_em: timestamp
            })
            .eq('id', inventarioAntigo.id)

          console.log('✅ Item antigo removido do inventário do funcionário')
        }
      }

      // ✅ NOTA: O novo item NÃO será adicionado ao inventário automaticamente
      // Ele só será adicionado após a nova solicitação ser aprovada e entregue
      // através do fluxo normal de aprovação (dupla aprovação: Almoxarifado + SESMT)

      // 9. REMOVER solicitação original completamente (item antigo some das solicitações)
      await supabase
        .from('solicitacoes_itens')
        .delete()
        .eq('id', solicitacaoId)

      console.log('✅ Devolução com troca processada com sucesso')
      return { devolucao, novaSolicitacao }
    } catch (error) {
      console.error('❌ Erro ao processar devolução com troca:', error)
      throw error
    }
  },

  // ============================================================================
  // VERIFICAÇÃO E REATIVAÇÃO DE SOLICITAÇÕES AGUARDANDO ESTOQUE
  // ============================================================================

  async verificarSolicitacoesAguardandoEstoque(): Promise<{ reativadas: number; movidas: number }> {
    const BATCH_SIZE = 5 // Batches pequenos para não estourar URL do Supabase

    try {
      const agora = new Date().toISOString()

      // Buscar solicitações aguardando_estoque JÁ COM o estoque via join (1 query só)
      // Usa hint do FK explícito para evitar PGRST201 (ambiguous relationship)
      const { data: aguardando, error: errAguardando } = await supabase
        .from('solicitacoes_itens')
        .select('id, quantidade_aprovada, itens_estoque!solicitacoes_itens_item_id_fkey(estoque_atual)')
        .eq('status', 'aguardando_estoque')
        .not('quantidade_aprovada', 'is', null)

      if (errAguardando) {
        console.error('❌ [ESTOQUE] Erro ao buscar aguardando:', errAguardando)
        return { reativadas: 0, movidas: 0 }
      }

      // Buscar aprovadas JÁ COM o estoque via join (1 query só)
      // Usa hint do FK explícito para evitar PGRST201 (ambiguous relationship)
      const { data: aprovadas, error: errAprovadas } = await supabase
        .from('solicitacoes_itens')
        .select('id, quantidade_aprovada, itens_estoque!solicitacoes_itens_item_id_fkey(estoque_atual)')
        .eq('status', 'aprovada')
        .not('quantidade_aprovada', 'is', null)

      if (errAprovadas) {
        console.error('❌ [ESTOQUE] Erro ao buscar aprovadas:', errAprovadas)
      }

      console.log(`🔍 [ESTOQUE] Verificando ${aguardando?.length || 0} aguardando, ${aprovadas?.length || 0} aprovadas`)

      // Filtrar IDs direto na memória — sem requests individuais
      const idsReativar = (aguardando || [])
        .filter(s => {
          const estoque = (s.itens_estoque as unknown as { estoque_atual: number })?.estoque_atual || 0
          return estoque >= (s.quantidade_aprovada || 0)
        })
        .map(s => s.id)

      const idsMover = (aprovadas || [])
        .filter(s => {
          const estoque = (s.itens_estoque as unknown as { estoque_atual: number })?.estoque_atual || 0
          return estoque < (s.quantidade_aprovada || 0)
        })
        .map(s => s.id)

      console.log(`📊 [ESTOQUE] ${idsReativar.length} para reativar, ${idsMover.length} para mover`)

      // Atualizar em batches pequenos para não estourar URL
      let reativadas = 0
      let movidas = 0

      for (let i = 0; i < idsReativar.length; i += BATCH_SIZE) {
        const batch = idsReativar.slice(i, i + BATCH_SIZE)
        const { error } = await supabase
          .from('solicitacoes_itens')
          .update({ status: 'aprovada', atualizado_em: agora })
          .in('id', batch)
        if (!error) reativadas += batch.length
        else console.error(`❌ [ESTOQUE] Erro ao reativar batch ${i}:`, error)
      }

      for (let i = 0; i < idsMover.length; i += BATCH_SIZE) {
        const batch = idsMover.slice(i, i + BATCH_SIZE)
        const { error } = await supabase
          .from('solicitacoes_itens')
          .update({ status: 'aguardando_estoque', atualizado_em: agora })
          .in('id', batch)
        if (!error) movidas += batch.length
        else console.error(`❌ [ESTOQUE] Erro ao mover batch ${i}:`, error)
      }

      console.log(`✅ [ESTOQUE] ${reativadas} reativada(s), ${movidas} movida(s) para aguardando`)
      return { reativadas, movidas }
    } catch (error) {
      console.error(`❌ [ESTOQUE] Erro na verificação de estoque:`, error)
      return { reativadas: 0, movidas: 0 }
    }
  }
}


