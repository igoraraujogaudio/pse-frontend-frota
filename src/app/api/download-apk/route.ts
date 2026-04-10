import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Configuração do Supabase (seu self-hosted no Coolify)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function getLatestApkUrl(): Promise<string> {
  try {
    console.log('🔍 Buscando APK mais recente do Supabase...')
    
    const { data, error } = await supabase
      .from('apk_builds')
      .select('download_url')
      .eq('is_active', true)
      .order('build_number', { ascending: false })
      .limit(1)
      .single()

    if (error) {
      console.error('❌ Erro do Supabase:', error)
      throw new Error(`Supabase error: ${error.message}`)
    }

    if (!data?.download_url) {
      throw new Error('URL de download não encontrada')
    }

    console.log('✅ URL do APK encontrada no Supabase')
    return data.download_url
  } catch (error) {
    console.error('❌ Erro ao buscar APK do Supabase:', error)
    // Fallback para build conhecida
    return 'https://expo.dev/artifacts/eas/fTqmgWLkwN3hAVbFFqVJNa.apk'
  }
}

// GET - Redireciona diretamente para o APK mais recente
export async function GET() {
  try {
    const apkUrl = await getLatestApkUrl()
    
    if (!apkUrl) {
      return NextResponse.json({
        error: 'URL do APK não encontrada'
      }, { status: 404 })
    }

    // Redireciona diretamente para o download
    return NextResponse.redirect(apkUrl, 302)
  } catch (error) {
    console.error('Erro no download direto:', error)
    return NextResponse.json({
      error: 'Erro ao buscar APK'
    }, { status: 500 })
  }
}
