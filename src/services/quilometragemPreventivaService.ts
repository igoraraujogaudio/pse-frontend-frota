import { apiClient } from '@/lib/apiClient'

export interface QuilometragemAlert {
  id: string; placa: string; modelo: string; quilometragem_atual: number; proxima_preventiva_km: number
  km_restantes: number; status_alerta: 'PREVENTIVA_VENCIDA' | 'PREVENTIVA_PROXIMA' | null
  contrato_nome?: string; base_nome?: string; percentual_uso?: number
}

export interface QuilometragemStats {
  total_veiculos: number; preventivas_vencidas: number; preventivas_proximas: number; veiculos_ok: number; percentual_cobertura: number
}

class QuilometragemPreventivaService {
  async getAlertasQuilometragem(): Promise<QuilometragemAlert[]> {
    try { return await apiClient.get<QuilometragemAlert[]>('/quilometragem/alertas', { silent: true }) } catch { return [] }
  }

  async getEstatisticasQuilometragem(): Promise<QuilometragemStats> {
    try { return await apiClient.get<QuilometragemStats>('/quilometragem/estatisticas', { silent: true }) }
    catch { return { total_veiculos: 0, preventivas_vencidas: 0, preventivas_proximas: 0, veiculos_ok: 0, percentual_cobertura: 0 } }
  }

  async atualizarQuilometragem(veiculoId: string, novaQuilometragem: number): Promise<boolean> {
    try {
      await apiClient.post('/quilometragem/atualizar', { body: { veiculo_id: veiculoId, quilometragem: novaQuilometragem, origem: 'upload_manual', detalhes: { metodo: 'gestor_frota', interface: 'quilometragem_preventiva' } } })
      return true
    } catch { return false }
  }

  async marcarPreventivaRealizada(veiculoId: string, quilometragemAtual: number, novaPreventivaKm?: number): Promise<boolean> {
    try {
      await apiClient.post('/quilometragem/preventiva-realizada', { body: { veiculo_id: veiculoId, quilometragem_atual: quilometragemAtual, proxima_preventiva_km: novaPreventivaKm } })
      return true
    } catch { return false }
  }

  async configurarIntervaloPreventiva(veiculoId: string, intervaloKm: number, alertaKm: number = 1000): Promise<boolean> {
    try {
      await apiClient.post('/quilometragem/configurar-intervalo', { body: { veiculo_id: veiculoId, intervalo_preventiva: intervaloKm, alerta_preventiva_km: alertaKm } })
      return true
    } catch { return false }
  }

  async getVeiculosProximosPreventiva(limite: number = 10): Promise<QuilometragemAlert[]> {
    try { return await apiClient.get<QuilometragemAlert[]>('/quilometragem/alertas', { params: { limit: limite }, silent: true }) } catch { return [] }
  }

  calcularProximaPreventiva(ultimaPreventiva: number | null, quilometragemAtual: number, intervaloPreventiva: number = 10000): number {
    if (ultimaPreventiva !== null && ultimaPreventiva !== undefined) return ultimaPreventiva + intervaloPreventiva
    return Math.ceil(quilometragemAtual / intervaloPreventiva) * intervaloPreventiva
  }

  verificarStatusPreventiva(quilometragemAtual: number, proximaPreventivaKm: number, alertaKm: number): 'OK' | 'PROXIMA' | 'VENCIDA' {
    if (quilometragemAtual >= proximaPreventivaKm) return 'VENCIDA'
    if (quilometragemAtual >= (proximaPreventivaKm - alertaKm)) return 'PROXIMA'
    return 'OK'
  }
}

export const quilometragemPreventivaService = new QuilometragemPreventivaService()
