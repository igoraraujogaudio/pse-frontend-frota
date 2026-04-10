import { supabase } from '@/lib/supabase';

export interface QuilometragemAlert {
  id: string;
  placa: string;
  modelo: string;
  quilometragem_atual: number;
  proxima_preventiva_km: number;
  km_restantes: number;
  status_alerta: 'PREVENTIVA_VENCIDA' | 'PREVENTIVA_PROXIMA' | null;
  contrato_nome?: string;
  base_nome?: string;
  percentual_uso?: number;
}

export interface QuilometragemStats {
  total_veiculos: number;
  preventivas_vencidas: number;
  preventivas_proximas: number;
  veiculos_ok: number;
  percentual_cobertura: number;
}

class QuilometragemPreventivaService {
  /**
   * Busca alertas de quilometragem preventiva usando a view do banco
   */
  async getAlertasQuilometragem(): Promise<QuilometragemAlert[]> {
    try {
      const { data, error } = await supabase
        .from('vw_alertas_quilometragem')
        .select('*')
        .not('status_alerta', 'is', null)
        .order('km_restantes', { ascending: true });

      if (error) {
        console.error('Erro ao buscar alertas de quilometragem:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Erro ao buscar alertas de quilometragem:', error);
      return [];
    }
  }

  /**
   * Busca estatísticas de quilometragem preventiva
   */
  async getEstatisticasQuilometragem(): Promise<QuilometragemStats> {
    try {
      const { data, error } = await supabase
        .from('vw_alertas_quilometragem')
        .select('status_alerta');

      if (error) {
        console.error('Erro ao buscar estatísticas:', error);
        return {
          total_veiculos: 0,
          preventivas_vencidas: 0,
          preventivas_proximas: 0,
          veiculos_ok: 0,
          percentual_cobertura: 0
        };
      }

      const total = data?.length || 0;
      const vencidas = data?.filter(item => item.status_alerta === 'PREVENTIVA_VENCIDA').length || 0;
      const proximas = data?.filter(item => item.status_alerta === 'PREVENTIVA_PROXIMA').length || 0;
      const ok = total - vencidas - proximas;

      return {
        total_veiculos: total,
        preventivas_vencidas: vencidas,
        preventivas_proximas: proximas,
        veiculos_ok: ok,
        percentual_cobertura: total > 0 ? Math.round(((ok + proximas) / total) * 100) : 0
      };
    } catch (error) {
      console.error('Erro ao buscar estatísticas:', error);
      return {
        total_veiculos: 0,
        preventivas_vencidas: 0,
        preventivas_proximas: 0,
        veiculos_ok: 0,
        percentual_cobertura: 0
      };
    }
  }

  /**
   * Atualiza quilometragem de um veículo e recalcula próxima preventiva
   */
  async atualizarQuilometragem(
    veiculoId: string, 
    novaQuilometragem: number
  ): Promise<boolean> {
    try {
      // Buscar usuário atual
      const { data: usuario } = await supabase.auth.getUser();
      const usuarioId = usuario?.user?.id || null;
      
      // Atualizar usando função RPC para garantir log correto
      const { error } = await supabase
        .rpc('atualizar_quilometragem_veiculo', {
          p_veiculo_id: veiculoId,
          p_quilometragem: novaQuilometragem,
          p_origem: 'upload_manual',
          p_usuario_id: usuarioId,
          p_movimentacao_id: null,
          p_detalhes: {
            metodo: 'gestor_frota',
            interface: 'quilometragem_preventiva'
          }
        });

      if (error) {
        console.error('Erro ao atualizar quilometragem:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Erro ao atualizar quilometragem:', error);
      return false;
    }
  }

  /**
   * Marca preventiva como realizada e atualiza próxima preventiva
   */
  async marcarPreventivaRealizada(
    veiculoId: string,
    quilometragemAtual: number,
    novaPreventivaKm?: number
  ): Promise<boolean> {
    try {
      // Buscar dados do veículo
      const { data: veiculo, error: fetchError } = await supabase
        .from('veiculos')
        .select('intervalo_preventiva')
        .eq('id', veiculoId)
        .single();

      if (fetchError) {
        console.error('Erro ao buscar dados do veículo:', fetchError);
        return false;
      }

      const intervalo = veiculo?.intervalo_preventiva || 10000;
      const proximaPreventiva = novaPreventivaKm || this.calcularProximaPreventiva(quilometragemAtual, intervalo);

      // Atualizar veículo via RPC (bypassa RLS)
      const { error } = await supabase.rpc('atualizar_preventiva_veiculo', {
        p_veiculo_id: veiculoId,
        p_quilometragem_preventiva: quilometragemAtual,
        p_proxima_preventiva_km: proximaPreventiva,
        p_quilometragem_atual: quilometragemAtual,
      });

      if (error) {
        console.error('Erro ao marcar preventiva realizada:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Erro ao marcar preventiva realizada:', error);
      return false;
    }
  }

  /**
   * Configura intervalo de preventiva para um veículo
   */
  async configurarIntervaloPreventiva(
    veiculoId: string,
    intervaloKm: number,
    alertaKm: number = 1000
  ): Promise<boolean> {
    try {
      const { error } = await supabase.rpc('configurar_intervalo_preventiva', {
        p_veiculo_id: veiculoId,
        p_intervalo_preventiva: intervaloKm,
        p_alerta_preventiva_km: alertaKm,
      });

      if (error) {
        console.error('Erro ao configurar intervalo preventiva:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Erro ao configurar intervalo preventiva:', error);
      return false;
    }
  }

  /**
   * Busca veículos próximos da preventiva (para dashboard)
   */
  async getVeiculosProximosPreventiva(limite: number = 10): Promise<QuilometragemAlert[]> {
    try {
      const { data, error } = await supabase
        .from('vw_alertas_quilometragem')
        .select('*')
        .not('status_alerta', 'is', null)
        .order('km_restantes', { ascending: true })
        .limit(limite);

      if (error) {
        console.error('Erro ao buscar veículos próximos:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Erro ao buscar veículos próximos:', error);
      return [];
    }
  }

  /**
   * Calcula próxima preventiva baseada na ÚLTIMA PREVENTIVA REALIZADA
   * Lógica: próxima = última preventiva + intervalo
   * 
   * Exemplos:
   * - Última preventiva aos 97 km → próxima em 10.097 km (97 + 10.000)
   * - Última preventiva aos 5.000 km → próxima em 15.000 km (5.000 + 10.000)
   * - Sem última preventiva → usa km atual como fallback
   */
  calcularProximaPreventiva(
    ultimaPreventiva: number | null,
    quilometragemAtual: number,
    intervaloPreventiva: number = 10000
  ): number {
    // Se tem última preventiva definida, usar ela como base
    if (ultimaPreventiva !== null && ultimaPreventiva !== undefined) {
      return ultimaPreventiva + intervaloPreventiva;
    }
    
    // Fallback: se não tem última preventiva, usar km atual como base
    return Math.ceil(quilometragemAtual / intervaloPreventiva) * intervaloPreventiva;
  }

  /**
   * Verifica status da preventiva
   */
  verificarStatusPreventiva(
    quilometragemAtual: number,
    proximaPreventivaKm: number,
    alertaKm: number
  ): 'OK' | 'PROXIMA' | 'VENCIDA' {
    if (quilometragemAtual >= proximaPreventivaKm) {
      return 'VENCIDA';
    } else if (quilometragemAtual >= (proximaPreventivaKm - alertaKm)) {
      return 'PROXIMA';
    }
    return 'OK';
  }
}

export const quilometragemPreventivaService = new QuilometragemPreventivaService();


