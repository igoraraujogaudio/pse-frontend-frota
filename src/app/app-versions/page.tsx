'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  Upload, 
  Download, 
  Trash2, 
  Eye, 
  CheckCircle, 
  AlertTriangle,
  FileText,
  Calendar,
  HardDrive,
  Shield
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import AdminRoute from '@/components/AdminRoute'
import { useAuth } from '@/contexts/AuthContext'

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

export default function AppVersionsPage() {
  const { user } = useAuth()
  const [versions, setVersions] = useState<AppVersion[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [formData, setFormData] = useState({
    version: '',
    build_number: '',
    release_notes: '',
    is_mandatory: false,
    is_active: true
  })
  const [showUploadForm, setShowUploadForm] = useState(false)

  useEffect(() => {
    loadVersions()
  }, [])

  const loadVersions = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('app_versions')
        .select('*')
        .order('build_number', { ascending: false })

      if (error) {
        console.error('Erro ao carregar versões:', error)
        toast.error('Erro ao carregar versões')
        return
      }

      setVersions(data || [])
    } catch (error) {
      console.error('Erro ao carregar versões:', error)
      toast.error('Erro ao carregar versões')
    } finally {
      setLoading(false)
    }
  }

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      if (file.type !== 'application/vnd.android.package-archive') {
        toast.error('Por favor, selecione um arquivo APK válido')
        return
      }
      setSelectedFile(file)
    }
  }

  const uploadFile = async (file: File): Promise<string> => {
    const fileName = `app-${formData.version}-${formData.build_number}.apk`
    
    try {
      const { error } = await supabase.storage
        .from('apk-files')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        })

      if (error) {
        console.error('Erro detalhado do Supabase:', error)
        throw new Error(`Erro no upload: ${error.message}`)
      }

      const { data: { publicUrl } } = supabase.storage
        .from('apk-files')
        .getPublicUrl(fileName)

      return publicUrl
    } catch (error) {
      console.error('Erro no upload do arquivo:', error)
      throw error
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Verificação adicional de admin no frontend
    if (!user || user.nivel_acesso !== 'admin') {
      toast.error('Acesso negado: apenas administradores podem fazer upload de APKs')
      return
    }
    
    if (!selectedFile) {
      toast.error('Por favor, selecione um arquivo APK')
      return
    }

    if (!formData.version || !formData.build_number) {
      toast.error('Por favor, preencha todos os campos obrigatórios')
      return
    }

    try {
      setUploading(true)
      setUploadProgress(0)

      // Simular progresso de upload
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval)
            return prev
          }
          return prev + 10
        })
      }, 200)

      // Upload do arquivo
      const downloadUrl = await uploadFile(selectedFile)
      
      setUploadProgress(100)

      // Salvar informações da versão
      const { error } = await supabase
        .from('app_versions')
        .insert({
          version: formData.version,
          build_number: parseInt(formData.build_number),
          release_notes: formData.release_notes,
          download_url: downloadUrl,
          file_size: selectedFile.size,
          is_mandatory: formData.is_mandatory,
          is_active: formData.is_active
        })

      if (error) {
        throw new Error(`Erro ao salvar versão: ${error.message}`)
      }

      toast.success('Versão criada com sucesso!')
      
      // Resetar formulário
      setFormData({
        version: '',
        build_number: '',
        release_notes: '',
        is_mandatory: false,
        is_active: true
      })
      setSelectedFile(null)
      setUploadProgress(0)
      
      // Recarregar lista
      await loadVersions()

    } catch (error) {
      console.error('Erro ao criar versão:', error)
      toast.error(`Erro: ${error instanceof Error ? error.message : 'Erro desconhecido'}`)
    } finally {
      setUploading(false)
    }
  }

  const toggleVersionStatus = async (id: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from('app_versions')
        .update({ is_active: !isActive })
        .eq('id', id)

      if (error) {
        throw new Error(`Erro ao atualizar status: ${error.message}`)
      }

      toast.success(`Versão ${!isActive ? 'ativada' : 'desativada'} com sucesso!`)
      await loadVersions()
    } catch (error) {
      console.error('Erro ao atualizar status:', error)
      toast.error(`Erro: ${error instanceof Error ? error.message : 'Erro desconhecido'}`)
    }
  }

  const deleteVersion = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta versão?')) {
      return
    }

    try {
      const { error } = await supabase
        .from('app_versions')
        .delete()
        .eq('id', id)

      if (error) {
        throw new Error(`Erro ao excluir versão: ${error.message}`)
      }

      toast.success('Versão excluída com sucesso!')
      await loadVersions()
    } catch (error) {
      console.error('Erro ao excluir versão:', error)
      toast.error(`Erro: ${error instanceof Error ? error.message : 'Erro desconhecido'}`)
    }
  }

  const formatFileSize = (bytes: number): string => {
    const mb = bytes / (1024 * 1024)
    return `${mb.toFixed(1)} MB`
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

  return (
    <AdminRoute>
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <Shield className="h-8 w-8 text-blue-600" />
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Controle de Versões</h1>
                <p className="text-gray-600 mt-2">Gerencie as versões do aplicativo mobile</p>
              </div>
            </div>
          </div>
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => window.open('/download-apk', '_blank')}
              className="flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              Página Pública
            </Button>
            <Button
              onClick={() => setShowUploadForm(!showUploadForm)}
              className="flex items-center gap-2"
            >
              <Upload className="h-4 w-4" />
              {showUploadForm ? 'Ocultar Upload' : 'Novo Upload'}
            </Button>
          </div>
        </div>

        {/* Alerta de Segurança */}
        <Alert className="border-amber-200 bg-amber-50">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800">
            <strong>Área Restrita:</strong> Esta página é acessível apenas para administradores. 
            Todas as ações são registradas e monitoradas.
          </AlertDescription>
        </Alert>

      {/* Formulário de Upload */}
      {showUploadForm && (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Nova Versão
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="version">Versão *</Label>
                <Input
                  id="version"
                  placeholder="Ex: 1.2.0"
                  value={formData.version}
                  onChange={(e) => setFormData(prev => ({ ...prev, version: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="build_number">Número do Build *</Label>
                <Input
                  id="build_number"
                  type="number"
                  placeholder="Ex: 123"
                  value={formData.build_number}
                  onChange={(e) => setFormData(prev => ({ ...prev, build_number: e.target.value }))}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="release_notes">Notas da Versão</Label>
              <Textarea
                id="release_notes"
                placeholder="Descreva as principais mudanças desta versão..."
                value={formData.release_notes}
                onChange={(e) => setFormData(prev => ({ ...prev, release_notes: e.target.value }))}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="apk_file">Arquivo APK *</Label>
              <Input
                id="apk_file"
                type="file"
                accept=".apk"
                onChange={handleFileSelect}
                required
              />
              {selectedFile && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <FileText className="h-4 w-4" />
                  <span>{selectedFile.name}</span>
                  <span>({formatFileSize(selectedFile.size)})</span>
                </div>
              )}
            </div>

            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Switch
                  id="is_mandatory"
                  checked={formData.is_mandatory}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_mandatory: checked }))}
                />
                <Label htmlFor="is_mandatory">Atualização Obrigatória</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="is_active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_active: checked }))}
                />
                <Label htmlFor="is_active">Ativo</Label>
              </div>
            </div>

            {uploading && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Enviando arquivo...</span>
                  <span>{uploadProgress}%</span>
                </div>
                <Progress value={uploadProgress} className="w-full" />
              </div>
            )}

            <Button type="submit" disabled={uploading} className="w-full">
              {uploading ? 'Enviando...' : 'Criar Versão'}
            </Button>
          </form>
        </CardContent>
      </Card>
      )}

      {/* Lista de Versões */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Versões Disponíveis
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : versions.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              Nenhuma versão encontrada
            </div>
          ) : (
            <div className="space-y-4">
              {versions.map((version) => (
                <div
                  key={version.id}
                  className="border rounded-lg p-4 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div>
                        <h3 className="font-semibold text-lg">v{version.version}</h3>
                        <p className="text-sm text-gray-600">Build {version.build_number}</p>
                      </div>
                      <div className="flex gap-2">
                        {version.is_active && (
                          <Badge variant="default" className="bg-green-100 text-green-800">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Ativo
                          </Badge>
                        )}
                        {version.is_mandatory && (
                          <Badge variant="destructive">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            Obrigatória
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toggleVersionStatus(version.id, version.is_active)}
                      >
                        {version.is_active ? 'Desativar' : 'Ativar'}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => deleteVersion(version.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {version.release_notes && (
                    <div className="bg-gray-50 p-3 rounded-md">
                      <p className="text-sm text-gray-700">{version.release_notes}</p>
                    </div>
                  )}

                  <div className="flex items-center gap-4 text-sm text-gray-600">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      <span>{formatDate(version.created_at)}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <HardDrive className="h-4 w-4" />
                      <span>{formatFileSize(version.file_size)}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Download className="h-4 w-4" />
                      <a
                        href={version.download_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800"
                      >
                        Download
                      </a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      </div>
    </AdminRoute>
  )
}
