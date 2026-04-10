import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

interface UpdateContratoRequest {
  matricula: string;
  contrato_id: string;
}

export async function POST(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ 
        error: 'Configuração do Supabase não encontrada' 
      }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const body = await request.json();
    const { updates }: { updates: UpdateContratoRequest[] } = body;

    if (!updates || !Array.isArray(updates)) {
      return NextResponse.json({
        error: 'Dados inválidos. Esperado array de atualizações com matrícula e contrato_id'
      }, { status: 400 });
    }

    const results = {
      success: [] as Array<{
        matricula: string;
        contrato_id: string;
        status: string;
      }>,
      errors: [] as Array<{
        matricula: string;
        contrato_id: string;
        error: string;
      }>,
      total: updates.length
    };

    for (const update of updates) {
      try {
        const { matricula, contrato_id } = update;

        // Verificar se o usuário existe
        const { data: usuario, error: userError } = await supabase
          .from('usuarios')
          .select('id, nome')
          .eq('matricula', matricula)
          .single();

        if (userError || !usuario) {
          results.errors.push({
            matricula,
            contrato_id,
            error: 'Usuário não encontrado'
          });
          continue;
        }

        // Verificar se o contrato existe
        const { data: contrato, error: contratoError } = await supabase
          .from('contratos')
          .select('id, nome')
          .eq('id', contrato_id)
          .single();

        if (contratoError || !contrato) {
          results.errors.push({
            matricula,
            contrato_id,
            error: 'Contrato não encontrado'
          });
          continue;
        }

        // Upsert associação em usuario_contratos como ativo
        const { error: upsertError } = await supabase
          .from('usuario_contratos')
          .upsert({
            usuario_id: usuario.id,
            contrato_id: contrato_id,
            ativo: true,
            data_inicio: new Date().toISOString().slice(0,10)
          }, {
            onConflict: 'usuario_id,contrato_id'
          });

        if (upsertError) {
          results.errors.push({
            matricula,
            contrato_id,
            error: `Erro ao associar contrato: ${upsertError.message}`
          });
          continue;
        }

        results.success.push({
          matricula,
          contrato_id,
          status: 'SUCESSO'
        });

      } catch (error) {
        results.errors.push({
          matricula: update.matricula,
          contrato_id: update.contrato_id,
          error: `Erro inesperado: ${error instanceof Error ? error.message : 'Erro desconhecido'}`
        });
      }
    }

    return NextResponse.json({
      message: 'Atualização de locais concluída',
      resultados: results
    });

  } catch (error) {
    console.error('Erro na atualização de locais:', error);
    return NextResponse.json(
      { error: `Erro interno: ${error instanceof Error ? error.message : 'Erro desconhecido'}` },
      { status: 500 }
    );
  }
}

