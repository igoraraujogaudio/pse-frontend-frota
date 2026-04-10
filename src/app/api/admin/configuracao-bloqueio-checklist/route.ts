import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';

// GET: Listar todas as configurações
export async function GET() {
  try {
    const supabase = createClient();
    
    // Obter usuário logado
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    // Buscar configurações com dados do contrato
    const { data: configuracoes, error } = await supabase
      .from('configuracao_bloqueio_checklist')
      .select(`
        *,
        contrato:contratos(id, nome, codigo)
      `)
      .order('criado_em', { ascending: false });

    if (error) {
      console.error('Erro ao buscar configurações:', error);
      return NextResponse.json(
        { error: 'Erro ao buscar configurações' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      configuracoes: configuracoes || []
    });

  } catch (error) {
    console.error('Erro interno:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// POST: Criar nova configuração
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();
    
    // Obter usuário logado
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const { contrato_id, bloquear_sem_checklist, bloquear_checklist_rejeitado, dias_apos_apresentacao, ativo } = body;

    if (!contrato_id) {
      return NextResponse.json(
        { error: 'ID do contrato é obrigatório' },
        { status: 400 }
      );
    }

    // Verificar se já existe configuração para este contrato
    const { data: existing } = await supabase
      .from('configuracao_bloqueio_checklist')
      .select('id')
      .eq('contrato_id', contrato_id)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: 'Já existe configuração para este contrato' },
        { status: 400 }
      );
    }

    // Criar configuração
    const { data: configuracao, error } = await supabase
      .from('configuracao_bloqueio_checklist')
      .insert({
        contrato_id,
        bloquear_sem_checklist: bloquear_sem_checklist ?? true,
        bloquear_checklist_rejeitado: bloquear_checklist_rejeitado ?? true,
        dias_apos_apresentacao: dias_apos_apresentacao ?? 1,
        ativo: ativo ?? true
      })
      .select(`
        *,
        contrato:contratos(id, nome, codigo)
      `)
      .single();

    if (error) {
      console.error('Erro ao criar configuração:', error);
      return NextResponse.json(
        { error: 'Erro ao criar configuração' },
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



