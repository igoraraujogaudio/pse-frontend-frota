"use client";

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useModularPermissions, PERMISSION_CODES } from '@/hooks/useModularPermissions';
import PasswordControlPanel from '@/components/admin/PasswordControlPanel';

export default function AdminPasswordControlPage() {
  const { user, loading } = useAuth();
  const { hasPermission, loading: permissionsLoading, permissionsLoaded } = useModularPermissions();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
      return;
    }

    // Aguardar carregamento das permissões antes de verificar
    if (!loading && !permissionsLoading && permissionsLoaded && user && !hasPermission(PERMISSION_CODES.CONFIGURACOES.GERENCIAR_USUARIOS)) {
      router.push('/dashboard');
    }
  }, [user, loading, router, hasPermission, permissionsLoading, permissionsLoaded]);

  // Mostrar loading enquanto autenticação ou permissões estão carregando
  if (loading || permissionsLoading || !permissionsLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando permissões...</p>
        </div>
      </div>
    );
  }

  // Verificar permissão após carregamento
  if (!user || !hasPermission(PERMISSION_CODES.CONFIGURACOES.GERENCIAR_USUARIOS)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Acesso Negado</h2>
          <p className="text-gray-600 mb-4">Você não tem permissão para acessar esta página.</p>
          <button
            onClick={() => router.push('/dashboard')}
            className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 transition-colors"
          >
            Voltar ao Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Controle de Mudança de Senha</h1>
          <p className="mt-2 text-gray-600">
            Gerencie a obrigatoriedade de mudança de senha para usuários do sistema.
          </p>
        </div>

        <PasswordControlPanel />
      </div>
    </div>
  );
}
