import { NextRequest, NextResponse } from 'next/server';
import { sendWhatsAppMessage } from '@/lib/whatsapp';

/**
 * POST /api/evolution/test-send
 * Endpoint para testar envio de mensagem via Evolution API
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { number, message } = body;

    if (!number) {
      return NextResponse.json(
        { error: 'Número é obrigatório' },
        { status: 400 }
      );
    }

    const testMessage = message || `🧪 *TESTE DE CONFIGURAÇÃO*

Esta é uma mensagem de teste do sistema de denúncias PSE.

Se você recebeu esta mensagem, a configuração está funcionando corretamente! ✅

Data: ${new Date().toLocaleString('pt-BR')}`;

    const result = await sendWhatsAppMessage(number, testMessage);

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: 'Mensagem de teste enviada com sucesso!',
        number: number
      });
    } else {
      // Determinar status HTTP baseado no tipo de erro
      const isClientError = result.error?.includes('não está registrado') || 
                           result.error?.includes('não existe') ||
                           result.error?.includes('Bad Request');
      
      return NextResponse.json(
        {
          success: false,
          error: result.error || 'Erro ao enviar mensagem',
          number: number,
          hint: result.error?.includes('não está registrado') 
            ? 'Verifique se o número está correto e se a pessoa tem WhatsApp instalado e ativo.'
            : undefined
        },
        { status: isClientError ? 400 : 500 }
      );
    }
  } catch (error) {
    console.error('❌ Erro ao testar envio:', error);
    return NextResponse.json(
      {
        error: 'Erro ao testar envio',
        details: error instanceof Error ? error.message : 'Erro desconhecido'
      },
      { status: 500 }
    );
  }
}





