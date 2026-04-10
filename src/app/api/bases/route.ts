import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('bases')
      .select(`
        id,
        nome,
        codigo,
        ativa,
        contrato_id,
        contrato:contratos(id, nome, codigo)
      `)
      .eq('ativa', true)
      .order('nome');

    if (error) {
      console.error('Erro ao buscar bases:', error);
      return NextResponse.json({ error: 'Erro ao buscar bases' }, { status: 500 });
    }

    return NextResponse.json({ bases: data || [] });
  } catch (error) {
    console.error('Erro interno:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
