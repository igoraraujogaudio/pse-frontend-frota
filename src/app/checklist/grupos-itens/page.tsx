'use client'

import React, { useEffect, useState, useCallback, useMemo } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useNotification } from '@/contexts/NotificationContext'
import { checklistGrupoService } from '@/services/checklistGrupoService'
import type {
  ChecklistGrupo,
  ChecklistGrupoCompleto,
  FormChecklistGrupo,
  FormChecklistGrupoItem,
  ItemCatalogo
} from '@/services/checklistGrupoService'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { 
  Plus, 
  Edit, 
  Trash2, 
  Package, 
  Search, 
  GripVertical,
  Layers,
  Eye,
  EyeOff,
  RefreshCw,
  Zap,
  Group,
  ChevronUp,
  ChevronDown,
  Shield,
  FileText,
  Sparkles,
  Loader2,
  Check,
  X
} from 'lucide-react'
import { PERMISSION_CODES } from '@/hooks/useModularPermissions'
import ProtectedRoute from '@/components/ProtectedRoute'

interface ItemDoGrupo {
  id: string
  item_catalogo_id: string
  item_catalogo_nome: string
  item_catalogo_codigo: string
  item_catalogo_descricao?: string
  obrigatorio_no_grupo: boolean
  ordem_no_grupo: number
  ativo: boolean
}

interface GrupoSuggestion {
  grupo_nome: string;
  grupo_descricao: string;
  grupo_categoria: 'epi' | 'ferramental' | 'equipamento' | 'documento' | 'outro';
  itens: ItemCatalogo[];
}
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
function SortableGrupoItem({ 
  item, 
  grupo, 
  onEdit, 
  onDelete, 
  onToggleActive 
}: {
  item: ItemDoGrupo
  grupo: ChecklistGrupo
  onEdit: (grupo: ChecklistGrupo, item: ItemDoGrupo) => void
  onDelete: (item: ItemDoGrupo) => void
  onToggleActive: (item: ItemDoGrupo) => void
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

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-white border rounded-lg p-3 mb-2 ${
        isDragging ? 'shadow-lg' : 'shadow-sm'
      } ${!item.ativo ? 'opacity-60' : ''}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div
            {...attributes}
            {...listeners}
            className="cursor-grab hover:cursor-grabbing text-gray-400 hover:text-gray-600"
          >
            <GripVertical className="h-4 w-4" />
          </div>
          
          <div className="flex-1">
            <div className="flex items-center space-x-2">
              <h4 className="font-medium text-sm">{item.item_catalogo_nome}</h4>
              <Badge variant="outline" className="text-xs">
                {item.item_catalogo_codigo}
              </Badge>
              {item.obrigatorio_no_grupo && (
                <Badge variant="destructive" className="text-xs">
                  Obrigatório
                </Badge>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {item.item_catalogo_descricao || 'Sem descrição'}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onToggleActive(item)}
            className="text-xs"
          >
            {item.ativo ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onEdit(grupo, item)}
            className="text-xs"
          >
            <Edit className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDelete(item)}
            className="text-xs text-red-600 hover:text-red-700"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </div>
  )
}

// Componente para card de grupo
function GrupoCard({ 
  grupo, 
  onEdit, 
  onDelete, 
  onAddItem, 
  onEditItem, 
  onDeleteItem, 
  onToggleItemActive,
  onReorderItems,
  isExpanded,
  onToggleExpansion 
}: {
  grupo: ChecklistGrupoCompleto
  onEdit: (grupo: ChecklistGrupo) => void
  onDelete: (grupo: ChecklistGrupo) => void
  onAddItem: (grupo: ChecklistGrupo) => void
  onEditItem: (grupo: ChecklistGrupo, item: ItemDoGrupo) => void
  onDeleteItem: (item: ItemDoGrupo) => void
  onToggleItemActive: (item: ItemDoGrupo) => void
  onReorderItems: (grupoId: string, items: ItemDoGrupo[]) => void
  isExpanded: boolean
  onToggleExpansion: (grupoId: string) => void
}) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (active.id !== over?.id) {
      const oldIndex = grupo.itens_do_grupo.findIndex(item => item.id === active.id)
      const newIndex = grupo.itens_do_grupo.findIndex(item => item.id === over?.id)
      
      const newItems = arrayMove(grupo.itens_do_grupo, oldIndex, newIndex)
      
      // Atualizar ordem no backend
      const itemsWithOrder = newItems.map((item, index) => ({
        id: item.id,
        ordem_no_grupo: index
      }))
      
      onReorderItems(grupo.id, itemsWithOrder as ItemDoGrupo[])
    }
  }

  const getCategoriaIcon = (categoria: string) => {
    switch (categoria) {
      case 'epi': return <Shield className="h-4 w-4" />
      case 'ferramental': return <Package className="h-4 w-4" />
      case 'equipamento': return <Layers className="h-4 w-4" />
      case 'documento': return <FileText className="h-4 w-4" />
      default: return <Group className="h-4 w-4" />
    }
  }

  const getCategoriaColor = (categoria: string) => {
    switch (categoria) {
      case 'epi': return 'bg-green-100 text-green-800'
      case 'ferramental': return 'bg-blue-100 text-blue-800'
      case 'equipamento': return 'bg-purple-100 text-purple-800'
      case 'documento': return 'bg-orange-100 text-orange-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <Card className="mb-4">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className={`p-2 rounded-lg ${getCategoriaColor(grupo.grupo_categoria)}`}>
              {getCategoriaIcon(grupo.grupo_categoria)}
            </div>
            <div>
              <CardTitle className="text-lg flex items-center space-x-2">
                <span>{grupo.grupo_nome}</span>
                {grupo.requer_laudo && (
                  <Badge variant="secondary" className="text-xs">
                    Requer Laudo
                  </Badge>
                )}
                {grupo.obrigatorio && (
                  <Badge variant="destructive" className="text-xs">
                    Obrigatório
                  </Badge>
                )}
                {!grupo.ativo && (
                  <Badge variant="outline" className="text-xs">
                    Inativo
                  </Badge>
                )}
              </CardTitle>
              <CardDescription className="text-sm">
                {grupo.grupo_descricao || 'Sem descrição'}
              </CardDescription>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <Badge variant="outline" className="text-xs">
              {grupo.total_itens_grupo} itens
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onToggleExpansion(grupo.id)}
            >
              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onAddItem(grupo)}
            >
              <Plus className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onEdit(grupo)}
            >
              <Edit className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDelete(grupo)}
              className="text-red-600 hover:text-red-700"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-sm">Itens do Grupo</h4>
              <Badge variant="outline" className="text-xs">
                Ordem: {grupo.ordem_exibicao}
              </Badge>
            </div>
            
            {grupo.itens_do_grupo.length > 0 ? (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={grupo.itens_do_grupo.map(item => item.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {grupo.itens_do_grupo.map((item) => (
                    <SortableGrupoItem
                      key={item.id}
                      item={item}
                      grupo={grupo}
                      onEdit={onEditItem}
                      onDelete={onDeleteItem}
                      onToggleActive={onToggleItemActive}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            ) : (
              <div className="text-center py-6 text-gray-500">
                <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Nenhum item adicionado ao grupo</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onAddItem(grupo)}
                  className="mt-2"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Adicionar Item
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  )
}

export default function GruposChecklistPage() {
  return (
    <ProtectedRoute 
      permission={PERMISSION_CODES.CONFIGURACOES.GERENCIAR_USUARIOS} // TODO: Criar permissão específica para checklist
      fallback="Você não tem permissão para acessar esta página"
    >
      <GruposChecklistContent />
    </ProtectedRoute>
  )
}

function GruposChecklistContent() {
  const { user, loading } = useAuth()
  const { notify } = useNotification()
  
  const [grupos, setGrupos] = useState<ChecklistGrupoCompleto[]>([])
  const [itensCatalogo, setItensCatalogo] = useState<ItemCatalogo[]>([])
  const [busy, setBusy] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [categoriaFilter, setCategoriaFilter] = useState<string>('todas')
  const [statusFilter, setStatusFilter] = useState<string>('todas')
  const [showAutoGrouping, setShowAutoGrouping] = useState(false)
  const [suggestedGroups, setSuggestedGroups] = useState<GrupoSuggestion[]>([])
  const [autoGroupingLoading, setAutoGroupingLoading] = useState(false)
  
  // Estados para controle de expansão dos grupos
  const [gruposExpandidos, setGruposExpandidos] = useState<Set<string>>(new Set())
  
  // Estados para modais
  const [grupoOpen, setGrupoOpen] = useState(false)
  const [itemOpen, setItemOpen] = useState(false)
  const [editingGrupo, setEditingGrupo] = useState<ChecklistGrupo | null>(null)
  const [editingItem, setEditingItem] = useState<ItemDoGrupo | null>(null)
  const [selectedGrupo, setSelectedGrupo] = useState<ChecklistGrupo | null>(null)
  
  // Estados para formulários
  const [grupoForm, setGrupoForm] = useState<FormChecklistGrupo>({
    grupo_nome: '',
    grupo_descricao: '',
    grupo_categoria: 'epi',
    requer_laudo: false,
    obrigatorio: true,
    permite_qualquer_item: true,
    ordem_exibicao: 0,
    ativo: true
  })
  
  const [itemForm, setItemForm] = useState<FormChecklistGrupoItem>({
    grupo_id: '',
    item_catalogo_id: '',
    obrigatorio_no_grupo: true,
    ordem_no_grupo: 0,
    ativo: true
  })

  const loadInitialData = useCallback(async () => {
    setBusy(true)
    try {
      const [gruposData, itensData] = await Promise.all([
        checklistGrupoService.getGruposChecklist(),
        checklistGrupoService.getItensCatalogoDisponiveisParaGrupo()
      ])
      
      // Carregar detalhes completos dos grupos
      const gruposCompletos = await Promise.all(
        gruposData.map(async (grupo: ChecklistGrupo) => {
          if (!grupo.id) {
            console.warn('Grupo sem ID válido:', grupo)
            return null
          }
          try {
            const detalhes = await checklistGrupoService.getGrupoChecklistById(grupo.id)
            return detalhes || grupo
          } catch (error) {
            console.error(`Erro ao carregar detalhes do grupo ${grupo.id}:`, error)
            return grupo
          }
        })
      )
      
      setGrupos(gruposCompletos.filter(g => g !== null) as ChecklistGrupoCompleto[])
      setItensCatalogo(itensData)
    } catch (error) {
      console.error('Erro ao carregar dados:', error)
      notify('Erro ao carregar dados', 'error')
    } finally {
      setBusy(false)
    }
  }, [notify])

  useEffect(() => {
    if (!loading && user) {
      loadInitialData()
    }
  }, [loading, user, loadInitialData])

  // Funções para controle de expansão dos grupos
  const toggleGrupoExpansao = (grupoId: string) => {
    setGruposExpandidos(prev => {
      const novoSet = new Set(prev)
      if (novoSet.has(grupoId)) {
        novoSet.delete(grupoId)
      } else {
        novoSet.add(grupoId)
      }
      return novoSet
    })
  }

  const expandirTodosGrupos = () => {
    const todosIds = grupos.map(grupo => grupo.id)
    setGruposExpandidos(new Set(todosIds))
  }

  const fecharTodosGrupos = () => {
    setGruposExpandidos(new Set())
  }

  const handleCreateGrupo = async () => {
    try {
      setBusy(true)
      await checklistGrupoService.criarGrupoChecklist(grupoForm)
      notify('Grupo criado com sucesso!', 'success')
      setGrupoOpen(false)
      resetGrupoForm()
      loadInitialData()
    } catch (error) {
      console.error('Erro ao criar grupo:', error)
      notify('Erro ao criar grupo', 'error')
    } finally {
      setBusy(false)
    }
  }

  const handleUpdateGrupo = async () => {
    if (!editingGrupo) return
    
    try {
      setBusy(true)
      await checklistGrupoService.atualizarGrupoChecklist(editingGrupo.id, grupoForm)
      notify('Grupo atualizado com sucesso!', 'success')
      setGrupoOpen(false)
      setEditingGrupo(null)
      resetGrupoForm()
      loadInitialData()
    } catch (error) {
      console.error('Erro ao atualizar grupo:', error)
      notify('Erro ao atualizar grupo', 'error')
    } finally {
      setBusy(false)
    }
  }

  const handleDeleteGrupo = async (grupo: ChecklistGrupo) => {
    if (!confirm(`Tem certeza que deseja excluir o grupo "${grupo.grupo_nome}"?`)) return
    
    try {
      setBusy(true)
      await checklistGrupoService.excluirGrupoChecklist(grupo.id)
      notify('Grupo excluído com sucesso!', 'success')
      loadInitialData()
    } catch (error) {
      console.error('Erro ao excluir grupo:', error)
      notify('Erro ao excluir grupo', 'error')
    } finally {
      setBusy(false)
    }
  }

  const handleCreateItem = async () => {
    try {
      setBusy(true)
      await checklistGrupoService.adicionarItemGrupoChecklist(itemForm)
      notify('Item adicionado ao grupo com sucesso!', 'success')
      setItemOpen(false)
      resetItemForm()
      loadInitialData()
    } catch (error) {
      console.error('Erro ao adicionar item:', error)
      notify('Erro ao adicionar item', 'error')
    } finally {
      setBusy(false)
    }
  }

  const handleUpdateItem = async () => {
    if (!editingItem) return
    
    try {
      setBusy(true)
      await checklistGrupoService.atualizarItemGrupoChecklist(editingItem.id, itemForm)
      notify('Item atualizado com sucesso!', 'success')
      setItemOpen(false)
      setEditingItem(null)
      resetItemForm()
      loadInitialData()
    } catch (error) {
      console.error('Erro ao atualizar item:', error)
      notify('Erro ao atualizar item', 'error')
    } finally {
      setBusy(false)
    }
  }

  const handleDeleteItem = async (item: ItemDoGrupo) => {
    if (!confirm(`Tem certeza que deseja excluir este item do grupo?`)) return
    
    try {
      setBusy(true)
      await checklistGrupoService.excluirItemGrupoChecklist(item.id)
      notify('Item removido do grupo com sucesso!', 'success')
      loadInitialData()
    } catch (error) {
      console.error('Erro ao excluir item:', error)
      notify('Erro ao excluir item', 'error')
    } finally {
      setBusy(false)
    }
  }

  const handleToggleItemActive = async (item: ItemDoGrupo) => {
    try {
      setBusy(true)
      await checklistGrupoService.atualizarItemGrupoChecklist(item.id, { ativo: !item.ativo })
      notify(`Item ${item.ativo ? 'desativado' : 'ativado'} com sucesso!`, 'success')
      loadInitialData()
    } catch (error) {
      console.error('Erro ao alterar status do item:', error)
      notify('Erro ao alterar status do item', 'error')
    } finally {
      setBusy(false)
    }
  }

  const handleReorderItems = async (grupoId: string, items: ItemDoGrupo[]) => {
    try {
      await checklistGrupoService.reordenarItensGrupo(grupoId, items)
      loadInitialData()
    } catch (error) {
      console.error('Erro ao reordenar itens:', error)
      notify('Erro ao reordenar itens', 'error')
    }
  }

  const handleAutoGrouping = async () => {
    try {
      setAutoGroupingLoading(true)
      const suggestions = await checklistGrupoService.gerarGruposAutomaticamente()
      setSuggestedGroups(suggestions as GrupoSuggestion[])
      setShowAutoGrouping(true)
    } catch (error) {
      console.error('Erro ao gerar sugestões de agrupamento:', error)
      notify('Erro ao gerar sugestões de agrupamento', 'error')
    } finally {
      setAutoGroupingLoading(false)
    }
  }

  const handleCreateGroupFromSuggestion = async (suggestion: GrupoSuggestion) => {
    try {
      setBusy(true)
      
      // Criar o grupo
      const novoGrupo = await checklistGrupoService.criarGrupoChecklist({
        grupo_nome: suggestion.grupo_nome,
        grupo_descricao: suggestion.grupo_descricao,
        grupo_categoria: suggestion.grupo_categoria,
        requer_laudo: suggestion.itens.some((item) => item.requer_laudo),
        obrigatorio: true,
        permite_qualquer_item: true,
        ordem_exibicao: grupos.length + 1,
        ativo: true
      })

      // Adicionar itens ao grupo
      for (let i = 0; i < suggestion.itens.length; i++) {
        const item = suggestion.itens[i]
        await checklistGrupoService.adicionarItemGrupoChecklist({
          grupo_id: novoGrupo.id,
          item_catalogo_id: item.id,
          obrigatorio_no_grupo: true,
          ordem_no_grupo: i,
          ativo: true
        })
      }

      notify(`Grupo "${suggestion.grupo_nome}" criado com sucesso!`, 'success')
      loadInitialData()
      
      // Remover sugestão da lista
      setSuggestedGroups(prev => prev.filter(s => s.grupo_nome !== suggestion.grupo_nome))
      
    } catch (error) {
      console.error('Erro ao criar grupo da sugestão:', error)
      notify('Erro ao criar grupo da sugestão', 'error')
    } finally {
      setBusy(false)
    }
  }

  const handleRejectSuggestion = (suggestion: GrupoSuggestion) => {
    setSuggestedGroups(prev => prev.filter(s => s.grupo_nome !== suggestion.grupo_nome))
  }

  const resetGrupoForm = () => {
    setGrupoForm({
      grupo_nome: '',
      grupo_descricao: '',
      grupo_categoria: 'epi',
      requer_laudo: false,
      obrigatorio: true,
      permite_qualquer_item: true,
      ordem_exibicao: 0,
      ativo: true
    })
  }

  const resetItemForm = () => {
    setItemForm({
      grupo_id: '',
      item_catalogo_id: '',
      obrigatorio_no_grupo: true,
      ordem_no_grupo: 0,
      ativo: true
    })
  }

  const openGrupoModal = (grupo?: ChecklistGrupo) => {
    if (grupo) {
      setEditingGrupo(grupo)
      setGrupoForm({
        grupo_nome: grupo.grupo_nome,
        grupo_descricao: grupo.grupo_descricao || '',
        grupo_categoria: grupo.grupo_categoria,
        requer_laudo: grupo.requer_laudo,
        obrigatorio: grupo.obrigatorio,
        permite_qualquer_item: grupo.permite_qualquer_item,
        ordem_exibicao: grupo.ordem_exibicao,
        ativo: grupo.ativo
      })
    } else {
      resetGrupoForm()
      setEditingGrupo(null)
    }
    setGrupoOpen(true)
  }

  const openItemModal = (grupo: ChecklistGrupo, item?: ItemDoGrupo) => {
    if (item) {
      setEditingItem(item)
      setItemForm({
        grupo_id: grupo.id,
        item_catalogo_id: item.item_catalogo_id,
        obrigatorio_no_grupo: item.obrigatorio_no_grupo,
        ordem_no_grupo: item.ordem_no_grupo,
        ativo: item.ativo
      })
    } else {
      setItemForm({
        grupo_id: grupo.id,
        item_catalogo_id: '',
        obrigatorio_no_grupo: true,
        ordem_no_grupo: 0,
        ativo: true
      })
      setEditingItem(null)
    }
    setSelectedGrupo(grupo)
    setItemOpen(true)
  }

  // Filtrar grupos
  const gruposFiltrados = useMemo(() => {
    return grupos.filter(grupo => {
      const matchSearch = !searchTerm || 
        grupo.grupo_nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (grupo.grupo_descricao && grupo.grupo_descricao.toLowerCase().includes(searchTerm.toLowerCase()))
      
      const matchCategoria = categoriaFilter === 'todas' || grupo.grupo_categoria === categoriaFilter
      const matchStatus = statusFilter === 'todas' || 
        (statusFilter === 'ativo' && grupo.ativo) ||
        (statusFilter === 'inativo' && !grupo.ativo)
      
      return matchSearch && matchCategoria && matchStatus
    })
  }, [grupos, searchTerm, categoriaFilter, statusFilter])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Grupos de Itens - Checklist</h1>
          <p className="text-gray-600 mt-1">
            Gerencie grupos de itens para o sistema de checklist individual
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <Button
            variant="outline"
            onClick={handleAutoGrouping}
            disabled={autoGroupingLoading}
            className="flex items-center space-x-2"
          >
            {autoGroupingLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Zap className="h-4 w-4" />
            )}
            <span>Agrupamento Automático</span>
          </Button>
          <Button
            onClick={() => openGrupoModal()}
            className="flex items-center space-x-2"
          >
            <Plus className="h-4 w-4" />
            <span>Novo Grupo</span>
          </Button>
        </div>
      </div>

      {/* Filtros */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex-1 min-w-[300px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Buscar grupos..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <Select value={categoriaFilter} onValueChange={setCategoriaFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas as categorias</SelectItem>
                <SelectItem value="epi">EPI</SelectItem>
                <SelectItem value="ferramental">Ferramental</SelectItem>
                <SelectItem value="equipamento">Equipamento</SelectItem>
                <SelectItem value="documento">Documento</SelectItem>
                <SelectItem value="outro">Outro</SelectItem>
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todos</SelectItem>
                <SelectItem value="ativo">Ativo</SelectItem>
                <SelectItem value="inativo">Inativo</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={expandirTodosGrupos}
              >
                Expandir Todos
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={fecharTodosGrupos}
              >
                Fechar Todos
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Grupos */}
      {busy && (
        <div className="flex items-center justify-center py-8">
          <RefreshCw className="h-6 w-6 animate-spin mr-2" />
          <span>Carregando...</span>
        </div>
      )}

      {!busy && gruposFiltrados.length === 0 && (
        <Card>
          <CardContent className="text-center py-12">
            <Package className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Nenhum grupo encontrado
            </h3>
            <p className="text-gray-600 mb-4">
              {searchTerm || categoriaFilter !== 'todas' || statusFilter !== 'todas'
                ? 'Tente ajustar os filtros de busca.'
                : 'Comece criando seu primeiro grupo de itens.'}
            </p>
            <Button onClick={() => openGrupoModal()}>
              <Plus className="h-4 w-4 mr-2" />
              Criar Primeiro Grupo
            </Button>
          </CardContent>
        </Card>
      )}

      {!busy && gruposFiltrados.map((grupo) => (
        <GrupoCard
          key={grupo.id}
          grupo={grupo}
          onEdit={openGrupoModal}
          onDelete={handleDeleteGrupo}
          onAddItem={openItemModal}
          onEditItem={openItemModal}
          onDeleteItem={handleDeleteItem}
          onToggleItemActive={handleToggleItemActive}
          onReorderItems={handleReorderItems}
          isExpanded={gruposExpandidos.has(grupo.id)}
          onToggleExpansion={toggleGrupoExpansao}
        />
      ))}

      {/* Modal de Grupo */}
      <Dialog open={grupoOpen} onOpenChange={setGrupoOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingGrupo ? 'Editar Grupo' : 'Novo Grupo'}
            </DialogTitle>
            <DialogDescription>
              {editingGrupo 
                ? 'Atualize as informações do grupo de itens.'
                : 'Crie um novo grupo de itens para o checklist.'
              }
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="grupo_nome">Nome do Grupo *</Label>
                <Input
                  id="grupo_nome"
                  value={grupoForm.grupo_nome}
                  onChange={(e) => setGrupoForm(prev => ({ ...prev, grupo_nome: e.target.value }))}
                  placeholder="Ex: Botina de Segurança"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="grupo_categoria">Categoria *</Label>
                <Select
                  value={grupoForm.grupo_categoria}
                  onValueChange={(value: 'epi' | 'ferramental' | 'equipamento' | 'documento' | 'outro') => setGrupoForm(prev => ({ ...prev, grupo_categoria: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="epi">EPI</SelectItem>
                    <SelectItem value="ferramental">Ferramental</SelectItem>
                    <SelectItem value="equipamento">Equipamento</SelectItem>
                    <SelectItem value="documento">Documento</SelectItem>
                    <SelectItem value="outro">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="grupo_descricao">Descrição</Label>
              <Textarea
                id="grupo_descricao"
                value={grupoForm.grupo_descricao}
                onChange={(e) => setGrupoForm(prev => ({ ...prev, grupo_descricao: e.target.value }))}
                placeholder="Descrição do grupo de itens..."
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="ordem_exibicao">Ordem de Exibição</Label>
                <Input
                  id="ordem_exibicao"
                  type="number"
                  value={grupoForm.ordem_exibicao}
                  onChange={(e) => setGrupoForm(prev => ({ ...prev, ordem_exibicao: parseInt(e.target.value) || 0 }))}
                />
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="requer_laudo"
                    checked={grupoForm.requer_laudo}
                    onCheckedChange={(checked) => setGrupoForm(prev => ({ ...prev, requer_laudo: checked }))}
                  />
                  <Label htmlFor="requer_laudo">Requer Laudo</Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="obrigatorio"
                    checked={grupoForm.obrigatorio}
                    onCheckedChange={(checked) => setGrupoForm(prev => ({ ...prev, obrigatorio: checked }))}
                  />
                  <Label htmlFor="obrigatorio">Obrigatório</Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="permite_qualquer_item"
                    checked={grupoForm.permite_qualquer_item}
                    onCheckedChange={(checked) => setGrupoForm(prev => ({ ...prev, permite_qualquer_item: checked }))}
                  />
                  <Label htmlFor="permite_qualquer_item">Permite Qualquer Item</Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="ativo"
                    checked={grupoForm.ativo}
                    onCheckedChange={(checked) => setGrupoForm(prev => ({ ...prev, ativo: checked }))}
                  />
                  <Label htmlFor="ativo">Ativo</Label>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setGrupoOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={editingGrupo ? handleUpdateGrupo : handleCreateGrupo}
              disabled={!grupoForm.grupo_nome.trim() || busy}
            >
              {busy ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                editingGrupo ? 'Atualizar' : 'Criar'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Item */}
      <Dialog open={itemOpen} onOpenChange={setItemOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingItem ? 'Editar Item' : 'Adicionar Item ao Grupo'}
            </DialogTitle>
            <DialogDescription>
              {editingItem 
                ? 'Atualize as informações do item no grupo.'
                : `Adicione um item ao grupo "${selectedGrupo?.grupo_nome}".`
              }
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="item_catalogo_id">Item do Catálogo *</Label>
              <SearchableSelect
                items={itensCatalogo.map(item => ({
                  id: item.id,
                  nome: item.nome,
                  codigo: item.codigo,
                  categoria: item.categoria
                }))}
                value={itemForm.item_catalogo_id}
                onValueChange={(value) => setItemForm(prev => ({ ...prev, item_catalogo_id: value }))}
                options={itensCatalogo.map(item => ({
                  value: item.id,
                  label: `${item.nome} (${item.codigo})`,
                  description: item.descricao || ''
                }))}
                placeholder="Selecione um item do catálogo..."
                disabled={!!editingItem}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="ordem_no_grupo">Ordem no Grupo</Label>
                <Input
                  id="ordem_no_grupo"
                  type="number"
                  value={itemForm.ordem_no_grupo}
                  onChange={(e) => setItemForm(prev => ({ ...prev, ordem_no_grupo: parseInt(e.target.value) || 0 }))}
                />
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="obrigatorio_no_grupo"
                    checked={itemForm.obrigatorio_no_grupo}
                    onCheckedChange={(checked) => setItemForm(prev => ({ ...prev, obrigatorio_no_grupo: checked }))}
                  />
                  <Label htmlFor="obrigatorio_no_grupo">Obrigatório no Grupo</Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="item_ativo"
                    checked={itemForm.ativo}
                    onCheckedChange={(checked) => setItemForm(prev => ({ ...prev, ativo: checked }))}
                  />
                  <Label htmlFor="item_ativo">Ativo</Label>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setItemOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={editingItem ? handleUpdateItem : handleCreateItem}
              disabled={!itemForm.item_catalogo_id || busy}
            >
              {busy ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                editingItem ? 'Atualizar' : 'Adicionar'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Agrupamento Automático */}
      <Dialog open={showAutoGrouping} onOpenChange={setShowAutoGrouping}>
        <DialogContent className="sm:max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-yellow-500" />
              Sugestões de Agrupamento Automático
            </DialogTitle>
            <DialogDescription>
              O sistema analisou os itens do catálogo e sugeriu os seguintes agrupamentos baseados nos 36 itens do checklist.
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto space-y-4">
            {suggestedGroups.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Sparkles className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p>Nenhuma sugestão de agrupamento encontrada.</p>
                <p className="text-sm">Verifique se há itens no catálogo que correspondam aos padrões de checklist.</p>
              </div>
            ) : (
              suggestedGroups.map((suggestion, index) => (
                <div key={index} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg text-gray-900">{suggestion.grupo_nome}</h3>
                      <p className="text-sm text-gray-600 mt-1">{suggestion.grupo_descricao}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant="outline" className="text-xs">
                          {suggestion.grupo_categoria}
                        </Badge>
                        <Badge variant="secondary" className="text-xs">
                          {suggestion.itens.length} itens
                        </Badge>
                        {suggestion.itens.some((item) => item.requer_laudo) && (
                          <Badge variant="destructive" className="text-xs">
                            Requer Laudo
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleCreateGroupFromSuggestion(suggestion)}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        <Check className="w-4 h-4 mr-1" />
                        Aceitar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleRejectSuggestion(suggestion)}
                      >
                        <X className="w-4 h-4 mr-1" />
                        Rejeitar
                      </Button>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {suggestion.itens.map((item) => (
                      <div key={item.id} className="flex items-center gap-2 p-2 bg-gray-50 rounded text-sm">
                        <Package className="w-4 h-4 text-gray-500" />
                        <span className="flex-1">{item.nome}</span>
                        <span className="text-xs text-gray-500">({item.codigo})</span>
                        {item.requer_laudo && (
                          <Badge variant="destructive" className="text-xs">
                            Laudo
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
          
          <DialogFooter className="border-t pt-4">
            <Button variant="outline" onClick={() => setShowAutoGrouping(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
