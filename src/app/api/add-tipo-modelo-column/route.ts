import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST() {
  try {
    console.log('🚀 Adicionando coluna tipo_modelo...');
    
    // Verificar se a coluna já existe
    const { data: columns, error: columnsError } = await supabase
      .from('information_schema.columns')
      .select('column_name')
      .eq('table_name', 'regras_documentacao_veiculo')
      .eq('column_name', 'tipo_modelo');

    if (columnsError) {
      console.error('❌ Erro ao verificar colunas:', columnsError);
    }

    if (columns && columns.length > 0) {
      console.log('✅ Coluna tipo_modelo já existe');
      return NextResponse.json({ message: 'Coluna tipo_modelo já existe' });
    }

    // Adicionar coluna usando SQL direto
    const { error } = await supabase.rpc('exec_sql', { 
      sql: 'ALTER TABLE regras_documentacao_veiculo ADD COLUMN tipo_modelo TEXT;' 
    });

    if (error) {
      console.error('❌ Erro ao adicionar coluna:', error);
      return NextResponse.json(
        { error: 'Erro ao adicionar coluna tipo_modelo', details: error },
        { status: 500 }
      );
    }

    console.log('✅ Coluna tipo_modelo adicionada com sucesso');
    return NextResponse.json({ message: 'Coluna tipo_modelo adicionada com sucesso' });

  } catch (error) {
    console.error('Erro na operação:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor', details: error },
      { status: 500 }
    );
  }
}
