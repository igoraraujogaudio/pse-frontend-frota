import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { permissionService } from '@/services/permissionService';
import { contratoService } from '@/services/contratoService';
import { baseService } from '@/services/baseService';
import type { 
  UsuarioFuncionalidade, 
  Funcionalidade,
  UseUnifiedPermissionsReturn 
} from '@/types/permissions';
import type { UsuarioContrato, UsuarioBase } from '@/types/contratos';

/**
 * Hook unificado para gerenciar todas as permissões do sistema
 * Consolida o sistema antigo (nivel_acesso) com o novo (funcionalidades modulares)
 */
export function useUnifiedPermissions(): UseUnifiedPermissionsReturn {
  const { user, loading: authLoading } = useAuth();
  
  // Estados
  const [userPermissions, setUserPermissions] = useState<UsuarioFuncionalidade[]>([]);
  const [funcionalidades, setFuncionalidades] = useState<Funcionalidade[]>([]);
  const [userContratos, setUserContratos] = useState<UsuarioContrato[]>([]);
  const [userBases, setUserBases] = useState<UsuarioBase[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cache de permissões para performance (useRef evita re-render ao setar cache)
  const permissionCacheRef = useRef<Map<string, boolean>>(new Map());

  // Hierarquia de níveis de acesso (índices menores = mais permissões)
  const ACCESS_HIERARCHY = useMemo(() => [
    'admin', 'diretor', 'manager', 'gerente', 'gestor_frota', 
    'gestor', 'gestor_almoxarifado', 'coordenador', 'eng_seguranca', 'supervisor', 
    'tst', 'rh', 'portaria', 'almoxarifado', 'operacao'
  ], []);

  // Carregar dados do usuário
  const loadUserData = useCallback(async () => {
    if (!user?.id || authLoading) return;

    setLoading(true);
    setError(null);

    try {
      const [contratos, bases] = await Promise.all([
        contratoService.getUserContratos(user.id),
        baseService.getUserBases(user.id)
      ]);

      setUserPermissions([]);
      setFuncionalidades([]);
      setUserContratos(contratos);
      setUserBases(bases);
      permissionCacheRef.current.clear();

    } catch (err) {
      console.error('Erro ao carregar permissões:', err);
      setError('Erro ao carregar permissões do usuário');
    } finally {
      setLoading(false);
    }
  }, [user?.id, authLoading]);

  // Carregar dados quando usuário muda
  useEffect(() => {
    loadUserData();
  }, [loadUserData]);

  // Verificar permissão baseada na hierarquia (sistema antigo)
  const checkHierarchyPermission = useCallback((userLevel: string, requiredLevel: string): boolean => {
    const userIndex = ACCESS_HIERARCHY.indexOf(userLevel);
    const requiredIndex = ACCESS_HIERARCHY.indexOf(requiredLevel);
    
    if (userIndex === -1 || requiredIndex === -1) return false;
    return userIndex <= requiredIndex;
  }, [ACCESS_HIERARCHY]);


  // Função principal para verificar permissões (unificada)
  const hasPermission = useCallback((codigo: string): boolean => {
    if (!user) return false;

    // Verificar cache primeiro
    if (permissionCacheRef.current.has(codigo)) {
      return permissionCacheRef.current.get(codigo)!;
    }

    let result = false;

    try {
      // Admin e Diretor têm acesso total
      if (['admin', 'diretor'].includes(user.nivel_acesso)) {
        result = true;
      } else {
        // Verificar se há permissão explícita na tabela usuario_permissoes_modulares
        // Sem registro = sem acesso. Não existe "inerente" nem "nivel_minimo".
        const permission = userPermissions.find(p => 
          p.funcionalidade?.codigo === codigo && 
          p.ativo &&
          (!p.data_fim || new Date(p.data_fim) >= new Date())
        );

        result = permission ? permission.concedido : false;
      }
    } catch (err) {
      console.error('Erro ao verificar permissão:', err);
      result = false;
    }

    // Salvar no cache
    permissionCacheRef.current.set(codigo, result);
    return result;
  }, [user, userPermissions]);

  // Verificar se tem pelo menos uma das permissões
  const hasAnyPermission = useCallback((codigos: string[]): boolean => {
    return codigos.some(codigo => hasPermission(codigo));
  }, [hasPermission]);

  // Verificar se tem todas as permissões
  const hasAllPermissions = useCallback((codigos: string[]): boolean => {
    return codigos.every(codigo => hasPermission(codigo));
  }, [hasPermission]);

  // Verificar permissão via API (para casos especiais)
  const checkPermission = useCallback(async (codigo: string): Promise<boolean> => {
    if (!user?.id) return false;

    try {
      const result = await permissionService.checkUserPermission(user.id, codigo);
      
      permissionCacheRef.current.set(codigo, result);
      return result;
    } catch (err) {
      console.error('Erro ao verificar permissão via API:', err);
      return false;
    }
  }, [user?.id]);

  // Verificar acesso por nível (sistema antigo)
  const hasAccessLevel = useCallback((requiredLevel: string): boolean => {
    if (!user) return false;
    return checkHierarchyPermission(user.nivel_acesso, requiredLevel);
  }, [user, checkHierarchyPermission]);

  // Verificar se usuário tem acesso a um contrato específico
  const hasContratoAccess = useCallback((contratoId: string): boolean => {
    // Admin e Diretor têm acesso a todos os contratos
    if (user && ['admin', 'diretor'].includes(user.nivel_acesso)) {
      return true;
    }
    return userContratos.some(uc => 
      uc.contrato_id === contratoId && 
      uc.ativo &&
      (!uc.data_fim || new Date(uc.data_fim) >= new Date())
    );
  }, [user, userContratos]);

  // Verificar se usuário tem acesso a uma base específica
  const hasBaseAccess = useCallback((baseId: string): boolean => {
    // Admin e Diretor têm acesso a todas as bases
    if (user && ['admin', 'diretor'].includes(user.nivel_acesso)) {
      return true;
    }
    return userBases.some(ub => 
      ub.base_id === baseId && 
      ub.ativo &&
      (!ub.data_fim || new Date(ub.data_fim) >= new Date())
    );
  }, [user, userBases]);

  // Obter tipo de acesso a uma base
  const getBaseAccessType = useCallback((baseId: string): 'total' | 'restrito' | 'leitura' | null => {
    // Admin e Diretor têm acesso total a todas as bases
    if (user && ['admin', 'diretor'].includes(user.nivel_acesso)) {
      return 'total';
    }
    const baseAccess = userBases.find(ub => 
      ub.base_id === baseId && 
      ub.ativo &&
      (!ub.data_fim || new Date(ub.data_fim) >= new Date())
    );
    
    return baseAccess?.tipo_acesso || null;
  }, [user, userBases]);

  // Filtrar apenas permissões personalizadas (não padrão)
  const customPermissions = userPermissions.filter(p => 
    p.tipo_permissao === 'adicional' || p.tipo_permissao === 'restricao'
  );

  // Função para recarregar permissões
  const refreshPermissions = useCallback(async () => {
    permissionCacheRef.current.clear();
    await loadUserData();
  }, [loadUserData]);

  // Obter estatísticas das permissões do usuário
  const getPermissionStats = useCallback(() => {
    const totalCustom = customPermissions.length;
    const additionalPermissions = customPermissions.filter(p => p.concedido).length;
    const restrictions = customPermissions.filter(p => !p.concedido).length;
    
    const modulePermissions = customPermissions.reduce((acc, p) => {
      const modulo = p.funcionalidade?.modulo;
      if (modulo) {
        acc[modulo] = (acc[modulo] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);

    return {
      totalCustom,
      additionalPermissions,
      restrictions,
      modulePermissions,
      hasCustomPermissions: user?.permissoes_personalizadas || false,
      userLevel: user?.nivel_acesso || 'operacao',
      hierarchyIndex: ACCESS_HIERARCHY.indexOf(user?.nivel_acesso || 'operacao')
    };
  }, [customPermissions, user?.permissoes_personalizadas, user?.nivel_acesso, ACCESS_HIERARCHY]);

  // Verificar se pode gerenciar outro usuário
  const canManageUser = useCallback((targetUserLevel: string): boolean => {
    if (!user) return false;
    
    // Verificar hierarquia
    return checkHierarchyPermission(user.nivel_acesso, targetUserLevel);
  }, [user, checkHierarchyPermission]);

  return {
    // Verificação de permissões (unificada)
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    checkPermission,
    
    // Verificação por nível (sistema antigo)
    hasAccessLevel,
    canManageUser,
    
    // Dados do usuário
    user,
    userPermissions,
    customPermissions,
    funcionalidades,
    
    // Contratos e bases
    userContratos,
    userBases,
    hasContratoAccess,
    hasBaseAccess,
    getBaseAccessType,
    
    // Estados
    loading: loading || authLoading,
    error,
    
    // Ações
    refreshPermissions,
    
    // Estatísticas e informações
    getPermissionStats,
    
    // Constantes
    ACCESS_HIERARCHY
  };
}

// Hook mais simples para componentes que só precisam verificar permissões
export function usePermissionCheck() {
  const { hasPermission, hasAnyPermission, hasAllPermissions, hasAccessLevel, loading } = useUnifiedPermissions();
  
  return {
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    hasAccessLevel,
    loading
  };
}

// Hook para verificar acesso a contratos e bases
export function useLocationAccess() {
  const { 
    userContratos, 
    userBases, 
    hasContratoAccess, 
    hasBaseAccess, 
    getBaseAccessType,
    loading 
  } = useUnifiedPermissions();
  
  return {
    userContratos,
    userBases,
    hasContratoAccess,
    hasBaseAccess,
    getBaseAccessType,
    loading
  };
}

// Hook para verificação de nível de acesso (compatibilidade)
export function useAccessLevel() {
  const { hasAccessLevel, canManageUser, loading } = useUnifiedPermissions();
  
  return {
    hasAccessLevel,
    canManageUser,
    loading
  };
}

