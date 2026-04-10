'use client'

import React, { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useNotification } from '@/contexts/NotificationContext'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { TrendingUp, Search, Download, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'
import * as XLSX from 'xlsx'
import { PERMISSION_CODES } from '@/hooks/useModularPermissions'
import { useUnifiedPermissions } from '@/hooks/useUnifiedPermissions'
import ProtectedRoute from '@/components/ProtectedRoute'
import type { UsuarioBase } from '@/types/contratos'

const ITEMS_PER_PAGE = 50

export default function MovimentacoesEstoquePage() {
  return (
    <ProtectedRoute requiredPermissions={[
      PERMISSION_CODES.ALMOXARIFADO.HISTORICO_MOVIMENTACOES,
      PERMISSION_CODES.ALMOXARIFADO.VISUALIZAR_ESTOQUE,
      PERMISSION_CODES.ALMOXARIFADO.GERENCIAR_ESTOQUE
    ]}>
      <MovimentacoesEstoqueContent />
    </ProtectedRoute>
  );
}

function MovimentacoesEstoqueContent() {
  const { user } = useAuth()
  const { notify } = useNotification()
  const { userBases, loading: permissionsLoading } = useUnifiedPermissions()
  
  // Estados
  const [page, setPage] = useState(0)
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [baseId, setBaseId] = useState<string>('todos')
  const [tipoFiltro, setTipoFiltro] = useState<string>('todos')
  const [dataInicio, setDataInicio] = useState('')
  const [dataFim, setDataFim] = useState('')
  const [exporting, setExporting] = useState(false)

  // Debounce para busca
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm)
      setPage(0) // Reset para primeira página ao buscar
    }, 500)
    return () => clearTimeout(timer)
  }, [searchTerm])

  // Buscar bases do usuário
  const { data: bases = [] } = useQuery({
    queryKey: ['bases-user', userBases],
    queryFn: async () => {
      console.log('🔍 [BASES] Buscando bases do usuário...')
      console.log('🔍 [BASES] userBases:', userBases)
      
      if (!userBases || !Array.isArray(userBases)) return []
      const baseIds = userBases
        .filter(ub => (ub as UsuarioBase).ativo)
        .map(ub => (ub as UsuarioBase).base_id)
      
      console.log('🔍 [BASES] baseIds:', baseIds)
      
      if (baseIds.length === 0) return []
      
      const { data, error } = await supabase
        .from('bases')
        .select('id, nome, codigo')
        .in('id', baseIds)
        .eq('ativa', true)
        .order('nome')
      
      if (error) throw error
      console.log('✅ [BASES] Bases carregadas:', data?.length || 0)
      return data || []
    },
    enabled: !permissionsLoading && !!user && Array.isArray(userBases) && userBases.length > 0,
    staleTime: 10 * 60 * 1000,
  })

  // Buscar contagem total (para paginação - só quando NÃO há busca textual)
  const { data: totalCountServer = 0 } = useQuery({
    queryKey: ['movimentacoes-count', baseId, tipoFiltro, dataInicio, dataFim],
    queryFn: async () => {
      if (!userBases || !Array.isArray(userBases)) return 0
      
      const userBaseIds = userBases
        .filter(ub => (ub as UsuarioBase).ativo)
        .map(ub => (ub as UsuarioBase).base_id)
      
      if (userBaseIds.length === 0) return 0

      let query = supabase
        .from('movimentacoes_estoque')
        .select('id', { count: 'exact', head: true })

      // Filtro de base
      if (baseId !== 'todos') {
        query = query.eq('base_id', baseId)
      } else {
        query = query.in('base_id', userBaseIds)
      }

      // Filtro de tipo
      if (tipoFiltro !== 'todos') {
        query = query.eq('tipo', tipoFiltro)
      }

      // Filtro de período (UTC-3 Brasília)
      if (dataInicio) {
        query = query.gte('criado_em', `${dataInicio}T00:00:00-03:00`)
      }
      if (dataFim) {
        query = query.lte('criado_em', `${dataFim}T23:59:59-03:00`)
      }

      const { count, error } = await query
      if (error) throw error
      return count || 0
    },
    enabled: !permissionsLoading && !!user && Array.isArray(userBases) && userBases.length > 0 && !debouncedSearch,
    staleTime: 2 * 60 * 1000,
  })

  // Buscar movimentações paginadas (sem busca) ou todas (com busca para filtro client-side)
  const { data: rawMovimentacoes = [], isLoading, error: queryError } = useQuery({
    queryKey: ['movimentacoes-paginated', debouncedSearch ? 'all' : page, baseId, tipoFiltro, dataInicio, dataFim, debouncedSearch],
    queryFn: async () => {
      console.log('🔍 [MOVIMENTACOES] Iniciando busca...')
      console.log('🔍 [MOVIMENTACOES] userBases:', userBases)
      
      if (!userBases || !Array.isArray(userBases)) {
        console.warn('⚠️ [MOVIMENTACOES] userBases não disponível')
        return []
      }
      
      const userBaseIds = userBases
        .filter(ub => (ub as UsuarioBase).ativo)
        .map(ub => (ub as UsuarioBase).base_id)
      
      console.log('🔍 [MOVIMENTACOES] userBaseIds:', userBaseIds)
      
      if (userBaseIds.length === 0) {
        console.warn('⚠️ [MOVIMENTACOES] Nenhuma base disponível')
        return []
      }

      let query = supabase
        .from('movimentacoes_estoque')
        .select(`
          id,
          tipo,
          quantidade,
          quantidade_anterior,
          quantidade_atual,
          criado_em,
          solicitacao_id,
          solicitacao:solicitacoes_itens!movimentacoes_estoque_solicitacao_id_fkey(numero_solicitacao),
          item:itens_estoque!item_id(nome, codigo),
          usuario:usuarios!movimentacoes_estoque_usuario_id_fkey(nome, matricula),
          solicitante:usuarios!movimentacoes_estoque_solicitante_id_fkey(nome, matricula),
          destinatario:usuarios!movimentacoes_estoque_destinatario_id_fkey(nome, matricula),
          destinatario_equipe:equipes!movimentacoes_estoque_destinatario_equipe_id_fkey(nome),
          base:bases!base_id(nome)
        `)

      // Filtro de base
      if (baseId !== 'todos') {
        query = query.eq('base_id', baseId)
      } else {
        query = query.in('base_id', userBaseIds)
      }

      // Filtro de tipo
      if (tipoFiltro !== 'todos') {
        query = query.eq('tipo', tipoFiltro)
      }

      // Filtro de período (UTC-3 Brasília)
      if (dataInicio) {
        query = query.gte('criado_em', `${dataInicio}T00:00:00-03:00`)
      }
      if (dataFim) {
        query = query.lte('criado_em', `${dataFim}T23:59:59-03:00`)
      }

      // Se há busca textual, buscar TODOS os registros para filtrar client-side
      // Caso contrário, usar paginação server-side
      if (!debouncedSearch) {
        const from = page * ITEMS_PER_PAGE
        const to = from + ITEMS_PER_PAGE - 1
        query = query.range(from, to)
      }

      console.log('📊 [MOVIMENTACOES] Executando query...', debouncedSearch ? '(busca: todos registros)' : `(página ${page + 1})`)
      const { data, error } = await query
        .order('criado_em', { ascending: false })

      if (error) {
        console.error('❌ [MOVIMENTACOES] Erro na query:', error)
        throw error
      }

      console.log('✅ [MOVIMENTACOES] Dados recebidos:', data?.length || 0, 'registros')
      
      // Normalizar dados (converter arrays em objetos)
      const normalizedData = (data || []).map(mov => ({
        ...mov,
        item: Array.isArray(mov.item) ? mov.item[0] : mov.item,
        usuario: Array.isArray(mov.usuario) ? mov.usuario[0] : mov.usuario,
        solicitante: Array.isArray(mov.solicitante) ? mov.solicitante[0] : mov.solicitante,
        destinatario: Array.isArray(mov.destinatario) ? mov.destinatario[0] : mov.destinatario,
        destinatario_equipe: Array.isArray(mov.destinatario_equipe) ? mov.destinatario_equipe[0] : mov.destinatario_equipe,
        base: Array.isArray(mov.base) ? mov.base[0] : mov.base,
        solicitacao: Array.isArray(mov.solicitacao) ? mov.solicitacao[0] : mov.solicitacao
      }))

      // Debug: verificar matrículas
      if (normalizedData && normalizedData.length > 0) {
        console.log('🔍 [DEBUG] Amostra de dados:')
        normalizedData.slice(0, 2).forEach((mov, idx) => {
          console.log(`  Mov ${idx + 1}:`, {
            usuario: { nome: mov.usuario?.nome, matricula: mov.usuario?.matricula },
            solicitante: { nome: mov.solicitante?.nome, matricula: mov.solicitante?.matricula },
            destinatario: { nome: mov.destinatario?.nome, matricula: mov.destinatario?.matricula },
            equipe: mov.destinatario_equipe?.nome
          })
        })
      }

      // Filtro de busca no cliente (para buscar em múltiplos campos de tabelas relacionadas)
      if (debouncedSearch) {
        const search = debouncedSearch.toLowerCase()
        const filtered = normalizedData.filter(m => 
          m.item?.nome?.toLowerCase().includes(search) ||
          m.item?.codigo?.toLowerCase().includes(search) ||
          m.usuario?.nome?.toLowerCase().includes(search) ||
          m.usuario?.matricula?.toLowerCase().includes(search) ||
          m.solicitante?.nome?.toLowerCase().includes(search) ||
          m.destinatario?.nome?.toLowerCase().includes(search) ||
          m.destinatario_equipe?.nome?.toLowerCase().includes(search) ||
          m.base?.nome?.toLowerCase().includes(search)
        )
        console.log(`🔍 [BUSCA] Filtro "${debouncedSearch}": ${filtered.length} de ${normalizedData.length} registros`)
        return filtered
      }

      return normalizedData
    },
    enabled: !permissionsLoading && !!user && Array.isArray(userBases) && userBases.length > 0,
    staleTime: 2 * 60 * 1000,
    placeholderData: (previousData) => previousData,
  })

  // Quando há busca, paginar client-side; senão, usar dados direto do server
  const totalCount = debouncedSearch ? rawMovimentacoes.length : totalCountServer
  const movimentacoes = debouncedSearch
    ? rawMovimentacoes.slice(page * ITEMS_PER_PAGE, (page + 1) * ITEMS_PER_PAGE)
    : rawMovimentacoes

  // Calcular total de páginas
  const totalPages = Math.max(1, Math.ceil(totalCount / ITEMS_PER_PAGE))

  // Exportar para Excel (busca TODOS os registros)
  const exportarExcel = async () => {
    try {
      setExporting(true)
      
      if (!userBases || !Array.isArray(userBases)) {
        notify('Erro ao buscar permissões', 'error')
        return
      }
      
      const userBaseIds = userBases
        .filter(ub => (ub as UsuarioBase).ativo)
        .map(ub => (ub as UsuarioBase).base_id)
      
      if (userBaseIds.length === 0) {
        notify('Nenhuma base disponível', 'error')
        return
      }

      let query = supabase
        .from('movimentacoes_estoque')
        .select(`
          id,
          tipo,
          quantidade,
          quantidade_anterior,
          quantidade_atual,
          criado_em,
          solicitacao_id,
          solicitacao:solicitacoes_itens!movimentacoes_estoque_solicitacao_id_fkey(numero_solicitacao),
          item:itens_estoque!item_id(nome, codigo),
          usuario:usuarios!movimentacoes_estoque_usuario_id_fkey(nome, matricula),
          solicitante:usuarios!movimentacoes_estoque_solicitante_id_fkey(nome, matricula),
          destinatario:usuarios!movimentacoes_estoque_destinatario_id_fkey(nome, matricula),
          destinatario_equipe:equipes!movimentacoes_estoque_destinatario_equipe_id_fkey(nome),
          base:bases!base_id(nome)
        `)

      // Aplicar mesmos filtros
      if (baseId !== 'todos') {
        query = query.eq('base_id', baseId)
      } else {
        query = query.in('base_id', userBaseIds)
      }

      // Filtro de tipo
      if (tipoFiltro !== 'todos') {
        query = query.eq('tipo', tipoFiltro)
      }

      if (dataInicio) {
        query = query.gte('criado_em', `${dataInicio}T00:00:00-03:00`)
      }
      if (dataFim) {
        query = query.lte('criado_em', `${dataFim}T23:59:59-03:00`)
      }

      const { data, error } = await query.order('criado_em', { ascending: false })

      if (error) throw error

      // Normalizar dados para exportação
      const normalizedData = (data || []).map(mov => ({
        ...mov,
        item: Array.isArray(mov.item) ? mov.item[0] : mov.item,
        usuario: Array.isArray(mov.usuario) ? mov.usuario[0] : mov.usuario,
        solicitante: Array.isArray(mov.solicitante) ? mov.solicitante[0] : mov.solicitante,
        destinatario: Array.isArray(mov.destinatario) ? mov.destinatario[0] : mov.destinatario,
        destinatario_equipe: Array.isArray(mov.destinatario_equipe) ? mov.destinatario_equipe[0] : mov.destinatario_equipe,
        base: Array.isArray(mov.base) ? mov.base[0] : mov.base,
        solicitacao: Array.isArray(mov.solicitacao) ? mov.solicitacao[0] : mov.solicitacao
      }))

      // Filtro de busca
      let filtered = normalizedData
      if (debouncedSearch) {
        const search = debouncedSearch.toLowerCase()
        filtered = filtered.filter(m => 
          m.item?.nome?.toLowerCase().includes(search) ||
          m.item?.codigo?.toLowerCase().includes(search) ||
          m.usuario?.nome?.toLowerCase().includes(search) ||
          m.usuario?.matricula?.toLowerCase().includes(search) ||
          m.solicitante?.nome?.toLowerCase().includes(search) ||
          m.destinatario?.nome?.toLowerCase().includes(search) ||
          m.destinatario_equipe?.nome?.toLowerCase().includes(search) ||
          m.base?.nome?.toLowerCase().includes(search)
        )
      }

      const dadosExcel = filtered.map(m => ({
        'Data': m.criado_em ? new Date(m.criado_em).toLocaleDateString('pt-BR') : '',
        'Item': m.item?.nome || '',
        'Código': m.item?.codigo || '',
        'Tipo': m.tipo || '',
        'Quantidade': m.quantidade || 0,
        'Anterior': m.quantidade_anterior || 0,
        'Atual': m.quantidade_atual || 0,
        'Usuário': m.usuario?.nome ? `${m.usuario.nome}${m.usuario.matricula ? ` (Mat: ${m.usuario.matricula})` : ''}` : '',
        'Solicitante': m.solicitante?.nome ? `${m.solicitante.nome}${m.solicitante.matricula ? ` (Mat: ${m.solicitante.matricula})` : ''}` : '',
        'Destinatário': m.destinatario_equipe?.nome 
          ? `Eq: ${m.destinatario_equipe.nome}` 
          : (m.destinatario?.nome ? `${m.destinatario.nome}${m.destinatario.matricula ? ` (Mat: ${m.destinatario.matricula})` : ''}` : ''),
        'Base': m.base?.nome || '',
      }))

      const wb = XLSX.utils.book_new()
      const ws = XLSX.utils.json_to_sheet(dadosExcel)
      
      ws['!cols'] = [
        { wch: 12 }, { wch: 30 }, { wch: 15 }, { wch: 12 },
        { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 35 },
        { wch: 35 }, { wch: 35 }, { wch: 20 }
      ]

      XLSX.utils.book_append_sheet(wb, ws, 'Movimentações')
      
      const dataAtual = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')
      XLSX.writeFile(wb, `Movimentacoes_${dataAtual}.xlsx`)
      
      notify(`${filtered.length} movimentações exportadas com sucesso!`, 'success')
    } catch (error) {
      console.error('Erro ao exportar:', error)
      notify('Erro ao exportar relatório', 'error')
    } finally {
      setExporting(false)
    }
  }

  const getTipoColor = (tipo: string) => {
    switch (tipo) {
      case 'entrada': return 'bg-green-100 text-green-800'
      case 'saida': return 'bg-red-100 text-red-800'
      case 'transferencia': return 'bg-blue-100 text-blue-800'
      case 'ajuste': return 'bg-purple-100 text-purple-800'
      case 'devolucao': return 'bg-orange-100 text-orange-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  if (!user) return null

  return (
    <div className="container mx-auto px-4 py-6 max-w-full">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <TrendingUp className="h-8 w-8 text-blue-600" />
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Movimentações de Estoque</h1>
            <p className="text-gray-600">Total: {totalCount.toLocaleString('pt-BR')} registros</p>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">Filtros e Busca</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Busca Global */}
            <div className="lg:col-span-2">
              <Label htmlFor="search">Busca Global</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  id="search"
                  placeholder="Buscar por item, código, usuário, destinatário..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Filtro de Tipo */}
            <div>
              <Label htmlFor="tipo">Tipo</Label>
              <Select value={tipoFiltro} onValueChange={(v) => { setTipoFiltro(v); setPage(0) }}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos os tipos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os tipos</SelectItem>
                  <SelectItem value="entrada">Entrada</SelectItem>
                  <SelectItem value="saida">Saída</SelectItem>
                  <SelectItem value="transferencia">Transferência</SelectItem>
                  <SelectItem value="ajuste">Ajuste</SelectItem>
                  <SelectItem value="devolucao">Devolução</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Filtro de Base */}
            <div>
              <Label htmlFor="base">Base</Label>
              <Select value={baseId} onValueChange={(v) => { setBaseId(v); setPage(0) }}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas as bases" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas as bases</SelectItem>
                  {bases.map(base => (
                    <SelectItem key={base.id} value={base.id}>
                      {base.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Exportar */}
            <div className="flex items-end">
              <Button 
                onClick={exportarExcel} 
                disabled={exporting || isLoading}
                className="w-full"
                variant="outline"
              >
                <Download className="h-4 w-4 mr-2" />
                {exporting ? 'Exportando...' : 'Excel'}
              </Button>
            </div>

            {/* Data Início */}
            <div>
              <Label htmlFor="dataInicio">Data Início</Label>
              <Input
                id="dataInicio"
                type="date"
                value={dataInicio}
                onChange={(e) => { setDataInicio(e.target.value); setPage(0) }}
              />
            </div>

            {/* Data Fim */}
            <div>
              <Label htmlFor="dataFim">Data Fim</Label>
              <Input
                id="dataFim"
                type="date"
                value={dataFim}
                onChange={(e) => { setDataFim(e.target.value); setPage(0) }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabela */}
      <Card>
        <CardContent className="pt-6">
          {permissionsLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Carregando permissões...</p>
            </div>
          ) : queryError ? (
            <div className="text-center py-12">
              <p className="text-red-600 font-medium mb-2">Erro ao carregar movimentações</p>
              <p className="text-sm text-gray-600">{(queryError as Error).message}</p>
              <p className="text-xs text-gray-500 mt-2">Verifique o console para mais detalhes</p>
            </div>
          ) : isLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Carregando movimentações...</p>
            </div>
          ) : movimentacoes.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-600">Nenhuma movimentação encontrada</p>
              <p className="text-sm text-gray-500 mt-2">
                {!userBases || userBases.length === 0 
                  ? 'Você não tem acesso a nenhuma base' 
                  : 'Tente ajustar os filtros'}
              </p>
            </div>
          ) : (
            <>
              <div className="w-full">
                <Table>
                  <TableHeader>
                    <TableRow className="text-xs">
                      <TableHead className="w-16 p-2">Data</TableHead>
                      <TableHead className="w-32 p-2">Item</TableHead>
                      <TableHead className="w-20 p-2">Tipo</TableHead>
                      <TableHead className="w-12 p-2 text-center">Qtd</TableHead>
                      <TableHead className="w-12 p-2 text-center">Ant</TableHead>
                      <TableHead className="w-12 p-2 text-center">Atu</TableHead>
                      <TableHead className="w-32 p-2">Usuário</TableHead>
                      <TableHead className="w-32 p-2">Solicit.</TableHead>
                      <TableHead className="w-32 p-2">Destin.</TableHead>
                      <TableHead className="w-20 p-2">Base</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {movimentacoes.map((m) => (
                      <TableRow key={m.id} className="text-xs">
                        <TableCell className="p-2 whitespace-nowrap">
                          {m.criado_em ? new Date(m.criado_em).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '-'}
                        </TableCell>
                        <TableCell className="p-2">
                          <div className="flex flex-col">
                            <span className="truncate" title={m.item?.nome}>
                              {m.item?.nome || '-'}
                            </span>
                            {m.item?.codigo && (
                              <span className="text-[10px] text-gray-500">
                                Cód: {m.item.codigo}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="p-2">
                          <div className="flex flex-col">
                            <Badge className={getTipoColor(m.tipo) + ' text-[10px] px-1 py-0'}>
                              {m.tipo}
                            </Badge>
                            {m.tipo === 'saida' && m.solicitacao?.numero_solicitacao && (
                              <span className="text-[10px] text-gray-500 mt-1">
                                Sol: #{m.solicitacao.numero_solicitacao}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="p-2 text-center font-medium">
                          {m.tipo === 'entrada' || m.tipo === 'devolucao' ? '+' : '-'}{m.quantidade}
                        </TableCell>
                        <TableCell className="p-2 text-center">{m.quantidade_anterior}</TableCell>
                        <TableCell className="p-2 text-center font-medium">{m.quantidade_atual}</TableCell>
                        <TableCell className="p-2">
                          <div className="flex flex-col">
                            <span className="truncate" title={m.usuario?.nome}>
                              {m.usuario?.nome || '-'}
                            </span>
                            {m.usuario?.matricula && (
                              <span className="text-[10px] text-gray-500">
                                Mat: {m.usuario.matricula}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="p-2">
                          <div className="flex flex-col">
                            <span className="truncate" title={m.solicitante?.nome}>
                              {m.solicitante?.nome || '-'}
                            </span>
                            {m.solicitante?.matricula && (
                              <span className="text-[10px] text-gray-500">
                                Mat: {m.solicitante.matricula}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="p-2">
                          {m.destinatario_equipe?.nome ? (
                            <div className="truncate" title={m.destinatario_equipe.nome}>
                              <span className="text-purple-600">Eq: {m.destinatario_equipe.nome}</span>
                            </div>
                          ) : (
                            <div className="flex flex-col">
                              <span className="truncate" title={m.destinatario?.nome}>
                                {m.destinatario?.nome || '-'}
                              </span>
                              {m.destinatario?.matricula && (
                                <span className="text-[10px] text-gray-500">
                                  Mat: {m.destinatario.matricula}
                                </span>
                              )}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="p-2">
                          <div className="truncate" title={m.base?.nome}>
                            {m.base?.nome || '-'}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Paginação */}
              <div className="flex items-center justify-between mt-4 pt-4 border-t">
                <div className="text-sm text-gray-600">
                  Mostrando {page * ITEMS_PER_PAGE + 1} a {Math.min((page + 1) * ITEMS_PER_PAGE, totalCount)} de {totalCount.toLocaleString('pt-BR')}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(0)}
                    disabled={page === 0}
                  >
                    <ChevronsLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.max(0, p - 1))}
                    disabled={page === 0}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm px-4">
                    Página {page + 1} de {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                    disabled={page >= totalPages - 1}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(totalPages - 1)}
                    disabled={page >= totalPages - 1}
                  >
                    <ChevronsRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
