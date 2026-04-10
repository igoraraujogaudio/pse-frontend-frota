import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('contratos')
      .select('id, nome')
      .order('nome');

    if (error) {
      console.error('Erro ao buscar locais:', error);
      return NextResponse.json({ error: 'Erro ao buscar locais' }, { status: 500 });
    }

    return NextResponse.json(data || []);
  } catch (error) {
    console.error('Erro interno:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}