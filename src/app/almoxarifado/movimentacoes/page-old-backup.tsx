'use client'

import React, { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useNotification } from '@/contexts/NotificationContext'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { userService } from '@/services/userService'
import { baseService } from '@/services/baseService'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { TrendingUp, Filter, Search, Download, FileSpreadsheet, ArrowUpDown, Package, ArrowRight, ArrowLeft } from 'lucide-react'
import * as XLSX from 'xlsx'
import { PERMISSION_CODES } from '@/hooks/useModularPermissions'
import { useUnifiedPermissions } from '@/hooks/useUnifiedPermissions'
import ProtectedRoute from '@/components/ProtectedRoute'
import type { UsuarioBase, UsuarioContrato } from '@/types/contratos'


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
  const { userContratos, userBases, loading: permissionsLoading } = useUnifiedPermissions()
  
  const [exporting, setExporting] = useState(false)
  const [shouldFetch, setShouldFetch] = useState(true) // Permitir carregamento inicial
  const [filtros, setFiltros] = useState({
    item: '',
    tipo: 'todos',
    usuario: '',
    data_inicio: '',
    data_fim: '',
    base_id: 'todos',
    contrato_id: 'todos'
  })
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table')

  // React Query para usuários
  const { data: usuarios = [] } = useQuery({
    queryKey: ['usuarios-movimentacoes'],
    queryFn: () => userService.getAll(),
    staleTime: 5 * 60 * 1000, // 5 minutos
    gcTime: 10 * 60 * 1000, // 10 minutos
  })

  // React Query para bases
  const { data: bases = [] } = useQuery({
    queryKey: ['bases-movimentacoes'],
    queryFn: () => baseService.getBasesAtivas(),
    staleTime: 5 * 60 * 1000, // 5 minutos
    gcTime: 10 * 60 * 1000, // 10 minutos
  })

  // Filtrar bases e contratos que o usuário tem acesso
  const filteredBases = React.useMemo(() => {
    if (!user || !userBases || !Array.isArray(userBases)) return []
    return bases.filter(base => 
      userBases.some(ub => (ub as UsuarioBase).base_id === base.id && (ub as UsuarioBase).ativo)
    )
  }, [bases, userBases, user])

  const filteredContratos = React.useMemo(() => {
    if (!user) return []
    return userContratos
      .filter(uc => (uc as UsuarioContrato).ativo)
      .map(uc => (uc as UsuarioContrato).contrato)
      .filter((contrato): contrato is NonNullable<typeof contrato> => contrato != null)
  }, [userContratos, user])

  // React Query para movimentações (não executa automaticamente)
  const { data: movimentacoes = [], isLoading: loading, error: queryError, refetch } = useQuery({
    queryKey: ['movimentacoes-estoque', filtros],
    queryFn: async () => {
      console.log('📊 [WEB] Carregando movimentações de estoque...')
      console.log('📊 [WEB] Filtros:', filtros)
      console.log('📊 [WEB] UserBases:', userBases)
      
      // Filtrar apenas bases que o usuário tem acesso
      let userBaseIds: string[] = []
      if (userBases && Array.isArray(userBases)) {
        userBaseIds = userBases.filter(ub => (ub as UsuarioBase).ativo).map(ub => (ub as UsuarioBase).base_id)
        console.log('📊 [WEB] Base IDs do usuário:', userBaseIds)
      }

      // Se filtro de contrato está ativo, buscar bases desse contrato primeiro
      let baseIdsParaFiltrar = userBaseIds
      if (filtros.contrato_id && filtros.contrato_id !== 'todos') {
        console.log('📊 [WEB] Filtrando por contrato:', filtros.contrato_id)
        const { data: basesDoContrato, error: basesError } = await supabase
          .from('bases')
          .select('id')
          .eq('contrato_id', filtros.contrato_id)
          .in('id', userBaseIds.length > 0 ? userBaseIds : [])
        
        if (basesError) {
          console.error('❌ [WEB] Erro ao buscar bases do contrato:', basesError)
        } else {
          const baseIdsContrato = basesDoContrato?.map(b => b.id) || []
          console.log('📊 [WEB] Bases do contrato:', baseIdsContrato)
          baseIdsParaFiltrar = baseIdsContrato.filter(id => userBaseIds.length === 0 || userBaseIds.includes(id))
        }
      }

      // Se filtro de base específica está ativo, usar apenas essa base
      if (filtros.base_id && filtros.base_id !== 'todos') {
        if (userBaseIds.length === 0 || userBaseIds.includes(filtros.base_id)) {
          baseIdsParaFiltrar = [filtros.base_id]
        } else {
          console.warn('⚠️ [WEB] Usuário não tem acesso à base selecionada')
          return []
        }
      }

      console.log('📊 [WEB] Base IDs finais para filtrar:', baseIdsParaFiltrar)
      
      // Query com todos os relacionamentos necessários
      let query = supabase
        .from('movimentacoes_estoque')
        .select(`
          *,
          item:itens_estoque!item_id(id, nome, codigo, categoria),
          usuario:usuarios!movimentacoes_estoque_usuario_id_fkey(id, nome, matricula),
          solicitante:usuarios!movimentacoes_estoque_solicitante_id_fkey(id, nome, matricula),
          destinatario:usuarios!movimentacoes_estoque_destinatario_id_fkey(id, nome, matricula),
          base:bases!base_id(id, nome, contrato_id),
          destinatario_equipe:equipes!movimentacoes_estoque_destinatario_equipe_id_fkey(id, nome)
        `)

      // Aplicar filtro de bases
      if (baseIdsParaFiltrar.length > 0) {
        query = query.in('base_id', baseIdsParaFiltrar)
      } else if (userBaseIds.length > 0) {
        // Se não há bases para filtrar mas há userBaseIds, não retornar nada
        console.warn('⚠️ [WEB] Nenhuma base disponível após filtros')
        return []
      }
      
      if (filtros.tipo && filtros.tipo !== 'todos') {
        query = query.eq('tipo', filtros.tipo)
      }
      
      // Nota: Filtro de item será aplicado no cliente após a query
      // pois Supabase não permite ilike diretamente em relacionamentos
      
      // Nota: Filtro de usuário será aplicado no cliente após a query
      // pois Supabase não permite OR direto em filtros de relação
      
      if (filtros.data_inicio) {
        // Adicionar 00:00:00 ao início do dia
        const dataInicio = new Date(filtros.data_inicio)
        dataInicio.setHours(0, 0, 0, 0)
        query = query.gte('criado_em', dataInicio.toISOString())
      }
      
      if (filtros.data_fim) {
        // Adicionar 23:59:59 ao final do dia para incluir o dia completo
        const dataFim = new Date(filtros.data_fim)
        dataFim.setHours(23, 59, 59, 999)
        query = query.lte('criado_em', dataFim.toISOString())
      }

      console.log('📊 [WEB] Executando query...')
      const { data, error } = await query.order('criado_em', { ascending: false })

      if (error) {
        console.error('❌ [WEB] Erro ao carregar movimentações:', error)
        console.error('❌ [WEB] Detalhes do erro:', JSON.stringify(error, null, 2))
        // Tentar query mais simples para debug
        console.log('🔍 [WEB] Tentando query simples para debug...')
        const { data: simpleData, error: simpleError } = await supabase
          .from('movimentacoes_estoque')
          .select('*')
          .limit(5)
        
        if (simpleError) {
          console.error('❌ [WEB] Erro mesmo na query simples:', simpleError)
        } else {
          console.log('✅ [WEB] Query simples funcionou!', simpleData?.length || 0, 'registros')
        }
        throw error
      }
      
      console.log('✅ [WEB] Movimentações carregadas:', data?.length || 0, 'registros')
      
      // Debug: verificar destinatários
      if (data && data.length > 0) {
        console.log('🔍 [DEBUG] Amostra de movimentações:')
        data.slice(0, 3).forEach((mov, idx) => {
          console.log(`  Mov ${idx + 1}:`, {
            id: mov.id,
            tipo: mov.tipo,
            destinatario_id: mov.destinatario_id,
            destinatario: mov.destinatario,
            destinatario_equipe_id: mov.destinatario_equipe_id,
            destinatario_equipe: mov.destinatario_equipe
          })
        })
      }
      
      // Aplicar filtros no cliente (item e usuário)
      let filteredData = data || []
      
      // Filtro de item (nome ou código)
      if (filtros.item && filtros.item.trim()) {
        const itemSearchTerm = filtros.item.toLowerCase().trim()
        filteredData = filteredData.filter(mov => {
          const itemNome = mov.item?.nome?.toLowerCase() || ''
          const itemCodigo = mov.item?.codigo?.toLowerCase() || ''
          return itemNome.includes(itemSearchTerm) || itemCodigo.includes(itemSearchTerm)
        })
      }
      
      // Filtro de usuário/matrícula
      if (filtros.usuario && filtros.usuario.trim()) {
        const searchTerm = filtros.usuario.toLowerCase().trim()
        filteredData = filteredData.filter(mov => {
          const usuarioNome = mov.usuario?.nome?.toLowerCase() || ''
          const usuarioMatricula = mov.usuario?.matricula?.toLowerCase() || ''
          const solicitanteNome = mov.solicitante?.nome?.toLowerCase() || ''
          const solicitanteMatricula = mov.solicitante?.matricula?.toLowerCase() || ''
          const destinatarioNome = mov.destinatario?.nome?.toLowerCase() || ''
          const destinatarioMatricula = mov.destinatario?.matricula?.toLowerCase() || ''
          const equipeNome = mov.destinatario_equipe?.nome?.toLowerCase() || ''
          
          return usuarioNome.includes(searchTerm) ||
                 usuarioMatricula.includes(searchTerm) ||
                 solicitanteNome.includes(searchTerm) ||
                 solicitanteMatricula.includes(searchTerm) ||
                 destinatarioNome.includes(searchTerm) ||
                 destinatarioMatricula.includes(searchTerm) ||
                 equipeNome.includes(searchTerm)
        })
      }
      
      // Enriquecer dados com informações de contrato e equipes se necessário
      if (filteredData && filteredData.length > 0) {
        console.log('📊 [WEB] Primeira movimentação:', data[0])
        
        // Buscar contratos para as bases retornadas
        const baseIds = [...new Set(data.map(m => m.base_id).filter(Boolean))]
        if (baseIds.length > 0) {
          const { data: basesData } = await supabase
            .from('bases')
            .select('id, contrato_id, contrato:contratos(id, nome, codigo)')
            .in('id', baseIds)
          
          if (basesData) {
            const basesMap = new Map(basesData.map(b => [b.id, b]))
            filteredData.forEach(mov => {
              if (mov.base_id && basesMap.has(mov.base_id)) {
                const base = basesMap.get(mov.base_id)
                if (base?.contrato) {
                  mov.contrato = base.contrato
                }
              }
            })
          }
        }
        
        // Destinatários e equipes já vêm da query principal com os relacionamentos corretos
      }
      
      return filteredData || []
    },
    enabled: shouldFetch && !permissionsLoading && !!user && Array.isArray(userBases),
    staleTime: 5 * 60 * 1000, // 5 minutos
    gcTime: 10 * 60 * 1000, // 10 minutos
  })
  
  // Desabilitar fetch automático após primeira carga
  React.useEffect(() => {
    if (movimentacoes.length > 0 && shouldFetch) {
      setShouldFetch(false)
    }
  }, [movimentacoes.length, shouldFetch])

  // Mapa de usuários com informações completas
  const userInfoMap = React.useMemo(() => {
    const map: Record<string, { nome: string; status: string; matricula?: string }> = {};
    usuarios.forEach(u => { 
      map[u.id] = { 
        nome: u.nome, 
        status: u.status || 'ativo',
        matricula: u.matricula 
      }; 
    });
    return map;
  }, [usuarios]);

  // Agrupar movimentações por item para visualização em cards
  const movimentacoesPorItem = React.useMemo(() => {
    const agrupadas: Record<string, {
      item: { id: string; nome: string; codigo: string; categoria: string };
      movimentacoes: Array<{ id: string; tipo: string; quantidade: number; motivo: string; criado_em: string; usuario?: { nome: string } }>;
      totalSaidas: number;
      totalDevolucoes: number;
      totalEntradas: number;
      totalTransferencias: number;
      totalAjustes: number;
    }> = {};

    movimentacoes.forEach(mov => {
      if (!mov.item) return;
      
      const itemId = mov.item.id;
      if (!agrupadas[itemId]) {
        agrupadas[itemId] = {
          item: mov.item,
          movimentacoes: [],
          totalSaidas: 0,
          totalDevolucoes: 0,
          totalEntradas: 0,
          totalTransferencias: 0,
          totalAjustes: 0
        };
      }

      agrupadas[itemId].movimentacoes.push(mov);
      
      switch (mov.tipo) {
        case 'saida':
          agrupadas[itemId].totalSaidas += mov.quantidade || 0;
          break;
        case 'devolucao':
          agrupadas[itemId].totalDevolucoes += mov.quantidade || 0;
          break;
        case 'entrada':
          agrupadas[itemId].totalEntradas += mov.quantidade || 0;
          break;
        case 'transferencia':
          agrupadas[itemId].totalTransferencias += mov.quantidade || 0;
          break;
        case 'ajuste':
          agrupadas[itemId].totalAjustes += mov.quantidade || 0;
          break;
      }
    });

    return Object.values(agrupadas);
  }, [movimentacoes]);

  const aplicarFiltros = () => {
    // Habilitar fetch e executar query
    setShouldFetch(true)
    refetch()
  }

  const exportarExcel = async () => {
    try {
      setExporting(true)
      
      const dadosExcel = movimentacoes.map(m => {
        // Determinar destinatário (equipe ou funcionário)
        let destinatarioNome = ''
        let destinatarioMatricula = ''
        let destinatarioTipo = ''
        
        if (m.destinatario_equipe_id && m.destinatario_equipe) {
          destinatarioNome = m.destinatario_equipe.nome
          destinatarioTipo = 'Equipe'
        } else if (m.destinatario_id) {
          if (m.destinatario) {
            destinatarioNome = m.destinatario.nome || ''
            destinatarioMatricula = m.destinatario.matricula || ''
          } else if (userInfoMap[m.destinatario_id]) {
            destinatarioNome = userInfoMap[m.destinatario_id].nome
            destinatarioMatricula = userInfoMap[m.destinatario_id].matricula || ''
          }
          destinatarioTipo = 'Funcionário'
        } else if (m.local_destino) {
          destinatarioNome = m.local_destino
          destinatarioTipo = 'Local'
        }
        
        return {
          'Data': m.criado_em ? new Date(m.criado_em).toLocaleDateString('pt-BR') : '',
          'Item': m.item?.nome || '',
          'Código': m.item?.codigo || '',
          'Categoria': m.item?.categoria || '',
          'Tipo': m.tipo || '',
          'Quantidade': m.quantidade || 0,
          'Quantidade Anterior': m.quantidade_anterior || 0,
          'Quantidade Atual': m.quantidade_atual || 0,
          'Usuário': m.usuario?.nome || '',
          'Usuário Matrícula': m.usuario?.matricula || userInfoMap[m.usuario_id]?.matricula || '',
          'Solicitante': m.solicitante?.nome || '',
          'Solicitante Matrícula': m.solicitante?.matricula || (m.solicitante_id && userInfoMap[m.solicitante_id]?.matricula) || '',
          'Destinatário': destinatarioNome,
          'Destinatário Matrícula': destinatarioMatricula,
          'Destinatário Tipo': destinatarioTipo,
          'Motivo': m.motivo || '',
          'Observações': m.observacoes || '',
          'Base': m.base?.nome || '',
          'Local Origem': m.local_origem || '',
          'Local Destino': m.local_destino || '',
          'Documento Referência': m.documento_referencia || ''
        }
      })

      const wb = XLSX.utils.book_new()
      const ws = XLSX.utils.json_to_sheet(dadosExcel)
      
      const colWidths = [
        { wch: 12 }, // Data
        { wch: 30 }, // Item
        { wch: 15 }, // Código
        { wch: 15 }, // Categoria
        { wch: 15 }, // Tipo
        { wch: 12 }, // Quantidade
        { wch: 15 }, // Quantidade Anterior
        { wch: 15 }, // Quantidade Atual
        { wch: 20 }, // Usuário
        { wch: 18 }, // Usuário Matrícula
        { wch: 20 }, // Solicitante
        { wch: 18 }, // Solicitante Matrícula
        { wch: 20 }, // Destinatário
        { wch: 18 }, // Destinatário Matrícula
        { wch: 15 }, // Destinatário Tipo
        { wch: 30 }, // Motivo
        { wch: 30 }, // Observações
        { wch: 20 }, // Base
        { wch: 20 }, // Local Origem
        { wch: 20 }, // Local Destino
        { wch: 20 }  // Documento Referência
      ]
      ws['!cols'] = colWidths

      XLSX.utils.book_append_sheet(wb, ws, 'Movimentações Estoque')
      
      const dataAtual = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')
      const nomeArquivo = `Movimentacoes_Estoque_${dataAtual}.xlsx`
      
      XLSX.writeFile(wb, nomeArquivo)
      notify('Relatório de movimentações exportado com sucesso!', 'success')
    } catch (error) {
      console.error('❌ [WEB] Erro ao exportar movimentações:', error)
      notify('Erro ao exportar relatório de movimentações', 'error')
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

  if (!user) {
    return null
  }

  return (
    <div className="container mx-auto px-6 py-8 w-full">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <TrendingUp className="h-8 w-8 text-blue-600" />
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Movimentações de Estoque</h1>
            <p className="text-gray-600">Controle de entradas, saídas e transferências</p>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            <div>
              <Label htmlFor="contrato">Contrato</Label>
              <Select value={filtros.contrato_id} onValueChange={(v) => setFiltros(prev => ({ ...prev, contrato_id: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o contrato" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os contratos</SelectItem>
                  {filteredContratos.map(contrato => (
                    <SelectItem key={contrato.id} value={contrato.id}>
                      {contrato.nome} ({contrato.codigo})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="base">Base</Label>
              <Select value={filtros.base_id} onValueChange={(v) => setFiltros(prev => ({ ...prev, base_id: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a base" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas as bases</SelectItem>
                  {filteredBases.map((base) => (
                    <SelectItem key={base.id} value={base.id}>
                      {base.nome} ({base.codigo})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="item">Item</Label>
              <Input
                id="item"
                placeholder="Nome do item"
                value={filtros.item}
                onChange={(e) => setFiltros(prev => ({ ...prev, item: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="tipo">Tipo de Movimentação</Label>
              <Select value={filtros.tipo} onValueChange={(v) => setFiltros(prev => ({ ...prev, tipo: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="entrada">Entrada</SelectItem>
                  <SelectItem value="saida">Saída</SelectItem>
                  <SelectItem value="transferencia">Transferência</SelectItem>
                  <SelectItem value="ajuste">Ajuste</SelectItem>
                  <SelectItem value="devolucao">Devolução</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="usuario">Usuário / Matrícula</Label>
              <Input
                id="usuario"
                placeholder="Nome ou matrícula do usuário"
                value={filtros.usuario}
                onChange={(e) => setFiltros(prev => ({ ...prev, usuario: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="dataInicio">Data Início</Label>
              <Input
                id="dataInicio"
                type="date"
                value={filtros.data_inicio}
                onChange={(e) => setFiltros(prev => ({ ...prev, data_inicio: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="dataFim">Data Fim</Label>
              <Input
                id="dataFim"
                type="date"
                value={filtros.data_fim}
                onChange={(e) => setFiltros(prev => ({ ...prev, data_fim: e.target.value }))}
              />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <Button onClick={aplicarFiltros}>
              <Search className="h-4 w-4 mr-2" />
              Aplicar Filtros
            </Button>
            <Button variant="outline" onClick={() => setFiltros({
              item: '',
              tipo: 'todos',
              usuario: '',
              data_inicio: '',
              data_fim: '',
              base_id: 'todos',
              contrato_id: 'todos'
            })}>
              Limpar Filtros
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Controles */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium text-gray-700">Exportar:</span>
                <Button 
                  variant="outline" 
                  onClick={exportarExcel}
                  disabled={exporting}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Excel
                </Button>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-700">Visualização:</span>
              <div className="flex border rounded-md">
                <Button
                  variant={viewMode === 'table' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('table')}
                  className="rounded-r-none"
                >
                  <ArrowUpDown className="h-4 w-4 mr-1" />
                  Tabela
                </Button>
                <Button
                  variant={viewMode === 'cards' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('cards')}
                  className="rounded-l-none"
                >
                  <Package className="h-4 w-4 mr-1" />
                  Cards
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Conteúdo Principal */}
      {loading || permissionsLoading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Carregando movimentações...</p>
        </div>
      ) : queryError ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <p className="text-red-600 font-medium mb-2">Erro ao carregar movimentações</p>
              <p className="text-sm text-gray-600">{queryError.message || 'Erro desconhecido'}</p>
            </div>
          </CardContent>
        </Card>
      ) : viewMode === 'table' ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ArrowUpDown className="h-5 w-5" />
              Movimentações ({movimentacoes.length} registros)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="w-full overflow-x-auto">
              <Table className="w-full">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-20">Data</TableHead>
                    <TableHead className="w-40">Item</TableHead>
                    <TableHead className="w-24">Tipo</TableHead>
                    <TableHead className="w-16 text-center">Qtd</TableHead>
                    <TableHead className="w-16 text-center">Ant.</TableHead>
                    <TableHead className="w-16 text-center">Atual</TableHead>
                    <TableHead className="w-32">Usuário</TableHead>
                    <TableHead className="w-32">Solicitante</TableHead>
                    <TableHead className="w-36">Destinatário</TableHead>
                    <TableHead className="w-48">Motivo</TableHead>
                    <TableHead className="w-28">Base</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {movimentacoes.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="text-xs whitespace-nowrap">
                        {m.criado_em ? new Date(m.criado_em).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '-'}
                      </TableCell>
                      <TableCell className="max-w-40">
                        <div className="truncate">
                          <div className="font-medium text-sm truncate" title={m.item?.nome}>{m.item?.nome || '-'}</div>
                          <div className="text-xs text-gray-500">{m.item?.codigo || '-'}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={getTipoColor(m.tipo) + ' text-xs'}>
                          {m.tipo}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium text-center text-sm">
                        {m.tipo === 'entrada' || m.tipo === 'devolucao' ? '+' : '-'}{m.quantidade}
                      </TableCell>
                      <TableCell className="text-center text-sm">{m.quantidade_anterior}</TableCell>
                      <TableCell className="font-medium text-center text-sm">{m.quantidade_atual}</TableCell>
                      <TableCell className="max-w-32">
                        <div className="truncate text-sm" title={userInfoMap[m.usuario_id]?.nome || m.usuario?.nome}>
                          {userInfoMap[m.usuario_id]?.nome || m.usuario?.nome || '-'}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-32">
                        <div className="truncate text-sm" title={userInfoMap[m.solicitante_id]?.nome || m.solicitante?.nome}>
                          {userInfoMap[m.solicitante_id]?.nome || m.solicitante?.nome || '-'}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-36">
                        {(() => {
                          // Se for transferência, mostrar local_destino
                          if (m.tipo === 'transferencia' && m.local_destino) {
                            return <div className="text-sm text-blue-600 truncate" title={m.local_destino}>{m.local_destino}</div>
                          }
                          
                          // Verificar destinatários
                          const temDestinatarioIndividual = m.destinatario_id && (m.destinatario || userInfoMap[m.destinatario_id])
                          const temDestinatarioEquipe = m.destinatario_equipe_id && m.destinatario_equipe
                          
                          // Se tiver ambos
                          if (temDestinatarioIndividual && temDestinatarioEquipe) {
                            const nomeFunc = m.destinatario?.nome || userInfoMap[m.destinatario_id]?.nome
                            return (
                              <div className="text-sm">
                                <div className="truncate" title={nomeFunc}>{nomeFunc}</div>
                                <div className="text-xs text-purple-600 truncate" title={m.destinatario_equipe.nome}>Eq: {m.destinatario_equipe.nome}</div>
                              </div>
                            )
                          }
                          
                          // Se tiver apenas equipe
                          if (temDestinatarioEquipe) {
                            return <div className="text-sm text-purple-600 truncate" title={m.destinatario_equipe.nome}>{m.destinatario_equipe.nome}</div>
                          }
                          
                          // Se tiver apenas funcionário
                          if (temDestinatarioIndividual) {
                            const nomeFunc = m.destinatario?.nome || userInfoMap[m.destinatario_id]?.nome
                            return <div className="text-sm truncate" title={nomeFunc}>{nomeFunc}</div>
                          }
                          
                          // Local destino
                          if (m.local_destino) {
                            return <div className="text-sm text-gray-600 truncate" title={m.local_destino}>{m.local_destino}</div>
                          }
                          
                          return '-'
                        })()}
                      </TableCell>
                      <TableCell className="max-w-48">
                        <div className="text-sm truncate" title={m.motivo}>{m.motivo || '-'}</div>
                      </TableCell>
                      <TableCell className="max-w-28">
                        <div className="text-sm truncate" title={m.base?.nome}>{m.base?.nome || '-'}</div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div>
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Resumo por Item ({movimentacoesPorItem.length} itens)
              </CardTitle>
            </CardHeader>
          </Card>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {movimentacoesPorItem.map((grupo) => (
              <Card key={grupo.item.id} className="hover:shadow-lg transition-shadow">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">
                    <div className="flex items-center gap-2">
                      <Package className="h-5 w-5 text-blue-600" />
                      <div>
                        <div className="font-medium">{grupo.item.nome}</div>
                        <div className="text-sm text-gray-500 font-normal">{grupo.item.codigo}</div>
                      </div>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <ArrowRight className="h-4 w-4 text-red-500" />
                        <span className="text-sm text-gray-600">Saídas:</span>
                      </div>
                      <Badge variant="destructive" className="font-semibold">
                        {grupo.totalSaidas}
                      </Badge>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <ArrowLeft className="h-4 w-4 text-orange-500" />
                        <span className="text-sm text-gray-600">Devoluções:</span>
                      </div>
                      <Badge variant="secondary" className="font-semibold">
                        {grupo.totalDevolucoes}
                      </Badge>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-green-500" />
                        <span className="text-sm text-gray-600">Entradas:</span>
                      </div>
                      <Badge variant="default" className="font-semibold bg-green-600">
                        {grupo.totalEntradas}
                      </Badge>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <ArrowUpDown className="h-4 w-4 text-blue-500" />
                        <span className="text-sm text-gray-600">Transferências:</span>
                      </div>
                      <Badge variant="outline" className="font-semibold">
                        {grupo.totalTransferencias}
                      </Badge>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <Filter className="h-4 w-4 text-purple-500" />
                        <span className="text-sm text-gray-600">Ajustes:</span>
                      </div>
                      <Badge variant="outline" className="font-semibold border-purple-500 text-purple-600">
                        {grupo.totalAjustes}
                      </Badge>
                    </div>
                  </div>
                  
                  <div className="mt-4 pt-3 border-t">
                    <div className="text-xs text-gray-500">
                      <div>Total de movimentações: {grupo.movimentacoes.length}</div>
                      <div>Categoria: {grupo.item.categoria}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
