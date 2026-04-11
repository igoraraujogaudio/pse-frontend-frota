const API_URL = process.env.NEXT_PUBLIC_API_FROTA_URL ?? '';

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
  /**
   * Login via Backend Rust — POST /api/v1/auth/login
   * Aceita email ou matrícula como identifier.
   */
  async signIn(
    identifier: string,
    password: string,
  ): Promise<LoginResponse> {
    const response = await fetch(`${API_URL}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier, password }),
    });
    return handleResponse<LoginResponse>(response);
  },

  /**
   * Logout via Backend Rust — POST /api/v1/auth/logout
   */
  async signOut(accessToken: string): Promise<void> {
    const response = await fetch(`${API_URL}/api/v1/auth/logout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
    });
    await handleResponse<unknown>(response);
  },

  /**
   * Dados do usuário autenticado — GET /api/v1/auth/me
   */
  async getCurrentUser(accessToken: string): Promise<UserProfile> {
    const response = await fetch(`${API_URL}/api/v1/auth/me`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    return handleResponse<UserProfile>(response);
  },

  /**
   * Solicitar reset de senha — POST /api/v1/auth/forgot-password
   * Sempre retorna sucesso (anti-enumeração).
   */
  async resetPassword(email: string): Promise<void> {
    const response = await fetch(`${API_URL}/api/v1/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    await handleResponse<unknown>(response);
  },

  /**
   * Alterar senha — POST /api/v1/auth/change-password
   */
  async changePassword(
    accessToken: string,
    newPassword: string,
  ): Promise<void> {
    const response = await fetch(`${API_URL}/api/v1/auth/change-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ new_password: newPassword }),
    });
    await handleResponse<unknown>(response);
  },

  /**
   * Refresh token — POST /api/v1/auth/refresh
   */
  async refreshToken(refreshToken: string): Promise<AuthTokenResponse> {
    const response = await fetch(`${API_URL}/api/v1/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    return handleResponse<AuthTokenResponse>(response);
  },
};
