// Tipos para o sistema de apresentação por turno

export type Turno = 'A' | 'B' | 'C';

export interface PrefixoEquipeMapping {
  id: string;
  prefixo_fixo: string;
  equipe_id: string;
  operacao: string;
  turno: Turno;
  ativo: boolean;
  criado_em: string;
  atualizado_em: string;
  equipe?: {
    id: string;
    nome: string;
    operacao: string;
  };
}

export interface ApresentacaoTurno {
  id: string;
  usuario_id: string;
  turno: Turno;
  operacao: string;
  data_apresentacao: string;
  prefixo_veiculo: string;
  equipe_atual: string | null;
  status: 'ativo' | 'finalizado' | 'transferido';
  observacoes?: string;
  supervisor_id?: string;
  aprovado_em?: string;
  criado_em: string;
  atualizado_em: string;
  usuario?: {
    id: string;
    nome: string;
    matricula: string;
    cargo: string;
  };
  equipe?: {
    id: string;
    nome: string;
    operacao: string;
  };
}

export interface ApresentacaoTurnoCreate {
  turno: Turno;
  prefixo_veiculo: string;
  observacoes?: string;
}

export interface ApresentacaoTurnoUpdate {
  status?: 'ativo' | 'finalizado' | 'transferido';
  observacoes?: string;
  supervisor_id?: string;
  aprovado_em?: string;
}

export interface ApresentacaoTurnoFilters {
  turno?: Turno;
  operacao?: string;
  status?: string;
  data_apresentacao?: string;
  prefixo_veiculo?: string;
}

export interface DashboardApresentacaoTurno {
  turno: Turno;
  operacao: string;
  prefixo_veiculo: string;
  equipe_nome: string;
  funcionarios_ativos: number;
  funcionarios_unicos: number;
  primeira_apresentacao: string;
  ultima_apresentacao: string;
}

export interface FuncionariosPorEquipe {
  equipe_id: string;
  equipe_nome: string;
  operacao: string;
  turno: Turno;
  prefixo_fixo: string;
  total_funcionarios: number;
  nomes_funcionarios: string[];
}
