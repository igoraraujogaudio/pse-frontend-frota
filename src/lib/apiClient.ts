import { supabase } from './supabase'
import { toast } from 'sonner'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_FROTA_URL || 'http://localhost:3001'
const API_PREFIX = '/api/v1/frota'

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'

interface RequestOptions {
  params?: Record<string, string | number | boolean | undefined>
  body?: unknown
  headers?: Record<string, string>
  /** Skip automatic error toast (caller handles errors) */
  silent?: boolean
}

interface ApiErrorResponse {
  error: string
  code?: string
  details?: Record<string, string[]>
}

class ApiClientError extends Error {
  status: number
  code?: string
  details?: Record<string, string[]>

  constructor(message: string, status: number, code?: string, details?: Record<string, string[]>) {
    super(message)
    this.name = 'ApiClientError'
    this.status = status
    this.code = code
    this.details = details
  }
}

async function getAuthToken(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) {
    window.location.href = '/login'
    throw new ApiClientError('Sessão expirada', 401)
  }
  return session.access_token
}

function buildUrl(path: string, params?: Record<string, string | number | boolean | undefined>): string {
  const url = new URL(`${API_BASE_URL}${API_PREFIX}${path}`)
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== '') {
        url.searchParams.set(key, String(value))
      }
    })
  }
  return url.toString()
}

async function handleResponse<T>(response: Response, silent: boolean): Promise<T> {
  if (response.ok) {
    // Handle 204 No Content
    if (response.status === 204) return undefined as T
    return response.json()
  }

  let errorBody: ApiErrorResponse
  try {
    errorBody = await response.json()
  } catch {
    errorBody = { error: 'Erro desconhecido' }
  }

  const { status } = response

  if (!silent) {
    switch (status) {
      case 401:
        toast.error('Sessão expirada. Redirecionando para login...')
        setTimeout(() => { window.location.href = '/login' }, 1500)
        break
      case 403:
        toast.error(`Sem permissão: ${errorBody.code || 'operação não autorizada'}`)
        break
      case 422:
        if (errorBody.details) {
          const msgs = Object.entries(errorBody.details)
            .map(([field, errs]) => `${field}: ${errs.join(', ')}`)
            .join('\n')
          toast.error(`Validação: ${msgs}`)
        } else {
          toast.error(errorBody.error || 'Dados inválidos')
        }
        break
      case 429:
        toast.error('Muitas requisições. Aguarde um momento.')
        break
      default:
        if (status >= 500) {
          toast.error('Erro interno do servidor. Tente novamente.')
        } else {
          toast.error(errorBody.error || 'Erro na requisição')
        }
    }
  }

  throw new ApiClientError(errorBody.error, status, errorBody.code, errorBody.details)
}

async function request<T>(method: HttpMethod, path: string, options: RequestOptions = {}): Promise<T> {
  const token = await getAuthToken()
  const url = buildUrl(path, options.params)

  const headers: Record<string, string> = {
    'Authorization': `Bearer ${token}`,
    ...options.headers,
  }

  if (options.body && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json'
  }

  const response = await fetch(url, {
    method,
    headers,
    body: options.body
      ? options.body instanceof FormData
        ? options.body
        : JSON.stringify(options.body)
      : undefined,
  })

  return handleResponse<T>(response, options.silent ?? false)
}

/** HTTP client for the Rust Frota API. Sends JWT from Supabase Auth automatically. */
export const apiClient = {
  get: <T>(path: string, options?: RequestOptions) => request<T>('GET', path, options),
  post: <T>(path: string, options?: RequestOptions) => request<T>('POST', path, options),
  put: <T>(path: string, options?: RequestOptions) => request<T>('PUT', path, options),
  delete: <T>(path: string, options?: RequestOptions) => request<T>('DELETE', path, options),
  patch: <T>(path: string, options?: RequestOptions) => request<T>('PATCH', path, options),

  /**
   * Get a temporary signed URL for a private file in Supabase Storage.
   * The backend validates JWT + permissions before generating the URL.
   */
  getSignedUrl: async (bucket: string, path: string): Promise<string> => {
    const result = await request<{ signed_url: string; expires_in: number }>(
      'POST',
      '/storage/signed-url',
      { body: { bucket, path }, silent: true }
    )
    return result.signed_url
  },
}

export { ApiClientError }
export type { ApiErrorResponse, RequestOptions }
