import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const userId = searchParams.get('userId');
    const adminId = searchParams.get('adminId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    let query = supabaseAdmin
      .from('logs_redefinicao_senha')
      .select(`
        *,
        usuario:usuarios!logs_redefinicao_senha_usuario_id_fkey(id, nome, email),
        admin:usuarios!logs_redefinicao_senha_admin_id_fkey(id, nome, email)
      `)
      .order('redefinido_em', { ascending: false });

    // Aplicar filtros
    if (userId) {
      query = query.eq('usuario_id', userId);
    }

    if (adminId) {
      query = query.eq('admin_id', adminId);
    }

    if (startDate) {
      query = query.gte('redefinido_em', startDate);
    }

    if (endDate) {
      query = query.lte('redefinido_em', endDate);
    }

    // Contar total de registros
    const { count: totalCount } = await supabaseAdmin
      .from('logs_redefinicao_senha')
      .select('*', { count: 'exact', head: true });

    // Buscar dados paginados
    const offset = (page - 1) * limit;
    const { data: logs, error } = await query
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Erro ao buscar logs de reset:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const totalPages = Math.ceil((totalCount || 0) / limit);

    return NextResponse.json({
      logs: logs || [],
      pagination: {
        page,
        limit,
        total: totalCount || 0,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    });

  } catch (error) {
    console.error('Erro na API de logs de reset:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const { usuario_id, admin_id, motivo } = await req.json();

    if (!usuario_id || !admin_id) {
      return NextResponse.json(
        { error: 'usuario_id e admin_id são obrigatórios' },
        { status: 400 }
      );
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data, error } = await supabaseAdmin
      .from('logs_redefinicao_senha')
      .insert({
        usuario_id,
        admin_id,
        motivo,
        redefinido_em: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('Erro ao criar log de reset:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ log: data });

  } catch (error) {
    console.error('Erro na API de criação de log:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
