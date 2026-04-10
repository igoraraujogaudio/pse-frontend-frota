import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  try {
    console.log('🔍 Iniciando diagnóstico de veículos...');
    
    // Buscar todos os veículos (sem filtro de status)
    const { data: allVehicles, error: allError } = await supabase
      .from('veiculos')
      .select('id, placa, status')
      .limit(10);

    if (allError) {
      console.error('❌ Erro ao buscar todos os veículos:', allError);
      return NextResponse.json({ error: 'Erro ao buscar veículos', details: allError }, { status: 500 });
    }

    console.log(`📊 Total de veículos encontrados: ${allVehicles?.length || 0}`);
    
    // Contar por status
    const statusCount = allVehicles?.reduce((acc: Record<string, number>, v: { status: string }) => {
      acc[v.status] = (acc[v.status] || 0) + 1;
      return acc;
    }, {}) || {};

    // Buscar apenas ativos
    const { data: activeVehicles, error: activeError } = await supabase
      .from('veiculos')
      .select('id, placa, modelo, status')
      .eq('status', 'ativo')
      .limit(5);

    if (activeError) {
      console.error('❌ Erro ao buscar veículos ativos:', activeError);
      return NextResponse.json({ error: 'Erro ao buscar veículos ativos', details: activeError }, { status: 500 });
    }

    console.log(`✅ Veículos ativos encontrados: ${activeVehicles?.length || 0}`);

    // Testar função de regras no primeiro veículo ativo
    let rulesTest = null;
    if (activeVehicles && activeVehicles.length > 0) {
      const firstVehicle = activeVehicles[0];
      console.log(`🧪 Testando regras para veículo: ${firstVehicle.placa} (ID: ${firstVehicle.id})`);
      
      const { data: rules, error: rulesError } = await supabase
        .rpc('obter_documentos_obrigatorios_veiculo', { p_veiculo_id: firstVehicle.id });

      if (rulesError) {
        console.error('❌ Erro na função de regras:', rulesError);
        rulesTest = { error: rulesError };
      } else {
        console.log('✅ Função de regras funcionou:', rules);
        rulesTest = { success: true, rules };
      }
    }

    const result = {
      totalVeiculos: allVehicles?.length || 0,
      statusCount,
      veiculosAtivos: activeVehicles?.length || 0,
      primeiros5Ativos: activeVehicles?.map(v => ({ id: v.id, placa: v.placa, modelo: v.modelo })) || [],
      testeRegras: rulesTest,
      timestamp: new Date().toISOString()
    };

    console.log('📋 Resultado do diagnóstico:', result);
    
    return NextResponse.json(result);

  } catch (err) {
    console.error('❌ Erro inesperado no diagnóstico:', err);
    return NextResponse.json({ error: 'Erro interno', details: err }, { status: 500 });
  }
}
