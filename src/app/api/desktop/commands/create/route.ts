import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';

/**
 * POST /api/desktop/commands/create
 * Cria um comando para o desktop via Supabase Realtime
 * Usa service_role para bypassar RLS
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { solicitacaoId, commandType, destinatarioId, isNewRegistration, desktopId } = body;

    if (!solicitacaoId || !commandType) {
      return NextResponse.json(
        { error: 'solicitacaoId e commandType são obrigatórios' },
        { status: 400 }
      );
    }

    // Usar service_role para bypassar RLS
    const supabaseAdmin = createClient();

    const { data, error } = await supabaseAdmin
      .from('desktop_commands')
      .insert({
        solicitacao_id: solicitacaoId,
        command_type: commandType,
        destinatario_id: destinatarioId,
        is_new_registration: isNewRegistration,
        desktop_id: desktopId,
        status: 'pending',
      })
      .select()
      .single();

    if (error) {
      console.error('❌ Erro ao criar comando desktop:', error);
      return NextResponse.json(
        { error: `Erro ao criar comando: ${error.message}` },
        { status: 500 }
      );
    }

    console.log('✅ Comando desktop criado:', data.id);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('❌ Erro ao criar comando:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}




