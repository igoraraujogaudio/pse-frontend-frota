import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  try {
    // Buscar todos os tipo_veiculo únicos dos veículos
    const { data: tiposVeiculo, error } = await supabase
      .from('veiculos')
      .select('tipo_veiculo')
      .not('tipo_veiculo', 'is', null)
      .not('tipo_veiculo', 'eq', '')
      .order('tipo_veiculo');

    if (error) {
      console.error('Erro ao buscar tipos de veículo:', error);
      return NextResponse.json({ error: 'Erro ao buscar tipos de veículo' }, { status: 500 });
    }

    // Remover duplicatas e ordenar
    const tiposUnicos = [...new Set(tiposVeiculo?.map(v => v.tipo_veiculo).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, 'pt-BR'));

    return NextResponse.json({ 
      tipos: tiposUnicos.map(tipo => ({ value: tipo, label: tipo }))
    });

  } catch (error) {
    console.error('Erro interno:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
