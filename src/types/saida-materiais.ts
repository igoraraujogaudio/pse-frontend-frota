export interface SaidaMaterial {
  id: string;
  contratoId: string;
  equipeId: string;
  responsavelId: string;
  entreguePor: string;
  dataEntrega: string;
  status: 'entregue' | 'conferida_portaria' | 'bloqueada_portaria' | 'cancelada';
  observacoes?: string;
  conferidoPortariaPor?: string;
  conferidoPortariaEm?: string;
  observacoesPortaria?: string;
  veiculoPlaca?: string;
  baseOrigem?: string;
  createdAt: string;
  updatedAt: string;
  
  itens?: SaidaMaterialItem[];
  base?: {
    id: string;
    nome: string;
    codigo: string;
  };
  responsavel?: {
    id: string;
    nome: string;
    email: string;
  };
  equipe?: {
    id: string;
    nome: string;
  };
  entregador?: {
    id: string;
    nome: string;
    email: string;
  };
  conferidorPortaria?: {
    id: string;
    nome: string;
    email: string;
  };
}

export interface SaidaMaterialItem {
  id: string;
  saidaId: string;
  materialId: string;
  quantidade: number;
  unidadeMedida: string;
  observacoes?: string;
  patrimonio?: string;
  conferidoPortaria?: boolean | null;
  observacoesConferencia?: string;
  createdAt: string;
  updatedAt: string;
  
  material?: {
    id: string;
    numeroMaterial: string;
    descricaoMaterial: string;
    unidadeMedida: string;
    conferirPortaria?: boolean;
    requerPatrimonio?: boolean;
  };
}

export interface CreateSaidaMaterialDTO {
  contratoId: string;
  equipeId: string;
  responsavelId: string;
  entreguePor: string;
  observacoes?: string;
  veiculoPlaca?: string;
  baseOrigem?: string;
  itens: CreateSaidaMaterialItemDTO[];
}

export interface CreateSaidaMaterialItemDTO {
  materialId: string;
  quantidade: number;
  unidadeMedida: string;
  observacoes?: string;
  patrimonio?: string;
}

export interface AprovarSaidaMaterialDTO {
  aprovadoPor: string;
  observacoes?: string;
}

export interface EntregarSaidaMaterialDTO {
  entreguePor: string;
  dataEntrega?: string;
  observacoes?: string;
}
