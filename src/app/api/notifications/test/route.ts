import { NextResponse } from 'next/server'
import { documentNotificationService } from '@/services/documentNotificationService'

export async function GET() {
  try {
    console.log('🧪 API: Testando sistema de notificações de vencimento')
    
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
