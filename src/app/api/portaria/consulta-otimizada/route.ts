import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    const userId = searchParams.get('userId');
    if (!userId) {
      return NextResponse.json({ error: 'ID do usuário não fornecido' }, { status: 401 });
    }
    
    const supabase = createClient();

    const { data: userData, error: userError } = await supabase
      .from('usuarios')
      .select('id, nivel_acesso')
      .eq('auth_usuario_id', userId)
      .single();

    if (userError || !userData) {
      return NextResponse.json({ error: 'Dados do usuário não encontrados' }, { status: 404 });
    }

    const { data: userContracts } = await supabase
      .from('usuario_contratos')
      .select('contrato_id')
      .eq('usuario_id', userData.id)
      .eq('ativo', true);

    const userContractIds = userContracts?.map(uc => uc.contrato_id) || [];
    
    console.log('🔍 User Contracts:', userContractIds.length);
    
    const { data: basesData } = await supabase
      .from('bases')
      .select('id')
      .in('contrato_id', userContractIds.length > 0 ? userContractIds : ['00000000-0000-0000-0000-000000000000'])
      .eq('ativa', true);

    const userBaseIds = basesData?.map(b => b.id) || [];
    
    console.log('🔍 User Bases:', userBaseIds.length);
    
    const search = searchParams.get('search') || '';
    const tipo = searchParams.get('tipo') || 'veiculos';
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '50');
    const dataInicio = searchParams.get('dataInicio');
    const dataFim = searchParams.get('dataFim');
    const baseId = searchParams.get('baseId');
    const contratoId = searchParams.get('contratoId');

    let inicio: Date | null = null;
    let fim: Date | null = null;

    if (dataInicio && dataFim) {
      inicio = new Date(dataInicio);
      inicio.setHours(0, 0, 0, 0);
      fim = new Date(dataFim);
      fim.setHours(23, 59, 59, 999);
    }

    if (tipo === 'veiculos') {
      console.log('🚗 Buscando veículos...');
      console.log('📅 Período:', { inicio, fim });
      console.log('🏢 Contratos:', userContractIds);
      console.log('🏭 Bases:', userBaseIds);
      
      let countQuery = supabase
        .from('movimentacoes_veiculos')
        .select('id, tipo', { count: 'exact', head: false });
      
      if (inicio && fim) {
        countQuery = countQuery.gte('data_movimentacao', inicio.toISOString())
                               .lte('data_movimentacao', fim.toISOString());
      }
      
      if (contratoId && contratoId !== 'todos') {
        countQuery = countQuery.eq('contrato_id', contratoId);
      } else if (userContractIds.length > 0) {
        countQuery = countQuery.in('contrato_id', userContractIds);
      }
      
      if (baseId && baseId !== 'todas') {
        countQuery = countQuery.eq('base_id', baseId);
      } else if (userBaseIds.length > 0) {
        countQuery = countQuery.in('base_id', userBaseIds);
      }

      const { data: statsData, count: totalCount, error: countError } = await countQuery;
      
      if (countError) {
        console.error('❌ Erro ao contar veículos:', countError);
      }
      console.log('📊 Total de registros:', totalCount);
      
      const stats = {
        total: totalCount || 0,
        entradas: statsData?.filter(m => m.tipo === 'entrada').length || 0,
        saidas: statsData?.filter(m => m.tipo === 'saida').length || 0,
        retiradas: 0,
        devolucoes: 0
      };

      let dataQuery = supabase
        .from('movimentacoes_veiculos')
        .select(`
          id,
          tipo,
          data_movimentacao,
          quilometragem,
          observacoes,
          tipo_veiculo,
          veiculo:veiculos!movimentacoes_veiculos_veiculo_id_fkey (
            placa,
            modelo,
            marca_equipamento
          ),
          carro_particular:carros_particulares!movimentacoes_veiculos_carro_particular_id_fkey (
            placa,
            funcionario:usuarios!carros_particulares_funcionario_id_fkey (
              nome,
              matricula
            )
          ),
          colaborador:usuarios!movimentacoes_veiculos_colaborador_id_fkey (
            nome,
            matricula
          ),
          base:bases!movimentacoes_veiculos_base_id_fkey (
            nome,
            codigo
          )
        `);
      
      if (inicio && fim) {
        dataQuery = dataQuery.gte('data_movimentacao', inicio.toISOString())
                             .lte('data_movimentacao', fim.toISOString());
      }
      
      if (contratoId && contratoId !== 'todos') {
        dataQuery = dataQuery.eq('contrato_id', contratoId);
      } else if (userContractIds.length > 0) {
        dataQuery = dataQuery.in('contrato_id', userContractIds);
      }
      
      if (baseId && baseId !== 'todas') {
        dataQuery = dataQuery.eq('base_id', baseId);
      } else if (userBaseIds.length > 0) {
        dataQuery = dataQuery.in('base_id', userBaseIds);
      }
      
      dataQuery = dataQuery.order('data_movimentacao', { ascending: false });

      const { data: allData, error } = await dataQuery;
      
      if (error) {
        console.error('❌ Erro ao buscar veículos:', error);
        return NextResponse.json({ error: 'Erro ao buscar dados', details: error.message }, { status: 500 });
      }
      
      console.log('✅ Dados retornados do banco:', allData?.length || 0, 'registros');

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const normalizedData = (allData || []).map((mov: any) => ({
        ...mov,
        veiculo: Array.isArray(mov.veiculo) ? mov.veiculo[0] : mov.veiculo,
        carro_particular: Array.isArray(mov.carro_particular) ? mov.carro_particular[0] : mov.carro_particular,
        colaborador: Array.isArray(mov.colaborador) ? mov.colaborador[0] : mov.colaborador,
        base: Array.isArray(mov.base) ? mov.base[0] : mov.base
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      })).map((mov: any) => ({
        ...mov,
        carro_particular: mov.carro_particular ? {
          ...mov.carro_particular,
          funcionario: Array.isArray(mov.carro_particular.funcionario) ? mov.carro_particular.funcionario[0] : mov.carro_particular.funcionario
        } : mov.carro_particular
      }));

      let filteredData = normalizedData;
      if (search) {
        const searchLower = search.toLowerCase();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        filteredData = normalizedData.filter((mov: any) => {
          return (
            mov.veiculo?.placa?.toLowerCase().includes(searchLower) ||
            mov.carro_particular?.placa?.toLowerCase().includes(searchLower) ||
            mov.colaborador?.nome?.toLowerCase().includes(searchLower) ||
            mov.colaborador?.matricula?.toLowerCase().includes(searchLower) ||
            mov.carro_particular?.funcionario?.nome?.toLowerCase().includes(searchLower) ||
            mov.carro_particular?.funcionario?.matricula?.toLowerCase().includes(searchLower) ||
            mov.base?.nome?.toLowerCase().includes(searchLower)
          );
        });
      }

      const totalFiltered = filteredData.length;
      const offset = (page - 1) * pageSize;
      const paginatedData = filteredData.slice(offset, offset + pageSize);

      console.log('🔍 Após filtro de busca:', totalFiltered, 'registros');
      console.log('📄 Página', page, ':', paginatedData.length, 'registros');

      return NextResponse.json({
        success: true,
        data: paginatedData,
        stats,
        pagination: {
          page,
          pageSize,
          total: search ? totalFiltered : (totalCount || 0),
          hasMore: totalFiltered > offset + pageSize
        }
      });
    } else if (tipo === 'chaves') {
      let countQuery = supabase
        .from('movimentacoes_chaves')
        .select('id, tipo', { count: 'exact', head: false })
        .order('data_movimentacao', { ascending: false });
      
      if (inicio && fim) {
        countQuery = countQuery.gte('data_movimentacao', inicio.toISOString())
                               .lte('data_movimentacao', fim.toISOString());
      }

      const { data: allChaves } = await countQuery;
      
      const filteredByAccess = allChaves || [];

      const stats = {
        total: filteredByAccess.length,
        entradas: 0,
        saidas: 0,
        retiradas: filteredByAccess.filter(m => m.tipo === 'retirada').length,
        devolucoes: filteredByAccess.filter(m => m.tipo === 'devolucao').length
      };

      let dataQuery = supabase
        .from('movimentacoes_chaves')
        .select(`
          id,
          tipo,
          data_movimentacao,
          observacoes,
          status,
          colaborador:usuarios!movimentacoes_chaves_colaborador_id_fkey (
            nome,
            matricula
          ),
          chave:chaves_veiculos!movimentacoes_chaves_chave_id_fkey (
            codigo,
            veiculo:veiculos!chaves_veiculos_veiculo_id_fkey (
              placa,
              modelo,
              marca_equipamento,
              base:bases!veiculos_base_id_fkey (
                nome,
                codigo
              )
            )
          )
        `);
      
      if (inicio && fim) {
        dataQuery = dataQuery.gte('data_movimentacao', inicio.toISOString())
                             .lte('data_movimentacao', fim.toISOString());
      }
      
      dataQuery = dataQuery.order('data_movimentacao', { ascending: false });

      const { data: allDataChaves, error } = await dataQuery;
      
      if (error) {
        console.error('Erro ao buscar chaves:', error);
        return NextResponse.json({ error: 'Erro ao buscar dados' }, { status: 500 });
      }

      console.log('✅ Dados de chaves retornados do banco:', allDataChaves?.length || 0, 'registros');

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const normalizedData = (allDataChaves || []).map((mov: any) => ({
        ...mov,
        chave: Array.isArray(mov.chave) ? mov.chave[0] : mov.chave,
        colaborador: Array.isArray(mov.colaborador) ? mov.colaborador[0] : mov.colaborador
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      })).map((mov: any) => ({
        ...mov,
        chave: mov.chave ? {
          ...mov.chave,
          veiculo: Array.isArray(mov.chave.veiculo) ? mov.chave.veiculo[0] : mov.chave.veiculo
        } : mov.chave
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      })).map((mov: any) => ({
        ...mov,
        chave: mov.chave && mov.chave.veiculo ? {
          ...mov.chave,
          veiculo: {
            ...mov.chave.veiculo,
            base: Array.isArray(mov.chave.veiculo.base) ? mov.chave.veiculo.base[0] : mov.chave.veiculo.base
          }
        } : mov.chave
      }));

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let filteredData = normalizedData.filter((mov: any) => {
        const veiculoContratoId = mov.chave?.veiculo?.contrato_id;
        const veiculoBaseId = mov.chave?.veiculo?.base_id;
        
        const hasContractAccess = !veiculoContratoId || userContractIds.includes(veiculoContratoId);
        const hasBaseAccess = !veiculoBaseId || userBaseIds.includes(veiculoBaseId);
        
        if (contratoId && contratoId !== 'todos') {
          return veiculoContratoId === contratoId && hasBaseAccess;
        }
        
        if (baseId && baseId !== 'todas') {
          return veiculoBaseId === baseId && hasContractAccess;
        }
        
        return hasContractAccess && hasBaseAccess;
      });

      if (search) {
        const searchLower = search.toLowerCase();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        filteredData = filteredData.filter((mov: any) => {
          return (
            mov.chave?.codigo?.toLowerCase().includes(searchLower) ||
            mov.chave?.veiculo?.placa?.toLowerCase().includes(searchLower) ||
            mov.colaborador?.nome?.toLowerCase().includes(searchLower) ||
            mov.colaborador?.matricula?.toLowerCase().includes(searchLower) ||
            mov.chave?.veiculo?.base?.nome?.toLowerCase().includes(searchLower)
          );
        });
      }

      const totalFilteredChaves = filteredData.length;
      const offsetChaves = (page - 1) * pageSize;
      const paginatedDataChaves = filteredData.slice(offsetChaves, offsetChaves + pageSize);

      console.log('🔍 Após filtros de acesso e busca:', totalFilteredChaves, 'registros');
      console.log('📄 Página', page, ':', paginatedDataChaves.length, 'registros');

      return NextResponse.json({
        success: true,
        data: paginatedDataChaves,
        stats,
        pagination: {
          page,
          pageSize,
          total: totalFilteredChaves,
          hasMore: totalFilteredChaves > offsetChaves + pageSize
        }
      });
    }

    return NextResponse.json({ error: 'Tipo inválido' }, { status: 400 });
  } catch (error) {
    console.error('Erro ao buscar movimentações:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
