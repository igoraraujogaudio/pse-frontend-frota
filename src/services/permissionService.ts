import { supabase } from '@/lib/supabase';
import type { 
  Funcionalidade, 
  UsuarioFuncionalidade, 
  GrupoPermissao, 
  GrupoFuncionalidade 
} from '@/types/permissions';

export class PermissionService {
  // ============================================================================
  // FUNCIONALIDADES
  // ============================================================================

  async getFuncionalidades(): Promise<Funcionalidade[]> {
    const { data, error } = await supabase
      .from('funcionalidades')
      .select('*')
      .order('modulo', { ascending: true })
      .order('codigo', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  async getFuncionalidadesByModulo(modulo: string): Promise<Funcionalidade[]> {
    const { data, error } = await supabase
      .from('funcionalidades')
      .select('*')
      .eq('modulo', modulo)
      .eq('ativa', true)
      .order('codigo', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  async createFuncionalidade(funcionalidade: Omit<Funcionalidade, 'id' | 'created_at' | 'updated_at'>): Promise<Funcionalidade> {
    const { data, error } = await supabase
      .from('funcionalidades')
      .insert(funcionalidade)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async updateFuncionalidade(id: string, updates: Partial<Funcionalidade>): Promise<Funcionalidade> {
    const { data, error } = await supabase
      .from('funcionalidades')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async deleteFuncionalidade(id: string): Promise<void> {
    const { error } = await supabase
      .from('funcionalidades')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  // ============================================================================
  // PERMISSÕES DE USUÁRIO
  // ============================================================================

  async getUserPermissions(userId: string): Promise<UsuarioFuncionalidade[]> {
    const { data, error } = await supabase
      .from('usuario_funcionalidades')
      .select(`
        *,
        funcionalidade:funcionalidades(*)
      `)
      .eq('usuario_id', userId)
      .eq('ativo', true);

    if (error) throw error;
    return data || [];
  }

  async grantUserPermission(permission: Omit<UsuarioFuncionalidade, 'id' | 'created_at'>): Promise<UsuarioFuncionalidade> {
    const { data, error } = await supabase
      .from('usuario_funcionalidades')
      .insert(permission)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async revokeUserPermission(userId: string, funcionalidadeId: string): Promise<void> {
    const { error } = await supabase
      .from('usuario_funcionalidades')
      .update({ ativo: false })
      .eq('usuario_id', userId)
      .eq('funcionalidade_id', funcionalidadeId);

    if (error) throw error;
  }

  async updateUserPermission(
    userId: string, 
    funcionalidadeId: string, 
    updates: Partial<UsuarioFuncionalidade>
  ): Promise<UsuarioFuncionalidade> {
    const { data, error } = await supabase
      .from('usuario_funcionalidades')
      .update(updates)
      .eq('usuario_id', userId)
      .eq('funcionalidade_id', funcionalidadeId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // ============================================================================
  // VERIFICAÇÃO DE PERMISSÕES
  // ============================================================================

  async checkUserPermission(userId: string, funcionalidadeCodigo: string): Promise<boolean> {
    const { data, error } = await supabase
      .rpc('user_has_permission', {
        user_id: userId,
        funcionalidade_codigo: funcionalidadeCodigo
      });

    if (error) throw error;
    return data || false;
  }

  // NOVA FUNÇÃO: Verificar se nível tem permissão na matriz
  async checkNivelPermission(nivelAcesso: string, funcionalidadeCodigo: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('configuracao_permissoes_niveis')
      .select('tem_permissao')
      .eq('nivel_acesso', nivelAcesso)
      .eq('funcionalidade_id', (
        await supabase
          .from('funcionalidades')
          .select('id')
          .eq('codigo', funcionalidadeCodigo)
          .eq('ativa', true)
          .single()
      ).data?.id)
      .single();

    if (error) {
      console.log('Nenhuma configuração na matriz para:', { nivelAcesso, funcionalidadeCodigo });
      return false; // Se não tem configuração específica, negar
    }

    return data?.tem_permissao === true;
  }

  async getUserPermissionsMatrix(userId: string): Promise<{[modulo: string]: {[codigo: string]: boolean}}> {
    const funcionalidades = await this.getFuncionalidades();
    const matrix: {[modulo: string]: {[codigo: string]: boolean}} = {};

    for (const func of funcionalidades) {
      if (!matrix[func.modulo]) {
        matrix[func.modulo] = {};
      }
      
      const hasPermission = await this.checkUserPermission(userId, func.codigo);
      matrix[func.modulo][func.codigo] = hasPermission;
    }

    return matrix;
  }

  // ============================================================================
  // GRUPOS DE PERMISSÕES
  // ============================================================================

  async getGruposPermissoes(): Promise<GrupoPermissao[]> {
    try {
      console.log('🔍 Buscando grupos de permissões...');
      
      // Buscar apenas os dados básicos sem relacionamentos complexos
      const { data, error } = await supabase
        .from('grupos_permissoes')
        .select('*')
        .eq('ativo', true)
        .order('nome', { ascending: true });

      if (error) {
        console.error('❌ Erro ao buscar grupos de permissões:', error);
        throw error;
      }
      
      console.log(`✅ Grupos de permissões encontrados: ${data?.length || 0}`);
      
      // Se não há dados, retornar array vazio
      if (!data || data.length === 0) {
        console.log('ℹ️ Nenhum grupo de permissões encontrado (isso é normal se não há grupos criados)');
        return [];
      }
      
      return data;
    } catch (error) {
      console.error('❌ Erro em getGruposPermissoes:', error);
      return [];
    }
  }

  async createGrupoPermissao(grupo: Omit<GrupoPermissao, 'id' | 'created_at'>): Promise<GrupoPermissao> {
    const { data, error } = await supabase
      .from('grupos_permissoes')
      .insert({
        nome: grupo.nome,
        descricao: grupo.descricao,
        ativo: grupo.ativo
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async updateGrupoPermissao(id: string, updates: Partial<GrupoPermissao>): Promise<GrupoPermissao> {
    const { data, error } = await supabase
      .from('grupos_permissoes')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async deleteGrupoPermissao(id: string): Promise<void> {
    const { error } = await supabase
      .from('grupos_permissoes')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  // ============================================================================
  // FUNCIONALIDADES DO GRUPO
  // ============================================================================

  async addFuncionalidadeToGrupo(grupoId: string, funcionalidadeId: string): Promise<GrupoFuncionalidade> {
    const { data, error } = await supabase
      .from('grupo_funcionalidades')
      .insert({
        grupo_id: grupoId,
        funcionalidade_id: funcionalidadeId
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async removeFuncionalidadeFromGrupo(grupoId: string, funcionalidadeId: string): Promise<void> {
    const { error } = await supabase
      .from('grupo_funcionalidades')
      .delete()
      .eq('grupo_id', grupoId)
      .eq('funcionalidade_id', funcionalidadeId);

    if (error) throw error;
  }

  // ============================================================================
  // APLICAR TEMPLATES/COMBOS
  // ============================================================================

  async applyPermissionTemplate(userId: string, templateId: string, createdBy: string): Promise<void> {
    // Buscar funcionalidades do template
    const { data: grupoFuncionalidades, error } = await supabase
      .from('grupo_funcionalidades')
      .select('funcionalidade_id')
      .eq('grupo_id', templateId);

    if (error) throw error;

    // Aplicar cada permissão
    const permissions = grupoFuncionalidades?.map(gf => ({
      usuario_id: userId,
      funcionalidade_id: gf.funcionalidade_id,
      concedido: true,
      tipo_permissao: 'adicional' as const,
      motivo: `Aplicado template/combo de permissões`,
      created_by: createdBy
    })) || [];

    if (permissions.length > 0) {
      const { error: insertError } = await supabase
        .from('usuario_funcionalidades')
        .insert(permissions);

      if (insertError) throw insertError;
    }

    // Marcar usuário como tendo permissões personalizadas
    await supabase
      .from('usuarios')
      .update({ permissoes_personalizadas: true })
      .eq('id', userId);
  }

  async applyBulkPermissions(
    userIds: string[], 
    funcionalidadeIds: string[], 
    config: {
      concedido: boolean;
      tipo_permissao: 'adicional' | 'restricao';
      motivo: string;
      created_by: string;
    }
  ): Promise<void> {
    const permissions: Omit<UsuarioFuncionalidade, 'id' | 'created_at'>[] = [];

    for (const userId of userIds) {
      for (const funcionalidadeId of funcionalidadeIds) {
        permissions.push({
          usuario_id: userId,
          funcionalidade_id: funcionalidadeId,
          concedido: config.concedido,
          tipo_permissao: config.tipo_permissao,
          motivo: config.motivo,
          ativo: true,
          created_by: config.created_by
        });
      }
    }

    if (permissions.length > 0) {
      const { error } = await supabase
        .from('usuario_funcionalidades')
        .insert(permissions);

      if (error) throw error;

      // Marcar usuários como tendo permissões personalizadas
      await supabase
        .from('usuarios')
        .update({ permissoes_personalizadas: true })
        .in('id', userIds);
    }
  }

  // ============================================================================
  // RELATÓRIOS E ESTATÍSTICAS
  // ============================================================================

  async getPermissionsStats(): Promise<{
    totalFuncionalidades: number;
    totalUsuariosComPermissoes: number;
    permissoesPorModulo: {[modulo: string]: number};
    usuariosMaisPermissoes: {nome: string; total: number}[];
  }> {
    // Total de funcionalidades ativas
    const { count: totalFuncionalidades } = await supabase
      .from('funcionalidades')
      .select('*', { count: 'exact', head: true })
      .eq('ativa', true);

    // Total de usuários com permissões personalizadas
    const { count: totalUsuariosComPermissoes } = await supabase
      .from('usuarios')
      .select('*', { count: 'exact', head: true })
      .eq('permissoes_personalizadas', true);

    // Permissões por módulo
    const { data: funcionalidades } = await supabase
      .from('funcionalidades')
      .select('modulo')
      .eq('ativa', true);

    const permissoesPorModulo: {[modulo: string]: number} = {};
    funcionalidades?.forEach(f => {
      permissoesPorModulo[f.modulo] = (permissoesPorModulo[f.modulo] || 0) + 1;
    });

    // Usuários com mais permissões
    const { data: usuariosPermissoes } = await supabase
      .from('usuario_funcionalidades')
      .select(`
        usuario_id,
        usuario:usuarios!usuario_permissoes_usuario_id_fkey(nome)
      `)
      .eq('ativo', true)
      .eq('concedido', true);

    const permissoesPorUsuario: {[userId: string]: {nome: string; total: number}} = {};
    usuariosPermissoes?.forEach(up => {
      const userId = up.usuario_id;
      if (!permissoesPorUsuario[userId]) {
        permissoesPorUsuario[userId] = {
          nome: (up.usuario as { nome?: string })?.nome || 'N/A',
          total: 0
        };
      }
      permissoesPorUsuario[userId].total++;
    });

    const usuariosMaisPermissoes = Object.values(permissoesPorUsuario)
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);

    return {
      totalFuncionalidades: totalFuncionalidades || 0,
      totalUsuariosComPermissoes: totalUsuariosComPermissoes || 0,
      permissoesPorModulo,
      usuariosMaisPermissoes
    };
  }

  // ============================================================================
  // CONFIGURAÇÃO DE PERMISSÕES POR NÍVEL
  // ============================================================================

  async getConfiguracaoPermissoes(): Promise<unknown[]> {
    const { data, error } = await supabase
      .from('configuracao_permissoes_niveis')
      .select('*')
      .order('nivel_acesso')
      .order('funcionalidade_id');

    if (error) throw error;
    return data || [];
  }

  async updateConfiguracaoPermissao(
    funcionalidadeId: string,
    nivelAcesso: string,
    temPermissao: boolean
  ): Promise<void> {
    const { error } = await supabase
      .from('configuracao_permissoes_niveis')
      .upsert({
        funcionalidade_id: funcionalidadeId,
        nivel_acesso: nivelAcesso,
        tem_permissao: temPermissao
      }, {
        onConflict: 'funcionalidade_id,nivel_acesso'
      });

    if (error) throw error;
  }

  async updateMultiplasConfiguracoes(
    configuracoes: Array<{
      funcionalidadeId: string;
      nivelAcesso: string;
      temPermissao: boolean;
    }>
  ): Promise<void> {
    const updates = configuracoes.map(config => ({
      funcionalidade_id: config.funcionalidadeId,
      nivel_acesso: config.nivelAcesso,
      tem_permissao: config.temPermissao
    }));

    const { error } = await supabase
      .from('configuracao_permissoes_niveis')
      .upsert(updates, {
        onConflict: 'funcionalidade_id,nivel_acesso'
      });

    if (error) throw error;
  }

  async resetConfiguracaoToDefault(funcionalidadeId?: string): Promise<void> {
    let deleteQuery;
    
    if (funcionalidadeId) {
      deleteQuery = supabase
        .from('configuracao_permissoes_niveis')
        .delete()
        .eq('funcionalidade_id', funcionalidadeId);
    } else {
      deleteQuery = supabase
        .from('configuracao_permissoes_niveis')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all
    }

    const { error } = await deleteQuery;
    if (error) throw error;

    // Recriar configurações padrão seria feito via SQL trigger ou função
  }

  // Método para obter matriz de permissões formatada
  async getMatrizPermissoes(): Promise<{
    funcionalidades: unknown[];
    configuracoes: Record<string, Record<string, boolean>>;
    niveis: string[];
  }> {
    const [funcionalidades, configuracoes] = await Promise.all([
      this.getFuncionalidades(),
      this.getConfiguracaoPermissoes()
    ]);

    // Níveis em ordem hierárquica
    const niveis = [
      'admin', 'diretor', 'manager', 'gerente', 'fleet_manager', 
      'gestor', 'gestor_almoxarifado', 'coordenador', 'supervisor', 
      'portaria', 'almoxarifado', 'operacao'
    ];

    // Criar matriz de configurações
    const matrizConfiguracoes: Record<string, Record<string, boolean>> = {};
    
    configuracoes.forEach((config: unknown) => {
      const configObj = config as { funcionalidade_id: string; nivel_acesso: string; tem_permissao: boolean };
      const funcId = configObj.funcionalidade_id;
      if (!matrizConfiguracoes[funcId]) {
        matrizConfiguracoes[funcId] = {};
      }
      matrizConfiguracoes[funcId][configObj.nivel_acesso] = configObj.tem_permissao;
    });

    return {
      funcionalidades,
      configuracoes: matrizConfiguracoes,
      niveis
    };
  }
}

export const permissionService = new PermissionService();