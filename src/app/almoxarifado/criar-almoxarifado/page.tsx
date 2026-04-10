'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useNotification } from '@/contexts/NotificationContext'
import { useAuth } from '@/contexts/AuthContext'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { baseService } from '@/services/baseService'
import { catalogoService } from '@/services/catalogoService'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { 
  Loader2, 
  ArrowLeft,
  Package,
  AlertCircle
} from 'lucide-react'
import { PERMISSION_CODES } from '@/hooks/useModularPermissions'
import { useUnifiedPermissions } from '@/hooks/useUnifiedPermissions'
import ProtectedRoute from '@/components/ProtectedRoute'
import { UNIDADES_MEDIDA } from '@/constants/unidadesMedida'

export default function CriarAlmoxarifadoPage() {
  return (
    <ProtectedRoute requiredPermissions={[
      PERMISSION_CODES.ALMOXARIFADO.CRIAR_ALMOXARIFADO
    ]}>
      <CriarAlmoxarifadoContent />
    </ProtectedRoute>
  )
}

function CriarAlmoxarifadoContent() {
  const router = useRouter()
  const { notify } = useNotification()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const { hasBaseAccess } = useUnifiedPermissions()

  const [formData, setFormData] = useState({
    codigo: '',
    nome: '',
    descricao: '',
    categoria: 'epi' as 'epi' | 'ferramental' | 'consumivel' | 'equipamento',
    subcategoria: '',
    unidade_medida: 'UN',
    valor_unitario: '',
    fornecedor: '',
    validade: '',
    observacoes: '',
    requer_certificacao: false,
    requer_laudo: false,
    NCM: '',
    base_id: '',
    estoque_minimo: '0',
    estoque_atual: '0',
    localizacao: ''
  })

  // Buscar bases
  const { data: allBases = [] } = useQuery({
    queryKey: ['bases-ativas'],
    queryFn: () => baseService.getBasesAtivas(),
    staleTime: 5 * 60 * 1000,
  })

  const bases = allBases.filter(base => hasBaseAccess(base.id))

  // Mutation para criar item
  const createItemMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      if (!user) throw new Error('Usuário não autenticado')
      if (!data.base_id) throw new Error('Selecione uma base')

      // 1. Criar item no catálogo
      const itemCatalogo = await catalogoService.criarItemCatalogo({
        codigo: data.codigo,
        nome: data.nome,
        descricao: data.descricao || undefined,
        categoria: data.categoria,
        subcategoria: data.subcategoria || undefined,
        unidade_medida: data.unidade_medida,
        valor_unitario: data.valor_unitario ? parseFloat(data.valor_unitario.replace(',', '.')) : undefined,
        fornecedor: data.fornecedor || undefined,
        validade: data.validade || undefined,
        observacoes: data.observacoes || undefined,
        requer_certificacao: data.requer_certificacao,
        requer_laudo: data.requer_laudo,
        requer_rastreabilidade: false,
        requer_ca: false,
        NCM: data.NCM ? parseInt(data.NCM) : undefined,
        ativo: true
      })

      // 2. Adicionar item à base selecionada
      await catalogoService.adicionarItemABase(
        itemCatalogo.id,
        data.base_id,
        parseInt(data.estoque_minimo) || 0,
        parseInt(data.estoque_atual) || 0,
        data.localizacao || undefined,
        data.observacoes || undefined
      )

      return itemCatalogo
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['itens-catalogo'] })
      queryClient.invalidateQueries({ queryKey: ['itens-estoque'] })
      notify('Item criado com sucesso!', 'success')
      router.push('/almoxarifado/estoque')
    },
    onError: (error: Error | unknown) => {
      console.error('Erro ao criar item:', error)
      const message = error instanceof Error ? error.message : 'Erro desconhecido'
      notify(`Erro ao criar item: ${message}`, 'error')
    }
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.codigo.trim()) {
      notify('Código é obrigatório', 'error')
      return
    }
    
    if (!formData.nome.trim()) {
      notify('Nome é obrigatório', 'error')
      return
    }
    
    if (!formData.base_id) {
      notify('Selecione uma base', 'error')
      return
    }

    createItemMutation.mutate(formData)
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.back()}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Criar Novo Item</h1>
          <p className="text-gray-600">Adicione um novo item ao almoxarifado</p>
        </div>
      </div>

      {/* Form */}
      <Card>
        <CardHeader>
          <CardTitle>Informações do Item</CardTitle>
          <CardDescription>
            Preencha os dados do item que será adicionado ao catálogo e estoque
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Informações Básicas */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Informações Básicas</h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="codigo">Código *</Label>
                  <Input
                    id="codigo"
                    value={formData.codigo}
                    onChange={(e) => setFormData({ ...formData, codigo: e.target.value })}
                    placeholder="Ex: EPI-001"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nome">Nome *</Label>
                  <Input
                    id="nome"
                    value={formData.nome}
                    onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                    placeholder="Nome do item"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="descricao">Descrição</Label>
                <Textarea
                  id="descricao"
                  value={formData.descricao}
                  onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                  placeholder="Descrição detalhada do item"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="categoria">Categoria *</Label>
                  <Select
                    value={formData.categoria}
                    onValueChange={(value) => setFormData({ ...formData, categoria: value as typeof formData.categoria })}
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
                <div className="space-y-2">
                  <Label htmlFor="subcategoria">Subcategoria</Label>
                  <Input
                    id="subcategoria"
                    value={formData.subcategoria}
                    onChange={(e) => setFormData({ ...formData, subcategoria: e.target.value })}
                    placeholder="Ex: Proteção Auditiva"
                  />
                </div>
              </div>
            </div>

            {/* Informações de Estoque */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Estoque</h3>
              
              <div className="space-y-2">
                <Label htmlFor="base_id">Base *</Label>
                <Select
                  value={formData.base_id}
                  onValueChange={(value) => setFormData({ ...formData, base_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma base" />
                  </SelectTrigger>
                  <SelectContent>
                    {bases.map((base) => (
                      <SelectItem key={base.id} value={base.id}>
                        {base.nome}
                        {base.codigo && ` (${base.codigo})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="unidade_medida">Unidade de Medida *</Label>
                  <Select
                    value={formData.unidade_medida}
                    onValueChange={(value) => setFormData({ ...formData, unidade_medida: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {UNIDADES_MEDIDA.map(unidade => (
                        <SelectItem key={unidade.value} value={unidade.value}>
                          {unidade.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="estoque_minimo">Estoque Mínimo</Label>
                  <Input
                    id="estoque_minimo"
                    type="number"
                    min="0"
                    value={formData.estoque_minimo}
                    onChange={(e) => setFormData({ ...formData, estoque_minimo: e.target.value })}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="estoque_atual">Estoque Atual</Label>
                  <Input
                    id="estoque_atual"
                    type="number"
                    min="0"
                    value={formData.estoque_atual}
                    onChange={(e) => setFormData({ ...formData, estoque_atual: e.target.value })}
                    placeholder="0"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="localizacao">Localização na Base</Label>
                <Input
                  id="localizacao"
                  value={formData.localizacao}
                  onChange={(e) => setFormData({ ...formData, localizacao: e.target.value })}
                  placeholder="Ex: Prateleira A-3"
                />
              </div>
            </div>

            {/* Informações Adicionais */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Informações Adicionais</h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="valor_unitario">Valor Unitário</Label>
                  <Input
                    id="valor_unitario"
                    type="text"
                    value={formData.valor_unitario}
                    onChange={(e) => setFormData({ ...formData, valor_unitario: e.target.value })}
                    placeholder="0,00"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fornecedor">Fornecedor</Label>
                  <Input
                    id="fornecedor"
                    value={formData.fornecedor}
                    onChange={(e) => setFormData({ ...formData, fornecedor: e.target.value })}
                    placeholder="Nome do fornecedor"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="validade">Validade</Label>
                  <Input
                    id="validade"
                    type="date"
                    value={formData.validade}
                    onChange={(e) => setFormData({ ...formData, validade: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="NCM">NCM</Label>
                  <Input
                    id="NCM"
                    type="number"
                    value={formData.NCM}
                    onChange={(e) => setFormData({ ...formData, NCM: e.target.value })}
                    placeholder="Código NCM"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="observacoes">Observações</Label>
                <Textarea
                  id="observacoes"
                  value={formData.observacoes}
                  onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                  placeholder="Observações adicionais"
                  rows={2}
                />
              </div>

              <div className="flex gap-6">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="requer_certificacao"
                    checked={formData.requer_certificacao}
                    onCheckedChange={(checked) => setFormData({ ...formData, requer_certificacao: checked })}
                  />
                  <Label htmlFor="requer_certificacao">Requer Certificação</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="requer_laudo"
                    checked={formData.requer_laudo}
                    onCheckedChange={(checked) => setFormData({ ...formData, requer_laudo: checked })}
                  />
                  <Label htmlFor="requer_laudo">Requer Laudo</Label>
                </div>
              </div>
            </div>

            {/* Alerts */}
            {bases.length === 0 && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Nenhuma base disponível</AlertTitle>
                <AlertDescription>
                  Você não tem acesso a nenhuma base. Entre em contato com o administrador.
                </AlertDescription>
              </Alert>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-4 pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
                disabled={createItemMutation.isPending}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={createItemMutation.isPending || bases.length === 0}
              >
                {createItemMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Criando...
                  </>
                ) : (
                  <>
                    <Package className="mr-2 h-4 w-4" />
                    Criar Item
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
