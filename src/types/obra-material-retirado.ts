import { Material } from './materiais';

export type DestinoMaterialRetirado = 'sucata' | 'reaproveitavel' | 'descarte';

export const DESTINO_LABELS: Record<DestinoMaterialRetirado, string> = {
  sucata: 'Sucata',
  reaproveitavel: 'Reaproveitável',
  descarte: 'Descarte',
};

export const DESTINO_COLORS: Record<DestinoMaterialRetirado, string> = {
  sucata: 'bg-red-100 text-red-700',
  reaproveitavel: 'bg-green-100 text-green-700',
  descarte: 'bg-gray-100 text-gray-600',
};

export interface ObraMaterialRetirado {
  id?: string;
  obraId: string;
  materialId?: string;
  descricaoMaterial?: string;
  numeroMaterial?: string;
  unidadeMedida?: string;
  quantidade: number;
  destino: DestinoMaterialRetirado;
  observacoes?: string;
  registradoPor?: string;
  createdAt?: string;
  updatedAt?: string;
  material?: Material;
}

export interface CreateObraMaterialRetiradoDTO {
  obraId: string;
  materialId?: string;
  descricaoMaterial?: string;
  numeroMaterial?: string;
  unidadeMedida?: string;
  quantidade: number;
  destino: DestinoMaterialRetirado;
  observacoes?: string;
}
