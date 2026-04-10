import React, { useState } from 'react'
import Image from 'next/image'
import { 
  DocumentArrowUpIcon, 
  EyeIcon,
  TrashIcon,
  DocumentIcon,
  PhotoIcon,
  FolderIcon
} from '@heroicons/react/24/outline'
import { MaintenanceAttachment } from '../../types'
import { MaintenanceAttachmentUpload } from './MaintenanceAttachmentUpload'
import { MaintenanceAttachmentService } from '../../services/maintenanceAttachmentService'

interface MaintenanceAttachmentManagerProps {
  maintenanceId: string
  attachments: MaintenanceAttachment[]
  onAttachmentAdded: (attachment: MaintenanceAttachment) => void
  onAttachmentDeleted: (attachmentId: string) => void
}

export const MaintenanceAttachmentManager: React.FC<MaintenanceAttachmentManagerProps> = ({
  maintenanceId,
  attachments,
  onAttachmentAdded,
  onAttachmentDeleted
}) => {
  const [selectedAttachment, setSelectedAttachment] = useState<MaintenanceAttachment | null>(null)

  const getCategoryIcon = (attachment: MaintenanceAttachment) => {
    switch (attachment.categoria) {
      case 'imagem': return PhotoIcon
      case 'nota_fiscal': return DocumentIcon
      case 'documento': return DocumentIcon
      case 'outros': return FolderIcon
      default: return DocumentIcon
    }
  }

  const getCategoryLabel = (attachment: MaintenanceAttachment) => {
    switch (attachment.categoria) {
      case 'imagem': return 'Imagem'
      case 'nota_fiscal': return 'Nota Fiscal'
      case 'documento': return 'Documento'
      case 'outros': return 'Outros'
      default: return 'Arquivo'
    }
  }

  const getCategoryColor = (attachment: MaintenanceAttachment) => {
    switch (attachment.categoria) {
      case 'imagem': return 'bg-green-100 text-green-800'
      case 'nota_fiscal': return 'bg-blue-100 text-blue-800'
      case 'documento': return 'bg-purple-100 text-purple-800'
      case 'outros': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString)
      return date.toLocaleDateString('pt-BR')
    } catch {
      return 'Data inválida'
    }
  }

  const handleViewAttachment = (attachment: MaintenanceAttachment) => {
    setSelectedAttachment(attachment)
  }

  const handleDeleteAttachment = async (attachmentId: string) => {
    if (confirm('Tem certeza que deseja excluir este anexo?')) {
      try {
        await MaintenanceAttachmentService.removeAttachmentAndFile(attachmentId)
        onAttachmentDeleted(attachmentId)
        alert('Anexo excluído com sucesso!')
      } catch (error) {
        console.error('Erro ao excluir anexo:', error)
        alert('Não foi possível excluir o anexo')
      }
    }
  }

  const groupedAttachments = attachments.reduce((groups, attachment) => {
    const category = attachment.categoria || 'outros'
    if (!groups[category]) {
      groups[category] = []
    }
    groups[category].push(attachment)
    return groups
  }, {} as Record<string, MaintenanceAttachment[]>)

  const categoryOrder = ['imagem', 'nota_fiscal', 'documento', 'outros']

  if (attachments.length === 0) {
    return (
      <div className="border border-gray-200 rounded-lg p-6">
        <div className="text-center">
          <DocumentArrowUpIcon className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">Nenhum anexo</h3>
          <p className="mt-1 text-sm text-gray-500">
            Adicione documentos, imagens ou notas fiscais relacionados à manutenção.
          </p>
          <div className="mt-6">
            <MaintenanceAttachmentUpload
              maintenanceId={maintenanceId}
              onAttachmentUploaded={onAttachmentAdded}
              existingAttachments={attachments}
            />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium text-gray-900">
          Anexos ({attachments.length})
        </h3>
        <MaintenanceAttachmentUpload
          maintenanceId={maintenanceId}
          onAttachmentUploaded={onAttachmentAdded}
          existingAttachments={attachments}
        />
      </div>

      {/* Attachments by Category */}
      {categoryOrder.map(category => {
        const categoryAttachments = groupedAttachments[category]
        if (!categoryAttachments || categoryAttachments.length === 0) return null

        return (
          <div key={category} className="space-y-3">
            <h4 className="text-sm font-medium text-gray-700 uppercase tracking-wide">
              {getCategoryLabel({ categoria: category } as MaintenanceAttachment)}s
            </h4>
            <div className="grid grid-cols-1 gap-3">
              {categoryAttachments.map((attachment) => {
                const IconComponent = getCategoryIcon(attachment)
                return (
                  <div
                    key={attachment.id}
                    className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
                  >
                    <div className="flex items-center space-x-4 flex-1 min-w-0">
                      <div className="flex-shrink-0">
                        <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                          <IconComponent className="h-5 w-5 text-gray-600" />
                        </div>
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {attachment.nome}
                        </p>
                        {attachment.descricao && (
                          <p className="text-sm text-gray-500 truncate">
                            {attachment.descricao}
                          </p>
                        )}
                        <div className="flex items-center space-x-4 mt-1">
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getCategoryColor(attachment)}`}>
                            {getCategoryLabel(attachment)}
                          </span>
                          <span className="text-xs text-gray-500">
                            {formatFileSize(attachment.tamanho)}
                          </span>
                          <span className="text-xs text-gray-500">
                            {formatDate(attachment.criado_em)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleViewAttachment(attachment)}
                        className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                        title="Visualizar"
                      >
                        <EyeIcon className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteAttachment(attachment.id)}
                        className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                        title="Excluir"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}

      {/* Attachment Viewer Modal */}
      {selectedAttachment && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">
                {selectedAttachment.nome}
              </h3>
              <button
                onClick={() => setSelectedAttachment(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getCategoryColor(selectedAttachment)}`}>
                  {getCategoryLabel(selectedAttachment)}
                </span>
                <span className="text-sm text-gray-500">
                  {formatFileSize(selectedAttachment.tamanho)}
                </span>
                <span className="text-sm text-gray-500">
                  {formatDate(selectedAttachment.criado_em)}
                </span>
              </div>
              
              {selectedAttachment.descricao && (
                <p className="text-sm text-gray-700">
                  <strong>Descrição:</strong> {selectedAttachment.descricao}
                </p>
              )}
              
              <div className="text-center">
                {selectedAttachment.categoria === 'imagem' ? (
                  <Image
                    src={selectedAttachment.url}
                    alt={selectedAttachment.nome}
                    width={400}
                    height={300}
                    className="max-w-full max-h-96 mx-auto rounded-lg shadow-sm"
                    style={{ objectFit: 'contain' }}
                  />
                ) : (
                  <div className="border border-gray-200 rounded-lg p-8">
                    <DocumentIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600 mb-4">
                      Visualização não disponível para este tipo de arquivo
                    </p>
                    <a
                      href={selectedAttachment.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
                    >
                      Abrir Arquivo
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
