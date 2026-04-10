import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// GET - Buscar detalhes de uma regra específica
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: ruleId } = await params;
    
    if (!ruleId) {
      return NextResponse.json(
        { error: 'ID da regra é obrigatório' },
        { status: 400 }
      );
    }

    // Obter informações do usuário do header
    const userLevel = request.headers.get('x-user-level') || '';
    const userId = request.headers.get('x-user-id') || '';
    
    console.log('🔍 Buscando detalhes da regra:', ruleId, 'User ID:', userId, 'Level:', userLevel);
    
    // Se for admin/gestor global, buscar qualquer regra
    const isGlobalAdmin = ['admin', 'diretor', 'manager', 'gerente', 'fleet_manager', 'gestor_frota', 'gestor', 'administrador'].includes(userLevel.toLowerCase());
    
    let ruleQuery = supabase
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
        atualizado_em,
        contratos(nome, codigo)
      `)
      .eq('id', ruleId)
      .eq('ativa', true);
    
    // Se não for admin global, filtrar apenas regras dos contratos do usuário
    if (!isGlobalAdmin && userId) {
      console.log('🔒 Filtrando regra por usuário:', userId);
      
      // Buscar contratos do usuário
      const { data: userContracts, error: userContractsError } = await supabase
        .from('usuario_contratos')
        .select('contrato_id')
        .eq('usuario_id', userId)
        .eq('ativo', true);
      
      if (userContractsError) {
        console.error('❌ Erro ao buscar contratos do usuário:', userContractsError);
        return NextResponse.json(
          { error: 'Erro ao buscar contratos do usuário' },
          { status: 500 }
        );
      }
      
      const userContractIds = userContracts?.map(uc => uc.contrato_id) || [];
      console.log('📋 Contratos do usuário:', userContractIds);
      
      if (userContractIds.length === 0) {
        console.log('⚠️ Usuário não tem acesso a nenhum contrato');
        return NextResponse.json(
          { error: 'Usuário não tem acesso a nenhum contrato' },
          { status: 403 }
        );
      }
      
      // Filtrar regra apenas se pertencer aos contratos do usuário
      ruleQuery = ruleQuery.in('contrato_id', userContractIds);
    }
    
    // Executar query
    const { data: rule, error } = await ruleQuery.single();
    
    if (error) {
      console.error('❌ Erro ao buscar regra:', error);
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Regra não encontrada ou sem acesso' },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { error: 'Erro ao buscar regra' },
        { status: 500 }
      );
    }
    
    console.log('✅ Regra encontrada:', rule);
    
    return NextResponse.json({
      rule: {
        id: rule.id,
        tipo_veiculo: rule.tipo_veiculo,
        prefixo_placa: rule.prefixo_placa,
        prefixos_placa: rule.prefixos_placa,
        placa_especifica: rule.placa_especifica,
        contrato_id: rule.contrato_id,
        documentos_obrigatorios: rule.documentos_obrigatorios || [],
        documentos_opcionais: rule.documentos_opcionais || [],
        descricao: rule.descricao,
        ativa: rule.ativa,
        criado_em: rule.criado_em,
        atualizado_em: rule.atualizado_em,
        contrato: rule.contratos
      }
    });

  } catch (error) {
    console.error('❌ Erro na API document-rules GET by ID:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}



