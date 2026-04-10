'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useNotification } from '@/contexts/NotificationContext'
import { useModularPermissions } from '@/hooks/useModularPermissions'
import { useUnifiedPermissions } from '@/hooks/useUnifiedPermissions'
import { supabase } from '@/lib/supabase'
import { TRANSFERENCIAS_PERMISSIONS } from '@/constants/permissions-transferencias-emprestimos'
import { 
  TransferenciaBaseView,
  CriarTransferenciaBaseDTO,
  EnviarTransferenciaDTO,
  ReceberTransferenciaDTO,
  StatusTransferencia,
  PrioridadeTransferencia
} from '@/types/transferencias-bases'
import { ItemEstoque, Base, Contrato } from '@/types'

// Types for better type safety
interface HistoricoTransferenciaLog {
  id: string
  criado_em: string
  acao: string
  detalhes?: string
  status_anterior?: string
  status_novo?: string
  usuario?: {
    nome?: string
    email?: string
  }
  transferencia?: {
    numero_transferencia?: string
    base_origem?: {
      nome?: string
    }
    base_destino?: {
      nome?: string
    }
  }
}


interface User {
  id?: string
  nome?: string
  email?: string
}
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { 
  ArrowLeftRight,
  Send,
  Package,
  CheckCircle,
  Eye,
  Plus,
  AlertTriangle,
  Loader2,
  TruckIcon
} from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export function TransferenciasBasesContent() {
  const { user } = useAuth()
  const { notify } = useNotification()
  const { hasPermission } = useModularPermissions()
  const { userContratos } = useUnifiedPermissions()

  const [loading, setLoading] = useState(true)
  const [transferencias, setTransferencias] = useState<TransferenciaBaseView[]>([])
  const [bases, setBases] = useState<Base[]>([])
  const [contratos, setContratos] = useState<Contrato[]>([])
  const [itensEstoque, setItensEstoque] = useState<ItemEstoque[]>([])
  const [historico, setHistorico] = useState<HistoricoTransferenciaLog[]>([])
  
  // Filtros e busca
  const [filtroStatus, setFiltroStatus] = useState<StatusTransferencia | 'todos'>('todos')
  const [termoBusca, setTermoBusca] = useState('')
  
  // Modais
  const [modalNova, setModalNova] = useState(false)
  const [modalEnviar, setModalEnviar] = useState(false)
  const [modalReceber, setModalReceber] = useState(false)
  const [modalDetalhes, setModalDetalhes] = useState(false)
  
  const [transferenciaSelecionada, setTransferenciaSelecionada] = useState<TransferenciaBaseView | null>(null)

  // Obter IDs dos contratos que o usuário tem acesso
  const userContratoIds = useMemo(() => {
    if (!userContratos || !Array.isArray(userContratos)) {
      return []
    }
    return userContratos
      .filter((uc) => uc.ativo && (!uc.data_fim || new Date(uc.data_fim) >= new Date()))
      .map((uc) => uc.contrato_id)
  }, [userContratos])

  // Filtrar transferências: mostrar apenas onde contrato_origem_id OU contrato_destino_id está nos contratos do usuário
  const transferenciasFiltradas = useMemo(() => {
    if (userContratoIds.length === 0) {
      return []
    }
    let resultado = transferencias.filter((transf) => {
      const temAcessoOrigem = transf.contrato_origem_id && userContratoIds.includes(transf.contrato_origem_id)
      const temAcessoDestino = transf.contrato_destino_id && userContratoIds.includes(transf.contrato_destino_id)
      return temAcessoOrigem || temAcessoDestino
    })

    // Aplicar filtro de status
    if (filtroStatus !== 'todos') {
      resultado = resultado.filter((transf) => transf.status === filtroStatus)
    }

    // Aplicar busca
    if (termoBusca.trim()) {
      const termo = termoBusca.toLowerCase()
      resultado = resultado.filter((transf) => 
        transf.numero_transferencia?.toLowerCase().includes(termo) ||
        transf.item_nome?.toLowerCase().includes(termo) ||
        transf.item_codigo?.toLowerCase().includes(termo) ||
        transf.base_origem_nome?.toLowerCase().includes(termo) ||
        transf.base_destino_nome?.toLowerCase().includes(termo) ||
        transf.solicitante_nome?.toLowerCase().includes(termo)
      )
    }

    return resultado
  }, [transferencias, userContratoIds, filtroStatus, termoBusca])

  // Verificar se usuário pode receber transferência (deve ter acesso ao contrato de destino)
  const podeReceberTransferencia = useCallback((transf: TransferenciaBaseView): boolean => {
    if (!transf.contrato_destino_id) {
      return false
    }
    return userContratoIds.includes(transf.contrato_destino_id)
  }, [userContratoIds])

  const carregarDados = useCallback(async () => {
    setLoading(true)
    try {
      await Promise.all([
        carregarTransferencias(),
        carregarBases(),
        carregarContratos(),
        carregarItensEstoque(),
        carregarHistorico()
      ])
    } catch (error) {
      console.error('Erro ao carregar dados:', error)
      notify('Erro ao carregar dados', 'error')
    } finally {
      setLoading(false)
    }
  }, [notify])

  useEffect(() => {
    carregarDados()
    
    const handleRecarregar = () => {
      carregarHistorico()
    }
    
    if (typeof window !== 'undefined') {
      window.addEventListener('recarregarHistoricoTransf', handleRecarregar)
      return () => window.removeEventListener('recarregarHistoricoTransf', handleRecarregar)
    }
  }, [carregarDados])

  const carregarTransferencias = async () => {
    const { data, error } = await supabase
      .from('vw_transferencias_bases')
      .select('*')
      .order('data_solicitacao', { ascending: false })
    
    if (error) throw error
    setTransferencias(data || [])
  }

  const carregarBases = async () => {
    const { data, error } = await supabase
      .from('bases')
      .select('*')
      .eq('ativa', true)
      .order('nome')
    
    if (error) throw error
    setBases(data || [])
  }

  const carregarContratos = async () => {
    const { data, error } = await supabase
      .from('contratos')
      .select('*')
      .eq('status', 'ativo')
      .order('nome')
    
    if (error) throw error
    setContratos(data || [])
  }

  const carregarItensEstoque = async () => {
    // Buscar TODOS os itens sem filtros de tipo ou categoria
    const { data, error } = await supabase
      .from('itens_estoque')
      .select('*')
      .eq('status', 'ativo')
      .order('nome')
    
    if (error) throw error
    console.log('📦 [TRANSFERENCIA] Itens carregados:', data?.length || 0, 'itens')
    setItensEstoque(data || [])
  }

  const carregarHistorico = async () => {
    const { data, error } = await supabase
      .from('historico_transferencias_bases')
      .select(`
        *,
        usuario:usuarios!historico_transferencias_bases_usuario_id_fkey(id, nome, email),
        transferencia:transferencias_bases!historico_transferencias_bases_transferencia_id_fkey(
          numero_transferencia,
          base_origem:bases!transferencias_bases_base_origem_id_fkey(nome),
          base_destino:bases!transferencias_bases_base_destino_id_fkey(nome)
        )
      `)
      .order('criado_em', { ascending: false })
      .limit(100)
    
    if (error) throw error
    setHistorico(data || [])
  }

  const getStatusBadge = (status: StatusTransferencia) => {
    const colors = {
      pendente: 'outline',
      em_transito: 'default',
      concluida: 'secondary',
      cancelada: 'destructive'
    }
    
    const labels = {
      pendente: 'Pendente',
      em_transito: 'Em Trânsito',
      concluida: 'Concluída',
      cancelada: 'Cancelada'
    }
    
    return <Badge variant={colors[status] as 'default' | 'secondary' | 'destructive' | 'outline'}>{labels[status]}</Badge>
  }

  const getPrioridadeBadge = (prioridade: PrioridadeTransferencia) => {
    const colors = {
      baixa: 'outline',
      normal: 'secondary',
      alta: 'default',
      urgente: 'destructive'
    }
    
    const labels = {
      baixa: 'Baixa',
      normal: 'Normal',
      alta: 'Alta',
      urgente: 'Urgente'
    }
    
    return <Badge variant={colors[prioridade] as 'default' | 'secondary' | 'destructive' | 'outline'}>{labels[prioridade]}</Badge>
  }

  const formatarData = (data: string) => {
    if (!data) return ''
    return new Date(data).toLocaleDateString('pt-BR')
  }

  // Estatísticas (usando transferências filtradas)
  const pendentes = transferenciasFiltradas.filter((t: TransferenciaBaseView) => t.status === 'pendente')
  const emTransito = transferenciasFiltradas.filter((t: TransferenciaBaseView) => t.status === 'em_transito')
  const concluidas = transferenciasFiltradas.filter((t: TransferenciaBaseView) => t.status === 'concluida')
  const emAtraso = transferenciasFiltradas.filter((t: TransferenciaBaseView) => t.em_atraso && t.status !== 'concluida')

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <ArrowLeftRight className="w-8 h-8" />
          <h1 className="text-3xl font-bold">Transferências Entre Bases</h1>
        </div>
        <p className="text-muted-foreground">
          Gerencie transferências de itens entre diferentes bases e contratos
        </p>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="transferencias" className="space-y-4">
        <TabsList>
          <TabsTrigger value="transferencias" className="flex items-center gap-2">
            <Package className="w-4 h-4" />
            Transferências
          </TabsTrigger>
          <TabsTrigger value="logs" className="flex items-center gap-2">
            <Eye className="w-4 h-4" />
            Logs
          </TabsTrigger>
        </TabsList>

        {/* Tab: Transferências */}
        <TabsContent value="transferencias" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-semibold">Transferências</h2>
            {hasPermission(TRANSFERENCIAS_PERMISSIONS.CRIAR) && (
              <Button onClick={() => {
                setTransferenciaSelecionada(null)
                setModalNova(true)
              }}>
                <Plus className="w-4 h-4 mr-2" />
                Nova Transferência
              </Button>
            )}
          </div>

          {/* Filtros e Busca */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <Input
                  placeholder="Buscar por documento, item, base ou solicitante..."
                  value={termoBusca}
                  onChange={(e) => setTermoBusca(e.target.value)}
                  className="w-full"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                variant={filtroStatus === 'todos' ? 'default' : 'outline'}
                onClick={() => setFiltroStatus('todos')}
                size="sm"
              >
                Todos ({transferencias.filter((t) => {
                  const temAcessoOrigem = t.contrato_origem_id && userContratoIds.includes(t.contrato_origem_id)
                  const temAcessoDestino = t.contrato_destino_id && userContratoIds.includes(t.contrato_destino_id)
                  return temAcessoOrigem || temAcessoDestino
                }).length})
              </Button>
              <Button
                variant={filtroStatus === 'pendente' ? 'default' : 'outline'}
                onClick={() => setFiltroStatus('pendente')}
                size="sm"
                className={filtroStatus === 'pendente' ? 'bg-yellow-600 hover:bg-yellow-700' : ''}
              >
                Pendentes ({pendentes.length})
              </Button>
              <Button
                variant={filtroStatus === 'em_transito' ? 'default' : 'outline'}
                onClick={() => setFiltroStatus('em_transito')}
                size="sm"
                className={filtroStatus === 'em_transito' ? 'bg-blue-600 hover:bg-blue-700' : ''}
              >
                Em Trânsito ({emTransito.length})
              </Button>
              <Button
                variant={filtroStatus === 'concluida' ? 'default' : 'outline'}
                onClick={() => setFiltroStatus('concluida')}
                size="sm"
                className={filtroStatus === 'concluida' ? 'bg-green-600 hover:bg-green-700' : ''}
              >
                Concluídas ({concluidas.length})
              </Button>
            </div>
          </div>

          {/* Estatísticas */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-yellow-600">Pendentes</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-yellow-600">{pendentes.length}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-blue-600">Em Trânsito</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">{emTransito.length}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-green-600">Concluídas</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{concluidas.length}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-red-600">Em Atraso</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">{emAtraso.length}</div>
              </CardContent>
            </Card>
          </div>

          {/* Alerta de atrasos */}
          {emAtraso.length > 0 && (
            <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              <span className="text-red-800 font-medium">
                Existem {emAtraso.length} transferência(s) em atraso!
              </span>
            </div>
          )}

          {/* Lista de Transferências */}
          {transferenciasFiltradas.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground">
                {transferencias.length === 0 
                  ? 'Nenhuma transferência registrada'
                  : 'Nenhuma transferência disponível para seus contratos'}
              </CardContent>
            </Card>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-muted">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-medium">Documento</th>
                      <th className="px-4 py-3 text-left text-sm font-medium">De → Para</th>
                      <th className="px-4 py-3 text-left text-sm font-medium">Item</th>
                      <th className="px-4 py-3 text-left text-sm font-medium">Qtd</th>
                      <th className="px-4 py-3 text-left text-sm font-medium">Solicitante</th>
                      <th className="px-4 py-3 text-left text-sm font-medium">Data</th>
                      <th className="px-4 py-3 text-left text-sm font-medium">Prioridade</th>
                      <th className="px-4 py-3 text-left text-sm font-medium">Status</th>
                      <th className="px-4 py-3 text-left text-sm font-medium">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {transferenciasFiltradas.map((transf: TransferenciaBaseView) => (
                      <tr 
                        key={transf.id}
                        className={transf.em_atraso ? 'bg-red-50' : ''}
                      >
                        <td className="px-4 py-3">
                          <div className="font-medium">{transf.numero_transferencia}</div>
                          {transf.dias_em_transito > 0 && (
                            <div className="text-xs text-muted-foreground">
                              {transf.dias_em_transito} dia(s) em trânsito
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="space-y-1">
                            <div className="flex items-center gap-1 text-sm">
                              <span className="font-medium">{transf.base_origem_nome}</span>
                              <ArrowLeftRight className="w-3 h-3" />
                              <span className="font-medium">{transf.base_destino_nome}</span>
                            </div>
                            {transf.entre_contratos && (
                              <Badge variant="outline" className="text-xs">
                                Entre Contratos
                              </Badge>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div>{transf.item_nome}</div>
                          <div className="text-xs text-muted-foreground">{transf.item_codigo}</div>
                        </td>
                        <td className="px-4 py-3">
                          {transf.quantidade} {transf.unidade_medida}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {transf.solicitante_nome}
                        </td>
                        <td className="px-4 py-3">
                          <div>{formatarData(transf.data_solicitacao)}</div>
                          {transf.previsao_chegada && (
                            <div className="text-xs text-muted-foreground">
                              Prev: {formatarData(transf.previsao_chegada)}
                            </div>
                          )}
                          {transf.em_atraso && (
                            <Badge variant="destructive" className="text-xs mt-1">
                              {transf.dias_atraso} dia(s) de atraso
                            </Badge>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {getPrioridadeBadge(transf.prioridade)}
                        </td>
                        <td className="px-4 py-3">
                          {getStatusBadge(transf.status)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            {transf.status === 'pendente' && hasPermission(TRANSFERENCIAS_PERMISSIONS.ENVIAR) && (
                              <Button
                                size="default"
                                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold"
                                onClick={() => {
                                  setTransferenciaSelecionada(transf)
                                  setModalEnviar(true)
                                }}
                                title="Enviar"
                              >
                                <Send className="w-5 h-5 mr-2" />
                                Enviar
                              </Button>
                            )}
                            {transf.status === 'em_transito' && hasPermission(TRANSFERENCIAS_PERMISSIONS.RECEBER) && podeReceberTransferencia(transf) && (
                              <Button
                                size="default"
                                className="bg-green-600 hover:bg-green-700 text-white font-semibold"
                                onClick={() => {
                                  setTransferenciaSelecionada(transf)
                                  setModalReceber(true)
                                }}
                                title="Receber"
                              >
                                <CheckCircle className="w-5 h-5 mr-2" />
                                Receber
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setTransferenciaSelecionada(transf)
                                setModalDetalhes(true)
                              }}
                              title="Ver detalhes"
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </TabsContent>

        {/* Tab: Logs */}
        <TabsContent value="logs" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-semibold">Histórico e Logs</h2>
            <Button variant="outline" onClick={carregarHistorico}>
              <ArrowLeftRight className="w-4 h-4 mr-2" />
              Atualizar
            </Button>
          </div>

          {historico.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground">
                Nenhum registro de histórico encontrado
              </CardContent>
            </Card>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-muted">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-medium">Data/Hora</th>
                      <th className="px-4 py-3 text-left text-sm font-medium">Ação</th>
                      <th className="px-4 py-3 text-left text-sm font-medium">Transferência</th>
                      <th className="px-4 py-3 text-left text-sm font-medium">Rota</th>
                      <th className="px-4 py-3 text-left text-sm font-medium">Detalhes</th>
                      <th className="px-4 py-3 text-left text-sm font-medium">Usuário</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {historico.map((log: HistoricoTransferenciaLog) => (
                      <tr key={log.id}>
                        <td className="px-4 py-3 text-sm">
                          {new Date(log.criado_em).toLocaleString('pt-BR')}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={
                            log.acao === 'criacao' ? 'default' :
                            log.acao === 'envio' ? 'secondary' :
                            log.acao === 'recebimento' ? 'secondary' :
                            log.acao === 'cancelamento' ? 'destructive' :
                            'outline'
                          }>
                            {log.acao === 'criacao' && 'Criação'}
                            {log.acao === 'aprovacao' && 'Aprovação'}
                            {log.acao === 'rejeicao' && 'Rejeição'}
                            {log.acao === 'envio' && 'Envio'}
                            {log.acao === 'recebimento' && 'Recebimento'}
                            {log.acao === 'cancelamento' && 'Cancelamento'}
                            {log.acao === 'atualizacao' && 'Atualização'}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-sm font-medium">
                          {log.transferencia?.numero_transferencia || '-'}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {log.transferencia?.base_origem?.nome && log.transferencia?.base_destino?.nome ? (
                            <div className="flex items-center gap-1">
                              <span>{log.transferencia.base_origem.nome}</span>
                              <ArrowLeftRight className="w-3 h-3" />
                              <span>{log.transferencia.base_destino.nome}</span>
                            </div>
                          ) : '-'}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {log.detalhes || '-'}
                          {log.status_anterior && log.status_novo && (
                            <div className="text-xs text-muted-foreground mt-1">
                              {log.status_anterior} → {log.status_novo}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <div className="font-medium">{log.usuario?.nome || 'Sistema'}</div>
                          {log.usuario?.email && (
                            <div className="text-xs text-muted-foreground">{log.usuario.email}</div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Modais */}
      <ModalNovaTransferencia
        open={modalNova}
        onClose={() => setModalNova(false)}
        bases={bases}
        contratos={contratos}
        itensEstoque={itensEstoque}
        onSave={() => {
          carregarTransferencias()
          setModalNova(false)
        }}
        notify={notify}
        user={user}
      />

      <ModalEnviarTransferencia
        open={modalEnviar}
        onClose={() => {
          setModalEnviar(false)
          setTransferenciaSelecionada(null)
        }}
        transferencia={transferenciaSelecionada}
        onSave={() => {
          carregarTransferencias()
          setModalEnviar(false)
          setTransferenciaSelecionada(null)
        }}
        notify={notify}
        user={user}
      />

      <ModalReceberTransferencia
        open={modalReceber}
        onClose={() => {
          setModalReceber(false)
          setTransferenciaSelecionada(null)
        }}
        transferencia={transferenciaSelecionada}
        onSave={() => {
          carregarTransferencias()
          setModalReceber(false)
          setTransferenciaSelecionada(null)
        }}
        notify={notify}
        user={user}
      />

      <ModalDetalhesTransferencia
        open={modalDetalhes}
        onClose={() => {
          setModalDetalhes(false)
          setTransferenciaSelecionada(null)
        }}
        transferencia={transferenciaSelecionada}
        historico={historico}
      />
    </div>
  )
}

// Modal: Nova Transferência
interface ModalNovaTransferenciaProps {
  open: boolean
  onClose: () => void
  bases: Base[]
  contratos: Contrato[]
  itensEstoque: ItemEstoque[]
  onSave: () => void
  notify: (message: string, type: 'success' | 'error' | 'info') => void
  user: User | null
}

function ModalNovaTransferencia({ open, onClose, bases, contratos, itensEstoque, onSave, notify, user }: ModalNovaTransferenciaProps) {
  const [formData, setFormData] = useState<CriarTransferenciaBaseDTO>({
    item_estoque_id: '',
    quantidade: 1,
    base_origem_id: '',
    contrato_origem_id: '',
    base_destino_id: '',
    contrato_destino_id: '',
    motivo: '',
    prioridade: 'normal',
    condicao_envio: 'bom',
    observacoes_solicitacao: ''
  })
  const [salvando, setSalvando] = useState(false)

  // Filtrar bases por contrato selecionado
  const basesOrigem = formData.contrato_origem_id 
    ? bases.filter((b: Base) => b.contrato_id === formData.contrato_origem_id)
    : bases

  const basesDestino = formData.contrato_destino_id
    ? bases.filter((b: Base) => b.contrato_id === formData.contrato_destino_id)
    : bases

  // Filtrar itens apenas da base origem selecionada
  // SEM filtros por tipo ou categoria - mostrar TODOS os itens da base
  // Itens sem estoque serão mostrados mas não poderão ser selecionados
  const itensDisponiveis = formData.base_origem_id
    ? itensEstoque.filter((i: ItemEstoque) => i.base_id === formData.base_origem_id)
    : []

  // Função para lidar com seleção de item (verificar estoque)
  const handleItemSelect = (itemId: string) => {
    const itemSelecionado = itensDisponiveis.find((i: ItemEstoque) => i.id === itemId)
    
    if (itemSelecionado) {
      const estoqueAtual = itemSelecionado.estoque_atual || 0
      
      if (estoqueAtual <= 0) {
        notify(`Este item não possui estoque disponível. Estoque atual: ${estoqueAtual}`, 'error')
        return // Não permite selecionar item sem estoque
      }
      
      // Permite selecionar apenas se tiver estoque
      setFormData({ ...formData, item_estoque_id: itemId })
    }
  }

  useEffect(() => {
    if (!open) {
      setFormData({
        item_estoque_id: '',
        quantidade: 1,
        base_origem_id: '',
        contrato_origem_id: '',
        base_destino_id: '',
        contrato_destino_id: '',
        motivo: '',
        prioridade: 'normal',
        condicao_envio: 'bom',
        observacoes_solicitacao: ''
      })
    }
  }, [open])

  const handleSalvar = async () => {
    if (!formData.item_estoque_id || !formData.base_origem_id || 
        !formData.base_destino_id || !formData.motivo) {
      notify('Preencha todos os campos obrigatórios', 'error')
      return
    }

    if (formData.base_origem_id === formData.base_destino_id) {
      notify('Base de origem e destino devem ser diferentes', 'error')
      return
    }

    // Validar estoque do item selecionado
    const itemSelecionado = itensDisponiveis.find((i: ItemEstoque) => i.id === formData.item_estoque_id)
    if (!itemSelecionado) {
      notify('Item selecionado não encontrado', 'error')
      return
    }

    const estoqueAtual = itemSelecionado.estoque_atual || 0
    if (estoqueAtual <= 0) {
      notify(`Este item não possui estoque disponível. Estoque atual: ${estoqueAtual}`, 'error')
      return
    }

    if (formData.quantidade > estoqueAtual) {
      notify(`Quantidade solicitada (${formData.quantidade}) é maior que o estoque disponível (${estoqueAtual})`, 'error')
      return
    }

    setSalvando(true)
    try {
      const { data: numeroData, error: numeroError } = await supabase
        .rpc('gerar_numero_transferencia')
      
      if (numeroError) throw numeroError

      const { error } = await supabase
        .from('transferencias_bases')
        .insert([{
          ...formData,
          numero_transferencia: numeroData,
          solicitante_id: user?.id
        }])
      
      if (error) throw error
      
      notify(`Transferência criada - Documento: ${numeroData}`, 'success')
      
      onSave()
      
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('recarregarHistoricoTransf'))
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido'
      notify(`Erro ao criar transferência: ${errorMessage}`, 'error')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova Transferência Entre Bases</DialogTitle>
          <DialogDescription>
            Solicite a transferência de um item entre bases
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          {/* Origem */}
          <div className="border rounded-lg p-4 space-y-4">
            <h3 className="font-semibold flex items-center gap-2">
              <Package className="w-4 h-4" />
              Origem
            </h3>
            
            <div className="space-y-2">
              <Label>Contrato de Origem</Label>
              <Select
                value={formData.contrato_origem_id}
                onValueChange={(value) => setFormData({ 
                  ...formData, 
                  contrato_origem_id: value,
                  base_origem_id: '' // Limpar base ao trocar contrato
                })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {contratos.map((contrato: Contrato) => (
                    <SelectItem key={contrato.id} value={contrato.id}>
                      {contrato.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Base de Origem *</Label>
              <Select
                value={formData.base_origem_id}
                onValueChange={(value) => setFormData({ 
                  ...formData, 
                  base_origem_id: value,
                  item_estoque_id: '' // Limpar item ao trocar base
                })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {basesOrigem.map((base: Base) => (
                    <SelectItem key={base.id} value={base.id}>
                      {base.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Destino */}
          <div className="border rounded-lg p-4 space-y-4">
            <h3 className="font-semibold flex items-center gap-2">
              <TruckIcon className="w-4 h-4" />
              Destino
            </h3>
            
            <div className="space-y-2">
              <Label>Contrato de Destino</Label>
              <Select
                value={formData.contrato_destino_id}
                onValueChange={(value) => setFormData({ 
                  ...formData, 
                  contrato_destino_id: value,
                  base_destino_id: '' // Limpar base ao trocar contrato
                })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {contratos.map((contrato: Contrato) => (
                    <SelectItem key={contrato.id} value={contrato.id}>
                      {contrato.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Base de Destino *</Label>
              <Select
                value={formData.base_destino_id}
                onValueChange={(value) => setFormData({ ...formData, base_destino_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {basesDestino.map((base: Base) => (
                    <SelectItem key={base.id} value={base.id}>
                      {base.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Item e Quantidade */}
          <div className="space-y-2">
            <Label>Item do Estoque *</Label>
            <SearchableSelect
              items={itensDisponiveis.map((item: ItemEstoque) => {
                const estoqueAtual = item.estoque_atual || 0
                const temEstoque = estoqueAtual > 0
                
                return {
                  id: item.id,
                  nome: `${item.nome} (${item.codigo})`,
                  codigo: item.codigo,
                  categoria: item.categoria,
                  estoque: estoqueAtual,
                  unidade: item.unidade_medida,
                  disabled: !temEstoque // Desabilita itens sem estoque
                }
              })}
              value={formData.item_estoque_id}
              onValueChange={handleItemSelect}
              placeholder="Digite para buscar o item..."
              className="w-full"
            />
            {!formData.base_origem_id && (
              <p className="text-xs text-muted-foreground">
                Selecione a base de origem primeiro
              </p>
            )}
            {formData.item_estoque_id && (() => {
              const itemSelecionado = itensDisponiveis.find((i: ItemEstoque) => i.id === formData.item_estoque_id)
              const estoqueAtual = itemSelecionado?.estoque_atual || 0
              if (estoqueAtual <= 0) {
                return (
                  <p className="text-xs text-red-600 font-medium">
                    ⚠️ Este item não possui estoque disponível para transferência
                  </p>
                )
              }
              return null
            })()}
          </div>

          <div className="space-y-2">
            <Label>Quantidade *</Label>
            <Input
              type="number"
              min={1}
              value={formData.quantidade}
              onChange={(e) => setFormData({ ...formData, quantidade: parseFloat(e.target.value) })}
            />
          </div>

          {/* Informações Adicionais */}
          <div className="border-t pt-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Prioridade *</Label>
                <Select
                  value={formData.prioridade}
                  onValueChange={(value: 'baixa' | 'normal' | 'alta' | 'urgente') => setFormData({ ...formData, prioridade: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="baixa">Baixa</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="alta">Alta</SelectItem>
                    <SelectItem value="urgente">Urgente</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Previsão de Chegada</Label>
                <Input
                  type="date"
                  value={formData.previsao_chegada}
                  onChange={(e) => setFormData({ ...formData, previsao_chegada: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Motivo *</Label>
              <Textarea
                value={formData.motivo}
                onChange={(e) => setFormData({ ...formData, motivo: e.target.value })}
                placeholder="Descreva o motivo da transferência"
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea
                value={formData.observacoes_solicitacao}
                onChange={(e) => setFormData({ ...formData, observacoes_solicitacao: e.target.value })}
                rows={2}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSalvar} disabled={salvando}>
            {salvando && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Criar Transferência
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Modal: Enviar Transferência
interface ModalEnviarTransferenciaProps {
  open: boolean
  onClose: () => void
  transferencia: TransferenciaBaseView | null
  onSave: () => void
  notify: (message: string, type: 'success' | 'error' | 'info') => void
  user: User | null
}

function ModalEnviarTransferencia({ open, onClose, transferencia, onSave, notify, user }: ModalEnviarTransferenciaProps) {
  const [formData, setFormData] = useState<EnviarTransferenciaDTO>({
    transferencia_id: '',
    tipo_transporte: '',
    documento_transporte: '',
    custo_transporte: 0,
    condicao_envio: 'bom',
    observacoes_envio: ''
  })
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    if (transferencia && open) {
      setFormData({
        transferencia_id: transferencia.id,
        tipo_transporte: '',
        documento_transporte: '',
        custo_transporte: 0,
        condicao_envio: 'bom',
        observacoes_envio: ''
      })
    }
  }, [transferencia, open])

  const handleSalvar = async () => {
    setSalvando(true)
    try {
      const { error } = await supabase
        .from('transferencias_bases')
        .update({
          status: 'em_transito',
          data_envio: new Date().toISOString().split('T')[0],
          enviado_por_id: user?.id,
          tipo_transporte: formData.tipo_transporte,
          documento_transporte: formData.documento_transporte,
          custo_transporte: formData.custo_transporte,
          condicao_envio: formData.condicao_envio,
          observacoes_envio: formData.observacoes_envio
        })
        .eq('id', formData.transferencia_id)
      
      if (error) throw error
      
      notify('Transferência enviada com sucesso', 'success')
      
      onSave()
      
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('recarregarHistoricoTransf'))
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido'
      notify(`Erro ao enviar: ${errorMessage}`, 'error')
    } finally {
      setSalvando(false)
    }
  }

  if (!transferencia) return null

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Enviar Transferência</DialogTitle>
          <DialogDescription>
            Registre o envio da transferência {transferencia.numero_transferencia}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-1">
            <div className="font-semibold">{transferencia.numero_transferencia}</div>
            <div className="text-sm">
              <span className="font-medium">{transferencia.item_nome}</span> ({transferencia.item_codigo})
            </div>
            <div className="text-sm text-muted-foreground">
              {transferencia.quantidade} {transferencia.unidade_medida}
            </div>
            <div className="text-sm flex items-center gap-1">
              <span>{transferencia.base_origem_nome}</span>
              <ArrowLeftRight className="w-3 h-3" />
              <span>{transferencia.base_destino_nome}</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Tipo de Transporte</Label>
            <Input
              value={formData.tipo_transporte}
              onChange={(e) => setFormData({ ...formData, tipo_transporte: e.target.value })}
              placeholder="Ex: Transportadora XYZ, Veículo próprio"
            />
          </div>

          <div className="space-y-2">
            <Label>Documento de Transporte</Label>
            <Input
              value={formData.documento_transporte}
              onChange={(e) => setFormData({ ...formData, documento_transporte: e.target.value })}
              placeholder="Código de rastreio, NF, etc."
            />
          </div>

          <div className="space-y-2">
            <Label>Custo do Transporte (R$)</Label>
            <Input
              type="number"
              min={0}
              step="0.01"
              value={formData.custo_transporte}
              onChange={(e) => setFormData({ ...formData, custo_transporte: parseFloat(e.target.value) })}
            />
          </div>

          <div className="space-y-2">
            <Label>Condição do Item</Label>
            <Select
              value={formData.condicao_envio}
              onValueChange={(value: 'novo' | 'bom' | 'regular' | 'ruim') => setFormData({ ...formData, condicao_envio: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="novo">Novo</SelectItem>
                <SelectItem value="bom">Bom estado</SelectItem>
                <SelectItem value="regular">Estado regular</SelectItem>
                <SelectItem value="ruim">Estado ruim</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea
              value={formData.observacoes_envio}
              onChange={(e) => setFormData({ ...formData, observacoes_envio: e.target.value })}
              placeholder="Informações adicionais sobre o envio"
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSalvar} disabled={salvando}>
            {salvando && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            <Send className="w-4 h-4 mr-2" />
            Confirmar Envio
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Modal: Receber Transferência
interface ModalReceberTransferenciaProps {
  open: boolean
  onClose: () => void
  transferencia: TransferenciaBaseView | null
  onSave: () => void
  notify: (message: string, type: 'success' | 'error' | 'info') => void
  user: User | null
}

function ModalReceberTransferencia({ open, onClose, transferencia, onSave, notify, user }: ModalReceberTransferenciaProps) {
  const [formData, setFormData] = useState<ReceberTransferenciaDTO>({
    transferencia_id: '',
    condicao_recebimento: 'bom',
    observacoes_recebimento: ''
  })
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    if (transferencia && open) {
      setFormData({
        transferencia_id: transferencia.id,
        condicao_recebimento: 'bom',
        observacoes_recebimento: ''
      })
    }
  }, [transferencia, open])

  const handleSalvar = async () => {
    setSalvando(true)
    try {
      const { error } = await supabase
        .from('transferencias_bases')
        .update({
          status: 'concluida',
          data_recebimento: formData.data_recebimento || new Date().toISOString().split('T')[0],
          recebido_por_id: user?.id,
          condicao_recebimento: formData.condicao_recebimento,
          observacoes_recebimento: formData.observacoes_recebimento
        })
        .eq('id', formData.transferencia_id)
      
      if (error) throw error
      
      notify('Transferência recebida e concluída com sucesso', 'success')
      
      onSave()
      
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('recarregarHistoricoTransf'))
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido'
      notify(`Erro ao receber: ${errorMessage}`, 'error')
    } finally {
      setSalvando(false)
    }
  }

  if (!transferencia) return null

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Receber Transferência</DialogTitle>
          <DialogDescription>
            Confirme o recebimento da transferência {transferencia.numero_transferencia}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg space-y-1">
            <div className="font-semibold">{transferencia.numero_transferencia}</div>
            <div className="text-sm">
              <span className="font-medium">{transferencia.item_nome}</span> ({transferencia.item_codigo})
            </div>
            <div className="text-sm text-muted-foreground">
              Quantidade: {transferencia.quantidade} {transferencia.unidade_medida}
            </div>
            <div className="text-sm flex items-center gap-1">
              <span>De: {transferencia.base_origem_nome}</span>
              <ArrowLeftRight className="w-3 h-3" />
              <span>Para: {transferencia.base_destino_nome}</span>
            </div>
            {transferencia.enviado_por_nome && (
              <div className="text-sm text-muted-foreground">
                Enviado por: {transferencia.enviado_por_nome}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Condição do Item Recebido *</Label>
            <Select
              value={formData.condicao_recebimento}
              onValueChange={(value: 'novo' | 'bom' | 'regular' | 'ruim' | 'danificado') => setFormData({ ...formData, condicao_recebimento: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="novo">Novo</SelectItem>
                <SelectItem value="bom">Bom estado</SelectItem>
                <SelectItem value="regular">Estado regular</SelectItem>
                <SelectItem value="ruim">Estado ruim</SelectItem>
                <SelectItem value="danificado">Danificado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Data do Recebimento</Label>
            <Input
              type="date"
              value={formData.data_recebimento || new Date().toISOString().split('T')[0]}
              onChange={(e) => setFormData({ ...formData, data_recebimento: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea
              value={formData.observacoes_recebimento}
              onChange={(e) => setFormData({ ...formData, observacoes_recebimento: e.target.value })}
              placeholder="Descreva o estado do item e outras observações"
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSalvar} disabled={salvando}>
            {salvando && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            <CheckCircle className="w-4 h-4 mr-2" />
            Confirmar Recebimento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Modal: Detalhes da Transferência
interface ModalDetalhesTransferenciaProps {
  open: boolean
  onClose: () => void
  transferencia: TransferenciaBaseView | null
  historico: HistoricoTransferenciaLog[]
}

function ModalDetalhesTransferencia({ open, onClose, transferencia, historico }: ModalDetalhesTransferenciaProps) {
  if (!transferencia) return null

  const historicoTransferencia = historico.filter(
    (log) => log.transferencia?.numero_transferencia === transferencia.numero_transferencia
  )

  const formatarDataHora = (data: string) => {
    if (!data) return ''
    return new Date(data).toLocaleString('pt-BR')
  }

  const formatarData = (data: string) => {
    if (!data) return ''
    return new Date(data).toLocaleDateString('pt-BR')
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="w-5 h-5" />
            Detalhes da Transferência
          </DialogTitle>
          <DialogDescription>
            Informações completas e timeline da transferência {transferencia.numero_transferencia}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          {/* Informações Principais */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Documento</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-lg font-bold">{transferencia.numero_transferencia}</div>
                <div className="flex gap-2 mt-2">
                  {getStatusBadge(transferencia.status)}
                  {getPrioridadeBadge(transferencia.prioridade)}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Rota</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <div className="text-sm">
                    <div className="font-semibold">{transferencia.base_origem_nome}</div>
                    <div className="text-xs text-muted-foreground">{transferencia.contrato_origem_nome}</div>
                  </div>
                  <ArrowLeftRight className="w-4 h-4 text-muted-foreground" />
                  <div className="text-sm">
                    <div className="font-semibold">{transferencia.base_destino_nome}</div>
                    <div className="text-xs text-muted-foreground">{transferencia.contrato_destino_nome}</div>
                  </div>
                </div>
                {transferencia.entre_contratos && (
                  <Badge variant="outline" className="mt-2">
                    Transferência Entre Contratos
                  </Badge>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Item */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Item</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <div className="text-xs text-muted-foreground">Nome</div>
                  <div className="font-semibold">{transferencia.item_nome}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Código</div>
                  <div className="font-semibold">{transferencia.item_codigo}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Quantidade</div>
                  <div className="font-semibold">{transferencia.quantidade} {transferencia.unidade_medida}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Datas e Prazos */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Datas e Prazos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <div className="text-xs text-muted-foreground">Solicitação</div>
                  <div className="font-semibold">{formatarData(transferencia.data_solicitacao)}</div>
                </div>
                {transferencia.data_envio && (
                  <div>
                    <div className="text-xs text-muted-foreground">Envio</div>
                    <div className="font-semibold">{formatarData(transferencia.data_envio)}</div>
                  </div>
                )}
                {transferencia.previsao_chegada && (
                  <div>
                    <div className="text-xs text-muted-foreground">Previsão</div>
                    <div className="font-semibold">{formatarData(transferencia.previsao_chegada)}</div>
                  </div>
                )}
                {transferencia.data_recebimento && (
                  <div>
                    <div className="text-xs text-muted-foreground">Recebimento</div>
                    <div className="font-semibold">{formatarData(transferencia.data_recebimento)}</div>
                  </div>
                )}
              </div>
              {transferencia.dias_em_transito > 0 && (
                <div className="mt-3 p-2 bg-blue-50 border border-blue-200 rounded text-sm">
                  <strong>{transferencia.dias_em_transito}</strong> dia(s) em trânsito
                </div>
              )}
              {transferencia.em_atraso && (
                <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded text-sm">
                  <AlertTriangle className="w-4 h-4 inline mr-1" />
                  <strong>{transferencia.dias_atraso}</strong> dia(s) de atraso
                </div>
              )}
            </CardContent>
          </Card>

          {/* Pessoas Envolvidas */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Pessoas Envolvidas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <div className="text-xs text-muted-foreground">Solicitante</div>
                  <div className="font-semibold">{transferencia.solicitante_nome || '-'}</div>
                </div>
                {transferencia.enviado_por_nome && (
                  <div>
                    <div className="text-xs text-muted-foreground">Enviado por</div>
                    <div className="font-semibold">{transferencia.enviado_por_nome}</div>
                  </div>
                )}
                {transferencia.recebido_por_nome && (
                  <div>
                    <div className="text-xs text-muted-foreground">Recebido por</div>
                    <div className="font-semibold">{transferencia.recebido_por_nome}</div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Informações de Transporte */}
          {(transferencia.tipo_transporte || transferencia.documento_transporte || transferencia.custo_transporte) && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <TruckIcon className="w-4 h-4" />
                  Transporte
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {transferencia.tipo_transporte && (
                    <div>
                      <div className="text-xs text-muted-foreground">Tipo</div>
                      <div className="font-semibold">{transferencia.tipo_transporte}</div>
                    </div>
                  )}
                  {transferencia.documento_transporte && (
                    <div>
                      <div className="text-xs text-muted-foreground">Documento</div>
                      <div className="font-semibold">{transferencia.documento_transporte}</div>
                    </div>
                  )}
                  {transferencia.custo_transporte && transferencia.custo_transporte > 0 && (
                    <div>
                      <div className="text-xs text-muted-foreground">Custo</div>
                      <div className="font-semibold">
                        R$ {transferencia.custo_transporte.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Condições e Motivo */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Condições e Motivo</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {transferencia.motivo && (
                <div>
                  <div className="text-xs text-muted-foreground font-semibold">Motivo</div>
                  <div className="text-sm mt-1">{transferencia.motivo}</div>
                </div>
              )}
              {transferencia.condicao_envio && (
                <div>
                  <div className="text-xs text-muted-foreground font-semibold">Condição no Envio</div>
                  <div className="text-sm mt-1 capitalize">{transferencia.condicao_envio}</div>
                </div>
              )}
              {transferencia.condicao_recebimento && (
                <div>
                  <div className="text-xs text-muted-foreground font-semibold">Condição no Recebimento</div>
                  <div className="text-sm mt-1 capitalize">{transferencia.condicao_recebimento}</div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Timeline */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Eye className="w-4 h-4" />
                Timeline da Transferência
              </CardTitle>
            </CardHeader>
            <CardContent>
              {historicoTransferencia.length === 0 ? (
                <div className="text-sm text-muted-foreground text-center py-4">
                  Nenhum registro de histórico encontrado
                </div>
              ) : (
                <div className="space-y-4">
                  {historicoTransferencia.map((log, index) => (
                    <div key={log.id} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div className={`w-3 h-3 rounded-full ${
                          log.acao === 'criacao' ? 'bg-blue-500' :
                          log.acao === 'envio' ? 'bg-yellow-500' :
                          log.acao === 'recebimento' ? 'bg-green-500' :
                          log.acao === 'cancelamento' ? 'bg-red-500' :
                          'bg-gray-400'
                        }`} />
                        {index < historicoTransferencia.length - 1 && (
                          <div className="w-0.5 h-full bg-gray-300 mt-1" />
                        )}
                      </div>
                      <div className="flex-1 pb-4">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant={{
                            criacao: 'default',
                            envio: 'secondary',
                            recebimento: 'secondary',
                            cancelamento: 'destructive'
                          }[log.acao] as 'default' | 'secondary' | 'destructive' || 'outline'}>
                            {log.acao === 'criacao' && 'Criação'}
                            {log.acao === 'aprovacao' && 'Aprovação'}
                            {log.acao === 'rejeicao' && 'Rejeição'}
                            {log.acao === 'envio' && 'Envio'}
                            {log.acao === 'recebimento' && 'Recebimento'}
                            {log.acao === 'cancelamento' && 'Cancelamento'}
                            {log.acao === 'atualizacao' && 'Atualização'}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {formatarDataHora(log.criado_em)}
                          </span>
                        </div>
                        <div className="text-sm">
                          <div className="font-medium">{log.usuario?.nome || 'Sistema'}</div>
                          {log.detalhes && (
                            <div className="text-muted-foreground mt-1">{log.detalhes}</div>
                          )}
                          {log.status_anterior && log.status_novo && (
                            <div className="text-xs text-muted-foreground mt-1">
                              Status: {log.status_anterior} → {log.status_novo}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function getStatusBadge(status: StatusTransferencia) {
  const colors = {
    pendente: 'outline',
    em_transito: 'default',
    concluida: 'secondary',
    cancelada: 'destructive'
  }
  
  const labels = {
    pendente: 'Pendente',
    em_transito: 'Em Trânsito',
    concluida: 'Concluída',
    cancelada: 'Cancelada'
  }
  
  return <Badge variant={colors[status] as 'default' | 'secondary' | 'destructive' | 'outline'}>{labels[status]}</Badge>
}

function getPrioridadeBadge(prioridade: PrioridadeTransferencia) {
  const colors = {
    baixa: 'outline',
    normal: 'secondary',
    alta: 'default',
    urgente: 'destructive'
  }
  
  const labels = {
    baixa: 'Baixa',
    normal: 'Normal',
    alta: 'Alta',
    urgente: 'Urgente'
  }
  
  return <Badge variant={colors[prioridade] as 'default' | 'secondary' | 'destructive' | 'outline'}>{labels[prioridade]}</Badge>
}

