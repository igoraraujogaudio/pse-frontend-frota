import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// interface Contract {
//   id: string;
//   nome: string;
//   codigo: string;
//   status: string;
//   total_veiculos?: number;
// } // TODO: Use this interface for type safety

// GET - Listar contratos disponíveis
export async function GET(request: NextRequest) {
  try {
    // Obter informações do usuário do header
    const userLevel = request.headers.get('x-user-level') || '';
    const userId = request.headers.get('x-user-id') || '';
    
    console.log('🔍 Filtro de contratos - User ID:', userId, 'Level:', userLevel);
    
    // Se for admin/gestor global, mostrar todos os contratos
    const isGlobalAdmin = ['admin', 'diretor', 'manager', 'gerente', 'fleet_manager', 'gestor_frota', 'gestor', 'administrador'].includes(userLevel.toLowerCase());
    
    let contractsQuery = supabase
      .from('contratos')
      .select('id, nome, codigo, status')
      .eq('status', 'ativo');
    
    // Se não for admin global, filtrar apenas contratos do usuário
    if (!isGlobalAdmin && userId) {
      console.log('🔒 Filtrando contratos por usuário:', userId);
      
      // Buscar contratos do usuário
      const { data: userContracts, error: userContractsError } = await supabase
        .from('usuario_contratos')
        .select('contrato_id')
        .eq('usuario_id', userId)
        .eq('ativo', true);
      
      if (userContractsError) {
        console.error('❌ Erro ao buscar contratos do usuário:', userContractsError);
        return NextResponse.json(
          { error: 'Erro ao buscar contratos do usuário' },
          { status: 500 }
        );
      }
      
      const userContractIds = userContracts?.map(uc => uc.contrato_id) || [];
      console.log('📋 Contratos do usuário:', userContractIds);
      
      if (userContractIds.length === 0) {
        console.log('⚠️ Usuário não tem acesso a nenhum contrato');
        return NextResponse.json({
          contracts: []
        });
      }
      
      // Filtrar contratos apenas pelos que o usuário tem acesso
      contractsQuery = contractsQuery.in('id', userContractIds);
    } else {
      console.log('🌐 Usuário admin - mostrando todos os contratos');
    }
    
    // Executar query final
    const { data: contracts, error } = await contractsQuery.order('nome');

    if (error) {
      console.error('Erro ao buscar contratos:', error);
      return NextResponse.json(
        { error: 'Erro ao buscar contratos' },
        { status: 500 }
      );
    }

    // Buscar contagem de veículos por contrato em uma única query
    // Usar o mesmo filtro do vehicleService para veículos ativos
    const { data: vehicleCounts, error: countError } = await supabase
      .from('veiculos')
      .select('contrato_id')
      .not('status', 'in', '(devolvido,desmobilizado,bloqueado)');

    if (countError) {
      console.error('Erro ao contar veículos:', countError);
      // Se der erro na contagem, retornar contratos sem contagem
      return NextResponse.json({
        contracts: contracts || []
      });
    }

    // Agrupar contagens por contrato
    const countMap = (vehicleCounts || []).reduce((acc, vehicle) => {
      if (vehicle.contrato_id) {
        acc[vehicle.contrato_id] = (acc[vehicle.contrato_id] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);

    console.log('🚗 Veículos encontrados:', vehicleCounts?.length || 0);
    console.log('📊 Mapa de contagens:', countMap);

    // Adicionar contagem aos contratos
    const contractsWithCount = (contracts || []).map(contract => ({
      ...contract,
      total_veiculos: countMap[contract.id] || 0
    }));

    return NextResponse.json({
      contracts: contractsWithCount
    });

  } catch (error) {
    console.error('Erro na API contracts GET:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
