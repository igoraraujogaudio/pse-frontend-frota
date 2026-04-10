export interface MaoDeObra {
  id?: string;
  up: string;
  descricaoUp: string;
  codigoNovo: string;
  descricao: string;
  descricaoCompleta: string;
  valorUnitario?: number;
  contratoId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ObraMaoDeObra {
  id?: string;
  obraId: string;
  maoDeObraId: string;
  quantidade: number;
  valorUnitario?: number;
  valorTotal?: number;
  createdAt?: string;
  updatedAt?: string;
  // Dados da mão de obra (join)
  maoDeObra?: MaoDeObra;
}

export interface CreateMaoDeObraDTO {
  up: string;
  descricaoUp: string;
  codigoNovo: string;
  descricao: string;
  descricaoCompleta: string;
  valorUnitario?: number;
  contratoId?: string;
}

export interface CreateObraMaoDeObraDTO {
  obraId: string;
  maoDeObraId: string;
  quantidade: number;
  valorUnitario?: number;
}

export interface BulkMaoDeObraImport {
  up: string;
  descricaoUp: string;
  codigoNovo: string;
  descricao: string;
  descricaoCompleta: string;
  valorUnitario?: number;
  contratoId?: string;
}
