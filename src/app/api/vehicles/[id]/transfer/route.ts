import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createClientWithAuth } from '@/lib/supabase'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { newContratoId, currentContratoId } = await request.json()
    const resolvedParams = await params
    const vehicleId = resolvedParams.id

    if (!newContratoId) {
      return NextResponse.json(
        { error: 'Novo contrato é obrigatório' },
        { status: 400 }
      )
    }

    // Obter token de autorização
    const authHeader = request.headers.get('authorization');
    let usuarioId: string | null = null;

    if (authHeader) {
      try {
        const token = authHeader.replace('Bearer ', '');
        const supabase = createClientWithAuth(token);
        
        // Obter usuário logado
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (!authError && user) {
          // Buscar dados do funcionário
          const { data: funcionario } = await supabase
            .from('usuarios')
            .select('id')
            .eq('auth_usuario_id', user.id)
            .single();
          
          if (funcionario) {
            usuarioId = funcionario.id;
          }
        }
      } catch (error) {
        console.error('Error getting user from session:', error);
        // Continuar sem usuário, o trigger pode registrar automaticamente
      }
    }

    // Criar cliente Supabase com service role para operações administrativas
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Get current vehicle data to log the origin contract
    const { data: vehicle, error: vehicleError } = await supabaseAdmin
      .from('veiculos')
      .select('contrato_id')
      .eq('id', vehicleId)
      .single()

    if (vehicleError) {
      console.error('Error fetching vehicle:', vehicleError)
      return NextResponse.json(
        { error: 'Erro ao buscar dados do veículo' },
        { status: 500 }
      )
    }

    const contratoOrigemId = vehicle.contrato_id || currentContratoId

    // Verificar se realmente está mudando de contrato
    if (contratoOrigemId === newContratoId) {
      return NextResponse.json(
        { error: 'O veículo já está neste contrato' },
        { status: 400 }
      )
    }

    // Validar que temos os IDs necessários
    if (!contratoOrigemId) {
      console.error('contratoOrigemId não encontrado:', { vehicle, currentContratoId })
      return NextResponse.json(
        { error: 'Não foi possível determinar o contrato de origem' },
        { status: 400 }
      )
    }

    if (!newContratoId) {
      return NextResponse.json(
        { error: 'Contrato de destino não informado' },
        { status: 400 }
      )
    }

    // Update vehicle contract
    // O trigger registrará automaticamente a transferência
    const { error: updateError } = await supabaseAdmin
      .from('veiculos')
      .update({ 
        contrato_id: newContratoId,
        atualizado_em: new Date().toISOString()
      })
      .eq('id', vehicleId)

    if (updateError) {
      console.error('Error updating vehicle:', updateError)
      return NextResponse.json(
        { error: 'Erro ao atualizar veículo' },
        { status: 500 }
      )
    }

    // Registrar log manualmente
    // Se houver um trigger que também registra, pode causar duplicação,
    // mas vamos tentar registrar com o usuário correto
    try {
      const logData: {
        veiculo_id: string
        base_origem_id: string
        base_destino_id: string
        data_transferencia: string
        observacoes: string
        usuario_id?: string
      } = {
        veiculo_id: vehicleId,
        base_origem_id: contratoOrigemId,
        base_destino_id: newContratoId,
        data_transferencia: new Date().toISOString(),
        observacoes: 'Transferência realizada via web'
      }

      // Adicionar usuario_id apenas se disponível (pode ser NULL)
      if (usuarioId) {
        logData.usuario_id = usuarioId
      }

      console.log('Tentando registrar histórico de transferência:', {
        veiculo_id: vehicleId,
        base_origem_id: contratoOrigemId,
        base_destino_id: newContratoId,
        usuario_id: usuarioId || 'NULL'
      })

      const { error: logError, data: logDataResult } = await supabaseAdmin
        .from('logs_transferencia_veiculo')
        .insert(logData)
        .select()

      if (logError) {
        // Se der erro de constraint única ou duplicação, pode ser que o trigger já registrou
        // Verificar se é erro de duplicação ou constraint
        const isDuplicateError = logError.message?.includes('duplicate') || 
                                 logError.message?.includes('unique') ||
                                 logError.code === '23505'
        
        if (isDuplicateError) {
          console.log('Histórico já registrado (provavelmente pelo trigger)')
        } else {
          console.error('Erro ao registrar histórico de transferência:', {
            error: logError,
            code: logError.code,
            message: logError.message,
            details: logError.details,
            hint: logError.hint,
            logData
          })
          // Retornar erro mais detalhado para ajudar no debug
          return NextResponse.json(
            { 
              error: 'Erro ao registrar histórico de transferência',
              details: logError.message,
              code: logError.code
            },
            { status: 500 }
          )
        }
      } else {
        console.log('✅ Histórico de transferência registrado com sucesso:', logDataResult)
      }
    } catch (logError: unknown) {
      const error = logError as Error
      console.error('Exceção ao registrar histórico:', logError)
      return NextResponse.json(
        { 
          error: 'Erro ao registrar histórico de transferência',
          details: error.message || String(logError)
        },
        { status: 500 }
      )
    }

    return NextResponse.json({ 
      success: true,
      message: 'Veículo transferido com sucesso'
    })
  } catch (error) {
    console.error('Error in transfer route:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}