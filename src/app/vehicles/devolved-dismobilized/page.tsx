'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { MagnifyingGlassIcon, ChevronRightIcon, TruckIcon, CheckCircleIcon, ChevronLeftIcon, ExclamationTriangleIcon, ArrowLeftIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { PERMISSION_CODES } from '@/hooks/useModularPermissions';
import ProtectedRoute from '@/components/ProtectedRoute';
import PermissionGuard from '@/components/permissions/PermissionGuard';

// Tipos para veículos devolvidos/desmobilizados
type VeiculoDevolvidoDesmobilizado = {
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
  contrato_nome: string;
  data_devolucao_desmobilizacao: string;
  tipo_operacao: 'devolvido' | 'desmobilizado';
  motivo: string;
  processado_por_nome: string;
  observacoes: string;
  pode_reativar: boolean;
  data_reativacao: string | null;
  reativado_por_nome: string | null;
  created_at: string;
  updated_at: string;
};

// Página principal de veículos devolvidos/desmobilizados com permissões modulares
export default function VeiculosDevolvidosDesmobilizadosPage() {
  return (
    <ProtectedRoute requiredPermissions={[
      PERMISSION_CODES.VEICULOS.GESTAO_COMPLETA_FROTA
    ]}>
      <VeiculosDevolvidosDesmobilizadosPageContent />
    </ProtectedRoute>
  );
}

function VeiculosDevolvidosDesmobilizadosPageContent() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [contratoFilter, setContratoFilter] = useState<string | null>(null);
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);
  const [veiculos, setVeiculos] = useState<VeiculoDevolvidoDesmobilizado[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [reativando, setReativando] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login');
    }
  }, [user, authLoading, router]);

  // Função para calcular o status do veículo dinamicamente
  const getVehicleStatus = (veiculo: VeiculoDevolvidoDesmobilizado) => {
    if (!veiculo.pode_reativar) {
      return { label: "Reativado", color: "bg-gray-100 text-gray-500" };
    }
    if (veiculo.tipo_operacao === 'devolvido') {
      return { label: "Devolvido", color: "bg-orange-50 text-orange-700" };
    }
    if (veiculo.tipo_operacao === 'desmobilizado') {
      return { label: "Desmobilizado", color: "bg-red-50 text-red-700" };
    }
    return { label: veiculo.tipo_operacao, color: "bg-gray-100 text-gray-500" };
  };

  // Função para buscar veículos devolvidos/desmobilizados
  const fetchVeiculos = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: itemsPerPage.toString(),
        ...(searchTerm && { search: searchTerm }),
        ...(statusFilter && { tipo_operacao: statusFilter }),
        ...(contratoFilter && { contrato_id: contratoFilter })
      });

      const response = await fetch(`/api/vehicles/devolved-dismobilized?${params}`);
      
      if (!response.ok) {
        throw new Error('Erro ao buscar veículos devolvidos/desmobilizados');
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
  }, [currentPage, itemsPerPage, searchTerm, statusFilter, contratoFilter]);

  // Função para reativar veículo
  const handleReativarVeiculo = async (veiculoId: string, placa: string) => {
    if (!confirm(`Confirma reativar o veículo ${placa}?`)) {
      return;
    }

    try {
      setReativando(veiculoId);
      
      const novoStatus = prompt(`Novo status para o veículo ${placa} (disponivel, operacao, manutencao):`, 'disponivel');
      
      if (!novoStatus) {
        return;
      }
      
      const observacoes = prompt(`Observações sobre a reativação (opcional):`) || '';

      const response = await fetch('/api/vehicles/reactivate', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          veiculo_id: veiculoId,
          novo_status: novoStatus,
          observacoes: observacoes
        }),
      });

      if (response.ok) {
        const result = await response.json();
        alert(result.message);
        fetchVeiculos(); // Recarregar lista
      } else {
        const error = await response.json();
        alert(error.error || 'Erro ao reativar veículo');
      }
    } catch (error) {
      console.error('Error reactivating vehicle:', error);
      alert('Erro ao reativar veículo');
    } finally {
      setReativando(null);
    }
  };

  useEffect(() => {
    fetchVeiculos();
  }, [fetchVeiculos]);

  // Calcular totais por status
  const totalDevolvido = veiculos.filter(v => v.tipo_operacao === 'devolvido' && v.pode_reativar).length;
  const totalDesmobilizado = veiculos.filter(v => v.tipo_operacao === 'desmobilizado' && v.pode_reativar).length;
  const totalReativavel = veiculos.filter(v => v.pode_reativar).length;

  // Liste contratos únicos
  const uniqueContratos = Array.from(new Set(veiculos.map((v: VeiculoDevolvidoDesmobilizado) => v.contrato_nome).filter(Boolean)));

  // Filtro de veículos
  const filteredVehicles = veiculos.filter((vehicle) => {
    const matchesSearch = !searchTerm || 
      vehicle.placa.toLowerCase().includes(searchTerm.toLowerCase()) ||
      vehicle.modelo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      vehicle.marca_equipamento?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = !statusFilter || vehicle.tipo_operacao === statusFilter;
    const matchesContrato = !contratoFilter || vehicle.contrato_nome === contratoFilter;
    
    return matchesSearch && matchesStatus && matchesContrato;
  });

  // Paginação
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedVehicles = filteredVehicles.slice(startIndex, endIndex);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Carregando veículos devolvidos/desmobilizados...</p>
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
            </div>
            
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-orange-50 rounded-lg">
                <TruckIcon className="h-6 w-6 text-orange-600" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900">
                Veículos Devolvidos e Desmobilizados
              </h1>
            </div>
          </div>

          {/* Cards de Status */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center">
                <div className="p-2 bg-orange-50 rounded-lg">
                  <TruckIcon className="h-5 w-5 text-orange-600" />
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-500">Devolvidos</p>
                  <p className="text-2xl font-semibold text-gray-900">{totalDevolvido}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center">
                <div className="p-2 bg-red-50 rounded-lg">
                  <ExclamationTriangleIcon className="h-5 w-5 text-red-600" />
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-500">Desmobilizados</p>
                  <p className="text-2xl font-semibold text-gray-900">{totalDesmobilizado}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center">
                <div className="p-2 bg-green-50 rounded-lg">
                  <CheckCircleIcon className="h-5 w-5 text-green-600" />
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-500">Reativáveis</p>
                  <p className="text-2xl font-semibold text-gray-900">{totalReativavel}</p>
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
                    className="pl-10 pr-3 py-2 border border-gray-300 rounded-md w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Filtro de Status */}
              <div className="lg:w-48">
                <select
                  value={statusFilter || ''}
                  onChange={(e) => setStatusFilter(e.target.value || null)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Todos os status</option>
                  <option value="devolvido">Devolvido</option>
                  <option value="desmobilizado">Desmobilizado</option>
                </select>
              </div>

              {/* Filtro de Contrato */}
              <div className="lg:w-48">
                <select
                  value={contratoFilter || ''}
                  onChange={(e) => setContratoFilter(e.target.value || null)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                        Data
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Motivo
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Processado por
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Ações
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {paginatedVehicles.map((veiculo) => (
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
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getVehicleStatus(veiculo).color}`}>
                            {getVehicleStatus(veiculo).label}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{veiculo.contrato_nome}</div>
                          <div className="text-sm text-gray-500">{veiculo.base_nome}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {new Date(veiculo.data_devolucao_desmobilizacao).toLocaleDateString('pt-BR')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900 max-w-xs truncate">
                            {veiculo.motivo || '-'}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {veiculo.processado_por_nome || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          {veiculo.pode_reativar && (
                            <PermissionGuard codigo={PERMISSION_CODES.VEICULOS.GESTAO_COMPLETA_FROTA}>
                              <button
                                onClick={() => handleReativarVeiculo(veiculo.veiculo_id, veiculo.placa)}
                                disabled={reativando === veiculo.veiculo_id}
                                className="text-green-600 hover:text-green-900 disabled:opacity-50"
                              >
                                {reativando === veiculo.veiculo_id ? 'Reativando...' : 'Reativar'}
                              </button>
                            </PermissionGuard>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              {paginatedVehicles.length === 0 && !loading && (
                <div className="text-center py-12">
                  <TruckIcon className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900">Nenhum veículo encontrado</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Não há veículos devolvidos/desmobilizados com os filtros aplicados.
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