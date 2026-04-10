'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { 
  Loader2, 
  CheckCircle2,
  Package,
  AlertCircle,
  Calendar,
  Building2,
  FileText,
  CheckSquare
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useNotification } from '@/contexts/NotificationContext'

interface ItemInventario {
  id: string
  item_catalogo_id: string
  base_id: string
  estoque_atual: number
  estoque_minimo: number
  localizacao_base?: string
  observacoes_base?: string
  status: string
  item_catalogo: {
    id: string
    nome: string
    codigo: string
    categoria: string
    requer_laudo: boolean
    descricao?: string
    unidade_medida?: string
  }
  base: {
    id: string
    nome: string
    codigo: string
  }
}

interface ItemInventarioCompleto extends ItemInventario {
  quantidade_verificada?: number
  observacoes?: string
  verificado: boolean
}

export default function InventarioDiarioPage() {
  const { user, userContratoIds } = useAuth()
  const { notify } = useNotification()
  
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [itens, setItens] = useState<ItemInventarioCompleto[]>([])
  const [dataGeracao, setDataGeracao] = useState<Date | null>(null)

  // Carregar itens aleatórios
  const carregarItens = useCallback(async () => {
    try {
      setLoading(true)
      
      const params = new URLSearchParams()
      if (userContratoIds && userContratoIds.length > 0) {
        params.append('contrato_ids', userContratoIds.join(','))
      }
      
      const response = await fetch(`/api/almoxarifado/inventario-diario?${params.toString()}`)
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Erro ao carregar itens')
      }
      
      const data = await response.json()
      
      // Inicializar itens com verificado = false
      const itensInicializados: ItemInventarioCompleto[] = (data.items || []).map((item: ItemInventario) => ({
        ...item,
        quantidade_verificada: item.estoque_atual,
        observacoes: '',
        verificado: false
      }))
      
      setItens(itensInicializados)
      setDataGeracao(new Date())
      
      if (itensInicializados.length === 0) {
        notify('Nenhum item encontrado no estoque para inventário', 'info')
      } else {
        notify(`${itensInicializados.length} itens gerados para inventário diário`, 'success')
      }
    } catch (error) {
      console.error('Erro ao carregar itens:', error)
      notify(error instanceof Error ? error.message : 'Erro ao carregar itens do inventário', 'error')
    } finally {
      setLoading(false)
    }
  }, [userContratoIds, notify])

  // Carregar itens ao montar o componente
  useEffect(() => {
    if (userContratoIds && userContratoIds.length > 0) {
      carregarItens()
    }
  }, [userContratoIds, carregarItens])

  // Atualizar quantidade verificada
  const atualizarQuantidade = (itemId: string, quantidade: number) => {
    setItens(prev => prev.map(item => 
      item.id === itemId 
        ? { ...item, quantidade_verificada: quantidade }
        : item
    ))
  }

  // Atualizar observações
  const atualizarObservacoes = (itemId: string, observacoes: string) => {
    setItens(prev => prev.map(item => 
      item.id === itemId 
        ? { ...item, observacoes }
        : item
    ))
  }

  // Marcar item como verificado
  const marcarVerificado = (itemId: string) => {
    setItens(prev => prev.map(item => 
      item.id === itemId 
        ? { ...item, verificado: !item.verificado }
        : item
    ))
  }

  // Salvar inventário de um item
  const salvarItem = async (item: ItemInventarioCompleto) => {
    try {
      setSaving(true)
      
      const response = await fetch('/api/almoxarifado/inventario-diario', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          item_id: item.id,
          quantidade_verificada: item.quantidade_verificada || item.estoque_atual,
          observacoes: item.observacoes || '',
          usuario_id: user?.id
        })
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Erro ao salvar inventário')
      }
      
      // Marcar como verificado após salvar
      marcarVerificado(item.id)
      
      notify(`Inventário de "${item.item_catalogo.nome}" salvo com sucesso`, 'success')
    } catch (error) {
      console.error('Erro ao salvar inventário:', error)
      notify(error instanceof Error ? error.message : 'Erro ao salvar inventário', 'error')
    } finally {
      setSaving(false)
    }
  }

  // Salvar todos os itens verificados
  const salvarTodos = async () => {
    const itensParaSalvar = itens.filter(item => item.verificado && item.quantidade_verificada !== undefined)
    
    if (itensParaSalvar.length === 0) {
      notify('Nenhum item verificado para salvar', 'warning')
      return
    }

    try {
      setSaving(true)
      
      const promises = itensParaSalvar.map(item => 
        fetch('/api/almoxarifado/inventario-diario', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            item_id: item.id,
            quantidade_verificada: item.quantidade_verificada || item.estoque_atual,
            observacoes: item.observacoes || '',
            usuario_id: user?.id
          })
        })
      )
      
      await Promise.all(promises)
      
      notify(`${itensParaSalvar.length} itens salvos com sucesso`, 'success')
      
      // Recarregar itens após salvar
      carregarItens()
    } catch (error) {
      console.error('Erro ao salvar inventários:', error)
      notify('Erro ao salvar inventários', 'error')
    } finally {
      setSaving(false)
    }
  }

  const itensVerificados = itens.filter(item => item.verificado).length
  const totalItens = itens.length
  const progresso = totalItens > 0 ? Math.round((itensVerificados / totalItens) * 100) : 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Inventário Diário</h1>
        <p className="text-gray-600">Verifique 5 itens aleatórios do estoque diariamente</p>
      </div>

      {/* Informações da geração */}
      {dataGeracao && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Calendar className="h-4 w-4" />
                <span>Gerado em {dataGeracao.toLocaleString('pt-BR')}</span>
              </div>
              <Badge variant="outline">
                {itensVerificados} de {totalItens} verificados
              </Badge>
            </div>
            {totalItens > 0 && (
              <div className="mt-4">
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                    style={{ width: `${progresso}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">{progresso}% concluído</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Lista de itens */}
      {loading && itens.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
              <span className="ml-3 text-gray-600">Carregando itens...</span>
            </div>
          </CardContent>
        </Card>
      ) : itens.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Package className="h-12 w-12 text-gray-400 mb-4" />
              <p className="text-gray-600 mb-2">Nenhum item disponível</p>
              <p className="text-sm text-gray-500">Os itens são carregados automaticamente ao acessar a página</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {itens.map((item) => (
            <Card 
              key={item.id} 
              className={item.verificado ? 'border-green-200 bg-green-50' : ''}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <CardTitle className="text-xl">{item.item_catalogo.nome}</CardTitle>
                      {item.verificado && (
                        <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Verificado
                        </Badge>
                      )}
                    </div>
                    <CardDescription className="flex items-center gap-4 mt-2">
                      <span className="flex items-center gap-1">
                        <FileText className="h-3 w-3" />
                        Código: {item.item_catalogo.codigo}
                      </span>
                      <span className="flex items-center gap-1">
                        <Building2 className="h-3 w-3" />
                        {item.base.nome}
                      </span>
                      <Badge variant="outline">{item.item_catalogo.categoria}</Badge>
                      {item.item_catalogo.requer_laudo && (
                        <Badge variant="outline" className="bg-orange-100 text-orange-800 border-orange-300">
                          Requer Laudo
                        </Badge>
                      )}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Informações do estoque */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <Label className="text-xs text-gray-500">Estoque Atual</Label>
                    <p className="text-lg font-semibold">{item.estoque_atual}</p>
                    {item.item_catalogo.unidade_medida && (
                      <p className="text-xs text-gray-500">{item.item_catalogo.unidade_medida}</p>
                    )}
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500">Estoque Mínimo</Label>
                    <p className="text-lg font-semibold text-orange-600">{item.estoque_minimo}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500">Localização</Label>
                    <p className="text-sm">{item.localizacao_base || 'Não informado'}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500">Status</Label>
                    <Badge 
                      variant={item.estoque_atual <= item.estoque_minimo ? 'destructive' : 'outline'}
                    >
                      {item.estoque_atual <= item.estoque_minimo ? 'Abaixo do Mínimo' : 'OK'}
                    </Badge>
                  </div>
                </div>

                {/* Campos de verificação */}
                <div className="border-t pt-4 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor={`quantidade-${item.id}`}>
                        Quantidade Verificada *
                      </Label>
                      <Input
                        id={`quantidade-${item.id}`}
                        type="number"
                        min="0"
                        value={item.quantidade_verificada || ''}
                        onChange={(e) => atualizarQuantidade(item.id, parseFloat(e.target.value) || 0)}
                        className="mt-1"
                      />
                      {item.quantidade_verificada !== undefined && 
                       item.quantidade_verificada !== item.estoque_atual && (
                        <div className="flex items-center gap-1 mt-1 text-sm">
                          {item.quantidade_verificada > item.estoque_atual ? (
                            <>
                              <AlertCircle className="h-4 w-4 text-green-600" />
                              <span className="text-green-600">
                                +{item.quantidade_verificada - item.estoque_atual} unidades
                              </span>
                            </>
                          ) : (
                            <>
                              <AlertCircle className="h-4 w-4 text-red-600" />
                              <span className="text-red-600">
                                {item.quantidade_verificada - item.estoque_atual} unidades
                              </span>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                    <div>
                      <Label htmlFor={`observacoes-${item.id}`}>
                        Observações
                      </Label>
                      <Textarea
                        id={`observacoes-${item.id}`}
                        value={item.observacoes || ''}
                        onChange={(e) => atualizarObservacoes(item.id, e.target.value)}
                        className="mt-1"
                        rows={2}
                        placeholder="Adicione observações sobre o inventário..."
                      />
                    </div>
                  </div>

                  {/* Ações */}
                  <div className="flex items-center justify-between pt-2">
                    <Button
                      variant="outline"
                      onClick={() => marcarVerificado(item.id)}
                      className={item.verificado ? 'bg-green-50 border-green-300' : ''}
                    >
                      <CheckSquare className="h-4 w-4 mr-2" />
                      {item.verificado ? 'Desmarcar' : 'Marcar como Verificado'}
                    </Button>
                    <Button
                      onClick={() => salvarItem(item)}
                      disabled={saving || item.quantidade_verificada === undefined}
                    >
                      {saving ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Salvando...
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="h-4 w-4 mr-2" />
                          Salvar Inventário
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Botão de salvar todos */}
      {itens.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Salvar todos os itens verificados</p>
                <p className="text-sm text-gray-500">
                  {itensVerificados} de {totalItens} itens marcados como verificados
                </p>
              </div>
              <Button
                onClick={salvarTodos}
                disabled={saving || itensVerificados === 0}
                size="lg"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Salvar Todos ({itensVerificados})
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

