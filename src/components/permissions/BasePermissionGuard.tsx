'use client'

import React from 'react'
import { useUnifiedPermissions } from '@/hooks/useUnifiedPermissions'
import { useAuth } from '@/contexts/AuthContext'
import { Loader2, AlertTriangle } from 'lucide-react'

interface BasePermissionGuardProps {
  baseId: string | 'todos' // 'todos' means all permitted bases
  requiredAccessType?: 'total' | 'restrito' | 'leitura'
  children: React.ReactNode
  fallback?: React.ReactNode
}

export default function BasePermissionGuard({
  baseId,
  requiredAccessType = 'leitura', // Default to 'leitura' if not specified
  children,
  fallback = (
    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md flex items-center gap-2">
      <AlertTriangle className="h-5 w-5" />
      <span>Você não tem permissão para acessar esta funcionalidade ou base.</span>
    </div>
  ),
}: BasePermissionGuardProps) {
  const { user, loading: authLoading } = useAuth()
  const { hasBaseAccess, getBaseAccessType, loading: permissionsLoading } = useUnifiedPermissions()

  if (authLoading || permissionsLoading) {
    return (
      <div className="flex items-center justify-center p-4">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        <span>Verificando permissões...</span>
      </div>
    )
  }

  if (!user) {
    return fallback
  }

  // If 'todos' is selected, check if user has access to ANY base
  if (baseId === 'todos') {
    // For 'todos', we assume if they have access to any base, they can view aggregated data
    // More granular control for 'todos' would need to be handled by filtering the data itself
    // This guard primarily checks if they have *any* base access for the module
    const hasAnyBaseAccess = user.bases && user.bases.length > 0;
    if (!hasAnyBaseAccess) {
      return fallback;
    }
    // For 'todos', we don't apply requiredAccessType at the guard level,
    // as it's an aggregation. Individual actions on specific bases will be guarded.
    return <>{children}</>;
  }

  // Check access for a specific base
  if (!hasBaseAccess(baseId)) {
    return fallback
  }

  // Check access type for the specific base
  const actualAccessType = getBaseAccessType(baseId)

  const accessLevels = {
    leitura: 0,
    restrito: 1,
    total: 2,
  }

  if (actualAccessType === null || accessLevels[actualAccessType] < accessLevels[requiredAccessType]) {
    return fallback
  }

  return <>{children}</>
}