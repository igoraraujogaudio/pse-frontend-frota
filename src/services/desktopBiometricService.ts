// desktopBiometricService.ts
// Serviço para interagir com o aplicativo desktop PSE via API HTTP local

// Portas possíveis (tentará em ordem)
const POSSIBLE_PORTS = [3001, 3002, 3003, 3004, 3005, 3006, 3007, 3008, 3009, 3010];
const DEFAULT_PORT = 3001;

// Cache da porta descoberta
let cachedPort: number | null = null;

/**
 * Descobre a porta em que o desktop app está rodando
 * Tenta múltiplas portas sequencialmente
 */
async function discoverPort(): Promise<number | null> {
  // Se já temos a porta em cache, tentar ela primeiro
  if (cachedPort !== null) {
    try {
      const response = await fetch(`http://localhost:${cachedPort}/api/status`, {
        method: 'GET',
        signal: AbortSignal.timeout(1000),
      });
      if (response.ok) {
        return cachedPort;
      }
    } catch {
      // Porta mudou, limpar cache
      cachedPort = null;
    }
  }

  // Tentar descobrir a porta atual via endpoint /api/port
  for (const port of POSSIBLE_PORTS) {
    try {
      const response = await fetch(`http://localhost:${port}/api/port`, {
        method: 'GET',
        signal: AbortSignal.timeout(1000),
      });
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          cachedPort = data.data;
          return cachedPort;
        }
      }
    } catch {
      // Continuar tentando próxima porta
      continue;
    }
  }

  // Fallback: tentar portas sequencialmente via /api/status
  for (const port of POSSIBLE_PORTS) {
    try {
      const response = await fetch(`http://localhost:${port}/api/status`, {
        method: 'GET',
        signal: AbortSignal.timeout(1000),
      });
      if (response.ok) {
        cachedPort = port;
        return port;
      }
    } catch {
      continue;
    }
  }

  return null;
}

/**
 * Obtém a URL base da API, descobrindo a porta automaticamente
 */
async function getBaseUrl(): Promise<string> {
  const port = await discoverPort();
  if (port === null) {
    // Fallback para porta padrão
    return `http://localhost:${DEFAULT_PORT}/api`;
  }
  return `http://localhost:${port}/api`;
}

export interface PortInfo {
  port_name: string;
  description: string;
  is_idbio: boolean;
  hardware_id?: string;
}

export interface DeviceInfo {
  connected: boolean;
  port?: string;
  version?: string;
  serial_number?: string;
  model?: string;
}

export interface FingerprintData {
  template: string;
  quality: number;
  image_base64?: string;
  width?: number;
  height?: number;
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

async function callApi<T>(
  method: string,
  endpoint: string,
  data?: unknown
): Promise<ApiResponse<T>> {
  try {
    const baseUrl = await getBaseUrl();
    const response = await fetch(`${baseUrl}${endpoint}`, {
      method: method,
      headers: {
        'Content-Type': 'application/json',
      },
      body: data ? JSON.stringify(data) : undefined,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `HTTP error! status: ${response.status}, message: ${errorText}`
      );
    }

    return await response.json();
  } catch (error) {
    console.error(`Erro ao chamar API ${endpoint}:`, error);
    const errorMessage = error instanceof Error ? error.message : 'Erro de rede ou serviço não disponível';
    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Verifica se o serviço desktop está disponível
 */
export async function checkServiceAvailability(): Promise<boolean> {
  try {
    const baseUrl = await getBaseUrl();
    const response = await fetch(`${baseUrl}/status`, {
      method: 'GET',
      signal: AbortSignal.timeout(2000), // 2 segundos de timeout
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Lista todas as portas COM disponíveis, priorizando dispositivos iDBio
 */
export async function listPorts(): Promise<ApiResponse<PortInfo[]>> {
  return callApi<PortInfo[]>('GET', '/ports');
}

/**
 * Conecta ao dispositivo biométrico na porta especificada
 */
export async function connectDevice(
  port: string
): Promise<ApiResponse<string>> {
  return callApi<string>('POST', '/connect', { port });
}

/**
 * Desconecta do dispositivo biométrico
 */
export async function disconnectDevice(): Promise<ApiResponse<string>> {
  return callApi<string>('DELETE', '/disconnect');
}

/**
 * Captura uma digital do dispositivo
 * @param timeout_ms Timeout em milissegundos (padrão: 30000)
 */
export async function captureFingerprint(
  timeout_ms?: number
): Promise<ApiResponse<FingerprintData>> {
  return callApi<FingerprintData>('POST', '/capture', { timeout: timeout_ms });
}

/**
 * Obtém informações do dispositivo conectado
 */
export async function getDeviceInfo(): Promise<ApiResponse<DeviceInfo>> {
  return callApi<DeviceInfo>('GET', '/device/info');
}

/**
 * Obtém o status do serviço
 */
export async function getStatus(): Promise<ApiResponse<string>> {
  return callApi<string>('GET', '/status');
}

/**
 * Registra um template biométrico no desktop app (armazenamento local)
 */
export async function registerTemplate(request: {
  id: string;
  name: string;
  template: string;
  metadata?: Record<string, string>;
}): Promise<ApiResponse<string>> {
  return callApi<string>('POST', '/templates/register', request);
}

/**
 * Lista templates cadastrados no desktop app
 */
export async function listTemplates(): Promise<ApiResponse<unknown[]>> {
  return callApi<unknown[]>('GET', '/templates/list');
}

/**
 * Compara dois templates usando o SDK do desktop app
 */
export async function compareTemplates(request: {
  template1: string;
  template2: string;
}): Promise<ApiResponse<{ similarity: number; match: boolean; threshold: number }>> {
  return callApi<{ similarity: number; match: boolean; threshold: number }>(
    'POST',
    '/templates/compare',
    request
  );
}

/**
 * Faz match de um template com templates cadastrados
 */
export async function matchTemplate(request: {
  template: string;
  threshold: number;
}): Promise<ApiResponse<{
  found: boolean;
  template?: unknown;
  similarity?: number;
}>> {
  return callApi<{
    found: boolean;
    template?: unknown;
    similarity?: number;
  }>('POST', '/templates/match', request);
}

