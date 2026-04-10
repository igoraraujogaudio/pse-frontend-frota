import { supabase } from '@/lib/supabase'
import type {
  ItemPedidoCompra,
  SolicitacaoAguardando,
  DadosPedidoCompra,
  GrupoBase,
  SugestaoTransferencia,
} from '@/types/pedido-compra'

export const pedidoCompraService = {
  /**
   * Carrega itens que precisam de reposição para as bases informadas.
   * Retorna agrupado por base.
   */
  async carregarDadosPedidoPorBases(
    baseIds: string[],
    basesInfo: Map<string, { nome: string; contrato_nome: string }>
  ): Promise<GrupoBase[]> {
    if (baseIds.length === 0) return []

    // Buscar itens de estoque das bases
    const { data: itensEstoque, error: itensError } = await supabase
      .from('itens_estoque')
      .select('id, codigo, nome, categoria, unidade_medida, estoque_atual, estoque_minimo, valor_unitario, base_id')
      .in('base_id', baseIds)
      .eq('status', 'ativo')
      .order('nome')

    if (itensError) throw itensError

    const itensBaixoEstoque = (itensEstoque || []).filter(
      item => item.estoque_atual < item.estoque_minimo
    )

    if (itensBaixoEstoque.length === 0) return []

    // Buscar solicitações aguardando estoque das bases
    const { data: solicitacoes, error: solicitacoesError } = await supabase
      .from('solicitacoes_itens')
      .select(`
        id, item_id, quantidade_aprovada, criado_em,
        solicitante:usuarios!solicitante_id(id, nome),
        destinatario:usuarios!destinatario_id(id, nome)
      `)
      .in('base_id', baseIds)
      .eq('status', 'aguardando_estoque')
      .not('quantidade_aprovada', 'is', null)

    if (solicitacoesError) throw solicitacoesError

    // Agrupar solicitações por item_id
    const solicitacoesPorItem = new Map<string, SolicitacaoAguardando[]>()
    const somaPorItem = new Map<string, number>()

    for (const sol of (solicitacoes || [])) {
      const itemId = sol.item_id as string
      const qtdAprovada = sol.quantidade_aprovada as number
      somaPorItem.set(itemId, (somaPorItem.get(itemId) || 0) + qtdAprovada)

      const solicitanteRaw = sol.solicitante
      const destinatarioRaw = sol.destinatario
      const solicitante = Array.isArray(solicitanteRaw) ? solicitanteRaw[0] : solicitanteRaw
      const destinatario = Array.isArray(destinatarioRaw) ? destinatarioRaw[0] : destinatarioRaw

      const aguardando: SolicitacaoAguardando = {
        id: sol.id as string,
        solicitante_nome: solicitante?.nome || 'N/A',
        destinatario_nome: destinatario?.nome || 'N/A',
        quantidade_aprovada: qtdAprovada,
        criado_em: sol.criado_em as string,
      }

      if (!solicitacoesPorItem.has(itemId)) solicitacoesPorItem.set(itemId, [])
      solicitacoesPorItem.get(itemId)!.push(aguardando)
    }

    // Montar itens e agrupar por base
    const itensPorBase = new Map<string, ItemPedidoCompra[]>()

    for (const item of itensBaixoEstoque) {
      const quantidadeSolicitacoes = somaPorItem.get(item.id) || 0
      const quantidadeNecessaria = item.estoque_minimo - item.estoque_atual + quantidadeSolicitacoes
      if (quantidadeNecessaria <= 0) continue

      const baseInfo = basesInfo.get(item.base_id)
      const pedidoItem: ItemPedidoCompra = {
        id: item.id,
        codigo: item.codigo || '',
        nome: item.nome || '',
        categoria: item.categoria || '',
        unidade_medida: item.unidade_medida || '',
        estoque_atual: item.estoque_atual,
        estoque_minimo: item.estoque_minimo,
        valor_unitario: item.valor_unitario || null,
        quantidade_solicitacoes: quantidadeSolicitacoes,
        quantidade_necessaria: quantidadeNecessaria,
        quantidade_editada: null,
        base_id: item.base_id,
        base_nome: baseInfo?.nome || 'N/A',
        solicitacoes: solicitacoesPorItem.get(item.id) || [],
      }

      if (!itensPorBase.has(item.base_id)) itensPorBase.set(item.base_id, [])
      itensPorBase.get(item.base_id)!.push(pedidoItem)
    }

    const grupos: GrupoBase[] = []
    for (const [baseId, itens] of itensPorBase) {
      const baseInfo = basesInfo.get(baseId)
      grupos.push({ base_id: baseId, base_nome: baseInfo?.nome || 'N/A', itens })
    }
    return grupos.sort((a, b) => a.base_nome.localeCompare(b.base_nome))
  },

  /**
   * Busca sugestões de transferência entre bases.
   * Compara itens com falta (nas bases do contrato selecionado) contra itens com excesso
   * em TODAS as bases acessíveis (inclusive de outros contratos).
   */
  async buscarSugestoesTransferencia(
    contratoId: string,
    itensFaltando: ItemPedidoCompra[],
    basesAcessiveisIds: string[],
    basesInfo: Map<string, { nome: string; contrato_nome: string }>
  ): Promise<SugestaoTransferencia[]> {
    if (itensFaltando.length === 0 || basesAcessiveisIds.length === 0) return []

    // Códigos dos itens que precisam de reposição
    const codigosFaltando = [...new Set(itensFaltando.map(i => i.codigo))]

    // Buscar esses mesmos códigos em TODAS as bases acessíveis
    const { data: itensTodasBases, error } = await supabase
      .from('itens_estoque')
      .select('id, codigo, nome, categoria, unidade_medida, estoque_atual, estoque_minimo, base_id')
      .in('base_id', basesAcessiveisIds)
      .in('codigo', codigosFaltando)
      .eq('status', 'ativo')

    if (error) throw error

    // Filtrar itens com excesso (estoque_atual > estoque_minimo)
    const itensComExcesso = (itensTodasBases || []).filter(
      item => item.estoque_atual > item.estoque_minimo
    )

    // Gerar sugestões cruzando falta x excesso
    const sugestoes: SugestaoTransferencia[] = []

    for (const itemFalta of itensFaltando) {
      for (const itemExcesso of itensComExcesso) {
        // Mesmo código, bases diferentes
        if (itemExcesso.codigo === itemFalta.codigo && itemExcesso.base_id !== itemFalta.base_id) {
          const excesso = itemExcesso.estoque_atual - itemExcesso.estoque_minimo
          if (excesso <= 0) continue

          const origemInfo = basesInfo.get(itemExcesso.base_id)
          const destinoInfo = basesInfo.get(itemFalta.base_id)

          sugestoes.push({
            item_codigo: itemFalta.codigo,
            item_nome: itemFalta.nome,
            categoria: itemFalta.categoria,
            unidade_medida: itemFalta.unidade_medida,
            base_origem_id: itemExcesso.base_id,
            base_origem_nome: origemInfo?.nome || 'N/A',
            contrato_origem_nome: origemInfo?.contrato_nome || 'N/A',
            excesso,
            base_destino_id: itemFalta.base_id,
            base_destino_nome: destinoInfo?.nome || 'N/A',
            contrato_destino_nome: destinoInfo?.contrato_nome || 'N/A',
            necessidade: itemFalta.quantidade_necessaria,
            quantidade_sugerida: Math.min(excesso, itemFalta.quantidade_necessaria),
          })
        }
      }
    }

    // Ordenar: mesmo contrato primeiro, depois por quantidade sugerida desc
    return sugestoes.sort((a, b) => {
      if (a.contrato_origem_nome === a.contrato_destino_nome && b.contrato_origem_nome !== b.contrato_destino_nome) return -1
      if (a.contrato_origem_nome !== a.contrato_destino_nome && b.contrato_origem_nome === b.contrato_destino_nome) return 1
      return b.quantidade_sugerida - a.quantidade_sugerida
    })
  },

  async gerarNumeroPedido(contratoId: string): Promise<string> {
    const { data, error } = await supabase.rpc('gerar_numero_pedido_compra', {
      p_contrato_id: contratoId,
    })
    if (error) throw error
    return String(data)
  },

  async salvarPedido(dados: DadosPedidoCompra, contratoId: string, almoxarifeId: string): Promise<void> {
    const { data: pedido, error: pedidoError } = await supabase
      .from('pedidos_compra')
      .insert({
        numero: dados.numero_pedido,
        contrato_id: contratoId,
        almoxarife_id: almoxarifeId,
        valor_total_estimado: dados.valor_total_estimado,
        total_itens: dados.itens.length,
      })
      .select('id')
      .single()

    if (pedidoError) throw pedidoError

    const itensParaInserir = dados.itens.map(item => {
      const quantidadeFinal = item.quantidade_editada ?? item.quantidade_necessaria
      return {
        pedido_id: pedido.id,
        item_estoque_id: item.id,
        codigo: item.codigo,
        nome: item.nome,
        categoria: item.categoria,
        unidade_medida: item.unidade_medida,
        estoque_atual: item.estoque_atual,
        estoque_minimo: item.estoque_minimo,
        quantidade_solicitacoes: item.quantidade_solicitacoes,
        quantidade_calculada: item.quantidade_necessaria,
        quantidade_final: quantidadeFinal,
        valor_unitario: item.valor_unitario,
        valor_total_estimado: item.valor_unitario ? quantidadeFinal * item.valor_unitario : null,
      }
    })

    const { error: itensError } = await supabase
      .from('pedidos_compra_itens')
      .insert(itensParaInserir)

    if (itensError) throw itensError
  },
}
