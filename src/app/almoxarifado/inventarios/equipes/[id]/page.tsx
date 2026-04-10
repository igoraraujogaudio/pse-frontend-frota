'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { supabase } from '@/lib/supabase'
import { 
  Loader2, 
  ChevronRight,
  Users,
  Package,
  Shield,
  Settings,
  Hammer,
  Box,
  Calendar,
  FileText,
  AlertTriangle,
  Plus,
  Trash2,
  Search,
  X,
  Download,
  FileSpreadsheet,
} from 'lucide-react'
import { inventarioService } from '@/services/inventarioService'
import { baseService } from '@/services/baseService'
import { estoqueService } from '@/services/estoqueService'
import { useAuth } from '@/contexts/AuthContext'
import { useNotification } from '@/contexts/NotificationContext'
import { useRouter, useSearchParams, useParams } from 'next/navigation'
import { Suspense } from 'react'
import type { InventarioEquipe } from '@/types/almoxarifado'
import type { ItemEstoque } from '@/types'
import { useModularPermissions, PERMISSION_CODES } from '@/hooks/useModularPermissions'

interface HistoricoEquipeItem {
  data_movimentacao: string
  observacoes_movimentacao?: string
  condicao_movimentacao?: string
  inventario_equipe?: Record<string, unknown>
  [key: string]: unknown
}

interface ItemInventario {
  id: string
  nome: string
  codigo: string
  categoria: string
  quantidade: number
  numero_laudo?: string
  validade_laudo?: string
  observacoes?: string
  status: 'em_uso' | 'devolvido' | 'perdido' | 'danificado' | 'vencido'
  data_entrega: string
}

export default function InventarioEquipeDetalhesPage() {
  return (
    <Suspense fallback={<div className="bg-gray-50 flex items-center justify-center py-20">Carregando...</div>}>
      <InventarioEquipeDetalhesContent />
    </Suspense>
  )
}

interface InventarioItemForm {
  id: string
  item_id: string
  quantidade: number
  numero_laudo?: string
  validade_laudo?: string
  observacoes?: string
}

function InventarioEquipeDetalhesContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const params = useParams()
  const { notify } = useNotification()
  const { user } = useAuth()
  const { hasPermission } = useModularPermissions()
  const queryClient = useQueryClient()
  
  const equipeId = params.id as string
  const equipeNome = searchParams.get('nome') || 'Equipe'
  const equipeOperacao = searchParams.get('operacao') || 'N/A'
  const equipeBase = searchParams.get('base') || 'N/A'

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [inventariosData, setInventariosData] = useState<InventarioEquipe[]>([])
  const [devolucoesData, setDevolucoesData] = useState<InventarioEquipe[]>([])
  const [loadingDevolucoes, setLoadingDevolucoes] = useState(false)
  
  // Estados para novo inventário
  const [showNovoInventarioDialog, setShowNovoInventarioDialog] = useState(false)
  const [baseSelecionada, setBaseSelecionada] = useState<string>('')
  const [itensInventario, setItensInventario] = useState<InventarioItemForm[]>([])
  const [itemAtual, setItemAtual] = useState<{
    item_id: string
    quantidade: number
    numero_laudo: string
    validade_laudo: string
    observacoes: string
  }>({
    item_id: '',
    quantidade: 1,
    numero_laudo: '',
    validade_laudo: '',
    observacoes: ''
  })
  const [searchItemText, setSearchItemText] = useState('')
  const [showItemResults, setShowItemResults] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)

  const loadInventario = useCallback(async () => {
    try {
      setLoading(true)
      console.log('🔄 Carregando inventário da equipe:', equipeId)
      
      const inventarios = await inventarioService.getInventarioByEquipe(equipeId)
      
      console.log('✅ Inventário carregado:', inventarios.length, 'itens')
      setInventariosData(inventarios)
      
    } catch (error) {
      console.error('Erro ao carregar inventário:', error)
      notify('Erro ao carregar inventário da equipe', 'error')
    } finally {
      setLoading(false)
    }
  }, [equipeId, notify])

  const loadDevolucoes = useCallback(async () => {
    try {
      setLoadingDevolucoes(true)
      console.log('🔄 Carregando devoluções da equipe:', equipeId)
      
      // Tentar buscar da tabela historico_equipe primeiro (se existir)
      let historicoData: HistoricoEquipeItem[] = []
      try {
        const { data: historico, error: historicoError } = await supabase
          .from('historico_equipe')
          .select(`
            *,
            item_estoque_direto:itens_estoque!itens_estoque_id(nome, codigo, categoria)
          `)
          .eq('equipe_id', equipeId)
          .eq('tipo_movimentacao', 'devolucao')
          .order('data_movimentacao', { ascending: false })

        if (!historicoError && historico) {
          historicoData = historico as HistoricoEquipeItem[]
          console.log('✅ Devoluções encontradas em historico_equipe:', historico.length)
        } else if (historicoError) {
          console.error('❌ Erro ao buscar historico_equipe:', historicoError)
        }
      } catch {
        console.log('⚠️ Tabela historico_equipe não encontrada ou sem dados, usando fallback')
      }

      // Fallback: se não encontrou no historico_equipe, buscar itens com status inativo da tabela inventario_equipe
      if (historicoData.length === 0) {
        const { data, error } = await supabase
          .from('inventario_equipe')
          .select(`
            *,
            equipe:equipes(nome, status),
            item_estoque:itens_estoque(nome, codigo, categoria)
          `)
          .eq('equipe_id', equipeId)
          .eq('status', 'inativo')
          .order('atualizado_em', { ascending: false })

        if (error) {
          console.error('Erro ao buscar devoluções:', error)
          throw error
        }

        console.log('✅ Devoluções carregadas de inventario_equipe (status inativo):', data?.length || 0, 'itens')
        setDevolucoesData(data || [])
      } else {
        // Transformar dados do histórico para o formato esperado
        const devolucoesFormatadas = historicoData.map(hist => {
          const itemEstoqueDireto = hist.item_estoque_direto as Record<string, unknown> || {};
          return {
            id: hist['id'] as string,
            equipe_id: equipeId,
            item_estoque_id: hist['itens_estoque_id'] as string,
            item_estoque: itemEstoqueDireto,
            itens_estoque_id: hist['itens_estoque_id'] as string,
            quantidade: hist['quantidade'] as number,
            quantidade_total: hist['quantidade'] as number,
            data_devolucao: hist.data_movimentacao,
            observacoes_devolucao: hist.observacoes_movimentacao,
            condicao_devolucao: hist.condicao_movimentacao,
            status: (hist['status'] as string) || 'inativo',
            data_entrega: hist.data_movimentacao,
            criado_em: hist['criado_em'] as string,
          };
        }) as unknown as InventarioEquipe[]
        setDevolucoesData(devolucoesFormatadas)
      }
      
    } catch (error) {
      console.error('Erro ao carregar devoluções:', error)
      notify('Erro ao carregar devoluções da equipe', 'error')
    } finally {
      setLoadingDevolucoes(false)
    }
  }, [equipeId, notify])

  const onRefresh = async () => {
    setRefreshing(true)
    await loadInventario()
    setRefreshing(false)
  }

  useEffect(() => {
    if (equipeId) {
      loadInventario()
      loadDevolucoes()
    }
  }, [equipeId, loadInventario, loadDevolucoes])

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowItemResults(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  // React Query para bases
  const { data: bases = [] } = useQuery({
    queryKey: ['bases-inventario-equipe', equipeId],
    queryFn: () => baseService.getBasesAtivas(),
    staleTime: 5 * 60 * 1000,
  })

  // React Query para itens de estoque
  const { data: itensEstoque = [], isLoading: loadingItensEstoque } = useQuery({
    queryKey: ['itens-estoque-inventario-equipe', baseSelecionada],
    queryFn: async () => {
      if (!baseSelecionada) return []
      console.log('🔍 Buscando TODOS os itens para base:', baseSelecionada)
      // Buscar TODOS os itens da base, não apenas epi e equipamento
      const todosItens = await estoqueService.getEstoquePorBase(baseSelecionada)
      console.log('✅ Itens encontrados:', todosItens.length)
      return todosItens
    },
    enabled: !!baseSelecionada,
    staleTime: 2 * 60 * 1000,
  })

  // Filtrar itens baseado na busca
  const itensFiltrados = useMemo(() => {
    if (!searchItemText.trim()) return itensEstoque
    const termo = searchItemText.toLowerCase()
    return itensEstoque.filter(item =>
      item.nome.toLowerCase().includes(termo) ||
      item.codigo.toLowerCase().includes(termo) ||
      item.categoria?.toLowerCase().includes(termo)
    )
  }, [itensEstoque, searchItemText])

  // Mutation para criar inventário
  const createInventarioMutation = useMutation({
    mutationFn: async (data: {
      equipe_id: string
      base_id: string
      itens: Array<{
        item_estoque_id: string
        quantidade: number
        numero_laudo?: string
        validade_laudo?: string
        observacoes?: string
      }>
    }) => {
      if (!user?.id) throw new Error('Usuário não autenticado')
      
      // Criar inventário para cada item
      const promises = data.itens.map(item =>
        inventarioService.createInventarioEquipe({
          equipe_id: data.equipe_id,
          item_estoque_id: item.item_estoque_id,
          quantidade_total: item.quantidade,
          quantidade_disponivel: item.quantidade,
          quantidade_em_uso: 0,
          numero_laudo: item.numero_laudo,
          validade_laudo: item.validade_laudo,
          observacoes: item.observacoes,
          status: 'ativo',
          data_entrega: new Date().toISOString().split('T')[0],
          responsavel_equipe: user.id,
        })
      )
      
      await Promise.all(promises)
      return { success: true }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventarios-equipes'] })
      notify('Inventário criado com sucesso!', 'success')
      setShowNovoInventarioDialog(false)
      resetNovoInventario()
      loadInventario()
    },
    onError: (error: Error | unknown) => {
      console.error('Erro ao criar inventário:', error)
      const message = error instanceof Error ? error.message : 'Erro desconhecido'
      notify(`Erro ao criar inventário: ${message}`, 'error')
    }
  })

  const resetNovoInventario = () => {
    setBaseSelecionada('')
    setItensInventario([])
    setItemAtual({
      item_id: '',
      quantidade: 1,
      numero_laudo: '',
      validade_laudo: '',
      observacoes: ''
    })
    setSearchItemText('')
    setShowItemResults(false)
  }

  const handleSelecionarItem = (item: ItemEstoque) => {
    setItemAtual(prev => ({ ...prev, item_id: item.id }))
    setSearchItemText(item.nome)
    setShowItemResults(false)
  }

  const handleAdicionarItem = () => {
    if (!itemAtual.item_id) {
      notify('Selecione um item', 'error')
      return
    }

    const itemEstoque = itensEstoque.find(i => i.id === itemAtual.item_id)
    if (!itemEstoque) {
      notify('Item não encontrado', 'error')
      return
    }

    // Verificar se item requer laudo e se os campos estão preenchidos
    if (itemEstoque.requer_laudo && (!itemAtual.numero_laudo || !itemAtual.validade_laudo)) {
      notify('Itens que requerem laudo precisam ter número e validade do laudo preenchidos', 'error')
      return
    }

    const novoItem: InventarioItemForm = {
      id: Date.now().toString(),
      item_id: itemAtual.item_id,
      quantidade: itemAtual.quantidade,
      numero_laudo: itemAtual.numero_laudo || undefined,
      validade_laudo: itemAtual.validade_laudo || undefined,
      observacoes: itemAtual.observacoes || undefined
    }

    setItensInventario(prev => [...prev, novoItem])
    setItemAtual({
      item_id: '',
      quantidade: 1,
      numero_laudo: '',
      validade_laudo: '',
      observacoes: ''
    })
    setSearchItemText('')
    setShowItemResults(false)
    notify('Item adicionado à lista!', 'success')
  }

  const handleRemoverItem = (itemId: string) => {
    setItensInventario(prev => prev.filter(item => item.id !== itemId))
  }

  const handleSalvarInventario = () => {
    if (!baseSelecionada) {
      notify('Selecione uma base', 'error')
      return
    }

    if (itensInventario.length === 0) {
      notify('Adicione pelo menos um item', 'error')
      return
    }

    createInventarioMutation.mutate({
      equipe_id: equipeId,
      base_id: baseSelecionada,
      itens: itensInventario.map(item => ({
        item_estoque_id: item.item_id,
        quantidade: item.quantidade,
        numero_laudo: item.numero_laudo,
        validade_laudo: item.validade_laudo,
        observacoes: item.observacoes
      }))
    })
  }

  // Transformar dados para o formato esperado - Inventário (ativos)
  const itens: ItemInventario[] = inventariosData.map(inv => {
      // Acessar item_estoque que vem da query com relacionamento
      const invWithRelations = inv as InventarioEquipe & { 
        item_estoque?: { nome?: string; codigo?: string; categoria?: string }
      }
      const itemEstoque = invWithRelations.item_estoque
      
      // Acessar diretamente os campos do laudo do objeto inv (que já tem esses campos no tipo InventarioEquipe)
      const numeroLaudo = inv.numero_laudo || undefined
      const validadeLaudo = inv.validade_laudo || undefined
      
      return {
        id: inv.id || inv.equipe_id + '_' + inv.item_estoque_id,
        nome: itemEstoque?.nome || 'Item não encontrado',
        codigo: itemEstoque?.codigo || 'N/A',
        categoria: itemEstoque?.categoria || 'material',
        quantidade: inv.quantidade_total || 0,
        numero_laudo: numeroLaudo,
        validade_laudo: validadeLaudo,
        observacoes: inv.observacoes,
        status: 'em_uso' as 'em_uso' | 'devolvido' | 'perdido' | 'danificado' | 'vencido',
        data_entrega: inv.data_entrega || inv.criado_em || new Date().toISOString()
      }
    })

  // Transformar dados de devoluções
  const devolucoes: ItemInventario[] = devolucoesData.map(inv => {
    const invRecord = inv as unknown as Record<string, unknown>
    const invWithRelations = inv as InventarioEquipe & { 
      item_estoque?: { nome?: string; codigo?: string; categoria?: string }
    }
    const itemEstoque = invWithRelations.item_estoque
    
    return {
      id: inv.id || inv.equipe_id + '_' + inv.item_estoque_id,
      nome: itemEstoque?.nome || 'Item não encontrado',
      codigo: itemEstoque?.codigo || 'N/A',
      categoria: itemEstoque?.categoria || 'material',
      quantidade: (invRecord.quantidade as number) || inv.quantidade_total || 0,
      numero_laudo: inv.numero_laudo || undefined,
      validade_laudo: inv.validade_laudo || undefined,
      observacoes: (invRecord.observacoes_devolucao as string) || inv.observacoes,
      status: (invRecord.condicao_devolucao === 'danificado' ? 'danificado' : 
               invRecord.condicao_devolucao === 'perdido' ? 'perdido' : 'devolvido') as 'em_uso' | 'devolvido' | 'perdido' | 'danificado' | 'vencido',
      data_entrega: (invRecord.data_devolucao as string) || inv.data_entrega || inv.criado_em || new Date().toISOString()
    }
  })

  const getCategoriaIcon = (categoria: string) => {
    switch (categoria) {
      case 'epi': return Shield
      case 'equipamento': return Settings
      case 'ferramental': return Hammer
      case 'material': return Box
      default: return Package
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'em_uso': return 'bg-green-100 text-green-800'
      case 'devolvido': return 'bg-gray-100 text-gray-800'
      case 'perdido': return 'bg-red-100 text-red-800'
      case 'danificado': return 'bg-yellow-100 text-yellow-800'
      case 'vencido': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'em_uso': return 'Em Uso'
      case 'devolvido': return 'Devolvido'
      case 'perdido': return 'Perdido'
      case 'danificado': return 'Danificado'
      case 'vencido': return 'Vencido'
      default: return status
    }
  }

  const formatarData = (data: string) => {
    try {
      return new Date(data).toLocaleDateString('pt-BR')
    } catch {
      return data
    }
  }

  const handleDownloadPDF = async () => {
    try {
      const response = await fetch(`/api/almoxarifado/inventarios/equipes/${equipeId}/export-pdf`)
      if (!response.ok) throw new Error('Erro ao gerar relatório')
      
      const html = await response.text()
      const blob = new Blob([html], { type: 'text/html' })
      const url = window.URL.createObjectURL(blob)
      const newWindow = window.open(url, '_blank')
      if (newWindow) {
        newWindow.onload = () => {
          setTimeout(() => { newWindow.print() }, 500)
        }
      }
      notify('Relatório gerado com sucesso!', 'success')
    } catch (error) {
      console.error('Erro ao gerar relatório:', error)
      notify('Erro ao gerar relatório', 'error')
    }
  }

  const handleDownloadExcel = async () => {
    try {
      const response = await fetch(`/api/almoxarifado/inventarios/equipes/${equipeId}/export-excel`)
      if (!response.ok) throw new Error('Erro ao gerar Excel')
      
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `inventario-equipe-${equipeNome.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.xlsx`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      notify('Excel baixado com sucesso!', 'success')
    } catch (error) {
      console.error('Erro ao baixar Excel:', error)
      notify('Erro ao baixar Excel', 'error')
    }
  }

  if (loading) {
    return (
      <div className="bg-gray-50 flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        <span className="ml-2 text-gray-600">Carregando inventário...</span>
      </div>
    )
  }

  return (
    <div className="bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.back()}
                className="mr-4"
              >
                <ChevronRight className="h-4 w-4 rotate-180" />
              </Button>
              <div className="text-center">
                <h1 className="text-lg font-semibold text-gray-900">
                  Inventário da Equipe
                </h1>
                <p className="text-sm text-gray-600">{equipeNome}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadPDF}
              >
                <Download className="h-4 w-4 mr-2" />
                PDF
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadExcel}
              >
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Excel
              </Button>
              {hasPermission(PERMISSION_CODES.ALMOXARIFADO.CRIAR_NOVO_INVENTARIO) && (
                <Button
                  onClick={() => setShowNovoInventarioDialog(true)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Novo Inventário
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={onRefresh}
                disabled={refreshing}
              >
                {refreshing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Package className="h-4 w-4" />
                )}
                Atualizar
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Informações da Equipe */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="flex items-center space-x-4">
              <div className="flex-shrink-0">
                <div className="h-12 w-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Users className="h-6 w-6 text-blue-600" />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-medium text-gray-900">
                  {equipeNome}
                </h2>
                <p className="text-sm text-gray-600">
                  {equipeOperacao} • {equipeBase}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Estatísticas */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardContent className="p-6 text-center">
              <div className="text-2xl font-bold text-blue-600">
                {itens.length}
              </div>
              <div className="text-sm text-gray-600">Total de Itens</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6 text-center">
              <div className="text-2xl font-bold text-green-600">
                {itens.filter(item => item.status === 'em_uso').length}
              </div>
              <div className="text-sm text-gray-600">Em Uso</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6 text-center">
              <div className="text-2xl font-bold text-red-600">
                {itens.filter(item => item.status === 'vencido').length}
              </div>
              <div className="text-sm text-gray-600">Vencidos</div>
            </CardContent>
          </Card>
        </div>

        {/* Lista de Itens com Abas */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Package className="h-5 w-5 mr-2" />
              Itens do Inventário
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Tabs defaultValue="inventario" className="w-full">
              <div className="px-6 pt-4">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="inventario" className="flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    Inventário ({itens.length})
                  </TabsTrigger>
                  <TabsTrigger value="devolucoes" className="flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    Devoluções ({devolucoes.length})
                  </TabsTrigger>
                </TabsList>
              </div>

              {/* Aba Inventário */}
              <TabsContent value="inventario" className="mt-0">
                {itens.length === 0 ? (
                  <div className="text-center py-12">
                    <Package className="mx-auto h-12 w-12 text-gray-400" />
                    <h3 className="mt-2 text-sm font-medium text-gray-900">
                      Nenhum item encontrado
                    </h3>
                    <p className="mt-1 text-sm text-gray-500">
                      Esta equipe ainda não possui itens no inventário
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-200">
                    {itens.map((item) => {
                      const CategoriaIcon = getCategoriaIcon(item.categoria)
                      
                      return (
                    <div key={item.id} className="p-6">
                      <div className="flex items-start space-x-4">
                        <div className="flex-shrink-0">
                          <div className="h-10 w-10 bg-blue-100 rounded-lg flex items-center justify-center">
                            <CategoriaIcon className="h-5 w-5 text-blue-600" />
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <div>
                              <h3 className="text-sm font-medium text-gray-900">
                                {item.nome}
                              </h3>
                              <p className="text-sm text-gray-500">
                                {item.codigo} • {item.categoria.charAt(0).toUpperCase() + item.categoria.slice(1)}
                              </p>
                            </div>
                            <Badge variant="secondary" className="ml-2">
                              x{item.quantidade}
                            </Badge>
                          </div>
                          
                          {/* Status e Data */}
                          <div className="flex items-center justify-between mt-3">
                            <Badge className={getStatusColor(item.status)}>
                              {getStatusText(item.status)}
                            </Badge>
                            <div className="flex items-center text-xs text-gray-500">
                              <Calendar className="h-3 w-3 mr-1" />
                              Entregue em: {formatarData(item.data_entrega)}
                            </div>
                          </div>
                          
                          {/* Detalhes do Laudo (se aplicável) */}
                          {(item.numero_laudo || item.validade_laudo) && (
                            <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                              <h4 className="text-xs font-medium text-gray-700 mb-2">
                                Informações do Laudo
                              </h4>
                              <div className="space-y-1">
                                {item.numero_laudo && (
                                  <div className="flex items-center text-xs text-gray-600">
                                    <FileText className="h-3 w-3 mr-2" />
                                    Laudo: {item.numero_laudo}
                                  </div>
                                )}
                                {item.validade_laudo && (
                                  <div className="flex items-center text-xs text-gray-600">
                                    <AlertTriangle className="h-3 w-3 mr-2" />
                                    Validade: {formatarData(item.validade_laudo)}
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                          
                          {/* Observações (se houver) */}
                          {item.observacoes && (
                            <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                              <h4 className="text-xs font-medium text-blue-700 mb-1">
                                Observações
                              </h4>
                              <p className="text-xs text-blue-600 italic">
                                {item.observacoes}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
                  </div>
                )}
              </TabsContent>

              {/* Aba Devoluções */}
              <TabsContent value="devolucoes" className="mt-0">
                {loadingDevolucoes ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-gray-400 mr-2" />
                    <span className="text-gray-500">Carregando devoluções...</span>
                  </div>
                ) : devolucoes.length === 0 ? (
                  <div className="text-center py-12">
                    <Package className="mx-auto h-12 w-12 text-gray-400" />
                    <h3 className="mt-2 text-sm font-medium text-gray-900">
                      Nenhuma devolução encontrada
                    </h3>
                    <p className="mt-1 text-sm text-gray-500">
                      Esta equipe ainda não possui itens devolvidos
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-200">
                    {devolucoes.map((item) => {
                      const CategoriaIcon = getCategoriaIcon(item.categoria)
                      
                      return (
                        <div key={item.id} className="p-6">
                          <div className="flex items-start space-x-4">
                            <div className="flex-shrink-0">
                              <div className="h-10 w-10 bg-gray-100 rounded-lg flex items-center justify-center">
                                <CategoriaIcon className="h-5 w-5 text-gray-600" />
                              </div>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <div>
                                  <h3 className="text-sm font-medium text-gray-900">
                                    {item.nome}
                                  </h3>
                                  <p className="text-sm text-gray-500">
                                    {item.codigo} • {item.categoria.charAt(0).toUpperCase() + item.categoria.slice(1)}
                                  </p>
                                </div>
                                <Badge variant="secondary" className="ml-2">
                                  x{item.quantidade}
                                </Badge>
                              </div>
                              
                              {/* Status e Data */}
                              <div className="flex items-center justify-between mt-3">
                                <Badge className={getStatusColor(item.status)}>
                                  {getStatusText(item.status)}
                                </Badge>
                                <div className="flex items-center text-xs text-gray-500">
                                  <Calendar className="h-3 w-3 mr-1" />
                                  Devolvido em: {formatarData(item.data_entrega)}
                                </div>
                              </div>
                              {(item.numero_laudo || item.validade_laudo) && (
                                <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                                  <h4 className="text-xs font-medium text-gray-700 mb-2">
                                    Informações do Laudo
                                  </h4>
                                  <div className="space-y-1">
                                    {item.numero_laudo && (
                                      <div className="flex items-center text-xs text-gray-600">
                                        <FileText className="h-3 w-3 mr-2" />
                                        Laudo: {item.numero_laudo}
                                      </div>
                                    )}
                                    {item.validade_laudo && (
                                      <div className="flex items-center text-xs text-gray-600">
                                        <AlertTriangle className="h-3 w-3 mr-2" />
                                        Validade: {formatarData(item.validade_laudo)}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}
                              
                              {/* Observações (se houver) */}
                              {item.observacoes && (
                                <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                                  <h4 className="text-xs font-medium text-blue-700 mb-1">
                                    Observações
                                  </h4>
                                  <p className="text-xs text-blue-600 italic">
                                    {item.observacoes}
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      {/* Dialog: Novo Inventário */}
      <Dialog open={showNovoInventarioDialog} onOpenChange={setShowNovoInventarioDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Novo Inventário - {equipeNome}</DialogTitle>
            <DialogDescription>
              Selecione a base e adicione os itens do inventário
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Seleção de Base */}
            <div className="space-y-2">
              <Label>Base de Origem *</Label>
              <Select value={baseSelecionada} onValueChange={setBaseSelecionada}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a base" />
                </SelectTrigger>
                <SelectContent>
                  {bases.map(base => (
                    <SelectItem key={base.id} value={base.id}>
                      {base.nome} {base.codigo && `(${base.codigo})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Formulário de Item */}
            {baseSelecionada && (
              <div className="space-y-4 border-t pt-4">
                <h3 className="font-semibold">Adicionar Item</h3>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2 relative">
                    <Label>Item *</Label>
                    <div className="relative" ref={searchRef}>
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        type="text"
                        placeholder="Buscar item por nome ou código..."
                        value={searchItemText}
                        onChange={(e) => {
                          setSearchItemText(e.target.value)
                          setShowItemResults(true)
                          if (!e.target.value) {
                            setItemAtual(prev => ({ ...prev, item_id: '' }))
                          }
                        }}
                        onFocus={() => setShowItemResults(true)}
                        className="pl-10 pr-10"
                      />
                      {searchItemText && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSearchItemText('')
                            setItemAtual(prev => ({ ...prev, item_id: '' }))
                            setShowItemResults(false)
                          }}
                          className="absolute right-1 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                      {showItemResults && itensFiltrados.length > 0 && (
                        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-y-auto">
                          {loadingItensEstoque ? (
                            <div className="p-4 text-center">
                              <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                            </div>
                          ) : (
                            itensFiltrados.map(item => (
                              <div
                                key={item.id}
                                onClick={() => handleSelecionarItem(item)}
                                className="p-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex-1">
                                    <p className="text-sm font-medium text-gray-900">{item.nome}</p>
                                    <p className="text-xs text-gray-500">
                                      {item.codigo} • Estoque: {item.estoque_atual}
                                      {item.requer_laudo && (
                                        <span className="ml-2 text-blue-600">• Requer Laudo</span>
                                      )}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                    {itemAtual.item_id && (
                      <div className="text-xs text-gray-600 mt-1">
                        Item selecionado: {itensEstoque.find(i => i.id === itemAtual.item_id)?.nome}
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>Quantidade *</Label>
                    <Input
                      type="number"
                      min="1"
                      value={itemAtual.quantidade}
                      onChange={(e) => setItemAtual(prev => ({ ...prev, quantidade: parseInt(e.target.value) || 1 }))}
                    />
                  </div>
                </div>

                {(() => {
                  const itemSelecionado = itensEstoque.find(i => i.id === itemAtual.item_id)
                  return itemSelecionado?.requer_laudo ? (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Número do Laudo *</Label>
                        <Input
                          value={itemAtual.numero_laudo}
                          onChange={(e) => setItemAtual(prev => ({ ...prev, numero_laudo: e.target.value }))}
                          placeholder="Ex: LAU-2024-001"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Validade do Laudo *</Label>
                        <Input
                          type="date"
                          value={itemAtual.validade_laudo}
                          onChange={(e) => setItemAtual(prev => ({ ...prev, validade_laudo: e.target.value }))}
                        />
                      </div>
                    </div>
                  ) : null
                })()}

                <div className="space-y-2">
                  <Label>Observações</Label>
                  <Input
                    value={itemAtual.observacoes}
                    onChange={(e) => setItemAtual(prev => ({ ...prev, observacoes: e.target.value }))}
                    placeholder="Observações sobre o item"
                  />
                </div>

                <Button onClick={handleAdicionarItem} className="w-full">
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar à Lista
                </Button>
              </div>
            )}

            {/* Lista de Itens */}
            {itensInventario.length > 0 && (
              <div className="space-y-2 border-t pt-4">
                <h3 className="font-semibold">Itens a Adicionar ({itensInventario.length})</h3>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {itensInventario.map((item) => {
                    const itemEstoque = itensEstoque.find(i => i.id === item.item_id)
                    return (
                      <Card key={item.id} className="p-3">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <p className="font-medium">{itemEstoque?.nome || 'Item'}</p>
                            <p className="text-sm text-gray-500">
                              Código: {itemEstoque?.codigo || 'N/A'} • Qtd: {item.quantidade}
                              {item.numero_laudo && ` • Laudo: ${item.numero_laudo}`}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoverItem(item.id)}
                            className="text-red-500 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </Card>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowNovoInventarioDialog(false)
                resetNovoInventario()
              }}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSalvarInventario}
              disabled={createInventarioMutation.isPending || !baseSelecionada || itensInventario.length === 0}
            >
              {createInventarioMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar Inventário
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

