import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('perfis_acesso')
      .select('*')
      .eq('ativo', true)
      .order('nivel_hierarquia');

    if (error) {
      console.error('Erro ao buscar perfis de acesso:', error);
      return NextResponse.json({ 
        error: 'Erro ao buscar perfis de acesso',
        details: error.message
      }, { status: 500 });
    }

    return NextResponse.json({ perfis: data || [] });
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
      .from('perfis_acesso')
      .insert({
        codigo: body.codigo,
        nome: body.nome,
        descricao: body.descricao,
        nivel_hierarquia: body.nivel_hierarquia,
        cor: body.cor,
        ativo: true
      })
      .select()
      .single();

    if (error) {
      console.error('Erro ao criar perfil de acesso:', error);
      return NextResponse.json({ 
        error: 'Erro ao criar perfil de acesso',
        details: error.message
      }, { status: 500 });
    }

    return NextResponse.json({ perfil: data }, { status: 201 });
  } catch (error) {
    console.error('Erro interno:', error);
    return NextResponse.json({ 
      error: 'Erro interno do servidor',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    }, { status: 500 });
  }
}