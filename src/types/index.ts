import type { ItemCatalogo } from '@/services/catalogoService'

export type Contrato = {
  id: string
  nome: string
  descricao?: string
  codigo: string
  status: 'ativo' | 'inativo' | 'suspenso'
  responsavel_id?: string
  valor_contrato?: number
  data_inicio?: string
  data_fim?: string
  observacoes?: string
  created_at: string
  updated_at: string
}

export type Base = {
  id: string
  nome: string
  codigo: string
  endereco?: string
  cidade?: string
  estado?: string
  cep?: string
  telefone?: string
  email?: string
  responsavel?: string
  ativa: boolean
  habilitar_biometria_entrega?: boolean
  created_at: string
  updated_at: string
  contrato_id?: string
  contrato?: Contrato
}

// Alias para compatibilidade com sistema antigo
export type Location = Base

export interface User {
  id: string
  nome: string
  email: string
  departamento?: string
  posicao?: string
  cargo?: string
  matricula?: string
  cpf?: string
  telefone?: string
  cnh?: string
  validade_cnh?: string
  cnh_categoria?: string
  perfil_acesso_id?: string
  nivel_acesso: string
  operacao?: string
  turno?: string
  status: string
  data_admissao?: string
  data_nascimento?: string
  telefone_empresarial?: string
  auth_usuario_id?: string
  permissoes_personalizadas?: boolean
  funcionalidades?: unknown[]
  criado_em?: string
  atualizado_em?: string
  cnh_vencimento?: string
  contratos?: Contrato[]
  bases?: Base[]
  contrato_origem_id?: string
  contrato_origem?: Contrato
  // Campos para controle de mudança de senha obrigatória
  deve_mudar_senha?: boolean
  senha_alterada?: boolean
  data_ultima_alteracao_senha?: string
  forcar_mudanca_senha?: boolean
}

// Extended interface for complete funcionario data
export interface FuncionarioCompleto extends User {
  base_id?: string;
  contrato_id?: string;
  data_ultimo_exame_aso?: string;
  data_agendamento_aso?: string;
  har_vencimento?: string;
  base?: {
    id: string;
    nome: string;
    codigo: string;
    cidade?: string;
    estado?: string;
  };
  contrato?: {
    id: string;
    nome: string;
    codigo: string;
  };
  vencimentos: {
    cnh: {
      status: string;
      dias_vencimento: number | null;
      data_vencimento?: string;
    };
    aso: {
      status: string;
      dias_vencimento: number | null;
      data_ultimo?: string;
      data_agendamento?: string;
      agendamento_status?: string;
      data_vencimento?: string;
    };
    har: {
      status: string;
      dias_vencimento: number | null;
      data_vencimento?: string;
    };
  };
}

// Novos tipos para relacionamentos com contratos e bases
export type UsuarioContrato = {
  id: string
  usuario_id: string
  contrato_id: string
  perfil_contrato: string
  data_inicio: string
  data_fim?: string
  ativo: boolean
  created_at: string
  created_by?: string
  contrato?: Contrato
}

export type UsuarioBase = {
  id: string
  usuario_id: string
  base_id: string
  tipo_acesso: 'total' | 'restrito' | 'leitura'
  data_inicio: string
  data_fim?: string
  ativo: boolean
  created_at: string
  created_by?: string
  base?: Base
}

import type { Vehicle } from './vehicle';
export type { Vehicle };

// Importar tipos de turno
import type { 
  Turno, 
  PrefixoEquipeMapping, 
  ApresentacaoTurno, 
  ApresentacaoTurnoCreate, 
  ApresentacaoTurnoUpdate, 
  ApresentacaoTurnoFilters,
  DashboardApresentacaoTurno,
  FuncionariosPorEquipe
} from './turno';

export type { 
  Turno, 
  PrefixoEquipeMapping, 
  ApresentacaoTurno, 
  ApresentacaoTurnoCreate, 
  ApresentacaoTurnoUpdate, 
  ApresentacaoTurnoFilters,
  DashboardApresentacaoTurno,
  FuncionariosPorEquipe
};

export interface VehicleDocument {
  id: string
  veiculo_id: string
  tipo_documento: string
  subtipo_documento?: string
  url_arquivo?: string
  expira_em?: string
  criado_em: string
  atualizado_em: string
  os_laudos?: LaudoAcusticoOS[]
  metadados?: {
    os_laudos?: LaudoAcusticoOS[]
  }
}

export interface LaudoAcusticoOS {
  id: string
  documento_id: string
  numero_os: string
  descricao?: string
  url_arquivo: string
  criado_em: string
  atualizado_em: string
}

export interface Team {
  id: string
  nome: string
  status: string
  criado_em: string
  atualizado_em: string
  operacao: string
}

export interface Report {
  id: string
  veiculo_id: string
  equipe_id: string
  tipo: 'acustico' | 'eletrico' | 'tacografo' | 'aet' | 'fumaca' | 'apolice' | 'contrato_seguro'
  descricao: string
  expira_em: string
  url_arquivo?: string
  criado_em: string
  atualizado_em: string
  veiculo: Vehicle
  equipe: Team
}

export interface Maintenance {
  id: string
  veiculo_id: string
  contrato_id?: string // Nova estrutura
  base_id?: string // Nova estrutura
  equipe_id?: string
  tipo: 'preventive' | 'corrective' | 'emergency'
  descricao: string
  status:
    | 'pending' | 'approved' | 'in_progress' | 'completed' | 'cancelled' | 'rejected'
    | 'pendente' | 'aprovada' | 'entregue' | 'em_orcamento' | 'em_manutencao' | 'pronto_retirada' | 'retornado' | 'em_andamento' | 'cancelada' | 'rejeitada'
  prioridade: 'low' | 'normal' | 'high' | 'urgent' | 'baixa' | 'alta' | 'urgente'
  tipo_servico: 'interno' | 'externo' // Novo campo para distinguir serviços internos dos externos
  custo_estimado?: number
  observacoes?: string
  oficina_id?: string
  start_date?: string
  end_date?: string
  location?: string
  started_at?: string
  completed_at?: string
  cancelado_em?: string
  motivo_cancelamento?: string
  rejeitado_em?: string
  motivo_rejeicao?: string
  rejeitador_id?: string
  estimated_completion?: string
  aprovado_em?: string
  entregue_em?: string
  orcado_em?: string
  em_manutencao_em?: string
  pronto_em?: string
  retornado_em?: string
  criado_em: string
  atualizado_em: string
  veiculo?: Vehicle
  equipe?: Team
  oficina?: Workshop
  historico?: unknown[]
  aprovador_id?: string
  solicitante_id?: string
  servicos?: unknown[]
  anexos?: MaintenanceAttachment[]
  // Novos campos para o processo de manutenção
  imagens?: MaintenanceImage[] // Imagens anexadas na criação
  numero_orcamento?: string // Número do orçamento/OS (não obrigatório)
  numero_cotacao?: string // Número da cotação (não obrigatório)
  numero_pedido?: string // Número do pedido (não obrigatório)
  numero_nf?: string // Número da NF (não obrigatório)
  nf_vencimento?: string // Data de vencimento da NF (não obrigatório)
  nf_arquivo?: string // URL do arquivo da NF (não obrigatório)
}

export interface MaintenanceImage {
  id: string
  maintenance_id: string
  url: string
  nome_arquivo: string
  tipo: string
  tamanho: number
  criado_em: string
}

export interface MaintenanceAttachment {
  id: string
  nome: string
  url: string
  tipo: string
  tamanho: number
  categoria: 'imagem' | 'nota_fiscal' | 'documento' | 'outros'
  descricao?: string
  criado_em: string
  criado_por: string
}

export interface Withdrawal {
  id: string
  veiculo_id: string
  equipe_id: string
  tipo: 'maintenance' | 'inspection' | 'other'
  descricao: string
  status: 'pending' | 'approved' | 'rejected' | 'completed'
  start_date: string
  end_date?: string
  criado_em: string
  atualizado_em: string
  veiculo: Vehicle
  equipe: Team
}

export interface Workshop {
  id: string
  nome: string
  endereco: string
  telefone: string
  email: string
  pessoa_contato: string
  especialidades: string[]
  criado_em: string
  atualizado_em: string
  cidade?: string
  estado?: string
  cnpj?: string
  ativo?: boolean
  contrato_id?: string
  base_id?: string
  contrato?: Contrato
  base?: Base
} 

// Almoxarifado types
export interface ItemEstoque {
  id: string
  codigo: string
  nome: string
  descricao?: string
  categoria: 'epi' | 'ferramental' | 'consumivel' | 'equipamento'
  subcategoria?: string
  unidade_medida: string
  estoque_minimo: number
  estoque_maximo?: number
  estoque_atual: number
  valor_unitario?: number
  fornecedor?: string
  localizacao?: string
  status: 'ativo' | 'inativo' | 'descontinuado'
  requer_certificacao?: boolean
  requer_laudo?: boolean
  requer_rastreabilidade?: boolean
  requer_ca?: boolean
  validade?: string
  observacoes?: string
  base_id: string
  base?: Base
  criado_em: string
  atualizado_em: string
}

export interface MovimentacaoEstoque {
  id: string
  item_id: string
  tipo: 'entrada' | 'saida' | 'transferencia' | 'ajuste' | 'devolucao'
  quantidade: number
  quantidade_anterior: number
  quantidade_atual: number
  motivo: string
  documento_referencia?: string
  solicitacao_id?: string // ID (UUID) da solicitação relacionada
  numero_solicitacao?: string // Número da solicitação relacionada (ex: NIT261125001)
  usuario_id: string
  solicitante_id?: string
  destinatario_id?: string // ✅ Quem recebe o item (terceiro ID importante)
  local_origem?: string
  local_destino?: string
  base_id: string
  base?: Base
  observacoes?: string
  criado_em: string
  item?: ItemEstoque
  usuario?: User
  solicitante?: User
  destinatario?: User // ✅ Quem recebeu o item
}

// Interface para itens de solicitação com tipos e motivos específicos
export interface SolicitacaoItemComTipoMotivo {
  id: string
  item_estoque_id: string
  nome: string
  codigo: string
  quantidade_solicitada: number
  tipo_troca: 'desconto' | 'troca' | 'fornecimento'
  motivo_solicitacao: string
  observacoes?: string
}

export interface SolicitacaoItem {
  id: string
  numero_solicitacao?: string // Número único da solicitação (ex: SOL-20240115-0001)
  item_id: string
  solicitante_id: string // Quem está fazendo a solicitação (supervisor/coordenador)
  destinatario_id?: string // Quem vai receber o item (operador/funcionário)
  base_id: string // Base de onde puxar o estoque
  quantidade_solicitada: number
  quantidade_aprovada?: number
  quantidade_entregue?: number
  prioridade: 'baixa' | 'normal' | 'alta' | 'urgente'
  status: 'pendente' | 'aprovada' | 'parcialmente_aprovada' | 'rejeitada' | 'entregue' | 'cancelada' | 'aguardando_estoque' | 'devolvida'
  motivo_solicitacao: string
  tipo_troca: 'desconto' | 'troca' | 'fornecimento'
  evidencia_url?: string
  evidencia_tipo?: 'foto' | 'arquivo'
  assinatura_digital?: string
  assinatura_nome?: string
  motivo_rejeicao?: string
  data_necessidade?: string
  aprovado_por?: string
  aprovado_em?: string
  entregue_por?: string
  entregue_em?: string
  observacoes?: string
  
  // Campos para dupla aprovação (Almoxarifado + SESMT)
  aprovado_almoxarifado_por?: string
  aprovado_almoxarifado_em?: string
  observacoes_almoxarifado?: string
  aprovado_sesmt_por?: string
  aprovado_sesmt_em?: string
  observacoes_sesmt?: string
  dupla_aprovacao_completa?: boolean
  
  // Campos para rejeição (separados dos campos de aprovação)
  rejeitado_almoxarifado_por?: string
  rejeitado_almoxarifado_em?: string
  rejeitado_sesmt_por?: string
  rejeitado_sesmt_em?: string
  
  // Novos campos para agrupamento e módulos pré-definidos
  grupo_entrega_id?: string
  tipo_solicitacao?: 'individual' | 'novo_funcionario'
  modulo_predefinido_id?: string
  item_modulo_id?: string
  
  // Campos para entrega para equipes
  destinatario_equipe_id?: string
  responsavel_equipe_id?: string
  
  // Campos para laudo (quando item requer laudo)
  numero_laudo?: string
  validade_laudo?: string
  data_vencimento?: string
  
  // Campos para rastreabilidade individual e CA (quando item exige)
  numeros_rastreabilidade?: string[]
  numero_ca?: string
  validade_ca?: string
  
  criado_em: string
  atualizado_em: string
  item?: ItemEstoque
  solicitante?: User // Quem fez a solicitação
  destinatario?: User // Quem vai receber o item
  destinatario_equipe?: { id: string; nome: string; operacao: string } // Equipe destinatária
  responsavel_equipe?: User // Responsável que pegou em nome da equipe
  base?: Base // Base de onde o item será retirado
  
  // Campos relacionados aos aprovadores da dupla aprovação
  aprovador_almoxarifado?: User // Quem aprovou no Almoxarifado
  aprovador_sesmt?: User // Quem aprovou no SESMT
  
  // Campos relacionados ao grupo de entrega
  grupo_entrega?: GrupoEntregaNovoFuncionario
  modulo_predefinido?: ModuloPredefinidoCargo

  // Campos para entrega via supervisor
  entregue_a_supervisor_id?: string
  supervisor_entrega?: { id: string; nome: string; matricula?: string }
}

// Tipo específico para a view de dupla aprovação com campos adicionais
export interface SolicitacaoItemDuplaAprovacao extends SolicitacaoItem {
  // Campos adicionais da view
  solicitante_nome?: string
  destinatario_nome?: string
  aprovador_almoxarifado_nome?: string
  aprovador_sesmt_nome?: string
  rejeitador_almoxarifado_nome?: string
  rejeitador_almoxarifado_email?: string
  rejeitador_sesmt_nome?: string
  rejeitador_sesmt_email?: string
  item_nome?: string
  item_codigo?: string
  base_nome?: string
  base_codigo?: string
  base_destino?: { nome?: string }
  contrato_nome?: string
}

// ============================================================================
// TIPOS PARA MÓDULOS PRÉ-DEFINIDOS POR CARGO
// ============================================================================

export interface ModuloPredefinidoCargo {
  id: string
  modulo_id?: string // Campo da view migrada (compatibilidade)
  contrato_id: string
  cargo_id: string
  nome_modulo: string
  descricao?: string
  ativo: boolean
  modulo_ativo?: boolean // Campo da view (compatibilidade)
  criado_por: string
  criado_em: string
  atualizado_em: string
  
  // Campos da view (compatibilidade)
  contrato_nome?: string
  cargo_nome?: string
  
  // Campos relacionados
  contrato?: {
    id: string
    nome: string
    codigo: string
  }
  cargo?: {
    id: string
    nome: string
    codigo: string
  }
  criado_por_info?: {
    nome: string
  }
  itens?: ModuloPredefinidoItem[]
  total_itens?: number
  itens_obrigatorios?: number
  itens_opcionais?: number
}

export interface ModuloPredefinidoItem {
  id: string
  modulo_id: string
  item_catalogo_id: string
  item_estoque_id?: string // For compatibility with existing code
  quantidade_padrao: number
  obrigatorio: boolean
  observacoes?: string
  ordem: number
  criado_em: string
  atualizado_em: string
  grupo_item_id?: string
  variacao_item_id?: string
  
  // Campos relacionados
  item_catalogo?: ItemCatalogo
  item_estoque?: { id: string; nome: string; codigo: string; categoria: string; estoque_atual: number; base_id: string; base?: Base } // Supabase relation
  grupo_item?: GrupoItem
  variacao_item?: VariacaoItem
  
  // Campos para interface (não persistidos)
  variacao_selecionada?: string
  quantidade_solicitada?: number
  nome?: string
  codigo?: string
}

export interface GrupoEntregaNovoFuncionario {
  id: string
  funcionario_id: string
  cargo_id: string
  modulo_predefinido_id?: string
  status: 'pendente' | 'aprovado' | 'entregue' | 'cancelado'
  observacoes?: string
  criado_por: string
  aprovado_por?: string
  entregue_por?: string
  criado_em: string
  aprovado_em?: string
  entregue_em?: string
  atualizado_em: string
  
  // Campos relacionados
  funcionario?: {
    id: string
    nome: string
    matricula?: string
  }
  cargo?: {
    id: string
    nome: string
    codigo: string
  }
  modulo_predefinido?: ModuloPredefinidoCargo
  criado_por_info?: {
    nome: string
  }
  aprovado_por_info?: {
    nome: string
  }
  entregue_por_info?: {
    nome: string
  }
  solicitacoes?: SolicitacaoItem[]
  total_solicitacoes?: number
  solicitacoes_pendentes?: number
  solicitacoes_aprovadas?: number
  solicitacoes_entregues?: number
}

// ============================================================================
// FORMULÁRIOS PARA MÓDULOS PRÉ-DEFINIDOS
// ============================================================================

export interface FormModuloPredefinidoCargo {
  contrato_id: string
  cargo_id: string
  nome_modulo: string
  descricao?: string
  ativo?: boolean
}

export interface FormModuloPredefinidoItem {
  modulo_id: string
  item_estoque_id?: string | null
  item_catalogo_id?: string | null
  quantidade_padrao: number
  obrigatorio: boolean
  observacoes?: string
  ordem?: number
  grupo_item_id?: string
  variacao_item_id?: string
}

export interface FormGrupoEntregaNovoFuncionario {
  funcionario_id: string
  cargo_id: string
  modulo_predefinido_id?: string
  observacoes?: string
}

// ============================================================================
// AGRUPAMENTO DE ITENS COM VARIAÇÕES
// ============================================================================

export interface GrupoItem {
  id: string
  nome_grupo: string
  descricao?: string
  categoria: 'epi' | 'ferramental' | 'consumivel' | 'equipamento'
  ativo: boolean
  criado_por: string
  criado_em: string
  atualizado_em: string
  criado_por_usuario?: {
    id: string
    nome: string
  }
  variacoes?: VariacaoItem[]
  total_variacoes?: number
  variacoes_ativas?: number
}

export interface VariacaoItem {
  id: string
  grupo_id: string
  item_catalogo_id: string
  item_estoque_id: string
  nome_variacao: string
  codigo_variacao?: string
  ordem: number
  ativo: boolean
  criado_em: string
  atualizado_em: string
  grupo_item?: GrupoItem
  item_catalogo?: ItemCatalogo
  item_estoque?: {
    codigo: string
    estoque_atual: number
  }
}

export interface GrupoItemCompleto extends GrupoItem {
  variacoes: VariacaoItem[]
}

export interface VariacaoItemCompleto extends VariacaoItem {
  grupo_item: GrupoItem
  item_catalogo: ItemCatalogo
}

export interface FormGrupoItem {
  nome_grupo: string
  descricao?: string
  categoria: 'epi' | 'ferramental' | 'consumivel' | 'equipamento'
  ativo?: boolean
}

export interface FormVariacaoItem {
  grupo_id: string
  item_catalogo_id: string
  nome_variacao: string
  codigo_variacao?: string
  ordem?: number
  ativo?: boolean
}

export interface FormModuloPredefinidoItemComGrupo extends FormModuloPredefinidoItem {
  grupo_item_id?: string
  variacao_item_id?: string
}

// ============================================================================
// FILTROS PARA CONSULTAS
// ============================================================================

export interface FiltrosModulosPredefinidos {
  contrato_id?: string
  cargo_id?: string
  ativo?: boolean
  nome_modulo?: string
}

export interface FiltrosGruposEntrega {
  funcionario_id?: string
  cargo_id?: string
  status?: string
  data_inicio?: string
  data_fim?: string
}

export interface HistoricoFuncionario {
  id: string
  funcionario_id: string
  item_id: string
  quantidade: number
  tipo_movimentacao: 'entrega' | 'devolucao' | 'troca' | 'substituicao'
  data_entrega: string
  data_devolucao?: string
  status: 'em_uso' | 'devolvido' | 'perdido' | 'danificado' | 'vencido' | 'reteste' | 'desgaste'
  condicao_entrega?: 'novo' | 'usado_bom' | 'usado_regular' | 'danificado'
  condicao_devolucao?: 'bom' | 'regular' | 'danificado' | 'perdido' | 'reteste' | 'desgaste'
  observacoes_entrega?: string
  observacoes_devolucao?: string
  responsavel_entrega: string
  responsavel_devolucao?: string
  solicitante_original_id?: string
  criado_em: string
  atualizado_em: string
  funcionario?: User
  item?: ItemEstoque
  solicitante_original?: User
}

export interface ItemInventarioFuncionario {
  id: string
  historico_id?: string
  item_id: string
  item: ItemEstoque
  quantidade: number
  condicao?: 'bom' | 'reteste' | 'descarte'
}

export interface NotaFiscal {
  id: string
  numero: string
  serie?: string
  numero_pedido?: string
  fornecedor: string
  cnpj_fornecedor?: string
  data_emissao: string
  data_recebimento: string
  valor_total: number
  status: 'pendente' | 'recebida' | 'conferida' | 'lancada' | 'cancelada'
  observacoes?: string
  arquivo_url?: string
  usuario_recebimento: string
  usuario_conferencia?: string
  base_id?: string
  contrato_id?: string
  criado_em: string
  atualizado_em: string
  itens?: ItemNotaFiscal[]
}

export interface ItemNotaFiscal {
  id: string
  nota_fiscal_id: string
  item_id?: string
  codigo_item?: string
  descricao: string
  quantidade: number
  valor_unitario: number
  valor_total: number
  unidade: string
  observacoes?: string
  item?: ItemEstoque
}

export interface Cotacao {
  id: string
  numero?: string
  item_nome: string
  descricao?: string
  quantidade: number
  unidade: string
  categoria: 'epi' | 'ferramental' | 'consumivel' | 'equipamento'
  prioridade: 'baixa' | 'media' | 'alta' | 'urgente'
  status: 'rascunho' | 'enviada' | 'respondida' | 'aprovada' | 'rejeitada' | 'cancelada' | 'pendente'
  data_solicitacao?: string
  data_resposta?: string
  data_validade?: string
  usuario_id: string
  solicitante_id?: string
  aprovador_id?: string
  fornecedor?: string
  valor_total?: number
  observacoes?: string
  created_at: string
  updated_at: string
  criado_em?: string
  atualizado_em?: string
  itens?: ItemCotacao[]
  solicitante?: User
  aprovador?: User
}

export interface ItemCotacao {
  id: string
  cotacao_id: string
  item_id?: string
  descricao: string
  quantidade: number
  unidade: string
  valor_unitario?: number
  valor_total?: number
  observacoes?: string
  item?: ItemEstoque
}

export interface RelatorioEstoque {
  item_id: string
  codigo: string
  nome: string
  categoria: string
  estoque_atual: number
  estoque_minimo: number
  estoque_maximo?: number
  valor_unitario?: number
  valor_total?: number
  status_estoque: 'normal' | 'baixo' | 'critico' | 'zerado'
  ultima_movimentacao?: string
  dias_sem_movimentacao?: number
  unidade_medida?: string
  base?: Base
  criado_em?: string
  observacoes?: string
}

export interface SolicitacaoCompra {
  id: string
  item_nome: string
  descricao?: string
  quantidade: number
  unidade: string
  categoria: 'epi' | 'ferramental' | 'consumivel' | 'equipamento'
  prioridade: 'baixa' | 'media' | 'alta' | 'urgente'
  justificativa: string
  fornecedor_sugerido?: string
  status: 'pendente' | 'aprovada' | 'rejeitada' | 'em_analise' | 'cancelada'
  usuario_id: string
  aprovador_id?: string
  observacoes?: string
  motivo_rejeicao?: string
  valor_estimado?: number
  data_necessidade?: string
  aprovado_em?: string
  created_at: string
  updated_at: string
  usuario?: User
  aprovador?: User
}

// Exportar tipos de EPI/EPC
export * from './epi'