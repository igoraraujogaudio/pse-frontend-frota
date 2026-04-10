import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/evolution/setup
 * Endpoint para configurar Evolution API automaticamente
 * Cria instância e retorna QR Code
 */
export async function POST(request: NextRequest) {
  // Definir variáveis que precisam estar acessíveis no catch
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  try {
    const body = await request.json();
    const { action, instanceName } = body;

    // Obter URL da API - priorizar variável de ambiente
    let API_URL = process.env.WHATSAPP_API_URL?.trim();
    const API_KEY = process.env.WHATSAPP_API_KEY || '8eGxVdQxguqkQ0yj9G6cnpk4efRK4tZd';
    const INSTANCE_NAME = instanceName || 'denuncias-pse';

    // Se não configurado, usar fallback
    if (!API_URL) {
      // Tentar usar URL interna primeiro (se estiver no Coolify)
      API_URL = process.env.WHATSAPP_API_INTERNAL_URL?.trim() || 
                'http://evo-bswo0gc8wk0cwgks8048s4ck.191.252.203.65.sslip.io';
    }
    
    // Se a URL contém /manager, remover essa parte (a API está na raiz)
    if (API_URL.includes('/manager')) {
      API_URL = API_URL.replace(/\/manager.*$/, '');
    }
    
    // Se a URL tem porta 8080 mas pode não estar acessível, tentar sem porta primeiro
    // (caso esteja em proxy reverso que redireciona automaticamente)
    if (API_URL.includes(':8080')) {
      // Tentar sem porta primeiro (proxy reverso)
      const urlWithoutPort = API_URL.replace(':8080', '');
      // Mas manter a original como fallback
      API_URL = urlWithoutPort;
    }

    // Validar URL
    if (!API_URL || !API_URL.startsWith('http')) {
      return NextResponse.json(
        { 
          error: 'URL da API inválida. Configure WHATSAPP_API_URL corretamente.',
          hint: 'No Coolify, use o nome do serviço interno: http://evolution-api:8080'
        },
        { status: 400 }
      );
    }

    // Remover barra final se houver
    const cleanApiUrl = API_URL.replace(/\/$/, '');
    
    // Função helper para tentar fetch com fallback de porta
    const fetchWithPortFallback = async (url: string, options: RequestInit): Promise<Response> => {
      try {
        console.log(`🌐 Tentando fetch: ${url}`);
        const response = await fetch(url, options);
        console.log(`✅ Resposta recebida: ${response.status} ${response.statusText}`);
        return response;
      } catch (error) {
        console.error(`❌ Erro no fetch: ${error}`);
        // Se falhou e a URL base não tinha porta 8080, tentar com porta 8080
        if (!cleanApiUrl.includes(':8080') && !cleanApiUrl.includes(':80') && !cleanApiUrl.includes(':443')) {
          try {
            // Substituir a URL base na URL completa
            const baseUrlObj = new URL(cleanApiUrl);
            const urlWithPort = url.replace(
              `${baseUrlObj.protocol}//${baseUrlObj.host}`,
              `${baseUrlObj.protocol}//${baseUrlObj.hostname}:8080`
            );
            console.log(`🔄 Tentando novamente com porta 8080: ${urlWithPort}`);
            const response = await fetch(urlWithPort, options);
            console.log(`✅ Resposta recebida (com porta): ${response.status} ${response.statusText}`);
            return response;
          } catch (secondError) {
            console.error(`❌ Erro também com porta: ${secondError}`);
            // Se ambas falharam, lançar o erro original
            throw error;
          }
        }
        // Se já tinha porta ou não conseguiu adicionar, lançar erro original
        throw error;
      }
    };
    
    // Log para debug
    console.log('🔧 Evolution API Config:', {
      url: cleanApiUrl,
      urlFromEnv: process.env.WHATSAPP_API_URL,
      hasApiKey: !!API_KEY,
      instanceName: INSTANCE_NAME,
      action,
      env: process.env.NODE_ENV,
      isDevelopment,
      warning: isDevelopment ? 'Rodando localmente - certifique-se de que a URL está acessível externamente' : undefined
    });
    
    // Verificar se a URL está acessível (apenas em desenvolvimento)
    if (isDevelopment) {
      try {
        const testUrl = new URL(cleanApiUrl);
        console.log(`🔍 Tentando conectar a: ${testUrl.hostname}:${testUrl.port || '80'}`);
      } catch {
        console.warn('⚠️ URL inválida:', cleanApiUrl);
      }
    }
    
    // Função helper para obter o ID da instância pelo nome
    const getInstanceIdByName = async (name: string): Promise<string | null> => {
      try {
        const listResponse = await fetchWithPortFallback(`${cleanApiUrl}/instance/fetchInstances`, {
          method: 'GET',
          headers: {
            'apikey': API_KEY,
          }
        });
        
        if (listResponse.ok) {
          const listText = await listResponse.text();
          const listData = listText ? JSON.parse(listText) : {};
          
          type InstanceItem = {name?: string; id?: string};
          if (Array.isArray(listData)) {
            const instance = (listData as InstanceItem[]).find((inst) => inst.name === name);
            return instance?.id || null;
          } else if (Array.isArray(listData.instances)) {
            const instance = (listData.instances as InstanceItem[]).find((inst) => inst.name === name);
            return instance?.id || null;
          }
        }
      } catch (error) {
        console.error('❌ Erro ao buscar ID da instância:', error);
      }
      return null;
    };

    switch (action) {
      case 'create':
        // Criar instância com timeout
        const createAbortController = new AbortController();
        const createTimeout = setTimeout(() => createAbortController.abort(), 10000);
        
        try {
          const createResponse = await fetchWithPortFallback(`${cleanApiUrl}/instance/create`, {
            method: 'POST',
            headers: {
              'apikey': API_KEY,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              instanceName: INSTANCE_NAME,
              qrcode: true,
              integration: 'WHATSAPP-BAILEYS'
            }),
            signal: createAbortController.signal
          });
          clearTimeout(createTimeout);

          // Verificar se a resposta tem conteúdo antes de fazer .json() 
          const createText = await createResponse.text();
          let createData;
          try {
            createData = createText ? JSON.parse(createText) : {};
          } catch {
            console.error('❌ Erro ao parsear JSON da resposta:', createText);
            return NextResponse.json(
              { 
                error: 'Resposta inválida da Evolution API', 
                details: createText || 'Resposta vazia',
                hint: 'Verifique se a Evolution API está rodando e acessível'
              },
              { status: 500 }
            );
          }
          
          if (!createResponse.ok) {
            return NextResponse.json(
              { error: 'Erro ao criar instância', details: createData },
              { status: createResponse.status }
            );
          }

          return NextResponse.json({
            success: true,
            message: 'Instância criada com sucesso',
            instanceName: INSTANCE_NAME,
            data: createData
          });
        } catch (fetchError) {
          clearTimeout(createTimeout);
          // Re-throw para ser capturado pelo catch externo
          throw fetchError;
        }

      case 'connect':
        // Obter QR Code - tentar usar ID se disponível, senão usar nome
        const connectInstanceId = await getInstanceIdByName(INSTANCE_NAME);
        const connectIdentifier = connectInstanceId || INSTANCE_NAME;
        const connectResponse = await fetchWithPortFallback(`${cleanApiUrl}/instance/connect/${connectIdentifier}`, {
          method: 'GET',
          headers: {
            'apikey': API_KEY,
          }
        });

        const connectText = await connectResponse.text();
        let connectData;
        try {
          connectData = connectText ? JSON.parse(connectText) : {};
        } catch {
          console.error('❌ Erro ao parsear JSON da resposta:', connectText);
          return NextResponse.json(
            { 
              error: 'Resposta inválida da Evolution API', 
              details: connectText || 'Resposta vazia',
              hint: 'Verifique se a Evolution API está rodando e acessível'
            },
            { status: 500 }
          );
        }
        
        if (!connectResponse.ok) {
          return NextResponse.json(
            { error: 'Erro ao obter QR Code', details: connectData },
            { status: connectResponse.status }
          );
        }

        return NextResponse.json({
          success: true,
          qrcode: connectData.qrcode,
          qrcodeUrl: `${cleanApiUrl}/instance/connect/${connectIdentifier}?apikey=${API_KEY}`,
          data: connectData,
          instanceId: connectInstanceId
        });

      case 'status':
        // Verificar status - primeiro buscar a instância na lista para obter o ID e status
        // Isso é mais eficiente e confiável do que usar o endpoint fetchStatus
        console.log(`🔍 Buscando status da instância: ${INSTANCE_NAME}`);
        
        // Buscar na lista de instâncias primeiro
        const listForStatusResponse = await fetchWithPortFallback(`${cleanApiUrl}/instance/fetchInstances`, {
          method: 'GET',
          headers: {
            'apikey': API_KEY,
          }
        });
        
        if (!listForStatusResponse.ok) {
          return NextResponse.json(
            { 
              error: 'Erro ao listar instâncias', 
              hint: 'Não foi possível acessar a lista de instâncias'
            },
            { status: listForStatusResponse.status }
          );
        }
        
        const listForStatusText = await listForStatusResponse.text();
        let listForStatusData;
        try {
          listForStatusData = listForStatusText ? JSON.parse(listForStatusText) : {};
        } catch {
          return NextResponse.json(
            { 
              error: 'Resposta inválida da Evolution API', 
              details: listForStatusText || 'Resposta vazia'
            },
            { status: 500 }
          );
        }
        
        // A resposta pode ser um array direto ou um objeto com propriedade instances
        type InstanceItem = {name?: string; id?: string; number?: string; connectionStatus?: string; ownerJid?: string; createdAt?: string; updatedAt?: string};
        let instances: InstanceItem[] = [];
        if (Array.isArray(listForStatusData)) {
          instances = listForStatusData as InstanceItem[];
        } else if (Array.isArray(listForStatusData.instances)) {
          instances = listForStatusData.instances as InstanceItem[];
        }
        
        // Procurar a instância pelo nome
        const instance = instances.find((inst) => inst.name === INSTANCE_NAME);
        
        if (!instance) {
          return NextResponse.json({
            success: false,
            status: null,
            connected: false,
            error: 'Instância não encontrada',
            hint: `A instância "${INSTANCE_NAME}" não foi encontrada. Verifique se o nome está correto ou liste as instâncias para ver os nomes disponíveis.`,
            instanceName: INSTANCE_NAME
          }, { status: 200 });
        }
        
        // Usar o connectionStatus da lista (mais confiável)
        const isConnected = instance.connectionStatus === 'open';
        
        return NextResponse.json({
          success: true,
          status: {
            instance: {
              state: instance.connectionStatus,
              id: instance.id,
              name: instance.name,
              number: instance.number,
              ownerJid: instance.ownerJid
            }
          },
          connected: isConnected,
          instanceId: instance.id,
          instanceName: instance.name
        });

      case 'list':
        // Listar instâncias
        const listResponse = await fetchWithPortFallback(`${cleanApiUrl}/instance/fetchInstances`, {
          method: 'GET',
          headers: {
            'apikey': API_KEY,
          }
        });

        const listText = await listResponse.text();
        let listData;
        try {
          listData = listText ? JSON.parse(listText) : {};
        } catch {
          console.error('❌ Erro ao parsear JSON da resposta:', listText);
          return NextResponse.json(
            { 
              error: 'Resposta inválida da Evolution API', 
              details: listText || 'Resposta vazia',
              hint: 'Verifique se a Evolution API está rodando e acessível'
            },
            { status: 500 }
          );
        }
        
        return NextResponse.json({
          success: true,
          instances: listData
        });

      default:
        return NextResponse.json(
          { error: 'Ação inválida. Use: create, connect, status ou list' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('❌ Erro ao configurar Evolution API:', error);
    
    // Tratar erros de conexão especificamente
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    const errorCause = error instanceof Error && 'cause' in error ? String(error.cause) : '';
    const isConnectionError = errorMessage.includes('ECONNREFUSED') || 
                              errorMessage.includes('fetch failed') ||
                              errorMessage.includes('ENOTFOUND') ||
                              errorCause.includes('ECONNREFUSED');
    
    let hint = '';
    if (isConnectionError) {
      hint = 'Não foi possível conectar à Evolution API. ';
      
      if (isDevelopment) {
        hint += 'Você está rodando localmente (development). ';
        hint += 'A Evolution API está no servidor e pode não estar acessível externamente. ';
        hint += '\n\nSoluções:\n';
        hint += '1. Verifique se a URL está acessível: abra no navegador ou use curl\n';
        hint += '2. Se não estiver acessível, a porta 8080 pode estar bloqueada pelo firewall\n';
        hint += '3. Teste diretamente no servidor Coolify (recomendado)\n';
        hint += '4. Ou use um túnel (ngrok) para expor a API temporariamente';
      } else {
        if (process.env.WHATSAPP_API_URL?.includes('sslip.io')) {
          hint += 'Se estiver rodando no Coolify, configure WHATSAPP_API_URL com o nome do serviço interno (ex: http://evolution-api:8080). ';
        }
        hint += 'Verifique se a Evolution API está rodando e acessível na URL configurada.';
      }
    }
    
    return NextResponse.json(
      {
        error: 'Erro ao configurar Evolution API',
        details: errorMessage,
        hint: hint || undefined,
        config: {
          url: process.env.WHATSAPP_API_URL || 'não configurado',
          hasInternalUrl: !!process.env.WHATSAPP_API_INTERNAL_URL
        }
      },
      { status: 500 }
    );
  }
}

