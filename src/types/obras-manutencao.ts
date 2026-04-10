export interface ObraManutencao {
  id?: string;
  numeroProjeto: string;
  valorProjetado: number;
  setor: string;
  base: string;
  quantidadePoste: number;
  metrosCondutor: number;
  quantidadeTrafo: number;
  dataInicio: string;
  dataFim: string;
  status: StatusObra;
  regulatorio: boolean;
  projetoRevisado: boolean;
  enderecoObra: string;
  bairro: string;
  municipio: string;
  latitude?: string;
  longitude?: string;
  observacoes?: string;
  arquivos?: string[];
  createdAt?: string;
  updatedAt?: string;
  contratoId?: string;
}

export enum StatusObra {
  CADASTRADA = 'CADASTRADA',
  VIABILIDADE = 'VIABILIDADE',
  PROGRAMACAO = 'PROGRAMACAO',
  EXECUCAO = 'EXECUCAO',
  APROVACAO_MEDICAO = 'APROVACAO_MEDICAO',
  MEDICAO = 'MEDICAO',
  ENCERRAMENTO = 'ENCERRAMENTO',
  FATURAMENTO = 'FATURAMENTO',
  CANCELADA = 'CANCELADA',
  PAUSADA = 'PAUSADA'
}

export interface CreateObraManutencaoDTO {
  numeroProjeto: string;
  valorProjetado: number;
  setor: string;
  base: string;
  quantidadePoste: number;
  metrosCondutor: number;
  quantidadeTrafo: number;
  dataInicio: string;
  dataFim: string;
  status: StatusObra;
  regulatorio: boolean;
  projetoRevisado: boolean;
  enderecoObra: string;
  bairro: string;
  municipio: string;
  latitude?: string;
  longitude?: string;
  observacoes?: string;
  contratoId?: string;
}

export interface UpdateObraManutencaoDTO extends Partial<CreateObraManutencaoDTO> {
  id: string;
}

export const STATUS_COLORS: Record<string, string> = {
  [StatusObra.CADASTRADA]: 'bg-blue-100 text-blue-800',
  [StatusObra.VIABILIDADE]: 'bg-yellow-100 text-yellow-800',
  [StatusObra.PROGRAMACAO]: 'bg-orange-100 text-orange-800',
  [StatusObra.EXECUCAO]: 'bg-emerald-100 text-emerald-800',
  [StatusObra.APROVACAO_MEDICAO]: 'bg-purple-100 text-purple-800',
  [StatusObra.MEDICAO]: 'bg-indigo-100 text-indigo-800',
  [StatusObra.ENCERRAMENTO]: 'bg-slate-100 text-slate-800',
  [StatusObra.FATURAMENTO]: 'bg-teal-100 text-teal-800',
  [StatusObra.CANCELADA]: 'bg-red-100 text-red-800',
  [StatusObra.PAUSADA]: 'bg-amber-100 text-amber-800',
};

export const STATUS_LABELS: Record<string, string> = {
  [StatusObra.CADASTRADA]: 'Cadastro',
  [StatusObra.VIABILIDADE]: 'Viabilidade',
  [StatusObra.PROGRAMACAO]: 'Programação',
  [StatusObra.EXECUCAO]: 'Execução',
  [StatusObra.APROVACAO_MEDICAO]: 'Aprovação de Medição',
  [StatusObra.MEDICAO]: 'Medição',
  [StatusObra.ENCERRAMENTO]: 'Encerramento',
  [StatusObra.FATURAMENTO]: 'Faturamento',
  [StatusObra.CANCELADA]: 'Cancelada',
  [StatusObra.PAUSADA]: 'Pausada',
};

// Fluxo de status: define próximo status válido
export const STATUS_FLOW: Record<StatusObra, StatusObra | null> = {
  [StatusObra.CADASTRADA]: StatusObra.VIABILIDADE,
  [StatusObra.VIABILIDADE]: StatusObra.PROGRAMACAO,
  [StatusObra.PROGRAMACAO]: StatusObra.EXECUCAO,
  [StatusObra.EXECUCAO]: StatusObra.APROVACAO_MEDICAO,
  [StatusObra.APROVACAO_MEDICAO]: StatusObra.MEDICAO,
  [StatusObra.MEDICAO]: StatusObra.ENCERRAMENTO,
  [StatusObra.ENCERRAMENTO]: StatusObra.FATURAMENTO,
  [StatusObra.FATURAMENTO]: null,
  [StatusObra.CANCELADA]: null,
  [StatusObra.PAUSADA]: null,
};
