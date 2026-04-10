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
import type { HistoricoFuncionario } from '@/types'
import {
  Loader2,
  ChevronRight,
  User,
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
import type { ItemEstoque } from '@/types'
import { supabase } from '@/lib/supabase'
import { useModularPermissions, PERMISSION_CODES } from '@/hooks/useModularPermissions'

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

interface InventarioFuncionarioLocal {
  funcionario_id: string
  item_estoque_id: string
  quantidade: number
  status: string
  numero_laudo?: string
  validade_laudo?: string
  observacoes_entrega?: string
  observacoes_devolucao?: string
  data_entrega: string
  criado_em: string
  item_estoque?: {
    id?: string
    nome?: string
    codigo?: string
    categoria?: string
  }
}


export default function InventarioFuncionarioDetalhesPage() {
  return (
    <Suspense fallback={<div className="bg-gray-50 flex items-center justify-center py-20">Carregando...</div>}>
      <InventarioFuncionarioDetalhesContent />
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
  condicao_entrega: 'novo' | 'usado_bom' | 'usado_regular' | 'usado_ruim' | 'danificado'
  item?: ItemEstoque
}

function InventarioFuncionarioDetalhesContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const params = useParams()
  const { notify } = useNotification()
  const { user } = useAuth()
  const { hasPermission } = useModularPermissions()
  const queryClient = useQueryClient()

  const funcionarioId = params.id as string
  
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [inventariosData, setInventariosData] = useState<InventarioFuncionarioLocal[]>([])
  const [historicoDevolucoes, setHistoricoDevolucoes] = useState<HistoricoFuncionario[]>([])
  const [loadingHistorico, setLoadingHistorico] = useState(false)
  const [funcionarioNome, setFuncionarioNome] = useState(searchParams.get('nome') || 'Funcionário')
  const [funcionarioMatricula, setFuncionarioMatricula] = useState(searchParams.get('matricula') || 'N/A')
  const [funcionarioCargo, setFuncionarioCargo] = useState(searchParams.get('cargo') || 'N/A')

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
    condicao_entrega: string
  }>({
    item_id: '',
    quantidade: 1,
    numero_laudo: '',
    validade_laudo: '',
    observacoes: '',
    condicao_entrega: 'novo'
  })
  const [searchItemText, setSearchItemText] = useState('')
  const [showItemResults, setShowItemResults] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)

  const loadInventario = useCallback(async () => {
    try {
      setLoading(true)
      console.log('🔄 Carregando inventário do funcionário:', funcionarioId)

      const inventarioFuncionario = await inventarioService.getInventarioByFuncionario(funcionarioId)

      console.log('✅ Inventário carregado:', inventarioFuncionario.length, 'itens')
      setInventariosData(inventarioFuncionario)

      // Buscar dados do funcionário do banco se não vieram nos parâmetros da URL
      if (inventarioFuncionario.length > 0 && inventarioFuncionario[0].funcionario) {
        const funcionarioData = inventarioFuncionario[0].funcionario
        if (funcionarioData.nome) {
          setFuncionarioNome(funcionarioData.nome)
        }
        if (funcionarioData.matricula) {
          setFuncionarioMatricula(funcionarioData.matricula)
        }
      } else {
        // Se não há inventário, buscar dados do funcionário diretamente
        const { data: funcionarioData } = await supabase
          .from('usuarios')
          .select('nome, matricula, cargo')
          .eq('id', funcionarioId)
          .single()
        
        if (funcionarioData) {
          if (funcionarioData.nome) setFuncionarioNome(funcionarioData.nome)
          if (funcionarioData.matricula) setFuncionarioMatricula(funcionarioData.matricula)
          if (funcionarioData.cargo) setFuncionarioCargo(funcionarioData.cargo)
        }
      }

    } catch (error) {
      console.error('Erro ao carregar inventário:', error)
      notify('Erro ao carregar inventário do funcionário', 'error')
    } finally {
      setLoading(false)
    }
  }, [funcionarioId, notify])

  const loadHistoricoDevolucoes = useCallback(async () => {
    try {
      setLoadingHistorico(true)
      console.log('🔄 Carregando histórico de devoluções do funcionário:', funcionarioId)

      const historico = await estoqueService.getHistoricoFuncionario(funcionarioId)
      // Filtrar apenas devoluções
      const devolucoes = historico.filter(
        h => h.tipo_movimentacao === 'devolucao' || h.status === 'devolvido' || h.data_devolucao
      )

      // Corrigir datas de entrega inválidas buscando do histórico de entrega original
      const devolucoesCorrigidas = await Promise.all(
        devolucoes.map(async (devolucao) => {
          // Verificar se a data de entrega é inválida (1900-01-01 ou antes de 1970)
          const dataEntrega = devolucao.data_entrega ? new Date(devolucao.data_entrega) : null
          const dataInvalida = !dataEntrega || 
                               dataEntrega.getFullYear() < 1970 || 
                               dataEntrega.getFullYear() === 1900

          if (dataInvalida && devolucao.item_id) {
            // Buscar o histórico de entrega anterior para este item e funcionário
            const { data: historicoEntrega } = await supabase
              .from('historico_funcionarios')
              .select('data_entrega')
              .eq('funcionario_id', funcionarioId)
              .eq('item_id', devolucao.item_id)
              .eq('tipo_movimentacao', 'entrega')
              .order('data_entrega', { ascending: false })
              .limit(1)
              .maybeSingle()

            if (historicoEntrega?.data_entrega) {
              console.log(`✅ Data de entrega corrigida para devolução ${devolucao.id}:`, historicoEntrega.data_entrega)
              return {
                ...devolucao,
                data_entrega: historicoEntrega.data_entrega
              }
            }
          }

          return devolucao
        })
      )

      console.log('✅ Histórico de devoluções carregado:', devolucoesCorrigidas.length, 'itens')
      setHistoricoDevolucoes(devolucoesCorrigidas)

    } catch (error) {
      console.error('Erro ao carregar histórico de devoluções:', error)
      notify('Erro ao carregar histórico de devoluções', 'error')
    } finally {
      setLoadingHistorico(false)
    }
  }, [funcionarioId, notify])

  const onRefresh = async () => {
    setRefreshing(true)
    await loadInventario()
    setRefreshing(false)
  }

  useEffect(() => {
    if (funcionarioId) {
      loadInventario()
      loadHistoricoDevolucoes()
    }
  }, [funcionarioId, loadInventario, loadHistoricoDevolucoes])

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
    queryKey: ['bases-inventario-funcionario', funcionarioId],
    queryFn: () => baseService.getBasesAtivas(),
    staleTime: 5 * 60 * 1000,
  })

  // React Query para itens de estoque
  const { data: itensEstoque = [], isLoading: loadingItensEstoque } = useQuery({
    queryKey: ['itens-estoque-inventario-funcionario', baseSelecionada],
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
      funcionario_id: string
      base_id: string
      itens: Array<{
        item_estoque_id: string
        quantidade: number
        numero_laudo?: string
        validade_laudo?: string
        observacoes?: string
        condicao_entrega: string
      }>
    }) => {
      if (!user?.id) throw new Error('Usuário não autenticado')

      // Criar inventário para cada item
      const promises = data.itens.map(item =>
        inventarioService.createInventarioFuncionario({
          funcionario_id: data.funcionario_id,
          item_estoque_id: item.item_estoque_id,
          quantidade: item.quantidade,
          numero_laudo: item.numero_laudo,
          validade_laudo: item.validade_laudo,
          observacoes_entrega: item.observacoes,
          condicao_entrega: (item.condicao_entrega === 'usado_ruim' ? 'danificado' : item.condicao_entrega) as 'novo' | 'usado_bom' | 'usado_regular' | 'danificado',
          status: 'em_uso',
          data_entrega: new Date().toISOString().split('T')[0],
          responsavel_entrega: user.id,
          base_origem_id: data.base_id,
        })
      )

      await Promise.all(promises)
      return { success: true }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventarios-funcionarios'] })
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
      observacoes: '',
      condicao_entrega: 'novo'
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
      observacoes: itemAtual.observacoes || undefined,
      condicao_entrega: itemAtual.condicao_entrega as 'novo' | 'usado_bom' | 'usado_regular' | 'usado_ruim' | 'danificado',
      item: itemEstoque
    }

    setItensInventario(prev => [...prev, novoItem])
    setItemAtual({
      item_id: '',
      quantidade: 1,
      numero_laudo: '',
      validade_laudo: '',
      observacoes: '',
      condicao_entrega: 'novo'
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
      funcionario_id: funcionarioId,
      base_id: baseSelecionada,
      itens: itensInventario.map(item => ({
        item_estoque_id: item.item_id,
        quantidade: item.quantidade,
        numero_laudo: item.numero_laudo,
        validade_laudo: item.validade_laudo,
        observacoes: item.observacoes,
        condicao_entrega: item.condicao_entrega
      }))
    })
  }

  // Transformar dados para o formato esperado
  // Inventário mostra apenas itens EM USO (devolvidos ficam no histórico)
  const itens: ItemInventario[] = inventariosData.map(inv => ({
    id: inv.funcionario_id + '_' + inv.item_estoque_id,
    nome: inv.item_estoque?.nome || 'Item',
    codigo: inv.item_estoque?.codigo || 'N/A',
    categoria: inv.item_estoque?.categoria || 'material',
    quantidade: inv.quantidade,
    numero_laudo: inv.numero_laudo,
    validade_laudo: inv.validade_laudo,
    observacoes: inv.observacoes_entrega || inv.observacoes_devolucao,
    status: inv.status as 'em_uso' | 'devolvido' | 'perdido' | 'danificado' | 'vencido',
    data_entrega: inv.data_entrega || inv.criado_em
  }))

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
    if (!data) return ''
    const dataObj = new Date(data)
    // Verificar se a data é inválida (antes de 1970 ou 1900)
    if (dataObj.getFullYear() < 1970 || dataObj.getFullYear() === 1900) {
      return ''
    }
    return dataObj.toLocaleDateString('pt-BR')
  }

  const isDataValida = (data: string | null | undefined): boolean => {
    if (!data) return false
    const dataObj = new Date(data)
    return dataObj.getFullYear() >= 1970 && dataObj.getFullYear() !== 1900
  }

  const handleDownloadPDF = async () => {
    try {
      const response = await fetch(`/api/almoxarifado/inventarios/funcionarios/${funcionarioId}/export-pdf`)
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
      const response = await fetch(`/api/almoxarifado/inventarios/funcionarios/${funcionarioId}/export-excel`)
      if (!response.ok) throw new Error('Erro ao gerar Excel')
      
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `inventario-funcionario-${funcionarioNome.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.xlsx`
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
                  Inventário do Funcionário
                </h1>
                <p className="text-sm text-gray-600">{funcionarioNome}</p>
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
        {/* Informações do Funcionário */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="flex items-center space-x-4">
              <div className="flex-shrink-0">
                <div className="h-12 w-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <User className="h-6 w-6 text-blue-600" />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-medium text-gray-900">
                  {funcionarioNome}
                </h2>
                <p className="text-sm text-gray-600">
                  {funcionarioMatricula} • {funcionarioCargo}
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
                    Devoluções ({historicoDevolucoes.length})
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
                      Este funcionário ainda não possui itens no inventário
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
                                    Validade: {item.validade_laudo}
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
                {loadingHistorico ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-gray-400 mr-2" />
                    <span className="text-gray-500">Carregando devoluções...</span>
                  </div>
                ) : historicoDevolucoes.length === 0 ? (
                  <div className="text-center py-12">
                    <Package className="mx-auto h-12 w-12 text-gray-400" />
                    <h3 className="mt-2 text-sm font-medium text-gray-900">
                      Nenhuma devolução encontrada
                    </h3>
                    <p className="mt-1 text-sm text-gray-500">
                      Este funcionário ainda não possui itens devolvidos
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-200">
                    {historicoDevolucoes.map((devolucao) => {
                      const CategoriaIcon = getCategoriaIcon(devolucao.item?.categoria || 'material')

                      return (
                        <div key={devolucao.id} className="p-6">
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
                                    {devolucao.item?.nome || 'Item não encontrado'}
                                  </h3>
                                  <p className="text-sm text-gray-500">
                                    {devolucao.item?.codigo || 'N/A'} • {(devolucao.item?.categoria ? devolucao.item.categoria.charAt(0).toUpperCase() + devolucao.item.categoria.slice(1) : 'Material')}
                                  </p>
                                </div>
                                <Badge variant="secondary" className="ml-2">
                                  x{devolucao.quantidade}
                                </Badge>
                              </div>

                              {/* Status e Datas */}
                              <div className="flex items-center justify-between mt-3">
                                <Badge className={getStatusColor(devolucao.status || 'devolvido')}>
                                  {getStatusText(devolucao.status || 'devolvido')}
                                </Badge>
                                <div className="flex flex-col items-end text-xs text-gray-500">
                                  {isDataValida(devolucao.data_entrega) && (
                                    <div className="flex items-center">
                                      <Calendar className="h-3 w-3 mr-1" />
                                      Entregue: {formatarData(devolucao.data_entrega)}
                                    </div>
                                  )}
                                  {devolucao.data_devolucao && (
                                    <div className="flex items-center mt-1">
                                      <Calendar className="h-3 w-3 mr-1" />
                                      Devolvido: {formatarData(devolucao.data_devolucao)}
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Condição de Devolução */}
                              {devolucao.condicao_devolucao && (
                                <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                                  <h4 className="text-xs font-medium text-gray-700 mb-1">
                                    Condição na Devolução
                                  </h4>
                                  <p className="text-xs text-gray-600 capitalize">
                                    {devolucao.condicao_devolucao}
                                  </p>
                                </div>
                              )}

                              {/* Observações de Devolução */}
                              {devolucao.observacoes_devolucao && (
                                <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                                  <h4 className="text-xs font-medium text-blue-700 mb-1">
                                    Observações da Devolução
                                  </h4>
                                  <p className="text-xs text-blue-600 italic">
                                    {devolucao.observacoes_devolucao}
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
            <DialogTitle>Novo Inventário - {funcionarioNome}</DialogTitle>
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

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Condição</Label>
                    <Select
                      value={itemAtual.condicao_entrega}
                      onValueChange={(value) => setItemAtual(prev => ({ ...prev, condicao_entrega: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="novo">Novo</SelectItem>
                        <SelectItem value="usado_bom">Usado - Bom</SelectItem>
                        <SelectItem value="usado_regular">Usado - Regular</SelectItem>
                        <SelectItem value="usado_ruim">Usado - Ruim</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Observações</Label>
                    <Input
                      value={itemAtual.observacoes}
                      onChange={(e) => setItemAtual(prev => ({ ...prev, observacoes: e.target.value }))}
                      placeholder="Observações sobre o item"
                    />
                  </div>
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
                  {itensInventario.map((item) => (
                    <Card key={item.id} className="p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <p className="font-medium">{item.item?.nome}</p>
                          <p className="text-sm text-gray-500">
                            Código: {item.item?.codigo} • Qtd: {item.quantidade}
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
                  ))}
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
