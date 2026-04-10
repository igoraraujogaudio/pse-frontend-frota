import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// GET - Buscar regras aplicadas a um veículo por placa
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const placa = searchParams.get('placa');

    if (!placa) {
      return NextResponse.json(
        { error: 'Placa é obrigatória' },
        { status: 400 }
      );
    }

    // Usar o cliente Supabase configurado
    
    // Verificar autenticação (opcional para esta funcionalidade)
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) {
        console.warn('Aviso: Erro de autenticação:', authError);
      }
      if (!user) {
        console.warn('Aviso: Usuário não autenticado, mas continuando...');
      }
    } catch (error) {
      console.warn('Aviso: Erro ao verificar autenticação:', error);
    }

    // Buscar veículo por placa
    const { data: veiculos, error: veiculoError } = await supabase
      .from('veiculos')
      .select(`
        id,
        placa,
        tipo_veiculo,
        contrato_id,
        contrato:contratos(id, nome, codigo)
      `)
      .eq('placa', placa.toUpperCase());

    if (veiculoError) {
      console.error('Erro ao buscar veículo:', veiculoError);
      return NextResponse.json(
        { error: `Erro ao buscar veículo: ${veiculoError.message}` },
        { status: 500 }
      );
    }

    if (!veiculos || veiculos.length === 0) {
      return NextResponse.json(
        { error: 'Veículo não encontrado' },
        { status: 404 }
      );
    }

    if (veiculos.length > 1) {
      return NextResponse.json(
        { error: `Múltiplos veículos encontrados com a placa ${placa.toUpperCase()}` },
        { status: 400 }
      );
    }

    const veiculo = veiculos[0];

    // Buscar regras aplicadas usando a função do banco
    let regrasAplicadas = null;
    let regrasError = null;
    
    try {
      const result = await supabase
        .rpc('obter_documentos_obrigatorios_veiculo', {
          p_veiculo_id: veiculo.id
        });
      
      regrasAplicadas = result.data;
      regrasError = result.error;
    } catch (error) {
      console.error('Erro ao executar função RPC:', error);
      regrasError = error;
    }

    if (regrasError) {
      console.error('Erro ao buscar regras:', regrasError);
      // Continuar sem as regras aplicadas se a função RPC falhar
      regrasAplicadas = null;
    }

    // Buscar todas as regras que poderiam se aplicar a este veículo (para mostrar contexto)
    const prefixo_placa = placa.substring(0, 3);
    
    let regrasCandidatas: unknown[] = [];
    let candidatasError = null;
    
    try {
      const result = await supabase
        .from('regras_documentacao_veiculo')
        .select(`
          id,
          tipo_veiculo,
          prefixo_placa,
          prefixos_placa,
          placa_especifica,
          contrato_id,
          documentos_obrigatorios,
          documentos_opcionais,
          descricao,
          ativa,
          criado_em,
          contrato:contratos(id, nome, codigo)
        `)
        .or(`
          placa_especifica.eq.${placa},
          prefixo_placa.eq.${prefixo_placa},
          tipo_veiculo.eq.${veiculo.tipo_veiculo},
          contrato_id.eq.${veiculo.contrato_id || 'null'}
        `)
        .eq('ativa', true)
        .order('criado_em', { ascending: false });

      regrasCandidatas = result.data || [];
      candidatasError = result.error;
    } catch (error) {
      console.error('Erro ao buscar regras candidatas:', error);
      candidatasError = error;
    }

    if (candidatasError) {
      console.error('Erro ao buscar regras candidatas:', candidatasError);
    }

    // Buscar documentos existentes do veículo
    let documentosExistentes: unknown[] = [];
    let docsError = null;
    
    try {
      const result = await supabase
        .from('documentos_veiculo')
        .select(`
          tipo_documento,
          numero_documento,
          data_emissao,
          data_vencimento,
          ativo
        `)
        .eq('veiculo_id', veiculo.id)
        .eq('ativo', true);

      documentosExistentes = result.data || [];
      docsError = result.error;
    } catch (error) {
      console.error('Erro ao buscar documentos existentes:', error);
      docsError = error;
    }

    if (docsError) {
      console.error('Erro ao buscar documentos existentes:', docsError);
    }

    return NextResponse.json({
      veiculo: {
        id: veiculo.id,
        placa: veiculo.placa,
        tipo_veiculo: veiculo.tipo_veiculo,
        contrato: veiculo.contrato
      },
      regra_aplicada: regrasAplicadas?.[0] || null,
      regras_candidatas: regrasCandidatas,
      documentos_existentes: documentosExistentes
    });

  } catch (error) {
    console.error('Erro na API search-rules:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
