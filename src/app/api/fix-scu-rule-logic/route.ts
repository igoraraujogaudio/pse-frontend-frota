import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST() {
  try {
    // A solução é: a regra "SCU IVECO" não deveria ter contrato_id
    // Ela deveria ser apenas uma regra de múltiplos prefixos "SCU"
    // Vou remover o contrato_id da regra "SCU IVECO"
    
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
      message: 'Regra SCU IVECO corrigida! Agora se aplica apenas aos prefixos SCU, não ao contrato Niterói.'
    });

  } catch (error) {
    console.error('Erro na API fix-scu-rule-logic:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
