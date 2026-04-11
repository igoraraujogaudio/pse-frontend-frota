// authService — BFF pattern
// Todas as chamadas passam pelas API routes do Next.js (same-origin).
// Tokens ficam em cookies httpOnly gerenciados pelo servidor.
// O browser NUNCA fala diretamente com o Backend Rust.

export interface AuthTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}

export interface UserProfile {
  id: string;
  nome: string;
  email: string;
  matricula: string;
  perfil_acesso: string | null;
  deve_mudar_senha: boolean;
  contrato_ids: string[];
}

export interface LoginResponse extends AuthTokenResponse {
  user: UserProfile;
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const message = body.error ?? body.message ?? 'Erro desconhecido';
    const error = new Error(message) as Error & { status: number; code?: string };
    error.status = response.status;
    error.code = body.code;
    throw error;
  }
  return response.json() as Promise<T>;
}

export const authService = {
  /** Login via BFF — POST /api/auth/login (same-origin, sem CORS) */
  async signIn(identifier: string, password: string): Promise<LoginResponse> {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier, password }),
    });
    return handleResponse<LoginResponse>(response);
  },

  /** Logout via BFF — POST /api/auth/logout */
  async signOut(): Promise<void> {
    await fetch('/api/auth/logout', { method: 'POST' });
  },

  /** Forgot password via BFF — POST /api/auth/forgot-password */
  async resetPassword(email: string): Promise<void> {
    const response = await fetch('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    await handleResponse<unknown>(response);
  },

  /** Change password via BFF — POST /api/auth/change-password (usuário logado) */
  async changePassword(newPassword: string): Promise<void> {
    const response = await fetch('/api/auth/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ new_password: newPassword }),
    });
    await handleResponse<unknown>(response);
  },

  /** Reset password via link de email — POST /api/auth/reset-password
   *  Caso especial: token vem da URL, não do cookie. */
  async resetPasswordWithToken(accessToken: string, newPassword: string): Promise<void> {
    const response = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ access_token: accessToken, new_password: newPassword }),
    });
    await handleResponse<unknown>(response);
  },
};
