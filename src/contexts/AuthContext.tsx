'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { authService } from '@/services/authService';
import { userService } from '@/services/userService';
import { User } from '@/types';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  userLocationIds: string[]; // Manter para compatibilidade durante transição
  userContratoIds: string[]; // Nova estrutura baseada em contratos
  signIn: (identifier: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  refreshUser: () => Promise<void>; // Atualiza os dados do usuário
  mustChangePassword: boolean; // Indica se o usuário deve mudar a senha
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [userLocationIds, setUserLocationIds] = useState<string[]>([]); // Compatibilidade
  const [userContratoIds, setUserContratoIds] = useState<string[]>([]); // Nova estrutura
  const router = useRouter();

  useEffect(() => {
    checkUser();
  }, []);

  useEffect(() => {
    if (user) {
      // Carregar locais (compatibilidade)
      userService.getUserLocations(user.id).then(setUserLocationIds).catch(() => setUserLocationIds([]));
      
      // Carregar contratos (nova estrutura)
      userService.getUserContratoIds(user.id).then(setUserContratoIds).catch(() => setUserContratoIds([]));
    } else {
      setUserLocationIds([]);
      setUserContratoIds([]);
    }
  }, [user]);

  async function checkUser() {
    try {
      const { user, error } = await authService.getCurrentUser();
      if (error) throw error;
      setUser(user);
    } catch (error) {
      console.error('Erro ao verificar usuário:', error);
    } finally {
      setLoading(false);
    }
  }

  async function signIn(identifier: string, password: string) {
    try {
      let email = identifier;
      // Se não for um email, assume matrícula e busca o email correspondente
      if (!identifier.includes('@')) {
        const response = await fetch('/api/auth/get-email-by-matricula', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ matricula: identifier }),
        });

        if (!response.ok) {
          throw new Error('Matrícula não encontrada');
        }

        const { email: foundEmail } = await response.json();
        email = foundEmail;
      }
      const { user, error } = await authService.signIn(email, password);
      if (error) throw error;
      setUser(user);
      // O redirecionamento será feito pelo componente de login
    } catch (error) {
      throw error;
    }
  }

  async function signOut() {
    try {
      const { error } = await authService.signOut();
      if (error) throw error;
      setUser(null);
      router.push('/login');
    } catch (error) {
      throw error;
    }
  }

  async function resetPassword(email: string) {
    try {
      const { error } = await authService.resetPassword(email);
      if (error) throw error;
    } catch (error) {
      throw error;
    }
  }

  async function refreshUser() {
    try {
      const { user: updatedUser, error } = await authService.getCurrentUser();
      if (error) throw error;
      setUser(updatedUser);
    } catch (error) {
      console.error('Erro ao atualizar usuário:', error);
    }
  }

  // Verificar se o usuário deve mudar a senha
  const mustChangePassword = user?.deve_mudar_senha === true;

  return (
    <AuthContext.Provider value={{ user, loading, userLocationIds, userContratoIds, signIn, signOut, resetPassword, refreshUser, mustChangePassword }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
} 