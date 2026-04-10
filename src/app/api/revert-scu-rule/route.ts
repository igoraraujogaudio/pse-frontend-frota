import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST() {
  try {
    // Reverter: adicionar contrato_id de volta na regra "SCU IVECO"
    const { error } = await supabase
      .from('regras_documentacao_veiculo')
      .update({ 
        contrato_id: '8b9320d7-7e06-4218-bb47-d48b3e5958b3', // Niterói
        atualizado_em: new Date().toISOString()
      })
      .eq('descricao', 'SCU IVECO');

    if (error) {
      console.error('Erro ao reverter regra SCU:', error);
      return NextResponse.json(
        { error: 'Erro ao reverter regra SCU' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Regra SCU IVECO revertida - voltou a ser específica do contrato Niterói'
    });

  } catch (error) {
    console.error('Erro na API revert-scu-rule:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
