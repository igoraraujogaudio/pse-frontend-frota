import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

interface EmailDesconto {
  id?: string;
  contrato_id?: string;
  codigo_contrato?: string;
  email: string;
  usuario_id?: string;
  ativo: boolean;
  tipo: 'especifico' | 'geral';
  observacoes?: string;
}

// GET - Carregar todos os emails ou filtrar por contrato
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const contratoId = searchParams.get('contrato_id');
    const codigoContrato = searchParams.get('codigo_contrato');
    const tipo = searchParams.get('tipo');
    const ativo = searchParams.get('ativo');

    // Buscar emails sem joins problemáticos
    let query = supabaseAdmin
      .from('emails_desconto_contrato')
      .select('*')
      .order('created_at', { ascending: false });

    if (contratoId) {
      query = query.eq('contrato_id', contratoId);
    }

    if (codigoContrato) {
      query = query.eq('codigo_contrato', codigoContrato);
    }

    if (tipo) {
      query = query.eq('tipo', tipo);
    }

    if (ativo !== null) {
      query = query.eq('ativo', ativo === 'true');
    }

    const { data: emailsData, error } = await query;

    if (error) {
      // Se a tabela não existir, retornar vazio
      if (error.code === '42P01') {
        return NextResponse.json({ emails: [], success: true });
      }
      console.error('❌ Erro ao buscar emails:', error);
      throw error;
    }

    // Buscar informações relacionadas separadamente
    const emailsCompletos = await Promise.all(
      (emailsData || []).map(async (email) => {
        const emailCompleto: EmailDesconto & { contrato?: { id: string; nome: string; codigo: string } | null; usuario?: { id: string; nome: string; email: string; matricula?: string } | null } = { ...email };

        // Buscar contrato se houver
        if (email.contrato_id) {
          try {
            const { data: contrato, error: contratoError } = await supabaseAdmin
              .from('contratos')
              .select('id, nome, codigo')
              .eq('id', email.contrato_id)
              .single();
            
            if (!contratoError && contrato) {
              emailCompleto.contrato = contrato;
            }
          } catch (err) {
            console.warn('⚠️ Erro ao buscar contrato para email:', email.id, err);
          }
        }

        // Buscar usuário se houver
        if (email.usuario_id) {
          try {
            const { data: usuario, error: usuarioError } = await supabaseAdmin
              .from('usuarios')
              .select('id, nome, email, matricula')
              .eq('id', email.usuario_id)
              .single();
            
            if (!usuarioError && usuario) {
              emailCompleto.usuario = usuario;
            }
          } catch (err) {
            console.warn('⚠️ Erro ao buscar usuário para email:', email.id, err);
          }
        }

        return emailCompleto;
      })
    );

    return NextResponse.json({
      success: true,
      emails: emailsCompletos
    });
  } catch (error) {
    console.error('❌ Erro ao carregar emails:', error);
    
    // Extrair informações do erro de forma segura
    let errorMessage = 'Erro desconhecido';
    let errorCode = 'UNKNOWN';
    let errorHint = '';
    let errorDetails = '';

    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (typeof error === 'string') {
      errorMessage = error;
    } else if (error && typeof error === 'object') {
      const errObj = error as { message?: string; error?: string; code?: string; hint?: string; details?: unknown };
      errorMessage = errObj.message || errObj.error || 'Erro desconhecido';
      errorCode = errObj.code || 'UNKNOWN';
      errorHint = errObj.hint || '';
      errorDetails = errObj.details ? String(errObj.details) : '';
    }

    console.error('❌ Detalhes do erro:', {
      message: errorMessage,
      code: errorCode,
      details: errorDetails,
      hint: errorHint
    });
    
    return NextResponse.json(
      {
        error: 'Erro ao carregar emails',
        details: errorMessage,
        code: errorCode,
        hint: errorHint
      },
      { status: 500 }
    );
  }
}

// POST - Criar novo email
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      contrato_id,
      codigo_contrato,
      email,
      usuario_id,
      ativo = true,
      tipo = 'especifico',
      observacoes
    } = body as EmailDesconto;

    if (!email) {
      return NextResponse.json(
        { error: 'Email é obrigatório' },
        { status: 400 }
      );
    }

    // Validar formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Formato de email inválido' },
        { status: 400 }
      );
    }

    // Se foi informado usuario_id, buscar o email do usuário
    let emailFinal = email;
    if (usuario_id && !email) {
      const { data: usuario, error: usuarioError } = await supabaseAdmin
        .from('usuarios')
        .select('email')
        .eq('id', usuario_id)
        .single();

      if (usuarioError || !usuario?.email) {
        return NextResponse.json(
          { error: 'Usuário não encontrado ou sem email cadastrado' },
          { status: 400 }
        );
      }
      emailFinal = usuario.email;
    }

    // Validar se contrato existe (se informado)
    if (contrato_id) {
      const { data: contrato, error: contratoError } = await supabaseAdmin
        .from('contratos')
        .select('id, codigo')
        .eq('id', contrato_id)
        .single();

      if (contratoError || !contrato) {
        return NextResponse.json(
          { error: 'Contrato não encontrado' },
          { status: 400 }
        );
      }
    }

    // Verificar se já existe (evitar duplicatas)
    let existingQuery = supabaseAdmin
      .from('emails_desconto_contrato')
      .select('id')
      .eq('email', emailFinal)
      .eq('ativo', true);

    if (contrato_id) {
      existingQuery = existingQuery.eq('contrato_id', contrato_id);
    } else if (codigo_contrato) {
      existingQuery = existingQuery.eq('codigo_contrato', codigo_contrato);
    } else if (tipo === 'geral') {
      existingQuery = existingQuery
        .is('contrato_id', null)
        .is('codigo_contrato', null)
        .eq('tipo', 'geral');
    }

    const { data: existing, error: existingError } = await existingQuery.maybeSingle();

    // Se houver erro diferente de "não encontrado", retornar erro
    if (existingError && existingError.code !== 'PGRST116') {
      console.error('Erro ao verificar duplicatas:', existingError);
      return NextResponse.json(
        { error: 'Erro ao verificar duplicatas', details: existingError.message },
        { status: 500 }
      );
    }

    if (existing) {
      return NextResponse.json(
        { error: 'Este email já está cadastrado para este contrato' },
        { status: 400 }
      );
    }

    // Preparar dados para inserção
    const emailData: Record<string, unknown> = {
      email: emailFinal,
      ativo,
      tipo,
      observacoes: observacoes || null
    };

    // Se tipo é geral, não deve ter contrato_id ou codigo_contrato
    if (tipo === 'geral') {
      emailData.contrato_id = null;
      emailData.codigo_contrato = null;
    } else {
      if (contrato_id) {
        emailData.contrato_id = contrato_id;
      }

      if (codigo_contrato && !contrato_id) {
        emailData.codigo_contrato = codigo_contrato;
      }
    }

    if (usuario_id) {
      emailData.usuario_id = usuario_id;
    }

    console.log('📝 Inserindo email:', { emailData, tipo, contrato_id, codigo_contrato });

    // Inserir
    const { data, error } = await supabaseAdmin
      .from('emails_desconto_contrato')
      .insert(emailData)
      .select(`
        *,
        contrato:contratos(id, nome, codigo),
        usuario:usuarios!usuario_id(id, nome, email, matricula)
      `)
      .single();

    if (error) {
      console.error('❌ Erro ao inserir email:', error);
      console.error('❌ Detalhes do erro:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint
      });
      
      // Retornar mensagem de erro mais específica
      let errorMessage = 'Erro ao criar email';
      if (error.code === '23505') { // Violação de constraint única
        errorMessage = 'Este email já está cadastrado';
      } else if (error.code === '23503') { // Violação de foreign key
        errorMessage = 'Contrato ou usuário não encontrado';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      return NextResponse.json(
        {
          error: errorMessage,
          details: error.message || 'Erro desconhecido',
          code: error.code
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      email: data,
      message: 'Email cadastrado com sucesso'
    });
  } catch (error) {
    console.error('❌ Erro ao criar email (catch):', error);
    console.error('❌ Stack:', error instanceof Error ? error.stack : 'N/A');
    
    return NextResponse.json(
      {
        error: 'Erro ao criar email',
        details: error instanceof Error ? error.message : String(error),
        type: error instanceof Error ? error.constructor.name : typeof error
      },
      { status: 500 }
    );
  }
}

// PUT - Atualizar email
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      id,
      contrato_id,
      codigo_contrato,
      email,
      usuario_id,
      ativo,
      tipo,
      observacoes
    } = body as EmailDesconto & { id: string };

    if (!id) {
      return NextResponse.json(
        { error: 'ID é obrigatório' },
        { status: 400 }
      );
    }

    // Buscar email existente
    const { data: existing, error: existingError } = await supabaseAdmin
      .from('emails_desconto_contrato')
      .select('*')
      .eq('id', id)
      .single();

    if (existingError || !existing) {
      return NextResponse.json(
        { error: 'Email não encontrado' },
        { status: 404 }
      );
    }

    // Preparar dados para atualização
    const updateData: Record<string, unknown> = {};

    if (email !== undefined) {
      // Validar formato de email
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return NextResponse.json(
          { error: 'Formato de email inválido' },
          { status: 400 }
        );
      }
      updateData.email = email;
    }

    if (usuario_id !== undefined) {
      updateData.usuario_id = usuario_id;
      
      // Se usuario_id foi informado e email não, buscar email do usuário
      if (usuario_id && !email) {
        const { data: usuario } = await supabaseAdmin
          .from('usuarios')
          .select('email')
          .eq('id', usuario_id)
          .single();

        if (usuario?.email) {
          updateData.email = usuario.email;
        }
      }
    }

    if (contrato_id !== undefined) {
      if (contrato_id) {
        // Validar se contrato existe
        const { data: contrato } = await supabaseAdmin
          .from('contratos')
          .select('id, codigo')
          .eq('id', contrato_id)
          .single();

        if (!contrato) {
          return NextResponse.json(
            { error: 'Contrato não encontrado' },
            { status: 400 }
          );
        }
      }
      updateData.contrato_id = contrato_id;
    }

    if (codigo_contrato !== undefined) {
      updateData.codigo_contrato = codigo_contrato;
    }

    if (ativo !== undefined) {
      updateData.ativo = ativo;
    }

    if (tipo !== undefined) {
      updateData.tipo = tipo;
    }

    if (observacoes !== undefined) {
      updateData.observacoes = observacoes;
    }

    // Atualizar
    const { data, error } = await supabaseAdmin
      .from('emails_desconto_contrato')
      .update(updateData)
      .eq('id', id)
      .select(`
        *,
        contrato:contratos(id, nome, codigo),
        usuario:usuarios!usuario_id(id, nome, email, matricula)
      `)
      .single();

    if (error) {
      console.error('Erro ao atualizar email:', error);
      throw error;
    }

    return NextResponse.json({
      success: true,
      email: data,
      message: 'Email atualizado com sucesso'
    });
  } catch (error) {
    console.error('Erro ao atualizar email:', error);
    return NextResponse.json(
      {
        error: 'Erro ao atualizar email',
        details: error instanceof Error ? error.message : 'Erro desconhecido'
      },
      { status: 500 }
    );
  }
}

// DELETE - Remover email
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'ID é obrigatório' },
        { status: 400 }
      );
    }

    const { error } = await supabaseAdmin
      .from('emails_desconto_contrato')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: 'Email removido com sucesso'
    });
  } catch (error) {
    console.error('Erro ao remover email:', error);
    return NextResponse.json(
      {
        error: 'Erro ao remover email',
        details: error instanceof Error ? error.message : 'Erro desconhecido'
      },
      { status: 500 }
    );
  }
}
