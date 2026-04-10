'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { useNotification } from '@/contexts/NotificationContext'
import { useQuery } from '@tanstack/react-query'
import { estoqueService } from '@/services/estoqueService'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Bell, 
  AlertTriangle, 
  Package, 
  Clock, 
  DollarSign, 
  Users, 
  CheckCircle, 
  RefreshCw,
  TrendingDown
} from 'lucide-react'

interface AlertaEstoque {
  id: string
  item_nome: string
  categoria: string
  estoque_atual: number
  estoque_minimo: number
  tipo: 'critico' | 'baixo' | 'expirado'
  dias_restantes?: number
  valor_unitario?: number
  impacto_financeiro?: number
}

interface AlertaSolicitacao {
  id: string
  item_nome: string
  solicitante: string
  quantidade: number
  prioridade: 'baixa' | 'media' | 'alta' | 'urgente'
  dias_pendente: number
  status: 'pendente' | 'aprovada' | 'rejeitada'
}

export default function AlertasPage() {
  const router = useRouter()
  const { user } = useAuth()
  const { notify } = useNotification()

  const [activeTab, setActiveTab] = useState('estoque')

  // React Query para alertas de estoque
  const { data: alertasEstoque = [], isLoading: alertasEstoqueLoading } = useQuery({
    queryKey: ['alertas-estoque'],
    queryFn: async () => {
      const relatorio = await estoqueService.getRelatorioEstoque()
      const alertas: AlertaEstoque[] = []
      
      relatorio.forEach(item => {
        if (item.status_estoque === 'critico') {
          alertas.push({
            id: item.item_id,
            item_nome: item.nome,
            categoria: item.categoria,
            estoque_atual: item.estoque_atual,
            estoque_minimo: item.estoque_minimo,
            tipo: 'critico',
            valor_unitario: item.valor_unitario,
            impacto_financeiro: (item.estoque_atual || 0) * (item.valor_unitario || 0)
          })
        } else if (item.status_estoque === 'baixo') {
          alertas.push({
            id: item.item_id,
            item_nome: item.nome,
            categoria: item.categoria,
            estoque_atual: item.estoque_atual,
            estoque_minimo: item.estoque_minimo,
            tipo: 'baixo',
            valor_unitario: item.valor_unitario,
            impacto_financeiro: (item.estoque_atual || 0) * (item.valor_unitario || 0)
          })
        }
      })
      
      return alertas
    },
    staleTime: 1 * 60 * 1000, // 1 minuto
    gcTime: 3 * 60 * 1000, // 3 minutos
  })

  // React Query para alertas de solicitações
  const { data: alertasSolicitacoes = [], isLoading: alertasSolicitacoesLoading } = useQuery({
    queryKey: ['alertas-solicitacoes'],
    queryFn: async () => {
      const solicitacoes = await estoqueService.getSolicitacoesPorStatus('pendente')
      const alertasSol: AlertaSolicitacao[] = solicitacoes
        .filter(sol => ['pendente', 'aprovada', 'rejeitada'].includes(sol.status))
        .map(sol => ({
          id: sol.id,
          item_nome: sol.item?.nome || 'N/A',
          solicitante: sol.solicitante?.nome || 'N/A',
          quantidade: sol.quantidade_solicitada,
          prioridade: sol.prioridade === 'normal' ? 'media' : sol.prioridade,
          dias_pendente: Math.floor((Date.now() - new Date(sol.criado_em).getTime()) / (1000 * 60 * 60 * 24)),
          status: sol.status as 'pendente' | 'aprovada' | 'rejeitada'
        }))
      
      return alertasSol
    },
    staleTime: 1 * 60 * 1000, // 1 minuto
    gcTime: 3 * 60 * 1000, // 3 minutos
  })

  const loading = alertasEstoqueLoading || alertasSolicitacoesLoading

  // Verificar permissões
  useEffect(() => {
    if (user && !['almoxarifado', 'gestor_almoxarifado', 'admin'].includes(user.nivel_acesso)) {
      notify('Acesso negado. Apenas funcionários do almoxarifado podem acessar esta funcionalidade.', 'error')
      router.push('/dashboard')
      return
    }
  }, [user, router, notify])

  const getTipoAlertaColor = (tipo: string) => {
    switch (tipo) {
      case 'critico': return 'bg-red-100 text-red-800'
      case 'baixo': return 'bg-yellow-100 text-yellow-800'
      case 'expirado': return 'bg-purple-100 text-purple-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getPrioridadeColor = (prioridade: string) => {
    switch (prioridade) {
      case 'baixa': return 'bg-green-100 text-green-800'
      case 'media': return 'bg-yellow-100 text-yellow-800'
      case 'alta': return 'bg-orange-100 text-orange-800'
      case 'urgente': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getDiasPendenteColor = (dias: number) => {
    if (dias <= 1) return 'text-green-600'
    if (dias <= 3) return 'text-yellow-600'
    if (dias <= 7) return 'text-orange-600'
    return 'text-red-600'
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value)
  }

  if (!user || !['almoxarifado', 'gestor_almoxarifado', 'admin'].includes(user.nivel_acesso)) {
    return null
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Bell className="h-8 w-8 text-red-600" />
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Alertas e Notificações</h1>
            <p className="text-gray-600">Monitore estoque crítico e solicitações pendentes</p>
          </div>
        </div>
      </div>

      {/* Estatísticas dos Alertas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              Total de Alertas
            </CardDescription>
            <CardTitle className="text-2xl text-red-600">
              {alertasEstoque.length + alertasSolicitacoes.length}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Package className="h-4 w-4 text-amber-500" />
              Estoque Crítico
            </CardDescription>
            <CardTitle className="text-2xl text-amber-600">
              {alertasEstoque.filter(a => a.tipo === 'critico').length}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-yellow-500" />
              Baixo Estoque
            </CardDescription>
            <CardTitle className="text-2xl text-yellow-600">
              {alertasEstoque.filter(a => a.tipo === 'baixo').length}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-blue-500" />
              Solicitações Pendentes
            </CardDescription>
            <CardTitle className="text-2xl text-blue-600">
              {alertasSolicitacoes.length}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="estoque">Alertas de Estoque</TabsTrigger>
          <TabsTrigger value="solicitacoes">Solicitações Pendentes</TabsTrigger>
        </TabsList>

        <TabsContent value="estoque" className="space-y-4">
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Carregando alertas...</p>
            </div>
          ) : alertasEstoque.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
                <p className="text-gray-500">Nenhum alerta de estoque ativo</p>
                <p className="text-sm text-gray-400">Todos os itens estão com estoque adequado</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {alertasEstoque.map((alerta) => (
                <Card key={alerta.id} className="border-l-4 border-l-red-500">
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-semibold text-lg">{alerta.item_nome}</h3>
                          <Badge className={getTipoAlertaColor(alerta.tipo)}>
                            {alerta.tipo === 'critico' ? 'Crítico' : 'Baixo Estoque'}
                          </Badge>
                          <Badge variant="outline" className="capitalize">
                            {alerta.categoria}
                          </Badge>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600 mb-3">
                          <div className="flex items-center gap-2">
                            <Package className="h-4 w-4" />
                            <span>Estoque Atual: <strong className="text-red-600">{alerta.estoque_atual}</strong></span>
                          </div>
                          <div className="flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4" />
                            <span>Mínimo: <strong>{alerta.estoque_minimo}</strong></span>
                          </div>
                          <div className="flex items-center gap-2">
                            <DollarSign className="h-4 w-4" />
                            <span>Valor: {formatCurrency(alerta.valor_unitario || 0)}</span>
                          </div>
                        </div>
                        <div className="p-3 bg-red-50 rounded-md border border-red-200">
                          <div className="flex items-center gap-2 text-red-700">
                            <AlertTriangle className="h-4 w-4" />
                            <span className="font-medium">
                              {alerta.tipo === 'critico' 
                                ? 'Estoque crítico! Reabastecimento urgente necessário.'
                                : 'Estoque abaixo do mínimo recomendado.'
                              }
                            </span>
                          </div>
                          {alerta.impacto_financeiro && (
                            <p className="text-sm text-red-600 mt-1">
                              Impacto financeiro: {formatCurrency(alerta.impacto_financeiro)}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col gap-2 ml-4">
                        <Button
                          size="sm"
                          onClick={() => router.push(`/almoxarifado/cotacoes?item=${alerta.item_nome}`)}
                        >
                          Solicitar Compra
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => router.push(`/almoxarifado/estoque?search=${alerta.item_nome}`)}
                        >
                          Ver Detalhes
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="solicitacoes" className="space-y-4">
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Carregando solicitações...</p>
            </div>
          ) : alertasSolicitacoes.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
                <p className="text-gray-500">Nenhuma solicitação pendente</p>
                <p className="text-sm text-gray-400">Todas as solicitações foram processadas</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {alertasSolicitacoes
                .sort((a, b) => {
                  // Ordenar por prioridade e depois por dias pendente
                  const prioridadeOrder = { urgente: 4, alta: 3, media: 2, baixa: 1 }
                  const prioridadeDiff = prioridadeOrder[b.prioridade] - prioridadeOrder[a.prioridade]
                  if (prioridadeDiff !== 0) return prioridadeDiff
                  return b.dias_pendente - a.dias_pendente
                })
                .map((solicitacao) => (
                  <Card key={solicitacao.id} className="border-l-4 border-l-blue-500">
                    <CardContent className="pt-6">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="font-semibold text-lg">{solicitacao.item_nome}</h3>
                            <Badge className={getPrioridadeColor(solicitacao.prioridade)}>
                              {solicitacao.prioridade}
                            </Badge>
                            <Badge variant="outline">
                              {solicitacao.status}
                            </Badge>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600 mb-3">
                            <div className="flex items-center gap-2">
                              <Users className="h-4 w-4" />
                              <span>Solicitante: <strong>{solicitacao.solicitante}</strong></span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Package className="h-4 w-4" />
                              <span>Quantidade: <strong>{solicitacao.quantidade}</strong></span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Clock className="h-4 w-4" />
                              <span className={getDiasPendenteColor(solicitacao.dias_pendente)}>
                                <strong>{solicitacao.dias_pendente} dias</strong> pendente
                              </span>
                            </div>
                          </div>
                          <div className={`p-3 rounded-md border ${
                            solicitacao.dias_pendente > 7 
                              ? 'bg-red-50 border-red-200' 
                              : solicitacao.dias_pendente > 3 
                                ? 'bg-yellow-50 border-yellow-200'
                                : 'bg-blue-50 border-blue-200'
                          }`}>
                            <div className={`flex items-center gap-2 ${
                              solicitacao.dias_pendente > 7 
                                ? 'text-red-700' 
                                : solicitacao.dias_pendente > 3 
                                  ? 'text-yellow-700'
                                  : 'text-blue-700'
                            }`}>
                              <Clock className="h-4 w-4" />
                              <span className="font-medium">
                                {solicitacao.dias_pendente > 7 
                                  ? 'Solicitação com alta urgência! Processe o quanto antes.'
                                  : solicitacao.dias_pendente > 3 
                                    ? 'Solicitação pendente há alguns dias.'
                                    : 'Solicitação recente.'
                                }
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col gap-2 ml-4">
                          <Button
                            size="sm"
                            onClick={() => router.push(`/almoxarifado/solicitacoes?id=${solicitacao.id}`)}
                          >
                            Processar
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => router.push(`/almoxarifado/solicitacoes`)}
                          >
                            Ver Todas
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Botão de Atualizar */}
      <div className="mt-6 text-center">
        <Button onClick={() => window.location.reload()} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Atualizar Alertas
        </Button>
      </div>
    </div>
  )
}
