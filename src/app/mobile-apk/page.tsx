'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  Download, 
  Smartphone, 
  CheckCircle, 
  AlertTriangle,
  HardDrive,
  Calendar,
  ExternalLink,
  ArrowDown
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'

interface AppVersion {
  id: string
  version: string
  build_number: number
  release_notes: string
  download_url: string
  file_size: number
  is_mandatory: boolean
  is_active: boolean
  created_at: string
  updated_at: string
}

export default function MobileApkPage() {
  const [latestVersion, setLatestVersion] = useState<AppVersion | null>(null)
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState(false)
  const [autoDownloadStarted, setAutoDownloadStarted] = useState(false)

  const handleDownload = useCallback(async (version: AppVersion) => {
    try {
      setDownloading(true)
      setAutoDownloadStarted(true)
      
      // Criar elemento de link temporário para download
      const link = document.createElement('a')
      link.href = version.download_url
      link.download = `PSE-v${version.version}.apk`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      
      toast.success(`Download iniciado: PSE v${version.version}`)
    } catch (error) {
      console.error('Erro no download:', error)
      toast.error('Erro ao iniciar download')
    } finally {
      setDownloading(false)
    }
  }, [])

  useEffect(() => {
    loadLatestVersion()
  }, [])

  useEffect(() => {
    // Auto download após 3 segundos se não foi iniciado manualmente
    if (latestVersion && !autoDownloadStarted) {
      const timer = setTimeout(() => {
        // Chama handleDownload diretamente para evitar dependência circular
        if (latestVersion && !autoDownloadStarted) {
          setAutoDownloadStarted(true)
          handleDownload(latestVersion)
        }
      }, 3000)

      return () => clearTimeout(timer)
    }
  }, [latestVersion, autoDownloadStarted, handleDownload])

  const loadLatestVersion = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('app_versions')
        .select('*')
        .eq('is_active', true)
        .order('build_number', { ascending: false })
        .limit(1)
        .single()

      if (error) {
        console.error('Erro ao carregar versão:', error)
        toast.error('Erro ao carregar versão do app')
        return
      }

      if (data) {
        setLatestVersion(data)
      }
    } catch (error) {
      console.error('Erro ao carregar versão:', error)
      toast.error('Erro ao carregar versão do app')
    } finally {
      setLoading(false)
    }
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
  }

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 shadow-2xl max-w-sm w-full text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 text-lg">Carregando...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 to-indigo-700 p-4">
      <div className="max-w-md mx-auto space-y-6">
        
        {/* Header */}
        <div className="text-center text-white space-y-4 pt-8">
          <div className="flex items-center justify-center">
            <Smartphone className="h-16 w-16 text-white" />
          </div>
          <h1 className="text-3xl font-bold">PSE Mobile</h1>
          <p className="text-blue-100 text-lg">Sistema de Gestão de Frota</p>
        </div>

        {/* Versão Atual */}
        {latestVersion && (
          <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
            <div className="bg-gradient-to-r from-green-500 to-emerald-600 p-4 text-white text-center">
              <div className="flex items-center justify-center space-x-2 mb-2">
                <CheckCircle className="h-6 w-6" />
                <span className="text-lg font-semibold">Versão Mais Recente</span>
              </div>
              <div className="text-2xl font-bold">v{latestVersion.version}</div>
              <div className="text-green-100 text-sm">Build {latestVersion.build_number}</div>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex items-center space-x-2">
                  <HardDrive className="h-4 w-4 text-gray-500" />
                  <span>{formatFileSize(latestVersion.file_size)}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Calendar className="h-4 w-4 text-gray-500" />
                  <span>{formatDate(latestVersion.created_at)}</span>
                </div>
              </div>

              {latestVersion.release_notes && (
                <div className="bg-gray-50 p-4 rounded-xl">
                  <h4 className="font-semibold text-gray-900 mb-2">Novidades:</h4>
                  <p className="text-gray-700 text-sm whitespace-pre-wrap">{latestVersion.release_notes}</p>
                </div>
              )}

              {latestVersion.is_mandatory && (
                <Alert className="border-orange-200 bg-orange-50">
                  <AlertTriangle className="h-4 w-4 text-orange-600" />
                  <AlertDescription className="text-orange-800 text-sm">
                    Atualização obrigatória. Instale imediatamente.
                  </AlertDescription>
                </Alert>
              )}

              {!autoDownloadStarted && (
                <div className="text-center">
                  <div className="text-sm text-gray-500 mb-3">
                    Download automático em 3 segundos...
                  </div>
                  <div className="animate-bounce">
                    <ArrowDown className="h-6 w-6 text-blue-600 mx-auto" />
                  </div>
                </div>
              )}

              <div className="space-y-3">
                <Button 
                  onClick={() => handleDownload(latestVersion)}
                  disabled={downloading}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white h-14 text-lg rounded-xl"
                >
                  {downloading ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                      Baixando...
                    </>
                  ) : (
                    <>
                      <Download className="h-5 w-5 mr-2" />
                      Baixar APK
                    </>
                  )}
                </Button>
                
                <Button 
                  variant="outline" 
                  onClick={() => window.open(latestVersion.download_url, '_blank')}
                  className="w-full h-12 rounded-xl"
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Link Direto
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Instruções Simplificadas */}
        <div className="bg-white rounded-2xl shadow-xl p-6">
          <h3 className="font-bold text-gray-900 mb-4 text-center">📱 Como Instalar</h3>
          <div className="space-y-3 text-sm">
            <div className="flex items-start space-x-3">
              <div className="bg-blue-100 text-blue-600 rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">1</div>
              <span>Baixe o arquivo APK</span>
            </div>
            <div className="flex items-start space-x-3">
              <div className="bg-blue-100 text-blue-600 rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">2</div>
              <span>Abra o arquivo baixado</span>
            </div>
            <div className="flex items-start space-x-3">
              <div className="bg-blue-100 text-blue-600 rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">3</div>
              <span>Permita instalação de apps desconhecidos</span>
            </div>
            <div className="flex items-start space-x-3">
              <div className="bg-blue-100 text-blue-600 rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">4</div>
              <span>Toque em &quot;Instalar&quot; e aguarde</span>
            </div>
          </div>
        </div>

        {/* Botão para versão desktop */}
        <div className="text-center">
          <Button 
            variant="ghost" 
            onClick={() => window.open('/download-apk', '_blank')}
            className="text-white hover:bg-white/10 rounded-xl"
          >
            Ver versão completa
          </Button>
        </div>

        {/* Footer */}
        <div className="text-center text-blue-100 text-xs pb-4">
          <p>© 2025 PSE - Sistema de Gestão de Frota</p>
        </div>
      </div>
    </div>
  )
}
