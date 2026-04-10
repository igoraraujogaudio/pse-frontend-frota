import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = createClient();
    const { id: colaboradorId } = await params;

    // Buscar colaborador por matrícula ou ID
    const { data: colaborador, error } = await supabase
      .from('usuarios')
      .select(`
        id,
        nome,
        email,
        matricula,
        setor,
        ativo
      `)
      .or(`matricula.eq.${colaboradorId},id.eq.${colaboradorId}`)
      .eq('ativo', true)
      .single();

    if (error || !colaborador) {
      return NextResponse.json(
        { error: 'Colaborador não encontrado' },
        { status: 404 }
      );
    }

    return NextResponse.json(colaborador);
  } catch (error) {
    console.error('Erro ao buscar colaborador:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}