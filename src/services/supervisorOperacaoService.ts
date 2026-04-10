import { supabase } from '@/lib/supabase';

export interface SupervisorOperacao {
  id: string;
  supervisor_id: string;
  operacao_id: string;
  contrato_id: string;
  ativo: boolean;
  criado_em: string;
  atualizado_em: string;
  
  // Relacionamentos
  supervisor?: {
    id: string;
    nome: string;
    email: string;
    matricula: string;
  };
  operacao?: {
    id: string;
    codigo: string;
    nome: string;
  };
  contrato?: {
    id: string;
    nome: string;
    codigo: string;
  };
}

export interface SupervisorOperacaoInput {
  supervisor_id: string;
  operacao_id: string;
  contrato_id: string;
  ativo?: boolean;
}

export const supervisorOperacaoService = {
  /**
   * Buscar todas as atribuições de operações por supervisor
   */
  async getAll(): Promise<SupervisorOperacao[]> {
    const { data, error } = await supabase
      .from('supervisor_operacoes')
      .select(`
        *,
        supervisor:usuarios(id, nome, email, matricula),
        operacao:operacoes_padrao(id, codigo, nome),
        contrato:contratos(id, nome, codigo)
      `)
      .order('criado_em', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  /**
   * Buscar operações de um supervisor específico
   */
  async getBySupervisor(supervisorId: string): Promise<SupervisorOperacao[]> {
    const { data, error } = await supabase
      .from('supervisor_operacoes')
      .select(`
        *,
        operacao:operacoes_padrao(id, codigo, nome),
        contrato:contratos(id, nome, codigo)
      `)
      .eq('supervisor_id', supervisorId)
      .eq('ativo', true)
      .order('criado_em', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  /**
   * Buscar supervisores de uma operação específica
   */
  async getByOperacao(operacaoId: string, contratoId?: string): Promise<SupervisorOperacao[]> {
    let query = supabase
      .from('supervisor_operacoes')
      .select(`
        *,
        supervisor:usuarios(id, nome, email, matricula),
        contrato:contratos(id, nome, codigo)
      `)
      .eq('operacao_id', operacaoId)
      .eq('ativo', true);

    if (contratoId) {
      query = query.eq('contrato_id', contratoId);
    }

    const { data, error } = await query.order('criado_em', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  /**
   * Buscar por contrato
   */
  async getByContrato(contratoId: string): Promise<SupervisorOperacao[]> {
    const { data, error } = await supabase
      .from('supervisor_operacoes')
      .select(`
        *,
        supervisor:usuarios(id, nome, email, matricula),
        operacao:operacoes_padrao(id, codigo, nome)
      `)
      .eq('contrato_id', contratoId)
      .eq('ativo', true)
      .order('criado_em', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  /**
   * Criar nova atribuição de operação para supervisor
   */
  async create(input: SupervisorOperacaoInput): Promise<SupervisorOperacao> {
    const { data, error } = await supabase
      .from('supervisor_operacoes')
      .insert([{
        supervisor_id: input.supervisor_id,
        operacao_id: input.operacao_id,
        contrato_id: input.contrato_id,
        ativo: input.ativo ?? true
      }])
      .select(`
        *,
        supervisor:usuarios(id, nome, email, matricula),
        operacao:operacoes_padrao(id, codigo, nome),
        contrato:contratos(id, nome, codigo)
      `)
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Atualizar atribuição existente
   */
  async update(id: string, input: Partial<SupervisorOperacaoInput>): Promise<SupervisorOperacao> {
    const { data, error } = await supabase
      .from('supervisor_operacoes')
      .update({
        ...input,
        atualizado_em: new Date().toISOString()
      })
      .eq('id', id)
      .select(`
        *,
        supervisor:usuarios(id, nome, email, matricula),
        operacao:operacoes_padrao(id, codigo, nome),
        contrato:contratos(id, nome, codigo)
      `)
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Desativar/Ativar atribuição
   */
  async toggleActive(id: string, ativo: boolean): Promise<SupervisorOperacao> {
    const { data, error } = await supabase
      .from('supervisor_operacoes')
      .update({
        ativo,
        atualizado_em: new Date().toISOString()
      })
      .eq('id', id)
      .select(`
        *,
        supervisor:usuarios(id, nome, email, matricula),
        operacao:operacoes_padrao(id, codigo, nome),
        contrato:contratos(id, nome, codigo)
      `)
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Deletar atribuição
   */
  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('supervisor_operacoes')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  /**
   * Criar múltiplas atribuições de uma vez
   */
  async createBulk(inputs: SupervisorOperacaoInput[]): Promise<SupervisorOperacao[]> {
    const { data, error } = await supabase
      .from('supervisor_operacoes')
      .insert(inputs.map(input => ({
        supervisor_id: input.supervisor_id,
        operacao_id: input.operacao_id,
        contrato_id: input.contrato_id,
        ativo: input.ativo ?? true
      })))
      .select(`
        *,
        supervisor:usuarios(id, nome, email, matricula),
        operacao:operacoes_padrao(id, codigo, nome),
        contrato:contratos(id, nome, codigo)
      `);

    if (error) throw error;
    return data || [];
  },

  /**
   * Verificar se supervisor já tem operação atribuída
   */
  async exists(supervisorId: string, operacaoId: string, contratoId: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('supervisor_operacoes')
      .select('id')
      .eq('supervisor_id', supervisorId)
      .eq('operacao_id', operacaoId)
      .eq('contrato_id', contratoId)
      .single();

    if (error && error.code !== 'PGRST116') throw error; // PGRST116 = não encontrado
    return !!data;
  }
};


