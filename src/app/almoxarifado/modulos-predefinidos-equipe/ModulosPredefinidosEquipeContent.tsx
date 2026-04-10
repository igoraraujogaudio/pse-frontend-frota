'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useNotification } from '@/contexts/NotificationContext'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { moduloPredefinidoEquipeService, ModuloPredefinidoEquipeService } from '@/services/moduloPredefinidoEquipeService'
// import { baseService } from '@/services/baseService' // Unused for now
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
// import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select' // Unused for now
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Plus, Edit, Trash2, Package, Briefcase, ChevronDown, ChevronRight } from 'lucide-react'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { ModuloPredefinidoEquipe, ItemModuloEquipe } from '@/services/moduloPredefinidoEquipeService'

// Tipos para formulários
interface FormModuloPredefinidoEquipe {
  operacao_id: string
  nome_modulo: string
  descricao: string
  ativo: boolean
}

interface FormItemModuloEquipe {
  modulo_id: string
  item_estoque_id?: string | null
  item_catalogo_id?: string | null
  grupo_item_id?: string | null
  variacao_item_id?: string | null
  quantidade_padrao: number
  obrigatorio: boolean
  ordem: number
  observacoes?: string
}

export default function ModulosPredefinidosEquipeContent() {
  const { user, loading } = useAuth()
  const { notify } = useNotification()
  
  const queryClient = useQueryClient()
  const [contratos, setContratos] = useState<Array<{ id: string; nome: string; codigo: string }>>([])
  const [busy, setBusy] = useState(false)
  const [expandedModulos, setExpandedModulos] = useState<Set<string>>(new Set())
  
  // Estados para modais
  const [moduloOpen, setModuloOpen] = useState(false)
  const [itemOpen, setItemOpen] = useState(false)
  const [editingModulo, setEditingModulo] = useState<ModuloPredefinidoEquipe | null>(null)
  const [editingItem, setEditingItem] = useState<ItemModuloEquipe | null>(null)
  const [selectedModulo, setSelectedModulo] = useState<ModuloPredefinidoEquipe | null>(null)
  const [itensDoModulo, setItensDoModulo] = useState<ItemModuloEquipe[]>([])
  const [tipoItem, setTipoItem] = useState<'individual' | 'grupo'>('individual')
  
  // Estados para formulários
  const [moduloForm, setModuloForm] = useState<FormModuloPredefinidoEquipe>({
    operacao_id: '',
    nome_modulo: '',
    descricao: '',
    ativo: true
  })
  
  const [itemForm, setItemForm] = useState<FormItemModuloEquipe>({
    modulo_id: '',
    item_estoque_id: null,
    item_catalogo_id: null,
    grupo_item_id: null,
    variacao_item_id: null,
    quantidade_padrao: 1,
    obrigatorio: true,
    ordem: 0,
    observacoes: ''
  })

  // React Query para módulos predefinidos por operação
  const { data: modulosData = [] } = useQuery({
    queryKey: ['modulos-predefinidos-equipe'],
    queryFn: () => moduloPredefinidoEquipeService.getModulosPredefinidosEquipe({}),
    staleTime: 10 * 60 * 1000, // 10 minutos
    gcTime: 30 * 60 * 1000,
  })

  // React Query para itens do catálogo
  const { data: itensCatalogo = [] } = useQuery({
    queryKey: ['itens-catalogo-modulos-equipe'],
    queryFn: () => moduloPredefinidoEquipeService.getItensDisponiveisParaModuloEquipe(),
    staleTime: 5 * 60 * 1000, // 5 minutos
    gcTime: 15 * 60 * 1000,
  })

  // React Query para grupos de itens
  const { data: gruposItens = [] } = useQuery({
    queryKey: ['grupos-itens-modulos-equipe'],
    queryFn: () => moduloPredefinidoEquipeService.getGruposItens(),
    staleTime: 10 * 60 * 1000, // 10 minutos
    gcTime: 30 * 60 * 1000,
  })

  const loadInitialData = useCallback(async () => {
    setBusy(true)
    try {
      // Buscar contratos separadamente
      const { data: contratosData } = await supabase.from('contratos').select('id, nome, codigo').eq('status', 'ativo').order('nome')
      
      setContratos(contratosData || [])
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

  const handleCreateModulo = async () => {
    if (!user) return
    
    try {
      setBusy(true)
      await ModuloPredefinidoEquipeService.criarModuloEquipe({
        ...moduloForm,
        criado_por: user.id
      })
      queryClient.invalidateQueries({ queryKey: ['modulos-predefinidos-equipe'] })
      setModuloOpen(false)
      resetModuloForm()
      notify('Módulo criado com sucesso!', 'success')
    } catch (error) {
      console.error('Erro ao criar módulo:', error)
      notify('Erro ao criar módulo', 'error')
    } finally {
      setBusy(false)
    }
  }

  const handleUpdateModulo = async () => {
    if (!editingModulo) return
    
    try {
      setBusy(true)
      await moduloPredefinidoEquipeService.atualizarModuloEquipe(
        editingModulo.id,
        moduloForm
      )
      queryClient.invalidateQueries({ queryKey: ['modulos-predefinidos-equipe'] })
      setModuloOpen(false)
      setEditingModulo(null)
      resetModuloForm()
      notify('Módulo atualizado com sucesso!', 'success')
    } catch (error) {
      console.error('Erro ao atualizar módulo:', error)
      notify('Erro ao atualizar módulo', 'error')
    } finally {
      setBusy(false)
    }
  }

  const handleDeleteModulo = async (modulo: ModuloPredefinidoEquipe) => {
    if (!confirm(`Tem certeza que deseja excluir o módulo "${modulo.nome_modulo}"?`)) return
    
    try {
      setBusy(true)
      await moduloPredefinidoEquipeService.desativarModuloEquipe(modulo.id)
      queryClient.invalidateQueries({ queryKey: ['modulos-predefinidos-equipe'] })
      notify('Módulo excluído com sucesso!', 'success')
    } catch (error) {
      console.error('Erro ao excluir módulo:', error)
      notify('Erro ao excluir módulo', 'error')
    } finally {
      setBusy(false)
    }
  }

  const handleCreateItem = async () => {
    if (!selectedModulo) return
    
    try {
      setBusy(true)
      await moduloPredefinidoEquipeService.adicionarItemModuloEquipe({
        modulo_id: selectedModulo.id,
        item_estoque_id: itemForm.item_estoque_id || undefined,
        item_catalogo_id: itemForm.item_catalogo_id || undefined,
        grupo_item_id: itemForm.grupo_item_id || undefined,
        variacao_item_id: itemForm.variacao_item_id || undefined,
        quantidade_padrao: itemForm.quantidade_padrao,
        obrigatorio: itemForm.obrigatorio,
        ordem: itemForm.ordem,
        observacoes: itemForm.observacoes
      })
      
      queryClient.invalidateQueries({ queryKey: ['modulos-predefinidos-equipe'] })
      setItemOpen(false)
      resetItemForm()
      notify('Item adicionado com sucesso!', 'success')
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
      await moduloPredefinidoEquipeService.atualizarItemModuloEquipe(
        editingItem.id,
        {
          item_estoque_id: itemForm.item_estoque_id || undefined,
          item_catalogo_id: itemForm.item_catalogo_id || undefined,
          grupo_item_id: itemForm.grupo_item_id || undefined,
          variacao_item_id: itemForm.variacao_item_id || undefined,
          quantidade_padrao: itemForm.quantidade_padrao,
          obrigatorio: itemForm.obrigatorio,
          ordem: itemForm.ordem,
          observacoes: itemForm.observacoes
        }
      )
      
      queryClient.invalidateQueries({ queryKey: ['modulos-predefinidos-equipe'] })
      setItemOpen(false)
      setEditingItem(null)
      resetItemForm()
      notify('Item atualizado com sucesso!', 'success')
    } catch (error) {
      console.error('Erro ao atualizar item:', error)
      notify('Erro ao atualizar item', 'error')
    } finally {
      setBusy(false)
    }
  }

  const handleDeleteItem = async (itemId: string) => {
    if (!confirm('Tem certeza que deseja remover este item do módulo?')) return
    
    try {
      setBusy(true)
      await moduloPredefinidoEquipeService.removerItemModuloEquipe(itemId)
      queryClient.invalidateQueries({ queryKey: ['modulos-predefinidos-equipe'] })
      notify('Item removido com sucesso!', 'success')
    } catch (error) {
      console.error('Erro ao remover item:', error)
      notify('Erro ao remover item', 'error')
    } finally {
      setBusy(false)
    }
  }

  const loadItensModulo = async (moduloId: string) => {
    try {
      const itens = await moduloPredefinidoEquipeService.getItensModuloEquipe(moduloId)
      setItensDoModulo(itens)
    } catch (error) {
      console.error('Erro ao carregar itens do módulo:', error)
      notify('Erro ao carregar itens do módulo', 'error')
    }
  }

  const resetModuloForm = () => {
    setModuloForm({
      operacao_id: '',
      nome_modulo: '',
      descricao: '',
      ativo: true
    })
  }

  const resetItemForm = () => {
    setItemForm({
      modulo_id: '',
      item_estoque_id: null,
      item_catalogo_id: null,
      grupo_item_id: null,
      variacao_item_id: null,
      quantidade_padrao: 1,
      obrigatorio: true,
      ordem: 0,
      observacoes: ''
    })
    setTipoItem('individual')
  }

  const openModuloModal = (modulo?: ModuloPredefinidoEquipe) => {
    if (modulo) {
      setEditingModulo(modulo)
      setModuloForm({
        operacao_id: modulo.operacao_id || '',
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

  const openItemModal = async (modulo: ModuloPredefinidoEquipe, item?: ItemModuloEquipe) => {
    setSelectedModulo(modulo)
    
    if (item) {
      setEditingItem(item)
      setItemForm({
        modulo_id: item.modulo_id,
        item_estoque_id: item.item_estoque_id || null,
        item_catalogo_id: item.item_catalogo_id || null,
        grupo_item_id: item.grupo_item_id || null,
        variacao_item_id: item.variacao_item_id || null,
        quantidade_padrao: item.quantidade_padrao,
        obrigatorio: item.obrigatorio,
        ordem: item.ordem,
        observacoes: item.observacoes || ''
      })
      setTipoItem(item.grupo_item_id && !item.item_estoque_id ? 'grupo' : 'individual')
    } else {
      setEditingItem(null)
      resetItemForm()
    }
    
    await loadItensModulo(modulo.id)
    setItemOpen(true)
  }

  const toggleModuloExpansion = (moduloId: string) => {
    setExpandedModulos(prev => {
      const newSet = new Set(prev)
      if (newSet.has(moduloId)) {
        newSet.delete(moduloId)
      } else {
        newSet.add(moduloId)
      }
      return newSet
    })
  }

  if (loading) return <div className="p-6">Carregando...</div>

  return (
    <div className="min-h-screen">
      <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Módulos Pré-definidos por Contrato</h1>
            <p className="text-sm text-muted-foreground">
              Configure kits de itens padrão para diferentes contratos
            </p>
          </div>
          <Button onClick={() => openModuloModal()}>
            <Plus className="w-4 h-4 mr-2" />
            Novo Módulo
          </Button>
        </div>

        {modulosData.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              <Package className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <p>Nenhum módulo pré-definido encontrado.</p>
              <p>Crie seu primeiro módulo para começar.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6">
            {modulosData.map((modulo: ModuloPredefinidoEquipe) => (
              <Card key={modulo.id} className="overflow-hidden">
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                        <Briefcase className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">{modulo.nome_modulo}</CardTitle>
                        <CardDescription>
                          {modulo.operacao_nome || 'Sem operação'} • {modulo.total_itens || 0} itens
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
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-medium text-gray-700">
                          Itens do Módulo ({modulo.itens.length})
                        </h4>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => toggleModuloExpansion(modulo.id)}
                          className="text-gray-500 hover:text-gray-700"
                        >
                          {expandedModulos.has(modulo.id) ? (
                            <ChevronDown className="w-4 h-4" />
                          ) : (
                            <ChevronRight className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                      
                      {expandedModulos.has(modulo.id) && (
                        <div className="space-y-2 mt-2">
                          {modulo.itens.map((item: ItemModuloEquipe) => (
                            <div key={item.id} className="flex items-center justify-between p-2 border rounded text-sm bg-gray-50">
                              <div className="flex-1">
                                <p className="font-medium">
                                  {item.item_catalogo?.nome || item.item_estoque?.nome || item.grupo_item?.nome_grupo || 'Item sem nome'}
                                </p>
                                <div className="flex items-center gap-3 text-xs text-gray-600">
                                  <span>Qtd: {item.quantidade_padrao}</span>
                                  {item.obrigatorio && (
                                    <span className="text-blue-600 font-medium">Obrigatório</span>
                                  )}
                                  {item.item_catalogo?.categoria && (
                                    <span>{item.item_catalogo.categoria}</span>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-1">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => openItemModal(modulo, item)}
                                  className="text-blue-600 hover:text-blue-700"
                                >
                                  <Edit className="w-3 h-3" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleDeleteItem(item.id)}
                                  className="text-red-600 hover:text-red-700"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
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
                  : 'Crie um novo módulo pré-definido para um contrato'
                }
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="contrato">Contrato *</Label>
                <SearchableSelect
                  items={contratos}
                  value={moduloForm.operacao_id}
                  onValueChange={(value) => setModuloForm(prev => ({ ...prev, operacao_id: value }))}
                  placeholder="Digite para buscar contrato..."
                  className="w-full"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="nome_modulo">Nome do Módulo *</Label>
                <Input
                  id="nome_modulo"
                  value={moduloForm.nome_modulo}
                  onChange={(e) => setModuloForm(prev => ({ ...prev, nome_modulo: e.target.value }))}
                  placeholder="Ex: Kit Básico Operação"
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
                disabled={!moduloForm.operacao_id || !moduloForm.nome_modulo || busy}
              >
                {editingModulo ? 'Atualizar' : 'Criar'} Módulo
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Modal de Item */}
        <Dialog open={itemOpen} onOpenChange={setItemOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingItem ? 'Editar Item' : 'Adicionar Item ao Módulo'}
              </DialogTitle>
              <DialogDescription>
                {editingItem 
                  ? 'Atualize as informações do item'
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
                <div className="space-y-2">
                  <Label htmlFor="item_catalogo">Item do Catálogo *</Label>
                  <SearchableSelect
                    items={itensCatalogo}
                    value={itemForm.item_catalogo_id || ''}
                    onValueChange={(value) => setItemForm(prev => ({ ...prev, item_catalogo_id: value }))}
                    placeholder="Digite para buscar item..."
                    className="w-full"
                  />
                </div>
              )}

              {/* Grupo de itens */}
              {tipoItem === 'grupo' && (
                <div className="space-y-2">
                  <Label htmlFor="grupo_item">Grupo de Item *</Label>
                  <Select
                    value={itemForm.grupo_item_id || ''}
                    onValueChange={(value) => setItemForm(prev => ({ ...prev, grupo_item_id: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um grupo" />
                    </SelectTrigger>
                    <SelectContent>
                      {gruposItens.map((grupo: { id: string; nome_grupo: string; categoria: string }) => (
                        <SelectItem key={grupo.id} value={grupo.id}>
                          {grupo.nome_grupo}
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

              {/* Lista de itens do módulo */}
              {itensDoModulo.length > 0 && (
                <div className="space-y-2 border-t pt-4">
                  <h4 className="text-sm font-medium">Itens já adicionados ({itensDoModulo.length})</h4>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {itensDoModulo.map(item => (
                      <div key={item.id} className="flex items-center justify-between p-2 border rounded text-sm">
                        <div>
                          <p className="font-medium">{item.item_nome || item.grupo_nome}</p>
                          <p className="text-xs text-gray-600">Qtd: {item.quantidade_padrao}</p>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeleteItem(item.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
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
      </div>
    </div>
  )
}