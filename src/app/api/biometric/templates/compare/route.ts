import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { template, threshold = 80.0, destinatarioId } = body;

    if (!template) {
      return NextResponse.json(
        { error: 'template é obrigatório' },
        { status: 400 }
      );
    }

    // Buscar templates cadastrados
    // Se destinatarioId for fornecido, filtrar apenas templates desse usuário
    let query = supabase
      .from('biometric_templates')
      .select('id, user_id, template, metadata')
      .eq('ativo', true);
    
    if (destinatarioId) {
      console.log(`🔍 [COMPARE] Filtrando templates para destinatarioId: ${destinatarioId}`);
      query = query.eq('user_id', destinatarioId);
    } else {
      console.log('⚠️ [COMPARE] destinatarioId não fornecido, buscando TODOS os templates (pode ser lento)');
    }

    const { data: templates, error: fetchError } = await query;

    if (fetchError) {
      console.error('❌ [COMPARE] Erro ao buscar templates:', fetchError);
      return NextResponse.json(
        { error: 'Erro ao buscar templates' },
        { status: 500 }
      );
    }

    if (!templates || templates.length === 0) {
      console.log(`⚠️ [COMPARE] Nenhum template encontrado${destinatarioId ? ` para destinatarioId: ${destinatarioId}` : ''}`);
      return NextResponse.json({
        success: true,
        data: {
          match: false,
          similarity: 0,
          threshold,
        },
      });
    }

    console.log(`✅ [COMPARE] Encontrados ${templates.length} template(s)${destinatarioId ? ` para destinatarioId: ${destinatarioId}` : ' (todos os usuários)'}`);

    // Usar o desktop app para fazer a comparação biométrica usando o SDK
    // Buscar templates do banco e comparar cada um usando o desktop app
    const POSSIBLE_PORTS = [3001, 3002, 3003, 3004, 3005, 3006, 3007, 3008, 3009, 3010];
    let desktopPort: number | null = null;

    // Descobrir porta do desktop app
    for (const port of POSSIBLE_PORTS) {
      try {
        const statusResponse = await fetch(`http://localhost:${port}/api/status`, {
          method: 'GET',
          signal: AbortSignal.timeout(1000),
        });
        if (statusResponse.ok) {
          desktopPort = port;
          break;
        }
      } catch {
        continue;
      }
    }

    let bestMatch: {
      match: boolean;
      similarity: number;
      template_id?: string;
      user_id?: string;
      user_name?: string;
    } = {
      match: false,
      similarity: 0,
    };

    // Se desktop app está disponível, usar SDK para comparar cada template do banco
    if (desktopPort !== null) {
      console.log(`Desktop app encontrado na porta ${desktopPort}. Comparando ${templates.length} templates usando SDK...`);
      
      // Comparar com cada template do banco usando o SDK do desktop app
      for (const dbTemplate of templates) {
        try {
          const compareResponse = await fetch(`http://localhost:${desktopPort}/api/templates/compare`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              template1: template,
              template2: dbTemplate.template,
            }),
            signal: AbortSignal.timeout(5000),
          });

          if (compareResponse.ok) {
            const compareData = await compareResponse.json();
            if (compareData.success && compareData.data) {
              const similarity = compareData.data.similarity || 0;
              
              // Se encontrou um match melhor que o threshold e melhor que o anterior
              if (similarity >= threshold && similarity > bestMatch.similarity) {
                bestMatch = {
                  match: true,
                  similarity,
                  template_id: dbTemplate.id,
                  user_id: dbTemplate.user_id,
                  user_name: (dbTemplate.metadata as { user_name?: string } | null)?.user_name,
                };
                console.log(`Match encontrado: ${similarity.toFixed(2)}% com template ${dbTemplate.id}`);
              }
            }
          }
        } catch (error) {
          console.warn(`Erro ao comparar com template ${dbTemplate.id}:`, error);
          continue;
        }
      }
    } else {
      console.warn('Desktop app não encontrado. Usando fallback de comparação simples.');
    }

    // Fallback: se não encontrou match via SDK ou desktop não disponível
    if (!bestMatch.match && templates.length > 0) {
      // Comparação simples: verificar se o template é exatamente igual
      const exactMatch = templates.find((t) => t.template === template);
      if (exactMatch) {
        bestMatch = {
          match: true,
          similarity: 100,
          template_id: exactMatch.id,
          user_id: exactMatch.user_id,
          user_name: (exactMatch.metadata as { user_name?: string } | null)?.user_name,
        };
        console.log('Match exato encontrado (templates idênticos)');
      }
    }

    const response = NextResponse.json({
      success: true,
      data: {
        ...bestMatch,
        threshold,
      },
    });
    
    // Adicionar headers CORS
    response.headers.set('Access-Control-Allow-Origin', '*');
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type');
    
    return response;
  } catch (error) {
    console.error('Erro ao comparar template:', error);
    const errorResponse = NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
    errorResponse.headers.set('Access-Control-Allow-Origin', '*');
    return errorResponse;
  }
}

// Handler OPTIONS para CORS preflight
export async function OPTIONS() {
  const response = new NextResponse(null, { status: 200 });
  response.headers.set('Access-Control-Allow-Origin', '*');
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type');
  return response;
}

