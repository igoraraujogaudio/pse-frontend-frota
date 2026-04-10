/**
 * Serviço para comunicação com o desktop app para tela de entrega
 */

// Portas possíveis do desktop app
const POSSIBLE_PORTS = [3001, 3002, 3003, 3004, 3005, 3006, 3007, 3008, 3009, 3010];

/**
 * Descobre a porta em que o desktop app está rodando
 * Otimizado para falhar rapidamente quando desktop não está disponível
 */
async function discoverDesktopPort(): Promise<number | null> {
  // Tentar descobrir via endpoint /api/port com timeout reduzido
  // Usar Promise.all para tentar múltiplas portas em paralelo (mais rápido)
  const portChecks = POSSIBLE_PORTS.map(async (port) => {
    try {
      const response = await fetch(`http://localhost:${port}/api/port`, {
        method: 'GET',
        signal: AbortSignal.timeout(300), // Reduzido de 1000ms para 300ms
      });
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          return data.data;
        }
      }
    } catch {
      // Ignorar erros silenciosamente
    }
    return null;
  });

  // Aguardar todas as tentativas em paralelo
  const results = await Promise.all(portChecks);
  const foundPort = results.find(port => port !== null);
  if (foundPort) {
    return foundPort;
  }

  // Fallback: tentar portas via /api/status em paralelo também
  const statusChecks = POSSIBLE_PORTS.map(async (port) => {
    try {
      const response = await fetch(`http://localhost:${port}/api/status`, {
        method: 'GET',
        signal: AbortSignal.timeout(300), // Reduzido de 1000ms para 300ms
      });
      if (response.ok) {
        return port;
      }
    } catch {
      // Ignorar erros silenciosamente
    }
    return null;
  });

  const statusResults = await Promise.all(statusChecks);
  const foundStatusPort = statusResults.find(port => port !== null);
  return foundStatusPort || null;
}

/**
 * Abre a tela de entrega no desktop app via Supabase Realtime
 */
export async function openEntregaScreen(solicitacaoId: string): Promise<boolean> {
  try {
    // Importar serviço de comandos
    const desktopCommandService = await import('./desktopCommandService');
    const { createDesktopCommand } = desktopCommandService;

    console.log('🖥️ Criando comando para abrir tela de entrega via Supabase Realtime...');
    
    // Criar comando no Supabase
    const command = await createDesktopCommand({
      solicitacaoId,
      commandType: 'open_screen',
    });

    console.log('✅ Comando criado para abrir tela:', command.id);
    console.log('📡 Desktop receberá o comando via Supabase Realtime');
    
    return true;
  } catch (error) {
    console.error('❌ Erro ao criar comando para abrir tela:', error);
    throw error;
  }
}

/**
 * Verifica se o desktop app está disponível
 */
export async function isDesktopAppAvailable(): Promise<boolean> {
  const port = await discoverDesktopPort();
  return port !== null;
}

/**
 * Inicia a captura biométrica no desktop app via Supabase Realtime
 * Nova implementação usando Supabase Realtime para comunicação confiável
 */
export async function startCaptureOnDesktop(
  solicitacaoId: string,
  isNewRegistration: boolean,
  destinatarioId?: string
): Promise<{
  template: string;
  quality: number;
  image_base64?: string;
  isNewRegistration: boolean;
  similarity?: number;
  validated?: boolean;
  multiCapture?: Array<{
    template: string;
    quality: number;
    image_base64?: string;
  }>;
}> {
  try {
    // Importar serviço de comandos
    const desktopCommandService = await import('./desktopCommandService');
    const { 
      createDesktopCommand, 
      waitForCommandCompletion
    } = desktopCommandService;

    console.log('🚀 Criando comando de captura via Supabase Realtime...');
    
    // Criar comando no Supabase
    const command = await createDesktopCommand({
      solicitacaoId,
      commandType: 'start_capture',
      destinatarioId,
      isNewRegistration,
    });

    console.log('✅ Comando criado:', command.id);
    console.log('⏳ Aguardando processamento do desktop...');

    // Aguardar conclusão (timeout de 30 segundos)
    const completedCommand = await waitForCommandCompletion(command.id, 30000);

    if (!completedCommand) {
      throw new Error('Timeout: Desktop não respondeu em 30 segundos');
    }

    if (completedCommand.status === 'error') {
      throw new Error(
        completedCommand.error_message || 'Erro desconhecido no desktop'
      );
    }

    if (completedCommand.status !== 'completed') {
      throw new Error(`Comando não foi completado. Status: ${completedCommand.status}`);
    }

    if (!completedCommand.biometric_data) {
      throw new Error('Dados biométricos não foram retornados');
    }

    console.log('✅ Captura completada com sucesso!');
    
    // Retornar dados biométricos no formato esperado
    return {
      template: completedCommand.biometric_data.template,
      quality: completedCommand.biometric_data.quality,
      image_base64: completedCommand.biometric_data.image_base64,
      isNewRegistration: completedCommand.biometric_data.isNewRegistration || isNewRegistration,
      similarity: completedCommand.biometric_data.similarity,
      validated: completedCommand.biometric_data.validated,
      multiCapture: completedCommand.biometric_data.multiCapture,
    };

  } catch (error) {
    console.error('❌ Erro ao iniciar captura no desktop:', error);
    throw error;
  }
}

/**
 * Inicia a captura biométrica no desktop app (método antigo via HTTP - mantido para compatibilidade)
 * @deprecated Use startCaptureOnDesktop que agora usa Supabase Realtime
 */
export async function startCaptureOnDesktopLegacy(
  solicitacaoId: string,
  isNewRegistration: boolean,
  destinatarioId?: string
): Promise<boolean> {
  try {
    const port = await discoverDesktopPort();
    
    if (!port) {
      throw new Error('Desktop app não está rodando. Inicie o aplicativo desktop primeiro.');
    }

    // Obter URL da API web (mesma lógica da página de entrega)
    const getWebApiUrl = () => {
      // Verificar se estamos em desenvolvimento (localhost)
      if (typeof window !== 'undefined') {
        const hostname = window.location.hostname;
        if (hostname === 'localhost' || hostname === '127.0.0.1') {
          return 'http://localhost:3000';
        }
      }
      // Em produção, usar a URL do site
      return 'https://app.pse.srv.br';
    };

    const webApiUrl = getWebApiUrl();

    const response = await fetch(`http://localhost:${port}/api/desktop/entrega/${solicitacaoId}/start-capture`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        solicitacao_id: solicitacaoId,
        is_new_registration: isNewRegistration,
        destinatario_id: destinatarioId,
        web_api_url: webApiUrl, // Passar URL da API web para o desktop usar
      }),
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Erro ao iniciar captura');
    }

    return true;
  } catch (error) {
    console.error('Erro ao iniciar captura no desktop:', error);
    throw error;
  }
}

