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

    // Buscar movimentações de estoque do funcionário
    const { data: movimentacoesEstoque, error: errorEstoque } = await supabaseAdmin
      .from('movimentacoes_estoque')
      .select(`
        id,
        tipo,
        quantidade,
        motivo,
        observacoes,
        criado_em,
        usuario_id,
        solicitante_id,
        item_id
      `)
      .or(`usuario_id.eq.${funcionarioId},solicitante_id.eq.${funcionarioId}`)
      .order('criado_em', { ascending: false })
      .limit(30);

    // Buscar movimentações de chaves do funcionário
    const { data: movimentacoesChaves, error: errorChaves } = await supabaseAdmin
      .from('movimentacoes_chaves')
      .select(`
        id,
        tipo,
        observacoes,
        data_movimentacao,
        status,
        chave_id
      `)
      .eq('colaborador_id', funcionarioId)
      .order('data_movimentacao', { ascending: false })
      .limit(20);

    // Buscar movimentações de veículos do funcionário
    const { data: movimentacoesVeiculos, error: errorVeiculos } = await supabaseAdmin
      .from('movimentacoes_veiculos')
      .select(`
        id,
        tipo,
        observacoes,
        data_movimentacao,
        quilometragem,
        veiculo_id
      `)
      .eq('colaborador_id', funcionarioId)
      .order('data_movimentacao', { ascending: false })
      .limit(20);

    // Definir tipos para as diferentes movimentações
    type MovimentacaoEstoque = {
      categoria: 'estoque';
      id: string;
      tipo: string;
      quantidade: number;
      motivo?: string;
      observacoes?: string;
      criado_em: string;
      usuario_id: string;
      solicitante_id?: string;
      item_id?: string;
    };

    type MovimentacaoChaves = {
      categoria: 'chaves';
      id: string;
      tipo: string;
      observacoes?: string;
      data_movimentacao: string;
      status?: string;
      chave_id?: string;
    };

    type MovimentacaoVeiculos = {
      categoria: 'veiculos';
      id: string;
      tipo: string;
      observacoes?: string;
      data_movimentacao: string;
      quilometragem?: number;
      veiculo_id?: string;
    };

    type MovimentacaoItem = MovimentacaoEstoque | MovimentacaoChaves | MovimentacaoVeiculos;

    // Combinar todas as movimentações
    const todasMovimentacoes: MovimentacaoItem[] = [
      ...(movimentacoesEstoque || []).map(mov => ({ ...mov, categoria: 'estoque' as const })),
      ...(movimentacoesChaves || []).map(mov => ({ ...mov, categoria: 'chaves' as const })),
      ...(movimentacoesVeiculos || []).map(mov => ({ ...mov, categoria: 'veiculos' as const }))
    ].sort((a, b) => {
      const dateA = a.categoria === 'estoque' ? a.criado_em : a.data_movimentacao;
      const dateB = b.categoria === 'estoque' ? b.criado_em : b.data_movimentacao;
      return new Date(dateB).getTime() - new Date(dateA).getTime();
    })
    .slice(0, 50);

    const error = errorEstoque || errorChaves || errorVeiculos;

    if (error) {
      console.error('Erro ao buscar movimentações:', error);
      return NextResponse.json(
        { error: 'Erro ao buscar movimentações' },
        { status: 500 }
      );
    }

    // Formatar movimentações com informações específicas por categoria
    const movimentacoesFormatadas = await Promise.all(todasMovimentacoes.map(async (mov) => {
      let descricao = '';
      const data = mov.categoria === 'estoque' ? mov.criado_em : mov.data_movimentacao;
      
      switch (mov.categoria) {
        case 'estoque':
          let itemNome = 'Item não encontrado';
          if (mov.item_id) {
            const { data: item } = await supabaseAdmin
              .from('itens_estoque')
              .select('nome, codigo')
              .eq('id', mov.item_id)
              .single();
            
            if (item) {
              itemNome = `${item.nome} (${item.codigo})`;
            }
          }
          descricao = `${mov.tipo} - ${itemNome} - Qtd: ${mov.quantidade}`;
          break;
          
        case 'chaves':
          let chaveCodigo = 'Chave não encontrada';
          if (mov.chave_id) {
            const { data: chave } = await supabaseAdmin
              .from('chaves_veiculos')
              .select('codigo')
              .eq('id', mov.chave_id)
              .single();
            
            if (chave) {
              chaveCodigo = chave.codigo;
            }
          }
          descricao = `${mov.tipo} - Chave ${chaveCodigo}`;
          break;
          
        case 'veiculos':
          let veiculoPlaca = 'Veículo não encontrado';
          if (mov.veiculo_id) {
            const { data: veiculo } = await supabaseAdmin
              .from('veiculos')
              .select('placa')
              .eq('id', mov.veiculo_id)
              .single();
            
            if (veiculo) {
              veiculoPlaca = veiculo.placa;
            }
          }
          descricao = `${mov.tipo} - Veículo ${veiculoPlaca} - KM: ${mov.quilometragem || 0}`;
          break;
          
        default:
          descricao = 'Movimentação';
      }

      return {
        id: mov.id,
        tipo: mov.tipo,
        descricao: descricao,
        data: data,
        valor: null,
        status: mov.categoria === 'chaves' ? (mov.status || 'concluido') : 'concluido',
        observacoes: mov.observacoes || (mov.categoria === 'estoque' ? mov.motivo : undefined)
      };
    }));

    return NextResponse.json({
      success: true,
      movimentacoes: movimentacoesFormatadas
    });

  } catch (error) {
    console.error('Erro na API de movimentações:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
