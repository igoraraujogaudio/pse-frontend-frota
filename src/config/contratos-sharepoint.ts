/**
 * Configuração de planilhas SharePoint por contrato
 * Cada contrato pode ter uma URL diferente e mapeamento de colunas específico
 */

/**
 * Mapeamento de status customizado por contrato
 */
export interface StatusMapping {
  // Mapeia valores da planilha para códigos do sistema
  // Exemplo: { "DESLIGAMENTO PROGRAMADO": "PROG", "CONCLUIDO": "EXEC" }
  [planilhaStatus: string]: 'PROG' | 'PANP' | 'EXEC' | 'CANC' | 'PARP';
}

export interface ContratoSharePointConfig {
  contratoNome: string;
  sharePointUrl: string;
  columnMapping: ColumnMapping;
  statusMapping?: StatusMapping; // Mapeamento customizado de status (opcional)
  headerRow?: number; // Linha onde começam os cabeçalhos (padrão: 1, baseado em 1)
  sheetName?: string; // Nome da aba da planilha a ser usada (padrão: primeira aba)
  // Configuração de equipes
  buscarEquipePorEncarregado?: boolean; // Se true, busca equipe pelo encarregado (padrão: true para Niterói)
  equipeMapping?: ColumnMappingValue; // Mapeamento da coluna de equipe na planilha (se buscarEquipePorEncarregado = false)
  equipesFixas?: string[]; // Lista de equipes fixas permitidas para este contrato (ex: ["MK 01", "LV 01", "CESTO 01"])
}

export interface ColumnMappingField {
  columns: string[]; // Nomes das colunas (pode ter múltiplas para concatenar)
  separator?: string; // Separador para concatenar (padrão: ' ')
  label?: string; // Label customizado para o frontend (ex: "Status da OS" ao invés de "status")
  concatenate?: boolean; // Se true, concatena todas as colunas; se false, usa a primeira que encontrar valor
}

/**
 * Tipo compatível: pode ser array simples (formato antigo) ou objeto ColumnMappingField (formato novo)
 */
export type ColumnMappingValue = string[] | ColumnMappingField;

/**
 * Normaliza um valor de mapeamento para o formato ColumnMappingField
 */
export function normalizeColumnMapping(value: ColumnMappingValue): ColumnMappingField {
  if (Array.isArray(value)) {
    // Formato antigo: array simples
    return {
      columns: value,
      separator: ' ',
      concatenate: false, // Por padrão, usa a primeira que encontrar
    };
  }
  // Formato novo: objeto ColumnMappingField
  return {
    columns: value.columns || [],
    separator: value.separator || ' ',
    concatenate: value.concatenate ?? false,
    label: value.label,
  };
}

/**
 * Retorna os nomes das colunas de um mapeamento (para compatibilidade)
 */
export function getColumnNames(mapping: ColumnMappingValue): string[] {
  if (Array.isArray(mapping)) {
    return mapping;
  }
  return mapping.columns || [];
}

export interface ColumnMapping {
  // Campos obrigatórios
  dataExecucao: ColumnMappingValue;
  numeroSOB: ColumnMappingValue;
  responsavelExecucao: ColumnMappingValue;
  valores: ColumnMappingValue;
  status: ColumnMappingValue;
  
  // Campos de localização
  logradouro: ColumnMappingValue;
  bairro: ColumnMappingValue;
  municipio: ColumnMappingValue;
  
  // Campos opcionais
  contrato?: ColumnMappingValue; // Opcional: contrato já é definido na configuração
  descricaoServico?: ColumnMappingValue;
  infoStatus?: ColumnMappingValue;
  tipoServico?: ColumnMappingValue;
  prioridade?: ColumnMappingValue;
  horInicObra?: ColumnMappingValue;
  horTermObra?: ColumnMappingValue;
  obs?: ColumnMappingValue;
  numeroEQ?: ColumnMappingValue;
  inicDeslig?: ColumnMappingValue;
  termDeslig?: ColumnMappingValue;
  tipoSGD?: ColumnMappingValue;
  numeroSGD?: ColumnMappingValue;
  anotacao?: ColumnMappingValue;
  apoio?: ColumnMappingValue;
  critico?: ColumnMappingValue;
  coordenada?: ColumnMappingValue;
  validade?: ColumnMappingValue;
}

/**
 * Configuração para contrato de Niterói
 */
export const CONTRATO_NITEROI: ContratoSharePointConfig = {
  contratoNome: 'Niterói',
  sharePointUrl: process.env.SHAREPOINT_EXCEL_URL_NITEROI || 
    process.env.SHAREPOINT_EXCEL_URL || 
    'https://psvsrv-my.sharepoint.com/:x:/g/personal/geraldo_junior_pse_srv_br/EQpz5vrm4AhAlRIfds04-L0BSG2C7Rbggnxj4EmvycK7tQ?rtime=4xEOfOAF3kg',
  columnMapping: {
    dataExecucao: ['Data Execução'],
    numeroSOB: ['Nº SOB', 'SOB'],
    responsavelExecucao: ['Responsável Execução'],
    valores: ['VALORES', 'V. PROGR'],
    status: ['STATUS'],
    logradouro: ['Logradouro'],
    bairro: ['Bairro'],
    municipio: ['Município'],
    descricaoServico: ['Descrição do serviço'],
    infoStatus: ['INFO STATUS'],
    tipoServico: ['Tipo de Serviço'],
    prioridade: ['PRIORIDADE'],
    horInicObra: ['Hor Inic Obra'],
    horTermObra: ['Hor Térm Obra'],
    obs: ['OBS'],
    numeroEQ: ['Nº EQ (RE, CO, CF, CC ou TR)'],
    inicDeslig: ['Inic deslig'],
    termDeslig: ['Térm deslig'],
    tipoSGD: ['Tipo de SGD'],
    numeroSGD: ['NUMERO SGD'],
    anotacao: ['Anotação'],
    apoio: ['Apoio'],
    critico: ['CRITICO'],
    coordenada: ['COORDENADA'],
    validade: ['VALIDADE'],
  },
};

/**
 * Configuração para contrato de Goiás
 * IMPORTANTE: Ajustar os nomes das colunas conforme a planilha real de Goiás
 */
export const CONTRATO_GOIAS: ContratoSharePointConfig = {
  contratoNome: 'Goiás',
  sharePointUrl: process.env.SHAREPOINT_EXCEL_URL_GOIAS || 'https://psvsrv-my.sharepoint.com/:x:/g/personal/geraldo_junior_pse_srv_br/IQCikJy7VZD0SJp7w8WfBYXOAeiLBXqnfHNx_NsQDZ-t7DM?e=90Xmci',
  statusMapping: {
    'DESLIGAMENTO PROGRAMADO': 'PROG',
    // Adicione outros mapeamentos de status específicos de Goiás aqui
  },
  columnMapping: {
    // TODO: Ajustar os nomes das colunas conforme a planilha real de Goiás
    dataExecucao: ['Data Execução', 'Data', 'DATA'],
    numeroSOB: ['Nº SOB', 'SOB', 'Número SOB', 'NUMERO SOB'],
    responsavelExecucao: ['Responsável Execução', 'Responsável', 'RESPONSAVEL'],
    valores: ['VALORES', 'Valor', 'VALOR', 'V. PROGR'],
    status: ['STATUS', 'Status', 'STATUS'],
    logradouro: ['Logradouro', 'Endereço', 'ENDERECO'],
    bairro: ['Bairro', 'BAIRRO'],
    municipio: ['Município', 'Municipio', 'MUNICIPIO', 'Cidade', 'CIDADE'],
    descricaoServico: ['Descrição do serviço', 'Descrição', 'DESCRICAO', 'Descrição do Serviço'],
    infoStatus: ['INFO STATUS', 'Info Status', 'INFO'],
    tipoServico: ['Tipo de Serviço', 'Tipo Serviço', 'TIPO SERVICO'],
    prioridade: ['PRIORIDADE', 'Prioridade'],
    horInicObra: ['Hor Inic Obra', 'Hora Início', 'HORA INICIO'],
    horTermObra: ['Hor Térm Obra', 'Hora Término', 'HORA TERMINO'],
    obs: ['OBS', 'Observação', 'OBSERVACAO', 'Observações'],
    numeroEQ: ['Nº EQ (RE, CO, CF, CC ou TR)', 'Número EQ', 'NUMERO EQ'],
    inicDeslig: ['Inic deslig', 'Início Desligamento', 'INICIO DESLIG'],
    termDeslig: ['Térm deslig', 'Término Desligamento', 'TERMINO DESLIG'],
    tipoSGD: ['Tipo de SGD', 'Tipo SGD', 'TIPO SGD'],
    numeroSGD: ['NUMERO SGD', 'Número SGD', 'NUMERO SGD'],
    anotacao: ['Anotação', 'Anotacao', 'ANOTACAO'],
    apoio: ['Apoio', 'APOIO'],
    critico: ['CRITICO', 'Crítico', 'CRITICO'],
    coordenada: ['COORDENADA', 'Coordenada', 'COORDENADAS'],
    validade: ['VALIDADE', 'Validade', 'VALIDADE'],
  },
};

/**
 * Mapa de configurações por nome do contrato
 */
export const CONTRATOS_CONFIG: Record<string, ContratoSharePointConfig> = {
  'Niterói': CONTRATO_NITEROI,
  'Goiás': CONTRATO_GOIAS,
};

/**
 * Busca configuração de um contrato pelo nome
 */
export function getContratoConfig(contratoNome: string): ContratoSharePointConfig | null {
  const nomeNormalizado = contratoNome.trim();
  return CONTRATOS_CONFIG[nomeNormalizado] || null;
}

/**
 * Retorna todos os contratos configurados
 */
export function getAllContratosConfig(): ContratoSharePointConfig[] {
  return Object.values(CONTRATOS_CONFIG);
}

