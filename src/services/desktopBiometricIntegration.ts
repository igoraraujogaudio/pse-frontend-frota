/**
 * Serviço para integração com o aplicativo desktop PSE
 * Permite comunicação entre o site web e o aplicativo desktop para captura biométrica
 */

// Portas possíveis (tentará em ordem)
const POSSIBLE_PORTS = [3001, 3002, 3003, 3004, 3005, 3006, 3007, 3008, 3009, 3010];
const DEFAULT_PORT = 3001;

// Cache da porta descoberta
let cachedPort: number | null = null;

/**
 * Descobre a porta em que o desktop app está rodando
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
 * Obtém a URL base da API
 */
export async function getApiUrl(): Promise<string> {
  const port = await discoverPort();
  const finalPort = port || DEFAULT_PORT;
  return `http://localhost:${finalPort}/api`;
}

export interface DesktopStatus {
  available: boolean;
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

/**
 * Verifica se o aplicativo desktop está disponível
 */
export async function checkDesktopAvailability(): Promise<boolean> {
  try {
    const apiUrl = await getApiUrl();
    const response = await fetch(`${apiUrl}/status`, {
      method: 'GET',
      signal: AbortSignal.timeout(2000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Obtém o status completo do aplicativo desktop
 */
export async function getDesktopStatus(): Promise<DesktopStatus> {
  try {
    const apiUrl = await getApiUrl();
    const statusResponse = await fetch(`${apiUrl}/status`, {
      method: 'GET',
      signal: AbortSignal.timeout(2000),
    });

    if (!statusResponse.ok) {
      return { available: false, connected: false };
    }

    const deviceInfoResponse = await fetch(`${apiUrl}/device/info`, {
      method: 'GET',
      signal: AbortSignal.timeout(2000),
    });

    let deviceInfo = null;
    if (deviceInfoResponse.ok) {
      const data = await deviceInfoResponse.json();
      deviceInfo = data.data;
    }

    return {
      available: true,
      connected: deviceInfo?.connected || false,
      port: deviceInfo?.port,
      version: deviceInfo?.version,
      serial_number: deviceInfo?.serial_number,
      model: deviceInfo?.model,
    };
  } catch {
    return { available: false, connected: false };
  }
}

/**
 * Abre o aplicativo desktop via deep link
 */
export function openDesktopApp(action: 'capture' | 'connect' = 'capture'): void {
  try {
    // Tentar abrir via protocol handler
    window.location.href = `pse://${action}`;
    
    // Fallback: mostrar mensagem
    setTimeout(() => {
      console.log('Se o aplicativo não abrir, abra manualmente o PSE Desktop.');
    }, 1000);
  } catch (error) {
    console.error('Erro ao abrir aplicativo desktop:', error);
    alert('Erro ao abrir aplicativo. Abra manualmente o PSE Desktop.');
  }
}

/**
 * Captura uma digital do dispositivo
 */
export async function captureFingerprint(timeout: number = 30000): Promise<FingerprintData> {
  const apiUrl = await getApiUrl();
  const response = await fetch(`${apiUrl}/capture`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ timeout }),
    signal: AbortSignal.timeout(timeout + 5000),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Erro ao capturar digital');
  }

  const data = await response.json();
  if (data.success && data.data) {
    return data.data;
  } else {
    throw new Error(data.error || 'Erro ao capturar digital');
  }
}

/**
 * Envia a digital capturada para o servidor do site
 */
export async function sendFingerprintToServer(
  template: string,
  quality: number,
  metadata?: Record<string, unknown>
): Promise<unknown> {
  const response = await fetch('/api/biometric/validate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      template,
      quality,
      metadata,
      timestamp: new Date().toISOString(),
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Erro ao enviar para o servidor');
  }

  return await response.json();
}

/**
 * Conecta ao dispositivo na porta especificada
 */
export async function connectDevice(port: string): Promise<void> {
  const apiUrl = await getApiUrl();
  const response = await fetch(`${apiUrl}/connect`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ port }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Erro ao conectar dispositivo');
  }
}

/**
 * Lista portas COM disponíveis
 */
export async function listPorts(): Promise<unknown[]> {
  const apiUrl = await getApiUrl();
  const response = await fetch(`${apiUrl}/ports`, {
    method: 'GET',
    signal: AbortSignal.timeout(5000),
  });

  if (!response.ok) {
    throw new Error('Erro ao listar portas');
  }

  const data = await response.json();
  return data.data || [];
}

