import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

interface BuildUpdateRequest {
  version: string
  buildNumber: number
  downloadUrl: string
  buildId: string
  releaseNotes?: string
  isMandatory?: boolean
  fileSize?: number
}

export async function POST(request: NextRequest) {
  try {
    const body: BuildUpdateRequest = await request.json()
    
    console.log('🔄 Atualizando build manualmente:', {
      version: body.version,
      buildNumber: body.buildNumber,
      buildId: body.buildId
    })

    // Verificar se a build já existe
    const { data: existingBuild } = await supabaseAdmin
      .from('apk_builds')
      .select('*')
      .eq('build_id', body.buildId)
      .single()

    if (existingBuild) {
      console.log('⚠️ Build já existe, atualizando...')
      
      const { error: updateError } = await supabaseAdmin
        .from('apk_builds')
        .update({
          version: body.version,
          build_number: body.buildNumber,
          download_url: body.downloadUrl,
          release_notes: body.releaseNotes || `Versão ${body.version} - Build ${body.buildNumber}`,
          is_mandatory: body.isMandatory || false,
          file_size: body.fileSize || 111 * 1024 * 1024,
          updated_at: new Date().toISOString()
        })
        .eq('build_id', body.buildId)

      if (updateError) {
        throw new Error(`Erro ao atualizar build: ${updateError.message}`)
      }

      console.log('✅ Build atualizada com sucesso!')
      
      return NextResponse.json({
        success: true,
        message: 'Build atualizada com sucesso',
        data: {
          version: body.version,
          buildNumber: body.buildNumber,
          downloadUrl: body.downloadUrl,
          buildId: body.buildId
        }
      })
    } else {
      console.log('🆕 Nova build, inserindo...')
      
      const { error: insertError } = await supabaseAdmin
        .from('apk_builds')
        .insert({
          build_id: body.buildId,
          version: body.version,
          build_number: body.buildNumber,
          download_url: body.downloadUrl,
          release_notes: body.releaseNotes || `Versão ${body.version} - Build ${body.buildNumber}`,
          is_mandatory: body.isMandatory || false,
          file_size: body.fileSize || 111 * 1024 * 1024,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })

      if (insertError) {
        throw new Error(`Erro ao inserir build: ${insertError.message}`)
      }

      console.log('✅ Nova build inserida com sucesso!')
      
      return NextResponse.json({
        success: true,
        message: 'Nova build inserida com sucesso',
        data: {
          version: body.version,
          buildNumber: body.buildNumber,
          downloadUrl: body.downloadUrl,
          buildId: body.buildId
        }
      })
    }

  } catch (error) {
    console.error('❌ Erro ao atualizar build:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido',
      message: 'Falha ao atualizar build'
    }, { status: 500 })
  }
}

export async function GET() {
  try {
    console.log('📋 Listando todas as builds...')
    
    const { data: builds, error } = await supabaseAdmin
      .from('apk_builds')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      throw new Error(`Erro ao buscar builds: ${error.message}`)
    }

    return NextResponse.json({
      success: true,
      message: 'Builds listadas com sucesso',
      data: builds
    })

  } catch (error) {
    console.error('❌ Erro ao listar builds:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido',
      message: 'Falha ao listar builds'
    }, { status: 500 })
  }
}
