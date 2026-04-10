'use client';

import { useVehiclePermissions } from '@/hooks/useVehiclePermissions';

interface VehiclePermissionGuardProps {
  codigo: string;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Componente PermissionGuard otimizado especificamente para veículos
 * Usa cache pré-carregado para renderização instantânea
 */
export function VehiclePermissionGuard({
  codigo,
  fallback = null,
  children
}: VehiclePermissionGuardProps) {
  const { hasVehiclePermission, loading } = useVehiclePermissions();

  // Se ainda está carregando, mostrar skeleton loading
  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-24"></div>
      </div>
    );
  }

  const hasAccess = hasVehiclePermission(codigo);

  if (hasAccess) {
    return <>{children}</>;
  }

  return <>{fallback}</>;
}

/**
 * Componente para múltiplas permissões de veículos
 */
export function MultipleVehiclePermissionGuard({
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
  const { hasAnyVehiclePermission, hasAllVehiclePermissions, loading } = useVehiclePermissions();

  // Se ainda está carregando, mostrar skeleton loading
  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-24"></div>
      </div>
    );
  }

  const hasAccess = requireAll 
    ? hasAllVehiclePermissions(permissions)
    : hasAnyVehiclePermission(permissions);

  if (hasAccess) {
    return <>{children}</>;
  }

  return <>{fallback}</>;
}

/**
 * Componente para verificação de permissão com callback
 */
export function VehiclePermissionCheck({ 
  codigo, 
  children 
}: { 
  codigo: string; 
  children: (hasPermission: boolean) => React.ReactNode;
}) {
  const { hasVehiclePermission, loading } = useVehiclePermissions();

  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-24"></div>
      </div>
    );
  }

  return <>{children(hasVehiclePermission(codigo))}</>;
}
