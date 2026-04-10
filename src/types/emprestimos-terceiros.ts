// =============================================
// Tipos para Sistema de Empréstimo para Terceiros
// =============================================

import { Base } from './index'
import { ItemEstoque } from './index'
import { User } from './index'

// Empresa terceira (externa à organização)
export interface EmpresaTerceira {
  id: string
  razao_social: string
  nome_fantasia?: string
  cnpj: string
  inscricao_estadual?: string
  telefone?: string
  email?: string
  endereco?: string
  cidade?: string
  estado?: string
  cep?: string
  contato_responsavel?: string // Nome do responsável
  telefone_responsavel?: string
  email_responsavel?: string
  tipo_servico?: string // Tipo de serviço que a empresa presta
  ativo: boolean
  observacoes?: string
  criado_em: string
  atualizado_em: string
  criado_por?: string
  criador?: User
}

// Tipo de operação
export type TipoOperacaoEmprestimo = 'emprestimo' | 'transferencia'

// Status do empréstimo
export type StatusEmprestimo = 'ativo' | 'devolvido' | 'baixado' | 'perdido' | 'cancelado'

// Condição do item
export type CondicaoItem = 'novo' | 'usado_bom' | 'usado_regular' | 'usado_ruim' | 'danificado' | 'inutilizavel'

// Ação no histórico
export type AcaoHistoricoEmprestimo = 'criacao' | 'atualizacao' | 'devolucao_parcial' | 'devolucao_total' | 'baixa' | 'cancelamento'

// Empréstimo/Transferência para terceiro
export interface EmprestimoTerceiro {
  id: string
  numero_documento: string
  empresa_terceira_id: string
  item_estoque_id: string
  base_id: string
  
  // Colaborador terceiro (registro simplificado - não há cadastro completo)
  colaborador_nome: string
  colaborador_cpf: string
  colaborador_telefone?: string
  colaborador_funcao?: string // Função/cargo na empresa terceira
  
  // Informações da operação
  tipo_operacao: TipoOperacaoEmprestimo
  quantidade: number
  valor_unitario?: number
  valor_total?: number
  
  // Status e datas
  status: StatusEmprestimo
  data_emprestimo: string // Date no formato ISO
  data_previsao_devolucao?: string // Date no formato ISO
  data_devolucao_real?: string // Date no formato ISO
  quantidade_devolvida: number
  
  // Documentação
  motivo: string
  projeto_obra?: string
  documento_referencia?: string // NF, OS, etc
  evidencia_entrega_url?: string // URL da foto/documento
  evidencia_devolucao_url?: string // URL da foto/documento
  
  // Responsáveis
  usuario_responsavel_id: string
  recebido_por_id?: string
  
  // Condições
  condicao_entrega?: CondicaoItem
  condicao_devolucao?: CondicaoItem
  observacoes_entrega?: string
  observacoes_devolucao?: string
  motivo_baixa?: string
  
  // Assinaturas digitais (base64)
  assinatura_colaborador?: string
  assinatura_responsavel?: string
  
  // Timestamps
  criado_em: string
  atualizado_em: string
  
  // Relacionamentos (populados via JOIN)
  empresa_terceira?: EmpresaTerceira
  item_estoque?: ItemEstoque
  base?: Base
  usuario_responsavel?: User
  recebido_por?: User
}

// Histórico de alterações no empréstimo
export interface HistoricoEmprestimoTerceiro {
  id: string
  emprestimo_id: string
  acao: AcaoHistoricoEmprestimo
  status_anterior?: StatusEmprestimo
  status_novo?: StatusEmprestimo
  quantidade_anterior?: number
  quantidade_nova?: number
  detalhes?: string
  usuario_id: string
  criado_em: string
  
  // Relacionamentos
  usuario?: User
  emprestimo?: EmprestimoTerceiro
}

// View consolidada (já com joins)
export interface EmprestimoTerceiroAtivo {
  id: string
  numero_documento: string
  tipo_operacao: TipoOperacaoEmprestimo
  status: StatusEmprestimo
  data_emprestimo: string
  data_previsao_devolucao?: string
  em_atraso: boolean
  dias_atraso: number
  
  // Empresa
  empresa_razao_social: string
  empresa_nome_fantasia?: string
  empresa_cnpj: string
  empresa_responsavel?: string
  
  // Colaborador
  colaborador_nome: string
  colaborador_cpf: string
  colaborador_telefone?: string
  colaborador_funcao?: string
  
  // Item
  item_codigo: string
  item_nome: string
  item_categoria: string
  unidade_medida: string
  
  // Quantidades
  quantidade: number
  quantidade_devolvida: number
  quantidade_pendente: number
  valor_unitario?: number
  valor_total?: number
  
  // Base
  base_nome: string
  
  // Outras informações
  motivo: string
  projeto_obra?: string
  condicao_entrega?: CondicaoItem
  observacoes_entrega?: string
  
  // Responsável
  responsavel_nome: string
  
  // Timestamps
  criado_em: string
  atualizado_em: string
}

// Estatísticas por empresa
export interface EstatisticasEmpresaTerceira {
  id: string
  razao_social: string
  nome_fantasia?: string
  cnpj: string
  tipo_servico?: string
  total_emprestimos: number
  emprestimos_ativos: number
  emprestimos_devolvidos: number
  itens_perdidos: number
  valor_total_emprestado: number
  valor_em_posse: number
  ultimo_emprestimo?: string
  ativo: boolean
}

// Estatísticas de itens
export interface ItemMaisEmprestadoTerceiros {
  id: string
  codigo: string
  nome: string
  categoria: string
  unidade_medida: string
  total_emprestimos: number
  quantidade_total_emprestada: number
  quantidade_atual_emprestada: number
  quantidade_perdida: number
  estoque_atual: number
}

// =============================================
// DTOs para criação/atualização
// =============================================

// Criar empresa terceira
export interface CriarEmpresaTerceiraDTO {
  razao_social: string
  nome_fantasia?: string
  cnpj?: string
  observacoes?: string
}

// Atualizar empresa terceira
export interface AtualizarEmpresaTerceiraDTO extends Partial<CriarEmpresaTerceiraDTO> {
  ativo?: boolean
}

// Criar empréstimo
export interface CriarEmprestimoTerceiroDTO {
  empresa_terceira_id: string
  item_estoque_id: string
  base_id: string
  
  // Colaborador terceiro
  colaborador_nome: string
  colaborador_cpf: string
  colaborador_telefone?: string
  colaborador_funcao?: string
  
  // Operação
  tipo_operacao: TipoOperacaoEmprestimo
  quantidade: number
  valor_unitario?: number
  
  // Datas
  data_emprestimo?: string // Se não informado, usa data atual
  data_previsao_devolucao?: string // Obrigatório para empréstimos
  
  // Documentação
  motivo: string
  projeto_obra?: string
  documento_referencia?: string
  evidencia_entrega_url?: string
  
  // Condição
  condicao_entrega?: CondicaoItem
  observacoes_entrega?: string
  
  // Assinaturas
  assinatura_colaborador?: string
  assinatura_responsavel?: string
}

// Registrar devolução
export interface RegistrarDevolucaoDTO {
  emprestimo_id: string
  quantidade_devolvida: number
  data_devolucao?: string // Se não informado, usa data atual
  condicao_devolucao: CondicaoItem
  observacoes_devolucao?: string
  evidencia_devolucao_url?: string
}

// Baixar/Cancelar empréstimo
export interface BaixarEmprestimoDTO {
  emprestimo_id: string
  status: 'baixado' | 'perdido' | 'cancelado'
  motivo_baixa: string
}

// =============================================
// Filtros para listagem
// =============================================

export interface FiltrosEmprestimoTerceiro {
  empresa_terceira_id?: string
  item_estoque_id?: string
  base_id?: string
  status?: StatusEmprestimo | StatusEmprestimo[]
  tipo_operacao?: TipoOperacaoEmprestimo
  data_emprestimo_inicio?: string
  data_emprestimo_fim?: string
  em_atraso?: boolean
  colaborador_cpf?: string
  colaborador_nome?: string
  numero_documento?: string
}

export interface FiltrosEmpresaTerceira {
  ativo?: boolean
  cnpj?: string
  razao_social?: string
  tipo_servico?: string
}

