/**
 * Constantes padronizadas para status de veículos
 * Usar SEMPRE estes valores para garantir consistência entre web e mobile
 * 
 * IMPORTANTE: Valores SEM acentos para compatibilidade com constraint do banco
 */

/**
 * VALORES EXATOS DO BANCO DE DADOS - NÃO ALTERAR
 * Constraint: CHECK (status IN ('disponivel', 'operacao', 'manutenção', 'bloqueado', 'devolvido', 'desmobilizado'))
 */
export const VEHICLE_STATUS = {
  DISPONIVEL: 'disponivel',      // SEM acento
  OPERACAO: 'operacao',          // SEM acento
  MANUTENCAO: 'manutenção',      // COM acento (único que tem)
  BLOQUEADO: 'bloqueado',
  DEVOLVIDO: 'devolvido',
  DESMOBILIZADO: 'desmobilizado',
} as const;

export type VehicleStatus = typeof VEHICLE_STATUS[keyof typeof VEHICLE_STATUS];

/**
 * Labels para exibição na UI
 */
export const VEHICLE_STATUS_LABELS: Record<VehicleStatus, string> = {
  [VEHICLE_STATUS.DISPONIVEL]: 'Disponível',
  [VEHICLE_STATUS.OPERACAO]: 'Em Operação',
  [VEHICLE_STATUS.MANUTENCAO]: 'Em Manutenção',
  [VEHICLE_STATUS.BLOQUEADO]: 'Bloqueado',
  [VEHICLE_STATUS.DEVOLVIDO]: 'Devolvido',
  [VEHICLE_STATUS.DESMOBILIZADO]: 'Desmobilizado',
};

/**
 * Cores para badges de status
 */
export const VEHICLE_STATUS_COLORS: Record<VehicleStatus, string> = {
  [VEHICLE_STATUS.DISPONIVEL]: 'bg-blue-50 text-blue-700',
  [VEHICLE_STATUS.OPERACAO]: 'bg-green-50 text-green-700',
  [VEHICLE_STATUS.MANUTENCAO]: 'bg-yellow-50 text-yellow-700',
  [VEHICLE_STATUS.BLOQUEADO]: 'bg-red-50 text-red-700',
  [VEHICLE_STATUS.DEVOLVIDO]: 'bg-orange-50 text-orange-700',
  [VEHICLE_STATUS.DESMOBILIZADO]: 'bg-gray-50 text-gray-700',
};

/**
 * Status que impedem alocação de veículo
 */
export const UNAVAILABLE_STATUSES: VehicleStatus[] = [
  VEHICLE_STATUS.MANUTENCAO,
  VEHICLE_STATUS.BLOQUEADO,
  VEHICLE_STATUS.DEVOLVIDO,
  VEHICLE_STATUS.DESMOBILIZADO,
];

/**
 * Normaliza status do banco para o padrão (case-insensitive)
 * Útil para lidar com variações que podem existir no banco
 */
export function normalizeVehicleStatus(status: string | null | undefined): VehicleStatus | null {
  if (!status) return null;
  
  const normalized = status.toLowerCase().trim();
  
  // Mapear variações comuns
  if (['disponivel', 'disponível'].includes(normalized)) return VEHICLE_STATUS.DISPONIVEL;
  if (['operacao', 'operação', 'em operacao', 'em operação'].includes(normalized)) return VEHICLE_STATUS.OPERACAO;
  if (['manutenção', 'manutencao', 'em manutenção', 'em manutencao'].includes(normalized)) return VEHICLE_STATUS.MANUTENCAO;
  if (normalized === 'bloqueado') return VEHICLE_STATUS.BLOQUEADO;
  if (normalized === 'devolvido') return VEHICLE_STATUS.DEVOLVIDO;
  if (normalized === 'desmobilizado') return VEHICLE_STATUS.DESMOBILIZADO;
  
  return null;
}

/**
 * Verifica se um veículo está disponível para alocação
 */
export function isVehicleAvailable(status: string | null | undefined): boolean {
  const normalized = normalizeVehicleStatus(status);
  if (!normalized) return false;
  
  return !UNAVAILABLE_STATUSES.includes(normalized);
}

/**
 * Obtém label de exibição para um status
 */
export function getVehicleStatusLabel(status: string | null | undefined): string {
  const normalized = normalizeVehicleStatus(status);
  return normalized ? VEHICLE_STATUS_LABELS[normalized] : status || 'Desconhecido';
}

/**
 * Obtém cor do badge para um status
 */
export function getVehicleStatusColor(status: string | null | undefined): string {
  const normalized = normalizeVehicleStatus(status);
  return normalized ? VEHICLE_STATUS_COLORS[normalized] : 'bg-gray-100 text-gray-500';
}
