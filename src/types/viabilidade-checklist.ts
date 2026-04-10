export interface ViabilidadeChecklist {
  id?: string;
  obraId: string;

  // Dados do projeto
  projeto: string;
  data: string;
  cidade: string;

  // Quantitativo
  quantidadePostes: number;

  // Tensão da rede
  tensaoRede: '13.8' | '34.5';

  // Necessário LV (Linha Viva)
  necessarioLV: boolean;

  // Sinal de telefone no local
  sinalTelefone: boolean;

  // Desligamento necessário
  desligamentoNecessario: boolean;
  numeroChaveEquipamento?: string;

  // Viabilidade
  viabilidade: 'APTO' | 'NAO_APTO';

  // Condição do traçado
  condicaoTracado: 'CONFORME' | 'ALTERACAO_NECESSARIA';

  // Autorização de passagem
  autorizacaoPassagem: 'SIM' | 'NAO' | 'EM_ANDAMENTO';

  // Poda de árvores
  podaArvores: boolean;

  // Interferências
  interferenciasIdentificadas: boolean;
  interferenciasDescricao?: string;

  // Resumo técnico
  resumoTecnico?: string;

  // Alerta de segurança
  alertaSeguranca: boolean;
  alertaSegurancaObs?: string;

  // Fotos (URLs dos arquivos)
  fotosPostes?: string[];
  fotosAlertaSeguranca?: string[];

  // Metadata
  criadoPor?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateViabilidadeChecklistDTO {
  obraId: string;
  projeto: string;
  data: string;
  cidade: string;
  quantidadePostes: number;
  tensaoRede: '13.8' | '34.5';
  necessarioLV: boolean;
  sinalTelefone: boolean;
  desligamentoNecessario: boolean;
  numeroChaveEquipamento?: string;
  viabilidade: 'APTO' | 'NAO_APTO';
  condicaoTracado: 'CONFORME' | 'ALTERACAO_NECESSARIA';
  autorizacaoPassagem: 'SIM' | 'NAO' | 'EM_ANDAMENTO';
  podaArvores: boolean;
  interferenciasIdentificadas: boolean;
  interferenciasDescricao?: string;
  resumoTecnico?: string;
  alertaSeguranca: boolean;
  alertaSegurancaObs?: string;
  fotosPostes?: string[];
  fotosAlertaSeguranca?: string[];
  criadoPor?: string;
}
