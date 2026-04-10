'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  Download, 
  Smartphone, 
  CheckCircle, 
  AlertTriangle,
  ExternalLink,
  ArrowDown,
  RefreshCw,
  Zap,
  HardDrive,
  Calendar
} from 'lucide-react'
import { toast } from 'sonner'

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

export default function ApkPage() {
  const [downloading, setDownloading] = useState(false)
  const [autoDownloadStarted, setAutoDownloadStarted] = useState(false)
  const [countdown, setCountdown] = useState(5)
  const [buildInfo, setBuildInfo] = useState<BuildInfo | null>(null)
  const [loading, setLoading] = useState(true)

  const handleDownload = useCallback(async () => {
    if (!buildInfo) return
    
    try {
      setDownloading(true)
      setAutoDownloadStarted(true)
      
      // Criar elemento de link temporário para download
      const link = document.createElement('a')
      link.href = buildInfo.downloadUrl
      link.download = `PSE-v${buildInfo.version}.apk`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      
      toast.success(`Download iniciado: PSE v${buildInfo.version}`)
    } catch (error) {
      console.error('Erro no download:', error)
      toast.error('Erro ao iniciar download')
    } finally {
      setDownloading(false)
    }
  }, [buildInfo])

  useEffect(() => {
    loadBuildInfo()
  }, [])

  useEffect(() => {
    // Countdown para auto download
    if (countdown > 0 && !autoDownloadStarted && buildInfo) {
      const timer = setTimeout(() => {
        setCountdown(countdown - 1)
      }, 1000)
      return () => clearTimeout(timer)
    } else if (countdown === 0 && !autoDownloadStarted && buildInfo) {
      // Chama handleDownload diretamente para evitar dependência circular
      if (!autoDownloadStarted && buildInfo) {
        setAutoDownloadStarted(true)
        handleDownload()
      }
    }
  }, [countdown, autoDownloadStarted, buildInfo, handleDownload])

  const loadBuildInfo = async () => {
    try {
      setLoading(true)
      
      // Primeiro, tentar fazer download e upload automático da nova versão
      console.log('🔄 Verificando e fazendo upload da nova versão automaticamente...')
      try {
        const uploadResponse = await fetch('/api/download-and-upload-apk', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        })
        
        if (!uploadResponse.ok) {
          throw new Error(`HTTP ${uploadResponse.status}: ${uploadResponse.statusText}`)
        }
        
        const uploadResult = await uploadResponse.json()
        
        if (uploadResult.success) {
          console.log('✅ Nova versão processada automaticamente!')
          console.log('📊 Dados da nova versão:', {
            version: uploadResult.data.version,
            buildNumber: uploadResult.data.buildNumber,
            downloadUrl: uploadResult.data.downloadUrl,
            fileSize: `${(uploadResult.data.fileSize / 1024 / 1024).toFixed(2)}MB`,
            source: uploadResult.source
          })
          
          toast.success(`Nova versão v${uploadResult.data.version} sincronizada com sucesso!`)
        } else {
          console.warn('⚠️ Upload automático falhou:', uploadResult.error)
          console.log('📝 Mensagem:', uploadResult.message)
          // Não mostrar toast de erro para não assustar o usuário
        }
      } catch (uploadError) {
        console.error('❌ Erro no upload automático:', uploadError)
        console.log('🔄 Continuando com versão existente...')
        // Não mostrar toast de erro para não assustar o usuário
      }
      
      // Depois, buscar informações da build (agora atualizada)
      console.log('📋 Buscando informações da build atualizada...')
      const response = await fetch('/api/latest-apk')
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      
      const result = await response.json()
      
      if (result.success) {
        console.log('✅ Informações da build carregadas:', {
          version: result.data.version,
          buildNumber: result.data.buildNumber,
          source: result.source,
          cached: result.cached
        })
        setBuildInfo(result.data)
      } else {
        console.error('❌ Erro na resposta da API:', result.error)
        throw new Error(result.error || 'Erro desconhecido na API')
      }
    } catch (error) {
      console.error('❌ Erro geral ao carregar build info:', error)
      
      // Determinar tipo de erro e mostrar mensagem apropriada
      let errorMessage = 'Erro ao carregar informações da build'
      
      if (error instanceof Error) {
        if (error.message.includes('HTTP 404')) {
          errorMessage = 'API não encontrada. Verifique se o servidor está funcionando.'
        } else if (error.message.includes('HTTP 500')) {
          errorMessage = 'Erro interno do servidor. Tente novamente em alguns minutos.'
        } else if (error.message.includes('Failed to fetch')) {
          errorMessage = 'Erro de conexão. Verifique sua internet.'
        } else {
          errorMessage = error.message
        }
      }
      
      console.log('📝 Mensagem de erro para o usuário:', errorMessage)
      toast.error(errorMessage)
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

  const cancelAutoDownload = () => {
    setAutoDownloadStarted(true)
    setCountdown(0)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 shadow-2xl max-w-sm w-full text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 text-lg">Carregando informações da build...</p>
        </div>
      </div>
    )
  }

  if (!buildInfo) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 shadow-2xl max-w-sm w-full text-center">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <p className="text-gray-600 text-lg mb-4">Erro ao carregar informações da build</p>
          <Button onClick={loadBuildInfo} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Tentar Novamente
          </Button>
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
          <Badge className="bg-green-500 text-white px-3 py-1">
            <Zap className="h-4 w-4 mr-1" />
            Sempre Atualizado
          </Badge>
        </div>

        {/* Versão Atual */}
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          <div className="bg-gradient-to-r from-green-500 to-emerald-600 p-4 text-white text-center">
            <div className="flex items-center justify-center space-x-2 mb-2">
              <CheckCircle className="h-6 w-6" />
              <span className="text-lg font-semibold">Versão Mais Recente</span>
            </div>
            <div className="text-2xl font-bold">v{buildInfo.version}</div>
            <div className="text-green-100 text-sm">Build {buildInfo.buildNumber} • Direto do EAS</div>
          </div>
          
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex items-center space-x-2">
                <HardDrive className="h-4 w-4 text-gray-500" />
                <span>{formatFileSize(buildInfo.fileSize)}</span>
              </div>
              <div className="flex items-center space-x-2">
                <Calendar className="h-4 w-4 text-gray-500" />
                <span>{formatDate(buildInfo.createdAt)}</span>
              </div>
            </div>

            {buildInfo.releaseNotes && (
              <div className="bg-gray-50 p-4 rounded-xl">
                <h4 className="font-semibold text-gray-900 mb-2">Novidades:</h4>
                <p className="text-gray-700 text-sm whitespace-pre-wrap">{buildInfo.releaseNotes}</p>
              </div>
            )}

            <Alert className="border-blue-200 bg-blue-50">
              <RefreshCw className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-800 text-sm">
                <strong>Sempre atualizado!</strong> Este sistema sincroniza automaticamente a nova versão do Expo quando você acessa esta página.
              </AlertDescription>
            </Alert>

            {buildInfo.isMandatory && (
              <Alert className="border-orange-200 bg-orange-50">
                <AlertTriangle className="h-4 w-4 text-orange-600" />
                <AlertDescription className="text-orange-800 text-sm">
                  Atualização obrigatória. Instale imediatamente.
                </AlertDescription>
              </Alert>
            )}

            {!autoDownloadStarted && countdown > 0 && (
              <div className="text-center bg-yellow-50 p-4 rounded-xl border border-yellow-200">
                <div className="text-lg font-bold text-yellow-800 mb-2">
                  Download automático em {countdown}s
                </div>
                <div className="animate-bounce mb-3">
                  <ArrowDown className="h-6 w-6 text-yellow-600 mx-auto" />
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={cancelAutoDownload}
                  className="text-yellow-700 border-yellow-300"
                >
                  Cancelar
                </Button>
              </div>
            )}

            <div className="space-y-3">
              <Button 
                onClick={handleDownload}
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
                onClick={() => window.open(buildInfo.downloadUrl, '_blank')}
                className="w-full h-12 rounded-xl"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Link Direto
              </Button>
            </div>
          </div>
        </div>

        {/* Vantagens do Sistema Automático */}
        <div className="bg-white rounded-2xl shadow-xl p-6">
          <h3 className="font-bold text-gray-900 mb-4 text-center">⚡ Sistema Automático</h3>
          <div className="space-y-3 text-sm">
            <div className="flex items-start space-x-3">
              <div className="bg-green-100 text-green-600 rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">✓</div>
              <span><strong>Sincronização automática:</strong> Sincroniza nova versão do Expo automaticamente</span>
            </div>
            <div className="flex items-start space-x-3">
              <div className="bg-green-100 text-green-600 rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">✓</div>
              <span><strong>URL direta do Expo:</strong> Download direto dos servidores do Expo</span>
            </div>
            <div className="flex items-start space-x-3">
              <div className="bg-green-100 text-green-600 rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">✓</div>
              <span><strong>Zero manutenção:</strong> Funciona sem intervenção manual</span>
            </div>
            <div className="flex items-start space-x-3">
              <div className="bg-green-100 text-green-600 rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">✓</div>
              <span><strong>Cache inteligente:</strong> Evita sincronizações desnecessárias</span>
            </div>
          </div>
        </div>

        {/* Instruções de Instalação */}
        <div className="bg-white rounded-2xl shadow-xl p-6">
          <h3 className="font-bold text-gray-900 mb-4 text-center">📱 Como Instalar</h3>
          <div className="space-y-3 text-sm">
            <div className="flex items-start space-x-3">
              <div className="bg-blue-100 text-blue-600 rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">1</div>
              <span>Baixe o arquivo APK (download automático em 5s)</span>
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
          
          <Alert className="mt-4 border-orange-200 bg-orange-50">
            <AlertTriangle className="h-4 w-4 text-orange-600" />
            <AlertDescription className="text-orange-800 text-sm">
              <strong>Importante:</strong> Desinstale versões antigas antes de instalar a nova.
            </AlertDescription>
          </Alert>
        </div>

        {/* QR Code para compartilhar */}
        <div className="bg-white rounded-2xl shadow-xl p-6 text-center">
          <h3 className="font-bold text-gray-900 mb-4">📱 Compartilhar</h3>
          <p className="text-sm text-gray-600 mb-4">
            Compartilhe este link com sua equipe:
          </p>
          <div className="bg-gray-100 p-3 rounded-lg text-xs font-mono break-all">
            {typeof window !== 'undefined' ? window.location.href : 'https://seu-site.com/apk'}
          </div>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => {
              navigator.clipboard.writeText(window.location.href)
              toast.success('Link copiado!')
            }}
            className="mt-3"
          >
            Copiar Link
          </Button>
        </div>

        {/* Footer */}
        <div className="text-center text-blue-100 text-xs pb-4">
          <p>© 2025 PSE - Sistema de Gestão de Frota</p>
          <p className="mt-1">Powered by Expo EAS + Supabase Storage</p>
          <p className="mt-1">🔄 Download e Upload Automático</p>
        </div>
      </div>
    </div>
  )
}
