import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST() {
  try {
    // Apenas corrigir a ordem de prioridade na função existente
    const { error } = await supabase
      .from('regras_documentacao_veiculo')
      .update({ 
        atualizado_em: new Date().toISOString()
      })
      .eq('descricao', 'MUNCK DESCONSIDERAR ELÉTRICO - CORRIGIDO');

    if (error) {
      console.error('Erro ao atualizar regra MUNCK:', error);
      return NextResponse.json(
        { error: 'Erro ao atualizar regra MUNCK' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Regra MUNCK atualizada - agora deve ter prioridade sobre contrato específico'
    });

  } catch (error) {
    console.error('Erro na API fix-priority-order:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
