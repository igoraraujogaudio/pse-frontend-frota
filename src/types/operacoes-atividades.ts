// ============================================================================
// TIPOS PARA OPERAÇÕES E ATIVIDADES PADRÃO
// ============================================================================

import { SetorPadrao } from './setores';

export interface OperacaoPadrao {
  id: string;
  codigo: string;
  nome: string;
  descricao?: string;
  contratoId?: string;
  requerEncarregado?: boolean;
  ativo: boolean;
  ordem: number;
  setores?: SetorPadrao[]; // Setores disponíveis para esta operação
  createdAt: string;
  updatedAt: string;
}

export interface AtividadePadrao {
  id: string;
  codigo: string;
  nome: string;
  descricao?: string;
  operacaoId?: string;
  operacao?: OperacaoPadrao;
  contratoId?: string;
  ativo: boolean;
  ordem: number;
  createdAt: string;
  updatedAt: string;
}

export interface AtividadeComOperacao extends AtividadePadrao {
  operacaoNome: string;
}

// ============================================================================
// ENUMS PARA OPERAÇÕES E ATIVIDADES
// ============================================================================

export enum OperacaoCodigo {
  TEC_LM = 'TEC_LM',
  TEC_LV = 'TEC_LV',
  EMERG = 'EMERG',
  COMERCIAL = 'COMERCIAL',
  RH = 'RH',
  SEG_TRAB = 'SEG_TRAB',
  COD = 'COD',
  ALMOX = 'ALMOX',
  ASG = 'ASG',
  GERAL = 'GERAL',
  FROTA = 'FROTA',
  FATURAMENTO = 'FATURAMENTO',
  MONITORIA = 'MONITORIA'
}

export enum AtividadeCodigo {
  // Técnica LM
  OBRA = 'OBRA',
  MANUT = 'MANUT',
  PODA = 'PODA',
  INSTALACAO = 'INSTALACAO',
  REPARO = 'REPARO',
  
  // Técnica LV
  OBRA_LV = 'OBRA_LV',
  MANUT_LV = 'MANUT_LV',
  PODA_LV = 'PODA_LV',
  INSTALACAO_LV = 'INSTALACAO_LV',
  
  // Emergência
  EMERG_OBRA = 'EMERG_OBRA',
  EMERG_MANUT = 'EMERG_MANUT',
  EMERG_REPARO = 'EMERG_REPARO',
  EMERG_ATENDIMENTO = 'EMERG_ATENDIMENTO',
  
  // Comercial
  COMERCIAL_VENDAS = 'COMERCIAL_VENDAS',
  COMERCIAL_ATENDIMENTO = 'COMERCIAL_ATENDIMENTO',
  
  // RH
  RH_RECRUTAMENTO = 'RH_RECRUTAMENTO',
  RH_TREINAMENTO = 'RH_TREINAMENTO',
  
  // Segurança
  SEG_INSPECAO = 'SEG_INSPECAO',
  SEG_TREINAMENTO = 'SEG_TREINAMENTO',
  
  // Almoxarifado
  ALMOX_ENTREGA = 'ALMOX_ENTREGA',
  ALMOX_RECEBIMENTO = 'ALMOX_RECEBIMENTO',
  
  // Frota
  FROTA_MANUT = 'FROTA_MANUT',
  FROTA_ABASTECIMENTO = 'FROTA_ABASTECIMENTO'
}

// ============================================================================
// LABELS PARA EXIBIÇÃO
// ============================================================================

export const OPERACAO_LABELS: Record<OperacaoCodigo, string> = {
  [OperacaoCodigo.TEC_LM]: 'Técnica LM - Linha Morta',
  [OperacaoCodigo.TEC_LV]: 'Técnica LV - Linha Viva',
  [OperacaoCodigo.EMERG]: 'Emergência',
  [OperacaoCodigo.COMERCIAL]: 'Comercial',
  [OperacaoCodigo.RH]: 'Recursos Humanos',
  [OperacaoCodigo.SEG_TRAB]: 'Segurança do Trabalho',
  [OperacaoCodigo.COD]: 'COD',
  [OperacaoCodigo.ALMOX]: 'Almoxarifado',
  [OperacaoCodigo.ASG]: 'ASG',
  [OperacaoCodigo.GERAL]: 'Geral',
  [OperacaoCodigo.FROTA]: 'Frota',
  [OperacaoCodigo.FATURAMENTO]: 'Faturamento',
  [OperacaoCodigo.MONITORIA]: 'Monitoria'
};

export const ATIVIDADE_LABELS: Record<AtividadeCodigo, string> = {
  // Técnica LM
  [AtividadeCodigo.OBRA]: 'Obra',
  [AtividadeCodigo.MANUT]: 'Manutenção',
  [AtividadeCodigo.PODA]: 'Poda',
  [AtividadeCodigo.INSTALACAO]: 'Instalação',
  [AtividadeCodigo.REPARO]: 'Reparo',
  
  // Técnica LV
  [AtividadeCodigo.OBRA_LV]: 'Obra LV',
  [AtividadeCodigo.MANUT_LV]: 'Manutenção LV',
  [AtividadeCodigo.PODA_LV]: 'Poda LV',
  [AtividadeCodigo.INSTALACAO_LV]: 'Instalação LV',
  
  // Emergência
  [AtividadeCodigo.EMERG_OBRA]: 'Emergência Obra',
  [AtividadeCodigo.EMERG_MANUT]: 'Emergência Manutenção',
  [AtividadeCodigo.EMERG_REPARO]: 'Emergência Reparo',
  [AtividadeCodigo.EMERG_ATENDIMENTO]: 'Emergência Atendimento',
  
  // Comercial
  [AtividadeCodigo.COMERCIAL_VENDAS]: 'Comercial Vendas',
  [AtividadeCodigo.COMERCIAL_ATENDIMENTO]: 'Comercial Atendimento',
  
  // RH
  [AtividadeCodigo.RH_RECRUTAMENTO]: 'RH Recrutamento',
  [AtividadeCodigo.RH_TREINAMENTO]: 'RH Treinamento',
  
  // Segurança
  [AtividadeCodigo.SEG_INSPECAO]: 'Segurança Inspeção',
  [AtividadeCodigo.SEG_TREINAMENTO]: 'Segurança Treinamento',
  
  // Almoxarifado
  [AtividadeCodigo.ALMOX_ENTREGA]: 'Almoxarifado Entrega',
  [AtividadeCodigo.ALMOX_RECEBIMENTO]: 'Almoxarifado Recebimento',
  
  // Frota
  [AtividadeCodigo.FROTA_MANUT]: 'Frota Manutenção',
  [AtividadeCodigo.FROTA_ABASTECIMENTO]: 'Frota Abastecimento'
};

// ============================================================================
// MAPEAMENTO DE ATIVIDADES POR OPERAÇÃO
// ============================================================================

export const ATIVIDADES_POR_OPERACAO: Record<OperacaoCodigo, AtividadeCodigo[]> = {
  [OperacaoCodigo.TEC_LM]: [
    AtividadeCodigo.OBRA,
    AtividadeCodigo.MANUT,
    AtividadeCodigo.PODA,
    AtividadeCodigo.INSTALACAO,
    AtividadeCodigo.REPARO
  ],
  [OperacaoCodigo.TEC_LV]: [
    AtividadeCodigo.OBRA_LV,
    AtividadeCodigo.MANUT_LV,
    AtividadeCodigo.PODA_LV,
    AtividadeCodigo.INSTALACAO_LV
  ],
  [OperacaoCodigo.EMERG]: [
    AtividadeCodigo.EMERG_OBRA,
    AtividadeCodigo.EMERG_MANUT,
    AtividadeCodigo.EMERG_REPARO,
    AtividadeCodigo.EMERG_ATENDIMENTO
  ],
  [OperacaoCodigo.COMERCIAL]: [
    AtividadeCodigo.COMERCIAL_VENDAS,
    AtividadeCodigo.COMERCIAL_ATENDIMENTO
  ],
  [OperacaoCodigo.RH]: [
    AtividadeCodigo.RH_RECRUTAMENTO,
    AtividadeCodigo.RH_TREINAMENTO
  ],
  [OperacaoCodigo.SEG_TRAB]: [
    AtividadeCodigo.SEG_INSPECAO,
    AtividadeCodigo.SEG_TREINAMENTO
  ],
  [OperacaoCodigo.COD]: [],
  [OperacaoCodigo.ALMOX]: [
    AtividadeCodigo.ALMOX_ENTREGA,
    AtividadeCodigo.ALMOX_RECEBIMENTO
  ],
  [OperacaoCodigo.ASG]: [],
  [OperacaoCodigo.GERAL]: [],
  [OperacaoCodigo.FROTA]: [
    AtividadeCodigo.FROTA_MANUT,
    AtividadeCodigo.FROTA_ABASTECIMENTO
  ],
  [OperacaoCodigo.FATURAMENTO]: [],
  [OperacaoCodigo.MONITORIA]: []
};

// ============================================================================
// TIPOS PARA FORMULÁRIOS
// ============================================================================

export interface OperacaoFormData {
  codigo: string;
  nome: string;
  descricao?: string;
  contratoId?: string;
  ativo: boolean;
  ordem: number;
}

export interface AtividadeFormData {
  codigo: string;
  nome: string;
  descricao?: string;
  operacaoId: string;
  contratoId?: string;
  ativo: boolean;
  ordem: number;
}

// ============================================================================
// TIPOS PARA FILTROS E BUSCA
// ============================================================================

export interface OperacaoFilter {
  ativo?: boolean;
  contratoId?: string;
  search?: string;
}

export interface AtividadeFilter {
  ativo?: boolean;
  operacaoId?: string;
  contratoId?: string;
  search?: string;
}

