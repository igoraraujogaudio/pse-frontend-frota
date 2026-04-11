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
    const search = searchParams.get('search') || '';
    const data_inicio = searchParams.get('data_inicio') || '';
    const data_fim = searchParams.get('data_fim') || '';

    // Buscar veículos bloqueados usando a view
    let vehiclesQuery = getSupabaseAdmin()
      .from('v_veiculos_bloqueados_relatorio')
      .select('*')
      .order('data_bloqueio', { ascending: false });

    // Aplicar filtros de contratos se fornecido
    if (contratoIds && contratoIds.length > 0) {
      vehiclesQuery = vehiclesQuery.in('contrato_id', contratoIds);
    }

    // Aplicar outros filtros
    if (search) {
      vehiclesQuery = vehiclesQuery.or(`placa.ilike.%${search}%,modelo.ilike.%${search}%,marca_equipamento.ilike.%${search}%`);
    }

    if (data_inicio) {
      vehiclesQuery = vehiclesQuery.gte('data_bloqueio', data_inicio);
    }

    if (data_fim) {
      vehiclesQuery = vehiclesQuery.lte('data_bloqueio', data_fim);
    }

    const { data: vehicles, error: vehiclesError } = await vehiclesQuery;
    if (vehiclesError) throw vehiclesError;

    // Preparar dados para o Excel
    const excelData = vehicles.map((vehicle: Record<string, unknown>) => ({
      'Placa': vehicle.placa,
      'Modelo': vehicle.modelo,
      'Marca': vehicle.marca_equipamento,
      'Ano Fabricação': vehicle.ano_fabricacao,
      'Ano Modelo': vehicle.ano_modelo,
      'Tipo Veículo': vehicle.tipo_veiculo,
      'Propriedade': vehicle.propriedade,
      'Quilometragem': vehicle.quilometragem_atual,
      'Contrato Atual': vehicle.contrato_atual_nome || '-',
      'Base': vehicle.base_nome || '-',
      'Data Bloqueio': vehicle.data_bloqueio && typeof vehicle.data_bloqueio === 'string' ? new Date(vehicle.data_bloqueio).toLocaleDateString('pt-BR') : '-',
      'Motivo': vehicle.motivo || '-',
      'Observações': vehicle.observacoes || '-',
      'Bloqueio Origem (Contrato)': vehicle.bloqueio_origem_contrato_nome || vehicle.bloqueio_origem_contrato_nome_atual || '-',
      'Processado por': vehicle.processado_por_nome || '-',
      'Pode Desbloquear': vehicle.pode_desbloquear ? 'Sim' : 'Não',
      'Data Desbloqueio': vehicle.data_desbloqueio && typeof vehicle.data_desbloqueio === 'string' ? new Date(vehicle.data_desbloqueio).toLocaleDateString('pt-BR') : '-',
      'Desbloqueado por': vehicle.desbloqueado_por_nome || '-'
    }));

    // Criar workbook
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(excelData);

    // Ajustar largura das colunas
    const columnWidths = [
      { wch: 12 }, // Placa
      { wch: 20 }, // Modelo
      { wch: 15 }, // Marca
      { wch: 12 }, // Ano Fabricação
      { wch: 10 }, // Ano Modelo
      { wch: 15 }, // Tipo Veículo
      { wch: 12 }, // Propriedade
      { wch: 12 }, // Quilometragem
      { wch: 25 }, // Contrato Atual
      { wch: 20 }, // Base
      { wch: 15 }, // Data Bloqueio
      { wch: 40 }, // Motivo
      { wch: 40 }, // Observações
      { wch: 30 }, // Bloqueio Origem
      { wch: 20 }, // Processado por
      { wch: 15 }, // Pode Desbloquear
      { wch: 15 }, // Data Desbloqueio
      { wch: 20 }  // Desbloqueado por
    ];
    worksheet['!cols'] = columnWidths;

    // Adicionar worksheet ao workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Veículos Bloqueados');

    // Gerar buffer do Excel
    const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    // Timestamp para nome do arquivo
    const timestamp = new Date().toISOString().split('T')[0];

    const filename = `relatorio-veiculos-bloqueados-${timestamp}.xlsx`;

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
    console.error('Erro ao gerar relatório Excel de veículos bloqueados:', error);
    return NextResponse.json({ 
      error: 'Erro interno do servidor',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    }, { status: 500 });
  }
}

