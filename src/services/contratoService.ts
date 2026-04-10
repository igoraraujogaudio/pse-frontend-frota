import { supabase } from '@/lib/supabase';
import type { Contrato, UsuarioContrato } from '@/types/contratos';

export class ContratoService {
  // ============================================================================
  // CONTRATOS
  // ============================================================================

  async getContratos(): Promise<Contrato[]> {
    const { data, error } = await supabase
      .from('contratos')
      .select('*')
      .order('nome', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  // Alias para compatibilidade
  async getAll(): Promise<Contrato[]> {
    return this.getContratos();
  }

  async getContrato(id: string): Promise<Contrato | null> {
    const { data, error } = await supabase
      .from('contratos')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw error;
    }
    return data;
  }

  async getContratosAtivos(): Promise<Contrato[]> {
    console.log('🔍 ContratoService.getContratosAtivos - Iniciando...');
    
    const { data, error } = await supabase
      .from('contratos')
      .select('*')
      .eq('status', 'ativo')
      .order('nome', { ascending: true });

    if (error) {
      console.error('❌ ContratoService.getContratosAtivos - Erro:', error);
      throw error;
    }
    
    console.log('✅ ContratoService.getContratosAtivos - Dados retornados:', data);
    return data || [];
  }

  async createContrato(contrato: Omit<Contrato, 'id' | 'created_at' | 'updated_at'>): Promise<Contrato> {
    const { data, error } = await supabase
      .from('contratos')
      .insert(contrato)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async updateContrato(id: string, updates: Partial<Contrato>): Promise<Contrato> {
    const { data, error } = await supabase
      .from('contratos')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async deleteContrato(id: string): Promise<void> {
    const { error } = await supabase
      .from('contratos')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  // ============================================================================
  // USUÁRIO-CONTRATOS
  // ============================================================================

  async getUserContratos(userId: string): Promise<UsuarioContrato[]> {
    console.log('🔍 contratoService.getUserContratos - User ID:', userId);
    
    const { data, error } = await supabase
      .from('usuario_contratos')
      .select(`
        *,
        contrato:contratos(*)
      `)
      .eq('usuario_id', userId)
      .eq('ativo', true);

    console.log('🔍 contratoService.getUserContratos - Data:', data);
    console.log('🔍 contratoService.getUserContratos - Error:', error);

    if (error) throw error;
    return data || [];
  }

  async getContratoUsers(contratoId: string): Promise<UsuarioContrato[]> {
    const { data, error } = await supabase
      .from('usuario_contratos')
      .select(`
        *,
        usuario:usuarios!usuario_contratos_usuario_id_fkey(*)
      `)
      .eq('contrato_id', contratoId)
      .eq('ativo', true)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  async assignUserToContrato(assignment: Omit<UsuarioContrato, 'id' | 'created_at'>): Promise<UsuarioContrato> {
    const { data, error } = await supabase
      .from('usuario_contratos')
      .insert(assignment)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async updateUserContratoAssignment(
    userId: string, 
    contratoId: string, 
    updates: Partial<UsuarioContrato>
  ): Promise<UsuarioContrato> {
    const { data, error } = await supabase
      .from('usuario_contratos')
      .update(updates)
      .eq('usuario_id', userId)
      .eq('contrato_id', contratoId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async removeUserFromContrato(userId: string, contratoId: string): Promise<void> {
    const { error } = await supabase
      .from('usuario_contratos')
      .update({ ativo: false })
      .eq('usuario_id', userId)
      .eq('contrato_id', contratoId);

    if (error) throw error;
  }

  // ============================================================================
  // RELATÓRIOS E ESTATÍSTICAS
  // ============================================================================

  async getContratoStats(): Promise<{
    totalContratos: number;
    contratosAtivos: number;
    contratosSuspensos: number;
    contratosInativos: number;
    usuariosPorContrato: {[contratoId: string]: number};
  }> {
    const contratos = await this.getContratos();
    
    const stats = {
      totalContratos: contratos.length,
      contratosAtivos: contratos.filter(c => c.status === 'ativo').length,
      contratosSuspensos: contratos.filter(c => c.status === 'suspenso').length,
      contratosInativos: contratos.filter(c => c.status === 'inativo').length,
      usuariosPorContrato: {} as {[contratoId: string]: number}
    };

    // Contar usuários por contrato
    for (const contrato of contratos) {
      const { count } = await supabase
        .from('usuario_contratos')
        .select('*', { count: 'exact', head: true })
        .eq('contrato_id', contrato.id)
        .eq('ativo', true);
      
      stats.usuariosPorContrato[contrato.id] = count || 0;
    }

    return stats;
  }

  async getContratosWithDetails(): Promise<(Contrato & {
    totalUsuarios: number;
    totalBases: number;
    totalEquipes: number;
    totalVeiculos: number;
  })[]> {
    const contratos = await this.getContratos();
    
    const contratosWithDetails = await Promise.all(
      contratos.map(async (contrato) => {
        // Contar usuários
        const { count: totalUsuarios } = await supabase
          .from('usuario_contratos')
          .select('*', { count: 'exact', head: true })
          .eq('contrato_id', contrato.id)
          .eq('ativo', true);

        // Contar bases
        const { count: totalBases } = await supabase
          .from('bases')
          .select('*', { count: 'exact', head: true })
          .eq('contrato_id', contrato.id);

        // Contar equipes
        const { count: totalEquipes } = await supabase
          .from('equipes')
          .select('*', { count: 'exact', head: true })
          .eq('contrato_id', contrato.id);

        // Contar veículos
        const { count: totalVeiculos } = await supabase
          .from('veiculos')
          .select('*', { count: 'exact', head: true })
          .eq('contrato_id', contrato.id);

        return {
          ...contrato,
          totalUsuarios: totalUsuarios || 0,
          totalBases: totalBases || 0,
          totalEquipes: totalEquipes || 0,
          totalVeiculos: totalVeiculos || 0
        };
      })
    );

    return contratosWithDetails;
  }

  // ============================================================================
  // BULK OPERATIONS
  // ============================================================================

  async bulkAssignUsersToContrato(
    userIds: string[], 
    contratoId: string, 
    config: {
      perfil_contrato: string;
      created_by: string;
    }
  ): Promise<void> {
    const assignments = userIds.map(userId => ({
      usuario_id: userId,
      contrato_id: contratoId,
      perfil_contrato: config.perfil_contrato,
      data_inicio: new Date().toISOString().split('T')[0],
      ativo: true,
      created_by: config.created_by
    }));

    const { error } = await supabase
      .from('usuario_contratos')
      .insert(assignments);

    if (error) throw error;
  }

  async bulkRemoveUsersFromContrato(userIds: string[], contratoId: string): Promise<void> {
    const { error } = await supabase
      .from('usuario_contratos')
      .update({ ativo: false })
      .eq('contrato_id', contratoId)
      .in('usuario_id', userIds);

    if (error) throw error;
  }

  // ============================================================================
  // BUSCA E FILTROS
  // ============================================================================

  async searchContratos(query: string): Promise<Contrato[]> {
    const { data, error } = await supabase
      .from('contratos')
      .select('*')
      .or(`nome.ilike.%${query}%,codigo.ilike.%${query}%,descricao.ilike.%${query}%`)
      .order('nome', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  async getContratosByStatus(status: string): Promise<Contrato[]> {
    const { data, error } = await supabase
      .from('contratos')
      .select('*')
      .eq('status', status)
      .order('nome', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  async getContratosByResponsavel(responsavelId: string): Promise<Contrato[]> {
    const { data, error } = await supabase
      .from('contratos')
      .select('*')
      .eq('responsavel_id', responsavelId)
      .order('nome', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  // ============================================================================
  // SISTEMA DE CONTRATO DE ORIGEM E VISUALIZAÇÃO
  // ============================================================================

  async setUsuarioContratoOrigem(usuarioId: string, contratoId: string): Promise<void> {
    const { error } = await supabase.rpc('set_usuario_contrato_origem', {
      p_usuario_id: usuarioId,
      p_contrato_id: contratoId
    });

    if (error) throw error;
  }

  async addUsuarioContratoVisualizacao(
    usuarioId: string, 
    contratoId: string, 
    perfil: string = 'operador'
  ): Promise<void> {
    const { error } = await supabase.rpc('add_usuario_contrato_visualizacao', {
      p_usuario_id: usuarioId,
      p_contrato_id: contratoId,
      p_perfil: perfil
    });

    if (error) throw error;
  }

  async getUsuarioContratosCompleto(usuarioId: string): Promise<{
    contrato_id: string;
    contrato_nome: string;
    contrato_codigo: string;
    tipo_acesso: 'origem' | 'visualizacao';
    perfil_contrato: string;
    is_origem: boolean;
  }[]> {
    const { data, error } = await supabase.rpc('get_usuario_contratos_completo', {
      p_usuario_id: usuarioId
    });

    if (error) throw error;
    return data || [];
  }

  async removeUsuarioContrato(usuarioId: string, contratoId: string): Promise<void> {
    const { error } = await supabase
      .from('usuario_contratos')
      .update({ ativo: false })
      .eq('usuario_id', usuarioId)
      .eq('contrato_id', contratoId);

    if (error) throw error;
  }
}

export const contratoService = new ContratoService();