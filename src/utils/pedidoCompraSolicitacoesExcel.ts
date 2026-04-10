import * as XLSX from 'xlsx'
import type { GrupoBase } from '@/types/pedido-compra'

interface DadosRelatorioSolicitacoes {
  contrato_nome: string
  data_geracao: string
  almoxarife_nome: string
  grupos: GrupoBase[]
}

export function gerarRelatorioSolicitacoesXLS(dados: DadosRelatorioSolicitacoes): void {
  const wb = XLSX.utils.book_new()

  const cabecalho = [
    ['Relatório de Solicitações Aguardando Estoque'],
    ['Contrato: ' + dados.contrato_nome],
    ['Data: ' + dados.data_geracao],
    ['Gerado por: ' + dados.almoxarife_nome],
    [],
  ]

  const headers = [
    'Base', 'Código', 'Nome Item', 'Categoria', 'Unidade',
    'Estoque Atual', 'Estoque Mínimo',
    'Qtd. Solicitações Aguardando', 'Qtd. Necessária',
  ]

  const rows: (string | number)[][] = []

  for (const grupo of dados.grupos) {
    for (const item of grupo.itens) {
      rows.push([
        grupo.base_nome,
        item.codigo,
        item.nome,
        item.categoria,
        item.unidade_medida,
        item.estoque_atual,
        item.estoque_minimo,
        item.quantidade_solicitacoes,
        item.quantidade_necessaria,
      ])
    }
  }

  const sheetData = [...cabecalho, headers, ...rows]
  const ws = XLSX.utils.aoa_to_sheet(sheetData)

  ws['!cols'] = [
    { wch: 20 }, { wch: 12 }, { wch: 30 }, { wch: 14 }, { wch: 10 },
    { wch: 14 }, { wch: 14 }, { wch: 24 }, { wch: 16 },
  ]

  XLSX.utils.book_append_sheet(wb, ws, 'Solicitações Aguardando')

  const dataFormatada = dados.data_geracao.replace(/\//g, '-')
  XLSX.writeFile(wb, 'relatorio_solicitacoes_' + dataFormatada + '.xlsx')
}
