'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useRouter } from 'next/navigation';
import { authService, LoginResponse, UserProfile } from '@/services/authService';
import { User } from '@/types';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  userLocationIds: string[];
  userContratoIds: string[];
  signIn: (identifier: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  refreshUser: () => Promise<void>;
  mustChangePassword: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/** Map UserProfile (from /auth/me) to the legacy User type used across the app */
function mapProfileToUser(profile: UserProfile): User {
  return {
    id: profile.id,
    nome: profile.nome,
    email: profile.email,
    matricula: profile.matricula,
    perfil_acesso_id: profile.perfil_acesso ?? undefined,
    nivel_acesso: profile.perfil_acesso ?? 'operador',
    deve_mudar_senha: profile.deve_mudar_senha,
    status: 'ativo',
  };
}

/**
 * Fetch user profile via proxy route (reads JWT from httpOnly cookie automatically).
 * The proxy handles 401 → refresh → retry transparently.
 */
async function fetchProfileViaProxy(): Promise<UserProfile> {
  const res = await fetch('/api/proxy/auth/me');
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const err = new Error(body.error ?? 'Erro ao carregar perfil') as Error & { status: number };
    err.status = res.status;
    throw err;
  }
  return res.json() as Promise<UserProfile>;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [userContratoIds, setUserContratoIds] = useState<string[]>([]);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();

  // ── helpers ──────────────────────────────────────────────

  /** Schedule a token refresh slightly before it expires */
  const scheduleRefresh = useCallback((expiresIn: number) => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);

    // Refresh 60 s before expiry (minimum 10 s)
    const delay = Math.max((expiresIn - 60) * 1000, 10_000);

    refreshTimerRef.current = setTimeout(async () => {
      try {
        // Call the dedicated refresh API route which reads refresh_token
        // from httpOnly cookie, calls the backend, and updates cookies.
        const refreshRes = await fetch('/api/auth/refresh', { method: 'POST' });
        if (refreshRes.ok) {
          const data = await refreshRes.json();
          if (data.expires_in) {
            scheduleRefresh(data.expires_in);
          }
        }
      } catch (err) {
        console.error('Erro no refresh automático:', err);
      }
    }, delay);
  }, []);

  /** Clear the refresh timer */
  const clearRefreshTimer = useCallback(() => {
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
  }, []);

  // ── checkUser (on mount) ────────────────────────────────

  useEffect(() => {
    checkUser();
    return () => clearRefreshTimer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function checkUser() {
    try {
      // 1. Check if session cookie exists
      const sessionRes = await fetch('/api/auth/session');
      const session = await sessionRes.json();

      if (!session.authenticated) {
        setUser(null);
        setUserContratoIds([]);
        return;
      }

      // 2. Load user profile via proxy (cookie sent automatically,
      //    proxy handles refresh on 401 transparently)
      const profile = await fetchProfileViaProxy();
      setUser(mapProfileToUser(profile));
      setUserContratoIds(profile.contrato_ids ?? []);

      // 3. Schedule auto-refresh (we don't know exact expires_in here,
      //    so use a conservative 50 min = 3000s assuming 1h tokens)
      scheduleRefresh(3000);
    } catch (error) {
      console.error('Erro ao verificar usuário:', error);
      setUser(null);
      setUserContratoIds([]);
    } finally {
      setLoading(false);
    }
  }

  // ── signIn ──────────────────────────────────────────────

  async function signIn(identifier: string, password: string) {
    // 1. Authenticate via backend (handles matrícula→email resolution)
    const loginData: LoginResponse = await authService.signIn(identifier, password);

    // 2. Store tokens in httpOnly cookies via session API route
    await fetch('/api/auth/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        access_token: loginData.access_token,
        refresh_token: loginData.refresh_token,
        expires_in: loginData.expires_in,
      }),
    });

    // 3. Set user state from login response
    if (loginData.user) {
      setUser(mapProfileToUser(loginData.user));
      setUserContratoIds(loginData.user.contrato_ids ?? []);
    } else {
      // Fallback: load profile via proxy
      const profile = await fetchProfileViaProxy();
      setUser(mapProfileToUser(profile));
      setUserContratoIds(profile.contrato_ids ?? []);
    }

    // 4. Schedule auto-refresh based on expires_in from login response
    scheduleRefresh(loginData.expires_in);
  }

  // ── signOut ─────────────────────────────────────────────

  async function signOut() {
    try {
      // 1. Get access_token from cookie to call backend logout
      const sessionRes = await fetch('/api/auth/session');
      const session = await sessionRes.json();

      if (session.access_token) {
        await authService.signOut(session.access_token).catch(() => {
          // Ignore errors — we still want to clear local state
        });
      }

      // 2. Clear httpOnly cookies
      await fetch('/api/auth/session', { method: 'DELETE' });
    } catch {
      // Best-effort — always clear local state
    } finally {
      clearRefreshTimer();
      setUser(null);
      setUserContratoIds([]);
      router.push('/login');
    }
  }

  // ── resetPassword ───────────────────────────────────────

  async function resetPassword(email: string) {
    await authService.resetPassword(email);
  }

  // ── refreshUser ─────────────────────────────────────────

  async function refreshUser() {
    try {
      // Load profile via proxy (handles auth automatically)
      const profile = await fetchProfileViaProxy();
      setUser(mapProfileToUser(profile));
      setUserContratoIds(profile.contrato_ids ?? []);
    } catch (error) {
      console.error('Erro ao atualizar usuário:', error);
    }
  }

  // ── derived state ───────────────────────────────────────

  const mustChangePassword = user?.deve_mudar_senha === true;

  // userLocationIds = alias for userContratoIds (backward compat)
  const userLocationIds = userContratoIds;

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        userLocationIds,
        userContratoIds,
        signIn,
        signOut,
        resetPassword,
        refreshUser,
        mustChangePassword,
      }}
    >
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
