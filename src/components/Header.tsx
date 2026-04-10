'use client';

import Link from 'next/link';
import Image from 'next/image';
import { UserCircleIcon } from '@heroicons/react/24/solid';
import { usePathname } from 'next/navigation';
import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNotification } from '@/contexts/NotificationContext';
export default function Header() {
  const pathname = usePathname();
  const isLoginPage = pathname === '/login';
  const isPublicApkPage = ['/apk', '/download-apk', '/mobile-apk', '/site', '/privacy', '/play-store', '/denuncias'].includes(pathname);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const { user, signOut } = useAuth();
  const { notify } = useNotification();

  // Fechar dropdown quando clicar fora
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        isUserMenuOpen &&
        userMenuRef.current &&
        !userMenuRef.current.contains(event.target as Node)
      ) {
        setIsUserMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isUserMenuOpen]);

  if (isLoginPage || isPublicApkPage) {
    return null;
  }

  const handleSignOut = async () => {
    try {
      await signOut();
      notify('Logout realizado com sucesso!', 'success');
    } catch {
      notify('Erro ao fazer logout.', 'error');
    }
  };

  return (
    <header className="w-full bg-gray-50 border-b border-gray-200 relative z-[1000] shadow-sm">
      <nav className="max-w-[1600px] mx-auto flex items-center justify-between px-4 py-2">
        {/* Logo à esquerda */}
        <div className="flex items-center min-w-[120px]">
          <Link href="/" className="flex items-center">
            <Image src="/logo_pse.png" alt="Logo PSE" height={32} width={104} className="h-8 w-auto" priority />
          </Link>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Notificações + Usuário à direita */}
        <div className="flex items-center gap-2 min-w-[160px] justify-end">
          {/* Usuário */}
          <div className="relative" ref={userMenuRef}>
            <button
              onClick={() => setIsUserMenuOpen((open) => !open)}
              className="flex items-center gap-2 text-gray-700 hover:text-gray-900 transition-colors"
            >
              <UserCircleIcon className="h-7 w-7 text-gray-400" />
              <span className="text-[13px] font-medium hidden md:inline">{user?.nome || 'Usuário'}</span>
              <svg
                className={`w-3.5 h-3.5 transition-transform duration-200 ${isUserMenuOpen ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {isUserMenuOpen && (
              <div className="absolute right-0 mt-2 w-48 rounded-xl bg-white shadow-lg ring-1 ring-black/5 backdrop-blur-sm transition-all duration-200 ease-out z-[1001] transform origin-top scale-100">
                <div className="py-1.5">
                  <div className="px-4 py-2 text-sm text-gray-500 border-b border-gray-100">
                    {user?.email}
                  </div>
                  <button
                    onClick={handleSignOut}
                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-red-700 transition-colors"
                  >
                    Sair
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </nav>
    </header>
  );
}
