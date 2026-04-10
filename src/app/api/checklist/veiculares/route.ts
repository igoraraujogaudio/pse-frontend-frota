import { NextRequest, NextResponse } from 'next/server';
import { createClientWithAuth } from '@/lib/supabase';

// GET: Listar checklists veiculares filtrados por contratos do usuário
export async function GET(request: NextRequest) {
  try {
    // Obter token de autorização
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

    // Verificar se é admin global
    const isGlobalAdmin = funcionario.nivel_acesso === 'admin' || funcionario.nivel_acesso === 'diretor';

    // Buscar contratos do usuário (se não for admin)
    let userContractIds: string[] = [];
    if (!isGlobalAdmin) {
      const { data: userContracts, error: userContractsError } = await supabase
        .from('usuario_contratos')
        .select('contrato_id')
        .eq('usuario_id', funcionario.id)
        .eq('ativo', true);

      if (userContractsError) {
        console.error('Erro ao buscar contratos do usuário:', userContractsError);
        return NextResponse.json(
          { error: 'Erro ao buscar contratos do usuário' },
          { status: 500 }
        );
      }

      userContractIds = userContracts?.map(uc => uc.contrato_id) || [];
      
      if (userContractIds.length === 0) {
        return NextResponse.json({
          checklists: []
        });
      }
    }

    // Buscar checklists veiculares
    let checklistsQuery = supabase
      .from('checklist_veicular')
      .select(`
        id,
        veiculo_id,
        equipe_id,
        equipe_nome,
        motorista_nome,
        motorista_cnh,
        motorista_validade_cnh,
        motorista_categoria,
        data_checklist,
        validade_crlv,
        km_atual,
        km_saida,
        km_chegada,
        motorista_condicoes_adequadas,
        justificativa_condicoes,
        propriedade,
        inclusao,
        horario_abertura,
        horario_fechamento,
        turma,
        localidade_motivo,
        nome_portaria,
        observacoes_portaria,
        status,
        itens,
        laudos_status,
        requer_liberacao_supervisor,
        liberado_por_supervisor,
        supervisor_nome,
        justificativa_liberacao,
        data_liberacao,
        criado_em,
        atualizado_em,
        veiculo:veiculos(
          id,
          placa,
          prefixo_fixo,
          modelo,
          marca,
          contrato_id,
          contrato:contratos(id, nome, codigo)
        ),
        equipe:equipes(
          id,
          nome,
          contrato_id,
          contrato:contratos(id, nome, codigo)
        )
      `)
      .order('data_checklist', { ascending: false })
      .limit(100);

    // Se não for admin, filtrar por contratos do usuário
    let vehicleIds: string[] = [];
    let equipeIds: string[] = [];
    
    if (!isGlobalAdmin && userContractIds.length > 0) {
      // Buscar IDs de veículos dos contratos do usuário
      const { data: vehicles } = await supabase
        .from('veiculos')
        .select('id')
        .in('contrato_id', userContractIds);
      
      vehicleIds = vehicles?.map(v => v.id) || [];

      // Buscar IDs de equipes dos contratos do usuário
      const { data: equipes } = await supabase
        .from('equipes')
        .select('id')
        .in('contrato_id', userContractIds);
      
      equipeIds = equipes?.map(e => e.id) || [];

      // Se não houver veículos nem equipes, retornar vazio
      if (vehicleIds.length === 0 && equipeIds.length === 0) {
        return NextResponse.json({
          checklists: []
        });
      }

      // Filtrar checklists por veículos ou equipes
      if (vehicleIds.length > 0 && equipeIds.length > 0) {
        // Combinar filtros: veículos OU equipes
        checklistsQuery = checklistsQuery.or(
          `veiculo_id.in.(${vehicleIds.join(',')}),equipe_id.in.(${equipeIds.join(',')})`
        );
      } else if (vehicleIds.length > 0) {
        checklistsQuery = checklistsQuery.in('veiculo_id', vehicleIds);
      } else if (equipeIds.length > 0) {
        checklistsQuery = checklistsQuery.in('equipe_id', equipeIds);
      }
    }

    const { data: checklists, error: checklistsError } = await checklistsQuery;

    if (checklistsError) {
      console.error('Erro ao buscar checklists veiculares:', checklistsError);
      return NextResponse.json(
        { error: 'Erro ao buscar checklists veiculares' },
        { status: 500 }
      );
    }

    // Formatar checklists para resposta
    interface ChecklistRaw {
      id: unknown;
      veiculo_id: unknown;
      equipe_id: unknown;
      equipe_nome: unknown;
      motorista_nome: unknown;
      motorista_cnh: unknown;
      motorista_validade_cnh: unknown;
      motorista_categoria: unknown;
      data_checklist: unknown;
      validade_crlv: unknown;
      km_atual: unknown;
      km_saida: unknown;
      km_chegada: unknown;
      motorista_condicoes_adequadas: unknown;
      justificativa_condicoes: unknown;
      propriedade: unknown;
      inclusao: unknown;
      horario_abertura: unknown;
      horario_fechamento: unknown;
      turma: unknown;
      localidade_motivo: unknown;
      nome_portaria: unknown;
      observacoes_portaria: unknown;
      status: unknown;
      itens: unknown[];
      laudos_status: unknown[];
      requer_liberacao_supervisor: unknown;
      liberado_por_supervisor: unknown;
      supervisor_nome: unknown;
      justificativa_liberacao: unknown;
      data_liberacao: unknown;
      criado_em: unknown;
      atualizado_em: unknown;
      veiculo: Array<{
        id: unknown;
        placa: unknown;
        prefixo_fixo: unknown;
        modelo: unknown;
        marca: unknown;
        contrato_id: unknown;
        contrato: Array<{ id: unknown; nome: unknown; codigo: unknown }>;
      }>;
      equipe: Array<{
        id: unknown;
        nome: unknown;
        contrato_id: unknown;
        contrato: Array<{ id: unknown; nome: unknown; codigo: unknown }>;
      }>;
    }
    const checklistsFormatados = (checklists || []).map((checklist: ChecklistRaw) => {
      const veiculo = Array.isArray(checklist.veiculo) && checklist.veiculo.length > 0 ? checklist.veiculo[0] : null;
      const equipe = Array.isArray(checklist.equipe) && checklist.equipe.length > 0 ? checklist.equipe[0] : null;
      const veiculoContrato = veiculo && Array.isArray(veiculo.contrato) && veiculo.contrato.length > 0 ? veiculo.contrato[0] : null;
      const equipeContrato = equipe && Array.isArray(equipe.contrato) && equipe.contrato.length > 0 ? equipe.contrato[0] : null;
      
      return {
      id: String(checklist.id),
      veiculo_id: checklist.veiculo_id ? String(checklist.veiculo_id) : null,
      veiculo: veiculo ? {
        id: String(veiculo.id),
        placa: String(veiculo.placa),
        prefixo: veiculo.prefixo_fixo ? String(veiculo.prefixo_fixo) : null,
        modelo: String(veiculo.modelo),
        marca: String(veiculo.marca),
        contrato: veiculoContrato ? {
          id: String(veiculoContrato.id),
          nome: String(veiculoContrato.nome),
          codigo: String(veiculoContrato.codigo)
        } : null
      } : null,
      equipe: equipe ? {
        id: String(equipe.id),
        nome: String(equipe.nome),
        contrato: equipeContrato ? {
          id: String(equipeContrato.id),
          nome: String(equipeContrato.nome),
          codigo: String(equipeContrato.codigo)
        } : null
      } : {
        nome: checklist.equipe_nome ? String(checklist.equipe_nome) : 'N/A'
      },
      motorista: {
        nome: String(checklist.motorista_nome),
        cnh: String(checklist.motorista_cnh),
        validade_cnh: checklist.motorista_validade_cnh ? String(checklist.motorista_validade_cnh) : null,
        categoria: String(checklist.motorista_categoria),
        condicoes_adequadas: Boolean(checklist.motorista_condicoes_adequadas),
        justificativa_condicoes: checklist.justificativa_condicoes ? String(checklist.justificativa_condicoes) : null
      },
      data_checklist: String(checklist.data_checklist),
      validade_crlv: checklist.validade_crlv ? String(checklist.validade_crlv) : null,
      quilometragem: {
        atual: checklist.km_atual ? Number(checklist.km_atual) : null,
        saida: checklist.km_saida ? Number(checklist.km_saida) : null,
        chegada: checklist.km_chegada ? Number(checklist.km_chegada) : null
      },
      propriedade: checklist.propriedade ? String(checklist.propriedade) : null,
      inclusao: checklist.inclusao ? String(checklist.inclusao) : null,
      horarios: {
        abertura: checklist.horario_abertura ? String(checklist.horario_abertura) : null,
        fechamento: checklist.horario_fechamento ? String(checklist.horario_fechamento) : null
      },
      turma: checklist.turma ? String(checklist.turma) : null,
      localidade_motivo: checklist.localidade_motivo ? String(checklist.localidade_motivo) : null,
      portaria: {
        nome: checklist.nome_portaria ? String(checklist.nome_portaria) : null,
        observacoes: checklist.observacoes_portaria ? String(checklist.observacoes_portaria) : null
      },
      status: String(checklist.status),
      itens: Array.isArray(checklist.itens) ? checklist.itens : [],
      laudos_status: Array.isArray(checklist.laudos_status) ? checklist.laudos_status : [],
      requer_liberacao_supervisor: Boolean(checklist.requer_liberacao_supervisor),
      liberacao: checklist.liberado_por_supervisor ? {
        supervisor_id: String(checklist.liberado_por_supervisor),
        supervisor_nome: checklist.supervisor_nome ? String(checklist.supervisor_nome) : null,
        justificativa: checklist.justificativa_liberacao ? String(checklist.justificativa_liberacao) : null,
        data: checklist.data_liberacao ? String(checklist.data_liberacao) : null
      } : null,
      criado_em: String(checklist.criado_em),
      atualizado_em: String(checklist.atualizado_em)
    };
    });

    return NextResponse.json({
      checklists: checklistsFormatados
    });

  } catch (error) {
    console.error('Erro interno:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

