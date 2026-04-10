import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase'

const CONTRATO_NITEROI_ID = '8b9320d7-7e06-4218-bb47-d48b3e5958b3'

// GET - Buscar saídas de material pendentes de conferência por veículo/equipe
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    const { searchParams } = new URL(request.url)
    const veiculoPlaca = searchParams.get('veiculoPlaca')
    const equipeId = searchParams.get('equipeId')

    if (!veiculoPlaca && !equipeId) {
      return NextResponse.json(
        { error: 'Placa do veículo ou ID da equipe é obrigatório' },
        { status: 400 }
      )
    }

    let query = supabase
      .from('saida_materiais')
      .select(`
        id,
        contrato_id,
        equipe_id,
        responsavel_id,
        data_entrega,
        status,
        observacoes,
        veiculo_placa,
        equipe:equipes!equipe_id(id, nome),
        responsavel:usuarios!responsavel_id(id, nome),
        itens:saida_materiais_itens(
          id,
          material_id,
          quantidade,
          unidade_medida,
          observacoes,
          patrimonio,
          conferido_portaria,
          observacoes_conferencia,
          material:lista_materiais!material_id(
            id,
            numero_material,
            descricao_material,
            unidade_medida,
            conferir_portaria,
            requer_patrimonio
          )
        )
      `)
      .eq('contrato_id', CONTRATO_NITEROI_ID)
      .eq('status', 'entregue')
      .order('data_entrega', { ascending: false })

    if (veiculoPlaca) {
      // Buscar por placa do veículo associado à equipe
      const { data: equipeVeiculo } = await supabase
        .from('equipe_veiculos')
        .select('equipe_id, veiculos!veiculo_id(placa)')
        .eq('veiculos.placa', veiculoPlaca)
        .single()

      if (equipeVeiculo) {
        query = query.eq('equipe_id', equipeVeiculo.equipe_id)
      } else {
        return NextResponse.json({ data: [] })
      }
    } else if (equipeId) {
      query = query.eq('equipe_id', equipeId)
    }

    const { data, error } = await query

    if (error) {
      console.error('Erro ao buscar saídas pendentes:', error)
      return NextResponse.json(
        { error: 'Erro ao buscar saídas pendentes' },
        { status: 500 }
      )
    }

    return NextResponse.json({ data })
  } catch (error) {
    console.error('Erro na API de conferência:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

// POST - Conferir saída de material (aprovar ou bloquear)
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    const body = await request.json()

    const {
      saidaMaterialId,
      usuarioPortariaId,
      veiculoPlaca,
      itens,
      observacoesGerais,
    } = body

    if (!saidaMaterialId || !usuarioPortariaId || !veiculoPlaca || !itens) {
      return NextResponse.json(
        { error: 'Dados incompletos para conferência' },
        { status: 400 }
      )
    }

    interface ConferenciaItem {
  itemId: string;
  conferido: boolean;
  observacoes?: string;
}

    // Verificar se todos os itens foram conferidos como OK
    const todosOk = itens.every((item: ConferenciaItem) => item.conferido === true)
    const novoStatus = todosOk ? 'conferida_portaria' : 'bloqueada_portaria'

    // Atualizar status da saída de material
    const { error: updateError } = await supabase
      .from('saida_materiais')
      .update({
        status: novoStatus,
        conferido_portaria_por: usuarioPortariaId,
        conferido_portaria_em: new Date().toISOString(),
        observacoes_portaria: observacoesGerais,
        veiculo_placa: veiculoPlaca,
        updated_at: new Date().toISOString(),
      })
      .eq('id', saidaMaterialId)
      .eq('contrato_id', CONTRATO_NITEROI_ID)

    if (updateError) {
      console.error('Erro ao atualizar saída de material:', updateError)
      return NextResponse.json(
        { error: 'Erro ao atualizar saída de material' },
        { status: 500 }
      )
    }

    // Atualizar cada item com o status de conferência
    for (const item of itens) {
      const { error: itemError } = await supabase
        .from('saida_materiais_itens')
        .update({
          conferido_portaria: item.conferido,
          observacoes_conferencia: item.observacoes || null,
        })
        .eq('id', item.itemId)

      if (itemError) {
        console.error('Erro ao atualizar item:', itemError)
      }
    }

    return NextResponse.json({
      success: true,
      status: novoStatus,
      message: todosOk
        ? 'Saída de material conferida e aprovada'
        : 'Saída de material bloqueada - requer nova ordem do almoxarifado',
    })
  } catch (error) {
    console.error('Erro ao conferir saída:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
