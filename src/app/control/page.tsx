'use client';

import { useEffect, useState } from 'react';
import { 
  WrenchScrewdriverIcon, 
  TruckIcon, 
  PlusIcon, 
  MagnifyingGlassIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import { maintenanceService } from '@/services/maintenanceService';
import { vehicleService } from '@/services/vehicleService';
import { useNotification } from '@/contexts/NotificationContext';
import { Maintenance, Vehicle } from '@/types';
import clsx from 'clsx';

// Definir tipo explícito para prioridade
type Prioridade = 'low' | 'normal' | 'high' | 'urgent' | 'baixa' | 'alta' | 'urgente';

export default function ControlPage() {
  const { notify } = useNotification();
  const [maintenances, setMaintenances] = useState<Maintenance[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [showNewMaintenanceModal, setShowNewMaintenanceModal] = useState(false);
  const [newMaintenance, setNewMaintenance] = useState<{
    vehicleId: string;
    reason: string;
    priority: Prioridade;
    estimatedCost: string;
    notes: string;
    workshopId: string;
  }>({
    vehicleId: '',
    reason: '',
    priority: 'normal',
    estimatedCost: '',
    notes: '',
    workshopId: ''
  });

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const [maintenancesData, vehiclesData] = await Promise.all([
          maintenanceService.getAll(),
          vehicleService.getAll()
        ]);
        setMaintenances(maintenancesData);
        setVehicles(vehiclesData);
      } catch {
        notify('Erro ao carregar dados das manutenções.', 'error');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [notify]);

  const statusOptions = [
    { key: 'pending', label: 'Pendentes', icon: ExclamationTriangleIcon, color: 'bg-yellow-100 text-yellow-800', border: 'border-yellow-300' },
    { key: 'approved', label: 'Aprovadas', icon: WrenchScrewdriverIcon, color: 'bg-blue-100 text-blue-800', border: 'border-blue-300' },
    { key: 'in_progress', label: 'Em Manutenção', icon: ArrowPathIcon, color: 'bg-purple-100 text-purple-800', border: 'border-purple-300' },
    { key: 'completed', label: 'Aguardando Retirada', icon: CheckCircleIcon, color: 'bg-green-100 text-green-800', border: 'border-green-300' },
  ];

  const toggleStatus = (key: string) => {
    setSelectedStatuses(prev =>
      prev.includes(key) ? prev.filter(s => s !== key) : [...prev, key]
    );
  };

  const handleApproveRequest = async (requestId: string, workshopId: string) => {
    try {
      const estimatedCompletion = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
      const updated = await maintenanceService.approve(requestId, workshopId, estimatedCompletion);
      setMaintenances(prev => prev.map(m => m.id === requestId ? updated : m));
      notify('Manutenção aprovada com sucesso!', 'success');
    } catch {
      notify('Erro ao aprovar manutenção.', 'error');
    }
  };

  const handleStartMaintenance = async (requestId: string) => {
    try {
      const updated = await maintenanceService.start(requestId);
      setMaintenances(prev => prev.map(m => m.id === requestId ? updated : m));
      notify('Manutenção iniciada com sucesso!', 'success');
    } catch {
      notify('Erro ao iniciar manutenção.', 'error');
    }
  };

  const handleCompleteMaintenance = async (requestId: string) => {
    try {
      const updated = await maintenanceService.complete(requestId);
      setMaintenances(prev => prev.map(m => m.id === requestId ? updated : m));
      notify('Manutenção concluída com sucesso!', 'success');
    } catch {
      notify('Erro ao concluir manutenção.', 'error');
    }
  };

  const handleNewMaintenanceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Mapear prioridade para português se necessário e garantir tipo
      let prioridade: Prioridade = newMaintenance.priority;
      if (prioridade === 'low') prioridade = 'baixa';
      else if (prioridade === 'high') prioridade = 'alta';
      else if (prioridade === 'urgent') prioridade = 'urgente';
      else if (prioridade === 'normal') prioridade = 'normal';
      const maintenance = await maintenanceService.create({
        veiculo_id: newMaintenance.vehicleId,
        descricao: newMaintenance.reason,
        prioridade,
        custo_estimado: parseFloat(newMaintenance.estimatedCost) || 0,
        observacoes: newMaintenance.notes,
        oficina_id: newMaintenance.workshopId,
        status: 'pending',
        atualizado_em: new Date().toISOString(),
        tipo: 'corrective',
        tipo_servico: 'externo' as const
      });
      setMaintenances(prev => [maintenance, ...prev]);
      setShowNewMaintenanceModal(false);
      setNewMaintenance({
        vehicleId: '',
        reason: '',
        priority: 'normal',
        estimatedCost: '',
        notes: '',
        workshopId: ''
      });
      notify('Manutenção criada com sucesso!', 'success');
    } catch {
      notify('Erro ao criar manutenção.', 'error');
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-gray-500">Carregando...</div>;
  }

  // Filtrar manutenções por status e texto
  const filteredMaintenances = maintenances.filter(maintenance => {
    const matchesStatus = selectedStatuses.length === 0 || selectedStatuses.includes(maintenance.status);
    const vehicle = vehicles.find(v => v.id === Number(maintenance.veiculo_id));
    const search = searchTerm.toLowerCase();
    const matchesSearch = !searchTerm || 
      (vehicle && (
        vehicle.placa.toLowerCase().includes(search) ||
                  vehicle.modelo.toLowerCase().includes(search)
      )) ||
      maintenance.descricao.toLowerCase().includes(search);
    return matchesStatus && matchesSearch;
  });

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Controle de Manutenções</h1>
            <p className="mt-1 text-sm text-gray-600">
              Gerencie solicitações de manutenção e acompanhe o status dos veículos
            </p>
          </div>

          {/* Barra de pesquisa e ações */}
          <div className="mb-6 flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="relative flex-1">
              <MagnifyingGlassIcon className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar por placa, modelo, equipe, supervisor..."
                className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowNewMaintenanceModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                <PlusIcon className="h-4 w-4" />
                Nova Manutenção
              </button>
            </div>
          </div>

          {/* Seletores de status */}
          <div className="mb-6 flex flex-wrap gap-4">
            {statusOptions.map(option => (
              <button
                key={option.key}
                type="button"
                onClick={() => toggleStatus(option.key)}
                className={clsx(
                  'inline-flex items-center gap-2 px-5 py-2 rounded-lg border text-base font-semibold transition-colors',
                  option.border,
                  selectedStatuses.includes(option.key)
                    ? option.color + ' ring-2 ring-offset-2 ring-blue-200 border-2'
                    : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                )}
              >
                <option.icon className={clsx('h-5 w-5', selectedStatuses.includes(option.key) ? '' : 'text-gray-400')} />
                {option.label}
              </button>
            ))}
          </div>

          {/* Lista de Manutenções */}
          <div className="space-y-4">
            {filteredMaintenances.map(maintenance => {
              const vehicle = vehicles.find(v => v.id === Number(maintenance.veiculo_id));
              return (
                <div key={maintenance.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <TruckIcon className="h-8 w-8 text-blue-600" />
                      <div>
                        <div className="font-semibold text-lg text-gray-900">
                          {vehicle ? `${vehicle.placa} - ${vehicle.modelo}` : 'Veículo não encontrado'}
                        </div>
                        <div className="text-sm text-gray-500">{maintenance.descricao}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {maintenance.status === 'pending' && (
                        <button
                          onClick={() => handleApproveRequest(maintenance.id, maintenance.oficina_id || '')}
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-sm font-medium text-white hover:bg-blue-700"
                        >
                          <CheckCircleIcon className="h-4 w-4" />
                          Aprovar e Definir Oficina
                        </button>
                      )}
                      {maintenance.status === 'approved' && (
                        <button
                          onClick={() => handleStartMaintenance(maintenance.id)}
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-600 text-sm font-medium text-white hover:bg-purple-700"
                        >
                          <ArrowPathIcon className="h-4 w-4" />
                          Entregar Veículo na Oficina
                        </button>
                      )}
                      {maintenance.status === 'in_progress' && (
                        <button
                          onClick={() => handleCompleteMaintenance(maintenance.id)}
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600 text-sm font-medium text-white hover:bg-green-700"
                        >
                          <CheckCircleIcon className="h-4 w-4" />
                          Marcar Pronto para Retirada
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Modal de Nova Manutenção */}
          {showNewMaintenanceModal && (
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
              <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full">
                <div className="flex items-center justify-between p-6 border-b border-gray-200">
                  <h2 className="text-lg font-semibold text-gray-900">Nova Manutenção</h2>
                  <button
                    onClick={() => setShowNewMaintenanceModal(false)}
                    className="text-gray-400 hover:text-gray-500"
                  >
                    <XMarkIcon className="h-6 w-6" />
                  </button>
                </div>
                <form onSubmit={handleNewMaintenanceSubmit} className="p-6">
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Veículo
                      </label>
                      <select
                        value={newMaintenance.vehicleId}
                        onChange={(e) => setNewMaintenance(prev => ({ ...prev, vehicleId: e.target.value }))}
                        className="w-full rounded-lg border border-gray-200 py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                      >
                        <option value="">Selecione um veículo</option>
                        {vehicles.map(vehicle => (
                          <option key={vehicle.id} value={vehicle.id}>
                            {vehicle.placa} - {vehicle.modelo}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Motivo da Manutenção
                      </label>
                      <textarea
                        value={newMaintenance.reason}
                        onChange={(e) => setNewMaintenance(prev => ({ ...prev, reason: e.target.value }))}
                        className="w-full rounded-lg border border-gray-200 py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        rows={3}
                        required
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Prioridade
                        </label>
                        <select
                          value={newMaintenance.priority}
                          onChange={(e) => setNewMaintenance(prev => ({ ...prev, priority: e.target.value as Prioridade }))}
                          className="w-full rounded-lg border border-gray-200 py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="low">Baixa</option>
                          <option value="normal">Normal</option>
                          <option value="high">Alta</option>
                          <option value="urgent">Urgente</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Custo Estimado
                        </label>
                        <input
                          type="text"
                          value={newMaintenance.estimatedCost}
                          onChange={(e) => setNewMaintenance(prev => ({ ...prev, estimatedCost: e.target.value }))}
                          className="w-full rounded-lg border border-gray-200 py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="R$ 0,00"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Observações
                      </label>
                      <textarea
                        value={newMaintenance.notes}
                        onChange={(e) => setNewMaintenance(prev => ({ ...prev, notes: e.target.value }))}
                        className="w-full rounded-lg border border-gray-200 py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        rows={2}
                      />
                    </div>
                  </div>

                  <div className="mt-6 flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => setShowNewMaintenanceModal(false)}
                      className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 rounded-lg bg-blue-600 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                    >
                      Criar Manutenção
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
} 