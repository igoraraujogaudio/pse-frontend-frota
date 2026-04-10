import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import fs from 'fs';
import path from 'path';

export async function POST() {
  try {
    // Ler o arquivo SQL de migração
    const migrationPath = path.join(process.cwd(), 'src/db/migrations/create_network_maintenance_tables.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    // Executar a migração
    const { error } = await supabase.rpc('exec_sql', { sql: migrationSQL });

    if (error) {
      console.error('Erro ao executar migração:', error);
      return NextResponse.json(
        { error: 'Erro ao criar tabelas de manutenção de rede' },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      message: 'Tabelas de manutenção de rede criadas com sucesso' 
    });

  } catch (error) {
    console.error('Erro no setup:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// Função alternativa caso o RPC não esteja disponível
export async function GET() {
  try {
    // Criar as tabelas uma por uma
    const createSchedulesTable = `
      CREATE TABLE IF NOT EXISTS network_maintenance_schedules (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          date DATE NOT NULL,
          day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          UNIQUE(date)
      );
    `;

    const createActivitiesTable = `
      CREATE TABLE IF NOT EXISTS network_maintenance_activities (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          schedule_id UUID NOT NULL,
          team VARCHAR(100) NOT NULL,
          os_number VARCHAR(100) NOT NULL,
          value DECIMAL(10,2) NOT NULL DEFAULT 0,
          status VARCHAR(10) NOT NULL DEFAULT 'PROG',
          status_notes TEXT,
          location VARCHAR(255) NOT NULL,
          notes TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `;

    // Executar as queries
    const { error: error1 } = await supabase.rpc('exec', { sql: createSchedulesTable });
    if (error1) throw error1;

    const { error: error2 } = await supabase.rpc('exec', { sql: createActivitiesTable });
    if (error2) throw error2;

    return NextResponse.json({ 
      message: 'Tabelas criadas com sucesso via GET' 
    });

  } catch (error) {
    console.error('Erro no setup via GET:', error);
    return NextResponse.json(
      { error: 'Erro ao criar tabelas', details: error },
      { status: 500 }
    );
  }
}