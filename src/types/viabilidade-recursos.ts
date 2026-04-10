import { Material } from './materiais';
import { MaoDeObra } from './mao-de-obra';

export type DecisaoRecurso = 'manter_original' | 'usar_viabilidade' | 'pendente';

export interface ViabilidadeMaterial {
  id?: string;
  obraId: string;
  materialId: string;
  quantidade: number;
  valorUnitario?: number;
  valorTotal?: number;
  decisao: DecisaoRecurso;
  observacoes?: string;
  createdAt?: string;
  updatedAt?: string;
  material?: Material;
}

export interface ViabilidadeMaoDeObra {
  id?: string;
  obraId: string;
  maoDeObraId: string;
  quantidade: number;
  valorUnitario?: number;
  valorTotal?: number;
  decisao: DecisaoRecurso;
  observacoes?: string;
  createdAt?: string;
  updatedAt?: string;
  maoDeObra?: MaoDeObra;
}

export interface CreateViabilidadeMaterialDTO {
  obraId: string;
  materialId: string;
  quantidade: number;
  valorUnitario?: number;
  decisao?: DecisaoRecurso;
  observacoes?: string;
}

export interface CreateViabilidadeMaoDeObraDTO {
  obraId: string;
  maoDeObraId: string;
  quantidade: number;
  valorUnitario?: number;
  decisao?: DecisaoRecurso;
  observacoes?: string;
}

export interface ComparativoItemMaterial {
  materialId: string;
  material?: Material;
  quantidadeOriginal?: number;
  valorUnitarioOriginal?: number;
  valorTotalOriginal?: number;
  obraMaterialId?: string;
  quantidadeViabilidade?: number;
  valorUnitarioViabilidade?: number;
  valorTotalViabilidade?: number;
  viabilidadeId?: string;
  decisao: DecisaoRecurso;
  status: 'igual' | 'aumentou' | 'diminuiu' | 'novo' | 'removido';
}

export interface ComparativoItemMO {
  maoDeObraId: string;
  maoDeObra?: MaoDeObra;
  quantidadeOriginal?: number;
  valorUnitarioOriginal?: number;
  valorTotalOriginal?: number;
  obraMaoDeObraId?: string;
  quantidadeViabilidade?: number;
  valorUnitarioViabilidade?: number;
  valorTotalViabilidade?: number;
  viabilidadeId?: string;
  decisao: DecisaoRecurso;
  status: 'igual' | 'aumentou' | 'diminuiu' | 'novo' | 'removido';
}
