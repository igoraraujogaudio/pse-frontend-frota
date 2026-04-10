import * as XLSX from 'xlsx'
import type { DiscountOrder } from '@/types/discountOrder'

interface DadosExportacao {
  ordens: DiscountOrder[]
  filtros: {
    setor: string
    status: string
    base: string
    busca: string
  }
  userMap: Record<string, string>
  baseMap: Record<string, string>
  userInfoMap: Record<string, { nome: string; status: string; matricula?: string }>
}

function getStatus(order: DiscountOrder): string {
  if (order.recusado) return 'Recusada'
  if (order.data_assinatura) return 'Assinada'
  return 'Pendente'
}

function formatarDataBR(data: string | undefined): string {
  if (!data || data === '-') return 'Sem data'
  const match = data.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (match) return `${match[3]}/${match[2]}/${match[1]}`
  return 'Sem data'
}

export function exportarOrdensDescontoExcel(dados: DadosExportacao): void {
  const wb = XLSX.utils.book_new()

  const setorLabel = dados.filtros.setor === 'all' ? 'Todos' : dados.filtros.setor === 'frota' ? 'Frota' : 'Almoxarifado'
  const statusLabel = dados.filtros.status === 'all' ? 'Todos' : dados.filtros.status
  const baseLabel = dados.filtros.base ? (dados.baseMap[dados.filtros.base] || dados.filtros.base) : 'Todas'

  const cabecalho = [
    ['Relatório de Ordens de Desconto'],
    ['Data de geração: ' + new Date().toLocaleDateString('pt-BR')],
    ['Filtros aplicados:  Setor: ' + setorLabel + '  |  Status: ' + statusLabel + '  |  Base: ' + baseLabel + (dados.filtros.busca ? '  |  Busca: ' + dados.filtros.busca : '')],
    ['Total de ordens: ' + dados.ordens.length],
    [],
  ]

  const headers = [
    'Data', 'Colaborador', 'Matrícula', 'CPF', 'Criador',
    'Base', 'Placa', 'Valor Total (R$)', 'Parcelas', 'Valor Parcela (R$)',
    'Status', 'Setor', 'Descrição',
  ]

  const rows: (string | number)[][] = dados.ordens.map(order => [
    formatarDataBR(order.data_geracao),
    dados.userMap[order.target_user_id] || '-',
    dados.userInfoMap[order.target_user_id]?.matricula || '-',
    order.cpf || '-',
    dados.userMap[order.created_by] || '-',
    order.base_id ? (dados.baseMap[order.base_id] || '-') : '-',
    order.placa || '-',
    order.valor_total ?? 0,
    order.parcelas ?? 1,
    order.valor_parcela ?? order.valor_total ?? 0,
    getStatus(order),
    order.criado_por_setor || '-',
    order.descricao || '-',
  ])

  const sheetData = [...cabecalho, headers, ...rows]
  const ws = XLSX.utils.aoa_to_sheet(sheetData)

  ws['!cols'] = [
    { wch: 12 }, { wch: 28 }, { wch: 12 }, { wch: 16 }, { wch: 28 },
    { wch: 18 }, { wch: 10 }, { wch: 16 }, { wch: 10 }, { wch: 16 },
    { wch: 12 }, { wch: 14 }, { wch: 40 },
  ]

  XLSX.utils.book_append_sheet(wb, ws, 'Ordens de Desconto')

  const dataFormatada = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')
  const setorSuffix = dados.filtros.setor !== 'all' ? `_${dados.filtros.setor}` : ''
  XLSX.writeFile(wb, `ordens_desconto${setorSuffix}_${dataFormatada}.xlsx`)
}
