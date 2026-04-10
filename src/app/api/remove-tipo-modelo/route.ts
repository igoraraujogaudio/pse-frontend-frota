import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST() {
  try {
    const migrationSQL = `
-- ============================================================================
-- REMOÇÃO FINAL DO TIPO_MODELO - DADOS JÁ MIGRADOS PARA TIPO_VEICULO
-- ============================================================================
-- Objetivo: Remover duplicação de preços causada pelo tipo_modelo
-- Dados já foram copiados de tipo_modelo para tipo_veiculo

-- 1. MANTER COLUNAS NO BANCO - APENAS ATUALIZAR FUNÇÃO
-- As colunas tipo_modelo ficam no banco, mas não são usadas na lógica

-- 2. ATUALIZAR FUNÇÃO PARA NÃO USAR TIPO_MODELO
DROP FUNCTION IF EXISTS obter_documentos_obrigatorios_veiculo(UUID);

CREATE FUNCTION obter_documentos_obrigatorios_veiculo(
    p_veiculo_id UUID
) RETURNS TABLE (
    documentos_obrigatorios TEXT[],
    documentos_opcionais TEXT[],
    origem TEXT,
    descricao TEXT
) LANGUAGE plpgsql AS $$
DECLARE
    v_tipo_veiculo TEXT;
    v_prefixo_placa TEXT;
    v_placa TEXT;
    v_contrato_id UUID;
    regra RECORD;
BEGIN
    -- Buscar informações do veículo (SEM tipo_modelo)
    SELECT 
        v.tipo_veiculo, 
        LEFT(v.placa, 3), 
        v.placa,
        v.contrato_id
    INTO v_tipo_veiculo, v_prefixo_placa, v_placa, v_contrato_id
    FROM public.veiculos v 
    WHERE v.id = p_veiculo_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Veículo não encontrado: %', p_veiculo_id;
    END IF;
    
    -- ORDEM DE PRIORIDADE (SEM TIPO_MODELO):
    -- 1. Placa específica (maior prioridade)
    -- 2. Múltiplos prefixos de placa
    -- 3. Tipo de veículo (ÚNICO CAMPO)
    -- 4. Prefixo único de placa (menor prioridade)
    -- 
    -- TODAS DEVEM FILTRAR POR contrato_id (filtro obrigatório - mesmo contrato do veículo)
    
    -- Prioridade 1: Placa específica + Contrato (filtro obrigatório)
    SELECT * INTO regra
    FROM public.regras_documentacao_veiculo
    WHERE placa_especifica = v_placa 
    AND contrato_id = v_contrato_id  -- ✅ FILTRO OBRIGATÓRIO: mesmo contrato do veículo
    AND ativa = true
    ORDER BY criado_em DESC
    LIMIT 1;
    
    IF FOUND THEN
        RETURN QUERY SELECT 
            regra.documentos_obrigatorios,
            regra.documentos_opcionais,
            'Placa Específica'::TEXT,
            regra.descricao;
        RETURN;
    END IF;
    
    -- Prioridade 2: Múltiplos prefixos de placa + Contrato (filtro obrigatório)
    SELECT * INTO regra
    FROM public.regras_documentacao_veiculo
    WHERE prefixos_placa IS NOT NULL 
    AND v_prefixo_placa = ANY(prefixos_placa) 
    AND contrato_id = v_contrato_id  -- ✅ FILTRO OBRIGATÓRIO: mesmo contrato do veículo
    AND ativa = true
    ORDER BY criado_em DESC
    LIMIT 1;
    
    IF FOUND THEN
        RETURN QUERY SELECT 
            regra.documentos_obrigatorios,
            regra.documentos_opcionais,
            'Múltiplos Prefixos de Placa'::TEXT,
            regra.descricao;
        RETURN;
    END IF;
    
    -- Prioridade 3: Tipo de veículo + Contrato (filtro obrigatório) - ÚNICO CAMPO
    SELECT * INTO regra
    FROM public.regras_documentacao_veiculo
    WHERE tipo_veiculo IS NOT NULL 
    AND v_tipo_veiculo = ANY(tipo_veiculo) 
    AND contrato_id = v_contrato_id  -- ✅ FILTRO OBRIGATÓRIO: mesmo contrato do veículo
    AND ativa = true
    ORDER BY criado_em DESC
    LIMIT 1;
    
    IF FOUND THEN
        RETURN QUERY SELECT 
            regra.documentos_obrigatorios,
            regra.documentos_opcionais,
            'Tipo de Veículo'::TEXT,
            regra.descricao;
        RETURN;
    END IF;
    
    -- Prioridade 4: Prefixo único de placa + Contrato (filtro obrigatório)
    SELECT * INTO regra
    FROM public.regras_documentacao_veiculo
    WHERE prefixo_placa = v_prefixo_placa 
    AND contrato_id = v_contrato_id  -- ✅ FILTRO OBRIGATÓRIO: mesmo contrato do veículo
    AND ativa = true
    ORDER BY criado_em DESC
    LIMIT 1;
    
    IF FOUND THEN
        RETURN QUERY SELECT 
            regra.documentos_obrigatorios,
            regra.documentos_opcionais,
            'Prefixo de Placa'::TEXT,
            regra.descricao;
        RETURN;
    END IF;
    
    -- Se nenhuma regra foi encontrada, retornar documentos padrão
    RETURN QUERY SELECT 
        ARRAY['crlv', 'tacografo', 'fumaca', 'eletrico', 'acustico', 'aet']::TEXT[],
        ARRAY['apolice', 'contrato_seguro']::TEXT[],
        'Padrão do Sistema'::TEXT,
        'Documentos padrão para todos os veículos'::TEXT;
END;
$$;
    `;

    console.log('🚀 Atualizando função para não usar tipo_modelo...');

    const { error } = await supabase.rpc('exec_sql', { sql: migrationSQL });

    if (error) {
      console.error('❌ Erro ao remover tipo_modelo:', error);
      return NextResponse.json(
        { 
          success: false, 
          error: 'Erro ao atualizar função',
          details: error.message 
        },
        { status: 500 }
      );
    }

    console.log('✅ Função atualizada com sucesso!');

    // Testar a correção com o veículo PJO5B06
    try {
      const { data: veiculo } = await supabase
        .from('veiculos')
        .select('id')
        .eq('placa', 'PJO5B06')
        .single();

      if (veiculo) {
        const { data: resultado } = await supabase
          .rpc('obter_documentos_obrigatorios_veiculo', {
            p_veiculo_id: veiculo.id
          });

        console.log('🧪 Teste PJO5B06:', resultado?.[0]);

        return NextResponse.json({
          success: true,
          message: 'Função atualizada com sucesso! Sistema agora usa apenas tipo_veiculo na lógica.',
          teste: {
            veiculo: 'PJO5B06',
            resultado: resultado?.[0]
          }
        });
      }
    } catch (testError) {
      console.warn('⚠️ Erro no teste:', testError);
    }

    return NextResponse.json({
      success: true,
      message: 'Função atualizada com sucesso! Sistema agora usa apenas tipo_veiculo na lógica.'
    });

  } catch (error) {
    console.error('❌ Erro na remoção:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Erro interno do servidor',
        details: error instanceof Error ? error.message : 'Erro desconhecido'
      },
      { status: 500 }
    );
  }
}
