import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const { matricula } = await request.json();

    if (!matricula) {
      return NextResponse.json(
        { error: 'Matrícula é obrigatória' },
        { status: 400 }
      );
    }

    const supabase = createClient();

    const { data, error } = await supabase
      .from('usuarios')
      .select('email')
      .eq('matricula', matricula)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: 'Matrícula não encontrada' },
        { status: 404 }
      );
    }

    return NextResponse.json({ email: data.email });
  } catch (error) {
    console.error('Erro ao buscar email por matrícula:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar email' },
      { status: 500 }
    );
  }
}
