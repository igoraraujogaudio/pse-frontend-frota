'use client'

import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  Users, 
  UserCheck, 
  Package, 
  FileText, 
  AlertTriangle,
  Clock,
  RefreshCw
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { inventarioService } from '@/services/inventarioService'

interface InventarioStats {
  equipes_total: number
  equipes_atualizadas: number
  funcionarios_total: number
  funcionarios_atualizados: number
  itens_distribuidos: number
  laudos_vencendo: number
}

export default function InventariosHubPage() {
  const { userContratoIds } = useAuth()
  
  // React Query para estatísticas
  const { data: stats = {
    equipes_total: 0,
    equipes_atualizadas: 0,
    funcionarios_total: 0,
    funcionarios_atualizados: 0,
    itens_distribuidos: 0,
    laudos_vencendo: 0
  } as InventarioStats, isLoading: loadingStats, refetch: refetchStats } = useQuery<InventarioStats>({
    queryKey: ['inventario-stats', userContratoIds],
    queryFn: async () => {
      console.log('🔥 Carregando estatísticas reais de inventário...')
      const statsData = await inventarioService.getStats(userContratoIds)
      console.log('✅ Estatísticas carregadas:', statsData)
      return statsData
    },
    staleTime: 2 * 60 * 1000, // 2 minutos
    gcTime: 5 * 60 * 1000, // 5 minutos
  })

  const inventarioOptions = [
    {
      id: 'funcionarios',
      title: 'Inventário de Funcionários',
      description: 'Controle EPIs e equipamentos por funcionário',
      icon: UserCheck,
      href: '/almoxarifado/inventarios/funcionarios',
      color: 'bg-green-500',
      stats: {
        total: stats.funcionarios_total,
        updated: stats.funcionarios_atualizados,
        percentage: stats.funcionarios_total > 0 ? Math.round((stats.funcionarios_atualizados / stats.funcionarios_total) * 100) : 0
      }
    },
    {
      id: 'equipes',
      title: 'Inventário de Equipes',
      description: 'Gerencie itens distribuídos para equipes específicas',
      icon: Users,
      href: '/almoxarifado/inventarios/equipes',
      color: 'bg-blue-500',
      stats: {
        total: stats.equipes_total,
        updated: stats.equipes_atualizadas,
        percentage: stats.equipes_total > 0 ? Math.round((stats.equipes_atualizadas / stats.equipes_total) * 100) : 0
      }
    }
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Inventários</h1>
          <p className="text-gray-600">Central de controle de inventários do almoxarifado</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetchStats()}
          disabled={loadingStats}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${loadingStats ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      {/* Cards de Estatísticas Gerais */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Itens Distribuídos</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.itens_distribuidos.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Total em uso</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Equipes Ativas</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.equipes_total}</div>
            <p className="text-xs text-muted-foreground">
              {stats.equipes_atualizadas} atualizadas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Funcionários</CardTitle>
            <UserCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.funcionarios_total}</div>
            <p className="text-xs text-muted-foreground">
              {stats.funcionarios_atualizados} com inventário
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Laudos Vencendo</CardTitle>
            <AlertTriangle className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{stats.laudos_vencendo}</div>
            <p className="text-xs text-muted-foreground">Próximos 30 dias</p>
          </CardContent>
        </Card>
      </div>

      {/* Opções de Inventário */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {inventarioOptions.map((option) => {
          const Icon = option.icon
          return (
            <Card key={option.id} className="hover:shadow-lg transition-shadow cursor-pointer group">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className={`p-3 rounded-lg ${option.color}`}>
                    <Icon className="h-6 w-6 text-white" />
                  </div>
                  <Badge variant="outline" className="text-sm">
                    {option.stats.percentage}% atualizado
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
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-gray-900">
                        {option.stats.total}
                      </div>
                      <div className="text-sm text-gray-500">Total</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">
                        {option.stats.updated}
                      </div>
                      <div className="text-sm text-gray-500">Atualizados</div>
                    </div>
                  </div>

                  {/* Barra de Progresso */}
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full transition-all duration-300 ${
                        option.id === 'funcionarios' ? 'bg-green-600' : 'bg-blue-600'
                      }`}
                      style={{ width: `${option.stats.percentage}%` }}
                    />
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
            Acesso rápido às funcionalidades mais utilizadas
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link href="/almoxarifado/inventarios/equipes">
              <Button variant="outline" className="w-full justify-start">
                <Users className="h-4 w-4 mr-2" />
                Nova Distribuição para Equipe
              </Button>
            </Link>
            
            <Link href="/almoxarifado/inventarios/funcionarios">
              <Button variant="outline" className="w-full justify-start">
                <UserCheck className="h-4 w-4 mr-2" />
                Atualizar EPI Funcionário
              </Button>
            </Link>
            
            <Link href="/almoxarifado/estoque">
              <Button variant="outline" className="w-full justify-start">
                <Package className="h-4 w-4 mr-2" />
                Verificar Estoque
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Alertas e Notificações */}
      {stats.laudos_vencendo > 0 && (
        <Card className="border-orange-200 bg-orange-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-800">
              <AlertTriangle className="h-5 w-5" />
              Atenção Necessária
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-orange-700">
              Existem <strong>{stats.laudos_vencendo} laudos</strong> que irão vencer nos próximos 30 dias. 
              Verifique os inventários para garantir a conformidade.
            </p>
            <div className="mt-3">
              <Link href="/almoxarifado/inventarios/laudos-vencendo">
                <Button variant="outline" size="sm" className="text-orange-700 border-orange-300 hover:bg-orange-100">
                  <FileText className="h-4 w-4 mr-2" />
                  Ver Laudos Vencendo
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
