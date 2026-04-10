import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: 'id é obrigatório' },
        { status: 400 }
      );
    }

    // Soft delete: marcar como inativo
    const { error } = await supabase
      .from('biometric_templates')
      .update({ ativo: false })
      .eq('id', id);

    if (error) {
      console.error('Erro ao deletar template:', error);
      return NextResponse.json(
        { error: 'Erro ao deletar template' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Template deletado com sucesso',
    });
  } catch (error) {
    console.error('Erro ao deletar template:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

