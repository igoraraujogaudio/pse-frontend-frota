// =============================================
// Tipos para Sistema de Transferência Entre Bases
// =============================================

import { Base, ItemEstoque, User, Contrato } from './index'

// Status da transferência
export type StatusTransferencia = 'pendente' | 'em_transito' | 'concluida' | 'cancelada'

// Prioridade da transferência
export type PrioridadeTransferencia = 'baixa' | 'normal' | 'alta' | 'urgente'

// Condição do item
export type CondicaoItemTransferencia = 'novo' | 'bom' | 'regular' | 'ruim' | 'danificado'

// Ação no histórico
export type AcaoHistoricoTransferencia = 'criacao' | 'aprovacao' | 'rejeicao' | 'envio' | 'recebimento' | 'cancelamento' | 'atualizacao'

// Transferência entre bases
export interface TransferenciaBase {
  id: string
  numero_transferencia: string
  
  // Item e quantidade
  item_estoque_id: string
  quantidade: number
  valor_unitario?: number
  valor_total?: number
  
  // Origem
  base_origem_id: string
  contrato_origem_id?: string
  
  // Destino
  base_destino_id: string
  contrato_destino_id?: string
  
  // Status e datas
  status: StatusTransferencia
  data_solicitacao: string
  data_envio?: string
  data_recebimento?: string
  previsao_chegada?: string
  
  // Responsáveis
  solicitante_id: string
  aprovador_id?: string
  enviado_por_id?: string
  recebido_por_id?: string
  
  // Informações adicionais
  motivo: string
  prioridade: PrioridadeTransferencia
  tipo_transporte?: string
  documento_transporte?: string
  custo_transporte?: number
  
  // Observações
  observacoes_solicitacao?: string
  observacoes_aprovacao?: string
  observacoes_envio?: string
  observacoes_recebimento?: string
  
  // Evidências
  evidencia_envio_url?: string
  evidencia_recebimento_url?: string
  
  // Condição
  condicao_envio?: CondicaoItemTransferencia
  condicao_recebimento?: CondicaoItemTransferencia
  
  // Assinaturas
  assinatura_enviado?: string
  assinatura_recebido?: string
  
  // Timestamps
  criado_em: string
  atualizado_em: string
  
  // Relacionamentos (populados via JOIN)
  item_estoque?: ItemEstoque
  base_origem?: Base
  base_destino?: Base
  contrato_origem?: Contrato
  contrato_destino?: Contrato
  solicitante?: User
  aprovador?: User
  enviado_por?: User
  recebido_por?: User
}

// View consolidada com informações calculadas
export interface TransferenciaBaseView {
  id: string
  numero_transferencia: string
  status: StatusTransferencia
  prioridade: PrioridadeTransferencia
  data_solicitacao: string
  data_envio?: string
  data_recebimento?: string
  previsao_chegada?: string
  dias_em_transito: number
  em_atraso: boolean
  dias_atraso: number
  
  // Item
  item_codigo: string
  item_nome: string
  item_categoria: string
  unidade_medida: string
  quantidade: number
  valor_unitario?: number
  valor_total?: number
  
  // Origem
  base_origem_nome: string
  base_origem_id: string
  contrato_origem_nome?: string
  contrato_origem_id?: string
  
  // Destino
  base_destino_nome: string
  base_destino_id: string
  contrato_destino_nome?: string
  contrato_destino_id?: string
  
  // Flag se é entre contratos
  entre_contratos: boolean
  
  // Responsáveis
  solicitante_nome: string
  solicitante_email: string
  aprovador_nome?: string
  enviado_por_nome?: string
  recebido_por_nome?: string
  
  // Outras informações
  motivo: string
  tipo_transporte?: string
  documento_transporte?: string
  custo_transporte?: number
  condicao_envio?: CondicaoItemTransferencia
  condicao_recebimento?: CondicaoItemTransferencia
  
  // Timestamps
  criado_em: string
  atualizado_em: string
}

// Histórico de transferências
export interface HistoricoTransferenciaBase {
  id: string
  transferencia_id: string
  acao: AcaoHistoricoTransferencia
  status_anterior?: StatusTransferencia
  status_novo?: StatusTransferencia
  detalhes?: string
  usuario_id: string
  criado_em: string
  
  // Relacionamentos
  usuario?: User
  transferencia?: TransferenciaBase
}

// Estatísticas por base
export interface EstatisticasTransferenciaBase {
  base_id: string
  base_nome: string
  
  // Enviadas
  total_enviadas: number
  enviadas_pendentes: number
  enviadas_em_transito: number
  enviadas_concluidas: number
  
  // Recebidas
  total_recebidas: number
  recebidas_pendentes: number
  recebidas_em_transito: number
  recebidas_concluidas: number
  
  // Valores
  valor_total_enviado: number
  valor_total_recebido: number
}

// =============================================
// DTOs para criação/atualização
// =============================================

// Criar transferência
export interface CriarTransferenciaBaseDTO {
  item_estoque_id: string
  quantidade: number
  valor_unitario?: number
  
  // Origem
  base_origem_id: string
  contrato_origem_id?: string
  
  // Destino
  base_destino_id: string
  contrato_destino_id?: string
  
  // Informações
  motivo: string
  prioridade?: PrioridadeTransferencia
  previsao_chegada?: string
  tipo_transporte?: string
  condicao_envio?: CondicaoItemTransferencia
  observacoes_solicitacao?: string
}

// Enviar transferência (mudar status para em_transito)
export interface EnviarTransferenciaDTO {
  transferencia_id: string
  data_envio?: string
  tipo_transporte?: string
  documento_transporte?: string
  custo_transporte?: number
  condicao_envio?: CondicaoItemTransferencia
  observacoes_envio?: string
  evidencia_envio_url?: string
  assinatura_enviado?: string
}

// Receber transferência (mudar status para concluida)
export interface ReceberTransferenciaDTO {
  transferencia_id: string
  data_recebimento?: string
  condicao_recebimento: CondicaoItemTransferencia
  observacoes_recebimento?: string
  evidencia_recebimento_url?: string
  assinatura_recebido?: string
}

// Cancelar transferência
export interface CancelarTransferenciaDTO {
  transferencia_id: string
  motivo: string
}

// =============================================
// Filtros para listagem
// =============================================

export interface FiltrosTransferenciaBase {
  status?: StatusTransferencia | StatusTransferencia[]
  prioridade?: PrioridadeTransferencia
  base_origem_id?: string
  base_destino_id?: string
  contrato_origem_id?: string
  contrato_destino_id?: string
  item_estoque_id?: string
  solicitante_id?: string
  data_solicitacao_inicio?: string
  data_solicitacao_fim?: string
  em_atraso?: boolean
  entre_contratos?: boolean
  numero_transferencia?: string
}




