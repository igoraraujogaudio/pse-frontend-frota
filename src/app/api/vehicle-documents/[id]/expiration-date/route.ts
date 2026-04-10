import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: documentId } = await params;
    const body = await request.json();
    const { expira_em } = body;

    if (!expira_em) {
      return NextResponse.json(
        { error: 'Data de expiração é obrigatória' },
        { status: 400 }
      );
    }

    // Validar formato da data
    const expirationDate = new Date(expira_em);
    if (isNaN(expirationDate.getTime())) {
      return NextResponse.json(
        { error: 'Formato de data inválido' },
        { status: 400 }
      );
    }

    // Atualizar apenas a data de expiração do documento
    const { data, error } = await supabase
      .from('documentos_veiculo')
      .update({ 
        expira_em: expira_em,
        atualizado_em: new Date().toISOString()
      })
      .eq('id', documentId)
      .select()
      .single();

    if (error) {
      console.error('Erro ao atualizar data de expiração:', error);
      return NextResponse.json(
        { error: 'Erro ao atualizar data de expiração' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: 'Data de expiração atualizada com sucesso',
      data
    });

  } catch (error) {
    console.error('Erro no endpoint de atualização de data:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
