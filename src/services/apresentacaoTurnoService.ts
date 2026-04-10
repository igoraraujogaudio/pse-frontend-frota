import { supabase } from '@/lib/supabase'
import { 
  ApresentacaoTurno, 
  // ApresentacaoTurnoCreate, // TODO: Implement create functionality
  // ApresentacaoTurnoUpdate, // TODO: Implement update functionality
  // ApresentacaoTurnoFilters, // TODO: Implement filtering
  DashboardApresentacaoTurno,
  FuncionariosPorEquipe
} from '@/types'

export const apresentacaoTurnoService = {
  /**
   * Fazer apresentação de turno (chama função do banco)
   */
  fazerApresentacao: async (
    turno: string, 
    prefixoVeiculo: string, 
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _observacoes?: string // TODO: Implement observations handling
  ): Promise<{ sucesso: boolean; mensagem: string; equipe_id?: string; equipe_nome?: string }> => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Usuário não autenticado')

      // Obter ID do usuário da tabela usuarios
      const { data: usuarioData, error: usuarioError } = await supabase
        .from('usuarios')
        .select('id')
        .eq('auth_usuario_id', user.id)
        .single()

      if (usuarioError || !usuarioData) {
        throw new Error('Usuário não encontrado')
      }

      // Chamar função do banco para fazer apresentação
      const { data, error } = await supabase
        .rpc('fazer_apresentacao_turno', {
          usuario_id_param: usuarioData.id,
          turno_param: turno,
          prefixo_veiculo_param: prefixoVeiculo
        })

      if (error) throw error

      return {
        sucesso: data[0]?.sucesso || false,
        mensagem: data[0]?.mensagem || 'Erro ao fazer apresentação',
        equipe_id: data[0]?.equipe_id,
        equipe_nome: data[0]?.equipe_nome
      }
    } catch (error) {
      console.error('Erro ao fazer apresentação:', error)
      throw error
    }
  },

  /**
   * Obter apresentações do usuário
   */
  getMinhasApresentacoes: async (): Promise<ApresentacaoTurno[]> => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Usuário não autenticado')

      const { data: usuarioData, error: usuarioError } = await supabase
        .from('usuarios')
        .select('id')
        .eq('auth_usuario_id', user.id)
        .single()

      if (usuarioError || !usuarioData) {
        throw new Error('Usuário não encontrado')
      }

      const { data, error } = await supabase
        .from('apresentacao_turno')
        .select(`
          *,
          usuario:usuarios!apresentacoes_turno_usuario_id_fkey(id, nome, matricula, cargo),
          equipe:equipes(id, nome, operacao)
        `)
        .eq('usuario_id', usuarioData.id)
        .order('data_apresentacao', { ascending: false })

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('Erro ao obter apresentações:', error)
      throw error
    }
  },

  /**
   * Obter apresentação ativa do usuário hoje
   */
  getApresentacaoAtiva: async (): Promise<ApresentacaoTurno | null> => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Usuário não autenticado')

      const { data: usuarioData, error: usuarioError } = await supabase
        .from('usuarios')
        .select('id')
        .eq('auth_usuario_id', user.id)
        .single()

      if (usuarioError || !usuarioData) {
        throw new Error('Usuário não encontrado')
      }

      const { data, error } = await supabase
        .from('apresentacao_turno')
        .select(`
          *,
          usuario:usuarios!apresentacoes_turno_usuario_id_fkey(id, nome, matricula, cargo),
          equipe:equipes(id, nome, operacao)
        `)
        .eq('usuario_id', usuarioData.id)
        .eq('data_apresentacao', new Date().toISOString().split('T')[0])
        .eq('status', 'ativo')
        .single()

      if (error && error.code !== 'PGRST116') throw error // PGRST116 = no rows returned
      return data || null
    } catch (error) {
      console.error('Erro ao obter apresentação ativa:', error)
      throw error
    }
  },

  /**
   * Finalizar apresentação de turno
   */
  finalizarApresentacao: async (apresentacaoId: string): Promise<void> => {
    try {
      const { error } = await supabase
        .from('apresentacao_turno')
        .update({ 
          status: 'finalizado',
          atualizado_em: new Date().toISOString()
        })
        .eq('id', apresentacaoId)

      if (error) throw error
    } catch (error) {
      console.error('Erro ao finalizar apresentação:', error)
      throw error
    }
  },

  /**
   * Obter dashboard de apresentações por turno (para gestores)
   */
  getDashboardApresentacoes: async (): Promise<DashboardApresentacaoTurno[]> => {
    try {
      const { data, error } = await supabase
        .from('vw_apresentacoes_turno_dashboard')
        .select('*')
        .order('turno')
        .order('operacao')

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('Erro ao obter dashboard:', error)
      throw error
    }
  },

  /**
   * Obter funcionários por equipe (para gestores da frota)
   */
  getFuncionariosPorEquipe: async (): Promise<FuncionariosPorEquipe[]> => {
    try {
      const { data, error } = await supabase
        .from('vw_funcionarios_por_equipe')
        .select('*')
        .order('equipe_nome')
        .order('turno')

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('Erro ao obter funcionários por equipe:', error)
      throw error
    }
  },

  /**
   * Obter veículos disponíveis por turno
   */
  getVeiculosPorTurno: async (turno: string): Promise<Array<{ prefixo_fixo: string; placa: string; modelo: string }>> => {
    try {
      const { data, error } = await supabase
        .from('prefixo_equipe_mapping')
        .select(`
          prefixo_fixo,
          veiculos!inner(placa, modelo)
        `)
        .eq('turno', turno)
        .eq('ativo', true)

      if (error) throw error
      
      return data?.map(item => ({
        prefixo_fixo: item.prefixo_fixo || '',
        placa: (item.veiculos as { placa?: string })?.placa || '',
        modelo: (item.veiculos as { modelo?: string })?.modelo || ''
      })) || []
    } catch (error) {
      console.error('Erro ao obter veículos por turno:', error)
      throw error
    }
  },

  /**
   * Obter mapeamentos de prefixo para equipe (para gestores da frota)
   */
  getPrefixosEquipe: async (): Promise<Array<{
    id: string;
    prefixo_fixo: string;
    equipe_nome: string;
    operacao: string;
    turno: string;
    ativo: boolean;
  }>> => {
    try {
      const { data, error } = await supabase
        .from('prefixo_equipe_mapping')
        .select(`
          id,
          prefixo_fixo,
          equipe:equipes(nome, operacao),
          turno,
          ativo
        `)
        .order('prefixo_fixo')

      if (error) throw error
      
      return data?.map(item => ({
        id: item.id,
        prefixo_fixo: item.prefixo_fixo,
        equipe_nome: (item.equipe as { nome?: string })?.nome || '',
        operacao: (item.equipe as { operacao?: string })?.operacao || '',
        turno: item.turno,
        ativo: item.ativo
      })) || []
    } catch (error) {
      console.error('Erro ao obter prefixos de equipe:', error)
      throw error
    }
  },

  /**
   * Atualizar mapeamento de prefixo para equipe (para gestores da frota)
   */
  atualizarMapeamentoPrefixos: async (
    prefixoId: string, 
    equipeId: string, 
    turno: string
  ): Promise<void> => {
    try {
      const { error } = await supabase
        .from('prefixo_equipe_mapping')
        .update({ 
          equipe_id: equipeId,
          turno,
          atualizado_em: new Date().toISOString()
        })
        .eq('id', prefixoId)

      if (error) throw error
    } catch (error) {
      console.error('Erro ao atualizar mapeamento:', error)
      throw error
    }
  }
}
