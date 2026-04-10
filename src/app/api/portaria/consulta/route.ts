import { NextRequest, NextResponse } from 'next/server';
import { createClientWithAuth } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Obter token de autorização
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Token de autorização não fornecido' }, { status: 401 });
    }
    
    const token = authHeader.replace('Bearer ', '');
    const supabase = createClientWithAuth(token);
    
    // Obter usuário autenticado
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
    if (authError || !authUser) {
      return NextResponse.json(
        { error: 'Usuário não autenticado' },
        { status: 401 }
      );
    }

    // Buscar dados do usuário na tabela usuarios
    const { data: userData, error: userError } = await supabase
      .from('usuarios')
      .select('id, nivel_acesso')
      .eq('auth_usuario_id', authUser.id)
      .single();

    if (userError || !userData) {
      return NextResponse.json(
        { error: 'Dados do usuário não encontrados' },
        { status: 404 }
      );
    }

    // Obter contratos do usuário
    let userContractIds: string[] = [];
    let userBaseIds: string[] = [];
    
    console.log('🔍 API DEBUG - Usuario ID:', userData.id);
    console.log('🔍 API DEBUG - Nivel de acesso:', userData.nivel_acesso);
    
    const { data: userContracts, error: contractsError } = await supabase
      .from('usuario_contratos')
      .select('contrato_id, ativo, data_inicio, data_fim')
      .eq('usuario_id', userData.id)
      .eq('ativo', true);

    console.log('🔍 API DEBUG - Usuario Contratos:', userContracts);

    if (contractsError) {
      console.error('Erro ao buscar contratos do usuário:', contractsError);
      return NextResponse.json(
        { error: 'Erro ao buscar contratos do usuário' },
        { status: 500 }
      );
    }

    userContractIds = userContracts?.map(uc => uc.contrato_id) || [];
    console.log('🔍 API DEBUG - Contract IDs:', userContractIds);
    
    // Se usuário não tem contratos, retornar dados vazios
    if (userContractIds.length === 0) {
      return NextResponse.json({
        success: true,
        data: { veiculos: [], chaves: [] },
        filtros: {
          search: searchParams.get('search') || '',
          periodo: searchParams.get('periodo') || 'hoje',
          dataInicio: null,
          dataFim: null,
          tipo: searchParams.get('tipo') || 'todos'
        }
      });
    }
    
    // Buscar bases dos contratos que o usuário tem acesso
    const { data: basesData, error: basesError } = await supabase
      .from('bases')
      .select('id, nome, codigo, contrato_id')
      .in('contrato_id', userContractIds)
      .eq('ativa', true);

    console.log('🔍 API DEBUG - Bases encontradas:', basesData);

    if (basesError) {
      console.error('Erro ao buscar bases dos contratos:', basesError);
      return NextResponse.json(
        { error: 'Erro ao buscar bases dos contratos' },
        { status: 500 }
      );
    }

    userBaseIds = basesData?.map(b => b.id) || [];
    console.log('🔍 API DEBUG - Base IDs:', userBaseIds);
    
    // Se não há bases disponíveis, retornar dados vazios
    if (userBaseIds.length === 0) {
      return NextResponse.json({
        success: true,
        data: { veiculos: [], chaves: [] },
        filtros: {
          search: searchParams.get('search') || '',
          periodo: searchParams.get('periodo') || 'hoje',
          dataInicio: null,
          dataFim: null,
          tipo: searchParams.get('tipo') || 'todos'
        }
      });
    }
    
    // Parâmetros de filtro
    const search = searchParams.get('search') || '';
    const periodo = searchParams.get('periodo') || 'hoje';
    const dataInicio = searchParams.get('dataInicio');
    const dataFim = searchParams.get('dataFim');
    const tipo = searchParams.get('tipo') || 'todos'; // 'veiculos', 'chaves', 'todos'
    const baseId = searchParams.get('baseId');
    const contratoId = searchParams.get('contratoId');

    // Calcular datas baseado no período
    let inicio: Date | null = null;
    let fim: Date | null = null;

    // Se período for 'todos', não aplicar filtro de data
    if (periodo === 'todos') {
      inicio = null;
      fim = null;
    } else if (dataInicio && dataFim) {
      inicio = new Date(dataInicio);
      fim = new Date(dataFim);
    } else {
      const hoje = new Date();
      inicio = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
      
      switch (periodo) {
        case 'hoje':
          fim = new Date(inicio);
          fim.setDate(fim.getDate() + 1);
          break;
        case 'ontem':
          inicio.setDate(inicio.getDate() - 1);
          fim = new Date(inicio);
          fim.setDate(fim.getDate() + 1);
          break;
        case '7dias':
          fim = new Date();
          inicio.setDate(fim.getDate() - 7);
          break;
        case '15dias':
          fim = new Date();
          inicio.setDate(fim.getDate() - 15);
          break;
        case '1mes':
          inicio.setMonth(inicio.getMonth() - 1);
          fim = new Date();
          break;
        default:
          fim = new Date(inicio);
          fim.setDate(fim.getDate() + 1);
      }
    }

    const resultados: {
      veiculos: Array<Record<string, unknown>>;
      chaves: Array<Record<string, unknown>>;
    } = {
      veiculos: [],
      chaves: []
    };

    // Buscar movimentações de veículos se necessário
    if (tipo === 'todos' || tipo === 'veiculos') {
      try {
        // Consulta otimizada com JOINs
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
          `);
        
        // Aplicar filtro de data apenas se não for 'todos'
        if (inicio && fim) {
          query = query.gte('data_movimentacao', inicio.toISOString())
                     .lte('data_movimentacao', fim.toISOString());
        }
        
        // Filtrar por contrato_id do usuário
        if (userContractIds.length > 0) {
          query = query.in('contrato_id', userContractIds);
        }
        
        // Filtrar por contrato específico se especificado
        if (contratoId && contratoId !== 'todos') {
          // Garantir que o contrato está nos contratos do usuário
          if (userContractIds.length > 0 && !userContractIds.includes(contratoId)) {
            query = query.eq('contrato_id', '00000000-0000-0000-0000-000000000000'); // Query vazia
          } else {
            query = query.eq('contrato_id', contratoId);
          }
        }
        
        // Filtrar por base_id se especificado
        if (baseId && baseId !== 'todas') {
          // Garantir que a base está nas bases do usuário
          if (userBaseIds.length > 0 && !userBaseIds.includes(baseId)) {
            query = query.eq('base_id', '00000000-0000-0000-0000-000000000000'); // Query vazia
          } else {
            query = query.eq('base_id', baseId);
          }
        }
        
        // Filtrar por base_id (apenas bases dos contratos do usuário)
        if (userBaseIds.length > 0 && (!baseId || baseId === 'todas')) {
          query = query.in('base_id', userBaseIds);
        }
        
        query = query.order('data_movimentacao', { ascending: false });

        // Aplicar filtro de busca no banco se necessário
        if (search) {
          // Para busca, vamos fazer uma consulta mais simples primeiro
          // e depois filtrar os resultados relacionados
          let baseQuery = supabase
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
              contrato_id
            `);

          // Aplicar filtro de data
          if (inicio && fim) {
            baseQuery = baseQuery.gte('data_movimentacao', inicio.toISOString())
                                .lte('data_movimentacao', fim.toISOString());
          }
          
          // Filtrar por contrato_id do usuário
          if (userContractIds.length > 0) {
            baseQuery = baseQuery.in('contrato_id', userContractIds);
          }
          
          // Filtrar por contrato específico se especificado
          if (contratoId && contratoId !== 'todos') {
            // Garantir que o contrato está nos contratos do usuário
            if (userContractIds.length > 0 && !userContractIds.includes(contratoId)) {
              baseQuery = baseQuery.eq('contrato_id', '00000000-0000-0000-0000-000000000000'); // Query vazia
            } else {
              baseQuery = baseQuery.eq('contrato_id', contratoId);
            }
          }
          
          // Filtrar por base_id se especificado
          if (baseId && baseId !== 'todas') {
            // Garantir que a base está nas bases do usuário
            if (userBaseIds.length > 0 && !userBaseIds.includes(baseId)) {
              baseQuery = baseQuery.eq('base_id', '00000000-0000-0000-0000-000000000000'); // Query vazia
            } else {
              baseQuery = baseQuery.eq('base_id', baseId);
            }
          }
          
          // Filtrar por base_id (apenas bases dos contratos do usuário)
          if (userBaseIds.length > 0 && (!baseId || baseId === 'todas')) {
            baseQuery = baseQuery.in('base_id', userBaseIds);
          }

          baseQuery = baseQuery.order('data_movimentacao', { ascending: false });

          const { data: movimentacoesBase, error: errorBase } = await baseQuery;

          if (errorBase) {
            console.error('Erro ao buscar movimentações de veículos:', errorBase);
          } else if (movimentacoesBase) {
            // Buscar dados relacionados em lotes para otimizar
            const veiculoIds = [...new Set(movimentacoesBase.map(m => m.veiculo_id).filter(Boolean))];
            const carroParticularIds = [...new Set(movimentacoesBase.map(m => m.carro_particular_id).filter(Boolean))];
            const colaboradorIds = [...new Set(movimentacoesBase.map(m => m.colaborador_id).filter(Boolean))];

            // Buscar dados relacionados em lotes
            let veiculosQuery = supabase
              .from('veiculos')
              .select('id, placa, modelo, marca_equipamento, tipo_veiculo, contrato_id, base_id, base:bases!veiculos_base_id_fkey(id, nome, codigo)');
            
            if (veiculoIds.length > 0) {
              veiculosQuery = veiculosQuery.in('id', veiculoIds);
            } else {
              veiculosQuery = veiculosQuery.eq('id', '00000000-0000-0000-0000-000000000000'); // Query vazia
            }

            // Aplicar filtro por contratos do usuário
            if (userContractIds.length > 0) {
              veiculosQuery = veiculosQuery.in('contrato_id', userContractIds);
            }

            // Não aplicar filtro adicional de contrato nos dados do veículo
            // O filtro por contrato deve funcionar para mostrar movimentações
            // das bases, não apenas veículos do contrato específico
            
            // Aplicar apenas filtro de base se especificado
            if (baseId) {
              veiculosQuery = veiculosQuery.eq('base_id', baseId);
            }

            const [veiculosResult, carrosResult, colaboradoresResult] = await Promise.all([
              veiculoIds.length > 0 ? veiculosQuery : { data: [] },
              carroParticularIds.length > 0 ? supabase
                .from('carros_particulares')
                .select('id, placa, funcionario_id')
                .in('id', carroParticularIds) : { data: [] },
              colaboradorIds.length > 0 ? supabase
                .from('usuarios')
                .select('id, nome, matricula')
                .in('id', colaboradorIds) : { data: [] }
            ]);

            // Buscar funcionários dos carros particulares
            const funcionarioIds = carrosResult.data?.map(c => c.funcionario_id).filter(Boolean) || [];
            const funcionariosResult = funcionarioIds.length > 0 ? await supabase
              .from('usuarios')
              .select('id, nome, matricula')
              .in('id', funcionarioIds) : { data: [] };

            // Criar mapas para lookup rápido
            const veiculosMap = new Map(veiculosResult.data?.map(v => [v.id, v]) || []);
            const carrosMap = new Map(carrosResult.data?.map(c => [c.id, c]) || []);
            const colaboradoresMap = new Map(colaboradoresResult.data?.map(c => [c.id, c]) || []);
            const funcionariosMap = new Map(funcionariosResult.data?.map(f => [f.id, f]) || []);

            // Montar dados completos e filtrar por contratos
            const movimentacoesCompletas = movimentacoesBase
              .map(mov => {
                const movimentacaoCompleta: Record<string, unknown> = { ...mov };

                if (mov.veiculo_id) {
                  movimentacaoCompleta.veiculo = veiculosMap.get(mov.veiculo_id);
                }

                if (mov.carro_particular_id) {
                  const carro = carrosMap.get(mov.carro_particular_id);
                  if (carro?.funcionario_id) {
                    (carro as Record<string, unknown>).funcionario = funcionariosMap.get(carro.funcionario_id);
                  }
                  movimentacaoCompleta.carro_particular = carro;
                }

                if (mov.colaborador_id) {
                  movimentacaoCompleta.colaborador = colaboradoresMap.get(mov.colaborador_id);
                }

                return movimentacaoCompleta;
              })
              .filter(() => {
                // O filtro já foi aplicado nas bases, permitindo todas as movimentações
                return true;
              });

            // Aplicar filtro de busca
            const searchLower = search.toLowerCase();
            resultados.veiculos = movimentacoesCompletas.filter(mov => {
              return (
                ((mov.veiculo as Record<string, unknown>)?.placa as string)?.toLowerCase().includes(searchLower) ||
                ((mov.carro_particular as Record<string, unknown>)?.placa as string)?.toLowerCase().includes(searchLower) ||
                ((mov.colaborador as Record<string, unknown>)?.nome as string)?.toLowerCase().includes(searchLower) ||
                ((mov.colaborador as Record<string, unknown>)?.matricula as string)?.toLowerCase().includes(searchLower) ||
                (((mov.carro_particular as Record<string, unknown>)?.funcionario as Record<string, unknown>)?.nome as string)?.toLowerCase().includes(searchLower) ||
                (((mov.carro_particular as Record<string, unknown>)?.funcionario as Record<string, unknown>)?.matricula as string)?.toLowerCase().includes(searchLower)
              );
            });
          }
        } else {
          // Sem busca, usar JOINs diretos
          const { data: movimentacoesCompletas, error: errorCompleto } = await query;
          
          if (errorCompleto) {
            console.error('Erro ao buscar movimentações completas:', errorCompleto);
          } else {
            // Usar dados diretamente (filtro já foi aplicado por contratos/bases)
            resultados.veiculos = movimentacoesCompletas || [];
          }
        }
      } catch (error) {
        console.error('Erro na consulta de veículos:', error);
      }
    }

    // Buscar movimentações de chaves se necessário
    if (tipo === 'todos' || tipo === 'chaves') {
      try {
        // Consulta otimizada com JOINs para chaves
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
          `);
        
        // Aplicar filtro de data apenas se não for 'todos'
        if (inicio && fim) {
          query = query.gte('data_movimentacao', inicio.toISOString())
                     .lte('data_movimentacao', fim.toISOString());
        }
        
        query = query.order('data_movimentacao', { ascending: false });

        if (search) {
          // Para busca, usar estratégia similar aos veículos
          let baseQuery = supabase
            .from('movimentacoes_chaves')
            .select(`
              id,
              tipo,
              data_movimentacao,
              observacoes,
              status,
              colaborador_id,
              chave_id
            `);

          // Aplicar filtro de data
          if (inicio && fim) {
            baseQuery = baseQuery.gte('data_movimentacao', inicio.toISOString())
                                .lte('data_movimentacao', fim.toISOString());
          }

          baseQuery = baseQuery.order('data_movimentacao', { ascending: false });

          const { data: movimentacoesBase, error: errorBase } = await baseQuery;

          if (errorBase) {
            console.error('Erro ao buscar movimentações de chaves:', errorBase);
          } else if (movimentacoesBase) {
            // Buscar dados relacionados em lotes
            const chaveIds = [...new Set(movimentacoesBase.map(m => m.chave_id).filter(Boolean))];
            const colaboradorIds = [...new Set(movimentacoesBase.map(m => m.colaborador_id).filter(Boolean))];

            const [chavesResult, colaboradoresResult] = await Promise.all([
              chaveIds.length > 0 ? supabase
                .from('chaves_veiculos')
                .select('id, codigo, veiculo_id')
                .in('id', chaveIds) : { data: [] },
              colaboradorIds.length > 0 ? supabase
                .from('usuarios')
                .select('id, nome, matricula')
                .in('id', colaboradorIds) : { data: [] }
            ]);

            // Buscar veículos das chaves
            const veiculoIds = chavesResult.data?.map(c => c.veiculo_id).filter(Boolean) || [];
            let veiculosQuery = supabase
              .from('veiculos')
              .select('id, placa, modelo, marca_equipamento, tipo_veiculo, contrato_id, base_id, base:bases!veiculos_base_id_fkey(id, nome, codigo)');
            
            if (veiculoIds.length > 0) {
              veiculosQuery = veiculosQuery.in('id', veiculoIds);
            } else {
              veiculosQuery = veiculosQuery.eq('id', '00000000-0000-0000-0000-000000000000'); // Query vazia
            }

            // Aplicar filtro por contratos do usuário
            if (userContractIds.length > 0) {
              veiculosQuery = veiculosQuery.in('contrato_id', userContractIds);
            }

            const veiculosResult = veiculoIds.length > 0 ? await veiculosQuery : { data: [] };

            // Criar mapas para lookup rápido
            const chavesMap = new Map(chavesResult.data?.map(c => [c.id, c]) || []);
            const colaboradoresMap = new Map(colaboradoresResult.data?.map(c => [c.id, c]) || []);
            const veiculosMap = new Map(veiculosResult.data?.map(v => [v.id, v]) || []);

            // Montar dados completos e filtrar por contratos
            const movimentacoesCompletas = movimentacoesBase
              .map(mov => {
                const movimentacaoCompleta: Record<string, unknown> = { ...mov };

                if (mov.chave_id) {
                  const chave = chavesMap.get(mov.chave_id);
                  if (chave?.veiculo_id) {
                    (chave as Record<string, unknown>).veiculo = veiculosMap.get(chave.veiculo_id);
                  }
                  movimentacaoCompleta.chave = chave;
                }

                if (mov.colaborador_id) {
                  movimentacaoCompleta.colaborador = colaboradoresMap.get(mov.colaborador_id);
                }

                return movimentacaoCompleta;
              })
              .filter(() => {
                // O filtro já foi aplicado nas bases, permitindo todas as movimentações
                return true;
              });

            // Aplicar filtro de busca
            const searchLower = search.toLowerCase();
            resultados.chaves = movimentacoesCompletas.filter(mov => {
              return (
                ((mov.chave as Record<string, unknown>)?.codigo as string)?.toLowerCase().includes(searchLower) ||
                (((mov.chave as Record<string, unknown>)?.veiculo as Record<string, unknown>)?.placa as string)?.toLowerCase().includes(searchLower) ||
                ((mov.colaborador as Record<string, unknown>)?.nome as string)?.toLowerCase().includes(searchLower) ||
                ((mov.colaborador as Record<string, unknown>)?.matricula as string)?.toLowerCase().includes(searchLower)
              );
            });
          }
        } else {
          // Sem busca, usar JOINs diretos
          const { data: movimentacoesCompletas, error: errorCompleto } = await query;
          
          if (errorCompleto) {
            console.error('Erro ao buscar movimentações de chaves:', errorCompleto);
          } else {
            // Remover filtro restritivo - usar dados diretamente sem filtrar adicionalmente
            resultados.chaves = movimentacoesCompletas || [];
          }
        }
      } catch (error) {
        console.error('Erro na consulta de chaves:', error);
      }
    }

    return NextResponse.json({
      success: true,
      data: resultados,
      filtros: {
        search,
        periodo,
        dataInicio: inicio?.toISOString() || null,
        dataFim: fim?.toISOString() || null,
        tipo
      }
    });
  } catch (error) {
    console.error('Erro ao buscar movimentações:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
