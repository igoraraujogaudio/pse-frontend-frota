import { NextRequest, NextResponse } from 'next/server';
import { createClientWithAuth } from '@/lib/supabase';

const PAGE_SIZE = 50;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Token de autorização não fornecido' }, { status: 401 });
    }
    
    const token = authHeader.replace('Bearer ', '');
    const supabase = createClientWithAuth(token);
    
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
    if (authError || !authUser) {
      return NextResponse.json({ error: 'Usuário não autenticado' }, { status: 401 });
    }

    const { data: userData, error: userError } = await supabase
      .from('usuarios')
      .select('id, nivel_acesso')
      .eq('auth_usuario_id', authUser.id)
      .single();

    if (userError || !userData) {
      return NextResponse.json({ error: 'Dados do usuário não encontrados' }, { status: 404 });
    }

    let userContractIds: string[] = [];
    let userBaseIds: string[] = [];
    
    const { data: userContracts, error: contractsError } = await supabase
      .from('usuario_contratos')
      .select('contrato_id, ativo, data_inicio, data_fim')
      .eq('usuario_id', userData.id)
      .eq('ativo', true);

    if (contractsError) {
      return NextResponse.json({ error: 'Erro ao buscar contratos do usuário' }, { status: 500 });
    }

    userContractIds = userContracts?.map(uc => uc.contrato_id) || [];
    
    if (userContractIds.length === 0) {
      return NextResponse.json({
        success: true,
        data: [],
        pagination: { page: 1, pageSize: PAGE_SIZE, total: 0, hasMore: false }
      });
    }
    
    const { data: basesData, error: basesError } = await supabase
      .from('bases')
      .select('id, nome, codigo, contrato_id')
      .in('contrato_id', userContractIds)
      .eq('ativa', true);

    if (basesError) {
      return NextResponse.json({ error: 'Erro ao buscar bases dos contratos' }, { status: 500 });
    }

    userBaseIds = basesData?.map(b => b.id) || [];
    
    if (userBaseIds.length === 0) {
      return NextResponse.json({
        success: true,
        data: [],
        pagination: { page: 1, pageSize: PAGE_SIZE, total: 0, hasMore: false }
      });
    }
    
    // Parse parameters
    const search = searchParams.get('search') || '';
    const periodo = searchParams.get('periodo') || 'todos';
    const dataInicio = searchParams.get('dataInicio');
    const dataFim = searchParams.get('dataFim');
    const tipo = searchParams.get('tipo') || 'veiculos';
    const baseId = searchParams.get('baseId');
    const contratoId = searchParams.get('contratoId');
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || String(PAGE_SIZE));

    // Calculate date range
    let inicio: Date | null = null;
    let fim: Date | null = null;

    if (periodo === 'todos') {
      inicio = null;
      fim = null;
    } else if (dataInicio && dataFim) {
      // Período personalizado: adicionar horários completos
      inicio = new Date(dataInicio);
      inicio.setHours(0, 0, 0, 0); // 00:00:00 no início do dia
      
      fim = new Date(dataFim);
      fim.setHours(23, 59, 59, 999); // 23:59:59 no final do dia
    } else {
      const hoje = new Date();
      inicio = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
      inicio.setHours(0, 0, 0, 0);
      
      switch (periodo) {
        case 'hoje':
          fim = new Date(inicio);
          fim.setHours(23, 59, 59, 999);
          break;
        case 'ontem':
          inicio.setDate(inicio.getDate() - 1);
          fim = new Date(inicio);
          fim.setHours(23, 59, 59, 999);
          break;
        case '7dias':
          fim = new Date();
          fim.setHours(23, 59, 59, 999);
          inicio.setDate(fim.getDate() - 7);
          inicio.setHours(0, 0, 0, 0);
          break;
        case '15dias':
          fim = new Date();
          fim.setHours(23, 59, 59, 999);
          inicio.setDate(fim.getDate() - 15);
          inicio.setHours(0, 0, 0, 0);
          break;
        case '1mes':
          fim = new Date();
          fim.setHours(23, 59, 59, 999);
          inicio = new Date(fim);
          inicio.setMonth(inicio.getMonth() - 1);
          inicio.setHours(0, 0, 0, 0);
          break;
        default:
          fim = new Date(inicio);
          fim.setHours(23, 59, 59, 999);
      }
    }

    // Build query based on type
    if (tipo === 'veiculos') {
      let query = supabase
        .from('movimentacoes_veiculos')
        .select(`
          id,
          tipo,
          data_movimentacao,
          quilometragem,
          observacoes,
          tipo_veiculo,
          veiculo_id,
          carro_particular_id,
          colaborador_id,
          base_id,
          contrato_id,
          base:bases!movimentacoes_veiculos_base_id_fkey (
            id,
            nome,
            codigo
          ),
          veiculo:veiculos!movimentacoes_veiculos_veiculo_id_fkey (
            id,
            placa,
            modelo,
            marca_equipamento,
            tipo_veiculo
          ),
          carro_particular:carros_particulares!movimentacoes_veiculos_carro_particular_id_fkey (
            id,
            placa,
            funcionario_id,
            funcionario:usuarios!carros_particulares_funcionario_id_fkey (
              nome,
              matricula
            )
          ),
          colaborador:usuarios!movimentacoes_veiculos_colaborador_id_fkey (
            id,
            nome,
            matricula
          )
        `, { count: 'exact' });
      
      if (inicio && fim) {
        query = query.gte('data_movimentacao', inicio.toISOString())
                   .lte('data_movimentacao', fim.toISOString());
      }
      
      if (userContractIds.length > 0) {
        query = query.in('contrato_id', userContractIds);
      }
      
      if (contratoId && contratoId !== 'todos') {
        if (userContractIds.includes(contratoId)) {
          query = query.eq('contrato_id', contratoId);
        } else {
          query = query.eq('contrato_id', '00000000-0000-0000-0000-000000000000');
        }
      }
      
      if (baseId && baseId !== 'todas') {
        if (userBaseIds.includes(baseId)) {
          query = query.eq('base_id', baseId);
        } else {
          query = query.eq('base_id', '00000000-0000-0000-0000-000000000000');
        }
      } else if (userBaseIds.length > 0) {
        query = query.in('base_id', userBaseIds);
      }
      
      query = query.order('data_movimentacao', { ascending: false });
      
      const offset = (page - 1) * pageSize;
      query = query.range(offset, offset + pageSize - 1);

      const { data, error, count } = await query;
      
      if (error) {
        console.error('Erro ao buscar veículos:', error);
        return NextResponse.json({ error: 'Erro ao buscar dados' }, { status: 500 });
      }

      // Normalize data (convert arrays to objects)
      const normalizedData = (data || []).map(mov => ({
        ...mov,
        veiculo: Array.isArray(mov.veiculo) ? mov.veiculo[0] : mov.veiculo,
        carro_particular: Array.isArray(mov.carro_particular) ? mov.carro_particular[0] : mov.carro_particular,
        colaborador: Array.isArray(mov.colaborador) ? mov.colaborador[0] : mov.colaborador
      })).map(mov => ({
        ...mov,
        carro_particular: mov.carro_particular ? {
          ...mov.carro_particular,
          funcionario: Array.isArray(mov.carro_particular.funcionario) ? mov.carro_particular.funcionario[0] : mov.carro_particular.funcionario
        } : mov.carro_particular
      }));

      // Apply search filter in memory if needed
      let filteredData = normalizedData;
      if (search) {
        const searchLower = search.toLowerCase();
        filteredData = filteredData.filter(mov => {
          return (
            mov.veiculo?.placa?.toLowerCase().includes(searchLower) ||
            mov.carro_particular?.placa?.toLowerCase().includes(searchLower) ||
            mov.colaborador?.nome?.toLowerCase().includes(searchLower) ||
            mov.colaborador?.matricula?.toLowerCase().includes(searchLower) ||
            mov.carro_particular?.funcionario?.nome?.toLowerCase().includes(searchLower) ||
            mov.carro_particular?.funcionario?.matricula?.toLowerCase().includes(searchLower)
          );
        });
      }

      return NextResponse.json({
        success: true,
        data: filteredData,
        pagination: {
          page,
          pageSize,
          total: count || 0,
          hasMore: (count || 0) > offset + pageSize
        }
      });
    } else if (tipo === 'chaves') {
      let query = supabase
        .from('movimentacoes_chaves')
        .select(`
          id,
          tipo,
          data_movimentacao,
          observacoes,
          status,
          colaborador_id,
          chave_id,
          colaborador:usuarios!movimentacoes_chaves_colaborador_id_fkey (
            id,
            nome,
            matricula
          ),
          chave:chaves_veiculos!movimentacoes_chaves_chave_id_fkey (
            id,
            codigo,
            veiculo_id,
            veiculo:veiculos!chaves_veiculos_veiculo_id_fkey (
              id,
              placa,
              modelo,
              marca_equipamento,
              tipo_veiculo,
              contrato_id,
              base_id,
              base:bases!veiculos_base_id_fkey (
                id,
                nome,
                codigo
              )
            )
          )
        `, { count: 'exact' });
      
      if (inicio && fim) {
        query = query.gte('data_movimentacao', inicio.toISOString())
                   .lte('data_movimentacao', fim.toISOString());
      }
      
      query = query.order('data_movimentacao', { ascending: false });
      
      const offset = (page - 1) * pageSize;
      query = query.range(offset, offset + pageSize - 1);

      const { data, error, count } = await query;
      
      if (error) {
        console.error('Erro ao buscar chaves:', error);
        return NextResponse.json({ error: 'Erro ao buscar dados' }, { status: 500 });
      }

      // Normalize data first (convert arrays to objects)
      const normalizedData = (data || []).map(mov => ({
        ...mov,
        chave: Array.isArray(mov.chave) ? mov.chave[0] : mov.chave,
        colaborador: Array.isArray(mov.colaborador) ? mov.colaborador[0] : mov.colaborador
      })).map(mov => ({
        ...mov,
        chave: mov.chave ? {
          ...mov.chave,
          veiculo: Array.isArray(mov.chave.veiculo) ? mov.chave.veiculo[0] : mov.chave.veiculo
        } : mov.chave
      })).map(mov => ({
        ...mov,
        chave: mov.chave && mov.chave.veiculo ? {
          ...mov.chave,
          veiculo: {
            ...mov.chave.veiculo,
            base: Array.isArray(mov.chave.veiculo.base) ? mov.chave.veiculo.base[0] : mov.chave.veiculo.base
          }
        } : mov.chave
      }));

      // Filter by user contracts and bases
      let filteredData = normalizedData.filter(mov => {
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

      // Apply search filter
      if (search) {
        const searchLower = search.toLowerCase();
        filteredData = filteredData.filter(mov => {
          return (
            mov.chave?.codigo?.toLowerCase().includes(searchLower) ||
            mov.chave?.veiculo?.placa?.toLowerCase().includes(searchLower) ||
            mov.colaborador?.nome?.toLowerCase().includes(searchLower) ||
            mov.colaborador?.matricula?.toLowerCase().includes(searchLower)
          );
        });
      }

      return NextResponse.json({
        success: true,
        data: filteredData,
        pagination: {
          page,
          pageSize,
          total: count || 0,
          hasMore: (count || 0) > offset + pageSize
        }
      });
    }

    return NextResponse.json({ error: 'Tipo inválido' }, { status: 400 });
  } catch (error) {
    console.error('Erro ao buscar movimentações:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
