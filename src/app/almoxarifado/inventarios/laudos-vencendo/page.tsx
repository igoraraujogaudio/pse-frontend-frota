'use client'

import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { 
  AlertTriangle, 
  FileText, 
  Search,
  User,
  Users,
  Package,
  Calendar,
  ArrowLeft,
  RefreshCw,
  Filter,
  CheckCircle
} from 'lucide-react'
import { inventarioService } from '@/services/inventarioService'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface LaudoVencendo {
  id: string
  tipo: 'funcionario' | 'equipe' | 'item_equipe'
  item_nome?: string
  item_codigo?: string
  funcionario_nome?: string
  funcionario_matricula?: string
  funcionario_id?: string
  equipe_nome?: string
  equipe_id?: string
  numero_laudo?: string
  validade_laudo: string
  data_vencimento?: string
  status: 'vencido' | 'vencendo' | 'em_dia'
  dias_restantes: number
  categoria?: string
}

export default function LaudosVencendoPage() {
  const { userContratoIds } = useAuth()
  const router = useRouter()
  
  const [search, setSearch] = useState('')
  const [tipoFilter, setTipoFilter] = useState<'todos' | 'funcionario' | 'equipe' | 'item_equipe'>('todos')
  const [statusFilter, setStatusFilter] = useState<'todos' | 'vencido' | 'vencendo' | 'em_dia'>('todos')

  const { data: laudos = [], isLoading, refetch } = useQuery<LaudoVencendo[]>({
    queryKey: ['laudos-vencendo-inventario', userContratoIds],
    queryFn: () => inventarioService.getLaudosVencendo(userContratoIds),
    staleTime: 2 * 60 * 1000, // 2 minutos
    gcTime: 5 * 60 * 1000, // 5 minutos
  })

  // Filtrar laudos
  const filteredLaudos = useMemo(() => {
    return laudos.filter(laudo => {
      // Filtro de busca
      const matchesSearch = search === '' || 
        laudo.item_nome?.toLowerCase().includes(search.toLowerCase()) ||
        laudo.item_codigo?.toLowerCase().includes(search.toLowerCase()) ||
        laudo.funcionario_nome?.toLowerCase().includes(search.toLowerCase()) ||
        laudo.funcionario_matricula?.toLowerCase().includes(search.toLowerCase()) ||
        laudo.equipe_nome?.toLowerCase().includes(search.toLowerCase()) ||
        laudo.numero_laudo?.toLowerCase().includes(search.toLowerCase()) ||
        laudo.categoria?.toLowerCase().includes(search.toLowerCase())

      // Filtro de tipo
      const matchesTipo = tipoFilter === 'todos' || laudo.tipo === tipoFilter

      // Filtro de status
      const matchesStatus = statusFilter === 'todos' || laudo.status === statusFilter

      return matchesSearch && matchesTipo && matchesStatus
    })
  }, [laudos, search, tipoFilter, statusFilter])

  // Estatísticas
  const stats = useMemo(() => {
    return {
      total: laudos.length,
      vencidos: laudos.filter(l => l.status === 'vencido').length,
      vencendo: laudos.filter(l => l.status === 'vencendo').length,
      em_dia: laudos.filter(l => l.status === 'em_dia').length,
    }
  }, [laudos])

  const getStatusBadge = (laudo: LaudoVencendo) => {
    if (laudo.status === 'vencido') {
      return (
        <Badge className="bg-red-100 text-red-700 hover:bg-red-200">
          <AlertTriangle className="h-3 w-3 mr-1" />
          Vencido há {Math.abs(laudo.dias_restantes)} dia{Math.abs(laudo.dias_restantes) !== 1 ? 's' : ''}
        </Badge>
      )
    }
    if (laudo.status === 'vencendo') {
      return (
        <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-200">
          <Calendar className="h-3 w-3 mr-1" />
          Vence em {laudo.dias_restantes} dia{laudo.dias_restantes !== 1 ? 's' : ''}
        </Badge>
      )
    }
    return (
      <Badge className="bg-green-100 text-green-700 hover:bg-green-200">
        <CheckCircle className="h-3 w-3 mr-1" />
        Em dia ({laudo.dias_restantes} dias restantes)
      </Badge>
    )
  }

  const getTipoIcon = (tipo: string) => {
    switch (tipo) {
      case 'funcionario':
        return <User className="h-4 w-4" />
      case 'equipe':
        return <Users className="h-4 w-4" />
      case 'item_equipe':
        return <Package className="h-4 w-4" />
      default:
        return <FileText className="h-4 w-4" />
    }
  }

  const getTipoLabel = (tipo: string) => {
    switch (tipo) {
      case 'funcionario':
        return 'Funcionário'
      case 'equipe':
        return 'Equipe'
      case 'item_equipe':
        return 'Item da Equipe'
      default:
        return tipo
    }
  }

  const handleVerDetalhes = (laudo: LaudoVencendo) => {
    if (laudo.tipo === 'funcionario' && laudo.funcionario_id) {
      router.push(`/almoxarifado/inventarios/funcionarios/${laudo.funcionario_id}?nome=${encodeURIComponent(laudo.funcionario_nome || '')}&matricula=${encodeURIComponent(laudo.funcionario_matricula || '')}`)
    } else if (laudo.tipo === 'equipe' && laudo.equipe_id) {
      router.push(`/almoxarifado/inventarios/equipes/${laudo.equipe_id}?nome=${encodeURIComponent(laudo.equipe_nome || '')}`)
    }
    // Para item_equipe, pode ser necessário criar uma página específica ou mostrar em modal
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <Link href="/almoxarifado/inventarios">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Laudos de Inventário</h1>
            <p className="text-gray-600">Acompanhamento de todos os laudos de inventário</p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isLoading}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      {/* Cards de Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card 
          className={`cursor-pointer hover:shadow-md transition-all ${
            statusFilter === 'todos' ? 'ring-2 ring-blue-500 shadow-md' : ''
          }`}
          onClick={() => setStatusFilter('todos')}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Laudos</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">Todos os laudos</p>
          </CardContent>
        </Card>

        <Card 
          className={`cursor-pointer hover:shadow-md transition-all ${
            statusFilter === 'vencido' ? 'ring-2 ring-red-500 shadow-md' : ''
          }`}
          onClick={() => setStatusFilter('vencido')}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Vencidos</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.vencidos}</div>
            <p className="text-xs text-muted-foreground">Atenção necessária</p>
          </CardContent>
        </Card>

        <Card 
          className={`cursor-pointer hover:shadow-md transition-all ${
            statusFilter === 'vencendo' ? 'ring-2 ring-orange-500 shadow-md' : ''
          }`}
          onClick={() => setStatusFilter('vencendo')}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Vencendo</CardTitle>
            <Calendar className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{stats.vencendo}</div>
            <p className="text-xs text-muted-foreground">Próximos 30 dias</p>
          </CardContent>
        </Card>

        <Card 
          className={`cursor-pointer hover:shadow-md transition-all ${
            statusFilter === 'em_dia' ? 'ring-2 ring-green-500 shadow-md' : ''
          }`}
          onClick={() => setStatusFilter('em_dia')}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Em Dia</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.em_dia}</div>
            <p className="text-xs text-muted-foreground">Mais de 30 dias</p>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Buscar</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Item, funcionário, equipe..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Tipo</label>
              <select
                value={tipoFilter}
                onChange={(e) => setTipoFilter(e.target.value as 'todos' | 'funcionario' | 'equipe' | 'item_equipe')}
                className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
              >
                <option value="todos">Todos os tipos</option>
                <option value="funcionario">Funcionários</option>
                <option value="equipe">Equipes</option>
                <option value="item_equipe">Itens da Equipe</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as 'todos' | 'vencido' | 'vencendo' | 'em_dia')}
                className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
              >
                <option value="todos">Todos</option>
                <option value="vencido">Vencidos</option>
                <option value="vencendo">Vencendo</option>
                <option value="em_dia">Em Dia</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Laudos */}
      <Card>
        <CardHeader>
          <CardTitle>Laudos ({filteredLaudos.length})</CardTitle>
          <CardDescription>
            Lista de todos os laudos de inventário
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-6 w-6 animate-spin text-gray-400 mr-2" />
              <span className="text-gray-500">Carregando laudos...</span>
            </div>
          ) : filteredLaudos.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500 text-lg font-medium">Nenhum laudo encontrado</p>
              <p className="text-gray-400 text-sm mt-2">
                {search || tipoFilter !== 'todos' || statusFilter !== 'todos'
                  ? 'Tente ajustar os filtros para encontrar mais resultados.'
                  : 'Não há laudos cadastrados.'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredLaudos.map((laudo) => (
                <div
                  key={laudo.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start gap-4 flex-1">
                    <div className={`p-2 rounded-lg ${
                      laudo.status === 'vencido' ? 'bg-red-100' : 
                      laudo.status === 'vencendo' ? 'bg-orange-100' : 
                      'bg-green-100'
                    }`}>
                      {getTipoIcon(laudo.tipo)}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-gray-900">
                          {laudo.item_nome || 'Item sem nome'}
                        </h3>
                        <Badge variant="outline" className="text-xs">
                          {getTipoLabel(laudo.tipo)}
                        </Badge>
                        {laudo.categoria && (
                          <Badge variant="outline" className="text-xs">
                            {laudo.categoria}
                          </Badge>
                        )}
                      </div>
                      <div className="text-sm text-gray-600 space-y-1">
                        {laudo.item_codigo && (
                          <p><span className="font-medium">Código:</span> {laudo.item_codigo}</p>
                        )}
                        {laudo.funcionario_nome && (
                          <p>
                            <span className="font-medium">Funcionário:</span> {laudo.funcionario_nome}
                            {laudo.funcionario_matricula && ` (${laudo.funcionario_matricula})`}
                          </p>
                        )}
                        {laudo.equipe_nome && (
                          <p><span className="font-medium">Equipe:</span> {laudo.equipe_nome}</p>
                        )}
                        {laudo.numero_laudo && (
                          <p><span className="font-medium">Nº Laudo:</span> {laudo.numero_laudo}</p>
                        )}
                        <p>
                          <span className="font-medium">Vencimento:</span>{' '}
                          {new Date(laudo.validade_laudo).toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {getStatusBadge(laudo)}
                    {(laudo.tipo === 'funcionario' || laudo.tipo === 'equipe') && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleVerDetalhes(laudo)}
                      >
                        Ver Detalhes
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

