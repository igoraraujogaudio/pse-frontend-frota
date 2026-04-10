import { supabase } from '@/lib/supabase';
import { 
  ActivityStatus, 
  NetworkMaintenanceSchedule, 
  NetworkMaintenanceActivity, 
  ImportedNetworkMaintenanceData,
  CalendarView 
} from '@/types/maintenance-schedule';

interface DatabaseSchedule {
  id: string;
  date: string;
  day_of_week: number;
  activities: DatabaseActivity[];
  created_at: string;
  updated_at: string;
}

interface DatabaseActivity {
  id: string;
  schedule_id: string;
  team: string;
  os_number: string;
  value: number;
  status: string;
  status_notes?: string;
  location: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  contrato_id?: string;
  prioridade?: string;
  atividade?: string;
  ponto_eletrico?: string;
  inicio_intervencao?: string;
  termino_intervencao?: string;
  tipo_sgd?: string;
  numero_sgd?: string;
  obs?: string;
  apoio?: string;
  critico?: string;
  coordenada?: string;
  validade?: string;
}

export class NetworkMaintenanceService {
  // Buscar programações por período (opcionalmente filtrar por contrato)
  static async getSchedulesByDateRange(startDate: string, endDate: string, contratoId?: string): Promise<NetworkMaintenanceSchedule[]> {
    console.log(`🔍 getSchedulesByDateRange chamado: ${startDate} a ${endDate}, contratoId: ${contratoId || 'nenhum'}`);
    
    // Buscar todos os schedules no período
    const query = supabase
      .from('network_maintenance_schedules')
      .select(`
        *,
        activities:network_maintenance_activities(*)
      `)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: true });

    const { data, error } = await query;

    if (error) {
      console.error('Erro ao buscar schedules:', error);
      throw error;
    }
    
    const totalAtividadesAntes = data?.reduce((sum, s) => sum + (s.activities?.length || 0), 0) || 0;
    console.log(`📋 Schedules encontrados: ${data?.length || 0}, total de atividades antes do filtro: ${totalAtividadesAntes}`);
    
    if (contratoId) {
      const targetContratoIdStr = String(contratoId).trim();
      console.log(`🔍 Filtrando por contratoId: "${targetContratoIdStr}" (tipo: ${typeof contratoId})`);
      
      // Contar quantas atividades têm o contrato_id correto
      const atividadesComContrato = data?.reduce((sum, s) => {
        return sum + (s.activities?.filter((a: DatabaseActivity) => {
          const aId = a.contrato_id ? String(a.contrato_id).trim() : null;
          const matches = aId === targetContratoIdStr;
          return matches;
        }).length || 0);
      }, 0) || 0;
      
      // Contar atividades sem contrato_id (NULL)
      const atividadesSemContrato = data?.reduce((sum, s) => {
        return sum + (s.activities?.filter((a: DatabaseActivity) => !a.contrato_id).length || 0);
      }, 0) || 0;
      
      // Mostrar exemplos de contrato_id encontrados
      const exemplosContratoIds = new Set<string>();
      data?.forEach(s => {
        s.activities?.forEach((a: DatabaseActivity) => {
          if (a.contrato_id) {
            exemplosContratoIds.add(String(a.contrato_id).trim());
          }
        });
      });
      
      console.log(`📊 Atividades com contrato_id=${targetContratoIdStr}: ${atividadesComContrato} de ${totalAtividadesAntes}`);
      console.log(`📊 Atividades sem contrato_id (NULL): ${atividadesSemContrato}`);
      console.log(`📊 Exemplos de contrato_id encontrados nas atividades:`, Array.from(exemplosContratoIds).slice(0, 5));
      
      // Verificar se algum dos IDs encontrados corresponde (apenas log informativo, não erro)
      const idsCorrespondem = Array.from(exemplosContratoIds).some(id => id === targetContratoIdStr);
      if (!idsCorrespondem && exemplosContratoIds.size > 0) {
        // Não é erro - apenas informativo que não há atividades para este contrato
        console.log(`ℹ️ Nenhuma atividade encontrada para o contrato ${targetContratoIdStr} (pode ser normal se não houver programações)`);
      }
    }
    
    // Transform database data to match interface
    return (data || []).map((schedule: DatabaseSchedule) => {
      // Filtrar atividades por contrato se especificado
      let activities = schedule.activities || [];
      if (contratoId) {
        const beforeFilter = activities.length;
        const targetContratoId = String(contratoId).trim();
        
        activities = activities.filter((activity: DatabaseActivity) => {
          // Comparar como string para garantir que funcione
          const activityContratoId = activity.contrato_id ? String(activity.contrato_id).trim() : null;
          
          // Se a atividade não tem contrato_id, não incluir (a menos que seja legado e queiramos tratar diferente)
          if (!activityContratoId) {
            return false; // Não mostrar atividades sem contrato_id quando um contrato está selecionado
          }
          
          const matches = activityContratoId === targetContratoId;
          
          // Log detalhado apenas para debug
          if (!matches && beforeFilter > 0 && activities.length < 3) {
            console.log(`🚫 Atividade ${activity.os_number || activity.id} filtrada: contrato_id="${activityContratoId}" !== "${targetContratoId}"`);
          }
          return matches;
        });
        
        if (beforeFilter !== activities.length) {
          console.log(`✅ Filtro aplicado no schedule ${schedule.date}: ${beforeFilter} → ${activities.length} atividades para contrato ${contratoId}`);
        } else if (beforeFilter > 0) {
          console.log(`ℹ️ Schedule ${schedule.date}: ${beforeFilter} atividades, todas correspondem ao contrato ${contratoId}`);
        } else if (beforeFilter === 0 && schedule.activities && schedule.activities.length > 0) {
          // Se tinha atividades mas nenhuma passou no filtro
          const semContratoId = schedule.activities.filter((a: DatabaseActivity) => !a.contrato_id).length;
          const comOutroContrato = schedule.activities.filter((a: DatabaseActivity) => {
            const aId = a.contrato_id ? String(a.contrato_id).trim() : null;
            return aId && aId !== targetContratoId;
          }).length;
          console.log(`⚠️ Schedule ${schedule.date}: ${schedule.activities.length} atividades, mas nenhuma corresponde ao contrato ${contratoId} (${semContratoId} sem contrato_id, ${comOutroContrato} com outro contrato)`);
        }
      } else {
        // Se não há contrato selecionado, NÃO mostrar atividades (exigir seleção de contrato)
        activities = [];
        if (schedule.activities && schedule.activities.length > 0) {
          console.log(`⚠️ Schedule ${schedule.date}: ${schedule.activities.length} atividades ignoradas (nenhum contrato selecionado)`);
        }
      }
      
      return {
        id: schedule.id,
        date: schedule.date,
        dayOfWeek: schedule.day_of_week,
        activities: activities.map((activity: DatabaseActivity) => ({
          id: activity.id,
          scheduleId: activity.schedule_id,
          team: activity.team,
          osNumber: activity.os_number,
          value: activity.value,
          status: activity.status as ActivityStatus,
          statusNotes: activity.status_notes,
          location: activity.location,
          notes: activity.notes,
          createdAt: activity.created_at,
          updatedAt: activity.updated_at,
          contratoId: activity.contrato_id,
          prioridade: activity.prioridade,
          atividade: activity.atividade,
          pontoEletrico: activity.ponto_eletrico,
          inicioIntervencao: activity.inicio_intervencao,
          terminoIntervencao: activity.termino_intervencao,
          tipoSGD: activity.tipo_sgd,
          numeroSGD: activity.numero_sgd,
          obs: activity.obs,
          apoio: activity.apoio,
          critico: activity.critico,
          coordenada: activity.coordenada,
          validade: activity.validade,
        })),
        createdAt: schedule.created_at,
        updatedAt: schedule.updated_at
      };
    }).filter(schedule => schedule.activities.length > 0); // Remover schedules sem atividades após filtro
  }

  // Buscar programações por mês/ano
  static async getSchedulesByMonth(year: number, month: number): Promise<CalendarView> {
    const startDate = `${year}-${month.toString().padStart(2, '0')}-01`;
    const endDate = `${year}-${month.toString().padStart(2, '0')}-31`;
    
    const schedules = await this.getSchedulesByDateRange(startDate, endDate);
    
    return {
      year,
      month,
      schedules
    };
  }

  // Criar nova programação
  static async createSchedule(schedule: Partial<NetworkMaintenanceSchedule>): Promise<NetworkMaintenanceSchedule> {
    const { data, error } = await supabase
      .from('network_maintenance_schedules')
      .insert({
        date: schedule.date,
        day_of_week: schedule.dayOfWeek,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;
    
    return {
      id: data.id,
      date: data.date,
      dayOfWeek: data.day_of_week,
      activities: [],
      createdAt: data.created_at,
      updatedAt: data.updated_at
    };
  }

  // Adicionar atividade a uma programação
  static async addActivity(activity: Partial<NetworkMaintenanceActivity>): Promise<NetworkMaintenanceActivity> {
    const { data, error } = await supabase
      .from('network_maintenance_activities')
      .insert({
        schedule_id: activity.scheduleId,
        team: activity.team,
        os_number: activity.osNumber,
        value: activity.value,
        status: activity.status as ActivityStatus,
        status_notes: activity.statusNotes,
        location: activity.location,
        notes: activity.notes,
        contrato_id: activity.contratoId || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;
    
    return {
      id: data.id,
      scheduleId: data.schedule_id,
      team: data.team,
      osNumber: data.os_number,
      value: data.value,
      status: data.status,
      statusNotes: data.status_notes,
      location: data.location,
      notes: data.notes,
      contratoId: data.contrato_id,
      createdAt: data.created_at,
      updatedAt: data.updated_at
    };
  }

  // Atualizar status de atividade
  static async updateActivityStatus(activityId: string, status: string): Promise<void> {
    const { error } = await supabase
      .from('network_maintenance_activities')
      .update({ status })
      .eq('id', activityId);

    if (error) throw error;
  }

  // Atualizar atividade completa
  static async updateActivity(activityId: string, updates: Partial<NetworkMaintenanceActivity>): Promise<void> {
    const { error } = await supabase
      .from('network_maintenance_activities')
      .update({
        schedule_id: updates.scheduleId,
        team: updates.team,
        os_number: updates.osNumber,
        value: updates.value,
        status: updates.status,
        status_notes: updates.statusNotes,
        location: updates.location,
        notes: updates.notes,
        updated_at: new Date().toISOString()
      })
      .eq('id', activityId);

    if (error) throw error;
  }

  // Importar dados de planilha Excel
  static async importFromExcel(data: ImportedNetworkMaintenanceData[]): Promise<void> {
    for (const dayData of data) {
      // Verificar se já existe programação para esta data
      const { data: existingSchedule } = await supabase
        .from('network_maintenance_schedules')
        .select('id')
        .eq('date', dayData.date)
        .single();

      let scheduleId: string;

      if (existingSchedule) {
        scheduleId = existingSchedule.id;
      } else {
        // Criar nova programação
        const dateObj = new Date(dayData.date);
        const { data: newSchedule, error } = await supabase
          .from('network_maintenance_schedules')
          .insert({
            date: dayData.date,
            day_of_week: dateObj.getDay(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .select('id')
          .single();

        if (error) throw error;
        scheduleId = newSchedule.id;
      }

      // Adicionar atividades
      for (const activity of dayData.activities) {
        await supabase
          .from('network_maintenance_activities')
          .insert({
            schedule_id: scheduleId,
            team: activity.team,
            os_number: activity.osNumber,
            value: activity.value,
            status: activity.status as ActivityStatus,
            status_notes: activity.statusNotes,
            location: activity.location,
            notes: activity.notes,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
      }
    }
  }

  // Exportar programação para Excel
  static async exportToExcel(startDate: string, endDate: string): Promise<Record<string, unknown>[]> {
    const schedules = await this.getSchedulesByDateRange(startDate, endDate);
    
    const exportData: Record<string, unknown>[] = [];
    
    schedules.forEach(schedule => {
      schedule.activities.forEach(activity => {
        exportData.push({
          'Data': schedule.date,
          'Dia da Semana': ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'][schedule.dayOfWeek],
          'Equipe': activity.team,
          'Número OS': activity.osNumber,
          'Valor (R$)': activity.value,
          'Status': activity.status,
          'Obs. Status': activity.statusNotes || '',
          'Localização': activity.location,
          'Observações': activity.notes || ''
        });
      });
    });

    return exportData;
  }

  // Buscar atividades por equipe
  static async getActivitiesByTeam(team: string, startDate: string, endDate: string): Promise<NetworkMaintenanceActivity[]> {
    const { data, error } = await supabase
      .from('network_maintenance_activities')
      .select(`
        *,
        schedule:network_maintenance_schedules(date, day_of_week)
      `)
      .eq('team', team)
      .gte('schedule.date', startDate)
      .lte('schedule.date', endDate);

    if (error) throw error;
    
    return (data || []).map((activity: DatabaseActivity) => ({
      id: activity.id,
      scheduleId: activity.schedule_id,
      team: activity.team,
      osNumber: activity.os_number,
      value: activity.value,
      status: activity.status as ActivityStatus,
      statusNotes: activity.status_notes,
      location: activity.location,
      notes: activity.notes,
      createdAt: activity.created_at,
      updatedAt: activity.updated_at
    }));
  }

  // Relatório por status
  static async getActivitiesByStatus(status: string, startDate: string, endDate: string): Promise<NetworkMaintenanceActivity[]> {
    const { data, error } = await supabase
      .from('network_maintenance_activities')
      .select(`
        *,
        schedule:network_maintenance_schedules(date, day_of_week)
      `)
      .eq('status', status)
      .gte('schedule.date', startDate)
      .lte('schedule.date', endDate)
      .order('schedule.date', { ascending: true });

    if (error) throw error;
    
    return (data || []).map((activity: DatabaseActivity) => ({
      id: activity.id,
      scheduleId: activity.schedule_id,
      team: activity.team,
      osNumber: activity.os_number,
      value: activity.value,
      status: activity.status as ActivityStatus,
      statusNotes: activity.status_notes,
      location: activity.location,
      notes: activity.notes,
      createdAt: activity.created_at,
      updatedAt: activity.updated_at
    }));
  }

  // Relatório financeiro
  static async getFinancialReport(startDate: string, endDate: string): Promise<{ total: number; executed: number; programmed: number; cancelled: number; partiallyPaid: number; }> {
    const { data, error } = await supabase
      .from('network_maintenance_activities')
      .select(`
        value,
        status,
        schedule:network_maintenance_schedules(date)
      `)
      .gte('schedule.date', startDate)
      .lte('schedule.date', endDate);

    if (error) throw error;

    const summary = {
      total: 0,
      executed: 0,
      programmed: 0,
      cancelled: 0,
      partiallyPaid: 0
    };

    data?.forEach(activity => {
      summary.total += activity.value;
      switch (activity.status) {
        case 'EXEC':
          summary.executed += activity.value;
          break;
        case 'PROG':
        case 'PANP':
          summary.programmed += activity.value;
          break;
        case 'CANC':
          summary.cancelled += activity.value;
          break;
        case 'PARP':
          summary.partiallyPaid += activity.value;
          break;
      }
    });

    return summary;
  }
}