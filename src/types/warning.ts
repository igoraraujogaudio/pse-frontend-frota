export type WarningType = 'advertencia' | 'suspensao' | 'falta_grave';

export type WarningStatus = 'pendente' | 'assinado' | 'recusado';

export interface Warning {
  id: string;
  created_by: string;
  target_user_id: string;
  tipo_aviso: WarningType;
  descricao: string;
  motivo: string;
  data_ocorrencia: string;
  data_geracao: string;
  data_assinatura?: string;
  arquivo_assinado_url?: string;
  recusado: boolean;
  status: WarningStatus;
  
  // Dados do funcionário (preenchidos automaticamente)
  nome_colaborador?: string;
  cpf?: string;
  matricula?: string;
  cargo?: string;
  setor?: string;
  base_id?: string;
  estado_base?: string;
  endereco_base?: string;
  cnpj_base?: string;
  
  // Testemunhas (em caso de rejeição)
  testemunha1_nome?: string;
  testemunha1_cpf?: string;
  testemunha2_nome?: string;
  testemunha2_cpf?: string;
  
  // Campos específicos por tipo de aviso
  periodo_suspensao?: number; // Para suspensão (dias)
  data_inicio_suspensao?: string; // Para suspensão
  data_fim_suspensao?: string; // Para suspensão
  data_retorno_conclusoes?: string; // Para falta grave (afastamento sindicância)
  
  // Observações adicionais
  observacoes?: string;
  
  // Anexos/documentos comprobatórios
  documentos_urls?: string[];
  
  // Metadados
  created_at?: string;
  updated_at?: string;
}

export interface WarningFormData {
  tipo_aviso: WarningType;
  descricao: string;
  motivo: string;
  data_ocorrencia: string;
  periodo_suspensao?: number;
  data_inicio_suspensao?: string;
  observacoes?: string;
  documentos?: FileInfo[];
}

export interface FileInfo {
  name: string;
  url: string;
  type: string;
  size: number;
  uploadedAt: string;
}

export interface WarningFilters {
  tipo_aviso?: WarningType;
  status?: WarningStatus;
  user_id?: string;
  data_inicio?: string;
  data_fim?: string;
}

