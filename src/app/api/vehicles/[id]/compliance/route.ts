import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

interface ComplianceDocument {
  documento_tipo: string;
  obrigatorio: boolean;
  possui_documento: boolean;
  documento_valido: boolean;
  data_vencimento: string | null;
  dias_para_vencer: number | null;
  status_conformidade: string;
  origem_regra: string;
  prioridade: 'CRÍTICO' | 'ATENÇÃO' | 'OK';
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

function calculatePriority(status: string, diasParaVencer: number | null): 'CRÍTICO' | 'ATENÇÃO' | 'OK' {
  if (status.includes('FALTANDO') || status.includes('VENCIDO')) {
    return 'CRÍTICO';
  }
  
  if (diasParaVencer !== null && diasParaVencer <= 30) {
    return 'ATENÇÃO';
  }
  
  return 'OK';
}

function calculateDaysToExpire(dataVencimento: string | null): number | null {
  if (!dataVencimento) return null;
  
  const hoje = new Date();
  const vencimento = new Date(dataVencimento);
  const diffMs = vencimento.getTime() - hoje.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  
  return diffDays;
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
    const { id: vehicleId } = await params;

    if (!vehicleId) {
      return NextResponse.json(
        { error: 'ID do veículo é obrigatório' },
        { status: 400 }
      );
    }

    // Buscar informações do veículo
    const { data: vehicle, error: vehicleError } = await supabase
      .from('veiculos')
      .select('id, placa')
      .eq('id', vehicleId)
      .single();

    if (vehicleError || !vehicle) {
      return NextResponse.json(
        { error: 'Veículo não encontrado' },
        { status: 404 }
      );
    }

    // Chamar função PostgreSQL para verificar conformidade
    const { data: complianceResult, error } = await supabase
      .rpc('verificar_conformidade_documentos_veiculo', {
        p_veiculo_id: vehicleId
      });

    if (error) {
      console.error('Erro ao verificar conformidade:', error);
      return NextResponse.json(
        { error: 'Erro ao verificar conformidade de documentos' },
        { status: 500 }
      );
    }

    // Buscar origem da regra (para contexto)
    const { data: ruleOrigin } = await supabase
      .rpc('obter_documentos_obrigatorios_veiculo', {
        p_veiculo_id: vehicleId
      });

    const origem = ruleOrigin?.[0]?.origem || 'Sistema';

    // Obter tipos de documentos permitidos para o usuário
    const allowedDocumentTypes = getFilteredDocumentTypes();

    // Converter resultado para formato esperado e filtrar por permissões
    const conformidade: ComplianceDocument[] = (complianceResult || [])
      .filter((item: { documento_tipo: string }) => 
        allowedDocumentTypes.includes(item.documento_tipo)
      )
      .map((item: {
      documento_tipo: string;
      obrigatorio: boolean;
      status_conformidade: string;
      data_expiracao?: string;
      observacoes?: string;
      data_upload?: string;
      nome_arquivo?: string;
      url_documento?: string;
      possui_documento?: boolean;
      documento_valido?: boolean;
    }) => {
      const diasParaVencer = calculateDaysToExpire(item.data_expiracao || null);
      const prioridade = calculatePriority(item.status_conformidade, diasParaVencer);

      return {
        documento_tipo: item.documento_tipo,
        obrigatorio: item.obrigatorio,
        possui_documento: item.possui_documento,
        documento_valido: item.documento_valido,
        data_vencimento: item.data_expiracao,
        dias_para_vencer: diasParaVencer,
        status_conformidade: item.status_conformidade,
        origem_regra: origem,
        prioridade,
        label: DOCUMENT_LABELS[item.documento_tipo] || item.documento_tipo
      };
    });

    // Calcular resumo
    const resumo = {
      total_documentos: conformidade.length,
      obrigatorios: conformidade.filter(d => d.obrigatorio).length,
      opcionais: conformidade.filter(d => !d.obrigatorio).length,
      conformes: conformidade.filter(d => d.prioridade === 'OK').length,
      nao_conformes: conformidade.filter(d => d.prioridade === 'CRÍTICO').length,
      criticos: conformidade.filter(d => d.prioridade === 'CRÍTICO').length,
      atencao: conformidade.filter(d => d.prioridade === 'ATENÇÃO').length
    };

    return NextResponse.json({
      veiculo_id: vehicleId,
      veiculo_placa: vehicle.placa,
      conformidade,
      resumo
    });

  } catch (error) {
    console.error('Erro na API compliance:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}