import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const { sql } = await request.json();
    
    if (!sql) {
      return NextResponse.json({ error: 'SQL é obrigatório' }, { status: 400 });
    }

    console.log('🚀 Executando SQL:', sql.substring(0, 100) + '...');
    
    const { error } = await supabase.rpc('exec_sql', { sql });

    if (error) {
      console.error('❌ Erro ao executar SQL:', error);
      return NextResponse.json(
        { error: 'Erro ao executar SQL', details: error },
        { status: 500 }
      );
    }

    console.log('✅ SQL executado com sucesso');
    return NextResponse.json({ message: 'SQL executado com sucesso' });

  } catch (error) {
    console.error('Erro na execução:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor', details: error },
      { status: 500 }
    );
  }
}
