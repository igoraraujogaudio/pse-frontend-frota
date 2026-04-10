'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Search, Car, Key, ArrowUpCircle, ArrowDownCircle, Filter, X, ChevronLeft, ChevronRight, FileSpreadsheet } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { PERMISSION_CODES } from '@/hooks/useModularPermissions';
import ProtectedRoute from '@/components/ProtectedRoute';
import * as XLSX from 'xlsx';

interface Movimentacao {
  id: string;
  tipo: string;
  data_movimentacao: string;
  quilometragem?: number;
  observacoes?: string;
  status?: string;
  veiculo?: {
    placa: string;
    modelo: string;
    marca_equipamento: string;
  };
  carro_particular?: {
    placa: string;
    funcionario?: {
      nome: string;
      matricula: string;
    };
  };
  chave?: {
    codigo: string;
    veiculo?: {
      placa: string;
      modelo: string;
      marca_equipamento: string;
      base?: {
        nome: string;
        codigo: string;
      };
    };
  };
  colaborador?: {
    nome: string;
    matricula: string;
  };
  base?: {
    nome: string;
    codigo: string;
  };
}

interface Stats {
  total: number;
  entradas: number;
  saidas: number;
  retiradas: number;
  devolucoes: number;
}

interface Filters {
  search: string;
  dataInicio: string;
  dataFim: string;
  baseId: string;
  contratoId: string;
}

export function ConsultaPortariaContent() {
  const [activeTab, setActiveTab] = useState<'veiculos' | 'chaves'>('veiculos');
  const [data, setData] = useState<Movimentacao[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, entradas: 0, saidas: 0, retiradas: 0, devolucoes: 0 });
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [totalRecords, setTotalRecords] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  
  const [filters, setFilters] = useState<Filters>({
    search: '',
    dataInicio: '',
    dataFim: '',
    baseId: 'todas',
    contratoId: 'todos'
  });

  const [bases, setBases] = useState<Array<{ id: string; nome: string; codigo: string }>>([]);
  const [contratos, setContratos] = useState<Array<{ id: string; nome: string }>>([]);

  const loadFiltersData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data: userData } = await supabase
        .from('usuarios')
        .select('id')
        .eq('auth_usuario_id', session.user.id)
        .single();

      if (!userData) return;

      const { data: userContracts } = await supabase
        .from('usuario_contratos')
        .select('contrato_id, contratos(id, nome)')
        .eq('usuario_id', userData.id)
        .eq('ativo', true);

      if (userContracts) {
        const contractsList = userContracts
          .map(uc => uc.contratos)
          .filter(Boolean)
          .map(c => Array.isArray(c) ? c[0] : c);
        setContratos(contractsList);

        const contractIds = userContracts.map(uc => uc.contrato_id);
        
        const { data: basesData } = await supabase
          .from('bases')
          .select('id, nome, codigo')
          .in('contrato_id', contractIds)
          .eq('ativa', true)
          .order('nome');

        if (basesData) {
          setBases(basesData);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar filtros:', error);
    }
  };

  const loadData = useCallback(async (pageNum: number) => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        console.log('❌ Sem sessão');
        setLoading(false);
        return;
      }

      const params = new URLSearchParams({
        tipo: activeTab,
        page: String(pageNum),
        pageSize: '50',
        userId: session.user.id,
        ...(filters.search && { search: filters.search }),
        ...(filters.dataInicio && { dataInicio: filters.dataInicio }),
        ...(filters.dataFim && { dataFim: filters.dataFim }),
        ...(filters.baseId !== 'todas' && { baseId: filters.baseId }),
        ...(filters.contratoId !== 'todos' && { contratoId: filters.contratoId })
      });

      console.log('🔍 Buscando dados:', `/api/portaria/consulta-otimizada?${params}`);

      const response = await fetch(`/api/portaria/consulta-otimizada?${params}`);

      console.log('📡 Response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json();
        console.error('❌ Erro na resposta:', errorData);
        throw new Error('Erro ao buscar dados');
      }

      const result = await response.json();
      console.log('✅ Resultado:', result);
      
      if (result.success) {
        setData(result.data);
        setStats(result.stats);
        setTotalRecords(result.pagination.total);
        setTotalPages(Math.ceil(result.pagination.total / result.pagination.pageSize));
        console.log('📊 Stats:', result.stats);
        console.log('📝 Dados carregados:', result.data.length);
        console.log('📄 Página:', result.pagination.page, 'de', Math.ceil(result.pagination.total / result.pagination.pageSize));
      } else {
        console.error('❌ Success false:', result);
      }
    } catch (error) {
      console.error('❌ Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  }, [activeTab, filters]);

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      console.log('🔐 Sessão verificada:', session ? 'OK' : 'NULA');
      if (session) {
        setSessionReady(true);
        loadFiltersData();
      }
    };
    checkSession();
  }, []);

  useEffect(() => {
    if (sessionReady) {
      setPage(1);
      loadData(1);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, filters, sessionReady]);

  const handleNextPage = () => {
    if (page < totalPages) {
      const nextPage = page + 1;
      setPage(nextPage);
      loadData(nextPage);
    }
  };

  const handlePreviousPage = () => {
    if (page > 1) {
      const prevPage = page - 1;
      setPage(prevPage);
      loadData(prevPage);
    }
  };

  const handleGoToPage = (pageNum: number) => {
    if (pageNum >= 1 && pageNum <= totalPages) {
      setPage(pageNum);
      loadData(pageNum);
    }
  };

  const handleSearchChange = (value: string) => {
    setFilters(prev => ({ ...prev, search: value }));
  };

  const clearFilters = () => {
    setFilters({
      search: '',
      dataInicio: '',
      dataFim: '',
      baseId: 'todas',
      contratoId: 'todos'
    });
  };

  const exportToExcel = async () => {
    if (totalRecords === 0) return;

    try {
      setLoading(true);
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        alert('Sessão expirada. Faça login novamente.');
        setLoading(false);
        return;
      }
      
      const params = new URLSearchParams({
        tipo: activeTab,
        page: '1',
        pageSize: totalRecords.toString(),
        userId: session.user.id,
        ...(filters.search && { search: filters.search }),
        ...(filters.dataInicio && { dataInicio: filters.dataInicio }),
        ...(filters.dataFim && { dataFim: filters.dataFim }),
        ...(filters.baseId !== 'todas' && { baseId: filters.baseId }),
        ...(filters.contratoId !== 'todos' && { contratoId: filters.contratoId })
      });

      console.log('📥 Buscando todos os dados para export...');
      const response = await fetch(`/api/portaria/consulta-otimizada?${params}`);
      
      if (!response.ok) {
        throw new Error('Erro ao buscar dados para exportação');
      }

      const result = await response.json();
      const allData = result.data || [];

      console.log('✅ Dados para export:', allData.length, 'registros');

      const headers = activeTab === 'veiculos' 
        ? ['Data', 'Tipo', 'Placa', 'Modelo', 'Colaborador', 'Matrícula', 'Base', 'KM', 'Observações']
        : ['Data', 'Tipo', 'Código Chave', 'Placa Veículo', 'Modelo', 'Colaborador', 'Matrícula', 'Base', 'Status', 'Observações'];

      const rows = allData.map((mov: Movimentacao) => {
        const dataFormatada = new Date(mov.data_movimentacao).toLocaleString('pt-BR');
        
        if (activeTab === 'veiculos') {
          const placa = mov.veiculo?.placa || mov.carro_particular?.placa || '-';
          const modelo = mov.veiculo?.modelo || '-';
          const colaborador = mov.colaborador?.nome || mov.carro_particular?.funcionario?.nome || '-';
          const matricula = mov.colaborador?.matricula || mov.carro_particular?.funcionario?.matricula || '-';
          const base = mov.base?.nome || '-';
          const km = mov.quilometragem || '-';
          const obs = mov.observacoes || '-';
          
          return [dataFormatada, mov.tipo, placa, modelo, colaborador, matricula, base, km, obs];
        } else {
          const codigo = mov.chave?.codigo || '-';
          const placa = mov.chave?.veiculo?.placa || '-';
          const modelo = mov.chave?.veiculo?.modelo || '-';
          const colaborador = mov.colaborador?.nome || '-';
          const matricula = mov.colaborador?.matricula || '-';
          const base = mov.chave?.veiculo?.base?.nome || '-';
          const status = mov.status || '-';
          const obs = mov.observacoes || '-';
          
          return [dataFormatada, mov.tipo, codigo, placa, modelo, colaborador, matricula, base, status, obs];
        }
      });

      // Exportar para Excel
      const wsData = [headers, ...rows];
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, activeTab === 'veiculos' ? 'Veículos' : 'Chaves');
      
      // Ajustar largura das colunas
      const colWidths = headers.map(() => ({ wch: 15 }));
      ws['!cols'] = colWidths;
      
      const fileName = `portaria_${activeTab}_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(wb, fileName);
      
      console.log('✅ Export Excel concluído:', rows.length, 'registros');
    } catch (error) {
      console.error('❌ Erro ao exportar:', error);
      alert('Erro ao exportar dados. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const filteredDataCount = useMemo(() => data.length, [data]);

  return (
    <ProtectedRoute requiredPermissions={[
      PERMISSION_CODES.PORTARIA.RELATORIO_MOVIMENTACOES
    ]}>
      <div className="bg-gray-50">
      <div className="max-w-7xl mx-auto p-4">
        <div className="mb-3">
          <h1 className="text-2xl font-bold text-gray-900">Consulta de Portaria</h1>
          <p className="text-sm text-gray-600 mt-1">Visualização rápida de movimentações</p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-3">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 p-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">{stats.total.toLocaleString()}</div>
              <div className="text-xs text-gray-600">Total</div>
            </div>
            {activeTab === 'veiculos' ? (
              <>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{stats.entradas.toLocaleString()}</div>
                  <div className="text-xs text-gray-600">Entradas</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600">{stats.saidas.toLocaleString()}</div>
                  <div className="text-xs text-gray-600">Saídas</div>
                </div>
              </>
            ) : (
              <>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">{stats.retiradas.toLocaleString()}</div>
                  <div className="text-xs text-gray-600">Retiradas</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">{stats.devolucoes.toLocaleString()}</div>
                  <div className="text-xs text-gray-600">Devoluções</div>
                </div>
              </>
            )}
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-700">{filteredDataCount.toLocaleString()}</div>
              <div className="text-xs text-gray-600">Carregados</div>
            </div>
            <div className="text-center">
              <button
                onClick={exportToExcel}
                disabled={data.length === 0}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <FileSpreadsheet className="h-4 w-4" />
                Exportar Excel
              </button>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-4">
          <div className="p-2">
            <div className="inline-flex items-center gap-1 rounded-lg bg-gray-100 p-1">
              <button
                onClick={() => setActiveTab('veiculos')}
                className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-all ${
                  activeTab === 'veiculos'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Car className="h-4 w-4" />
                Veículos
              </button>
              <button
                onClick={() => setActiveTab('chaves')}
                className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-all ${
                  activeTab === 'chaves'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Key className="h-4 w-4" />
                Chaves
              </button>
            </div>
          </div>

          <div className="p-4 space-y-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Buscar por placa, nome, matrícula..."
                  value={filters.search}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />
              </div>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                <Filter className="h-4 w-4" />
                Filtros
              </button>
              {(filters.dataInicio || filters.dataFim || filters.baseId !== 'todas' || filters.contratoId !== 'todos') && (
                <button
                  onClick={clearFilters}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 bg-white border border-red-300 rounded-md hover:bg-red-50"
                >
                  <X className="h-4 w-4" />
                  Limpar
                </button>
              )}
            </div>

            {showFilters && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 p-4 bg-gray-50 rounded-md">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Data Início</label>
                  <input
                    type="date"
                    value={filters.dataInicio}
                    onChange={(e) => setFilters(prev => ({ ...prev, dataInicio: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Data Fim</label>
                  <input
                    type="date"
                    value={filters.dataFim}
                    onChange={(e) => setFilters(prev => ({ ...prev, dataFim: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Contrato</label>
                  <select
                    value={filters.contratoId}
                    onChange={(e) => setFilters(prev => ({ ...prev, contratoId: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  >
                    <option value="todos">Todos</option>
                    {contratos.map(c => (
                      <option key={c.id} value={c.id}>{c.nome}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Base</label>
                  <select
                    value={filters.baseId}
                    onChange={(e) => setFilters(prev => ({ ...prev, baseId: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  >
                    <option value="todas">Todas</option>
                    {bases.map(b => (
                      <option key={b.id} value={b.id}>{b.nome}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Data/Hora</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipo</th>
                  {activeTab === 'veiculos' ? (
                    <>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Placa</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Modelo</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Colaborador</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Base</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">KM</th>
                    </>
                  ) : (
                    <>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Código</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Veículo</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Colaborador</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Base</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {loading && data.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-500">
                      Carregando...
                    </td>
                  </tr>
                ) : data.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-500">
                      Nenhum registro encontrado
                    </td>
                  </tr>
                ) : (
                  data.map((mov) => (
                    <tr key={mov.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
                        {new Date(mov.data_movimentacao).toLocaleString('pt-BR', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </td>
                      <td className="px-4 py-3 text-sm whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                          mov.tipo === 'entrada' ? 'bg-green-100 text-green-800' :
                          mov.tipo === 'saida' ? 'bg-red-100 text-red-800' :
                          mov.tipo === 'retirada' ? 'bg-blue-100 text-blue-800' :
                          'bg-purple-100 text-purple-800'
                        }`}>
                          {mov.tipo === 'entrada' && <ArrowDownCircle className="h-3 w-3" />}
                          {mov.tipo === 'saida' && <ArrowUpCircle className="h-3 w-3" />}
                          {mov.tipo.charAt(0).toUpperCase() + mov.tipo.slice(1)}
                        </span>
                      </td>
                      {activeTab === 'veiculos' ? (
                        <>
                          <td className="px-4 py-3 text-sm text-gray-900 font-medium">
                            {mov.veiculo?.placa || mov.carro_particular?.placa || '-'}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {mov.veiculo?.modelo || '-'}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            <div>{mov.colaborador?.nome || mov.carro_particular?.funcionario?.nome || '-'}</div>
                            <div className="text-xs text-gray-500">
                              {mov.colaborador?.matricula || mov.carro_particular?.funcionario?.matricula || ''}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {mov.base?.nome || '-'}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {mov.quilometragem ? `${mov.quilometragem.toLocaleString()} km` : '-'}
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-4 py-3 text-sm text-gray-900 font-medium">
                            {mov.chave?.codigo || '-'}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            <div className="font-medium">{mov.chave?.veiculo?.placa || '-'}</div>
                            <div className="text-xs text-gray-500">{mov.chave?.veiculo?.modelo || ''}</div>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            <div>{mov.colaborador?.nome || '-'}</div>
                            <div className="text-xs text-gray-500">{mov.colaborador?.matricula || ''}</div>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {mov.chave?.veiculo?.base?.nome || '-'}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                              mov.status === 'disponivel' ? 'bg-green-100 text-green-800' :
                              mov.status === 'em_uso' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {mov.status || '-'}
                            </span>
                          </td>
                        </>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="px-4 py-4 border-t border-gray-200">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-700">
                  Mostrando <span className="font-medium">{data.length}</span> de{' '}
                  <span className="font-medium">{totalRecords.toLocaleString()}</span> registros
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handlePreviousPage}
                    disabled={page === 1 || loading}
                    className="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Anterior
                  </button>
                  
                  <div className="flex items-center gap-1">
                    {page > 2 && (
                      <>
                        <button
                          onClick={() => handleGoToPage(1)}
                          className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                        >
                          1
                        </button>
                        {page > 3 && <span className="px-2 text-gray-500">...</span>}
                      </>
                    )}
                    
                    {page > 1 && (
                      <button
                        onClick={() => handleGoToPage(page - 1)}
                        className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                      >
                        {page - 1}
                      </button>
                    )}
                    
                    <button
                      className="px-3 py-2 text-sm font-medium text-white bg-blue-600 border border-blue-600 rounded-md"
                    >
                      {page}
                    </button>
                    
                    {page < totalPages && (
                      <button
                        onClick={() => handleGoToPage(page + 1)}
                        className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                      >
                        {page + 1}
                      </button>
                    )}
                    
                    {page < totalPages - 1 && (
                      <>
                        {page < totalPages - 2 && <span className="px-2 text-gray-500">...</span>}
                        <button
                          onClick={() => handleGoToPage(totalPages)}
                          className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                        >
                          {totalPages}
                        </button>
                      </>
                    )}
                  </div>
                  
                  <button
                    onClick={handleNextPage}
                    disabled={page === totalPages || loading}
                    className="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Próximo
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
    </ProtectedRoute>
  );
}

