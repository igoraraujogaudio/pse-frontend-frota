'use client';

import { useModularPermissions } from '@/hooks/useModularPermissions';

interface PermissionGuardProps {
  codigo?: string;
  codigos?: string[];
  requireAll?: boolean;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Componente para proteger conteúdo baseado em permissões
 * 
 * @example
 * // Verificar uma permissão específica
 * <PermissionGuard codigo="frota.criar_veiculo">
 *   <Button>Criar Veículo</Button>
 * </PermissionGuard>
 * 
 * @example
 * // Verificar múltiplas permissões (pelo menos uma)
 * <PermissionGuard codigos={["frota.editar_veiculo", "frota.criar_veiculo"]}>
 *   <Button>Gerenciar Veículos</Button>
 * </PermissionGuard>
 * 
 * @example
 * // Verificar múltiplas permissões (todas obrigatórias)
 * <PermissionGuard 
 *   codigos={["frota.editar_veiculo", "frota.aprovar_manutencao"]} 
 *   requireAll={true}
 * >
 *   <Button>Aprovar e Editar</Button>
 * </PermissionGuard>
 * 
 * @example
 * // Com fallback personalizado
 * <PermissionGuard 
 *   codigo="usuarios.criar"
 *   fallback={<div>Você não tem permissão para criar usuários</div>}
 * >
 *   <CreateUserForm />
 * </PermissionGuard>
 */
export default function PermissionGuard({
  codigo,
  codigos,
  requireAll = false,
  fallback = null,
  children
}: PermissionGuardProps) {
  const { hasPermission, hasAnyPermission, hasAllPermissions, loading, permissionsLoaded } = useModularPermissions();

  // Se ainda está carregando, mostrar skeleton loading para melhor UX
  if (loading && !permissionsLoaded) {
    return (
      <div className="animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-24"></div>
      </div>
    );
  }

  let hasAccess = false;

  if (codigo) {
    // Verificar uma permissão específica
    hasAccess = hasPermission(codigo);
  } else if (codigos && codigos.length > 0) {
    // Verificar múltiplas permissões
    if (requireAll) {
      hasAccess = hasAllPermissions(codigos);
    } else {
      hasAccess = hasAnyPermission(codigos);
    }
  } else {
    // Se não foi fornecido nem codigo nem codigos, permitir acesso
    hasAccess = true;
  }

  if (hasAccess) {
    return <>{children}</>;
  }

  return <>{fallback}</>;
}

// Componente para uso em casos mais específicos
export function PermissionCheck({ 
  codigo, 
  children 
}: { 
  codigo: string; 
  children: (hasPermission: boolean) => React.ReactNode;
}) {
  const { hasPermission, loading, permissionsLoaded } = useModularPermissions();

  if (loading && !permissionsLoaded) {
    return (
      <div className="animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-24"></div>
      </div>
    );
  }

  return <>{children(hasPermission(codigo))}</>;
}

// Componente otimizado para múltiplas permissões - evita carregamento em fila
export function MultiplePermissionGuard({
  permissions,
  requireAll = false,
  fallback = null,
  children
}: {
  permissions: string[];
  requireAll?: boolean;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}) {
  const { checkMultiplePermissions, loading, permissionsLoaded } = useModularPermissions();

  // Se ainda está carregando, mostrar skeleton loading
  if (loading && !permissionsLoaded) {
    return (
      <div className="animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-24"></div>
      </div>
    );
  }

  // Verificar todas as permissões de uma vez
  const permissionResults = checkMultiplePermissions(permissions);
  
  let hasAccess = false;
  if (requireAll) {
    hasAccess = Array.from(permissionResults.values()).every(result => result);
  } else {
    hasAccess = Array.from(permissionResults.values()).some(result => result);
  }

  if (hasAccess) {
    return <>{children}</>;
  }

  return <>{fallback}</>;
}

// HOC para proteger páginas inteiras
export function withPermissions<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  requiredPermissions: string[],
  options?: {
    requireAll?: boolean;
    fallback?: React.ComponentType;
  }
) {
  const { requireAll = false, fallback: FallbackComponent } = options || {};

  return function PermissionWrappedComponent(props: P) {
    const { hasAnyPermission, hasAllPermissions, loading } = useModularPermissions();

    if (loading) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      );
    }

    const hasAccess = requireAll 
      ? hasAllPermissions(requiredPermissions)
      : hasAnyPermission(requiredPermissions);

    if (!hasAccess) {
      if (FallbackComponent) {
        return <FallbackComponent />;
      }

      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Acesso Restrito</h2>
            <p className="text-gray-600 mb-4">
              Você não tem permissão para acessar esta página.
            </p>
            <p className="text-sm text-gray-500">
              Permissões necessárias: {requiredPermissions.join(', ')}
            </p>
          </div>
        </div>
      );
    }

    return <WrappedComponent {...props} />;
  };
}