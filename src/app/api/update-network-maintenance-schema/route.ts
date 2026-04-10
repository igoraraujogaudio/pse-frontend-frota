import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export async function POST() {
  try {
    console.log('🔄 Atualizando schema da tabela network_maintenance_activities...');

    // Adicionar colunas critico e coordenada se não existirem
    const alterTableSQL = `
      DO $$ 
      BEGIN
        -- Adicionar coluna critico se não existir
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'network_maintenance_activities' 
          AND column_name = 'critico'
        ) THEN
          ALTER TABLE network_maintenance_activities 
          ADD COLUMN critico VARCHAR(10);
        END IF;

        -- Adicionar coluna coordenada se não existir
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'network_maintenance_activities' 
          AND column_name = 'coordenada'
        ) THEN
          ALTER TABLE network_maintenance_activities 
          ADD COLUMN coordenada TEXT;
        END IF;

        -- Adicionar outras colunas que podem estar faltando
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'network_maintenance_activities' 
          AND column_name = 'prioridade'
        ) THEN
          ALTER TABLE network_maintenance_activities 
          ADD COLUMN prioridade VARCHAR(50);
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'network_maintenance_activities' 
          AND column_name = 'atividade'
        ) THEN
          ALTER TABLE network_maintenance_activities 
          ADD COLUMN atividade TEXT;
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'network_maintenance_activities' 
          AND column_name = 'ponto_eletrico'
        ) THEN
          ALTER TABLE network_maintenance_activities 
          ADD COLUMN ponto_eletrico VARCHAR(100);
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'network_maintenance_activities' 
          AND column_name = 'inicio_intervencao'
        ) THEN
          ALTER TABLE network_maintenance_activities 
          ADD COLUMN inicio_intervencao VARCHAR(10);
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'network_maintenance_activities' 
          AND column_name = 'termino_intervencao'
        ) THEN
          ALTER TABLE network_maintenance_activities 
          ADD COLUMN termino_intervencao VARCHAR(10);
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'network_maintenance_activities' 
          AND column_name = 'tipo_sgd'
        ) THEN
          ALTER TABLE network_maintenance_activities 
          ADD COLUMN tipo_sgd VARCHAR(50);
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'network_maintenance_activities' 
          AND column_name = 'numero_sgd'
        ) THEN
          ALTER TABLE network_maintenance_activities 
          ADD COLUMN numero_sgd VARCHAR(50);
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'network_maintenance_activities' 
          AND column_name = 'obs'
        ) THEN
          ALTER TABLE network_maintenance_activities 
          ADD COLUMN obs TEXT;
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'network_maintenance_activities' 
          AND column_name = 'apoio'
        ) THEN
          ALTER TABLE network_maintenance_activities 
          ADD COLUMN apoio VARCHAR(100);
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'network_maintenance_activities' 
          AND column_name = 'horario_inicio'
        ) THEN
          ALTER TABLE network_maintenance_activities 
          ADD COLUMN horario_inicio VARCHAR(10);
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'network_maintenance_activities' 
          AND column_name = 'horario_fim'
        ) THEN
          ALTER TABLE network_maintenance_activities 
          ADD COLUMN horario_fim VARCHAR(10);
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'network_maintenance_activities' 
          AND column_name = 'tipo_servico'
        ) THEN
          ALTER TABLE network_maintenance_activities 
          ADD COLUMN tipo_servico VARCHAR(100);
        END IF;
      END $$;
    `;

    // Executar o SQL
    const { error } = await supabaseAdmin.rpc('exec_sql', { sql: alterTableSQL });

    if (error) {
      console.error('❌ Erro ao executar SQL:', error);
      return NextResponse.json(
        { error: 'Erro ao atualizar schema', details: error.message },
        { status: 500 }
      );
    }

    console.log('✅ Schema atualizado com sucesso!');

    return NextResponse.json({ 
      success: true,
      message: 'Schema da tabela network_maintenance_activities atualizado com sucesso',
      addedColumns: ['critico', 'coordenada', 'prioridade', 'atividade', 'ponto_eletrico', 'inicio_intervencao', 'termino_intervencao', 'tipo_sgd', 'numero_sgd', 'obs', 'apoio', 'horario_inicio', 'horario_fim', 'tipo_servico']
    });

  } catch (error) {
    console.error('❌ Erro no update schema:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return NextResponse.json(
      { error: 'Erro ao atualizar schema', details: errorMessage },
      { status: 500 }
    );
  }
}

// GET para verificar o schema atual
export async function GET() {
  try {
    const { data: columns, error } = await supabaseAdmin
      .rpc('exec_sql', { 
        sql: `
          SELECT column_name, data_type, is_nullable, column_default
          FROM information_schema.columns 
          WHERE table_name = 'network_maintenance_activities'
          ORDER BY ordinal_position;
        `
      });

    if (error) {
      return NextResponse.json(
        { error: 'Erro ao consultar schema', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      table: 'network_maintenance_activities',
      columns: columns || []
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return NextResponse.json(
      { error: 'Erro ao consultar schema', details: errorMessage },
      { status: 500 }
    );
  }
}



