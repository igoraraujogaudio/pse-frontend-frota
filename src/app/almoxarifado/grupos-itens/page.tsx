'use client'

import React, { useState, useMemo } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useNotification } from '@/contexts/NotificationContext'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { grupoItemService } from '@/services/grupoItemService'
import type {
  GrupoItem,
  VariacaoItem,
  GrupoItemCompleto,
  FormGrupoItem,
  FormVariacaoItem,
  ItemEstoque
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
  ArrowUpDown,
  RefreshCw,
  Zap,
  Group,
  ChevronUp,
  ChevronDown
} from 'lucide-react'
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
function SortableVariacaoItem({ 
  variacao, 
  grupo, 
  onEdit, 
  onDelete, 
  onToggleActive 
}: {
  variacao: VariacaoItem
  grupo: GrupoItem
  onEdit: (grupo: GrupoItem, variacao: VariacaoItem) => void
  onDelete: (variacao: VariacaoItem) => void
  onToggleActive: (variacao: VariacaoItem) => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: variacao.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group relative bg-white border rounded-lg p-4 transition-all duration-200 hover:shadow-md ${
        isDragging ? 'shadow-lg z-50' : ''
      } ${!variacao.ativo ? 'opacity-60' : ''}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 flex-1">
          <div
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing p-1 hover:bg-gray-100 rounded"
          >
            <GripVertical className="w-4 h-4 text-gray-400" />
          </div>
          
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="font-medium text-gray-900">{variacao.nome_variacao}</h4>
              {variacao.codigo_variacao && (
                <Badge variant="secondary" className="text-xs">
                  {variacao.codigo_variacao}
                </Badge>
              )}
              <Badge 
                variant={variacao.ativo ? "default" : "secondary"}
                className="text-xs"
              >
                {variacao.ativo ? 'Ativo' : 'Inativo'}
              </Badge>
            </div>
            
            {variacao.item_catalogo && (
              <div className="text-sm text-gray-600">
                <span className="font-medium">Item:</span> {variacao.item_catalogo.nome}
                {variacao.item_catalogo.codigo && (
                  <span className="ml-2 text-gray-500">({variacao.item_catalogo.codigo})</span>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onToggleActive(variacao)}
            className="h-8 w-8 p-0"
          >
            {variacao.ativo ? (
              <Eye className="w-4 h-4 text-green-600" />
            ) : (
              <EyeOff className="w-4 h-4 text-gray-400" />
            )}
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onEdit(grupo, variacao)}
            className="h-8 w-8 p-0"
          >
            <Edit className="w-4 h-4 text-blue-600" />
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDelete(variacao)}
            className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}

// Componente para grupo de itens
function GrupoItemCard({ 
  grupo, 
  onEdit, 
  onDelete, 
  onAddVariacao, 
  onEditVariacao, 
  onDeleteVariacao,
  onToggleVariacaoActive,
  onReorderVariacoes,
  isExpanded,
  onToggleExpansion
}: {
  grupo: GrupoItemCompleto
  onEdit: (grupo: GrupoItem) => void
  onDelete: (grupo: GrupoItem) => void
  onAddVariacao: (grupo: GrupoItem) => void
  onEditVariacao: (grupo: GrupoItem, variacao: VariacaoItem) => void
  onDeleteVariacao: (variacao: VariacaoItem) => void
  onToggleVariacaoActive: (variacao: VariacaoItem) => void
  onReorderVariacoes: (grupoId: string, variacoes: VariacaoItem[]) => void
  isExpanded: boolean
  onToggleExpansion: () => void
}) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      const oldIndex = grupo.variacoes.findIndex(item => item.id === active.id)
      const newIndex = grupo.variacoes.findIndex(item => item.id === over.id)
      
      const newVariacoes = arrayMove(grupo.variacoes, oldIndex, newIndex)
      onReorderVariacoes(grupo.id, newVariacoes)
    }
  }

  const categoriaColors = {
    epi: 'bg-blue-100 text-blue-800 border-blue-200',
    ferramental: 'bg-orange-100 text-orange-800 border-orange-200',
    consumivel: 'bg-green-100 text-green-800 border-green-200',
    equipamento: 'bg-purple-100 text-purple-800 border-purple-200'
  }

  return (
    <Card className="overflow-hidden shadow-sm border-2 hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
              <Package className="w-5 h-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-lg font-bold text-gray-900">
                {grupo.nome_grupo}
              </CardTitle>
              <div className="flex items-center gap-2 mt-1">
                <Badge 
                  variant="outline" 
                  className={`text-xs ${categoriaColors[grupo.categoria]}`}
                >
                  {grupo.categoria.toUpperCase()}
                </Badge>
                <Badge 
                  variant={grupo.ativo ? "default" : "secondary"}
                  className="text-xs"
                >
                  {grupo.ativo ? 'Ativo' : 'Inativo'}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {grupo.variacoes?.length || 0} variações
                </Badge>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggleExpansion}
              className="h-8 w-8 p-0"
              title={isExpanded ? "Fechar grupo" : "Expandir grupo"}
            >
              {isExpanded ? (
                <ChevronUp className="w-4 h-4 text-gray-600" />
              ) : (
                <ChevronDown className="w-4 h-4 text-gray-600" />
              )}
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => onAddVariacao(grupo)}
              className="h-8"
            >
              <Plus className="w-4 h-4 mr-1" />
              Variação
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onEdit(grupo)}
              className="h-8 w-8 p-0"
            >
              <Edit className="w-4 h-4 text-blue-600" />
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDelete(grupo)}
              className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
        
        {grupo.descricao && (
          <CardDescription className="mt-2 text-gray-600">
            {grupo.descricao}
          </CardDescription>
        )}
      </CardHeader>

      {isExpanded && (
        <CardContent className="pt-0">
          {grupo.variacoes && grupo.variacoes.length > 0 ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <Layers className="w-4 h-4" />
                  Variações ({grupo.variacoes.length})
                </h4>
              <div className="text-xs text-gray-500 flex items-center gap-1">
                <ArrowUpDown className="w-3 h-3" />
                Arraste para reordenar
              </div>
            </div>
            
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={grupo.variacoes.map(v => v.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-2">
                  {grupo.variacoes
                    .sort((a, b) => a.ordem - b.ordem)
                    .map((variacao) => (
                      <SortableVariacaoItem
                        key={variacao.id}
                        variacao={variacao}
                        grupo={grupo}
                        onEdit={onEditVariacao}
                        onDelete={onDeleteVariacao}
                        onToggleActive={onToggleVariacaoActive}
                      />
                    ))}
                </div>
              </SortableContext>
            </DndContext>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <Package className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p className="text-sm">Nenhuma variação cadastrada</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onAddVariacao(grupo)}
              className="mt-3"
            >
              <Plus className="w-4 h-4 mr-1" />
              Adicionar primeira variação
            </Button>
          </div>
        )}
        </CardContent>
      )}
      
      {!isExpanded && grupo.variacoes && grupo.variacoes.length > 0 && (
        <CardContent className="pt-0 pb-4">
          <div className="text-center py-2 text-gray-500 border-t">
            <p className="text-sm">
              {grupo.variacoes.length} variação{grupo.variacoes.length > 1 ? 'ões' : ''} oculta{grupo.variacoes.length > 1 ? 's' : ''}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Clique na seta para expandir
            </p>
          </div>
        </CardContent>
      )}
    </Card>
  )
}

export default function GruposItensPage() {
  return (
    <ProtectedRoute requiredPermissions={[
      PERMISSION_CODES.ALMOXARIFADO.GERENCIAR_ESTOQUE,
      PERMISSION_CODES.ALMOXARIFADO.VISUALIZAR_ESTOQUE
    ]}>
      <GruposItensContent />
    </ProtectedRoute>
  )
}

function GruposItensContent() {
  const { user, loading } = useAuth()
  const { notify } = useNotification()
  const queryClient = useQueryClient()
  
  const [searchTerm, setSearchTerm] = useState('')
  const [categoriaFilter, setCategoriaFilter] = useState<string>('todas')
  const [statusFilter, setStatusFilter] = useState<string>('todas')
  const [showAutoGrouping, setShowAutoGrouping] = useState(false)
  
  // Estados para controle de expansão dos grupos
  const [gruposExpandidos, setGruposExpandidos] = useState<Set<string>>(new Set())
  
  // Estados para modais
  const [grupoOpen, setGrupoOpen] = useState(false)
  const [variacaoOpen, setVariacaoOpen] = useState(false)
  const [editingGrupo, setEditingGrupo] = useState<GrupoItem | null>(null)
  const [editingVariacao, setEditingVariacao] = useState<VariacaoItem | null>(null)
  const [selectedGrupo, setSelectedGrupo] = useState<GrupoItem | null>(null)
  
  // Estados para formulários
  const [grupoForm, setGrupoForm] = useState<FormGrupoItem>({
    nome_grupo: '',
    descricao: '',
    categoria: 'epi',
    ativo: true
  })
  
  const [variacaoForm, setVariacaoForm] = useState<FormVariacaoItem>({
    grupo_id: '',
    item_catalogo_id: '',
    nome_variacao: '',
    codigo_variacao: '',
    ordem: 0,
    ativo: true
  })

  // React Query para grupos de itens
  const { data: grupos = [], isLoading: gruposLoading } = useQuery({
    queryKey: ['grupos-itens'],
    queryFn: async () => {
      const gruposData = await grupoItemService.getGruposItens()
      
      // Carregar detalhes completos dos grupos
      const gruposCompletos = await Promise.all(
        gruposData.map(async (grupo: GrupoItem) => {
          if (!grupo.id) {
            console.warn('Grupo sem ID válido:', grupo)
            return null
          }
          try {
            const detalhes = await grupoItemService.getGrupoItemById(grupo.id)
            return detalhes || grupo
          } catch (error) {
            console.error(`Erro ao carregar detalhes do grupo ${grupo.id}:`, error)
            return grupo
          }
        })
      )
      
      return gruposCompletos.filter(g => g !== null) as GrupoItemCompleto[]
    },
    staleTime: 5 * 60 * 1000, // 5 minutos
    gcTime: 10 * 60 * 1000, // 10 minutos
    enabled: !loading && !!user,
  })

  // React Query para itens do catálogo
  const { data: itensCatalogo = [] } = useQuery({
    queryKey: ['itens-catalogo-grupos'],
    queryFn: () => grupoItemService.getItensDisponiveisParaGrupo(),
    staleTime: 10 * 60 * 1000, // 10 minutos
    gcTime: 30 * 60 * 1000, // 30 minutos
    enabled: !loading && !!user,
  })

  const busy = gruposLoading

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

  // Mutation para criar grupo
  const createGrupoMutation = useMutation({
    mutationFn: async (grupoForm: FormGrupoItem) => {
      if (!user) throw new Error('Usuário não autenticado')
      return grupoItemService.criarGrupoItem({
        ...grupoForm,
        criado_por: user.id
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grupos-itens'] })
      setGrupoOpen(false)
      resetGrupoForm()
      notify('Grupo criado com sucesso!', 'success')
    },
    onError: (error) => {
      console.error('Erro ao criar grupo:', error)
      notify('Erro ao criar grupo', 'error')
    }
  })

  const handleCreateGrupo = async () => {
    createGrupoMutation.mutate(grupoForm)
  }

  // Mutation para atualizar grupo
  const updateGrupoMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string, data: FormGrupoItem }) => {
      return grupoItemService.atualizarGrupoItem(id, data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grupos-itens'] })
      setGrupoOpen(false)
      setEditingGrupo(null)
      resetGrupoForm()
      notify('Grupo atualizado com sucesso!', 'success')
    },
    onError: (error) => {
      console.error('Erro ao atualizar grupo:', error)
      notify('Erro ao atualizar grupo', 'error')
    }
  })

  const handleUpdateGrupo = async () => {
    if (!editingGrupo) return
    updateGrupoMutation.mutate({ id: editingGrupo.id, data: grupoForm })
  }

  // Mutation para excluir grupo
  const deleteGrupoMutation = useMutation({
    mutationFn: async (grupoId: string) => {
      return grupoItemService.excluirGrupoItem(grupoId)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grupos-itens'] })
      notify('Grupo excluído com sucesso!', 'success')
    },
    onError: (error) => {
      console.error('Erro ao excluir grupo:', error)
      notify('Erro ao excluir grupo', 'error')
    }
  })

  const handleDeleteGrupo = async (grupo: GrupoItem) => {
    if (!confirm(`Tem certeza que deseja excluir o grupo "${grupo.nome_grupo}"?`)) {
      return
    }
    deleteGrupoMutation.mutate(grupo.id)
  }

  const handleCreateVariacao = async () => {
    if (!selectedGrupo) return
    
    try {
      
      // Calcular próxima ordem
      const proximaOrdem = Math.max(
        ...(selectedGrupo.variacoes?.map(v => v.ordem) || [0]),
        0
      ) + 1
      
      await grupoItemService.adicionarVariacaoItem({
        ...variacaoForm,
        grupo_id: selectedGrupo.id,
        ordem: proximaOrdem
      })
      
      // Recarregar grupo com nova variação
      if (selectedGrupo.id) {
        try {
          const grupoAtualizado = await grupoItemService.getGrupoItemById(selectedGrupo.id)
          if (grupoAtualizado) {
            queryClient.invalidateQueries({ queryKey: ['grupos-itens'] })
          }
        } catch (error) {
          console.error('Erro ao recarregar grupo após criar variação:', error)
        }
      }
      
      setVariacaoOpen(false)
      setSelectedGrupo(null)
      resetVariacaoForm()
      notify('Variação criada com sucesso!', 'success')
    } catch (error) {
      console.error('Erro ao criar variação:', error)
      notify('Erro ao criar variação', 'error')
    } finally {
    }
  }

  const handleUpdateVariacao = async () => {
    if (!editingVariacao) return
    
    try {
      await grupoItemService.atualizarVariacaoItem(
        editingVariacao.id,
        variacaoForm
      )
      
      // Recarregar grupo atualizado
      if (editingVariacao.grupo_id) {
        try {
          const grupoAtualizado = await grupoItemService.getGrupoItemById(editingVariacao.grupo_id)
          if (grupoAtualizado) {
            queryClient.invalidateQueries({ queryKey: ['grupos-itens'] })
          }
        } catch (error) {
          console.error('Erro ao recarregar grupo após atualizar variação:', error)
        }
      }
      
      setVariacaoOpen(false)
      setEditingVariacao(null)
      setSelectedGrupo(null)
      resetVariacaoForm()
      notify('Variação atualizada com sucesso!', 'success')
    } catch (error) {
      console.error('Erro ao atualizar variação:', error)
      notify('Erro ao atualizar variação', 'error')
    } finally {
    }
  }

  const handleDeleteVariacao = async (variacao: VariacaoItem) => {
    if (!confirm(`Tem certeza que deseja excluir a variação "${variacao.nome_variacao}"?`)) {
      return
    }
    
    try {
      await grupoItemService.excluirVariacaoItem(variacao.id)
      
      // Recarregar grupo atualizado
      if (variacao.grupo_id) {
        try {
          const grupoAtualizado = await grupoItemService.getGrupoItemById(variacao.grupo_id)
          if (grupoAtualizado) {
            queryClient.invalidateQueries({ queryKey: ['grupos-itens'] })
          }
        } catch (error) {
          console.error('Erro ao recarregar grupo após excluir variação:', error)
        }
      }
      
      notify('Variação excluída com sucesso!', 'success')
    } catch (error) {
      console.error('Erro ao excluir variação:', error)
      notify('Erro ao excluir variação', 'error')
    } finally {
    }
  }

  const handleToggleVariacaoActive = async (variacao: VariacaoItem) => {
    try {
      await grupoItemService.atualizarVariacaoItem(variacao.id, {
        ativo: !variacao.ativo
      })
      
      // Recarregar grupo atualizado
      if (variacao.grupo_id) {
        try {
          const grupoAtualizado = await grupoItemService.getGrupoItemById(variacao.grupo_id)
          if (grupoAtualizado) {
            queryClient.invalidateQueries({ queryKey: ['grupos-itens'] })
          }
        } catch (error) {
          console.error('Erro ao recarregar grupo após alterar status da variação:', error)
        }
      }
      
      notify(
        `Variação ${!variacao.ativo ? 'ativada' : 'desativada'} com sucesso!`, 
        'success'
      )
    } catch (error) {
      console.error('Erro ao alterar status da variação:', error)
      notify('Erro ao alterar status da variação', 'error')
    } finally {
    }
  }

  const handleReorderVariacoes = async (grupoId: string, variacoes: VariacaoItem[]) => {
    try {
      // Atualizar ordem das variações
      await Promise.all(
        variacoes.map((variacao, index) =>
          grupoItemService.atualizarVariacaoItem(variacao.id, {
            ordem: index + 1
          })
        )
      )
      
      // Atualizar estado local
      queryClient.invalidateQueries({ queryKey: ['grupos-itens'] })
      
      notify('Ordem das variações atualizada!', 'success')
    } catch (error) {
      console.error('Erro ao reordenar variações:', error)
      notify('Erro ao reordenar variações', 'error')
    }
  }

  const resetGrupoForm = () => {
    setGrupoForm({
      nome_grupo: '',
      descricao: '',
      categoria: 'epi',
      ativo: true
    })
  }

  const resetVariacaoForm = () => {
    setVariacaoForm({
      grupo_id: '',
      item_catalogo_id: '',
      nome_variacao: '',
      codigo_variacao: '',
      ordem: 0,
      ativo: true
    })
  }

  const openGrupoModal = (grupo?: GrupoItem) => {
    if (grupo) {
      setEditingGrupo(grupo)
      setGrupoForm({
        nome_grupo: grupo.nome_grupo,
        descricao: grupo.descricao || '',
        categoria: grupo.categoria,
        ativo: grupo.ativo
      })
    } else {
      resetGrupoForm()
    }
    setGrupoOpen(true)
  }

  const openVariacaoModal = (grupo: GrupoItem, variacao?: VariacaoItem) => {
    setSelectedGrupo(grupo)
    if (variacao) {
      setEditingVariacao(variacao)
      setVariacaoForm({
        grupo_id: variacao.grupo_id,
        item_catalogo_id: variacao.item_catalogo_id,
        nome_variacao: variacao.nome_variacao,
        codigo_variacao: variacao.codigo_variacao || '',
        ordem: variacao.ordem,
        ativo: variacao.ativo
      })
    } else {
      setVariacaoForm({
        grupo_id: grupo.id,
        item_catalogo_id: '',
        nome_variacao: '',
        codigo_variacao: '',
        ordem: 0,
        ativo: true
      })
    }
    setVariacaoOpen(true)
  }

  const autoGroupingSuggestions = useMemo(() => {
    if (!showAutoGrouping) return []
    
    const suggestions: Array<{
      baseName: string
      items: ItemEstoque[]
      variations: string[]
      confidence: number
    }> = []
    
    
    // Função melhorada para detectar padrões similares
    const detectarPadroesSimilares = (itens: typeof itensCatalogo) => {
      const grupos: Map<string, ItemEstoque[]> = new Map()
      
      for (let i = 0; i < itens.length; i++) {
        for (let j = i + 1; j < itens.length; j++) {
          const item1 = itens[i]
          const item2 = itens[j]
          
          const resultado = compararNomes(item1.nome, item2.nome)
          
          if (resultado.similar) {
            const chaveGrupo = resultado.nomeBase
            
            if (!grupos.has(chaveGrupo)) {
              grupos.set(chaveGrupo, [])
            }
            
            const grupo = grupos.get(chaveGrupo)!
            
            // Adicionar item1 se não estiver no grupo
            if (!grupo.find(item => item.id === item1.id)) {
              grupo.push(item1)
            }
            
            // Adicionar item2 se não estiver no grupo
            if (!grupo.find(item => item.id === item2.id)) {
              grupo.push(item2)
            }
          }
        }
      }
      
      return grupos
    }
    
    // Função para comparar nomes e detectar variações
    const compararNomes = (nome1: string, nome2: string) => {
      const n1 = nome1.trim().toUpperCase()
      const n2 = nome2.trim().toUpperCase()
      
      if (n1 === n2) {
        return { similar: false, nomeBase: '', variacao1: '', variacao2: '' }
      }
      
      const palavras1 = n1.split(/\s+/)
      const palavras2 = n2.split(/\s+/)
      
      // Se número de palavras muito diferente, provavelmente não são similares
      if (Math.abs(palavras1.length - palavras2.length) > 1) {
        return { similar: false, nomeBase: '', variacao1: '', variacao2: '' }
      }
      
      // Encontrar diferenças
      const diferencas: Array<{ pos: number; palavra1: string; palavra2: string }> = []
      
      const maxPalavras = Math.max(palavras1.length, palavras2.length)
      
      for (let i = 0; i < maxPalavras; i++) {
        const p1 = palavras1[i] || ''
        const p2 = palavras2[i] || ''
        
        if (p1 !== p2) {
          diferencas.push({ pos: i, palavra1: p1, palavra2: p2 })
        }
      }
      
      // Se há mais de 1 diferença, provavelmente não são similares
      if (diferencas.length > 1) {
        return { similar: false, nomeBase: '', variacao1: '', variacao2: '' }
      }
      
      // Se há exatamente 1 diferença, verificar se é uma variação válida
      if (diferencas.length === 1) {
        const diff = diferencas[0]
        
        if (ehVariacaoValida(diff.palavra1, diff.palavra2)) {
          // Construir nome base removendo a palavra diferente
          const nomeBase = palavras1.map((palavra, index) => 
            index === diff.pos ? '[VARIACAO]' : palavra
          ).join(' ')
          
          return {
            similar: true,
            nomeBase: nomeBase.replace('[VARIACAO]', '').trim(),
            variacao1: diff.palavra1,
            variacao2: diff.palavra2
          }
        }
      }
      
      return { similar: false, nomeBase: '', variacao1: '', variacao2: '' }
    }
    
    // Função para verificar se é uma variação válida
    const ehVariacaoValida = (palavra1: string, palavra2: string): boolean => {
      // 1. Números com MM (13MM, 17MM, 19MM, etc.)
      if (/^\d+MM?$/.test(palavra1) && /^\d+MM?$/.test(palavra2)) {
        return true
      }
      
      // 2. Tamanhos (P, M, G, GG, etc.)
      const tamanhos = ['P', 'M', 'G', 'GG', 'XG', 'XXG', 'EXG', 'EXXG', 'XXXG', 'PP']
      if (tamanhos.includes(palavra1) && tamanhos.includes(palavra2)) {
        return true
      }
      
      // 3. Números simples (2, 3, 4, etc.)
      if (/^\d+$/.test(palavra1) && /^\d+$/.test(palavra2)) {
        const num1 = parseInt(palavra1)
        const num2 = parseInt(palavra2)
        // Considerar variação se a diferença for pequena (tamanhos de calçado, etc.)
        if (Math.abs(num1 - num2) <= 10) {
          return true
        }
      }
      
      // 4. Padrões específicos (BT, MT, etc.)
      const padroesEspecificos = ['BT', 'MT', 'LV', 'ISOLADA', 'RETARDANTE', 'GORNES']
      if (padroesEspecificos.includes(palavra1) && padroesEspecificos.includes(palavra2)) {
        return true
      }
      
      // 5. Padrões de cores
      const cores = ['AZUL', 'VERMELHO', 'VERDE', 'AMARELO', 'PRETO', 'BRANCO', 'CINZA', 'LARANJA']
      if (cores.includes(palavra1) && cores.includes(palavra2)) {
        return true
      }
      
      // 6. Padrões de material/tipo
      const materiais = ['CANO', 'CURTO', 'LONGO', 'ANTICHAMAS', 'RESISTENTE', 'ELETRICISTA']
      if (materiais.includes(palavra1) && materiais.includes(palavra2)) {
        return true
      }
      
      return false
    }
    
    // Usar o algoritmo melhorado
    const gruposDetectados = detectarPadroesSimilares(itensCatalogo)
    
    // Converter para formato de sugestões
    gruposDetectados.forEach((items, nomeBase) => {
      if (items.length >= 2) {
        // Verificar se já existe um grupo com este nome base
        const grupoExistente = grupos.find(grupo => 
          grupo.nome_grupo.toLowerCase() === nomeBase.toLowerCase()
        )
        
        if (!grupoExistente) {
          // Calcular variações para cada item
          const variations = items.map(item => {
            const palavras = item.nome.toUpperCase().split(/\s+/)
            const palavrasBase = nomeBase.toUpperCase().split(/\s+/)
            
            // Encontrar a diferença
            for (let i = 0; i < Math.max(palavras.length, palavrasBase.length); i++) {
              const palavraItem = palavras[i] || ''
              const palavraBase = palavrasBase[i] || ''
              
              if (palavraItem !== palavraBase) {
                return palavraItem
              }
            }
            
            return 'Padrão'
          })
          
          // Calcular confiança baseada no número de itens e consistência
          let confianca = 0.5
          confianca += Math.min(items.length * 0.1, 0.3)
          
          const variacoesUnicas = new Set(variations).size
          if (variacoesUnicas === items.length) {
            confianca += 0.2
          }
          
          suggestions.push({
            baseName: nomeBase,
            items: items.sort((a, b) => a.nome.localeCompare(b.nome)),
            variations,
            confidence: Math.min(confianca, 1.0)
          })
        }
      }
    })
    
    return suggestions
      .filter(s => s.confidence >= 0.6) // Filtrar por confiança mínima
      .sort((a, b) => b.confidence - a.confidence) // Ordenar por confiança
  }, [itensCatalogo, showAutoGrouping, grupos])


  const handleAutoGrouping = async (suggestion: typeof autoGroupingSuggestions[0]) => {
    try {
      
      // Criar grupo
      const novoGrupo = await grupoItemService.criarGrupoItem({
        nome_grupo: suggestion.baseName,
        descricao: `Grupo criado automaticamente com ${suggestion.items.length} variações`,
        categoria: suggestion.items[0].categoria || 'epi',
        ativo: true,
        criado_por: user!.id
      })
      
      // Criar variações
      await Promise.all(
        suggestion.items.map(async (item, index) => {
          const variation = suggestion.variations[index] || `Variação ${index + 1}`
          await grupoItemService.adicionarVariacaoItem({
            grupo_id: novoGrupo.id,
            item_catalogo_id: item.id,
            nome_variacao: variation,
            codigo_variacao: item.codigo || '',
            ordem: index + 1,
            ativo: true
          })
        })
      )
      
      // Recarregar dados
      queryClient.invalidateQueries({ queryKey: ['grupos-itens'] })
      
      notify(`Grupo "${suggestion.baseName}" criado automaticamente!`, 'success')
    } catch (error) {
      console.error('Erro ao criar agrupamento automático:', error)
      notify('Erro ao criar agrupamento automático', 'error')
    } finally {
    }
  }


  // Filtros
  const filteredGrupos = useMemo(() => {
    return grupos.filter(grupo => {
      const matchesSearch = !searchTerm || 
        grupo.nome_grupo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        grupo.descricao?.toLowerCase().includes(searchTerm.toLowerCase())
      
      const matchesCategoria = categoriaFilter === 'todas' || grupo.categoria === categoriaFilter
      const matchesStatus = statusFilter === 'todas' || 
        (statusFilter === 'ativo' && grupo.ativo) ||
        (statusFilter === 'inativo' && !grupo.ativo)
      
      return matchesSearch && matchesCategoria && matchesStatus
    })
  }, [grupos, searchTerm, categoriaFilter, statusFilter])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Grupos de Itens</h1>
          <p className="text-gray-600 mt-1">
            Gerencie grupos de itens e suas variações com sistema de agrupamento automático
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={() => setShowAutoGrouping(!showAutoGrouping)}
            className="flex items-center gap-2"
          >
            <Zap className="w-4 h-4" />
            Sugestões Automáticas
          </Button>
          
          <Button
            variant="outline"
            onClick={expandirTodosGrupos}
            className="flex items-center gap-2"
            disabled={grupos.length === 0}
          >
            <ChevronDown className="w-4 h-4" />
            Expandir Todos
          </Button>
          
          <Button
            variant="outline"
            onClick={fecharTodosGrupos}
            className="flex items-center gap-2"
            disabled={grupos.length === 0}
          >
            <ChevronUp className="w-4 h-4" />
            Fechar Todos
          </Button>
          
          <Button
            onClick={() => openGrupoModal()}
            className="flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Novo Grupo
          </Button>
        </div>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Buscar grupos..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <Select value={categoriaFilter} onValueChange={setCategoriaFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas as categorias</SelectItem>
                <SelectItem value="epi">EPI</SelectItem>
                <SelectItem value="ferramental">Ferramental</SelectItem>
                <SelectItem value="consumivel">Consumível</SelectItem>
                <SelectItem value="equipamento">Equipamento</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todos</SelectItem>
                <SelectItem value="ativo">Ativo</SelectItem>
                <SelectItem value="inativo">Inativo</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Agrupamento Automático */}
      {showAutoGrouping && (
        <div className="space-y-4">
          {/* Sugestões Automáticas */}
          <Card className="border-blue-200 bg-blue-50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-blue-800">
                <Zap className="w-5 h-5" />
                Sugestões de Agrupamento Automático
              </CardTitle>
              <CardDescription className="text-blue-700">
                Itens com nomenclatura similar que podem ser agrupados automaticamente
              </CardDescription>
              <div className="text-xs text-blue-600 mt-2">
                📊 Analisando {itensCatalogo.length} itens do catálogo...
              </div>
            </CardHeader>
            <CardContent>
              {autoGroupingSuggestions.length > 0 ? (
                <div className="space-y-3">
                  <div className="text-sm text-blue-700 mb-3">
                    ✅ Encontradas {autoGroupingSuggestions.length} sugestões de agrupamento
                  </div>
                  <div className="max-h-96 overflow-y-auto space-y-3 pr-2">
                    {autoGroupingSuggestions.map((suggestion, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-white rounded-lg border hover:shadow-sm transition-shadow">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-medium text-gray-900">{suggestion.baseName}</h4>
                            <Badge 
                              variant={suggestion.confidence >= 0.8 ? 'default' : suggestion.confidence >= 0.7 ? 'secondary' : 'outline'}
                              className="text-xs"
                            >
                              {Math.round(suggestion.confidence * 100)}% confiança
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-600">
                            {suggestion.items.length} variações: {suggestion.variations.join(', ')}
                          </p>
                          <div className="text-xs text-gray-500 mt-1">
                            Itens: {suggestion.items.map(item => item.nome).join(', ')}
                          </div>
                        </div>
                        <Button
                          onClick={() => handleAutoGrouping(suggestion)}
                          size="sm"
                          className="ml-3"
                        >
                          <Group className="w-4 h-4 mr-1" />
                          Agrupar
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Zap className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    Nenhuma sugestão encontrada
                  </h3>
                  <p className="text-gray-600">
                    Todos os itens similares já foram agrupados ou não há padrões suficientes
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

        </div>
      )}

      {/* Lista de Grupos */}
      <div className="space-y-4">
        {filteredGrupos.length > 0 ? (
          filteredGrupos.map((grupo) => (
            <GrupoItemCard
              key={grupo.id}
              grupo={grupo}
              onEdit={openGrupoModal}
              onDelete={handleDeleteGrupo}
              onAddVariacao={openVariacaoModal}
              onEditVariacao={openVariacaoModal}
              onDeleteVariacao={handleDeleteVariacao}
              onToggleVariacaoActive={handleToggleVariacaoActive}
              onReorderVariacoes={handleReorderVariacoes}
              isExpanded={gruposExpandidos.has(grupo.id)}
              onToggleExpansion={() => toggleGrupoExpansao(grupo.id)}
            />
          ))
        ) : (
          <Card className="text-center py-12">
            <Package className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Nenhum grupo encontrado
            </h3>
            <p className="text-gray-600 mb-4">
              {searchTerm || categoriaFilter !== 'todas' || statusFilter !== 'todas'
                ? 'Tente ajustar os filtros de busca'
                : 'Comece criando seu primeiro grupo de itens'
              }
            </p>
            {!searchTerm && categoriaFilter === 'todas' && statusFilter === 'todas' && (
              <Button onClick={() => openGrupoModal()}>
                <Plus className="w-4 h-4 mr-2" />
                Criar Primeiro Grupo
              </Button>
            )}
          </Card>
        )}
      </div>

      {/* Modal de Grupo */}
      <Dialog open={grupoOpen} onOpenChange={setGrupoOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingGrupo ? 'Editar Grupo' : 'Novo Grupo'}
            </DialogTitle>
            <DialogDescription>
              {editingGrupo 
                ? 'Atualize as informações do grupo de itens'
                : 'Crie um novo grupo para organizar variações de itens'
              }
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="nome_grupo">Nome do Grupo *</Label>
              <Input
                id="nome_grupo"
                value={grupoForm.nome_grupo}
                onChange={(e) => setGrupoForm(prev => ({ ...prev, nome_grupo: e.target.value }))}
                placeholder="Ex: Botina de Segurança"
              />
            </div>
            
            <div>
              <Label htmlFor="descricao">Descrição</Label>
              <Textarea
                id="descricao"
                value={grupoForm.descricao}
                onChange={(e) => setGrupoForm(prev => ({ ...prev, descricao: e.target.value }))}
                placeholder="Descrição opcional do grupo"
                rows={3}
              />
            </div>
            
            <div>
              <Label htmlFor="categoria">Categoria *</Label>
              <Select
                value={grupoForm.categoria}
                onValueChange={(value: "epi" | "ferramental" | "consumivel" | "equipamento") => setGrupoForm(prev => ({ ...prev, categoria: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="epi">EPI</SelectItem>
                  <SelectItem value="ferramental">Ferramental</SelectItem>
                  <SelectItem value="consumivel">Consumível</SelectItem>
                  <SelectItem value="equipamento">Equipamento</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex items-center space-x-2">
              <Switch
                id="ativo"
                checked={grupoForm.ativo}
                onCheckedChange={(checked) => setGrupoForm(prev => ({ ...prev, ativo: checked }))}
              />
              <Label htmlFor="ativo">Grupo ativo</Label>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setGrupoOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={editingGrupo ? handleUpdateGrupo : handleCreateGrupo}
              disabled={!grupoForm.nome_grupo || busy}
            >
              {busy ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                editingGrupo ? 'Atualizar' : 'Criar'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Variação */}
      <Dialog open={variacaoOpen} onOpenChange={setVariacaoOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingVariacao ? 'Editar Variação' : 'Nova Variação'}
            </DialogTitle>
            <DialogDescription>
              {editingVariacao 
                ? 'Atualize as informações da variação'
                : `Adicione uma nova variação ao grupo "${selectedGrupo?.nome_grupo}"`
              }
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="item_catalogo_id">Item de Catálogo *</Label>
              <SearchableSelect
                value={variacaoForm.item_catalogo_id}
                onValueChange={(value) => setVariacaoForm(prev => ({ ...prev, item_catalogo_id: value }))}
                items={itensCatalogo.map(item => ({
                  id: item.id,
                  nome: `${item.nome} ${item.codigo ? `(${item.codigo})` : ''}`,
                }))}
                placeholder="Selecione um item de estoque"
              />
            </div>
            
            <div>
              <Label htmlFor="nome_variacao">Nome da Variação *</Label>
              <Input
                id="nome_variacao"
                value={variacaoForm.nome_variacao}
                onChange={(e) => setVariacaoForm(prev => ({ ...prev, nome_variacao: e.target.value }))}
                placeholder="Ex: Tamanho 38, Cor Azul"
              />
            </div>
            
            <div>
              <Label htmlFor="codigo_variacao">Código da Variação</Label>
              <Input
                id="codigo_variacao"
                value={variacaoForm.codigo_variacao}
                onChange={(e) => setVariacaoForm(prev => ({ ...prev, codigo_variacao: e.target.value }))}
                placeholder="Código opcional"
              />
            </div>
            
            <div className="flex items-center space-x-2">
              <Switch
                id="ativo_variacao"
                checked={variacaoForm.ativo}
                onCheckedChange={(checked) => setVariacaoForm(prev => ({ ...prev, ativo: checked }))}
              />
              <Label htmlFor="ativo_variacao">Variação ativa</Label>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setVariacaoOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={editingVariacao ? handleUpdateVariacao : handleCreateVariacao}
              disabled={!variacaoForm.item_catalogo_id || !variacaoForm.nome_variacao || busy}
            >
              {busy ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                editingVariacao ? 'Atualizar' : 'Criar'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
