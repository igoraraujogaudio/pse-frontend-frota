// =============================
// API: BUSCA UNIFICADA DE VEÍCULOS POR QR CODE
// =============================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { carrosParticularesService } from '@/services/carrosParticularesService';

// GET: Buscar veículo por QR code (frota ou particular)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ qrData: string }> }
) {
  try {
    const { qrData: qrDataParam } = await params;
    const supabase = createClient();
    
    // Obter usuário logado
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const qrData = decodeURIComponent(qrDataParam);
    
    // Buscar veículo usando serviço unificado
    const resultado = await carrosParticularesService.buscarVeiculoPorQR(qrData);

    if (!resultado) {
      return NextResponse.json({ error: 'Veículo não encontrado' }, { status: 404 });
    }

    // Buscar alertas específicos baseado no tipo
    let alertas = resultado.alertas || [];

    if (resultado.veiculo.tipo === 'frota') {
      // Buscar alertas de veículos da frota (sistema existente)
      const { data: alertasFrota } = await supabase
        .from('documentos_veiculo')
        .select('tipo_documento, data_vencimento')
        .eq('veiculo_id', resultado.veiculo.id)
        .eq('ativo', true)
        .lt('data_vencimento', new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()); // 30 dias

      if (alertasFrota && alertasFrota.length > 0) {
        alertas = alertasFrota.map(doc => ({
          tipo: 'documento_vencendo',
          descricao: `${doc.tipo_documento} vencendo em ${new Date(doc.data_vencimento).toLocaleDateString()}`,
          nivel: 'warning' as const
        }));
      }
    } else if (resultado.veiculo.tipo === 'particular') {
      // Para carros particulares, verificar se funcionário está ativo
      const { data: funcionario } = await supabase
        .from('carros_particulares')
        .select(`
          funcionario:usuarios!carros_particulares_funcionario_id_fkey(status)
        `)
        .eq('id', resultado.veiculo.id)
        .single();

      if (funcionario?.funcionario && Array.isArray(funcionario.funcionario) && funcionario.funcionario[0]?.status !== 'ativo') {
        alertas.push({
          tipo: 'funcionario_inativo',
          descricao: 'Funcionário proprietário do veículo está inativo ou suspenso',
          nivel: 'error' as const
        });
      }
    }

    return NextResponse.json({
      veiculo: resultado.veiculo,
      alertas
    });
  } catch (error) {
    console.error('Erro ao buscar veículo por QR:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
