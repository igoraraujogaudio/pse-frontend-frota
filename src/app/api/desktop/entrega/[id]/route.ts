import { NextRequest, NextResponse } from 'next/server';
import { estoqueService } from '@/services/estoqueService';
import { InventarioFuncionario, InventarioEquipe } from '@/types/almoxarifado';
import { createClient } from '@supabase/supabase-js';

/**
 * GET /api/desktop/entrega/[id]
 * Retorna dados da solicitação para a tela de entrega no desktop
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    if (!id) {
      return NextResponse.json(
        { error: 'ID da solicitação é obrigatório' },
        { status: 400 }
      );
    }

    // Buscar solicitação
    const solicitacao = await estoqueService.getSolicitacaoById(id);
    
    if (!solicitacao) {
      return NextResponse.json(
        { error: 'Solicitação não encontrada' },
        { status: 404 }
      );
    }

    // Buscar inventário do destinatário usando service role key para contornar RLS
    let inventario = [];
    try {
      console.log('🔍 [DESKTOP API] Buscando inventário...');
      console.log('📋 [DESKTOP API] Solicitação:', {
        id: solicitacao.id,
        destinatario_id: solicitacao.destinatario_id,
        destinatario_equipe_id: solicitacao.destinatario_equipe_id,
      });
      
      // Criar cliente Supabase com service role key para contornar RLS
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
      const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
      
      if (solicitacao.destinatario_equipe_id) {
        console.log('👥 [DESKTOP API] Buscando inventário da equipe:', solicitacao.destinatario_equipe_id);
        const { data, error } = await supabaseAdmin
          .from('inventario_equipe')
          .select(`
            *,
            equipe:equipes(nome, status),
            item_estoque:itens_estoque(nome, codigo, categoria)
          `)
          .eq('equipe_id', solicitacao.destinatario_equipe_id)
          .order('data_entrega', { ascending: false });
        
        if (error) {
          console.error('❌ [DESKTOP API] Erro ao buscar inventário da equipe:', error);
        } else {
          inventario = data || [];
          console.log('✅ [DESKTOP API] Inventário da equipe encontrado:', inventario.length);
        }
      } else if (solicitacao.destinatario_id) {
        console.log('👤 [DESKTOP API] Buscando inventário do funcionário:', solicitacao.destinatario_id);
        const { data, error } = await supabaseAdmin
          .from('inventario_funcionario')
          .select(`
            *,
            funcionario:usuarios!funcionario_id(id, nome, matricula),
            item_estoque:itens_estoque(nome, codigo, categoria)
          `)
          .eq('funcionario_id', solicitacao.destinatario_id)
          .eq('status', 'em_uso')
          .order('data_entrega', { ascending: false });
        
        if (error) {
          console.error('❌ [DESKTOP API] Erro ao buscar inventário do funcionário:', error);
        } else {
          inventario = data || [];
          console.log('✅ [DESKTOP API] Inventário do funcionário encontrado:', inventario.length);
        }
      } else {
        console.warn('⚠️ [DESKTOP API] Nenhum destinatário encontrado na solicitação');
      }
    } catch (error) {
      console.error('❌ [DESKTOP API] Erro ao buscar inventário:', error);
      if (error instanceof Error) {
        console.error('❌ [DESKTOP API] Mensagem de erro:', error.message);
        console.error('❌ [DESKTOP API] Stack:', error.stack);
      }
      // Continuar sem inventário
    }

    // Formatar dados para o desktop
    console.log('📦 [DESKTOP API] Formatando dados...');
    console.log('📦 [DESKTOP API] Inventário bruto:', inventario);
    
    const data = {
      solicitacao: {
        id: solicitacao.id,
        item_nome: solicitacao.item?.nome || 'Item',
        quantidade_aprovada: solicitacao.quantidade_aprovada || 0,
        quantidade_entregue: solicitacao.quantidade_entregue,
        destinatario: {
          id: solicitacao.destinatario_id || solicitacao.destinatario_equipe_id || '',
          nome: solicitacao.destinatario?.nome || solicitacao.destinatario_equipe?.nome || 'Destinatário',
          matricula: solicitacao.destinatario?.matricula,
        },
        responsavel_equipe: solicitacao.responsavel_equipe ? {
          id: solicitacao.responsavel_equipe.id,
          nome: solicitacao.responsavel_equipe.nome,
        } : null,
        base: {
          id: solicitacao.base_id || '',
          nome: solicitacao.base?.nome || 'Base',
        },
      },
      inventario: inventario.map((item: InventarioFuncionario | InventarioEquipe | Record<string, unknown>) => {
        // Log para debug
        const itemWithEstoque = item as (InventarioFuncionario | InventarioEquipe) & {
          item_estoque?: { nome?: string; codigo?: string; categoria?: string };
        };
        
        console.log('🔍 [DESKTOP API] Mapeando item do inventário:', {
          id: item.id,
          item_estoque: itemWithEstoque.item_estoque,
          quantidade: 'quantidade' in item ? item.quantidade : undefined,
          quantidade_total: 'quantidade_total' in item ? item.quantidade_total : undefined,
        });
        
        const quantidade = 'quantidade' in item 
          ? item.quantidade 
          : ('quantidade_total' in item ? item.quantidade_total : 0);
        
        const itemEstoque = itemWithEstoque.item_estoque;
        
        return {
          id: item.id,
          item_estoque: {
            nome: itemEstoque?.nome || 'Item sem nome',
            codigo: itemEstoque?.codigo || null,
            categoria: itemEstoque?.categoria || 'Outros',
          },
          quantidade,
          data_entrega: 'data_entrega' in item ? item.data_entrega : undefined,
        };
      }),
    };
    
    console.log('✅ [DESKTOP API] Dados formatados:', {
      solicitacao_id: data.solicitacao.id,
      destinatario_id: data.solicitacao.destinatario.id,
      inventario_count: data.inventario.length,
    });

    const response = NextResponse.json(data);
    // Adicionar headers CORS para permitir requisições do desktop app
    response.headers.set('Access-Control-Allow-Origin', '*');
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type');
    return response;
  } catch (error) {
    console.error('Erro ao buscar dados da solicitação:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro ao buscar dados da solicitação';
    const errorResponse = NextResponse.json(
      { error: errorMessage },
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

/**
 * POST /api/desktop/entrega/[id]/confirmar
 * Confirma a entrega com dados biométricos
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { biometricData } = body;

    if (!biometricData) {
      return NextResponse.json(
        { error: 'Dados biométricos são obrigatórios' },
        { status: 400 }
      );
    }

    // Buscar solicitação para obter dados necessários
    const solicitacao = await estoqueService.getSolicitacaoById(id);
    
    if (!solicitacao) {
      return NextResponse.json(
        { error: 'Solicitação não encontrada' },
        { status: 404 }
      );
    }

    // Retornar sucesso - a confirmação será processada pelo fluxo normal de entrega
    // O site chamará entregarItem com os dados biométricos
    const response = NextResponse.json({
      success: true,
      message: 'Confirmação recebida. Processando entrega...',
    });
    response.headers.set('Access-Control-Allow-Origin', '*');
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type');
    return response;
  } catch (error) {
    console.error('Erro ao confirmar entrega:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro ao confirmar entrega';
    const errorResponse = NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
    errorResponse.headers.set('Access-Control-Allow-Origin', '*');
    return errorResponse;
  }
}

