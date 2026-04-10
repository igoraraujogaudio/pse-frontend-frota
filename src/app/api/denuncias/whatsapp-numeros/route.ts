import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';

/**
 * GET /api/denuncias/whatsapp-numeros
 * Lista todos os números de WhatsApp configurados
 */
export async function GET() {
  try {
    const supabaseAdmin = createClient();
    
    const { data, error } = await supabaseAdmin
      .from('denuncias_whatsapp_numeros')
      .select('*')
      .order('criado_em', { ascending: false });
    
    if (error) {
      console.error('❌ Erro ao buscar números de WhatsApp:', error);
      return NextResponse.json(
        { error: 'Erro ao buscar números', details: error.message },
        { status: 500 }
      );
    }
    
    return NextResponse.json({ numeros: data || [] });
  } catch (error) {
    console.error('❌ Erro inesperado ao buscar números:', error);
    return NextResponse.json(
      { 
        error: 'Erro inesperado ao buscar números', 
        details: error instanceof Error ? error.message : 'Erro desconhecido' 
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/denuncias/whatsapp-numeros
 * Cria um novo número de WhatsApp
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { numero, nome, descricao, ativo = true } = body;
    
    // Validar campos obrigatórios
    if (!numero || numero.trim().length === 0) {
      return NextResponse.json(
        { error: 'Número é obrigatório' },
        { status: 400 }
      );
    }
    
    // Validar formato do número (apenas dígitos, mínimo 10 caracteres)
    const numeroLimpo = numero.replace(/\D/g, '');
    if (numeroLimpo.length < 10) {
      return NextResponse.json(
        { error: 'Número inválido. Deve conter pelo menos 10 dígitos' },
        { status: 400 }
      );
    }
    
    const supabaseAdmin = createClient();
    
    // Verificar se o número já existe
    const { data: existente } = await supabaseAdmin
      .from('denuncias_whatsapp_numeros')
      .select('id')
      .eq('numero', numeroLimpo)
      .single();
    
    if (existente) {
      return NextResponse.json(
        { error: 'Este número já está configurado' },
        { status: 409 }
      );
    }
    
    // Inserir novo número
    const { data, error } = await supabaseAdmin
      .from('denuncias_whatsapp_numeros')
      .insert({
        numero: numeroLimpo,
        nome: nome?.trim() || null,
        descricao: descricao?.trim() || null,
        ativo: ativo !== false
      })
      .select()
      .single();
    
    if (error) {
      console.error('❌ Erro ao criar número de WhatsApp:', error);
      return NextResponse.json(
        { error: 'Erro ao criar número', details: error.message },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      success: true,
      data,
      message: 'Número adicionado com sucesso!'
    });
  } catch (error) {
    console.error('❌ Erro inesperado ao criar número:', error);
    return NextResponse.json(
      { 
        error: 'Erro inesperado ao criar número', 
        details: error instanceof Error ? error.message : 'Erro desconhecido' 
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/denuncias/whatsapp-numeros
 * Atualiza um número de WhatsApp existente
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, numero, nome, descricao, ativo } = body;
    
    if (!id) {
      return NextResponse.json(
        { error: 'ID é obrigatório' },
        { status: 400 }
      );
    }
    
    const supabaseAdmin = createClient();
    
    // Preparar dados para atualização
    const updateData: {
      nome?: string | null;
      descricao?: string | null;
      ativo?: boolean;
      numero?: string;
    } = {};
    
    if (nome !== undefined) updateData.nome = nome?.trim() || null;
    if (descricao !== undefined) updateData.descricao = descricao?.trim() || null;
    if (ativo !== undefined) updateData.ativo = ativo;
    
    // Se o número foi alterado, validar e limpar
    if (numero) {
      const numeroLimpo = numero.replace(/\D/g, '');
      if (numeroLimpo.length < 10) {
        return NextResponse.json(
          { error: 'Número inválido. Deve conter pelo menos 10 dígitos' },
          { status: 400 }
        );
      }
      
      // Verificar se o novo número já existe em outro registro
      const { data: existente } = await supabaseAdmin
        .from('denuncias_whatsapp_numeros')
        .select('id')
        .eq('numero', numeroLimpo)
        .neq('id', id)
        .single();
      
      if (existente) {
        return NextResponse.json(
          { error: 'Este número já está configurado em outro registro' },
          { status: 409 }
        );
      }
      
      updateData.numero = numeroLimpo;
    }
    
    // Atualizar
    const { data, error } = await supabaseAdmin
      .from('denuncias_whatsapp_numeros')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      console.error('❌ Erro ao atualizar número de WhatsApp:', error);
      return NextResponse.json(
        { error: 'Erro ao atualizar número', details: error.message },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      success: true,
      data,
      message: 'Número atualizado com sucesso!'
    });
  } catch (error) {
    console.error('❌ Erro inesperado ao atualizar número:', error);
    return NextResponse.json(
      { 
        error: 'Erro inesperado ao atualizar número', 
        details: error instanceof Error ? error.message : 'Erro desconhecido' 
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/denuncias/whatsapp-numeros
 * Remove um número de WhatsApp
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
    
    const supabaseAdmin = createClient();
    
    const { error } = await supabaseAdmin
      .from('denuncias_whatsapp_numeros')
      .delete()
      .eq('id', id);
    
    if (error) {
      console.error('❌ Erro ao deletar número de WhatsApp:', error);
      return NextResponse.json(
        { error: 'Erro ao deletar número', details: error.message },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      success: true,
      message: 'Número removido com sucesso!'
    });
  } catch (error) {
    console.error('❌ Erro inesperado ao deletar número:', error);
    return NextResponse.json(
      { 
        error: 'Erro inesperado ao deletar número', 
        details: error instanceof Error ? error.message : 'Erro desconhecido' 
      },
      { status: 500 }
    );
  }
}
