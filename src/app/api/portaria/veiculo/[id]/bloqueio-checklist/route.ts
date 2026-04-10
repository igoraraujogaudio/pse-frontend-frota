import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';

// GET: Verificar se veículo está bloqueado por checklist
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: veiculoId } = await params;
    const supabase = createClient();
    
    // Obter usuário logado
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    // Chamar função do banco para verificar bloqueio
    const { data: bloqueio, error } = await supabase
      .rpc('verificar_bloqueio_veiculo_checklist', {
        p_veiculo_id: veiculoId
      });

    if (error) {
      console.error('Erro ao verificar bloqueio:', error);
      return NextResponse.json(
        { error: 'Erro ao verificar bloqueio do veículo' },
        { status: 500 }
      );
    }

    const resultado = bloqueio?.[0] || { bloqueado: false, motivo: null, tipo_bloqueio: null };

    return NextResponse.json({
      bloqueado: resultado.bloqueado || false,
      motivo: resultado.motivo || null,
      tipo_bloqueio: resultado.tipo_bloqueio || null
    });

  } catch (error) {
    console.error('Erro interno:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}







