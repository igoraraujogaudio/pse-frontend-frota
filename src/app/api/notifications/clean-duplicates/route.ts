import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
}

export async function POST(request: NextRequest) {
  try {
    // Verificar autorização
    const authHeader = request.headers.get('authorization')
    const expectedToken = process.env.CRON_SECRET_TOKEN || 'default-secret-token'
    
    if (authHeader !== `Bearer ${expectedToken}`) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    console.log('🧹 Iniciando limpeza de notificações duplicadas...')

    const hoje = new Date().toISOString().split('T')[0]

    // 1. Contar notificações antes da limpeza
    const { count: totalAntes, error: errorAntes } = await getSupabase()
      .from('notificacoes')
      .select('*', { count: 'exact', head: true })
      .gte('criado_em', hoje + 'T00:00:00.000Z')
      .lt('criado_em', hoje + 'T23:59:59.999Z')

    if (errorAntes) {
      console.error('❌ Erro ao contar notificações:', errorAntes)
      return NextResponse.json({ error: 'Erro ao contar notificações' }, { status: 500 })
    }

    console.log(`📊 Total de notificações hoje antes da limpeza: ${totalAntes || 0}`)

    // 2. Buscar todas as notificações de hoje
    const { data: notificacoes, error: errorBusca } = await getSupabase()
      .from('notificacoes')
      .select('*')
      .gte('criado_em', hoje + 'T00:00:00.000Z')
      .lt('criado_em', hoje + 'T23:59:59.999Z')
      .order('criado_em', { ascending: false })

    if (errorBusca) {
      console.error('❌ Erro ao buscar notificações:', errorBusca)
      return NextResponse.json({ error: 'Erro ao buscar notificações' }, { status: 500 })
    }

    // 3. Identificar e remover duplicatas
    const seen = new Set()
    const idsParaRemover: string[] = []

    for (const notif of notificacoes || []) {
      const chave = `${notif.usuario_id}-${notif.titulo}-${notif.dados?.funcionarioId}-${notif.dados?.documento}-${notif.dados?.status}`
      
      if (seen.has(chave)) {
        idsParaRemover.push(notif.id)
      } else {
        seen.add(chave)
      }
    }

    console.log(`🔍 Encontradas ${idsParaRemover.length} notificações duplicadas para remover`)

    // 4. Remover duplicatas
    if (idsParaRemover.length > 0) {
      const { error: errorDelete } = await getSupabase()
        .from('notificacoes')
        .delete()
        .in('id', idsParaRemover)

      if (errorDelete) {
        console.error('❌ Erro ao remover duplicatas:', errorDelete)
        return NextResponse.json({ error: 'Erro ao remover duplicatas' }, { status: 500 })
      }
    }

    // 5. Contar notificações após a limpeza
    const { count: totalDepois } = await getSupabase()
      .from('notificacoes')
      .select('*', { count: 'exact', head: true })
      .gte('criado_em', hoje + 'T00:00:00.000Z')
      .lt('criado_em', hoje + 'T23:59:59.999Z')

    const removidas = (totalAntes || 0) - (totalDepois || 0)

    console.log(`✅ Limpeza concluída: ${removidas} notificações duplicadas removidas`)

    return NextResponse.json({
      message: 'Limpeza de duplicatas concluída com sucesso',
      total_antes: totalAntes || 0,
      total_depois: totalDepois || 0,
      duplicatas_removidas: idsParaRemover.length
    })

  } catch (error) {
    console.error('❌ Erro na limpeza de duplicatas:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
