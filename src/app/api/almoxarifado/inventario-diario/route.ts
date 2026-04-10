import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

/**
 * API Route para buscar 5 itens aleatórios do estoque para inventário diário
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const baseId = searchParams.get('base_id')
    const contratoIds = searchParams.get('contrato_ids')?.split(',').filter(Boolean) || []

    // Construir query base
    let query = supabase
      .from('itens_estoque')
      .select(`
        id,
        item_catalogo_id,
        base_id,
        estoque_atual,
        estoque_minimo,
        localizacao_base,
        observacoes_base,
        status,
        criado_em,
        atualizado_em,
        item_catalogo:itens_catalogo(
          id,
          nome,
          codigo,
          categoria,
          requer_laudo,
          descricao,
          unidade_medida
        ),
        base:bases(
          id,
          nome,
          codigo
        )
      `)
      .eq('status', 'ativo')
      .gt('estoque_atual', 0) // Apenas itens com estoque disponível

    // Filtrar por contratos se especificado
    // Primeiro buscar as bases dos contratos, depois filtrar itens por essas bases
    let baseIdsParaFiltrar: string[] = []
    
    if (contratoIds.length > 0) {
      const { data: bases, error: basesError } = await supabase
        .from('bases')
        .select('id')
        .in('contrato_id', contratoIds)
        .eq('ativa', true)
      
      if (basesError) {
        console.error('❌ Erro ao buscar bases dos contratos:', basesError)
      } else {
        baseIdsParaFiltrar = bases?.map(b => b.id) || []
      }
    }
    
    // Filtrar por base se especificado
    if (baseId) {
      query = query.eq('base_id', baseId)
    } else if (baseIdsParaFiltrar.length > 0) {
      // Filtrar apenas itens das bases dos contratos do usuário
      query = query.in('base_id', baseIdsParaFiltrar)
    }

    // Buscar todos os itens que atendem aos critérios
    const { data: allItems, error } = await query

    if (error) {
      console.error('❌ Erro ao buscar itens para inventário diário:', error)
      return NextResponse.json(
        { error: 'Erro ao buscar itens do estoque', details: error.message },
        { status: 500 }
      )
    }

    if (!allItems || allItems.length === 0) {
      return NextResponse.json(
        { items: [], message: 'Nenhum item encontrado no estoque' },
        { status: 200 }
      )
    }

    // Selecionar 5 itens aleatórios
    const shuffled = [...allItems].sort(() => 0.5 - Math.random())
    const randomItems = shuffled.slice(0, Math.min(5, shuffled.length))

    console.log(`✅ [API] Inventário Diário: ${randomItems.length} itens selecionados aleatoriamente`)

    return NextResponse.json({
      items: randomItems,
      total_disponivel: allItems.length,
      selecionados: randomItems.length
    })
  } catch (error) {
    console.error('❌ Erro inesperado ao gerar inventário diário:', error)
    return NextResponse.json(
      { error: 'Erro inesperado ao gerar inventário diário', details: error instanceof Error ? error.message : 'Erro desconhecido' },
      { status: 500 }
    )
  }
}

/**
 * API Route para salvar/atualizar o resultado do inventário diário
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { item_id, quantidade_verificada, observacoes, usuario_id } = body

    if (!item_id || quantidade_verificada === undefined) {
      return NextResponse.json(
        { error: 'item_id e quantidade_verificada são obrigatórios' },
        { status: 400 }
      )
    }

    // Verificar se já existe um registro de inventário diário para hoje
    const hoje = new Date().toISOString().split('T')[0]
    
    const { data: existingRecord, error: checkError } = await supabase
      .from('inventario_diario')
      .select('id')
      .eq('item_estoque_id', item_id)
      .eq('data_inventario', hoje)
      .maybeSingle()

    if (checkError && checkError.code !== 'PGRST116') {
      console.error('❌ Erro ao verificar registro existente:', checkError)
      return NextResponse.json(
        { error: 'Erro ao verificar registro existente', details: checkError.message },
        { status: 500 }
      )
    }

    const recordData = {
      item_estoque_id: item_id,
      quantidade_verificada,
      observacoes: observacoes || null,
      usuario_id: usuario_id || null,
      data_inventario: hoje,
      atualizado_em: new Date().toISOString()
    }

    let result
    if (existingRecord) {
      // Atualizar registro existente
      const { data, error } = await supabase
        .from('inventario_diario')
        .update(recordData)
        .eq('id', existingRecord.id)
        .select()
        .single()

      if (error) throw error
      result = data
    } else {
      // Criar novo registro
      const { data, error } = await supabase
        .from('inventario_diario')
        .insert({
          ...recordData,
          criado_em: new Date().toISOString()
        })
        .select()
        .single()

      if (error) throw error
      result = data
    }

    console.log(`✅ [API] Inventário diário ${existingRecord ? 'atualizado' : 'criado'} para item ${item_id}`)

    return NextResponse.json({
      success: true,
      data: result
    })
  } catch (error) {
    console.error('❌ Erro ao salvar inventário diário:', error)
    return NextResponse.json(
      { error: 'Erro ao salvar inventário diário', details: error instanceof Error ? error.message : 'Erro desconhecido' },
      { status: 500 }
    )
  }
}

