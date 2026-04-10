import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// GET - Debug das regras para um veículo específico
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const placa = searchParams.get('placa');

    if (!placa) {
      return NextResponse.json({ error: 'Placa é obrigatória' }, { status: 400 });
    }

    // Buscar veículo
    const { data: veiculo, error: veiculoError } = await supabase
      .from('veiculos')
      .select(`
        id,
        placa,
        tipo_veiculo,
        contrato_id,
        contrato:contratos(id, nome, codigo)
      `)
      .eq('placa', placa.toUpperCase())
      .single();

    if (veiculoError || !veiculo) {
      return NextResponse.json({ error: 'Veículo não encontrado' }, { status: 404 });
    }

    const prefixo_placa = placa.substring(0, 3);

    // Buscar todas as regras que poderiam se aplicar
    const { data: regrasMúltiplosPrefixos } = await supabase
      .from('regras_documentacao_veiculo')
      .select('*')
      .not('prefixos_placa', 'is', null)
      .eq('ativa', true)
      .order('criado_em', { ascending: false });

    const { data: regrasTipoVeiculo } = await supabase
      .from('regras_documentacao_veiculo')
      .select('*')
      .not('tipo_veiculo', 'is', null)
      .eq('ativa', true)
      .order('criado_em', { ascending: false });

    const { data: regrasContrato } = await supabase
      .from('regras_documentacao_veiculo')
      .select('*')
      .not('contrato_id', 'is', null)
      .eq('ativa', true)
      .order('criado_em', { ascending: false });

    // Testar a função atual
    const { data: regraAplicada, error: regraError } = await supabase
      .rpc('obter_documentos_obrigatorios_veiculo', {
        p_veiculo_id: veiculo.id
      });

    return NextResponse.json({
      veiculo: {
        ...veiculo,
        prefixo_placa
      },
      regra_aplicada: regraAplicada?.[0] || null,
      regra_error: regraError,
      regras_multiplos_prefixos: regrasMúltiplosPrefixos || [],
      regras_tipo_veiculo: regrasTipoVeiculo || [],
      regras_contrato: regrasContrato || []
    });

  } catch (error) {
    console.error('Erro na API debug rules:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
