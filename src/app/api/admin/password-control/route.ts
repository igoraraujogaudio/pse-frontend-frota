import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: NextRequest) {
  try {
    const { action, userId } = await req.json();

    if (!action) {
      return NextResponse.json({ error: 'Ação não especificada.' }, { status: 400 });
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    switch (action) {
      case 'force_all':
        // Forçar mudança de senha em todos os usuários ativos
        const { error: forceAllError } = await supabaseAdmin
          .from('usuarios')
          .update({ 
            deve_mudar_senha: true,
            forcar_mudanca_senha: true
          })
          .eq('status', 'ativo');

        if (forceAllError) {
          return NextResponse.json({ error: 'Erro ao forçar mudança de senha: ' + forceAllError.message }, { status: 400 });
        }

        return NextResponse.json({ 
          success: true, 
          message: 'Todos os usuários ativos foram marcados para mudar senha no próximo login.' 
        });

      case 'cancel_all':
        // Cancelar força de mudança de senha para todos os usuários
        const { error: cancelAllError } = await supabaseAdmin
          .from('usuarios')
          .update({ 
            deve_mudar_senha: false,
            forcar_mudanca_senha: false
          })
          .eq('forcar_mudanca_senha', true);

        if (cancelAllError) {
          return NextResponse.json({ error: 'Erro ao cancelar força de mudança: ' + cancelAllError.message }, { status: 400 });
        }

        return NextResponse.json({ 
          success: true, 
          message: 'Força de mudança de senha cancelada para todos os usuários.' 
        });

      case 'force_user':
        // Forçar mudança de senha para um usuário específico
        if (!userId) {
          return NextResponse.json({ error: 'ID do usuário não fornecido.' }, { status: 400 });
        }

        const { error: forceUserError } = await supabaseAdmin
          .from('usuarios')
          .update({ 
            deve_mudar_senha: true,
            forcar_mudanca_senha: true
          })
          .eq('id', userId);

        if (forceUserError) {
          return NextResponse.json({ error: 'Erro ao forçar mudança de senha do usuário: ' + forceUserError.message }, { status: 400 });
        }

        return NextResponse.json({ 
          success: true, 
          message: 'Usuário marcado para mudar senha no próximo login.' 
        });

      case 'cancel_user':
        // Cancelar força de mudança de senha para um usuário específico
        if (!userId) {
          return NextResponse.json({ error: 'ID do usuário não fornecido.' }, { status: 400 });
        }

        const { error: cancelUserError } = await supabaseAdmin
          .from('usuarios')
          .update({ 
            deve_mudar_senha: false,
            forcar_mudanca_senha: false
          })
          .eq('id', userId);

        if (cancelUserError) {
          return NextResponse.json({ error: 'Erro ao cancelar força de mudança do usuário: ' + cancelUserError.message }, { status: 400 });
        }

        return NextResponse.json({ 
          success: true, 
          message: 'Força de mudança de senha cancelada para o usuário.' 
        });

      case 'get_stats':
        // Obter estatísticas de usuários que devem mudar senha
        const { data: statsData, error: statsError } = await supabaseAdmin
          .from('usuarios')
          .select('deve_mudar_senha, forcar_mudanca_senha, status')
          .eq('status', 'ativo');

        if (statsError) {
          return NextResponse.json({ error: 'Erro ao obter estatísticas: ' + statsError.message }, { status: 400 });
        }

        const stats = {
          total: statsData.length,
          mustChange: statsData.filter(u => u.deve_mudar_senha).length,
          forcedByAdmin: statsData.filter(u => u.forcar_mudanca_senha).length,
          firstLogin: statsData.filter(u => u.deve_mudar_senha && !u.forcar_mudanca_senha).length
        };

        return NextResponse.json({ 
          success: true, 
          stats 
        });

      default:
        return NextResponse.json({ error: 'Ação não reconhecida.' }, { status: 400 });
    }

  } catch (error: unknown) {
    console.error('Erro na API de controle de mudança de senha:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro interno do servidor';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
