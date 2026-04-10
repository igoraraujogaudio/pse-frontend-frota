/**
 * Utilitários para cálculo de manutenção preventiva de veículos
 */

export interface VehicleMaintenanceData {
  quilometragem_atual: number;
  quilometragem_preventiva?: number | null;
  intervalo_preventiva?: number;
  proxima_preventiva_km?: number | null;
}

export interface CalculatedMaintenance {
  proxima_preventiva_km: number;
  alerta_preventiva_km: number;
  dias_para_alerta?: number;
  status_preventiva: 'em_dia' | 'proximo_vencimento' | 'vencida';
}

/**
 * Calcula a próxima manutenção preventiva baseada na ÚLTIMA PREVENTIVA REALIZADA
 * (usando a nova lógica: próxima = última preventiva + intervalo)
 */
export function calculateNextPreventiveMaintenance(
  data: VehicleMaintenanceData,
  alertPercentage: number = 0.1 // 10% antes do vencimento
): CalculatedMaintenance {
  const {
    quilometragem_atual,
    quilometragem_preventiva,
    intervalo_preventiva = 10000, // Padrão: 10.000 km
  } = data;

  // NOVA LÓGICA: Calcular próxima preventiva baseada na ÚLTIMA PREVENTIVA REALIZADA
  // Se tem última preventiva definida, usar ela como base
  // Exemplo: última preventiva aos 97 km → próxima em 10.097 km (97 + 10.000)
  let proximaPreventivaKm: number;
  
  if (quilometragem_preventiva !== null && quilometragem_preventiva !== undefined) {
    proximaPreventivaKm = quilometragem_preventiva + intervalo_preventiva;
  } else {
    // Fallback: se não tem última preventiva, usar km atual como base (lógica antiga)
    proximaPreventivaKm = Math.ceil(quilometragem_atual / intervalo_preventiva) * intervalo_preventiva;
  }

  // Calcular quilometragem de alerta (antes do vencimento)
  const alertaKm = proximaPreventivaKm - (intervalo_preventiva * alertPercentage);

  // Determinar status da manutenção preventiva
  let status: 'em_dia' | 'proximo_vencimento' | 'vencida';
  
  if (quilometragem_atual >= proximaPreventivaKm) {
    status = 'vencida';
  } else if (quilometragem_atual >= alertaKm) {
    status = 'proximo_vencimento';
  } else {
    status = 'em_dia';
  }

  return {
    proxima_preventiva_km: proximaPreventivaKm,
    alerta_preventiva_km: Math.round(alertaKm),
    status_preventiva: status
  };
}

/**
 * Verifica se a manutenção preventiva está vencida ou próxima do vencimento
 */
export function checkMaintenanceStatus(
  quilometragem_atual: number,
  proxima_preventiva_km: number,
  alerta_preventiva_km: number
): {
  status: 'em_dia' | 'proximo_vencimento' | 'vencida';
  km_restantes: number;
  percentual_usado: number;
} {
  const kmRestantes = proxima_preventiva_km - quilometragem_atual;
  const intervaloPrevisto = proxima_preventiva_km - alerta_preventiva_km;
  const percentualUsado = intervaloPrevisto > 0 
    ? Math.min(100, Math.max(0, ((intervaloPrevisto - kmRestantes) / intervaloPrevisto) * 100))
    : 0;

  let status: 'em_dia' | 'proximo_vencimento' | 'vencida';
  
  if (kmRestantes <= 0) {
    status = 'vencida';
  } else if (quilometragem_atual >= alerta_preventiva_km) {
    status = 'proximo_vencimento';
  } else {
    status = 'em_dia';
  }

  return {
    status,
    km_restantes: Math.max(0, kmRestantes),
    percentual_usado: Math.round(percentualUsado)
  };
}

/**
 * Formata informações de manutenção para exibição
 */
export function formatMaintenanceInfo(
  quilometragem_atual: number,
  proxima_preventiva_km: number,
  alerta_preventiva_km: number
): {
  status_texto: string;
  cor_status: 'green' | 'yellow' | 'red';
  km_restantes_texto: string;
  percentual_texto: string;
} {
  const { status, km_restantes, percentual_usado } = checkMaintenanceStatus(
    quilometragem_atual,
    proxima_preventiva_km,
    alerta_preventiva_km
  );

  let statusTexto: string;
  let corStatus: 'green' | 'yellow' | 'red';

  switch (status) {
    case 'vencida':
      statusTexto = 'Manutenção Vencida';
      corStatus = 'red';
      break;
    case 'proximo_vencimento':
      statusTexto = 'Próximo do Vencimento';
      corStatus = 'yellow';
      break;
    default:
      statusTexto = 'Em Dia';
      corStatus = 'green';
  }

  const kmRestantesTexto = km_restantes > 0 
    ? `${km_restantes.toLocaleString()} km restantes`
    : `${Math.abs(km_restantes).toLocaleString()} km em atraso`;

  const percentualTexto = `${percentual_usado}% do intervalo utilizado`;

  return {
    status_texto: statusTexto,
    cor_status: corStatus,
    km_restantes_texto: kmRestantesTexto,
    percentual_texto: percentualTexto
  };
}

/**
 * Calcula quando um veículo deve fazer a próxima manutenção preventiva
 * baseado na quilometragem atual e histórico de manutenções
 * NOVA LÓGICA: próxima = última preventiva + intervalo
 */
export function calculateMaintenanceSchedule(
  quilometragem_atual: number,
  ultima_manutencao_km?: number | null,
  intervalo_preventiva: number = 10000
): {
  proxima_preventiva_km: number;
  km_desde_ultima: number;
  km_para_proxima: number;
  manutencoes_em_atraso: number;
} {
  // Se não há registro da última manutenção, assumir que foi feita no km 0
  const ultimaManutencaoKm = ultima_manutencao_km ?? 0;
  
  // NOVA LÓGICA: Próxima preventiva = última preventiva + intervalo
  // Exemplo: última aos 97 km → próxima em 10.097 km
  const proximaManutencaoKm = ultimaManutencaoKm + intervalo_preventiva;
  
  // Calcular quantos km desde a última manutenção
  const kmDesdeUltima = quilometragem_atual - ultimaManutencaoKm;
  
  // Km para a próxima manutenção
  const kmParaProxima = Math.max(0, proximaManutencaoKm - quilometragem_atual);
  
  // Calcular manutenções em atraso
  const manutencoesPrevistas = Math.floor(kmDesdeUltima / intervalo_preventiva);
  const manutencoes_em_atraso = Math.max(0, manutencoesPrevistas);

  return {
    proxima_preventiva_km: proximaManutencaoKm,
    km_desde_ultima: kmDesdeUltima,
    km_para_proxima: kmParaProxima,
    manutencoes_em_atraso
  };
}
