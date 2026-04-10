import type { ItemPedidoCompra } from '@/types/pedido-compra'

/**
 * Ordena uma lista de itens do pedido de compra por qualquer campo.
 * Retorna uma nova lista (não muta a original).
 */
export function ordenarItens(
  itens: ItemPedidoCompra[],
  campo: keyof ItemPedidoCompra,
  direcao: 'asc' | 'desc'
): ItemPedidoCompra[] {
  return [...itens].sort((a, b) => {
    const valorA = a[campo]
    const valorB = b[campo]

    if (valorA == null && valorB == null) return 0
    if (valorA == null) return direcao === 'asc' ? -1 : 1
    if (valorB == null) return direcao === 'asc' ? 1 : -1

    let comparacao: number
    if (typeof valorA === 'string' && typeof valorB === 'string') {
      comparacao = valorA.localeCompare(valorB, 'pt-BR')
    } else if (typeof valorA === 'number' && typeof valorB === 'number') {
      comparacao = valorA - valorB
    } else {
      comparacao = String(valorA) < String(valorB) ? -1 : String(valorA) > String(valorB) ? 1 : 0
    }

    return direcao === 'desc' ? -comparacao : comparacao
  })
}

/**
 * Filtra itens por categoria (EPI, ferramental, consumível, equipamento).
 * Retorna todos os itens se categoria for null.
 */
export function filtrarPorCategoria(
  itens: ItemPedidoCompra[],
  categoria: string | null
): ItemPedidoCompra[] {
  if (categoria == null) return itens
  return itens.filter((item) => item.categoria === categoria)
}

/**
 * Calcula o valor total estimado do pedido.
 * Soma `quantidade_final × valor_unitario` para itens com valor_unitario definido,
 * onde quantidade_final = quantidade_editada ?? quantidade_necessaria.
 */
export function calcularValorTotal(itens: ItemPedidoCompra[]): number {
  return itens.reduce((total, item) => {
    if (item.valor_unitario == null) return total
    const quantidadeFinal = item.quantidade_editada ?? item.quantidade_necessaria
    return total + quantidadeFinal * item.valor_unitario
  }, 0)
}

/**
 * Valida se uma quantidade é válida (não negativa).
 * Retorna false para valores negativos.
 */
export function validarQuantidade(valor: number): boolean {
  return valor >= 0
}

/**
 * Remove um item da lista pelo id.
 * Retorna uma nova lista sem o item removido.
 */
export function removerItem(
  itens: ItemPedidoCompra[],
  itemId: string
): ItemPedidoCompra[] {
  return itens.filter((item) => item.id !== itemId)
}
