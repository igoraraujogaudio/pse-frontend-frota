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

    // Buscar inventário do funcionário
    const { data: inventario, error } = await supabaseAdmin
      .from('inventario_funcionario')
      .select(`
        id,
        quantidade,
        status,
        data_entrega,
        data_devolucao,
        observacoes_entrega,
        observacoes_devolucao,
        condicao_entrega,
        condicao_atual,
        item_estoque_id
      `)
      .eq('funcionario_id', funcionarioId)
      .order('data_entrega', { ascending: false });

    if (error) {
      console.error('Erro ao buscar inventário:', error);
      return NextResponse.json(
        { error: 'Erro ao buscar inventário' },
        { status: 500 }
      );
    }

    // Buscar informações dos itens de estoque
    const inventarioFormatado = await Promise.all((inventario || []).map(async (item) => {
      let itemNome = 'Item não encontrado';
      let itemCodigo = null;

      if (item.item_estoque_id) {
        const { data: itemEstoque } = await supabaseAdmin
          .from('itens_estoque')
          .select('nome, codigo')
          .eq('id', item.item_estoque_id)
          .single();
        
        if (itemEstoque) {
          itemNome = itemEstoque.nome;
          itemCodigo = itemEstoque.codigo;
        }
      }

      return {
        id: item.id,
        item_nome: itemNome,
        item_codigo: itemCodigo,
        quantidade: item.quantidade,
        status: item.status,
        data_entrega: item.data_entrega,
        data_devolucao: item.data_devolucao,
        observacoes: item.observacoes_entrega || item.observacoes_devolucao || null,
        condicao_entrega: item.condicao_entrega,
        condicao_atual: item.condicao_atual
      };
    }));

    return NextResponse.json({
      success: true,
      inventario: inventarioFormatado
    });

  } catch (error) {
    console.error('Erro na API de inventário:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
