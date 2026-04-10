'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { MagnifyingGlassIcon, ChevronRightIcon, TruckIcon, CheckCircleIcon, ChevronLeftIcon, ExclamationTriangleIcon, ArrowLeftIcon, ShieldCheckIcon, DocumentArrowDownIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { PERMISSION_CODES } from '@/hooks/useModularPermissions';
import ProtectedRoute from '@/components/ProtectedRoute';
import PermissionGuard from '@/components/permissions/PermissionGuard';

// Tipos para veículos bloqueados
type VeiculoBloqueado = {
  id: string;
  veiculo_id: string;
  placa: string;
  modelo: string;
  marca_equipamento: string;
  ano_fabricacao: number;
  ano_modelo: number;
  tipo_veiculo: string;
  propriedade: string;
  quilometragem_atual: number;
  base_nome: string;
  contrato_atual_nome: string;
  data_bloqueio: string;
  motivo: string;
  observacoes: string;
  observacoes_bloqueio?: string;
  observacoes_desbloqueio?: string;
  bloqueio_origem_contrato_id: string | null;
  bloqueio_origem_contrato_nome: string | null;
  bloqueio_origem_contrato_nome_atual: string | null;
  processado_por_nome: string;
  pode_desbloquear: boolean;
  data_desbloqueio: string | null;
  desbloqueado_por_nome: string | null;
  status_bloqueio?: 'bloqueado' | 'desbloqueado';
  dias_bloqueado?: number;
  created_at: string;
  updated_at: string;
};

// Página principal de veículos bloqueados com permissões modulares
export default function VeiculosBloqueadosPage() {
  return (
    <ProtectedRoute requiredPermissions={[
      PERMISSION_CODES.VEICULOS.GESTAO_COMPLETA_FROTA
    ]}>
      <VeiculosBloqueadosPageContent />
    </ProtectedRoute>
  );
}

function VeiculosBloqueadosPageContent() {
  const [searchTerm, setSearchTerm] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const [contratoFilter, setContratoFilter] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'ativos' | 'historico'>('ativos'); // Novo estado para alternar entre ativos e histórico
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);
  const [veiculos, setVeiculos] = useState<VeiculoBloqueado[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [desbloqueando, setDesbloqueando] = useState<string | null>(null);
  const [exportingExcel, setExportingExcel] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login');
    }
  }, [user, authLoading, router]);

  // Função para buscar veículos bloqueados (ativos ou histórico)
  const fetchVeiculos = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: itemsPerPage.toString(),
        ...(searchTerm && { search: searchTerm }),
        ...(contratoFilter && { contrato_id: contratoFilter })
      });

      // Usar endpoint diferente dependendo do modo de visualização
      const endpoint = viewMode === 'historico' 
        ? `/api/vehicles/blocked/history?${params}`
        : `/api/vehicles/blocked?${params}`;

      const response = await fetch(endpoint);
      
      if (!response.ok) {
        throw new Error('Erro ao buscar veículos bloqueados');
      }

      const data = await response.json();
      
      if (data.success) {
        setVeiculos(data.data);
        setTotalPages(data.pagination.totalPages);
        setTotal(data.pagination.total);
      } else {
        throw new Error(data.error || 'Erro ao buscar dados');
      }
    } catch (err) {
      console.error('Erro ao buscar veículos:', err);
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  }, [currentPage, itemsPerPage, searchTerm, contratoFilter, viewMode]);

  // Função para desbloquear veículo
  const handleDesbloquearVeiculo = async (veiculoId: string, placa: string) => {
    if (!confirm(`Confirma desbloquear o veículo ${placa}?`)) {
      return;
    }

    try {
      setDesbloqueando(veiculoId);
      
      const observacoes = prompt(`Observações sobre o desbloqueio (opcional):`) || '';

      const { data: { session } } = await (await import('@/lib/supabase')).supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Token de acesso não encontrado');
      }

      const response = await fetch('/api/vehicles/unblock', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          veiculo_id: veiculoId,
          novo_status: 'disponivel',
          observacoes: observacoes
        }),
      });

      if (response.ok) {
        const result = await response.json();
        alert(result.message);
        fetchVeiculos(); // Recarregar lista
      } else {
        const error = await response.json();
        alert(error.error || 'Erro ao desbloquear veículo');
      }
    } catch (error) {
      console.error('Error unblocking vehicle:', error);
      alert('Erro ao desbloquear veículo');
    } finally {
      setDesbloqueando(null);
    }
  };

  // Função para exportar Excel
  const handleExportExcel = async () => {
    try {
      setExportingExcel(true);
      const response = await fetch('/api/vehicles/blocked/export');
      
      if (!response.ok) {
        throw new Error('Erro ao exportar Excel');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `relatorio-veiculos-bloqueados-${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Erro ao exportar Excel:', error);
      alert('Erro ao exportar Excel');
    } finally {
      setExportingExcel(false);
    }
  };

  useEffect(() => {
    setCurrentPage(1); // Resetar página ao mudar modo de visualização
  }, [viewMode]);

  useEffect(() => {
    fetchVeiculos();
  }, [fetchVeiculos]);

  // Calcular totais
  const totalDesbloqueavel = veiculos.filter(v => v.pode_desbloquear).length;

  // Liste contratos únicos
  const uniqueContratos = Array.from(new Set(veiculos.map((v: VeiculoBloqueado) => v.contrato_atual_nome).filter(Boolean)));

  // Filtro de veículos
  const filteredVehicles = veiculos.filter((vehicle) => {
    const matchesSearch = !searchTerm || 
      vehicle.placa.toLowerCase().includes(searchTerm.toLowerCase()) ||
      vehicle.modelo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      vehicle.marca_equipamento?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesContrato = !contratoFilter || vehicle.contrato_atual_nome === contratoFilter;
    
    return matchesSearch && matchesContrato;
  });

  // Paginação
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedVehicles = filteredVehicles.slice(startIndex, endIndex);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Carregando veículos bloqueados...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {/* Header */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <Link href="/vehicles" className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900">
                  <ArrowLeftIcon className="h-4 w-4 mr-1" />
                  Voltar para veículos
                </Link>
              </div>
              <div className="flex gap-3">
                <button
                  className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                  onClick={handleExportExcel}
                  disabled={exportingExcel}
                >
                  <DocumentArrowDownIcon className="h-5 w-5 mr-2" />
                  {exportingExcel ? 'Gerando...' : 'Exportar Excel'}
                </button>
              </div>
            </div>
            
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-red-50 rounded-lg">
                <ExclamationTriangleIcon className="h-6 w-6 text-red-600" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900">
                Veículos Bloqueados
              </h1>
            </div>

            {/* Abas para alternar entre ativos e histórico */}
            <div className="border-b border-gray-200 mb-4">
              <nav className="-mb-px flex space-x-8">
                <button
                  onClick={() => setViewMode('ativos')}
                  className={`${
                    viewMode === 'ativos'
                      ? 'border-red-500 text-red-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                >
                  Bloqueios Ativos
                </button>
                <button
                  onClick={() => setViewMode('historico')}
                  className={`${
                    viewMode === 'historico'
                      ? 'border-red-500 text-red-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                >
                  Histórico Completo
                </button>
              </nav>
            </div>
          </div>

          {/* Cards de Status */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center">
                <div className="p-2 bg-red-50 rounded-lg">
                  <ExclamationTriangleIcon className="h-5 w-5 text-red-600" />
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-500">Bloqueados</p>
                  <p className="text-2xl font-semibold text-gray-900">{total}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center">
                <div className="p-2 bg-green-50 rounded-lg">
                  <CheckCircleIcon className="h-5 w-5 text-green-600" />
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-500">Desbloqueáveis</p>
                  <p className="text-2xl font-semibold text-gray-900">{totalDesbloqueavel}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center">
                <div className="p-2 bg-gray-50 rounded-lg">
                  <TruckIcon className="h-5 w-5 text-gray-600" />
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-500">Total</p>
                  <p className="text-2xl font-semibold text-gray-900">{total}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Filtros e Busca */}
          <div className="bg-white rounded-lg shadow mb-6 p-4">
            <div className="flex flex-col lg:flex-row gap-4">
              {/* Busca */}
              <div className="flex-1">
                <div className="relative">
                  <MagnifyingGlassIcon className="h-5 w-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <input
                    ref={inputRef}
                    type="text"
                    placeholder="Buscar por placa, modelo ou marca..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 pr-3 py-2 border border-gray-300 rounded-md w-full focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>
              </div>

              {/* Filtro de Contrato */}
              <div className="lg:w-48">
                <select
                  value={contratoFilter || ''}
                  onChange={(e) => setContratoFilter(e.target.value || null)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                >
                  <option value="">Todos os contratos</option>
                  {uniqueContratos.map((contrato) => (
                    <option key={contrato} value={contrato}>
                      {contrato}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Lista de Veículos */}
          {error ? (
            <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
              <div className="flex">
                <ExclamationTriangleIcon className="h-5 w-5 text-red-400" />
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">Erro</h3>
                  <div className="mt-2 text-sm text-red-700">{error}</div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white shadow rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Veículo
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Localização
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Bloqueio Origem
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Data Bloqueio
                      </th>
                      {viewMode === 'historico' && (
                        <>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Data Desbloqueio
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Dias Bloqueado
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Desbloqueado por
                          </th>
                        </>
                      )}
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Motivo
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Processado por
                      </th>
                      {viewMode === 'ativos' && (
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Ações
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {paginatedVehicles.map((veiculo) => {
                      const isDesbloqueado = veiculo.status_bloqueio === 'desbloqueado' || veiculo.data_desbloqueio;
                      return (
                        <tr key={veiculo.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div>
                              <div className="text-sm font-medium text-gray-900">
                                {veiculo.placa}
                              </div>
                              <div className="text-sm text-gray-500">
                                {veiculo.modelo} - {veiculo.marca_equipamento}
                              </div>
                              <div className="text-sm text-gray-500">
                                {veiculo.ano_fabricacao}/{veiculo.ano_modelo}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {isDesbloqueado ? (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                <ShieldCheckIcon className="h-4 w-4 mr-1" />
                                Desbloqueado
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                <ExclamationTriangleIcon className="h-4 w-4 mr-1" />
                                Bloqueado
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">{veiculo.contrato_atual_nome || '-'}</div>
                            <div className="text-sm text-gray-500">{veiculo.base_nome || '-'}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">
                              {veiculo.bloqueio_origem_contrato_nome || veiculo.bloqueio_origem_contrato_nome_atual || '-'}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {new Date(veiculo.data_bloqueio).toLocaleDateString('pt-BR')}
                          </td>
                          {viewMode === 'historico' && (
                            <>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {veiculo.data_desbloqueio 
                                  ? new Date(veiculo.data_desbloqueio).toLocaleDateString('pt-BR')
                                  : '-'}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {veiculo.dias_bloqueado !== undefined && veiculo.dias_bloqueado !== null
                                  ? `${veiculo.dias_bloqueado} dias`
                                  : '-'}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {veiculo.desbloqueado_por_nome || '-'}
                                {veiculo.observacoes_desbloqueio && (
                                  <div className="text-xs text-gray-500 mt-1 max-w-xs truncate" title={veiculo.observacoes_desbloqueio}>
                                    {veiculo.observacoes_desbloqueio}
                                  </div>
                                )}
                              </td>
                            </>
                          )}
                          <td className="px-6 py-4">
                            <div className="text-sm text-gray-900 max-w-xs truncate" title={veiculo.motivo}>
                              {veiculo.motivo || '-'}
                            </div>
                            {veiculo.observacoes_bloqueio && (
                              <div className="text-xs text-gray-500 mt-1 max-w-xs truncate" title={veiculo.observacoes_bloqueio}>
                                Obs: {veiculo.observacoes_bloqueio}
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {veiculo.processado_por_nome || '-'}
                          </td>
                          {viewMode === 'ativos' && (
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                              {veiculo.pode_desbloquear && (
                                <PermissionGuard codigo={PERMISSION_CODES.VEICULOS.GESTAO_COMPLETA_FROTA}>
                                  <button
                                    onClick={() => handleDesbloquearVeiculo(veiculo.veiculo_id, veiculo.placa)}
                                    disabled={desbloqueando === veiculo.veiculo_id}
                                    className="text-green-600 hover:text-green-900 disabled:opacity-50"
                                  >
                                    {desbloqueando === veiculo.veiculo_id ? 'Desbloqueando...' : 'Desbloquear'}
                                  </button>
                                </PermissionGuard>
                              )}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              
              {paginatedVehicles.length === 0 && !loading && (
                <div className="text-center py-12">
                  <ExclamationTriangleIcon className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900">Nenhum veículo encontrado</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Não há veículos bloqueados com os filtros aplicados.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Paginação */}
          {totalPages > 1 && (
            <div className="mt-6 flex items-center justify-between">
              <div className="text-sm text-gray-700">
                Mostrando {startIndex + 1} a {Math.min(endIndex, filteredVehicles.length)} de {filteredVehicles.length} registros
              </div>
              <div className="flex space-x-2">
                <Button
                  variant="outline"
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeftIcon className="h-4 w-4 mr-1" />
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                >
                  Próximo
                  <ChevronRightIcon className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

