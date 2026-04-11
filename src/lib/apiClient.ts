import { toast } from 'sonner'

const API_BASE_URL = '/api/proxy'
const API_PREFIX = '/frota'
type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
interface RequestOptions { params?: Record<string, string | number | boolean | undefined>; body?: unknown; headers?: Record<string, string>; silent?: boolean }
interface ApiErrorResponse { error: string; code?: string; details?: Record<string, string[]> }

class ApiClientError extends Error {
  status: number
  code?: string
  details?: Record<string, string[]>
  constructor(msg: string, status: number, code?: string, details?: Record<string, string[]>) {
    super(msg); this.name = 'ApiClientError'; this.status = status; this.code = code; this.details = details
  }
}

function buildUrl(path: string, params?: Record<string, string | number | boolean | undefined>) {
  const url = `${API_BASE_URL}${API_PREFIX}${path}`
  const sp = new URLSearchParams()
  if (params) Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== '') sp.set(k, String(v)) })
  const qs = sp.toString()
  return qs ? `${url}?${qs}` : url
}

function showErrorToast(status: number, err: ApiErrorResponse) {
  if (status === 401) { toast.error('Sessão expirada. Redirecionando para login...'); setTimeout(() => { window.location.href = '/login' }, 1500) }
  else if (status === 403) toast.error(`Sem permissão: ${err.code || 'operação não autorizada'}`)
  else if (status === 422) {
    if (err.details) { const m = Object.entries(err.details).map(([f, e]) => `${f}: ${e.join(', ')}`).join('\n'); toast.error(`Validação: ${m}`) }
    else toast.error(err.error || 'Dados inválidos')
  }
  else if (status === 429) toast.error('Muitas requisições. Aguarde um momento.')
  else if (status >= 500) toast.error('Erro interno do servidor. Tente novamente.')
  else toast.error(err.error || 'Erro na requisição')
}

async function handleResponse<T>(res: Response, silent: boolean): Promise<T> {
  if (res.ok) return res.status === 204 ? (undefined as T) : res.json()
  let err: ApiErrorResponse
  try { err = await res.json() } catch { err = { error: 'Erro desconhecido' } }
  if (!silent) showErrorToast(res.status, err)
  throw new ApiClientError(err.error, res.status, err.code, err.details)
}

async function request<T>(method: HttpMethod, path: string, opts: RequestOptions = {}): Promise<T> {
  const { params, body, headers = {}, silent = false } = opts
  const url = buildUrl(path, params)
  const init: RequestInit = { method, headers: { 'Content-Type': 'application/json', ...headers }, credentials: 'same-origin' as RequestCredentials }
  if (body !== undefined && method !== 'GET') init.body = JSON.stringify(body)
  return handleResponse<T>(await fetch(url, init), silent)
}

export const apiClient = {
  get<T>(path: string, opts?: RequestOptions) { return request<T>('GET', path, opts) },
  post<T>(path: string, opts?: RequestOptions) { return request<T>('POST', path, opts) },
  put<T>(path: string, opts?: RequestOptions) { return request<T>('PUT', path, opts) },
  delete<T = void>(path: string, opts?: RequestOptions) { return request<T>('DELETE', path, opts) },
  patch<T>(path: string, opts?: RequestOptions) { return request<T>('PATCH', path, opts) },
  async getSignedUrl(bucket: string, filePath: string): Promise<string> {
    const d = await request<{ signed_url: string }>('POST', '/storage/signed-url', { body: { bucket, path: filePath } })
    return d.signed_url
  },
}

export { ApiClientError }
export type { RequestOptions, ApiErrorResponse }
