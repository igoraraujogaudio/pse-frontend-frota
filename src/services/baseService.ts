import { supabase } from '@/lib/supabase';
import type { Base, UsuarioBase } from '@/types/contratos';

export class BaseService {
  // ============================================================================
  // BASES
  // ============================================================================

  async getBases(): Promise<Base[]> {
    const { data, error } = await supabase
      .from('bases')
      .select(`
        *,
        contrato:contratos(*)
      `)
      .order('nome', { ascending: true });

    if (error) throw error;
    
    // Buscar configurações SESMT separadamente para evitar problemas com relacionamentos
    const baseIds = (data || []).map(b => b.id);
    const { data: configs } = await supabase
      .from('configuracoes_aprovacao_sesmt')
      .select('base_id, aprovar_sesmt_obrigatorio')
      .in('base_id', baseIds);
    
    // Criar mapa de configurações por base_id
    const configMap = new Map(
      (configs || []).map(c => [c.base_id, c.aprovar_sesmt_obrigatorio])
    );
    
    // Mapear configuração SESMT para o campo aprovar_sesmt_obrigatorio
    return (data || []).map(base => ({
      ...base,
      aprovar_sesmt_obrigatorio: configMap.get(base.id) ?? true
    }));
  }

  // Alias para compatibilidade
  async getAll(): Promise<Base[]> {
    return this.getBases();
  }

  async getBase(id: string): Promise<Base | null> {
    const { data, error } = await supabase
      .from('bases')
      .select(`
        *,
        contrato:contratos(*)
      `)
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw error;
    }
    
    // Buscar configuração SESMT separadamente
    const { data: config } = await supabase
      .from('configuracoes_aprovacao_sesmt')
      .select('aprovar_sesmt_obrigatorio')
      .eq('base_id', id)
      .maybeSingle();
    
    return {
      ...data,
      aprovar_sesmt_obrigatorio: config?.aprovar_sesmt_obrigatorio ?? true
    };
  }

  async getBasesAtivas(): Promise<Base[]> {
    console.log('🔍 BaseService.getBasesAtivas - Iniciando...');
    
    // Teste 1: Todas as bases (sem filtro)
    const { data: todasBases, error: errorTodas } = await supabase
      .from('bases')
      .select('*')
      .order('nome', { ascending: true });

    console.log('🔍 BaseService.getBasesAtivas - Todas as bases:', { data: todasBases, error: errorTodas });

    // Teste 2: Filtro com boolean true
    const { data: dataBoolean, error: errorBoolean } = await supabase
      .from('bases')
      .select('*')
      .eq('ativa', true)
      .order('nome', { ascending: true });

    console.log('🔍 BaseService.getBasesAtivas - Filtro boolean true:', { data: dataBoolean, error: errorBoolean });

    // Teste 3: Filtro com string 'true'
    const { data: dataString, error: errorString } = await supabase
      .from('bases')
      .select('*')
      .eq('ativa', 'true')
      .order('nome', { ascending: true });

    console.log('🔍 BaseService.getBasesAtivas - Filtro string true:', { data: dataString, error: errorString });

    // Determinar qual filtro funcionou
    let basesAtivas = [];
    if (dataBoolean && dataBoolean.length > 0) {
      basesAtivas = dataBoolean;
      console.log('✅ Usando filtro boolean');
    } else if (dataString && dataString.length > 0) {
      basesAtivas = dataString;
      console.log('✅ Usando filtro string');
    } else {
      // Se nenhum filtro funcionou, retorna todas as bases
      basesAtivas = todasBases || [];
      console.log('⚠️ Nenhum filtro funcionou, retornando todas as bases');
    }

    // Agora fazer o join se tiver dados
    if (basesAtivas.length > 0) {
      const { data: dataComJoin, error: errorJoin } = await supabase
        .from('bases')
        .select(`
          *,
          contrato:contratos(*)
        `)
        .in('id', basesAtivas.map(b => b.id))
        .order('nome', { ascending: true });

      if (!errorJoin && dataComJoin) {
        console.log('✅ BaseService.getBasesAtivas - Com join:', dataComJoin);
        return dataComJoin;
      }
    }
    
    console.log('✅ BaseService.getBasesAtivas - Sem join:', basesAtivas);
    return basesAtivas;
  }

  async getBasesByContrato(contratoId: string): Promise<Base[]> {
    const { data, error } = await supabase
      .from('bases')
      .select(`
        *,
        contrato:contratos(*)
      `)
      .eq('contrato_id', contratoId)
      .eq('ativa', true)
      .order('nome', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  async createBase(base: Omit<Base, 'id' | 'created_at' | 'updated_at'>): Promise<Base> {
    console.log('🔍 BaseService.createBase - Dados recebidos:', base);
    
    // Separar aprovar_sesmt_obrigatorio do insert da base
    const { aprovar_sesmt_obrigatorio, ...baseData } = base;
    
    const { data, error } = await supabase
      .from('bases')
      .insert(baseData)
      .select(`
        *,
        contrato:contratos(*)
      `)
      .single();

    if (error) {
      console.error('❌ BaseService.createBase - Erro do Supabase:', error);
      throw error;
    }
    
    // Criar configuração SESMT (padrão: true se não especificado)
    const sesmtObrigatorio = aprovar_sesmt_obrigatorio ?? true;
    await supabase
      .from('configuracoes_aprovacao_sesmt')
      .insert({
        base_id: data.id,
        aprovar_sesmt_obrigatorio: sesmtObrigatorio
      });
    
    console.log('✅ BaseService.createBase - Base criada:', data);
    
    return {
      ...data,
      aprovar_sesmt_obrigatorio: sesmtObrigatorio
    };
  }

  async updateBase(id: string, updates: Partial<Base>): Promise<Base> {
    // Separar aprovar_sesmt_obrigatorio do update da base
    const { aprovar_sesmt_obrigatorio, ...baseUpdates } = updates;
    
    // Atualizar a base
    const { data, error } = await supabase
      .from('bases')
      .update({ ...baseUpdates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select(`
        *,
        contrato:contratos(*)
      `)
      .single();

    if (error) throw error;
    
    // Atualizar configuração SESMT se fornecida
    if (aprovar_sesmt_obrigatorio !== undefined) {
      // Verificar se já existe configuração
      const { data: existingConfig, error: checkError } = await supabase
        .from('configuracoes_aprovacao_sesmt')
        .select('id')
        .eq('base_id', id)
        .maybeSingle();
      
      if (checkError && checkError.code !== 'PGRST116') {
        console.error('Erro ao verificar configuração SESMT:', checkError);
        throw checkError;
      }
      
      if (existingConfig) {
        // Atualizar existente usando UPSERT para evitar race conditions
        const { error: updateError } = await supabase
          .from('configuracoes_aprovacao_sesmt')
          .update({ 
            aprovar_sesmt_obrigatorio,
            atualizado_em: new Date().toISOString()
          })
          .eq('base_id', id);
        
        if (updateError) {
          console.error('Erro ao atualizar configuração SESMT:', updateError);
          throw updateError;
        }
      } else {
        // Criar nova configuração usando UPSERT para evitar duplicatas
        const { error: insertError } = await supabase
          .from('configuracoes_aprovacao_sesmt')
          .upsert({
            base_id: id,
            aprovar_sesmt_obrigatorio,
            criado_em: new Date().toISOString(),
            atualizado_em: new Date().toISOString()
          }, {
            onConflict: 'base_id'
          });
        
        if (insertError) {
          console.error('Erro ao criar configuração SESMT:', insertError);
          throw insertError;
        }
      }
    }
    
    // Buscar configuração SESMT atualizada
    const { data: config } = await supabase
      .from('configuracoes_aprovacao_sesmt')
      .select('aprovar_sesmt_obrigatorio')
      .eq('base_id', id)
      .maybeSingle();
    
    return {
      ...data,
      aprovar_sesmt_obrigatorio: config?.aprovar_sesmt_obrigatorio ?? true
    };
  }

  async deleteBase(id: string): Promise<void> {
    const { error } = await supabase
      .from('bases')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  // ============================================================================
  // USUÁRIO-BASES
  // ============================================================================

  async getUserBases(userId: string): Promise<UsuarioBase[]> {
    const { data, error } = await supabase
      .from('usuario_bases')
      .select(`
        *,
        base:bases(
          *,
          contrato:contratos(*)
        )
      `)
      .eq('usuario_id', userId)
      .eq('ativo', true);

    if (error) throw error;
    return data || [];
  }

  async getBaseUsers(baseId: string): Promise<UsuarioBase[]> {
    const { data, error } = await supabase
      .from('usuario_bases')
      .select(`
        *,
        usuario:usuarios!usuario_bases_usuario_id_fkey(*)
      `)
      .eq('base_id', baseId)
      .eq('ativo', true)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  // Method removed - duplicate function

  async updateUserBaseAssignment(
    userId: string, 
    baseId: string, 
    updates: Partial<UsuarioBase>
  ): Promise<UsuarioBase> {
    const { data, error } = await supabase
      .from('usuario_bases')
      .update(updates)
      .eq('usuario_id', userId)
      .eq('base_id', baseId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async removeUserFromBase(userId: string, baseId: string): Promise<void> {
    const { error } = await supabase
      .from('usuario_bases')
      .update({ ativo: false })
      .eq('usuario_id', userId)
      .eq('base_id', baseId);

    if (error) throw error;
  }

  async assignUserToBase(
    usuarioId: string, 
    baseId: string, 
    tipoAcesso: 'total' | 'restrito' | 'leitura' = 'total'
  ): Promise<void> {
    const { error } = await supabase
      .from('usuario_bases')
      .insert({
        usuario_id: usuarioId,
        base_id: baseId,
        tipo_acesso: tipoAcesso,
        ativo: true
      });

    if (error) throw error;
  }

  // ============================================================================
  // RELATÓRIOS E ESTATÍSTICAS
  // ============================================================================

  async getBaseStats(): Promise<{
    totalBases: number;
    basesAtivas: number;
    basesInativas: number;
    usuariosPorBase: {[baseId: string]: number};
    basesPorContrato: {[contratoId: string]: number};
  }> {
    const bases = await this.getBases();
    
    const stats = {
      totalBases: bases.length,
      basesAtivas: bases.filter(b => b.ativa).length,
      basesInativas: bases.filter(b => !b.ativa).length,
      usuariosPorBase: {} as {[baseId: string]: number},
      basesPorContrato: {} as {[contratoId: string]: number}
    };

    // Contar usuários por base
    for (const base of bases) {
      const { count } = await supabase
        .from('usuario_bases')
        .select('*', { count: 'exact', head: true })
        .eq('base_id', base.id)
        .eq('ativo', true);
      
      stats.usuariosPorBase[base.id] = count || 0;
    }

    // Contar bases por contrato
    bases.forEach(base => {
      if (base.contrato_id) {
        stats.basesPorContrato[base.contrato_id] = (stats.basesPorContrato[base.contrato_id] || 0) + 1;
      }
    });

    return stats;
  }

  async getBasesWithDetails(): Promise<(Base & {
    totalUsuarios: number;
    totalEquipes: number;
    totalVeiculos: number;
  })[]> {
    // Usar getBases() que já inclui a configuração SESMT
    const bases = await this.getBases();
    
    const basesWithDetails = await Promise.all(
      bases.map(async (base) => {
        // Contar usuários
        const { count: totalUsuarios } = await supabase
          .from('usuario_bases')
          .select('*', { count: 'exact', head: true })
          .eq('base_id', base.id)
          .eq('ativo', true);

        // Contar equipes
        const { count: totalEquipes } = await supabase
          .from('equipes')
          .select('*', { count: 'exact', head: true })
          .eq('base_id', base.id);

        // Contar veículos
        const { count: totalVeiculos } = await supabase
          .from('veiculos')
          .select('*', { count: 'exact', head: true })
          .eq('base_id', base.id);

        return {
          ...base,
          totalUsuarios: totalUsuarios || 0,
          totalEquipes: totalEquipes || 0,
          totalVeiculos: totalVeiculos || 0
        };
      })
    );

    return basesWithDetails;
  }

  // ============================================================================
  // BULK OPERATIONS
  // ============================================================================

  async bulkAssignUsersToBase(
    userIds: string[], 
    baseId: string, 
    config: {
      tipo_acesso: 'total' | 'restrito' | 'leitura';
      created_by: string;
    }
  ): Promise<void> {
    const assignments = userIds.map(userId => ({
      usuario_id: userId,
      base_id: baseId,
      tipo_acesso: config.tipo_acesso,
      data_inicio: new Date().toISOString().split('T')[0],
      ativo: true,
      created_by: config.created_by
    }));

    const { error } = await supabase
      .from('usuario_bases')
      .insert(assignments);

    if (error) throw error;
  }

  async bulkRemoveUsersFromBase(userIds: string[], baseId: string): Promise<void> {
    const { error } = await supabase
      .from('usuario_bases')
      .update({ ativo: false })
      .eq('base_id', baseId)
      .in('usuario_id', userIds);

    if (error) throw error;
  }

  async bulkUpdateBaseStatus(baseIds: string[], ativa: boolean): Promise<void> {
    const { error } = await supabase
      .from('bases')
      .update({ 
        ativa, 
        updated_at: new Date().toISOString() 
      })
      .in('id', baseIds);

    if (error) throw error;
  }

  // ============================================================================
  // BUSCA E FILTROS
  // ============================================================================

  async searchBases(query: string): Promise<Base[]> {
    const { data, error } = await supabase
      .from('bases')
      .select(`
        *,
        contrato:contratos(*)
      `)
      .or(`nome.ilike.%${query}%,codigo.ilike.%${query}%,cidade.ilike.%${query}%,estado.ilike.%${query}%`)
      .order('nome', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  async getBasesByCidade(cidade: string): Promise<Base[]> {
    const { data, error } = await supabase
      .from('bases')
      .select(`
        *,
        contrato:contratos(*)
      `)
      .eq('cidade', cidade)
      .eq('ativa', true)
      .order('nome', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  async getBasesByEstado(estado: string): Promise<Base[]> {
    const { data, error } = await supabase
      .from('bases')
      .select(`
        *,
        contrato:contratos(*)
      `)
      .eq('estado', estado)
      .eq('ativa', true)
      .order('nome', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  async getBasesByResponsavel(responsavel: string): Promise<Base[]> {
    const { data, error } = await supabase
      .from('bases')
      .select(`
        *,
        contrato:contratos(*)
      `)
      .eq('responsavel', responsavel)
      .eq('ativa', true)
      .order('nome', { ascending: true });

    if (error) throw error;
    return data || [];
  }
}

export const baseService = new BaseService();