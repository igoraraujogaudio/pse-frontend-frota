'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
// import { Badge } from '@/components/ui/badge' // TODO: Use for status indicators
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { 
  Package, 
  Users, 
  Building2,
  FileText, 
  AlertTriangle, 
  Settings,
  Globe,
  RotateCcw,
  ArrowLeftRight,
  TruckIcon,
  Truck,
  HardHat,
} from 'lucide-react'
import { baseService } from '@/services/baseService'
import { PERMISSION_CODES, useModularPermissions } from '@/hooks/useModularPermissions'
import { useUnifiedPermissions } from '@/hooks/useUnifiedPermissions'
import ProtectedRoute from '@/components/ProtectedRoute'
// import { useAuth } from '@/contexts/AuthContext' // TODO: Use when needed

interface DashboardStats {
  totalItens: number
  itensEmprestados: number
  itensEmManutencao: number
  laudosVencendo: number
  laudosVencidos: number
  equipesAtivas: number
  funcionariosAtivos: number
}

export default function AlmoxarifadoDashboardSimples() {
  return (
    <ProtectedRoute requiredPermissions={[
      PERMISSION_CODES.ALMOXARIFADO.DASHBOARD_COMPLETO,
      PERMISSION_CODES.ALMOXARIFADO.VISUALIZAR_ESTOQUE,
      PERMISSION_CODES.ALMOXARIFADO.GERENCIAR_ESTOQUE,
      PERMISSION_CODES.ALMOXARIFADO.RELATORIOS_AVANCADOS,
      PERMISSION_CODES.ALMOXARIFADO.CONFIGURAR_CATEGORIAS,
      PERMISSION_CODES.ALMOXARIFADO.GERENCIAR_FORNECEDORES,
      PERMISSION_CODES.ALMOXARIFADO.CONTROLE_ENTRADA_SAIDA,
      PERMISSION_CODES.ALMOXARIFADO.ALERTAS_ESTOQUE,
      PERMISSION_CODES.ALMOXARIFADO.HISTORICO_MOVIMENTACOES,
      PERMISSION_CODES.ALMOXARIFADO.INVENTARIO_FISICO,
      PERMISSION_CODES.ALMOXARIFADO.CONTROLE_QUALIDADE,
      PERMISSION_CODES.ALMOXARIFADO.INTEGRACAO_SISTEMAS,
      PERMISSION_CODES.ALMOXARIFADO.BACKUP_DADOS,
      PERMISSION_CODES.ALMOXARIFADO.AUDITORIA_LOG,
      PERMISSION_CODES.ALMOXARIFADO.CONFIGURACOES_SISTEMA,
      PERMISSION_CODES.ALMOXARIFADO.GERENCIAR_USUARIOS,
      PERMISSION_CODES.ALMOXARIFADO.PERMISSOES_ACESSO,
      PERMISSION_CODES.ALMOXARIFADO.RELATORIO_PERFORMANCE,
      PERMISSION_CODES.ALMOXARIFADO.ANALISE_TENDENCIAS,
      PERMISSION_CODES.ALMOXARIFADO.PREVISAO_DEMANDA,
      PERMISSION_CODES.ALMOXARIFADO.OTIMIZACAO_ESTOQUE,
      PERMISSION_CODES.ALMOXARIFADO.CONTROLE_CUSTOS,
      PERMISSION_CODES.ALMOXARIFADO.GESTAO_CONTRATOS,
      PERMISSION_CODES.ALMOXARIFADO.CONTROLE_QUALIDADE_AVANCADO,
      PERMISSION_CODES.ALMOXARIFADO.RASTREAMENTO_LOTE,
      PERMISSION_CODES.ALMOXARIFADO.CONTROLE_TEMPERATURA,
      PERMISSION_CODES.ALMOXARIFADO.ALERTAS_VENCIMENTO,
      PERMISSION_CODES.ALMOXARIFADO.CONTROLE_ACESSO_FISICO,
      PERMISSION_CODES.ALMOXARIFADO.INTEGRACAO_RFID,
      PERMISSION_CODES.ALMOXARIFADO.AUTOMACAO_PROCESSOS,
      PERMISSION_CODES.ALMOXARIFADO.DASHBOARD,
      PERMISSION_CODES.ALMOXARIFADO.VISUALIZAR_ESTOQUE_MOBILE,
      PERMISSION_CODES.ALMOXARIFADO.SOLICITAR_ITEM,
      PERMISSION_CODES.ALMOXARIFADO.APROVAR_SOLICITACAO,
      PERMISSION_CODES.ALMOXARIFADO.CONTROLE_ENTREGA,
      PERMISSION_CODES.ALMOXARIFADO.SCANNER_CODIGO_BARRAS,
      PERMISSION_CODES.ALMOXARIFADO.NOTIFICACOES_PUSH,
      PERMISSION_CODES.ALMOXARIFADO.OFFLINE_SYNC,
      PERMISSION_CODES.ALMOXARIFADO.RELATORIO_MOBILE,
      PERMISSION_CODES.ALMOXARIFADO.CONTROLE_LOCALIZACAO
    ]}>
      <AlmoxarifadoContent />
    </ProtectedRoute>
  );
}

function AlmoxarifadoContent() {
  const { hasPermission } = useModularPermissions();
  const { hasBaseAccess } = useUnifiedPermissions();
  
  // Permission variables - usando sistema modular
  const canViewDashboard = hasPermission(PERMISSION_CODES.ALMOXARIFADO.DASHBOARD);
  const canViewStock = hasPermission(PERMISSION_CODES.ALMOXARIFADO.VISUALIZAR_ESTOQUE);
  const canManageStock = hasPermission(PERMISSION_CODES.ALMOXARIFADO.GERENCIAR_ESTOQUE);
  const canViewReports = hasPermission(PERMISSION_CODES.ALMOXARIFADO.RELATORIOS_AVANCADOS);
  const canViewAlerts = hasPermission(PERMISSION_CODES.ALMOXARIFADO.ALERTAS_ESTOQUE);
  const canViewHistory = hasPermission(PERMISSION_CODES.ALMOXARIFADO.HISTORICO_MOVIMENTACOES);
  
  const [baseSelecionada, setBaseSelecionada] = useState<string>('todos')

  // React Query para bases
  const { data: allBases = [] } = useQuery({
    queryKey: ['bases-dashboard'],
    queryFn: () => baseService.getBasesAtivas(),
    staleTime: 5 * 60 * 1000, // 5 minutos
    gcTime: 10 * 60 * 1000, // 10 minutos
  })

  // Filtrar bases baseado nas permissões do usuário
  const bases = allBases.filter(base => hasBaseAccess(base.id))

  // React Query para estatísticas do dashboard
  const { data: stats = {
    totalItens: 150,
    itensEmprestados: 45,
    itensEmManutencao: 8,
    laudosVencendo: 12,
    laudosVencidos: 3,
    equipesAtivas: 8,
    funcionariosAtivos: 25
  }, isLoading: loading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      // Por enquanto retorna dados mockados
      // TODO: Implementar serviço real de estatísticas
      return {
        totalItens: 150,
        itensEmprestados: 45,
        itensEmManutencao: 8,
        laudosVencendo: 12,
        laudosVencidos: 3,
        equipesAtivas: 8,
        funcionariosAtivos: 25
      } as DashboardStats
    },
    staleTime: 2 * 60 * 1000, // 2 minutos
    gcTime: 5 * 60 * 1000, // 5 minutos
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  // Verificar se o usuário tem acesso a alguma base
  if (bases.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Almoxarifado</h1>
            <p className="text-gray-600">Dashboard do sistema de almoxarifado</p>
          </div>
        </div>
        
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <div className="flex items-center">
            <AlertTriangle className="h-8 w-8 text-yellow-600 mr-4" />
            <div>
              <h3 className="text-lg font-medium text-yellow-800">Acesso Restrito</h3>
              <p className="text-yellow-700 mt-1">
                Você não tem acesso a nenhuma base do almoxarifado. 
                Entre em contato com o administrador para solicitar permissões.
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Almoxarifado</h1>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-muted-foreground">Sistema Modular de Almoxarifado</p>
            <div className="flex items-center gap-1">
              {canViewDashboard && (
                <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                  Dashboard
                </span>
              )}
              {canViewStock && (
                <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">
                  Estoque
                </span>
              )}
              {canManageStock && (
                <span className="px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 rounded-full">
                  Gerenciar
                </span>
              )}
              {canViewReports && (
                <span className="px-2 py-1 text-xs font-medium bg-purple-100 text-purple-800 rounded-full">
                  Relatórios
                </span>
              )}
              {canViewAlerts && (
                <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-800 rounded-full">
                  Alertas
                </span>
              )}
              {canViewHistory && (
                <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded-full">
                  Histórico
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button asChild>
            <Link href="/almoxarifado/por-base">
              <Building2 className="w-4 h-4 mr-2" />
              Por Base
            </Link>
          </Button>
          {canViewStock && (
            <Button asChild>
              <Link href="/almoxarifado/estoque">
                <Package className="w-4 h-4 mr-2" />
                Estoque
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="w-5 h-5" />
            Filtros de Localização
          </CardTitle>
          <CardDescription>
            Filtre o dashboard por base específica
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Base</label>
              <Select value={baseSelecionada} onValueChange={setBaseSelecionada}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma base" />
                </SelectTrigger>
                <SelectContent>
                  {bases.length > 1 && (
                    <SelectItem value="todos">
                      Todas as Bases ({bases.length})
                    </SelectItem>
                  )}
                  {bases.map(base => (
                    <SelectItem key={base.id} value={base.id}>
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4" />
                        {base.nome} ({base.codigo})
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cards de Estatísticas */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Itens</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalItens}</div>
            <p className="text-xs text-muted-foreground">
              No sistema
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Itens Emprestados</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.itensEmprestados}</div>
            <p className="text-xs text-muted-foreground">
              Em uso por funcionários
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Em Manutenção</CardTitle>
            <Settings className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.itensEmManutencao}</div>
            <p className="text-xs text-muted-foreground">
              Itens sendo reparados
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Laudos Vencendo</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.laudosVencendo}</div>
            <p className="text-xs text-muted-foreground">
              Próximos 30 dias
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Ações Rápidas */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="w-5 h-5" />
              Gestão de Estoque
            </CardTitle>
            <CardDescription>
              Gerencie itens por base
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button asChild className="w-full">
              <Link href="/almoxarifado/estoque">
                Ver Estoque
              </Link>
            </Button>
            <Button asChild variant="outline" className="w-full">
              <Link href="/almoxarifado/por-base">
                Por Base
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Solicitações
            </CardTitle>
            <CardDescription>
              Gerencie solicitações de itens
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button asChild className="w-full">
              <Link href="/almoxarifado/solicitacoes">
                Ver Solicitações
              </Link>
            </Button>
            <Button asChild variant="outline" className="w-full">
              <Link href="/almoxarifado/solicitacoes?status=pendente">
                Pendentes
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Entrada de Material
            </CardTitle>
            <CardDescription>
              Processar entrada de materiais no estoque
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button asChild className="w-full">
              <Link href="/almoxarifado/cadastro-nf">
                Nova Entrada
              </Link>
            </Button>
            <Button asChild variant="outline" className="w-full">
              <Link href="/almoxarifado/notas-fiscais">
                Ver Entradas
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RotateCcw className="w-5 h-5" />
              Devoluções
            </CardTitle>
            <CardDescription>
              Processar devoluções e trocas de EPIs
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button asChild className="w-full">
              <Link href="/almoxarifado/devolucoes">
                Processar Devoluções
              </Link>
            </Button>
            <Button asChild variant="outline" className="w-full">
              <Link href="/almoxarifado/historico-funcionarios">
                Ver Histórico
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ArrowLeftRight className="w-5 h-5" />
              Transferências Entre Bases
            </CardTitle>
            <CardDescription>
              Transfira itens entre suas bases
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button asChild className="w-full">
              <Link href="/almoxarifado/transferencias">
                Gerenciar Transferências
              </Link>
            </Button>
            <Button asChild variant="outline" className="w-full">
              <Link href="/almoxarifado/transferencias?tab=logs">
                Ver Histórico
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Truck className="w-5 h-5" />
              Entregas de Obra
            </CardTitle>
            <CardDescription>
              Entrega de materiais para equipes de obra (fluxo definido)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button asChild className="w-full">
              <Link href="/almoxarifado/entregas-obra">
                Ver Entregas Pendentes
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HardHat className="w-5 h-5" />
              Devoluções de Obra
            </CardTitle>
            <CardDescription>
              Registrar devoluções de materiais de obras
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button asChild className="w-full">
              <Link href="/almoxarifado/devolucoes-obra">
                Gerenciar Devoluções
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TruckIcon className="w-5 h-5" />
              Empréstimos para Terceiros
            </CardTitle>
            <CardDescription>
              Empréstimos para empresas externas
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button asChild className="w-full">
              <Link href="/almoxarifado/emprestimos-terceiros">
                Gerenciar Empréstimos
              </Link>
            </Button>
            <Button asChild variant="outline" className="w-full">
              <Link href="/almoxarifado/emprestimos-terceiros?tab=empresas">
                Empresas Cadastradas
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5" />
              Bases
            </CardTitle>
            <CardDescription>
              {bases.length} bases ativas
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {bases.slice(0, 3).map(base => (
                <div key={base.id} className="flex items-center gap-2 text-sm">
                  <Building2 className="h-3 w-3" />
                  {base.nome}
                </div>
              ))}
              {bases.length > 3 && (
                <div className="text-sm text-muted-foreground">
                  +{bases.length - 3} mais...
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
