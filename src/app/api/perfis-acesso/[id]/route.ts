import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    
    const { data, error } = await supabase
      .from('perfis_acesso')
      .update({
        codigo: body.codigo,
        nome: body.nome,
        descricao: body.descricao,
        nivel_hierarquia: body.nivel_hierarquia,
        cor: body.cor
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Erro ao atualizar perfil de acesso:', error);
      return NextResponse.json({ 
        error: 'Erro ao atualizar perfil de acesso',
        details: error.message
      }, { status: 500 });
    }

    return NextResponse.json({ perfil: data });
  } catch (error) {
    console.error('Erro interno:', error);
    return NextResponse.json({ 
      error: 'Erro interno do servidor',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    // Verificar se há cargos usando este perfil
    const { data: cargos, error: cargosError } = await supabase
      .from('cargos')
      .select('id, nome')
      .eq('perfil_acesso_id', id)
      .eq('ativo', true);

    if (cargosError) {
      console.error('Erro ao verificar cargos:', cargosError);
      return NextResponse.json({ 
        error: 'Erro ao verificar cargos vinculados',
        details: cargosError.message
      }, { status: 500 });
    }

    if (cargos && cargos.length > 0) {
      return NextResponse.json({ 
        error: 'Não é possível desativar este perfil pois há cargos vinculados a ele',
        cargos: cargos.map(c => c.nome)
      }, { status: 400 });
    }

    // Desativar o perfil
    const { data, error } = await supabase
      .from('perfis_acesso')
      .update({ ativo: false })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Erro ao desativar perfil de acesso:', error);
      return NextResponse.json({ 
        error: 'Erro ao desativar perfil de acesso',
        details: error.message
      }, { status: 500 });
    }

    return NextResponse.json({ perfil: data });
  } catch (error) {
    console.error('Erro interno:', error);
    return NextResponse.json({ 
      error: 'Erro interno do servidor',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    }, { status: 500 });
  }
}
