'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { useNotification } from '@/contexts/NotificationContext'
import { useModularPermissions, PERMISSION_CODES } from '@/hooks/useModularPermissions'
import { estoqueService } from '@/services/estoqueService'
import { NotaFiscal, ItemEstoque } from '@/types'
import { parseBrazilianCurrency, formatBrazilianCurrency, isValidCurrency } from '@/utils/currencyUtils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { 
  FileText, 
  ArrowLeft, 
  Edit, 
  Save, 
  X, 
  User, 
  DollarSign,
  Package,
  Download,
  Loader2,
  Trash2,
  Upload,
  Plus
} from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export default function NotaFiscalDetailsPage() {
  const router = useRouter()
  const params = useParams()
  const { user } = useAuth()
  const { notify } = useNotification()
  
  // Tratamento seguro do useModularPermissions
  let hasPermission: (permission: string) => boolean
  try {
    const permissions = useModularPermissions()
    hasPermission = permissions.hasPermission
  } catch (error) {
    console.error('Erro ao carregar permissões modulares:', error)
    hasPermission = () => false
  }

  // Verificar permissão para editar NF
  const canEditNF = user && hasPermission(PERMISSION_CODES.ALMOXARIFADO.CADASTRAR_NF_WEB)
  
  const [notaFiscal, setNotaFiscal] = useState<NotaFiscal | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editingItems, setEditingItems] = useState(false)
  const [savingItems, setSavingItems] = useState(false)
  const [uploadingFile, setUploadingFile] = useState(false)
  const [deletingFile, setDeletingFile] = useState(false)
  
  // Estados para edição
  const [editForm, setEditForm] = useState({
    numero: '',
    serie: '',
    numero_pedido: '',
    fornecedor: '',
    cnpj_fornecedor: '',
    data_emissao: '',
    data_recebimento: '',
    observacoes: '',
    status: 'pendente' as NotaFiscal['status']
  })

  // Estados para edição de itens
  const [editItems, setEditItems] = useState<Array<{
    id: string
    quantidade: number
    valor_unitario: number
    valor_total: number
    observacoes: string
    isNew?: boolean // Para identificar itens novos
    isDeleted?: boolean // Para identificar itens marcados para exclusão
    item_id?: string // Para itens existentes no estoque
    codigo_item?: string
    descricao?: string
    unidade?: string
  }>>([])

  // Estados para adição de itens
  const [showAddItemModal, setShowAddItemModal] = useState(false)
  const [itensEstoque, setItensEstoque] = useState<ItemEstoque[]>([])
  const [selectedItem, setSelectedItem] = useState<ItemEstoque | null>(null)
  const [showCreateItemModal, setShowCreateItemModal] = useState(false)
  
  // Estados do formulário de novo item
  const [itemDescricao, setItemDescricao] = useState('')
  const [itemCodigo, setItemCodigo] = useState('')
  const [itemQuantidade, setItemQuantidade] = useState('')
  const [itemValorUnitario, setItemValorUnitario] = useState('')
  const [itemValorTotal, setItemValorTotal] = useState('')
  const [itemUnidade, setItemUnidade] = useState('UN')
  const [itemObservacoes, setItemObservacoes] = useState('')
  
  // Estados do formulário de criação de item
  const [newItemForm, setNewItemForm] = useState({
    codigo: '',
    nome: '',
    categoria: '',
    unidade_medida: 'UN',
    descricao: '',
    estoque_minimo: 0,
    estoque_maximo: 0
  })

  const nfId = params.id as string

  const loadNotaFiscal = useCallback(async () => {
    try {
      setLoading(true)
      const data = await estoqueService.getNotaFiscalById(nfId)
      setNotaFiscal(data)
      
      // Preencher formulário de edição
      setEditForm({
        numero: data.numero || '',
        serie: data.serie || '',
        numero_pedido: data.numero_pedido || '',
        fornecedor: data.fornecedor || '',
        cnpj_fornecedor: data.cnpj_fornecedor || '',
        data_emissao: data.data_emissao || '',
        data_recebimento: data.data_recebimento || '',
        observacoes: data.observacoes || '',
        status: data.status || 'pendente'
      })

      // Preencher itens para edição
      if (data.itens) {
        setEditItems(data.itens.map(item => ({
          id: item.id,
          quantidade: item.quantidade,
          valor_unitario: item.valor_unitario,
          valor_total: item.valor_total,
          observacoes: item.observacoes || '',
          isNew: false,
          item_id: item.item_id,
          codigo_item: item.codigo_item,
          descricao: item.descricao,
          unidade: item.unidade
        })))
      }
    } catch (error) {
      console.error('Erro ao carregar NF:', error)
      notify('Erro ao carregar detalhes da nota fiscal', 'error')
      router.push('/almoxarifado/notas-fiscais')
    } finally {
      setLoading(false)
    }
  }, [nfId, notify, router])

  const loadItensEstoque = async () => {
    try {
      const itens = await estoqueService.getItensPorCategoria('epi')
      const ferramental = await estoqueService.getItensPorCategoria('ferramental')
      const consumivel = await estoqueService.getItensPorCategoria('consumivel')
      const equipamento = await estoqueService.getItensPorCategoria('equipamento')

      const todosItens = [...itens, ...ferramental, ...consumivel, ...equipamento]
        .sort((a, b) => a.nome.localeCompare(b.nome))

      setItensEstoque(todosItens)
    } catch (error) {
      console.error('Erro ao carregar itens do estoque:', error)
    }
  }

  useEffect(() => {
    if (nfId) {
      loadNotaFiscal()
    }
    loadItensEstoque()
  }, [nfId, loadNotaFiscal])

  const handleEdit = () => {
    setEditing(true)
  }

  const handleCancel = () => {
    setEditing(false)
    // Restaurar valores originais
    if (notaFiscal) {
      setEditForm({
        numero: notaFiscal.numero || '',
        serie: notaFiscal.serie || '',
        numero_pedido: notaFiscal.numero_pedido || '',
        fornecedor: notaFiscal.fornecedor || '',
        cnpj_fornecedor: notaFiscal.cnpj_fornecedor || '',
        data_emissao: notaFiscal.data_emissao || '',
        data_recebimento: notaFiscal.data_recebimento || '',
        observacoes: notaFiscal.observacoes || '',
        status: notaFiscal.status || 'pendente'
      })
    }
  }

  const handleEditItems = () => {
    setEditingItems(true)
  }

  const handleCancelItems = () => {
    setEditingItems(false)
    setShowAddItemModal(false)
    // Restaurar valores originais dos itens
    if (notaFiscal && notaFiscal.itens) {
      setEditItems(notaFiscal.itens.map(item => ({
        id: item.id,
        quantidade: item.quantidade,
        valor_unitario: item.valor_unitario,
        valor_total: item.valor_total,
        observacoes: item.observacoes || '',
        isNew: false,
        item_id: item.item_id,
        codigo_item: item.codigo_item,
        descricao: item.descricao,
        unidade: item.unidade
      })))
    }
  }

  const handleSaveItems = async () => {
    if (!notaFiscal) return

    try {
      setSavingItems(true)
      
      // Separar itens por tipo
      const existingItems = editItems.filter(item => !item.isNew && !item.isDeleted)
      const newItems = editItems.filter(item => item.isNew)
      const deletedItems = editItems.filter(item => item.isDeleted)
      
      // Calcular diferenças para itens existentes
      const originalItems = notaFiscal.itens || []
      const adjustments: Array<{ item_id: string; quantidade_diferenca: number }> = []

      for (const editedItem of existingItems) {
        const originalItem = originalItems.find(oi => oi.id === editedItem.id)
        
        if (originalItem) {
          const diferenca = editedItem.quantidade - originalItem.quantidade
          if (diferenca !== 0 && originalItem.item_id) {
            adjustments.push({
              item_id: originalItem.item_id,
              quantidade_diferenca: diferenca
            })
          }
        }
      }

      // Adicionar novos itens (soma ao estoque)
      for (const newItem of newItems) {
        if (newItem.item_id && newItem.quantidade > 0) {
          adjustments.push({
            item_id: newItem.item_id,
            quantidade_diferenca: newItem.quantidade // Sempre positivo para novos itens
          })
        }
      }

      // Remover itens excluídos (diminuir do estoque)
      for (const deletedItem of deletedItems) {
        const originalItem = originalItems.find(oi => oi.id === deletedItem.id)
        if (originalItem?.item_id && originalItem.quantidade > 0) {
          adjustments.push({
            item_id: originalItem.item_id,
            quantidade_diferenca: -originalItem.quantidade // Negativo para remoção
          })
        }
      }

      // Atualizar itens da NF
      await estoqueService.updateItensNotaFiscal(notaFiscal.id, editItems)

      // Ajustar estoque baseado nas diferenças, novos itens e exclusões
      for (const adjustment of adjustments) {
        await estoqueService.adjustarEstoquePorDiferenca(
          adjustment.item_id,
          adjustment.quantidade_diferenca,
          'Ajuste por edição de NF',
          user?.id || ''
        )
      }

      // Recarregar dados da NF
      await loadNotaFiscal()
      setEditingItems(false)
      setShowAddItemModal(false)
      notify('Itens atualizados com sucesso!', 'success')
    } catch (error) {
      console.error('Erro ao salvar itens:', error)
      notify('Erro ao salvar alterações dos itens', 'error')
    } finally {
      setSavingItems(false)
    }
  }

  const handleSave = async () => {
    if (!notaFiscal) return

    try {
      setSaving(true)
      
      // Atualizar dados da NF (o serviço já retorna dados completos)
      const updatedNF = await estoqueService.updateNotaFiscal(notaFiscal.id, {
        numero: editForm.numero,
        serie: editForm.serie,
        numero_pedido: editForm.numero_pedido,
        fornecedor: editForm.fornecedor,
        cnpj_fornecedor: editForm.cnpj_fornecedor,
        data_emissao: editForm.data_emissao,
        data_recebimento: editForm.data_recebimento,
        observacoes: editForm.observacoes,
        status: editForm.status
      })

      // Atualizar estado com dados completos
      setNotaFiscal(updatedNF)
      
      // Atualizar itens para edição
      if (updatedNF.itens) {
        setEditItems(updatedNF.itens.map(item => ({
          id: item.id,
          quantidade: item.quantidade,
          valor_unitario: item.valor_unitario,
          valor_total: item.valor_total,
          observacoes: item.observacoes || '',
          isNew: false,
          item_id: item.item_id,
          codigo_item: item.codigo_item,
          descricao: item.descricao,
          unidade: item.unidade
        })))
      }
      
      setEditing(false)
      notify('Nota fiscal atualizada com sucesso!', 'success')
    } catch (error) {
      console.error('Erro ao salvar NF:', error)
      notify('Erro ao salvar alterações', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleDownloadFile = (url: string, fileName: string) => {
    const link = document.createElement('a')
    link.href = url
    link.download = fileName
    link.target = '_blank'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleDeleteFile = async () => {
    if (!notaFiscal || !canEditNF) return

    try {
      setDeletingFile(true)
      await estoqueService.deleteArquivoNotaFiscal(notaFiscal.id)
      
      // Atualizar estado local
      setNotaFiscal(prev => prev ? { ...prev, arquivo_url: undefined } : null)
      notify('Arquivo excluído com sucesso!', 'success')
    } catch (error) {
      console.error('Erro ao excluir arquivo:', error)
      notify('Erro ao excluir arquivo', 'error')
    } finally {
      setDeletingFile(false)
    }
  }

  const handleFileUpload = async (file: File) => {
    if (!notaFiscal || !canEditNF) return

    try {
      setUploadingFile(true)
      const newFileUrl = await estoqueService.uploadArquivoNotaFiscal(notaFiscal.id, file)
      
      // Atualizar estado local
      setNotaFiscal(prev => prev ? { ...prev, arquivo_url: newFileUrl } : null)
      notify('Arquivo enviado com sucesso!', 'success')
    } catch (error) {
      console.error('Erro no upload:', error)
      notify(error instanceof Error ? error.message : 'Erro no upload do arquivo', 'error')
    } finally {
      setUploadingFile(false)
    }
  }

  const handleAddNewItem = () => {
    if (!itemDescricao || !itemQuantidade || !itemValorUnitario) {
      notify('Preencha todos os campos obrigatórios', 'error')
      return
    }

    // Verificar se o item já existe na lista (por código ou nome)
    const itemJaExiste = editItems.some(item => 
      !item.isDeleted && (
        (item.codigo_item && itemCodigo && item.codigo_item === itemCodigo) ||
        (item.descricao && itemDescricao && item.descricao.toLowerCase() === itemDescricao.toLowerCase())
      )
    )

    if (itemJaExiste) {
      notify('Este item já foi adicionado à lista. Não é possível duplicar itens.', 'error')
      return
    }

    const novoItem = {
      id: `new_${Date.now()}`, // ID temporário para novos itens
      quantidade: parseInt(itemQuantidade),
      valor_unitario: parseBrazilianCurrency(itemValorUnitario),
      valor_total: parseBrazilianCurrency(itemValorTotal),
      observacoes: itemObservacoes,
      isNew: true,
      item_id: selectedItem?.id || undefined,
      codigo_item: itemCodigo || undefined,
      descricao: itemDescricao,
      unidade: itemUnidade
    }

    setEditItems(prev => [...prev, novoItem])
    
    // Limpar formulário
    setItemDescricao('')
    setItemCodigo('')
    setItemQuantidade('')
    setItemValorUnitario('')
    setItemValorTotal('')
    setItemUnidade('UN')
    setItemObservacoes('')
    setSelectedItem(null)
    setShowAddItemModal(false)
    notify('Item adicionado à lista', 'success')
  }

  const handleCreateNewItem = async () => {
    if (!newItemForm.codigo || !newItemForm.nome) {
      notify('Preencha código e nome do item', 'error')
      return
    }

    try {
      const novoItem = await estoqueService.createItemEstoque({
        codigo: newItemForm.codigo,
        nome: newItemForm.nome,
        categoria: (newItemForm.categoria || 'Outros') as ItemEstoque['categoria'],
        unidade_medida: newItemForm.unidade_medida,
        descricao: newItemForm.descricao || '',
        estoque_minimo: newItemForm.estoque_minimo,
        estoque_maximo: newItemForm.estoque_maximo,
        status: 'ativo',
        estoque_atual: 0,
        base_id: notaFiscal?.base_id || ''
      })

      // Atualizar lista de itens
      await loadItensEstoque()
      
      // Preencher formulário com o novo item
      setSelectedItem(novoItem)
      setItemDescricao(novoItem.nome)
      setItemCodigo(novoItem.codigo || '')
      setItemUnidade(novoItem.unidade_medida || 'UN')
      
      setShowCreateItemModal(false)
      notify('Item criado com sucesso!', 'success')
    } catch (error) {
      console.error('Erro ao criar item:', error)
      notify('Erro ao criar item', 'error')
    }
  }

  const handleRemoveItem = (itemId: string) => {
    const itemToRemove = editItems.find(item => item.id === itemId)
    
    if (itemToRemove?.isNew) {
      // Apenas remover da lista se for item novo
      setEditItems(prev => prev.filter(item => item.id !== itemId))
    } else {
      // Para itens existentes, marcar para exclusão (não remover da lista ainda)
      // A exclusão real acontecerá no save
      setEditItems(prev => prev.map(item => 
        item.id === itemId 
          ? { ...item, isDeleted: true }
          : item
      ))
    }
  }

  const getStatusBadge = (status: NotaFiscal['status']) => {
    const statusConfig = {
      pendente: { label: 'Pendente', variant: 'secondary' as const },
      recebida: { label: 'Recebida', variant: 'default' as const },
      conferida: { label: 'Conferida', variant: 'default' as const },
      lancada: { label: 'Lançada', variant: 'default' as const },
      cancelada: { label: 'Cancelada', variant: 'destructive' as const }
    }
    
    const config = statusConfig[status]
    return <Badge variant={config.variant}>{config.label}</Badge>
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value)
  }

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), 'dd/MM/yyyy', { locale: ptBR })
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="flex justify-center items-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      </div>
    )
  }

  if (!notaFiscal) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Nota Fiscal não encontrada</h1>
          <Button onClick={() => router.push('/almoxarifado/notas-fiscais')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar para Notas Fiscais
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <Button
            variant="outline"
            onClick={() => router.push('/almoxarifado/notas-fiscais')}
            className="mr-2"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
          <div className="p-2 bg-blue-100 rounded-lg">
            <FileText className="h-8 w-8 text-blue-600" />
          </div>
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-gray-900">
              NF {notaFiscal.numero}
              {notaFiscal.serie && <span className="text-gray-500"> - Série {notaFiscal.serie}</span>}
              {notaFiscal.numero_pedido && <span className="text-blue-600 text-sm font-medium"> - Pedido: {notaFiscal.numero_pedido}</span>}
            </h1>
            <p className="text-gray-600">{notaFiscal.fornecedor}</p>
          </div>
          <div className="flex gap-2">
            {getStatusBadge(notaFiscal.status)}
            {canEditNF && (
              editing ? (
                <>
                  <Button onClick={handleCancel} variant="outline">
                    <X className="h-4 w-4 mr-2" />
                    Cancelar
                  </Button>
                  <Button onClick={handleSave} disabled={saving}>
                    {saving ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4 mr-2" />
                    )}
                    Salvar
                  </Button>
                </>
              ) : (
                <Button onClick={handleEdit}>
                  <Edit className="h-4 w-4 mr-2" />
                  Editar
                </Button>
              )
            )}
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {/* Primeira linha - Informações da NF e Sidebar */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Informações da NF */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Informações da Nota Fiscal
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="numero">Número *</Label>
                  {editing && canEditNF ? (
                    <Input
                      id="numero"
                      value={editForm.numero}
                      onChange={(e) => setEditForm(prev => ({ ...prev, numero: e.target.value }))}
                      required
                    />
                  ) : (
                    <p className="text-gray-900">{notaFiscal.numero}</p>
                  )}
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="serie">Série</Label>
                  {editing && canEditNF ? (
                    <Input
                      id="serie"
                      value={editForm.serie}
                      onChange={(e) => setEditForm(prev => ({ ...prev, serie: e.target.value }))}
                    />
                  ) : (
                    <p className="text-gray-900">{notaFiscal.serie || 'N/A'}</p>
                  )}
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="numero_pedido">Número do Pedido</Label>
                  {editing && canEditNF ? (
                    <Input
                      id="numero_pedido"
                      value={editForm.numero_pedido}
                      onChange={(e) => setEditForm(prev => ({ ...prev, numero_pedido: e.target.value }))}
                    />
                  ) : (
                    <p className="text-gray-900">{notaFiscal.numero_pedido || 'N/A'}</p>
                  )}
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="fornecedor">Fornecedor *</Label>
                  {editing && canEditNF ? (
                    <Input
                      id="fornecedor"
                      value={editForm.fornecedor}
                      onChange={(e) => setEditForm(prev => ({ ...prev, fornecedor: e.target.value }))}
                      required
                    />
                  ) : (
                    <p className="text-gray-900">{notaFiscal.fornecedor}</p>
                  )}
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="cnpj">CNPJ</Label>
                  {editing && canEditNF ? (
                    <Input
                      id="cnpj"
                      value={editForm.cnpj_fornecedor}
                      onChange={(e) => setEditForm(prev => ({ ...prev, cnpj_fornecedor: e.target.value }))}
                    />
                  ) : (
                    <p className="text-gray-900">{notaFiscal.cnpj_fornecedor || 'N/A'}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="data_emissao">Data de Emissão *</Label>
                  {editing && canEditNF ? (
                    <Input
                      id="data_emissao"
                      type="date"
                      value={editForm.data_emissao}
                      onChange={(e) => setEditForm(prev => ({ ...prev, data_emissao: e.target.value }))}
                      required
                    />
                  ) : (
                    <p className="text-gray-900">{formatDate(notaFiscal.data_emissao)}</p>
                  )}
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="data_recebimento">Data de Recebimento *</Label>
                  {editing && canEditNF ? (
                    <Input
                      id="data_recebimento"
                      type="date"
                      value={editForm.data_recebimento}
                      onChange={(e) => setEditForm(prev => ({ ...prev, data_recebimento: e.target.value }))}
                      required
                    />
                  ) : (
                    <p className="text-gray-900">{formatDate(notaFiscal.data_recebimento)}</p>
                  )}
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  {editing && canEditNF ? (
                    <Select value={editForm.status} onValueChange={(value) => setEditForm(prev => ({ ...prev, status: value as NotaFiscal['status'] }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pendente">Pendente</SelectItem>
                        <SelectItem value="recebida">Recebida</SelectItem>
                        <SelectItem value="conferida">Conferida</SelectItem>
                        <SelectItem value="lancada">Lançada</SelectItem>
                        <SelectItem value="cancelada">Cancelada</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <div>{getStatusBadge(notaFiscal.status)}</div>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="observacoes">Observações</Label>
                {editing ? (
                  <Textarea
                    id="observacoes"
                    value={editForm.observacoes}
                    onChange={(e) => setEditForm(prev => ({ ...prev, observacoes: e.target.value }))}
                    rows={2}
                  />
                ) : (
                  <p className="text-gray-900 text-sm">{notaFiscal.observacoes || 'N/A'}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Arquivo da Nota Fiscal</Label>
                {notaFiscal.arquivo_url ? (
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => handleDownloadFile(notaFiscal.arquivo_url!, `NF_${notaFiscal.numero}.pdf`)}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Baixar Arquivo
                    </Button>
                    {canEditNF && (
                      <>
                        <Button
                          variant="outline"
                          onClick={handleDeleteFile}
                          disabled={deletingFile}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          {deletingFile ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4 mr-2" />
                          )}
                          Excluir
                        </Button>
                        <div className="relative">
                          <Input
                            type="file"
                            accept=".pdf,.jpg,.jpeg,.png"
                            onChange={(e) => {
                              const file = e.target.files?.[0]
                              if (file) {
                                handleFileUpload(file)
                              }
                            }}
                            disabled={uploadingFile}
                            className="hidden"
                            id="file-upload"
                          />
                          <Button
                            variant="outline"
                            onClick={() => document.getElementById('file-upload')?.click()}
                            disabled={uploadingFile}
                          >
                            {uploadingFile ? (
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                              <Upload className="h-4 w-4 mr-2" />
                            )}
                            Reupload
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-sm text-gray-500">Nenhum arquivo anexado</p>
                    {canEditNF && (
                      <div className="relative">
                        <Input
                          type="file"
                          accept=".pdf,.jpg,.jpeg,.png"
                          onChange={(e) => {
                            const file = e.target.files?.[0]
                            if (file) {
                              handleFileUpload(file)
                            }
                          }}
                          disabled={uploadingFile}
                          className="hidden"
                          id="file-upload-new"
                        />
                        <Button
                          variant="outline"
                          onClick={() => document.getElementById('file-upload-new')?.click()}
                          disabled={uploadingFile}
                        >
                          {uploadingFile ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <Upload className="h-4 w-4 mr-2" />
                          )}
                          Enviar Arquivo
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-1">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Resumo
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Valor Total:</span>
                  <span className="text-2xl font-bold text-green-600">
                    {formatCurrency(notaFiscal.valor_total)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Total de Itens:</span>
                  <span className="font-semibold">{notaFiscal.itens?.length || 0}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Usuários
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-sm font-medium text-gray-700">Usuário de Recebimento</Label>
                  <p className="text-gray-900">
                    {(notaFiscal.usuario_recebimento as { nome?: string })?.nome || 'Usuário não encontrado'}
                  </p>
                </div>
                {notaFiscal.usuario_conferencia && (
                  <div>
                    <Label className="text-sm font-medium text-gray-700">Usuário de Conferência</Label>
                    <p className="text-gray-900">
                      {(notaFiscal.usuario_conferencia as { nome?: string })?.nome || 'Usuário não encontrado'}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Segunda linha - Itens da NF ocupando toda a largura */}
      {notaFiscal.itens && notaFiscal.itens.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Itens da Nota Fiscal
              </CardTitle>
              {canEditNF && (
                editingItems ? (
                  <div className="flex gap-2">
                    <Button onClick={handleCancelItems} variant="outline" size="sm">
                      <X className="h-4 w-4 mr-2" />
                      Cancelar
                    </Button>
                    <Button onClick={handleSaveItems} disabled={savingItems} size="sm">
                      {savingItems ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4 mr-2" />
                      )}
                      Salvar Itens
                    </Button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Button onClick={handleEditItems} size="sm">
                      <Edit className="h-4 w-4 mr-2" />
                      Editar Itens
                    </Button>
                    <Button onClick={() => setShowAddItemModal(true)} size="sm" variant="outline">
                      <Plus className="h-4 w-4 mr-2" />
                      Adicionar Item
                    </Button>
                  </div>
                )
              )}
            </div>
          </CardHeader>
          <CardContent className={editingItems ? "pt-4" : ""}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm rounded-lg overflow-hidden">
                <thead>
                  <tr className="border-b bg-gray-50 rounded-t-lg">
                    <th className="text-center py-4 px-3 w-17 font-bold text-orange-800 bg-orange-100">Código</th>
                    <th className="text-center py-4 px-3 w-72 font-bold text-blue-800 bg-blue-100">Nome do Item</th>
                    <th className="text-center py-4 px-3 w-17 font-bold text-purple-800 bg-purple-100">Qtd</th>
                    <th className="text-center py-4 px-3 w-17 font-bold text-yellow-800 bg-yellow-100">Valor Unit.</th>
                    <th className="text-center py-4 px-3 w-17 font-bold text-green-800 bg-green-100">Total</th>
                    {editingItems && canEditNF && <th className="text-center py-4 px-3 w-24">Ações</th>}
                  </tr>
                </thead>
                <tbody>
                  {editItems.map((item, index) => {
                    return (
                      <tr key={index} className={`border-b border-gray-200 ${editingItems ? 'py-3' : 'py-2'} hover:bg-gray-50 transition-colors duration-200 ${
                        item.isNew ? 'bg-green-50 border-green-200' : 
                        item.isDeleted ? 'bg-red-50 border-red-200 opacity-70' : 'bg-white'
                      } ${index === editItems.length - 1 ? 'rounded-b-lg' : ''}`}>
                        <td className={`${editingItems ? 'py-4 px-4' : 'py-2 px-3'} text-center`}>
                          <span className="text-base font-bold text-orange-800 bg-orange-50 rounded-md px-2 py-1">{item.codigo_item || 'N/A'}</span>
                        </td>
                        <td className={`${editingItems ? 'py-4 px-4' : 'py-2 px-3'} text-center`}>
                          <div className="flex items-center justify-center gap-1">
                            <span className={`text-base font-bold text-blue-800 bg-blue-50 rounded-md px-2 py-1 ${item.isDeleted ? 'line-through' : ''} break-words`}>
                              {item.descricao || 'Nome não encontrado'}
                            </span>
                            {item.isNew && (
                              <Badge variant="secondary" className="text-xs bg-green-100 text-green-700 px-1 py-0">
                                NOVO
                              </Badge>
                            )}
                            {item.isDeleted && (
                              <Badge variant="destructive" className="text-xs px-1 py-0">
                                EXCLUIR
                              </Badge>
                            )}
                          </div>
                        </td>
                        <td className={`text-center ${editingItems ? 'py-4 px-4' : 'py-2 px-3'}`}>
                          {editingItems && canEditNF && !item.isDeleted ? (
                            <div className="flex items-center justify-center gap-1">
                              <Input
                                type="number"
                                min="0"
                                step="1"
                                value={item.quantidade}
                                onChange={(e) => {
                                  const newQuantidade = parseInt(e.target.value) || 0
                                  const newValorTotal = newQuantidade * item.valor_unitario
                                  
                                  setEditItems(prev => prev.map(ei => 
                                    ei.id === item.id 
                                      ? { ...ei, quantidade: newQuantidade, valor_total: newValorTotal }
                                      : ei
                                  ))
                                }}
                                className="w-20 text-center text-xs h-8"
                              />
                              <span className="text-xs text-gray-500">{item.unidade}</span>
                            </div>
                          ) : (
                            <span className={`text-base font-bold text-purple-800 bg-purple-50 rounded-md px-2 py-1 ${item.isDeleted ? 'line-through' : ''}`}>
                              {item.quantidade} {item.unidade}
                            </span>
                          )}
                        </td>
                        <td className={`text-center ${editingItems ? 'py-4 px-4' : 'py-2 px-3'}`}>
                          {editingItems && canEditNF && !item.isDeleted ? (
                            <div className="flex justify-center">
                              <Input
                                type="text"
                                placeholder="0,00"
                                value={item.valor_unitario ? formatBrazilianCurrency(item.valor_unitario) : ''}
                                onChange={(e) => {
                                  const inputValue = e.target.value
                                  if (isValidCurrency(inputValue)) {
                                    const newValorUnitario = parseBrazilianCurrency(inputValue)
                                    const newValorTotal = item.quantidade * newValorUnitario
                                    
                                    setEditItems(prev => prev.map(ei => 
                                      ei.id === item.id 
                                        ? { ...ei, valor_unitario: newValorUnitario, valor_total: newValorTotal }
                                        : ei
                                    ))
                                  }
                                }}
                                className="w-24 text-center text-xs h-8"
                              />
                            </div>
                          ) : (
                            <span className={`text-base font-bold text-yellow-800 bg-yellow-50 rounded-md px-2 py-1 ${item.isDeleted ? 'line-through' : ''}`}>
                              {formatCurrency(item.valor_unitario)}
                            </span>
                          )}
                        </td>
                        <td className={`text-center ${editingItems ? 'py-4 px-4' : 'py-2 px-3'} font-medium`}>
                          <span className={`text-base font-bold text-green-800 bg-green-50 rounded-md px-2 py-1 ${item.isDeleted ? 'line-through' : ''}`}>
                            {formatCurrency(item.valor_total)}
                          </span>
                        </td>
                        {editingItems && canEditNF && (
                          <td className={`${editingItems ? 'py-4 px-4' : 'py-2 px-3'} text-center`}>
                            <div className="flex gap-1 justify-center">
                              {!item.isDeleted ? (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleRemoveItem(item.id)}
                                  className="h-7 w-7 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                                  title="Excluir item"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              ) : (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    // Restaurar item
                                    setEditItems(prev => prev.map(ei => 
                                      ei.id === item.id 
                                        ? { ...ei, isDeleted: false }
                                        : ei
                                    ))
                                  }}
                                  className="h-7 w-7 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                                  title="Restaurar item"
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
      </div>

      {/* Modal para Adicionar Novo Item */}
      <Dialog open={showAddItemModal} onOpenChange={setShowAddItemModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Adicionar Item à Nota Fiscal</DialogTitle>
            <DialogDescription>
              Adicione um item existente do estoque ou crie um novo item
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="item-search">Item do Estoque (opcional)</Label>
              <div className="flex gap-2">
                <SearchableSelect
                  items={itensEstoque.map(item => ({
                    id: item.id,
                    nome: item.nome,
                    codigo: item.codigo,
                    categoria: item.categoria
                  }))}
                  value={selectedItem?.id || ''}
                  onValueChange={(itemId) => {
                    const item = itensEstoque.find(i => i.id === itemId)
                    if (item) {
                      setSelectedItem(item)
                      setItemDescricao(item.nome)
                      setItemCodigo(item.codigo || '')
                      setItemUnidade(item.unidade_medida || 'UN')
                    }
                  }}
                  placeholder="Buscar item..."
                  className="flex-1"
                />
                <Button
                  variant="outline"
                  onClick={() => setShowCreateItemModal(true)}
                  type="button"
                  className="whitespace-nowrap"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Novo Item
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="item-descricao">Descrição *</Label>
              <Input
                id="item-descricao"
                value={itemDescricao}
                onChange={(e) => setItemDescricao(e.target.value)}
                placeholder="Descrição do item"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="item-codigo">Código do Item</Label>
              <Input
                id="item-codigo"
                value={itemCodigo}
                onChange={(e) => setItemCodigo(e.target.value)}
                placeholder="Código do item"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="item-quantidade">Quantidade *</Label>
                <Input
                  id="item-quantidade"
                  type="number"
                  min="1"
                  value={itemQuantidade}
                  onChange={(e) => {
                    const quantidade = parseInt(e.target.value) || 0
                    const valorTotal = quantidade * parseBrazilianCurrency(itemValorUnitario || '0')
                    setItemQuantidade(e.target.value)
                    setItemValorTotal(formatBrazilianCurrency(valorTotal))
                  }}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="item-unidade">Unidade</Label>
                <Select value={itemUnidade} onValueChange={setItemUnidade}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="UN">Unidade</SelectItem>
                    <SelectItem value="KG">Quilograma</SelectItem>
                    <SelectItem value="L">Litro</SelectItem>
                    <SelectItem value="M">Metro</SelectItem>
                    <SelectItem value="PCT">Pacote</SelectItem>
                    <SelectItem value="CX">Caixa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="item-valor">Valor Unitário *</Label>
              <Input
                id="item-valor"
                type="text"
                placeholder="0,00"
                value={itemValorUnitario}
                onChange={(e) => {
                  const inputValue = e.target.value
                  if (isValidCurrency(inputValue)) {
                    const valorUnitario = parseBrazilianCurrency(inputValue)
                    const valorTotal = parseInt(itemQuantidade || '0') * valorUnitario
                    setItemValorUnitario(inputValue)
                    setItemValorTotal(formatBrazilianCurrency(valorTotal))
                  }
                }}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="item-observacoes">Observações</Label>
              <Textarea
                id="item-observacoes"
                value={itemObservacoes}
                onChange={(e) => setItemObservacoes(e.target.value)}
                placeholder="Observações do item"
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddItemModal(false)}>
              Cancelar
            </Button>
            <Button onClick={handleAddNewItem}>
              Adicionar Item
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Criação de Novo Item */}
      <Dialog open={showCreateItemModal} onOpenChange={setShowCreateItemModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Criar Novo Item</DialogTitle>
            <DialogDescription>
              Crie um novo item no estoque. As quantidades e valores serão preenchidos no próximo passo.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="codigo">Código *</Label>
                <Input
                  id="codigo"
                  value={newItemForm.codigo}
                  onChange={(e) => setNewItemForm(prev => ({ ...prev, codigo: e.target.value }))}
                  placeholder="Ex: EPI001"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="nome">Nome *</Label>
                <Input
                  id="nome"
                  value={newItemForm.nome}
                  onChange={(e) => setNewItemForm(prev => ({ ...prev, nome: e.target.value }))}
                  placeholder="Ex: Capacete de Segurança"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="categoria">Categoria</Label>
                <Input
                  id="categoria"
                  value={newItemForm.categoria}
                  onChange={(e) => setNewItemForm(prev => ({ ...prev, categoria: e.target.value }))}
                  placeholder="Ex: EPI"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="unidade">Unidade de Medida</Label>
                <Select value={newItemForm.unidade_medida} onValueChange={(value) => setNewItemForm(prev => ({ ...prev, unidade_medida: value }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="UN">Unidade</SelectItem>
                    <SelectItem value="KG">Quilograma</SelectItem>
                    <SelectItem value="L">Litro</SelectItem>
                    <SelectItem value="M">Metro</SelectItem>
                    <SelectItem value="PCT">Pacote</SelectItem>
                    <SelectItem value="CX">Caixa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="descricao">Descrição</Label>
              <Textarea
                id="descricao"
                value={newItemForm.descricao}
                onChange={(e) => setNewItemForm(prev => ({ ...prev, descricao: e.target.value }))}
                placeholder="Descrição detalhada do item"
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="estoque-minimo">Estoque Mínimo</Label>
                <Input
                  id="estoque-minimo"
                  type="number"
                  min="0"
                  value={newItemForm.estoque_minimo}
                  onChange={(e) => setNewItemForm(prev => ({ ...prev, estoque_minimo: parseInt(e.target.value) || 0 }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="estoque-maximo">Estoque Máximo</Label>
                <Input
                  id="estoque-maximo"
                  type="number"
                  min="0"
                  value={newItemForm.estoque_maximo}
                  onChange={(e) => setNewItemForm(prev => ({ ...prev, estoque_maximo: parseInt(e.target.value) || 0 }))}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateItemModal(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreateNewItem}>
              Criar Item
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
