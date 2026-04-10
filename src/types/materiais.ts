export interface Material {
  id?: string;
  numeroMaterial: string;
  descricaoMaterial: string;
  unidadeMedida: string;
  numeroMaterialAntigo?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ObraMaterial {
  id?: string;
  obraId: string;
  materialId: string;
  quantidade: number;
  valorUnitario?: number;
  valorTotal?: number;
  observacoes?: string;
  createdAt?: string;
  updatedAt?: string;
  // Dados do material (join)
  material?: Material;
}

export interface CreateMaterialDTO {
  numeroMaterial: string;
  descricaoMaterial: string;
  unidadeMedida: string;
  numeroMaterialAntigo?: string;
}

export interface CreateObraMaterialDTO {
  obraId: string;
  materialId: string;
  quantidade: number;
  valorUnitario?: number;
  observacoes?: string;
}

export interface BulkMaterialImport {
  numeroMaterial: string;
  descricaoMaterial: string;
  unidadeMedida: string;
  numeroMaterialAntigo?: string;
}
