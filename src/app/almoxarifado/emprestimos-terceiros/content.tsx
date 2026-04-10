'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useNotification } from '@/contexts/NotificationContext'
import { useModularPermissions } from '@/hooks/useModularPermissions'
import { supabase } from '@/lib/supabase'
import { EMPRESTIMOS_TERCEIROS_PERMISSIONS } from '@/constants/permissions-transferencias-emprestimos'
import { 
  EmpresaTerceira, 
  EmprestimoTerceiroAtivo,
  CriarEmpresaTerceiraDTO,
  CriarEmprestimoTerceiroDTO,
  RegistrarDevolucaoDTO,
  StatusEmprestimo
} from '@/types/emprestimos-terceiros'
import { ItemEstoque, Base } from '@/types'

// Types for better type safety
interface HistoricoLog {
  id: string
  criado_em: string
  acao: string
  detalhes?: string
  status_anterior?: string
  status_novo?: string
  quantidade_anterior?: number
  quantidade_nova?: number
  usuario?: {
    nome?: string
    email?: string
  }
  emprestimo?: {
    numero_documento?: string
    empresa_terceira?: {
      razao_social?: string
    }
    item_estoque?: {
      nome?: string
      codigo?: string
    }
  }
}

interface User {
  id?: string
  nome?: string
  email?: string
}
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { 
  Building2, 
  PackagePlus, 
  ArrowLeftRight, 
  Undo2, 
  Eye, 
  Edit, 
  Plus,
  AlertTriangle,
  Loader2
} from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export function EmprestimosTerceirosContent() {
  const { user } = useAuth()
  const { notify } = useNotification()
  const { hasPermission } = useModularPermissions()

  const [loading, setLoading] = useState(true)
  const [empresas, setEmpresas] = useState<EmpresaTerceira[]>([])
  const [emprestimos, setEmprestimos] = useState<EmprestimoTerceiroAtivo[]>([])
  const [bases, setBases] = useState<Base[]>([])
  const [itensEstoque, setItensEstoque] = useState<ItemEstoque[]>([])
  const [historico, setHistorico] = useState<HistoricoLog[]>([])
  
  // Modais
  const [modalEmpresa, setModalEmpresa] = useState(false)
  const [modalEmprestimo, setModalEmprestimo] = useState(false)
  const [modalDevolucao, setModalDevolucao] = useState(false)
  
  const [empresaSelecionada, setEmpresaSelecionada] = useState<EmpresaTerceira | null>(null)
  const [emprestimoSelecionado, setEmprestimoSelecionado] = useState<EmprestimoTerceiroAtivo | null>(null)

  const carregarDados = useCallback(async () => {
    setLoading(true)
    try {
      await Promise.all([
        carregarEmpresas(),
        carregarEmprestimos(),
        carregarBases(),
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

  // Carregar dados
  useEffect(() => {
    carregarDados()
    
    // Listener para recarregar histórico
    const handleRecarregar = () => {
      carregarHistorico()
    }
    
    if (typeof window !== 'undefined') {
      window.addEventListener('recarregarHistorico', handleRecarregar)
      return () => window.removeEventListener('recarregarHistorico', handleRecarregar)
    }
  }, [carregarDados])

  const carregarEmpresas = async () => {
    const { data, error } = await supabase
      .from('empresas_terceiras')
      .select('*')
      .order('razao_social')
    
    if (error) throw error
    setEmpresas(data || [])
  }

  const carregarEmprestimos = async () => {
    const { data, error } = await supabase
      .from('vw_emprestimos_terceiros_ativos')
      .select('*')
      .order('data_emprestimo', { ascending: false })
    
    if (error) throw error
    setEmprestimos(data || [])
  }

  const carregarBases = async () => {
    const { data, error } = await supabase
      .from('bases')
      .select('*')
      .order('nome')
    
    if (error) throw error
    setBases(data || [])
  }

  const carregarItensEstoque = async () => {
    const { data, error } = await supabase
      .from('itens_estoque')
      .select('*')
      .eq('status', 'ativo')
      .order('nome')
    
    if (error) throw error
    setItensEstoque(data || [])
  }

  const carregarHistorico = async () => {
    const { data, error } = await supabase
      .from('historico_emprestimos_terceiros')
      .select(`
        *,
        usuario:usuarios!historico_emprestimos_terceiros_usuario_id_fkey(id, nome, email),
        emprestimo:emprestimos_terceiros!historico_emprestimos_terceiros_emprestimo_id_fkey(
          numero_documento,
          empresa_terceira:empresas_terceiras(razao_social),
          item_estoque:itens_estoque(nome, codigo)
        )
      `)
      .order('criado_em', { ascending: false })
      .limit(100)
    
    if (error) throw error
    setHistorico(data || [])
  }

  const getStatusBadge = (status: StatusEmprestimo) => {
    const colors = {
      ativo: 'default',
      devolvido: 'secondary',
      baixado: 'destructive',
      perdido: 'destructive',
      cancelado: 'outline'
    }
    
    const labels = {
      ativo: 'Ativo',
      devolvido: 'Devolvido',
      baixado: 'Baixado',
      perdido: 'Perdido',
      cancelado: 'Cancelado'
    }
    
    return <Badge variant={colors[status] as 'default' | 'secondary' | 'destructive' | 'outline'}>{labels[status]}</Badge>
  }

  const formatarCPF = (cpf: string) => {
    if (!cpf) return ''
    return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
  }

  const formatarData = (data: string) => {
    if (!data) return ''
    return new Date(data).toLocaleDateString('pt-BR')
  }

  // Estatísticas
  const emprestimosAtivos = emprestimos.filter(e => e.status === 'ativo')
  const emprestimosEmAtraso = emprestimosAtivos.filter(e => e.em_atraso)
  const emprestimosDevolvidos = emprestimos.filter(e => e.status === 'devolvido')

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
          <h1 className="text-3xl font-bold">Empréstimos para Empresas Terceiras</h1>
        </div>
        <p className="text-muted-foreground">
          Gerencie empréstimos e transferências de itens do almoxarifado para colaboradores de outras empresas
        </p>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="emprestimos" className="space-y-4">
        <TabsList>
          <TabsTrigger value="emprestimos" className="flex items-center gap-2">
            <PackagePlus className="w-4 h-4" />
            Empréstimos
          </TabsTrigger>
          <TabsTrigger value="empresas" className="flex items-center gap-2">
            <Building2 className="w-4 h-4" />
            Empresas
          </TabsTrigger>
          <TabsTrigger value="logs" className="flex items-center gap-2">
            <Eye className="w-4 h-4" />
            Logs
          </TabsTrigger>
        </TabsList>

        {/* Tab: Empréstimos */}
        <TabsContent value="emprestimos" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-semibold">Empréstimos e Transferências</h2>
            {hasPermission(EMPRESTIMOS_TERCEIROS_PERMISSIONS.CRIAR) && (
              <Button onClick={() => {
                setEmprestimoSelecionado(null)
                setModalEmprestimo(true)
              }}>
                <Plus className="w-4 h-4 mr-2" />
                Novo Empréstimo
              </Button>
            )}
          </div>

          {/* Estatísticas */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{emprestimos.length}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-green-600">Ativos</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{emprestimosAtivos.length}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-red-600">Em Atraso</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">{emprestimosEmAtraso.length}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-blue-600">Devolvidos</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">{emprestimosDevolvidos.length}</div>
              </CardContent>
            </Card>
          </div>

          {/* Alerta de atrasos */}
          {emprestimosEmAtraso.length > 0 && (
            <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              <span className="text-red-800 font-medium">
                Existem {emprestimosEmAtraso.length} empréstimo(s) em atraso!
              </span>
            </div>
          )}

          {/* Lista de Empréstimos */}
          {emprestimos.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground">
                Nenhum empréstimo registrado
              </CardContent>
            </Card>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-muted">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-medium">Documento</th>
                      <th className="px-4 py-3 text-left text-sm font-medium">Empresa</th>
                      <th className="px-4 py-3 text-left text-sm font-medium">Colaborador</th>
                      <th className="px-4 py-3 text-left text-sm font-medium">Item</th>
                      <th className="px-4 py-3 text-left text-sm font-medium">Qtd</th>
                      <th className="px-4 py-3 text-left text-sm font-medium">Data</th>
                      <th className="px-4 py-3 text-left text-sm font-medium">Previsão</th>
                      <th className="px-4 py-3 text-left text-sm font-medium">Responsável</th>
                      <th className="px-4 py-3 text-left text-sm font-medium">Status</th>
                      <th className="px-4 py-3 text-left text-sm font-medium">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {emprestimos.map((emprestimo) => (
                      <tr 
                        key={emprestimo.id}
                        className={emprestimo.em_atraso ? 'bg-red-50' : ''}
                      >
                        <td className="px-4 py-3">
                          <div className="font-medium">{emprestimo.numero_documento}</div>
                          <div className="text-xs text-muted-foreground">
                            {emprestimo.tipo_operacao === 'emprestimo' ? 'Empréstimo' : 'Transferência'}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium">{emprestimo.empresa_razao_social}</div>
                          <div className="text-xs text-muted-foreground">{emprestimo.empresa_cnpj}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div>{emprestimo.colaborador_nome}</div>
                          <div className="text-xs text-muted-foreground">
                            CPF: {formatarCPF(emprestimo.colaborador_cpf)}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div>{emprestimo.item_nome}</div>
                          <div className="text-xs text-muted-foreground">{emprestimo.item_codigo}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div>{emprestimo.quantidade_pendente}</div>
                          {emprestimo.quantidade_devolvida > 0 && (
                            <div className="text-xs text-muted-foreground">
                              ({emprestimo.quantidade_devolvida} devolvida)
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">{formatarData(emprestimo.data_emprestimo)}</td>
                        <td className="px-4 py-3">
                          {emprestimo.data_previsao_devolucao ? (
                            <div>
                              <div>{formatarData(emprestimo.data_previsao_devolucao)}</div>
                              {emprestimo.em_atraso && (
                                <Badge variant="destructive" className="text-xs mt-1">
                                  {emprestimo.dias_atraso} dia(s) de atraso
                                </Badge>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">N/A</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {emprestimo.responsavel_nome || 'N/A'}
                        </td>
                        <td className="px-4 py-3">{getStatusBadge(emprestimo.status)}</td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1">
                            {emprestimo.status === 'ativo' && emprestimo.tipo_operacao === 'emprestimo' && 
                             hasPermission(EMPRESTIMOS_TERCEIROS_PERMISSIONS.DEVOLVER) && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setEmprestimoSelecionado(emprestimo)
                                  setModalDevolucao(true)
                                }}
                              >
                                <Undo2 className="w-4 h-4" />
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                notify(`Empréstimo: ${emprestimo.numero_documento}`, 'info')
                              }}
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
                      <th className="px-4 py-3 text-left text-sm font-medium">Empréstimo</th>
                      <th className="px-4 py-3 text-left text-sm font-medium">Empresa</th>
                      <th className="px-4 py-3 text-left text-sm font-medium">Item</th>
                      <th className="px-4 py-3 text-left text-sm font-medium">Detalhes</th>
                      <th className="px-4 py-3 text-left text-sm font-medium">Usuário</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {historico.map((log: HistoricoLog) => (
                      <tr key={log.id}>
                        <td className="px-4 py-3 text-sm">
                          {new Date(log.criado_em).toLocaleString('pt-BR')}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={
                            log.acao === 'criacao' ? 'default' :
                            log.acao === 'devolucao_total' ? 'secondary' :
                            log.acao === 'devolucao_parcial' ? 'outline' :
                            log.acao === 'baixa' ? 'destructive' :
                            'outline'
                          }>
                            {log.acao === 'criacao' && 'Criação'}
                            {log.acao === 'devolucao_total' && 'Devolução Total'}
                            {log.acao === 'devolucao_parcial' && 'Devolução Parcial'}
                            {log.acao === 'baixa' && 'Baixa'}
                            {log.acao === 'cancelamento' && 'Cancelamento'}
                            {log.acao === 'atualizacao' && 'Atualização'}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-sm font-medium">
                          {log.emprestimo?.numero_documento || '-'}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {log.emprestimo?.empresa_terceira?.razao_social || '-'}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <div>{log.emprestimo?.item_estoque?.nome || '-'}</div>
                          <div className="text-xs text-muted-foreground">
                            {log.emprestimo?.item_estoque?.codigo || ''}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {log.detalhes || '-'}
                          {log.status_anterior && log.status_novo && (
                            <div className="text-xs text-muted-foreground mt-1">
                              {log.status_anterior} → {log.status_novo}
                            </div>
                          )}
                          {log.quantidade_anterior !== null && log.quantidade_nova !== null && (
                            <div className="text-xs text-muted-foreground mt-1">
                              Qtd: {log.quantidade_anterior} → {log.quantidade_nova}
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

        {/* Tab: Empresas */}
        <TabsContent value="empresas" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-semibold">Empresas Terceiras Cadastradas</h2>
            {hasPermission(EMPRESTIMOS_TERCEIROS_PERMISSIONS.GERENCIAR_EMPRESAS) && (
              <Button onClick={() => {
                setEmpresaSelecionada(null)
                setModalEmpresa(true)
              }}>
                <Plus className="w-4 h-4 mr-2" />
                Nova Empresa
              </Button>
            )}
          </div>

          {empresas.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground">
                Nenhuma empresa cadastrada. Clique em &quot;Nova Empresa&quot; para começar.
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {empresas.map((empresa) => (
                <Card key={empresa.id}>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <CardTitle className="text-lg">{empresa.razao_social}</CardTitle>
                      <Badge variant={empresa.ativo ? 'default' : 'outline'}>
                        {empresa.ativo ? 'Ativa' : 'Inativa'}
                      </Badge>
                    </div>
                    {empresa.nome_fantasia && (
                      <CardDescription>{empresa.nome_fantasia}</CardDescription>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {empresa.cnpj && (
                      <div className="text-sm">
                        <span className="font-medium">CNPJ:</span> {empresa.cnpj}
                      </div>
                    )}
                    {empresa.observacoes && (
                      <div className="text-sm">
                        <span className="font-medium">Observações:</span> {empresa.observacoes}
                      </div>
                    )}
                    {hasPermission(EMPRESTIMOS_TERCEIROS_PERMISSIONS.GERENCIAR_EMPRESAS) && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full mt-2"
                        onClick={() => {
                          setEmpresaSelecionada(empresa)
                          setModalEmpresa(true)
                        }}
                      >
                        <Edit className="w-4 h-4 mr-2" />
                        Editar
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Modal Empresa */}
      <ModalEmpresa
        open={modalEmpresa}
        onClose={() => {
          setModalEmpresa(false)
          setEmpresaSelecionada(null)
        }}
        empresa={empresaSelecionada}
        onSave={() => {
          carregarEmpresas()
          setModalEmpresa(false)
          setEmpresaSelecionada(null)
        }}
        notify={notify}
        supabase={supabase}
      />

      {/* Modal Empréstimo */}
      <ModalEmprestimo
        open={modalEmprestimo}
        onClose={() => {
          setModalEmprestimo(false)
          setEmprestimoSelecionado(null)
        }}
        empresas={empresas}
        bases={bases}
        itensEstoque={itensEstoque}
        onSave={() => {
          carregarEmprestimos()
          setModalEmprestimo(false)
        }}
        notify={notify}
        supabase={supabase}
        user={user}
      />

      {/* Modal Devolução */}
      <ModalDevolucao
        open={modalDevolucao}
        onClose={() => {
          setModalDevolucao(false)
          setEmprestimoSelecionado(null)
        }}
        emprestimo={emprestimoSelecionado}
        onSave={() => {
          carregarEmprestimos()
          setModalDevolucao(false)
          setEmprestimoSelecionado(null)
        }}
        notify={notify}
        supabase={supabase}
        user={user}
      />
    </div>
  )
}

// Modal Empresa
interface ModalEmpresaProps {
  open: boolean
  onClose: () => void
  empresa: EmpresaTerceira | null
  onSave: () => void
  notify: (message: string, type: 'success' | 'error' | 'info') => void
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any
}

function ModalEmpresa({ open, onClose, empresa, onSave, notify, supabase }: ModalEmpresaProps) {
  const [formData, setFormData] = useState<CriarEmpresaTerceiraDTO>({
    razao_social: '',
    nome_fantasia: '',
    cnpj: '',
    observacoes: ''
  })
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    if (empresa) {
      setFormData({
        razao_social: empresa.razao_social || '',
        nome_fantasia: empresa.nome_fantasia || '',
        cnpj: empresa.cnpj || '',
        observacoes: empresa.observacoes || ''
      })
    } else {
      setFormData({
        razao_social: '',
        nome_fantasia: '',
        cnpj: '',
        observacoes: ''
      })
    }
  }, [empresa, open])

  const handleSalvar = async () => {
    if (!formData.razao_social) {
      notify('Preencha a razão social', 'error')
      return
    }

    setSalvando(true)
    try {
      if (empresa) {
        // Ao editar, criar objeto de update sem o CNPJ se não foi alterado
        const updateData: Partial<CriarEmpresaTerceiraDTO> = {
          razao_social: formData.razao_social,
          nome_fantasia: formData.nome_fantasia || undefined,
          observacoes: formData.observacoes || undefined
        }
        
        // Só incluir CNPJ se foi alterado
        if (formData.cnpj !== empresa.cnpj) {
          updateData.cnpj = formData.cnpj ? formData.cnpj.trim() : undefined
        }
        
        const { error } = await supabase
          .from('empresas_terceiras')
          .update(updateData)
          .eq('id', empresa.id)
        
        if (error) throw error
        notify('Empresa atualizada com sucesso', 'success')
      } else {
        // Ao criar, preparar dados e não enviar CNPJ se estiver vazio
        const insertData: Record<string, string | null> = {
          razao_social: formData.razao_social,
          nome_fantasia: formData.nome_fantasia || null,
          observacoes: formData.observacoes || null
        }
        
        // Só incluir CNPJ se foi preenchido
        if (formData.cnpj && formData.cnpj.trim() !== '') {
          insertData.cnpj = formData.cnpj.trim()
        }
        
        const { error } = await supabase
          .from('empresas_terceiras')
          .insert([insertData])
        
        if (error) throw error
        notify('Empresa cadastrada com sucesso', 'success')
      }
      
      onSave()
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido'
      notify(`Erro ao salvar: ${errorMessage}`, 'error')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{empresa ? 'Editar Empresa' : 'Nova Empresa Terceira'}</DialogTitle>
          <DialogDescription>
            Preencha as informações da empresa terceira
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="razao_social">Razão Social *</Label>
            <Input
              id="razao_social"
              value={formData.razao_social}
              onChange={(e) => setFormData({ ...formData, razao_social: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="nome_fantasia">Nome Fantasia</Label>
            <Input
              id="nome_fantasia"
              value={formData.nome_fantasia}
              onChange={(e) => setFormData({ ...formData, nome_fantasia: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="cnpj">CNPJ</Label>
            <Input
              id="cnpj"
              value={formData.cnpj}
              onChange={(e) => setFormData({ ...formData, cnpj: e.target.value })}
              placeholder="00.000.000/0000-00"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="observacoes">Observações</Label>
            <Textarea
              id="observacoes"
              value={formData.observacoes}
              onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
              rows={4}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSalvar} disabled={salvando}>
            {salvando && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Modal Empréstimo
interface ModalEmprestimoProps {
  open: boolean
  onClose: () => void
  empresas: EmpresaTerceira[]
  bases: Base[]
  itensEstoque: ItemEstoque[]
  onSave: () => void
  notify: (message: string, type: 'success' | 'error' | 'info') => void
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any
  user: User | null
}

function ModalEmprestimo({ open, onClose, empresas, bases, itensEstoque, onSave, notify, supabase, user }: ModalEmprestimoProps) {
  const [formData, setFormData] = useState<CriarEmprestimoTerceiroDTO>({
    empresa_terceira_id: '',
    item_estoque_id: '',
    base_id: '',
    colaborador_nome: '',
    colaborador_cpf: '',
    colaborador_telefone: '',
    colaborador_funcao: '',
    tipo_operacao: 'emprestimo',
    quantidade: 1,
    motivo: '',
    projeto_obra: '',
    documento_referencia: '',
    condicao_entrega: 'novo',
    observacoes_entrega: ''
  })
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    if (!open) {
      setFormData({
        empresa_terceira_id: '',
        item_estoque_id: '',
        base_id: '',
        colaborador_nome: '',
        colaborador_cpf: '',
        colaborador_telefone: '',
        colaborador_funcao: '',
        tipo_operacao: 'emprestimo',
        quantidade: 1,
        motivo: '',
        projeto_obra: '',
        documento_referencia: '',
        condicao_entrega: 'novo',
        observacoes_entrega: ''
      })
    }
  }, [open])

  const handleSalvar = async () => {
    if (!formData.empresa_terceira_id || !formData.item_estoque_id || 
        !formData.base_id || !formData.colaborador_nome || 
        !formData.colaborador_cpf || !formData.motivo) {
      notify('Preencha todos os campos obrigatórios', 'error')
      return
    }

    setSalvando(true)
    try {
      const { data: numeroData, error: numeroError } = await supabase
        .rpc('gerar_numero_emprestimo_terceiro')
      
      if (numeroError) throw numeroError

      const { error } = await supabase
        .from('emprestimos_terceiros')
        .insert([{
          ...formData,
          numero_documento: numeroData,
          usuario_responsavel_id: user?.id
        }])
      
      if (error) throw error
      
      notify(`Empréstimo registrado - Documento: ${numeroData}`, 'success')
      
      onSave()
      
      // Recarregar histórico
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('recarregarHistorico'))
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido'
      notify(`Erro ao registrar: ${errorMessage}`, 'error')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo Empréstimo/Transferência</DialogTitle>
          <DialogDescription>
            Registre um empréstimo ou transferência de item para empresa terceira
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Tipo de Operação *</Label>
            <Select
              value={formData.tipo_operacao}
              onValueChange={(value: 'emprestimo' | 'transferencia') => setFormData({ ...formData, tipo_operacao: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="emprestimo">Empréstimo (item será devolvido)</SelectItem>
                <SelectItem value="transferencia">Transferência (item não retorna)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Empresa Terceira *</Label>
            <Select
              value={formData.empresa_terceira_id}
              onValueChange={(value) => setFormData({ ...formData, empresa_terceira_id: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                {empresas.filter((e: EmpresaTerceira) => e.ativo).map((empresa: EmpresaTerceira) => (
                  <SelectItem key={empresa.id} value={empresa.id}>
                    {empresa.razao_social} ({empresa.cnpj})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Base *</Label>
            <Select
              value={formData.base_id}
              onValueChange={(value) => setFormData({ ...formData, base_id: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                {bases.map((base: Base) => (
                  <SelectItem key={base.id} value={base.id}>{base.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Item do Estoque *</Label>
            <SearchableSelect
              items={itensEstoque.map((item: ItemEstoque) => ({
                id: item.id,
                nome: `${item.nome} (${item.codigo}) - Estoque: ${item.estoque_atual}`,
                codigo: item.codigo,
                categoria: item.categoria
              }))}
              value={formData.item_estoque_id}
              onValueChange={(value) => setFormData({ ...formData, item_estoque_id: value })}
              placeholder="Digite para buscar o item..."
              className="w-full"
            />
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

          <div className="border-t pt-4 space-y-4">
            <h3 className="font-semibold">Colaborador Terceiro</h3>
            
            <div className="space-y-2">
              <Label>Nome Completo *</Label>
              <Input
                value={formData.colaborador_nome}
                onChange={(e) => setFormData({ ...formData, colaborador_nome: e.target.value })}
                placeholder="Nome completo"
              />
            </div>

            <div className="space-y-2">
              <Label>CPF *</Label>
              <Input
                value={formData.colaborador_cpf}
                onChange={(e) => setFormData({ ...formData, colaborador_cpf: e.target.value })}
                placeholder="000.000.000-00"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Telefone</Label>
                <Input
                  value={formData.colaborador_telefone}
                  onChange={(e) => setFormData({ ...formData, colaborador_telefone: e.target.value })}
                  placeholder="(00) 00000-0000"
                />
              </div>
              <div className="space-y-2">
                <Label>Função</Label>
                <Input
                  value={formData.colaborador_funcao}
                  onChange={(e) => setFormData({ ...formData, colaborador_funcao: e.target.value })}
                  placeholder="Ex: Técnico"
                />
              </div>
            </div>
          </div>

          <div className="border-t pt-4 space-y-4">
            <div className="space-y-2">
              <Label>Motivo *</Label>
              <Textarea
                value={formData.motivo}
                onChange={(e) => setFormData({ ...formData, motivo: e.target.value })}
                placeholder="Descreva o motivo"
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label>Projeto/Obra</Label>
              <Input
                value={formData.projeto_obra}
                onChange={(e) => setFormData({ ...formData, projeto_obra: e.target.value })}
              />
            </div>

            {formData.tipo_operacao === 'emprestimo' && (
              <div className="space-y-2">
                <Label>Data Prevista de Devolução</Label>
                <Input
                  type="date"
                  value={formData.data_previsao_devolucao}
                  onChange={(e) => setFormData({ ...formData, data_previsao_devolucao: e.target.value })}
                />
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSalvar} disabled={salvando}>
            {salvando && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Registrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Modal Devolução
interface ModalDevolucaoProps {
  open: boolean
  onClose: () => void
  emprestimo: EmprestimoTerceiroAtivo | null
  onSave: () => void
  notify: (message: string, type: 'success' | 'error' | 'info') => void
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any
  user: User | null
}

function ModalDevolucao({ open, onClose, emprestimo, onSave, notify, supabase, user }: ModalDevolucaoProps) {
  const [formData, setFormData] = useState<RegistrarDevolucaoDTO>({
    emprestimo_id: '',
    quantidade_devolvida: 0,
    condicao_devolucao: 'usado_bom',
    observacoes_devolucao: ''
  })
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    if (emprestimo && open) {
      setFormData({
        emprestimo_id: emprestimo.id,
        quantidade_devolvida: emprestimo.quantidade_pendente,
        condicao_devolucao: 'usado_bom',
        observacoes_devolucao: ''
      })
    }
  }, [emprestimo, open])

  const handleSalvar = async () => {
    if (!formData.quantidade_devolvida || formData.quantidade_devolvida <= 0) {
      notify('Informe a quantidade devolvida', 'error')
      return
    }

    setSalvando(true)
    try {
      const novaQuantidadeDevolvida = (emprestimo?.quantidade_devolvida || 0) + formData.quantidade_devolvida
      const quantidadeTotal = emprestimo?.quantidade || 0
      const novoStatus = novaQuantidadeDevolvida >= quantidadeTotal ? 'devolvido' : 'ativo'

      const { error } = await supabase
        .from('emprestimos_terceiros')
        .update({
          quantidade_devolvida: novaQuantidadeDevolvida,
          data_devolucao_real: formData.data_devolucao || new Date().toISOString().split('T')[0],
          condicao_devolucao: formData.condicao_devolucao,
          observacoes_devolucao: formData.observacoes_devolucao,
          status: novoStatus,
          recebido_por_id: user?.id
        })
        .eq('id', formData.emprestimo_id)
      
      if (error) throw error
      
      notify(
        novoStatus === 'devolvido' 
          ? 'Empréstimo totalmente devolvido' 
          : 'Devolução parcial registrada',
        'success'
      )
      
      onSave()
      
      // Recarregar histórico
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('recarregarHistorico'))
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido'
      notify(`Erro ao registrar devolução: ${errorMessage}`, 'error')
    } finally {
      setSalvando(false)
    }
  }

  if (!emprestimo) return null

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar Devolução</DialogTitle>
          <DialogDescription>
            Registre a devolução do empréstimo {emprestimo.numero_documento}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="font-semibold">Empréstimo: {emprestimo.numero_documento}</div>
            <div className="text-sm text-muted-foreground">
              Quantidade pendente: {emprestimo.quantidade_pendente} {emprestimo.unidade_medida}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Quantidade Devolvida *</Label>
            <Input
              type="number"
              min={0}
              max={emprestimo.quantidade_pendente}
              value={formData.quantidade_devolvida}
              onChange={(e) => setFormData({ ...formData, quantidade_devolvida: parseFloat(e.target.value) })}
            />
            <p className="text-xs text-muted-foreground">
              Máximo: {emprestimo.quantidade_pendente}
            </p>
          </div>

          <div className="space-y-2">
            <Label>Condição do Item *</Label>
            <Select
              value={formData.condicao_devolucao}
              onValueChange={(value: 'novo' | 'usado_bom' | 'usado_regular' | 'usado_ruim' | 'danificado' | 'inutilizavel') => setFormData({ ...formData, condicao_devolucao: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="novo">Novo</SelectItem>
                <SelectItem value="usado_bom">Usado - Bom estado</SelectItem>
                <SelectItem value="usado_regular">Usado - Estado regular</SelectItem>
                <SelectItem value="usado_ruim">Usado - Estado ruim</SelectItem>
                <SelectItem value="danificado">Danificado</SelectItem>
                <SelectItem value="inutilizavel">Inutilizável</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Data da Devolução</Label>
            <Input
              type="date"
              value={formData.data_devolucao || new Date().toISOString().split('T')[0]}
              onChange={(e) => setFormData({ ...formData, data_devolucao: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea
              value={formData.observacoes_devolucao}
              onChange={(e) => setFormData({ ...formData, observacoes_devolucao: e.target.value })}
              placeholder="Descreva o estado do item"
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSalvar} disabled={salvando}>
            {salvando && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Confirmar Devolução
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}