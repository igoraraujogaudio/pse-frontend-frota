'use client'

import React, { useEffect, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useAuth } from '@/contexts/AuthContext'
import { duplaAprovacaoService } from '@/services/duplaAprovacaoService'
import type { SolicitacaoItemDuplaAprovacao, Base } from '@/types'

import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { useNotification } from '@/contexts/NotificationContext'
import { X, CheckCircle, Loader2, Eye } from 'lucide-react'
import { PERMISSION_CODES } from '@/hooks/useModularPermissions'
import ProtectedRoute from '@/components/ProtectedRoute'
import { DateFilter, DateFilterType } from '@/components/ui/date-filter'
import Image from 'next/image'
import { SignatureRenderer } from '@/components/SignatureRenderer'
import { supabase } from '@/lib/supabase'

type StatusFilter = 'todas' | 'pendente' | 'aprovada' | 'rejeitada' | 'aguardando_estoque' | 'entregue' | 'devolvida'
type TipoAprovacaoFilter = 'todas' | 'pendente_sesmt' | 'aprovada_sesmt' | 'dupla_completa'

export default function SESMTAprovacaoPage() {
  return (
    <ProtectedRoute requiredPermissions={[
      PERMISSION_CODES.SESMT.APROVAR_SOLICITACOES_SESMT,
      PERMISSION_CODES.SESMT.VISUALIZAR_SOLICITACOES_SESMT,
    ]}>
      <SESMTAprovacaoContent />
    </ProtectedRoute>
  );
}

function SESMTAprovacaoContent() {
  const { user, loading } = useAuth()
  const { notify } = useNotification()

  // ===== PADRÃO PORTARIA: sessionReady + filters objeto único =====
  const [sessionReady, setSessionReady] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(50)

  // Filtros como objeto único (padrão portaria)
  const [filters, setFilters] = useState({
    status: 'todas' as StatusFilter,
    tipoAprovacao: 'todas' as TipoAprovacaoFilter,
    search: '',
    baseId: 'todas',
    contratoId: 'todos',
    dataInicio: '',
    dataFim: '',
  })

  // Debounce do search
  const [debouncedSearch, setDebouncedSearch] = useState(filters.search)
  const loadingRef = React.useRef(false)
  const authUserIdRef = React.useRef<string | null>(null)
  useEffect(() => {
    if (filters.search === debouncedSearch) return
    const timer = setTimeout(() => setDebouncedSearch(filters.search), 500)
    return () => clearTimeout(timer)
  }, [filters.search, debouncedSearch])

  // Compat aliases
  const statusFilter = filters.status
  const tipoAprovacaoFilter = filters.tipoAprovacao
  const setStatusFilter = (v: StatusFilter) => setFilters(prev => ({ ...prev, status: v }))
  const setTipoAprovacaoFilter = (v: TipoAprovacaoFilter) => setFilters(prev => ({ ...prev, tipoAprovacao: v }))
  const selectedBase = filters.baseId
  const setSelectedBase = (v: string) => setFilters(prev => ({ ...prev, baseId: v }))

  // Bases e contratos para dropdowns
  const [bases, setBases] = useState<Base[]>([])
  const [, setContratos] = useState<Array<{ id: string; nome: string }>>([])

  // Estados do filtro de data
  const [dateFilter, setDateFilter] = useState<DateFilterType>('todos')
  const [dateRange, setDateRange] = useState<{ start: Date; end: Date }>(() => {
    const today = new Date()
    return {
      start: today,
      end: new Date(today.getTime() + 24 * 60 * 60 * 1000 - 1)
    }
  })

  // ===== DADOS VIA API =====
  const [apiData, setApiData] = useState<SolicitacaoItemDuplaAprovacao[]>([])
  const [apiStats, setApiStats] = useState({ total: 0, pendente_sesmt: 0, aprovada_sesmt: 0, dupla_completa: 0, rejeitada: 0 })
  const [apiPagination, setApiPagination] = useState({ page: 1, pageSize: 50, total: 0 })
  const [solicitacoesLoading, setSolicitacoesLoading] = useState(false)

  const [selected, setSelected] = useState<SolicitacaoItemDuplaAprovacao | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [approveOpen, setApproveOpen] = useState(false)
  const [rejectOpen, setRejectOpen] = useState(false)
  const [approveObs, setApproveObs] = useState('')
  const [rejectMotivo, setRejectMotivo] = useState('')

  // Verificar sessão e carregar bases/contratos
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      authUserIdRef.current = session.user.id

      try {
        const { data: userData } = await supabase
          .from('usuarios')
          .select('id')
          .eq('auth_usuario_id', session.user.id)
          .single()
        if (!userData) { setSessionReady(true); return }

        // Contratos + bases do usuário em paralelo
        const [{ data: userContracts }, { data: userBasesData }] = await Promise.all([
          supabase.from('usuario_contratos').select('contrato_id, contratos(id, nome)').eq('usuario_id', userData.id).eq('ativo', true),
          supabase.from('usuario_bases').select('base_id').eq('usuario_id', userData.id).eq('ativo', true),
        ])

        if (userContracts) {
          const contractsList = userContracts.map(uc => uc.contratos).filter(Boolean).map(c => Array.isArray(c) ? c[0] : c)
          setContratos(contractsList as Array<{ id: string; nome: string }>)
          const contractIds = userContracts.map(uc => uc.contrato_id)
          const { data: basesData } = await supabase
            .from('bases').select('id, nome, codigo, ativa, contrato_id')
            .in('contrato_id', contractIds.length > 0 ? contractIds : ['00000000-0000-0000-0000-000000000000'])
            .eq('ativa', true).order('nome')

          const basesFromContracts = basesData || []
          const directBaseIds = (userBasesData || []).map(ub => ub.base_id)
          const missingIds = directBaseIds.filter(id => !basesFromContracts.some(b => b.id === id))
          if (missingIds.length > 0) {
            const { data: extraBases } = await supabase
              .from('bases').select('id, nome, codigo, ativa, contrato_id')
              .in('id', missingIds).eq('ativa', true)
            if (extraBases) basesFromContracts.push(...extraBases)
          }
          setBases(basesFromContracts as Base[])
        }
      } catch (error) {
        console.error('Erro ao carregar filtros:', error)
      }
      setSessionReady(true)
    }
    checkSession()
  }, [])

  // loadDataFromApi: inclui filtros no useCallback
  const loadDataFromApi = React.useCallback(async (pageNum: number) => {
    if (loadingRef.current || !authUserIdRef.current) return
    loadingRef.current = true
    setSolicitacoesLoading(true)
    try {
      const params = new URLSearchParams({
        userId: authUserIdRef.current,
        page: String(pageNum),
        pageSize: String(pageSize),
        tipoAprovacao: filters.tipoAprovacao,
        ...(filters.status !== 'todas' && { status: filters.status }),
        ...(debouncedSearch && { search: debouncedSearch }),
        ...(filters.baseId !== 'todas' && { baseId: filters.baseId }),
        ...(filters.contratoId !== 'todos' && { contratoId: filters.contratoId }),
        ...(filters.dataInicio && { dataInicio: new Date(filters.dataInicio).toISOString() }),
        ...(filters.dataFim && { dataFim: new Date(filters.dataFim + 'T23:59:59').toISOString() }),
      })
      const response = await fetch(`/api/sesmt/aprovacao?${params}`)
      if (!response.ok) throw new Error('Erro ao buscar dados')
      const result = await response.json()
      setApiData(result.data || [])
      setApiStats(result.stats || { total: 0, pendente_sesmt: 0, aprovada_sesmt: 0, dupla_completa: 0, rejeitada: 0 })
      setApiPagination(result.pagination || { page: pageNum, pageSize, total: 0 })
    } catch (error) {
      console.error('❌ Erro ao buscar solicitações SESMT:', error)
    } finally {
      setSolicitacoesLoading(false)
      loadingRef.current = false
    }
  }, [filters, debouncedSearch, pageSize])

  // TRIGGER DE CARGA
  useEffect(() => {
    if (sessionReady) {
      setPage(1)
      loadDataFromApi(1)
    }
  }, [loadDataFromApi, sessionReady])

  // Alias para compatibilidade
  const solicitacoes = apiData
  const isLoading = solicitacoesLoading

  // Filtros agora são aplicados server-side pela API
  const filteredSolicitacoes = solicitacoes
  const paginatedSolicitacoes = filteredSolicitacoes

  // Mutação para aprovar no SESMT
  const approveMutation = useMutation({
    mutationFn: async (params: { id: string; observacoes: string }) => {
      if (!user) throw new Error('Usuário não encontrado')
      
      return await duplaAprovacaoService.aprovarSESMT({
        solicitacaoId: params.id,
        aprovadorId: user.id,
        observacoes: params.observacoes
      })
    },
    onSuccess: () => {
      loadDataFromApi(page)
      notify('Solicitação aprovada pelo SESMT com sucesso!', 'success')
      setApproveOpen(false)
      setSelected(null)
      setApproveObs('')
    },
    onError: (error: Error) => {
      console.error('Erro ao aprovar:', error)
      notify(error.message || 'Erro ao aprovar solicitação', 'error')
    }
  })

  // Mutação para rejeitar
  const rejectMutation = useMutation({
    mutationFn: async (params: { id: string; motivo: string }) => {
      if (!user) throw new Error('Usuário não encontrado')
      
      return await duplaAprovacaoService.rejeitarSolicitacao({
        solicitacaoId: params.id,
        rejeitadorId: user.id,
        motivo: params.motivo,
        tipoRejeicao: 'sesmt'
      })
    },
    onSuccess: () => {
      loadDataFromApi(page)
      notify('Solicitação rejeitada com sucesso!', 'success')
      setRejectOpen(false)
      setSelected(null)
      setRejectMotivo('')
    },
    onError: (error: Error) => {
      console.error('Erro ao rejeitar:', error)
      notify(error.message || 'Erro ao rejeitar solicitação', 'error')
    }
  })

  // Função para aprovar
  async function doApprove() {
    if (!selected || !user) return
    
    // Verificar permissões
    const temPermissao = await duplaAprovacaoService.verificarPermissaoAprovacao(user.id, 'sesmt')
    if (!temPermissao) {
      notify('Você não tem permissão para aprovar solicitações no SESMT', 'error')
      return
    }
    
    if (!approveObs || approveObs.trim() === '') {
      notify('Observações são obrigatórias para aprovação no SESMT', 'error')
      return
    }

    approveMutation.mutate({
      id: selected.id,
      observacoes: approveObs
    })
  }

  // Função para rejeitar
  async function doReject() {
    if (!selected || !user) return
    
    if (!rejectMotivo || rejectMotivo.trim() === '') {
      notify('Motivo da rejeição é obrigatório', 'error')
      return
    }

    rejectMutation.mutate({
      id: selected.id,
      motivo: rejectMotivo
    })
  }




  const handleDateFilterChange = (filter: DateFilterType) => {
    setDateFilter(filter)
    
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    
    let start: Date
    let end: Date
    
    switch (filter) {
      case 'todos':
        setFilters(prev => ({ ...prev, dataInicio: '', dataFim: '' }))
        return
      case 'periodo':
        return
      case 'hoje':
        start = today
        end = new Date(today.getTime() + 24 * 60 * 60 * 1000 - 1)
        break
      case '7dias':
        start = new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000)
        end = new Date(today.getTime() + 24 * 60 * 60 * 1000 - 1)
        break
      case '1mes':
        start = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)
        end = new Date(today.getTime() + 24 * 60 * 60 * 1000 - 1)
        break
      case '6meses':
        start = new Date(today.getTime() - 180 * 24 * 60 * 60 * 1000)
        end = new Date(today.getTime() + 24 * 60 * 60 * 1000 - 1)
        break
      case '1ano':
        start = new Date(today.getTime() - 365 * 24 * 60 * 60 * 1000)
        end = new Date(today.getTime() + 24 * 60 * 60 * 1000 - 1)
        break
      default:
        start = today
        end = new Date(today.getTime() + 24 * 60 * 60 * 1000 - 1)
    }
    
    setDateRange({ start, end })
    setFilters(prev => ({ ...prev, dataInicio: start.toISOString().slice(0, 10), dataFim: end.toISOString().slice(0, 10) }))
  }

  const handleDateRangeChange = (start: Date, end: Date) => {
    setDateRange({ start, end })
    setFilters(prev => ({ ...prev, dataInicio: start.toISOString().slice(0, 10), dataFim: end.toISOString().slice(0, 10) }))
  }

  // Estatísticas do servidor
  const stats = {
    total: apiStats.total,
    pendentesSESMT: apiStats.pendente_sesmt,
    aprovadasSESMT: apiStats.aprovada_sesmt,
    duplaCompleta: apiStats.dupla_completa,
    rejeitadas: apiStats.rejeitada
  }

  if (loading || !sessionReady) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto" />
          <p className="mt-4 text-gray-600">Carregando...</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="max-w-7xl mx-auto px-4 py-8 space-y-4">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">SESMT - Aprovação de Solicitações</h1>
          <p className="text-sm text-muted-foreground">Aprove solicitações de EPI e materiais de segurança</p>
        </div>

        {/* Stats Cards - mesmo padrão da página de solicitações */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Card onClick={() => { setTipoAprovacaoFilter('pendente_sesmt'); setPage(1) }} className="hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader className="pb-2">
              <CardDescription className="text-xs font-medium text-gray-600">PENDENTES SESMT</CardDescription>
              <CardTitle className="text-xl text-amber-600">{stats.pendentesSESMT}</CardTitle>
            </CardHeader>
          </Card>
          <Card onClick={() => { setTipoAprovacaoFilter('aprovada_sesmt'); setPage(1) }} className="hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader className="pb-2">
              <CardDescription className="text-xs font-medium text-gray-600">APROVADAS SESMT</CardDescription>
              <CardTitle className="text-xl text-blue-600">{stats.aprovadasSESMT}</CardTitle>
            </CardHeader>
          </Card>
          <Card onClick={() => { setTipoAprovacaoFilter('dupla_completa'); setPage(1) }} className="hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader className="pb-2">
              <CardDescription className="text-xs font-medium text-gray-600">DUPLA COMPLETA</CardDescription>
              <CardTitle className="text-xl text-emerald-600">{stats.duplaCompleta}</CardTitle>
            </CardHeader>
          </Card>
          <Card onClick={() => { setStatusFilter('rejeitada'); setPage(1) }} className="hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader className="pb-2">
              <CardDescription className="text-xs font-medium text-gray-600">REJEITADAS</CardDescription>
              <CardTitle className="text-xl text-red-600">{stats.rejeitadas}</CardTitle>
            </CardHeader>
          </Card>
          <Card onClick={() => { setTipoAprovacaoFilter('todas'); setStatusFilter('todas'); setPage(1) }} className="hover:shadow-md transition-shadow cursor-pointer border-2 border-blue-200">
            <CardHeader className="pb-2">
              <CardDescription className="text-xs font-medium text-gray-600">TOTAL</CardDescription>
              <CardTitle className="text-xl text-blue-600">{stats.total}</CardTitle>
            </CardHeader>
          </Card>
        </div>

        {/* DateFilter + Atualizar */}
        <div className="bg-white rounded-lg border border-gray-200 p-2 shadow-sm flex flex-wrap items-center gap-2">
          <DateFilter
            selectedFilter={dateFilter}
            onFilterChange={handleDateFilterChange}
            onDateRangeChange={handleDateRangeChange}
            startDate={dateRange.start}
            endDate={dateRange.end}
          />
          <div className="h-6 w-px bg-gray-200 hidden sm:block" />
          <Button variant="outline" size="sm" onClick={() => loadDataFromApi(page)} disabled={isLoading}>
            {isLoading ? 'Atualizando...' : 'Atualizar'}
          </Button>
        </div>

        {/* Inline filters - mesmo padrão da página de solicitações */}
        <div className="flex flex-wrap items-center gap-2">
          <Input
            className="w-full max-w-md"
            placeholder="Buscar por item, solicitante, destinatário, base..."
            value={filters.search}
            onChange={e => setFilters(prev => ({ ...prev, search: e.target.value }))}
          />

          <Select value={tipoAprovacaoFilter} onValueChange={(v: TipoAprovacaoFilter) => setTipoAprovacaoFilter(v)}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Tipo Aprovação" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas</SelectItem>
              <SelectItem value="pendente_sesmt">Pendentes SESMT</SelectItem>
              <SelectItem value="aprovada_sesmt">Aprovadas SESMT</SelectItem>
              <SelectItem value="dupla_completa">Dupla Completa</SelectItem>
            </SelectContent>
          </Select>

          <Select value={selectedBase} onValueChange={setSelectedBase}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Base" />
            </SelectTrigger>
            <SelectContent>
              {bases.length > 1 && (
                <SelectItem value="todas">Todas as Bases ({bases.length})</SelectItem>
              )}
              {bases.map(base => (
                <SelectItem key={base.id} value={base.id}>{base.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas</SelectItem>
              <SelectItem value="pendente">Pendentes</SelectItem>
              <SelectItem value="aprovada">Aprovadas</SelectItem>
              <SelectItem value="rejeitada">Rejeitadas</SelectItem>
              <SelectItem value="aguardando_estoque">Aguardando Estoque</SelectItem>
              <SelectItem value="entregue">Entregues</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Contador e loading */}
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-600">
            {isLoading ? 'Carregando...' : `${apiPagination.total} solicitações encontradas`}
          </div>
          <div className="text-xs text-gray-500">
            Página {page} de {Math.max(1, Math.ceil(apiPagination.total / pageSize))}
          </div>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          </div>
        )}

        {/* Tabela de solicitações - mesmo padrão leve da página de solicitações */}
        {!isLoading && paginatedSolicitacoes.length > 0 && (
          <div className="border rounded-lg overflow-hidden bg-white">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left p-2 font-medium text-gray-600">Nº</th>
                  <th className="text-left p-2 font-medium text-gray-600">Item</th>
                  <th className="text-center p-2 font-medium text-gray-600">Qtd</th>
                  <th className="text-left p-2 font-medium text-gray-600">Tipo</th>
                  <th className="text-left p-2 font-medium text-gray-600">Destinatário</th>
                  <th className="text-left p-2 font-medium text-gray-600">Base</th>
                  <th className="text-left p-2 font-medium text-gray-600">Status</th>
                  <th className="text-left p-2 font-medium text-gray-600">Aprovação</th>
                  <th className="text-left p-2 font-medium text-gray-600">Data</th>
                  <th className="text-center p-2 font-medium text-gray-600"></th>
                </tr>
              </thead>
              <tbody>
                {paginatedSolicitacoes.map(s => (
                  <tr
                    key={s.id}
                    className="border-b hover:bg-blue-50 cursor-pointer transition-colors"
                    onClick={() => { setSelected(s); setDetailOpen(true) }}
                  >
                    <td className="p-2 text-xs text-gray-500">{s.numero_solicitacao || '-'}</td>
                    <td className="p-2">
                      <div className="font-medium text-gray-900">{s.item?.nome || s.item_nome || 'Item'}</div>
                      {(s.item?.codigo || s.item_codigo) && <div className="text-xs text-gray-500">{s.item?.codigo || s.item_codigo}</div>}
                      {s.motivo_solicitacao && <div className="text-xs text-gray-400 truncate max-w-[180px]" title={s.motivo_solicitacao}>{s.motivo_solicitacao}</div>}
                    </td>
                    <td className="p-2 text-center">
                      <div className="text-xs">
                        <span className="font-bold">{s.quantidade_solicitada}</span>
                        {s.quantidade_aprovada ? <span className="text-green-600 ml-1">/{s.quantidade_aprovada}</span> : null}
                        {s.quantidade_entregue ? <span className="text-purple-600 ml-1">/{s.quantidade_entregue}</span> : null}
                      </div>
                    </td>
                    <td className="p-2">
                      <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                        s.tipo_troca === 'fornecimento' ? 'bg-green-100 text-green-700' :
                        s.tipo_troca === 'troca' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'
                      }`}>{s.tipo_troca === 'fornecimento' ? 'Forn.' : s.tipo_troca === 'troca' ? 'Troca' : 'Desc.'}</span>
                    </td>
                    <td className="p-2">
                      {s.destinatario_equipe ? (
                        <div>
                          <div className="text-xs font-medium text-orange-700">{s.destinatario_equipe.nome}</div>
                          {s.responsavel_equipe && <div className="text-xs text-blue-600">{s.responsavel_equipe.nome}</div>}
                        </div>
                      ) : (
                        <div>
                          <div className="text-xs">{s.destinatario?.nome || s.destinatario_nome || '-'}</div>
                          {s.destinatario?.matricula && <div className="text-xs text-gray-400">({s.destinatario.matricula})</div>}
                        </div>
                      )}
                    </td>
                    <td className="p-2 text-xs">{s.base_destino?.nome || s.base_nome || '-'}</td>
                    <td className="p-2">
                      <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${
                        s.status === 'pendente' ? 'bg-yellow-100 text-yellow-700' :
                        s.status === 'aprovada' ? 'bg-green-100 text-green-700' :
                        s.status === 'entregue' ? 'bg-purple-100 text-purple-700' :
                        s.status === 'rejeitada' ? 'bg-red-100 text-red-700' :
                        s.status === 'aguardando_estoque' ? 'bg-orange-100 text-orange-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>{s.status === 'pendente' && !s.aprovado_sesmt_por ? 'Pendente SESMT' : s.status}</span>
                    </td>
                    <td className="p-2">
                      <div className="flex items-center gap-1">
                        <span className={`w-2 h-2 rounded-full ${s.aprovado_almoxarifado_por ? 'bg-green-500' : 'bg-gray-300'}`} title={s.aprovado_almoxarifado_por ? 'Almox. OK' : 'Almox. pendente'}></span>
                        <span className={`w-2 h-2 rounded-full ${
                          s.status === 'rejeitada' && s.motivo_rejeicao ? 'bg-red-500' :
                          s.aprovado_sesmt_por ? 'bg-blue-500' : 'bg-gray-300'
                        }`} title={s.aprovado_sesmt_por ? 'SESMT OK' : 'SESMT pendente'}></span>
                        {s.dupla_aprovacao_completa && <span className="text-xs text-green-600 font-bold">✓</span>}
                      </div>
                    </td>
                    <td className="p-2 text-xs text-gray-500 whitespace-nowrap">
                      {new Date(s.criado_em).toLocaleDateString('pt-BR')}{' '}
                      <span className="text-gray-400">{new Date(s.criado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                    </td>
                    <td className="p-2 text-center">
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-blue-50 text-blue-600 hover:bg-blue-100 text-xs font-medium">
                        <Eye className="w-3.5 h-3.5" />
                        Detalhes
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Mensagem vazio */}
        {!isLoading && paginatedSolicitacoes.length === 0 && (
          <div className="text-center py-10 text-sm text-gray-500 bg-white border rounded-lg">
            Nenhuma solicitação encontrada.
          </div>
        )}

        {/* Paginação - mesmo padrão da página de solicitações */}
        {apiPagination.total > 0 && (
          <div className="flex items-center justify-between py-3">
            <div className="text-xs text-gray-500">
              Mostrando {((page - 1) * pageSize) + 1} a {Math.min(page * pageSize, apiPagination.total)} de {apiPagination.total}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => { const p = Math.max(1, page - 1); setPage(p); loadDataFromApi(p) }}
                disabled={page <= 1 || isLoading}
                className="px-3 py-1 text-sm border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Anterior
              </button>
              <span className="text-sm font-medium">
                {page} / {Math.max(1, Math.ceil(apiPagination.total / pageSize))}
              </span>
              <button
                onClick={() => { const p = Math.min(Math.ceil(apiPagination.total / pageSize), page + 1); setPage(p); loadDataFromApi(p) }}
                disabled={page >= Math.ceil(apiPagination.total / pageSize) || isLoading}
                className="px-3 py-1 text-sm border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Próxima
              </button>
            </div>
          </div>
        )}

      {/* ========== MODAL DE DETALHES ========== */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">Detalhes da Solicitação</DialogTitle>
            <DialogDescription className="text-sm">Informações completas, evidências e assinatura.</DialogDescription>
          </DialogHeader>

          {selected && (
            <div className="space-y-4">
              {/* Item */}
              <div className="bg-gray-50 p-3 rounded-lg">
                <div className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">ITEM</div>
                <div className="text-base font-bold text-gray-900">{selected.item?.nome || selected.item_nome || 'Item'}</div>
                {(selected.item?.codigo || selected.item_codigo) && (
                  <div className="text-xs text-gray-600">Código: {selected.item?.codigo || selected.item_codigo}</div>
                )}
              </div>

              {/* Informações principais */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 p-3 rounded-lg">
                  <div className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">DESTINATÁRIO</div>
                  <div className="text-sm font-medium">
                    {selected.destinatario_equipe
                      ? selected.destinatario_equipe.nome
                      : selected.destinatario?.nome || selected.destinatario_nome || '-'}
                  </div>
                  {selected.destinatario?.matricula && (
                    <div className="text-xs text-gray-500">Mat: {selected.destinatario.matricula}</div>
                  )}
                </div>
                <div className="bg-gray-50 p-3 rounded-lg">
                  <div className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">SOLICITANTE</div>
                  <div className="text-sm font-medium">{selected.solicitante?.nome || selected.solicitante_nome || '-'}</div>
                  {selected.solicitante?.matricula && (
                    <div className="text-xs text-gray-500">Mat: {selected.solicitante.matricula}</div>
                  )}
                </div>
              </div>

              {/* Quantidades */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
                  <div className="text-xs font-bold uppercase text-blue-600 mb-1">SOLICITADA</div>
                  <div className="text-lg font-bold text-blue-800">{selected.quantidade_solicitada}</div>
                </div>
                {selected.quantidade_aprovada != null && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
                    <div className="text-xs font-bold uppercase text-green-600 mb-1">APROVADA</div>
                    <div className="text-lg font-bold text-green-800">{selected.quantidade_aprovada}</div>
                  </div>
                )}
                {selected.quantidade_entregue != null && (
                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 text-center">
                    <div className="text-xs font-bold uppercase text-purple-600 mb-1">ENTREGUE</div>
                    <div className="text-lg font-bold text-purple-800">{selected.quantidade_entregue}</div>
                  </div>
                )}
              </div>

              {/* Tipo, Motivo, Base */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-gray-50 p-3 rounded-lg">
                  <div className="text-xs font-bold uppercase text-gray-500 mb-1">TIPO</div>
                  <span className={`text-sm font-medium ${
                    selected.tipo_troca === 'fornecimento' ? 'text-green-600' :
                    selected.tipo_troca === 'troca' ? 'text-blue-600' : 'text-red-600'
                  }`}>
                    {selected.tipo_troca === 'fornecimento' ? 'Fornecimento' : selected.tipo_troca === 'troca' ? 'Troca' : 'Desconto'}
                  </span>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg">
                  <div className="text-xs font-bold uppercase text-gray-500 mb-1">BASE</div>
                  <div className="text-sm font-medium">{selected.base_destino?.nome || selected.base_nome || '-'}</div>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg">
                  <div className="text-xs font-bold uppercase text-gray-500 mb-1">DATA</div>
                  <div className="text-sm font-medium">{new Date(selected.criado_em).toLocaleDateString('pt-BR')}</div>
                </div>
              </div>

              {/* Motivo */}
              {selected.motivo_solicitacao && (
                <div className="bg-gray-50 p-3 rounded-lg">
                  <div className="text-xs font-bold uppercase text-gray-500 mb-1">MOTIVO</div>
                  <div className="text-sm text-gray-700">{selected.motivo_solicitacao}</div>
                </div>
              )}

              {/* Dupla Aprovação */}
              <div className="p-3 bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg">
                <div className="text-xs font-bold uppercase text-blue-700 mb-2">DUPLA APROVAÇÃO</div>
                <div className="grid grid-cols-2 gap-2">
                  <div className={`p-2 rounded-lg border ${selected.aprovado_almoxarifado_por ? 'bg-green-50 border-green-300' : 'bg-gray-50 border-gray-300'}`}>
                    <div className="flex items-center gap-2">
                      <span className={`w-3 h-3 rounded-full ${selected.aprovado_almoxarifado_por ? 'bg-green-500' : 'bg-gray-400'}`}></span>
                      <span className="text-xs font-bold text-gray-600">ALMOXARIFADO</span>
                    </div>
                    <div className="text-sm font-semibold mt-1">
                      {selected.aprovado_almoxarifado_por
                        ? <span className="text-green-700">✓ APROVADO</span>
                        : <span className="text-gray-500">⏳ PENDENTE</span>}
                    </div>
                    {selected.aprovador_almoxarifado?.nome && (
                      <div className="text-xs text-gray-500 mt-1">Por: {selected.aprovador_almoxarifado.nome}</div>
                    )}
                  </div>
                  <div className={`p-2 rounded-lg border ${selected.aprovado_sesmt_por ? 'bg-blue-50 border-blue-300' : 'bg-gray-50 border-gray-300'}`}>
                    <div className="flex items-center gap-2">
                      <span className={`w-3 h-3 rounded-full ${selected.aprovado_sesmt_por ? 'bg-blue-500' : 'bg-gray-400'}`}></span>
                      <span className="text-xs font-bold text-gray-600">SESMT</span>
                    </div>
                    <div className="text-sm font-semibold mt-1">
                      {selected.aprovado_sesmt_por
                        ? <span className="text-blue-700">✓ APROVADO</span>
                        : <span className="text-gray-500">⏳ PENDENTE</span>}
                    </div>
                    {selected.aprovador_sesmt?.nome && (
                      <div className="text-xs text-gray-500 mt-1">Por: {selected.aprovador_sesmt.nome}</div>
                    )}
                  </div>
                </div>
                {selected.dupla_aprovacao_completa ? (
                  <div className="mt-2 p-2 bg-green-100 border border-green-300 rounded-lg text-sm font-bold text-green-800 text-center">
                    ✅ PRONTA PARA ENTREGA
                  </div>
                ) : (
                  <div className="mt-2 p-2 bg-yellow-100 border border-yellow-300 rounded-lg text-sm font-bold text-yellow-800 text-center">
                    ⚠️ AGUARDANDO APROVAÇÃO
                  </div>
                )}
              </div>

              {/* Observações */}
              {(selected.observacoes_almoxarifado || selected.observacoes_sesmt) && (
                <div className="space-y-2">
                  {selected.observacoes_almoxarifado && (
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="text-xs font-bold uppercase text-blue-600 mb-1">OBSERVAÇÕES ALMOXARIFADO</div>
                      <div className="text-sm text-blue-800">{selected.observacoes_almoxarifado}</div>
                    </div>
                  )}
                  {selected.observacoes_sesmt && (
                    <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                      <div className="text-xs font-bold uppercase text-green-600 mb-1">OBSERVAÇÕES SESMT</div>
                      <div className="text-sm text-green-800">{selected.observacoes_sesmt}</div>
                    </div>
                  )}
                </div>
              )}

              {/* Evidências e Assinatura */}
              {(selected.evidencia_url || selected.assinatura_digital) && (
                <div className="p-3 bg-gray-50 rounded-lg border">
                  <div className="text-xs font-bold uppercase text-gray-700 mb-3">EVIDÊNCIAS E ASSINATURA</div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 overflow-hidden">
                    {selected.evidencia_url && (
                      <div className="space-y-2 min-w-0">
                        <div className="text-sm font-medium text-gray-700">Evidência Fotográfica</div>
                        <div className="bg-white border border-gray-200 rounded-lg p-2">
                          {selected.evidencia_url.startsWith('file://') ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={selected.evidencia_url}
                              alt="Evidência"
                              className="w-full h-48 object-cover rounded cursor-pointer hover:opacity-80 transition-opacity"
                              onClick={() => window.open(selected.evidencia_url, '_blank')}
                            />
                          ) : (
                            <Image
                              src={selected.evidencia_url}
                              alt="Evidência"
                              width={400}
                              height={200}
                              className="w-full h-48 object-cover rounded cursor-pointer hover:opacity-80 transition-opacity"
                              onClick={() => window.open(selected.evidencia_url, '_blank')}
                            />
                          )}
                        </div>
                        <div className="text-xs text-gray-500">Clique para ampliar</div>
                      </div>
                    )}
                    {selected.assinatura_digital && (
                      <div className="space-y-2 min-w-0 overflow-hidden">
                        <div className="text-sm font-medium text-gray-700">Assinatura Digital</div>
                        <SignatureRenderer
                          signatureData={selected.assinatura_digital}
                          width={250}
                          height={100}
                          className="w-full max-w-full"
                        />
                        {selected.assinatura_nome && (
                          <div className="text-xs text-gray-600">
                            <span className="font-medium">Assinado por:</span> {selected.assinatura_nome}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Ações SESMT */}
              {!selected.aprovado_sesmt_por && selected.status === 'pendente' && (
                <div className="flex items-center justify-end gap-2 pt-2 border-t">
                  <Button
                    onClick={() => { setDetailOpen(false); setApproveOpen(true) }}
                    size="sm"
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <CheckCircle className="h-4 w-4 mr-1" />
                    Aprovar SESMT
                  </Button>
                  <Button
                    onClick={() => { setDetailOpen(false); setRejectOpen(true) }}
                    variant="destructive"
                    size="sm"
                  >
                    <X className="h-4 w-4 mr-1" />
                    Rejeitar
                  </Button>
                </div>
              )}
              {selected.aprovado_sesmt_por && (
                <div className="flex justify-end pt-2 border-t">
                  <Badge variant="outline" className="text-green-600 border-green-600">
                    Aprovado pelo SESMT
                  </Badge>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal de Aprovação */}
      <Dialog open={approveOpen} onOpenChange={setApproveOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              Aprovar Solicitação - SESMT
            </DialogTitle>
            <DialogDescription>
              Aprove esta solicitação no SESMT. Observações são obrigatórias.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {selected && (
              <div className="bg-gray-50 p-3 rounded-lg">
                <h4 className="font-medium">{selected.item?.nome || selected.item_nome || 'Item'}</h4>
                <p className="text-sm text-gray-600">Solicitante: {selected.solicitante?.nome || selected.solicitante_nome || 'N/A'}</p>
                <p className="text-sm text-gray-600">Quantidade: {selected.quantidade_solicitada}</p>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="approve-obs">Observações da Aprovação SESMT *</Label>
              <Textarea
                id="approve-obs"
                placeholder="Digite suas observações sobre a aprovação..."
                value={approveObs}
                onChange={(e) => setApproveObs(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveOpen(false)}>Cancelar</Button>
            <Button onClick={doApprove} disabled={approveMutation.isPending || !approveObs.trim()} className="bg-green-600 hover:bg-green-700">
              {approveMutation.isPending ? 'Aprovando...' : 'Aprovar SESMT'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Rejeição */}
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <X className="h-5 w-5 text-red-600" />
              Rejeitar Solicitação
            </DialogTitle>
            <DialogDescription>
              Rejeite esta solicitação. O motivo é obrigatório.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {selected && (
              <div className="bg-gray-50 p-3 rounded-lg">
                <h4 className="font-medium">{selected.item?.nome || selected.item_nome || 'Item'}</h4>
                <p className="text-sm text-gray-600">Solicitante: {selected.solicitante?.nome || selected.solicitante_nome || 'N/A'}</p>
                <p className="text-sm text-gray-600">Quantidade: {selected.quantidade_solicitada}</p>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="reject-motivo">Motivo da Rejeição *</Label>
              <Textarea
                id="reject-motivo"
                placeholder="Digite o motivo da rejeição..."
                value={rejectMotivo}
                onChange={(e) => setRejectMotivo(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>Cancelar</Button>
            <Button onClick={doReject} disabled={rejectMutation.isPending || !rejectMotivo.trim()} variant="destructive">
              {rejectMutation.isPending ? 'Rejeitando...' : 'Rejeitar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </div>
  )
}
