import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    // Verificar se é uma chamada autorizada usando a chave de serviço do Supabase
    const authHeader = request.headers.get('authorization')
    const expectedToken = process.env.SUPABASE_SERVICE_ROLE_KEY
    
    if (expectedToken && authHeader !== `Bearer ${expectedToken}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('🔄 Iniciando processamento de notificações de documentos de veículos...')

    // Executar a função de processamento de notificações
    const { error } = await supabase.rpc('processar_notificacoes_documentos_veiculos')

    if (error) {
      console.error('❌ Erro ao executar função de notificações:', error)
      return NextResponse.json({ 
        success: false, 
        error: error.message 
      }, { status: 500 })
    }

    // Verificar quantas notificações foram criadas hoje
    const { data: notificationsCount, error: countError } = await supabase
      .from('notificacoes')
      .select('id', { count: 'exact' })
      .eq('tipo', 'vehicle_document_expiration')
      .gte('criado_em', new Date().toISOString().split('T')[0])

    if (countError) {
      console.error('❌ Erro ao contar notificações:', countError)
    }

    console.log('✅ Processamento de notificações concluído')
    
    return NextResponse.json({ 
      success: true, 
      message: 'Notificações processadas com sucesso',
      notificationsCreated: notificationsCount?.length || 0,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ Erro geral no processamento:', error)
    return NextResponse.json({ 
      success: false, 
      error: 'Erro interno do servidor' 
    }, { status: 500 })
  }
}

// Método GET para teste manual
export async function GET() {
  try {
    console.log('🧪 Testando função de notificações...')
    
    const { error } = await supabase.rpc('processar_notificacoes_documentos_veiculos')

    if (error) {
      return NextResponse.json({ 
        success: false, 
        error: error.message 
      }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Teste executado com sucesso',
      timestamp: new Date().toISOString()
    })

  } catch {
    return NextResponse.json({ 
      success: false, 
      error: 'Erro interno do servidor' 
    }, { status: 500 })
  }
}