'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { useModularPermissions, PERMISSION_CODES } from '@/hooks/useModularPermissions'
import { useQuery } from '@tanstack/react-query'
import { estoqueService } from '@/services/estoqueService'
import { NotaFiscal } from '@/types'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { 
  FileText, 
  Search, 
  Eye, 
  Download, 
  Calendar, 
  Building2, 
  User, 
  DollarSign,
  Package,
  Loader2,
  RefreshCw
} from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export default function NotasFiscaisPage() {
  const router = useRouter()
  const { user } = useAuth()
  
  // Tratamento seguro do useModularPermissions
  let hasPermission: (permission: string) => boolean
  let loadingPermissions: boolean
  let permissionsLoaded: boolean
  try {
    const permissions = useModularPermissions()
    hasPermission = permissions.hasPermission
    loadingPermissions = permissions.loading
    permissionsLoaded = permissions.permissionsLoaded
  } catch (error) {
    console.error('Erro ao carregar permissões modulares:', error)
    hasPermission = () => false
    loadingPermissions = true
    permissionsLoaded = false
  }

  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('todos')

  // Aguardar carregamento das permissões antes de verificar
  const hasPermissionToView = user && permissionsLoaded && hasPermission(PERMISSION_CODES.ALMOXARIFADO.VISUALIZAR_NF_WEB)

  // React Query para notas fiscais
  const { data: notasFiscais = [], isLoading: loading } = useQuery({
    queryKey: ['notas-fiscais'],
    queryFn: async () => {
      console.log('🔄 Carregando notas fiscais...')
      
      const data = await estoqueService.getNotasFiscais()
      console.log('📊 Dados recebidos:', data)
      console.log('📊 Tipo dos dados:', typeof data)
      console.log('📊 É array?', Array.isArray(data))
      
      // Verificar se os dados são válidos
      if (!data) {
        console.log('⚠️ Dados são null/undefined')
        return []
      }
      
      if (!Array.isArray(data)) {
        console.log('⚠️ Dados não são um array:', data)
        return []
      }
      
      console.log('✅ Dados válidos, retornando...')
      return data
    },
    staleTime: 2 * 60 * 1000, // 2 minutos
    gcTime: 5 * 60 * 1000, // 5 minutos
    enabled: !!hasPermissionToView,
  })

  // Mostrar loading enquanto permissões estão carregando
  if (loadingPermissions || !permissionsLoaded) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
            <p className="text-gray-600">Carregando permissões...</p>
          </div>
        </div>
      </div>
    )
  }

  // Verificar permissão após carregamento
  if (!hasPermissionToView) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Acesso Negado</h1>
          <p className="text-gray-600">Você não tem permissão para visualizar notas fiscais.</p>
        </div>
      </div>
    )
  }

  const filteredNFs = notasFiscais.filter(nf => {
    const matchesSearch = 
      nf.numero.toLowerCase().includes(searchTerm.toLowerCase()) ||
      nf.fornecedor.toLowerCase().includes(searchTerm.toLowerCase()) ||
      nf.serie?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      nf.numero_pedido?.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesStatus = statusFilter === 'todos' || nf.status === statusFilter
    
    return matchesSearch && matchesStatus
  })

  const getStatusBadge = (status: NotaFiscal['status']) => {
    const statusConfig = {
      pendente: { label: 'Pendente', variant: 'secondary' as const },
      recebida: { label: 'Recebida', variant: 'default' as const },
      conferida: { label: 'Conferida', variant: 'default' as const },
      lancada: { label: 'Lançada', variant: 'default' as const },
      cancelada: { label: 'Cancelada', variant: 'destructive' as const }
    }
    
    const config = statusConfig[status]
    return <Badge variant={config.variant}>{config.label}</Badge>
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value)
  }

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), 'dd/MM/yyyy', { locale: ptBR })
  }

  const handleViewDetails = (nf: NotaFiscal) => {
    router.push(`/almoxarifado/notas-fiscais/${nf.id}`)
  }

  const handleDownloadFile = (url: string, fileName: string) => {
    const link = document.createElement('a')
    link.href = url
    link.download = fileName
    link.target = '_blank'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-blue-100 rounded-lg">
            <FileText className="h-8 w-8 text-blue-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Notas Fiscais</h1>
            <p className="text-gray-600">Visualize e gerencie todas as notas fiscais</p>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Buscar por número, série, pedido ou fornecedor..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="sm:w-48">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filtrar por status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os status</SelectItem>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="recebida">Recebida</SelectItem>
                  <SelectItem value="conferida">Conferida</SelectItem>
                  <SelectItem value="lancada">Lançada</SelectItem>
                  <SelectItem value="cancelada">Cancelada</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={() => window.location.reload()} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Atualizar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Notas Fiscais */}
      {loading ? (
        <div className="flex justify-center items-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      ) : filteredNFs.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhuma nota fiscal encontrada</h3>
            <p className="text-gray-600">
              {searchTerm || statusFilter !== 'todos' 
                ? 'Tente ajustar os filtros de busca.' 
                : 'Cadastre a primeira nota fiscal para começar.'
              }
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredNFs.map((nf) => (
            <Card key={nf.id} className="hover:shadow-md transition-shadow">
              <CardContent className="pt-6">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900">
                        NF {nf.numero}
                        {nf.serie && <span className="text-gray-500"> - Série {nf.serie}</span>}
                        {nf.numero_pedido && <span className="text-blue-600 text-sm font-medium"> - Pedido: {nf.numero_pedido}</span>}
                      </h3>
                      {getStatusBadge(nf.status)}
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm text-gray-600">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4" />
                        <span>{nf.fornecedor}</span>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        <span>Emissão: {formatDate(nf.data_emissao)}</span>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4" />
                        <span>
                          {(nf.usuario_recebimento as { nome?: string })?.nome || 'Usuário não encontrado'}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4" />
                        <span className="font-medium">{formatCurrency(nf.valor_total)}</span>
                      </div>
                    </div>

                    {nf.itens && nf.itens.length > 0 && (
                      <div className="mt-3 flex items-center gap-2 text-sm text-gray-600">
                        <Package className="h-4 w-4" />
                        <span>{nf.itens.length} item(ns)</span>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleViewDetails(nf)}
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      Ver Detalhes
                    </Button>
                    
                    {nf.arquivo_url && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownloadFile(nf.arquivo_url!, `NF_${nf.numero}.pdf`)}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Baixar
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
