import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('cargos')
      .select(`
        id,
        nome,
        nivel_acesso,
        ativo,
        created_at,
        updated_at,
        perfil_acesso_id,
        perfis_acesso (
          id,
          codigo,
          nome,
          descricao,
          nivel_hierarquia,
          cor
        )
      `)
      .eq('ativo', true)
      .order('nome');

    if (error) {
      console.error('Erro ao buscar cargos:', error);
      return NextResponse.json({ 
        error: 'Erro ao buscar cargos',
        details: error.message
      }, { status: 500 });
    }

    return NextResponse.json({ cargos: data || [] });
  } catch (error) {
    console.error('Erro interno:', error);
    return NextResponse.json({ 
      error: 'Erro interno do servidor',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    const { data, error } = await supabase
      .from('cargos')
      .insert({
        nome: body.nome,
        nivel_acesso: body.nivel_acesso,
        perfil_acesso_id: body.perfil_acesso_id,
        ativo: true
      })
      .select()
      .single();

    if (error) {
      console.error('Erro ao criar cargo:', error);
      return NextResponse.json({ error: 'Erro ao criar cargo' }, { status: 500 });
    }

    return NextResponse.json({ cargo: data }, { status: 201 });
  } catch (error) {
    console.error('Erro interno:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
