import * as XLSX from 'xlsx'
import { DadosPedidoCompra } from '@/types/pedido-compra'

/**
 * Gera e faz download de um arquivo Excel (.xlsx) com os dados do pedido de compra.
 * Segue o padrão de exportação da página compras/page.tsx.
 */
export function gerarPedidoCompraXLS(dados: DadosPedidoCompra): void {
  const wb = XLSX.utils.book_new()

  // Cria a sheet com cabeçalho + dados usando aoa_to_sheet
  const headers = ['Código', 'Nome', 'Base', 'Quantidade Solicitada', 'Unidade de Medida', 'Valor Estimado', 'Valor Total']
  const rows = dados.itens.map(item => {
    const quantidade = item.quantidade_editada ?? item.quantidade_necessaria
    const valorUnitario = item.valor_unitario
    const valorTotal = valorUnitario != null ? quantidade * valorUnitario : null
    return [
      item.codigo,
      item.nome,
      item.base_nome,
      quantidade,
      item.unidade_medida,
      valorUnitario != null ? valorUnitario.toFixed(2) : '',
      valorTotal != null ? valorTotal.toFixed(2) : '',
    ]
  })

  const sheetData = [
    [`Pedido de Compra - ${dados.numero_pedido}`],
    [`Contrato: ${dados.contrato_nome}`],
    [`Data: ${dados.data_geracao}`],
    [`Almoxarife: ${dados.almoxarife_nome}`],
    [],
    headers,
    ...rows,
  ]

  const ws = XLSX.utils.aoa_to_sheet(sheetData)

  XLSX.utils.book_append_sheet(wb, ws, 'Pedido de Compra')

  // Formato do nome: pedido_compra_NNNN_AAAA.xlsx
  const nomeArquivo = `pedido_compra_${dados.numero_pedido.replace('/', '_')}.xlsx`
  XLSX.writeFile(wb, nomeArquivo)
}
