import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params;
    
    console.log('🔍 [API] GET /api/biometric/templates/user/[userId] chamado com userId:', userId);

    if (!userId) {
      console.error('❌ [API] userId não fornecido');
      return NextResponse.json(
        { error: 'userId é obrigatório' },
        { status: 400 }
      );
    }

    const { data: templates, error } = await supabase
      .from('biometric_templates')
      .select('*')
      .eq('user_id', userId)
      .eq('ativo', true)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Erro ao buscar templates:', error);
      return NextResponse.json(
        { error: 'Erro ao buscar templates' },
        { status: 500 }
      );
    }

    const response = NextResponse.json({
      success: true,
      data: templates || [],
    });
    
    // Adicionar headers CORS
    response.headers.set('Access-Control-Allow-Origin', '*');
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type');
    
    return response;
  } catch (error) {
    console.error('Erro ao listar templates:', error);
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

