export interface ObraMaterialCorrigido {
  id?: string;
  obraId: string;
  materialId?: string;
  descricaoMaterial?: string;
  numeroMaterial?: string;
  unidadeMedida?: string;
  quantidade: number;
  valorUnitario?: number;
  valorTotal?: number;
  observacoes?: string;
  createdAt?: string;
}

export interface ObraMaoDeObraCorrigida {
  id?: string;
  obraId: string;
  maoDeObraId?: string;
  descricao?: string;
  codigo?: string;
  up?: string;
  quantidade: number;
  valorUnitario?: number;
  valorTotal?: number;
  observacoes?: string;
  createdAt?: string;
}
