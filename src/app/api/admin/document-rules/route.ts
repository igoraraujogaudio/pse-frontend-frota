import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

interface DocumentRule {
  id?: string;
  tipo_veiculo?: string[]; // CORRIGIDO: agora é array para múltiplos tipos
  tipo_modelo?: string; // tipo modelo específico
  tipos_modelo?: string[]; // múltiplos tipos de modelo
  prefixo_placa?: string;
  prefixos_placa?: string[]; // múltiplos prefixos
  placa_especifica?: string;
  contrato_id?: string;
  documentos_obrigatorios: string[];
  documentos_opcionais: string[];
  descricao: string;
  ativa: boolean;
}

interface RuleReport {
  id: string;
  criterio: string;
  valor_criterio: string;
  documentos_obrigatorios: string[];
  documentos_opcionais: string[];
  total_veiculos_afetados: number;
  descricao: string;
}

// Tipos de documento válidos
const VALID_DOCUMENT_TYPES = [
  'crlv', 'tacografo', 'fumaca', 'eletrico', 'acustico', 'aet', 'apolice', 'contrato_seguro'
];

// Validar regra de documentação
function validateDocumentRule(rule: Partial<DocumentRule>): string[] {
  const errors: string[] = [];

  // Contrato é obrigatório
  if (!rule.contrato_id) {
    errors.push('Contrato é obrigatório para todas as regras');
  }

  // Validar prefixo de placa (deve ter 3 caracteres)
  if (rule.prefixo_placa && rule.prefixo_placa.length !== 3) {
    errors.push('Prefixo de placa deve ter exatamente 3 caracteres');
  }

  // Validar múltiplos prefixos de placa
  if (rule.prefixos_placa && rule.prefixos_placa.length > 0) {
    const invalidPrefixes = rule.prefixos_placa.filter(prefix => prefix.length !== 3);
    if (invalidPrefixes.length > 0) {
      errors.push(`Todos os prefixos de placa devem ter exatamente 3 caracteres: ${invalidPrefixes.join(', ')}`);
    }
  }

  // Validar placa específica (formato antigo ABC1234/ABC-1234 ou Mercosul ABC1D23)
  if (rule.placa_especifica) {
    const placaUpper = rule.placa_especifica.toUpperCase().replace(/-/g, '');
    const oldFormat = /^[A-Z]{3}\d{4}$/.test(placaUpper); // ABC1234
    const mercosulFormat = /^[A-Z]{3}\d[A-Z]\d{2}$/.test(placaUpper); // ABC1D23
    if (!oldFormat && !mercosulFormat) {
      errors.push('Placa específica deve estar no formato ABC1234, ABC-1234 ou ABC1D23 (Mercosul)');
    }
  }

  // Validar tipos de documento
  const allDocTypes = [...(rule.documentos_obrigatorios || []), ...(rule.documentos_opcionais || [])];
  const invalidTypes = allDocTypes.filter(type => !VALID_DOCUMENT_TYPES.includes(type));
  if (invalidTypes.length > 0) {
    errors.push(`Tipos de documento inválidos: ${invalidTypes.join(', ')}`);
  }

  // Verificar duplicatas entre obrigatórios e opcionais
  const obrigatorios = rule.documentos_obrigatorios || [];
  const opcionais = rule.documentos_opcionais || [];
  const duplicates = obrigatorios.filter(doc => opcionais.includes(doc));
  if (duplicates.length > 0) {
    errors.push(`Documentos não podem estar em ambas as listas: ${duplicates.join(', ')}`);
  }

  return errors;
}

// GET - Listar regras de documentação
export async function GET(request: NextRequest) {
  try {
    // Obter informações do usuário do header
    const userLevel = request.headers.get('x-user-level') || '';
    const userId = request.headers.get('x-user-id') || '';
    
    console.log('🔍 Filtro de regras - User ID:', userId, 'Level:', userLevel);
    
    // Se for admin/gestor global, mostrar todas as regras
    const isGlobalAdmin = ['admin', 'diretor', 'manager', 'gerente', 'fleet_manager', 'gestor_frota', 'gestor', 'administrador'].includes(userLevel.toLowerCase());
    
    let rules;
    let error;
    
    if (isGlobalAdmin) {
      console.log('🌐 Usuário admin - mostrando todas as regras');
      // ✅ CORREÇÃO: Buscar apenas regras que têm contrato_id (obrigatório)
      const { data: adminRules, error: adminRulesError } = await supabase
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
        .eq('ativa', true)
        .not('contrato_id', 'is', null) // ✅ CORREÇÃO: Apenas regras com contrato_id
        .order('criado_em', { ascending: false });
      
      if (adminRulesError) {
        console.error('❌ Erro ao buscar regras admin:', adminRulesError);
        return NextResponse.json(
          { error: 'Erro ao buscar regras' },
          { status: 500 }
        );
      }
      
      // Transformar dados para o formato esperado
      rules = adminRules?.map(rule => ({
        id: rule.id,
        criterio: rule.placa_especifica ? 'Placa Específica' :
                rule.prefixos_placa?.length ? 'Múltiplos Prefixos de Placa' :
                rule.prefixo_placa ? 'Prefixo de Placa' :
                rule.tipo_veiculo?.length ? 'Tipo de Veículo' : 'Contrato Específico',
        valor_criterio: rule.placa_especifica || 
                      (rule.prefixos_placa?.join(', ')) ||
                      rule.prefixo_placa ||
                      (rule.tipo_veiculo?.join(', ')) ||
                      (rule.contratos as unknown as { nome: string; codigo: string })?.nome || 'Contrato não encontrado',
        total_veiculos_afetados: 0, // TODO: Calcular veículos afetados
        documentos_obrigatorios: rule.documentos_obrigatorios || [],
        documentos_opcionais: rule.documentos_opcionais || [],
        descricao: rule.descricao,
        contrato_id: rule.contrato_id
      })) || [];
      
      error = null;
    } else if (userId) {
      console.log('🔒 Filtrando regras por usuário:', userId);
      
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
        return NextResponse.json({
          rules: []
        });
      }
      
      // ✅ CORREÇÃO: Buscar apenas regras que têm contrato_id (obrigatório)
      const { data: userRules, error: userRulesError } = await supabase
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
        .eq('ativa', true)
        .not('contrato_id', 'is', null) // ✅ CORREÇÃO: Apenas regras com contrato_id
        .in('contrato_id', userContractIds)
        .order('criado_em', { ascending: false });
      
      if (userRulesError) {
        console.error('❌ Erro ao buscar regras do usuário:', userRulesError);
        return NextResponse.json(
          { error: 'Erro ao buscar regras do usuário' },
          { status: 500 }
        );
      }
      
      // Transformar dados para o formato esperado
      rules = userRules?.map(rule => ({
        id: rule.id,
        criterio: 'Contrato Específico',
        valor_criterio: (rule.contratos as unknown as { nome: string; codigo: string })?.nome || 'Contrato não encontrado',
        total_veiculos_afetados: 0, // TODO: Calcular veículos afetados
        documentos_obrigatorios: rule.documentos_obrigatorios || [],
        documentos_opcionais: rule.documentos_opcionais || [],
        descricao: rule.descricao,
        contrato_id: rule.contrato_id
      })) || [];
      
      console.log('📋 Regras do usuário transformadas:', rules);
      
      error = null;
    } else {
      console.log('⚠️ Usuário não identificado');
      return NextResponse.json({
        rules: []
      });
    }

    if (error) {
      console.error('Erro ao buscar regras:', error);
      return NextResponse.json(
        { error: 'Erro ao buscar regras de documentação' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      rules: rules as RuleReport[]
    });

  } catch (error) {
    console.error('Erro na API document-rules GET:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// POST - Criar nova regra de documentação
export async function POST(request: NextRequest) {
  try {
    const rule: DocumentRule = await request.json();

    console.log('🔍 Criando regra:', {
      contrato_id: rule.contrato_id,
      placa_especifica: rule.placa_especifica,
      prefixo_placa: rule.prefixo_placa,
      prefixos_placa: rule.prefixos_placa,
      tipo_veiculo: rule.tipo_veiculo,
      documentos_obrigatorios: rule.documentos_obrigatorios
    });

    // ✅ CORREÇÃO: Contrato é SEMPRE obrigatório
    if (!rule.contrato_id) {
      return NextResponse.json(
        { error: 'Contrato é obrigatório. Toda regra deve ter um contrato específico.' },
        { status: 400 }
      );
    }

    // Validar regra
    const validationErrors = validateDocumentRule(rule);
    if (validationErrors.length > 0) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: validationErrors },
        { status: 400 }
      );
    }

    // Preparar dados para inserção
    const insertData = {
      tipo_veiculo: rule.tipo_veiculo || (rule.tipos_modelo?.length ? rule.tipos_modelo : null),
      prefixo_placa: rule.prefixo_placa || null,
      prefixos_placa: rule.prefixos_placa || null,
      placa_especifica: rule.placa_especifica?.trim() || null,
      contrato_id: rule.contrato_id,
      documentos_obrigatorios: rule.documentos_obrigatorios,
      documentos_opcionais: rule.documentos_opcionais,
      descricao: rule.descricao,
      ativa: rule.ativa
    };

    console.log('📝 Dados preparados para inserção:', JSON.stringify(insertData, null, 2));

    // Inserir regra no banco
    const { data, error } = await supabase
      .from('regras_documentacao_veiculo')
      .insert(insertData)
      .select()
      .single();

    console.log('📊 Resultado da inserção:', {
      success: !error,
      data: data,
      error: error ? JSON.stringify(error, null, 2) : null
    });

    if (error) {
      console.error('❌ Erro detalhado ao criar regra:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      });
      return NextResponse.json(
        { 
          error: 'Erro ao criar regra de documentação',
          details: error.message,
          hint: error.hint,
          code: error.code
        },
        { status: 500 }
      );
    }

    if (!data) {
      console.error('⚠️ Insert bem-sucedido mas sem dados retornados');
      return NextResponse.json(
        { error: 'Regra não foi criada no banco de dados. Verifique permissões RLS.' },
        { status: 500 }
      );
    }

    console.log('✅ Regra criada com sucesso:', data.id);

    return NextResponse.json({
      message: 'Regra criada com sucesso',
      rule: data
    });

  } catch (error) {
    console.error('Erro na API document-rules POST:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// PUT - Atualizar regra existente
export async function PUT(request: NextRequest) {
  try {
    const rule: DocumentRule & { id: string } = await request.json();

    if (!rule.id) {
      return NextResponse.json(
        { error: 'ID da regra é obrigatório' },
        { status: 400 }
      );
    }

    // Validar regra
    const validationErrors = validateDocumentRule(rule);
    if (validationErrors.length > 0) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: validationErrors },
        { status: 400 }
      );
    }

    // Atualizar regra no banco
    const { data, error } = await supabase
      .from('regras_documentacao_veiculo')
      .update({
        tipo_veiculo: rule.tipo_veiculo || (rule.tipos_modelo?.length ? rule.tipos_modelo : null), // CORRIGIDO: usar array diretamente
        prefixo_placa: rule.prefixo_placa || null,
        prefixos_placa: rule.prefixos_placa || null,
        placa_especifica: rule.placa_especifica || null,
        contrato_id: rule.contrato_id,
        documentos_obrigatorios: rule.documentos_obrigatorios,
        documentos_opcionais: rule.documentos_opcionais,
        descricao: rule.descricao,
        ativa: rule.ativa
      })
      .eq('id', rule.id)
      .select()
      .single();

    if (error) {
      console.error('Erro ao atualizar regra:', error);
      return NextResponse.json(
        { error: 'Erro ao atualizar regra de documentação' },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { error: 'Regra não encontrada' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      message: 'Regra atualizada com sucesso',
      rule: data
    });

  } catch (error) {
    console.error('Erro na API document-rules PUT:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// DELETE - Remover regra
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'ID da regra é obrigatório' },
        { status: 400 }
      );
    }

    // Remover regra do banco
    const { error } = await supabase
      .from('regras_documentacao_veiculo')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Erro ao remover regra:', error);
      return NextResponse.json(
        { error: 'Erro ao remover regra de documentação' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: 'Regra removida com sucesso'
    });

  } catch (error) {
    console.error('Erro na API document-rules DELETE:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
