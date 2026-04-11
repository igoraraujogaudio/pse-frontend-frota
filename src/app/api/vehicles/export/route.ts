import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Importação do XLSX
import * as XLSX from 'xlsx';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function getSupabaseAdmin() {
  return createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const contratoIds = searchParams.get('contratoIds')?.split(',').filter(Boolean);

    console.log('🔍 Exportando Excel com filtro de contratos:', contratoIds);

    // Buscar veículos com dados relacionados (apenas ativos)
    let vehiclesQuery = getSupabaseAdmin()
      .from('veiculos')
      .select(`
        *,
        contrato:contratos(id, nome, codigo),
        equipe:equipes(id, nome, operacao),
        base:bases(id, nome, codigo)
      `)
      .not('status', 'in', '(devolvido,desmobilizado)')
      .order('placa');

    if (contratoIds && contratoIds.length > 0) {
      console.log('✅ Aplicando filtro por contratos:', contratoIds);
      vehiclesQuery = vehiclesQuery.in('contrato_id', contratoIds);
    } else {
      console.log('⚠️ NENHUM FILTRO DE CONTRATO - exportando TODOS os veículos');
    }

    const { data: vehicles, error: vehiclesError } = await vehiclesQuery;
    if (vehiclesError) throw vehiclesError;
    
    console.log(`📊 Total de veículos encontrados: ${vehicles?.length || 0}`);

    // Buscar regras de documentos obrigatórios em paralelo (mais rápido)
    const documentRulesByVehicle: Record<string, string[]> = {};
    
    const rulesPromises = vehicles.map(async (vehicle) => {
      try {
        const { data: rulesData } = await getSupabaseAdmin()
          .rpc('obter_documentos_obrigatorios_veiculo', { p_veiculo_id: vehicle.id });
        
        return {
          vehicleId: vehicle.id,
          rules: (rulesData && rulesData.length > 0 && rulesData[0].documentos_obrigatorios) 
            ? rulesData[0].documentos_obrigatorios 
            : []
        };
      } catch {
        return { vehicleId: vehicle.id, rules: [] };
      }
    });
    
    const rulesResults = await Promise.all(rulesPromises);
    rulesResults.forEach(result => {
      documentRulesByVehicle[result.vehicleId] = result.rules;
    });

    // Buscar documentos para todos os veículos em lotes (evitar URI too long)
    const vehicleIds = vehicles.map(v => v.id);
    let documents: unknown[] = [];
    
    try {
      const batchSize = 50; // Buscar 50 veículos por vez
      const allDocuments = [];
      
      for (let i = 0; i < vehicleIds.length; i += batchSize) {
        const batch = vehicleIds.slice(i, i + batchSize);
        const { data: documentsData, error: documentsError } = await getSupabaseAdmin()
          .from('documentos_veiculo')
          .select('id, veiculo_id, tipo_documento, url_arquivo, expira_em')
          .in('veiculo_id', batch);

        if (documentsError) {
          console.error('Erro ao buscar documentos (lote):', documentsError);
        } else if (documentsData) {
          allDocuments.push(...documentsData);
        }
      }
      
      documents = allDocuments;
    } catch (err) {
      console.error('Erro ao buscar documentos:', err);
      documents = [];
    }

    // Definir tipo para documentos
    type DocumentoVeiculo = {
      id: string;
      veiculo_id: string;
      tipo_documento: string;
      url_arquivo: string | null;
      expira_em: string | null;
    };

    // Agrupar documentos por veículo
    const documentsByVehicle = (documents as DocumentoVeiculo[]).reduce((acc, doc) => {
      if (!acc[doc.veiculo_id]) {
        acc[doc.veiculo_id] = [];
      }
      acc[doc.veiculo_id].push(doc);
      return acc;
    }, {} as Record<string, DocumentoVeiculo[]>);

    // Identificar todos os tipos de documentos presentes
    const allDocumentTypes = new Set<string>();
    Object.values(documentsByVehicle).forEach(docs => {
      docs.forEach(doc => {
        if (doc.tipo_documento) {
          allDocumentTypes.add(doc.tipo_documento);
        }
      });
    });
    const sortedDocTypes = Array.from(allDocumentTypes).sort();

    // Preparar dados dos veículos para o Excel
    const excelData = vehicles.map(vehicle => {
      const vehicleDocs = documentsByVehicle[vehicle.id] || [];
      
      // Criar objeto com colunas padrão
      const rowData: Record<string, string | number> = {
        'Placa': vehicle.placa || '',
        'Ano Fabricação': vehicle.ano_fabricacao || '',
        'Ano Modelo': vehicle.ano_modelo || '',
        'RENAVAM': vehicle.renavam || '',
        'Chassi': vehicle.chassis || '',
        'Número CRLV': vehicle.numero_crlv || '',
        'Operação Combustível': vehicle.operacao_combustivel || '',
        'Modelo': vehicle.modelo || '',
        'Tipo/Modelo': vehicle.tipo_modelo || '',
        'Versão': vehicle.versao || '',
        'Tipo Veículo': vehicle.tipo_veiculo || '',
        'Marca/Equipamento': vehicle.marca_equipamento || '',
        'Valor Aluguel': vehicle.valor_aluguel || '',
        'Tipo Combustível': vehicle.tipo_combustivel || '',
        'Rastreador': vehicle.rastreador || '',
        'Propriedade': vehicle.propriedade || '',
        'Condição': vehicle.condicao || '',
        'Status': vehicle.status || '',
        'Contrato': vehicle.contrato?.nome || '',
        'Base': vehicle.base?.nome || '',
        'Equipe': vehicle.equipe?.nome || '',
        'Operação da Equipe': vehicle.equipe?.operacao || '',
        'Última Manutenção': vehicle.ultima_manutencao || '',
        'Próxima Manutenção': vehicle.proxima_manutencao || '',
        'Quilometragem Atual': vehicle.quilometragem_atual || '',
        'Criado em': vehicle.criado_em || '',
        'Atualizado em': vehicle.atualizado_em || ''
      };

      // Adicionar colunas para cada tipo de documento (obrigatório, link, validade e dias)
      const requiredDocs = documentRulesByVehicle[vehicle.id] || [];
      
      sortedDocTypes.forEach(docType => {
        const doc = vehicleDocs.find(d => d.tipo_documento === docType);
        
        // Verificar se é obrigatório
        const isRequired = requiredDocs.includes(docType.toLowerCase()) || requiredDocs.includes(docType);
        rowData[`${docType} - Obrigatório`] = isRequired ? 'SIM' : 'NÃO';
        
        // Link do documento
        rowData[`${docType} - Link`] = doc?.url_arquivo || '';
        
        // Validade e dias para vencimento
        let dataValidadeFormatada = '';
        let diasParaVencimento = '';
        
        if (doc?.expira_em) {
          try {
            const dataValidade = new Date(doc.expira_em);
            const hoje = new Date();
            hoje.setHours(0, 0, 0, 0);
            dataValidade.setHours(0, 0, 0, 0);
            
            const diffTime = dataValidade.getTime() - hoje.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            
            diasParaVencimento = diffDays.toString();
            dataValidadeFormatada = dataValidade.toLocaleDateString('pt-BR');
          } catch {
            dataValidadeFormatada = doc.expira_em;
          }
        }
        
        rowData[`${docType} - Validade`] = dataValidadeFormatada;
        rowData[`${docType} - Dias p/ Venc.`] = diasParaVencimento;
      });

      return rowData;
    });

    // Preparar dados dos documentos para planilha separada
    const documentsData = (documents as DocumentoVeiculo[]).map(doc => {
      const vehicle = vehicles.find(v => v.id === doc.veiculo_id);
      
      // Verificar se o documento é obrigatório para este veículo
      const requiredDocs = documentRulesByVehicle[doc.veiculo_id] || [];
      const isRequired = requiredDocs.includes(doc.tipo_documento?.toLowerCase()) || requiredDocs.includes(doc.tipo_documento);
      
      // Calcular dias para vencimento
      let diasParaVencimento = '';
      let dataValidadeFormatada = '';
      
      if (doc.expira_em) {
        try {
          const dataValidade = new Date(doc.expira_em);
          const hoje = new Date();
          hoje.setHours(0, 0, 0, 0);
          dataValidade.setHours(0, 0, 0, 0);
          
          const diffTime = dataValidade.getTime() - hoje.getTime();
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          
          diasParaVencimento = diffDays.toString();
          dataValidadeFormatada = dataValidade.toLocaleDateString('pt-BR');
        } catch {
          diasParaVencimento = '';
          dataValidadeFormatada = doc.expira_em;
        }
      }
      
      return {
        'Placa do Veículo': vehicle?.placa || '',
        'Tipo de Documento': doc.tipo_documento || '',
        'Obrigatório': isRequired ? 'SIM' : 'NÃO',
        'Validade': dataValidadeFormatada,
        'Dias para Vencimento': diasParaVencimento,
        'Link do Documento': doc.url_arquivo || ''
      };
    });

    // Criar workbook
    const workbook = XLSX.utils.book_new();
    
    // Planilha 1: Veículos
    const worksheetVehicles = XLSX.utils.json_to_sheet(excelData);
    const columnWidthsVehicles = [
      { wch: 12 }, // Placa
      { wch: 15 }, // Ano Fabricação
      { wch: 12 }, // Ano Modelo
      { wch: 15 }, // RENAVAM
      { wch: 20 }, // Chassi
      { wch: 15 }, // Número CRLV
      { wch: 20 }, // Operação Combustível
      { wch: 20 }, // Modelo
      { wch: 20 }, // Tipo/Modelo
      { wch: 15 }, // Versão
      { wch: 15 }, // Tipo Veículo
      { wch: 20 }, // Marca/Equipamento
      { wch: 15 }, // Valor Aluguel
      { wch: 15 }, // Tipo Combustível
      { wch: 15 }, // Rastreador
      { wch: 15 }, // Propriedade
      { wch: 15 }, // Condição
      { wch: 15 }, // Status
      { wch: 20 }, // Contrato
      { wch: 20 }, // Base
      { wch: 20 }, // Equipe
      { wch: 20 }, // Operação da Equipe
      { wch: 18 }, // Última Manutenção
      { wch: 18 }, // Próxima Manutenção
      { wch: 18 }, // Quilometragem Atual
      { wch: 20 }, // Criado em
      { wch: 20 }, // Atualizado em
      // Adicionar largura para cada coluna de documento (4 colunas: Obrigatório, Link, Validade, Dias)
      ...sortedDocTypes.flatMap(() => [
        { wch: 15 }, // Obrigatório
        { wch: 60 }, // Link
        { wch: 15 }, // Validade
        { wch: 18 }  // Dias para Vencimento
      ])
    ];
    worksheetVehicles['!cols'] = columnWidthsVehicles;
    XLSX.utils.book_append_sheet(workbook, worksheetVehicles, 'Veículos');

    // Planilha 2: Documentos
    if (documentsData.length > 0) {
      const worksheetDocuments = XLSX.utils.json_to_sheet(documentsData);
      const columnWidthsDocuments = [
        { wch: 15 }, // Placa do Veículo
        { wch: 25 }, // Tipo de Documento
        { wch: 15 }, // Obrigatório
        { wch: 15 }, // Validade
        { wch: 20 }, // Dias para Vencimento
        { wch: 60 }  // Link do Documento
      ];
      worksheetDocuments['!cols'] = columnWidthsDocuments;
      XLSX.utils.book_append_sheet(workbook, worksheetDocuments, 'Documentos');
    }

    // Gerar buffer do Excel
    const excelBuffer = XLSX.write(workbook, { 
      type: 'buffer', 
      bookType: 'xlsx' 
    });

    // Criar nome do arquivo com timestamp
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    const filename = `relatorio-veiculos-${timestamp}.xlsx`;

    // Retornar arquivo Excel
    return new NextResponse(excelBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': excelBuffer.length.toString(),
      },
    });

  } catch (error) {
    console.error('Erro ao gerar relatório Excel:', error);
    return NextResponse.json({ 
      error: 'Erro interno do servidor',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    }, { status: 500 });
  }
}