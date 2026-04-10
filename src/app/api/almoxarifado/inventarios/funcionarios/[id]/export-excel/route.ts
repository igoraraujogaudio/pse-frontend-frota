import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: funcionarioId } = await params;

    // Buscar dados do funcionário
    const { data: funcionario, error: funcionarioError } = await supabaseAdmin
      .from('usuarios')
      .select('id, nome, matricula, cargo')
      .eq('id', funcionarioId)
      .single();

    if (funcionarioError || !funcionario) {
      return NextResponse.json(
        { error: 'Funcionário não encontrado' },
        { status: 404 }
      );
    }

    // Buscar inventário do funcionário
    const { data: inventarios, error: inventarioError } = await supabaseAdmin
      .from('inventario_funcionario')
      .select(`
        *,
        item_estoque:itens_estoque(nome, codigo, categoria)
      `)
      .eq('funcionario_id', funcionarioId)
      .order('data_entrega', { ascending: false });

    if (inventarioError) {
      console.error('Erro ao buscar inventário:', inventarioError);
      return NextResponse.json(
        { error: 'Erro ao buscar inventário' },
        { status: 500 }
      );
    }

    // Preparar dados para Excel
    interface InventarioFuncionarioComItem {
      item_estoque?: {
        nome?: string
        codigo?: string
        categoria?: string
      } | null
      quantidade?: number
      status?: string
      condicao_entrega?: string | null
      numero_laudo?: string | null
      validade_laudo?: string | null
      data_entrega?: string
    }

    const excelData = (inventarios || []).map((inv: InventarioFuncionarioComItem) => {
      const itemEstoque = inv.item_estoque || {};
      
      return {
        'Item': itemEstoque.nome || 'N/A',
        'Código': itemEstoque.codigo || 'N/A',
        'Categoria': itemEstoque.categoria || 'N/A',
        'Quantidade': inv.quantidade || 0,
        'Status': inv.status === 'em_uso' ? 'Em Uso' : 
                 inv.status === 'devolvido' ? 'Devolvido' : 
                 inv.status === 'perdido' ? 'Perdido' : 
                 inv.status === 'danificado' ? 'Danificado' : 
                 inv.status || '',
        'Condição de Entrega': inv.condicao_entrega || '',
        'Número do Laudo': inv.numero_laudo || '',
        'Validade do Laudo': inv.validade_laudo 
          ? new Date(inv.validade_laudo).toLocaleDateString('pt-BR')
          : '',
        'Data de Entrega': inv.data_entrega 
          ? new Date(inv.data_entrega).toLocaleDateString('pt-BR')
          : ''
      };
    });

    // Criar workbook
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(excelData);

    // Ajustar largura das colunas
    const columnWidths = [
      { wch: 30 }, // Item
      { wch: 15 }, // Código
      { wch: 15 }, // Categoria
      { wch: 12 }, // Quantidade
      { wch: 15 }, // Status
      { wch: 20 }, // Condição de Entrega
      { wch: 18 }, // Número do Laudo
      { wch: 18 }, // Validade do Laudo
      { wch: 18 }  // Data de Entrega
    ];
    worksheet['!cols'] = columnWidths;

    XLSX.utils.book_append_sheet(workbook, worksheet, 'Inventário');

    // Gerar buffer do Excel
    const excelBuffer = XLSX.write(workbook, {
      type: 'buffer',
      bookType: 'xlsx'
    });

    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `inventario-funcionario-${funcionario.nome.replace(/\s+/g, '-')}-${timestamp}.xlsx`;

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
    return NextResponse.json(
      { error: 'Erro ao gerar relatório Excel', details: error instanceof Error ? error.message : 'Erro desconhecido' },
      { status: 500 }
    );
  }
}
