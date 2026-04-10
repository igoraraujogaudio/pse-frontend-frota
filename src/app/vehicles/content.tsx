'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import { MagnifyingGlassIcon, PlusIcon, FunnelIcon, ChevronRightIcon, TruckIcon, WrenchScrewdriverIcon, CheckCircleIcon, ArrowsRightLeftIcon, ChevronLeftIcon, DocumentArrowDownIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { vehicleService } from '@/services/vehicleService';
import type { Vehicle } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { Team } from '@/types/team';
import { teamService } from '@/services/teamService';
import { contratoService } from '@/services/contratoService';

// Sistema de toast simples
const showToast = (type: 'success' | 'error', message: string) => {
  const toast = document.createElement('div');
  toast.className = `fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg transition-all duration-300 transform translate-x-full ${
    type === 'success' 
      ? 'bg-green-500 text-white' 
      : 'bg-red-500 text-white'
  }`;
  toast.textContent = message;
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.classList.remove('translate-x-full');
  }, 100);
  
  setTimeout(() => {
    toast.classList.add('translate-x-full');
    setTimeout(() => {
      if (document.body.contains(toast)) {
        document.body.removeChild(toast);
      }
    }, 300);
  }, 3000);
};

// Página principal de veículos com permissões modulares
export function VehiclesPageContent() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [teamSearch, setTeamSearch] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [contratoFilter, setContratoFilter] = useState<string[]>([]);
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [showContratoDropdown, setShowContratoDropdown] = useState(false);
  const { user, loading: authLoading, userContratoIds } = useAuth();
  const router = useRouter();
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [showReallocationModal, setShowReallocationModal] = useState<string | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<string | ''>('');
  const [reallocating, setReallocating] = useState<string | null>(null);
  const [exportingExcel, setExportingExcel] = useState(false);
  const [vehicleTeamsMap, setVehicleTeamsMap] = useState<Record<string, Team[]>>({});
  const { data: teams = [], isLoading: isLoadingTeams } = useQuery<Team[]>({
    queryKey: ['teams'],
    queryFn: teamService.getTeams,
  });

  const { data: vehicles = [], isLoading, isError } = useQuery({
    queryKey: ['vehicles', userContratoIds],
    queryFn: () => vehicleService.getAll(undefined, userContratoIds) // Usar contratos em vez de locais
  });

  // Buscar informações de bloqueio para veículos bloqueados
  const { data: blockedVehiclesInfo = {} } = useQuery({
    queryKey: ['blocked-vehicles-info'],
    queryFn: async () => {
      const { data: { session } } = await (await import('@/lib/supabase')).supabase.auth.getSession();
      if (!session?.access_token) return {};
      
      const response = await fetch('/api/vehicles/blocked?limit=1000', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        const infoMap: Record<string, { origem_contrato: string | null }> = {};
        (data.data || []).forEach((v: Record<string, unknown>) => {
          const vehicleId = v.veiculo_id as string
          const origemNome = (v.bloqueio_origem_contrato_nome || v.bloqueio_origem_contrato_nome_atual) as string | undefined
          infoMap[vehicleId] = {
            origem_contrato: origemNome || null
          };
        });
        return infoMap;
      }
      return {};
    },
    enabled: !!user,
  });

  // Buscar totais de veículos bloqueados, desmobilizados e devolvidos
  // Note: blockedCount is calculated but not used in the UI
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { data: blockedCount = 0 } = useQuery({
    queryKey: ['blocked-vehicles-count', userContratoIds],
    queryFn: async () => {
      const { data: { session } } = await (await import('@/lib/supabase')).supabase.auth.getSession();
      if (!session?.access_token) return 0;
      
      const response = await fetch('/api/vehicles/blocked?limit=1', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        return data.pagination?.total || 0;
      }
      return 0;
    },
    enabled: !!user,
  });

  const { data: devolvedDismobilizedData } = useQuery({
    queryKey: ['devolved-dismobilized-data', userContratoIds],
    queryFn: async () => {
      const { data: { session } } = await (await import('@/lib/supabase')).supabase.auth.getSession();
      if (!session?.access_token) return { devolvidos: 0, desmobilizados: 0 };
      
      const response = await fetch('/api/vehicles/devolved-dismobilized?limit=1000', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        const veiculos = data.data || [];
        return {
          devolvidos: veiculos.filter((v: Record<string, unknown>) => v.tipo_operacao === 'devolvido').length,
          desmobilizados: veiculos.filter((v: Record<string, unknown>) => v.tipo_operacao === 'desmobilizado').length,
        };
      }
      return { devolvidos: 0, desmobilizados: 0 };
    },
    enabled: !!user,
  });

  const devolvidosCount = devolvedDismobilizedData?.devolvidos || 0;
  const desmobilizadosCount = devolvedDismobilizedData?.desmobilizados || 0;

  // Carregar todos os contratos do usuário (não apenas os que têm veículos)
  const { data: userContratos = [] } = useQuery({
    queryKey: ['userContratos', user?.id],
    queryFn: () => user ? contratoService.getUserContratos(user.id) : Promise.resolve([]),
    enabled: !!user
  });

  // Carregar associações veículo-equipe (query leve, sem filtro de IDs)
  const { data: vehicleTeamAssociations = [] } = useQuery({
    queryKey: ['vehicle-team-associations'],
    queryFn: () => teamService.getAllVehicleTeamAssociations(),
    enabled: vehicles.length > 0,
  });

  // Montar mapa veículo->equipes cruzando associações com equipes já carregadas
  useEffect(() => {
    if (vehicleTeamAssociations.length > 0 && teams.length > 0) {
      const teamsById = new Map(teams.map(t => [String(t.id), t]));
      const newMap: Record<string, Team[]> = {};
      for (const assoc of vehicleTeamAssociations) {
        const vid = String(assoc.veiculo_id);
        const team = teamsById.get(String(assoc.equipe_id));
        if (team) {
          if (!newMap[vid]) newMap[vid] = [];
          newMap[vid].push(team);
        }
      }
      setVehicleTeamsMap(newMap);
    }
  }, [vehicleTeamAssociations, teams]);

  useEffect(() => {
    async function fetchMaintenances() {
      try {
        // Remover import não utilizado de 'Maintenance'
        // Remover variável não utilizada 'allMaintenances'
      } catch {
        // ignore
      }
    }
    fetchMaintenances();
  }, []);

  // Função para calcular o status do veículo dinamicamente
  const getVehicleStatus = (vehicle: Vehicle) => {
    const status = (vehicle.status || '').toLowerCase();
    if (["operacao", "operação"].includes(status)) {
      return { label: "Operação", color: "bg-green-50 text-green-700" };
    }
    if (["manutenção", "em manutenção", "manutencao"].includes(status)) {
      return { label: "Em Manutenção", color: "bg-yellow-50 text-yellow-700" };
    }
    if (["disponivel", "disponível"].includes(status)) {
      return { label: "Disponível", color: "bg-blue-50 text-blue-700" };
    }
    if (["bloqueado"].includes(status)) {
      return { label: "Bloqueado", color: "bg-red-50 text-red-700" };
    }
    if (["devolvido"].includes(status)) {
      return { label: "Devolvido", color: "bg-orange-50 text-orange-700" };
    }
    if (["desmobilizado"].includes(status)) {
      return { label: "Desmobilizado", color: "bg-red-50 text-red-700" };
    }
    return { label: vehicle.status, color: "bg-gray-100 text-gray-500" };
  };

  // Função para obter as equipes do veículo (many-to-many)
  const getVehicleTeams = (vehicleId: string | number) => {
    return vehicleTeamsMap[vehicleId.toString()] || [];
  };

  // Função para obter as operações das equipes do veículo
  const getTeamOperations = (vehicle: Vehicle) => {
    const vehicleTeams = getVehicleTeams(vehicle.id);
    if (vehicleTeams.length === 0) {
      // Fallback para estrutura antiga
      const allocatedTeam = teams.find(t => String(t.id) === String(vehicle.equipe_id));
      return allocatedTeam?.operacao || '-';
    }
    const operations = vehicleTeams.map(t => t.operacao).filter(Boolean);
    return operations.length > 0 ? operations.join(', ') : '-';
  };

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login');
    }
  }, [user, authLoading, router]);

  // Corrigir totais por status usando os labels padronizados
  const totalOperacao = vehicles.filter(v =>
    getVehicleStatus(v).label === 'Operação' &&
    (contratoFilter.length === 0 ? true : (v.contrato?.nome && contratoFilter.includes(v.contrato.nome)))
  ).length;
  const totalManutencao = vehicles.filter(v =>
    getVehicleStatus(v).label === 'Em Manutenção' &&
    (contratoFilter.length === 0 ? true : (v.contrato?.nome && contratoFilter.includes(v.contrato.nome)))
  ).length;
  const totalDisponivel = vehicles.filter(v =>
    getVehicleStatus(v).label === 'Disponível' &&
    (contratoFilter.length === 0 ? true : (v.contrato?.nome && contratoFilter.includes(v.contrato.nome)))
  ).length;
  const totalBloqueado = vehicles.filter(v =>
    getVehicleStatus(v).label === 'Bloqueado' &&
    (contratoFilter.length === 0 ? true : (v.contrato?.nome && contratoFilter.includes(v.contrato.nome)))
  ).length;
  const totalVeiculos = vehicles.filter(v =>
    (contratoFilter.length === 0 ? true : (v.contrato?.nome && contratoFilter.includes(v.contrato.nome)))
  ).length;

  // Obter todos os contratos do usuário (não apenas os que têm veículos)
  const uniqueContratos = useMemo(() => {
    // Primeiro, pegar os contratos dos veículos carregados
    const contratosFromVehicles = Array.from(new Set(vehicles.map((v: Vehicle) => v.contrato?.nome).filter(Boolean)));
    
    // Depois, pegar todos os contratos do usuário
    const contratosFromUser = userContratos
      .map(uc => uc.contrato?.nome)
      .filter(Boolean) as string[];
    
    // Combinar ambos e remover duplicatas
    const allContratos = Array.from(new Set([...contratosFromVehicles, ...contratosFromUser]));
    
    return allContratos.sort();
  }, [vehicles, userContratos]);
  
  // Obter todos os status únicos usando os labels normalizados
  // Note: uniqueStatusLabels is calculated but not used in the UI
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const uniqueStatusLabels = useMemo(() => {
    const statusSet = new Set<string>();
    vehicles.forEach((v: Vehicle) => {
      const statusLabel = getVehicleStatus(v).label;
      if (statusLabel) {
        statusSet.add(statusLabel);
      }
      // Adicionar também o status raw caso seja diferente do label
      if (v.status && v.status !== statusLabel) {
        statusSet.add(v.status);
      }
    });
    return Array.from(statusSet).sort();
  }, [vehicles]);

  // Filtro de veículos
  const filteredVehicles = vehicles.filter(vehicle =>
    (statusFilter ? getVehicleStatus(vehicle).label === statusFilter : true) &&

    (contratoFilter.length === 0 ? true : (vehicle.contrato?.nome && contratoFilter.includes(vehicle.contrato.nome))) &&
    (
      (vehicle.placa && vehicle.placa.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (vehicle.tipo_veiculo && vehicle.tipo_veiculo.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (vehicle.marca_equipamento && vehicle.marca_equipamento.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (vehicle.status && vehicle.status.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (vehicle.contrato?.nome && vehicle.contrato.nome.toLowerCase().includes(searchTerm.toLowerCase()))
    )
  );

  // Filtra as equipes com base na busca
  const filteredTeams = useMemo(() => {
    if (!teamSearch) return [];
    const searchTerm = teamSearch.toLowerCase();
    return teams.filter((team: Team) => {
      const teamName = team.nome.toLowerCase();
      return teamName.includes(searchTerm) || 
             (team.operacao && team.operacao.toLowerCase().includes(searchTerm));
    });
  }, [teamSearch, teams]);

  // Paginação
  const totalPages = Math.ceil(filteredVehicles.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedVehicles = filteredVehicles.slice(startIndex, startIndex + itemsPerPage);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, contratoFilter, itemsPerPage]);

  const handleReallocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showReallocationModal) return;

    try {
      setReallocating(showReallocationModal);

      // 1. Encontra o veículo alvo
      const targetVehicle = vehicles.find(v => String(v.id) === showReallocationModal);
      if (!targetVehicle) {
        throw new Error('Veículo não encontrado');
      }

      // 2. Se não há equipe selecionada, apenas desaloca todas as equipes do veículo
      if (selectedTeam === '') {
        const currentTeams = getVehicleTeams(showReallocationModal);
        // Remover todas as equipes do veículo
        for (const team of currentTeams) {
          await teamService.removeVehicle(team.id, String(targetVehicle.id));
        }
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['vehicles'] }),
          queryClient.invalidateQueries({ queryKey: ['teams'] })
        ]);
        setShowReallocationModal(null);
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 2000);
        return;
      }

      // 3. Encontra a equipe selecionada
      const selectedTeamData = teams.find(t => String(t.id) === String(selectedTeam));
      if (!selectedTeamData) {
        throw new Error('Equipe não encontrada');
      }

      // 4. Verificar se a equipe já está associada ao veículo
      const currentTeams = getVehicleTeams(showReallocationModal);
      const alreadyAssigned = currentTeams.some(t => String(t.id) === String(selectedTeam));
      
      if (alreadyAssigned) {
        // Se já está associada, apenas confirma
        setShowReallocationModal(null);
        setSelectedTeam('');
        setTeamSearch('');
        return;
      }

      // 5. Aloca a equipe ao veículo usando many-to-many
      await teamService.assignVehicle(selectedTeam, String(targetVehicle.id));

      // 6. Atualiza as listas
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['vehicles'] }),
        queryClient.invalidateQueries({ queryKey: ['teams'] })
      ]);

      // 7. Limpa o estado e mostra sucesso
      setShowReallocationModal(null);
      setSelectedTeam('');
      setTeamSearch('');
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 2000);

    } catch (error) {
      console.error('Erro:', error);
      alert(error instanceof Error ? error.message : 'Erro ao processar a operação');
    } finally {
      setReallocating(null);
    }
  };

  // Função para exportar relatório em Excel
  const handleExportExcel = async () => {
    try {
      setExportingExcel(true);
      
      // Se houver filtro de contrato, usar apenas os contratos dos veículos filtrados
      let contratoIdsToExport: string[] = [];
      
      if (contratoFilter.length > 0) {
        // Pegar IDs únicos dos contratos dos veículos filtrados
        const filteredContratoIds = Array.from(
          new Set(
            vehicles
              .filter(v => v.contrato?.nome && contratoFilter.includes(v.contrato.nome) && v.contrato?.id)
              .map(v => v.contrato!.id)
          )
        );
        contratoIdsToExport = filteredContratoIds;
      } else {
        // Se não houver filtro, usar todos os contratos do usuário
        contratoIdsToExport = userContratoIds || [];
      }
      
      const contratoIdsParam = contratoIdsToExport.length ? contratoIdsToExport.join(',') : '';
      const response = await fetch(`/api/vehicles/export?contratoIds=${contratoIdsParam}`);
      
      if (!response.ok) {
        throw new Error('Erro ao gerar relatório');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `relatorio-veiculos-${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
    } catch (error) {
      console.error('Erro ao exportar:', error);
      alert('Erro ao gerar relatório Excel. Tente novamente.');
    } finally {
      setExportingExcel(false);
    }
  };

  if (isLoading || !user) {
    return <div className="flex items-center justify-center py-20 text-gray-500">Carregando...</div>;
  }

  if (isError) {
    return <div className="flex items-center justify-center py-20 text-red-500">Erro ao carregar veículos.</div>;
  }

  return (
    <div>
      <div className="max-w-[1300px] mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {/* Header Section */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Frota</h1>
                <p className="mt-2 text-sm text-gray-600">
                  Gerencie sua frota de veículos de forma eficiente
                </p>
              </div>
              {/* Cards de totais na mesma linha */}
              <div className="flex items-center gap-4">
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 min-w-[120px]">
                  <div className="text-2xl font-bold text-amber-700">{desmobilizadosCount}</div>
                  <div className="text-sm text-amber-600 font-medium">Desmobilizados</div>
                </div>
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 min-w-[120px]">
                  <div className="text-2xl font-bold text-orange-700">{devolvidosCount}</div>
                  <div className="text-sm text-orange-600 font-medium">Devolvidos</div>
                </div>
              </div>
            </div>
          </div>

          {/* Cards de totais */}
          <div className="mb-8 grid grid-cols-1 sm:grid-cols-5 gap-6">
            <button
              type="button"
              onClick={() => setStatusFilter(null)}
              className={`flex items-center gap-4 bg-purple-50 border rounded-xl p-5 transition-all focus:outline-none focus:ring-2 focus:ring-purple-300 ${
                statusFilter === null ? 'border-purple-500 ring-2 ring-purple-200' : 'border-purple-100'
              }`}
            >
              <TruckIcon className="h-8 w-8 text-purple-600" />
              <div>
                <div className="text-2xl font-bold text-purple-700">{totalVeiculos}</div>
                <div className="text-sm text-purple-800 font-medium">Total</div>
              </div>
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter(statusFilter === 'Operação' ? null : 'Operação')}
              className={`flex items-center gap-4 bg-green-50 border rounded-xl p-5 transition-all focus:outline-none focus:ring-2 focus:ring-green-300 ${
                statusFilter === 'Operação' ? 'border-green-500 ring-2 ring-green-200' : 'border-green-100'
              }`}
            >
              <TruckIcon className="h-8 w-8 text-green-600" />
              <div>
                <div className="text-2xl font-bold text-green-700">{totalOperacao}</div>
                <div className="text-sm text-green-800 font-medium">Operação</div>
              </div>
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter(statusFilter === 'Em Manutenção' ? null : 'Em Manutenção')}
              className={`flex items-center gap-4 bg-yellow-50 border rounded-xl p-5 transition-all focus:outline-none focus:ring-2 focus:ring-yellow-300 ${
                statusFilter === 'Em Manutenção' ? 'border-yellow-500 ring-2 ring-yellow-200' : 'border-yellow-100'
              }`}
            >
              <WrenchScrewdriverIcon className="h-8 w-8 text-yellow-600" />
              <div>
                <div className="text-2xl font-bold text-yellow-700">{totalManutencao}</div>
                <div className="text-sm text-yellow-800 font-medium">Em Manutenção</div>
              </div>
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter(statusFilter === 'Disponível' ? null : 'Disponível')}
              className={`flex items-center gap-4 bg-blue-50 border rounded-xl p-5 transition-all focus:outline-none focus:ring-2 focus:ring-blue-300 ${
                statusFilter === 'Disponível' ? 'border-blue-500 ring-2 ring-blue-200' : 'border-blue-100'
              }`}
            >
              <CheckCircleIcon className="h-8 w-8 text-blue-600" />
              <div>
                <div className="text-2xl font-bold text-blue-700">{totalDisponivel}</div>
                <div className="text-sm text-blue-800 font-medium">Disponíveis</div>
              </div>
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter(statusFilter === 'Bloqueado' ? null : 'Bloqueado')}
              className={`flex items-center gap-4 bg-red-50 border rounded-xl p-5 transition-all focus:outline-none focus:ring-2 focus:ring-red-300 ${
                statusFilter === 'Bloqueado' ? 'border-red-500 ring-2 ring-red-200' : 'border-red-100'
              }`}
            >
              <ExclamationTriangleIcon className="h-8 w-8 text-red-600" />
              <div>
                <div className="text-2xl font-bold text-red-700">{totalBloqueado}</div>
                <div className="text-sm text-red-800 font-medium">Bloqueados</div>
              </div>
            </button>
          </div>

          {/* Search and Actions Bar */}
          <div className="mb-6 flex flex-col sm:flex-row gap-4 items-center justify-between">
            <div className="relative flex-1 max-w-md w-full">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                placeholder="Buscar por placa, modelo, marca, operação ou localização..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex gap-3">
              <div className="relative">
                <Button
                  variant="outline"
                  onClick={() => setShowFilterDropdown(!showFilterDropdown)}
                  className="inline-flex items-center px-4 py-2 text-sm font-medium"
                >
                  <FunnelIcon className="h-5 w-5 mr-2 text-gray-500" />
                  Filtrar
                </Button>
                {showFilterDropdown && (
                  <div className="absolute left-0 mt-2 w-64 bg-white rounded-md shadow-lg z-10">
                    <div className="py-1">
                      <div className="px-4 py-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Contrato</label>
                        {uniqueContratos.length > 1 ? (
                          <div className="relative">
                            <button
                              type="button"
                              onClick={() => {
                                setShowContratoDropdown(!showContratoDropdown);
                                setShowFilterDropdown(true);
                              }}
                              className="w-full px-3 py-2 text-left text-sm bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 flex items-center justify-between"
                            >
                              <span className="text-gray-700">
                                {contratoFilter.length === 0 
                                  ? 'Todos os Contratos' 
                                  : contratoFilter.length === 1 
                                    ? contratoFilter[0]
                                    : `${contratoFilter.length} contratos selecionados`}
                              </span>
                              <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            </button>
                            {showContratoDropdown && (
                              <>
                                <div 
                                  className="fixed inset-0 z-10" 
                                  onClick={() => {
                                    setShowContratoDropdown(false);
                                    setShowFilterDropdown(false);
                                  }}
                                />
                                <div className="absolute z-20 mt-1 w-full bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                                  <div className="p-2">
                                    <div className="flex items-center space-x-2 px-2 py-1.5 hover:bg-gray-50 rounded">
                                      <Checkbox
                                        id="contrato-all-vehicles"
                                        checked={contratoFilter.length === 0}
                                        onCheckedChange={(checked) => {
                                          if (checked) {
                                            setContratoFilter([]);
                                          }
                                        }}
                                      />
                                      <label 
                                        htmlFor="contrato-all-vehicles"
                                        className="text-sm font-medium text-gray-700 cursor-pointer flex-1"
                                      >
                                        Todos os Contratos
                                      </label>
                                    </div>
                                    {uniqueContratos.filter((c): c is string => Boolean(c)).map((contrato: string) => (
                                      <div key={contrato} className="flex items-center space-x-2 px-2 py-1.5 hover:bg-gray-50 rounded">
                                        <Checkbox
                                          id={`contrato-vehicles-${contrato}`}
                                          checked={contratoFilter.includes(contrato)}
                                          onCheckedChange={(checked) => {
                                            if (checked) {
                                              setContratoFilter([...contratoFilter, contrato]);
                                            } else {
                                              setContratoFilter(contratoFilter.filter(c => c !== contrato));
                                            }
                                          }}
                                        />
                                        <label 
                                          htmlFor={`contrato-vehicles-${contrato}`}
                                          className="text-sm text-gray-700 cursor-pointer flex-1"
                                        >
                                          {contrato}
                                        </label>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </>
                            )}
                          </div>
                        ) : (
                          <select
                            className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md whitespace-normal"
                            value={contratoFilter.length > 0 ? contratoFilter[0] : ''}
                            onChange={e => {
                              setContratoFilter(e.target.value ? [e.target.value] : []);
                              setShowFilterDropdown(false);
                            }}
                          >
                            <option value="">Todos os Contratos</option>
                            {uniqueContratos.map(contrato => (
                              <option key={contrato} value={contrato}>{contrato}</option>
                            ))}
                          </select>
                        )}
                      </div>

                    </div>
                  </div>
                )}
              </div>
              <div className="flex gap-3">
                <button
                  className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  onClick={handleExportExcel}
                  disabled={exportingExcel}
                >
                  <DocumentArrowDownIcon className="h-5 w-5 mr-2" />
                  {exportingExcel ? 'Gerando...' : 'Exportar Excel'}
                </button>
                <button
                  className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  onClick={() => router.push('/vehicles/create')}
                >
                  <PlusIcon className="h-5 w-5 mr-2" />
                  Adicionar Veículo
                </button>
                <Link href="/vehicles/transfer-history">
                  <button className="inline-flex items-center px-4 py-2 border border-blue-300 rounded-md shadow-sm text-sm font-medium text-blue-700 bg-white hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 mr-2">
                    <ArrowsRightLeftIcon className="h-5 w-5 mr-2" />
                    Transferências
                  </button>
                </Link>
                <Link href="/vehicles/devolved-dismobilized">
                  <button className="inline-flex items-center px-4 py-2 border border-orange-300 rounded-md shadow-sm text-sm font-medium text-orange-700 bg-white hover:bg-orange-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500">
                    <TruckIcon className="h-5 w-5 mr-2" />
                    Devolvidos/Desmobilizados
                  </button>
                </Link>
                <Link href="/vehicles/blocked">
                  <button className="inline-flex items-center px-4 py-2 border border-red-300 rounded-md shadow-sm text-sm font-medium text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500">
                    <ExclamationTriangleIcon className="h-5 w-5 mr-2" />
                    Bloqueados
                  </button>
                </Link>
              </div>
            </div>
          </div>

          {/* Vehicles List */}
          {isLoading ? (
            <div className="text-center py-10 text-gray-500">Carregando veículos...</div>
          ) : isError ? (
            <div className="text-center py-10 text-red-500">Erro ao carregar veículos.</div>
          ) : (
            <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-6 py-3 text-left font-semibold text-gray-700">Placa</th>
                    <th className="px-6 py-3 text-left font-semibold text-gray-700">Modelo</th>
                    <th className="px-6 py-3 text-left font-semibold text-gray-700">Operação</th>
                    <th className="px-6 py-3 text-left font-semibold text-gray-700">Equipe</th>
                    <th className="px-6 py-3 text-left font-semibold text-gray-700">Contrato</th>
                    <th className="px-6 py-3 text-left font-semibold text-gray-700">Status</th>
                    <th className="px-6 py-3 text-center font-semibold text-gray-700">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedVehicles.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-8 text-gray-400">Nenhum veículo encontrado</td>
                    </tr>
                  ) : (
                    paginatedVehicles.map((vehicle) => (
                      <tr key={vehicle.id} className="border-t border-gray-100 hover:bg-gray-50 transition">
                        <td className="px-6 py-3 font-medium text-gray-900 whitespace-nowrap">{vehicle.placa}</td>
                        <td className="px-6 py-3 text-gray-700 whitespace-nowrap">{vehicle.tipo_veiculo}</td>
                        <td className="px-6 py-3 text-gray-700 whitespace-nowrap">
                          {getTeamOperations(vehicle)}
                        </td>
                        <td className="px-6 py-3 text-gray-700">
                          {(() => {
                            const vehicleTeams = getVehicleTeams(vehicle.id);
                            if (vehicleTeams.length === 0) {
                              // Fallback para estrutura antiga
                              const allocatedTeam = teams.find(t => String(t.id) === String(vehicle.equipe_id));
                              return allocatedTeam ? allocatedTeam.nome : '-';
                            }
                            return (
                              <div className="flex flex-col gap-1">
                                {vehicleTeams.slice(0, 2).map((team) => (
                                  <span key={team.id} className="text-sm">
                                    {team.nome}
                                  </span>
                                ))}
                                {vehicleTeams.length > 2 && (
                                  <span className="text-xs text-gray-500">
                                    +{vehicleTeams.length - 2} mais
                                  </span>
                                )}
                              </div>
                            );
                          })()}
                        </td>
                        <td className="px-6 py-3 text-gray-700 whitespace-nowrap">
                          <div className="flex flex-col">
                            <span className="font-medium text-blue-600">{vehicle.contrato?.nome || '-'}</span>
                            {vehicle.contrato?.codigo && (
                              <span className="text-xs text-gray-500">{vehicle.contrato.codigo}</span>
                            )}
                            {vehicle.status?.toLowerCase() === 'bloqueado' && blockedVehiclesInfo[vehicle.id.toString()]?.origem_contrato && (
                              <span className="text-xs text-red-600 font-medium mt-1">
                                Origem: {blockedVehiclesInfo[vehicle.id.toString()].origem_contrato}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-3 text-gray-700 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${
                            getVehicleStatus(vehicle).color
                          }`}>
                            {getVehicleStatus(vehicle).label}
                          </span>
                        </td>
                        <td className="px-6 py-3 text-center whitespace-nowrap">
                          <div className="flex gap-2 justify-center">
                            <Link 
                              href={`/vehicles/${vehicle.id}`}
                              className="inline-flex items-center px-3 py-1.5 border border-gray-300 rounded-md text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                            >
                              Detalhes
                              <ChevronRightIcon className="ml-1 h-4 w-4" />
                            </Link>
                            <button
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-blue-600 text-white font-medium text-xs hover:bg-blue-700 border border-blue-700 transition-colors shadow-sm"
                              style={{ minHeight: 0, height: '32px' }}
                              title="Realocar equipe"
                              onClick={() => {
                                setShowReallocationModal(String(vehicle.id));
                                setTeamSearch('');
                              }}
                            >
                              <ArrowsRightLeftIcon className="h-4 w-4" />
                              Realocar Equipe
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              {/* Paginação */}
              <div className="bg-white px-4 py-2 flex flex-col sm:flex-row sm:items-center sm:justify-between border-t border-gray-200 gap-2">
                <div className="text-xs text-gray-600 mb-1 sm:mb-0">
                  Mostrando <span className="font-semibold">{startIndex + 1}</span> - <span className="font-semibold">{Math.min(startIndex + itemsPerPage, filteredVehicles.length)}</span> de <span className="font-semibold">{filteredVehicles.length}</span>
                </div>
                <div className="flex items-center gap-2">
                  <label htmlFor="itemsPerPage" className="text-xs text-gray-600">Itens por página:</label>
                  <select
                    id="itemsPerPage"
                    value={itemsPerPage}
                    onChange={(e) => setItemsPerPage(Number(e.target.value))}
                    className="block border-gray-300 rounded-md text-xs py-1 px-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                  <nav className="inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                      disabled={currentPage === 1}
                      className="relative inline-flex items-center px-2 py-1 rounded-l-md border border-gray-300 bg-white text-xs font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ChevronLeftIcon className="h-4 w-4" aria-hidden="true" />
                    </button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={`relative inline-flex items-center px-3 py-1 border text-xs font-medium ${
                          currentPage === page
                            ? 'z-10 bg-blue-50 border-blue-500 text-blue-600'
                            : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                        }`}
                      >
                        {page}
                      </button>
                    ))}
                    <button
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                      disabled={currentPage === totalPages}
                      className="relative inline-flex items-center px-2 py-1 rounded-r-md border border-gray-300 bg-white text-xs font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ChevronRightIcon className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </nav>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal de realocação de equipe */}
        {showReallocationModal && (
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="relative bg-white/80 backdrop-blur-xl shadow-2xl rounded-2xl max-w-md w-full p-8 border border-gray-200">
              <button
                type="button"
                onClick={() => {
                  setShowReallocationModal(null);
                  setSelectedTeam('');
                  setTeamSearch('');
                }}
                className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors text-xl font-bold focus:outline-none"
                aria-label="Fechar"
              >
                ×
              </button>

              {/* Header com informações do veículo */}
              {(() => {
                const vehicle = vehicles.find(v => String(v.id) === showReallocationModal);
                if (!vehicle) return null;
                const currentTeams = getVehicleTeams(showReallocationModal);
                return (
                  <div className="mb-6 flex flex-col items-center gap-2">
                    <div className="flex items-center gap-2 text-blue-700 text-lg font-semibold">
                      <TruckIcon className="h-6 w-6" />
                      {vehicle.placa}
                    </div>
                    <div className="text-gray-600 text-sm">
                      {vehicle.tipo_veiculo}
                    </div>
                    {currentTeams.length > 0 && (
                      <div className="flex flex-col gap-1 items-center text-sm text-gray-500">
                        <div className="flex items-center gap-2">
                          <WrenchScrewdriverIcon className="h-4 w-4" />
                          <span>Equipes associadas:</span>
                        </div>
                        <div className="flex flex-wrap gap-1 justify-center">
                          {currentTeams.map((team) => (
                            <span key={team.id} className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">
                              {team.nome}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              <div className="flex flex-col items-center mb-6">
                <div className="mb-4 flex items-center justify-center w-12 h-12 rounded-full bg-blue-100">
                  <ArrowsRightLeftIcon className="h-6 w-6 text-blue-600" />
                </div>
                <h3 className="text-2xl font-semibold text-gray-900 mb-2 text-center">Gerenciar Equipes</h3>
                <p className="text-gray-500 text-sm text-center">Adicione ou remova equipes deste veículo. Você pode associar múltiplas equipes.</p>
              </div>

              {/* Lista de equipes atuais */}
              {(() => {
                const currentTeams = getVehicleTeams(showReallocationModal);
                if (currentTeams.length === 0) return null;
                
                return (
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Equipes Atuais</label>
                    <div className="space-y-2 max-h-32 overflow-y-auto rounded-xl border border-gray-200 bg-white/90 shadow-sm">
                      {currentTeams.map((team) => (
                        <div key={team.id} className="flex items-center justify-between px-4 py-2 border-b border-gray-100 last:border-b-0">
                          <div className="flex flex-col">
                            <span className="font-medium text-sm">{team.nome}</span>
                            <span className="text-xs text-gray-500">{team.operacao}</span>
                          </div>
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                await teamService.removeVehicle(team.id, showReallocationModal);
                                await Promise.all([
                                  queryClient.invalidateQueries({ queryKey: ['vehicles'] }),
                                  queryClient.invalidateQueries({ queryKey: ['teams'] })
                                ]);
                                showToast('success', 'Equipe removida com sucesso!');
                              } catch (error) {
                                console.error('Erro ao remover equipe:', error);
                                showToast('error', 'Erro ao remover equipe. Tente novamente.');
                              }
                            }}
                            className="text-red-600 hover:text-red-700 text-xs font-medium"
                          >
                            Remover
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              <form onSubmit={handleReallocation} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Buscar Equipe</label>
                  <div className="relative">
                    <input
                      ref={inputRef}
                      type="text"
                      value={teamSearch}
                      onChange={(e) => setTeamSearch(e.target.value)}
                      placeholder="Digite para buscar uma equipe..."
                      className="block w-full rounded-xl border border-gray-300 bg-white/70 py-3 px-4 text-gray-700 shadow-sm focus:border-blue-400 focus:ring-2 focus:ring-blue-400 transition"
                    />
                    <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                      <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
                    </div>
                  </div>
                </div>

                {/* Lista de equipes filtradas */}
                {teamSearch && (
                  <div className="mt-2 max-h-48 overflow-y-auto rounded-xl border border-gray-200 bg-white/90 shadow-lg">
                    {isLoadingTeams ? (
                      <div className="px-4 py-2 text-gray-500 text-sm">Carregando equipes...</div>
                    ) : filteredTeams.length > 0 ? (
                      filteredTeams.map((team: Team) => {
                        const currentTeams = getVehicleTeams(showReallocationModal);
                        const alreadyAssigned = currentTeams.some(t => String(t.id) === String(team.id));
                        
                        return (
                          <button
                            key={team.id}
                            type="button"
                            onClick={() => {
                              setSelectedTeam(team.id);
                              setTeamSearch(team.nome);
                            }}
                            disabled={alreadyAssigned}
                            className={`w-full px-4 py-3 text-left text-sm flex flex-col gap-1 hover:bg-blue-50 focus:outline-none transition ${
                              String(selectedTeam) === String(team.id) ? 'bg-blue-100 font-medium' : ''
                            } ${alreadyAssigned ? 'opacity-50 cursor-not-allowed' : ''}`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex flex-col gap-1">
                                <span className="font-medium">
                                  {team.nome}
                                  {alreadyAssigned && (
                                    <span className="ml-2 text-xs text-green-600">(Já associada)</span>
                                  )}
                                </span>
                                <span className="text-xs text-gray-500">{team.operacao}</span>
                              </div>
                              {String(selectedTeam) === String(team.id) && (
                                <CheckCircleIcon className="h-5 w-5 text-blue-600" />
                              )}
                              {alreadyAssigned && (
                                <CheckCircleIcon className="h-5 w-5 text-green-600" />
                              )}
                            </div>
                          </button>
                        );
                      })
                    ) : (
                      <div className="px-4 py-2 text-gray-500 text-sm">Nenhuma equipe encontrada</div>
                    )}
                  </div>
                )}

                {/* Mensagem informativa */}
                {selectedTeam !== '' && (() => {
                  const selectedTeamData = teams.find(t => String(t.id) === String(selectedTeam));
                  const currentVehicle = vehicles.find((v: Vehicle) => String(v.id) === showReallocationModal);
                  if (!selectedTeamData || !currentVehicle) return null;
                  
                  return (
                    <div className="mt-4 p-4 bg-blue-50 rounded-xl border border-blue-200">
                      <div className="flex items-start gap-3">
                        <CheckCircleIcon className="h-5 w-5 text-blue-500 mt-0.5" />
                        <div className="flex-1">
                          <h4 className="text-sm font-medium text-blue-800 mb-1">Adicionar Equipe</h4>
                          <p className="text-sm text-blue-700">
                            A equipe <strong>{selectedTeamData.nome}</strong> será associada ao veículo {currentVehicle.placa}.
                            Você pode associar múltiplas equipes ao mesmo veículo.
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowReallocationModal(null);
                      setSelectedTeam('');
                      setTeamSearch('');
                    }}
                    className="px-5 py-2.5 rounded-full text-sm font-medium text-gray-700 bg-white/80 border border-gray-300 hover:bg-gray-100 transition focus:outline-none focus:ring-2 focus:ring-blue-400"
                  >
                    Cancelar
                  </button>
                  {(() => {
                    const currentTeams = getVehicleTeams(showReallocationModal);
                    const hasTeams = currentTeams.length > 0;
                    
                    if (hasTeams && selectedTeam === '') {
                      return (
                        <button
                          type="submit"
                          disabled={reallocating === showReallocationModal}
                          className="px-6 py-2.5 rounded-full text-sm font-semibold text-white bg-red-600 hover:bg-red-700 shadow-md transition focus:outline-none focus:ring-2 focus:ring-red-400 disabled:opacity-60"
                        >
                          {reallocating === showReallocationModal ? (
                            <span className="flex items-center gap-2">
                              <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              Removendo...
                            </span>
                          ) : (
                            'Remover Todas as Equipes'
                          )}
                        </button>
                      );
                    }
                    return (
                      <button
                        type="submit"
                        disabled={reallocating === showReallocationModal || selectedTeam === ''}
                        className="px-6 py-2.5 rounded-full text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 shadow-md transition focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-60"
                      >
                        {reallocating === showReallocationModal ? (
                          <span className="flex items-center gap-2">
                            <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Adicionando...
                          </span>
                        ) : (
                          'Adicionar Equipe'
                        )}
                      </button>
                    );
                  })()}
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Feedback de sucesso */}
        {showSuccess && (
          <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg text-sm font-medium animate-fade-in">
            Equipe realocada com sucesso!
          </div>
        )}
      </div>
    </div>
  );
}
