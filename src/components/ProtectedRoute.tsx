'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useModularPermissions } from '@/hooks/useModularPermissions';

interface ProtectedRouteProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  requiredAccessLevel?: string[];
  requiredPermissions?: string[];
  permission?: string;
}

export default function ProtectedRoute({ children, fallback, requiredAccessLevel, requiredPermissions, permission }: ProtectedRouteProps) { // eslint-disable-line @typescript-eslint/no-unused-vars
  const { user, loading } = useAuth();
  const router = useRouter();
  const { hasAnyPermission, loading: permissionsLoading, permissionsLoaded } = useModularPermissions();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  if (loading || (!permissionsLoaded && permissionsLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) {
    return fallback || (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Acesso Negado</h2>
          <p className="text-gray-600 mb-4">Você precisa estar logado para acessar esta página.</p>
          <button
            onClick={() => router.push('/login')}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
          >
            Fazer Login
          </button>
        </div>
      </div>
    );
  }

  // Verificar nível de acesso se especificado
  if (requiredAccessLevel && requiredAccessLevel.length > 0) {
    const hasRequiredAccess = requiredAccessLevel.includes(user.nivel_acesso);
    if (!hasRequiredAccess) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Acesso Restrito</h2>
            <p className="text-gray-600 mb-4">Você não tem permissão para acessar esta página.</p>
            <button
              onClick={() => router.back()}
              className="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700"
            >
              Voltar
            </button>
          </div>
        </div>
      );
    }
  }

  // Verificar permissões específicas se especificadas
  if (requiredPermissions && requiredPermissions.length > 0) {
    const hasRequiredPermissions = hasAnyPermission(requiredPermissions);
    if (!hasRequiredPermissions) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Acesso Restrito</h2>
            <p className="text-gray-600 mb-4">Você não tem permissão para acessar esta página.</p>
            <p className="text-sm text-gray-500 mb-4">Permissões necessárias: {requiredPermissions.join(', ')}</p>
            <button
              onClick={() => router.back()}
              className="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700"
            >
              Voltar
            </button>
          </div>
        </div>
      );
    }
  }

  return <>{children}</>;
}