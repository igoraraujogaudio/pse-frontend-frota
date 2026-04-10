import React, { useState, useEffect } from 'react'
import { useWebAlmoxarifadoPermissions } from '@/hooks/useWebAlmoxarifadoPermissions'
import { parseBrazilianCurrency, formatBrazilianCurrency, isValidCurrency } from '@/utils/currencyUtils'

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

interface WebCreateItemModalProps {
  isOpen: boolean
  onClose: () => void
  onCreate: (itemData: Partial<ItemEstoque>) => Promise<void>
}

const categories = [
  { label: 'EPI', value: 'epi' },
  { label: 'Ferramental', value: 'ferramental' },
  { label: 'Consumível', value: 'consumivel' },
  { label: 'Equipamento', value: 'equipamento' }
]

const units = [
  { label: 'Unidade', value: 'un' },
  { label: 'Peça', value: 'pc' },
  { label: 'Metro', value: 'm' },
  { label: 'Quilograma', value: 'kg' },
  { label: 'Litro', value: 'l' },
  { label: 'Caixa', value: 'cx' },
  { label: 'Pacote', value: 'pct' }
]

export const WebCreateItemModal: React.FC<WebCreateItemModalProps> = ({
  isOpen,
  onClose,
  onCreate
}) => {
  const { canCreateNewItem } = useWebAlmoxarifadoPermissions()
  const [formData, setFormData] = useState({
    codigo: '',
    nome: '',
    descricao: '',
    categoria: 'epi' as 'epi' | 'ferramental' | 'consumivel' | 'equipamento',
    subcategoria: '',
    unidade_medida: 'un',
    estoque_minimo: '0',
    estoque_atual: '0',
    valor_unitario: '',
    fornecedor: '',
    localizacao: '',
    requer_certificacao: false,
    requer_laudo: false,
    observacoes: ''
  })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (isOpen) {
      // Reset form when modal opens
      setFormData({
        codigo: '',
        nome: '',
        descricao: '',
        categoria: 'epi',
        subcategoria: '',
        unidade_medida: 'un',
        estoque_minimo: '0',
        estoque_atual: '0',
        valor_unitario: '',
        fornecedor: '',
        localizacao: '',
        requer_certificacao: false,
        requer_laudo: false,
        observacoes: ''
      })
    }
  }, [isOpen])

  const handleSave = async () => {
    // Validações
    if (!formData.codigo.trim()) {
      alert('Código é obrigatório')
      return
    }

    if (!formData.nome.trim()) {
      alert('Nome é obrigatório')
      return
    }

    const estoqueMinimo = parseInt(formData.estoque_minimo)
    const estoqueAtual = parseInt(formData.estoque_atual)
    const valorUnitario = formData.valor_unitario ? parseBrazilianCurrency(formData.valor_unitario) : undefined

    if (isNaN(estoqueMinimo) || estoqueMinimo < 0) {
      alert('Estoque mínimo deve ser um número válido maior ou igual a zero')
      return
    }

    if (isNaN(estoqueAtual) || estoqueAtual < 0) {
      alert('Estoque atual deve ser um número válido maior ou igual a zero')
      return
    }

    if (valorUnitario !== undefined && (isNaN(valorUnitario) || valorUnitario < 0)) {
      alert('Valor unitário deve ser um número válido maior ou igual a zero')
      return
    }

    try {
      setLoading(true)
      
      const itemData: Partial<ItemEstoque> = {
        codigo: formData.codigo.trim(),
        nome: formData.nome.trim(),
        descricao: formData.descricao.trim() || undefined,
        categoria: formData.categoria,
        subcategoria: formData.subcategoria.trim() || undefined,
        unidade_medida: formData.unidade_medida,
        estoque_minimo: estoqueMinimo,
        estoque_atual: estoqueAtual,
        valor_unitario: valorUnitario,
        fornecedor: formData.fornecedor.trim() || undefined,
        localizacao: formData.localizacao.trim() || undefined,
        status: 'ativo',
        requer_certificacao: formData.requer_certificacao,
        requer_laudo: formData.requer_laudo,
        observacoes: formData.observacoes.trim() || undefined
      }

      await onCreate(itemData)
      onClose()
    } catch {
      alert('Não foi possível criar o item')
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
  if (!canCreateNewItem()) {
    return null
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        {/* Overlay */}
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={handleClose}></div>

        {/* Modal */}
        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full">
          {/* Header */}
          <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg leading-6 font-medium text-gray-900">
                Criar Novo Item
              </h3>
              <button
                onClick={handleClose}
                className="text-gray-400 hover:text-gray-600"
                disabled={loading}
              >
                <i className="fas fa-times text-xl"></i>
              </button>
            </div>

            {/* Form */}
            <div className="space-y-4">
              {/* Código e Nome */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Código *
                  </label>
                  <input
                    type="text"
                    value={formData.codigo}
                    onChange={(e) => setFormData(prev => ({ ...prev, codigo: e.target.value }))}
                    placeholder="Ex: EPI001"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={loading}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nome *
                  </label>
                  <input
                    type="text"
                    value={formData.nome}
                    onChange={(e) => setFormData(prev => ({ ...prev, nome: e.target.value }))}
                    placeholder="Nome do item"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={loading}
                  />
                </div>
              </div>

              {/* Descrição */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Descrição
                </label>
                <textarea
                  value={formData.descricao}
                  onChange={(e) => setFormData(prev => ({ ...prev, descricao: e.target.value }))}
                  placeholder="Descrição detalhada do item"
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={loading}
                />
              </div>

              {/* Categoria e Subcategoria */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Categoria
                  </label>
                  <select
                    value={formData.categoria}
                    onChange={(e) => setFormData(prev => ({ ...prev, categoria: e.target.value as typeof prev.categoria }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={loading}
                  >
                    {categories.map(cat => (
                      <option key={cat.value} value={cat.value}>{cat.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Subcategoria
                  </label>
                  <input
                    type="text"
                    value={formData.subcategoria}
                    onChange={(e) => setFormData(prev => ({ ...prev, subcategoria: e.target.value }))}
                    placeholder="Ex: Capacete"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={loading}
                  />
                </div>
              </div>

              {/* Unidade e Estoque */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Unidade
                  </label>
                  <select
                    value={formData.unidade_medida}
                    onChange={(e) => setFormData(prev => ({ ...prev, unidade_medida: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={loading}
                  >
                    {units.map(unit => (
                      <option key={unit.value} value={unit.value}>{unit.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Estoque Mínimo
                  </label>
                  <input
                    type="number"
                    value={formData.estoque_minimo}
                    onChange={(e) => setFormData(prev => ({ ...prev, estoque_minimo: e.target.value }))}
                    placeholder="0"
                    min="0"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={loading}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Estoque Atual
                  </label>
                  <input
                    type="number"
                    value={formData.estoque_atual}
                    onChange={(e) => setFormData(prev => ({ ...prev, estoque_atual: e.target.value }))}
                    placeholder="0"
                    min="0"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={loading}
                  />
                </div>
              </div>

              {/* Valor Unitário */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Valor Unitário
                </label>
                <input
                  type="text"
                  value={formData.valor_unitario ? formatBrazilianCurrency(parseBrazilianCurrency(formData.valor_unitario)) : ''}
                  onChange={(e) => {
                    const inputValue = e.target.value
                    if (isValidCurrency(inputValue)) {
                      setFormData(prev => ({ ...prev, valor_unitario: inputValue }))
                    }
                  }}
                  placeholder="0,00"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={loading}
                />
              </div>

              {/* Fornecedor e Localização */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Fornecedor
                  </label>
                  <input
                    type="text"
                    value={formData.fornecedor}
                    onChange={(e) => setFormData(prev => ({ ...prev, fornecedor: e.target.value }))}
                    placeholder="Nome do fornecedor"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={loading}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Localização
                  </label>
                  <input
                    type="text"
                    value={formData.localizacao}
                    onChange={(e) => setFormData(prev => ({ ...prev, localizacao: e.target.value }))}
                    placeholder="Ex: Prateleira A1"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={loading}
                  />
                </div>
              </div>

              {/* Checkboxes */}
              <div className="flex space-x-6">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.requer_certificacao}
                    onChange={(e) => setFormData(prev => ({ ...prev, requer_certificacao: e.target.checked }))}
                    className="mr-2"
                    disabled={loading}
                  />
                  <span className="text-sm text-gray-700">Requer Certificação</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.requer_laudo}
                    onChange={(e) => setFormData(prev => ({ ...prev, requer_laudo: e.target.checked }))}
                    className="mr-2"
                    disabled={loading}
                  />
                  <span className="text-sm text-gray-700">Requer Laudo</span>
                </label>
              </div>

              {/* Observações */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Observações
                </label>
                <textarea
                  value={formData.observacoes}
                  onChange={(e) => setFormData(prev => ({ ...prev, observacoes: e.target.value }))}
                  placeholder="Observações adicionais"
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
              className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <i className="fas fa-spinner fa-spin mr-2"></i>
                  Criando...
                </>
              ) : (
                <>
                  <i className="fas fa-plus mr-2"></i>
                  Criar Item
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

export default WebCreateItemModal
