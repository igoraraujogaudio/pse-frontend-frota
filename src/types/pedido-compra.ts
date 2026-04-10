// =============================================
// Tipos para Geração de Pedido de Compra por Contrato
// =============================================

export interface SolicitacaoAguardando {
  id: string
  solicitante_nome: string
  destinatario_nome: string
  quantidade_aprovada: number
  criado_em: string
}

export interface ItemPedidoCompra {
  id: string
  codigo: string
  nome: string
  categoria: string
  unidade_medida: string
  estoque_atual: number
  estoque_minimo: number
  valor_unitario: number | null
  quantidade_solicitacoes: number
  quantidade_necessaria: number
  quantidade_editada: number | null
  base_id: string
  base_nome: string
  solicitacoes: SolicitacaoAguardando[]
}

/** Agrupamento de itens por base dentro de um contrato */
export interface GrupoBase {
  base_id: string
  base_nome: string
  itens: ItemPedidoCompra[]
}

/** Sugestão de transferência entre bases */
export interface SugestaoTransferencia {
  item_codigo: string
  item_nome: string
  categoria: string
  unidade_medida: string
  /** Base que tem excesso */
  base_origem_id: string
  base_origem_nome: string
  contrato_origem_nome: string
  excesso: number
  /** Base que precisa */
  base_destino_id: string
  base_destino_nome: string
  contrato_destino_nome: string
  necessidade: number
  /** Quantidade sugerida para transferir */
  quantidade_sugerida: number
}

export interface DadosPedidoCompra {
  numero_pedido: string
  contrato_nome: string
  data_geracao: string
  almoxarife_nome: string
  itens: ItemPedidoCompra[]
  valor_total_estimado: number
}
