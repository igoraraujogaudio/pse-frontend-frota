import { NextRequest, NextResponse } from 'next/server';

// Armazenamento temporário de confirmações (em produção, usar Redis ou banco)
const confirmations = new Map<string, {
  confirmed: boolean;
  error?: string;
  biometricData?: {
    template: string;
    quality: number;
    image_base64?: string;
    isNewRegistration?: boolean;
    multiCapture?: Array<{ template: string; quality: number; image_base64?: string }>;
    validated?: boolean; // Flag indicando que já foi validado pelo desktop
    similarity?: number; // Similaridade da validação
  };
  timestamp: number;
}>();

// Limpar confirmações antigas (mais de 5 minutos)
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of confirmations.entries()) {
    if (now - value.timestamp > 5 * 60 * 1000) {
      confirmations.delete(key);
    }
  }
}, 60000); // Verificar a cada minuto

/**
 * GET /api/desktop/entrega/[id]/status
 * Verifica se há confirmação pendente para a solicitação
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const confirmation = confirmations.get(id);
    
    if (confirmation) {
      if (confirmation.error) {
        // Não remover erro imediatamente - manter por 30 segundos para garantir que seja lido
        // Só remover se for muito antigo (mais de 5 minutos)
        const now = Date.now();
        const errorAge = now - confirmation.timestamp;
        
        // Se o erro foi lido recentemente (menos de 30 segundos), manter
        // Se for muito antigo (mais de 5 minutos), remover
        if (errorAge > 5 * 60 * 1000) {
          confirmations.delete(id);
        }
        
        const response = NextResponse.json({
          confirmed: false,
          error: confirmation.error,
          hasError: true, // Flag para indicar que há erro
        });
        response.headers.set('Access-Control-Allow-Origin', '*');
        response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        response.headers.set('Access-Control-Allow-Headers', 'Content-Type');
        return response;
      }
      
      if (confirmation.confirmed) {
        // Não remover confirmação imediatamente - manter por 30 segundos para garantir que seja lida
        // Só remover se for muito antiga (mais de 5 minutos)
        const now = Date.now();
        const confirmationAge = now - confirmation.timestamp;
        
        // Se a confirmação foi lida recentemente (menos de 30 segundos), manter
        // Se for muito antiga (mais de 5 minutos), remover
        if (confirmationAge > 5 * 60 * 1000) {
          confirmations.delete(id);
        }
        
        const response = NextResponse.json({
          confirmed: true,
          biometricData: confirmation.biometricData,
        });
        response.headers.set('Access-Control-Allow-Origin', '*');
        response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        response.headers.set('Access-Control-Allow-Headers', 'Content-Type');
        return response;
      }
    }
    
    const response = NextResponse.json({
      confirmed: false,
    });
    response.headers.set('Access-Control-Allow-Origin', '*');
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type');
    return response;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro ao verificar status';
    const errorResponse = NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
    errorResponse.headers.set('Access-Control-Allow-Origin', '*');
    return errorResponse;
  }
}

// Handler OPTIONS para CORS preflight
export async function OPTIONS() {
  const response = new NextResponse(null, { status: 200 });
  response.headers.set('Access-Control-Allow-Origin', '*');
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type');
  return response;
}

/**
 * POST /api/desktop/entrega/[id]/status
 * Define confirmação da entrega (chamado pelo desktop)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { biometricData, error, clear } = body;
    
    // Se clear for true, limpar confirmação anterior
    if (clear) {
      confirmations.delete(id);
      const response = NextResponse.json({
        success: true,
        message: 'Confirmação limpa',
      });
      response.headers.set('Access-Control-Allow-Origin', '*');
      response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      response.headers.set('Access-Control-Allow-Headers', 'Content-Type');
      return response;
    }
    
    if (error) {
      // Salvar erro
      confirmations.set(id, {
        confirmed: false,
        error,
        timestamp: Date.now(),
      });
    } else {
      // Salvar confirmação
      confirmations.set(id, {
        confirmed: true,
        biometricData,
        timestamp: Date.now(),
      });
    }
    
    const response = NextResponse.json({
      success: true,
      message: error ? 'Erro registrado' : 'Confirmação registrada',
    });
    response.headers.set('Access-Control-Allow-Origin', '*');
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type');
    return response;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro ao registrar confirmação';
    const errorResponse = NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
    errorResponse.headers.set('Access-Control-Allow-Origin', '*');
    return errorResponse;
  }
}

