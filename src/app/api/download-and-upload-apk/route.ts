import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Configuração do Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Cliente Supabase com service role para operações administrativas
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

// Project ID do Expo (baseado no link fornecido)
const EXPO_PROJECT_ID = 'pse-fleet-mobile-2025'
const EXPO_ACCOUNT = 'igorgaudio1'

// Cache para evitar downloads desnecessários
let lastDownloadTime = 0
let lastDownloadedBuildId = ''
const DOWNLOAD_COOLDOWN = 10 * 60 * 1000 // 10 minutos entre downloads

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

// interface EASBuild {
//   id: string
//   appVersion: string
//   appBuildVersion: string
//   artifacts?: {
//     applicationArchiveUrl?: string
//   }
//   createdAt: string
//   platform: string
//   status: string
// }

/**
 * Busca a última build do EAS/Expo usando múltiplas estratégias
 */
async function fetchLatestBuildFromEAS(): Promise<BuildInfo | null> {
  console.log('🔍 Consultando API do EAS/Expo...')
  
  try {
    // Tentar diferentes endpoints da API do Expo
    const endpoints = [
      `https://api.expo.dev/v2/projects/${EXPO_ACCOUNT}/${EXPO_PROJECT_ID}/builds?platform=android&limit=1&status=finished`,
      `https://expo.dev/api/v2/projects/${EXPO_ACCOUNT}/${EXPO_PROJECT_ID}/builds?platform=android&limit=1&status=finished`,
      `https://api.expo.dev/v1/projects/${EXPO_ACCOUNT}/${EXPO_PROJECT_ID}/builds?platform=android&limit=1&status=finished`
    ]

    for (const endpoint of endpoints) {
      try {
        console.log(`🔄 Tentando endpoint: ${endpoint}`)
        
        const response = await fetch(endpoint, {
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'PSE-Mobile-System/1.0'
          },
          next: { revalidate: 0 }
        })

        if (response.ok) {
          const data = await response.json()
          const builds = data.data || data.builds || data
          
          if (Array.isArray(builds) && builds.length > 0) {
            const latestBuild = builds[0]
            const apkUrl = latestBuild.artifacts?.applicationArchiveUrl || latestBuild.downloadUrl

            if (apkUrl) {
              console.log('✅ Build encontrada via API:', {
                id: latestBuild.id,
                version: latestBuild.appVersion || latestBuild.version,
                buildNumber: latestBuild.appBuildVersion || latestBuild.buildNumber
              })

              return {
                version: latestBuild.appVersion || latestBuild.version,
                buildNumber: parseInt(latestBuild.appBuildVersion || latestBuild.buildNumber),
                downloadUrl: apkUrl,
                buildId: latestBuild.id,
                createdAt: latestBuild.createdAt || new Date().toISOString(),
                releaseNotes: `Versão ${latestBuild.appVersion || latestBuild.version} - Build ${latestBuild.appBuildVersion || latestBuild.buildNumber}. Atualização automática do PSE Mobile.`,
                isMandatory: false,
                fileSize: 111 * 1024 * 1024, // Estimativa
              }
            }
          }
        } else {
          console.log(`⚠️ Endpoint ${endpoint} retornou:`, response.status, response.statusText)
        }
      } catch (endpointError) {
        console.log(`⚠️ Erro no endpoint ${endpoint}:`, endpointError)
      }
    }

    // Se todas as APIs falharam, buscar no Supabase
    console.log('🔄 Todas as APIs falharam, buscando no Supabase...')
    
    const { data: existingBuilds, error } = await supabaseAdmin
      .from('apk_builds')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)

    if (!error && existingBuilds && existingBuilds.length > 0) {
      const latestBuild = existingBuilds[0]
      console.log('✅ Usando build existente do Supabase:', {
        id: latestBuild.build_id,
        version: latestBuild.version,
        buildNumber: latestBuild.build_number
      })

      return {
        version: latestBuild.version,
        buildNumber: latestBuild.build_number,
        downloadUrl: latestBuild.download_url,
        buildId: latestBuild.build_id,
        createdAt: latestBuild.created_at,
        releaseNotes: latestBuild.release_notes,
        isMandatory: latestBuild.is_mandatory,
        fileSize: latestBuild.file_size
      }
    }

    console.log('❌ Nenhuma build encontrada')
    return null

  } catch (error) {
    console.error('❌ Erro geral ao buscar builds:', error)
    return null
  }
}

/**
 * Busca a última build do Supabase
 */
async function fetchLatestBuildFromSupabase(): Promise<BuildInfo | null> {
  try {
    console.log('🔍 Buscando build do Supabase...')
    
    const { data, error } = await supabaseAdmin
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
 * Verifica se já existe uma build no Supabase com o mesmo buildId
 */
async function checkBuildExists(buildId: string): Promise<boolean> {
  try {
    const { data, error } = await supabaseAdmin
      .from('apk_builds')
      .select('build_id')
      .eq('build_id', buildId)
      .single()

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
      console.error('❌ Erro ao verificar build existente:', error)
      return false
    }

    return !!data
  } catch (error) {
    console.error('❌ Erro ao verificar build existente:', error)
    return false
  }
}

/**
 * Baixa o APK do Expo e faz upload para o Supabase Storage
 */
// async function downloadAndUploadAPK(buildInfo: BuildInfo): Promise<string> {
//   try {
//     console.log('📥 Iniciando download do APK do Expo...')
//     
//     // Baixar o APK do Expo
//     const response = await fetch(buildInfo.downloadUrl)
//     
//     if (!response.ok) {
//       throw new Error(`Erro ao baixar APK: ${response.status} ${response.statusText}`)
//     }

//     const arrayBuffer = await response.arrayBuffer()
//     const fileSize = arrayBuffer.byteLength
//     
//     console.log(`✅ APK baixado com sucesso: ${(fileSize / 1024 / 1024).toFixed(2)}MB`)

//     // Gerar nome único para o arquivo
//     const fileName = `PSE-v${buildInfo.version}-build${buildInfo.buildNumber}.apk`
//     const filePath = fileName // Sem subpasta, arquivo direto no bucket

//     console.log('📤 Fazendo upload para Supabase Storage...')
//     console.log('📁 Bucket: apk-files')
//     console.log('📄 Arquivo:', filePath)

//     // Verificar se o bucket existe
//     const { data: buckets, error: bucketsError } = await supabaseAdmin.storage.listBuckets()
//     
//     if (bucketsError) {
//       console.error('❌ Erro ao verificar buckets:', bucketsError)
//       throw new Error(`Erro ao verificar buckets: ${bucketsError.message}`)
//     }

//     console.log('📋 Buckets disponíveis:', buckets?.map(b => b.name))

//     const apkBucket = buckets?.find(bucket => bucket.name === 'apk-files')
//     
//     if (!apkBucket) {
//       console.error('❌ Bucket apk-files não encontrado')
//       throw new Error('Bucket apk-files não encontrado. Crie o bucket apk-files no Supabase Storage primeiro.')
//     }

//     console.log('✅ Bucket apk-files encontrado')

//     // Upload para Supabase Storage com estratégia otimizada
//     console.log('⏱️ Iniciando upload para Supabase Storage...')
//     console.log(`📊 Tamanho do arquivo: ${(fileSize / 1024 / 1024).toFixed(2)}MB`)
//     
//     // Converter ArrayBuffer para Uint8Array para melhor compatibilidade
//     const uint8Array = new Uint8Array(arrayBuffer)
//     
//     // Upload com configurações otimizadas
//     const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
//       .from('apk-files')
//       .upload(filePath, uint8Array, {
//         contentType: 'application/vnd.android.package-archive',
//         cacheControl: '3600',
//         upsert: true
//       })

//     if (uploadError) {
//       console.error('❌ Erro no upload:', uploadError)
//       console.error('❌ Detalhes do erro:', JSON.stringify(uploadError, null, 2))
//       
//       // Tentar entender melhor o erro
//       if (uploadError.message?.includes('Client Clo')) {
//         throw new Error('Erro de conectividade com Supabase. Verifique as configurações de rede e chaves de API.')
//       }
//       
//       if (uploadError.message?.includes('Gateway Timeout')) {
//         throw new Error('Timeout no Supabase. O arquivo pode ser muito grande ou o servidor está sobrecarregado. Tente novamente em alguns minutos.')
//       }
//       
//       if (uploadError.message?.includes('Unexpected token')) {
//         throw new Error('Erro de comunicação com Supabase. A resposta não está em formato JSON válido.')
//       }
//       
//       throw new Error(`Erro no upload: ${uploadError.message}`)
//     }

//     console.log('✅ Upload concluído com sucesso!')
//     console.log('📊 Dados do upload:', uploadData)

//     // Obter URL pública
//     const { data: { publicUrl } } = supabaseAdmin.storage
//       .from('apk-files')
//       .getPublicUrl(filePath)

//     console.log('🔗 URL pública:', publicUrl)

//     return publicUrl
//   } catch (error) {
//     console.error('❌ Erro no download/upload:', error)
//     
//     // Log mais detalhado do erro
//     if (error instanceof Error) {
//       console.error('❌ Mensagem:', error.message)
//       console.error('❌ Stack:', error.stack)
//     }
//     
//     throw error
//   }
// }

/**
 * Salva informações da build no banco de dados
 */
async function saveBuildInfo(buildInfo: BuildInfo, supabaseUrl: string): Promise<void> {
  try {
    console.log('💾 Salvando informações da build no banco...')

    // Desativar builds anteriores
    await supabaseAdmin
      .from('apk_builds')
      .update({ is_active: false })
      .eq('is_active', true)

    // Inserir nova build
    const { error } = await supabaseAdmin
      .from('apk_builds')
      .upsert({
        version: buildInfo.version,
        build_number: buildInfo.buildNumber,
        build_id: buildInfo.buildId,
        download_url: supabaseUrl,
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
      console.error('❌ Erro ao salvar no banco:', error)
      throw new Error(`Erro ao salvar no banco: ${error.message}`)
    }

    console.log('✅ Informações da build salvas com sucesso!')
  } catch (error) {
    console.error('❌ Erro ao salvar build info:', error)
    throw error
  }
}

/**
 * Função principal: sincroniza informações da versão no Supabase usando URL direta do Expo
 */
async function syncLatestAPKInfo(): Promise<BuildInfo> {
  console.log('🚀 Iniciando sincronização de informações da versão...')
  
  // 1. Buscar última build do EAS
  const easBuild = await fetchLatestBuildFromEAS()
  
  if (!easBuild) {
    console.log('⚠️ Nenhuma build encontrada, verificando Supabase...')
    
    // Buscar última build do Supabase como fallback
    const supabaseBuild = await fetchLatestBuildFromSupabase()
    
    if (supabaseBuild) {
      console.log('✅ Usando build do Supabase como fallback')
      return supabaseBuild
    }
    
    throw new Error('Nenhuma build encontrada no EAS/Expo nem no Supabase')
  }

  // 2. Verificar cache para evitar downloads desnecessários
  const now = Date.now()
  if (lastDownloadedBuildId === easBuild.buildId && (now - lastDownloadTime) < DOWNLOAD_COOLDOWN) {
    console.log('⏰ Download recente detectado, usando cache...')
    
    // Buscar informações da build existente
    const { data: existingBuild } = await supabaseAdmin
      .from('apk_builds')
      .select('*')
      .eq('build_id', easBuild.buildId)
      .single()

    if (existingBuild) {
      return {
        version: existingBuild.version,
        buildNumber: existingBuild.build_number,
        downloadUrl: existingBuild.download_url,
        buildId: existingBuild.build_id,
        createdAt: existingBuild.created_at,
        releaseNotes: existingBuild.release_notes,
        isMandatory: existingBuild.is_mandatory,
        fileSize: existingBuild.file_size
      }
    }
  }

  // 3. Verificar se já existe no Supabase
  const buildExists = await checkBuildExists(easBuild.buildId)
  
  if (buildExists) {
    console.log('✅ Build já existe no Supabase, retornando informações existentes')
    
    // Atualizar cache
    lastDownloadedBuildId = easBuild.buildId
    lastDownloadTime = now
    
    // Buscar informações da build existente
    const { data: existingBuild } = await supabaseAdmin
      .from('apk_builds')
      .select('*')
      .eq('build_id', easBuild.buildId)
      .single()

    if (existingBuild) {
      return {
        version: existingBuild.version,
        buildNumber: existingBuild.build_number,
        downloadUrl: existingBuild.download_url,
        buildId: existingBuild.build_id,
        createdAt: existingBuild.created_at,
        releaseNotes: existingBuild.release_notes,
        isMandatory: existingBuild.is_mandatory,
        fileSize: existingBuild.file_size
      }
    }
  }

  console.log(`🆕 Nova versão detectada: v${easBuild.version} (Build ${easBuild.buildNumber})`)
  
  // 4. Salvar apenas informações da versão no Supabase (usando URL direta do Expo)
  console.log('💾 Salvando informações da versão no Supabase...')
  
  try {
    await saveBuildInfo(easBuild, easBuild.downloadUrl)
    console.log('✅ Informações da versão salvas no Supabase com sucesso!')
  } catch (dbError) {
    console.warn('⚠️ Não foi possível salvar no Supabase, mas continuando:', dbError)
  }
  
  // Atualizar cache
  lastDownloadedBuildId = easBuild.buildId
  lastDownloadTime = now
  
  console.log('✅ Sincronização concluída! Usando URL direta do Expo.')
  
  // Retornar informações com URL do Expo
  return {
    ...easBuild,
    downloadUrl: easBuild.downloadUrl
  }
}

export async function POST() {
  try {
    console.log('🎯 Endpoint de sincronização automática chamado')
    
    const buildInfo = await syncLatestAPKInfo()
    
    return NextResponse.json({
      success: true,
      message: 'Informações da versão sincronizadas com sucesso (URL direta do Expo)',
      data: buildInfo,
      source: 'expo-direct'
    })
  } catch (error) {
    console.error('❌ Erro no processo de download/upload:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido',
      message: 'Falha no processo de sincronização do APK'
    }, { status: 500 })
  }
}

export async function GET() {
  try {
    console.log('🔍 Verificando status do sistema de download automático...')
    
    // Verificar se o bucket existe
    const { data: buckets, error: bucketsError } = await supabaseAdmin.storage.listBuckets()
    
    if (bucketsError) {
      throw new Error(`Erro ao verificar buckets: ${bucketsError.message}`)
    }

    const apkBucket = buckets?.find(bucket => bucket.name === 'apk-files')
    
    if (!apkBucket) {
      return NextResponse.json({
        success: false,
        error: 'Bucket apk-files não encontrado',
        message: 'Configure o bucket apk-files no Supabase Storage'
      }, { status: 404 })
    }

    // Verificar última build
    const easBuild = await fetchLatestBuildFromEAS()
    
    if (!easBuild) {
      return NextResponse.json({
        success: false,
        error: 'Nenhuma build encontrada no EAS',
        message: 'Não foi possível encontrar builds no EAS/Expo'
      }, { status: 404 })
    }

    const buildExists = await checkBuildExists(easBuild.buildId)

    const now = Date.now()
    const timeSinceLastDownload = now - lastDownloadTime
    const canDownload = timeSinceLastDownload >= DOWNLOAD_COOLDOWN || lastDownloadedBuildId !== easBuild.buildId

    return NextResponse.json({
      success: true,
      message: 'Sistema funcionando corretamente',
      data: {
        latestEASBuild: {
          version: easBuild.version,
          buildNumber: easBuild.buildNumber,
          buildId: easBuild.buildId,
          downloadUrl: easBuild.downloadUrl
        },
        bucketExists: true,
        buildExistsInSupabase: buildExists,
        needsDownload: !buildExists,
        cache: {
          lastDownloadedBuildId,
          timeSinceLastDownload: Math.round(timeSinceLastDownload / 1000), // em segundos
          canDownload,
          cooldownMinutes: Math.round(DOWNLOAD_COOLDOWN / 1000 / 60)
        }
      }
    })
  } catch (error) {
    console.error('❌ Erro na verificação do sistema:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido',
      message: 'Falha na verificação do sistema'
    }, { status: 500 })
  }
}
