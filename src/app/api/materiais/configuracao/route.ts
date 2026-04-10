import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase'

// PATCH - Atualizar configurações de um material
export async function PATCH(request: NextRequest) {
  try {
    const supabase = createClient()
    const body = await request.json()

    const { materialId, conferirPortaria, requerPatrimonio } = body

    if (!materialId) {
      return NextResponse.json(
        { error: 'ID do material é obrigatório' },
        { status: 400 }
      )
    }

    const updateData: Record<string, boolean> = {}
    if (typeof conferirPortaria === 'boolean') {
      updateData.conferir_portaria = conferirPortaria
    }
    if (typeof requerPatrimonio === 'boolean') {
      updateData.requer_patrimonio = requerPatrimonio
    }

    const { data, error } = await supabase
      .from('lista_materiais')
      .update(updateData)
      .eq('id', materialId)
      .select()
      .single()

    if (error) {
      console.error('Erro ao atualizar material:', error)
      return NextResponse.json(
        { error: 'Erro ao atualizar material' },
        { status: 500 }
      )
    }

    return NextResponse.json({ data })
  } catch (error) {
    console.error('Erro na API de configuração de materiais:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
