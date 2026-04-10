'use client'

import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  Users, 
  Package, 
  TrendingUp,
  FileText,
  Calendar,
  BarChart3,
  Activity,
  Clock,
  ArrowUpDown
} from 'lucide-react'

interface HistoricoStats {
  movimentacoes_mes: number
  entregas_mes: number
  devolucoes_mes: number
  funcionarios_ativos: number
}

export default function HistoricoHubPage() {
  // React Query para estatísticas do histórico
  const { data: stats = {
    movimentacoes_mes: 245,
    entregas_mes: 180,
    devolucoes_mes: 65,
    funcionarios_ativos: 150
  } } = useQuery({
    queryKey: ['historico-stats'],
    queryFn: async () => {
      // TODO: Implementar carregamento real das estatísticas
      // Por enquanto, dados mockados
      return {
        movimentacoes_mes: 245,
        entregas_mes: 180,
        devolucoes_mes: 65,
        funcionarios_ativos: 150
      } as HistoricoStats
    },
    staleTime: 5 * 60 * 1000, // 5 minutos
    gcTime: 10 * 60 * 1000, // 10 minutos
  })

  const historicoOptions = [
    {
      id: 'funcionarios',
      title: 'Histórico de Funcionários',
      description: 'Acompanhe entregas, devoluções e movimentações de EPIs por funcionário',
      icon: Users,
      href: '/almoxarifado/historico-funcionarios',
      color: 'bg-blue-500',
      stats: {
        total: stats.funcionarios_ativos,
        recent: Math.floor(stats.funcionarios_ativos * 0.3),
        label: 'funcionários ativos'
      }
    },
    {
      id: 'movimentacoes',
      title: 'Histórico de Movimentações',
      description: 'Visualize todas as movimentações de estoque, entradas e saídas',
      icon: ArrowUpDown,
      href: '/almoxarifado/historico/movimentacoes',
      color: 'bg-green-500',
      stats: {
        total: stats.movimentacoes_mes,
        recent: Math.floor(stats.movimentacoes_mes * 0.4),
        label: 'movimentações este mês'
      }
    },
    {
      id: 'relatorios',
      title: 'Relatórios Gerenciais',
      description: 'Acesse relatórios detalhados e análises do almoxarifado',
      icon: BarChart3,
      href: '/almoxarifado/relatorios',
      color: 'bg-purple-500',
      stats: {
        total: 12,
        recent: 3,
        label: 'relatórios disponíveis'
      }
    }
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Histórico</h1>
          <p className="text-gray-600">Central de históricos e relatórios do almoxarifado</p>
        </div>
      </div>

      {/* Cards de Estatísticas Gerais */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Movimentações</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.movimentacoes_mes}</div>
            <p className="text-xs text-muted-foreground">Este mês</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Entregas</CardTitle>
            <Package className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.entregas_mes}</div>
            <p className="text-xs text-muted-foreground">Este mês</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Devoluções</CardTitle>
            <TrendingUp className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.devolucoes_mes}</div>
            <p className="text-xs text-muted-foreground">Este mês</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Funcionários</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.funcionarios_ativos}</div>
            <p className="text-xs text-muted-foreground">Com movimentações</p>
          </CardContent>
        </Card>
      </div>

      {/* Opções de Histórico */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {historicoOptions.map((option) => {
          const Icon = option.icon
          return (
            <Card key={option.id} className="hover:shadow-lg transition-shadow cursor-pointer group">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className={`p-3 rounded-lg ${option.color}`}>
                    <Icon className="h-6 w-6 text-white" />
                  </div>
                  <Badge variant="outline" className="text-sm">
                    {option.stats.recent} recentes
                  </Badge>
                </div>
                <CardTitle className="text-xl group-hover:text-blue-600 transition-colors">
                  {option.title}
                </CardTitle>
                <CardDescription className="text-gray-600">
                  {option.description}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Estatísticas */}
                  <div className="text-center">
                    <div className="text-3xl font-bold text-gray-900">
                      {option.stats.total}
                    </div>
                    <div className="text-sm text-gray-500">
                      {option.stats.label}
                    </div>
                  </div>

                  {/* Botão de Ação */}
                  <Link href={option.href}>
                    <Button className="w-full group-hover:bg-blue-600 transition-colors">
                      Acessar {option.title}
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Ações Rápidas */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Ações Rápidas
          </CardTitle>
          <CardDescription>
            Acesso rápido às consultas mais utilizadas
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link href="/almoxarifado/historico-funcionarios">
              <Button variant="outline" className="w-full justify-start">
                <Users className="h-4 w-4 mr-2" />
                Consultar Funcionário
              </Button>
            </Link>
            
            <Link href="/almoxarifado/historico/movimentacoes">
              <Button variant="outline" className="w-full justify-start">
                <ArrowUpDown className="h-4 w-4 mr-2" />
                Ver Movimentações
              </Button>
            </Link>
            
            <Link href="/almoxarifado/relatorios">
              <Button variant="outline" className="w-full justify-start">
                <FileText className="h-4 w-4 mr-2" />
                Gerar Relatório
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Resumo do Período */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Resumo do Mês
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Total de Movimentações</span>
                <span className="font-semibold">{stats.movimentacoes_mes}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Entregas Realizadas</span>
                <span className="font-semibold text-green-600">{stats.entregas_mes}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Devoluções Recebidas</span>
                <span className="font-semibold text-blue-600">{stats.devolucoes_mes}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Taxa de Devolução</span>
                <span className="font-semibold">
                  {stats.entregas_mes > 0 ? Math.round((stats.devolucoes_mes / stats.entregas_mes) * 100) : 0}%
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Atividade Recente
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <div className="flex-1">
                  <p className="text-sm">Entrega de EPI realizada</p>
                  <p className="text-xs text-gray-500">há 2 horas</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <div className="flex-1">
                  <p className="text-sm">Devolução processada</p>
                  <p className="text-xs text-gray-500">há 4 horas</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                <div className="flex-1">
                  <p className="text-sm">Relatório gerado</p>
                  <p className="text-xs text-gray-500">há 6 horas</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                <div className="flex-1">
                  <p className="text-sm">Ajuste de estoque</p>
                  <p className="text-xs text-gray-500">há 1 dia</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}