import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Importação do XLSX
import * as XLSX from 'xlsx';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const contratoIds = searchParams.get('contratoIds')?.split(',').filter(Boolean);
    const search = searchParams.get('search') || '';
    const tipo_operacao = searchParams.get('tipo_operacao') || '';
    const data_inicio = searchParams.get('data_inicio') || '';
    const data_fim = searchParams.get('data_fim') || '';

    // Buscar veículos desmobilizados/devolvidos usando a view
    let vehiclesQuery = supabaseAdmin
      .from('v_veiculos_devolvidos_desmobilizados_relatorio')
      .select('*')
      .order('data_devolucao_desmobilizacao', { ascending: false });

    // Aplicar filtros de contratos se fornecido
    if (contratoIds && contratoIds.length > 0) {
      vehiclesQuery = vehiclesQuery.in('contrato_id', contratoIds);
    }

    // Aplicar outros filtros
    if (search) {
      vehiclesQuery = vehiclesQuery.or(`placa.ilike.%${search}%,modelo.ilike.%${search}%,marca_equipamento.ilike.%${search}%`);
    }

    if (tipo_operacao) {
      vehiclesQuery = vehiclesQuery.eq('tipo_operacao', tipo_operacao);
    }

    if (data_inicio) {
      vehiclesQuery = vehiclesQuery.gte('data_devolucao_desmobilizacao', data_inicio);
    }

    if (data_fim) {
      vehiclesQuery = vehiclesQuery.lte('data_devolucao_desmobilizacao', data_fim);
    }

    const { data: vehicles, error: vehiclesError } = await vehiclesQuery;
    if (vehiclesError) throw vehiclesError;

    // Preparar dados para o Excel
    const excelData = vehicles.map(vehicle => {
      return {
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
        'Tipo Operação': vehicle.tipo_operacao || '',
        'Data Devolução/Desmobilização': vehicle.data_devolucao_desmobilizacao ? 
          new Date(vehicle.data_devolucao_desmobilizacao).toLocaleDateString('pt-BR') : '',
        'Motivo': vehicle.motivo || '',
        'Observações': vehicle.observacoes || '',
        'Processado Por': vehicle.processado_por_nome || '',
        'Contrato': vehicle.contrato_nome || '',
        'Base': vehicle.base_nome || '',
        'Pode Reativar': vehicle.pode_reativar ? 'Sim' : 'Não',
        'Data Reativação': vehicle.data_reativacao ? 
          new Date(vehicle.data_reativacao).toLocaleDateString('pt-BR') : '',
        'Reativado Por': vehicle.reativado_por_nome || '',
        'Criado em': vehicle.criado_em ? 
          new Date(vehicle.criado_em).toLocaleDateString('pt-BR') : '',
        'Atualizado em': vehicle.atualizado_em ? 
          new Date(vehicle.atualizado_em).toLocaleDateString('pt-BR') : ''
      };
    });

    // Criar workbook
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(excelData);

    // Ajustar largura das colunas
    const columnWidths = [
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
      { wch: 18 }, // Tipo Operação
      { wch: 20 }, // Data Devolução/Desmobilização
      { wch: 30 }, // Motivo
      { wch: 30 }, // Observações
      { wch: 20 }, // Processado Por
      { wch: 20 }, // Contrato
      { wch: 20 }, // Base
      { wch: 15 }, // Pode Reativar
      { wch: 18 }, // Data Reativação
      { wch: 20 }, // Reativado Por
      { wch: 20 }, // Criado em
      { wch: 20 }  // Atualizado em
    ];

    worksheet['!cols'] = columnWidths;

    // Adicionar worksheet ao workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Veículos Desmobilizados/Devolvidos');

    // Gerar buffer do Excel
    const excelBuffer = XLSX.write(workbook, { 
      type: 'buffer', 
      bookType: 'xlsx' 
    });

    // Criar nome do arquivo com timestamp
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    const filename = `relatorio-veiculos-desmobilizados-devolvidos-${timestamp}.xlsx`;

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
    console.error('Erro ao gerar relatório Excel de veículos desmobilizados/devolvidos:', error);
    return NextResponse.json({ 
      error: 'Erro interno do servidor',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    }, { status: 500 });
  }
}
