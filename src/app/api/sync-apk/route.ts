import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Configuração do Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Project ID do Expo
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

/**
 * Endpoint para forçar sincronização imediata do EAS → Supabase
 * Útil para testes e atualizações manuais
 */
export async function POST() {
  try {
    console.log('🚀 Sincronização manual iniciada...')
    
    // 1. Buscar do EAS
    const response = await fetch(
      `https://api.expo.dev/v2/projects/${EXPO_PROJECT_ID}/builds?platform=android&limit=1&status=finished`,
      {
        headers: {
          'Accept': 'application/json',
        },
        cache: 'no-store'
      }
    )

    if (!response.ok) {
      throw new Error(`Erro ao consultar EAS: ${response.status}`)
    }

    const builds: EASBuild[] = await response.json()
    
    if (!builds || builds.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Nenhuma build encontrada no EAS'
      }, { status: 404 })
    }

    const latestBuild = builds[0]
    const apkUrl = latestBuild.artifacts?.applicationArchiveUrl

    if (!apkUrl) {
      return NextResponse.json({
        success: false,
        error: 'Build encontrada mas sem URL de download'
      }, { status: 400 })
    }

    const easBuildInfo: BuildInfo = {
      version: latestBuild.appVersion,
      buildNumber: parseInt(latestBuild.appBuildVersion),
      downloadUrl: apkUrl,
      buildId: latestBuild.id,
      createdAt: latestBuild.createdAt,
      releaseNotes: `Versão ${latestBuild.appVersion} - Build ${latestBuild.appBuildVersion}. Atualização automática do PSE Mobile.`,
      isMandatory: false,
      fileSize: 47 * 1024 * 1024,
    }

    // 2. Buscar do Supabase
    const { data: supabaseData } = await supabase
      .from('apk_builds')
      .select('*')
      .eq('is_active', true)
      .order('build_number', { ascending: false })
      .limit(1)
      .single()

    const supabaseBuildNumber = supabaseData?.build_number || 0

    // 3. Verificar se precisa atualizar
    if (easBuildInfo.buildNumber <= supabaseBuildNumber) {
      return NextResponse.json({
        success: true,
        message: 'Supabase já está atualizado',
        alreadyUpToDate: true,
        currentBuild: {
          version: supabaseData.version,
          buildNumber: supabaseData.build_number
        },
        easBuild: {
          version: easBuildInfo.version,
          buildNumber: easBuildInfo.buildNumber
        }
      })
    }

    // 4. Desativar builds anteriores
    await supabase
      .from('apk_builds')
      .update({ is_active: false })
      .eq('is_active', true)

    // 5. Inserir nova build
    const { error: insertError } = await supabase
      .from('apk_builds')
      .upsert({
        version: easBuildInfo.version,
        build_number: easBuildInfo.buildNumber,
        build_id: easBuildInfo.buildId,
        download_url: easBuildInfo.downloadUrl,
        file_size: easBuildInfo.fileSize,
        release_notes: easBuildInfo.releaseNotes,
        is_active: true,
        is_mandatory: easBuildInfo.isMandatory,
        created_at: easBuildInfo.createdAt,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'build_id'
      })

    if (insertError) {
      throw new Error(`Erro ao salvar no Supabase: ${insertError.message}`)
    }

    console.log(`✅ Build ${easBuildInfo.version} salva com sucesso!`)

    return NextResponse.json({
      success: true,
      message: 'Sincronização concluída com sucesso',
      updated: true,
      previousBuild: {
        version: supabaseData?.version || 'N/A',
        buildNumber: supabaseBuildNumber
      },
      newBuild: {
        version: easBuildInfo.version,
        buildNumber: easBuildInfo.buildNumber,
        downloadUrl: easBuildInfo.downloadUrl,
        buildId: easBuildInfo.buildId
      }
    })
  } catch (error) {
    console.error('❌ Erro na sincronização manual:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    }, { status: 500 })
  }
}

/**
 * Endpoint GET para verificar status da sincronização
 */
export async function GET() {
  try {
    // Buscar do EAS
    const easResponse = await fetch(
      `https://api.expo.dev/v2/projects/${EXPO_PROJECT_ID}/builds?platform=android&limit=1&status=finished`,
      {
        headers: {
          'Accept': 'application/json',
        },
        cache: 'no-store'
      }
    )

    let easBuild = null
    if (easResponse.ok) {
      const builds: EASBuild[] = await easResponse.json()
      if (builds && builds.length > 0) {
        easBuild = {
          version: builds[0].appVersion,
          buildNumber: parseInt(builds[0].appBuildVersion),
          buildId: builds[0].id
        }
      }
    }

    // Buscar do Supabase
    const { data: supabaseData } = await supabase
      .from('apk_builds')
      .select('version, build_number, build_id, is_active, created_at')
      .eq('is_active', true)
      .order('build_number', { ascending: false })
      .limit(1)
      .single()

    return NextResponse.json({
      success: true,
      eas: easBuild,
      supabase: supabaseData || null,
      isSynced: easBuild && supabaseData ? easBuild.buildNumber === supabaseData.build_number : false,
      needsUpdate: easBuild && supabaseData ? easBuild.buildNumber > supabaseData.build_number : false
    })
  } catch (error) {
    console.error('❌ Erro ao verificar status:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    }, { status: 500 })
  }
}





