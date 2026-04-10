import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';

interface DocumentoVeiculo {
  tipo: string;
  data_vencimento: string;
  status: string;
}

// Função para obter todos os tipos de documentos (sem restrições)
function getFilteredDocumentTypes() {
  // Retornar todos os tipos de documentos, incluindo apólices e contratos de aluguel
  return ['crlv', 'tacografo', 'fumaca', 'eletrico', 'acustico', 'aet', 'apolice', 'contrato_seguro'];
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = createClient();
    const { id: veiculoId } = await params;

    // Buscar veículo por placa ou ID
    const { data: veiculo, error } = await supabase
      .from('veiculos')
      .select(`
        id,
        placa,
        modelo,
        marca,
        status,
        quilometragem_atual,
        created_at
      `)
      .or(`placa.eq.${veiculoId},id.eq.${veiculoId}`)
      .single();

    if (error || !veiculo) {
      return NextResponse.json(
        { error: 'Veículo não encontrado' },
        { status: 404 }
      );
    }

    // Buscar última quilometragem registrada
    const { data: ultimaMovimentacao } = await supabase
      .from('movimentacoes_veiculos')
      .select('quilometragem')
      .eq('veiculo_id', veiculo.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    // Verificar laudos vencidos ou próximos do vencimento
    const hoje = new Date();
    const em30Dias = new Date();
    em30Dias.setDate(hoje.getDate() + 30);

    // Filtrar tipos de documentos baseado no nível de acesso (por padrão, apenas tipos básicos)
    const allowedDocumentTypes = getFilteredDocumentTypes();

    const { data: documentos } = await supabase
      .from('documentos_veiculos')
      .select(`
        tipo,
        data_vencimento,
        status
      `)
      .eq('veiculo_id', veiculo.id)
      .in('tipo', allowedDocumentTypes)
      .or(`data_vencimento.lt.${hoje.toISOString()},data_vencimento.lt.${em30Dias.toISOString()}`)
      .eq('ativo', true);

    // Criar alertas baseados nos documentos
    const alertas = documentos?.map((doc: DocumentoVeiculo) => {
      const vencimento = new Date(doc.data_vencimento);
      const isVencido = vencimento < hoje;
      
      return {
        tipo: isVencido ? 'DOCUMENTO VENCIDO' : 'DOCUMENTO PRÓXIMO DO VENCIMENTO',
        descricao: `${doc.tipo} ${isVencido ? 'vencido' : 'vence em breve'}`,
        vencimento: doc.data_vencimento,
        severidade: isVencido ? 'alta' : 'media'
      };
    }) || [];

    return NextResponse.json({
      veiculo: {
        ...veiculo,
        ultima_quilometragem: ultimaMovimentacao?.quilometragem || veiculo.quilometragem_atual
      },
      alertas
    });
  } catch (error) {
    console.error('Erro na API da portaria:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}