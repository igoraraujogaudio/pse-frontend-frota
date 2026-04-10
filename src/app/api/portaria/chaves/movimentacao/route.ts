import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();
    const { colaborador_id, chave_id, acao, observacoes } = await request.json();

    // Validar dados obrigatórios
    if (!colaborador_id || !chave_id || !acao) {
      return NextResponse.json(
        { error: 'Dados obrigatórios não fornecidos' },
        { status: 400 }
      );
    }

    // Iniciar transação
    const { data: movimentacao, error: movimentacaoError } = await supabase
      .from('movimentacoes_chaves')
      .insert({
        colaborador_id,
        chave_id,
        tipo: acao,
        data_movimentacao: new Date().toISOString(),
        observacoes,
        status: 'ativa'
      })
      .select()
      .single();

    if (movimentacaoError) {
      throw movimentacaoError;
    }

    // Atualizar status da chave
    const novoStatus = acao === 'retirada' ? 'em_uso' : 'disponivel';
    const { error: chaveError } = await supabase
      .from('chaves_veiculos')
      .update({ 
        status: novoStatus,
        ultimo_responsavel: acao === 'retirada' ? colaborador_id : null,
        updated_at: new Date().toISOString()
      })
      .eq('id', chave_id);

    if (chaveError) {
      // Reverter movimentação se falhar
      await supabase
        .from('movimentacoes_chaves')
        .delete()
        .eq('id', movimentacao.id);
      
      throw chaveError;
    }

    // Se for entrega, finalizar movimentação anterior
    if (acao === 'entrega') {
      await supabase
        .from('movimentacoes_chaves')
        .update({ 
          status: 'finalizada',
          data_finalizacao: new Date().toISOString()
        })
        .eq('chave_id', chave_id)
        .eq('tipo', 'retirada')
        .eq('status', 'ativa');
    }

    return NextResponse.json({
      success: true,
      movimentacao
    });
  } catch (error) {
    console.error('Erro ao processar movimentação de chave:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}