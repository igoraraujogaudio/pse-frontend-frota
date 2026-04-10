import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: funcionarioId } = await params;

    if (!funcionarioId) {
      return NextResponse.json(
        { error: 'ID do funcionário é obrigatório' },
        { status: 400 }
      );
    }

    // Buscar checklist de demissão do funcionário (usando checklists diários como exemplo)
    const { data: checklist, error } = await supabaseAdmin
      .from('checklists_diarios')
      .select(`
        id,
        tipo_checklist,
        progresso_geral,
        completo,
        observacoes_gerais,
        data,
        criado_em
      `)
      .eq('usuario_id', funcionarioId)
      .order('criado_em', { ascending: true })
      .limit(20);

    if (error) {
      console.error('Erro ao buscar checklist:', error);
      return NextResponse.json(
        { error: 'Erro ao buscar checklist' },
        { status: 500 }
      );
    }

    // Formatar checklist
    const checklistFormatado = (checklist || []).map(item => ({
      id: item.id,
      item: `Checklist ${item.tipo_checklist} - ${new Date(item.data).toLocaleDateString('pt-BR')}`,
      status: item.completo ? 'concluido' : 'pendente',
      data_conclusao: item.completo ? item.criado_em : null,
      responsavel: 'Sistema',
      observacoes: item.observacoes_gerais
    }));

    return NextResponse.json({
      success: true,
      checklist: checklistFormatado
    });

  } catch (error) {
    console.error('Erro na API de checklist:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
