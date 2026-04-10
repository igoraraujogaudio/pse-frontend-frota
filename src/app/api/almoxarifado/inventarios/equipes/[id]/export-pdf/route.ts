import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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
    const { id: equipeId } = await params;

    // Buscar dados da equipe com contrato
    const { data: equipe, error: equipeError } = await supabaseAdmin
      .from('equipes')
      .select(`
        id,
        nome,
        operacao,
        contrato:contratos(id, nome, codigo)
      `)
      .eq('id', equipeId)
      .single();

    if (equipeError || !equipe) {
      return NextResponse.json(
        { error: 'Equipe não encontrada' },
        { status: 404 }
      );
    }

    const contrato = equipe.contrato as { nome?: string; codigo?: string } | null;

    // Buscar inventário da equipe
    const { data: inventarios, error: inventarioError } = await supabaseAdmin
      .from('inventario_equipe')
      .select(`
        *,
        item_estoque:itens_estoque(nome, codigo, categoria)
      `)
      .eq('equipe_id', equipeId)
      .order('data_entrega', { ascending: false });

    if (inventarioError) {
      console.error('Erro ao buscar inventário:', inventarioError);
      return NextResponse.json(
        { error: 'Erro ao buscar inventário' },
        { status: 500 }
      );
    }

    // Função para formatar data
    const formatDate = (dateString: string | null) => {
      if (!dateString) return '';
      try {
        return new Date(dateString).toLocaleDateString('pt-BR');
      } catch {
        return dateString;
      }
    };

    // Função para formatar status
    const formatStatus = (status: string) => {
      return status === 'ativo' ? 'Ativo' : 'Inativo';
    };

    // Gerar HTML do PDF com design melhorado
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <style>
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            body {
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
              margin: 0;
              padding: 30px;
              font-size: 11px;
              color: #2c3e50;
              background: #fff;
            }
            .header {
              text-align: center;
              margin-bottom: 35px;
              padding-bottom: 25px;
              border-bottom: 3px solid #16a34a;
              background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
              color: white;
              padding: 25px 20px;
              margin: -30px -30px 35px -30px;
              border-radius: 0;
            }
            .header h1 {
              margin: 0;
              font-size: 20px;
              font-weight: 600;
              letter-spacing: 0.5px;
            }
            .info-section {
              margin-bottom: 30px;
              padding: 20px;
              background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
              border-radius: 10px;
              border-left: 5px solid #16a34a;
              box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            }
            .info-section h2 {
              margin: 0 0 15px 0;
              font-size: 18px;
              color: #15803d;
              font-weight: 600;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }
            .info-grid {
              display: grid;
              grid-template-columns: repeat(2, 1fr);
              gap: 12px;
            }
            .info-row {
              display: flex;
              flex-direction: column;
            }
            .info-label {
              font-weight: 600;
              font-size: 10px;
              color: #64748b;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              margin-bottom: 4px;
            }
            .info-value {
              font-size: 13px;
              color: #1e293b;
              font-weight: 500;
            }
            table {
              width: 100%;
              border-collapse: separate;
              border-spacing: 0;
              margin-top: 25px;
              background: white;
              border-radius: 8px;
              overflow: hidden;
              box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            }
            thead {
              background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
            }
            th {
              padding: 12px 10px;
              text-align: left;
              color: white;
              font-weight: 600;
              font-size: 10px;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              border: none;
            }
            th:first-child {
              border-top-left-radius: 8px;
            }
            th:last-child {
              border-top-right-radius: 8px;
            }
            tbody tr {
              transition: background-color 0.2s;
            }
            tbody tr:nth-child(even) {
              background-color: #f8fafc;
            }
            tbody tr:hover {
              background-color: #e0e7ff;
            }
            td {
              padding: 10px;
              border-bottom: 1px solid #e2e8f0;
              color: #334155;
              font-size: 11px;
            }
            tbody tr:last-child td {
              border-bottom: none;
            }
            .status-badge {
              display: inline-block;
              padding: 4px 10px;
              border-radius: 12px;
              font-size: 9px;
              font-weight: 600;
              text-transform: uppercase;
            }
            .status-ativo {
              background-color: #dcfce7;
              color: #166534;
            }
            .status-inativo {
              background-color: #fee2e2;
              color: #991b1b;
            }
            .footer {
              margin-top: 40px;
              padding-top: 20px;
              text-align: center;
              font-size: 9px;
              color: #64748b;
              border-top: 2px solid #e2e8f0;
            }
            .footer p {
              margin: 5px 0;
            }
            .total-badge {
              display: inline-block;
              margin-top: 10px;
              padding: 8px 16px;
              background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
              color: white;
              border-radius: 20px;
              font-weight: 600;
              font-size: 12px;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>📋 Inventário da Equipe</h1>
          </div>
          
          <div class="info-section">
            <h2>Informações da Equipe</h2>
            <div class="info-grid">
              <div class="info-row">
                <span class="info-label">Nome da Equipe</span>
                <span class="info-value">${equipe.nome || 'N/A'}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Operação</span>
                <span class="info-value">${equipe.operacao || 'N/A'}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Contrato</span>
                <span class="info-value">${contrato?.nome || 'N/A'} ${contrato?.codigo ? `(${contrato.codigo})` : ''}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Data de Geração</span>
                <span class="info-value">${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Item</th>
                <th>Código</th>
                <th>Categoria</th>
                <th>Quantidade</th>
                <th>Status</th>
                <th>Nº Laudo</th>
                <th>Validade Laudo</th>
                <th>Data Entrega</th>
              </tr>
            </thead>
            <tbody>
              ${(inventarios || []).map((inv: {
                item_estoque?: {
                  nome?: string
                  codigo?: string
                  categoria?: string
                } | null
                quantidade_total?: number
                status?: string
                numero_laudo?: string | null
                validade_laudo?: string | null
                data_entrega?: string
              }) => {
                const itemEstoque = inv.item_estoque || {};
                const statusClass = inv.status === 'ativo' ? 'status-ativo' : 'status-inativo';
                return `
                  <tr>
                    <td>${itemEstoque.nome || 'N/A'}</td>
                    <td>${itemEstoque.codigo || 'N/A'}</td>
                    <td>${itemEstoque.categoria || 'N/A'}</td>
                    <td style="text-align: center; font-weight: 600;">${inv.quantidade_total || 0}</td>
                    <td><span class="status-badge ${statusClass}">${formatStatus(inv.status || '')}</span></td>
                    <td>${inv.numero_laudo || '-'}</td>
                    <td>${formatDate(inv.validade_laudo || null) || '-'}</td>
                    <td>${formatDate(inv.data_entrega || null) || '-'}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>

          <div class="footer">
            <p class="total-badge">Total de itens: ${(inventarios || []).length}</p>
            <p style="margin-top: 15px;">Gerado em ${new Date().toLocaleString('pt-BR')}</p>
          </div>
        </body>
      </html>
    `;

    // Retornar HTML direto para o frontend abrir em nova aba e imprimir
    return new NextResponse(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
      },
    });
  } catch (error) {
    console.error('Erro ao gerar relatório:', error);
    return NextResponse.json(
      { error: 'Erro ao gerar relatório', details: error instanceof Error ? error.message : 'Erro desconhecido' },
      { status: 500 }
    );
  }
}
