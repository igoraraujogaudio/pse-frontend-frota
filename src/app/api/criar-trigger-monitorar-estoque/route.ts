import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

export async function POST() {
  try {
    console.log('🚀 Executando criação do trigger de monitoramento de estoque...')
    
    // Ler o arquivo SQL
    const sqlFilePath = path.join(process.cwd(), '../../mobile/criar_trigger_monitorar_estoque_diminuicao.sql')
    const sql = fs.readFileSync(sqlFilePath, 'utf8')
    
    console.log('📄 SQL carregado:', sql.substring(0, 200) + '...')
    
    // Executar o SQL diretamente via fetch para Supabase
    const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY!
      },
      body: JSON.stringify({ sql })
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ Erro ao executar SQL:', errorText)
      return NextResponse.json({ 
        error: 'Erro ao criar trigger de monitoramento de estoque', 
        details: errorText 
      }, { status: 500 })
    }
    
    const result = await response.json()
    console.log('✅ Trigger criado com sucesso!')
    
    return NextResponse.json({ 
      message: 'Trigger de monitoramento de estoque criado com sucesso!',
      result 
    })
    
  } catch (error) {
    console.error('❌ Erro na API criar-trigger-monitorar-estoque:', error)
    return NextResponse.json({ 
      error: 'Erro interno do servidor' 
    }, { status: 500 })
  }
}


