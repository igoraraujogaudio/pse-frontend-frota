'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { useNotification } from '@/contexts/NotificationContext'
import { userService } from '@/services/userService'
import { estoqueService } from '@/services/estoqueService'
import { User, HistoricoFuncionario, MovimentacaoEstoque } from '@/types'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  ArrowLeft, 
  User as UserIcon, 
  Package, 
  Calendar, 
  Clock, 
  FileText, 
  AlertTriangle,
  MapPin,
  Building,
  Briefcase,
  Hash,
  TrendingUp,
  ArrowLeft as ArrowLeftIcon,
  RefreshCw,
  BarChart3
} from 'lucide-react'

export default function HistoricoFuncionarioDetailPage() {
  const router = useRouter()
  const params = useParams()
  const { user } = useAuth()
  const { notify } = useNotification()

  const [funcionario, setFuncionario] = useState<User | null>(null)
  const [historico, setHistorico] = useState<HistoricoFuncionario[]>([])
  const [movimentacoes, setMovimentacoes] = useState<MovimentacaoEstoque[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('historico')

  const funcionarioId = params.id as string

  const loadFuncionarioData = useCallback(async () => {
    try {
      setLoading(true)
      
      // Carregar dados do funcionário
      const func = await userService.getById(funcionarioId)
      setFuncionario(func)

      // Carregar histórico de entregas
      const hist = await estoqueService.getHistoricoFuncionario(funcionarioId)
      setHistorico(hist)

      // Carregar movimentações de estoque
      const mov = await estoqueService.getMovimentacoesPorFuncionario(funcionarioId)
      setMovimentacoes(mov)
    } catch (error) {
      console.error('Erro ao carregar dados do funcionário:', error)
      notify('Erro ao carregar dados do funcionário', 'error')
    } finally {
      setLoading(false)
    }
  }, [funcionarioId, notify])

  // Verificar permissões
  useEffect(() => {
    if (user && !['almoxarifado', 'gestor_almoxarifado', 'admin', 'supervisor'].includes(user.nivel_acesso)) {
      notify('Acesso negado. Apenas funcionários do almoxarifado e supervisores podem acessar esta funcionalidade.', 'error')
      router.push('/dashboard')
      return
    }
    loadFuncionarioData()
  }, [user, router, funcionarioId, loadFuncionarioData, notify])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'entregue': return 'bg-green-100 text-green-800'
      case 'devolvido': return 'bg-blue-100 text-blue-800'
      case 'pendente': return 'bg-yellow-100 text-yellow-800'
      case 'rejeitado': return 'bg-red-100 text-red-800'
      case 'em_uso': return 'bg-purple-100 text-purple-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getTipoMovimentacaoColor = (tipo: string) => {
    switch (tipo) {
      case 'entrada': return 'bg-green-100 text-green-800'
      case 'saida': return 'bg-red-100 text-red-800'
      case 'transferencia': return 'bg-blue-100 text-blue-800'
      case 'ajuste': return 'bg-purple-100 text-purple-800'
      case 'devolucao': return 'bg-orange-100 text-orange-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }



  const getFuncaoDisplay = (funcionario: User) => {
    // Priorizar cargo/posição se disponível, caso contrário usar o nível de acesso
    if (funcionario.cargo) return funcionario.cargo
    if (funcionario.posicao) return funcionario.posicao
    
    switch (funcionario.nivel_acesso) {
      case 'admin': return 'Administrador'
      case 'gestor_almoxarifado': return 'Gestor de Almoxarifado'
      case 'almoxarifado': return 'Funcionário de Almoxarifado'
      case 'supervisor': return 'Supervisor'
      case 'funcionario': return 'Funcionário'
      default: return funcionario.nivel_acesso
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }



  // Calcular estatísticas mais detalhadas
  const estatisticas = {
    total_entregas: historico.length,
    entregas_ativas: historico.filter(h => h.status === 'em_uso').length,
    devolucoes: historico.filter(h => h.status === 'devolvido').length,
    total_movimentacoes: movimentacoes.length,
    entradas: movimentacoes.filter(m => m.tipo === 'entrada').length,
    saidas: movimentacoes.filter(m => m.tipo === 'saida').length,
    transferencias: movimentacoes.filter(m => m.tipo === 'transferencia').length,
    ajustes: movimentacoes.filter(m => m.tipo === 'ajuste').length,
    devolucoes_mov: movimentacoes.filter(m => m.tipo === 'devolucao').length
  }

  if (!user || !['almoxarifado', 'gestor_almoxarifado', 'admin', 'supervisor'].includes(user.nivel_acesso)) {
    return null
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Carregando dados do funcionário...</p>
        </div>
      </div>
    )
  }

  if (!funcionario) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="text-center py-12">
          <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-red-500" />
          <p className="text-gray-600">Funcionário não encontrado</p>
          <Button onClick={() => router.back()} className="mt-4">
            Voltar
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <Button
          variant="outline"
          onClick={() => router.back()}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>
        
        <div className="flex items-center gap-3 mb-2">
          <UserIcon className="h-8 w-8 text-blue-600" />
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{funcionario.nome}</h1>
            <p className="text-gray-600">Histórico completo de entregas e movimentações de estoque</p>
          </div>
        </div>
      </div>

      {/* Informações do Funcionário */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserIcon className="h-5 w-5" />
            Informações do Funcionário
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                  <Hash className="h-4 w-4" />
                  Matrícula
                </label>
                <p className="text-gray-900 font-medium">{funcionario.matricula || 'Não informada'}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                  <Building className="h-4 w-4" />
                  Departamento
                </label>
                <p className="text-gray-900 font-medium">{funcionario.departamento || 'Não informado'}</p>
              </div>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Operação
                </label>
                <p className="text-gray-900 font-medium">{funcionario.operacao || 'Não informada'}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                  <Briefcase className="h-4 w-4" />
                  Função
                </label>
                <Badge className="mt-1 bg-blue-100 text-blue-800">
                  {getFuncaoDisplay(funcionario)}
                </Badge>
              </div>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <Badge variant={
                  funcionario.status === 'ativo' ? 'default' : 
                  funcionario.status === 'suspenso' ? 'secondary' : 'secondary'
                } className="mt-1">
                  {funcionario.status === 'ativo' ? 'Ativo' : 
                   funcionario.status === 'suspenso' ? 'Suspenso' : 'Inativo'}
                </Badge>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Data de Cadastro
                </label>
                <p className="text-gray-900 font-medium">
                  {funcionario.criado_em ? formatDate(funcionario.criado_em) : 'Não informada'}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Estatísticas Detalhadas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              Total de Entregas
            </CardDescription>
            <CardTitle className="text-2xl text-slate-700">{estatisticas.total_entregas}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Itens em Uso
            </CardDescription>
            <CardTitle className="text-2xl text-emerald-600">{estatisticas.entregas_ativas}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <ArrowLeftIcon className="h-4 w-4" />
              Devoluções
            </CardDescription>
            <CardTitle className="text-2xl text-blue-600">{estatisticas.devolucoes}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Movimentações
            </CardDescription>
            <CardTitle className="text-2xl text-purple-600">{estatisticas.total_movimentacoes}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Estatísticas de Movimentação */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Detalhamento de Movimentações
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{estatisticas.entradas}</div>
              <div className="text-sm text-gray-600">Entradas</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">{estatisticas.saidas}</div>
              <div className="text-sm text-gray-600">Saídas</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{estatisticas.transferencias}</div>
              <div className="text-sm text-gray-600">Transferências</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">{estatisticas.ajustes}</div>
              <div className="text-sm text-gray-600">Ajustes</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">{estatisticas.devolucoes_mov}</div>
              <div className="text-sm text-gray-600">Devoluções</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="historico">Histórico de Entregas ({historico.length})</TabsTrigger>
          <TabsTrigger value="movimentacoes">Movimentações de Estoque ({movimentacoes.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="historico" className="space-y-4">
          {historico.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <Package className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p className="text-gray-500">Nenhuma entrega registrada</p>
                <p className="text-sm text-gray-400">Este funcionário ainda não possui histórico de entregas</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {historico.map((item) => (
                <Card key={item.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-3">
                          <h3 className="font-semibold text-lg text-gray-900">{item.item?.nome || 'Item não encontrado'}</h3>
                          <Badge className={getStatusColor(item.status)}>
                            {item.status === 'em_uso' ? 'Em Uso' : 
                             item.status === 'devolvido' ? 'Devolvido' : 
                             item.status === 'perdido' ? 'Perdido' :
                             item.status === 'danificado' ? 'Danificado' :
                             item.status === 'vencido' ? 'Vencido' :
                             item.status}
                          </Badge>
                          <Badge variant="outline" className="capitalize">
                            {item.item?.categoria || 'N/A'}
                          </Badge>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm mb-4">
                          <div className="space-y-2">
                            <h4 className="font-medium text-gray-900 text-sm border-b pb-1">Informações do Item</h4>
                            <div className="flex items-center gap-2 text-gray-600">
                              <Hash className="h-4 w-4 text-blue-500" />
                              <span><strong>Código:</strong> {item.item?.codigo || 'N/A'}</span>
                            </div>
                            <div className="flex items-center gap-2 text-gray-600">
                              <Package className="h-4 w-4 text-blue-500" />
                              <span><strong>Quantidade:</strong> {item.quantidade} {item.item?.unidade_medida || 'UN'}</span>
                            </div>
                            {item.item?.descricao && (
                              <div className="text-gray-600">
                                <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Descrição:</span>
                                <p className="text-gray-700 text-sm">{item.item.descricao}</p>
                              </div>
                            )}
                            {item.item?.localizacao && (
                              <div className="flex items-center gap-2 text-gray-600">
                                <MapPin className="h-4 w-4 text-green-500" />
                                <span><strong>Localização:</strong> {item.item.localizacao}</span>
                              </div>
                            )}
                          </div>
                          
                          <div className="space-y-2">
                            <h4 className="font-medium text-gray-900 text-sm border-b pb-1">Dados da Entrega</h4>
                            <div className="flex items-center gap-2 text-gray-600">
                              <Calendar className="h-4 w-4 text-green-500" />
                              <span><strong>Data Entrega:</strong> {formatDate(item.data_entrega)}</span>
                            </div>
                            <div className="flex items-center gap-2 text-gray-600">
                              <Clock className="h-4 w-4 text-orange-500" />
                              <span><strong>Tipo:</strong> {item.tipo_movimentacao === 'entrega' ? 'Entrega' : item.tipo_movimentacao}</span>
                            </div>
                            {item.solicitante_original && (
                              <div className="flex items-center gap-2 text-gray-600">
                                <UserIcon className="h-4 w-4 text-blue-500" />
                                <span><strong>Solicitante:</strong> {item.solicitante_original.nome || 'N/A'}</span>
                              </div>
                            )}
                            <div className="flex items-center gap-2 text-gray-600">
                              <UserIcon className="h-4 w-4 text-purple-500" />
                              <span><strong>Responsável:</strong> {item.responsavel_entrega || 'N/A'}</span>
                            </div>
                            {item.condicao_entrega && (
                              <div className="text-gray-600">
                                <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Condição na Entrega:</span>
                                <Badge variant="outline" className="ml-2 capitalize">
                                  {item.condicao_entrega.replace('_', ' ')}
                                </Badge>
                              </div>
                            )}
                          </div>

                          {(item.data_devolucao || item.responsavel_devolucao || item.condicao_devolucao) && (
                            <div className="space-y-2">
                              <h4 className="font-medium text-gray-900 text-sm border-b pb-1">Dados da Devolução</h4>
                              {item.data_devolucao && (
                                <div className="flex items-center gap-2 text-gray-600">
                                  <Calendar className="h-4 w-4 text-red-500" />
                                  <span><strong>Data Devolução:</strong> {formatDate(item.data_devolucao)}</span>
                                </div>
                              )}
                              {item.responsavel_devolucao && (
                                <div className="flex items-center gap-2 text-gray-600">
                                  <UserIcon className="h-4 w-4 text-red-500" />
                                  <span><strong>Responsável:</strong> {item.responsavel_devolucao}</span>
                                </div>
                              )}
                              {item.condicao_devolucao && (
                                <div className="text-gray-600">
                                  <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Condição na Devolução:</span>
                                  <Badge variant="outline" className="ml-2 capitalize">
                                    {item.condicao_devolucao}
                                  </Badge>
                                </div>
                              )}
                            </div>
                          )}
                        </div>



                        {(item.observacoes_entrega || item.observacoes_devolucao) && (
                          <div className="space-y-2">
                            {item.observacoes_entrega && (
                              <div className="p-3 bg-green-50 rounded-md border border-green-200">
                                <div className="flex items-center gap-2 mb-1">
                                  <FileText className="h-4 w-4 text-green-600" />
                                  <span className="text-sm font-medium text-green-700">Observações da Entrega</span>
                                </div>
                                <p className="text-green-700 text-sm">{item.observacoes_entrega}</p>
                              </div>
                            )}
                            {item.observacoes_devolucao && (
                              <div className="p-3 bg-blue-50 rounded-md border border-blue-200">
                                <div className="flex items-center gap-2 mb-1">
                                  <FileText className="h-4 w-4 text-blue-600" />
                                  <span className="text-sm font-medium text-blue-700">Observações da Devolução</span>
                                </div>
                                <p className="text-blue-700 text-sm">{item.observacoes_devolucao}</p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="movimentacoes" className="space-y-4">
          {movimentacoes.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <BarChart3 className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p className="text-gray-500">Nenhuma movimentação registrada</p>
                <p className="text-sm text-gray-400">Este funcionário ainda não possui movimentações de estoque</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {movimentacoes.map((mov) => (
                <Card key={mov.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-3">
                          <h3 className="font-semibold text-lg text-gray-900">{mov.item?.nome || 'Item não encontrado'}</h3>
                          <Badge className={getTipoMovimentacaoColor(mov.tipo)}>
                            {mov.tipo === 'entrada' ? 'Entrada' : 
                             mov.tipo === 'saida' ? 'Saída' : 
                             mov.tipo === 'transferencia' ? 'Transferência' : 
                             mov.tipo === 'ajuste' ? 'Ajuste' : 
                             mov.tipo === 'devolucao' ? 'Devolução' : mov.tipo}
                          </Badge>
                          <Badge variant="outline" className="capitalize">
                            {mov.item?.categoria || 'N/A'}
                          </Badge>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm mb-4">
                          <div className="space-y-2">
                            <h4 className="font-medium text-gray-900 text-sm border-b pb-1">Informações do Item</h4>
                            <div className="flex items-center gap-2 text-gray-600">
                              <Hash className="h-4 w-4 text-blue-500" />
                              <span><strong>Código:</strong> {mov.item?.codigo || 'N/A'}</span>
                            </div>
                            <div className="flex items-center gap-2 text-gray-600">
                              <Package className="h-4 w-4 text-blue-500" />
                              <span><strong>Quantidade:</strong> {mov.quantidade} {mov.item?.unidade_medida || 'UN'}</span>
                            </div>
                            {mov.item?.descricao && (
                              <div className="text-gray-600">
                                <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Descrição:</span>
                                <p className="text-gray-700 text-sm">{mov.item.descricao}</p>
                              </div>
                            )}
                            {mov.item?.localizacao && (
                              <div className="flex items-center gap-2 text-gray-600">
                                <MapPin className="h-4 w-4 text-green-500" />
                                <span><strong>Localização:</strong> {mov.item.localizacao}</span>
                              </div>
                            )}
                            {mov.item?.fornecedor && (
                              <div className="text-gray-600">
                                <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Fornecedor:</span>
                                <p className="text-gray-700 text-sm">{mov.item.fornecedor}</p>
                              </div>
                            )}
                          </div>
                          
                          <div className="space-y-2">
                            <h4 className="font-medium text-gray-900 text-sm border-b pb-1">Dados da Movimentação</h4>
                            <div className="flex items-center gap-2 text-gray-600">
                              <Calendar className="h-4 w-4 text-green-500" />
                              <span><strong>Data:</strong> {formatDate(mov.criado_em)}</span>
                            </div>
                            <div className="flex items-center gap-2 text-gray-600">
                              <BarChart3 className="h-4 w-4 text-blue-500" />
                              <span><strong>Estoque Anterior:</strong> {mov.quantidade_anterior || 'N/A'}</span>
                            </div>
                            <div className="flex items-center gap-2 text-gray-600">
                              <TrendingUp className="h-4 w-4 text-purple-500" />
                              <span><strong>Estoque Atual:</strong> {mov.quantidade_atual || 'N/A'}</span>
                            </div>
                            <div className="text-gray-600">
                              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Motivo:</span>
                              <p className="text-gray-700 text-sm">{mov.motivo}</p>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <h4 className="font-medium text-gray-900 text-sm border-b pb-1">Referências</h4>
                            {mov.documento_referencia && (
                              <div className="flex items-center gap-2 text-gray-600">
                                <FileText className="h-4 w-4 text-blue-500" />
                                <span><strong>Documento:</strong> {mov.documento_referencia}</span>
                              </div>
                            )}
                            {mov.local_origem && (
                              <div className="flex items-center gap-2 text-gray-600">
                                <MapPin className="h-4 w-4 text-orange-500" />
                                <span><strong>Local Origem:</strong> {mov.local_origem}</span>
                              </div>
                            )}
                            {mov.local_destino && (
                              <div className="flex items-center gap-2 text-gray-600">
                                <MapPin className="h-4 w-4 text-green-500" />
                                <span><strong>Local Destino:</strong> {mov.local_destino}</span>
                              </div>
                            )}
                          </div>
                        </div>



                        {mov.observacoes && (
                          <div className="p-3 bg-blue-50 rounded-md border border-blue-200">
                            <div className="flex items-center gap-2 mb-1">
                              <FileText className="h-4 w-4 text-blue-500" />
                              <span className="text-sm font-medium text-blue-700">Observações</span>
                            </div>
                            <p className="text-blue-700 text-sm">{mov.observacoes}</p>
                          </div>
                        )}
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
        <Button onClick={loadFuncionarioData} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Atualizar Dados
        </Button>
      </div>
    </div>
  )
}
