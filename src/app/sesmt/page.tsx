'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  AlertTriangle,
  FileText,
  UserCheck,
  Car,
  TrendingUp,
  Shield,
  Activity,
  Download,
  CheckCircle,
  Clock
} from 'lucide-react'
import Link from 'next/link'
// import { useAuth } from '@/contexts/AuthContext' // Unused
import { reportService } from '@/services/reportService'
import { documentService } from '@/services/documentService' // Removed unused DocumentInfo

interface LaudoInfo {
  id: string
  tipo_documento: string
  veiculo_placa: string
  expira_em: string
  status: 'vigente' | 'vencendo' | 'vencido'
  dias_restantes: number
}

interface OperadorHAR {
  id: string
  nome: string
  equipe: string
  har_numero: string
  har_vencimento: string
  dias_restantes: number
  status: 'vigente' | 'vencendo' | 'vencido'
  arquivo_url?: string
}

interface OperadorCNH {
  id: string
  nome: string
  equipe: string
  cnh_numero: string
  cnh_vencimento: string
  dias_restantes: number
  status: 'vigente' | 'vencendo' | 'vencido'
  arquivo_url?: string
}

interface SESMTStats {
  total_laudos: number
  laudos_vencendo: number
  laudos_vencidos: number
  total_operadores_har: number
  operadores_har_vencendo: number
  operadores_har_vencidos: number
  total_operadores_cnh: number
  operadores_cnh_vencendo: number
  operadores_cnh_vencidos: number
}

export default function SESMTPage() {
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<SESMTStats>({
    total_laudos: 0,
    laudos_vencendo: 0,
    laudos_vencidos: 0,
    total_operadores_har: 0,
    operadores_har_vencendo: 0,
    operadores_har_vencidos: 0,
    total_operadores_cnh: 0,
    operadores_cnh_vencendo: 0,
    operadores_cnh_vencidos: 0
  })
  const [laudos, setLaudos] = useState<LaudoInfo[]>([])
  const [operadoresHAR, setOperadoresHAR] = useState<OperadorHAR[]>([])
  const [operadoresCNH, setOperadoresCNH] = useState<OperadorCNH[]>([])

  useEffect(() => {
    loadSESMTData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadSESMTData = async () => {
    try {
      setLoading(true)

      // Carregar laudos
      const [expiringReports, expiredReports] = await Promise.all([
        reportService.getExpiringDocuments(),
        reportService.getExpiredDocuments()
      ])

      // Processar laudos
      const laudosProcessados = [
        ...expiringReports.map(report => ({
          id: report.id,
          tipo_documento: report.tipo_documento,
          veiculo_placa: report.veiculo?.placa || 'N/A',
          expira_em: report.expira_em || '',
          status: 'vencendo' as const,
          dias_restantes: getDaysUntilExpiration(report.expira_em || '')
        })),
        ...expiredReports.map(report => ({
          id: report.id,
          tipo_documento: report.tipo_documento,
          veiculo_placa: report.veiculo?.placa || 'N/A',
          expira_em: report.expira_em || '',
          status: 'vencido' as const,
          dias_restantes: 0
        }))
      ]

      setLaudos(laudosProcessados)

      // Carregar operadores com HAR
      const operadoresHARData = await loadOperadoresHAR()
      setOperadoresHAR(operadoresHARData)

      // Carregar operadores com CNH
      const operadoresCNHData = await loadOperadoresCNH()
      setOperadoresCNH(operadoresCNHData)

      // Calcular estatísticas
      const statsCalculadas = {
        total_laudos: laudosProcessados.length,
        laudos_vencendo: laudosProcessados.filter(l => l.status === 'vencendo').length,
        laudos_vencidos: laudosProcessados.filter(l => l.status === 'vencido').length,
        total_operadores_har: operadoresHARData.length,
        operadores_har_vencendo: operadoresHARData.filter(o => o.status === 'vencendo').length,
        operadores_har_vencidos: operadoresHARData.filter(o => o.status === 'vencido').length,
        total_operadores_cnh: operadoresCNHData.length,
        operadores_cnh_vencendo: operadoresCNHData.filter(o => o.status === 'vencendo').length,
        operadores_cnh_vencidos: operadoresCNHData.filter(o => o.status === 'vencido').length
      }

      setStats(statsCalculadas)

    } catch (error) {
      console.error('Erro ao carregar dados do SESMT:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadOperadoresHAR = async (): Promise<OperadorHAR[]> => {
    try {
      // Buscar documentos HAR reais
      const allDocuments = await documentService.getAllDocuments()
      const harDocuments = allDocuments.filter(doc => doc.tipo === 'har')

      return harDocuments.map(doc => ({
        id: doc.id,
        nome: doc.usuarios?.nome || 'N/A',
        equipe: 'N/A', // TODO: Implement proper user team relationship
        har_numero: doc.numero,
        har_vencimento: doc.vencimento,
        dias_restantes: getDaysUntilExpiration(doc.vencimento),
        status: doc.status,
        arquivo_url: doc.arquivo_url
      }))
    } catch (error) {
      console.error('Erro ao carregar operadores HAR:', error)
      return []
    }
  }

  const loadOperadoresCNH = async (): Promise<OperadorCNH[]> => {
    try {
      // Buscar documentos CNH reais
      const allDocuments = await documentService.getAllDocuments()
      const cnhDocuments = allDocuments.filter(doc => doc.tipo === 'cnh')

      return cnhDocuments.map(doc => ({
        id: doc.id,
        nome: doc.usuarios?.nome || 'N/A',
        equipe: 'N/A', // TODO: Implement proper user team relationship
        cnh_numero: doc.numero,
        cnh_vencimento: doc.vencimento,
        dias_restantes: getDaysUntilExpiration(doc.vencimento),
        status: doc.status,
        arquivo_url: doc.arquivo_url
      }))
    } catch (error) {
      console.error('Erro ao carregar operadores CNH:', error)
      return []
    }
  }

  const getDaysUntilExpiration = (expiresAt: string): number => {
    if (!expiresAt) return 0
    const now = new Date()
    const exp = new Date(expiresAt)
    return Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  }

  // const getStatusFromDays = (days: number): 'vigente' | 'vencendo' | 'vencido' => { // TODO: Use for status calculation
  //   if (days < 0) return 'vencido'
  //   if (days <= 30) return 'vencendo'
  //   return 'vigente'
  // }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'vigente':
        return 'bg-green-100 text-green-800'
      case 'vencendo':
        return 'bg-yellow-100 text-yellow-800'
      case 'vencido':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'vigente':
        return <Shield className="h-4 w-4 text-green-600" />
      case 'vencendo':
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />
      case 'vencido':
        return <AlertTriangle className="h-4 w-4 text-red-600" />
      default:
        return <Activity className="h-4 w-4 text-gray-600" />
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Carregando dados do SESMT...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">SESMT</h1>
        <p className="text-gray-600">
          Serviços Especializados em Engenharia de Segurança e em Medicina do Trabalho
        </p>
      </div>

      {/* Cards de Ação Rápida */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        <Link href="/sesmt/aprovacao">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer border-l-4 border-l-blue-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Aprovação de Solicitações</CardTitle>
              <CheckCircle className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">SESMT</div>
              <p className="text-xs text-muted-foreground">
                Aprove solicitações de EPI e materiais de segurança
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/sesmt/inventarios">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer border-l-4 border-l-purple-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Inventários</CardTitle>
              <FileText className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">EPIs</div>
              <p className="text-xs text-muted-foreground">
                Visualize inventários e gere fichas de EPI
              </p>
            </CardContent>
          </Card>
        </Link>

        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Documentos Vigentes</CardTitle>
            <Shield className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {stats.total_laudos - stats.laudos_vencendo - stats.laudos_vencidos}
            </div>
            <p className="text-xs text-muted-foreground">
              Laudos em dia
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-yellow-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Alertas de Vencimento</CardTitle>
            <Clock className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {stats.laudos_vencendo + stats.operadores_har_vencendo + stats.operadores_cnh_vencendo}
            </div>
            <p className="text-xs text-muted-foreground">
              Documentos vencendo
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Cards de Estatísticas Detalhadas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Laudos</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total_laudos}</div>
            <p className="text-xs text-muted-foreground">
              {stats.laudos_vencendo} vencendo, {stats.laudos_vencidos} vencidos
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">HAR Operação</CardTitle>
            <UserCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total_operadores_har}</div>
            <p className="text-xs text-muted-foreground">
              {stats.operadores_har_vencendo} vencendo, {stats.operadores_har_vencidos} vencidos
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">CNH Operação</CardTitle>
            <Car className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total_operadores_cnh}</div>
            <p className="text-xs text-muted-foreground">
              {stats.operadores_cnh_vencendo} vencendo, {stats.operadores_cnh_vencidos} vencidos
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Alertas Críticos</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {stats.laudos_vencidos + stats.operadores_har_vencidos + stats.operadores_cnh_vencidos}
            </div>
            <p className="text-xs text-muted-foreground">
              Documentos vencidos
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs de Conteúdo */}
      <Tabs defaultValue="laudos" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="laudos">Laudos</TabsTrigger>
          <TabsTrigger value="har">HAR Operação</TabsTrigger>
          <TabsTrigger value="cnh">CNH Operação</TabsTrigger>
        </TabsList>

        {/* Tab Laudos */}
        <TabsContent value="laudos" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Laudos de Veículos
              </CardTitle>
              <CardDescription>
                Documentos com vencimento próximo ou vencidos
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {laudos.map((laudo) => (
                  <div key={laudo.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      {getStatusIcon(laudo.status)}
                      <div>
                        <p className="font-medium">{laudo.tipo_documento}</p>
                        <p className="text-sm text-gray-600">Veículo: {laudo.veiculo_placa}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge className={getStatusColor(laudo.status)}>
                        {laudo.status === 'vencendo' ? `${laudo.dias_restantes} dias` : laudo.status}
                      </Badge>
                      <p className="text-sm text-gray-600">
                        Vence: {new Date(laudo.expira_em).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                  </div>
                ))}
                {laudos.length === 0 && (
                  <p className="text-center text-gray-500 py-8">
                    Nenhum laudo com vencimento próximo ou vencido encontrado.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab Operadores HAR */}
        <TabsContent value="har" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserCheck className="h-5 w-5" />
                HAR Operação
              </CardTitle>
              <CardDescription>
                Habilitações para Operação de Equipamentos vencendo ou vencidas
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {operadoresHAR.map((operador) => (
                  <div key={operador.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      {getStatusIcon(operador.status)}
                      <div>
                        <p className="font-medium">{operador.nome}</p>
                        <p className="text-sm text-gray-600">Equipe: {operador.equipe}</p>
                        <p className="text-sm text-gray-600">HAR: {operador.har_numero}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge className={getStatusColor(operador.status)}>
                        {operador.status === 'vencendo' ? `${operador.dias_restantes} dias` : operador.status}
                      </Badge>
                      <p className="text-sm text-gray-600">
                        Vence: {new Date(operador.har_vencimento).toLocaleDateString('pt-BR')}
                      </p>
                      {operador.arquivo_url && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(operador.arquivo_url, '_blank')}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
                {operadoresHAR.length === 0 && (
                  <p className="text-center text-gray-500 py-8">
                    Nenhum operador com HAR vencendo ou vencido encontrado.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab Operadores CNH */}
        <TabsContent value="cnh" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Car className="h-5 w-5" />
                CNH Operação
              </CardTitle>
              <CardDescription>
                Carteiras Nacionais de Habilitação vencendo ou vencidas
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {operadoresCNH.map((operador) => (
                  <div key={operador.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      {getStatusIcon(operador.status)}
                      <div>
                        <p className="font-medium">{operador.nome}</p>
                        <p className="text-sm text-gray-600">Equipe: {operador.equipe}</p>
                        <p className="text-sm text-gray-600">CNH: {operador.cnh_numero}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge className={getStatusColor(operador.status)}>
                        {operador.status === 'vencendo' ? `${operador.dias_restantes} dias` : operador.status}
                      </Badge>
                      <p className="text-sm text-gray-600">
                        Vence: {new Date(operador.cnh_vencimento).toLocaleDateString('pt-BR')}
                      </p>
                      {operador.arquivo_url && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(operador.arquivo_url, '_blank')}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
                {operadoresCNH.length === 0 && (
                  <p className="text-center text-gray-500 py-8">
                    Nenhum operador com CNH vencendo ou vencida encontrado.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Botão de Atualizar */}
      <div className="mt-8 text-center">
        <Button onClick={loadSESMTData} className="px-6">
          <TrendingUp className="h-4 w-4 mr-2" />
          Atualizar Dados
        </Button>
      </div>
    </div>
  )
}
