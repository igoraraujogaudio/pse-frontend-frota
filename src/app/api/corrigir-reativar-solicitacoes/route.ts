import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST() {
  try {
    const migrationSQL = `
-- ============================================================================
-- CORREÇÃO SIMPLES: Função reativar_solicitacoes_com_estoque
-- Problema: Estava mudando status para 'aprovada' quando deveria mudar para 'pendente'
-- ============================================================================

-- 1. Remover função atual
DROP FUNCTION IF EXISTS reativar_solicitacoes_com_estoque();

-- 2. Criar função corrigida (versão simples)
CREATE OR REPLACE FUNCTION reativar_solicitacoes_com_estoque()
RETURNS INTEGER AS $$
DECLARE
    solicitacao_record RECORD;
    solicitacoes_reativadas INTEGER := 0;
BEGIN
    -- Buscar e reativar solicitações aguardando estoque
    FOR solicitacao_record IN 
        SELECT 
            si.id,
            si.quantidade_aprovada,
            ie.nome as item_nome,
            ie.estoque_atual
        FROM solicitacoes_itens si
        JOIN itens_estoque ie ON ie.id = si.item_id
        WHERE si.status = 'aguardando_estoque'
          AND si.quantidade_aprovada IS NOT NULL
          AND ie.estoque_atual >= si.quantidade_aprovada
        ORDER BY si.criado_em ASC
    LOOP
        -- CORREÇÃO: Mudar para 'pendente' em vez de 'aprovada'
        UPDATE solicitacoes_itens 
        SET 
            status = 'pendente',  -- ✅ CORRIGIDO
            atualizado_em = NOW(),
            observacoes = COALESCE(observacoes || ' | ', '') || 
                         format('Reativada automaticamente - Estoque disponível: %s (Necessário: %s)', 
                               solicitacao_record.estoque_atual, solicitacao_record.quantidade_aprovada)
        WHERE id = solicitacao_record.id;
        
        solicitacoes_reativadas := solicitacoes_reativadas + 1;
        
        RAISE NOTICE '✅ Solicitação % reativada como PENDENTE: % (estoque: %, necessário: %)', 
            solicitacoes_reativadas, solicitacao_record.item_nome, 
            solicitacao_record.estoque_atual, solicitacao_record.quantidade_aprovada;
    END LOOP;
    
    IF solicitacoes_reativadas = 0 THEN
        RAISE NOTICE 'ℹ️ Nenhuma solicitação pode ser reativada no momento';
    ELSE
        RAISE NOTICE '🎉 Total de % solicitações reativadas como PENDENTES para dupla aprovação', solicitacoes_reativadas;
    END IF;
    
    RETURN solicitacoes_reativadas;
END;
$$ LANGUAGE plpgsql;

-- 3. Comentário
COMMENT ON FUNCTION reativar_solicitacoes_com_estoque() IS 'Reativa solicitações aguardando estoque mudando status para PENDENTE (não aprovada) para dupla aprovação';

-- 4. Corrigir solicitações que foram reativadas incorretamente como 'aprovada'
UPDATE solicitacoes_itens 
SET 
    status = 'pendente',
    atualizado_em = NOW(),
    observacoes = COALESCE(observacoes || ' | ', '') || 'CORRIGIDO: Status alterado de aprovada para pendente para dupla aprovação'
WHERE status = 'aprovada' 
  AND dupla_aprovacao_completa = false
  AND (observacoes LIKE '%Reativada automaticamente%' OR observacoes LIKE '%Reativada%');

-- 5. Teste da função
SELECT reativar_solicitacoes_com_estoque() as solicitacoes_reativadas;

-- 6. Verificar resultado
SELECT 
    'APÓS CORREÇÃO' as categoria,
    COUNT(*) as total_solicitacoes,
    COUNT(CASE WHEN status = 'pendente' THEN 1 END) as pendentes,
    COUNT(CASE WHEN status = 'aprovada' AND dupla_aprovacao_completa = true THEN 1 END) as aprovadas_com_dupla_aprovacao,
    COUNT(CASE WHEN status = 'aguardando_estoque' THEN 1 END) as aguardando_estoque
FROM solicitacoes_itens;
    `;

    console.log('🚀 Executando correção da função reativar_solicitacoes_com_estoque...');

    const { data, error } = await supabase.rpc('exec_sql', { sql: migrationSQL });

    if (error) {
      console.error('Erro ao executar correção:', error);
      return NextResponse.json(
        { 
          error: 'Erro ao corrigir função reativar_solicitacoes_com_estoque',
          details: error
        },
        { status: 500 }
      );
    }

    console.log('✅ Correção executada com sucesso!');

    return NextResponse.json({
      success: true,
      message: 'Função reativar_solicitacoes_com_estoque corrigida com sucesso!',
      data
    });

  } catch (error) {
    console.error('Erro na API corrigir-reativar-solicitacoes:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}




