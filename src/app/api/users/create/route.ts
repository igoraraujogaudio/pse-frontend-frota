import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { modularPermissionService } from '@/services/modularPermissionService';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const {
    name,
    department,
    role,
    position,
    employee_id,
    cpf,
    operacao = 'geral', // Valor padrão para operação
    email: emailFromBody,
    phone,
    password,
    access_level,
    contratos = [], // Mudança: contratos em vez de locations
    bases = [], // Mudança: bases específicas (opcional)
    cnh,
    validade_cnh,
    cnh_categoria,
  } = body;

  // Usa o email do body se vier, senão gera pelo padrão
  const email = emailFromBody || `${employee_id}@pse.srv.br`;

  // Cria client admin
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // 1. Cria usuário no Auth
  const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (authError || !authUser?.user) {
    return NextResponse.json({ error: authError?.message || 'Erro ao criar usuário no Auth' }, { status: 400 });
  }

  // Determina o contrato origem (primeiro contrato do array, se houver)
  const contratoOrigemId = contratos.length > 0 ? contratos[0].contrato_id : null;

  // 2. Cria usuário na tabela usuarios
  const { data: userData, error: userError } = await supabaseAdmin
    .from('usuarios')
    .insert({
      nome: name,
      email,
      departamento: department,
      cargo: role,
      posicao: position,
      matricula: employee_id,
      cpf: cpf || null,
      telefone: phone,
      cnh: cnh || null,
      validade_cnh: validade_cnh || null,
      cnh_categoria: cnh_categoria || null,
      nivel_acesso: access_level,
      operacao: operacao || 'geral', // Campo obrigatório
      status: 'ativo',
      auth_usuario_id: authUser.user.id,
      contrato_origem_id: contratoOrigemId, // Define o primeiro contrato como contrato origem
      // Campos para controle de mudança de senha obrigatória
      deve_mudar_senha: true, // Novo usuário deve mudar senha no primeiro login
      senha_alterada: false, // Ainda não alterou a senha
      forcar_mudanca_senha: false, // Não foi forçado pelo admin
    })
    .select()
    .single();
  if (userError) {
    // rollback: deleta usuário do Auth
    await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
    return NextResponse.json({ error: userError.message }, { status: 400 });
  }

  // 3. Relaciona contratos
  if (contratos.length > 0) {
    const userId = userData.id;
    const userContratos = contratos.map((contrato: { contrato_id: string; perfil_contrato?: string }, index: number) => ({
      usuario_id: userId,
      contrato_id: contrato.contrato_id,
      tipo_acesso: index === 0 ? 'origem' : 'visualizacao', // Primeiro contrato é origem, demais são visualização
      perfil_contrato: contrato.perfil_contrato || 'operador',
      ativo: true
    }));
    const { error: contratosError } = await supabaseAdmin.from('usuario_contratos').insert(userContratos);
    if (contratosError) {
      console.error('Erro ao associar contratos:', contratosError);
      // Não falha a criação do usuário, apenas log do erro
    }
  }

  // 4. Relaciona bases específicas (opcional)
  if (bases.length > 0) {
    const userId = userData.id;
    const userBases = bases.map((base: { base_id: string; tipo_acesso?: string }) => ({
      usuario_id: userId,
      base_id: base.base_id,
      tipo_acesso: base.tipo_acesso || 'total',
      ativo: true
    }));
    const { error: basesError } = await supabaseAdmin.from('usuario_bases').insert(userBases);
    if (basesError) {
      console.error('Erro ao associar bases:', basesError);
      // Não falha a criação do usuário, apenas log do erro
    }
  }

  // ✅ NOVO: 5. Aplicar permissões padrão do perfil automaticamente
  if (userData && access_level) {
    try {
      console.log(`🔄 Aplicando permissões padrão para usuário ${userData.id} com nível de acesso: ${access_level}`);
      
      // Buscar perfil correspondente ao nível de acesso
      const { data: perfil, error: perfilError } = await supabaseAdmin
        .from('perfis_acesso')
        .select('id')
        .eq('codigo', access_level)
        .eq('ativo', true)
        .single();

      if (perfilError) {
        console.warn(`⚠️ Erro ao buscar perfil para nível ${access_level}:`, perfilError);
      } else if (perfil) {
        // Aplicar permissões padrão do perfil
        await modularPermissionService.applyProfileDefaultPermissions(
          userData.id,
          perfil.id,
          'sistema', // Sistema aplicou automaticamente
          'api_individual' // Método de aplicação
        );
        console.log(`✅ Permissões padrão aplicadas com sucesso para usuário ${userData.id}`);
      } else {
        console.warn(`⚠️ Nenhum perfil encontrado para nível de acesso: ${access_level}`);
      }
    } catch (permissionError) {
      console.error('❌ Erro ao aplicar permissões padrão:', permissionError);
      // Não falha a criação do usuário, apenas log do erro
    }
  }

  return NextResponse.json({ ...userData, email });
} 