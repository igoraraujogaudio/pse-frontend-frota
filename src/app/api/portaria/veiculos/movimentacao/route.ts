import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();
    
    // Obter usuário logado
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    // Buscar dados do funcionário
    const { data: funcionario, error: funcionarioError } = await supabase
      .from('usuarios')
      .select('id')
      .eq('auth_usuario_id', user.id)
      .single();

    if (funcionarioError || !funcionario) {
      return NextResponse.json({ error: 'Funcionário não encontrado' }, { status: 404 });
    }

    const { 
      veiculo_id, 
      carro_particular_id, 
      acao, 
      quilometragem, 
      observacoes,
      base_id,
      contrato_id
    } = await request.json();

    // Validar dados obrigatórios
    if ((!veiculo_id && !carro_particular_id) || !acao) {
      return NextResponse.json(
        { error: 'Dados obrigatórios não fornecidos' },
        { status: 400 }
      );
    }

    // Validar base_id (obrigatório)
    if (!base_id) {
      return NextResponse.json(
        { error: 'base_id é obrigatório para registrar movimentações' },
        { status: 400 }
      );
    }

    // Determinar tipo de veículo
    const tipoVeiculo = veiculo_id ? 'frota' : 'particular';

    // Validações específicas por tipo
    if (tipoVeiculo === 'frota') {
      // Para veículos da frota, quilometragem é obrigatória
      if (!quilometragem || quilometragem < 0) {
        return NextResponse.json(
          { error: 'Quilometragem é obrigatória e deve ser válida para veículos da frota' },
          { status: 400 }
        );
      }

      // Buscar última quilometragem para validação
      const { data: ultimaMovimentacao } = await supabase
        .from('movimentacoes_veiculos')
        .select('quilometragem')
        .eq('veiculo_id', veiculo_id)
        .eq('tipo_veiculo', 'frota')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      // Validar se a quilometragem não é menor que a anterior
      if (ultimaMovimentacao && quilometragem < ultimaMovimentacao.quilometragem) {
        return NextResponse.json(
          { error: 'Quilometragem não pode ser menor que a anterior' },
          { status: 400 }
        );
      }
    } else {
      // Para carros particulares, quilometragem é opcional (pode ser 0)
      if (quilometragem && quilometragem < 0) {
        return NextResponse.json(
          { error: 'Quilometragem inválida' },
          { status: 400 }
        );
      }
    }

    // Para carros particulares, usar o funcionário proprietário como colaborador
    let colaboradorId = funcionario.id;
    
    if (tipoVeiculo === 'particular' && carro_particular_id) {
      // Buscar o funcionário proprietário do carro particular
      const { data: carroParticular } = await supabase
        .from('carros_particulares')
        .select('funcionario_id')
        .eq('id', carro_particular_id)
        .single();
      
      if (carroParticular) {
        colaboradorId = carroParticular.funcionario_id;
      }
    }

    // Registrar movimentação unificada
    const { data: movimentacao, error: movimentacaoError } = await supabase
      .from('movimentacoes_veiculos')
      .insert({
        veiculo_id: veiculo_id || null,
        carro_particular_id: carro_particular_id || null,
        tipo_veiculo: tipoVeiculo,
        colaborador_id: colaboradorId,
        tipo: acao,
        quilometragem: quilometragem || 0,
        data_movimentacao: new Date().toISOString(),
        observacoes: observacoes || '',
        base_id: base_id, // base_id é obrigatório e já foi validado acima
        contrato_id: contrato_id || null
      })
      .select(`
        *,
        veiculo:veiculos(id, placa, modelo, marca_equipamento),
        carro_particular:carros_particulares(
          *,
          funcionario:usuarios!carros_particulares_funcionario_id_fkey(id, nome, matricula)
        ),
        colaborador:usuarios!movimentacoes_veiculos_colaborador_id_fkey(id, nome, matricula)
      `)
      .single();

    if (movimentacaoError) {
      throw movimentacaoError;
    }

    // Atualizar status do veículo (apenas para frota)
    if (tipoVeiculo === 'frota') {
      const novoStatus = acao === 'saida' ? 'em_uso' : 'disponivel';
      
      // NOTA: O trigger 'trigger_calcular_proxima_preventiva' no banco de dados
      // automaticamente recalcula proxima_preventiva_km e alerta_preventiva_km
      // quando quilometragem_atual é atualizada
      const { error: veiculoError } = await supabase
        .from('veiculos')
        .update({ 
          status: novoStatus,
          quilometragem_atual: quilometragem,
          atualizado_em: new Date().toISOString()
        })
        .eq('id', veiculo_id);

      if (veiculoError) {
        // Reverter movimentação se falhar
        await supabase
          .from('movimentacoes_veiculos')
          .delete()
          .eq('id', movimentacao.id);
        
        throw veiculoError;
      }
    }

    return NextResponse.json({
      success: true,
      movimentacao,
      tipo_veiculo: tipoVeiculo
    });
  } catch (error) {
    console.error('Erro ao processar movimentação:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}