import { NextRequest, NextResponse } from 'next/server'
import { documentNotificationService } from '@/services/documentNotificationService'

export async function POST(req: NextRequest) {
  try {
    console.log('🔔 API: Iniciando processamento de notificações de vencimento')
    
    // Verificar se é uma chamada autorizada usando a chave de serviço do Supabase
    const authHeader = req.headers.get('authorization')
    const expectedToken = process.env.SUPABASE_SERVICE_ROLE_KEY
    
    if (expectedToken && authHeader !== `Bearer ${expectedToken}`) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      )
    }

    // Processar notificações de vencimento
    await documentNotificationService.processDocumentExpirationNotifications()
    
    return NextResponse.json({
      success: true,
      message: 'Notificações de vencimento processadas com sucesso',
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ Erro na API de notificações:', error)
    return NextResponse.json(
      { 
        error: 'Erro interno do servidor',
        details: error instanceof Error ? error.message : 'Erro desconhecido'
      },
      { status: 500 }
    )
  }
}

// Método GET para testar o sistema
export async function GET(req: NextRequest) {
  try {
    console.log('🧪 API: Testando sistema de notificações')
    
    // Verificar se é uma chamada autorizada usando a chave de serviço do Supabase
    const authHeader = req.headers.get('authorization')
    const expectedToken = process.env.SUPABASE_SERVICE_ROLE_KEY
    
    if (expectedToken && authHeader !== `Bearer ${expectedToken}`) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      )
    }

    // Executar teste do sistema
    await documentNotificationService.testNotificationSystem()
    
    return NextResponse.json({
      success: true,
      message: 'Teste do sistema de notificações executado com sucesso',
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ Erro no teste da API de notificações:', error)
    return NextResponse.json(
      { 
        error: 'Erro interno do servidor',
        details: error instanceof Error ? error.message : 'Erro desconhecido'
      },
      { status: 500 }
    )
  }
}
