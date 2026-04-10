import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('contratos')
      .select(`
        id,
        nome,
        codigo,
        status,
        descricao,
        created_at,
        updated_at
      `)
      .eq('status', 'ativo')
      .order('nome');

    if (error) {
      console.error('Erro ao buscar contratos:', error);
      return NextResponse.json({ 
        error: 'Erro ao buscar contratos',
        details: error.message
      }, { status: 500 });
    }

    return NextResponse.json({ contratos: data || [] });
  } catch (error) {
    console.error('Erro interno:', error);
    return NextResponse.json({ 
      error: 'Erro interno do servidor',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    }, { status: 500 });
  }
}