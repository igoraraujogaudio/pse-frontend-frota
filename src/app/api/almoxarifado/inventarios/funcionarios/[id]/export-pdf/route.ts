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
    const { id: funcionarioId } = await params;

    // Buscar dados do funcionário com contrato
    const { data: funcionario, error: funcionarioError } = await supabaseAdmin
      .from('usuarios')
      .select(`
        id,
        nome,
        matricula,
        cargo,
        contrato_origem_id
      `)
      .eq('id', funcionarioId)
      .single();

    if (funcionarioError || !funcionario) {
      return NextResponse.json(
        { error: 'Funcionário não encontrado' },
        { status: 404 }
      );
    }

    // Buscar contrato do funcionário
    let contrato = null;
    if (funcionario.contrato_origem_id) {
      const { data: contratoData } = await supabaseAdmin
        .from('contratos')
        .select('id, nome, codigo')
        .eq('id', funcionario.contrato_origem_id)
        .single();
      
      contrato = contratoData;
    }

    // Buscar inventário do funcionário
    // Buscar inventário do funcionário com dados do supervisor
    const { data: inventarios, error: inventarioError } = await supabaseAdmin
      .from('inventario_funcionario')
      .select(`
        *,
        item_estoque:itens_estoque(nome, codigo, categoria),
        supervisor:usuarios!inventario_funcionario_recebido_por_supervisor_id_fkey(id, nome)
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
      const statusMap: Record<string, string> = {
        'em_uso': 'Em Uso',
        'devolvido': 'Devolvido',
        'perdido': 'Perdido',
        'danificado': 'Danificado',
        'vencido': 'Vencido'
      };
      return statusMap[status] || status;
    };

    // Função para formatar condição
    const formatCondicao = (condicao: string | null) => {
      if (!condicao) return '';
      const condicaoMap: Record<string, string> = {
        'novo': 'Novo',
        'usado_bom': 'Usado - Bom',
        'usado_regular': 'Usado - Regular',
        'usado_ruim': 'Usado - Ruim',
        'danificado': 'Danificado'
      };
      return condicaoMap[condicao] || condicao;
    };

    // Função para obter classe CSS do status
    const getStatusClass = (status: string) => {
      const statusClasses: Record<string, string> = {
        'em_uso': 'status-ativo',
        'devolvido': 'status-devolvido',
        'perdido': 'status-perdido',
        'danificado': 'status-danificado',
        'vencido': 'status-vencido'
      };
      return statusClasses[status] || '';
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
            .status-devolvido {
              background-color: #e0e7ff;
              color: #3730a3;
            }
            .status-perdido {
              background-color: #fee2e2;
              color: #991b1b;
            }
            .status-danificado {
              background-color: #fef3c7;
              color: #92400e;
            }
            .status-vencido {
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
            .supervisor-badge {
              display: inline-block;
              padding: 3px 8px;
              border-radius: 8px;
              font-size: 9px;
              font-weight: 600;
              background-color: #fef3c7;
              color: #92400e;
            }
            .validado-badge {
              display: inline-block;
              padding: 3px 8px;
              border-radius: 8px;
              font-size: 9px;
              font-weight: 600;
              background-color: #dcfce7;
              color: #166534;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>👤 Inventário do Funcionário</h1>
          </div>
          
          <div class="info-section">
            <h2>Informações do Funcionário</h2>
            <div class="info-grid">
              <div class="info-row">
                <span class="info-label">Nome</span>
                <span class="info-value">${funcionario.nome || 'N/A'}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Matrícula</span>
                <span class="info-value">${funcionario.matricula || 'N/A'}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Cargo</span>
                <span class="info-value">${funcionario.cargo || 'N/A'}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Contrato</span>
                <span class="info-value">${contrato?.nome || 'N/A'} ${contrato?.codigo ? `(${contrato.codigo})` : ''}</span>
              </div>
              <div class="info-row" style="grid-column: 1 / -1;">
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
                <th>Condição</th>
                <th>Nº Laudo</th>
                <th>Validade Laudo</th>
                <th>Data Entrega</th>
                <th>Recebimento</th>
              </tr>
            </thead>
            <tbody>
              ${(inventarios || []).map((inv: {
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
                supervisor?: { id?: string; nome?: string } | null
                recebido_por_supervisor_id?: string | null
                pendente_validacao_funcionario?: boolean
                data_entrega_supervisor?: string | null
                data_validacao_funcionario?: string | null
              }) => {
                const itemEstoque = inv.item_estoque || {};
                const statusClass = getStatusClass(inv.status || '');

                // Determinar texto de recebimento
                let recebimentoHtml = '-';
                if (inv.pendente_validacao_funcionario && inv.supervisor?.nome) {
                  // Item pendente de validação - entregue ao supervisor
                  recebimentoHtml = `<span class="supervisor-badge">Entregue ao Supervisor: ${inv.supervisor.nome}</span>`;
                } else if (!inv.pendente_validacao_funcionario && inv.recebido_por_supervisor_id && inv.supervisor?.nome) {
                  // Item já validado pelo funcionário, mas foi inicialmente entregue ao supervisor
                  recebimentoHtml = `<span class="validado-badge">Recebido pelo funcionário em ${formatDate(inv.data_validacao_funcionario || null)}</span><br/><span style="font-size:8px;color:#64748b;">Via supervisor: ${inv.supervisor.nome}</span>`;
                }

                return `
                  <tr>
                    <td>${itemEstoque.nome || 'N/A'}</td>
                    <td>${itemEstoque.codigo || 'N/A'}</td>
                    <td>${itemEstoque.categoria || 'N/A'}</td>
                    <td style="text-align: center; font-weight: 600;">${inv.quantidade || 0}</td>
                    <td><span class="status-badge ${statusClass}">${formatStatus(inv.status || '')}</span></td>
                    <td>${formatCondicao(inv.condicao_entrega || null) || '-'}</td>
                    <td>${inv.numero_laudo || '-'}</td>
                    <td>${formatDate(inv.validade_laudo || null) || '-'}</td>
                    <td>${formatDate(inv.data_entrega || null) || '-'}</td>
                    <td>${recebimentoHtml}</td>
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
