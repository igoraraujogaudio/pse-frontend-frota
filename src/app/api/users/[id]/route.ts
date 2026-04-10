import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: funcionarioId } = await params;

    if (!funcionarioId) {
      return NextResponse.json(
        { error: 'ID do funcionário é obrigatório' },
        { status: 400 }
      );
    }

    // Buscar dados completos do funcionário
    const { data: funcionario, error } = await supabase
      .from('usuarios')
      .select(`
        id,
        nome,
        email,
        matricula,
        cpf,
        telefone,
        cargo,
        posicao,
        operacao,
        departamento,
        status,
        nivel_acesso,
        criado_em,
        atualizado_em,
        data_nascimento,
        cnh,
        validade_cnh,
        cnh_categoria,
        data_ultimo_exame_aso,
        data_agendamento_aso,
        validade_aso,
        har_vencimento,
        telefone_empresarial,
        data_admissao,
        contrato_id,
        email_pessoal
      `)
      .eq('id', funcionarioId)
      .single();

    if (error) {
      console.error('Erro ao buscar funcionário:', error);
      return NextResponse.json(
        { error: 'Funcionário não encontrado' },
        { status: 404 }
      );
    }

    if (!funcionario) {
      return NextResponse.json(
        { error: 'Funcionário não encontrado' },
        { status: 404 }
      );
    }

    // Buscar informações de base através da tabela de relacionamento
    let baseInfo = null;
    let baseId = null;
    
    const { data: usuarioBase } = await supabase
      .from('usuario_bases')
      .select('base_id')
      .eq('usuario_id', funcionarioId)
      .eq('ativo', true)
      .single();
    
    if (usuarioBase?.base_id) {
      baseId = usuarioBase.base_id;
      const { data: base } = await supabase
        .from('bases')
        .select('id, nome, codigo, cidade, estado')
        .eq('id', baseId)
        .single();
      
      baseInfo = base;
    }

    // Buscar informações de contrato
    let contratoInfo = null;
    if (funcionario.contrato_id) {
      const { data: contrato } = await supabase
        .from('contratos')
        .select('id, nome, codigo')
        .eq('id', funcionario.contrato_id)
        .single();
      
      contratoInfo = contrato;
    }

    // Calcular status de vencimentos
    const hoje = new Date();
    const em30Dias = new Date(hoje.getTime() + (30 * 24 * 60 * 60 * 1000));
    const em60Dias = new Date(hoje.getTime() + (60 * 24 * 60 * 60 * 1000));
    // const em10Meses = new Date(hoje.getTime() + (10 * 30 * 24 * 60 * 60 * 1000)); // Aproximadamente 10 meses

    // Status CNH
    let cnhStatus = 'SEM_CNH';
    let cnhDiasVencimento = null;
    if (funcionario.validade_cnh) {
      const dataVencimentoCNH = new Date(funcionario.validade_cnh);
      cnhDiasVencimento = Math.ceil((dataVencimentoCNH.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
      
      if (dataVencimentoCNH < hoje) {
        cnhStatus = 'VENCIDA';
      } else if (dataVencimentoCNH <= em30Dias) {
        cnhStatus = 'VENCENDO';
      } else {
        cnhStatus = 'VIGENTE';
      }
    }

    // Status ASO
    let asoStatus = 'SEM_ASO';
    let asoDiasVencimento = null;
    let asoAgendamentoStatus = null;
    
    if (funcionario.data_agendamento_aso) {
      const dataAgendamento = new Date(funcionario.data_agendamento_aso);
      const diasAgendamento = Math.ceil((dataAgendamento.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
      
      if (diasAgendamento <= 0) {
        asoAgendamentoStatus = 'AGENDADO_VENCENDO';
      } else if (diasAgendamento <= 7) {
        asoAgendamentoStatus = 'AGENDADO_PROXIMO';
      } else {
        asoAgendamentoStatus = 'AGENDADO';
      }
    }
    
    // Usar validade_aso se disponível, senão calcular manualmente
    if (funcionario.validade_aso) {
      const dataVencimentoASO = new Date(funcionario.validade_aso);
      asoDiasVencimento = Math.ceil((dataVencimentoASO.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
      
      // Lógica de status baseada no status do funcionário
      if (funcionario.status === 'demitido') {
        // Para funcionários demitidos, usar lógica mais simples
        if (dataVencimentoASO < hoje) {
          asoStatus = 'VENCIDO';
        } else {
          asoStatus = 'VIGENTE';
        }
      } else {
        // Para funcionários ativos, usar lógica completa com alertas
        if (dataVencimentoASO < hoje) {
          asoStatus = 'VENCIDO';
        } else if (dataVencimentoASO <= em30Dias) {
          asoStatus = 'ATENCAO'; // 30 dias para vencer
        } else if (dataVencimentoASO <= em60Dias) {
          asoStatus = 'VENCENDO'; // 60 dias para vencer
        } else {
          asoStatus = 'NO_PRAZO'; // Mais de 60 dias
        }
      }
    } else if (funcionario.data_ultimo_exame_aso) {
      // Fallback: calcular manualmente se validade_aso não estiver disponível
      const dataUltimoASO = new Date(funcionario.data_ultimo_exame_aso);
      const dataVencimentoASO = new Date(dataUltimoASO.getTime() + (365 * 24 * 60 * 60 * 1000)); // ASO vence em 1 ano
      asoDiasVencimento = Math.ceil((dataVencimentoASO.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
      
      // Lógica de status baseada no status do funcionário
      if (funcionario.status === 'demitido') {
        // Para funcionários demitidos, usar lógica mais simples
        if (dataVencimentoASO < hoje) {
          asoStatus = 'VENCIDO';
        } else {
          asoStatus = 'VIGENTE';
        }
      } else {
        // Para funcionários ativos, usar lógica completa com alertas
        if (dataVencimentoASO < hoje) {
          asoStatus = 'VENCIDO';
        } else if (dataVencimentoASO <= em30Dias) {
          asoStatus = 'ATENCAO'; // 30 dias para vencer
        } else if (dataVencimentoASO <= em60Dias) {
          asoStatus = 'VENCENDO'; // 60 dias para vencer
        } else {
          asoStatus = 'NO_PRAZO'; // Mais de 60 dias
        }
      }
    }

    // Status HAR
    let harStatus = 'SEM_HAR';
    let harDiasVencimento = null;
    if (funcionario.har_vencimento) {
      const dataVencimentoHAR = new Date(funcionario.har_vencimento);
      harDiasVencimento = Math.ceil((dataVencimentoHAR.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
      
      if (dataVencimentoHAR < hoje) {
        harStatus = 'VENCIDO';
      } else if (dataVencimentoHAR <= em30Dias) {
        harStatus = 'VENCENDO';
      } else {
        harStatus = 'VIGENTE';
      }
    }

    // Montar resposta com todos os dados
    const funcionarioCompleto = {
      ...funcionario,
      base_id: baseId,
      base: baseInfo,
      contrato: contratoInfo,
      vencimentos: {
        cnh: {
          status: cnhStatus,
          dias_vencimento: cnhDiasVencimento,
          data_vencimento: funcionario.validade_cnh
        },
        aso: {
          status: asoStatus,
          dias_vencimento: asoDiasVencimento,
          data_ultimo: funcionario.data_ultimo_exame_aso,
          data_agendamento: funcionario.data_agendamento_aso,
          agendamento_status: asoAgendamentoStatus,
          data_vencimento: funcionario.validade_aso || 
            (funcionario.data_ultimo_exame_aso ? 
              new Date(new Date(funcionario.data_ultimo_exame_aso).getTime() + (365 * 24 * 60 * 60 * 1000)).toISOString().split('T')[0] : null)
        },
        har: {
          status: harStatus,
          dias_vencimento: harDiasVencimento,
          data_vencimento: funcionario.har_vencimento
        }
      }
    };

    return NextResponse.json({ funcionario: funcionarioCompleto });

  } catch (error) {
    console.error('Erro interno:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const body = await request.json();
    const { id } = await params;

    // ✅ CORREÇÃO: Se perfil_acesso_id foi enviado, buscar o codigo correspondente
    let nivelAcesso = body.nivel_acesso; // Manter o valor atual se não houver perfil_acesso_id
    if (body.perfil_acesso_id) {
      const { data: perfilData } = await supabase
        .from('perfis_acesso')
        .select('codigo')
        .eq('id', body.perfil_acesso_id)
        .single();
      nivelAcesso = perfilData?.codigo || body.nivel_acesso;
    }

    const { data, error } = await supabase
      .from('usuarios')
      .update({
        nome: body.nome,
        email: body.email,
        matricula: body.matricula,
        cpf: body.cpf,
        telefone: body.telefone,
        telefone_empresarial: body.telefone_empresarial,
        cargo: body.cargo,
        posicao: body.posicao,
        operacao: body.operacao,
        contrato_id: body.contrato_id || null,
        nivel_acesso: nivelAcesso, // ✅ CORREÇÃO: Usar nivel_acesso derivado do perfil_id
        status: body.status,
        // Campos de documentos
        cnh: body.cnh,
        validade_cnh: body.validade_cnh,
        cnh_categoria: body.cnh_categoria,
        data_ultimo_exame_aso: body.data_ultimo_exame_aso,
        data_agendamento_aso: body.data_agendamento_aso,
        validade_aso: body.validade_aso,
        har_vencimento: body.har_vencimento,
        // Campos de datas
        data_admissao: body.data_admissao,
        data_nascimento: body.data_nascimento,
        data_demissao: body.data_demissao,
        tipo_demissao: body.tipo_demissao,
        observacoes_demissao: body.observacoes_demissao,
        email_pessoal: body.email_pessoal,
        atualizado_em: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Erro ao atualizar usuário:', error);
      return NextResponse.json({ error: 'Erro ao atualizar usuário' }, { status: 500 });
    }

    // Atualizar relacionamento com base se especificado
    if (body.base_id !== undefined && data) {
      // Primeiro, desativar relacionamentos existentes
      await supabase
        .from('usuario_bases')
        .update({ ativo: false })
        .eq('usuario_id', id);

      // Se uma nova base foi especificada, criar novo relacionamento
      if (body.base_id) {
        await supabase
          .from('usuario_bases')
          .insert({
            usuario_id: id,
            base_id: body.base_id,
            tipo_acesso: 'total',
            ativo: true
          });
      }
    }

    return NextResponse.json({ usuario: data });
  } catch (error) {
    console.error('Erro interno:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
