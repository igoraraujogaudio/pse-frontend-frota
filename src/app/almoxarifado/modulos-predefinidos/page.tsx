'use client'

import React, { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useNotification } from '@/contexts/NotificationContext'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { moduloPredefinidoService } from '@/services/moduloPredefinidoService'
import { grupoItemService } from '@/services/grupoItemService'
import type {
  ModuloPredefinidoCargo,
  ModuloPredefinidoItem,
  FormModuloPredefinidoCargo,
  FormModuloPredefinidoItem,
  GrupoItemCompleto
} from '@/types'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Plus, Edit, Trash2, Package, Settings, GripVertical, Eye, EyeOff, Save, X, ChevronDown, ChevronRight } from 'lucide-react'
import { PERMISSION_CODES } from '@/hooks/useModularPermissions'
import ProtectedRoute from '@/components/ProtectedRoute'
import { SearchableSelect } from '@/components/ui/searchable-select'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import {
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

// Componente para item arrastável
function SortableItem({ 
  item, 
  gruposItens, 
  onDelete, 
  isEditing, 
  onToggleEdit, 
  onToggleVisibility, 
  onInlineUpdate,
  isHidden 
}: {
  item: ModuloPredefinidoItem
  gruposItens: GrupoItemCompleto[]
  onDelete: (item: ModuloPredefinidoItem) => void
  isEditing: boolean
  onToggleEdit: (itemId: string) => void
  onToggleVisibility: (itemId: string) => void
  onInlineUpdate: (item: ModuloPredefinidoItem, updates: Partial<ModuloPredefinidoItem>) => void
  isHidden: boolean
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const [editForm, setEditForm] = useState({
    quantidade_padrao: item.quantidade_padrao,
    obrigatorio: item.obrigatorio,
    observacoes: item.observacoes || ''
  })

  const handleSave = () => {
    onInlineUpdate(item, editForm)
  }

  const handleCancel = () => {
    setEditForm({
      quantidade_padrao: item.quantidade_padrao,
      obrigatorio: item.obrigatorio,
      observacoes: item.observacoes || ''
    })
    onToggleEdit(item.id)
  }

  if (isHidden) {
    return (
      <div className="flex items-center justify-between p-3 bg-gray-100 rounded-lg opacity-50">
        <div className="flex items-center gap-3">
          <div className="w-4 h-4" /> {/* Espaço para alinhar */}
          <span className="text-sm text-gray-500 italic">
            Item oculto: {item.item_catalogo?.nome || item.item_estoque?.nome || item.grupo_item?.nome_grupo || 'Item sem nome'}
          </span>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onToggleVisibility(item.id)}
        >
          <Eye className="w-3 h-3" />
        </Button>
      </div>
    )
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
    >
      <div className="flex items-center gap-3 flex-1">
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing p-1 hover:bg-gray-200 rounded"
        >
          <GripVertical className="w-4 h-4 text-gray-500" />
        </div>
        
        {isEditing ? (
          <div className="flex items-center gap-3 flex-1">
            <div className="flex items-center gap-2">
              <Label className="text-xs">Qtd:</Label>
              <Input
                type="number"
                min="1"
                value={editForm.quantidade_padrao}
                onChange={(e) => setEditForm(prev => ({ ...prev, quantidade_padrao: parseInt(e.target.value) || 1 }))}
                className="w-16 h-8 text-sm"
              />
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-xs">Obrigatório:</Label>
              <Switch
                checked={editForm.obrigatorio}
                onCheckedChange={(checked) => setEditForm(prev => ({ ...prev, obrigatorio: checked }))}
              />
            </div>
            <div className="flex items-center gap-2 flex-1">
              <Label className="text-xs">Obs:</Label>
              <Input
                value={editForm.observacoes}
                onChange={(e) => setEditForm(prev => ({ ...prev, observacoes: e.target.value }))}
                placeholder="Observações..."
                className="flex-1 h-8 text-sm"
              />
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <Badge variant={item.obrigatorio ? 'destructive' : 'secondary'} className="text-xs">
                {item.obrigatorio ? 'Obrigatório' : 'Opcional'}
              </Badge>
              {item.grupo_item_id && !item.item_estoque_id && !item.item_catalogo_id ? (
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700">
                    Grupo
                  </Badge>
                  <span className="text-sm font-medium">
                    {gruposItens.find(g => g.id === item.grupo_item_id)?.nome_grupo || 'Grupo não encontrado'}
                  </span>
                </div>
              ) : (
                <span className="text-sm font-medium">
                  {item.item_catalogo?.nome || item.item_estoque?.nome || 'Item não encontrado'}
                </span>
              )}
            </div>
            <span className="text-sm text-gray-500">
              Qtd: {item.quantidade_padrao}
            </span>
            {item.observacoes && (
              <span className="text-sm text-gray-500">
                • {item.observacoes}
              </span>
            )}
          </>
        )}
      </div>
      
      <div className="flex items-center gap-1">
        {isEditing ? (
          <>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleSave}
              className="text-green-600 hover:text-green-700"
            >
              <Save className="w-3 h-3" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleCancel}
              className="text-gray-600 hover:text-gray-700"
            >
              <X className="w-3 h-3" />
            </Button>
          </>
        ) : (
          <>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onToggleEdit(item.id)}
            >
              <Edit className="w-3 h-3" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onToggleVisibility(item.id)}
            >
              <EyeOff className="w-3 h-3" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-red-600 hover:text-red-700"
              onClick={() => onDelete(item)}
            >
              <Trash2 className="w-3 h-3" />
            </Button>
          </>
        )}
      </div>
    </div>
  )
}

export default function ModulosPredefinidosPage() {
  return (
    <ProtectedRoute requiredPermissions={[
      PERMISSION_CODES.ALMOXARIFADO.CONFIGURAR_CATEGORIAS,
      PERMISSION_CODES.ALMOXARIFADO.CONFIGURACOES_SISTEMA
    ]}>
      <ModulosPredefinidosContent />
    </ProtectedRoute>
  )
}

function ModulosPredefinidosContent() {
  const { user, loading } = useAuth()
  const { notify } = useNotification()
  const queryClient = useQueryClient()
  
  const [contratoSelecionado, setContratoSelecionado] = useState<string>('all')
  
  // Sensores para drag and drop
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )
  
  // Estados para modais
  const [moduloOpen, setModuloOpen] = useState(false)
  const [itemOpen, setItemOpen] = useState(false)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [editingModulo, setEditingModulo] = useState<ModuloPredefinidoCargo | null>(null)
  const [editingItem, setEditingItem] = useState<ModuloPredefinidoItem | null>(null)
  const [selectedModulo, setSelectedModulo] = useState<ModuloPredefinidoCargo | null>(null)
  const [viewingModulo, setViewingModulo] = useState<ModuloPredefinidoCargo | null>(null)
  const [editingItemId, setEditingItemId] = useState<string | null>(null)
  const [hiddenItems, setHiddenItems] = useState<Set<string>>(new Set())
  const [collapsedModules, setCollapsedModules] = useState<Set<string>>(new Set())
  
  // Estados para formulários
  const [moduloForm, setModuloForm] = useState<FormModuloPredefinidoCargo>({
    contrato_id: '',
    cargo_id: '',
    nome_modulo: '',
    descricao: '',
    ativo: true
  })
  
  const [itemForm, setItemForm] = useState<FormModuloPredefinidoItem>({
    modulo_id: '',
    item_estoque_id: null,
    item_catalogo_id: '',
    quantidade_padrao: 1,
    obrigatorio: true,
    observacoes: '',
    ordem: 0
  })
  
  // Estado para controlar o tipo de item sendo adicionado
  const [tipoItem, setTipoItem] = useState<'individual' | 'grupo'>('individual')

  // React Query para módulos predefinidos
  const { data: modulos = [], isLoading: modulosLoading } = useQuery({
    queryKey: ['modulos-predefinidos', contratoSelecionado],
    queryFn: () => moduloPredefinidoService.getModulosPredefinidos(
      contratoSelecionado && contratoSelecionado !== 'all' ? { contrato_id: contratoSelecionado } : undefined
    ),
    staleTime: 5 * 60 * 1000, // 5 minutos
    gcTime: 10 * 60 * 1000, // 10 minutos
    enabled: !loading && !!user,
  })

  // React Query para contratos
  const { data: contratos = [] } = useQuery({
    queryKey: ['contratos-modulos'],
    queryFn: () => moduloPredefinidoService.getContratosDisponiveis(),
    staleTime: 10 * 60 * 1000, // 10 minutos
    gcTime: 30 * 60 * 1000, // 30 minutos
    enabled: !loading && !!user,
  })

  // React Query para cargos
  const { data: cargos = [] } = useQuery({
    queryKey: ['cargos-modulos'],
    queryFn: () => moduloPredefinidoService.getCargosDisponiveis(),
    staleTime: 10 * 60 * 1000, // 10 minutos
    gcTime: 30 * 60 * 1000, // 30 minutos
    enabled: !loading && !!user,
  })

  // React Query para itens de catálogo
  const { data: itensCatalogo = [] } = useQuery({
    queryKey: ['itens-catalogo-modulos'],
    queryFn: () => moduloPredefinidoService.getItensDisponiveisParaModulo(),
    staleTime: 5 * 60 * 1000, // 5 minutos
    gcTime: 10 * 60 * 1000, // 10 minutos
    enabled: !loading && !!user,
  })

  // React Query para grupos de itens
  const { data: gruposItens = [] } = useQuery({
    queryKey: ['grupos-itens-modulos'],
    queryFn: () => grupoItemService.getGruposItens(),
    staleTime: 10 * 60 * 1000, // 10 minutos
    gcTime: 30 * 60 * 1000, // 30 minutos
    enabled: !loading && !!user,
  })

  const busy = modulosLoading

  // Carregar itens quando o modal de item abrir
  useEffect(() => {
    if (itemOpen) {
      queryClient.invalidateQueries({ queryKey: ['itens-catalogo-modulos'] })
    }
  }, [itemOpen, queryClient])

  const handleCreateModulo = async () => {
    if (!user) return
    
    try {
      await moduloPredefinidoService.criarModuloPredefinido(moduloForm, user.id)
      queryClient.invalidateQueries({ queryKey: ['modulos-predefinidos'] })
      setModuloOpen(false)
      resetModuloForm()
      notify('Módulo criado com sucesso!', 'success')
    } catch (error) {
      console.error('Erro ao criar módulo:', error)
      notify('Erro ao criar módulo', 'error')
    } finally {
    }
  }

  const handleUpdateModulo = async () => {
    if (!editingModulo) return
    
    try {
      const moduloId = editingModulo.modulo_id || editingModulo.id
      await moduloPredefinidoService.atualizarModuloPredefinido(
        moduloId,
        moduloForm
      )
      queryClient.invalidateQueries({ queryKey: ['modulos-predefinidos'] })
      setModuloOpen(false)
      setEditingModulo(null)
      resetModuloForm()
      notify('Módulo atualizado com sucesso!', 'success')
    } catch (error) {
      console.error('Erro ao atualizar módulo:', error)
      notify('Erro ao atualizar módulo', 'error')
    } finally {
    }
  }

  const handleDeleteModulo = async (modulo: ModuloPredefinidoCargo) => {
    if (!confirm(`Tem certeza que deseja excluir o módulo "${modulo.nome_modulo}"?`)) return
    
    try {
      await moduloPredefinidoService.excluirModuloPredefinido(modulo.modulo_id || modulo.id)
      queryClient.invalidateQueries({ queryKey: ['modulos-predefinidos'] })
      notify('Módulo excluído com sucesso!', 'success')
    } catch (error) {
      console.error('Erro ao excluir módulo:', error)
      notify('Erro ao excluir módulo', 'error')
    } finally {
    }
  }

  const handleCreateItem = async () => {
    try {
      
      // Debug: verificar o que está sendo enviado
      console.log('🔍 [DEBUG] itemForm completo:', itemForm)
      console.log('🔍 [DEBUG] itemForm.modulo_id:', itemForm.modulo_id)
      console.log('🔍 [DEBUG] modulos disponíveis:', modulos.map(m => ({ id: m.id, modulo_id: m.modulo_id, nome: m.nome_modulo })))
      console.log('🔍 [DEBUG] modulos completos:', modulos)
      console.log('🔍 [DEBUG] selectedModulo:', selectedModulo)
      
      // Se itemForm.modulo_id estiver undefined, usar selectedModulo
      let moduloIdParaUsar = itemForm.modulo_id
      if (!moduloIdParaUsar && selectedModulo) {
        moduloIdParaUsar = selectedModulo.modulo_id || selectedModulo.id
        console.log('🔍 [DEBUG] Usando selectedModulo para modulo_id:', moduloIdParaUsar)
      }
      
      // Definir ordem como último item + 1
      const modulo = modulos.find(m => (m.modulo_id || m.id) === moduloIdParaUsar)
      console.log('🔍 [DEBUG] módulo encontrado:', modulo)
      const ultimaOrdem = modulo?.itens?.length ? 
        Math.max(...modulo.itens.map(item => item.ordem || 0)) + 1 : 1
      
      if (tipoItem === 'grupo' && itemForm.grupo_item_id && itemForm.grupo_item_id !== '') {
        // Adicionar grupo inteiro ao módulo
        const grupoSelecionado = gruposItens.find(g => g.id === itemForm.grupo_item_id)
        if (!grupoSelecionado) {
          notify('Grupo não encontrado', 'error')
          return
        }
        
        // Criar um item representando o grupo inteiro
        const itemGrupoForm = {
          ...itemForm,
          modulo_id: moduloIdParaUsar,
          ordem: ultimaOrdem,
          item_estoque_id: null, // Grupo não tem item específico
          item_catalogo_id: null, // Grupo não tem item específico
          grupo_item_id: itemForm.grupo_item_id,
          variacao_item_id: undefined // Será selecionado na entrega
        }
        
        console.log('🔍 [DEBUG] itemGrupoForm antes de enviar:', itemGrupoForm)
        console.log('🔍 [DEBUG] itemGrupoForm.modulo_id:', itemGrupoForm.modulo_id)
        
        await moduloPredefinidoService.adicionarItemModulo(itemGrupoForm as FormModuloPredefinidoItem)
        
        // Atualizar o módulo na lista
        queryClient.invalidateQueries({ queryKey: ['modulos-predefinidos'] })
        
        notify(`Grupo "${grupoSelecionado.nome_grupo}" adicionado ao módulo com sucesso!`, 'success')
      } else {
        // Adicionar item individual
        const itemFormComOrdem = {
          ...itemForm,
          modulo_id: moduloIdParaUsar,
          ordem: ultimaOrdem,
          grupo_item_id: itemForm.grupo_item_id === 'none' ? undefined : itemForm.grupo_item_id,
          variacao_item_id: itemForm.variacao_item_id === 'none' ? undefined : itemForm.variacao_item_id
        }
        
        console.log('🔍 [DEBUG] itemFormComOrdem antes de enviar:', itemFormComOrdem)
        console.log('🔍 [DEBUG] itemFormComOrdem.modulo_id:', itemFormComOrdem.modulo_id)
        
        await moduloPredefinidoService.adicionarItemModulo(itemFormComOrdem)
        
        // Atualizar o módulo na lista para refletir o novo item
        queryClient.invalidateQueries({ queryKey: ['modulos-predefinidos'] })
        
        notify('Item adicionado ao módulo com sucesso!', 'success')
      }
      
      setItemOpen(false)
      resetItemForm()
    } catch (error) {
      console.error('Erro ao adicionar item:', error)
      notify('Erro ao adicionar item ao módulo', 'error')
    } finally {
    }
  }

  // Função para reordenar itens via drag and drop
  const handleDragEnd = async (event: DragEndEvent, moduloId: string) => {
    const { active, over } = event

    if (!over || active.id === over.id) return

    const modulo = modulos.find(m => (m.modulo_id || m.id) === moduloId)
    if (!modulo || !modulo.itens) return

    const oldIndex = modulo.itens.findIndex(item => item.id === active.id)
    const newIndex = modulo.itens.findIndex(item => item.id === over.id)

    if (oldIndex === -1 || newIndex === -1) return

    // Reordenar localmente primeiro
    const novosItens = arrayMove(modulo.itens, oldIndex, newIndex)
    
    // Atualizar ordem no banco de dados
    try {
      
      // Atualizar ordem de todos os itens afetados
      const promises = novosItens.map((item, index) => 
        moduloPredefinidoService.atualizarItemModulo(item.id, { ordem: index + 1 })
      )
      
      await Promise.all(promises)
      
      // Atualizar estado local
      queryClient.invalidateQueries({ queryKey: ['modulos-predefinidos'] })
      
      notify('Ordem dos itens atualizada com sucesso!', 'success')
    } catch (error) {
      console.error('Erro ao reordenar itens:', error)
      notify('Erro ao reordenar itens', 'error')
    } finally {
    }
  }

  const handleUpdateItem = async () => {
    if (!editingItem) return
    
    try {
      
      const itemFormProcessed = {
        ...itemForm,
        grupo_item_id: itemForm.grupo_item_id === 'none' ? undefined : itemForm.grupo_item_id,
        variacao_item_id: itemForm.variacao_item_id === 'none' ? undefined : itemForm.variacao_item_id
      }
      
      await moduloPredefinidoService.atualizarItemModulo(
        editingItem.id,
        itemFormProcessed
      )
      
      // Atualizar o item na lista
      queryClient.invalidateQueries({ queryKey: ['modulos-predefinidos'] })
      
      setItemOpen(false)
      setEditingItem(null)
      resetItemForm()
      notify('Item atualizado com sucesso!', 'success')
    } catch (error) {
      console.error('Erro ao atualizar item:', error)
      notify('Erro ao atualizar item', 'error')
    } finally {
    }
  }

  const handleDeleteItem = async (item: ModuloPredefinidoItem) => {
    if (!confirm(`Tem certeza que deseja remover este item do módulo?`)) return
    
    try {
      await moduloPredefinidoService.removerItemModulo(item.id)
      
      // Atualizar o módulo na lista
      queryClient.invalidateQueries({ queryKey: ['modulos-predefinidos'] })
      
      notify('Item removido do módulo com sucesso!', 'success')
    } catch (error) {
      console.error('Erro ao remover item:', error)
      notify('Erro ao remover item do módulo', 'error')
    } finally {
    }
  }

  const resetModuloForm = () => {
    setModuloForm({
      contrato_id: '',
      cargo_id: '',
      nome_modulo: '',
      descricao: '',
      ativo: true
    })
  }

  const resetItemForm = () => {
    // Manter o modulo_id atual se existir
    const currentModuloId = itemForm.modulo_id
    setItemForm({
      modulo_id: currentModuloId || '',
      item_estoque_id: null,
      item_catalogo_id: '',
      quantidade_padrao: 1,
      obrigatorio: true,
      observacoes: '',
      ordem: 0,
      grupo_item_id: 'none',
      variacao_item_id: 'none'
    })
    setTipoItem('individual')
  }

  const openModuloModal = (modulo?: ModuloPredefinidoCargo) => {
    if (modulo) {
      setEditingModulo(modulo)
      setModuloForm({
        contrato_id: modulo.contrato_id,
        cargo_id: modulo.cargo_id,
        nome_modulo: modulo.nome_modulo,
        descricao: modulo.descricao || '',
        ativo: modulo.ativo
      })
    } else {
      setEditingModulo(null)
      resetModuloForm()
    }
    setModuloOpen(true)
  }

  const openItemModal = (modulo: ModuloPredefinidoCargo, item?: ModuloPredefinidoItem) => {
    console.log('🔍 [DEBUG] openItemModal CHAMADA com módulo:', modulo)
    setSelectedModulo(modulo)
    
    // Usar modulo_id se disponível, senão usar id (compatibilidade)
    const moduloId = modulo.modulo_id || modulo.id
    
    // Debug: verificar o módulo e o ID calculado
    console.log('🔍 [DEBUG] openItemModal - módulo:', modulo)
    console.log('🔍 [DEBUG] openItemModal - modulo.modulo_id:', modulo.modulo_id)
    console.log('🔍 [DEBUG] openItemModal - modulo.id:', modulo.id)
    console.log('🔍 [DEBUG] openItemModal - moduloId calculado:', moduloId)
    console.log('🔍 [DEBUG] openItemModal - selectedModulo será definido como:', modulo)
    
    if (item) {
      setEditingItem(item)
      setItemForm({
        modulo_id: item.modulo_id,
        item_estoque_id: item.item_estoque_id || null,
        item_catalogo_id: item.item_catalogo_id || '',
        quantidade_padrao: item.quantidade_padrao,
        obrigatorio: item.obrigatorio,
        observacoes: item.observacoes || '',
        ordem: item.ordem,
        grupo_item_id: item.grupo_item_id || 'none',
        variacao_item_id: item.variacao_item_id || 'none'
      })
      // Se o item tem grupo_item_id mas não tem item_estoque_id, é um grupo
      setTipoItem(item.grupo_item_id && !item.item_estoque_id ? 'grupo' : 'individual')
    } else {
      setEditingItem(null)
      
      // Verificar se moduloId é válido
      if (!moduloId) {
        console.error('❌ [ERROR] moduloId é inválido:', moduloId)
        console.error('❌ [ERROR] módulo:', modulo)
        notify('Erro: ID do módulo não encontrado', 'error')
        return
      }
      
      const novoItemForm = {
        modulo_id: moduloId,
        item_estoque_id: null,
        item_catalogo_id: '',
        quantidade_padrao: 1,
        obrigatorio: true,
        observacoes: '',
        ordem: (modulo.itens?.length || 0) + 1,
        grupo_item_id: 'none',
        variacao_item_id: 'none'
      }
      
      console.log('🔍 [DEBUG] setItemForm será chamado com:', novoItemForm)
      setItemForm(novoItemForm)
      setTipoItem('individual')
    }
    
    // loadItensEstoque(moduloId) // Function not available
    setItemOpen(true)
  }

  const openDetailsModal = (modulo: ModuloPredefinidoCargo) => {
    setViewingModulo(modulo)
    setDetailsOpen(true)
  }

  const toggleItemEdit = (itemId: string) => {
    setEditingItemId(editingItemId === itemId ? null : itemId)
  }

  const toggleItemVisibility = (itemId: string) => {
    setHiddenItems(prev => {
      const newSet = new Set(prev)
      if (newSet.has(itemId)) {
        newSet.delete(itemId)
      } else {
        newSet.add(itemId)
      }
      return newSet
    })
  }

  const toggleModuleItemsVisibility = (moduloId: string) => {
    setCollapsedModules(prev => {
      const newSet = new Set(prev)
      if (newSet.has(moduloId)) {
        newSet.delete(moduloId)
      } else {
        newSet.add(moduloId)
      }
      return newSet
    })
  }

  const handleInlineUpdate = async (item: ModuloPredefinidoItem, updates: Partial<ModuloPredefinidoItem>) => {
    try {
      
      const itemFormProcessed = {
        ...updates,
        grupo_item_id: updates.grupo_item_id === 'none' ? undefined : updates.grupo_item_id,
        variacao_item_id: updates.variacao_item_id === 'none' ? undefined : updates.variacao_item_id
      }
      
      await moduloPredefinidoService.atualizarItemModulo(
        item.id,
        itemFormProcessed
      )
      
      // Atualizar o item na lista
      queryClient.invalidateQueries({ queryKey: ['modulos-predefinidos'] })
      
      setEditingItemId(null)
      notify('Item atualizado com sucesso!', 'success')
    } catch (error) {
      console.error('Erro ao atualizar item:', error)
      notify('Erro ao atualizar item', 'error')
    } finally {
    }
  }

  if (loading) return <div className="p-6">Carregando...</div>

  return (
    <div>
      <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Módulos Pré-definidos por Contrato</h1>
            <p className="text-sm text-muted-foreground">
              Configure kits de itens padrão por contrato e cargo
            </p>
          </div>
          <Button onClick={() => openModuloModal()}>
            <Plus className="w-4 h-4 mr-2" />
            Novo Módulo
          </Button>
        </div>

        {/* Filtro de Contrato */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <Label htmlFor="filtro-contrato">Filtrar por Contrato</Label>
                <Select
                  value={contratoSelecionado}
                  onValueChange={setContratoSelecionado}
                >
                  <SelectTrigger id="filtro-contrato">
                    <SelectValue placeholder="Todos os contratos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os contratos</SelectItem>
                    {contratos.map(contrato => (
                      <SelectItem key={contrato.id} value={contrato.id}>
                        {contrato.nome} ({contrato.codigo})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {modulos.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              <Package className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <p>Nenhum módulo pré-definido encontrado.</p>
              <p>Crie seu primeiro módulo para começar.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6">
            {modulos.map(modulo => (
              <Card key={modulo.modulo_id || modulo.id} className="overflow-hidden">
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                        <Settings className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">{modulo.nome_modulo}</CardTitle>
                        <CardDescription className="flex items-center gap-2 mt-1">
                          {modulo.contrato_nome && (
                            <>
                              <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                                {modulo.contrato_nome}
                              </Badge>
                              <span className="text-gray-400">•</span>
                            </>
                          )}
                          <span>{modulo.cargo_nome || 'Cargo não definido'}</span>
                          <span className="text-gray-400">•</span>
                          <span>{modulo.total_itens || 0} itens</span>
                        </CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={modulo.ativo ? 'default' : 'secondary'}>
                        {modulo.ativo ? 'Ativo' : 'Inativo'}
                      </Badge>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openDetailsModal(modulo)}
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        Ver Detalhes
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openItemModal(modulo)}
                      >
                        <Plus className="w-4 h-4 mr-1" />
                        Adicionar Item
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openModuloModal(modulo)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-red-600 hover:text-red-700"
                        onClick={() => handleDeleteModulo(modulo)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                
                {modulo.descricao && (
                  <CardContent className="pt-0 pb-4">
                    <p className="text-sm text-muted-foreground">{modulo.descricao}</p>
                  </CardContent>
                )}

                {modulo.itens && modulo.itens.length > 0 && (
                  <CardContent className="pt-0">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-medium text-gray-700">Itens do Módulo</h4>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => toggleModuleItemsVisibility(modulo.modulo_id || modulo.id)}
                          className="text-gray-500 hover:text-gray-700"
                        >
                          {collapsedModules.has(modulo.modulo_id || modulo.id) ? (
                            <ChevronRight className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                      
                      {!collapsedModules.has(modulo.modulo_id || modulo.id) && (
                        <DndContext
                          sensors={sensors}
                          collisionDetection={closestCenter}
                          onDragEnd={(event: DragEndEvent) => handleDragEnd(event, modulo.modulo_id || modulo.id)}
                        >
                        <SortableContext
                          items={modulo.itens.map(item => item.id)}
                          strategy={verticalListSortingStrategy}
                        >
                          <div className="space-y-4">
                            {/* Grupos */}
                            {modulo.itens.filter(item => item.grupo_item_id && !item.item_estoque_id && !item.item_catalogo_id).length > 0 && (
                              <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                  <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
                                  <h5 className="text-sm font-medium text-purple-700">Grupos</h5>
                                </div>
                                <div className="grid gap-2 ml-5">
                                  {modulo.itens
                                    .filter(item => item.grupo_item_id && !item.item_estoque_id && !item.item_catalogo_id)
                                    .sort((a, b) => (a.ordem || 0) - (b.ordem || 0))
                                    .map(item => (
                                      <SortableItem
                                        key={item.id}
                                        item={item}
                                        gruposItens={gruposItens as GrupoItemCompleto[]}
                                        onDelete={handleDeleteItem}
                                        isEditing={editingItemId === item.id}
                                        onToggleEdit={toggleItemEdit}
                                        onToggleVisibility={toggleItemVisibility}
                                        onInlineUpdate={handleInlineUpdate}
                                        isHidden={hiddenItems.has(item.id)}
                                      />
                                    ))}
                                </div>
                              </div>
                            )}

                            {/* EPIs */}
                            {modulo.itens.filter(item => (item.item_catalogo?.categoria || item.item_estoque?.categoria) === 'epi').length > 0 && (
                              <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                  <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                                  <h5 className="text-sm font-medium text-blue-700">EPIs</h5>
                                </div>
                                <div className="grid gap-2 ml-5">
                                  {modulo.itens
                                    .filter(item => (item.item_catalogo?.categoria || item.item_estoque?.categoria) === 'epi')
                                    .sort((a, b) => (a.ordem || 0) - (b.ordem || 0))
                                    .map(item => (
                                      <SortableItem
                                        key={item.id}
                                        item={item}
                                        gruposItens={gruposItens as GrupoItemCompleto[]}
                                        onDelete={handleDeleteItem}
                                        isEditing={editingItemId === item.id}
                                        onToggleEdit={toggleItemEdit}
                                        onToggleVisibility={toggleItemVisibility}
                                        onInlineUpdate={handleInlineUpdate}
                                        isHidden={hiddenItems.has(item.id)}
                                      />
                                    ))}
                                </div>
                              </div>
                            )}

                            {/* Ferramental */}
                            {modulo.itens.filter(item => (item.item_catalogo?.categoria || item.item_estoque?.categoria) === 'ferramental').length > 0 && (
                              <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                  <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                                  <h5 className="text-sm font-medium text-orange-700">Ferramental</h5>
                                </div>
                                <div className="grid gap-2 ml-5">
                                  {modulo.itens
                                    .filter(item => (item.item_catalogo?.categoria || item.item_estoque?.categoria) === 'ferramental')
                                    .sort((a, b) => (a.ordem || 0) - (b.ordem || 0))
                                    .map(item => (
                                      <SortableItem
                                        key={item.id}
                                        item={item}
                                        gruposItens={gruposItens as GrupoItemCompleto[]}
                                        onDelete={handleDeleteItem}
                                        isEditing={editingItemId === item.id}
                                        onToggleEdit={toggleItemEdit}
                                        onToggleVisibility={toggleItemVisibility}
                                        onInlineUpdate={handleInlineUpdate}
                                        isHidden={hiddenItems.has(item.id)}
                                      />
                                    ))}
                                </div>
                              </div>
                            )}

                            {/* Outras categorias */}
                            {modulo.itens.filter(item => {
                              const cat = item.item_catalogo?.categoria || item.item_estoque?.categoria
                              return cat !== 'epi' && 
                              cat !== 'ferramental' &&
                              !(item.grupo_item_id && !item.item_estoque_id && !item.item_catalogo_id)
                            }).length > 0 && (
                              <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                  <div className="w-3 h-3 bg-gray-500 rounded-full"></div>
                                  <h5 className="text-sm font-medium text-gray-700">Outros</h5>
                                </div>
                                <div className="grid gap-2 ml-5">
                                  {modulo.itens
                                    .filter(item => {
                                      const cat = item.item_catalogo?.categoria || item.item_estoque?.categoria
                                      return cat !== 'epi' && 
                                      cat !== 'ferramental' &&
                                      !(item.grupo_item_id && !item.item_estoque_id && !item.item_catalogo_id)
                                    })
                                    .sort((a, b) => (a.ordem || 0) - (b.ordem || 0))
                                    .map(item => (
                                      <SortableItem
                                        key={item.id}
                                        item={item}
                                        gruposItens={gruposItens as GrupoItemCompleto[]}
                                        onDelete={handleDeleteItem}
                                        isEditing={editingItemId === item.id}
                                        onToggleEdit={toggleItemEdit}
                                        onToggleVisibility={toggleItemVisibility}
                                        onInlineUpdate={handleInlineUpdate}
                                        isHidden={hiddenItems.has(item.id)}
                                      />
                                    ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </SortableContext>
                      </DndContext>
                      )}
                    </div>
                  </CardContent>
                )}
              </Card>
            ))}
          </div>
        )}

        {/* Modal de Módulo */}
        <Dialog open={moduloOpen} onOpenChange={setModuloOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingModulo ? 'Editar Módulo' : 'Novo Módulo'}
              </DialogTitle>
              <DialogDescription>
                {editingModulo 
                  ? 'Atualize as informações do módulo pré-definido'
                  : 'Crie um novo módulo pré-definido para um contrato e cargo'
                }
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="contrato">Contrato *</Label>
                <Select
                  value={moduloForm.contrato_id}
                  onValueChange={(value) => setModuloForm(prev => ({ ...prev, contrato_id: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o contrato" />
                  </SelectTrigger>
                  <SelectContent>
                    {contratos.map(contrato => (
                      <SelectItem key={contrato.id} value={contrato.id}>
                        {contrato.nome} ({contrato.codigo})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="cargo">Cargo *</Label>
                <Select
                  value={moduloForm.cargo_id}
                  onValueChange={(value) => setModuloForm(prev => ({ ...prev, cargo_id: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o cargo" />
                  </SelectTrigger>
                  <SelectContent>
                    {cargos.map(cargo => (
                      <SelectItem key={cargo.id} value={cargo.id}>
                        {cargo.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="nome_modulo">Nome do Módulo *</Label>
                <Input
                  id="nome_modulo"
                  value={moduloForm.nome_modulo}
                  onChange={(e) => setModuloForm(prev => ({ ...prev, nome_modulo: e.target.value }))}
                  placeholder="Ex: Kit Básico Operador"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="descricao">Descrição</Label>
                <Textarea
                  id="descricao"
                  value={moduloForm.descricao}
                  onChange={(e) => setModuloForm(prev => ({ ...prev, descricao: e.target.value }))}
                  placeholder="Descreva o módulo e seus itens..."
                  rows={3}
                />
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="ativo"
                  checked={moduloForm.ativo}
                  onCheckedChange={(checked) => setModuloForm(prev => ({ ...prev, ativo: checked }))}
                />
                <Label htmlFor="ativo">Módulo ativo</Label>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setModuloOpen(false)}>
                Cancelar
              </Button>
              <Button 
                onClick={editingModulo ? handleUpdateModulo : handleCreateModulo}
                disabled={!moduloForm.contrato_id || !moduloForm.cargo_id || !moduloForm.nome_modulo || busy}
              >
                {editingModulo ? 'Atualizar' : 'Criar'} Módulo
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Modal de Item */}
        <Dialog open={itemOpen} onOpenChange={setItemOpen}>
          <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingItem ? 'Editar Item' : 'Adicionar Item'}
              </DialogTitle>
              <DialogDescription>
                {editingItem 
                  ? 'Atualize as informações do item no módulo'
                  : `Adicione um item ao módulo "${selectedModulo?.nome_modulo}"`
                }
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              {/* Tipo de item */}
              <div className="space-y-2">
                <Label>Tipo de Item *</Label>
                <div className="flex gap-4">
                  <div className="flex items-center space-x-2">
                    <input
                      type="radio"
                      id="individual"
                      name="tipoItem"
                      value="individual"
                      checked={tipoItem === 'individual'}
                      onChange={(e) => setTipoItem(e.target.value as 'individual' | 'grupo')}
                      className="h-4 w-4"
                    />
                    <Label htmlFor="individual" className="cursor-pointer">Item Individual</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="radio"
                      id="grupo"
                      name="tipoItem"
                      value="grupo"
                      checked={tipoItem === 'grupo'}
                      onChange={(e) => setTipoItem(e.target.value as 'individual' | 'grupo')}
                      className="h-4 w-4"
                    />
                    <Label htmlFor="grupo" className="cursor-pointer">Grupo de Itens</Label>
                  </div>
                </div>
              </div>

              {/* Item individual */}
              {tipoItem === 'individual' && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="item_catalogo">Item de Catálogo *</Label>
                    <SearchableSelect
                      items={itensCatalogo}
                      value={itemForm.item_catalogo_id || ''}
                      onValueChange={(value) => {
                        setItemForm(prev => ({ 
                          ...prev, 
                          item_catalogo_id: value,
                          item_estoque_id: null,
                          grupo_item_id: 'none',
                          variacao_item_id: 'none'
                        }))
                      }}
                      placeholder="Digite para buscar item..."
                      className="w-full max-h-60"
                    />
                  </div>

                  {/* Seleção de Grupo e Variação para Item Individual */}
                  <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
                    <div className="space-y-2">
                      <Label htmlFor="grupo_item">Grupo de Item (Opcional)</Label>
                      <Select
                        value={itemForm.grupo_item_id || 'none'}
                        onValueChange={(value) => {
                          setItemForm(prev => ({ 
                            ...prev, 
                            grupo_item_id: value,
                            variacao_item_id: 'none' // Reset variação quando mudar grupo
                          }))
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione um grupo (opcional)" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Nenhum grupo</SelectItem>
                          {gruposItens.map(grupo => (
                            <SelectItem key={grupo.id} value={grupo.id}>
                              {grupo.nome_grupo} ({grupo.total_variacoes || 0} variações)
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {itemForm.grupo_item_id && itemForm.grupo_item_id !== '' && itemForm.grupo_item_id !== 'none' && (
                      <div className="space-y-2">
                        <Label htmlFor="variacao_item">Variação do Item</Label>
                        <Select
                          value={itemForm.variacao_item_id || 'none'}
                          onValueChange={(value) => setItemForm(prev => ({ ...prev, variacao_item_id: value }))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione uma variação" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Nenhuma variação específica</SelectItem>
                            {gruposItens
                              .find(g => g.id === itemForm.grupo_item_id)
                              ?.variacoes?.map(variacao => (
                                <SelectItem key={variacao.id} value={variacao.id}>
                                  {variacao.nome_variacao} 
                                  {variacao.item_estoque?.estoque_atual !== undefined && 
                                    ` (Estoque: ${variacao.item_estoque.estoque_atual})`
                                  }
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Grupo de itens */}
              {tipoItem === 'grupo' && (
                <div className="space-y-2">
                  <Label htmlFor="grupo_item">Grupo de Item *</Label>
                  <Select
                    value={itemForm.grupo_item_id}
                    onValueChange={(value) => {
                      setItemForm(prev => ({ 
                        ...prev, 
                        grupo_item_id: value,
                        variacao_item_id: '' // Reset variação quando mudar grupo
                      }))
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um grupo" />
                    </SelectTrigger>
                    <SelectContent>
                      {gruposItens.map(grupo => (
                        <SelectItem key={grupo.id} value={grupo.id}>
                          {grupo.nome_grupo} ({grupo.total_variacoes || 0} variações)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}


              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="quantidade">Quantidade Padrão *</Label>
                  <Input
                    id="quantidade"
                    type="number"
                    min="1"
                    value={itemForm.quantidade_padrao}
                    onChange={(e) => setItemForm(prev => ({ ...prev, quantidade_padrao: parseInt(e.target.value) || 1 }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="ordem">Ordem</Label>
                  <Input
                    id="ordem"
                    type="number"
                    min="0"
                    value={itemForm.ordem}
                    onChange={(e) => setItemForm(prev => ({ ...prev, ordem: parseInt(e.target.value) || 0 }))}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="observacoes">Observações</Label>
                <Textarea
                  id="observacoes"
                  value={itemForm.observacoes}
                  onChange={(e) => setItemForm(prev => ({ ...prev, observacoes: e.target.value }))}
                  placeholder="Observações sobre este item..."
                  rows={2}
                />
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="obrigatorio"
                  checked={itemForm.obrigatorio}
                  onCheckedChange={(checked) => setItemForm(prev => ({ ...prev, obrigatorio: checked }))}
                />
                <Label htmlFor="obrigatorio">Item obrigatório</Label>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setItemOpen(false)}>
                Cancelar
              </Button>
              <Button 
                onClick={editingItem ? handleUpdateItem : handleCreateItem}
                disabled={
                  busy || 
                  (tipoItem === 'individual' && !itemForm.item_catalogo_id) ||
                  (tipoItem === 'grupo' && !itemForm.grupo_item_id)
                }
              >
                {editingItem ? 'Atualizar' : 'Adicionar'} Item
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Modal de Detalhes do Módulo */}
        <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                Detalhes do Módulo: {viewingModulo?.nome_modulo}
              </DialogTitle>
              <DialogDescription>
                Visualização completa de todos os itens do módulo
              </DialogDescription>
            </DialogHeader>
            
            {viewingModulo && (
              <div className="space-y-6">
                {/* Informações do Módulo */}
                <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
                  <div>
                    <Label className="text-sm font-medium text-gray-600">Contrato</Label>
                    <p className="text-sm">{viewingModulo.contrato?.nome}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-600">Cargo</Label>
                    <p className="text-sm">{viewingModulo.cargo?.nome}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-600">Total de Itens</Label>
                    <p className="text-sm">{viewingModulo.total_itens || 0}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-600">Status</Label>
                    <Badge variant={viewingModulo.ativo ? 'default' : 'secondary'}>
                      {viewingModulo.ativo ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </div>
                  <div className="col-span-2">
                    <Label className="text-sm font-medium text-gray-600">Criado em</Label>
                    <p className="text-sm">{new Date(viewingModulo.criado_em).toLocaleDateString()}</p>
                  </div>
                </div>

                {/* Descrição */}
                {viewingModulo.descricao && (
                  <div>
                    <Label className="text-sm font-medium text-gray-600">Descrição</Label>
                    <p className="text-sm text-gray-700 mt-1">{viewingModulo.descricao}</p>
                  </div>
                )}

                {/* Lista de Itens */}
                <div>
                  <Label className="text-sm font-medium text-gray-600 mb-3 block">Itens do Módulo</Label>
                  {viewingModulo.itens && viewingModulo.itens.length > 0 ? (
                    <div className="space-y-3">
                      {viewingModulo.itens
                        .sort((a, b) => (a.ordem || 0) - (b.ordem || 0))
                        .map((item, index) => (
                          <div key={item.id} className="flex items-center justify-between p-3 border rounded-lg">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-sm font-medium text-blue-600">
                                {index + 1}
                              </div>
                              <div>
                                <p className="font-medium">
                                  {item.item_catalogo?.nome || item.item_estoque?.nome || item.grupo_item?.nome_grupo || 'Item sem nome'}
                                </p>
                                <div className="flex items-center gap-4 text-sm text-gray-600">
                                  <span>Quantidade: {item.quantidade_padrao}</span>
                                  <span>Ordem: {item.ordem || 0}</span>
                                  <Badge variant={item.obrigatorio ? 'default' : 'secondary'}>
                                    {item.obrigatorio ? 'Obrigatório' : 'Opcional'}
                                  </Badge>
                                  {(item.item_catalogo?.categoria || item.item_estoque?.categoria) && (
                                    <Badge variant="outline">
                                      {item.item_catalogo?.categoria || item.item_estoque?.categoria}
                                    </Badge>
                                  )}
                                </div>
                                {item.observacoes && (
                                  <p className="text-sm text-gray-500 mt-1">{item.observacoes}</p>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setDetailsOpen(false)
                                  openItemModal(viewingModulo, item)
                                }}
                              >
                                <Edit className="w-3 h-3 mr-1" />
                                Editar
                              </Button>
                            </div>
                          </div>
                        ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <Package className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                      <p>Nenhum item adicionado ao módulo</p>
                    </div>
                  )}
                </div>
              </div>
            )}
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setDetailsOpen(false)}>
                Fechar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
