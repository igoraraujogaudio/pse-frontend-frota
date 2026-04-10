import React, { useState, useRef } from 'react'
import { 
  DocumentArrowUpIcon, 
  XMarkIcon,
  FolderIcon,
  DocumentTextIcon,
  PhotoIcon
} from '@heroicons/react/24/outline'
import { MaintenanceAttachment } from '../../types'
import { MaintenanceAttachmentService } from '../../services/maintenanceAttachmentService'

interface MaintenanceAttachmentUploadProps {
  maintenanceId: string
  onAttachmentUploaded: (attachment: MaintenanceAttachment) => void
  existingAttachments?: MaintenanceAttachment[]
}

const ATTACHMENT_CATEGORIES = [
  { key: 'imagem', label: 'Imagens', icon: PhotoIcon, description: 'Fotos da manutenção' },
  { key: 'nota_fiscal', label: 'Nota Fiscal', icon: DocumentTextIcon, description: 'NFs e comprovantes' },
  { key: 'documento', label: 'Documentos', icon: DocumentTextIcon, description: 'PDFs e documentos' },
  { key: 'outros', label: 'Outros', icon: FolderIcon, description: 'Outros arquivos' }
] as const

export const MaintenanceAttachmentUpload: React.FC<MaintenanceAttachmentUploadProps> = ({
  maintenanceId,
  onAttachmentUploaded,
}) => {
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<string>('')
  const [description, setDescription] = useState('')
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleCategorySelect = (category: string) => {
    setSelectedCategory(category)
  }

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (files && files.length > 0) {
      handleUpload(files[0])
    }
  }

  const handleUpload = async (file: File) => {
    if (!selectedCategory) {
      alert('Selecione uma categoria primeiro')
      return
    }

    try {
      setUploading(true)
      
      // Fazer upload real para o backend
      const attachment = await uploadToBackend(file)
      
      onAttachmentUploaded(attachment)
      setShowUploadModal(false)
      setSelectedCategory('')
      setDescription('')
      
      // Limpar input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
      
      alert('Anexo adicionado com sucesso!')
    } catch (error) {
      console.error('Erro no upload:', error)
      alert('Não foi possível fazer o upload do arquivo')
    } finally {
      setUploading(false)
    }
  }

  const uploadToBackend = async (file: File) => {
    try {
      const attachment = await MaintenanceAttachmentService.uploadAndAddAttachment(
        file,
        maintenanceId,
        selectedCategory,
        description || undefined
      )
      
      return attachment
    } catch (error) {
      console.error('Erro no upload:', error)
      throw error
    }
  }


  const renderCategorySelection = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900">
        Categoria do Anexo
      </h3>
      <div className="grid grid-cols-2 gap-3">
        {ATTACHMENT_CATEGORIES.map((category) => {
          const IconComponent = category.icon
          return (
            <button
              key={category.key}
              type="button"
              onClick={() => handleCategorySelect(category.key)}
              className={`
                relative flex flex-col items-center p-4 rounded-lg border-2 transition-all
                ${selectedCategory === category.key
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                }
              `}
            >
              <IconComponent className="h-8 w-8 mb-2" />
              <span className="font-medium text-sm">{category.label}</span>
              <span className="text-xs text-gray-500 mt-1">{category.description}</span>
            </button>
          )
        })}
      </div>
    </div>
  )

  const renderUploadSection = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900">
        Escolha o arquivo
      </h3>
      
      <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
        <div className="text-center">
          <DocumentArrowUpIcon className="mx-auto h-12 w-12 text-gray-400" />
          <div className="mt-4">
            <label
              htmlFor="file-upload"
              className="cursor-pointer rounded-md bg-white font-medium text-blue-600 hover:text-blue-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-blue-500 focus-within:ring-offset-2"
            >
              <span>Selecionar arquivo</span>
              <input
                ref={fileInputRef}
                id="file-upload"
                name="file-upload"
                type="file"
                className="sr-only"
                onChange={handleFileSelect}
                accept="image/*,.pdf,.doc,.docx,.txt"
              />
            </label>
            <p className="pl-1">ou arraste e solte aqui</p>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            PNG, JPG, PDF, DOC, DOCX até 10MB
          </p>
        </div>
      </div>
    </div>
  )

  return (
    <div>
      <button
        type="button"
        onClick={() => setShowUploadModal(true)}
        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
      >
        <DocumentArrowUpIcon className="h-4 w-4 mr-2" />
        Adicionar Anexo
      </button>

      {showUploadModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              {/* Header */}
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-medium text-gray-900">
                  Adicionar Anexo à Manutenção
                </h3>
                <button
                  onClick={() => setShowUploadModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>

              {/* Content */}
              <div className="space-y-6">
                {renderCategorySelection()}
                
                <div>
                  <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
                    Descrição (opcional)
                  </label>
                  <textarea
                    id="description"
                    rows={3}
                    className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                    placeholder="Descreva o conteúdo do anexo..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>

                {selectedCategory && renderUploadSection()}
              </div>

              {/* Footer */}
              <div className="flex justify-end space-x-3 mt-6 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={!selectedCategory || uploading}
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {uploading ? 'Enviando...' : 'Selecionar Arquivo'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
