import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      user_id,
      template,
      quality,
      finger = 'other',
      image_base64,
      metadata = {},
    } = body;

    // Validações
    if (!user_id || !template) {
      return NextResponse.json(
        { error: 'user_id e template são obrigatórios' },
        { status: 400 }
      );
    }

    if (quality < 0 || quality > 100) {
      return NextResponse.json(
        { error: 'quality deve estar entre 0 e 100' },
        { status: 400 }
      );
    }

    // Verificar se o usuário existe
    const { data: user, error: userError } = await supabase
      .from('usuarios')
      .select('id, nome')
      .eq('id', user_id)
      .single();

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Usuário não encontrado' },
        { status: 404 }
      );
    }

    // Inserir template no banco de dados
    const { data: templateData, error: insertError } = await supabase
      .from('biometric_templates')
      .insert({
        user_id,
        template,
        quality,
        finger,
        image_base64: image_base64 || null,
        metadata: {
          ...metadata,
          user_name: user.nome,
          registered_at: new Date().toISOString(),
        },
      })
      .select()
      .single();

    if (insertError) {
      console.error('Erro ao inserir template:', insertError);
      return NextResponse.json(
        { error: 'Erro ao salvar template no banco de dados' },
        { status: 500 }
      );
    }

    const response = NextResponse.json({
      success: true,
      data: templateData,
    });
    
    // Adicionar headers CORS
    response.headers.set('Access-Control-Allow-Origin', '*');
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type');
    
    return response;
  } catch (error) {
    console.error('Erro ao registrar template:', error);
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

