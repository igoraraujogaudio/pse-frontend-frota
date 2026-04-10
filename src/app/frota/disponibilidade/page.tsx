'use client';
import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { vehicleService } from '@/services/vehicleService';
import { teamService } from '@/services/teamService';
import { maintenanceService } from '@/services/maintenanceService';
import { useAuth } from '@/contexts/AuthContext';
import type { Vehicle } from '@/types';
import { Team } from '@/types/team';
import { Maintenance } from '@/types';
import { PERMISSION_CODES } from '@/hooks/useModularPermissions';
import ProtectedRoute from '@/components/ProtectedRoute';
import { 
  TruckIcon, 
  WrenchScrewdriverIcon, 
  UserGroupIcon,
  CheckCircleIcon,
  XCircleIcon,
  LockClosedIcon
} from '@heroicons/react/24/outline';

// Shadcn/ui components
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface Contract {
  id: string;
  nome: string;
  codigo: string;
}

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

// Status disponíveis
const STATUS_OPTIONS = [
  { value: 'operacao', label: 'Em Operação', color: 'bg-green-500', icon: CheckCircleIcon },
  { value: 'disponivel', label: 'Disponível', color: 'bg-blue-500', icon: CheckCircleIcon },
  { value: 'manutenção', label: 'Em Manutenção', color: 'bg-yellow-500', icon: WrenchScrewdriverIcon },
  { value: 'não operante', label: 'Não Operante', color: 'bg-gray-500', icon: XCircleIcon },
  { value: 'bloqueado', label: 'Bloqueado', color: 'bg-red-500', icon: LockClosedIcon },
];

export default function DisponibilidadeVeiculosPage() {
  return (
    <ProtectedRoute requiredPermissions={[
      PERMISSION_CODES.VEICULOS?.GESTAO_COMPLETA_FROTA || 'veiculos.site.gestao_completa_frota'
    ]}>
      <DisponibilidadeVeiculosContent />
    </ProtectedRoute>
  );
}

function DisponibilidadeVeiculosContent() {
  const { userContratoIds, user } = useAuth();
  const queryClient = useQueryClient();

  // Estados
  const [searchTerm, setSearchTerm] = useState('');
  const [contratoFilter, setContratoFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showMaintenanceModal, setShowMaintenanceModal] = useState(false);
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [newStatus, setNewStatus] = useState<string>('');
  const [maintenanceForm, setMaintenanceForm] = useState({
    descricao: '',
    prioridade: 'normal' as 'normal' | 'baixa' | 'alta' | 'urgente',
    observacoes: '',
  });
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');

  // Carregar veículos
  const { data: vehicles, isLoading: loadingVehicles, isError: errorVehicles } = useQuery<Vehicle[]>({
    queryKey: ['vehicles', userContratoIds],
    queryFn: () => vehicleService.getAll(undefined, userContratoIds),
    retry: 3,
    retryDelay: 1000,
  });

  // Carregar equipes
  const { data: teams, isLoading: loadingTeams } = useQuery<Team[]>({
    queryKey: ['teams'],
    queryFn: teamService.getTeams,
    retry: 3,
    retryDelay: 1000,
  });

  // Carregar contratos
  const { data: contratos, isLoading: loadingContratos } = useQuery<Contract[]>({
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

  const safeVehicles = useMemo(() => Array.isArray(vehicles) ? vehicles : [], [vehicles]);
  const safeTeams = useMemo(() => Array.isArray(teams) ? teams : [], [teams]);
  const safeContratos = useMemo(() => Array.isArray(contratos) ? contratos : [], [contratos]);

  // Filtrar contratos que o usuário tem acesso
  const isAdmin = user?.nivel_acesso === 'admin' || user?.nivel_acesso === 'diretor';
  const contratosPermitidos = safeContratos.filter(contrato => 
    isAdmin || (userContratoIds && userContratoIds.includes(String(contrato.id)))
  );

  // Agrupar veículos por contrato
  const vehiclesByContract = useMemo(() => {
    const grouped: Record<string, Vehicle[]> = {};
    
    safeVehicles.forEach(vehicle => {
      const contratoId = vehicle.contrato_id || 'sem-contrato';
      if (!grouped[contratoId]) {
        grouped[contratoId] = [];
      }
      grouped[contratoId].push(vehicle);
    });

    // Aplicar filtros
    let filtered = grouped;
    
    // Filtro de contrato
    if (contratoFilter !== 'all') {
      const filteredByContract: Record<string, Vehicle[]> = {};
      if (grouped[contratoFilter]) {
        filteredByContract[contratoFilter] = grouped[contratoFilter];
      }
      filtered = filteredByContract;
    }

    // Filtro de status
    if (statusFilter !== 'all') {
      Object.keys(filtered).forEach(contratoId => {
        filtered[contratoId] = filtered[contratoId].filter(v => 
          (v.status || '').toLowerCase() === statusFilter.toLowerCase()
        );
      });
    }

    // Filtro de busca
    if (searchTerm) {
      Object.keys(filtered).forEach(contratoId => {
        filtered[contratoId] = filtered[contratoId].filter(v => 
          v.placa?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          v.modelo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          v.prefixo_fixo?.toLowerCase().includes(searchTerm.toLowerCase())
        );
      });
    }

    return filtered;
  }, [safeVehicles, contratoFilter, statusFilter, searchTerm]);

  // Mutation para atualizar status
  const updateStatusMutation = useMutation({
    mutationFn: async ({ vehicleId, status }: { vehicleId: string; status: string }) => {
      const { data: { session } } = await (await import('@/lib/supabase')).supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Sessão expirada. Faça login novamente.');
      }

      const response = await fetch(`/api/vehicles/${vehicleId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ status }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao atualizar status');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      setShowStatusModal(false);
      setSelectedVehicle(null);
      showToast('success', 'Status atualizado com sucesso!');
    },
    onError: (error: Error) => {
      showToast('error', error.message || 'Erro ao atualizar status');
    },
  });

  // Mutation para criar manutenção
  const createMaintenanceMutation = useMutation({
    mutationFn: async (data: Omit<Maintenance, 'id' | 'criado_em'>) => {
      return maintenanceService.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      queryClient.invalidateQueries({ queryKey: ['maintenances'] });
      setShowMaintenanceModal(false);
      setSelectedVehicle(null);
      setMaintenanceForm({ descricao: '', prioridade: 'normal', observacoes: '' });
      showToast('success', 'Manutenção registrada com sucesso!');
    },
    onError: (error: Error) => {
      showToast('error', error.message || 'Erro ao registrar manutenção');
    },
  });

  // Mutation para atualizar equipe
  const updateTeamMutation = useMutation({
    mutationFn: async ({ vehicleId, teamId }: { vehicleId: string; teamId: string | null }) => {
      const { data: { session } } = await (await import('@/lib/supabase')).supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Sessão expirada. Faça login novamente.');
      }

      if (teamId) {
        // Alocar veículo à equipe
        await teamService.assignVehicle(teamId, vehicleId);
        // Atualizar equipe_id no veículo
        const response = await fetch(`/api/vehicles/${vehicleId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ equipe_id: teamId }),
        });
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Erro ao atualizar equipe');
        }
        return response.json();
      } else {
        // Remover veículo de todas as equipes
        const vehicle = safeVehicles.find(v => String(v.id) === vehicleId);
        if (vehicle?.equipe_id) {
          await teamService.removeVehicle(vehicle.equipe_id, vehicleId);
        }
        // Atualizar equipe_id no veículo
        const response = await fetch(`/api/vehicles/${vehicleId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ equipe_id: null }),
        });
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Erro ao remover equipe');
        }
        return response.json();
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      setShowTeamModal(false);
      setSelectedVehicle(null);
      setSelectedTeamId('');
      showToast('success', 'Equipe atualizada com sucesso!');
    },
    onError: (error: Error) => {
      showToast('error', error.message || 'Erro ao atualizar equipe');
    },
  });

  // Handlers
  const handleStatusChange = (vehicle: Vehicle) => {
    setSelectedVehicle(vehicle);
    setNewStatus(vehicle.status || '');
    setShowStatusModal(true);
  };

  const handleMaintenance = (vehicle: Vehicle) => {
    setSelectedVehicle(vehicle);
    setMaintenanceForm({ descricao: '', prioridade: 'normal', observacoes: '' });
    setShowMaintenanceModal(true);
  };

  const handleTeamChange = (vehicle: Vehicle) => {
    setSelectedVehicle(vehicle);
    setSelectedTeamId(vehicle.equipe_id || '');
    setShowTeamModal(true);
  };

  const handleConfirmStatus = () => {
    if (!selectedVehicle || !newStatus) return;
    updateStatusMutation.mutate({ vehicleId: String(selectedVehicle.id), status: newStatus });
  };

  const handleConfirmMaintenance = () => {
    if (!selectedVehicle || !user || !maintenanceForm.descricao.trim()) {
      showToast('error', 'Por favor, preencha a descrição da manutenção');
      return;
    }

    const maintenanceData: Omit<Maintenance, 'id' | 'criado_em'> = {
      veiculo_id: String(selectedVehicle.id),
      contrato_id: selectedVehicle.contrato_id || undefined,
      descricao: maintenanceForm.descricao.trim(),
      prioridade: maintenanceForm.prioridade,
      status: 'pendente',
      tipo: 'corrective',
      tipo_servico: 'externo',
      observacoes: maintenanceForm.observacoes?.trim() || undefined,
      atualizado_em: new Date().toISOString(),
      solicitante_id: user.id,
    };

    createMaintenanceMutation.mutate(maintenanceData);
  };

  const handleConfirmTeam = () => {
    if (!selectedVehicle) return;
    updateTeamMutation.mutate({ 
      vehicleId: String(selectedVehicle.id), 
      teamId: selectedTeamId || null 
    });
  };

  // Função para obter cor do status
  const getStatusColor = (status: string) => {
    const statusOption = STATUS_OPTIONS.find(s => s.value.toLowerCase() === status.toLowerCase());
    return statusOption?.color || 'bg-gray-500';
  };

  // Função para obter label do status
  const getStatusLabel = (status: string) => {
    const statusOption = STATUS_OPTIONS.find(s => s.value.toLowerCase() === status.toLowerCase());
    return statusOption?.label || status;
  };

  // Função para obter equipe do veículo
  const getVehicleTeam = (vehicle: Vehicle) => {
    if (!vehicle.equipe_id) return null;
    return safeTeams.find(t => String(t.id) === vehicle.equipe_id);
  };

  // Loading
  if (loadingVehicles || loadingContratos || loadingTeams) {
    return (
      <div className="bg-gray-50 flex items-center justify-center py-20">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Carregando dados...</p>
        </div>
      </div>
    );
  }

  // Error
  if (errorVehicles) {
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
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-900">Disponibilidade de Veículos</h1>
            <p className="text-gray-600 mt-1">Gerencie a disponibilidade e status dos veículos por contrato</p>
          </div>

          {/* Filtros */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Filtros</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="search">Buscar</Label>
                  <Input
                    id="search"
                    placeholder="Placa, modelo ou prefixo..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="contrato">Contrato</Label>
                  <Select value={contratoFilter} onValueChange={setContratoFilter}>
                    <SelectTrigger id="contrato">
                      <SelectValue placeholder="Todos os contratos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os contratos</SelectItem>
                      {contratosPermitidos.map(contrato => (
                        <SelectItem key={contrato.id} value={contrato.id}>
                          {contrato.nome} ({contrato.codigo})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="status">Status</Label>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger id="status">
                      <SelectValue placeholder="Todos os status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os status</SelectItem>
                      {STATUS_OPTIONS.map(status => (
                        <SelectItem key={status.value} value={status.value}>
                          {status.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Lista de veículos por contrato */}
          <div className="space-y-6">
            {Object.keys(vehiclesByContract).length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-gray-500">
                  Nenhum veículo encontrado com os filtros aplicados.
                </CardContent>
              </Card>
            ) : (
              Object.entries(vehiclesByContract).map(([contratoId, vehicles]) => {
                const contrato = safeContratos.find(c => c.id === contratoId);
                if (vehicles.length === 0) return null;

                return (
                  <Card key={contratoId}>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <TruckIcon className="h-5 w-5" />
                        {contrato ? `${contrato.nome} (${contrato.codigo})` : 'Sem Contrato'}
                      </CardTitle>
                      <CardDescription>
                        {vehicles.length} veículo{vehicles.length !== 1 ? 's' : ''}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Placa</TableHead>
                            <TableHead>Modelo</TableHead>
                            <TableHead>Prefixo</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Equipe</TableHead>
                            <TableHead className="text-right">Ações</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {vehicles.map((vehicle) => {
                            const team = getVehicleTeam(vehicle);
                            return (
                              <TableRow key={vehicle.id}>
                                <TableCell className="font-medium">{vehicle.placa}</TableCell>
                                <TableCell>{vehicle.modelo || '-'}</TableCell>
                                <TableCell>{vehicle.prefixo_fixo || '-'}</TableCell>
                                <TableCell>
                                  <Badge className={getStatusColor(vehicle.status || '')}>
                                    {getStatusLabel(vehicle.status || '')}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  {team ? (
                                    <span className="text-sm">{team.nome}</span>
                                  ) : (
                                    <span className="text-sm text-gray-400">Sem equipe</span>
                                  )}
                                </TableCell>
                                <TableCell className="text-right">
                                  <div className="flex justify-end gap-2">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleStatusChange(vehicle)}
                                    >
                                      Status
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleMaintenance(vehicle)}
                                    >
                                      <WrenchScrewdriverIcon className="h-4 w-4 mr-1" />
                                      Manutenção
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleTeamChange(vehicle)}
                                    >
                                      <UserGroupIcon className="h-4 w-4 mr-1" />
                                      Equipe
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Modal de Alterar Status */}
      <Dialog open={showStatusModal} onOpenChange={setShowStatusModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Alterar Status do Veículo</DialogTitle>
            <DialogDescription>
              Veículo: {selectedVehicle?.placa} - {selectedVehicle?.modelo}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="status-select">Novo Status</Label>
              <Select value={newStatus} onValueChange={setNewStatus}>
                <SelectTrigger id="status-select">
                  <SelectValue placeholder="Selecione o status" />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map(status => (
                    <SelectItem key={status.value} value={status.value}>
                      {status.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowStatusModal(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleConfirmStatus}
              disabled={updateStatusMutation.isPending}
            >
              {updateStatusMutation.isPending ? 'Atualizando...' : 'Confirmar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Manutenção */}
      <Dialog open={showMaintenanceModal} onOpenChange={setShowMaintenanceModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar Manutenção</DialogTitle>
            <DialogDescription>
              Veículo: {selectedVehicle?.placa} - {selectedVehicle?.modelo}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="descricao">Descrição do Problema *</Label>
              <Textarea
                id="descricao"
                placeholder="Descreva o problema ou tipo de manutenção necessária..."
                value={maintenanceForm.descricao}
                onChange={(e) => setMaintenanceForm({ ...maintenanceForm, descricao: e.target.value })}
                rows={4}
              />
            </div>
            <div>
              <Label htmlFor="prioridade">Prioridade</Label>
              <Select 
                value={maintenanceForm.prioridade} 
                onValueChange={(value: 'normal' | 'baixa' | 'alta' | 'urgente') => 
                  setMaintenanceForm({ ...maintenanceForm, prioridade: value })
                }
              >
                <SelectTrigger id="prioridade">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="baixa">Baixa</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="alta">Alta</SelectItem>
                  <SelectItem value="urgente">Urgente</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="observacoes">Observações</Label>
              <Textarea
                id="observacoes"
                placeholder="Observações adicionais (opcional)..."
                value={maintenanceForm.observacoes}
                onChange={(e) => setMaintenanceForm({ ...maintenanceForm, observacoes: e.target.value })}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMaintenanceModal(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleConfirmMaintenance}
              disabled={createMaintenanceMutation.isPending || !maintenanceForm.descricao.trim()}
            >
              {createMaintenanceMutation.isPending ? 'Registrando...' : 'Registrar Manutenção'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Alterar Equipe */}
      <Dialog open={showTeamModal} onOpenChange={setShowTeamModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Alterar Equipe do Veículo</DialogTitle>
            <DialogDescription>
              Veículo: {selectedVehicle?.placa} - {selectedVehicle?.modelo}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="team-select">Equipe</Label>
              <Select value={selectedTeamId} onValueChange={setSelectedTeamId}>
                <SelectTrigger id="team-select">
                  <SelectValue placeholder="Selecione uma equipe ou deixe vazio para remover" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Sem equipe</SelectItem>
                  {safeTeams
                    .filter(team => 
                      !selectedVehicle?.contrato_id || 
                      String(team.contrato_id) === String(selectedVehicle.contrato_id)
                    )
                    .map(team => (
                      <SelectItem key={team.id} value={String(team.id)}>
                        {team.nome} {team.prefixo ? `(${team.prefixo})` : ''}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTeamModal(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleConfirmTeam}
              disabled={updateTeamMutation.isPending}
            >
              {updateTeamMutation.isPending ? 'Atualizando...' : 'Confirmar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

