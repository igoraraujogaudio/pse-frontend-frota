export interface DiscountOrder {
  id: string;
  created_by: string;
  target_user_id: string;
  valor_total: number;
  valor_parcela?: number;
  parcelas?: number;
  descricao: string;
  placa?: string;
  cpf?: string;
  documentos?: string[]; // array de comprovantes ou objeto
  data_geracao: string;
  data_assinatura?: string;
  arquivo_assinado_url?: string;
  recusado: boolean;
  testemunha1_nome?: string;
  testemunha1_cpf?: string;
  testemunha2_nome?: string;
  testemunha2_cpf?: string;
  status?: string;
  outros_documentos?: string;
  base_id?: string;
  data?: string;
  
  // NOVOS CAMPOS PARA ANEXOS (CORRIGIDOS)
  tipo_documento?: 'nf' | 'os' | 'ambos';
  numero_documento?: string;
  valor_documento?: number;
  data_documento?: string;
  observacoes_danos?: string;
  observacoes_documentos?: string;
  danos_evidencias_urls?: string[]; // Array de URLs para arquivos de danos no bucket
  nf_os_documentos_urls?: string[]; // Array de URLs para documentos NF/OS no bucket
  
  // Campo para auto de infração (multas)
  auto_infracao?: string;
  
  // Campo para identificar origem da ordem
  criado_por_setor?: 'almoxarifado' | 'frota' | 'outros'; // Setor que criou a ordem
} 