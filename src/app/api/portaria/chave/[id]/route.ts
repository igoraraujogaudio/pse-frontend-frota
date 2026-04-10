import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = createClient();
    const { id: chaveId } = await params;

    // Buscar chave com informações do veículo
    const { data: chave, error } = await supabase
      .from('chaves_veiculos')
      .select(`
        id,
        codigo,
        status,
        veiculo:veiculos (
          id,
          placa,
          modelo,
          marca,
          status
        )
      `)
      .eq('codigo', chaveId)
      .single();

    if (error || !chave) {
      return NextResponse.json(
        { error: 'Chave não encontrada' },
        { status: 404 }
      );
    }

    // Verificar se há movimentação pendente
    const { data: movimentacaoPendente } = await supabase
      .from('movimentacoes_chaves')
      .select('*')
      .eq('chave_id', chave.id)
      .eq('status', 'ativa')
      .single();

    return NextResponse.json({
      ...chave,
      movimentacao_ativa: movimentacaoPendente
    });
  } catch (error) {
    console.error('Erro ao buscar chave:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}