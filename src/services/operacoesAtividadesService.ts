import { supabase } from '@/lib/supabase';
import { 
  OperacaoPadrao, 
  AtividadePadrao, 
  AtividadeComOperacao,
  OperacaoFormData,
  AtividadeFormData,
  OperacaoFilter,
  AtividadeFilter
} from '@/types/operacoes-atividades';

export class OperacoesAtividadesService {
  // ============================================================================
  // OPERAÇÕES
  // ============================================================================

  // Buscar todas as operações
  static async getOperacoes(filter?: OperacaoFilter): Promise<OperacaoPadrao[]> {
    let query = supabase
      .from('operacoes_padrao')
      .select('*')
      .order('ordem', { ascending: true });

    if (filter?.ativo !== undefined) {
      query = query.eq('ativo', filter.ativo);
    }

    if (filter?.contratoId) {
      query = query.eq('contrato_id', filter.contratoId);
    }

    if (filter?.search) {
      query = query.or(`nome.ilike.%${filter.search}%,codigo.ilike.%${filter.search}%`);
    }

    const { data, error } = await query;

    if (error) throw error;
    
    // Mapear snake_case para camelCase
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data || []).map((op: any) => ({
      ...op,
      contratoId: op.contrato_id,
      requerEncarregado: op.requer_encarregado,
      createdAt: op.created_at,
      updatedAt: op.updated_at
    }));
  }

  // Buscar operação por ID
  static async getOperacaoById(id: string): Promise<OperacaoPadrao | null> {
    const { data, error } = await supabase
      .from('operacoes_padrao')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }
    
    if (!data) return null;
    
    // Mapear snake_case para camelCase
    return {
      ...data,
      contratoId: data.contrato_id,
      requerEncarregado: data.requer_encarregado,
      createdAt: data.created_at,
      updatedAt: data.updated_at
    };
  }

  // Buscar operação por código
  static async getOperacaoByCodigo(codigo: string): Promise<OperacaoPadrao | null> {
    const { data, error } = await supabase
      .from('operacoes_padrao')
      .select('*')
      .eq('codigo', codigo)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }
    return data;
  }

  // Criar operação
  static async createOperacao(operacao: OperacaoFormData & { requerEncarregado?: boolean }): Promise<OperacaoPadrao> {
    const { data, error } = await supabase
      .from('operacoes_padrao')
      .insert({
        codigo: operacao.codigo,
        nome: operacao.nome,
        descricao: operacao.descricao,
        contrato_id: operacao.contratoId,
        requer_encarregado: operacao.requerEncarregado || false,
        ativo: operacao.ativo,
        ordem: operacao.ordem,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // Atualizar operação
  static async updateOperacao(id: string, operacao: Partial<OperacaoFormData & { requerEncarregado?: boolean }>): Promise<OperacaoPadrao> {
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString()
    };

    if (operacao.codigo !== undefined) updateData.codigo = operacao.codigo;
    if (operacao.nome !== undefined) updateData.nome = operacao.nome;
    if (operacao.descricao !== undefined) updateData.descricao = operacao.descricao;
    if (operacao.contratoId !== undefined) updateData.contrato_id = operacao.contratoId;
    if (operacao.requerEncarregado !== undefined) updateData.requer_encarregado = operacao.requerEncarregado;
    if (operacao.ativo !== undefined) updateData.ativo = operacao.ativo;
    if (operacao.ordem !== undefined) updateData.ordem = operacao.ordem;

    const { data, error } = await supabase
      .from('operacoes_padrao')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // Deletar operação
  static async deleteOperacao(id: string): Promise<void> {
    const { error } = await supabase
      .from('operacoes_padrao')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  // ============================================================================
  // ATIVIDADES
  // ============================================================================

  // Buscar todas as atividades
  static async getAtividades(filter?: AtividadeFilter): Promise<AtividadeComOperacao[]> {
    let query = supabase
      .from('atividades_padrao')
      .select(`
        *,
        operacao:operacoes_padrao(*)
      `)
      .order('ordem', { ascending: true });

    if (filter?.ativo !== undefined) {
      query = query.eq('ativo', filter.ativo);
    }

    if (filter?.operacaoId) {
      query = query.eq('operacao_id', filter.operacaoId);
    }

    if (filter?.contratoId) {
      query = query.eq('contrato_id', filter.contratoId);
    }

    if (filter?.search) {
      query = query.or(`nome.ilike.%${filter.search}%,codigo.ilike.%${filter.search}%`);
    }

    const { data, error } = await query;

    if (error) throw error;
    
    return (data || []).map((atividade: Record<string, unknown>) => ({
      ...atividade,
      operacaoNome: (atividade.operacao as Record<string, unknown>)?.nome || ''
    })) as AtividadeComOperacao[];
  }

  // Buscar atividades por operação
  static async getAtividadesByOperacao(operacaoCodigo: string): Promise<AtividadeComOperacao[]> {
    const { data, error } = await supabase
      .from('atividades_padrao')
      .select(`
        *,
        operacao:operacoes_padrao(*)
      `)
      .eq('operacao.codigo', operacaoCodigo)
      .eq('ativo', true)
      .order('ordem', { ascending: true });

    if (error) throw error;
    
    return (data || []).map((atividade: Record<string, unknown>) => ({
      ...atividade,
      operacaoNome: (atividade.operacao as Record<string, unknown>)?.nome || ''
    })) as AtividadeComOperacao[];
  }

  // Buscar atividade por ID
  static async getAtividadeById(id: string): Promise<AtividadePadrao | null> {
    const { data, error } = await supabase
      .from('atividades_padrao')
      .select(`
        *,
        operacao:operacoes_padrao(*)
      `)
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }
    return data;
  }

  // Buscar atividade por código
  static async getAtividadeByCodigo(codigo: string): Promise<AtividadePadrao | null> {
    const { data, error } = await supabase
      .from('atividades_padrao')
      .select(`
        *,
        operacao:operacoes_padrao(*)
      `)
      .eq('codigo', codigo)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }
    return data;
  }

  // Criar atividade
  static async createAtividade(atividade: AtividadeFormData): Promise<AtividadePadrao> {
    const { data, error } = await supabase
      .from('atividades_padrao')
      .insert({
        codigo: atividade.codigo,
        nome: atividade.nome,
        descricao: atividade.descricao,
        operacao_id: atividade.operacaoId,
        contrato_id: atividade.contratoId,
        ativo: atividade.ativo,
        ordem: atividade.ordem,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // Atualizar atividade
  static async updateAtividade(id: string, atividade: Partial<AtividadeFormData>): Promise<AtividadePadrao> {
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString()
    };

    if (atividade.codigo !== undefined) updateData.codigo = atividade.codigo;
    if (atividade.nome !== undefined) updateData.nome = atividade.nome;
    if (atividade.descricao !== undefined) updateData.descricao = atividade.descricao;
    if (atividade.operacaoId !== undefined) updateData.operacao_id = atividade.operacaoId;
    if (atividade.contratoId !== undefined) updateData.contrato_id = atividade.contratoId;
    if (atividade.ativo !== undefined) updateData.ativo = atividade.ativo;
    if (atividade.ordem !== undefined) updateData.ordem = atividade.ordem;

    const { data, error } = await supabase
      .from('atividades_padrao')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // Deletar atividade
  static async deleteAtividade(id: string): Promise<void> {
    const { error } = await supabase
      .from('atividades_padrao')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  // ============================================================================
  // FUNÇÕES AUXILIARES
  // ============================================================================

  // Buscar operações ativas para select
  static async getOperacoesForSelect(): Promise<{ value: string; label: string }[]> {
    const operacoes = await this.getOperacoes({ ativo: true });
    return operacoes.map(op => ({
      value: op.codigo,
      label: op.nome
    }));
  }

  // Buscar atividades por operação para select
  static async getAtividadesForSelect(operacaoCodigo?: string): Promise<{ value: string; label: string }[]> {
    const filter: AtividadeFilter = { ativo: true };
    if (operacaoCodigo) {
      filter.operacaoId = operacaoCodigo;
    }
    
    const atividades = await this.getAtividades(filter);
    return atividades.map(at => ({
      value: at.codigo,
      label: at.nome
    }));
  }

  // Verificar se código de operação existe
  static async operacaoExists(codigo: string, excludeId?: string): Promise<boolean> {
    let query = supabase
      .from('operacoes_padrao')
      .select('id')
      .eq('codigo', codigo);

    if (excludeId) {
      query = query.neq('id', excludeId);
    }

    const { data, error } = await query;

    if (error) throw error;
    return (data || []).length > 0;
  }

  // Verificar se código de atividade existe
  static async atividadeExists(codigo: string, excludeId?: string): Promise<boolean> {
    let query = supabase
      .from('atividades_padrao')
      .select('id')
      .eq('codigo', codigo);

    if (excludeId) {
      query = query.neq('id', excludeId);
    }

    const { data, error } = await query;

    if (error) throw error;
    return (data || []).length > 0;
  }

  // ============================================================================
  // ESTATÍSTICAS
  // ============================================================================

  // Contar operações
  static async countOperacoes(filter?: OperacaoFilter): Promise<number> {
    let query = supabase
      .from('operacoes_padrao')
      .select('id', { count: 'exact' });

    if (filter?.ativo !== undefined) {
      query = query.eq('ativo', filter.ativo);
    }

    if (filter?.search) {
      query = query.or(`nome.ilike.%${filter.search}%,codigo.ilike.%${filter.search}%`);
    }

    const { count, error } = await query;

    if (error) throw error;
    return count || 0;
  }

  // Contar atividades
  static async countAtividades(filter?: AtividadeFilter): Promise<number> {
    let query = supabase
      .from('atividades_padrao')
      .select('id', { count: 'exact' });

    if (filter?.ativo !== undefined) {
      query = query.eq('ativo', filter.ativo);
    }

    if (filter?.operacaoId) {
      query = query.eq('operacao_id', filter.operacaoId);
    }

    if (filter?.search) {
      query = query.or(`nome.ilike.%${filter.search}%,codigo.ilike.%${filter.search}%`);
    }

    const { count, error } = await query;

    if (error) throw error;
    return count || 0;
  }
}

