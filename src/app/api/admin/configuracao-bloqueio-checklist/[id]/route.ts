import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';

// PATCH: Atualizar configuração
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = createClient();
    
    // Obter usuário logado
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const updates: Record<string, unknown> = {
      atualizado_em: new Date().toISOString()
    };

    if (body.ativo !== undefined) updates.ativo = body.ativo;
    if (body.bloquear_sem_checklist !== undefined) updates.bloquear_sem_checklist = body.bloquear_sem_checklist;
    if (body.bloquear_checklist_rejeitado !== undefined) updates.bloquear_checklist_rejeitado = body.bloquear_checklist_rejeitado;
    if (body.dias_apos_apresentacao !== undefined) updates.dias_apos_apresentacao = body.dias_apos_apresentacao;

    // Atualizar configuração
    const { data: configuracao, error } = await supabase
      .from('configuracao_bloqueio_checklist')
      .update(updates)
      .eq('id', id)
      .select(`
        *,
        contrato:contratos(id, nome, codigo)
      `)
      .single();

    if (error) {
      console.error('Erro ao atualizar configuração:', error);
      return NextResponse.json(
        { error: 'Erro ao atualizar configuração' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      configuracao
    });

  } catch (error) {
    console.error('Erro interno:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}







