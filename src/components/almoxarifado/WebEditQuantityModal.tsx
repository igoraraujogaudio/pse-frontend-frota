import React, { useState, useEffect } from 'react'
import { useWebAlmoxarifadoPermissions } from '@/hooks/useWebAlmoxarifadoPermissions'

interface ItemEstoque {
  id: string
  codigo: string
  nome: string
  descricao?: string
  categoria: 'epi' | 'ferramental' | 'consumivel' | 'equipamento'
  subcategoria?: string
  unidade_medida: string
  estoque_minimo: number
  estoque_atual: number
  valor_unitario?: number
  fornecedor?: string
  localizacao?: string
  status: 'ativo' | 'inativo' | 'descontinuado'
  requer_certificacao?: boolean
  requer_laudo?: boolean
  validade?: string
  observacoes?: string
  criado_em: string
  atualizado_em: string
}

interface WebEditQuantityModalProps {
  isOpen: boolean
  onClose: () => void
  item: ItemEstoque | null
  onSave: (itemId: string, newQuantity: number, reason: string) => Promise<void>
}

export const WebEditQuantityModal: React.FC<WebEditQuantityModalProps> = ({
  isOpen,
  onClose,
  item,
  onSave
}) => {
  const { canEditItemQuantity } = useWebAlmoxarifadoPermissions()
  const [quantity, setQuantity] = useState('')
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (isOpen && item) {
      setQuantity(item.estoque_atual.toString())
      setReason('')
    }
  }, [isOpen, item])

  const handleSave = async () => {
    if (!item) return

    const newQuantity = parseInt(quantity)
    
    if (isNaN(newQuantity) || newQuantity < 0) {
      alert('Quantidade deve ser um número válido maior ou igual a zero')
      return
    }

    if (!reason.trim()) {
      alert('Motivo da alteração é obrigatório')
      return
    }

    try {
      setLoading(true)
      await onSave(item.id, newQuantity, reason.trim())
      onClose()
    } catch {
      alert('Não foi possível atualizar a quantidade')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    if (!loading) {
      onClose()
    }
  }

  // Se não tem permissão, não renderiza o modal
  if (!canEditItemQuantity()) {
    return null
  }

  if (!isOpen || !item) return null

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        {/* Overlay */}
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={handleClose}></div>

        {/* Modal */}
        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-md sm:w-full">
          {/* Header */}
          <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg leading-6 font-medium text-gray-900">
                Editar Quantidade
              </h3>
              <button
                onClick={handleClose}
                className="text-gray-400 hover:text-gray-600"
                disabled={loading}
              >
                <i className="fas fa-times text-xl"></i>
              </button>
            </div>

            {/* Item Info */}
            <div className="bg-gray-50 p-4 rounded-lg mb-4">
              <h4 className="font-medium text-gray-900 mb-2">{item.nome}</h4>
              <p className="text-sm text-gray-600 mb-1">Código: {item.codigo}</p>
              <p className="text-sm text-blue-600 font-medium">
                Quantidade atual: {item.estoque_atual} {item.unidade_medida}
              </p>
            </div>

            {/* Form */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nova Quantidade *
                </label>
                <div className="flex items-center">
                  <input
                    type="number"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    placeholder="Digite a nova quantidade"
                    min="0"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={loading}
                  />
                  <span className="ml-2 text-sm text-gray-500">{item.unidade_medida}</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Motivo da Alteração *
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Ex: Entrada de material, correção de inventário, etc."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={loading}
                />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
            <button
              onClick={handleSave}
              disabled={loading}
              className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-green-600 text-base font-medium text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <i className="fas fa-spinner fa-spin mr-2"></i>
                  Salvando...
                </>
              ) : (
                <>
                  <i className="fas fa-save mr-2"></i>
                  Salvar
                </>
              )}
            </button>
            <button
              onClick={handleClose}
              disabled={loading}
              className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default WebEditQuantityModal
