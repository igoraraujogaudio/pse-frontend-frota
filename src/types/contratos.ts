// Types para sistema de contratos e bases

export interface Contrato {
  id: string;
  nome: string;
  descricao?: string;
  codigo: string;
  status: 'ativo' | 'inativo' | 'suspenso';
  responsavel_id?: string;
  valor_contrato?: number;
  data_inicio?: string;
  data_fim?: string;
  observacoes?: string;
  created_at: string;
  updated_at: string;
}

export interface Base {
  id: string;
  nome: string;
  codigo: string;
  endereco?: string;
  cidade?: string;
  estado?: string;
  cep?: string;
  telefone?: string;
  email?: string;
  responsavel?: string;
  ativa: boolean;
  habilitar_biometria_entrega?: boolean;
  aprovar_sesmt_obrigatorio?: boolean;
  contrato_id?: string;
  created_at: string;
  updated_at: string;
  contrato?: Contrato;
}

export interface UsuarioContrato {
  id: string;
  usuario_id: string;
  contrato_id: string;
  perfil_contrato: string;
  tipo_acesso: 'origem' | 'visualizacao';
  data_inicio: string;
  data_fim?: string;
  ativo: boolean;
  created_at: string;
  created_by?: string;
  contrato?: Contrato;
}

export interface UsuarioBase {
  id: string;
  usuario_id: string;
  base_id: string;
  tipo_acesso: 'total' | 'restrito' | 'leitura';
  data_inicio: string;
  data_fim?: string;
  ativo: boolean;
  created_at: string;
  created_by?: string;
  base?: Base;
}