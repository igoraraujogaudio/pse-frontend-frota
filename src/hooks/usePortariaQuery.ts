import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

interface PortariaFilters {
  search?: string;
  periodo?: string;
  dataInicio?: string;
  dataFim?: string;
  tipo: 'veiculos' | 'chaves';
  contratoId?: string;
  baseId?: string;
  pageSize?: number;
}

interface PaginationInfo {
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
}

interface MovimentacaoPortaria {
  id: string;
  data_movimentacao: string;
  tipo: string;
  status?: string;
  chave?: { 
    codigo: string;
    veiculo?: {
      placa: string;
      base?: {
        nome: string;
        codigo: string;
      };
    };
  };
  veiculo?: { 
    placa: string; 
    marca_equipamento: string; 
    modelo: string; 
    tipo_veiculo: string;
  };
  carro_particular?: { 
    placa: string; 
    modelo?: string;
    funcionario?: {
      nome: string;
      matricula: string;
    };
  };
  tipo_veiculo?: string;
  veiculo_id?: string;
  carro_particular_id?: string;
  base?: { 
    nome: string;
    codigo: string;
  };
  colaborador?: { 
    nome: string; 
    matricula: string 
  };
  motorista?: { 
    nome: string; 
    matricula: string 
  };
  quilometragem?: number;
  observacoes?: string;
  [key: string]: unknown;
}

interface PortariaResponse {
  success: boolean;
  data: MovimentacaoPortaria[];
  pagination: PaginationInfo;
}

const fetchPortariaPage = async (
  filters: PortariaFilters,
  page: number
): Promise<PortariaResponse> => {
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  
  if (sessionError || !session) {
    throw new Error('Usuário não autenticado');
  }

  const params = new URLSearchParams();
  if (filters.search) params.append('search', filters.search);
  if (filters.periodo) params.append('periodo', filters.periodo);
  if (filters.dataInicio) params.append('dataInicio', filters.dataInicio);
  if (filters.dataFim) params.append('dataFim', filters.dataFim);
  if (filters.tipo) params.append('tipo', filters.tipo);
  if (filters.contratoId) params.append('contratoId', filters.contratoId);
  if (filters.baseId) params.append('baseId', filters.baseId);
  if (filters.pageSize) params.append('pageSize', String(filters.pageSize));
  params.append('page', String(page));

  const response = await fetch(`/api/portaria/consulta-v2?${params}`, {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`
    }
  });
  
  if (!response.ok) {
    throw new Error('Erro ao buscar movimentações');
  }
  
  return response.json();
};

export function usePortariaInfiniteQuery(filters: PortariaFilters) {
  return useInfiniteQuery({
    queryKey: ['portaria-infinite', filters],
    queryFn: ({ pageParam = 1 }) => fetchPortariaPage(filters, pageParam),
    getNextPageParam: (lastPage) => {
      if (lastPage.pagination.hasMore) {
        return lastPage.pagination.page + 1;
      }
      return undefined;
    },
    initialPageParam: 1,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 10,
    refetchOnWindowFocus: false,
  });
}

export function usePortariaQuery(filters: PortariaFilters, page: number = 1) {
  return useQuery({
    queryKey: ['portaria', filters, page],
    queryFn: () => fetchPortariaPage(filters, page),
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 10,
    refetchOnWindowFocus: false,
    placeholderData: (previousData) => previousData,
  });
}

export async function exportPortariaData(filters: Omit<PortariaFilters, 'pageSize'>) {
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  
  if (sessionError || !session) {
    throw new Error('Usuário não autenticado');
  }

  const params = new URLSearchParams();
  if (filters.search) params.append('search', filters.search);
  if (filters.periodo) params.append('periodo', filters.periodo);
  if (filters.dataInicio) params.append('dataInicio', filters.dataInicio);
  if (filters.dataFim) params.append('dataFim', filters.dataFim);
  if (filters.tipo) params.append('tipo', filters.tipo);
  if (filters.contratoId) params.append('contratoId', filters.contratoId);
  if (filters.baseId) params.append('baseId', filters.baseId);
  params.append('export', 'true');

  const response = await fetch(`/api/portaria/consulta?${params}`, {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`
    }
  });
  
  if (!response.ok) {
    throw new Error('Erro ao exportar dados');
  }
  
  return response.json();
}
