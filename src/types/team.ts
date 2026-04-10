export type Team = {
  id: string; // UUID do banco
  nome: string;
  contrato_id: string | null; // Nova estrutura - região de acesso
  base_id: string | null; // Nova estrutura - localização física
  responsavel_id: string | null; // ID do responsável pela equipe
  encarregado_id?: string | null; // ID do encarregado da equipe
  status: 'active' | 'parada';
  criado_em: string;
  atualizado_em: string;
  operacao: string;
  operacao_id?: string; // FK para operacoes_padrao
  setor?: string; // Setor da equipe (ex: Elétrica, Mecânica, Civil)
  motivoParada?: string;
  veiculo_id?: string;
  // Novos campos para sistema de prefixo fixo
  prefixo?: string; // Corrigido de prefixo_fixo para prefixo
  turno_ativo?: 'A' | 'B' | 'C';
  mapeamento_ativo?: boolean;
  // Campos para gestão de equipes
  capacidade_maxima?: number;
  tipo?: 'fixa' | 'aberta';
};

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
}

// Novo tipo para mapeamento de prefixos
export interface PrefixoEquipeMapping {
  id: string;
  prefixo_fixo: string;
  equipe_id: string;
  equipe_nome: string;
  operacao: string;
  turno: 'A' | 'B' | 'C';
  ativo: boolean;
  criado_em: string;
  atualizado_em: string;
} 