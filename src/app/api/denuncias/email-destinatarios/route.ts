import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';

/**
 * GET /api/denuncias/email-destinatarios
 * Lista todos os emails destinatários
 */
export async function GET() {
  try {
    const supabase = createClient();
    
    const { data, error } = await supabase
      .from('denuncias_email_destinatarios')
      .select(`
        *,
        usuarios!denuncias_email_destinatarios_usuario_id_fkey(id, nome, email, status)
      `)
      .order('criado_em', { ascending: false });

    if (error) {
      console.error('❌ Erro ao buscar emails:', error);
      return NextResponse.json(
        { error: 'Erro ao buscar emails', details: error.message },
        { status: 500 }
      );
    }

    // Processar dados para incluir informações do usuário
    type EmailItem = {
      usuarios?: {id: string; nome: string; email: string; status: string} | Array<{id: string; nome: string; email: string; status: string}> | null;
      email: string;
      [key: string]: unknown;
    };
    const processedData = data?.map((item: EmailItem) => {
      const usuario = item.usuarios ? (Array.isArray(item.usuarios) ? item.usuarios[0] : item.usuarios) : null;
      return {
        ...item,
        usuario: usuario,
        email_final: usuario && usuario.email ? usuario.email : item.email
      };
    }) || [];

    return NextResponse.json({ data: processedData });
  } catch (error) {
    console.error('❌ Erro inesperado:', error);
    return NextResponse.json(
      { error: 'Erro inesperado', details: error instanceof Error ? error.message : 'Erro desconhecido' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/denuncias/email-destinatarios
 * Cria um novo email destinatário
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, nome, descricao, usuario_id } = body;

    const supabase = createClient();

    // Se tem usuario_id, validar que o usuário existe e está ativo
    if (usuario_id) {
      const { data: usuario, error: usuarioError } = await supabase
        .from('usuarios')
        .select('id, email, nome, status')
        .eq('id', usuario_id)
        .single();

      if (usuarioError || !usuario) {
        return NextResponse.json(
          { error: 'Usuário não encontrado' },
          { status: 404 }
        );
      }

      if (usuario.status !== 'ativo') {
        return NextResponse.json(
          { error: 'Usuário não está ativo' },
          { status: 400 }
        );
      }

      // Se tem usuario_id, usar email do usuário
      const { data, error } = await supabase
        .from('denuncias_email_destinatarios')
        .insert({
          usuario_id: usuario_id,
          email: usuario.email, // Email do usuário
          nome: nome?.trim() || usuario.nome || null,
          descricao: descricao?.trim() || null,
          ativo: true
        })
        .select(`
          *,
          usuarios!denuncias_email_destinatarios_usuario_id_fkey(id, nome, email, status)
        `)
        .single();

      if (error) {
        if (error.code === '23505') { // Unique violation
          return NextResponse.json(
            { error: 'Este usuário já está cadastrado como destinatário' },
            { status: 409 }
          );
        }
        console.error('❌ Erro ao criar email:', error);
        return NextResponse.json(
          { error: 'Erro ao criar email', details: error.message },
          { status: 500 }
        );
      }

      return NextResponse.json({ 
        data: {
          ...data,
          usuario: data.usuarios ? (Array.isArray(data.usuarios) ? data.usuarios[0] : data.usuarios) : null
        }
      }, { status: 201 });
    }

    // Se não tem usuario_id, validar email
    if (!email || !email.trim()) {
      return NextResponse.json(
        { error: 'Email é obrigatório quando não há usuário selecionado' },
        { status: 400 }
      );
    }

    // Validar formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return NextResponse.json(
        { error: 'Email inválido' },
        { status: 400 }
      );
    }
    
    const { data, error } = await supabase
      .from('denuncias_email_destinatarios')
      .insert({
        email: email.trim().toLowerCase(),
        nome: nome?.trim() || null,
        descricao: descricao?.trim() || null,
        ativo: true
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') { // Unique violation
        return NextResponse.json(
          { error: 'Este email já está cadastrado' },
          { status: 409 }
        );
      }
      console.error('❌ Erro ao criar email:', error);
      return NextResponse.json(
        { error: 'Erro ao criar email', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    console.error('❌ Erro inesperado:', error);
    return NextResponse.json(
      { error: 'Erro inesperado', details: error instanceof Error ? error.message : 'Erro desconhecido' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/denuncias/email-destinatarios
 * Atualiza um email destinatário
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, email, nome, descricao, ativo } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'ID é obrigatório' },
        { status: 400 }
      );
    }

    const supabase = createClient();
    
    const updateData: {
      email?: string;
      nome?: string | null;
      descricao?: string | null;
      ativo?: boolean;
    } = {};
    if (email !== undefined) {
      if (!email.trim()) {
        return NextResponse.json(
          { error: 'Email não pode ser vazio' },
          { status: 400 }
        );
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        return NextResponse.json(
          { error: 'Email inválido' },
          { status: 400 }
        );
      }
      updateData.email = email.trim().toLowerCase();
    }
    if (nome !== undefined) updateData.nome = nome?.trim() || null;
    if (descricao !== undefined) updateData.descricao = descricao?.trim() || null;
    if (ativo !== undefined) updateData.ativo = ativo;

    const { data, error } = await supabase
      .from('denuncias_email_destinatarios')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'Este email já está cadastrado' },
          { status: 409 }
        );
      }
      console.error('❌ Erro ao atualizar email:', error);
      return NextResponse.json(
        { error: 'Erro ao atualizar email', details: error.message },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { error: 'Email não encontrado' },
        { status: 404 }
      );
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error('❌ Erro inesperado:', error);
    return NextResponse.json(
      { error: 'Erro inesperado', details: error instanceof Error ? error.message : 'Erro desconhecido' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/denuncias/email-destinatarios
 * Remove um email destinatário
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'ID é obrigatório' },
        { status: 400 }
      );
    }

    const supabase = createClient();
    
    const { error } = await supabase
      .from('denuncias_email_destinatarios')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('❌ Erro ao deletar email:', error);
      return NextResponse.json(
        { error: 'Erro ao deletar email', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('❌ Erro inesperado:', error);
    return NextResponse.json(
      { error: 'Erro inesperado', details: error instanceof Error ? error.message : 'Erro desconhecido' },
      { status: 500 }
    );
  }
}
