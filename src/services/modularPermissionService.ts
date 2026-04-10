import { supabase } from '@/lib/supabase';
import type { 
  FuncionalidadeModular,
  ModuloSistema,
  Plataforma,
  PerfilAcesso,
  UsuarioPermissaoModular,
  GrupoPermissoesModulares,
  PerfilFuncionalidadesPadrao
} from '@/types/permissions';

export class ModularPermissionService {
  // ============================================================================
  // FUNCIONALIDADES MODULARES
  // ============================================================================

  async getFuncionalidadesModulares(): Promise<FuncionalidadeModular[]> {
    try {
      console.log('🔍 Buscando funcionalidades modulares...');
      
      // Buscar apenas os dados básicos sem relacionamentos complexos
      const { data, error } = await supabase
        .from('funcionalidades_modulares')
        .select('*')
        .eq('ativa', true)
        .order('ordem');

      if (error) {
        console.error('❌ Erro ao buscar funcionalidades modulares:', error);
        throw error;
      }
      
      console.log(`✅ Funcionalidades modulares encontradas: ${data?.length || 0}`);
      
      // Se não há dados, retornar array vazio
      if (!data || data.length === 0) {
        console.log('ℹ️ Nenhuma funcionalidade modular encontrada');
        return [];
      }
      
      return data;
    } catch (error) {
      console.error('❌ Erro em getFuncionalidadesModulares:', error);
      return [];
    }
  }

  async getFuncionalidadesByModulo(moduloId: string): Promise<FuncionalidadeModular[]> {
    const { data, error } = await supabase
      .from('funcionalidades_modulares')
      .select(`
        *,
        modulo:modulos_sistema(*),
        plataforma:plataformas(*)
      `)
      .eq('modulo_id', moduloId)
      .eq('ativa', true)
      .order('ordem');

    if (error) throw error;
    return data || [];
  }

  async getFuncionalidadesByPlataforma(plataformaId: string): Promise<FuncionalidadeModular[]> {
    const { data, error } = await supabase
      .from('funcionalidades_modulares')
      .select(`
        *,
        modulo:modulos_sistema(*),
        plataforma:plataformas(*)
      `)
      .eq('plataforma_id', plataformaId)
      .eq('ativa', true)
      .order('ordem');

    if (error) throw error;
    return data || [];
  }

  async getFuncionalidadesByModuloAndPlataforma(moduloId: string, plataformaId: string): Promise<FuncionalidadeModular[]> {
    const { data, error } = await supabase
      .from('funcionalidades_modulares')
      .select(`
        *,
        modulo:modulos_sistema(*),
        plataforma:plataformas(*)
      `)
      .eq('modulo_id', moduloId)
      .eq('plataforma_id', plataformaId)
      .eq('ativa', true)
      .order('ordem');

    if (error) throw error;
    return data || [];
  }

  // ============================================================================
  // MÓDULOS DO SISTEMA
  // ============================================================================

  async getModulosSistema(): Promise<ModuloSistema[]> {
    try {
      console.log('🔍 Buscando módulos do sistema...');
      const { data, error } = await supabase
        .from('modulos_sistema')
        .select('*')
        .eq('ativo', true)
        .order('ordem');

      if (error) {
        console.error('❌ Erro ao buscar módulos do sistema:', error);
        throw error;
      }
      
      console.log(`✅ Módulos do sistema encontrados: ${data?.length || 0}`);
      return data || [];
    } catch (error) {
      console.error('❌ Erro em getModulosSistema:', error);
      return [];
    }
  }

  async getModuloByCodigo(codigo: string): Promise<ModuloSistema | null> {
    const { data, error } = await supabase
      .from('modulos_sistema')
      .select('*')
      .eq('codigo', codigo)
      .eq('ativo', true)
      .single();

    if (error) throw error;
    return data;
  }

  // ============================================================================
  // PLATAFORMAS
  // ============================================================================

  async getPlataformas(): Promise<Plataforma[]> {
    try {
      console.log('🔍 Buscando plataformas...');
      const { data, error } = await supabase
        .from('plataformas')
        .select('*')
        .eq('ativa', true)
        .order('nome');

      if (error) {
        console.error('❌ Erro ao buscar plataformas:', error);
        throw error;
      }
      
      console.log(`✅ Plataformas encontradas: ${data?.length || 0}`);
      return data || [];
    } catch (error) {
      console.error('❌ Erro em getPlataformas:', error);
      return [];
    }
  }

  async getPlataformaByCodigo(codigo: string): Promise<Plataforma | null> {
    const { data, error } = await supabase
      .from('plataformas')
      .select('*')
      .eq('codigo', codigo)
      .eq('ativa', true)
      .single();

    if (error) throw error;
    return data;
  }

  // ============================================================================
  // PERFIS DE ACESSO
  // ============================================================================

  async getPerfisAcesso(): Promise<PerfilAcesso[]> {
    try {
      console.log('🔍 Buscando perfis de acesso...');
      const { data, error } = await supabase
        .from('perfis_acesso')
        .select('*')
        .order('nivel_hierarquia');

      if (error) {
        console.error('❌ Erro ao buscar perfis de acesso:', error);
        throw error;
      }
      
      console.log(`✅ Perfis de acesso encontrados: ${data?.length || 0}`);
      return data || [];
    } catch (error) {
      console.error('❌ Erro em getPerfisAcesso:', error);
      return [];
    }
  }

  // Aplicar permissões padrão de um perfil a um usuário
  async applyProfileDefaultPermissions(userId: string, perfilId: string, grantedBy: string | null, metodoAplicacao: string = 'api_individual'): Promise<void> {
    try {
      console.log(`🔄 Aplicando permissões padrão do perfil ${perfilId} ao usuário ${userId}`);
      
      // Buscar permissões padrão do perfil
      const { data: perfilFuncionalidades, error } = await supabase
        .from('perfil_funcionalidades_padrao')
        .select('funcionalidade_id, concedido')
        .eq('perfil_id', perfilId)
        .eq('concedido', true);

      if (error) {
        console.error('❌ Erro ao buscar permissões padrão do perfil:', error);
        throw error;
      }

      if (!perfilFuncionalidades || perfilFuncionalidades.length === 0) {
        console.log(`ℹ️ Nenhuma permissão padrão encontrada para o perfil ${perfilId}`);
        return;
      }

      console.log(`📋 Encontradas ${perfilFuncionalidades.length} permissões padrão para aplicar`);

      // ✅ NOVO: Registrar log de início da aplicação
      try {
        await supabase.rpc('registrar_log_aplicacao_permissao', {
          p_usuario_id: userId,
          p_acao: 'aplicada',
          p_metodo_aplicacao: metodoAplicacao,
          p_concedido: true,
          p_perfil_id: perfilId,
          p_funcionalidade_id: null, // NULL para aplicação em lote
          p_motivo: `Aplicação automática de permissões padrão do perfil via ${metodoAplicacao}`,
          p_concedido_por: grantedBy || 'sistema',
          p_dados_contexto: {
            perfil_id: perfilId,
            metodo_aplicacao: metodoAplicacao,
            total_funcionalidades: perfilFuncionalidades.length,
            timestamp: new Date().toISOString()
          }
        });
      } catch (logError) {
        console.warn('⚠️ Erro ao registrar log de auditoria:', logError);
        // Não falha a aplicação por erro de log
      }

      // Aplicar cada permissão padrão
      for (const perfilFunc of perfilFuncionalidades) {
        try {
          await this.grantUserPermissionModular({
            usuario_id: userId,
            funcionalidade_id: perfilFunc.funcionalidade_id,
            concedido: true,
            tipo_permissao: 'adicional',
            motivo: `Permissão padrão aplicada automaticamente do perfil via ${metodoAplicacao}`,
            concedido_por: grantedBy || undefined,
            data_inicio: new Date().toISOString(),
            ativo: true,
            temporaria: false
          });

          // ✅ NOVO: Registrar log individual da permissão
          try {
            await supabase.rpc('registrar_log_aplicacao_permissao', {
              p_usuario_id: userId,
              p_acao: 'aplicada',
              p_metodo_aplicacao: metodoAplicacao,
              p_concedido: true,
              p_perfil_id: perfilId,
              p_funcionalidade_id: perfilFunc.funcionalidade_id,
              p_motivo: 'Permissão padrão aplicada automaticamente',
              p_concedido_por: grantedBy || 'sistema'
            });
          } catch (logError) {
            console.warn('⚠️ Erro ao registrar log individual:', logError);
          }
        } catch (permissionError) {
          console.warn(`⚠️ Erro ao aplicar permissão ${perfilFunc.funcionalidade_id}:`, permissionError);
          // Continue com as outras permissões mesmo se uma falhar
        }
      }

      console.log(`✅ Permissões padrão do perfil ${perfilId} aplicadas ao usuário ${userId} com sucesso!`);
    } catch (error) {
      console.error('❌ Erro em applyProfileDefaultPermissions:', error);
      throw error;
    }
  }

  // Aplicar permissões padrão a todos os usuários de um perfil
  async applyProfileDefaultPermissionsToAllUsers(perfilId: string, grantedBy: string | null): Promise<void> {
    try {
      console.log(`🔄 Aplicando permissões padrão do perfil ${perfilId} a todos os usuários`);
      
      // Primeiro, buscar o perfil para obter o código/nome
      const { data: perfil, error: perfilError } = await supabase
        .from('perfis_acesso')
        .select('codigo, nome')
        .eq('id', perfilId)
        .single();

      if (perfilError) {
        console.error('❌ Erro ao buscar perfil:', perfilError);
        throw perfilError;
      }

      console.log(`📋 Perfil encontrado: ${perfil.nome} (código: ${perfil.codigo})`);

      // Buscar todos os usuários que têm este perfil (por código ou nome)
      const { data: usuarios, error: usuariosError } = await supabase
        .from('usuarios')
        .select('id, nome, nivel_acesso')
        .or(`nivel_acesso.eq.${perfil.codigo},nivel_acesso.eq.${perfil.nome}`)
        .eq('status', 'ativo');

      if (usuariosError) {
        console.error('❌ Erro ao buscar usuários do perfil:', usuariosError);
        throw usuariosError;
      }

      if (!usuarios || usuarios.length === 0) {
        console.log(`ℹ️ Nenhum usuário ativo encontrado para o perfil ${perfil.nome} (${perfil.codigo})`);
        console.log(`🔍 Tentando buscar usuários com diferentes critérios...`);
        
        // Tentar buscar usuários com diferentes critérios
        const { data: todosUsuarios, error: todosUsuariosError } = await supabase
          .from('usuarios')
          .select('id, nome, nivel_acesso, status')
          .limit(10);

        if (todosUsuariosError) {
          console.error('❌ Erro ao buscar todos os usuários:', todosUsuariosError);
        } else {
          console.log(`📊 Exemplo de usuários no sistema:`, todosUsuarios);
        }
        
        return;
      }

      console.log(`👥 Encontrados ${usuarios.length} usuários para aplicar permissões:`, usuarios.map(u => `${u.nome} (${u.nivel_acesso})`));

      // Buscar permissões padrão do perfil
      const { data: perfilFuncionalidades, error: funcError } = await supabase
        .from('perfil_funcionalidades_padrao')
        .select('funcionalidade_id, concedido')
        .eq('perfil_id', perfilId)
        .eq('concedido', true);

      if (funcError) {
        console.error('❌ Erro ao buscar permissões padrão do perfil:', funcError);
        throw funcError;
      }

      if (!perfilFuncionalidades || perfilFuncionalidades.length === 0) {
        console.log(`ℹ️ Nenhuma permissão padrão encontrada para o perfil ${perfilId}`);
        return;
      }

      console.log(`📋 Encontradas ${perfilFuncionalidades.length} permissões padrão para aplicar`);

      // Aplicar permissões padrão a todos os usuários de uma vez
      console.log(`🔄 Aplicando ${perfilFuncionalidades.length} permissões padrão a ${usuarios.length} usuários...`);

      // Criar todas as permissões de uma vez para todos os usuários
      const permissoesParaInserir = [];
      
      for (const usuario of usuarios) {
        for (const perfilFunc of perfilFuncionalidades) {
          permissoesParaInserir.push({
            usuario_id: usuario.id,
            funcionalidade_id: perfilFunc.funcionalidade_id,
            concedido: true,
            tipo_permissao: 'adicional',
            motivo: `Permissão padrão aplicada automaticamente do perfil ${perfil.nome}`,
            concedido_por: grantedBy,
            data_inicio: new Date().toISOString(),
            ativo: true,
            temporaria: false
          });
        }
      }

      console.log(`🔄 Inserindo ${permissoesParaInserir.length} permissões no banco de dados...`);

      // Inserir todas as permissões de uma vez usando upsert para evitar duplicatas
      const { error: insertError } = await supabase
        .from('usuario_permissoes_modulares')
        .upsert(permissoesParaInserir, {
          onConflict: 'usuario_id,funcionalidade_id',
          ignoreDuplicates: false
        });

      if (insertError) {
        console.error('❌ Erro ao inserir permissões em lote:', insertError);
        throw insertError;
      }

      console.log(`✅ ${permissoesParaInserir.length} permissões aplicadas com sucesso a ${usuarios.length} usuários!`);

      console.log(`✅ Permissões padrão aplicadas a todos os usuários do perfil ${perfil.nome}!`);
    } catch (error) {
      console.error('❌ Erro em applyProfileDefaultPermissionsToAllUsers:', error);
      throw error;
    }
  }


  // Remover permissões padrão de todos os usuários de um perfil
  async removeProfileDefaultPermissionsFromAllUsers(perfilId: string, funcionalidadesIds?: string[]): Promise<void> {
    try {
      console.log(`🔄 Removendo permissões padrão do perfil ${perfilId} de todos os usuários`);
      
      // Primeiro, buscar o perfil para obter o código/nome
      const { data: perfil, error: perfilError } = await supabase
        .from('perfis_acesso')
        .select('codigo, nome')
        .eq('id', perfilId)
        .single();

      if (perfilError) {
        console.error('❌ Erro ao buscar perfil:', perfilError);
        throw perfilError;
      }

      console.log(`📋 Perfil encontrado: ${perfil.nome} (código: ${perfil.codigo})`);

      // Buscar todos os usuários que têm este perfil (por código ou nome)
      const { data: usuarios, error: usuariosError } = await supabase
        .from('usuarios')
        .select('id, nome, nivel_acesso')
        .or(`nivel_acesso.eq.${perfil.codigo},nivel_acesso.eq.${perfil.nome}`)
        .eq('status', 'ativo');

      if (usuariosError) {
        console.error('❌ Erro ao buscar usuários do perfil:', usuariosError);
        throw usuariosError;
      }

      if (!usuarios || usuarios.length === 0) {
        console.log(`ℹ️ Nenhum usuário ativo encontrado para o perfil ${perfil.nome} (${perfil.codigo})`);
        return;
      }

      console.log(`👥 Encontrados ${usuarios.length} usuários para remover permissões:`, usuarios.map(u => `${u.nome} (${u.nivel_acesso})`));

      let funcionalidadesParaRemover: string[];

      if (funcionalidadesIds && funcionalidadesIds.length > 0) {
        // Se permissões específicas foram fornecidas, usar essas
        console.log(`📋 Usando permissões específicas fornecidas: ${funcionalidadesIds.length} permissões`);
        funcionalidadesParaRemover = funcionalidadesIds;
      } else {
        // Buscar TODAS as permissões padrão do perfil (tanto concedidas quanto negadas)
        const { data: todasPermissoesPerfil, error: funcError } = await supabase
          .from('perfil_funcionalidades_padrao')
          .select('funcionalidade_id, concedido')
          .eq('perfil_id', perfilId);

        if (funcError) {
          console.error('❌ Erro ao buscar permissões do perfil:', funcError);
          throw funcError;
        }

        if (!todasPermissoesPerfil || todasPermissoesPerfil.length === 0) {
          console.log(`ℹ️ Nenhuma permissão encontrada para o perfil ${perfilId}`);
          return;
        }

        // Filtrar apenas as permissões que estão marcadas como NEGADAS (concedido = false)
        const perfilFuncionalidadesRemovidas = todasPermissoesPerfil.filter(p => p.concedido === false);
        
        console.log(`📋 Total de permissões do perfil: ${todasPermissoesPerfil.length}`);
        console.log(`📋 Permissões concedidas: ${todasPermissoesPerfil.filter(p => p.concedido === true).length}`);
        console.log(`📋 Permissões negadas (para remover): ${perfilFuncionalidadesRemovidas.length}`);

        if (perfilFuncionalidadesRemovidas.length === 0) {
          console.log(`ℹ️ Nenhuma permissão negada encontrada para remover do perfil ${perfilId}`);
          return;
        }

        funcionalidadesParaRemover = perfilFuncionalidadesRemovidas.map(pf => pf.funcionalidade_id);
      }

      // Remover permissões de todos os usuários em lotes menores para evitar URLs muito longas
      const usuariosIds = usuarios.map(u => u.id);

      console.log(`🔄 Removendo ${funcionalidadesParaRemover.length} permissões de ${usuariosIds.length} usuários em lotes...`);

      // Primeiro, verificar se existem permissões para remover
      console.log(`🔍 Verificando se existem permissões para remover...`);
      const { data: permissoesExistentes, error: checkError } = await supabase
        .from('usuario_permissoes_modulares')
        .select('id, usuario_id, funcionalidade_id, motivo')
        .in('usuario_id', usuariosIds.slice(0, 5)) // Verificar apenas os primeiros 5 usuários como amostra
        .in('funcionalidade_id', funcionalidadesParaRemover.slice(0, 5)) // Verificar apenas as primeiras 5 funcionalidades como amostra
        .eq('tipo_permissao', 'adicional')
        .like('motivo', `%Permissão padrão aplicada automaticamente do perfil ${perfil.nome}%`)
        .limit(10);

      if (checkError) {
        console.error('❌ Erro ao verificar permissões existentes:', checkError);
      } else {
        console.log(`📊 Amostra de permissões encontradas para remoção: ${permissoesExistentes?.length || 0}`);
        if (permissoesExistentes && permissoesExistentes.length > 0) {
          console.log(`📋 Exemplos de permissões encontradas:`, permissoesExistentes.map(p => ({
            usuario_id: p.usuario_id,
            funcionalidade_id: p.funcionalidade_id,
            motivo: p.motivo
          })));
        } else {
          console.log(`⚠️ Nenhuma permissão encontrada para remover! Verifique se as permissões foram aplicadas corretamente.`);
        }
      }

      // Dividir em lotes menores (máximo 50 usuários por vez)
      const batchSize = 50;
      let totalRemovidas = 0;

      for (let i = 0; i < usuariosIds.length; i += batchSize) {
        const batchUsuarios = usuariosIds.slice(i, i + batchSize);
        
        console.log(`🔄 Processando lote ${Math.floor(i/batchSize) + 1}/${Math.ceil(usuariosIds.length/batchSize)} (${batchUsuarios.length} usuários)...`);

        try {
          console.log(`🔍 Removendo permissões do lote ${Math.floor(i/batchSize) + 1}...`);
          console.log(`📋 Usuários do lote: ${batchUsuarios.length}`);
          console.log(`📋 Funcionalidades para remover: ${funcionalidadesParaRemover.length}`);
          console.log(`📋 Motivo da busca: "Permissão padrão aplicada automaticamente do perfil ${perfil.nome}"`);

          const { error: deleteError } = await supabase
            .from('usuario_permissoes_modulares')
            .delete()
            .in('usuario_id', batchUsuarios)
            .in('funcionalidade_id', funcionalidadesParaRemover)
            .eq('tipo_permissao', 'adicional')
            .like('motivo', `%Permissão padrão aplicada automaticamente do perfil ${perfil.nome}%`);

          if (deleteError) {
            console.error(`❌ Erro ao remover permissões do lote ${Math.floor(i/batchSize) + 1}:`, deleteError);
            // Continue com os outros lotes mesmo se um falhar
          } else {
            totalRemovidas += batchUsuarios.length * funcionalidadesParaRemover.length;
            console.log(`✅ Lote ${Math.floor(i/batchSize) + 1} processado com sucesso!`);
            console.log(`📊 Permissões removidas neste lote: ${batchUsuarios.length * funcionalidadesParaRemover.length}`);
          }
        } catch (batchError) {
          console.error(`❌ Erro no lote ${Math.floor(i/batchSize) + 1}:`, batchError);
          // Continue com os outros lotes
        }
      }

      console.log(`✅ Processo concluído! Aproximadamente ${totalRemovidas} permissões removidas de ${usuariosIds.length} usuários!`);
    } catch (error) {
      console.error('❌ Erro em removeProfileDefaultPermissionsFromAllUsers:', error);
      throw error;
    }
  }

  async updatePerfilAcesso(perfilId: string, ativo: boolean): Promise<void> {
    try {
      console.log(`🔄 Atualizando perfil ${perfilId} para ${ativo ? 'ATIVO' : 'INATIVO'}`);
      
      const { error } = await supabase
        .from('perfis_acesso')
        .update({ ativo })
        .eq('id', perfilId);

      if (error) {
        console.error('❌ Erro ao atualizar perfil:', error);
        throw error;
      }
      
      console.log(`✅ Perfil ${perfilId} atualizado com sucesso!`);

      // Se o perfil foi ativado, aplicar permissões padrão a todos os usuários deste perfil
      if (ativo) {
        console.log(`🔄 Aplicando permissões padrão a todos os usuários do perfil ${perfilId}...`);
        try {
          await this.applyProfileDefaultPermissionsToAllUsers(perfilId, 'sistema');
          console.log(`✅ Permissões padrão aplicadas a todos os usuários do perfil ${perfilId}!`);
        } catch (applyError) {
          console.warn(`⚠️ Erro ao aplicar permissões padrão aos usuários:`, applyError);
          // Não falha a operação principal se a aplicação de permissões falhar
        }
      }
    } catch (error) {
      console.error('❌ Erro em updatePerfilAcesso:', error);
      throw error;
    }
  }

  // ============================================================================
  // PERMISSÕES MODULARES DE USUÁRIO
  // ============================================================================

  async getUserPermissionsModulares(userId: string): Promise<UsuarioPermissaoModular[]> {
    const { data, error } = await supabase
      .from('usuario_permissoes_modulares')
      .select(`
        *,
        funcionalidade:funcionalidades_modulares(
          *,
          modulo:modulos_sistema(*),
          plataforma:plataformas(*)
        )
      `)
      .eq('usuario_id', userId)
      .eq('ativo', true);

    if (error) throw error;
    return data || [];
  }

  async getAllUsuarioPermissoesModulares(): Promise<UsuarioPermissaoModular[]> {
    try {
      console.log('🔍 Buscando todas as permissões modulares de usuários...');
      
      // Primeiro, buscar apenas os dados básicos sem relacionamentos complexos
      const { data, error } = await supabase
        .from('usuario_permissoes_modulares')
        .select('*')
        .eq('ativo', true);

      if (error) {
        console.error('❌ Erro ao buscar permissões modulares de usuários:', error);
        throw error;
      }
      
      console.log(`✅ Permissões modulares de usuários encontradas: ${data?.length || 0}`);
      
      // Se não há dados, retornar array vazio
      if (!data || data.length === 0) {
        console.log('ℹ️ Nenhuma permissão modular de usuário encontrada (isso é normal se não há usuários com permissões personalizadas)');
        return [];
      }
      
      return data;
    } catch (error) {
      console.error('❌ Erro em getAllUsuarioPermissoesModulares:', error);
      return [];
    }
  }

  async grantUserPermissionModular(permission: Omit<UsuarioPermissaoModular, 'id' | 'criado_em' | 'atualizado_em'>): Promise<UsuarioPermissaoModular> {
    console.log('🔐 Concedendo permissão modular:', {
      usuario_id: permission.usuario_id,
      funcionalidade_id: permission.funcionalidade_id,
      concedido: permission.concedido,
      tipo_permissao: permission.tipo_permissao
    });

    console.log('🔍 Dados completos da permissão:', permission);

    const { data, error } = await supabase
      .from('usuario_permissoes_modulares')
      .upsert(permission, {
        onConflict: 'usuario_id,funcionalidade_id',
        ignoreDuplicates: false // Atualizar se já existir
      })
      .select()
      .single();

    if (error) {
      console.error('❌ Erro ao conceder permissão modular:', error);
      console.error('❌ Detalhes do erro:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      });
      throw error;
    }

    console.log('✅ Permissão modular concedida/atualizada com sucesso:', data);
    return data;
  }

  async revokeUserPermissionModular(userId: string, funcionalidadeId: string): Promise<void> {
    console.log('🗑️ Revogando permissão modular:', {
      usuario_id: userId,
      funcionalidade_id: funcionalidadeId
    });

    // ✅ CORREÇÃO: Marcar como concedido: false e ativo: false (não deletar)
    const { error } = await supabase
      .from('usuario_permissoes_modulares')
      .update({ 
        concedido: false, 
        ativo: false,
        motivo: 'REMOVIDO VIA INTERFACE - ' + new Date().toISOString()
      })
      .eq('usuario_id', userId)
      .eq('funcionalidade_id', funcionalidadeId);

    if (error) {
      console.error('❌ Erro ao revogar permissão modular:', error);
      throw error;
    }

    console.log('✅ Permissão modular revogada (concedido: false, ativo: false)');
  }

  // Método adicional para forçar deleção completa de permissões
  async forceDeleteUserPermissionModular(userId: string, funcionalidadeId: string): Promise<void> {
    console.log('💥 FORÇANDO deleção de permissão modular:', {
      usuario_id: userId,
      funcionalidade_id: funcionalidadeId
    });

    try {
      // Tentar múltiplas abordagens para garantir a deleção
      
      // Abordagem 1: Delete direto
      const { data: deleteData, error: deleteError } = await supabase
        .from('usuario_permissoes_modulares')
        .delete()
        .eq('usuario_id', userId)
        .eq('funcionalidade_id', funcionalidadeId)
        .select();

      if (deleteError) {
        console.error('❌ Erro na abordagem 1 (delete direto):', deleteError);
      } else {
        console.log('✅ Abordagem 1 bem-sucedida - registros deletados:', deleteData?.length || 0);
        return;
      }

      // Abordagem 2: Delete por ID específico
      const { data: findData, error: findError } = await supabase
        .from('usuario_permissoes_modulares')
        .select('id')
        .eq('usuario_id', userId)
        .eq('funcionalidade_id', funcionalidadeId);

      if (!findError && findData && findData.length > 0) {
        for (const record of findData) {
          const { error: deleteByIdError } = await supabase
            .from('usuario_permissoes_modulares')
            .delete()
            .eq('id', record.id);

          if (deleteByIdError) {
            console.error(`❌ Erro ao deletar por ID ${record.id}:`, deleteByIdError);
          } else {
            console.log(`✅ Registro ${record.id} deletado com sucesso`);
          }
        }
        return;
      }

      // Abordagem 3: Marcar como completamente removido
      console.log('🔄 Usando abordagem 3: marcar como removido');
      const { error: updateError } = await supabase
        .from('usuario_permissoes_modulares')
        .update({ 
          ativo: false, 
          concedido: false,
          motivo: 'FORÇADO A REMOVER - ' + new Date().toISOString(),
          data_fim: new Date().toISOString()
        })
        .eq('usuario_id', userId)
        .eq('funcionalidade_id', funcionalidadeId);

      if (updateError) {
        console.error('❌ Erro na abordagem 3:', updateError);
        throw updateError;
      } else {
        console.log('✅ Registro marcado como removido via abordagem 3');
      }

    } catch (error) {
      console.error('❌ Erro completo ao forçar deleção:', error);
      throw error;
    }
  }

  async updateUserPermissionModular(
    userId: string, 
    funcionalidadeId: string, 
    updates: Partial<UsuarioPermissaoModular>
  ): Promise<UsuarioPermissaoModular> {
    const { data, error } = await supabase
      .from('usuario_permissoes_modulares')
      .update(updates)
      .eq('usuario_id', userId)
      .eq('funcionalidade_id', funcionalidadeId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // ============================================================================
  // VERIFICAÇÃO DE PERMISSÕES MODULARES
  // ============================================================================

  async checkUserPermissionModular(userId: string, funcionalidadeCodigo: string): Promise<boolean> {
    // Verificar se há permissão personalizada
    const { data: customPermission, error: customError } = await supabase
      .from('usuario_permissoes_modulares')
      .select('concedido')
      .eq('usuario_id', userId)
      .eq('funcionalidade_id', (
        await supabase
          .from('funcionalidades_modulares')
          .select('id')
          .eq('codigo', funcionalidadeCodigo)
          .eq('ativa', true)
          .single()
      ).data?.id)
      .eq('ativo', true)
      .single();

    if (!customError && customPermission) {
      return customPermission.concedido;
    }

    // Se não há permissão personalizada, verificar perfil padrão
    const { data: user } = await supabase
      .from('usuarios')
      .select('nivel_acesso')
      .eq('id', userId)
      .single();

    if (!user) return false;

    // Verificar perfil padrão
    const { data: perfilPadrao, error: perfilError } = await supabase
      .from('perfil_funcionalidades_padrao')
      .select('concedido')
      .eq('perfil_id', (
        await supabase
          .from('perfis_acesso')
          .select('id')
          .eq('codigo', user.nivel_acesso)
          .eq('ativo', true)
          .single()
      ).data?.id)
      .eq('funcionalidade_id', (
        await supabase
          .from('funcionalidades_modulares')
          .select('id')
          .eq('codigo', funcionalidadeCodigo)
          .eq('ativa', true)
          .single()
      ).data?.id)
      .single();

    if (!perfilError && perfilPadrao) {
      return perfilPadrao.concedido;
    }

    return false;
  }

  // ============================================================================
  // GRUPOS DE PERMISSÕES MODULARES
  // ============================================================================

  async getGruposPermissoesModulares(): Promise<GrupoPermissoesModulares[]> {
    // Funcionalidade desabilitada - retorna array vazio
    console.log('ℹ️ Funcionalidade de grupos de permissões modulares desabilitada');
    return [];
  }

  async createGrupoPermissaoModular(): Promise<GrupoPermissoesModulares> {
    // Funcionalidade desabilitada - lança erro informativo
    throw new Error('Funcionalidade de grupos de permissões modulares está desabilitada');
  }

  // ============================================================================
  // PERFIL FUNCIONALIDADES PADRÃO
  // ============================================================================

  async getPerfilFuncionalidadesPadrao(): Promise<PerfilFuncionalidadesPadrao[]> {
    try {
      console.log('🔍 Buscando perfil funcionalidades padrão...');
      
      // Buscar apenas os dados básicos sem relacionamentos complexos
      const { data, error } = await supabase
        .from('perfil_funcionalidades_padrao')
        .select('*')
        .order('perfil_id')
        .order('funcionalidade_id');

      if (error) {
        console.error('❌ Erro ao buscar perfil funcionalidades padrão:', error);
        throw error;
      }
      
      console.log(`✅ Perfil funcionalidades padrão encontradas: ${data?.length || 0}`);
      
      // Se não há dados, retornar array vazio
      if (!data || data.length === 0) {
        console.log('ℹ️ Nenhuma perfil funcionalidade padrão encontrada');
        return [];
      }
      
      return data;
    } catch (error) {
      console.error('❌ Erro em getPerfilFuncionalidadesPadrao:', error);
      return [];
    }
  }

  async updatePerfilFuncionalidadesPadrao(
    perfilId: string,
    funcionalidadeId: string,
    concedido: boolean
  ): Promise<void> {
    const { error } = await supabase
      .from('perfil_funcionalidades_padrao')
      .upsert({
        perfil_id: perfilId,
        funcionalidade_id: funcionalidadeId,
        concedido
      }, {
        onConflict: 'perfil_id,funcionalidade_id'
      });

    if (error) throw error;
  }

  async createPerfilFuncionalidadesPadrao(
    perfilId: string,
    funcionalidadeId: string,
    concedido: boolean
  ): Promise<void> {
    const { error } = await supabase
      .from('perfil_funcionalidades_padrao')
      .insert({
        perfil_id: perfilId,
        funcionalidade_id: funcionalidadeId,
        concedido
      });

    if (error) throw error;
  }

  // ============================================================================
  // APLICAR TEMPLATES/COMBOS MODULARES
  // ============================================================================

  async applyModularPermissionTemplate(userId: string, templateId: string, createdBy: string): Promise<void> {
    // Buscar funcionalidades do template
    const { data: grupoFuncionalidades, error } = await supabase
      .from('grupo_funcionalidades_modulares')
      .select('funcionalidade_id')
      .eq('grupo_id', templateId);

    if (error) throw error;

    // Aplicar cada permissão
    const permissions = grupoFuncionalidades?.map(gf => ({
      usuario_id: userId,
      funcionalidade_id: gf.funcionalidade_id,
      concedido: true,
      tipo_permissao: 'adicional' as const,
      motivo: `Aplicado template/combo de permissões modulares`,
      concedido_por: createdBy,
      data_inicio: new Date().toISOString(),
      ativo: true,
      temporaria: false
    })) || [];

    if (permissions.length > 0) {
      const { error: insertError } = await supabase
        .from('usuario_permissoes_modulares')
        .insert(permissions);

      if (insertError) throw insertError;
    }

    // Marcar usuário como tendo permissões personalizadas
    await supabase
      .from('usuarios')
      .update({ permissoes_personalizadas: true })
      .eq('id', userId);
  }

  // ============================================================================
  // DEBUG E VALIDAÇÃO
  // ============================================================================

  async debugFuncionalidadesModulares(): Promise<{
    total: number;
    validas: number;
    invalidas: Record<string, unknown>[];
    exemplos: Record<string, unknown>[];
  }> {
    try {
      console.log('🔍 DEBUG: Analisando funcionalidades modulares...');
      
      const { data, error } = await supabase
        .from('funcionalidades_modulares')
        .select('*')
        .eq('ativa', true)
        .order('ordem');

      if (error) {
        console.error('❌ Erro ao buscar funcionalidades para debug:', error);
        throw error;
      }

      const total = data?.length || 0;
      const validas = data?.filter(f => f && f.id && f.nome && f.codigo)?.length || 0;
      const invalidas = data?.filter(f => !f || !f.id || !f.nome || !f.codigo) || [];
      const exemplos = data?.slice(0, 3) || [];

      console.log('📊 DEBUG - Funcionalidades Modulares:', {
        total,
        validas,
        invalidas: invalidas.length,
        exemplos
      });

      if (invalidas.length > 0) {
        console.warn('⚠️ Funcionalidades inválidas encontradas:', invalidas);
      }

      return {
        total,
        validas,
        invalidas,
        exemplos
      };
    } catch (error) {
      console.error('❌ Erro em debugFuncionalidadesModulares:', error);
      return {
        total: 0,
        validas: 0,
        invalidas: [],
        exemplos: []
      };
    }
  }

  async getModularPermissionsStats(): Promise<{
    totalFuncionalidadesModulares: number;
    totalUsuariosComPermissoesModulares: number;
    permissoesPorModulo: {[modulo: string]: number};
    permissoesPorPlataforma: {[plataforma: string]: number};
    usuariosMaisPermissoesModulares: {nome: string; total: number}[];
  }> {
    // Total de funcionalidades modulares ativas
    const { count: totalFuncionalidadesModulares } = await supabase
      .from('funcionalidades_modulares')
      .select('*', { count: 'exact', head: true })
      .eq('ativa', true);

    // Total de usuários com permissões modulares personalizadas
    const { count: totalUsuariosComPermissoesModulares } = await supabase
      .from('usuarios')
      .select('*', { count: 'exact', head: true })
      .eq('permissoes_personalizadas', true);

    // Permissões por módulo
    const { data: funcionalidadesModulos } = await supabase
      .from('funcionalidades_modulares')
      .select(`
        modulo:modulos_sistema(nome)
      `)
      .eq('ativa', true);

    const permissoesPorModulo: {[modulo: string]: number} = {};
    funcionalidadesModulos?.forEach(f => {
      const modulo = (f.modulo as { nome?: string })?.nome || 'N/A';
      permissoesPorModulo[modulo] = (permissoesPorModulo[modulo] || 0) + 1;
    });

    // Permissões por plataforma
    const { data: funcionalidadesPlataformas } = await supabase
      .from('funcionalidades_modulares')
      .select(`
        plataforma:plataformas(nome)
      `)
      .eq('ativa', true);

    const permissoesPorPlataforma: {[plataforma: string]: number} = {};
    funcionalidadesPlataformas?.forEach(f => {
      const plataforma = (f.plataforma as { nome?: string })?.nome || 'N/A';
      permissoesPorPlataforma[plataforma] = (permissoesPorPlataforma[plataforma] || 0) + 1;
    });

    // Usuários com mais permissões modulares
    const { data: usuariosPermissoesModulares } = await supabase
      .from('usuario_permissoes_modulares')
      .select(`
        usuario_id,
        usuario:usuarios!usuario_permissoes_modulares_usuario_id_fkey(nome)
      `)
      .eq('ativo', true)
      .eq('concedido', true);

    const permissoesPorUsuario: {[userId: string]: {nome: string; total: number}} = {};
    usuariosPermissoesModulares?.forEach(up => {
      const userId = up.usuario_id;
      if (!permissoesPorUsuario[userId]) {
        permissoesPorUsuario[userId] = {
          nome: (up.usuario as { nome?: string })?.nome || 'N/A',
          total: 0
        };
      }
      permissoesPorUsuario[userId].total++;
    });

    const usuariosMaisPermissoesModulares = Object.values(permissoesPorUsuario)
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);

    return {
      totalFuncionalidadesModulares: totalFuncionalidadesModulares || 0,
      totalUsuariosComPermissoesModulares: totalUsuariosComPermissoesModulares || 0,
      permissoesPorModulo,
      permissoesPorPlataforma,
      usuariosMaisPermissoesModulares
    };
  }
}

export const modularPermissionService = new ModularPermissionService();

