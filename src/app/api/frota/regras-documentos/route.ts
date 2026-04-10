import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

interface DocumentRule {
  id?: string;
  tipo_veiculo?: string[];
  prefixo_placa?: string;
  prefixos_placa?: string[];
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
  contrato_id?: string;
}

// Função para validar regra de documentação
function validateDocumentRule(rule: DocumentRule): string[] {
  const errors: string[] = [];

  if (!rule.documentos_obrigatorios || rule.documentos_obrigatorios.length === 0) {
    errors.push('Pelo menos um documento obrigatório deve ser especificado');
  }

  if (!rule.descricao || rule.descricao.trim().length === 0) {
    errors.push('Descrição é obrigatória');
  }

  // Verificar se pelo menos um critério foi especificado
  const hasCriteria = 
    (rule.tipo_veiculo && rule.tipo_veiculo.length > 0) ||
    rule.prefixo_placa ||
    (rule.prefixos_placa && rule.prefixos_placa.length > 0) ||
    rule.placa_especifica ||
    rule.contrato_id;

  if (!hasCriteria) {
    errors.push('Pelo menos um critério deve ser especificado (tipo de veículo, prefixo, placa específica ou contrato)');
  }

  return errors;
}

// GET - Listar regras de documentação com relatório
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const includeReport = searchParams.get('report') === 'true';

    if (includeReport) {
      // Buscar regras com relatório de veículos afetados
      const { data: rules, error } = await supabase
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
          criado_em
        `)
        .eq('ativa', true)
        .order('criado_em', { ascending: false });

      if (error) {
        console.error('Erro ao buscar regras:', error);
        return NextResponse.json(
          { error: 'Erro ao buscar regras de documentação' },
          { status: 500 }
        );
      }

      // Gerar relatório para cada regra
      const rulesWithReport: RuleReport[] = await Promise.all(
        (rules || []).map(async (rule) => {
          console.log('🔍 Processando regra:', {
            id: rule.id,
            placa_especifica: rule.placa_especifica,
            prefixos_placa: rule.prefixos_placa,
            tipo_veiculo: rule.tipo_veiculo,
            prefixo_placa: rule.prefixo_placa,
            contrato_id: rule.contrato_id
          });
          
          let criterio = '';
          let valor_criterio = '';
          let total_veiculos_afetados = 0;

          // Determinar critério e contar veículos afetados
          if (rule.placa_especifica) {
            criterio = 'Placa Específica';
            valor_criterio = rule.placa_especifica;
            
            const { count } = await supabase
              .from('veiculos')
              .select('*', { count: 'exact', head: true })
              .eq('placa', rule.placa_especifica)
              .not('status', 'in', '(devolvido,desmobilizado)');
            total_veiculos_afetados = Number(count) || 0;
            console.log(`🔍 Placa específica ${rule.placa_especifica}: ${total_veiculos_afetados} veículos`);
          } 
          else if (rule.prefixos_placa && rule.prefixos_placa.length > 0) {
            criterio = 'Múltiplos Prefixos';
            valor_criterio = rule.prefixos_placa.join(', ');
            
            const { count } = await supabase
              .from('veiculos')
              .select('*', { count: 'exact', head: true })
              .or(rule.prefixos_placa.map((prefix: string) => `placa.ilike.${prefix}%`).join(','))
              .not('status', 'in', '(devolvido,desmobilizado)');
            total_veiculos_afetados = Number(count) || 0;
            console.log(`🔍 Múltiplos prefixos ${rule.prefixos_placa.join(', ')}: ${total_veiculos_afetados} veículos`);
          }
          else if (rule.tipo_veiculo && rule.tipo_veiculo.length > 0) {
            criterio = 'Tipo de Veículo';
            valor_criterio = rule.tipo_veiculo.join(', ');
            
            const { count } = await supabase
              .from('veiculos')
              .select('*', { count: 'exact', head: true })
              .in('tipo_veiculo', rule.tipo_veiculo)
              .not('status', 'in', '(devolvido,desmobilizado)');
            total_veiculos_afetados = Number(count) || 0;
            console.log(`🔍 Tipo de veículo ${rule.tipo_veiculo.join(', ')}: ${total_veiculos_afetados} veículos`);
          }
          else if (rule.prefixo_placa) {
            criterio = 'Prefixo de Placa';
            valor_criterio = rule.prefixo_placa;
            
            const { count } = await supabase
              .from('veiculos')
              .select('*', { count: 'exact', head: true })
              .ilike('placa', `${rule.prefixo_placa}%`)
              .not('status', 'in', '(devolvido,desmobilizado)');
            total_veiculos_afetados = Number(count) || 0;
            console.log(`🔍 Prefixo ${rule.prefixo_placa}: ${total_veiculos_afetados} veículos`);
          }
          
          // Se nenhum critério foi detectado, verificar se é uma regra inválida
          if (!criterio) {
            if (rule.contrato_id && !rule.placa_especifica && !rule.prefixos_placa && !rule.tipo_veiculo && !rule.prefixo_placa) {
              criterio = 'Regra Inválida';
              valor_criterio = 'Apenas contrato especificado - precisa de outro critério';
              total_veiculos_afetados = 0;
              console.log(`❌ Regra inválida: apenas contrato especificado`);
            } else {
              criterio = 'Critério Indefinido';
              valor_criterio = 'Critério não identificado';
              total_veiculos_afetados = 0;
              console.log(`❓ Critério indefinido para regra:`, rule);
            }
          }

          return {
            id: rule.id,
            criterio,
            valor_criterio,
            documentos_obrigatorios: rule.documentos_obrigatorios || [],
            documentos_opcionais: rule.documentos_opcionais || [],
            total_veiculos_afetados,
            descricao: rule.descricao,
            contrato_id: rule.contrato_id
          };
        })
      );

      return NextResponse.json({
        rules: rulesWithReport,
        total: rulesWithReport.length
      });
    } else {
      // Buscar apenas as regras
      const { data: rules, error } = await supabase
        .from('regras_documentacao_veiculo')
        .select('*')
        .eq('ativa', true)
        .order('criado_em', { ascending: false });

      if (error) {
        console.error('Erro ao buscar regras:', error);
        return NextResponse.json(
          { error: 'Erro ao buscar regras de documentação' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        rules: rules || [],
        total: (rules || []).length
      });
    }

  } catch (error) {
    console.error('Erro na API regras-documentos GET:', error);
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

    // Validar regra
    const validationErrors = validateDocumentRule(rule);
    if (validationErrors.length > 0) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: validationErrors },
        { status: 400 }
      );
    }

    // Inserir regra no banco
    const { data, error } = await supabase
      .from('regras_documentacao_veiculo')
      .insert({
        tipo_veiculo: rule.tipo_veiculo || null,
        prefixo_placa: rule.prefixo_placa || null,
        prefixos_placa: rule.prefixos_placa || null,
        placa_especifica: rule.placa_especifica || null,
        contrato_id: rule.contrato_id || null,
        documentos_obrigatorios: rule.documentos_obrigatorios,
        documentos_opcionais: rule.documentos_opcionais,
        descricao: rule.descricao,
        ativa: rule.ativa
      })
      .select()
      .single();

    if (error) {
      console.error('Erro ao criar regra:', error);
      return NextResponse.json(
        { error: 'Erro ao criar regra de documentação' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: 'Regra criada com sucesso',
      rule: data
    });

  } catch (error) {
    console.error('Erro na API regras-documentos POST:', error);
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
        tipo_veiculo: rule.tipo_veiculo || null,
        prefixo_placa: rule.prefixo_placa || null,
        prefixos_placa: rule.prefixos_placa || null,
        placa_especifica: rule.placa_especifica || null,
        contrato_id: rule.contrato_id || null,
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
    console.error('Erro na API regras-documentos PUT:', error);
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
    const ruleId = searchParams.get('id');

    if (!ruleId) {
      return NextResponse.json(
        { error: 'ID da regra é obrigatório' },
        { status: 400 }
      );
    }

    // Verificar se a regra existe
    const { data: existingRule, error: checkError } = await supabase
      .from('regras_documentacao_veiculo')
      .select('id')
      .eq('id', ruleId)
      .single();

    if (checkError || !existingRule) {
      return NextResponse.json(
        { error: 'Regra não encontrada' },
        { status: 404 }
      );
    }

    // Remover regra (soft delete - marcar como inativa)
    const { error } = await supabase
      .from('regras_documentacao_veiculo')
      .update({ ativa: false })
      .eq('id', ruleId);

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
    console.error('Erro na API regras-documentos DELETE:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}