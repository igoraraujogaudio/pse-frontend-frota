import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { modularPermissionService } from '@/services/modularPermissionService';

// Create admin client with service role key for user creation
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('funcionarios_ativos')
      .select(`
        id,
        nome,
        email,
        matricula,
        cpf,
        telefone,
        cargo,
        posicao,
        operacao,
        contrato_id,
        departamento,
        status,
        nivel_acesso,
        criado_em,
        atualizado_em,
        base_id,
        base_nome,
        contrato_nome,
        cnh,
        validade_cnh,
        cnh_categoria,
        data_ultimo_exame_aso,
        data_agendamento_aso,
        har_vencimento
      `)
      .order('nome');

    if (error) {
      console.error('Erro ao buscar usuários:', error);
      return NextResponse.json({ error: 'Erro ao buscar usuários' }, { status: 500 });
    }

    // Os dados já vêm formatados da view
    const usuarios = data?.map(usuario => ({
      ...usuario,
      contrato_nome: usuario.contrato_nome,
      base_nome: usuario.base_nome,
      base_id: usuario.base_id
    })) || [];

    return NextResponse.json({ usuarios });
  } catch (error) {
    console.error('Erro interno:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // Criar usuário no Supabase Auth primeiro
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: body.email,
      password: body.senha,
      email_confirm: true
    });

    if (authError) {
      console.error('Erro ao criar usuário no Auth:', authError);
      return NextResponse.json({ error: `Erro ao criar usuário no Auth: ${authError.message}` }, { status: 500 });
    }

    // ✅ CORREÇÃO: Buscar nivel_acesso baseado no perfil_acesso_id
    let nivelAcesso = 'operacao'; // padrão
    if (body.perfil_acesso_id) {
      const { data: perfilData } = await supabaseAdmin
        .from('perfis_acesso')
        .select('codigo')
        .eq('id', body.perfil_acesso_id)
        .single();
      nivelAcesso = perfilData?.codigo || 'operacao';
    }

    // Criar registro na tabela usuarios
    const { data, error } = await supabaseAdmin
      .from('usuarios')
      .insert({
        auth_usuario_id: authData.user.id,
        nome: body.nome,
        email: body.email,
        matricula: body.matricula,
        cpf: body.cpf,
        telefone: body.telefone,
        cargo: body.cargo,
        posicao: body.posicao,
        operacao: body.operacao,
        contrato_id: body.contrato_id || null,
        contrato_origem_id: body.contrato_id || null, // Define o contrato definido como contrato origem
        departamento: body.departamento,
        status: 'ativo',
        nivel_acesso: nivelAcesso // ✅ CORREÇÃO: Usar nivel_acesso derivado do perfil_id
      })
      .select()
      .single();

    if (error) {
      console.error('Erro ao criar usuário:', error);
      return NextResponse.json({ error: `Erro ao criar usuário: ${error.message}` }, { status: 500 });
    }

    // Se foi especificada uma base, criar o relacionamento
    if (body.base_id && data) {
      await supabaseAdmin
        .from('usuario_bases')
        .insert({
          usuario_id: data.id,
          base_id: body.base_id,
          tipo_acesso: 'total',
          ativo: true
        });
    }

    // Criar relacionamento com contrato (OBRIGATÓRIO)
    if (body.contrato_id && data) {
      const { error: contratoError } = await supabaseAdmin
        .from('usuario_contratos')
        .insert({
          usuario_id: data.id,
          contrato_id: body.contrato_id,
          tipo_acesso: 'origem', // Define como contrato de origem
          perfil_contrato: 'operador', // Perfil padrão
          ativo: true
        });

      if (contratoError) {
        console.error('Erro ao associar contrato:', contratoError);
        // Não falha a criação do usuário, apenas log do erro
      }
    }

    // ✅ CORREÇÃO: Aplicar permissões baseadas no perfil_acesso_id
    if (data && body.perfil_acesso_id) {
      try {
        console.log(`🔄 Aplicando permissões para perfil ID: ${body.perfil_acesso_id}`);
        
        // Aplicar permissões padrão do perfil
        await modularPermissionService.applyProfileDefaultPermissions(
          data.id,
          body.perfil_acesso_id,
          'sistema', // Sistema aplicou automaticamente
          'api_funcionario' // Método de aplicação
        );
        console.log(`✅ Permissões padrão aplicadas com sucesso para usuário ${data.id} com perfil ${body.perfil_acesso_id}`);
      } catch (permissionError) {
        console.error('❌ Erro ao aplicar permissões padrão:', permissionError);
        // Não falha a criação do usuário, apenas log do erro
      }
    }

    return NextResponse.json({ usuario: data }, { status: 201 });
  } catch (error) {
    console.error('Erro interno:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}