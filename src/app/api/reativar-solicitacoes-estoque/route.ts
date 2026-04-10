import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

const BATCH_SIZE = 5;

export async function POST() {
  try {
    console.log('🔄 Iniciando reativação de solicitações aguardando estoque...');

    // Buscar solicitações aguardando estoque JÁ COM estoque via join (1 query)
    const { data: solicitacoesAguardando, error: errorBusca } = await supabase
      .from('solicitacoes_itens')
      .select('id, quantidade_aprovada, item_id, itens_estoque!solicitacoes_itens_item_id_fkey(estoque_atual, nome)')
      .eq('status', 'aguardando_estoque')
      .not('quantidade_aprovada', 'is', null);

    if (errorBusca) {
      console.error('❌ Erro ao buscar solicitações:', errorBusca);
      return NextResponse.json(
        { error: 'Erro ao buscar solicitações', details: errorBusca },
        { status: 500 }
      );
    }

    console.log(`📊 Encontradas ${solicitacoesAguardando?.length || 0} solicitações aguardando estoque`);

    if (!solicitacoesAguardando || solicitacoesAguardando.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Nenhuma solicitação aguardando estoque encontrada',
        data: { total_verificadas: 0, total_reativadas: 0 }
      });
    }

    // Filtrar na memória — sem requests individuais
    const solicitacoesParaReativar = solicitacoesAguardando.filter(s => {
      const estoque = (s.itens_estoque as unknown as { estoque_atual: number; nome: string })?.estoque_atual || 0;
      return estoque >= (s.quantidade_aprovada || 0);
    });

    console.log(`🔧 ${solicitacoesParaReativar.length} solicitações podem ser reativadas`);

    if (solicitacoesParaReativar.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Nenhuma solicitação pode ser reativada - estoque ainda insuficiente',
        data: {
          total_verificadas: solicitacoesAguardando.length,
          total_reativadas: 0
        }
      });
    }

    // Reativar em batches pequenos
    let reativadas = 0;
    let erros = 0;

    for (let i = 0; i < solicitacoesParaReativar.length; i += BATCH_SIZE) {
      const batch = solicitacoesParaReativar.slice(i, i + BATCH_SIZE);
      const batchIds = batch.map(s => s.id);

      const { error: updateError } = await supabase
        .from('solicitacoes_itens')
        .update({
          status: 'aprovada',
          atualizado_em: new Date().toISOString()
        })
        .in('id', batchIds);

      if (updateError) {
        console.error(`❌ Erro ao reativar batch ${i}:`, updateError);
        erros += batch.length;
      } else {
        reativadas += batch.length;
      }
    }

    console.log(`✅ Reativação concluída: ${reativadas} reativadas, ${erros} erros`);

    return NextResponse.json({
      success: true,
      message: `Reativação concluída: ${reativadas} solicitação(ões) reativada(s)`,
      data: {
        total_verificadas: solicitacoesAguardando.length,
        total_reativadas: reativadas,
        total_erros: erros
      }
    });

  } catch (error) {
    console.error('❌ Erro na API reativar-solicitacoes-estoque:', error);
    return NextResponse.json(
      { 
        error: 'Erro interno do servidor',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
