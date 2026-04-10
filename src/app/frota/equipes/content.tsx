'use client';
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { CheckCircleIcon, ExclamationTriangleIcon, MagnifyingGlassIcon, FunnelIcon, EyeIcon, ArrowUpTrayIcon, TruckIcon, PlusIcon } from '@heroicons/react/24/outline';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { teamService } from '@/services/teamService';
import { vehicleService } from '@/services/vehicleService';
import { OperacoesAtividadesService } from '@/services/operacoesAtividadesService';
import { SetoresService } from '@/services/setoresService';
import { useAuth } from '@/contexts/AuthContext';
import { Team } from '@/types/team';
import type { Vehicle } from '@/types';
import { OperacaoPadrao } from '@/types/operacoes-atividades';
import { SetorPadrao } from '@/types/setores';
// import { Location } from '@/types'; // TODO: Implement location-based filtering
import { PERMISSION_CODES, useModularPermissions } from '@/hooks/useModularPermissions';


interface Contract {
  id: string;
  nome: string;
  codigo: string;
}

// Shadcn/ui components
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
// import { Alert, AlertDescription } from '@/components/ui/alert'; // TODO: Implement alert messages

const motivosPadrao = ['Manutenção programada', 'Falta de motorista', 'Outro'];

// Sistema de toast simples
const showToast = (type: 'success' | 'error', message: string) => {
  // Criar elemento de toast
  const toast = document.createElement('div');
  toast.className = `fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg transition-all duration-300 transform translate-x-full ${type === 'success'
      ? 'bg-green-500 text-white'
      : 'bg-red-500 text-white'
    }`;
  toast.textContent = message;

  // Adicionar ao DOM
  document.body.appendChild(toast);

  // Animar entrada
  setTimeout(() => {
    toast.classList.remove('translate-x-full');
  }, 100);

  // Remover após 3 segundos
  setTimeout(() => {
    toast.classList.add('translate-x-full');
    setTimeout(() => {
      if (document.body.contains(toast)) {
        document.body.removeChild(toast);
      }
    }, 300);
  }, 3000);
};

export function FrotaEquipesContent() {
  // Contexto de autenticação
  const { userContratoIds } = useAuth();
  const { hasPermission } = useModularPermissions();


  // const userLocationIds = []; // TODO: Implement location-based filtering
  const queryClient = useQueryClient();

  // Carregar equipes e veículos
  const { data: teams, isLoading: loadingTeams, isError: errorTeams } = useQuery<Team[]>({
    queryKey: ['teams'],
    queryFn: teamService.getTeams,
    retry: 3,
    retryDelay: 1000,
  });
  const { data: vehicles, isLoading: loadingVehicles, isError: errorVehicles } = useQuery<Vehicle[]>({
    queryKey: ['vehicles', userContratoIds],
    queryFn: () => vehicleService.getAll(undefined, userContratoIds),
    retry: 3,
    retryDelay: 1000,
  });

  // Garantir que teams e vehicles sejam sempre arrays (usando useMemo para evitar warnings)
  const safeTeams = useMemo(() => Array.isArray(teams) ? teams : [], [teams]);
  const safeVehicles = Array.isArray(vehicles) ? vehicles : [];

  // Buscar contratos
  const { data: contratos, isLoading: loadingContratos, isError: errorContratos } = useQuery<Contract[]>({
    queryKey: ['contracts'],
    queryFn: async () => {
      const res = await fetch('/api/admin/contracts');
      if (!res.ok) {
        throw new Error('Failed to fetch contracts');
      }
      const data = await res.json();
      return data.contracts || [];
    },
    retry: 3,
    retryDelay: 1000,
  });

  // Garantir que contratos seja sempre um array
  const safeContratos = Array.isArray(contratos) ? contratos : [];

  // Estados
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'operando' | 'parada'>('all');
  const [contratoFilter, setContratoFilter] = useState<string>('all');
  const [expandedParada, setExpandedParada] = useState<string | null>(null);
  const [teamVehiclesMap, setTeamVehiclesMap] = useState<Record<string, Vehicle[]>>({});
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [selectedContratoId, setSelectedContratoId] = useState<string>('');
  const [selectedOperacaoPadrao, setSelectedOperacaoPadrao] = useState<string>('');
  const [operacoesPadrao, setOperacoesPadrao] = useState<OperacaoPadrao[]>([]);
  const [showVehicleAllocationModal, setShowVehicleAllocationModal] = useState<Team | null>(null);
  const [vehicleSearchTerm, setVehicleSearchTerm] = useState('');
  const [showCreateTeamModal, setShowCreateTeamModal] = useState(false);
  const [newTeamForm, setNewTeamForm] = useState({
    nome: '',
    contrato_id: '',
    operacao_id: '',
    prefixo: '',
    tipo: 'fixa' as 'fixa' | 'aberta',
    capacidade_maxima: 10,
  });

  // Estados para operações do modal de criação
  const [operacoesCreateModal, setOperacoesCreateModal] = useState<OperacaoPadrao[]>([]);

  // Estados para modal de edição
  const [showEditModal, setShowEditModal] = useState<Team | null>(null);
  const [editFormData, setEditFormData] = useState({
    nome: '',
    operacao: '',
    operacao_id: '',
    encarregado_id: '',
    setor: '',
    prefixo: '',
    contrato_id: '',
    status: 'active' as 'active' | 'parada',
    motivoParada: ''
  });
  const [operacoesEditModal, setOperacoesEditModal] = useState<OperacaoPadrao[]>([]);
  const [funcionarios, setFuncionarios] = useState<Array<{ id: string; nome: string; matricula: string; status: string }>>([]);
  const [setoresDisponiveis, setSetoresDisponiveis] = useState<SetorPadrao[]>([]);
  const [operacaoSelecionada, setOperacaoSelecionada] = useState<OperacaoPadrao | null>(null);
  const [encarregadoSearch, setEncarregadoSearch] = useState('');
  const [showEncarregadoDropdown, setShowEncarregadoDropdown] = useState(false);

  // Carregar operações quando contrato for selecionado (modal de upload)
  useEffect(() => {
    const loadOperacoes = async () => {
      if (!selectedContratoId) {
        setOperacoesPadrao([]);
        return;
      }

      try {
        const ops = await OperacoesAtividadesService.getOperacoes({
          ativo: true,
          contratoId: selectedContratoId
        });
        setOperacoesPadrao(ops);
      } catch (error) {
        console.error('Erro ao carregar operações:', error);
        setOperacoesPadrao([]);
      }
    };

    loadOperacoes();
  }, [selectedContratoId]);

  // Carregar operações quando contrato for selecionado (modal de criação)
  useEffect(() => {
    const loadOperacoes = async () => {
      if (!newTeamForm.contrato_id) {
        setOperacoesCreateModal([]);
        return;
      }

      try {
        const ops = await OperacoesAtividadesService.getOperacoes({
          ativo: true,
          contratoId: newTeamForm.contrato_id
        });
        setOperacoesCreateModal(ops);
      } catch (error) {
        console.error('Erro ao carregar operações:', error);
        setOperacoesCreateModal([]);
      }
    };

    loadOperacoes();
  }, [newTeamForm.contrato_id]);

  // Carregar funcionários para o modal de edição
  useEffect(() => {
    const loadFuncionarios = async () => {
      try {
        const response = await fetch('/api/users');
        if (response.ok) {
          const data = await response.json();
          const funcionariosList = data.usuarios || data.users || [];
          
          // Remover duplicados por ID
          const uniqueFuncionarios = funcionariosList.filter((funcionario: { id: string }, index: number, self: Array<{ id: string }>) => 
            index === self.findIndex((f: { id: string }) => f.id === funcionario.id)
          );
          
          setFuncionarios(uniqueFuncionarios);
        }
      } catch (error) {
        console.error('Erro ao carregar funcionários:', error);
      }
    };

    loadFuncionarios();
  }, []);

  // Carregar operações quando contrato mudar (modal de edição)
  useEffect(() => {
    const loadOperacoes = async () => {
      if (!editFormData.contrato_id) {
        setOperacoesEditModal([]);
        return;
      }

      try {
        const ops = await OperacoesAtividadesService.getOperacoes({
          ativo: true,
          contratoId: editFormData.contrato_id
        });
        setOperacoesEditModal(ops);
      } catch (error) {
        console.error('Erro ao carregar operações:', error);
        setOperacoesEditModal([]);
      }
    };

    loadOperacoes();
  }, [editFormData.contrato_id]);

  // Atualizar operação selecionada quando operacao_id mudar (modal de edição)
  useEffect(() => {
    if (editFormData.operacao_id) {
      const op = operacoesEditModal.find(o => o.id === editFormData.operacao_id);
      setOperacaoSelecionada(op || null);
    } else {
      setOperacaoSelecionada(null);
    }
  }, [editFormData.operacao_id, operacoesEditModal]);

  // Carregar setores quando operação mudar (modal de edição)
  useEffect(() => {
    const loadSetores = async () => {
      if (!editFormData.operacao_id) {
        setSetoresDisponiveis([]);
        return;
      }

      try {
        const setores = await SetoresService.getSetoresDaOperacao(editFormData.operacao_id);
        setSetoresDisponiveis(setores);
      } catch (error) {
        console.error('Erro ao carregar setores:', error);
        setSetoresDisponiveis([]);
      }
    };

    loadSetores();
  }, [editFormData.operacao_id]);

  // Preencher formulário quando equipe for selecionada para edição
  useEffect(() => {
    if (showEditModal) {
      const formDataToSet = {
        nome: showEditModal.nome || '',
        operacao: showEditModal.operacao || '',
        operacao_id: showEditModal.operacao_id || '',
        encarregado_id: showEditModal.encarregado_id || '',
        setor: showEditModal.setor || '',
        prefixo: (showEditModal as Team & { prefixo?: string }).prefixo || '',
        contrato_id: showEditModal.contrato_id ? String(showEditModal.contrato_id) : '',
        status: showEditModal.status || 'active',
        motivoParada: showEditModal.motivoParada || ''
      };
      
      setEditFormData(formDataToSet);
      
      // Se tem encarregado, buscar o nome
      if (showEditModal.encarregado_id && (showEditModal as Team & { encarregado?: { nome: string; matricula: string } }).encarregado) {
        const nomeEncarregado = `${(showEditModal as Team & { encarregado: { nome: string; matricula: string } }).encarregado.nome} - ${(showEditModal as Team & { encarregado: { nome: string; matricula: string } }).encarregado.matricula}`;
        setEncarregadoSearch(nomeEncarregado);
      } else {
        setEncarregadoSearch('');
      }
    }
  }, [showEditModal]);

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('#encarregado-edit') && !target.closest('.encarregado-dropdown')) {
        setShowEncarregadoDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Estado para modal de parada de equipe
  const [modalPararEquipe, setModalPararEquipe] = useState<{
    teamId: string;
    motivo: string;
    outro: string;
  } | null>(null);
  const openPararEquipeModal = (teamId: string) => setModalPararEquipe({ teamId, motivo: '', outro: '' });

  // Estado para modal de realocação
  const [modalRealocacao, setModalRealocacao] = useState<{
    vehicleId: string;
    currentTeamId: string;
    vehiclePlaca: string;
    targetTeamId: string;
  } | null>(null);

  // Mutations
  const allocateVehicleMutation = useMutation({
    mutationFn: ({ teamId, vehicleId }: { teamId: string; vehicleId: string }) =>
      teamService.assignVehicle(teamId, vehicleId),
    onSuccess: async () => {
      // Invalidar todas as queries relacionadas para garantir atualização
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      queryClient.invalidateQueries({ queryKey: ['allocation-logs'] });
      
      // Recarregar veículos das equipes para atualizar a UI
      await loadTeamVehicles();
      
      setShowVehicleAllocationModal(null);
      setVehicleSearchTerm('');
      showToast('success', 'Veículo alocado com sucesso!');
    },
    onError: (error) => {
      console.error('Erro ao alocar veículo:', error);
      showToast('error', 'Erro ao alocar veículo. Tente novamente.');
    }
  });

  const removeVehicleMutation = useMutation({
    mutationFn: ({ teamId, vehicleId }: { teamId: string; vehicleId: string }) =>
      teamService.removeVehicle(teamId, vehicleId),
    onSuccess: async () => {
      // Invalidar todas as queries relacionadas para garantir atualização
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      queryClient.invalidateQueries({ queryKey: ['allocation-logs'] });
      
      // Recarregar veículos das equipes para atualizar a UI
      await loadTeamVehicles();
      
      showToast('success', 'Veículo removido com sucesso!');
    },
    onError: (error) => {
      console.error('Erro ao remover veículo:', error);
      showToast('error', 'Erro ao remover veículo. Tente novamente.');
    }
  });

  const realocateVehicleMutation = useMutation({
    mutationFn: ({ vehicleId, targetTeamId }: { vehicleId: string; targetTeamId: string }) =>
      teamService.assignVehicle(targetTeamId, vehicleId),
    onSuccess: async () => {
      // Invalidar todas as queries relacionadas para garantir atualização
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      queryClient.invalidateQueries({ queryKey: ['allocation-logs'] });
      
      // Recarregar veículos das equipes para atualizar a UI
      await loadTeamVehicles();
      
      setModalRealocacao(null);
      showToast('success', 'Veículo realocado com sucesso!');
    },
    onError: (error) => {
      console.error('Erro ao realocar veículo:', error);
      showToast('error', 'Erro ao realocar veículo. Tente novamente.');
    }
  });

  const createTeamMutation = useMutation({
    mutationFn: (teamData: Omit<Team, 'id' | 'criado_em' | 'atualizado_em'>) =>
      teamService.create(teamData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      setShowCreateTeamModal(false);
      setNewTeamForm({
        nome: '',
        contrato_id: '',
        operacao_id: '',
        prefixo: '',
        tipo: 'fixa',
        capacidade_maxima: 10,
      });
      showToast('success', 'Equipe criada com sucesso!');
    },
    onError: (error: Error) => {
      console.error('Erro ao criar equipe:', error);
      showToast('error', error.message || 'Erro ao criar equipe. Tente novamente.');
    }
  });

  const updateTeamMutation = useMutation({
    mutationFn: ({ teamId, data }: { teamId: string; data: Partial<Team> }) =>
      teamService.update(teamId, data),
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      await loadTeamVehicles();
      setShowEditModal(null);
      showToast('success', 'Equipe atualizada com sucesso!');
    },
    onError: (error: Error) => {
      console.error('Erro ao atualizar equipe:', error);
      showToast('error', error.message || 'Erro ao atualizar equipe. Tente novamente.');
    }
  });

  // Filtrar contratos que o usuário tem acesso
  const { user } = useAuth();
  const isAdmin = user?.nivel_acesso === 'admin' || user?.nivel_acesso === 'diretor';
  const contratosPermitidos = safeContratos.filter(contrato =>
    isAdmin || (userContratoIds && userContratoIds.includes(String(contrato.id)))
  );

  // Filtrar equipes conforme busca, status e contrato
  const filteredTeams = safeTeams.filter(team => {
    const matchesSearch =
      team.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (team.prefixo && team.prefixo.toLowerCase().includes(searchTerm.toLowerCase())) ||
      team.operacao.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || team.status === statusFilter;

    // Filtro de contrato
    let matchesContrato = true;
    if (contratoFilter !== 'all') {
      matchesContrato = String(team.contrato_id) === contratoFilter;
    } else {
      // Se "Todos", ainda filtrar por acesso do usuário
      if (!isAdmin && team.contrato_id) {
        matchesContrato = userContratoIds?.includes(String(team.contrato_id)) || false;
      }
    }

    // Apenas mostrar equipes que o usuário tem acesso (por contrato)
    const hasAccess = isAdmin ||
      !team.contrato_id ||
      (userContratoIds && userContratoIds.includes(String(team.contrato_id)));

    return matchesSearch && matchesStatus && matchesContrato && hasAccess;
  });

  // Calcular totais
  const totalOperando = safeTeams.filter(team => team.status === 'active').length;
  const totalParada = safeTeams.filter(team => team.status === 'parada').length;

  // Função utilitária para traduzir e colorir status da equipe
  function getEquipeStatusBadge(status: string) {
    switch (status) {
      case 'operando':
        return { label: 'Operando', variant: 'default' as const };
      case 'parada':
        return { label: 'Parada', variant: 'destructive' as const };
      case 'active':
        return { label: 'Ativa', variant: 'default' as const };
      case 'inactive':
        return { label: 'Inativa', variant: 'secondary' as const };
      default:
        return { label: status, variant: 'outline' as const };
    }
  }

  // Filtrar contratos do usuário (para uso futuro)
  // const userContratos = safeContratos.filter(contrato => {
  //   return userContratoIds.includes(String(contrato.id));
  // });

  // Função para carregar veículos por equipe (many-to-many) - OTIMIZADO COM PROMISE.ALL
  const loadTeamVehicles = useCallback(async () => {
    const newMap: Record<string, Vehicle[]> = {};
    
    // Fazer todas as requisições em paralelo ao invés de sequencial
    const promises = safeTeams.map(async (team) => {
      try {
        const vehicles = await teamService.getVehiclesByTeam(team.id);
        return { teamId: team.id, vehicles };
      } catch (error) {
        console.error(`Erro ao carregar veículos da equipe ${team.id}:`, error);
        return { teamId: team.id, vehicles: [] };
      }
    });

    // Aguardar todas as requisições completarem
    const results = await Promise.all(promises);
    
    // Construir o mapa com os resultados
    results.forEach(({ teamId, vehicles }) => {
      newMap[teamId] = vehicles;
    });
    
    setTeamVehiclesMap(newMap);
  }, [safeTeams]);

  // Carregar veículos quando as equipes mudarem
  useEffect(() => {
    if (safeTeams.length > 0) {
      loadTeamVehicles();
    }
  }, [safeTeams, loadTeamVehicles]);

  // Função para obter veículos de uma equipe (many-to-many)
  const getTeamVehicles = (teamId: string) => {
    return teamVehiclesMap[teamId] || [];
  };

  // Função para obter veículos disponíveis para alocação
  const getAvailableVehicles = (contratoId: string | null, currentTeamId?: string) => {
    if (!contratoId) return [];

    // Pegar todos os veículos já alocados (em qualquer equipe)
    const allAllocatedVehicleIds = new Set(
      Object.values(teamVehiclesMap).flat().map((v: Vehicle) => String(v.id))
    );

    return safeVehicles.filter(vehicle => {
      // Veículos já alocados não aparecem (exceto se for para adicionar à mesma equipe)
      const isAllocated = allAllocatedVehicleIds.has(String(vehicle.id));
      if (isAllocated && currentTeamId) {
        // Se já está alocado à mesma equipe, não mostrar novamente
        const teamVehicles = getTeamVehicles(currentTeamId);
        const alreadyInTeam = teamVehicles.some((v: Vehicle) => String(v.id) === String(vehicle.id));
        if (alreadyInTeam) return false;
      }

      // Importar constantes no topo do arquivo
      const unavailableStatuses = ['manutenção', 'bloqueado', 'devolvido', 'desmobilizado'];
      
      return (
        String(vehicle.contrato_id) === contratoId && // Por contrato
        !unavailableStatuses.includes(vehicle.status || '') && // Excluir status indisponíveis
        (!isAllocated || currentTeamId) // Se está alocado, só mostrar se for para adicionar à mesma equipe
      );
    });
  };

  // Função para obter equipes disponíveis para realocação (excluindo a atual) - TODO: Implement vehicle reallocation
  // const getAvailableTeamsForRealocation = (currentTeamId: string, vehicleContratoId: string | null) => {
  //   if (!vehicleContratoId) return [];
  //   return safeTeams.filter(team => 
  //     team.id !== currentTeamId && // Não é a equipe atual
  //     String(team.contrato_id) === vehicleContratoId && // Mesmo contrato do veículo
  //     team.status === 'operando' && // Equipe está operando
  //     getTeamVehicles(team.id).length === 0 // Equipe não tem veículo
  //   );
  // };

  // Handlers
  const handleAllocateVehicle = (teamId: string, vehicleId: string) => {
    // Validar: uma equipe só pode ter um veículo
    const currentVehicles = getTeamVehicles(teamId);
    if (currentVehicles.length >= 1) {
      showToast('error', 'Esta equipe já possui um veículo alocado. Remova o veículo atual antes de alocar outro.');
      return;
    }
    
    allocateVehicleMutation.mutate({ teamId, vehicleId });
  };

  const handleRemoveVehicle = (teamId: string, vehicleId: string) => {
    removeVehicleMutation.mutate({ teamId, vehicleId });
  };

  // const handleRealocateVehicle = () => { // TODO: Implement vehicle reallocation
  //   if (!modalRealocacao?.targetTeamId) return;
  //   
  //   realocateVehicleMutation.mutate({
  //     vehicleId: modalRealocacao.vehicleId,
  //     targetTeamId: modalRealocacao.targetTeamId
  //   });
  // };

  const handleCloseVehicleAllocationModal = () => {
    setShowVehicleAllocationModal(null);
    setVehicleSearchTerm('');
  };

  const handleConfirmPararEquipe = () => {
    // TODO: Implementar lógica para parar equipe
    setModalPararEquipe(null);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!showEditModal) return;

    const updateData: Partial<Team> & { motivoParada?: string } = {
      nome: editFormData.nome,
      operacao_id: editFormData.operacao_id || undefined,
      encarregado_id: editFormData.encarregado_id || null,
      setor: editFormData.setor || undefined,
      prefixo: editFormData.prefixo || undefined,
      contrato_id: editFormData.contrato_id || undefined,
      status: editFormData.status,
      motivoParada: editFormData.status === 'parada' ? editFormData.motivoParada : undefined
    };

    updateTeamMutation.mutate({ teamId: showEditModal.id, data: updateData });
  };

  // Filtrar funcionários ativos por busca
  const funcionariosFiltrados = funcionarios
    .filter(f => f.status === 'ativo')
    .filter(f => {
      if (!encarregadoSearch) return true;
      const search = encarregadoSearch.toLowerCase();
      return (
        f.nome?.toLowerCase().includes(search) ||
        f.matricula?.toLowerCase().includes(search)
      );
    });

  // Upload em massa
  const handleBulkUpload = async () => {
    if (!uploadFile || !selectedContratoId || !selectedOperacaoPadrao) return;

    console.log('📤 Iniciando upload em massa:');
    console.log('   - Arquivo:', uploadFile.name);
    console.log('   - Contrato ID:', selectedContratoId);
    console.log('   - Operação ID:', selectedOperacaoPadrao);

    setUploading(true);
    const formData = new FormData();
    formData.append('file', uploadFile);
    formData.append('contratoId', selectedContratoId);
    formData.append('operacaoPadrao', selectedOperacaoPadrao);

    try {
      const response = await fetch('/api/teams/bulk-upload', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const result = await response.json();
        console.log('✅ Upload concluído:', result);
        queryClient.invalidateQueries({ queryKey: ['teams'] });
        setShowBulkUpload(false);
        setUploadFile(null);
        setSelectedContratoId('');
        setSelectedOperacaoPadrao('');
        alert(result.message || 'Upload realizado com sucesso!');
      } else {
        const error = await response.json();
        console.error('❌ Erro no upload:', error);

        let errorMessage = error.error || error.message || 'Erro desconhecido';

        // Adicionar detalhes se houver
        if (error.detalhes) {
          errorMessage += '\n\n' + error.detalhes;
        }

        if (error.linhas && error.linhas.length > 0) {
          errorMessage += '\n\nLinhas com problema: ' + error.linhas.join(', ');
        }

        alert(`Erro no upload:\n${errorMessage}`);
      }
    } catch (error) {
      console.error('Erro no upload:', error);
      alert('Erro ao fazer upload. Tente novamente.');
    } finally {
      setUploading(false);
    }
  };

  // Mostrar loading se alguma query estiver carregando
  if (loadingTeams || loadingVehicles || loadingContratos) {
    return (
      <div className="bg-gray-50 flex items-center justify-center py-20">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Carregando dados...</p>
        </div>
      </div>
    );
  }

  // Mostrar erro se alguma query falhou
  if (errorTeams || errorVehicles || errorContratos) {
    return (
      <div className="bg-gray-50 flex items-center justify-center py-20">
        <div className="text-center max-w-md">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Erro ao carregar dados</h2>
          <p className="text-gray-600 mb-4">Ocorreu um erro ao carregar as informações. Tente recarregar a página.</p>
          <Button onClick={() => window.location.reload()}>Recarregar</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-50">
      <div className="max-w-7xl mx-auto py-2 sm:px-6 lg:px-8">
        <div className="px-4 py-2 sm:px-0">
          {/* Header */}
          <div className="mb-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Gestão de Equipes - Frota</h1>
                <p className="text-gray-600 mt-1">Gerencie equipes e aloque veículos para operações</p>
              </div>
              <div className="flex gap-3">
                {hasPermission(PERMISSION_CODES.EQUIPES.CRIAR_EQUIPE) && (
                  <Button
                    onClick={() => setShowCreateTeamModal(true)}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <PlusIcon className="h-4 w-4 mr-2" />
                    Nova Equipe
                  </Button>
                )}
                <Button
                  onClick={() => setShowBulkUpload(true)}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <ArrowUpTrayIcon className="h-4 w-4 mr-2" />
                  Upload em Massa
                </Button>
                <Button asChild>
                  <Link href="/frota/equipes/historico">
                    📊 Histórico
                  </Link>
                </Button>
              </div>
            </div>
          </div>

          {/* Estatísticas */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-4">
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total de Equipes</p>
                  <p className="text-2xl font-semibold text-gray-900 mt-1">{safeTeams.length}</p>
                </div>
                <div className="p-3 rounded-lg bg-blue-500">
                  <TruckIcon className="h-6 w-6 text-white" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Em Operação</p>
                  <p className="text-2xl font-semibold text-green-600 mt-1">{totalOperando}</p>
                </div>
                <div className="p-3 rounded-lg bg-green-500">
                  <CheckCircleIcon className="h-6 w-6 text-white" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Paradas</p>
                  <p className="text-2xl font-semibold text-red-600 mt-1">{totalParada}</p>
                </div>
                <div className="p-3 rounded-lg bg-red-500">
                  <ExclamationTriangleIcon className="h-6 w-6 text-white" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Taxa Operacional</p>
                  <p className="text-2xl font-semibold text-gray-900 mt-1">
                    {safeTeams.length > 0 ? Math.round((totalOperando / safeTeams.length) * 100) : 0}%
                  </p>
                  <p className="text-sm text-blue-600 mt-2">Eficiência operacional</p>
                </div>
                <div className="p-3 rounded-lg bg-purple-500">
                  <CheckCircleIcon className="h-6 w-6 text-white" />
                </div>
              </div>
            </div>
          </div>

          {/* Filtros */}
          <div className="mb-6 flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <MagnifyingGlassIcon className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por equipe, prefixo ou operação..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={(value: 'all' | 'operando' | 'parada') => setStatusFilter(value)}>
              <SelectTrigger className="w-[180px]">
                <FunnelIcon className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filtrar por status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="operando">Em operação</SelectItem>
                <SelectItem value="parada">Parada</SelectItem>
              </SelectContent>
            </Select>
            <Select value={contratoFilter} onValueChange={setContratoFilter}>
              <SelectTrigger className="w-[200px]">
                <FunnelIcon className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filtrar por contrato" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Contratos</SelectItem>
                {contratosPermitidos.map(contrato => (
                  <SelectItem key={contrato.id} value={contrato.id}>
                    {contrato.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Tabela */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Equipe</TableHead>
                  <TableHead>Turno Ativo</TableHead>
                  <TableHead>Operação</TableHead>
                  <TableHead>Contrato</TableHead>
                  <TableHead>Veículo</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Última Atualização</TableHead>
                  <TableHead className="text-center">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTeams.map((team) => {
                  const contrato = safeContratos.find(c => String(c.id) === String(team.contrato_id));
                  const isParada = team.status === 'parada';
                  const isExpanded = expandedParada === team.id;
                  const statusBadge = getEquipeStatusBadge(team.status);
                  const teamVehicles = getTeamVehicles(team.id);

                  return (
                    <React.Fragment key={team.id}>
                      <TableRow>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <span>{team.prefixo || team.nome || '-'}</span>
                            {isParada && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setExpandedParada(isExpanded ? null : team.id)}
                              >
                                <EyeIcon className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {team.turno_ativo ? (
                            <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                              Turno {team.turno_ativo}
                            </Badge>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </TableCell>
                        <TableCell>{team.operacao || '-'}</TableCell>
                        <TableCell>{contrato ? contrato.nome : '-'}</TableCell>
                        <TableCell>
                          {teamVehicles.length > 0 ? (
                            <div className="flex flex-col gap-1">
                              {teamVehicles.slice(0, 2).map((vehicle: Vehicle) => (
                                <div key={vehicle.id} className="flex items-center gap-2">
                                  <TruckIcon className="h-4 w-4 text-blue-500" />
                                  <span className="font-medium">{vehicle.placa}</span>
                                </div>
                              ))}
                              {teamVehicles.length > 2 && (
                                <span className="text-xs text-gray-500">
                                  +{teamVehicles.length - 2} mais
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-gray-400">Sem veículo</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {teamVehicles.length > 0 ? (
                            <span className="text-sm">
                              {teamVehicles.length === 1
                                ? teamVehicles[0].tipo_modelo
                                : `${teamVehicles.length} veículos`}
                            </span>
                          ) : '-'}
                        </TableCell>
                        <TableCell>
                          <Badge variant={statusBadge.variant}>
                            {statusBadge.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {team.atualizado_em ? new Date(team.atualizado_em).toLocaleDateString() : '-'}
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex gap-2 justify-center">
                            {hasPermission(PERMISSION_CODES.EQUIPES.GERENCIAR_VEICULOS_EQUIPE) && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setShowVehicleAllocationModal(team)}
                              >
                                <TruckIcon className="h-4 w-4 mr-1" />
                                Veículos
                              </Button>
                            )}
                            {hasPermission(PERMISSION_CODES.EQUIPES.EDITAR_EQUIPE) && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setShowEditModal(team)}
                              >
                                Editar
                              </Button>
                            )}
                            {!isParada && hasPermission(PERMISSION_CODES.EQUIPES.PARAR_EQUIPE) && (
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => openPararEquipeModal(team.id)}
                              >
                                Parar
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                      {isParada && isExpanded && (
                        <TableRow>
                          <TableCell colSpan={9} className="bg-red-50 border-l-4 border-red-400">
                            <div className="p-4">
                              <strong>Motivo da parada:</strong> {team.motivoParada}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Modal de Alocação de Veículos */}
          <Dialog open={!!showVehicleAllocationModal} onOpenChange={handleCloseVehicleAllocationModal}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Alocar Veículo - {showVehicleAllocationModal?.prefixo || showVehicleAllocationModal?.nome}</DialogTitle>
                <DialogDescription>
                  Gerencie o veículo alocado a esta equipe. Uma equipe pode ter apenas um veículo, mas um veículo pode estar em múltiplas equipes.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-6">
                {/* Veículo Atual */}
                <div>
                  <h3 className="text-lg font-semibold mb-3">Veículo Alocado</h3>
                  {showVehicleAllocationModal && getTeamVehicles(showVehicleAllocationModal.id).length > 0 ? (
                    <div className="space-y-2">
                      {getTeamVehicles(showVehicleAllocationModal.id).map((vehicle: Vehicle) => (
                        <div key={vehicle.id} className="flex items-center justify-between p-3 border rounded-lg bg-gray-50">
                          <div>
                            <div className="font-medium">{vehicle.placa}</div>
                            <div className="text-sm text-gray-500">
                              {vehicle.marca_equipamento} {vehicle.modelo}
                            </div>
                            <div className="text-xs text-blue-600">
                              {vehicle.contrato?.nome || 'Sem contrato'}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            {hasPermission(PERMISSION_CODES.EQUIPES.GERENCIAR_VEICULOS_EQUIPE) && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleRemoveVehicle(showVehicleAllocationModal.id, String(vehicle.id))}
                                disabled={allocateVehicleMutation.isPending || removeVehicleMutation.isPending}
                                className="text-red-600 border-red-600 hover:bg-red-50"
                              >
                                {removeVehicleMutation.isPending ? 'Removendo...' : 'Remover'}
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500 text-center py-4 border rounded-lg">
                      Nenhum veículo alocado a esta equipe (máximo: 1 veículo)
                    </p>
                  )}
                </div>

                {/* Veículos Disponíveis */}
                <div>
                  <h3 className="text-lg font-semibold mb-3">Veículos Disponíveis para Alocação</h3>
                  <p className="text-sm text-gray-600 mb-3">
                    Selecione um veículo para alocar à equipe. Limite: 1 veículo por equipe.
                  </p>

                  {/* Campo de busca */}
                  <div className="mb-3">
                    <Input
                      placeholder="Buscar veículo por placa..."
                      value={vehicleSearchTerm}
                      onChange={(e) => setVehicleSearchTerm(e.target.value)}
                      className="w-full"
                    />
                  </div>

                  {(() => {
                    const currentVehicles = showVehicleAllocationModal ? getTeamVehicles(showVehicleAllocationModal.id) : [];
                    const hasVehicle = currentVehicles.length >= 1;
                    const availableVehicles = getAvailableVehicles(
                      showVehicleAllocationModal?.contrato_id ? String(showVehicleAllocationModal.contrato_id) : null,
                      showVehicleAllocationModal?.id
                    );
                    const filteredVehicles = availableVehicles.filter(vehicle =>
                      vehicle.placa.toLowerCase().includes(vehicleSearchTerm.toLowerCase())
                    );

                    if (hasVehicle) {
                      return (
                        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                          <p className="text-sm text-yellow-800">
                            ⚠️ Esta equipe já possui um veículo alocado. Remova o veículo atual antes de alocar outro.
                          </p>
                        </div>
                      );
                    }

                    return filteredVehicles.length > 0 ? (
                      <div className="space-y-2 max-h-40 overflow-y-auto">
                        {filteredVehicles.map((vehicle: Vehicle) => (
                          <div key={vehicle.id} className="flex items-center justify-between p-3 border rounded-lg">
                            <div>
                              <div className="font-medium">{vehicle.placa}</div>
                              <div className="text-sm text-gray-500">
                                {vehicle.marca_equipamento} {vehicle.modelo}
                              </div>
                              <div className="text-xs text-blue-600">
                                {vehicle.contrato?.nome || 'Sem contrato'}
                              </div>
                            </div>
                            {hasPermission(PERMISSION_CODES.EQUIPES.GERENCIAR_VEICULOS_EQUIPE) && (
                              <Button
                                size="sm"
                                onClick={() => handleAllocateVehicle(showVehicleAllocationModal!.id.toString(), vehicle.id.toString())}
                                disabled={allocateVehicleMutation.isPending || removeVehicleMutation.isPending}
                                className="bg-green-600 hover:bg-green-700"
                              >
                                {allocateVehicleMutation.isPending ? 'Alocando...' : 'Alocar'}
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-500 text-center py-4 border rounded-lg">
                        {vehicleSearchTerm ? 'Nenhum veículo encontrado com essa placa' : 'Nenhum veículo disponível para alocação'}
                      </p>
                    );
                  })()}
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={handleCloseVehicleAllocationModal}>
                  Fechar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Modal de Realocação */}
          <Dialog open={!!modalRealocacao} onOpenChange={(open) => !open && setModalRealocacao(null)}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Realocar Veículo</DialogTitle>
                <DialogDescription>
                  Escolha um novo veículo para a equipe <strong>{safeTeams.find(t => t.id === modalRealocacao?.currentTeamId)?.nome || safeTeams.find(t => t.id === modalRealocacao?.currentTeamId)?.prefixo}</strong>
                </DialogDescription>
              </DialogHeader>

              {modalRealocacao && (() => {
                const currentTeam = safeTeams.find(t => t.id === modalRealocacao.currentTeamId);
                const currentVehicle = safeVehicles.find(v => String(v.id) === modalRealocacao.vehicleId);
                const availableVehicles = getAvailableVehicles(currentTeam?.contrato_id ? String(currentTeam.contrato_id) : null);

                return (
                  <div className="space-y-6">
                    {/* Veículo Atual */}
                    <div>
                      <h3 className="text-lg font-semibold mb-3">Veículo Atual</h3>
                      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-blue-800">
                              <strong>Equipe:</strong> {currentTeam?.nome || currentTeam?.prefixo}
                            </p>
                            <p className="text-sm text-blue-800">
                              <strong>Veículo atual:</strong> {currentVehicle?.placa} - {currentVehicle?.marca_equipamento} {currentVehicle?.modelo}
                            </p>
                          </div>
                          <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                            Atual
                          </Badge>
                        </div>
                      </div>
                    </div>

                    {/* Veículos Disponíveis */}
                    <div>
                      <h3 className="text-lg font-semibold mb-3">Veículos Disponíveis para Troca</h3>
                      <p className="text-sm text-gray-600 mb-3">
                        Selecione um veículo disponível para substituir o veículo atual da equipe.
                      </p>

                      {availableVehicles.length > 0 ? (
                        <div className="space-y-2 max-h-60 overflow-y-auto">
                          {availableVehicles.map((vehicle) => (
                            <div key={vehicle.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50">
                              <div>
                                <div className="font-medium">{vehicle.placa}</div>
                                <div className="text-sm text-gray-500">
                                  {vehicle.marca_equipamento} {vehicle.modelo}
                                </div>
                                <div className="text-xs text-blue-600">
                                  {vehicle.contrato?.nome || 'Sem contrato'}
                                </div>
                                <div className="text-xs text-gray-400">
                                  Tipo: {vehicle.tipo_modelo}
                                </div>
                              </div>
                              <Button
                                size="sm"
                                onClick={() => {
                                  // Usar a mutation de realocação diretamente
                                  realocateVehicleMutation.mutate({
                                    vehicleId: vehicle.id.toString(),
                                    targetTeamId: modalRealocacao.currentTeamId
                                  });
                                }}
                                disabled={allocateVehicleMutation.isPending || removeVehicleMutation.isPending}
                                className="bg-green-600 hover:bg-green-700"
                              >
                                {allocateVehicleMutation.isPending || removeVehicleMutation.isPending ? 'Realocando...' : 'Escolher Este'}
                              </Button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="p-4 bg-gray-50 border rounded-lg text-center">
                          <p className="text-gray-500">
                            Não há veículos disponíveis no mesmo local para realocação.
                          </p>
                          <p className="text-sm text-gray-400 mt-1">
                            Todos os veículos já estão alocados a outras equipes.
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Opção de Remover Veículo */}
                    <div className="border-t pt-4">
                      <h3 className="text-lg font-semibold mb-3 text-red-600">Remover Veículo da Equipe</h3>
                      <p className="text-sm text-gray-600 mb-3">
                        Se desejar, você pode remover o veículo atual da equipe sem alocar um novo.
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          removeVehicleMutation.mutate({
                            teamId: modalRealocacao.currentTeamId,
                            vehicleId: modalRealocacao.vehicleId
                          }, {
                            onSuccess: () => {
                              setModalRealocacao(null);
                              showToast('success', 'Veículo removido da equipe com sucesso!');
                            }
                          });
                        }}
                        disabled={removeVehicleMutation.isPending}
                        className="text-red-600 border-red-600 hover:bg-red-50"
                      >
                        {removeVehicleMutation.isPending ? 'Removendo...' : 'Remover Veículo'}
                      </Button>
                    </div>
                  </div>
                );
              })()}

              <DialogFooter>
                <Button variant="outline" onClick={() => setModalRealocacao(null)}>
                  Cancelar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Modal Parar Equipe */}
          <Dialog open={!!modalPararEquipe} onOpenChange={(open) => !open && setModalPararEquipe(null)}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Parar Equipe</DialogTitle>
                <DialogDescription>
                  Selecione o motivo para parar a equipe
                </DialogDescription>
              </DialogHeader>
              {modalPararEquipe && (
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="motivo">Justificativa</Label>
                    <Select
                      value={modalPararEquipe.motivo}
                      onValueChange={(value) => setModalPararEquipe(m => m ? { ...m, motivo: value, outro: '' } : m)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o motivo" />
                      </SelectTrigger>
                      <SelectContent>
                        {motivosPadrao.map(m => (
                          <SelectItem key={m} value={m === 'Outro' ? 'outro' : m}>
                            {m}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {modalPararEquipe.motivo === 'outro' && (
                    <div>
                      <Label htmlFor="outro">Especifique o motivo</Label>
                      <Textarea
                        id="outro"
                        placeholder="Digite a justificativa..."
                        value={modalPararEquipe.outro}
                        onChange={e => setModalPararEquipe(m => m ? { ...m, outro: e.target.value } : m)}
                      />
                    </div>
                  )}
                </div>
              )}
              <DialogFooter>
                <Button variant="outline" onClick={() => setModalPararEquipe(null)}>
                  Cancelar
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleConfirmPararEquipe}
                  disabled={
                    !modalPararEquipe?.motivo ||
                    (modalPararEquipe?.motivo === 'outro' && !modalPararEquipe?.outro)
                  }
                >
                  Confirmar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Modal de Criação de Equipe */}
          <Dialog open={showCreateTeamModal} onOpenChange={(open) => {
            setShowCreateTeamModal(open);
            if (!open) {
              setNewTeamForm({
                nome: '',
                contrato_id: '',
                operacao_id: '',
                prefixo: '',
                tipo: 'fixa',
                capacidade_maxima: 10,
              });
            }
          }}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Nova Equipe</DialogTitle>
                <DialogDescription>
                  Preencha os dados para criar uma nova equipe
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="nome">Nome da Equipe *</Label>
                  <Input
                    id="nome"
                    placeholder="Ex: Equipe LM 01"
                    value={newTeamForm.nome}
                    onChange={(e) => setNewTeamForm({ ...newTeamForm, nome: e.target.value })}
                  />
                </div>

                <div>
                  <Label htmlFor="contrato">Contrato *</Label>
                  <Select
                    value={newTeamForm.contrato_id}
                    onValueChange={(value) => {
                      setNewTeamForm({ ...newTeamForm, contrato_id: value, operacao_id: '' });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o contrato" />
                    </SelectTrigger>
                    <SelectContent>
                      {contratosPermitidos.map(contrato => (
                        <SelectItem key={contrato.id} value={contrato.id}>
                          {contrato.nome} ({contrato.codigo})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="operacao">Operação Padrão *</Label>
                  <Select
                    value={newTeamForm.operacao_id}
                    onValueChange={(value) => setNewTeamForm({ ...newTeamForm, operacao_id: value })}
                    disabled={!newTeamForm.contrato_id}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={newTeamForm.contrato_id ? "Selecione a operação" : "Selecione um contrato primeiro"} />
                    </SelectTrigger>
                    <SelectContent>
                      {operacoesCreateModal.map(operacao => (
                        <SelectItem key={operacao.id} value={operacao.id}>
                          {operacao.nome} ({operacao.codigo})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="prefixo">Prefixo</Label>
                    <Input
                      id="prefixo"
                      placeholder="Ex: EQ-A"
                      value={newTeamForm.prefixo}
                      onChange={(e) => setNewTeamForm({ ...newTeamForm, prefixo: e.target.value })}
                    />
                  </div>

                  <div>
                    <Label htmlFor="capacidade">Capacidade Máxima</Label>
                    <Input
                      id="capacidade"
                      type="number"
                      min="1"
                      value={newTeamForm.capacidade_maxima}
                      onChange={(e) => setNewTeamForm({ ...newTeamForm, capacidade_maxima: parseInt(e.target.value) || 10 })}
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="tipo">Tipo de Equipe</Label>
                  <Select
                    value={newTeamForm.tipo}
                    onValueChange={(value: 'fixa' | 'aberta') => setNewTeamForm({ ...newTeamForm, tipo: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fixa">Fixa</SelectItem>
                      <SelectItem value="aberta">Aberta</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setShowCreateTeamModal(false)}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={() => {
                    if (!newTeamForm.nome || !newTeamForm.contrato_id || !newTeamForm.operacao_id) {
                      showToast('error', 'Preencha todos os campos obrigatórios');
                      return;
                    }

                    const operacao = operacoesCreateModal.find(op => op.id === newTeamForm.operacao_id);

                    createTeamMutation.mutate({
                      nome: newTeamForm.nome,
                      contrato_id: newTeamForm.contrato_id,
                      operacao_id: newTeamForm.operacao_id,
                      operacao: operacao?.nome || '',
                      prefixo: newTeamForm.prefixo || undefined,
                      tipo: newTeamForm.tipo,
                      capacidade_maxima: newTeamForm.capacidade_maxima,
                      status: 'active',
                      base_id: null,
                      responsavel_id: null,
                    });
                  }}
                  disabled={createTeamMutation.isPending}
                >
                  {createTeamMutation.isPending ? 'Criando...' : 'Criar Equipe'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Modal de Upload em Massa */}
          <Dialog open={showBulkUpload} onOpenChange={(open) => {
            setShowBulkUpload(open);
            if (!open) {
              setUploadFile(null);
              setSelectedContratoId('');
              setSelectedOperacaoPadrao('');
            }
          }}>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Upload em Massa de Equipes</DialogTitle>
                <DialogDescription>
                  Faça upload de um arquivo CSV com os nomes das equipes
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="contrato">1. Selecione o Contrato *</Label>
                  <Select value={selectedContratoId} onValueChange={(value) => {
                    setSelectedContratoId(value);
                    setSelectedOperacaoPadrao(''); // Reset operação quando mudar contrato
                  }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o contrato" />
                    </SelectTrigger>
                    <SelectContent>
                      {safeContratos.map(contrato => (
                        <SelectItem key={contrato.id} value={contrato.id}>
                          {contrato.nome} ({contrato.codigo})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="operacao">2. Selecione a Operação Padrão *</Label>
                  <Select
                    value={selectedOperacaoPadrao}
                    onValueChange={setSelectedOperacaoPadrao}
                    disabled={!selectedContratoId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={selectedContratoId ? "Selecione a operação" : "Selecione um contrato primeiro"} />
                    </SelectTrigger>
                    <SelectContent>
                      {operacoesPadrao.map(operacao => (
                        <SelectItem key={operacao.id} value={operacao.id}>
                          {operacao.nome} ({operacao.codigo})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-gray-500 mt-1">
                    Todas as equipes terão esta operação
                  </p>
                </div>

                <div>
                  <Label htmlFor="file">3. Arquivo CSV *</Label>
                  <Input
                    id="file"
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                    disabled={!selectedOperacaoPadrao}
                  />
                  <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-md">
                    <p className="text-sm font-semibold text-blue-900 mb-1">
                      Formato esperado:
                    </p>
                    <p className="text-xs text-blue-800 font-mono">
                      nome_equipe
                    </p>
                    <p className="text-xs text-gray-600 mt-2">
                      <strong>Exemplo:</strong>
                    </p>
                    <p className="text-xs text-gray-700 font-mono">
                      Equipe LM 01<br />
                      Equipe LM 02<br />
                      Equipe LM 03
                    </p>
                    <p className="text-xs text-gray-600 mt-2">
                      <strong>Nota:</strong> A operação selecionada acima será aplicada a todas as equipes
                    </p>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowBulkUpload(false)}>
                  Cancelar
                </Button>
                <Button
                  onClick={handleBulkUpload}
                  disabled={!uploadFile || !selectedContratoId || !selectedOperacaoPadrao || uploading}
                >
                  {uploading ? 'Fazendo upload...' : 'Fazer Upload'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Modal de Edição de Equipe */}
          <Dialog open={!!showEditModal} onOpenChange={(open) => !open && setShowEditModal(null)}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Editar Equipe</DialogTitle>
                <DialogDescription>
                  Atualize as informações da equipe
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={handleEditSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Nome da Equipe */}
                  <div>
                    <Label htmlFor="nome-edit">Nome da Equipe *</Label>
                    <Input
                      id="nome-edit"
                      value={editFormData.nome}
                      onChange={(e) => setEditFormData(prev => ({ ...prev, nome: e.target.value }))}
                      required
                      placeholder="Nome da equipe"
                    />
                  </div>

                  {/* Contrato */}
                  <div>
                    <Label htmlFor="contrato-edit">Contrato *</Label>
                    <Select 
                      key={`contrato-edit-${editFormData.contrato_id}`}
                      value={editFormData.contrato_id} 
                      onValueChange={(value) => {
                        setEditFormData(prev => ({ ...prev, contrato_id: value, operacao_id: '' }));
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o contrato" />
                      </SelectTrigger>
                      <SelectContent>
                        {safeContratos.map(contrato => (
                          <SelectItem key={contrato.id} value={String(contrato.id)}>
                            {contrato.nome} ({contrato.codigo})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-gray-500 mt-1">
                      Ao mudar o contrato, selecione a operação novamente
                    </p>
                  </div>

                  {/* Operação */}
                  <div>
                    <Label htmlFor="operacao-edit">Operação *</Label>
                    <Select 
                      key={`operacao-edit-${editFormData.operacao_id}-${editFormData.contrato_id}`}
                      value={editFormData.operacao_id} 
                      onValueChange={(value) => {
                        setEditFormData(prev => ({ ...prev, operacao_id: value }));
                      }}
                      disabled={!editFormData.contrato_id || operacoesEditModal.length === 0}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={editFormData.contrato_id ? "Selecione a operação" : "Selecione um contrato primeiro"} />
                      </SelectTrigger>
                      <SelectContent>
                        {operacoesEditModal.map(operacao => (
                          <SelectItem key={operacao.id} value={operacao.id}>
                            {operacao.nome} ({operacao.codigo})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-gray-500 mt-1">
                      {operacoesEditModal.length === 0 && editFormData.contrato_id 
                        ? 'Nenhuma operação cadastrada para este contrato' 
                        : 'Operação vinculada à equipe'}
                    </p>
                  </div>

                  {/* Prefixo */}
                  <div>
                    <Label htmlFor="prefixo-edit">Prefixo</Label>
                    <Input
                      id="prefixo-edit"
                      value={editFormData.prefixo}
                      onChange={(e) => setEditFormData(prev => ({ ...prev, prefixo: e.target.value }))}
                      placeholder="Prefixo da equipe"
                    />
                  </div>

                  {/* Encarregado - Mostrar apenas se operação requer */}
                  {operacaoSelecionada?.requerEncarregado && (
                    <div className="relative">
                      <Label htmlFor="encarregado-edit">
                        Encarregado
                        <span className="text-xs text-blue-600 ml-1">(Recomendado para esta operação)</span>
                      </Label>
                      <div className="relative">
                        <Input
                          id="encarregado-edit"
                          value={encarregadoSearch}
                          onChange={(e) => {
                            setEncarregadoSearch(e.target.value);
                            setShowEncarregadoDropdown(true);
                          }}
                          onFocus={() => setShowEncarregadoDropdown(true)}
                          placeholder="Buscar por nome ou matrícula..."
                          className="w-full"
                        />
                        {editFormData.encarregado_id && (
                          <button
                            type="button"
                            onClick={() => {
                              setEditFormData(prev => ({ ...prev, encarregado_id: '' }));
                              setEncarregadoSearch('');
                            }}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                      
                      {showEncarregadoDropdown && (
                        <div className="encarregado-dropdown absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-auto">
                          {funcionariosFiltrados.length > 0 ? (
                            funcionariosFiltrados.map(funcionario => (
                              <button
                                key={funcionario.id}
                                type="button"
                                onClick={() => {
                                  setEditFormData(prev => ({ ...prev, encarregado_id: funcionario.id }));
                                  setEncarregadoSearch(`${funcionario.nome} - ${funcionario.matricula}`);
                                  setShowEncarregadoDropdown(false);
                                }}
                                className={`w-full text-left px-3 py-2 hover:bg-gray-100 transition-colors ${
                                  editFormData.encarregado_id === funcionario.id ? 'bg-blue-50' : ''
                                }`}
                              >
                                <div className="font-medium">{funcionario.nome}</div>
                                <div className="text-sm text-gray-500">
                                  Matrícula: {funcionario.matricula}
                                </div>
                              </button>
                            ))
                          ) : (
                            <div className="px-3 py-4 text-center text-gray-500">
                              <p className="text-sm">Nenhum funcionário encontrado</p>
                            </div>
                          )}
                        </div>
                      )}
                      
                      <p className="text-xs text-gray-500 mt-1">
                        Busque funcionários ativos por nome ou matrícula (opcional)
                      </p>
                    </div>
                  )}

                  {/* Setor - Mostrar apenas se operação tiver setores associados */}
                  {setoresDisponiveis.length > 0 && (
                    <div>
                      <Label htmlFor="setor-edit">
                        Setor
                        <span className="text-xs text-gray-500 ml-1">
                          (Setores disponíveis para {operacaoSelecionada?.nome})
                        </span>
                      </Label>
                      <Select 
                        key={`setor-edit-${editFormData.setor}`}
                        value={editFormData.setor || undefined} 
                        onValueChange={(value) => setEditFormData(prev => ({ ...prev, setor: value === 'NENHUM' ? '' : value }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o setor" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="NENHUM">Nenhum</SelectItem>
                          {setoresDisponiveis.map(setor => (
                            <SelectItem key={setor.id} value={setor.codigo}>
                              {setor.nome} ({setor.codigo})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-gray-500 mt-1">
                        Apenas setores associados à operação selecionada
                      </p>
                    </div>
                  )}

                  {/* Status */}
                  <div>
                    <Label htmlFor="status-edit">Status</Label>
                    <Select value={editFormData.status} onValueChange={(value: 'active' | 'parada') => setEditFormData(prev => ({ ...prev, status: value }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Ativa</SelectItem>
                        <SelectItem value="parada">Parada</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Motivo da Parada */}
                {editFormData.status === 'parada' && (
                  <div>
                    <Label htmlFor="motivoParada-edit">Motivo da Parada</Label>
                    <Textarea
                      id="motivoParada-edit"
                      value={editFormData.motivoParada}
                      onChange={(e) => setEditFormData(prev => ({ ...prev, motivoParada: e.target.value }))}
                      placeholder="Descreva o motivo da parada"
                      rows={3}
                    />
                  </div>
                )}

                {/* Botões */}
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowEditModal(null)}
                    disabled={updateTeamMutation.isPending}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    disabled={updateTeamMutation.isPending}
                    className="min-w-[120px]"
                  >
                    {updateTeamMutation.isPending ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Salvando...
                      </>
                    ) : (
                      'Salvar'
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </div>
  );
}
