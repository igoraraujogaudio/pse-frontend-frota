import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const body = await request.json();
    const { id } = await params;

    const { data, error } = await supabase
      .from('cargos')
      .update({
        nivel_acesso: body.nivel_acesso,
        perfil_acesso_id: body.perfil_acesso_id,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Erro ao atualizar cargo:', error);
      return NextResponse.json({ error: 'Erro ao atualizar cargo' }, { status: 500 });
    }

    return NextResponse.json({ cargo: data });
  } catch (error) {
    console.error('Erro interno:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    const { data, error } = await supabase
      .from('cargos')
      .update({
        ativo: false,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Erro ao desativar cargo:', error);
      return NextResponse.json({ error: 'Erro ao desativar cargo' }, { status: 500 });
    }

    return NextResponse.json({ cargo: data });
  } catch (error) {
    console.error('Erro interno:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
