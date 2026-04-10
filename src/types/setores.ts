// Sistema de Setores para Operações

export interface SetorPadrao {
  id: string;
  codigo: string;
  nome: string;
  descricao?: string;
  ativo: boolean;
  contratoId?: string;
  ordem: number;
  createdAt: string;
  updatedAt: string;
}

export interface OperacaoSetor {
  id: string;
  operacaoId: string;
  setorId: string;
  ativo: boolean;
  createdAt: string;
}

export interface SetorFormData {
  codigo: string;
  nome: string;
  descricao?: string;
  ativo: boolean;
  contratoId?: string;
  ordem: number;
}

export interface OperacaoComSetores {
  id: string;
  codigo: string;
  nome: string;
  descricao?: string;
  ativo: boolean;
  contratoId?: string;
  ordem: number;
  requerEncarregado: boolean;
  setores: SetorPadrao[];
  createdAt: string;
  updatedAt: string;
}

export interface SetorComOperacoes {
  id: string;
  codigo: string;
  nome: string;
  descricao?: string;
  ativo: boolean;
  contratoId?: string;
  ordem: number;
  operacoes: {
    id: string;
    codigo: string;
    nome: string;
  }[];
  createdAt: string;
  updatedAt: string;
}

export interface SetorFilter {
  ativo?: boolean;
  contratoId?: string;
  search?: string;
}

// Códigos padrão de setores
export enum SetorCodigo {
  OBRA = 'OBRA',
  MANUT = 'MANUT',
  EMERG = 'EMERG',
  PODA = 'PODA',
  LIMPEZA = 'LIMPEZA'
}

// Labels para os setores
export const SETOR_LABELS: Record<SetorCodigo, string> = {
  [SetorCodigo.OBRA]: 'Obra',
  [SetorCodigo.MANUT]: 'Manutenção',
  [SetorCodigo.EMERG]: 'Emergência',
  [SetorCodigo.PODA]: 'Poda',
  [SetorCodigo.LIMPEZA]: 'Limpeza'
};

// Descrições para os setores
export const SETOR_DESCRICOES: Record<SetorCodigo, string> = {
  [SetorCodigo.OBRA]: 'Setor responsável por obras e construções',
  [SetorCodigo.MANUT]: 'Setor responsável por manutenções preventivas e corretivas',
  [SetorCodigo.EMERG]: 'Setor responsável por atendimentos de emergência',
  [SetorCodigo.PODA]: 'Setor responsável por poda de árvores',
  [SetorCodigo.LIMPEZA]: 'Setor responsável por limpeza e conservação'
};


