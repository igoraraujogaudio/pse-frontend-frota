import { NextRequest, NextResponse } from 'next/server';
import { sendWhatsAppMessage } from '@/lib/whatsapp';

/**
 * GET /api/denuncias/test-whatsapp?number=5511999999999
 * Endpoint de teste para verificar configuração do WhatsApp
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const testNumber = searchParams.get('number');

    if (!testNumber) {
      return NextResponse.json(
        { 
          error: 'Número não fornecido',
          usage: 'Use: /api/denuncias/test-whatsapp?number=5511999999999'
        },
        { status: 400 }
      );
    }

    // Verificar se está configurado
    const apiUrl = process.env.WHATSAPP_API_URL;
    const apiKey = process.env.WHATSAPP_API_KEY;
    const instanceId = process.env.WHATSAPP_INSTANCE_ID;
    const provider = process.env.WHATSAPP_PROVIDER || 'evolution';

    if (!apiUrl) {
      return NextResponse.json(
        { 
          error: 'WhatsApp não configurado',
          message: 'Configure as variáveis de ambiente primeiro',
          required: {
            WHATSAPP_API_URL: 'URL da API do WhatsApp',
            WHATSAPP_API_KEY: 'API Key',
            WHATSAPP_INSTANCE_ID: 'Instance ID (para Evolution API)',
            WHATSAPP_PROVIDER: 'Provedor (evolution, twilio, etc)'
          }
        },
        { status: 400 }
      );
    }

    // Enviar mensagem de teste
    const testMessage = `🧪 *TESTE DE CONFIGURAÇÃO*

Esta é uma mensagem de teste do sistema de denúncias PSE.

Se você recebeu esta mensagem, a configuração está funcionando corretamente! ✅

Data: ${new Date().toLocaleString('pt-BR')}`;

    const result = await sendWhatsAppMessage(testNumber, testMessage);

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: 'Mensagem de teste enviada com sucesso!',
        config: {
          provider,
          apiUrl: apiUrl.replace(/\/$/, ''),
          hasApiKey: !!apiKey,
          hasInstanceId: !!instanceId
        }
      });
    } else {
      return NextResponse.json(
        {
          success: false,
          error: result.error,
          config: {
            provider,
            apiUrl: apiUrl.replace(/\/$/, ''),
            hasApiKey: !!apiKey,
            hasInstanceId: !!instanceId
          }
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('❌ Erro ao testar WhatsApp:', error);
    return NextResponse.json(
      {
        error: 'Erro ao testar WhatsApp',
        details: error instanceof Error ? error.message : 'Erro desconhecido'
      },
      { status: 500 }
    );
  }
}























