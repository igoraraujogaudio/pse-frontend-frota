import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST() {
  try {
    console.log('🔍 Iniciando correção de solicitações aprovadas sem estoque...');

    // Primeiro, buscar todas as solicitações que precisam ser corrigidas
    const { data: solicitacoesProblema, error: errorVerificacao } = await supabase
      .from('solicitacoes_itens')
      .select(`
        id,
        quantidade_aprovada,
        status,
        item_id,
        base_id,
        criado_em
      `)
      .eq('status', 'aprovada')
      .not('quantidade_aprovada', 'is', null);

    if (errorVerificacao) {
      console.error('❌ Erro ao verificar solicitações:', errorVerificacao);
      return NextResponse.json(
        { 
          error: 'Erro ao verificar solicitações',
          details: errorVerificacao
        },
        { status: 500 }
      );
    }

    console.log(`📊 Encontradas ${solicitacoesProblema?.length || 0} solicitações aprovadas para verificar`);

    if (!solicitacoesProblema || solicitacoesProblema.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Nenhuma solicitação aprovada encontrada para verificar',
        data: {
          total_verificadas: 0,
          total_corrigidas: 0,
          total_erros: 0
        }
      });
    }

    // Buscar estoque atual para cada solicitação
    const solicitacoesParaCorrigir: Array<{
      id: string;
      quantidade_aprovada: number;
      estoque_atual: number;
      item_id: string;
      base_id: string;
    }> = [];

    for (const solicitacao of solicitacoesProblema) {
      // Buscar estoque atual do item na base específica
      const { data: estoque, error: errorEstoque } = await supabase
        .from('itens_estoque')
        .select('estoque_atual')
        .eq('id', solicitacao.item_id)
        .eq('base_id', solicitacao.base_id)
        .single();

      if (errorEstoque || !estoque) {
        console.warn(`⚠️ Erro ao buscar estoque para solicitação ${solicitacao.id}:`, errorEstoque);
        continue;
      }

      const estoqueAtual = estoque.estoque_atual || 0;
      const quantidadeAprovada = solicitacao.quantidade_aprovada || 0;

      if (quantidadeAprovada > estoqueAtual) {
        solicitacoesParaCorrigir.push({
          id: solicitacao.id,
          quantidade_aprovada: quantidadeAprovada,
          estoque_atual: estoqueAtual,
          item_id: solicitacao.item_id,
          base_id: solicitacao.base_id
        });
      }
    }

    console.log(`🔧 Encontradas ${solicitacoesParaCorrigir.length} solicitações que precisam ser corrigidas`);

    if (solicitacoesParaCorrigir.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Nenhuma solicitação precisa ser corrigida - todas têm estoque suficiente',
        data: {
          total_verificadas: solicitacoesProblema.length,
          total_corrigidas: 0,
          total_erros: 0
        }
      });
    }

    // Corrigir cada solicitação usando UPDATE direto
    let corrigidas = 0;
    let erros = 0;
    const errosDetalhes: Array<{ id: string; erro: string }> = [];

    for (const solicitacao of solicitacoesParaCorrigir) {
      const motivo = `Correção automática - Estoque insuficiente: Disponível ${solicitacao.estoque_atual}, Necessário ${solicitacao.quantidade_aprovada}`;
      
      // Buscar observações atuais
      const { data: solicitacaoAtual } = await supabase
        .from('solicitacoes_itens')
        .select('observacoes')
        .eq('id', solicitacao.id)
        .single();

      const observacoesAtuais = solicitacaoAtual?.observacoes || '';
      const novasObservacoes = observacoesAtuais 
        ? `${observacoesAtuais} | ${motivo}`
        : motivo;

      const { error: updateError } = await supabase
        .from('solicitacoes_itens')
        .update({
          status: 'aguardando_estoque',
          atualizado_em: new Date().toISOString(),
          observacoes: novasObservacoes
        })
        .eq('id', solicitacao.id);

      if (updateError) {
        console.error(`❌ Erro ao corrigir solicitação ${solicitacao.id}:`, updateError);
        erros++;
        errosDetalhes.push({
          id: solicitacao.id,
          erro: updateError.message
        });
      } else {
        console.log(`✅ Solicitação ${solicitacao.id} corrigida: aguardando_estoque`);
        corrigidas++;
      }
    }

    console.log(`✅ Correção concluída: ${corrigidas} corrigidas, ${erros} erros`);

    return NextResponse.json({
      success: true,
      message: `Correção concluída: ${corrigidas} solicitação(ões) movida(s) para aguardando_estoque`,
      data: {
        total_verificadas: solicitacoesProblema.length,
        total_corrigidas: corrigidas,
        total_erros: erros,
        solicitacoes_corrigidas: solicitacoesParaCorrigir.map(s => ({
          id: s.id,
          quantidade_aprovada: s.quantidade_aprovada,
          estoque_atual: s.estoque_atual
        })),
        erros: errosDetalhes
      }
    });

  } catch (error) {
    console.error('❌ Erro na API corrigir-solicitacoes-sem-estoque:', error);
    return NextResponse.json(
      { 
        error: 'Erro interno do servidor',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

