// Tipos para sistema de EPI/EPC com controle de não conformidades
import { User } from './index';

export interface ItemEPI {
  id: string;
  codigo: string;
  nome: string;
  descricao?: string;
  categoria: 'epi' | 'epc';
  subcategoria: string; // 'protecao_cabeca' | 'protecao_maos' | 'protecao_pes' | 'protecao_ocular' | 'protecao_auditiva' | 'protecao_respiratoria' | 'protecao_corpo' | 'sinalizacao' | 'isolamento' | 'extincao'
  unidade_medida: string;
  estoque_minimo: number;
  estoque_atual: number;
  valor_unitario?: number;
  fornecedor?: string;
  localizacao?: string;
  status: 'ativo' | 'inativo' | 'descontinuado';
  requer_certificacao: boolean;
  certificacao_obrigatoria?: string; // 'ca' | 'ce' | 'inmetro' | 'outro'
  validade?: string;
  observacoes?: string;
  criado_em: string;
  atualizado_em: string;
}

export interface ChecklistEPI {
  id: string;
  funcionario_id: string;
  data_checklist: string;
  turno: 'A' | 'B' | 'C';
  tipo: 'entrada' | 'saida' | 'verificacao_diaria';
  status: 'pendente' | 'aprovado' | 'rejeitado' | 'com_nc';
  aprovado_almoxarifado_por?: string;
  aprovado_em?: string;
  observacoes?: string;
  criado_em: string;
  atualizado_em: string;
  funcionario?: User;
  aprovador?: User;
  itens?: ChecklistItemEPI[];
}

export interface ChecklistItemEPI {
  id: string;
  checklist_id: string;
  item_epi_id: string;
  status: 'conforme' | 'nao_conforme' | 'nao_aplicavel';
  observacoes?: string;
  foto_evidencia?: string;
  criado_em: string;
  item_epi?: ItemEPI;
}

export interface NaoConformidadeEPI {
  id: string;
  checklist_item_id: string;
  funcionario_id: string;
  item_epi_id: string;
  tipo_nc: 'danificado' | 'vencido' | 'perdido' | 'inadequado' | 'outro';
  descricao_nc: string;
  prioridade: 'baixa' | 'normal' | 'alta' | 'urgente';
  status: 'pendente' | 'aprovada' | 'rejeitada' | 'resolvida';
  bloqueia_operacao: boolean; // Se true, funcionário não pode operar até resolver
  aprovado_almoxarifado_por?: string;
  aprovado_em?: string;
  resolvido_em?: string;
  observacoes?: string;
  criado_em: string;
  atualizado_em: string;
  funcionario?: User;
  aprovador?: User;
  item_epi?: ItemEPI;
  checklist_item?: ChecklistItemEPI;
}

export interface SolicitacaoTrocaEPI {
  id: string;
  nao_conformidade_id: string;
  funcionario_id: string;
  item_epi_id: string;
  quantidade_solicitada: number;
  prioridade: 'baixa' | 'normal' | 'alta' | 'urgente';
  status: 'pendente' | 'aprovada' | 'rejeitada' | 'entregue' | 'cancelada';
  motivo_solicitacao: string;
  tipo_troca: 'troca' | 'fornecimento' | 'devolucao';
  evidencia_url?: string;
  assinatura_digital?: string;
  assinatura_nome?: string;
  motivo_rejeicao?: string;
  data_necessidade?: string;
  aprovado_almoxarifado_por?: string;
  aprovado_em?: string;
  entregue_por?: string;
  entregue_em?: string;
  observacoes?: string;
  criado_em: string;
  atualizado_em: string;
  funcionario?: User;
  aprovador?: User;
  entregador?: User;
  item_epi?: ItemEPI;
  nao_conformidade?: NaoConformidadeEPI;
}

// Tipos para relatórios e dashboards
export interface RelatorioEPI {
  total_itens: number;
  itens_conformes: number;
  itens_nao_conformes: number;
  nc_pendentes: number;
  nc_aprovadas: number;
  nc_resolvidas: number;
  solicitacoes_pendentes: number;
  estoque_critico: number;
}

export interface EstatisticasEPI {
  total_funcionarios: number;
  funcionarios_com_checklist: number;
  funcionarios_com_nc: number;
  funcionarios_bloqueados: number;
  taxa_conformidade: number;
  itens_mais_nc: Array<{
    item_id: string;
    nome: string;
    quantidade_nc: number;
    percentual_nc: number;
  }>;
}

// Tipos para filtros e busca
export interface FiltrosChecklistEPI {
  data_inicio?: string;
  data_fim?: string;
  turno?: 'A' | 'B' | 'C';
  status?: 'pendente' | 'aprovado' | 'rejeitado' | 'com_nc';
  funcionario_id?: string;
  categoria?: 'epi' | 'epc';
  subcategoria?: string;
}

export interface FiltrosNaoConformidade {
  data_inicio?: string;
  data_fim?: string;
  status?: 'pendente' | 'aprovada' | 'rejeitada' | 'resolvida';
  prioridade?: 'baixa' | 'normal' | 'alta' | 'urgente';
  tipo_nc?: 'danificado' | 'vencido' | 'perdido' | 'inadequado' | 'outro';
  funcionario_id?: string;
  item_epi_id?: string;
  bloqueia_operacao?: boolean;
}
