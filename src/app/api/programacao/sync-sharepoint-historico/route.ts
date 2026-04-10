import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';

/**
 * API para importar dados HISTÓRICOS do SharePoint (antes de 2026-01-01)
 * 
 * Diferenças do sync-sharepoint normal:
 * 1. Aceita datas ANTES de outubro/2025
 * 2. Marca automaticamente como is_historico = TRUE
 * 3. NÃO apaga dados existentes (apenas adiciona)
 * 
 * USO:
 * POST /api/programacao/sync-sharepoint-historico?contrato=Niterói
 * 
 * IMPORTANTE: Execute apenas UMA VEZ para importar histórico
 */

export async function POST(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const contratoNome = searchParams.get('contrato');

    if (!contratoNome) {
      return NextResponse.json(
        { 
          error: 'Parâmetro "contrato" é obrigatório',
          exemplo: '/api/programacao/sync-sharepoint-historico?contrato=Niterói'
        },
        { status: 400 }
      );
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log(`📜 IMPORTAÇÃO DE HISTÓRICO - ${contratoNome}`);
    console.log(`${'='.repeat(60)}\n`);

    // Redirecionar para o endpoint normal com flag especial
    const url = new URL('/api/programacao/sync-sharepoint', request.url);
    url.searchParams.set('contrato', contratoNome);
    url.searchParams.set('modo', 'historico'); // Flag especial

    // Fazer requisição interna
    const response = await fetch(url.toString(), {
      method: 'POST',
      headers: request.headers,
    });

    const data = await response.json();

    return NextResponse.json({
      ...data,
      modo: 'historico',
      mensagem: 'Importação de histórico concluída. Dados marcados como is_historico = TRUE e protegidos contra exclusão.'
    });

  } catch (error) {
    console.error('❌ Erro na importação de histórico:', error);
    return NextResponse.json(
      { 
        error: 'Erro ao importar histórico',
        detalhes: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    endpoint: '/api/programacao/sync-sharepoint-historico',
    descricao: 'Importa dados históricos do SharePoint (antes de 2026-01-01)',
    uso: 'POST /api/programacao/sync-sharepoint-historico?contrato=Niterói',
    caracteristicas: [
      'Aceita datas antes de outubro/2025',
      'Marca automaticamente como is_historico = TRUE',
      'NÃO apaga dados existentes',
      'Dados protegidos contra exclusão na sincronização normal'
    ],
    importante: 'Execute apenas UMA VEZ para importar o histórico'
  });
}
