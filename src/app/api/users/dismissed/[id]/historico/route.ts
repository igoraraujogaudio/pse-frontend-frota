import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: funcionarioId } = await params;

    if (!funcionarioId) {
      return NextResponse.json(
        { error: 'ID do funcionário é obrigatório' },
        { status: 400 }
      );
    }

    // Buscar histórico do funcionário de múltiplas fontes
    const [historicoDemissoes, historicoFuncionarios, movimentacoesEstoque] = await Promise.all([
      // Histórico de demissões
      supabaseAdmin
        .from('historico_demissoes')
        .select(`
          id,
          data_demissao,
          tipo_demissao,
          observacoes,
          data_reativacao,
          observacoes_reativacao,
          demitido_por,
          reativado_por,
          criado_em
        `)
        .eq('usuario_id', funcionarioId)
        .order('criado_em', { ascending: false })
        .limit(20),

      // Histórico de funcionários (inventário) com informações dos itens
      supabaseAdmin
        .from('historico_funcionarios')
        .select(`
          id,
          tipo_movimentacao,
          data_entrega,
          data_devolucao,
          condicao_entrega,
          condicao_devolucao,
          observacoes_entrega,
          observacoes_devolucao,
          status,
          criado_em,
          quantidade,
          itens_estoque!historico_funcionarios_item_id_fkey(
            nome,
            codigo
          )
        `)
        .eq('funcionario_id', funcionarioId)
        .order('criado_em', { ascending: false })
        .limit(20),

      // Movimentações de estoque
      supabaseAdmin
        .from('movimentacoes_estoque')
        .select(`
          id,
          tipo,
          quantidade,
          motivo,
          observacoes,
          criado_em
        `)
        .or(`usuario_id.eq.${funcionarioId},solicitante_id.eq.${funcionarioId}`)
        .order('criado_em', { ascending: false })
        .limit(20)
    ]);

    // Definir tipos para os diferentes históricos
    type HistoricoDemissao = {
      categoria: 'demissao';
      id: string;
      data_demissao: string;
      tipo_demissao: string;
      observacoes: string;
      data_reativacao?: string;
      observacoes_reativacao?: string;
      demitido_por?: string;
      reativado_por?: string;
      criado_em: string;
    };

    type HistoricoInventario = {
      categoria: 'inventario';
      id: string;
      tipo_movimentacao: string;
      data_entrega?: string;
      data_devolucao?: string;
      condicao_entrega?: string;
      condicao_devolucao?: string;
      observacoes_entrega?: string;
      observacoes_devolucao?: string;
      status: string;
      criado_em: string;
      quantidade: number;
      itens_estoque?: { nome: string; codigo: string } | null;
    };

    type HistoricoEstoque = {
      categoria: 'estoque';
      id: string;
      tipo: string;
      quantidade: number;
      motivo?: string;
      observacoes?: string;
      criado_em: string;
    };

    type HistoricoItem = HistoricoDemissao | HistoricoInventario | HistoricoEstoque;

    // Combinar todos os históricos
    const todosHistoricos: HistoricoItem[] = [
      ...(historicoDemissoes.data || []).map(item => ({ 
        ...item, 
        categoria: 'demissao' as const,
        data_demissao: item.data_demissao as string,
        tipo_demissao: item.tipo_demissao as string,
        observacoes: item.observacoes as string,
        data_reativacao: item.data_reativacao as string | undefined,
        observacoes_reativacao: item.observacoes_reativacao as string | undefined,
        demitido_por: item.demitido_por as string | undefined,
        reativado_por: item.reativado_por as string | undefined,
        criado_em: item.criado_em as string
      })),
      ...(historicoFuncionarios.data || []).map(item => ({ 
        ...item, 
        categoria: 'inventario' as const,
        tipo_movimentacao: item.tipo_movimentacao as string,
        data_entrega: item.data_entrega as string | undefined,
        data_devolucao: item.data_devolucao as string | undefined,
        condicao_entrega: item.condicao_entrega as string | undefined,
        condicao_devolucao: item.condicao_devolucao as string | undefined,
        observacoes_entrega: item.observacoes_entrega as string | undefined,
        observacoes_devolucao: item.observacoes_devolucao as string | undefined,
        status: item.status as string,
        criado_em: item.criado_em as string,
        quantidade: item.quantidade as number,
        itens_estoque: Array.isArray(item.itens_estoque) && item.itens_estoque.length > 0 
          ? item.itens_estoque[0] as { nome: string; codigo: string }
          : null
      })),
      ...(movimentacoesEstoque.data || []).map(item => ({ 
        ...item, 
        categoria: 'estoque' as const,
        tipo: item.tipo as string,
        quantidade: item.quantidade as number,
        motivo: item.motivo as string | undefined,
        observacoes: item.observacoes as string | undefined,
        criado_em: item.criado_em as string
      }))
    ].sort((a, b) => new Date(b.criado_em).getTime() - new Date(a.criado_em).getTime())
    .slice(0, 50);

    const error = historicoDemissoes.error || historicoFuncionarios.error || movimentacoesEstoque.error;

    if (error) {
      console.error('Erro ao buscar histórico:', error);
      return NextResponse.json(
        { error: 'Erro ao buscar histórico' },
        { status: 500 }
      );
    }

    // Formatar histórico combinado
    const historicoFormatado = todosHistoricos.map(item => {
      let tipo = '';
      let descricao = '';
      let data = item.criado_em;
      let observacoes = '';

      switch (item.categoria) {
        case 'demissao':
          tipo = 'Demissão/Reativação';
          if (item.data_reativacao) {
            descricao = `Funcionário reativado em ${new Date(item.data_reativacao).toLocaleDateString('pt-BR')}`;
            data = item.data_reativacao;
            observacoes = item.observacoes_reativacao || '';
          } else {
            descricao = `Funcionário demitido em ${new Date(item.data_demissao).toLocaleDateString('pt-BR')} - ${item.tipo_demissao}`;
            data = item.data_demissao;
            observacoes = item.observacoes;
          }
          break;

        case 'inventario':
          tipo = 'Inventário';
          const itemNome = item.itens_estoque?.nome || 'Item não encontrado';
          const itemCodigo = item.itens_estoque?.codigo || '';
          const quantidade = item.quantidade || 1;
          
          descricao = `${item.tipo_movimentacao} - ${itemNome}${itemCodigo ? ` (${itemCodigo})` : ''} - Qtd: ${quantidade}`;
          
          if (item.data_entrega) {
            data = item.data_entrega;
            observacoes = item.observacoes_entrega || '';
          }
          if (item.data_devolucao) {
            data = item.data_devolucao;
            observacoes = item.observacoes_devolucao || '';
          }
          break;

        case 'estoque':
          tipo = 'Estoque';
          descricao = `${item.tipo} - Qtd: ${item.quantidade}`;
          observacoes = item.observacoes || item.motivo || '';
          break;

        default:
          tipo = 'Outros';
          descricao = 'Movimentação';
      }

      return {
        id: item.id,
        tipo,
        descricao,
        data,
        usuario_responsavel: 'Sistema',
        observacoes
      };
    });

    return NextResponse.json({
      success: true,
      historico: historicoFormatado
    });

  } catch (error) {
    console.error('Erro na API de histórico:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// Function removed as it was unused
