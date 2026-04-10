// Sistema de Programação de Manutenções de Rede Elétrica - Enel
export interface NetworkMaintenanceSchedule {
  id: string;
  date: string; // YYYY-MM-DD
  dayOfWeek: number; // 0-6 (Sunday-Saturday)
  activities: NetworkMaintenanceActivity[];
  createdAt: string;
  updatedAt: string;
}

export interface NetworkMaintenanceActivity {
  id: string;
  scheduleId: string;
  team: string; // Equipe (ex: MK 01, LV 01, CESTO 01)
  osNumber: string; // Número da OS (ex: A045420293)
  value: number; // Valor em R$
  status: ActivityStatus; // Status da OS
  statusNotes?: string; // Observações específicas do status
  location: string; // Localização (ex: NITEROI)
  setor?: string; // Setor da atividade (ex: Elétrica, Mecânica, Civil)
  notes?: string; // Observações gerais adicionais
  contratoId?: string; // ID do contrato ao qual esta atividade pertence
  createdAt: string;
  updatedAt: string;
  prioridade?: string; // Prioridade
  atividade?: string; // Atividade (campo OBS)
  pontoEletrico?: string; // Nº EQ (RE, CO, CF, CC ou TR)
  inicioIntervencao?: string; // Início do desligamento
  terminoIntervencao?: string; // Término do desligamento
  tipoSGD?: string; // Tipo de SGD
  numeroSGD?: string; // Número SGD
  obs?: string; // Anotação
  apoio?: string; // Apoio
  horarioInicio?: string; // Horário de início da obra
  horarioFim?: string; // Horário de término da obra
  tipoServico?: string; // Tipo de serviço
  critico?: string; // Campo CRITICO da planilha SharePoint
  coordenada?: string; // Campo COORDENADA da planilha SharePoint
  validade?: string; // Data de validade/prazo limite para execução da OS (YYYY-MM-DD)
}

export enum ActivityStatus {
  PANP = 'PANP', // Programada Não Planejada
  CANC = 'CANC', // Cancelada
  EXEC = 'EXEC', // Executada
  PROG = 'PROG', // Programada
  PARP = 'PARP'  // Parcialmente Planejada
}

export interface ImportedNetworkMaintenanceData {
  date: string;
  activities: {
    team: string;
    osNumber: string;
    value: number;
    status: string;
    statusNotes?: string;
    location: string;
    notes?: string;
  }[];
}

export interface CalendarView {
  year: number;
  month: number;
  schedules: NetworkMaintenanceSchedule[];
}