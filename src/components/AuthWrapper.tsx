'use client';

import { useAuth } from '@/contexts/AuthContext';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import ForcedPasswordChange from './auth/ForcedPasswordChange';

interface AuthWrapperProps {
  children: React.ReactNode;
}

// Rotas que não precisam de autenticação
const publicRoutes = [
  '/login',
  '/forgot-password',
  '/reset-password',
  '/forced-password-change',
  '/apk',
  '/download-apk',
  '/mobile-apk',
  '/play-store',
  '/site',
  '/privacy',
  '/denuncias'
];

export default function AuthWrapper({ children }: AuthWrapperProps) {
  const { user, loading, mustChangePassword } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route));

  useEffect(() => {
    if (!loading && !user && !isPublicRoute) {
      // Salva a rota atual para redirecionar após login
      const redirectUrl = encodeURIComponent(pathname);
      router.push(`/login?redirect=${redirectUrl}`);
    }
  }, [user, loading, isPublicRoute, pathname, router]);

  // Se é rota pública, não mostra loading de autenticação
  if (isPublicRoute) {
    return <>{children}</>;
  }

  // Mostra loading enquanto verifica autenticação
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Verificando autenticação...</p>
        </div>
      </div>
    );
  }

  // Se não está logado e não é rota pública, não renderiza nada (redirecionamento já foi feito)
  if (!user && !isPublicRoute) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Acesso Negado</h2>
          <p className="text-gray-600 mb-4">Você precisa estar logado para acessar esta página.</p>
          <button
            onClick={() => router.push('/login')}
            className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 transition-colors"
          >
            Fazer Login
          </button>
        </div>
      </div>
    );
  }

  // Se o usuário deve mudar a senha e não está na página de mudança de senha, mostrar o componente
  if (user && mustChangePassword && !pathname.startsWith('/forced-password-change')) {
    return <ForcedPasswordChange user={user} />;
  }

  return <>{children}</>;
}