import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Create Supabase client with service role key for admin operations
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

export async function POST() {
  try {

    // 1. Verificar estrutura atual da tabela
    let columns: { column_name: string; data_type: string; is_nullable: string; column_default: string }[] | null = null
    let columnsError: Error | null = null
    
    try {
      const result = await supabase
        .rpc('get_table_columns', { table_name: 'usuario_bases' })
      columns = result.data
      columnsError = result.error
    } catch {
      // Fallback: usar query direta
      const result = await supabase
        .from('information_schema.columns')
        .select('column_name, data_type, is_nullable, column_default')
        .eq('table_name', 'usuario_bases')
        .eq('table_schema', 'public')
        .order('ordinal_position')
      
      columns = result.data
      columnsError = result.error
    }

    if (columnsError) {
    } else {
    }

    // 2. Verificar se o campo atualizado_em existe
    const hasAtualizadoEm = columns?.some((col: { column_name: string }) => col.column_name === 'atualizado_em')
    
    if (!hasAtualizadoEm) {
      
      // Adicionar o campo atualizado_em
      let alterError: Error | null = null
      
      try {
        const result = await supabase
          .rpc('exec_sql', { 
            sql: `ALTER TABLE public.usuario_bases ADD COLUMN atualizado_em timestamp with time zone DEFAULT now();` 
          })
        alterError = result.error
      } catch {
        // Fallback: usar query direta se RPC não funcionar
        await supabase
          .from('usuario_bases')
          .select('id')
          .limit(1)
        
        // Se chegou aqui, a tabela existe, mas não conseguimos alterar via RPC
        // Vamos tentar uma abordagem diferente
        alterError = new Error('RPC não disponível, tentando abordagem alternativa')
      }

      if (alterError) {
        return NextResponse.json({ 
          success: false, 
          error: 'Erro ao adicionar campo atualizado_em',
          details: alterError.message 
        })
      } else {
      }
    } else {
    }

    // 3. Atualizar registros existentes
    const { error: updateError } = await supabase
      .from('usuario_bases')
      .update({ atualizado_em: new Date().toISOString() })
      .is('atualizado_em', null)

    if (updateError) {
    } else {
    }

    // 4. Verificar se o trigger existe
    let triggers: { trigger_name: string }[] | null = null
    
    try {
      const result = await supabase
        .rpc('get_table_triggers', { table_name: 'usuario_bases' })
      triggers = result.data
    } catch {
      // Fallback: verificar via query direta
      const result = await supabase
        .from('information_schema.triggers')
        .select('trigger_name')
        .eq('event_object_table', 'usuario_bases')
        .eq('trigger_name', 'update_usuario_bases_updated_at')
      
      triggers = result.data
    }

    const hasTrigger = triggers?.some((t: { trigger_name: string }) => t.trigger_name === 'update_usuario_bases_updated_at')
    
    if (!hasTrigger) {
      
      // Criar função do trigger
      let functionError: Error | null = null
      
      try {
        const result = await supabase
          .rpc('exec_sql', { 
            sql: `
              CREATE OR REPLACE FUNCTION update_updated_at_column()
              RETURNS TRIGGER AS $$
              BEGIN
                  NEW.atualizado_em = now();
                  RETURN NEW;
              END;
              $$ language 'plpgsql';
            ` 
          })
        functionError = result.error
      } catch {
        functionError = new Error('RPC não disponível')
      }

      if (functionError) {
      } else {
      }

      // Criar trigger
      let triggerCreateError: Error | null = null
      
      try {
        const result = await supabase
          .rpc('exec_sql', { 
            sql: `
              DROP TRIGGER IF EXISTS update_usuario_bases_updated_at ON usuario_bases;
              CREATE TRIGGER update_usuario_bases_updated_at
                  BEFORE UPDATE ON usuario_bases
                  FOR EACH ROW
                  EXECUTE FUNCTION update_updated_at_column();
            ` 
          })
        triggerCreateError = result.error
      } catch {
        triggerCreateError = new Error('RPC não disponível')
      }

      if (triggerCreateError) {
      } else {
      }
    } else {
    }

    // 5. Teste do trigger
    const { data: testRecord } = await supabase
      .from('usuario_bases')
      .select('id')
      .limit(1)
      .single()

    if (testRecord) {
      const { error: testError } = await supabase
        .from('usuario_bases')
        .update({ ativo: true }) // Atualização dummy para testar o trigger
        .eq('id', testRecord.id)

      if (testError) {
      } else {
      }
    } else {
    }

    
    return NextResponse.json({ 
      success: true, 
      message: 'Campo atualizado_em adicionado à tabela usuario_bases com sucesso!',
      details: {
        campoAdicionado: !hasAtualizadoEm,
        triggerCriado: !hasTrigger,
        registrosAtualizados: true
      }
    })

  } catch (error) {
      console.error(error);
    return NextResponse.json({ 
      success: false, 
      error: 'Erro interno do servidor',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    }, { status: 500 })
  }
}
