import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Configuração do Supabase (seu self-hosted no Coolify)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Project ID do Expo (do app.json)
const EXPO_PROJECT_ID = 'fdcc7644-84eb-46a2-93a5-558921d329ec'

interface BuildInfo {
  version: string
  buildNumber: number
  downloadUrl: string
  buildId: string
  createdAt: string
  releaseNotes: string
  isMandatory: boolean
  fileSize: number
}

interface EASBuild {
  id: string
  appVersion: string
  appBuildVersion: string
  artifacts?: {
    applicationArchiveUrl?: string
  }
  createdAt: string
  platform: string
  status: string
}

// Cache para evitar muitas consultas
let cachedBuildInfo: BuildInfo | null = null
let lastFetchTime = 0
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutos

/**
 * Busca a última build do EAS/Expo usando a API pública
 */
async function fetchLatestBuildFromEAS(): Promise<BuildInfo | null> {
  try {
    console.log('🔍 Consultando API do EAS/Expo...')
    
    // API pública do Expo para listar builds
    const response = await fetch(
      `https://api.expo.dev/v2/projects/${EXPO_PROJECT_ID}/builds?platform=android&limit=1&status=finished`,
      {
        headers: {
          'Accept': 'application/json',
        },
        next: { revalidate: 0 } // Não cachear no Next.js
      }
    )

    if (!response.ok) {
      console.error('❌ Erro ao consultar EAS:', response.status, response.statusText)
      return null
    }

    const builds: EASBuild[] = await response.json()
    
    if (!builds || builds.length === 0) {
      console.log('⚠️ Nenhuma build encontrada no EAS')
      return null
    }

    const latestBuild = builds[0]
    const apkUrl = latestBuild.artifacts?.applicationArchiveUrl

    if (!apkUrl) {
      console.log('⚠️ Build encontrada mas sem URL de download')
      return null
    }

    console.log('✅ Build encontrada no EAS:', {
      id: latestBuild.id,
      version: latestBuild.appVersion,
      buildNumber: latestBuild.appBuildVersion
    })

    return {
      version: latestBuild.appVersion,
      buildNumber: parseInt(latestBuild.appBuildVersion),
      downloadUrl: apkUrl,
      buildId: latestBuild.id,
      createdAt: latestBuild.createdAt,
      releaseNotes: `Versão ${latestBuild.appVersion} - Build ${latestBuild.appBuildVersion}. Atualização automática do PSE Mobile.`,
      isMandatory: false,
      fileSize: 47 * 1024 * 1024, // Estimativa 47MB
    }
  } catch (error) {
    console.error('❌ Erro ao consultar EAS:', error)
    return null
  }
}

/**
 * Busca a última build do Supabase
 */
async function fetchLatestBuildFromSupabase(): Promise<BuildInfo | null> {
  try {
    console.log('🔍 Buscando build do Supabase...')
    
    const { data, error } = await supabase
      .from('apk_builds')
      .select('*')
      .eq('is_active', true)
      .order('build_number', { ascending: false })
      .limit(1)
      .single()

    if (error || !data) {
      console.log('⚠️ Nenhuma build encontrada no Supabase')
      return null
    }

    console.log('✅ Build encontrada no Supabase:', {
      id: data.build_id,
      version: data.version,
      buildNumber: data.build_number
    })

    return {
      version: data.version,
      buildNumber: data.build_number,
      downloadUrl: data.download_url,
      buildId: data.build_id,
      createdAt: data.created_at,
      releaseNotes: data.release_notes || `Versão ${data.version} - Build ${data.build_number}.`,
      isMandatory: data.is_mandatory || false,
      fileSize: data.file_size || 45 * 1024 * 1024,
    }
  } catch (error) {
    console.error('❌ Erro ao buscar do Supabase:', error)
    return null
  }
}

/**
 * Salva uma nova build no Supabase
 */
async function saveBuildToSupabase(buildInfo: BuildInfo): Promise<boolean> {
  try {
    console.log('💾 Salvando nova build no Supabase...', {
      version: buildInfo.version,
      buildNumber: buildInfo.buildNumber
    })

    // Desativar builds anteriores
    await supabase
      .from('apk_builds')
      .update({ is_active: false })
      .eq('is_active', true)

    // Inserir nova build
    const { error } = await supabase
      .from('apk_builds')
      .upsert({
        version: buildInfo.version,
        build_number: buildInfo.buildNumber,
        build_id: buildInfo.buildId,
        download_url: buildInfo.downloadUrl,
        file_size: buildInfo.fileSize,
        release_notes: buildInfo.releaseNotes,
        is_active: true,
        is_mandatory: buildInfo.isMandatory,
        created_at: buildInfo.createdAt,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'build_id'
      })

    if (error) {
      console.error('❌ Erro ao salvar no Supabase:', error)
      return false
    }

    console.log('✅ Build salva com sucesso no Supabase!')
    return true
  } catch (error) {
    console.error('❌ Erro ao salvar build:', error)
    return false
  }
}

/**
 * Função principal: sincroniza EAS → Supabase e retorna a última build
 */
async function syncAndGetLatestBuild(): Promise<BuildInfo> {
  console.log('🚀 Iniciando sincronização EAS → Supabase...')
  
  // 1. Buscar do EAS
  const easBuild = await fetchLatestBuildFromEAS()
  
  // 2. Buscar do Supabase
  const supabaseBuild = await fetchLatestBuildFromSupabase()
  
  // 3. Se não há build no EAS, usar do Supabase
  if (!easBuild) {
    console.log('⚠️ EAS indisponível, usando Supabase como fallback')
    if (supabaseBuild) {
      return supabaseBuild
    }
    // Fallback final - Build mais recente encontrada via EAS CLI
    return {
      version: '2.0.3',
      buildNumber: 7,
      downloadUrl: 'https://expo.dev/artifacts/eas/cyjGz9baeYawQAvnA9FtC2.apk',
      buildId: '5d97d991-c334-4101-be57-b056ca12448d',
      createdAt: '2025-10-13T12:19:53.000Z',
      releaseNotes: 'Versão 2.0.3 - Build 7. Sistema de Gestão de Frota PSE Mobile com todas as funcionalidades atualizadas.',
      isMandatory: false,
      fileSize: 47 * 1024 * 1024, // ~47MB
    }
  }
  
  // 4. Se não há build no Supabase, salvar a do EAS
  if (!supabaseBuild) {
    console.log('📥 Primeira build - salvando no Supabase...')
    await saveBuildToSupabase(easBuild)
    return easBuild
  }
  
  // 5. Comparar versões - se EAS tem build mais nova, atualizar Supabase
  if (easBuild.buildNumber > supabaseBuild.buildNumber) {
    console.log(`🆕 Nova versão detectada! ${supabaseBuild.version} → ${easBuild.version}`)
    await saveBuildToSupabase(easBuild)
    return easBuild
  }
  
  // 6. Supabase está atualizado
  console.log('✅ Supabase já tem a versão mais recente')
  return supabaseBuild
}

export async function GET() {
  try {
    const now = Date.now()
    
    // Usar cache se ainda válido (reduzir chamadas à API do Expo)
    if (cachedBuildInfo && (now - lastFetchTime) < CACHE_DURATION) {
      console.log('📦 Usando build info do cache')
      return NextResponse.json({
        success: true,
        data: cachedBuildInfo,
        cached: true,
        source: 'cache'
      })
    }

    // Sincronizar EAS → Supabase e buscar última build
    console.log('🔄 Cache expirado, sincronizando com EAS...')
    const latestBuildInfo = await syncAndGetLatestBuild()
    
    // Atualizar cache
    cachedBuildInfo = latestBuildInfo
    lastFetchTime = now

    return NextResponse.json({
      success: true,
      data: latestBuildInfo,
      cached: false,
      source: 'synced'
    })
  } catch (error) {
    console.error('❌ Erro ao buscar build mais recente:', error)
    return NextResponse.json({
      success: false,
      error: 'Erro ao buscar informações da build'
    }, { status: 500 })
  }
}

// Endpoint para redirecionar diretamente para o download
export async function POST() {
  try {
    // Sincronizar e buscar a build mais recente
    const latestBuildInfo = await syncAndGetLatestBuild()
    
    if (!latestBuildInfo.downloadUrl) {
      throw new Error('URL de download não encontrada')
    }
    
    return NextResponse.redirect(latestBuildInfo.downloadUrl, 302)
  } catch (error) {
    console.error('❌ Erro no redirecionamento:', error)
    return NextResponse.json({
      success: false,
      error: 'Erro no redirecionamento para download'
    }, { status: 500 })
  }
}
