import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import fs from 'fs';
import path from 'path';

export async function POST() {
  try {
    console.log('🚀 Iniciando migração de equipes para contratos...');
    
    // Ler o arquivo SQL de migração
    const migrationPath = path.join(process.cwd(), '../MIGRACAO_EQUIPES_CONTRATO.sql');
    
    let migrationSQL: string;
    try {
      migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    } catch (fileError) {
      console.error('❌ Erro ao ler arquivo de migração:', fileError);
      
      // Fallback: SQL incorporado
      migrationSQL = `
-- MIGRAÇÃO DE EQUIPES PARA SISTEMA DE CONTRATOS
DO $$
BEGIN
    -- Verificar se a coluna contrato_id já existe
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'equipes' AND column_name = 'contrato_id'
    ) THEN
        ALTER TABLE equipes ADD COLUMN contrato_id UUID;
        RAISE NOTICE 'Coluna contrato_id adicionada à tabela equipes';
    ELSE
        RAISE NOTICE 'Coluna contrato_id já existe na tabela equipes';
    END IF;
END $$;

-- Migrar dados: Associar equipes aos contratos baseado nos locais
UPDATE equipes 
SET contrato_id = (
    SELECT DISTINCT v.contrato_id 
    FROM veiculos v 
    WHERE v.base_id = equipes.base_id 
    AND v.contrato_id IS NOT NULL
    LIMIT 1
)
WHERE equipes.base_id IS NOT NULL 
AND equipes.contrato_id IS NULL;

-- Para equipes sem mapeamento, tentar pelos veículos alocados
UPDATE equipes 
SET contrato_id = (
    SELECT DISTINCT v.contrato_id 
    FROM veiculos v 
    WHERE v.equipe_id = equipes.id 
    AND v.contrato_id IS NOT NULL
    LIMIT 1
)
WHERE equipes.contrato_id IS NULL;

-- Criar índice
CREATE INDEX IF NOT EXISTS idx_equipes_contrato_id ON equipes(contrato_id);

-- Comentar coluna
COMMENT ON COLUMN equipes.contrato_id IS 'ID do contrato associado à equipe';
      `;
    }

    console.log('📄 Executando SQL de migração...');
    
    // Executar a migração usando RPC
    const { error } = await supabase.rpc('exec_sql', { sql: migrationSQL });

    if (error) {
      console.error('❌ Erro ao executar migração:', error);
      return NextResponse.json(
        { error: 'Erro ao executar migração de equipes', details: error },
        { status: 500 }
      );
    }

    // Verificar resultados
    console.log('📊 Verificando resultados da migração...');
    
    const { data: stats, error: statsError } = await supabase
      .from('equipes')
      .select('id, contrato_id')
      .limit(1000);

    if (statsError) {
      console.error('❌ Erro ao verificar stats:', statsError);
    } else {
      const total = stats.length;
      const migradas = stats.filter(e => e.contrato_id !== null).length;
      const semContrato = total - migradas;
      
      console.log(`📈 Estatísticas: ${migradas}/${total} equipes migradas (${semContrato} sem contrato)`);
    }

    console.log('✅ Migração de equipes concluída com sucesso');

    return NextResponse.json({ 
      message: 'Migração de equipes para contratos executada com sucesso',
      stats: stats ? {
        total: stats.length,
        migradas: stats.filter(e => e.contrato_id !== null).length,
        semContrato: stats.filter(e => e.contrato_id === null).length
      } : null
    });

  } catch (error) {
    console.error('💥 Erro na migração:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor na migração', details: error },
      { status: 500 }
    );
  }
}
