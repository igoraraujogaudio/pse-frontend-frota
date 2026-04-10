import { NextRequest, NextResponse } from 'next/server';
import { createClientWithAuth } from '@/lib/supabase';
import { modularPermissionService } from '@/services/modularPermissionService';
import { calculateNextPreventiveMaintenance } from '@/utils/vehicleMaintenanceCalculator';

// GET: Buscar veículo por ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: vehicleId } = await params;
    
    // Get the authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Token de autorização não fornecido' }, { status: 401 });
    }
    
    const token = authHeader.replace('Bearer ', '');
    const supabase = createClientWithAuth(token);
    
    // Obter usuário logado
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    // Buscar dados do funcionário
    const { data: funcionario, error: funcionarioError } = await supabase
      .from('usuarios')
      .select('id, nivel_acesso')
      .eq('auth_usuario_id', user.id)
      .single();

    if (funcionarioError || !funcionario) {
      return NextResponse.json({ error: 'Funcionário não encontrado' }, { status: 404 });
    }

    // Buscar veículo
    const { data: vehicle, error: vehicleError } = await supabase
      .from('veiculos')
      .select(`
        *,
        contrato:contratos(id, nome, codigo),
        base:bases(id, nome, codigo),
        equipe:equipes(id, nome)
      `)
      .eq('id', vehicleId)
      .single();

    if (vehicleError) {
      console.error('Erro ao buscar veículo:', vehicleError);
      return NextResponse.json({ error: 'Veículo não encontrado' }, { status: 404 });
    }

    return NextResponse.json({ vehicle });
  } catch (error) {
    console.error('Erro interno:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

// PUT: Atualizar veículo
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: vehicleId } = await params;
    
    // Get the authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Token de autorização não fornecido' }, { status: 401 });
    }
    
    const token = authHeader.replace('Bearer ', '');
    const supabase = createClientWithAuth(token);
    
    // Obter usuário logado
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    // Buscar dados do funcionário
    const { data: funcionario, error: funcionarioError } = await supabase
      .from('usuarios')
      .select('id, nivel_acesso')
      .eq('auth_usuario_id', user.id)
      .single();

    if (funcionarioError || !funcionario) {
      return NextResponse.json({ error: 'Funcionário não encontrado' }, { status: 404 });
    }

    // Verificar se tem permissão para editar veículos
    const hasVehiclePermission = await modularPermissionService.checkUserPermissionModular(
      funcionario.id, 
      'veiculos.site.gestao_completa_frota'
    );

    if (!hasVehiclePermission) {
      return NextResponse.json({ error: 'Sem permissão para editar veículos' }, { status: 403 });
    }

    const updateData = await request.json();

    // Verificar se o veículo existe
    const { data: existingVehicle, error: checkError } = await supabase
      .from('veiculos')
      .select('id, quilometragem_atual, intervalo_preventiva, quilometragem_preventiva')
      .eq('id', vehicleId)
      .single();

    if (checkError || !existingVehicle) {
      return NextResponse.json({ error: 'Veículo não encontrado' }, { status: 404 });
    }

    // ⚠️ IMPORTANTE: SÓ recalcular se quilometragem_preventiva ou intervalo_preventiva mudaram
    // NÃO recalcular quando apenas quilometragem_atual muda (upload diário)
    if ((updateData.quilometragem_preventiva !== undefined && 
         updateData.quilometragem_preventiva !== existingVehicle.quilometragem_preventiva) ||
        (updateData.intervalo_preventiva !== undefined && 
         updateData.intervalo_preventiva !== existingVehicle.intervalo_preventiva)) {
      
      const novaQuilometragem = updateData.quilometragem_atual || existingVehicle.quilometragem_atual;
      const intervaloPreventiva = updateData.intervalo_preventiva || existingVehicle.intervalo_preventiva || 10000;
      const quilometragemPreventiva = updateData.quilometragem_preventiva !== undefined 
        ? updateData.quilometragem_preventiva 
        : existingVehicle.quilometragem_preventiva;

      // Usar a função utilitária para calcular a próxima manutenção preventiva
      const maintenanceCalculation = calculateNextPreventiveMaintenance({
        quilometragem_atual: novaQuilometragem,
        quilometragem_preventiva: quilometragemPreventiva,
        intervalo_preventiva: intervaloPreventiva
      });

      // Adicionar campos calculados aos dados de atualização
      updateData.proxima_preventiva_km = maintenanceCalculation.proxima_preventiva_km;
      updateData.alerta_preventiva_km = maintenanceCalculation.alerta_preventiva_km;

      console.log('🔧 Calculando próxima manutenção preventiva (gestor editou última preventiva):', {
        quilometragem_atual: novaQuilometragem,
        quilometragem_preventiva: quilometragemPreventiva,
        intervalo_preventiva: intervaloPreventiva,
        proxima_preventiva_km: maintenanceCalculation.proxima_preventiva_km,
        alerta_preventiva_km: maintenanceCalculation.alerta_preventiva_km,
        status_preventiva: maintenanceCalculation.status_preventiva
      });
    }

    // Adicionar timestamp de atualização
    updateData.atualizado_em = new Date().toISOString();

    // Atualizar veículo
    const { data: updatedVehicle, error: updateError } = await supabase
      .from('veiculos')
      .update(updateData)
      .eq('id', vehicleId)
      .select(`
        *,
        contrato:contratos(id, nome, codigo),
        base:bases(id, nome, codigo),
        equipe:equipes(id, nome)
      `)
      .single();

    if (updateError) {
      console.error('Erro ao atualizar veículo:', updateError);
      return NextResponse.json({ 
        error: 'Erro ao atualizar veículo',
        details: updateError.message
      }, { status: 500 });
    }

    return NextResponse.json({ 
      vehicle: updatedVehicle,
      message: 'Veículo atualizado com sucesso'
    });

  } catch (error) {
    console.error('Erro interno:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

// DELETE: Excluir veículo (soft delete)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: vehicleId } = await params;
    
    // Get the authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Token de autorização não fornecido' }, { status: 401 });
    }
    
    const token = authHeader.replace('Bearer ', '');
    const supabase = createClientWithAuth(token);
    
    // Obter usuário logado
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    // Buscar dados do funcionário
    const { data: funcionario, error: funcionarioError } = await supabase
      .from('usuarios')
      .select('id, nivel_acesso')
      .eq('auth_usuario_id', user.id)
      .single();

    if (funcionarioError || !funcionario) {
      return NextResponse.json({ error: 'Funcionário não encontrado' }, { status: 404 });
    }

    // Verificar se tem permissão para excluir veículos
    const hasVehiclePermission = await modularPermissionService.checkUserPermissionModular(
      funcionario.id, 
      'veiculos.site.gestao_completa_frota'
    );

    if (!hasVehiclePermission) {
      return NextResponse.json({ error: 'Sem permissão para excluir veículos' }, { status: 403 });
    }

    // Soft delete - marcar como inativo
    const { error: deleteError } = await supabase
      .from('veiculos')
      .update({
        status: 'inativo',
        atualizado_em: new Date().toISOString()
      })
      .eq('id', vehicleId);

    if (deleteError) {
      console.error('Erro ao excluir veículo:', deleteError);
      return NextResponse.json({ 
        error: 'Erro ao excluir veículo',
        details: deleteError.message
      }, { status: 500 });
    }

    return NextResponse.json({ 
      message: 'Veículo excluído com sucesso'
    });

  } catch (error) {
    console.error('Erro interno:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
