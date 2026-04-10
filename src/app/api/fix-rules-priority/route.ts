import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST() {
  try {
    const migrationSQL = `
-- Correção da ordem de prioridade das regras
-- Múltiplos prefixos devem ter prioridade sobre contrato

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
    -- Buscar informações do veículo incluindo contrato_id
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
    
    -- NOVA ORDEM DE PRIORIDADE:
    -- 1. Placa específica (maior prioridade)
    -- 2. Múltiplos prefixos de placa (MOVIDO PARA CIMA)
    -- 3. Tipo de veículo
    -- 4. Contrato específico (MOVIDO PARA BAIXO)
    -- 5. Prefixo único de placa (menor prioridade)
    
    -- Prioridade 1: Placa específica
    SELECT * INTO regra
    FROM public.regras_documentacao_veiculo
    WHERE placa_especifica = v_placa AND ativa = true
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
    
    -- Prioridade 2: Múltiplos prefixos de placa (NOVA POSIÇÃO)
    SELECT * INTO regra
    FROM public.regras_documentacao_veiculo
    WHERE prefixos_placa IS NOT NULL 
    AND v_prefixo_placa = ANY(prefixos_placa) 
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
    
    -- Prioridade 3: Tipo de veículo
    SELECT * INTO regra
    FROM public.regras_documentacao_veiculo
    WHERE tipo_veiculo = v_tipo_veiculo AND ativa = true
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
    
    -- Prioridade 4: Contrato específico (NOVA POSIÇÃO - DEPOIS DOS PREFIXOS)
    IF v_contrato_id IS NOT NULL THEN
        SELECT * INTO regra
        FROM public.regras_documentacao_veiculo
        WHERE contrato_id = v_contrato_id AND ativa = true
        ORDER BY criado_em DESC
        LIMIT 1;
        
        IF FOUND THEN
            RETURN QUERY SELECT 
                regra.documentos_obrigatorios,
                regra.documentos_opcionais,
                'Contrato Específico'::TEXT,
                regra.descricao;
            RETURN;
        END IF;
    END IF;
    
    -- Prioridade 5: Prefixo único de placa
    SELECT * INTO regra
    FROM public.regras_documentacao_veiculo
    WHERE prefixo_placa = v_prefixo_placa AND ativa = true
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

    console.log('🚀 Executando correção de prioridade das regras...');
    
    const { error } = await supabase.rpc('exec_sql', { sql: migrationSQL });

    if (error) {
      console.error('❌ Erro ao executar migração:', error);
      return NextResponse.json(
        { error: 'Erro ao corrigir prioridade das regras', details: error },
        { status: 500 }
      );
    }

    console.log('✅ Correção de prioridade aplicada com sucesso');

    return NextResponse.json({ 
      message: 'Prioridade das regras corrigida com sucesso' 
    });

  } catch (error) {
    console.error('Erro na correção:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor', details: error },
      { status: 500 }
    );
  }
}
