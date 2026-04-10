import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET() {
  try {
    // Future implementation: filtering by contract IDs
    // const { searchParams } = new URL(request.url)
    // const contratoIds = searchParams.get('contrato_ids')?.split(',') || []

    // Buscar inventários de funcionários (simplificado)
    console.log('🔍 [API] Buscando inventários de funcionários...')
    const { data: inventariosFuncionarios, error: errorFuncionarios } = await supabase
      .from('inventario_funcionario')
      .select('id, funcionario_id, item_estoque_id, quantidade, status, data_vencimento')

    if (errorFuncionarios) {
      console.error('❌ [API] Erro ao buscar inventários de funcionários:', errorFuncionarios)
    } else {
      console.log('✅ [API] Inventários de funcionários encontrados:', inventariosFuncionarios?.length || 0)
      console.log('📊 [API] Dados dos funcionários:', inventariosFuncionarios)
    }

    // Buscar inventários de equipes (simplificado)
    console.log('🔍 [API] Buscando inventários de equipes...')
    const { data: inventariosEquipes, error: errorEquipes } = await supabase
      .from('inventario_equipe')
      .select('id, equipe_id, item_estoque_id, quantidade_total, quantidade_disponivel, quantidade_em_uso, status, data_entrega')

    if (errorEquipes) {
      console.error('❌ [API] Erro ao buscar inventários de equipes:', errorEquipes)
    } else {
      console.log('✅ [API] Inventários de equipes encontrados:', inventariosEquipes?.length || 0)
      console.log('📊 [API] Dados das equipes:', inventariosEquipes)
    }

    // Buscar total de equipes (simplificado)
    console.log('🔍 [API] Buscando total de equipes...')
    const { count: totalEquipes, error: errorTotalEquipes } = await supabase
      .from('equipes')
      .select('id', { count: 'exact' })

    if (errorTotalEquipes) {
      console.error('❌ [API] Erro ao buscar total de equipes:', errorTotalEquipes)
    } else {
      console.log('✅ [API] Total de equipes:', totalEquipes || 0)
    }

    // Buscar total de funcionários (apenas não demitidos)
    console.log('🔍 [API] Buscando total de funcionários (não demitidos)...')
    const { count: totalFuncionarios, error: errorTotalFuncionarios } = await supabase
      .from('usuarios')
      .select('id', { count: 'exact' })
      .eq('nivel_acesso', 'operacao')
      .neq('status', 'demitido')

    if (errorTotalFuncionarios) {
      console.error('❌ [API] Erro ao buscar total de funcionários:', errorTotalFuncionarios)
    } else {
      console.log('✅ [API] Total de funcionários:', totalFuncionarios || 0)
    }

    // Calcular estatísticas reais
    const funcionariosComInventario = inventariosFuncionarios?.length || 0
    const equipesComInventario = inventariosEquipes?.length || 0

    // Contar itens distribuídos (somar quantidades de todos os itens)
    let itensDistribuidos = 0
    
    console.log('🔍 [API] Calculando itens distribuídos...')
    
    inventariosFuncionarios?.forEach(inv => {
      const quantidade = inv.quantidade || 0
      itensDistribuidos += quantidade
      console.log(`  - Funcionário: +${quantidade} itens`)
    })

    inventariosEquipes?.forEach(inv => {
      const quantidade = inv.quantidade_total || 0
      itensDistribuidos += quantidade
      console.log(`  - Equipe: +${quantidade} itens`)
    })
    
    console.log('✅ [API] Total itens distribuídos:', itensDistribuidos)

    // Contar laudos vencendo (simplificado por enquanto)
    console.log('🔍 [API] Calculando laudos vencendo...')
    const dataLimite = new Date()
    dataLimite.setDate(dataLimite.getDate() + 30)
    const dataLimiteStr = dataLimite.toISOString().split('T')[0]

    let laudosVencendo = 0

    inventariosFuncionarios?.forEach(inv => {
      if (inv.data_vencimento && inv.data_vencimento <= dataLimiteStr) {
        laudosVencendo++
      }
    })
    
    console.log('✅ [API] Laudos vencendo:', laudosVencendo)

    const stats = {
      equipes_total: totalEquipes || 0,
      equipes_atualizadas: equipesComInventario,
      funcionarios_total: totalFuncionarios || 0,
      funcionarios_atualizados: funcionariosComInventario,
      itens_distribuidos: itensDistribuidos,
      laudos_vencendo: laudosVencendo
    }

    console.log('🎯 [API] Estatísticas finais:', stats)
    return NextResponse.json(stats)

  } catch (error) {
    console.error('Erro ao buscar estatísticas de inventários:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
