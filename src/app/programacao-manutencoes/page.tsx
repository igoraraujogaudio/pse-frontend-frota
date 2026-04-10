'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAuth } from '@/contexts/AuthContext';
import { useModularPermissions, PERMISSION_CODES } from '@/hooks/useModularPermissions';
import PermissionGuard from '@/components/PermissionGuard';
import { NetworkMaintenanceService } from '@/services/networkMaintenanceService';
import { OperacoesAtividadesService } from '@/services/operacoesAtividadesService';
import { EquipesComEncarregadoService, EquipeComEncarregado } from '@/services/equipesComEncarregadoService';
import { supabase } from '@/lib/supabase';
import { ActivityStatus } from '@/types/maintenance-schedule';
import { OperacaoPadrao, AtividadeComOperacao } from '@/types/operacoes-atividades';
import { normalizeColumnMapping, ColumnMappingValue } from '@/config/contratos-sharepoint';
import dynamic from 'next/dynamic';
import { Label } from '@/components/ui/label';

// Importar o mapa dinamicamente para evitar problemas de SSR
const InteractiveMap = dynamic(() => import('@/components/InteractiveMap'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-96 bg-gray-50 rounded-lg">
      <div className="text-center">
        <div className="text-4xl mb-4">🗺️</div>
        <p className="text-gray-600">Carregando mapa...</p>
      </div>
    </div>
  ),
});

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

const DAYS_OF_WEEK = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

// Tipo para funcionário usado no modal de encarregados
type FuncionarioBasico = {
  id: string;
  nome: string;
  matricula?: string;
  cargo?: string;
  status: string;
};

// Tipos para compatibilidade com a interface existente
type SimpleActivity = { 
  id?: string;
  team: string; 
  osNumber: string; 
  value: number; 
  status: ActivityStatus; 
  location: string; 
  date?: string;
  statusNotes?: string;
  notes?: string;
  prioridade?: string;
  atividade?: string;
  pontoEletrico?: string;
  inicioIntervencao?: string;
  terminoIntervencao?: string;
  tipoSGD?: string;
  numeroSGD?: string;
  obs?: string;
  apoio?: string;
  horarioInicio?: string;
  horarioFim?: string;
  tipoServico?: string;
  critico?: string;
  coordenada?: string;
};
type ActivitiesByDate = Record<string, SimpleActivity[]>;

// const STATUS_COLORS = {
//   [ActivityStatus.PANP]: 'bg-yellow-100 text-yellow-800 border-yellow-200',
//   [ActivityStatus.CANC]: 'bg-red-100 text-red-800 border-red-200',
//   [ActivityStatus.EXEC]: 'bg-green-100 text-green-800 border-green-200',
//   [ActivityStatus.PROG]: 'bg-blue-100 text-blue-800 border-blue-200',
//   [ActivityStatus.PARP]: 'bg-orange-100 text-orange-800 border-orange-200'
// };

// const STATUS_LABELS = {
//   [ActivityStatus.PANP]: 'Programada Não Paga',
//   [ActivityStatus.CANC]: 'Cancelada',
//   [ActivityStatus.EXEC]: 'Executada',
//   [ActivityStatus.PROG]: 'Programada',
//   [ActivityStatus.PARP]: 'Parada'
// };

// Componente de lançamento direto
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function QuickAddForm({ onActivityAdded }: { onActivityAdded?: () => void }) {
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    team: '',
    osNumber: '',
    value: '',
    status: ActivityStatus.PROG,
    location: '',
    notes: '',
    operacao: '',
    atividade: ''
  });

  const [operacoes, setOperacoes] = useState<OperacaoPadrao[]>([]);
  const [atividades, setAtividades] = useState<AtividadeComOperacao[]>([]);
  const [loadingOperacoes, setLoadingOperacoes] = useState(true);

  // Carregar operações e atividades
  useEffect(() => {
    const loadOperacoesAtividades = async () => {
      try {
        setLoadingOperacoes(true);
        const [operacoesData, atividadesData] = await Promise.all([
          OperacoesAtividadesService.getOperacoes({ ativo: true }),
          OperacoesAtividadesService.getAtividades({ ativo: true })
        ]);
        setOperacoes(operacoesData);
        setAtividades(atividadesData);
      } catch (error) {
        console.error('Erro ao carregar operações e atividades:', error);
      } finally {
        setLoadingOperacoes(false);
      }
    };

    loadOperacoesAtividades();
  }, []);

  // Filtrar atividades por operação selecionada
  const atividadesFiltradas = formData.operacao 
    ? atividades.filter(at => at.operacaoId === formData.operacao)
    : atividades;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    try {
      const dateObj = new Date(formData.date);
      
      // Buscar ou criar programação
      const schedules = await NetworkMaintenanceService.getSchedulesByDateRange(formData.date, formData.date);
      let scheduleId: string;
      
      if (schedules.length > 0) {
        scheduleId = schedules[0].id;
      } else {
        const newSchedule = await NetworkMaintenanceService.createSchedule({
          date: formData.date,
          dayOfWeek: dateObj.getDay()
        });
        scheduleId = newSchedule.id;
      }

      // Adicionar atividade
      await NetworkMaintenanceService.addActivity({
        scheduleId,
      team: formData.team,
      osNumber: formData.osNumber,
      value: parseFloat(formData.value),
      status: formData.status,
        location: formData.location,
        notes: formData.notes || undefined
      });

      // Recarregar dados
      onActivityAdded?.();

    // Reset form
    setFormData({
      date: new Date().toISOString().split('T')[0],
      team: '',
      osNumber: '',
      value: '',
        status: ActivityStatus.PROG,
        location: '',
        notes: '',
        operacao: '',
        atividade: ''
    });

    alert('OS adicionada com sucesso!');
    } catch (err) {
      console.error('Erro ao adicionar atividade:', err);
      alert('Erro ao adicionar atividade. Tente novamente.');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Data *</label>
          <Input
            type="date"
            value={formData.date}
            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Operação</label>
          <Select
            value={formData.operacao}
            onValueChange={(value) => setFormData({ ...formData, operacao: value, atividade: '' })}
            disabled={loadingOperacoes}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione uma operação" />
            </SelectTrigger>
            <SelectContent>
              {operacoes.map((operacao) => (
                <SelectItem key={operacao.id} value={operacao.id}>
                  {operacao.nome} ({operacao.codigo})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Atividade</label>
          <Select
            value={formData.atividade}
            onValueChange={(value) => setFormData({ ...formData, atividade: value })}
            disabled={loadingOperacoes || !formData.operacao}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione uma atividade" />
            </SelectTrigger>
            <SelectContent>
              {atividadesFiltradas.map((atividade) => (
                <SelectItem key={atividade.id} value={atividade.id}>
                  {atividade.nome} ({atividade.codigo})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Equipe *</label>
          <Input
            type="text"
            value={formData.team}
            onChange={(e) => setFormData({ ...formData, team: e.target.value })}
            placeholder="Ex: MK 01, LV 01, CESTO 01"
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Número da OS *</label>
          <Input
            type="text"
            value={formData.osNumber}
            onChange={(e) => setFormData({ ...formData, osNumber: e.target.value })}
            placeholder="Ex: A045420293"
            className="font-mono"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Valor (R$) *</label>
          <Input
            type="number"
            step="0.01"
            value={formData.value}
            onChange={(e) => setFormData({ ...formData, value: e.target.value })}
            placeholder="0,00"
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Status *</label>
          <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value as ActivityStatus })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="PROG">PROG - Programada</SelectItem>
              <SelectItem value="PANP">PANP - Parcial Não Planejada</SelectItem>
              <SelectItem value="EXEC">EXEC - Executada</SelectItem>
              <SelectItem value="CANC">CANC - Cancelada</SelectItem>
              <SelectItem value="PARP">PARP - Parcial Planejada</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Localização *</label>
          <Input
            type="text"
            value={formData.location}
            onChange={(e) => setFormData({ ...formData, location: e.target.value })}
            placeholder="Ex: NITEROI"
            required
          />
        </div>
      </div>

      <div className="flex justify-end">
        <Button type="submit" className="bg-green-600 hover:bg-green-700">
          ➕ Adicionar OS
        </Button>
      </div>
    </form>
  );
}

export default function ProgramacaoManutencoes() {
  return (
    <PermissionGuard requiredPermissions={[PERMISSION_CODES.PROGRAMACAO.VISUALIZAR_CALENDARIO]}>
      <ProgramacaoManutencoesContent />
    </PermissionGuard>
  );
}

// Componente para item de equipe com encarregado
function EquipeEncarregadoItem({ 
  equipe, 
  funcionarios, 
  onUpdateEncarregado 
}: { 
  equipe: EquipeComEncarregado; 
  funcionarios: FuncionarioBasico[]; 
  onUpdateEncarregado: (equipeId: string, encarregadoId: string | null) => Promise<void>;
}) {
  const [encarregadoSearch, setEncarregadoSearch] = useState(
    equipe.encarregadoNome && equipe.encarregadoMatricula
      ? `${equipe.encarregadoNome} - ${equipe.encarregadoMatricula}`
      : ''
  );
  const [showDropdown, setShowDropdown] = useState(false);
  const [updating, setUpdating] = useState(false);

  const funcionariosFiltrados = funcionarios.filter(f =>
    f.nome.toLowerCase().includes(encarregadoSearch.toLowerCase()) ||
    f.matricula?.toLowerCase().includes(encarregadoSearch.toLowerCase())
  );

  const handleSelectEncarregado = async (funcionario: FuncionarioBasico) => {
    setUpdating(true);
    try {
      await onUpdateEncarregado(equipe.id, funcionario.id);
      setEncarregadoSearch(`${funcionario.nome} - ${funcionario.matricula}`);
      setShowDropdown(false);
    } catch (error) {
      console.error('Erro ao atualizar encarregado:', error);
    } finally {
      setUpdating(false);
    }
  };

  const handleRemoveEncarregado = async () => {
    setUpdating(true);
    try {
      await onUpdateEncarregado(equipe.id, null);
      setEncarregadoSearch('');
    } catch (error) {
      console.error('Erro ao remover encarregado:', error);
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="border rounded-lg p-4 space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="font-semibold text-gray-900">{equipe.nome}</h4>
          <p className="text-sm text-gray-600">
            {equipe.prefixo} • {equipe.operacaoNome}
          </p>
        </div>
      </div>
      <div className="relative">
        <Label htmlFor={`encarregado-${equipe.id}`} className="text-sm">
          Encarregado
        </Label>
        <Input
          id={`encarregado-${equipe.id}`}
          value={encarregadoSearch}
          onChange={(e) => {
            setEncarregadoSearch(e.target.value);
            setShowDropdown(true);
          }}
          onFocus={() => setShowDropdown(true)}
          onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
          placeholder="Buscar por nome ou matrícula..."
          className="w-full"
          disabled={updating}
        />
        {equipe.encarregadoId && !updating && (
          <button
            type="button"
            onClick={handleRemoveEncarregado}
            className="absolute right-2 top-8 text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>
        )}
        {showDropdown && encarregadoSearch && funcionariosFiltrados.length > 0 && (
          <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-auto">
            {funcionariosFiltrados.map(funcionario => (
              <button
                key={funcionario.id}
                type="button"
                onClick={() => handleSelectEncarregado(funcionario)}
                className={`w-full text-left px-3 py-2 hover:bg-gray-100 transition-colors ${
                  equipe.encarregadoId === funcionario.id ? 'bg-blue-50' : ''
                }`}
              >
                <div className="font-medium">{funcionario.nome}</div>
                <div className="text-sm text-gray-500">
                  Matrícula: {funcionario.matricula} • {funcionario.cargo}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ProgramacaoManutencoesContent() {
  useAuth();
  const { hasPermission } = useModularPermissions();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [draggedActivity, setDraggedActivity] = useState<(SimpleActivity & { sourceDate: string }) | null>(null);
  const [viewingActivity, setViewingActivity] = useState<(SimpleActivity & { date: string }) | null>(null);
  const [activities, setActivities] = useState<ActivitiesByDate>({});
  const [dashboardActivities, setDashboardActivities] = useState<ActivitiesByDate>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [equipesFixas, setEquipesFixas] = useState<EquipeComEncarregado[]>([]);
  const [showEquipeModal, setShowEquipeModal] = useState(false);
  const [selectedEquipe, setSelectedEquipe] = useState<EquipeComEncarregado | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<{ success?: boolean; message?: string } | null>(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedContrato, setSelectedContrato] = useState<string>('');
  const [contratos, setContratos] = useState<Array<{ id: string; nome: string }>>([]);
  const [contratoConfig, setContratoConfig] = useState<{ 
    sharePointUrl?: string; 
    headerRow?: number; 
    sheetName?: string;
    equipesFixas?: string[];
    columnMapping?: Record<string, unknown>; // Para acessar labels customizados
    buscarEquipePorEncarregado?: boolean;
  } | null>(null);
  
  // Estados para modal de encarregados
  const [showEncarregadosModal, setShowEncarregadosModal] = useState(false);
  const [equipesComEncarregado, setEquipesComEncarregado] = useState<EquipeComEncarregado[]>([]);
  const [funcionarios, setFuncionarios] = useState<FuncionarioBasico[]>([]);
  const [loadingEncarregados, setLoadingEncarregados] = useState(false);

  // Filtros do mapa
  const [mapFilterStatus, setMapFilterStatus] = useState<string>('todos');
  const [mapFilterCritico, setMapFilterCritico] = useState<string>('todos');
  const [mapFilterMonth, setMapFilterMonth] = useState<number>(new Date().getMonth());
  const [mapFilterYear, setMapFilterYear] = useState<number>(new Date().getFullYear());
  const [mapFilterDay, setMapFilterDay] = useState<string>('todos'); // 'todos' ou número do dia
  const [mapFilterTeam, setMapFilterTeam] = useState<string>('todas'); // 'todas' ou nome da equipe

  // Estado específico para visualização do mapa (múltiplas equipes)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [viewingMapActivities, setViewingMapActivities] = useState<SimpleActivity[] | null>(null);

  // Estado separado para atividades do mapa (ano inteiro)
  const [mapActivities, setMapActivities] = useState<ActivitiesByDate>({});

  // Verificar permissões específicas
  const canSyncSharePoint = hasPermission(PERMISSION_CODES.PROGRAMACAO.SINCRONIZAR_SHAREPOINT);

  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();

  // Estados para filtro de período do Dashboard (declarar antes de loadActivities)
  const [dashboardStartMonth, setDashboardStartMonth] = useState(currentMonth);
  const [dashboardStartYear, setDashboardStartYear] = useState(currentYear);
  const [dashboardEndMonth, setDashboardEndMonth] = useState(currentMonth);
  const [dashboardEndYear, setDashboardEndYear] = useState(currentYear);
  const [dashboardStartDay, setDashboardStartDay] = useState<string>('todos');
  const [dashboardEndDay, setDashboardEndDay] = useState<string>('todos');

  // Filtrar atividades do mapa
  const getFilteredMapActivities = useCallback(() => {
    // Obter nomes das equipes do contrato selecionado
    const equipesContrato = equipesFixas
      .filter(equipe => {
        if (!selectedContrato) return false;
        const contrato = contratos.find(c => c.nome === selectedContrato);
        if (!contrato) return false;
        return equipe.contratoId === contrato.id;
      })
      .map(equipe => equipe.prefixo || equipe.nome);

    // Usar mapActivities (ano inteiro) em vez de activities (mês atual)
    const allActivities = Object.entries(mapActivities)
      .flatMap(([date, acts]) =>
        acts.map(act => ({ ...act, date }))
      )
      .filter(a => a.coordenada);

    return allActivities.filter(activity => {
      // Filtrar apenas atividades de equipes do contrato selecionado
      if (selectedContrato && !equipesContrato.includes(activity.team)) {
        return false;
      }

      // Filtro de mês/ano
      const activityDate = new Date(activity.date);
      if (activityDate.getMonth() !== mapFilterMonth || activityDate.getFullYear() !== mapFilterYear) {
        return false;
      }

      // Filtro de dia
      if (mapFilterDay !== 'todos') {
        const day = activityDate.getDate();
        if (day !== parseInt(mapFilterDay)) {
          return false;
        }
      }

      // Filtro de status
      if (mapFilterStatus !== 'todos' && activity.status !== mapFilterStatus) {
        return false;
      }

      // Filtro de crítico
      if (mapFilterCritico === 'sim' && activity.critico?.toUpperCase() !== 'SIM') {
        return false;
      }
      if (mapFilterCritico === 'nao' && activity.critico?.toUpperCase() === 'SIM') {
        return false;
      }

      // Filtro de equipe
      if (mapFilterTeam !== 'todas' && activity.team !== mapFilterTeam) {
        return false;
      }

      return true;
    });
  }, [mapActivities, mapFilterMonth, mapFilterYear, mapFilterDay, mapFilterStatus, mapFilterCritico, mapFilterTeam, selectedContrato, contratos, equipesFixas]);

  // Carregar dados do banco
  const loadActivities = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Obter contratoId do contrato selecionado
      let contratoId: string | undefined;
      if (selectedContrato) {
        console.log(`🔍 Buscando contrato: "${selectedContrato}"`);
        console.log(`📋 Total de contratos disponíveis: ${contratos.length}`);
        console.log(`📋 Nomes dos contratos:`, contratos.map(c => `"${c.nome}"`));
        
        const contrato = contratos.find(c => {
          const nomeMatch = c.nome === selectedContrato;
          if (nomeMatch) {
            console.log(`✅ Contrato encontrado: "${c.nome}" (ID: ${c.id})`);
          }
          return nomeMatch;
        });
        
        contratoId = contrato?.id;
        
        if (!contratoId) {
          console.error(`❌ ERRO: Contrato "${selectedContrato}" não encontrado na lista de contratos!`);
          console.log('📋 Contratos disponíveis:', contratos.map(c => ({ nome: c.nome, id: c.id })));
          setError(`Contrato "${selectedContrato}" não encontrado`);
          setLoading(false);
          return;
        } else {
          console.log(`✅ Contrato encontrado: "${selectedContrato}" (ID: ${contratoId})`);
          console.log(`🔍 Tipo do contratoId:`, typeof contratoId);
          console.log(`🔍 Valor do contratoId:`, contratoId);
        }
      } else {
        console.log('⚠️ Nenhum contrato selecionado - NÃO carregando atividades (selecione um contrato primeiro)');
        // Não carregar atividades se não houver contrato selecionado
        setActivities({});
        setMapActivities({});
        setLoading(false);
        return;
      }
      
      // Para o calendário, carregar apenas o mês atual
      const startDate = new Date(currentYear, currentMonth, 1).toISOString().split('T')[0];
      const endDate = new Date(currentYear, currentMonth + 1, 0).toISOString().split('T')[0];
      
      // Para o mapa, carregar o ano inteiro para permitir filtros por mês
      const startDateYear = new Date(mapFilterYear, 0, 1).toISOString().split('T')[0];
      const endDateYear = new Date(mapFilterYear, 11, 31).toISOString().split('T')[0];
      
      // Para o dashboard, carregar o período selecionado
      const dashStartDay = dashboardStartDay !== 'todos' ? parseInt(dashboardStartDay) : 1;
      const dashEndDay = dashboardEndDay !== 'todos' 
        ? parseInt(dashboardEndDay) 
        : new Date(dashboardEndYear, dashboardEndMonth + 1, 0).getDate();
      
      const dashboardStartDate = new Date(dashboardStartYear, dashboardStartMonth, dashStartDay).toISOString().split('T')[0];
      const dashboardEndDate = new Date(dashboardEndYear, dashboardEndMonth, dashEndDay).toISOString().split('T')[0];
      
      console.log(`📊 Dashboard período: ${dashboardStartDate} a ${dashboardEndDate}`);
      console.log(`   - Dia inicial: ${dashboardStartDay} (raw: "${dashboardStartDay}")`);
      console.log(`   - Dia final: ${dashEndDay} (raw: "${dashboardEndDay}")`);

      // Carregar dados do mês atual (calendário) - filtrar por contrato se selecionado
      const schedules = await NetworkMaintenanceService.getSchedulesByDateRange(startDate, endDate, contratoId);
      
      // Carregar dados do ano inteiro (mapa) - filtrar por contrato se selecionado
      const schedulesYear = await NetworkMaintenanceService.getSchedulesByDateRange(startDateYear, endDateYear, contratoId);

      // Processar atividades do calendário (mês atual)
      const activitiesByDate: ActivitiesByDate = {};
      schedules.forEach(schedule => {
        activitiesByDate[schedule.date] = schedule.activities.map(activity => ({
          id: activity.id,
          team: activity.team,
          osNumber: activity.osNumber,
          value: activity.value,
          status: activity.status,
          location: activity.location,
          statusNotes: activity.statusNotes,
          notes: activity.notes,
          date: schedule.date,
          prioridade: activity.prioridade,
          atividade: activity.atividade,
          pontoEletrico: activity.pontoEletrico,
          inicioIntervencao: activity.inicioIntervencao,
          terminoIntervencao: activity.terminoIntervencao,
          tipoSGD: activity.tipoSGD,
          numeroSGD: activity.numeroSGD,
          obs: activity.obs,
          apoio: activity.apoio,
          horarioInicio: activity.horarioInicio,
          horarioFim: activity.horarioFim,
          tipoServico: activity.tipoServico,
          critico: activity.critico,
          coordenada: activity.coordenada,
        }));
      });

      // Processar atividades do mapa (ano inteiro)
      const mapActivitiesByDate: ActivitiesByDate = {};
      schedulesYear.forEach(schedule => {
        mapActivitiesByDate[schedule.date] = schedule.activities.map(activity => ({
          id: activity.id,
          team: activity.team,
          osNumber: activity.osNumber,
          value: activity.value,
          status: activity.status,
          location: activity.location,
          statusNotes: activity.statusNotes,
          notes: activity.notes,
          date: schedule.date,
          prioridade: activity.prioridade,
          atividade: activity.atividade,
          pontoEletrico: activity.pontoEletrico,
          inicioIntervencao: activity.inicioIntervencao,
          terminoIntervencao: activity.terminoIntervencao,
          tipoSGD: activity.tipoSGD,
          numeroSGD: activity.numeroSGD,
          obs: activity.obs,
          apoio: activity.apoio,
          horarioInicio: activity.horarioInicio,
          horarioFim: activity.horarioFim,
          tipoServico: activity.tipoServico,
          critico: activity.critico,
          coordenada: activity.coordenada,
        }));
      });
      
      setActivities(activitiesByDate);
      setMapActivities(mapActivitiesByDate);
      
      // Carregar dados do dashboard (período selecionado) - separado do calendário
      if (dashboardStartDate !== startDate || dashboardEndDate !== endDate) {
        console.log(`📊 Dashboard: Carregando período ${dashboardStartDate} a ${dashboardEndDate}`);
        const schedulesDashboard = await NetworkMaintenanceService.getSchedulesByDateRange(dashboardStartDate, dashboardEndDate, contratoId);
        console.log(`📊 Dashboard: ${schedulesDashboard.length} schedules retornados`);
        
        const dashActivitiesByDate: ActivitiesByDate = {};
        schedulesDashboard.forEach(schedule => {
          dashActivitiesByDate[schedule.date] = schedule.activities.map(activity => ({
            id: activity.id,
            team: activity.team,
            osNumber: activity.osNumber,
            value: activity.value,
            status: activity.status,
            location: activity.location,
            statusNotes: activity.statusNotes,
            notes: activity.notes,
            date: schedule.date,
            prioridade: activity.prioridade,
            atividade: activity.atividade,
            pontoEletrico: activity.pontoEletrico,
            inicioIntervencao: activity.inicioIntervencao,
            terminoIntervencao: activity.terminoIntervencao,
            tipoSGD: activity.tipoSGD,
            numeroSGD: activity.numeroSGD,
            obs: activity.obs,
            apoio: activity.apoio,
            horarioInicio: activity.horarioInicio,
            horarioFim: activity.horarioFim,
            tipoServico: activity.tipoServico,
            critico: activity.critico,
            coordenada: activity.coordenada,
          }));
        });
        
        const totalDashActivities = Object.values(dashActivitiesByDate).flat().length;
        console.log(`📊 Dashboard: ${totalDashActivities} atividades processadas`);
        
        setDashboardActivities(dashActivitiesByDate);
      } else {
        console.log(`📊 Dashboard: Usando mesmos dados do calendário (período igual)`);
        // Se o período do dashboard é igual ao do calendário, usar os mesmos dados
        setDashboardActivities(activitiesByDate);
      }
    } catch (err) {
      console.error('Erro ao carregar atividades:', err);
      setError('Erro ao carregar dados. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }, [currentYear, currentMonth, mapFilterYear, selectedContrato, contratos, dashboardStartYear, dashboardStartMonth, dashboardStartDay, dashboardEndYear, dashboardEndMonth, dashboardEndDay]);

  // Carregar equipes fixas do contrato selecionado
  const loadEquipesFixas = useCallback(async () => {
    try {
      if (!selectedContrato) {
        setEquipesFixas([]);
        return;
      }

      // Buscar contratoId
      const contrato = contratos.find(c => c.nome === selectedContrato);
      if (!contrato) {
        setEquipesFixas([]);
        return;
      }

      // Se o contrato tem equipes fixas configuradas, usar apenas essas
      if (contratoConfig?.equipesFixas && contratoConfig.equipesFixas.length > 0) {
        console.log(`🔍 Buscando equipes fixas para ${selectedContrato}:`, contratoConfig.equipesFixas);
        
        // Buscar todas as equipes do contrato
        const todasEquipes = await EquipesComEncarregadoService.getEquipesComEncarregado(contrato.id);
        console.log(`📋 Total de equipes encontradas no contrato: ${todasEquipes.length}`);
        
        // Filtrar equipes que correspondem às equipes fixas configuradas
        // Comparar tanto pelo nome quanto pelo prefixo
        const equipesFiltradas = todasEquipes.filter(equipe => {
          const nomeEquipe = equipe.nome;
          const prefixoEquipe = equipe.prefixo || '';
          const nomeCompleto = prefixoEquipe || nomeEquipe;
          
          // Verificar se alguma das equipes fixas corresponde ao nome ou prefixo
          const corresponde = contratoConfig.equipesFixas!.some(equipeFixa => {
            // Comparação exata (case-insensitive)
            const equipeFixaUpper = equipeFixa.toUpperCase().trim();
            const nomeEquipeUpper = nomeEquipe.toUpperCase().trim();
            const prefixoEquipeUpper = prefixoEquipe.toUpperCase().trim();
            const nomeCompletoUpper = nomeCompleto.toUpperCase().trim();
            
            return equipeFixaUpper === nomeEquipeUpper || 
                   equipeFixaUpper === prefixoEquipeUpper || 
                   equipeFixaUpper === nomeCompletoUpper ||
                   nomeEquipeUpper.includes(equipeFixaUpper) ||
                   prefixoEquipeUpper.includes(equipeFixaUpper) ||
                   nomeCompletoUpper.includes(equipeFixaUpper);
          });
          
          if (corresponde) {
            console.log(`✅ Equipe encontrada: "${nomeEquipe}" (prefixo: "${prefixoEquipe}") corresponde a uma equipe fixa`);
          }
          
          return corresponde;
        });
        
        console.log(`✅ Usando ${equipesFiltradas.length} equipes fixas configuradas para ${selectedContrato} (de ${contratoConfig.equipesFixas.length} configuradas)`);
        
        // Se não encontrou nenhuma equipe correspondente, criar equipes "virtuais" com os nomes das equipes fixas
        if (equipesFiltradas.length === 0) {
          console.log(`⚠️ Nenhuma equipe encontrada correspondendo às equipes fixas. Criando equipes virtuais...`);
          const equipesVirtuais = contratoConfig.equipesFixas.map(nomeEquipe => ({
            id: `virtual-${nomeEquipe}`,
            nome: nomeEquipe,
            prefixo: nomeEquipe,
            operacao: '',
            operacaoNome: '',
            setor: '',
            encarregadoId: null,
            encarregadoNome: '',
            encarregadoMatricula: '',
            contratoId: contrato.id,
            contratoNome: selectedContrato
          }));
          setEquipesFixas(equipesVirtuais);
          console.log(`✅ Criadas ${equipesVirtuais.length} equipes virtuais para ${selectedContrato}`);
        } else {
          setEquipesFixas(equipesFiltradas);
        }
      } else {
        // Se não tem equipes fixas configuradas, buscar todas as equipes do contrato que requerem encarregado
        const equipes = await EquipesComEncarregadoService.getEquipesComEncarregado(contrato.id);
        setEquipesFixas(equipes);
        console.log(`✅ Usando ${equipes.length} equipes do contrato ${selectedContrato} (sem equipes fixas configuradas)`);
      }
    } catch (err) {
      console.error('Erro ao carregar equipes:', err);
      setEquipesFixas([]);
    }
  }, [selectedContrato, contratos, contratoConfig]);

  // Carregar contratos disponíveis
  useEffect(() => {
    const loadContratos = async () => {
      try {
        const response = await fetch('/api/contratos');
        const data = await response.json();
        if (data.contratos) {
          setContratos(data.contratos);
          // Selecionar o primeiro contrato por padrão
          if (data.contratos.length > 0) {
            setSelectedContrato(prev => prev || data.contratos[0].nome);
          }
        }
      } catch (err) {
        console.error('Erro ao carregar contratos:', err);
      }
    };
    loadContratos();
  }, []);

  // Carregar configuração do contrato selecionado
  useEffect(() => {
    const loadContratoConfig = async () => {
      if (!selectedContrato) {
        setContratoConfig(null);
        return;
      }

      try {
        const response = await fetch(`/api/admin/sharepoint-config?contrato=${encodeURIComponent(selectedContrato)}`);
        const data = await response.json();
        
        if (data.success && data.config) {
          setContratoConfig({
            sharePointUrl: data.config.sharepoint_url,
            headerRow: data.config.header_row || 1,
            sheetName: data.config.sheet_name,
            equipesFixas: data.config.equipes_fixas || [],
            columnMapping: data.config.column_mapping, // Carregar mapeamento completo para acessar labels
            buscarEquipePorEncarregado: data.config.buscar_equipe_por_encarregado !== false, // Padrão true
          });
        } else {
          // Se não tiver configuração, deixar em branco
          setContratoConfig(null);
        }
      } catch (err) {
        console.error('Erro ao carregar configuração do contrato:', err);
        setContratoConfig(null);
      }
    };

    loadContratoConfig();
  }, [selectedContrato]);

  // Recarregar equipes quando o contrato ou configuração mudar
  useEffect(() => {
    loadEquipesFixas();
  }, [loadEquipesFixas]);

  // Carregar dados quando o componente monta ou o mês muda ou o contrato muda
  useEffect(() => {
    console.log(`🔄 useEffect disparado - mês: ${currentMonth}/${currentYear}, contrato: "${selectedContrato}"`);
    // Só carregar se tiver contratos carregados e um contrato selecionado
    if (contratos.length > 0 && selectedContrato) {
      console.log(`✅ Condições OK - carregando atividades...`);
      loadActivities();
    } else {
      console.log(`⚠️ Não carregando - contratos: ${contratos.length}, selectedContrato: "${selectedContrato}"`);
    }
    loadEquipesFixas();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentYear, currentMonth, mapFilterYear, selectedContrato]);

  // Auto-fechar toast de sincronização após 5 segundos
  useEffect(() => {
    if (syncStatus) {
      const timer = setTimeout(() => {
        setSyncStatus(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [syncStatus]);

  // Calcular estatísticas do mês
  const calculateMonthStats = useCallback(() => {
    const allActivities: SimpleActivity[] = [];
    Object.values(activities).forEach(dayActivities => {
      allActivities.push(...dayActivities);
    });

    const totalActivities = allActivities.length;
    const totalValue = allActivities.reduce((sum, act) => sum + (act.value || 0), 0);
    const avgValue = totalActivities > 0 ? totalValue / totalActivities : 0;

    // Agrupar por status
    const byStatus = allActivities.reduce((acc, act) => {
      acc[act.status] = (acc[act.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Agrupar por equipe
    const byTeam = allActivities.reduce((acc, act) => {
      if (!acc[act.team]) {
        acc[act.team] = {
          count: 0,
          totalValue: 0,
          activities: []
        };
      }
      acc[act.team].count++;
      acc[act.team].totalValue += (act.value || 0);
      acc[act.team].activities.push(act);
      return acc;
    }, {} as Record<string, { count: number; totalValue: number; activities: SimpleActivity[] }>);

    return {
      totalActivities,
      totalValue,
      avgValue,
      byStatus,
      byTeam,
      allActivities
    };
  }, [activities]);

  const navigateMonth = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);
    if (direction === 'prev') {
      newDate.setMonth(newDate.getMonth() - 1);
    } else {
      newDate.setMonth(newDate.getMonth() + 1);
    }
    setCurrentDate(newDate);
  };

  // Exportar relatório para Excel
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleExportExcel = useCallback(() => {
    const stats = calculateMonthStats();
    const monthName = MONTHS[currentMonth];
    const year = currentYear;

    // Criar CSV
    let csv = `Relatório de Programação - ${monthName} ${year}\n\n`;
    
    // Resumo Geral
    csv += `RESUMO GERAL\n`;
    csv += `Total de Atividades,${stats.totalActivities}\n`;
    csv += `Valor Total,R$ ${stats.totalValue.toFixed(2)}\n`;
    csv += `Valor Médio,R$ ${stats.avgValue.toFixed(2)}\n\n`;
    
    // Por Status
    csv += `ATIVIDADES POR STATUS\n`;
    csv += `Status,Quantidade\n`;
    Object.entries(stats.byStatus).forEach(([status, count]) => {
      csv += `${status},${count}\n`;
    });
    csv += `\n`;
    
    // Por Equipe
    csv += `ATIVIDADES POR EQUIPE\n`;
    csv += `Equipe,Quantidade,Valor Total,Valor Médio\n`;
    Object.entries(stats.byTeam)
      .sort((a, b) => b[1].count - a[1].count)
      .forEach(([team, data]) => {
        const avgTeam = data.count > 0 ? data.totalValue / data.count : 0;
        csv += `${team},${data.count},R$ ${data.totalValue.toFixed(2)},R$ ${avgTeam.toFixed(2)}\n`;
      });
    csv += `\n`;
    
    // Detalhamento de Atividades
    csv += `DETALHAMENTO DE ATIVIDADES\n`;
    csv += `Data,Equipe,Número OS,Status,Valor,Localização,Observações\n`;
    
    // Ordenar por data
    const sortedDates = Object.keys(activities).sort();
    sortedDates.forEach(date => {
      activities[date].forEach(activity => {
        const formattedDate = new Date(date).toLocaleDateString('pt-BR');
        csv += `${formattedDate},${activity.team},"${activity.osNumber}",${activity.status},"R$ ${(activity.value || 0).toFixed(2)}","${activity.location}","${(activity.notes || '').replace(/"/g, '""')}"\n`;
      });
    });

    // Download do arquivo
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Relatorio_Programacao_${monthName}_${year}.csv`;
    link.click();
  }, [activities, currentMonth, currentYear, calculateMonthStats]);

  const getDaysInMonth = () => {
    const firstDay = new Date(currentYear, currentMonth, 1);
    const lastDay = new Date(currentYear, currentMonth + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days = [];

    // Dias vazios do mês anterior
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }

    // Dias do mês atual
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(day);
    }

    return days;
  };

  const getActivitiesForDate = (day: number): SimpleActivity[] => {
    const dateStr = `${currentYear}-${(currentMonth + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
    return activities[dateStr] || [];
  };


  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>, targetDate: string) => {
    e.preventDefault();
    if (!draggedActivity) return;

    try {
      // Atualizar no banco de dados
      if (draggedActivity.id) {
        // Buscar programação da data de destino
        const targetSchedules = await NetworkMaintenanceService.getSchedulesByDateRange(targetDate, targetDate);
        let targetScheduleId: string;
        
        if (targetSchedules.length > 0) {
          targetScheduleId = targetSchedules[0].id;
        } else {
          // Criar nova programação se não existir
          const newSchedule = await NetworkMaintenanceService.createSchedule({
            date: targetDate,
            dayOfWeek: new Date(targetDate).getDay()
          });
          targetScheduleId = newSchedule.id;
        }

        // Atualizar atividade
        await NetworkMaintenanceService.updateActivity(draggedActivity.id, {
          scheduleId: targetScheduleId
        });
      }

      // Recarregar dados
      await loadActivities();
    setDraggedActivity(null);
    } catch (err) {
      console.error('Erro ao mover atividade:', err);
      setError('Erro ao mover atividade. Tente novamente.');
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleSetupDatabase = async () => {
    try {
      const response = await fetch('/api/setup-network-maintenance');
      const result = await response.json();
      alert(result.message || 'Banco configurado com sucesso!');
    } catch {
      alert('Erro ao configurar banco de dados');
    }
  };

  // Função para carregar dados de encarregados
  const loadEncarregadosData = async () => {
    if (!selectedContrato) return;
    
    setLoadingEncarregados(true);
    try {
      const contrato = contratos.find(c => c.nome === selectedContrato);
      if (!contrato) return;

      // Carregar equipes do contrato
      const equipes = await EquipesComEncarregadoService.getEquipesComEncarregado(contrato.id);
      setEquipesComEncarregado(equipes);

      // Carregar funcionários ativos
      const { data: usuariosData, error } = await supabase
        .from('usuarios')
        .select('id, nome, matricula, cargo, status')
        .eq('status', 'ativo')
        .order('nome', { ascending: true });

      if (error) throw error;
      setFuncionarios(usuariosData || []);
    } catch (error) {
      console.error('Erro ao carregar dados de encarregados:', error);
    } finally {
      setLoadingEncarregados(false);
    }
  };

  // Função para atualizar encarregado de uma equipe
  const updateEncarregado = async (equipeId: string, encarregadoId: string | null) => {
    try {
      const { error } = await supabase
        .from('equipes')
        .update({ encarregado_id: encarregadoId })
        .eq('id', equipeId);

      if (error) throw error;

      // Atualizar estado local
      setEquipesComEncarregado(prev => prev.map(eq => {
        if (eq.id === equipeId) {
          const encarregado = encarregadoId ? funcionarios.find(f => f.id === encarregadoId) : null;
          return {
            ...eq,
            encarregadoId: encarregadoId || undefined,
            encarregadoNome: encarregado?.nome || undefined,
            encarregadoMatricula: encarregado?.matricula || undefined,
          };
        }
        return eq;
      }));
    } catch (error) {
      console.error('Erro ao atualizar encarregado:', error);
      throw error;
    }
  };

  const handleSyncSharePoint = async () => {
    if (!selectedContrato) {
      setSyncStatus({
        success: false,
        message: 'Selecione um contrato antes de sincronizar'
      });
      return;
    }

    try {
      setSyncing(true);
      
      console.log('🔄 Iniciando sincronização com SharePoint...', selectedContrato);
      
      const response = await fetch(`/api/programacao/sync-sharepoint?contrato=${encodeURIComponent(selectedContrato)}`, {
        method: 'POST',
      });
      
      const result = await response.json();
      
      if (response.ok && result.success) {
        setSyncStatus({
          success: true,
          message: `${result.totalCreated} atividades importadas`
        });
        
        // Recarregar dados
        await loadActivities();
        
        // Mostrar warnings se houver
        if (result.warnings && result.warnings.length > 0) {
          console.warn('⚠️ Avisos:', result.warnings);
        }
      } else {
        setSyncStatus({
          success: false,
          message: `${result.error || 'Erro desconhecido'}`
        });
      }
    } catch (error) {
      console.error('❌ Erro na sincronização:', error);
      setSyncStatus({
        success: false,
        message: 'Erro ao conectar com o servidor'
      });
    } finally {
      setSyncing(false);
    }
  };

  const days = getDaysInMonth();

  // Recarregar atividades quando o período do dashboard mudar
  useEffect(() => {
    if (activeTab === 'dashboard' && selectedContrato) {
      // Recarregar atividades do período do dashboard
      loadActivities();
    }
  }, [dashboardStartMonth, dashboardStartYear, dashboardEndMonth, dashboardEndYear, activeTab, selectedContrato, loadActivities]);

  // Effect para fechar calendários do dashboard ao clicar fora
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const startCalendar = document.getElementById('dashboard-start-calendar');
      const endCalendar = document.getElementById('dashboard-end-calendar');
      const target = e.target as HTMLElement;
      
      // Verificar se o clique foi no botão ou dentro do calendário
      const isStartButton = target.closest('[data-calendar-button="start"]');
      const isInsideStartCalendar = startCalendar && startCalendar.contains(target);
      
      const isEndButton = target.closest('[data-calendar-button="end"]');
      const isInsideEndCalendar = endCalendar && endCalendar.contains(target);
      
      // Só fechar se clicar fora do botão E fora do calendário
      if (startCalendar && !isStartButton && !isInsideStartCalendar && !startCalendar.classList.contains('hidden')) {
        startCalendar.classList.remove('calendar-dropdown-open');
        setTimeout(() => startCalendar.classList.add('hidden'), 200);
      }
      
      if (endCalendar && !isEndButton && !isInsideEndCalendar && !endCalendar.classList.contains('hidden')) {
        endCalendar.classList.remove('calendar-dropdown-open');
        setTimeout(() => endCalendar.classList.add('hidden'), 200);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  // Função para calcular dados do dashboard
  type TeamStat = { 
    team: string; 
    totalValue: number; 
    osCount: number; 
    statusCount: { PROG: number; PANP: number; EXEC: number; CANC: number; PARP: number };
    programmedValue: number;
    executedValue: number;
    criticalCount: number;
    expiredCount: number;
    avgDaysOpen: number;
  };
  type DashboardData = { 
    teamStats: TeamStat[]; 
    totalValue: number; 
    totalOS: number; 
    totalTeams: number;
    programmedValue: number;
    executedValue: number;
    criticalOS: number;
    expiredOS: number;
    avgTicket: number;
    avgDaysOpen: number;
  };
  const getDashboardData = (): DashboardData => {
    // Usar atividades do dashboard que já foram carregadas com o período correto
    const allActivities: SimpleActivity[] = (Object.values(dashboardActivities) as SimpleActivity[][]).flat();

    // Inicializar teamStats com TODAS as equipes fixas do contrato selecionado (mesmo sem OSs)
    const teamStats: Record<string, TeamStat> = {};
    
    // Filtrar equipes fixas do contrato selecionado
    const equipesContrato = equipesFixas.filter(equipe => {
      if (!selectedContrato) return false;
      const contrato = contratos.find(c => c.nome === selectedContrato);
      if (!contrato) return false;
      return equipe.contratoId === contrato.id;
    });
    
    equipesContrato.forEach(equipe => {
      const teamName = equipe.prefixo || equipe.nome;
      teamStats[teamName] = {
        team: teamName,
        totalValue: 0,
        osCount: 0,
        statusCount: { PROG: 0, PANP: 0, EXEC: 0, CANC: 0, PARP: 0 },
        programmedValue: 0,
        executedValue: 0,
        criticalCount: 0,
        expiredCount: 0,
        avgDaysOpen: 0
      };
    });

    let totalValue = 0;
    let totalOS = 0;
    let programmedValue = 0;
    let executedValue = 0;
    let criticalOS = 0;
    let expiredOS = 0;
    let totalDaysOpen = 0;
    const now = new Date();

    // Processar atividades e atualizar estatísticas
    allActivities.forEach(activity => {
      // Encontrar equipe fixa correspondente ou criar nova entrada
      let teamKey = activity.team;
      const equipeFixa = equipesFixas.find(eq => 
        activity.team.toLowerCase().includes((eq.prefixo || eq.nome).toLowerCase())
      );
      
      if (equipeFixa) {
        teamKey = equipeFixa.prefixo || equipeFixa.nome;
      }

      if (!teamStats[teamKey]) {
        teamStats[teamKey] = {
          team: teamKey,
          totalValue: 0,
          osCount: 0,
          statusCount: { PROG: 0, PANP: 0, EXEC: 0, CANC: 0, PARP: 0 },
          programmedValue: 0,
          executedValue: 0,
          criticalCount: 0,
          expiredCount: 0,
          avgDaysOpen: 0
        };
      }

      teamStats[teamKey].totalValue += activity.value;
      teamStats[teamKey].osCount += 1;
      teamStats[teamKey].statusCount[activity.status] += 1;

      // Calcular valor programado e executado
      if (activity.status === 'PROG') {
        teamStats[teamKey].programmedValue += activity.value;
        programmedValue += activity.value;
      } else if (activity.status === 'EXEC') {
        teamStats[teamKey].executedValue += activity.value;
        executedValue += activity.value;
      }

      // Contar críticos
      if (activity.critico?.toUpperCase() === 'SIM') {
        teamStats[teamKey].criticalCount += 1;
        criticalOS += 1;
      }

      // Verificar validade (assumindo que validade está no campo validade ou similar)
      // Por enquanto, vamos considerar vencidos baseado na data + 30 dias
      if (activity.date) {
        const activityDate = new Date(activity.date);
        const daysOpen = Math.floor((now.getTime() - activityDate.getTime()) / (1000 * 60 * 60 * 24));
        totalDaysOpen += daysOpen;
        
        // Considerar vencido se estiver aberto há mais de 30 dias e status PROG
        if (activity.status === 'PROG' && daysOpen > 30) {
          teamStats[teamKey].expiredCount += 1;
          expiredOS += 1;
        }
      }

      totalValue += activity.value;
      totalOS += 1;
    });

    // Calcular média de dias em aberto para cada equipe
    Object.keys(teamStats).forEach(teamKey => {
      const teamActivities = allActivities.filter(a => {
        const equipeFixa = equipesFixas.find(eq =>
          a.team.toLowerCase().includes((eq.prefixo || eq.nome).toLowerCase())
        );
        const key = equipeFixa ? (equipeFixa.prefixo || equipeFixa.nome) : a.team;
        return key === teamKey;
      });

      if (teamActivities.length > 0) {
        const totalTeamDays = teamActivities.reduce((sum, a) => {
          if (a.date) {
            const activityDate = new Date(a.date);
            const days = Math.floor((now.getTime() - activityDate.getTime()) / (1000 * 60 * 60 * 24));
            return sum + days;
          }
          return sum;
        }, 0);
        teamStats[teamKey].avgDaysOpen = Math.round(totalTeamDays / teamActivities.length);
      }
    });

    return {
      teamStats: Object.values(teamStats) as TeamStat[],
      totalValue,
      totalOS,
      totalTeams: Object.keys(teamStats).length, // Todas as equipes fixas, mesmo sem OS
      programmedValue,
      executedValue,
      criticalOS,
      expiredOS,
      avgTicket: totalOS > 0 ? totalValue / totalOS : 0,
      avgDaysOpen: totalOS > 0 ? Math.round(totalDaysOpen / totalOS) : 0
    };
  };

  const dashboardData = getDashboardData();

  return (
    <>
      {/* Estilos customizados para barra de rolagem horizontal */}
      <style jsx global>{`
        .overflow-x-auto {
          scrollbar-width: thin;
          scrollbar-color: #cbd5e0 #f7fafc;
          overflow-x: auto;
        }
        .overflow-x-auto::-webkit-scrollbar {
          height: 8px;
        }
        .overflow-x-auto::-webkit-scrollbar-track {
          background: #f7fafc;
          border-radius: 4px;
        }
        .overflow-x-auto::-webkit-scrollbar-thumb {
          background: #cbd5e0;
          border-radius: 4px;
        }
        .overflow-x-auto::-webkit-scrollbar-thumb:hover {
          background: #a0aec0;
        }
        
        /* Garantir que o calendário sempre mostre scroll quando necessário */
        .bg-white.rounded-lg.shadow-lg.overflow-hidden.overflow-x-auto {
          overflow-x: auto !important;
        }
      `}</style>
      
      <div className="min-h-screen bg-gray-50 p-1">
        <div className="w-full mx-auto px-1">
          {/* Header com Abas na mesma linha */}
          <div className="bg-white rounded-lg shadow-lg px-3 py-2 mb-2 relative z-10">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <div className="flex items-center justify-center gap-8">
                <h1 className="text-lg font-bold text-gray-900 flex-shrink-0">
                  Programação - Rede Elétrica
            </h1>

                <TabsList className="grid grid-cols-3 max-w-2xl">
                  <TabsTrigger value="dashboard">📊 Dashboard</TabsTrigger>
                  <TabsTrigger value="calendario">📅 Calendário</TabsTrigger>
                  <TabsTrigger value="mapa">🗺️ Mapa</TabsTrigger>
                </TabsList>
                
                <div className="flex items-center gap-1.5 flex-shrink-0">
              {canSyncSharePoint && (
                    <>
                      <Select value={selectedContrato} onValueChange={setSelectedContrato}>
                        <SelectTrigger className="w-[180px] h-[38px] border-2 border-blue-400 bg-white/90 backdrop-blur-sm shadow-lg">
                          <SelectValue placeholder="Selecione o contrato" />
                        </SelectTrigger>
                        <SelectContent>
                          {contratos.map((contrato) => (
                            <SelectItem key={contrato.id} value={contrato.nome}>
                              {contrato.nome}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <button
                  onClick={handleSyncSharePoint} 
                  disabled={syncing || !selectedContrato}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 bg-white/90 backdrop-blur-sm border-2 border-blue-400 text-blue-600 shadow-lg hover:shadow-xl hover:scale-105 hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                    >
                      {syncing ? (
                        <>
                          <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          <span>Sincronizando...</span>
                        </>
                      ) : (
                        <>
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                          <span>Sincronizar SharePoint</span>
                        </>
                      )}
                    </button>
                    {contratoConfig?.buscarEquipePorEncarregado && selectedContrato && (
                      <button
                        onClick={async () => {
                          await loadEncarregadosData();
                          setShowEncarregadosModal(true);
                        }}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 bg-white/90 backdrop-blur-sm border-2 border-purple-400 text-purple-600 shadow-lg hover:shadow-xl hover:scale-105 hover:bg-purple-50"
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                        </svg>
                        <span>Gerenciar Encarregados</span>
                      </button>
                    )}
                    </>
                  )}
            </div>
          </div>

          {/* Toast Notification para Sincronização */}
          {syncStatus && (
            <div className="fixed top-4 right-4 z-[9999] animate-in slide-in-from-top-2 duration-300">
              <div className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-2xl backdrop-blur-md border-2 ${
                syncStatus.success 
                  ? 'bg-green-50/95 border-green-400 text-green-800' 
                  : 'bg-red-50/95 border-red-400 text-red-800'
              }`}>
                <div className="flex items-center gap-3 flex-1">
                  {syncStatus.success ? (
                    <svg className="h-5 w-5 text-green-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="h-5 w-5 text-red-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  )}
                  <div className="flex flex-col">
                    <span className="font-semibold text-sm">
                      {syncStatus.success ? 'Sincronização Concluída!' : 'Erro na Sincronização'}
                    </span>
                    <span className="text-xs">
                      {syncStatus.message}
                    </span>
        </div>
                </div>
                <button
                  onClick={() => setSyncStatus(null)}
                  className={`flex-shrink-0 p-1 rounded-md transition-colors ${
                    syncStatus.success 
                      ? 'hover:bg-green-200 text-green-600' 
                      : 'hover:bg-red-200 text-red-600'
                  }`}
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          )}

        {/* Loading e Error States */}
        {loading && (
          <div className="flex justify-center items-center py-8">
            <div className="text-lg text-gray-600">Carregando dados...</div>
          </div>
        )}
        
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <div className="text-red-800">{error}</div>
            <Button 
              onClick={loadActivities} 
              variant="outline" 
              size="sm" 
              className="mt-2"
            >
              Tentar novamente
            </Button>
          </div>
        )}
          {/* Calendário Tab */}
          <TabsContent value="calendario" className="space-y-6">
            {/* Navigation */}
            <div className="bg-white rounded-lg shadow-lg p-4">
              <div className="flex items-center justify-between">
                <Button
                  onClick={() => navigateMonth('prev')}
                  variant="outline"
                >
                  ← Anterior
                </Button>

                <h2 className="text-xl font-semibold text-gray-900">
                  {MONTHS[currentMonth]} {currentYear}
                </h2>

                <Button
                  onClick={() => navigateMonth('next')}
                  variant="outline"
                >
                  Próximo →
                </Button>
              </div>
            </div>


            {/* Calendar */}
            <div className="bg-white rounded-lg shadow-lg overflow-auto">
              <style>{`
                .calendar-container {
                  transform-origin: top left;
                  transform: scale(0.9);
                  width: 111.11%;
                }
                .calendar-day {
                  min-width: 0;
                  flex: 1;
                }
              `}</style>
              {/* Calendar days */}
              <div className="divide-y divide-gray-100 calendar-container">
                {days.reduce((weeks, day, index) => {
                  const weekIndex = Math.floor(index / 7);
                  if (!weeks[weekIndex]) {
                    weeks[weekIndex] = [];
                  }
                  weeks[weekIndex].push(day);
                  return weeks;
                }, [] as (number | null)[][]).map((week: (number | null)[], weekIndex: number) => (
                  <div key={weekIndex} className="grid grid-cols-7 min-h-[96px]">
                    {week.map((day: number | null, dayIndex: number) => {
                      if (day === null) {
                        return (
                          <div key={`empty-${weekIndex}-${dayIndex}`} className="bg-gray-50 border-r border-gray-100 last:border-r-0"></div>
                        );
                      }

                      const activities = getActivitiesForDate(day);
                      const totalValue = activities.reduce((sum, activity) => sum + activity.value, 0);
                      const dayName = DAYS_OF_WEEK[dayIndex];

                      return (
                        <div
                          key={`day-${day}`}
                          className="calendar-day border-r border-gray-100 last:border-r-0 bg-white relative p-1 hover:bg-gray-50 transition-colors"
                          onDragOver={handleDragOver}
                          onDrop={(e) => handleDrop(e, `${currentYear}-${(currentMonth + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`)}
                        >
                          {/* Header ultra compacto - MANTÉM TAMANHO DOS TÍTULOS */}
                          <div className="flex justify-between items-center mb-1 bg-gradient-to-r from-blue-600 to-blue-700 text-white px-1 py-1 rounded text-xs font-semibold">
                            <span className="text-xs">{dayName.substring(0, 3).toUpperCase()}</span>
                            <span className="text-sm font-bold">{day}</span>
                            <span className="text-xs">
                              {totalValue > 0 ? `R$ ${(totalValue / 1000).toFixed(1)}k` : 'R$ 0'}
                            </span>
                          </div>

                          {/* Lista Fixa de Equipes com Atividades inline - 20% MAIS COMPACTA */}
                          <div className="space-y-0 mb-1 overflow-x-auto">
                            {equipesFixas.map((equipe) => {
                              const dateStr = `${currentYear}-${(currentMonth + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
                              // Buscar TODAS as atividades desta equipe
                              const atividadesDaEquipe = activities.filter(activity => 
                                activity.team.toLowerCase().includes((equipe.prefixo || equipe.nome).toLowerCase())
                              );

                              // Se não houver atividades, mostrar apenas a equipe vazia
                              if (atividadesDaEquipe.length === 0) {
                                return (
                                  <div
                                    key={`equipe-${equipe.id}-${day}`} 
                                    className="rounded px-1 w-full py-0.5 bg-gray-50 border border-gray-200 flex items-center justify-between"
                                    style={{ fontSize: '8.9px', lineHeight: '12.5px' }}
                                  >
                                    <span className="font-medium text-gray-700 whitespace-nowrap overflow-hidden text-ellipsis">
                                      {equipe.prefixo || equipe.nome}
                                    </span>
                                  </div>
                                );
                              }

                              // Se houver múltiplas OSs, agrupá-las com contorno especial
                              const hasMultipleOS = atividadesDaEquipe.length > 1;

                              return (
                                <div 
                                  key={`equipe-${equipe.id}-${day}`}
                                  className={hasMultipleOS ? 'border-2 border-purple-400 rounded p-0.5 mb-0.5 bg-purple-50' : ''}
                                >
                                  {hasMultipleOS && (
                                    <div className="text-[7px] font-bold text-purple-700 px-1 mb-0.5">
                                      {atividadesDaEquipe.length} OSs
                                    </div>
                                  )}
                                  {atividadesDaEquipe.map((atividade, osIndex) => (
                                    <div
                                      key={`equipe-${equipe.id}-${day}-os-${osIndex}`} 
                                      className={`rounded px-1 w-full py-0 border-2 transition-colors cursor-pointer relative group shadow-sm ${hasMultipleOS && osIndex > 0 ? 'mt-0.5' : ''
                                        } ${atividade.critico?.toUpperCase() === 'SIM'
                                          ? 'border-yellow-500 hover:border-yellow-600'
                                          : 'bg-blue-50 border-blue-300 hover:bg-blue-100'
                                        }`}
                                      style={{
                                        fontSize: '10.8px',
                                        lineHeight: '16.8px',
                                        ...(atividade.critico?.toUpperCase() === 'SIM' && {
                                          background: 'repeating-linear-gradient(45deg, #fef3c7, #fef3c7 10px, #fde68a 10px, #fde68a 20px)'
                                        })
                                      }}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setViewingActivity({ ...atividade, date: dateStr });
                                      }}
                                    >
                                      {/* Mostrar atividade no lugar da linha da equipe - 20% MAIOR */}
                                      <div className="flex items-center justify-between py-0.5 min-w-max">
                                        <div className="flex items-center gap-1 flex-shrink-0">
                                          <span className="font-bold text-gray-800 whitespace-nowrap" style={{ fontSize: '9.2px' }}>
                                            {atividade.team}
                                          </span>
                                          <div className="flex items-center gap-0.5 flex-shrink-0">
                                            <span className={`font-mono font-extrabold text-white rounded ${atividade.status === 'PROG' ? 'bg-blue-600' :
                                              atividade.status === 'PANP' ? 'bg-orange-600' :
                                              atividade.status === 'EXEC' ? 'bg-green-600' :
                                              atividade.status === 'CANC' ? 'bg-red-600' :
                                              atividade.status === 'PARP' ? 'bg-yellow-600' : 'bg-purple-600'
                                              }`} style={{
                                                fontSize: atividade.osNumber.length === 12 && atividade.team.length >= 9 ? '8.3px' : atividade.osNumber.length > 11 && atividade.team.length >= 9 ? '8.7px' : atividade.osNumber.length > 11 ? '9px' : '9.5px',
                                                paddingLeft: '2px',
                                                paddingRight: '2px',
                                                paddingTop: '2px',
                                                paddingBottom: '2px'
                                              }}>
                                              {atividade.osNumber}
                                            </span>
                                            <span className={`font-semibold rounded text-white flex items-center justify-center ${atividade.status === 'PROG' ? 'bg-blue-600' :
                                              atividade.status === 'PANP' ? 'bg-orange-600' :
                                              atividade.status === 'EXEC' ? 'bg-green-600' :
                                              atividade.status === 'CANC' ? 'bg-red-600' :
                                              atividade.status === 'PARP' ? 'bg-yellow-600' : 'bg-purple-600'
                                              }`} style={{ fontSize: '8.5px', paddingLeft: '2.5px', paddingRight: '2.5px', paddingTop: '1.5px', paddingBottom: '1.5px', lineHeight: '1' }}>
                                              {atividade.status}
                                            </span>
                                          </div>
                                        </div>
                                        <span
                                          className="text-emerald-700 font-extrabold"
                                          style={{ fontSize: '10.5px', fontWeight: '900' }}
                                        >
                                          {(atividade.value / 1000).toFixed(1)}k
                                        </span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              );
                            })}
                                      </div>

                          {/* Activities NÃO vinculadas a equipes fixas (se houver) */}
                          <div className="space-y-0 overflow-x-auto">
                            {(() => {
                              // Filtrar atividades não vinculadas
                              const atividadesNaoVinculadas = activities.filter(activity => 
                                !equipesFixas.some(eq => 
                                  activity.team.toLowerCase().includes((eq.prefixo || eq.nome).toLowerCase())
                                )
                              );

                              // Agrupar por equipe
                              const atividadesPorEquipe: Record<string, SimpleActivity[]> = {};
                              atividadesNaoVinculadas.forEach(activity => {
                                if (!atividadesPorEquipe[activity.team]) {
                                  atividadesPorEquipe[activity.team] = [];
                                }
                                atividadesPorEquipe[activity.team].push(activity);
                              });

                              const dateStr = `${currentYear}-${(currentMonth + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;

                              return Object.entries(atividadesPorEquipe).map(([teamName, teamActivities]) => {
                                const hasMultipleOS = teamActivities.length > 1;

                                return (
                                  <div 
                                    key={`team-${teamName}-${day}`}
                                    className={hasMultipleOS ? 'border-2 border-purple-400 rounded p-0.5 mb-0.5 bg-purple-50' : ''}
                                  >
                                    {hasMultipleOS && (
                                      <div className="text-[7px] font-bold text-purple-700 px-1 mb-0.5">
                                        {teamActivities.length} OSs
                                      </div>
                                    )}
                                    {teamActivities.map((activity, osIndex) => (
                                      <div
                                        key={`team-${teamName}-os-${osIndex}`}
                                        className={`rounded px-1 py-0.5 border-2 transition-colors cursor-pointer relative group z-10 shadow-sm w-full ${hasMultipleOS && osIndex > 0 ? 'mt-0.5' : ''
                                          } ${activity.critico?.toUpperCase() === 'SIM'
                                            ? 'border-yellow-500 hover:border-yellow-600'
                                            : 'bg-blue-50 border-blue-300 hover:bg-blue-100'
                                          }`}
                                        style={{
                                          fontSize: '8.4px',
                                          lineHeight: '14.4px',
                                          ...(activity.critico?.toUpperCase() === 'SIM' && {
                                            background: 'repeating-linear-gradient(45deg, #fef3c7, #fef3c7 10px, #fde68a 10px, #fde68a 20px)'
                                          })
                                        }}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setViewingActivity({ ...activity, date: dateStr });
                                        }}
                                      >
                                        {/* Linha única compacta: Equipe | OS | Status | Valor - 20% MAIOR */}
                                        <div className="flex items-center justify-between py-0.5 min-w-max">
                                          <div className="flex items-center gap-1 flex-shrink-0">
                                            <span className="font-bold text-gray-800 whitespace-nowrap" style={{ fontSize: '9.2px' }}>
                                              {activity.team}
                                            </span>
                                            <div className="flex items-center gap-0.5 flex-shrink-0">
                                              <span className={`font-mono font-extrabold text-white rounded ${activity.status === 'PROG' ? 'bg-blue-600' :
                                                activity.status === 'PANP' ? 'bg-orange-600' :
                                                activity.status === 'EXEC' ? 'bg-green-600' :
                                                activity.status === 'CANC' ? 'bg-red-600' :
                                                activity.status === 'PARP' ? 'bg-yellow-600' : 'bg-purple-600'
                                                }`} style={{
                                                  fontSize: activity.osNumber.length === 12 && activity.team.length >= 9 ? '8.3px' : activity.osNumber.length > 11 && activity.team.length >= 9 ? '8.7px' : activity.osNumber.length > 11 ? '9px' : '9.5px',
                                                  paddingLeft: '2px',
                                                  paddingRight: '2px',
                                                  paddingTop: '2px',
                                                  paddingBottom: '2px'
                                                }}>
                                                {activity.osNumber}
                                              </span>
                                              <span className={`font-semibold rounded text-white flex items-center justify-center ${activity.status === 'PROG' ? 'bg-blue-600' :
                                                activity.status === 'PANP' ? 'bg-orange-600' :
                                                activity.status === 'EXEC' ? 'bg-green-600' :
                                                activity.status === 'CANC' ? 'bg-red-600' :
                                                activity.status === 'PARP' ? 'bg-yellow-600' : 'bg-purple-600'
                                                }`} style={{ fontSize: '8.5px', paddingLeft: '2.5px', paddingRight: '2.5px', paddingTop: '1.5px', paddingBottom: '1.5px', lineHeight: '1' }}>
                                                {activity.status}
                                              </span>
                                            </div>
                                          </div>
                                          <span
                                            className="text-emerald-700 font-extrabold"
                                            style={{ fontSize: '10.5px', fontWeight: '900' }}
                                          >
                                            {(activity.value / 1000).toFixed(1)}k
                                          </span>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                );
                              });
                            })()}
                          </div>

                          {/* Add button ultra compacto - 20% MAIOR */}
                          <button
                            className="w-full mt-0.5 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded border border-dashed border-blue-200 hover:border-blue-300 transition-all"
                            style={{ fontSize: '10.8px', padding: '1.2px', lineHeight: '14.4px' }}
                            title="Adicionar atividade"
                          >
                            + OS
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>

            {/* Legend */}
            <div className="bg-white rounded-lg shadow-lg p-4">
              <h3 className="font-semibold text-gray-900 mb-3">Status das OS:</h3>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">PROG - Programada</Badge>
                <Badge variant="secondary">PANP - Parcial Não Planejada</Badge>
                <Badge variant="secondary">EXEC - Executada</Badge>
                <Badge variant="destructive">CANC - Cancelada</Badge>
                <Badge variant="default">PARP - Parcial Planejada</Badge>
              </div>
            </div>
          </TabsContent>
          {/* Mapa Tab */}
          <TabsContent value="mapa" className="space-y-2">
            {/* Mapa Interativo - Sem Card */}
            <div className="max-w-[95%] mx-auto">
              <div className="relative bg-white rounded-lg shadow-lg border border-gray-200" style={{ height: '600px' }}>

                {/* Container Principal Flex - Todos os Controles na Mesma Linha */}
                <div className="absolute top-3 left-0 right-0 z-[10000] px-3 flex items-center justify-between gap-4">

                  {/* Grupo 1: Filtros de Status (Esquerda) */}
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {/* Botão PROG */}
                    <div className="relative inline-flex flex-col gap-1">
                      <button
                        onClick={() => setMapFilterStatus(mapFilterStatus === 'PROG' ? 'todos' : 'PROG')}
                        className={`group relative inline-flex items-center gap-0.5 px-2 py-1 rounded-lg text-xs font-semibold transition-all duration-200 backdrop-blur-sm border-2 ${mapFilterStatus === 'PROG'
                            ? 'bg-blue-600 text-white shadow-lg scale-105 ring-2 ring-blue-300 border-blue-400'
                            : 'bg-white/90 text-gray-700 border-gray-300 hover:bg-blue-50 hover:text-blue-700 hover:scale-105 hover:shadow-md'
                          }`}
                      >
                        <span className="w-3 h-3 bg-blue-600 rounded-full border-2 border-white shadow-sm"></span>
                        <span>Prog.</span>
                        <span className={`min-w-[22px] h-[22px] px-1 rounded-full inline-flex items-center justify-center text-[14px] font-bold leading-none ${mapFilterStatus === 'PROG' ? 'bg-white text-blue-600' : 'bg-blue-100 text-blue-700'
                          }`}>
                          {Object.values(mapActivities).flat().filter(a => a.status === 'PROG' && a.coordenada).length}
                        </span>
                      </button>
                      {mapFilterStatus === 'PROG' && (
                        <div className="absolute top-full mt-1 left-0 bg-white/98 backdrop-blur-md rounded-lg shadow-xl border-2 border-gray-300 px-2 py-1.5 z-[10002] inline-flex items-center gap-1.5">
                          <span className="text-sm">⚠️</span>
                          <button
                            onClick={() => setMapFilterCritico(mapFilterCritico === 'sim' ? 'todos' : 'sim')}
                            className={`relative inline-flex h-4 w-8 items-center rounded-full transition-all duration-300 ${mapFilterCritico === 'sim' ? 'bg-gradient-to-r from-yellow-400 to-orange-500 shadow-lg' : 'bg-gray-300 hover:bg-gray-400'}`}
                          >
                            <span className={`inline-block h-3 w-3 transform rounded-full bg-white shadow-lg transition-transform duration-300 ${mapFilterCritico === 'sim' ? 'translate-x-4' : 'translate-x-0.5'}`} />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Botão EXEC */}
                    <div className="relative inline-flex flex-col gap-1">
                      <button
                        onClick={() => setMapFilterStatus(mapFilterStatus === 'EXEC' ? 'todos' : 'EXEC')}
                        className={`group relative inline-flex items-center gap-0.5 px-2 py-1 rounded-lg text-xs font-semibold transition-all duration-200 backdrop-blur-sm border-2 ${mapFilterStatus === 'EXEC'
                            ? 'bg-green-600 text-white shadow-lg scale-105 ring-2 ring-green-300 border-green-400'
                            : 'bg-white/90 text-gray-700 border-gray-300 hover:bg-green-50 hover:text-green-700 hover:scale-105 hover:shadow-md'
                          }`}
                      >
                        <span className="w-3 h-3 bg-green-600 rounded-full border-2 border-white shadow-sm"></span>
                        <span>Exec.</span>
                        <span className={`min-w-[22px] h-[22px] px-1 rounded-full inline-flex items-center justify-center text-[14px] font-bold leading-none ${mapFilterStatus === 'EXEC' ? 'bg-white text-green-600' : 'bg-green-100 text-green-700'
                          }`}>
                          {Object.values(mapActivities).flat().filter(a => a.status === 'EXEC' && a.coordenada).length}
                        </span>
                      </button>
                      {mapFilterStatus === 'EXEC' && (
                        <div className="absolute top-full mt-1 left-0 bg-white/98 backdrop-blur-md rounded-lg shadow-xl border-2 border-gray-300 px-2 py-1.5 z-[10002] inline-flex items-center gap-1.5">
                          <span className="text-sm">⚠️</span>
                          <button
                            onClick={() => setMapFilterCritico(mapFilterCritico === 'sim' ? 'todos' : 'sim')}
                            className={`relative inline-flex h-4 w-8 items-center rounded-full transition-all duration-300 ${mapFilterCritico === 'sim' ? 'bg-gradient-to-r from-yellow-400 to-orange-500 shadow-lg' : 'bg-gray-300 hover:bg-gray-400'}`}
                          >
                            <span className={`inline-block h-3 w-3 transform rounded-full bg-white shadow-lg transition-transform duration-300 ${mapFilterCritico === 'sim' ? 'translate-x-4' : 'translate-x-0.5'}`} />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Botão CANC */}
                    <div className="relative inline-flex flex-col gap-1">
                      <button
                        onClick={() => setMapFilterStatus(mapFilterStatus === 'CANC' ? 'todos' : 'CANC')}
                        className={`group relative inline-flex items-center gap-0.5 px-2 py-1 rounded-lg text-xs font-semibold transition-all duration-200 backdrop-blur-sm border-2 ${mapFilterStatus === 'CANC'
                            ? 'bg-red-600 text-white shadow-lg scale-105 ring-2 ring-red-300 border-red-400'
                            : 'bg-white/90 text-gray-700 border-gray-300 hover:bg-red-50 hover:text-red-700 hover:scale-105 hover:shadow-md'
                          }`}
                      >
                        <span className="w-3 h-3 bg-red-600 rounded-full border-2 border-white shadow-sm"></span>
                        <span>Canc.</span>
                        <span className={`min-w-[22px] h-[22px] px-1 rounded-full inline-flex items-center justify-center text-[14px] font-bold leading-none ${mapFilterStatus === 'CANC' ? 'bg-white text-red-600' : 'bg-red-100 text-red-700'
                          }`}>
                          {Object.values(mapActivities).flat().filter(a => a.status === 'CANC' && a.coordenada).length}
                        </span>
                      </button>
                      {mapFilterStatus === 'CANC' && (
                        <div className="absolute top-full mt-1 left-0 bg-white/98 backdrop-blur-md rounded-lg shadow-xl border-2 border-gray-300 px-2 py-1.5 z-[10002] inline-flex items-center gap-1.5">
                          <span className="text-sm">⚠️</span>
                          <button
                            onClick={() => setMapFilterCritico(mapFilterCritico === 'sim' ? 'todos' : 'sim')}
                            className={`relative inline-flex h-4 w-8 items-center rounded-full transition-all duration-300 ${mapFilterCritico === 'sim' ? 'bg-gradient-to-r from-yellow-400 to-orange-500 shadow-lg' : 'bg-gray-300 hover:bg-gray-400'}`}
                          >
                            <span className={`inline-block h-3 w-3 transform rounded-full bg-white shadow-lg transition-transform duration-300 ${mapFilterCritico === 'sim' ? 'translate-x-4' : 'translate-x-0.5'}`} />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Botão PARP */}
                    <div className="relative inline-flex flex-col gap-1">
                      <button
                        onClick={() => setMapFilterStatus(mapFilterStatus === 'PARP' ? 'todos' : 'PARP')}
                        className={`group relative inline-flex items-center gap-0.5 px-2 py-1 rounded-lg text-xs font-semibold transition-all duration-200 backdrop-blur-sm border-2 ${mapFilterStatus === 'PARP'
                            ? 'bg-yellow-500 text-white shadow-lg scale-105 ring-2 ring-yellow-300 border-yellow-400'
                            : 'bg-white/90 text-gray-700 border-gray-300 hover:bg-yellow-50 hover:text-yellow-700 hover:scale-105 hover:shadow-md'
                          }`}
                      >
                        <span className="w-3 h-3 bg-yellow-500 rounded-full border-2 border-white shadow-sm"></span>
                        <span>ParP.</span>
                        <span className={`min-w-[22px] h-[22px] px-1 rounded-full inline-flex items-center justify-center text-[14px] font-bold leading-none ${mapFilterStatus === 'PARP' ? 'bg-white text-yellow-600' : 'bg-yellow-100 text-yellow-700'
                          }`}>
                          {Object.values(mapActivities).flat().filter(a => a.status === 'PARP' && a.coordenada).length}
                        </span>
                      </button>
                      {mapFilterStatus === 'PARP' && (
                        <div className="absolute top-full mt-1 left-0 bg-white/98 backdrop-blur-md rounded-lg shadow-xl border-2 border-gray-300 px-2 py-1.5 z-[10002] inline-flex items-center gap-1.5">
                          <span className="text-sm">⚠️</span>
                          <button
                            onClick={() => setMapFilterCritico(mapFilterCritico === 'sim' ? 'todos' : 'sim')}
                            className={`relative inline-flex h-4 w-8 items-center rounded-full transition-all duration-300 ${mapFilterCritico === 'sim' ? 'bg-gradient-to-r from-yellow-400 to-orange-500 shadow-lg' : 'bg-gray-300 hover:bg-gray-400'}`}
                          >
                            <span className={`inline-block h-3 w-3 transform rounded-full bg-white shadow-lg transition-transform duration-300 ${mapFilterCritico === 'sim' ? 'translate-x-4' : 'translate-x-0.5'}`} />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Botão PANP */}
                    <div className="relative inline-flex flex-col gap-1">
                      <button
                        onClick={() => setMapFilterStatus(mapFilterStatus === 'PANP' ? 'todos' : 'PANP')}
                        className={`group relative inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold transition-all duration-200 backdrop-blur-sm border-2 ${mapFilterStatus === 'PANP'
                            ? 'bg-orange-500 text-white shadow-lg scale-105 ring-2 ring-orange-300 border-orange-400'
                            : 'bg-white/90 text-gray-700 border-gray-300 hover:bg-orange-50 hover:text-orange-700 hover:scale-105 hover:shadow-md'
                          }`}
                      >
                        <span className="w-3 h-3 bg-orange-500 rounded-full border-2 border-white shadow-sm"></span>
                        <span>ParNP.</span>
                        <span className={`min-w-[22px] h-[22px] px-1 rounded-full inline-flex items-center justify-center text-[14px] font-bold leading-none ${mapFilterStatus === 'PANP' ? 'bg-white text-orange-600' : 'bg-orange-100 text-orange-700'
                          }`}>
                          {Object.values(mapActivities).flat().filter(a => a.status === 'PANP' && a.coordenada).length}
                        </span>
                      </button>
                      {mapFilterStatus === 'PANP' && (
                        <div className="absolute top-full mt-1 left-0 bg-white/98 backdrop-blur-md rounded-lg shadow-xl border-2 border-gray-300 px-2 py-1.5 z-[10002] inline-flex items-center gap-1.5">
                          <span className="text-sm">⚠️</span>
                          <button
                            onClick={() => setMapFilterCritico(mapFilterCritico === 'sim' ? 'todos' : 'sim')}
                            className={`relative inline-flex h-4 w-8 items-center rounded-full transition-all duration-300 ${mapFilterCritico === 'sim' ? 'bg-gradient-to-r from-yellow-400 to-orange-500 shadow-lg' : 'bg-gray-300 hover:bg-gray-400'}`}
                          >
                            <span className={`inline-block h-3 w-3 transform rounded-full bg-white shadow-lg transition-transform duration-300 ${mapFilterCritico === 'sim' ? 'translate-x-4' : 'translate-x-0.5'}`} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Grupo 2: Calendário (Centro) */}
                  <div
                    className="flex items-center gap-3 flex-shrink-0"
                    onClick={() => {
                      const calendar = document.getElementById('calendar-dropdown');
                      if (calendar && !calendar.classList.contains('hidden')) {
                        calendar.classList.remove('calendar-dropdown-open');
                        setTimeout(() => calendar.classList.add('hidden'), 200);
                      }
                    }}
                  >
                    {/* Botão Limpar (Vassoura) - Aparece quando dia selecionado */}
                    {mapFilterDay !== 'todos' && (
                      <button
                        onClick={() => setMapFilterDay('todos')}
                        className="flex items-center justify-center w-10 h-[34px] rounded-lg bg-orange-500 hover:bg-orange-600 text-white transition-all duration-200 hover:scale-105 shadow-lg font-bold border-2 border-orange-400"
                        title="Limpar filtro de dia"
                      >
                        <span className="text-base">🧹</span>
                      </button>
                    )}

                    {/* Seletor de Mês com Calendário - Dropdown Moderno */}
                    <div className="relative flex items-center gap-2">
                      {/* Botão Mês Anterior */}
                      <button
                        onClick={() => {
                          const newMonth = mapFilterMonth === 0 ? 11 : mapFilterMonth - 1;
                          const newYear = mapFilterMonth === 0 ? mapFilterYear - 1 : mapFilterYear;
                          setMapFilterMonth(newMonth);
                          setMapFilterYear(newYear);
                          setMapFilterDay('todos');
                        }}
                        className="flex items-center justify-center px-4 py-2 rounded-lg bg-white/90 backdrop-blur-sm border-2 border-gray-300 shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200 text-gray-700 hover:bg-gray-50 text-sm font-bold"
                        title="Mês anterior"
                      >
                        <span>‹</span>
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const calendar = document.getElementById('calendar-dropdown');
                          if (calendar) {
                            if (calendar.classList.contains('hidden')) {
                              calendar.classList.remove('hidden');
                              setTimeout(() => calendar.classList.add('calendar-dropdown-open'), 10);
                            } else {
                              calendar.classList.remove('calendar-dropdown-open');
                              setTimeout(() => calendar.classList.add('hidden'), 200);
                            }
                          }
                        }}
                        className="bg-white/90 backdrop-blur-sm px-3 py-2 rounded-lg border-2 border-blue-400 shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200 flex items-center justify-between gap-2 font-semibold text-gray-800 text-sm min-w-[190px]"
                      >
                        <span className="text-blue-600">
                          {['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'][mapFilterMonth]} {mapFilterYear}
                          {mapFilterDay !== 'todos' && ` (${mapFilterDay.padStart(2, '0')})`}
                          {mapFilterDay === 'todos' && ' (Todos)'}
                        </span>
                        <svg className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>

                      {/* Botão Próximo Mês */}
                      <button
                        onClick={() => {
                          const newMonth = mapFilterMonth === 11 ? 0 : mapFilterMonth + 1;
                          const newYear = mapFilterMonth === 11 ? mapFilterYear + 1 : mapFilterYear;
                          setMapFilterMonth(newMonth);
                          setMapFilterYear(newYear);
                          setMapFilterDay('todos');
                        }}
                        className="flex items-center justify-center px-4 py-2 rounded-lg bg-white/90 backdrop-blur-sm border-2 border-gray-300 shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200 text-gray-700 hover:bg-gray-50 text-sm font-bold"
                        title="Próximo mês"
                      >
                        <span>›</span>
                      </button>

                      {/* Calendário Dropdown com animação */}
                      <style>{`
                  #calendar-dropdown {
                    opacity: 0;
                    transform: translateY(-10px) scale(0.95);
                    transition: opacity 0.2s ease, transform 0.2s ease;
                  }
                  #calendar-dropdown.calendar-dropdown-open {
                    opacity: 1;
                    transform: translateY(0) scale(1);
                  }
                  #team-dropdown {
                    opacity: 0;
                    transform: translateY(-10px) scale(0.95);
                    transition: opacity 0.2s ease, transform 0.2s ease;
                  }
                  #team-dropdown.team-dropdown-open {
                    opacity: 1;
                    transform: translateY(0) scale(1);
                  }
                `}</style>
                      <div
                        id="calendar-dropdown"
                        className="hidden absolute top-full left-1/2 -translate-x-1/2 mt-0.5 p-3 bg-white/95 backdrop-blur-md rounded-xl shadow-2xl border-2 border-blue-300 z-[10001] w-[320px]"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {/* Dias da Semana */}
                        <div className="grid grid-cols-7 gap-1 mb-2">
                          {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((day, idx) => (
                            <div key={idx} className="text-center text-xs font-bold text-gray-500 py-1">
                              {day}
                            </div>
                          ))}
                        </div>

                        {/* Dias do Mês */}
                        <div className="grid grid-cols-7 gap-1">
                          {(() => {
                            const firstDay = new Date(mapFilterYear, mapFilterMonth, 1).getDay();
                            const daysInMonth = new Date(mapFilterYear, mapFilterMonth + 1, 0).getDate();
                            const days = [];

                            // Células vazias antes do primeiro dia
                            for (let i = 0; i < firstDay; i++) {
                              days.push(<div key={`empty-${i}`} className="p-2"></div>);
                            }

                            // Dias do mês
                            for (let day = 1; day <= daysInMonth; day++) {
                              const dayStr = day.toString();
                              const dateStr = `${mapFilterYear}-${(mapFilterMonth + 1).toString().padStart(2, '0')}-${dayStr.padStart(2, '0')}`;

                              // Contar OS do dia
                              const activitiesOnDay = mapActivities[dateStr] || [];
                              const filteredActivities = activitiesOnDay.filter(a => {
                                if (mapFilterStatus !== 'todos' && a.status !== mapFilterStatus) return false;
                                if (mapFilterCritico !== 'todos' && (a.critico?.toUpperCase() === 'SIM') !== (mapFilterCritico === 'sim')) return false;
                                return true;
                              });

                              const hasActivities = filteredActivities.length > 0;
                              const isSelected = mapFilterDay === dayStr;

                              // Determinar cor de fundo baseada no status predominante
                              let bgColor = 'bg-white/90';
                              if (hasActivities) {
                                // Se nenhum filtro de status está aplicado (todos), usar cor única
                                if (mapFilterStatus === 'todos') {
                                  bgColor = 'bg-indigo-100 border-indigo-300';
                                } else {
                                  const statusCount: Record<string, number> = {};
                                  filteredActivities.forEach(a => {
                                    statusCount[a.status] = (statusCount[a.status] || 0) + 1;
                                  });
                                  const predominantStatus = Object.keys(statusCount).reduce((a, b) =>
                                    statusCount[a] > statusCount[b] ? a : b
                                  );

                                  switch (predominantStatus) {
                                    case 'PROG': bgColor = 'bg-blue-100 border-blue-300'; break;
                                    case 'EXEC': bgColor = 'bg-green-100 border-green-300'; break;
                                    case 'CANC': bgColor = 'bg-red-100 border-red-300'; break;
                                    case 'PARP': bgColor = 'bg-yellow-100 border-yellow-300'; break;
                                    case 'PANP': bgColor = 'bg-orange-100 border-orange-300'; break;
                                  }
                                }
                              }

                              days.push(
                                <button
                                  key={day}
                                  onClick={() => {
                                    // Toggle: se já está selecionado, desselecionar
                                    if (mapFilterDay === dayStr) {
                                      setMapFilterDay('todos');
                                    } else {
                                      setMapFilterDay(dayStr);
                                    }
                                    const calendar = document.getElementById('calendar-dropdown');
                                    if (calendar) {
                                      calendar.classList.remove('calendar-dropdown-open');
                                      setTimeout(() => calendar.classList.add('hidden'), 200);
                                    }
                                  }}
                                  className={`p-2 rounded-lg text-xs font-bold transition-all duration-200 hover:scale-110 hover:shadow-lg border-2 ${isSelected
                                      ? 'bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg ring-2 ring-blue-400 scale-105'
                                      : hasActivities
                                        ? `${bgColor} text-gray-800 hover:scale-110 border-2`
                                        : 'bg-white/50 text-gray-400 border-gray-200 hover:bg-gray-50'
                                    }`}
                                  title={hasActivities ? `${filteredActivities.length} OS` : 'Sem OS'}
                                >
                                  <div className="flex flex-col items-center gap-0.5">
                                    <span>{day}</span>
                                    {hasActivities && (
                                      <span className={`text-[9px] ${isSelected ? 'text-white' : 'text-gray-600'}`}>
                                        {filteredActivities.length}
                                      </span>
                                    )}
                                  </div>
                                </button>
                              );
                            }

                            return days;
                          })()}
                        </div>
                      </div>

                    </div>
                  </div>

                  {/* Grupo 3: Seletor de Equipe (Direita) */}
                  <div className="relative">
                    <button
                      onClick={() => {
                        const dropdown = document.getElementById('team-dropdown');
                        if (dropdown) {
                          if (dropdown.classList.contains('hidden')) {
                            dropdown.classList.remove('hidden');
                            setTimeout(() => dropdown.classList.add('team-dropdown-open'), 10);
                          } else {
                            dropdown.classList.remove('team-dropdown-open');
                            setTimeout(() => dropdown.classList.add('hidden'), 200);
                          }
                        }
                      }}
                      className="bg-white/90 backdrop-blur-sm px-3 py-2 rounded-lg border-2 border-purple-400 shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200 flex items-center justify-between gap-2 font-semibold text-gray-800 text-sm min-w-[180px]"
                    >
                      <span className="text-purple-600">
                        {mapFilterTeam === 'todas' ? '👥 Todas as Equipes' : `${mapFilterTeam} (${getFilteredMapActivities().filter(a => a.team === mapFilterTeam).length
                          })`}
                      </span>
                      <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>

                    {/* Dropdown Moderno de Equipes */}
                    <div
                      id="team-dropdown"
                      className="hidden absolute top-full mt-1 right-0 bg-white/98 backdrop-blur-md rounded-lg shadow-2xl border-2 border-purple-300 overflow-hidden z-[10001]"
                      style={{
                        minWidth: '220px',
                        maxHeight: '400px',
                        overflowY: 'auto'
                      }}
                    >
                      {/* Opção "Todas" */}
                      <button
                        onClick={() => {
                          setMapFilterTeam('todas');
                          const dropdown = document.getElementById('team-dropdown');
                          if (dropdown) {
                            dropdown.classList.remove('team-dropdown-open');
                            setTimeout(() => dropdown.classList.add('hidden'), 200);
                          }
                        }}
                        className={`w-full px-4 py-2.5 text-left hover:bg-purple-50 transition-all duration-150 flex items-center justify-between ${mapFilterTeam === 'todas' ? 'bg-purple-100 font-bold' : ''
                          }`}
                      >
                        <span className="flex items-center gap-2">
                          <span className="text-lg">👥</span>
                          <span className="text-sm font-semibold text-gray-700">Todas as Equipes</span>
                        </span>
                        <span className="px-2 py-0.5 bg-purple-500 text-white rounded-full text-xs font-bold">
                          {getFilteredMapActivities().length}
                        </span>
                      </button>

                      {/* Equipes fixas do contrato selecionado - sempre aparecem, mesmo sem OS */}
                      {(() => {
                        // Obter nomes das equipes fixas do contrato selecionado
                        const equipesContrato = equipesFixas
                          .filter(equipe => {
                            if (!selectedContrato) return false;
                            const contrato = contratos.find(c => c.nome === selectedContrato);
                            if (!contrato) return false;
                            return equipe.contratoId === contrato.id;
                          })
                          .map(equipe => equipe.prefixo || equipe.nome);

                        // Contar OS por equipe no período filtrado
                        const teamCounts = new Map<string, number>();
                        getFilteredMapActivities().forEach(activity => {
                          if (activity.team && equipesContrato.includes(activity.team)) {
                            teamCounts.set(activity.team, (teamCounts.get(activity.team) || 0) + 1);
                          }
                        });

                        // Garantir que TODAS as equipes fixas apareçam, mesmo sem OS
                        equipesContrato.forEach(team => {
                          if (!teamCounts.has(team)) {
                            teamCounts.set(team, 0);
                          }
                        });

                        // Ordenar equipes alfabeticamente
                        return Array.from(teamCounts.entries())
                          .sort((a, b) => a[0].localeCompare(b[0]))
                          .map(([team, count]) => (
                            <button
                              key={team}
                              onClick={() => {
                                setMapFilterTeam(team);
                                const dropdown = document.getElementById('team-dropdown');
                                if (dropdown) {
                                  dropdown.classList.remove('team-dropdown-open');
                                  setTimeout(() => dropdown.classList.add('hidden'), 200);
                                }
                              }}
                              className={`w-full px-4 py-2.5 text-left hover:bg-purple-50 transition-all duration-150 flex items-center justify-between border-t border-gray-100 ${mapFilterTeam === team ? 'bg-purple-100 font-bold' : ''
                                }`}
                            >
                              <span className="text-sm font-medium text-gray-700">{team}</span>
                              <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${count > 0 ? 'bg-purple-500 text-white' : 'bg-gray-300 text-gray-600'}`}>
                                {count}
                              </span>
                            </button>
                          ));
                      })()}
                    </div>
                  </div>
                </div>  {/* Fecha container principal flex */}

                <InteractiveMap
                  activities={getFilteredMapActivities()}
                  filterStatus={mapFilterStatus}
                  filterCritico={mapFilterCritico}
                  filterMonth={mapFilterMonth}
                  filterYear={mapFilterYear}
                  filterDay={mapFilterDay}
                  onFilterStatusChange={setMapFilterStatus}
                  onFilterCriticoChange={setMapFilterCritico}
                  onFilterMonthChange={(value) => {
                    setMapFilterMonth(value);
                    setMapFilterDay('todos');
                  }}
                  onFilterYearChange={(value) => {
                    setMapFilterYear(value);
                    setMapFilterDay('todos');
                  }}
                  onFilterDayChange={setMapFilterDay}
                  onClearFilters={() => {
                    setMapFilterStatus('todos');
                    setMapFilterCritico('todos');
                    setMapFilterDay('todos');
                    setMapFilterMonth(new Date().getMonth());
                    setMapFilterYear(new Date().getFullYear());
                  }}
                  onActivityClick={(activity) => {
                    // Encontrar todas as atividades com mesmo osNumber e mesma data
                    const activityDate = activity.date || Object.keys(activities).find(date =>
                      activities[date].some(a => a.osNumber === activity.osNumber && a.team === activity.team)
                    );

                    if (activityDate) {
                      // Buscar todas as equipes dessa OS na mesma data
                      const sameOSActivities = activities[activityDate]?.filter(
                        a => a.osNumber === activity.osNumber
                      ) || [];

                      if (sameOSActivities.length > 1) {
                        // Múltiplas equipes no mesmo dia - usar modal do mapa
                        const activitiesWithDate = sameOSActivities.map(a => ({
                          ...a,
                          date: activityDate
                        }));
                        setViewingMapActivities(activitiesWithDate);
                      } else {
                        // Equipe única - usar modal normal (calendário)
                        const fullActivity = activities[activityDate].find(
                          a => a.osNumber === activity.osNumber && a.team === activity.team
                        );

                        if (fullActivity) {
                          setViewingActivity({
                            ...fullActivity,
                            date: activityDate
                          });
                        }
                      }
                    }
                  }}
                />
              </div>
            </div>
          </TabsContent>

          {/* Dashboard Tab */}
          <TabsContent value="dashboard" className="space-y-4">
            {/* Filtro de Período Moderno com Calendário */}
            <div className="bg-white rounded-lg shadow-lg p-4">
              <div className="flex flex-wrap items-center gap-4">
                {/* Label */}
                <div className="text-sm font-semibold text-gray-700">
                  📅 Período de Análise:
                </div>

                {/* Seletor de Data Inicial com Calendário */}
                <div className="relative flex items-center gap-2">
                  <span className="text-xs font-medium text-gray-600">De:</span>
                  
                  {/* Botão Limpar Data Inicial */}
                  {dashboardStartDay !== 'todos' && (
                    <button
                      onClick={() => setDashboardStartDay('todos')}
                      className="flex items-center justify-center w-8 h-8 rounded-lg bg-orange-500 hover:bg-orange-600 text-white transition-all duration-200 hover:scale-105 shadow-md text-sm font-bold"
                      title="Limpar dia"
                    >
                      🧹
                    </button>
                  )}
                  
                  <button
                    onClick={() => {
                      const newMonth = dashboardStartMonth === 0 ? 11 : dashboardStartMonth - 1;
                      const newYear = dashboardStartMonth === 0 ? dashboardStartYear - 1 : dashboardStartYear;
                      setDashboardStartMonth(newMonth);
                      setDashboardStartYear(newYear);
                      setDashboardStartDay('todos');
                    }}
                    className="flex items-center justify-center px-3 py-1.5 rounded-lg bg-white/90 backdrop-blur-sm border-2 border-gray-300 shadow-md hover:shadow-lg hover:scale-105 transition-all duration-200 text-gray-700 hover:bg-gray-50 text-sm font-bold"
                    title="Mês anterior"
                  >
                    ‹
                  </button>
                  
                  <button
                    data-calendar-button="start"
                    onClick={(e) => {
                      e.stopPropagation();
                      const calendar = document.getElementById('dashboard-start-calendar');
                      if (calendar) {
                        if (calendar.classList.contains('hidden')) {
                          calendar.classList.remove('hidden');
                          setTimeout(() => calendar.classList.add('calendar-dropdown-open'), 10);
                        } else {
                          calendar.classList.remove('calendar-dropdown-open');
                          setTimeout(() => calendar.classList.add('hidden'), 200);
                        }
                      }
                    }}
                    className="bg-white/90 backdrop-blur-sm px-4 py-1.5 rounded-lg border-2 border-blue-400 shadow-md text-sm font-semibold text-blue-700 min-w-[180px] text-center hover:scale-105 transition-all cursor-pointer"
                  >
                    {MONTHS[dashboardStartMonth]} {dashboardStartYear}
                    {dashboardStartDay !== 'todos' && ` (${dashboardStartDay.padStart(2, '0')})`}
                    {dashboardStartDay === 'todos' && ' (Todos)'}
                  </button>
                  
                  <button
                    onClick={() => {
                      const newMonth = dashboardStartMonth === 11 ? 0 : dashboardStartMonth + 1;
                      const newYear = dashboardStartMonth === 11 ? dashboardStartYear + 1 : dashboardStartYear;
                      setDashboardStartMonth(newMonth);
                      setDashboardStartYear(newYear);
                      setDashboardStartDay('todos');
                    }}
                    className="flex items-center justify-center px-3 py-1.5 rounded-lg bg-white/90 backdrop-blur-sm border-2 border-gray-300 shadow-md hover:shadow-lg hover:scale-105 transition-all duration-200 text-gray-700 hover:bg-gray-50 text-sm font-bold"
                    title="Próximo mês"
                  >
                    ›
                  </button>

                  {/* Calendário Dropdown Inicial */}
                  <style>{`
                    #dashboard-start-calendar {
                      opacity: 0;
                      transform: translateY(-10px);
                      transition: opacity 200ms, transform 200ms;
                    }
                    #dashboard-start-calendar.calendar-dropdown-open {
                      opacity: 1;
                      transform: translateY(0);
                    }
                  `}</style>
                  <div
                    id="dashboard-start-calendar"
                    className="hidden absolute top-full left-20 mt-0.5 p-3 bg-white/95 backdrop-blur-md rounded-xl shadow-2xl border-2 border-blue-300 z-[10001] w-[320px]"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="grid grid-cols-7 gap-1 mb-2">
                      {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((day, idx) => (
                        <div key={idx} className="text-center text-xs font-bold text-gray-500 py-1">
                          {day}
                        </div>
                      ))}
                    </div>
                    <div className="grid grid-cols-7 gap-1">
                      {(() => {
                        const firstDay = new Date(dashboardStartYear, dashboardStartMonth, 1).getDay();
                        const daysInMonth = new Date(dashboardStartYear, dashboardStartMonth + 1, 0).getDate();
                        const days = [];
                        
                        for (let i = 0; i < firstDay; i++) {
                          days.push(<div key={`empty-${i}`} className="p-2"></div>);
                        }
                        
                        for (let day = 1; day <= daysInMonth; day++) {
                          const dayStr = day.toString();
                          const isSelected = dashboardStartDay === dayStr;
                          
                          days.push(
                            <button
                              key={day}
                              onClick={() => {
                                if (dashboardStartDay === dayStr) {
                                  setDashboardStartDay('todos');
                                } else {
                                  setDashboardStartDay(dayStr);
                                }
                                const calendar = document.getElementById('dashboard-start-calendar');
                                if (calendar) {
                                  calendar.classList.remove('calendar-dropdown-open');
                                  setTimeout(() => calendar.classList.add('hidden'), 200);
                                }
                              }}
                              className={`p-2 rounded-lg text-xs font-bold transition-all duration-200 hover:scale-110 hover:shadow-lg border-2 ${
                                isSelected 
                                  ? 'bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg ring-2 ring-blue-400 scale-105' 
                                  : 'bg-white/50 text-gray-700 border-gray-200 hover:bg-blue-50'
                              }`}
                            >
                              {day}
                            </button>
                          );
                        }
                        return days;
                      })()}
                    </div>
                  </div>
                </div>

                {/* Separador */}
                <div className="text-gray-400 font-bold">→</div>

                {/* Seletor de Data Final com Calendário */}
                <div className="relative flex items-center gap-2">
                  <span className="text-xs font-medium text-gray-600">Até:</span>
                  
                  {/* Botão Limpar Data Final */}
                  {dashboardEndDay !== 'todos' && (
                    <button
                      onClick={() => setDashboardEndDay('todos')}
                      className="flex items-center justify-center w-8 h-8 rounded-lg bg-orange-500 hover:bg-orange-600 text-white transition-all duration-200 hover:scale-105 shadow-md text-sm font-bold"
                      title="Limpar dia"
                    >
                      🧹
                    </button>
                  )}
                  
                  <button
                    onClick={() => {
                      const newMonth = dashboardEndMonth === 0 ? 11 : dashboardEndMonth - 1;
                      const newYear = dashboardEndMonth === 0 ? dashboardEndYear - 1 : dashboardEndYear;
                      setDashboardEndMonth(newMonth);
                      setDashboardEndYear(newYear);
                      setDashboardEndDay('todos');
                    }}
                    className="flex items-center justify-center px-3 py-1.5 rounded-lg bg-white/90 backdrop-blur-sm border-2 border-gray-300 shadow-md hover:shadow-lg hover:scale-105 transition-all duration-200 text-gray-700 hover:bg-gray-50 text-sm font-bold"
                    title="Mês anterior"
                  >
                    ‹
                  </button>
                  
                  <button
                    data-calendar-button="end"
                    onClick={(e) => {
                      e.stopPropagation();
                      const calendar = document.getElementById('dashboard-end-calendar');
                      if (calendar) {
                        if (calendar.classList.contains('hidden')) {
                          calendar.classList.remove('hidden');
                          setTimeout(() => calendar.classList.add('calendar-dropdown-open'), 10);
                        } else {
                          calendar.classList.remove('calendar-dropdown-open');
                          setTimeout(() => calendar.classList.add('hidden'), 200);
                        }
                      }
                    }}
                    className="bg-white/90 backdrop-blur-sm px-4 py-1.5 rounded-lg border-2 border-green-400 shadow-md text-sm font-semibold text-green-700 min-w-[180px] text-center hover:scale-105 transition-all cursor-pointer"
                  >
                    {MONTHS[dashboardEndMonth]} {dashboardEndYear}
                    {dashboardEndDay !== 'todos' && ` (${dashboardEndDay.padStart(2, '0')})`}
                    {dashboardEndDay === 'todos' && ' (Todos)'}
                  </button>
                  
                  <button
                    onClick={() => {
                      const newMonth = dashboardEndMonth === 11 ? 0 : dashboardEndMonth + 1;
                      const newYear = dashboardEndMonth === 11 ? dashboardEndYear + 1 : dashboardEndYear;
                      setDashboardEndMonth(newMonth);
                      setDashboardEndYear(newYear);
                      setDashboardEndDay('todos');
                    }}
                    className="flex items-center justify-center px-3 py-1.5 rounded-lg bg-white/90 backdrop-blur-sm border-2 border-gray-300 shadow-md hover:shadow-lg hover:scale-105 transition-all duration-200 text-gray-700 hover:bg-gray-50 text-sm font-bold"
                    title="Próximo mês"
                  >
                    ›
                  </button>

                  {/* Calendário Dropdown Final */}
                  <style>{`
                    #dashboard-end-calendar {
                      opacity: 0;
                      transform: translateY(-10px);
                      transition: opacity 200ms, transform 200ms;
                    }
                    #dashboard-end-calendar.calendar-dropdown-open {
                      opacity: 1;
                      transform: translateY(0);
                    }
                  `}</style>
                  <div
                    id="dashboard-end-calendar"
                    className="hidden absolute top-full left-20 mt-0.5 p-3 bg-white/95 backdrop-blur-md rounded-xl shadow-2xl border-2 border-green-300 z-[10001] w-[320px]"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="grid grid-cols-7 gap-1 mb-2">
                      {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((day, idx) => (
                        <div key={idx} className="text-center text-xs font-bold text-gray-500 py-1">
                          {day}
                        </div>
                      ))}
                    </div>
                    <div className="grid grid-cols-7 gap-1">
                      {(() => {
                        const firstDay = new Date(dashboardEndYear, dashboardEndMonth, 1).getDay();
                        const daysInMonth = new Date(dashboardEndYear, dashboardEndMonth + 1, 0).getDate();
                        const days = [];
                        
                        for (let i = 0; i < firstDay; i++) {
                          days.push(<div key={`empty-${i}`} className="p-2"></div>);
                        }
                        
                        for (let day = 1; day <= daysInMonth; day++) {
                          const dayStr = day.toString();
                          const isSelected = dashboardEndDay === dayStr;
                          
                          days.push(
                            <button
                              key={day}
                              onClick={() => {
                                if (dashboardEndDay === dayStr) {
                                  setDashboardEndDay('todos');
                                } else {
                                  setDashboardEndDay(dayStr);
                                }
                                const calendar = document.getElementById('dashboard-end-calendar');
                                if (calendar) {
                                  calendar.classList.remove('calendar-dropdown-open');
                                  setTimeout(() => calendar.classList.add('hidden'), 200);
                                }
                              }}
                              className={`p-2 rounded-lg text-xs font-bold transition-all duration-200 hover:scale-110 hover:shadow-lg border-2 ${
                                isSelected 
                                  ? 'bg-gradient-to-br from-green-500 to-emerald-600 text-white shadow-lg ring-2 ring-green-400 scale-105' 
                                  : 'bg-white/50 text-gray-700 border-gray-200 hover:bg-green-50'
                              }`}
                            >
                              {day}
                            </button>
                          );
                        }
                        return days;
                      })()}
                    </div>
                  </div>
                </div>

                {/* Botões Rápidos */}
                <div className="flex items-center gap-2 ml-auto">
                  <button
                    onClick={() => {
                      const now = new Date();
                      setDashboardStartMonth(now.getMonth());
                      setDashboardStartYear(now.getFullYear());
                      setDashboardStartDay('todos');
                      setDashboardEndMonth(now.getMonth());
                      setDashboardEndYear(now.getFullYear());
                      setDashboardEndDay('todos');
                    }}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-100 text-indigo-700 border-2 border-indigo-300 hover:bg-indigo-200 hover:scale-105 transition-all duration-200 shadow-sm"
                  >
                    📅 Mês Atual
                  </button>
                  <button
                    onClick={() => {
                      const now = new Date();
                      const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, 1);
                      setDashboardStartMonth(threeMonthsAgo.getMonth());
                      setDashboardStartYear(threeMonthsAgo.getFullYear());
                      setDashboardStartDay('todos');
                      setDashboardEndMonth(now.getMonth());
                      setDashboardEndYear(now.getFullYear());
                      setDashboardEndDay('todos');
                    }}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-100 text-blue-700 border-2 border-blue-300 hover:bg-blue-200 hover:scale-105 transition-all duration-200 shadow-sm"
                  >
                    📊 Últimos 3 Meses
                  </button>
                  <button
                    onClick={() => {
                      const now = new Date();
                      const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
                      setDashboardStartMonth(sixMonthsAgo.getMonth());
                      setDashboardStartYear(sixMonthsAgo.getFullYear());
                      setDashboardStartDay('todos');
                      setDashboardEndMonth(now.getMonth());
                      setDashboardEndYear(now.getFullYear());
                      setDashboardEndDay('todos');
                    }}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-purple-100 text-purple-700 border-2 border-purple-300 hover:bg-purple-200 hover:scale-105 transition-all duration-200 shadow-sm"
                  >
                    📈 Últimos 6 Meses
                  </button>
                  <button
                    onClick={() => {
                      const now = new Date();
                      setDashboardStartMonth(0);
                      setDashboardStartYear(now.getFullYear());
                      setDashboardStartDay('todos');
                      setDashboardEndMonth(11);
                      setDashboardEndYear(now.getFullYear());
                      setDashboardEndDay('todos');
                    }}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-green-100 text-green-700 border-2 border-green-300 hover:bg-green-200 hover:scale-105 transition-all duration-200 shadow-sm"
                  >
                    📆 Ano Completo
                  </button>
                </div>
              </div>
                </div>

            {/* Cards de Resumo Modernos */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Total de OS */}
              <Card className="border-l-4 border-l-blue-500">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                    📊 Total de OS
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-gray-900">{dashboardData.totalOS}</div>
                  <p className="text-xs text-gray-500 mt-1">Ordens de serviço</p>
                </CardContent>
              </Card>

              {/* Faturamento Programado */}
              <Card className="border-l-4 border-l-orange-500">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                    💰 Programado
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-orange-600">
                    {formatCurrency(dashboardData.programmedValue)}
                </div>
                  <p className="text-xs text-gray-500 mt-1">Valor a executar</p>
              </CardContent>
            </Card>

              {/* Faturamento Executado */}
              <Card className="border-l-4 border-l-green-500">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                    ✅ Executado
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-green-600">
                    {formatCurrency(dashboardData.executedValue)}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Valor executado</p>
                </CardContent>
              </Card>

              {/* Ticket Médio */}
              <Card className="border-l-4 border-l-indigo-500">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                    💵 Ticket Médio
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-indigo-600">
                    {formatCurrency(dashboardData.avgTicket)}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Valor médio por OS</p>
                </CardContent>
              </Card>

              {/* OS Críticas */}
              <Card className="border-l-4 border-l-yellow-500">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                    ⚠️ OS Críticas
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-yellow-600">{dashboardData.criticalOS}</div>
                  <p className="text-xs text-gray-500 mt-1">Requerem atenção urgente</p>
                </CardContent>
              </Card>

              {/* OS Vencidas */}
              <Card className="border-l-4 border-l-red-500">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                    🔴 OS Vencidas
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-red-600">{dashboardData.expiredOS}</div>
                  <p className="text-xs text-gray-500 mt-1">Mais de 30 dias em aberto</p>
                </CardContent>
              </Card>

              {/* Tempo Médio */}
              <Card className="border-l-4 border-l-purple-500">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                    ⏱️ Tempo Médio
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-purple-600">{dashboardData.avgDaysOpen}</div>
                  <p className="text-xs text-gray-500 mt-1">Dias em aberto</p>
                </CardContent>
              </Card>

              {/* Equipes Ativas */}
              <Card className="border-l-4 border-l-cyan-500">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                    👥 Equipes Ativas
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-cyan-600">{dashboardData.totalTeams}</div>
                  <p className="text-xs text-gray-500 mt-1">Equipes trabalhando</p>
                </CardContent>
              </Card>
            </div>

            {/* Cards de Faturamento por Status */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Faturamento por Status</CardTitle>
                <CardDescription>Distribuição financeira por tipo de ordem</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
                  {/* Programado */}
                  <div className="bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-blue-300 rounded-lg p-4 shadow-md hover:shadow-lg transition-all">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-3 h-3 bg-blue-600 rounded-full"></div>
                      <span className="text-sm font-semibold text-blue-900">Programado</span>
                    </div>
                    <div className="text-2xl font-bold text-blue-700">
                      {formatCurrency(dashboardData.programmedValue)}
                    </div>
                    <div className="text-xs text-blue-600 mt-1">
                      {dashboardData.teamStats.reduce((sum, t) => sum + t.statusCount.PROG, 0)} OS
                    </div>
                  </div>

                  {/* Executado */}
                  <div className="bg-gradient-to-br from-green-50 to-green-100 border-2 border-green-300 rounded-lg p-4 shadow-md hover:shadow-lg transition-all">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-3 h-3 bg-green-600 rounded-full"></div>
                      <span className="text-sm font-semibold text-green-900">Executado</span>
                    </div>
                    <div className="text-2xl font-bold text-green-700">
                      {formatCurrency(dashboardData.executedValue)}
                    </div>
                    <div className="text-xs text-green-600 mt-1">
                      {dashboardData.teamStats.reduce((sum, t) => sum + t.statusCount.EXEC, 0)} OS
                    </div>
                  </div>

                  {/* Parcial Planejado */}
                  <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 border-2 border-yellow-300 rounded-lg p-4 shadow-md hover:shadow-lg transition-all">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-3 h-3 bg-yellow-600 rounded-full"></div>
                      <span className="text-sm font-semibold text-yellow-900">Parcial Planejado</span>
                    </div>
                    <div className="text-2xl font-bold text-yellow-700">
                      {formatCurrency(
                        Object.values(dashboardActivities)
                          .flat()
                          .filter(a => a.status === 'PARP')
                          .reduce((sum, a) => sum + a.value, 0)
                      )}
                    </div>
                    <div className="text-xs text-yellow-600 mt-1">
                      {dashboardData.teamStats.reduce((sum, t) => sum + t.statusCount.PARP, 0)} OS
                    </div>
                  </div>

                  {/* Parcial Não Planejado */}
                  <div className="bg-gradient-to-br from-orange-50 to-orange-100 border-2 border-orange-300 rounded-lg p-4 shadow-md hover:shadow-lg transition-all">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-3 h-3 bg-orange-600 rounded-full"></div>
                      <span className="text-sm font-semibold text-orange-900">Parcial Não Planejado</span>
                    </div>
                    <div className="text-2xl font-bold text-orange-700">
                      {formatCurrency(
                        Object.values(dashboardActivities)
                          .flat()
                          .filter(a => a.status === 'PANP')
                          .reduce((sum, a) => sum + a.value, 0)
                      )}
                    </div>
                    <div className="text-xs text-orange-600 mt-1">
                      {dashboardData.teamStats.reduce((sum, t) => sum + t.statusCount.PANP, 0)} OS
                    </div>
                  </div>

                  {/* Cancelado - Vermelho e não contabilizado */}
                  <div className="bg-gradient-to-br from-red-50 to-red-100 border-2 border-red-400 rounded-lg p-4 shadow-md hover:shadow-lg transition-all opacity-75">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-3 h-3 bg-red-600 rounded-full"></div>
                      <span className="text-sm font-semibold text-red-900">Cancelado</span>
                    </div>
                    <div className="text-2xl font-bold text-red-700 line-through">
                      {formatCurrency(
                        Object.values(dashboardActivities)
                          .flat()
                          .filter(a => a.status === 'CANC')
                          .reduce((sum, a) => sum + a.value, 0)
                      )}
                    </div>
                    <div className="text-xs text-red-600 mt-1 flex items-center gap-1">
                      <span>❌ {dashboardData.teamStats.reduce((sum, t) => sum + t.statusCount.CANC, 0)} OS</span>
                      <span className="text-[10px]">(não contabilizado)</span>
                    </div>
                  </div>
                </div>

                {/* Resumo Total */}
                <div className="mt-4 p-4 bg-gradient-to-r from-indigo-50 to-purple-50 border-2 border-indigo-300 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-semibold text-indigo-900 mb-1">💰 Faturamento Total Válido</div>
                      <div className="text-xs text-indigo-600">
                        (Excluindo cancelamentos)
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-3xl font-bold text-indigo-700">
                        {formatCurrency(
                          Object.values(dashboardActivities)
                            .flat()
                            .filter(a => a.status !== 'CANC')
                            .reduce((sum, a) => sum + a.value, 0)
                        )}
                      </div>
                      <div className="text-xs text-indigo-600 mt-1">
                        {Object.values(dashboardActivities).flat().filter(a => a.status !== 'CANC').length} OS válidas
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Tabela de Desempenho por Equipe */}
            <Card>
              <CardHeader>
                <CardTitle>Desempenho por Equipe</CardTitle>
                <CardDescription>Resumo financeiro e operacional detalhado por equipe</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Equipe</TableHead>
                        <TableHead className="text-center">Total OS</TableHead>
                        <TableHead className="text-center">Programado</TableHead>
                        <TableHead className="text-center">Executado</TableHead>
                        <TableHead className="text-center">Ticket Médio</TableHead>
                        <TableHead className="text-center">Críticas</TableHead>
                        <TableHead className="text-center">Vencidas</TableHead>
                        <TableHead className="text-center">Dias Médio</TableHead>
                        <TableHead className="text-center">PROG</TableHead>
                        <TableHead className="text-center">EXEC</TableHead>
                        <TableHead className="text-center">CANC</TableHead>
                        <TableHead className="text-center">PARP</TableHead>
                        <TableHead className="text-center">PANP</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                      {dashboardData.teamStats
                        .sort((a, b) => {
                          // Ordenar: primeiro equipes com OS (por valor), depois equipes sem OS
                          if (a.osCount > 0 && b.osCount === 0) return -1;
                          if (a.osCount === 0 && b.osCount > 0) return 1;
                          return b.totalValue - a.totalValue;
                        })
                        .map((team) => (
                        <TableRow key={team.team} className="hover:bg-gray-50">
                          <TableCell className="font-semibold">{team.team}</TableCell>
                          <TableCell className="text-center font-medium">{team.osCount}</TableCell>
                          <TableCell className="text-center text-orange-600 font-semibold">
                            {formatCurrency(team.programmedValue)}
                        </TableCell>
                          <TableCell className="text-center text-green-600 font-semibold">
                            {formatCurrency(team.executedValue)}
                          </TableCell>
                          <TableCell className="text-center text-indigo-600 font-medium">
                          {formatCurrency(team.totalValue / team.osCount)}
                        </TableCell>
                          <TableCell className="text-center">
                            <Badge variant={team.criticalCount > 0 ? "destructive" : "outline"} className="min-w-[40px]">
                              {team.criticalCount}
                            </Badge>
                        </TableCell>
                          <TableCell className="text-center">
                            <Badge variant={team.expiredCount > 0 ? "destructive" : "outline"} className="min-w-[40px]">
                              {team.expiredCount}
                            </Badge>
                        </TableCell>
                          <TableCell className="text-center">
                            <Badge variant={team.avgDaysOpen > 30 ? "destructive" : team.avgDaysOpen > 15 ? "default" : "secondary"} className="min-w-[40px]">
                              {team.avgDaysOpen}d
                            </Badge>
                        </TableCell>
                          <TableCell className="text-center">
                            <Badge className="bg-blue-100 text-blue-700 min-w-[40px]">{team.statusCount.PROG}</Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge className="bg-green-100 text-green-700 min-w-[40px]">{team.statusCount.EXEC}</Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge className="bg-red-100 text-red-700 min-w-[40px]">{team.statusCount.CANC}</Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge className="bg-yellow-100 text-yellow-700 min-w-[40px]">{team.statusCount.PARP}</Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge className="bg-orange-100 text-orange-700 min-w-[40px]">{team.statusCount.PANP}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Modal para adicionar OS para equipe específica */}
      {showEquipeModal && selectedEquipe && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold mb-4">
              Criar OS para {selectedEquipe.prefixo || selectedEquipe.nome}
            </h3>
            
            <form onSubmit={async (e) => {
              e.preventDefault();
              try {
                const formData = new FormData(e.currentTarget);
                const osNumber = formData.get('osNumber') as string;
                const value = parseFloat(formData.get('value') as string);
                const location = formData.get('location') as string;
                const setor = formData.get('setor') as string;
                const notes = formData.get('notes') as string;

                // Criar ou buscar schedule para a data
                const schedules = await NetworkMaintenanceService.getSchedulesByDateRange(selectedDate, selectedDate);
                let scheduleId: string;
                
                if (schedules.length > 0) {
                  scheduleId = schedules[0].id;
                } else {
                  const dateObj = new Date(selectedDate);
                  const newSchedule = await NetworkMaintenanceService.createSchedule({
                    date: selectedDate,
                    dayOfWeek: dateObj.getDay()
                  });
                  scheduleId = newSchedule.id;
                }

                // Adicionar atividade
                await NetworkMaintenanceService.addActivity({
                  scheduleId,
                  team: selectedEquipe.prefixo || selectedEquipe.nome,
                  osNumber,
                  value,
                  status: ActivityStatus.PROG,
                  location: location || undefined,
                  setor: setor || undefined,
                  notes: notes || undefined
                });

                // Fechar modal e recarregar dados
                setShowEquipeModal(false);
                setSelectedEquipe(null);
                setSelectedDate('');
                loadActivities();
                alert('OS criada com sucesso!');
              } catch (err) {
                console.error('Erro ao criar OS:', err);
                alert('Erro ao criar OS. Tente novamente.');
              }
            }}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Data
                  </label>
                  <input
                    type="text"
                    value={selectedDate}
                    disabled
                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Equipe
                  </label>
                  <input
                    type="text"
                    value={selectedEquipe.prefixo || selectedEquipe.nome}
                    disabled
                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Setor
                  </label>
                  <input
                    type="text"
                    name="setor"
                    defaultValue={selectedEquipe.setor || ''}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Ex: Elétrica, Mecânica, Civil"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Número da OS *
                  </label>
                  <input
                    type="text"
                    name="osNumber"
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Ex: CT0321343837"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Valor (R$) *
                  </label>
                  <input
                    type="number"
                    name="value"
                    step="0.01"
                    min="0"
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Ex: 6851.17"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Local
                  </label>
                  <input
                    type="text"
                    name="location"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Ex: NITERÓI"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Observações
                  </label>
                  <textarea
                    name="notes"
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Observações adicionais..."
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowEquipeModal(false);
                    setSelectedEquipe(null);
                    setSelectedDate('');
                  }}
                  className="px-4 py-2 text-gray-700 bg-gray-200 hover:bg-gray-300 rounded-md transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors"
                >
                  Criar OS
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Visualização Completa da OS */}
      {viewingActivity && (
        <Dialog open={!!viewingActivity} onOpenChange={() => setViewingActivity(null)}>
          <DialogContent className="max-w-4xl w-[90vw] max-h-[120vh] overflow-y-auto z-[9999]" style={{ transform: 'scale(0.8)', transformOrigin: 'center' }}>
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold text-gray-900">
                Detalhes da Ordem de Serviço
              </DialogTitle>
              <DialogDescription>
                Informações completas da OS {viewingActivity.osNumber}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6 mt-4">
              {/* Seção Principal */}
              <div className="bg-gradient-to-r from-blue-50 to-blue-100 p-4 rounded-lg border border-blue-200">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs font-medium text-gray-600 mb-1">Número da OS</p>
                    <p className="text-lg font-bold text-gray-900 font-mono">{viewingActivity.osNumber}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-600 mb-1">Status</p>
                    <Badge 
                      variant={
                        viewingActivity.status === 'CANC' ? 'destructive' :
                        viewingActivity.status === 'PARP' ? 'default' :
                        viewingActivity.status === 'EXEC' ? 'secondary' :
                        viewingActivity.status === 'PROG' ? 'outline' : 'secondary'
                      }
                      className="text-sm px-3 py-1"
                    >
                      {viewingActivity.status === 'PROG' ? 'Programada' :
                       viewingActivity.status === 'EXEC' ? 'Executada' :
                       viewingActivity.status === 'CANC' ? 'Cancelada' :
                       viewingActivity.status === 'PARP' ? 'Parcial Planejada' :
                       viewingActivity.status === 'PANP' ? 'Parcial Não Planejada' : viewingActivity.status}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Informações da Equipe e Data */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-4 rounded-lg border border-gray-200">
                  <p className="text-xs font-medium text-gray-600 mb-2">Equipe</p>
                  <p className="text-base font-semibold text-gray-900">{viewingActivity.team}</p>
                </div>
                
                <div className="bg-white p-4 rounded-lg border border-gray-200">
                  <p className="text-xs font-medium text-gray-600 mb-2">Data</p>
                  <p className="text-base font-semibold text-gray-900">
                    {viewingActivity.date && new Date(viewingActivity.date + 'T12:00:00').toLocaleDateString('pt-BR', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric'
                    })}
                  </p>
                </div>

                <div className="bg-white p-4 rounded-lg border border-gray-200">
                  <p className="text-xs font-medium text-gray-600 mb-2">Valor</p>
                  <p className="text-xl font-bold text-emerald-600">
                    R$ {viewingActivity.value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
              </div>

                  {/* Prioridade e Crítico */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {viewingActivity.prioridade && (
                <div className="bg-white p-4 rounded-lg border border-gray-200">
                  <p className="text-xs font-medium text-gray-600 mb-2">⭐ Prioridade</p>
                  <p className="text-base font-semibold text-gray-900">{viewingActivity.prioridade}</p>
                </div>
              )}

                    {viewingActivity.critico && (
                      <div className={`p-4 rounded-lg border ${viewingActivity.critico.toUpperCase() === 'SIM'
                          ? 'bg-red-50 border-red-200'
                          : 'bg-white border-gray-200'
                        }`}>
                        <p className="text-xs font-medium text-gray-600 mb-2">
                          {viewingActivity.critico.toLowerCase() === 'sim' ? '🚨 CRÍTICO' : '📋 Crítico'}
                        </p>
                        <p className={`text-base font-semibold ${viewingActivity.critico.toUpperCase() === 'SIM'
                            ? 'text-red-900'
                            : 'text-gray-900'
                          }`}>
                          {viewingActivity.critico}
                        </p>
                      </div>
                    )}
                  </div>

              {/* Tipo de Serviço */}
              {viewingActivity.tipoServico && (
                <div className="bg-white p-4 rounded-lg border border-gray-200">
                  <p className="text-xs font-medium text-gray-600 mb-2">🔧 Tipo de Serviço</p>
                  <p className="text-base text-gray-900">{viewingActivity.tipoServico}</p>
                </div>
              )}

              {/* Horários de Obra */}
              {(viewingActivity.horarioInicio || viewingActivity.horarioFim) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {viewingActivity.horarioInicio && (
                    <div className="bg-white p-4 rounded-lg border border-gray-200">
                      <p className="text-xs font-medium text-gray-600 mb-2">🕐 Início Obra</p>
                      <p className="text-base font-semibold text-gray-900">{viewingActivity.horarioInicio}</p>
                    </div>
                  )}

                  {viewingActivity.horarioFim && (
                    <div className="bg-white p-4 rounded-lg border border-gray-200">
                      <p className="text-xs font-medium text-gray-600 mb-2">🕐 Término Obra</p>
                      <p className="text-base font-semibold text-gray-900">{viewingActivity.horarioFim}</p>
                    </div>
                  )}
                </div>
              )}

                  {/* Localização, Ponto Elétrico e Coordenada */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {viewingActivity.location && (
                  <div className="bg-white p-4 rounded-lg border border-gray-200">
                    <p className="text-xs font-medium text-gray-600 mb-2">📍 Localização</p>
                    <p className="text-base text-gray-900">{viewingActivity.location}</p>
                  </div>
                )}

                {viewingActivity.pontoEletrico && (
                  <div className="bg-white p-4 rounded-lg border border-gray-200">
                    <p className="text-xs font-medium text-gray-600 mb-2">⚡ Ponto Elétrico</p>
                    <p className="text-base text-gray-900">{viewingActivity.pontoEletrico}</p>
                  </div>
                )}

                    {viewingActivity.coordenada && (
                      <div className="bg-white p-4 rounded-lg border border-gray-200">
                        <p className="text-xs font-medium text-gray-600 mb-2">🌍 Coordenada</p>
                        <p className="text-base text-gray-900 font-mono text-sm">{viewingActivity.coordenada}</p>
                        {viewingActivity.coordenada && (
                          <button
                            onClick={() => {
                              const coords = viewingActivity.coordenada?.split(',').map(c => c.trim());
                              if (coords && coords.length === 2) {
                                const [lat, lng] = coords;
                                window.open(`https://www.google.com/maps?q=${lat},${lng}`, '_blank');
                              }
                            }}
                            className="mt-2 text-xs text-blue-600 hover:text-blue-800 underline"
                          >
                            Ver no mapa
                          </button>
                        )}
                  </div>
                )}
              </div>

              {/* Horários de Intervenção */}
              {(viewingActivity.inicioIntervencao || viewingActivity.terminoIntervencao) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {viewingActivity.inicioIntervencao && (
                    <div className="bg-white p-4 rounded-lg border border-gray-200">
                      <p className="text-xs font-medium text-gray-600 mb-2">🔌 Início Intervenção</p>
                      <p className="text-base font-semibold text-gray-900">{viewingActivity.inicioIntervencao}</p>
                    </div>
                  )}

                  {viewingActivity.terminoIntervencao && (
                    <div className="bg-white p-4 rounded-lg border border-gray-200">
                      <p className="text-xs font-medium text-gray-600 mb-2">🔌 Término Intervenção</p>
                      <p className="text-base font-semibold text-gray-900">{viewingActivity.terminoIntervencao}</p>
                    </div>
                  )}
                </div>
              )}

              {/* SGD - Label customizado */}
              {(viewingActivity.tipoSGD || viewingActivity.numeroSGD) && (() => {
                // Buscar label customizado do tipoSGD na configuração
                let sgdLabel = 'SGD'; // Padrão
                if (contratoConfig?.columnMapping?.tipoSGD && 
                    typeof contratoConfig.columnMapping.tipoSGD === 'object' && 
                    Object.keys(contratoConfig.columnMapping.tipoSGD).length > 0) {
                  const tipoSGDMapping = normalizeColumnMapping(contratoConfig.columnMapping.tipoSGD as ColumnMappingValue);
                  if (tipoSGDMapping.label) {
                    sgdLabel = tipoSGDMapping.label;
                  }
                }
                
                return (
                  <div className="bg-white p-4 rounded-lg border border-gray-200">
                    <p className="text-xs font-medium text-gray-600 mb-2">📋 {sgdLabel}</p>
                    <p className="text-base text-gray-900">
                      {viewingActivity.tipoSGD && viewingActivity.numeroSGD 
                        ? `${viewingActivity.tipoSGD} - ${viewingActivity.numeroSGD}`
                        : viewingActivity.tipoSGD || viewingActivity.numeroSGD}
                    </p>
                  </div>
                );
              })()}

              {/* Apoio */}
              {viewingActivity.apoio && (
                <div className="bg-white p-4 rounded-lg border border-gray-200">
                  <p className="text-xs font-medium text-gray-600 mb-2">🤝 Apoio</p>
                  <p className="text-base text-gray-900">{viewingActivity.apoio}</p>
                </div>
              )}

              {/* Atividade (campo atividade do Excel - OBS) */}
              {viewingActivity.atividade && (
                <div className="bg-white p-4 rounded-lg border border-gray-200">
                  <p className="text-xs font-medium text-gray-600 mb-2">🔧 Atividade</p>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{viewingActivity.atividade}</p>
                </div>
              )}

              {/* Descrição do Serviço (campo notes antigo) */}
              {viewingActivity.notes && (
                <div className="bg-white p-4 rounded-lg border border-gray-200">
                  <p className="text-xs font-medium text-gray-600 mb-2">📄 Descrição do Serviço</p>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{viewingActivity.notes}</p>
                </div>
              )}

              {/* Observações (campo obs novo - Anotação do Excel) */}
              {viewingActivity.obs && (
                <div className="bg-white p-4 rounded-lg border border-gray-200">
                  <p className="text-xs font-medium text-gray-600 mb-2">📝 Observações</p>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{viewingActivity.obs}</p>
                </div>
              )}

              {/* Notas do Status */}
              {viewingActivity.statusNotes && (
                <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                  <p className="text-xs font-medium text-yellow-800 mb-2">⚠️ Informações do Status</p>
                  <p className="text-sm text-yellow-900 whitespace-pre-wrap">{viewingActivity.statusNotes}</p>
                </div>
              )}

               {/* Botão de Ação */}
               <div className="flex justify-end pt-4 border-t">
                 <Button
                   variant="default"
                   onClick={() => setViewingActivity(null)}
                   className="bg-blue-600 hover:bg-blue-700"
                 >
                   Fechar
                 </Button>
               </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Modal de Gerenciar Encarregados */}
      <Dialog open={showEncarregadosModal} onOpenChange={setShowEncarregadosModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Gerenciar Encarregados - {selectedContrato}</DialogTitle>
            <DialogDescription>
              Defina os encarregados para as equipes deste contrato. Apenas equipes que requerem encarregado são exibidas.
            </DialogDescription>
          </DialogHeader>

          {loadingEncarregados ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                <p className="text-sm text-gray-600">Carregando equipes e funcionários...</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {equipesComEncarregado.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p>Nenhuma equipe encontrada para este contrato.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {equipesComEncarregado.map((equipe) => (
                    <EquipeEncarregadoItem
                      key={equipe.id}
                      equipe={equipe}
                      funcionarios={funcionarios}
                      onUpdateEncarregado={updateEncarregado}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => setShowEncarregadosModal(false)}>
              Fechar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
        </div>
      </div>
    </>
  );
}