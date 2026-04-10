'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  Upload, 
  FileText, 
  UserCheck, 
  Car, 
  X, 
  Download,
  Calendar
} from 'lucide-react'
import { documentService, DocumentInfo } from '@/services/documentService'

interface DocumentUploadSectionProps {
  userId: string
  onDocumentsChange?: (documents: DocumentInfo[]) => void
}

export default function DocumentUploadSection({ userId, onDocumentsChange }: DocumentUploadSectionProps) {
  const [harFile, setHarFile] = useState<File | null>(null)
  const [cnhFile, setCnhFile] = useState<File | null>(null)
  const [harNumero, setHarNumero] = useState('')
  const [cnhNumero, setCnhNumero] = useState('')
  const [harVencimento, setHarVencimento] = useState('')
  const [cnhVencimento, setCnhVencimento] = useState('')
  const [uploading, setUploading] = useState(false)
  const [documents, setDocuments] = useState<DocumentInfo[]>([])
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const handleFileChange = (file: File | null, type: 'har' | 'cnh') => {
    if (type === 'har') {
      setHarFile(file)
    } else {
      setCnhFile(file)
    }
  }

  const handleUpload = async (type: 'har' | 'cnh') => {
    try {
      setUploading(true)
      setError('')
      setSuccess('')

      let file: File | null
      let numero: string
      let vencimento: string

      if (type === 'har') {
        file = harFile
        numero = harNumero
        vencimento = harVencimento
      } else {
        file = cnhFile
        numero = cnhNumero
        vencimento = cnhVencimento
      }

      if (!file) {
        setError(`Selecione um arquivo para ${type.toUpperCase()}`)
        return
      }

      if (!numero.trim()) {
        setError(`Digite o número do ${type.toUpperCase()}`)
        return
      }

      if (!vencimento) {
        setError(`Selecione a data de vencimento do ${type.toUpperCase()}`)
        return
      }

      const uploadedDoc = await documentService.uploadDocument({
        user_id: userId,
        tipo: type,
        numero: numero.trim(),
        arquivo: file,
        vencimento: vencimento
      })

      // Adicionar à lista de documentos
      const newDocuments = [...documents, uploadedDoc]
      setDocuments(newDocuments)
      onDocumentsChange?.(newDocuments)

      // Limpar campos
      if (type === 'har') {
        setHarFile(null)
        setHarNumero('')
        setHarVencimento('')
      } else {
        setCnhFile(null)
        setCnhNumero('')
        setCnhVencimento('')
      }

      setSuccess(`${type.toUpperCase()} enviado com sucesso!`)
      
      // Limpar mensagem de sucesso após 3 segundos
      setTimeout(() => setSuccess(''), 3000)

    } catch (error) {
      console.error(`Erro no upload do ${type}:`, error)
      setError(`Erro ao enviar ${type.toUpperCase()}: ${error instanceof Error ? error.message : 'Erro desconhecido'}`)
    } finally {
      setUploading(false)
    }
  }

  const handleDeleteDocument = async (documentId: string) => {
    try {
      await documentService.deleteDocument(documentId)
      const newDocuments = documents.filter(doc => doc.id !== documentId)
      setDocuments(newDocuments)
      onDocumentsChange?.(newDocuments)
      setSuccess('Documento deletado com sucesso!')
      setTimeout(() => setSuccess(''), 3000)
    } catch (error) {
      console.error('Erro ao deletar documento:', error)
      setError('Erro ao deletar documento')
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'vigente':
        return 'bg-green-100 text-green-800'
      case 'vencendo':
        return 'bg-yellow-100 text-yellow-800'
      case 'vencido':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'vigente':
        return <FileText className="h-4 w-4 text-green-600" />
      case 'vencendo':
        return <Calendar className="h-4 w-4 text-yellow-600" />
      case 'vencido':
        return <X className="h-4 w-4 text-red-600" />
      default:
        return <FileText className="h-4 w-4 text-gray-600" />
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Documentos de Habilitação
        </CardTitle>
        <CardDescription>
          Upload de HAR (Habilitação para Operação de Equipamentos) e CNH (Carteira Nacional de Habilitação)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Mensagens de feedback */}
        {error && (
          <Alert variant="destructive">
            <X className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {success && (
          <Alert>
            <FileText className="h-4 w-4" />
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        )}

        {/* Upload HAR */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <UserCheck className="h-5 w-5 text-blue-600" />
            <h3 className="text-lg font-medium">HAR - Habilitação para Operação de Equipamentos</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="har-file">Arquivo</Label>
              <Input
                id="har-file"
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={(e) => handleFileChange(e.target.files?.[0] || null, 'har')}
                className="mt-1"
              />
            </div>
            
            <div>
              <Label htmlFor="har-numero">Número HAR</Label>
              <Input
                id="har-numero"
                placeholder="Ex: HAR-001"
                value={harNumero}
                onChange={(e) => setHarNumero(e.target.value)}
                className="mt-1"
              />
            </div>
            
            <div>
              <Label htmlFor="har-vencimento">Data de Vencimento</Label>
              <Input
                id="har-vencimento"
                type="date"
                value={harVencimento}
                onChange={(e) => setHarVencimento(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>
          
          <Button 
            onClick={() => handleUpload('har')} 
            disabled={uploading || !harFile || !harNumero || !harVencimento}
            className="w-full md:w-auto"
          >
            <Upload className="h-4 w-4 mr-2" />
            {uploading ? 'Enviando...' : 'Enviar HAR'}
          </Button>
        </div>

        {/* Upload CNH */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Car className="h-5 w-5 text-green-600" />
            <h3 className="text-lg font-medium">CNH - Carteira Nacional de Habilitação</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="cnh-file">Arquivo</Label>
              <Input
                id="cnh-file"
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={(e) => handleFileChange(e.target.files?.[0] || null, 'cnh')}
                className="mt-1"
              />
            </div>
            
            <div>
              <Label htmlFor="cnh-numero">Número CNH</Label>
              <Input
                id="cnh-numero"
                placeholder="Ex: 12345678901"
                value={cnhNumero}
                onChange={(e) => setCnhNumero(e.target.value)}
                className="mt-1"
              />
            </div>
            
            <div>
              <Label htmlFor="cnh-vencimento">Data de Vencimento</Label>
              <Input
                id="cnh-vencimento"
                type="date"
                value={cnhVencimento}
                onChange={(e) => setCnhVencimento(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>
          
          <Button 
            onClick={() => handleUpload('cnh')} 
            disabled={uploading || !cnhFile || !cnhNumero || !cnhVencimento}
            className="w-full md:w-auto"
          >
            <Upload className="h-4 w-4 mr-2" />
            {uploading ? 'Enviando...' : 'Enviar CNH'}
          </Button>
        </div>

        {/* Lista de documentos enviados */}
        {documents.length > 0 && (
          <div className="space-y-3">
            <h4 className="font-medium">Documentos Enviados</h4>
            <div className="space-y-2">
              {documents.map((doc) => (
                <div key={doc.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(doc.status)}
                    <div>
                      <p className="font-medium">
                        {doc.tipo.toUpperCase()}: {doc.numero}
                      </p>
                      <p className="text-sm text-gray-600">
                        Vence: {new Date(doc.vencimento).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Badge className={getStatusColor(doc.status)}>
                      {doc.status}
                    </Badge>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(doc.arquivo_url, '_blank')}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDeleteDocument(doc.id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
