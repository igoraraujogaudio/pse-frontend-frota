import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST() {
  try {
    // Remover contrato_id da regra "SCU IVECO" para que ela se aplique apenas aos prefixos SCU
    const { error } = await supabase
      .from('regras_documentacao_veiculo')
      .update({ 
        contrato_id: null,
        atualizado_em: new Date().toISOString()
      })
      .eq('descricao', 'SCU IVECO');

    if (error) {
      console.error('Erro ao corrigir regra SCU:', error);
      return NextResponse.json(
        { error: 'Erro ao corrigir regra SCU' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Regra SCU IVECO corrigida - agora se aplica apenas aos prefixos SCU, não ao contrato Niterói'
    });

  } catch (error) {
    console.error('Erro na API fix-scu-rule:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
