import { supabase } from '@/lib/supabase'

export interface VehicleAllocationLog {
  id: string
  veiculo_id: string
  equipe_id_anterior: string | null
  equipe_id_nova: string | null
  usuario_id: string
  acao: 'alocar' | 'remover' | 'realocar'
  data_alteracao: string
  detalhes: {
    placa_veiculo: string
    equipe_anterior: string | null
    equipe_nova: string | null
    timestamp: string
  }
  ip_address?: string
  user_agent?: string
}

export interface AllocationLogWithDetails extends VehicleAllocationLog {
  veiculo: {
    placa: string
    marca_equipamento: string
    modelo: string
  }
  equipe_anterior: {
    nome: string
    prefixo_fixo?: string
  } | null
  equipe_nova: {
    nome: string
    prefixo_fixo?: string
  } | null
  usuario: {
    nome: string
    email: string
  }
}

export const allocationLogService = {
  /**
   * Busca todos os logs de alocação com detalhes
   */
  getAll: async (): Promise<AllocationLogWithDetails[]> => {
    const { data, error } = await supabase
      .from('veiculo_alocacao_log')
      .select(`
        *,
        veiculo:veiculos(placa, marca_equipamento, modelo),
        equipe_anterior:equipes!veiculo_alocacao_log_equipe_id_anterior_fkey(nome, prefixo_fixo),
        equipe_nova:equipes!veiculo_alocacao_log_equipe_id_nova_fkey(nome, prefixo_fixo),
        usuario:usuarios!veiculo_alocacao_log_usuario_id_fkey(nome, email)
      `)
      .order('data_alteracao', { ascending: false })

    if (error) throw error
    return data || []
  },

  /**
   * Busca logs de um veículo específico
   */
  getByVehicle: async (vehicleId: string): Promise<AllocationLogWithDetails[]> => {
    const { data, error } = await supabase
      .from('veiculo_alocacao_log')
      .select(`
        *,
        veiculo:veiculos(placa, marca_equipamento, modelo),
        equipe_anterior:equipes!veiculo_alocacao_log_equipe_id_anterior_fkey(nome, prefixo_fixo),
        equipe_nova:equipes!veiculo_alocacao_log_equipe_id_nova_fkey(nome, prefixo_fixo),
        usuario:usuarios!veiculo_alocacao_log_usuario_id_fkey(nome, email)
      `)
      .eq('veiculo_id', vehicleId)
      .order('data_alteracao', { ascending: false })

    if (error) throw error
    return data || []
  },

  /**
   * Busca logs de uma equipe específica
   */
  getByTeam: async (teamId: string): Promise<AllocationLogWithDetails[]> => {
    const { data, error } = await supabase
      .from('veiculo_alocacao_log')
      .select(`
        *,
        veiculo:veiculos(placa, marca_equipamento, modelo),
        equipe_anterior:equipes!veiculo_alocacao_log_equipe_id_anterior_fkey(nome, prefixo_fixo),
        equipe_nova:equipes!veiculo_alocacao_log_equipe_id_nova_fkey(nome, prefixo_fixo),
        usuario:usuarios!veiculo_alocacao_log_usuario_id_fkey(nome, email)
      `)
      .or(`equipe_id_anterior.eq.${teamId},equipe_id_nova.eq.${teamId}`)
      .order('data_alteracao', { ascending: false })

    if (error) throw error
    return data || []
  },

  /**
   * Busca logs por período
   */
  getByDateRange: async (startDate: string, endDate: string): Promise<AllocationLogWithDetails[]> => {
    const { data, error } = await supabase
      .from('veiculo_alocacao_log')
      .select(`
        *,
        veiculo:veiculos(placa, marca_equipamento, modelo),
        equipe_anterior:equipes!veiculo_alocacao_log_equipe_id_anterior_fkey(nome, prefixo_fixo),
        equipe_nova:equipes!veiculo_alocacao_log_equipe_id_nova_fkey(nome, prefixo_fixo),
        usuario:usuarios!veiculo_alocacao_log_usuario_id_fkey(nome, email)
      `)
      .gte('data_alteracao', startDate)
      .lte('data_alteracao', endDate)
      .order('data_alteracao', { ascending: false })

    if (error) throw error
    return data || []
  },

  /**
   * Busca logs por tipo de ação
   */
  getByAction: async (action: 'alocar' | 'remover' | 'realocar'): Promise<AllocationLogWithDetails[]> => {
    const { data, error } = await supabase
      .from('veiculo_alocacao_log')
      .select(`
        *,
        veiculo:veiculos(placa, marca_equipamento, modelo),
        equipe_anterior:equipes!veiculo_alocacao_log_equipe_id_anterior_fkey(nome, prefixo_fixo),
        equipe_nova:equipes!veiculo_alocacao_log_equipe_id_nova_fkey(nome, prefixo_fixo),
        usuario:usuarios!veiculo_alocacao_log_usuario_id_fkey(nome, email)
      `)
      .eq('acao', action)
      .order('data_alteracao', { ascending: false })

    if (error) throw error
    return data || []
  },

  /**
   * Busca logs de um usuário específico
   */
  getByUser: async (userId: string): Promise<AllocationLogWithDetails[]> => {
    const { data, error } = await supabase
      .from('veiculo_alocacao_log')
      .select(`
        *,
        veiculo:veiculos(placa, marca_equipamento, modelo),
        equipe_anterior:equipes!veiculo_alocacao_log_equipe_id_anterior_fkey(nome, prefixo_fixo),
        equipe_nova:equipes!veiculo_alocacao_log_equipe_id_nova_fkey(nome, prefixo_fixo),
        usuario:usuarios!veiculo_alocacao_log_usuario_id_fkey(nome, email)
      `)
      .eq('usuario_id', userId)
      .order('data_alteracao', { ascending: false })

    if (error) throw error
    return data || []
  }
}
