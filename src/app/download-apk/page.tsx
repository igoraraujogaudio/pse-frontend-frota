'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  Download, 
  Smartphone, 
  CheckCircle, 
  AlertTriangle,
  FileText,
  Calendar,
  HardDrive,
  Shield,
  ExternalLink
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

export default function DownloadApkPage() {
  const [latestVersion, setLatestVersion] = useState<AppVersion | null>(null)
  const [allVersions, setAllVersions] = useState<AppVersion[]>([])
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState(false)

  useEffect(() => {
    loadVersions()
  }, [])

  const loadVersions = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('app_versions')
        .select('*')
        .eq('is_active', true)
        .order('build_number', { ascending: false })

      if (error) {
        console.error('Erro ao carregar versões:', error)
        toast.error('Erro ao carregar versões do app')
        return
      }

      if (data && data.length > 0) {
        setLatestVersion(data[0])
        setAllVersions(data)
      }
    } catch (error) {
      console.error('Erro ao carregar versões:', error)
      toast.error('Erro ao carregar versões do app')
    } finally {
      setLoading(false)
    }
  }

  const handleDownload = async (version: AppVersion) => {
    try {
      setDownloading(true)
      
      // Criar elemento de link temporário para download
      const link = document.createElement('a')
      link.href = version.download_url
      link.download = `PSE-v${version.version}-build${version.build_number}.apk`
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
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex items-center justify-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-3 text-gray-600">Carregando...</span>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-3 sm:p-4 md:p-6">
      <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6 py-4 sm:py-6">
        
        {/* Header */}
        <div className="text-center space-y-3 sm:space-y-4 px-2">
          <div className="flex items-center justify-center space-x-2 sm:space-x-3">
            <Smartphone className="h-10 w-10 sm:h-12 sm:w-12 text-blue-600" />
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900">PSE Mobile</h1>
          </div>
          <p className="text-lg sm:text-xl text-gray-600">Sistema de Gestão de Frota</p>
          <p className="text-sm sm:text-base text-gray-500">Baixe a versão mais recente do aplicativo</p>
        </div>

        {/* Versão Mais Recente */}
        {latestVersion && (
          <Card className="border-2 border-blue-200 shadow-lg">
            <CardHeader className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-4 sm:p-6">
              <CardTitle className="flex flex-col sm:flex-row items-center justify-center sm:justify-start space-y-2 sm:space-y-0 sm:space-x-2 text-center sm:text-left">
                <div className="flex items-center space-x-2">
                  <CheckCircle className="h-5 w-5 sm:h-6 sm:w-6" />
                  <span className="text-base sm:text-lg">Versão Mais Recente</span>
                </div>
                <Badge variant="secondary" className="bg-white text-blue-600 text-sm sm:text-base">
                  v{latestVersion.version}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4 text-sm">
                <div className="flex items-center justify-center sm:justify-start space-x-2 bg-gray-50 p-2 rounded-lg">
                  <Shield className="h-4 w-4 text-green-600" />
                  <span>Build {latestVersion.build_number}</span>
                </div>
                <div className="flex items-center justify-center sm:justify-start space-x-2 bg-gray-50 p-2 rounded-lg">
                  <HardDrive className="h-4 w-4 text-blue-600" />
                  <span>{formatFileSize(latestVersion.file_size)}</span>
                </div>
                <div className="flex items-center justify-center sm:justify-start space-x-2 bg-gray-50 p-2 rounded-lg sm:col-span-2 md:col-span-1">
                  <Calendar className="h-4 w-4 text-gray-600" />
                  <span className="text-xs sm:text-sm">{formatDate(latestVersion.created_at)}</span>
                </div>
              </div>

              {latestVersion.release_notes && (
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <FileText className="h-4 w-4 text-gray-600" />
                    <span className="font-medium">Novidades desta versão:</span>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <p className="text-gray-700 whitespace-pre-wrap">{latestVersion.release_notes}</p>
                  </div>
                </div>
              )}

              {latestVersion.is_mandatory && (
                <Alert className="border-orange-200 bg-orange-50">
                  <AlertTriangle className="h-4 w-4 text-orange-600" />
                  <AlertDescription className="text-orange-800">
                    Esta é uma atualização obrigatória. Recomendamos instalar imediatamente.
                  </AlertDescription>
                </Alert>
              )}

              <div className="flex flex-col gap-3">
                <Button 
                  onClick={() => handleDownload(latestVersion)}
                  disabled={downloading}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white h-14 sm:h-12 text-base sm:text-lg font-semibold"
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
                  className="w-full h-12 sm:h-10"
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Link Direto
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Instruções de Instalação */}
        <Card>
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="flex items-center justify-center sm:justify-start space-x-2 text-base sm:text-lg">
              <Smartphone className="h-5 w-5" />
              <span>Como Instalar</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
              <div className="space-y-3 bg-blue-50 p-4 rounded-lg">
                <h4 className="font-semibold text-gray-900 text-center sm:text-left">📱 No seu celular:</h4>
                <ol className="space-y-2 text-sm text-gray-700">
                  <li className="flex items-start">
                    <span className="bg-blue-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs mr-2 mt-0.5 flex-shrink-0">1</span>
                    <span>Baixe o arquivo APK</span>
                  </li>
                  <li className="flex items-start">
                    <span className="bg-blue-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs mr-2 mt-0.5 flex-shrink-0">2</span>
                    <span>Abra o arquivo baixado</span>
                  </li>
                  <li className="flex items-start">
                    <span className="bg-blue-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs mr-2 mt-0.5 flex-shrink-0">3</span>
                    <span>Permita instalação de fontes desconhecidas</span>
                  </li>
                  <li className="flex items-start">
                    <span className="bg-blue-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs mr-2 mt-0.5 flex-shrink-0">4</span>
                    <span>Toque em &quot;Instalar&quot;</span>
                  </li>
                  <li className="flex items-start">
                    <span className="bg-blue-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs mr-2 mt-0.5 flex-shrink-0">5</span>
                    <span>Aguarde a instalação concluir</span>
                  </li>
                </ol>
              </div>
              <div className="space-y-3 bg-orange-50 p-4 rounded-lg">
                <h4 className="font-semibold text-gray-900 text-center sm:text-left">⚠️ Importante:</h4>
                <ul className="space-y-2 text-sm text-gray-700">
                  <li className="flex items-start">
                    <span className="text-orange-600 mr-2 flex-shrink-0">•</span>
                    <span>Desinstale versões antigas antes</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-orange-600 mr-2 flex-shrink-0">•</span>
                    <span>Mantenha o WiFi ligado durante o download</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-orange-600 mr-2 flex-shrink-0">•</span>
                    <span>Certifique-se de ter espaço suficiente</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-orange-600 mr-2 flex-shrink-0">•</span>
                    <span>Use apenas este link oficial</span>
                  </li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Versões Anteriores */}
        {allVersions.length > 1 && (
          <Card>
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="text-center sm:text-left text-base sm:text-lg">Versões Anteriores</CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-6">
              <div className="space-y-3">
                {allVersions.slice(1).map((version) => (
                  <div key={version.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-4 bg-gray-50 rounded-lg gap-3">
                    <div className="flex-1">
                      <div className="flex items-center justify-center sm:justify-start space-x-2 mb-1">
                        <span className="font-medium text-base">v{version.version}</span>
                        <Badge variant="outline" className="text-xs">
                          Build {version.build_number}
                        </Badge>
                      </div>
                      <div className="text-xs sm:text-sm text-gray-600 text-center sm:text-left">
                        {formatFileSize(version.file_size)} • {formatDate(version.created_at)}
                      </div>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleDownload(version)}
                      disabled={downloading}
                      className="w-full sm:w-auto h-10"
                    >
                      <Download className="h-4 w-4 mr-1" />
                      Baixar
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Footer */}
        <div className="text-center text-gray-500 text-xs sm:text-sm px-4 pb-4">
          <p className="font-medium">© 2025 PSE - Sistema de Gestão de Frota</p>
          <p className="mt-1">Para suporte técnico, entre em contato com a equipe de TI</p>
        </div>
      </div>
    </div>
  )
}
