/**
 * Serviço de envio de mensagens via WhatsApp
 * Suporta múltiplas APIs: Twilio, Evolution API, Baileys, etc.
 */

interface WhatsAppConfig {
  apiUrl?: string;
  apiKey?: string;
  instanceId?: string;
  token?: string;
  provider?: 'twilio' | 'evolution' | 'baileys' | 'custom';
}

/**
 * Envia mensagem via WhatsApp usando a API configurada
 */
export async function sendWhatsAppMessage(
  to: string,
  message: string,
  config?: WhatsAppConfig
): Promise<{ success: boolean; error?: string }> {
  try {
    // Obter configuração das variáveis de ambiente
    const provider = config?.provider || (process.env.WHATSAPP_PROVIDER as 'twilio' | 'evolution' | 'baileys' | 'custom' | undefined) || 'evolution';
    const apiUrl = config?.apiUrl || process.env.WHATSAPP_API_URL;
    const apiKey = config?.apiKey || process.env.WHATSAPP_API_KEY;
    const instanceId = config?.instanceId || process.env.WHATSAPP_INSTANCE_ID;
    const token = config?.token || process.env.WHATSAPP_TOKEN;

    if (!apiUrl) {
      console.warn('⚠️ WhatsApp API URL não configurada. Mensagem não enviada.');
      return { success: false, error: 'WhatsApp API não configurada' };
    }

    // Formatar número (remover caracteres especiais, garantir formato internacional)
    const formattedNumber = formatPhoneNumber(to);

    let response: Response;

    switch (provider) {
      case 'twilio':
        // Twilio WhatsApp API
        const twilioAuth = btoa(`${process.env.TWILIO_ACCOUNT_SID}:${token}`);
        response = await fetch(`${apiUrl}/Messages.json`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Basic ${twilioAuth}`
          },
          body: new URLSearchParams({
            From: `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`,
            To: `whatsapp:${formattedNumber}`,
            Body: message
          })
        });
        break;

      case 'evolution':
        // Evolution API - Documentação: https://doc.evolution-api.com
        // Endpoint: POST /message/sendText/{instanceName}
        // Headers: apikey ou Authorization: Bearer {token}
        const evolutionHeaders: HeadersInit = {
          'Content-Type': 'application/json',
        };
        
        // Evolution API aceita apikey no header ou Authorization Bearer
        if (apiKey) {
          evolutionHeaders['apikey'] = apiKey;
        } else if (token) {
          evolutionHeaders['Authorization'] = `Bearer ${token}`;
        }
        
        // Garantir que a URL não tenha barra no final
        const evolutionUrl = apiUrl.replace(/\/$/, '');
        const evolutionEndpoint = `${evolutionUrl}/message/sendText/${instanceId}`;
        
        response = await fetch(evolutionEndpoint, {
          method: 'POST',
          headers: evolutionHeaders,
          body: JSON.stringify({
            number: formattedNumber,
            text: message
          })
        });
        break;

      case 'baileys':
        // Baileys API (similar ao Evolution)
        response = await fetch(`${apiUrl}/send-message`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token || apiKey}`
          },
          body: JSON.stringify({
            phone: formattedNumber,
            message: message
          })
        });
        break;

      case 'custom':
      default:
        // API customizada - espera formato padrão
        response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(apiKey && { 'Authorization': `Bearer ${apiKey}` }),
            ...(token && { 'X-API-Token': token })
          },
          body: JSON.stringify({
            to: formattedNumber,
            message: message,
            ...(instanceId && { instanceId })
          })
        });
        break;
    }

    if (!response.ok) {
      const errorText = await response.text();
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { message: errorText };
      }
      
      // Tratar erros específicos da Evolution API
      if (response.status === 400 && errorData.response?.message) {
        const messages = Array.isArray(errorData.response.message) 
          ? errorData.response.message 
          : [errorData.response.message];
        
        // Verificar se é erro de número não existente
        type MessageItem = {exists?: boolean; number?: string};
        const numberError = (messages as MessageItem[]).find((msg) => msg.exists === false || msg.number);
        if (numberError) {
          const errorMsg = `O número ${numberError.number || formattedNumber} não está registrado no WhatsApp. Verifique se o número está correto e se a pessoa tem WhatsApp instalado.`;
          console.error('❌ Erro ao enviar WhatsApp:', errorMsg);
          return { success: false, error: errorMsg };
        }
      }
      
      const errorMessage = errorData.error || errorData.message || errorText;
      console.error('❌ Erro ao enviar WhatsApp:', errorMessage);
      return { success: false, error: errorMessage };
    }

    console.log(`✅ WhatsApp enviado para ${formattedNumber}`);
    return { success: true };
  } catch (error) {
    console.error('❌ Erro ao enviar WhatsApp:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    };
  }
}

/**
 * Envia mensagem para múltiplos números
 */
export async function sendWhatsAppToMultiple(
  numbers: string[],
  message: string,
  config?: WhatsAppConfig
): Promise<Array<{ number: string; success: boolean; error?: string }>> {
  const results = await Promise.allSettled(
    numbers.map(number => sendWhatsAppMessage(number, message, config))
  );

  return numbers.map((number, index) => {
    const result = results[index];
    if (result.status === 'fulfilled') {
      return { number, ...result.value };
    } else {
      return { number, success: false, error: result.reason?.message || 'Erro desconhecido' };
    }
  });
}

/**
 * Formata número de telefone para formato internacional
 * Remove caracteres especiais e garante código do país
 */
function formatPhoneNumber(phone: string): string {
  // Remover todos os caracteres não numéricos
  let cleaned = phone.replace(/\D/g, '');

  // Se não começar com código do país (55 para Brasil), adicionar
  if (!cleaned.startsWith('55') && cleaned.length <= 11) {
    cleaned = '55' + cleaned;
  }

  return cleaned;
}

/**
 * Envia imagem via WhatsApp usando Evolution API
 */
export async function sendWhatsAppImage(
  to: string,
  imageUrl: string,
  caption?: string,
  config?: WhatsAppConfig
): Promise<{ success: boolean; error?: string }> {
  try {
    const provider = config?.provider || (process.env.WHATSAPP_PROVIDER as 'twilio' | 'evolution' | 'baileys' | 'custom' | undefined) || 'evolution';
    const apiUrl = config?.apiUrl || process.env.WHATSAPP_API_URL;
    const apiKey = config?.apiKey || process.env.WHATSAPP_API_KEY;
    const instanceId = config?.instanceId || process.env.WHATSAPP_INSTANCE_ID;
    const token = config?.token || process.env.WHATSAPP_TOKEN;

    if (!apiUrl) {
      console.warn('⚠️ WhatsApp API URL não configurada. Imagem não enviada.');
      return { success: false, error: 'WhatsApp API não configurada' };
    }

    if (!instanceId) {
      console.warn('⚠️ WhatsApp Instance ID não configurado. Imagem não enviada.');
      return { success: false, error: 'WhatsApp Instance ID não configurado' };
    }

    const formattedNumber = formatPhoneNumber(to);

    if (provider !== 'evolution') {
      return { success: false, error: 'Envio de imagens suportado apenas para Evolution API' };
    }

    console.log(`📤 Preparando envio de imagem via WhatsApp:`);
    console.log(`   URL da imagem: ${imageUrl.substring(0, 100)}...`);
    console.log(`   Número: ${formattedNumber}`);
    console.log(`   Instance ID: ${instanceId}`);

    // Verificar se a URL está acessível e tentar converter para base64 se necessário
    let mediaToSend = imageUrl;
    let useBase64 = false;

    try {
      const urlCheck = await fetch(imageUrl, { method: 'HEAD' });
      if (!urlCheck.ok) {
        console.warn(`⚠️ URL da imagem retornou status ${urlCheck.status}. Tentando converter para base64...`);
        // Tentar baixar a imagem e converter para base64
        try {
          const imageResponse = await fetch(imageUrl);
          if (imageResponse.ok) {
            const imageBuffer = await imageResponse.arrayBuffer();
            const base64 = Buffer.from(imageBuffer).toString('base64');
            const mimeType = imageResponse.headers.get('content-type') || 'image/jpeg';
            mediaToSend = `data:${mimeType};base64,${base64}`;
            useBase64 = true;
            console.log(`✅ Imagem convertida para base64 (tamanho: ${base64.length} caracteres)`);
          }
        } catch (base64Error) {
          console.warn(`⚠️ Não foi possível converter para base64:`, base64Error);
          console.warn(`   Tentando usar URL mesmo assim...`);
        }
      } else {
        console.log(`✅ URL da imagem está acessível (status ${urlCheck.status})`);
      }
    } catch (urlError) {
      console.warn(`⚠️ Não foi possível verificar a URL da imagem:`, urlError);
      // Tentar baixar e converter para base64 como fallback
      try {
        console.log(`🔄 Tentando baixar imagem e converter para base64...`);
        const imageResponse = await fetch(imageUrl);
        if (imageResponse.ok) {
          const imageBuffer = await imageResponse.arrayBuffer();
          const base64 = Buffer.from(imageBuffer).toString('base64');
          const mimeType = imageResponse.headers.get('content-type') || 'image/jpeg';
          mediaToSend = `data:${mimeType};base64,${base64}`;
          useBase64 = true;
          console.log(`✅ Imagem convertida para base64 (tamanho: ${base64.length} caracteres)`);
        }
      } catch (base64Error) {
        console.warn(`⚠️ Não foi possível converter para base64:`, base64Error);
        console.warn(`   Continuando com URL...`);
      }
    }

    const evolutionHeaders: HeadersInit = {
      'Content-Type': 'application/json',
    };
    
    if (apiKey) {
      evolutionHeaders['apikey'] = apiKey;
    } else if (token) {
      evolutionHeaders['Authorization'] = `Bearer ${token}`;
    }
    
    const evolutionUrl = apiUrl.replace(/\/$/, '');
    const evolutionEndpoint = `${evolutionUrl}/message/sendMedia/${instanceId}`;
    
    // Determinar o MIME type baseado na extensão ou URL
    const fileName = imageUrl.split('/').pop() || 'image.jpg';
    let mimeType = 'image/jpeg';
    if (fileName.endsWith('.png')) {
      mimeType = 'image/png';
    } else if (fileName.endsWith('.webp')) {
      mimeType = 'image/webp';
    } else if (fileName.endsWith('.gif')) {
      mimeType = 'image/gif';
    }

    // Se estiver usando base64, extrair o MIME type do data URI
    if (useBase64 && mediaToSend.startsWith('data:')) {
      const mimeMatch = mediaToSend.match(/data:([^;]+)/);
      if (mimeMatch) {
        mimeType = mimeMatch[1];
      }
    }

    // Evolution API espera os campos diretamente no body, não dentro de mediaMessage
    const requestBody = {
      number: formattedNumber,
      mediatype: 'image', // Tipo de mídia: image, video, document
      mimetype: mimeType, // MIME type: image/png, image/jpeg, etc
      fileName: fileName,
      caption: caption || '',
      media: mediaToSend // URL ou base64
    };

    if (useBase64) {
      console.log(`📦 Usando base64 para envio (MIME: ${mimeType}, primeiros 100 chars): ${mediaToSend.substring(0, 100)}...`);
    } else {
      console.log(`📦 Usando URL para envio (MIME: ${mimeType}): ${mediaToSend}`);
    }

    console.log(`📡 Enviando requisição para: ${evolutionEndpoint}`);
    console.log(`📦 Body:`, JSON.stringify(requestBody, null, 2));
    
    const response = await fetch(evolutionEndpoint, {
      method: 'POST',
      headers: evolutionHeaders,
      body: JSON.stringify(requestBody)
    });

    const responseText = await response.text();
    console.log(`📥 Resposta da Evolution API (status ${response.status}):`, responseText.substring(0, 500));

    if (!response.ok) {
      let errorData;
      try {
        errorData = JSON.parse(responseText);
      } catch {
        errorData = { message: responseText };
      }
      
      const errorMessage = errorData.error || errorData.message || responseText || `HTTP ${response.status}`;
      console.error('❌ Erro ao enviar imagem via WhatsApp:', errorMessage);
      console.error('   Detalhes completos:', JSON.stringify(errorData, null, 2));
      return { success: false, error: errorMessage };
    }

    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = { message: responseText };
    }

    console.log(`✅ Imagem enviada via WhatsApp para ${formattedNumber}`);
    console.log(`   Resposta:`, JSON.stringify(responseData, null, 2));
    return { success: true };
  } catch (error) {
    console.error('❌ Erro ao enviar imagem via WhatsApp:', error);
    console.error('   Stack:', error instanceof Error ? error.stack : 'N/A');
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    };
  }
}

/**
 * Formata mensagem de denúncia para WhatsApp
 */
export function formatDenunciaMessage(denuncia: {
  id: string;
  base: string;
  descricao: string;
  anonimo: boolean;
  email?: string;
  matricula?: string;
  evidencias_count: number;
}): string {
  const tipo = denuncia.anonimo ? '🔒 ANÔNIMA' : '👤 IDENTIFICADA';
  const contato = denuncia.anonimo 
    ? 'Sem informações de contato' 
    : `Email: ${denuncia.email || 'N/A'}\nMatrícula: ${denuncia.matricula || 'N/A'}`;

  return `🚨 *NOVA DENÚNCIA RECEBIDA*

${tipo}

*Base:* ${denuncia.base}
*ID:* ${denuncia.id}

*Descrição:*
${denuncia.descricao.substring(0, 500)}${denuncia.descricao.length > 500 ? '...' : ''}

*Contato:*
${contato}

*Evidências:* ${denuncia.evidencias_count} foto(s)

---
Acesse o sistema para mais detalhes.`;
}

