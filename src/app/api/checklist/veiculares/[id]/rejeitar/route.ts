import { NextRequest, NextResponse } from 'next/server';
import { createClientWithAuth } from '@/lib/supabase';

// POST: Rejeitar checklist veicular
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: checklistId } = await params;
    
    // Obter token de autorização
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
      .select('id, nome, nivel_acesso')
      .eq('auth_usuario_id', user.id)
      .single();

    if (funcionarioError || !funcionario) {
      return NextResponse.json({ error: 'Funcionário não encontrado' }, { status: 404 });
    }

    // Obter dados do body (motivo da rejeição)
    const body = await request.json();
    const { motivo } = body;

    if (!motivo || motivo.trim() === '') {
      return NextResponse.json(
        { error: 'Motivo da rejeição é obrigatório' },
        { status: 400 }
      );
    }

    // Buscar checklist para verificar se existe e se o usuário tem acesso
    const { data: checklist, error: checklistError } = await supabase
      .from('checklist_veicular')
      .select(`
        id,
        status,
        veiculo:veiculos(contrato_id),
        equipe:equipes(contrato_id)
      `)
      .eq('id', checklistId)
      .single();

    if (checklistError || !checklist) {
      return NextResponse.json(
        { error: 'Checklist não encontrado' },
        { status: 404 }
      );
    }

    // Verificar se o checklist já foi processado
    if (checklist.status === 'rejeitado' || checklist.status === 'aprovado') {
      return NextResponse.json(
        { error: 'Checklist já foi processado' },
        { status: 400 }
      );
    }

    // Verificar acesso ao contrato (se não for admin)
    const isGlobalAdmin = funcionario.nivel_acesso === 'admin' || funcionario.nivel_acesso === 'diretor';
    
    if (!isGlobalAdmin) {
      const { data: userContracts } = await supabase
        .from('usuario_contratos')
        .select('contrato_id')
        .eq('usuario_id', funcionario.id)
        .eq('ativo', true);

      const userContractIds = userContracts?.map(uc => uc.contrato_id) || [];
      const veiculoContratoId = (checklist.veiculo as { contrato_id?: string })?.contrato_id;
      const equipeContratoId = (checklist.equipe as { contrato_id?: string })?.contrato_id;

      const hasAccess = userContractIds.includes(veiculoContratoId) || 
                       userContractIds.includes(equipeContratoId);

      if (!hasAccess) {
        return NextResponse.json(
          { error: 'Você não tem acesso a este checklist' },
          { status: 403 }
        );
      }
    }

    // Atualizar checklist como rejeitado
    const { error: updateError } = await supabase
      .from('checklist_veicular')
      .update({
        status: 'rejeitado',
        supervisor_nome: funcionario.nome,
        justificativa_liberacao: motivo, // Reutilizando campo para motivo da rejeição
        data_liberacao: new Date().toISOString(),
        atualizado_em: new Date().toISOString()
      })
      .eq('id', checklistId);

    if (updateError) {
      console.error('Erro ao rejeitar checklist:', updateError);
      return NextResponse.json(
        { error: 'Erro ao rejeitar checklist' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Checklist rejeitado com sucesso'
    });

  } catch (error) {
    console.error('Erro interno:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}



