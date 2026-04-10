// =============================
// API: CARROS PARTICULARES
// =============================

import { NextRequest, NextResponse } from 'next/server';
import { createClientWithAuth } from '@/lib/supabase';
import { carrosParticularesService } from '@/services/carrosParticularesService';
import { modularPermissionService } from '@/services/modularPermissionService';

// GET: Listar carros do funcionário logado
export async function GET(request: NextRequest) {
  try {
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

    let query = supabase
      .from('carros_particulares')
      .select(`
        id,
        funcionario_id,
        placa,
        ativo,
        criado_em,
        atualizado_em,
        funcionario:usuarios!carros_particulares_funcionario_id_fkey(id, nome, matricula, email)
      `)
      .eq('ativo', true);

    // Se não tem permissão de gestão de frota, filtrar apenas carros do funcionário logado
    if (!hasFleetPermission) {
      query = query.eq('funcionario_id', funcionario.id);
    }

    const { data: carros, error } = await query
      .order('criado_em', { ascending: false });

    if (error) {
      console.error('Erro ao buscar carros particulares:', error);
      return NextResponse.json({ 
        error: 'Erro ao buscar carros particulares',
        details: error.message
      }, { status: 500 });
    }

    return NextResponse.json({ 
      carros: carros || [],
      total: carros?.length || 0
    });

  } catch (error) {
    console.error('Erro na API de carros particulares:', error);
    return NextResponse.json({ 
      error: 'Erro interno do servidor',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    }, { status: 500 });
  }
}

// POST: Cadastrar novo carro particular
export async function POST(request: NextRequest) {
  try {
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

    // Verificar se tem permissão para gestão completa de frota (carros particulares)
    const hasFleetPermission = await modularPermissionService.checkUserPermissionModular(
      funcionario.id, 
      'veiculos.site.gestao_completa_frota'
    );

    if (!hasFleetPermission) {
      return NextResponse.json({ error: 'Sem permissão para gerenciar carros particulares' }, { status: 403 });
    }

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

    // Verificar se já existe carro com esta placa
    const { data: carroExistente, error: checkError } = await supabase
      .from('carros_particulares')
      .select('id')
      .eq('placa', placa)
      .eq('ativo', true)
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      console.error('Erro ao verificar placa existente:', checkError);
      return NextResponse.json({ error: 'Erro ao verificar placa' }, { status: 500 });
    }

    if (carroExistente) {
      return NextResponse.json({ error: 'Já existe um carro cadastrado com esta placa' }, { status: 409 });
    }

    // Cadastrar novo carro
    const { data: novoCarro, error: insertError } = await supabase
      .from('carros_particulares')
      .insert({
        funcionario_id: funcionario_id,
        placa: placa
      })
      .select(`
        *,
        funcionario:usuarios!carros_particulares_funcionario_id_fkey(id, nome, matricula, email)
      `)
      .single();

    if (insertError) {
      console.error('Erro ao cadastrar carro:', insertError);
      return NextResponse.json({ 
        error: 'Erro ao cadastrar carro',
        details: insertError.message
      }, { status: 500 });
    }

    return NextResponse.json({ 
      carro: novoCarro,
      message: 'Carro cadastrado com sucesso'
    }, { status: 201 });

  } catch (error) {
    console.error('Erro na API de carros particulares:', error);
    return NextResponse.json({ 
      error: 'Erro interno do servidor',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    }, { status: 500 });
  }
}