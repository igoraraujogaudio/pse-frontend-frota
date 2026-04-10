import { useQuery } from '@tanstack/react-query';
import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';

interface ConsultaParams {
  search?: string;
  periodo?: string;
  dataInicio?: string;
  dataFim?: string;
  tipo?: string;
  contratoId?: string;
  baseId?: string;
}

interface MovimentacaoVeiculo {
  id: string;
  tipo: string;
  data_movimentacao: string;
  quilometragem: number;
  observacoes: string;
  tipo_veiculo: string;
  veiculo_id?: string;
  carro_particular_id?: string;
  colaborador_id?: string;
  base?: {
    id: string;
    nome: string;
    codigo: string;
  };
  veiculo?: {
    id: string;
    placa: string;
    modelo: string;
    marca_equipamento: string;
    tipo_veiculo: string;
    base?: {
      id: string;
      nome: string;
      codigo: string;
    };
  };
  carro_particular?: {
    id: string;
    placa: string;
    funcionario_id: string;
    funcionario?: {
      nome: string;
      matricula: string;
    };
  };
  colaborador?: {
    id: string;
    nome: string;
    matricula: string;
  };
}

interface MovimentacaoChave {
  id: string;
  tipo: string;
  data_movimentacao: string;
  observacoes: string;
  status: string;
  colaborador_id?: string;
  chave_id?: string;
  colaborador?: {
    id: string;
    nome: string;
    matricula: string;
  };
  chave?: {
    id: string;
    codigo: string;
    veiculo_id?: string;
    veiculo?: {
      id: string;
      placa: string;
      modelo: string;
      marca: string;
      base?: {
        id: string;
        nome: string;
        codigo: string;
      };
    };
  };
}

interface ConsultaData {
  veiculos: MovimentacaoVeiculo[];
  chaves: MovimentacaoChave[];
}

interface ConsultaResponse {
  success: boolean;
  data: ConsultaData;
  filtros: {
    search: string;
    periodo: string;
    dataInicio: string;
    dataFim: string;
    tipo: string;
  };
}

const fetchMovimentacoes = async (params: ConsultaParams): Promise<ConsultaResponse> => {
  const searchParams = new URLSearchParams();
  
  if (params.search) searchParams.append('search', params.search);
  if (params.periodo) searchParams.append('periodo', params.periodo);
  if (params.dataInicio) searchParams.append('dataInicio', params.dataInicio);
  if (params.dataFim) searchParams.append('dataFim', params.dataFim);
  if (params.tipo) searchParams.append('tipo', params.tipo);
  if (params.contratoId) searchParams.append('contratoId', params.contratoId);
  if (params.baseId) searchParams.append('baseId', params.baseId);

  // Obter token de autenticação
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  
  if (sessionError) {
    throw new Error('Erro ao obter sessão');
  }
  
  if (!session) {
    throw new Error('Usuário não autenticado');
  }

  const response = await fetch(`/api/portaria/consulta?${searchParams}`, {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`
    }
  });
  
  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Usuário não autorizado');
    }
    throw new Error('Erro ao buscar movimentações');
  }
  
  return response.json();
};

export function useConsultaPortaria(params: ConsultaParams) {
  return useQuery({
    queryKey: ['consulta-portaria', params],
    queryFn: () => fetchMovimentacoes(params),
    staleTime: 1000 * 60 * 5, // 5 minutos (aumentado de 2)
    gcTime: 1000 * 60 * 10, // 10 minutos (cache mais agressivo)
    refetchOnWindowFocus: false,
    retry: 1,
    // Não refazer query se os parâmetros não mudaram significativamente
    enabled: true,
  });
}

export function useConsultaPortariaState() {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [periodo, setPeriodo] = useState('todos');
  const [tipo, setTipo] = useState('todos');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [contratoId, setContratoId] = useState('todos');
  const [baseId, setBaseId] = useState('todas');

  // Debounce para busca (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);

    return () => clearTimeout(timer);
  }, [search]);

  const params: ConsultaParams = useMemo(() => ({
    search: debouncedSearch,
    periodo,
    tipo,
    dataInicio,
    dataFim,
    contratoId: contratoId === 'todos' ? undefined : contratoId,
    baseId: baseId === 'todas' ? undefined : baseId,
  }), [debouncedSearch, periodo, tipo, dataInicio, dataFim, contratoId, baseId]);

  const query = useConsultaPortaria(params);

  const clearFilters = () => {
    setSearch('');
    setDebouncedSearch('');
    setPeriodo('todos');
    setTipo('todos');
    setDataInicio('');
    setDataFim('');
    setContratoId('todos');
    setBaseId('todas');
  };

  // Garantir que data sempre tenha estrutura válida
  const data = query.data?.data || { veiculos: [], chaves: [] };

  return {
    // Estado
    search,
    setSearch,
    periodo,
    setPeriodo,
    tipo,
    setTipo,
    dataInicio,
    setDataInicio,
    dataFim,
    setDataFim,
    contratoId,
    setContratoId,
    baseId,
    setBaseId,
    
    // Query
    ...query,
    data, // Sobrescrever com dados seguros
    
    // Helpers
    clearFilters,
    params,
  };
}
