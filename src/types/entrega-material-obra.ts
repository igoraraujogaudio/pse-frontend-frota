export interface EntregaMaterialObra {
  id?: string;
  obraId: string;
  programacaoId?: string | null;
  equipeId?: string | null;
  baseId?: string | null;
  materialId?: string | null;
  descricao: string;
  numeroMaterial?: string;
  unidade: string;
  quantidade: number;
  saidaId?: string | null;
  dataEntrega: string;
  entreguePor?: string | null;
  aceiteEncarregado: boolean;
  aceiteEncarregadoEm?: string | null;
  aceiteEncarregadoPor?: string | null;
  status: 'pendente' | 'entregue' | 'aceito' | 'recusado' | 'cancelado';
  observacoes?: string;
  createdAt?: string;
  // joins
  equipe?: { id: string; nome: string };
  obra?: { id: string; numeroProjeto: string; enderecoObra?: string; municipio?: string };
  base?: { id: string; nome: string; codigo: string };
  entregador?: { id: string; nome: string };
  programacao?: { id: string; etapa?: string; data: string };
}

export interface DevolucaoMaterialObra {
  id?: string;
  obraId: string;
  programacaoId?: string | null;
  equipeId: string;
  baseId: string;
  etapa?: string;
  dataDevolucao: string;
  devolvidoPara?: string | null;
  aceiteEncarregado: boolean;
  aceiteEncarregadoEm?: string | null;
  aceiteEncarregadoPor?: string | null;
  status: 'pendente' | 'aceito' | 'recusado' | 'cancelado';
  observacoes?: string;
  createdAt?: string;
  updatedAt?: string;
  // joins
  equipe?: { id: string; nome: string };
  obra?: { id: string; numeroProjeto: string; enderecoObra?: string; municipio?: string };
  base?: { id: string; nome: string; codigo: string };
  recebedor?: { id: string; nome: string };
  itens?: DevolucaoMaterialObraItem[];
}

export interface DevolucaoMaterialObraItem {
  id?: string;
  devolucaoId: string;
  materialId?: string | null;
  descricao: string;
  numeroMaterial?: string;
  unidade: string;
  quantidade: number;
  condicao: 'bom' | 'danificado' | 'sucata';
  observacoes?: string;
  createdAt?: string;
}

export interface EstoqueMaterialBase {
  id?: string;
  baseId: string;
  materialId: string;
  quantidade: number;
  quantidadeMinima: number;
  createdAt?: string;
  updatedAt?: string;
  // joins
  base?: { id: string; nome: string; codigo: string };
  material?: { id: string; numeroMaterial: string; descricaoMaterial: string; unidadeMedida: string };
}

export interface ProgramacaoComFluxo {
  id: string;
  obraId: string;
  equipeId: string;
  data: string;
  etapa?: string;
  fluxoDefinido: boolean;
  statusExecucao?: string;
  obra?: { id: string; numeroProjeto: string; enderecoObra?: string; municipio?: string; setor?: string };
  equipe?: { id: string; nome: string };
  materiaisFluxo?: Array<{
    id: string;
    descricao: string;
    numeroMaterial?: string;
    unidade: string;
    quantidade: number;
    materialId?: string | null;
  }>;
  entregasRealizadas?: number;
}
