import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

interface RequiredDocument {
  tipo: string;
  obrigatorio: boolean;
  origem_regra: string;
  label: string;
}

// Mapeamento de tipos de documento para labels
const DOCUMENT_LABELS: { [key: string]: string } = {
  'crlv': 'CRLV',
  'tacografo': 'Laudo Tacógrafo',
  'fumaca': 'Laudo de Fumaça',
  'eletrico': 'Laudo Elétrico',
  'acustico': 'Laudo Acústico',
  'aet': 'AET',
  'apolice': 'Apólice',
  'contrato_seguro': 'Contrato de Aluguel'
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: vehicleId } = await params;

    if (!vehicleId) {
      return NextResponse.json(
        { error: 'ID do veículo é obrigatório' },
        { status: 400 }
      );
    }

    // Chamar função PostgreSQL para obter documentos obrigatórios
    const { data: result, error } = await supabase
      .rpc('obter_documentos_obrigatorios_veiculo', {
        p_veiculo_id: vehicleId
      });

    if (error) {
      console.error('Erro ao buscar documentos obrigatórios:', error);
      return NextResponse.json(
        { error: 'Erro ao buscar documentos obrigatórios' },
        { status: 500 }
      );
    }

    if (!result || result.length === 0) {
      return NextResponse.json(
        { error: 'Nenhuma regra encontrada para este veículo' },
        { status: 404 }
      );
    }

    // Pegar o primeiro resultado (a função retorna apenas um registro)
    const ruleResult = result[0];

    // Converter para formato esperado pelo frontend
    const documents: RequiredDocument[] = [];

    // Adicionar documentos obrigatórios
    if (ruleResult.documentos_obrigatorios) {
      ruleResult.documentos_obrigatorios.forEach((doc: string) => {
        documents.push({
          tipo: doc,
          obrigatorio: true,
          origem_regra: ruleResult.origem || 'Sistema',
          label: DOCUMENT_LABELS[doc] || doc
        });
      });
    }

    // Adicionar documentos opcionais
    if (ruleResult.documentos_opcionais) {
      ruleResult.documentos_opcionais.forEach((doc: string) => {
        documents.push({
          tipo: doc,
          obrigatorio: false,
          origem_regra: ruleResult.origem || 'Sistema',
          label: DOCUMENT_LABELS[doc] || doc
        });
      });
    }

    return NextResponse.json({
      documents,
      origem: ruleResult.origem,
      descricao: ruleResult.descricao
    });

  } catch (error) {
    console.error('Erro na API required-documents:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}