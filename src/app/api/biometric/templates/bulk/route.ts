import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { user_ids }: { user_ids: string[] } = body;

    if (!user_ids || !Array.isArray(user_ids) || user_ids.length === 0) {
      return NextResponse.json({ error: 'user_ids é obrigatório' }, { status: 400 });
    }

    // Dividir em batches de 50 para evitar URL too long no PostgREST
    const BATCH_SIZE = 50;
    const allTemplates: { user_id: string; created_at: string }[] = [];

    for (let i = 0; i < user_ids.length; i += BATCH_SIZE) {
      const batch = user_ids.slice(i, i + BATCH_SIZE);
      const { data: templates, error } = await supabase
        .from('biometric_templates')
        .select('user_id, created_at')
        .in('user_id', batch)
        .eq('ativo', true)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Erro no batch de biometrias:', error);
        continue;
      }

      if (templates) {
        allTemplates.push(...templates);
      }
    }

    // Agrupar por user_id pegando apenas o mais recente (já vem ordenado desc)
    const porUsuario: Record<string, string> = {};
    for (const t of allTemplates) {
      if (!porUsuario[t.user_id]) {
        porUsuario[t.user_id] = t.created_at;
      }
    }

    return NextResponse.json({ success: true, data: porUsuario });
  } catch (error) {
    console.error('Erro ao buscar templates bulk:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
