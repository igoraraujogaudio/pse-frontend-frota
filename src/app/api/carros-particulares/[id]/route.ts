// =============================
// API: CARRO PARTICULAR INDIVIDUAL
// =============================

import { NextRequest, NextResponse } from 'next/server';
import { createClientWithAuth } from '@/lib/supabase';
import { carrosParticularesService } from '@/services/carrosParticularesService';
import { modularPermissionService } from '@/services/modularPermissionService';

// GET: Buscar carro particular específico
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: carroId } = await params;
    
    // Get the authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Token de autorização não fornecido' }, { status: 401 });
    }
    
    const token = authHeader.replace('Bearer ', '');
    const supabase = createClientWithAuth(token);
    
    // Obter usuário logado
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    // Buscar dados do funcionário
    const { data: funcionario, error: funcionarioError } = await supabase
      .from('usuarios')
      .select('id')
      .eq('auth_usuario_id', user.id)
      .single();

    if (funcionarioError || !funcionario) {
      return NextResponse.json({ error: 'Funcionário não encontrado' }, { status: 404 });
    }

    // Buscar carro particular
    const { data: carro, error: carroError } = await supabase
      .from('carros_particulares')
      .select(`
        id,
        placa,
        ativo,
        criado_em,
        atualizado_em,
        funcionario:usuarios!carros_particulares_funcionario_id_fkey(id, nome, matricula, email)
      `)
      .eq('id', carroId)
      .eq('funcionario_id', funcionario.id)
      .single();

    if (carroError || !carro) {
      return NextResponse.json({ error: 'Carro não encontrado' }, { status: 404 });
    }

    return NextResponse.json({ carro });

  } catch (error) {
    console.error('Erro ao buscar carro particular:', error);
    return NextResponse.json({ 
      error: 'Erro interno do servidor',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    }, { status: 500 });
  }
}

// PUT: Atualizar carro particular
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: carroId } = await params;
    
    // Get the authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Token de autorização não fornecido' }, { status: 401 });
    }
    
    const token = authHeader.replace('Bearer ', '');
    const supabase = createClientWithAuth(token);
    
    // Obter usuário logado
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    // Buscar dados do funcionário
    const { data: funcionario, error: funcionarioError } = await supabase
      .from('usuarios')
      .select('id, nivel_acesso')
      .eq('auth_usuario_id', user.id)
      .single();

    if (funcionarioError || !funcionario) {
      return NextResponse.json({ error: 'Funcionário não encontrado' }, { status: 404 });
    }

    // Verificar se tem permissão para gestão completa de frota (carros particulares)
    const hasFleetPermission = await modularPermissionService.checkUserPermissionModular(
      funcionario.id, 
      'veiculos.site.gestao_completa_frota'
    );

    const { placa, funcionario_id } = await request.json();

    if (!placa) {
      return NextResponse.json({ error: 'Placa é obrigatória' }, { status: 400 });
    }

    if (!funcionario_id) {
      return NextResponse.json({ error: 'Funcionário é obrigatório' }, { status: 400 });
    }

    // Validar formato da placa
    if (!carrosParticularesService.validarPlaca(placa)) {
      return NextResponse.json({ error: 'Formato de placa inválido' }, { status: 400 });
    }

    // Verificar se já existe outro carro com esta placa (exceto o atual)
    const { data: carroComMesmaPlaca, error: placaError } = await supabase
      .from('carros_particulares')
      .select('id')
      .eq('placa', placa)
      .eq('ativo', true)
      .neq('id', carroId)
      .single();

    if (placaError && placaError.code !== 'PGRST116') {
      console.error('Erro ao verificar placa existente:', placaError);
      return NextResponse.json({ error: 'Erro ao verificar placa' }, { status: 500 });
    }

    if (carroComMesmaPlaca) {
      return NextResponse.json({ error: 'Já existe outro carro cadastrado com esta placa' }, { status: 409 });
    }

    // Verificar se o carro existe e se o usuário tem permissão
    let query = supabase
      .from('carros_particulares')
      .select('id, funcionario_id')
      .eq('id', carroId)
      .eq('ativo', true);

    // Se não tem permissão de gestão de frota, verificar se o carro pertence ao funcionário
    if (!hasFleetPermission) {
      query = query.eq('funcionario_id', funcionario.id);
    }

    const { data: carroExistente, error: checkError } = await query.single();

    if (checkError || !carroExistente) {
      return NextResponse.json({ error: 'Carro não encontrado' }, { status: 404 });
    }

    // Atualizar carro
    const { data: carroAtualizado, error: updateError } = await supabase
      .from('carros_particulares')
      .update({
        placa: placa,
        funcionario_id: funcionario_id,
        atualizado_em: new Date().toISOString()
      })
      .eq('id', carroId)
      .select(`
        *,
        funcionario:usuarios!carros_particulares_funcionario_id_fkey(id, nome, matricula, email)
      `)
      .single();

    if (updateError) {
      console.error('Erro ao atualizar carro:', updateError);
      return NextResponse.json({ 
        error: 'Erro ao atualizar carro',
        details: updateError.message
      }, { status: 500 });
    }

    return NextResponse.json({ 
      carro: carroAtualizado,
      message: 'Carro atualizado com sucesso'
    });

  } catch (error) {
    console.error('Erro ao atualizar carro particular:', error);
    return NextResponse.json({ 
      error: 'Erro interno do servidor',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    }, { status: 500 });
  }
}

// DELETE: Desativar carro particular
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: carroId } = await params;
    
    // Get the authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Token de autorização não fornecido' }, { status: 401 });
    }
    
    const token = authHeader.replace('Bearer ', '');
    const supabase = createClientWithAuth(token);
    
    // Obter usuário logado
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    // Buscar dados do funcionário
    const { data: funcionario, error: funcionarioError } = await supabase
      .from('usuarios')
      .select('id')
      .eq('auth_usuario_id', user.id)
      .single();

    if (funcionarioError || !funcionario) {
      return NextResponse.json({ error: 'Funcionário não encontrado' }, { status: 404 });
    }

    // Verificar se o carro pertence ao funcionário
    const { data: carroExistente, error: checkError } = await supabase
      .from('carros_particulares')
      .select('id, placa')
      .eq('id', carroId)
      .eq('funcionario_id', funcionario.id)
      .eq('ativo', true)
      .single();

    if (checkError || !carroExistente) {
      return NextResponse.json({ error: 'Carro não encontrado' }, { status: 404 });
    }

    // Desativar carro (soft delete)
    const { error: deleteError } = await supabase
      .from('carros_particulares')
      .update({
        ativo: false,
        atualizado_em: new Date().toISOString()
      })
      .eq('id', carroId);

    if (deleteError) {
      console.error('Erro ao desativar carro:', deleteError);
      return NextResponse.json({ 
        error: 'Erro ao desativar carro',
        details: deleteError.message
      }, { status: 500 });
    }

    return NextResponse.json({ 
      message: 'Carro desativado com sucesso'
    });

  } catch (error) {
    console.error('Erro ao desativar carro particular:', error);
    return NextResponse.json({ 
      error: 'Erro interno do servidor',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    }, { status: 500 });
  }
}