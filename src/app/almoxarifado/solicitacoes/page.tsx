 'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useAuth } from '@/contexts/AuthContext'
import Image from 'next/image'
import { estoqueService } from '@/services/estoqueService'
import { duplaAprovacaoService } from '@/services/duplaAprovacaoService'
import { userService } from '@/services/userService'
import { moduloPredefinidoService } from '@/services/moduloPredefinidoService'
import { moduloPredefinidoEquipeService } from '@/services/moduloPredefinidoEquipeService'
import { catalogoService } from '@/services/catalogoService'
import { inventarioService } from '@/services/inventarioService'
import type { SolicitacaoItem, SolicitacaoItemComTipoMotivo, User, Base } from '@/types'
import type { InventarioFuncionario, InventarioEquipe } from '@/types/almoxarifado'
import type { ItemEstoqueCompleto } from '@/services/catalogoService'
import type { ItemModuloEquipe } from '@/services/moduloPredefinidoEquipeService'
import { SignatureRenderer } from '@/components/SignatureRenderer'

// Tipo estendido para itens do módulo com grupos
type ItemModuloComGrupo = {
  id: string
  item_estoque_id?: string
  item_catalogo_id?: string
  nome: string
  codigo: string
  quantidade_padrao: number
  quantidade_solicitada: number
  obrigatorio: boolean
  ordem: number
  grupo_item_id?: string
  variacao_item_id?: string
  grupo_item?: {
    id: string
    nome_grupo: string
    variacoes?: Array<{
      id: string
      nome_variacao: string
      item_estoque_id: string
      item_estoque?: {
        codigo: string
        estoque_atual: number
      }
    }>
  }
  variacao_item?: {
    id: string
    nome_variacao: string
    item_estoque_id: string
    item_estoque?: {
      codigo: string
      estoque_atual: number
    }
  }
  variacao_selecionada?: string
}
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { useNotification } from '@/contexts/NotificationContext'
import { supabase } from '@/lib/supabase'
import { AlertTriangle, Search, X, Users, Settings, Plus, Trash2, Package, ArrowLeftRight, RefreshCw, Loader2, Eye } from 'lucide-react'
import { PERMISSION_CODES } from '@/hooks/useModularPermissions'
import ProtectedRoute from '@/components/ProtectedRoute'
import { DateFilter, DateFilterType } from '@/components/ui/date-filter'
import { SearchableSelect } from '@/components/ui/searchable-select'

type StatusFilter = 'todas' | 'pendente' | 'aprovada' | 'rejeitada' | 'aguardando_estoque' | 'entregue' | 'devolvida'

export default function SolicitacoesPage() {
  return (
    <ProtectedRoute requiredPermissions={[
      PERMISSION_CODES.ALMOXARIFADO.SOLICITAR_ITEM,
      PERMISSION_CODES.ALMOXARIFADO.APROVAR_SOLICITACAO,
      PERMISSION_CODES.ALMOXARIFADO.VISUALIZAR_ESTOQUE,
      PERMISSION_CODES.ALMOXARIFADO.GERENCIAR_ESTOQUE,
      PERMISSION_CODES.ALMOXARIFADO.CONTROLE_ENTRADA_SAIDA,
      PERMISSION_CODES.ALMOXARIFADO.HISTORICO_MOVIMENTACOES,
      PERMISSION_CODES.ALMOXARIFADO.RELATORIOS_AVANCADOS,
      PERMISSION_CODES.ALMOXARIFADO.CONTROLE_ENTREGA,
      PERMISSION_CODES.ALMOXARIFADO.NOTIFICACOES_PUSH,
      PERMISSION_CODES.ALMOXARIFADO.RELATORIO_MOBILE
    ]}>
      <SolicitacoesContent />
    </ProtectedRoute>
  );
}

function SolicitacoesContent() {
  const { user, loading } = useAuth()
  
  const router = useRouter()
  const { notify } = useNotification()

  // ===== PADRÃO PORTARIA: sessionReady + filters objeto único =====
  const [sessionReady, setSessionReady] = useState(false)
  const [pageSize] = useState(50)

  // Chave para persistência no sessionStorage
  const STORAGE_KEY = 'solicitacoes-almoxarifado-filters'

  // Restaurar filtros do sessionStorage (se existirem)
  const getInitialFilters = () => {
    if (typeof window === 'undefined') return null
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY)
      if (saved) return JSON.parse(saved)
    } catch { /* ignore */ }
    return null
  }

  const savedState = React.useMemo(() => getInitialFilters(), [])

  const [page, setPage] = useState(savedState?.page || 1)

  // Filtros como objeto único (padrão portaria)
  const [filters, setFilters] = useState({
    status: (savedState?.filters?.status || 'todas') as StatusFilter,
    search: savedState?.filters?.search || '',
    baseId: savedState?.filters?.baseId || 'todas',
    contratoId: savedState?.filters?.contratoId || 'todos',
    tipoSolicitacao: (savedState?.filters?.tipoSolicitacao || 'todas') as 'todas' | 'origem' | 'destino',
    dataInicio: savedState?.filters?.dataInicio || '',
    dataFim: savedState?.filters?.dataFim || '',
  })

  // Debounce do search
  const [debouncedSearch, setDebouncedSearch] = useState(filters.search)
  const loadingRef = React.useRef(false)
  const authUserIdRef = React.useRef<string | null>(null)
  useEffect(() => {
    if (filters.search === debouncedSearch) return // sem mudança real
    const timer = setTimeout(() => setDebouncedSearch(filters.search), 500)
    return () => clearTimeout(timer)
  }, [filters.search]) // eslint-disable-line react-hooks/exhaustive-deps

  // Compat aliases para código existente que usa statusFilter/baseFilter/contratoFilter
  const statusFilter = filters.status
  const baseFilter = filters.baseId
  const contratoFilter = filters.contratoId
  const setStatusFilter = (v: StatusFilter) => setFilters(prev => ({ ...prev, status: v }))
  const setBaseFilter = (v: string) => setFilters(prev => ({ ...prev, baseId: v }))
  const setContratoFilter = (v: string) => setFilters(prev => ({ ...prev, contratoId: v }))

  // Bases e contratos para dropdowns
  const [bases, setBases] = useState<Base[]>([])
  const [contratos, setContratos] = useState<Array<{ id: string; nome: string }>>([])

  // Estados do filtro de data (para componente DateFilter)
  const [dateFilter, setDateFilter] = useState<DateFilterType>(savedState?.dateFilter || 'todos')
  const [dateRange, setDateRange] = useState<{ start: Date; end: Date }>(() => {
    if (savedState?.dateRange) {
      return {
        start: new Date(savedState.dateRange.start),
        end: new Date(savedState.dateRange.end),
      }
    }
    const today = new Date()
    return {
      start: new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000),
      end: new Date(today.getTime() + 24 * 60 * 60 * 1000 - 1)
    }
  })

  // Persistir filtros no sessionStorage sempre que mudarem
  useEffect(() => {
    if (!sessionReady) return
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
        filters,
        dateFilter,
        dateRange: { start: dateRange.start.toISOString(), end: dateRange.end.toISOString() },
        page,
      }))
    } catch { /* ignore */ }
  }, [filters, dateFilter, dateRange, page, sessionReady])

  // ===== DADOS VIA API =====
  const [apiData, setApiData] = useState<SolicitacaoItem[]>([])
  const [apiStats, setApiStats] = useState({ total: 0, pendente: 0, aprovada: 0, rejeitada: 0, aguardando_estoque: 0, entregue: 0, devolvida: 0 })
  const [apiPagination, setApiPagination] = useState({ page: 1, pageSize: 50, total: 0 })
  const [, setApiBases] = useState<Array<{ id: string; nome: string; codigo: string; contrato_id: string }>>([])
  const [, setApiContratos] = useState<Array<{ id: string; nome: string; codigo: string }>>([])
  const [solicitacoesLoading, setSolicitacoesLoading] = useState(false)

  // Verificar sessão e carregar bases/contratos (tudo antes de sessionReady)
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

          // Combinar bases de contratos + bases diretas do usuário
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
      // Só seta sessionReady DEPOIS de tudo carregado
      setSessionReady(true)
    }
    checkSession()
  }, [])

  // loadDataFromApi: inclui filtros no useCallback (padrão portaria: loadData com filters nas deps)
  const loadDataFromApi = React.useCallback(async (pageNum: number) => {
    if (loadingRef.current || !authUserIdRef.current) return
    loadingRef.current = true
    setSolicitacoesLoading(true)
    try {
      const params = new URLSearchParams({
        userId: authUserIdRef.current,
        page: String(pageNum),
        pageSize: String(pageSize),
        ...(filters.status !== 'todas' && { status: filters.status }),
        ...(debouncedSearch && { search: debouncedSearch }),
        ...(filters.baseId !== 'todas' && { baseId: filters.baseId }),
        ...(filters.contratoId !== 'todos' && { contratoId: filters.contratoId }),
        ...(filters.dataInicio && { dataInicio: new Date(filters.dataInicio).toISOString() }),
        ...(filters.dataFim && { dataFim: new Date(filters.dataFim + 'T23:59:59').toISOString() }),
      })
      const response = await fetch(`/api/almoxarifado/solicitacoes?${params}`)
      if (!response.ok) throw new Error('Erro ao buscar dados')
      const result = await response.json()
      setApiData(result.data || [])
      setApiStats(result.stats || { total: 0, pendente: 0, aprovada: 0, rejeitada: 0, aguardando_estoque: 0, entregue: 0, devolvida: 0 })
      setApiPagination(result.pagination || { page: pageNum, pageSize, total: 0 })
      if (result.bases) setApiBases(result.bases)
      if (result.contratos) setApiContratos(result.contratos)
    } catch (error) {
      console.error('❌ Erro ao buscar solicitações:', error)
    } finally {
      setSolicitacoesLoading(false)
      loadingRef.current = false
    }
  }, [filters, debouncedSearch, pageSize])

  // TRIGGER DE CARGA — dispara quando loadDataFromApi muda (inclui filters + debouncedSearch)
  useEffect(() => {
    if (sessionReady) {
      setPage(1)
      loadDataFromApi(1)
    }
  }, [loadDataFromApi, sessionReady])

  // Alias para manter compatibilidade com o código existente
  const solicitacoes = apiData

  const [selected, setSelected] = useState<SolicitacaoItem | null>(null)
  const [approveOpen, setApproveOpen] = useState(false)
  const [approveQty, setApproveQty] = useState('')
  const [approveObs, setApproveObs] = useState('')
  const [approveBaseId, setApproveBaseId] = useState('')
  const [inventarioItems, setInventarioItems] = useState<(InventarioFuncionario | InventarioEquipe)[]>([])

  const [rejectOpen, setRejectOpen] = useState(false)
  const [rejectReason, setRejectReason] = useState('')

  const [deliverOpen, setDeliverOpen] = useState(false)
  const [deliverQty, setDeliverQty] = useState('')
  const [deliverObs, setDeliverObs] = useState('')
  
  // Estados para campos de laudo na entrega
  const [deliverNumeroLaudo, setDeliverNumeroLaudo] = useState('')
  const [deliverValidadeLaudo, setDeliverValidadeLaudo] = useState('')
  
  // Estados para múltiplos laudos (quando quantidade > 1)
  const [deliverLaudos, setDeliverLaudos] = useState<Array<{ numero: string; validade: string }>>([])
  
  // Estados para campos de CA na entrega
  const [deliverNumeroCa, setDeliverNumeroCa] = useState('')
  
  // Estados para campos de rastreabilidade na entrega
  const [deliverNumerosRastreabilidade, setDeliverNumerosRastreabilidade] = useState<string[]>([])
  
  // Handler para mudança de data com máscara DD/MM/YYYY
  const handleValidadeLaudoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '') // Remove tudo que não é dígito
    
    // Limita a 8 dígitos (DDMMAAAA)
    if (value.length > 8) {
      value = value.slice(0, 8)
    }
    
    // Aplica máscara DD/MM/YYYY
    let formatted = value
    if (value.length > 0) {
      formatted = value.slice(0, 2)
      if (value.length > 2) {
        formatted += '/' + value.slice(2, 4)
      }
      if (value.length > 4) {
        formatted += '/' + value.slice(4, 8)
      }
    }
    
    // Armazena no formato DD/MM/YYYY para exibição
    setDeliverValidadeLaudo(formatted)
  }
  
  // Função para validar se a data é válida
  const isValidDate = (dateStr: string): boolean => {
    if (!dateStr || !/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
      return false
    }
    
    const [day, month, year] = dateStr.split('/').map(Number)
    
    // Validar ano (entre 1900 e 2100)
    if (year < 1900 || year > 2100) {
      return false
    }
    
    // Validar mês (1-12)
    if (month < 1 || month > 12) {
      return false
    }
    
    // Validar dia baseado no mês
    const daysInMonth = new Date(year, month, 0).getDate()
    if (day < 1 || day > daysInMonth) {
      return false
    }
    
    // Criar objeto Date e verificar se é válido
    const date = new Date(year, month - 1, day)
    return date.getFullYear() === year && 
           date.getMonth() === month - 1 && 
           date.getDate() === day
  }
  
  // Função para converter DD/MM/YYYY para YYYY-MM-DD antes de enviar
  // Mantém o fuso horário brasileiro (UTC-3)
  const convertDateForSubmit = (dateStr: string): string => {
    if (!dateStr) return ''
    // Se está no formato DD/MM/YYYY, converte para YYYY-MM-DD
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
      const [day, month, year] = dateStr.split('/')
      // Retorna no formato YYYY-MM-DD (data local brasileira)
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
    }
    // Se já está no formato YYYY-MM-DD, retorna como está
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return dateStr
    }
    return dateStr
  }
  
  // Estados para seleção de base na entrega
  const [deliverBaseId, setDeliverBaseId] = useState('')
  
  // Efeito para inicializar lista de laudos quando quantidade mudar
  useEffect(() => {
    if (deliverOpen && selected?.item?.requer_laudo && deliverQty) {
      const qty = parseInt(deliverQty)
      if (!isNaN(qty) && qty > 1) {
        // Inicializar array de laudos com quantidade especificada
        const novosLaudos = Array.from({ length: qty }, () => ({ numero: '', validade: '' }))
        setDeliverLaudos(novosLaudos)
      } else {
        // Se quantidade <= 1, limpar array de laudos
        setDeliverLaudos([])
      }
    } else if (!deliverOpen || !selected?.item?.requer_laudo) {
      // Limpar quando modal fechar ou item não requer laudo
      setDeliverLaudos([])
    }
  }, [deliverQty, deliverOpen, selected?.item?.requer_laudo])
  
  // Funções para atualizar laudos individuais
  const updateLaudoNumero = (index: number, numero: string) => {
    setDeliverLaudos(prev => {
      const novos = [...prev]
      novos[index] = { ...novos[index], numero }
      return novos
    })
  }
  
  const updateLaudoValidade = (index: number, validade: string) => {
    // Aplicar máscara DD/MM/YYYY
    let value = validade.replace(/\D/g, '')
    if (value.length > 8) {
      value = value.slice(0, 8)
    }
    
    let formatted = value
    if (value.length > 0) {
      formatted = value.slice(0, 2)
      if (value.length > 2) {
        formatted += '/' + value.slice(2, 4)
      }
      if (value.length > 4) {
        formatted += '/' + value.slice(4, 8)
      }
    }
    
    setDeliverLaudos(prev => {
      const novos = [...prev]
      novos[index] = { ...novos[index], validade: formatted }
      return novos
    })
  }
  // Efeito para inicializar lista de rastreabilidade quando quantidade mudar
  useEffect(() => {
    if (deliverOpen && selected?.item?.requer_rastreabilidade && deliverQty) {
      const qty = parseInt(deliverQty)
      if (!isNaN(qty) && qty >= 1) {
        const novos = Array.from({ length: qty }, () => '')
        setDeliverNumerosRastreabilidade(novos)
      } else {
        setDeliverNumerosRastreabilidade([])
      }
    } else if (!deliverOpen || !selected?.item?.requer_rastreabilidade) {
      setDeliverNumerosRastreabilidade([])
    }
  }, [deliverQty, deliverOpen, selected?.item?.requer_rastreabilidade])

  // Função para atualizar número de rastreabilidade individual
  const updateRastreabilidade = (index: number, valor: string) => {
    setDeliverNumerosRastreabilidade(prev => {
      const novos = [...prev]
      novos[index] = valor
      return novos
    })
  }
  const availableBases = bases

  // Estados para cancelamento e devolução
  const [cancelOpen, setCancelOpen] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [returnOpen, setReturnOpen] = useState(false)
  const [returnReason, setReturnReason] = useState('')
  const [returnObservations, setReturnObservations] = useState('')
  const [newItemId, setNewItemId] = useState('')
  const [simpleReturnOpen, setSimpleReturnOpen] = useState(false)
  const [simpleReturnReason, setSimpleReturnReason] = useState('')
  const [simpleReturnQuantity, setSimpleReturnQuantity] = useState('')

  // Estados para solicitação emergencial
  const [emergencyOpen, setEmergencyOpen] = useState(false)
  const [searchItem, setSearchItem] = useState('')
  const [searchUser, setSearchUser] = useState('')
  const [loadingEmergency, setLoadingEmergency] = useState(false)
  const [emergencyForm, setEmergencyForm] = useState({
    item_id: '',
    solicitante_id: '',
    base_id: '',
    quantidade_solicitada: '',
    prioridade: 'urgente' as 'baixa' | 'normal' | 'alta' | 'urgente',
    motivo_solicitacao: '',
    tipo_troca: 'fornecimento' as 'desconto' | 'troca' | 'fornecimento',
    observacoes: '',
    aprovar_automaticamente: true
  })

  // React Query para usuários e bases emergenciais
  const { data: usuarios = [] } = useQuery({
    queryKey: ['usuarios-ativos'],
    queryFn: () => userService.getUsuariosAtivos(),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  })

  // Usa as mesmas bases carregadas no checkSession
  const basesEmergenciais = bases

  // Estados para itens individuais da solicitação emergencial
  const [itensIndividuaisEmergencial, setItensIndividuaisEmergencial] = useState<SolicitacaoItemComTipoMotivo[]>([])

  // Estados para modal de devolução

  // Estados para entrega novo funcionário
  const [novoFuncionarioOpen, setNovoFuncionarioOpen] = useState(false)
  const [searchFuncionario, setSearchFuncionario] = useState('')
  const [funcionariosFiltrados, setFuncionariosFiltrados] = useState<User[]>([])
  const [itensModuloSelecionado, setItensModuloSelecionado] = useState<ItemModuloComGrupo[]>([])
  const [isSubmittingNovoFuncionario, setIsSubmittingNovoFuncionario] = useState(false)
  const [novoFuncionarioForm, setNovoFuncionarioForm] = useState({
    funcionario_id: '',
    cargo_id: '',
    modulo_predefinido_id: '',
    base_id: '',
    observacoes: ''
  })

  // React Query para módulos predefinidos e cargos
  const { data: modulosPredefinidos = [] } = useQuery({
    queryKey: ['modulos-predefinidos'],
    queryFn: () => moduloPredefinidoService.getModulosPredefinidos({ ativo: true }),
    staleTime: 10 * 60 * 1000, // 10 minutos
    gcTime: 30 * 60 * 1000, // 30 minutos
  })

  const { data: cargos = [] } = useQuery({
    queryKey: ['cargos'],
    queryFn: async () => {
      const response = await supabase.from('cargos').select('id, nome').order('nome')
      return response.data || []
    },
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  })

  // Estados para itens individuais de novo funcionário
  const [itensIndividuaisNovoFuncionario, setItensIndividuaisNovoFuncionario] = useState<Array<{
    id: string
    item_estoque_id: string
    nome: string
    codigo: string
    quantidade_solicitada: number
    grupo_item_id?: string
    variacao_item_id?: string
    grupo_item?: { id: string; nome_grupo: string }
    variacao_item?: { id: string; nome_variacao: string }
    variacao_selecionada?: string
  }>>([])
  const [searchItemNovoFuncionario, setSearchItemNovoFuncionario] = useState('')
  const [searchGrupoNovoFuncionario, setSearchGrupoNovoFuncionario] = useState('')
  const [variacoesGrupoNovoFuncionario, setVariacoesGrupoNovoFuncionario] = useState<Array<{ id: string; nome_variacao: string; item_catalogo_id: string; item_catalogo?: { id: string; nome: string; codigo: string }[] }>>([])

  // React Query para itens de estoque e grupos de novo funcionário
  const { data: itensEstoqueNovoFuncionario = [] } = useQuery({
    queryKey: ['itens-estoque-novo-funcionario', novoFuncionarioForm.base_id],
    queryFn: async () => {
      if (!novoFuncionarioForm.base_id) return []
      return catalogoService.getItensCatalogoComEstoque(novoFuncionarioForm.base_id)
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    enabled: !!novoFuncionarioForm.base_id,
  })

  const { data: gruposItensNovoFuncionario = [] } = useQuery({
    queryKey: ['grupos-itens-novo-funcionario'],
    queryFn: async () => {
      const response = await supabase.from('grupos_itens').select('id, nome_grupo, categoria').order('nome_grupo')
      return response.data || []
    },
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  })

  // Estados para Entrega Equipe
  const [entregaEquipeOpen, setEntregaEquipeOpen] = useState(false)
  const [searchEquipe, setSearchEquipe] = useState('')
  const [searchResponsavelEquipe, setSearchResponsavelEquipe] = useState('')
  const [equipesFiltradas, setEquipesFiltradas] = useState<Array<{ id: string; nome: string; operacao: string; operacao_id: string }>>([])
  // const [responsaveisEquipeFiltrados] = useState<User[]>([]) // Unused for now
  const [itensModuloEquipeSelecionado, setItensModuloEquipeSelecionado] = useState<ItemModuloEquipe[]>([])
  const [entregaEquipeForm, setEntregaEquipeForm] = useState({
    equipe_id: '',
    responsavel_equipe_id: '',
    modulo_predefinido_id: '',
    base_id: '',
    observacoes: ''
  })

  // React Query para módulos predefinidos de equipe
  const { data: modulosPredefinidosEquipe = [] } = useQuery({
    queryKey: ['modulos-predefinidos-equipe'],
    queryFn: () => moduloPredefinidoEquipeService.getModulosPredefinidosEquipe({ ativo: true }),
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  })

  // Estados para itens individuais de equipes
  const [itensIndividuaisEquipe, setItensIndividuaisEquipe] = useState<Array<{
    id: string
    item_estoque_id: string
    nome: string
    codigo: string
    quantidade_solicitada: number
    grupo_item_id?: string
    variacao_item_id?: string
    grupo_item?: { id: string; nome_grupo: string }
    variacao_item?: { id: string; nome_variacao: string }
    variacao_selecionada?: string
  }>>([])
  const [searchItemEquipe, setSearchItemEquipe] = useState('')
  const [searchGrupoEquipe, setSearchGrupoEquipe] = useState('')
  const [variacoesGrupoEquipe, setVariacoesGrupoEquipe] = useState<Array<{ id: string; nome_variacao: string; item_estoque_id: string }>>([])

  // React Query para itens de estoque e grupos de equipe
  const { data: itensEstoqueEquipe = [] } = useQuery({
    queryKey: ['itens-estoque-equipe', entregaEquipeForm.base_id],
    queryFn: async () => {
      if (!entregaEquipeForm.base_id) return []
      return catalogoService.getItensCatalogoComEstoque(entregaEquipeForm.base_id)
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    enabled: !!entregaEquipeForm.base_id,
  })

  const { data: gruposItensEquipe = [] } = useQuery({
    queryKey: ['grupos-itens-equipe'],
    queryFn: async () => {
      const response = await supabase.from('grupos_itens').select('id, nome_grupo, categoria').order('nome_grupo')
      return response.data || []
    },
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  })




  // React Query para itens do catálogo com cache por base
  const { data: itensCatalogo = [] } = useQuery({
    queryKey: ['itens-catalogo', emergencyForm.base_id || selected?.base_id],
    queryFn: async () => {
      const baseId = emergencyForm.base_id || selected?.base_id
      if (!baseId) return []
      
      console.log('🔄 Carregando itens do catálogo para base:', baseId)
      const itens = await catalogoService.getItensCatalogoComEstoque(baseId)
      console.log('✅ Itens do catálogo carregados:', itens.length)
      return itens
    },
    staleTime: 5 * 60 * 1000, // 5 minutos
    gcTime: 10 * 60 * 1000, // 10 minutos
    enabled: !!(emergencyForm.base_id || selected?.base_id),
  })


  // Mutations para ações que modificam dados
  const approveMutation = useMutation({
    mutationFn: async ({ id, quantidade, observacoes }: { id: string; quantidade: number; observacoes: string; baseId?: string }) => {
      // Usar duplaAprovacaoService para aprovação no Almoxarifado
      return duplaAprovacaoService.aprovarAlmoxarifado({
        solicitacaoId: id,
        aprovadorId: user?.id || '',
        quantidadeAprovada: quantidade,
        observacoes: observacoes
      })
    },
    onSuccess: () => {
      loadDataFromApi(page)
      notify('Solicitação aprovada pelo Almoxarifado com sucesso', 'success')
    },
    onError: (error) => {
      console.error('Erro ao aprovar solicitação:', error)
      notify('Erro ao aprovar solicitação', 'error')
    }
  })

  const rejectMutation = useMutation({
    mutationFn: async ({ id, motivo }: { id: string; motivo: string }) => {
      // Usar duplaAprovacaoService para rejeição
      return duplaAprovacaoService.rejeitarSolicitacao({
        solicitacaoId: id,
        rejeitadorId: user?.id || '',
        motivo: motivo,
        tipoRejeicao: 'almoxarifado'
      })
    },
    onSuccess: () => {
      loadDataFromApi(page)
      notify('Solicitação rejeitada pelo Almoxarifado', 'success')
    },
    onError: (error) => {
      console.error('Erro ao rejeitar solicitação:', error)
      notify('Erro ao rejeitar solicitação', 'error')
    }
  })

  // Mutation para entregar solicitação
  const deliverMutation = useMutation({
    mutationFn: async () => {
      if (!selected || !user) throw new Error('Dados inválidos')
      
      // Validações adicionais
      if (!deliverQty || deliverQty.trim() === '') {
        throw new Error('Quantidade é obrigatória')
      }

      if (!deliverBaseId || deliverBaseId.trim() === '') {
        throw new Error('Selecione a base de origem para a entrega')
      }

      const q = parseInt(deliverQty)
      if (isNaN(q) || q < 1) {
        throw new Error('Quantidade deve ser um número maior que zero')
      }

      if (q > (selected.quantidade_aprovada || 0)) {
        throw new Error(`Quantidade a entregar (${q}) não pode ser maior que aprovada (${selected.quantidade_aprovada || 0})`)
      }

      // Validação específica para itens que requerem laudo
      if (selected.item?.requer_laudo) {
        // Se quantidade > 1, validar múltiplos laudos
        if (q > 1) {
          if (deliverLaudos.length !== q) {
            throw new Error(`Este item requer ${q} laudos (um para cada unidade). Preencha todos os laudos.`)
          }
          
          // Validar cada laudo
          for (let i = 0; i < deliverLaudos.length; i++) {
            const laudo = deliverLaudos[i]
            if (!laudo.numero || laudo.numero.trim() === '') {
              throw new Error(`Laudo ${i + 1}: Número do laudo é obrigatório.`)
            }
            if (!laudo.validade || laudo.validade.trim() === '') {
              throw new Error(`Laudo ${i + 1}: Validade do laudo é obrigatória.`)
            }
            // Validar formato e validade da data
            if (!/^\d{2}\/\d{2}\/\d{4}$/.test(laudo.validade)) {
              throw new Error(`Laudo ${i + 1}: Data de validade inválida. Use o formato DD/MM/AAAA.`)
            }
            if (!isValidDate(laudo.validade)) {
              throw new Error(`Laudo ${i + 1}: Data de validade inválida. Verifique se a data existe (dia, mês e ano válidos).`)
            }
          }
        } else {
          // Se quantidade = 1, usar campos únicos
          if (!deliverNumeroLaudo || deliverNumeroLaudo.trim() === '') {
            throw new Error('Este item requer laudo. Preencha o número do laudo.')
          }
          if (!deliverValidadeLaudo || deliverValidadeLaudo.trim() === '') {
            throw new Error('Este item requer laudo. Preencha a validade do laudo.')
          }
          // Validar formato e validade da data
          if (!/^\d{2}\/\d{2}\/\d{4}$/.test(deliverValidadeLaudo)) {
            throw new Error('Data de validade inválida. Use o formato DD/MM/AAAA.')
          }
          if (!isValidDate(deliverValidadeLaudo)) {
            throw new Error('Data de validade inválida. Verifique se a data existe (dia, mês e ano válidos).')
          }
        }
      }

      // Validação específica para itens que requerem CA
      if (selected.item?.requer_ca) {
        if (!deliverNumeroCa || deliverNumeroCa.trim() === '') {
          throw new Error('Este item requer CA. Preencha o número do CA.')
        }
      }

      // Validação específica para itens que requerem rastreabilidade
      if (selected.item?.requer_rastreabilidade) {
        const qty = parseInt(deliverQty)
        for (let i = 0; i < qty; i++) {
          if (!deliverNumerosRastreabilidade[i] || deliverNumerosRastreabilidade[i].trim() === '') {
            throw new Error(`Rastreabilidade ${i + 1}: Número de rastreabilidade é obrigatório.`)
          }
        }
      }

      console.log(`🚚 [UI] Entregando item:`, { 
        id: selected.id, 
        quantidade: q, 
        observacoes: deliverObs 
      })

      // Se quantidade > 1 e há múltiplos laudos, fazer uma entrega única
      // mas incluir informações de todos os laudos nas observações
      if (q > 1 && selected.item?.requer_laudo && deliverLaudos.length > 0) {
        // Criar string com informações de todos os laudos
        const laudosInfo = deliverLaudos.map((laudo, index) => 
          `Unidade ${index + 1}: Laudo ${laudo.numero} - Validade ${laudo.validade}`
        ).join('; ')
        
        const observacoesCompletas = deliverObs 
          ? `${deliverObs}\n\nLaudos:\n${laudosInfo}`
          : `Laudos:\n${laudosInfo}`
        
        // Usar o primeiro laudo para os campos principais (compatibilidade com banco)
        // Mas incluir todos os laudos nas observações
        return await estoqueService.entregarItem(
          selected.id, 
          user.id, 
          q, 
          'novo',
          observacoesCompletas,
          deliverLaudos[0].numero, // Primeiro laudo para compatibilidade
          convertDateForSubmit(deliverLaudos[0].validade), // Primeira validade para compatibilidade
          undefined, // dataVencimento removido - usar validade_laudo
          deliverBaseId,
          undefined, // biometricData
          selected.item?.requer_rastreabilidade ? deliverNumerosRastreabilidade.filter(n => n.trim()) : undefined,
          selected.item?.requer_ca ? deliverNumeroCa : undefined,
          undefined  // validadeCa
        )
      } else {
        // Entrega única (quantidade = 1 ou sem múltiplos laudos)
        return await estoqueService.entregarItem(
          selected.id, 
          user.id, 
          q, 
          'novo',
          deliverObs,
          deliverNumeroLaudo || undefined,
          deliverValidadeLaudo ? convertDateForSubmit(deliverValidadeLaudo) : undefined,
          undefined, // dataVencimento removido - usar validade_laudo
          deliverBaseId,
          undefined, // biometricData
          selected.item?.requer_rastreabilidade ? deliverNumerosRastreabilidade.filter(n => n.trim()) : undefined,
          selected.item?.requer_ca ? deliverNumeroCa : undefined,
          undefined  // validadeCa
        )
      }
    },
    onSuccess: () => {
      notify('Item entregue com sucesso', 'success')
      setDeliverOpen(false)
      setSelected(null)
      setDeliverQty('')
      setDeliverObs('')
      setDeliverNumeroLaudo('')
      setDeliverValidadeLaudo('')
      setDeliverNumeroCa('')
      setDeliverNumerosRastreabilidade([])
      setDeliverBaseId('')
      loadDataFromApi(page)
      console.log(`✅ [UI] Item entregue com sucesso`)
    },
    onError: (error: Error | unknown) => {
      console.error(`❌ [UI] Erro ao entregar:`, error)
      const message = error instanceof Error ? error.message : 'Erro desconhecido'
      notify(`Erro ao entregar item: ${message}`, 'error')
    }
  })

  // Verificar periodicamente se há solicitações aguardando estoque que podem ser reativadas
  useEffect(() => {
    const verificarSolicitacoesAguardando = async () => {
      try {
        const { reativadas, movidas } = await estoqueService.reativarSolicitacoesComEstoque()
        if (reativadas > 0 || movidas > 0) {
          const partes = []
          if (reativadas > 0) partes.push(`${reativadas} reativada(s)`)
          if (movidas > 0) partes.push(`${movidas} movida(s) p/ aguardando`)
          notify(partes.join(' · '), 'success')
          loadDataFromApi(page)
        }
      } catch (error) {
        console.warn('Erro ao verificar solicitações aguardando:', error)
      }
    }

    // Verificar a cada 60 segundos (NÃO roda no mount para não atrasar carregamento)
    const interval = setInterval(verificarSolicitacoesAguardando, 60000)

    return () => clearInterval(interval)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notify])

  // Sistema de notificações em tempo real para novas solicitações
  useEffect(() => {
    console.log('🔔 Configurando notificações em tempo real...')
    
    // Função para tocar som de notificação
    const playNotificationSound = () => {
      try {
        // Criar um som simples usando Web Audio API
        const audioContext = new (window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext)()
        const oscillator = audioContext.createOscillator()
        const gainNode = audioContext.createGain()
        
        oscillator.connect(gainNode)
        gainNode.connect(audioContext.destination)
        
        oscillator.frequency.setValueAtTime(800, audioContext.currentTime)
        oscillator.frequency.setValueAtTime(600, audioContext.currentTime + 0.1)
        
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime)
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2)
        
        oscillator.start(audioContext.currentTime)
        oscillator.stop(audioContext.currentTime + 0.2)
      } catch (error) {
        console.warn('Não foi possível reproduzir som de notificação:', error)
      }
    }

    // Configurar subscription para detectar novas solicitações
    const subscription = supabase
      .channel('solicitacoes_changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'solicitacoes_itens',
          filter: 'status=eq.pendente' // Apenas solicitações pendentes (novas)
        },
        (payload) => {
          console.log('🔔 Nova solicitação detectada:', payload)
          
          const novaSolicitacao = payload.new as SolicitacaoItem
          
          // Tocar som de notificação
          playNotificationSound()
          
          // Mostrar notificação visual
          notify(
            `Nova solicitação: ${novaSolicitacao.item?.nome || 'Item'} - ${novaSolicitacao.solicitante?.nome || 'Solicitante'}`,
            'info'
          )
          
          // Recarregar automaticamente a lista após um pequeno delay
          setTimeout(() => {
            loadDataFromApi(page)
          }, 1000)
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'solicitacoes_itens',
          filter: 'status=eq.aprovada' // Solicitações que foram aprovadas
        },
        (payload) => {
          console.log('✅ Solicitação aprovada:', payload)
          
          const solicitacaoAprovada = payload.new as SolicitacaoItem
          
          // Notificação mais sutil para aprovações
          notify(
            `Solicitação aprovada: ${solicitacaoAprovada.item?.nome || 'Item'}`,
            'success'
          )
          
          // Recarregar dados
          setTimeout(() => {
            loadDataFromApi(page)
          }, 500)
        }
      )
      .subscribe()

    return () => {
      console.log('🔕 Removendo subscription de notificações...')
      subscription.unsubscribe()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notify])

  const handleDateFilterChange = (filter: DateFilterType) => {
    setDateFilter(filter)
    
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    
    let start: Date
    let end: Date
    
    switch (filter) {
      case 'todos':
        // Sem filtro de data — busca tudo
        setFilters(prev => ({ ...prev, dataInicio: '', dataFim: '' }))
        return
      case 'periodo':
        // Período personalizado — não altera datas
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


  // Filtros agora são aplicados server-side pela API
  // filtered é apenas um alias para os dados retornados
  const filtered = solicitacoes

  // Agrupar solicitações por grupo de entrega
  const groupedSolicitacoes = useMemo(() => {
    const grupos = new Map<string, SolicitacaoItem[]>()
    const individuais: SolicitacaoItem[] = []
    
    filtered.forEach(solicitacao => {
      if (solicitacao.grupo_entrega_id && solicitacao.tipo_solicitacao === 'novo_funcionario') {
        if (!grupos.has(solicitacao.grupo_entrega_id)) {
          grupos.set(solicitacao.grupo_entrega_id, [])
        }
        grupos.get(solicitacao.grupo_entrega_id)!.push(solicitacao)
      } else {
        individuais.push(solicitacao)
      }
    })
    
    return { grupos: Array.from(grupos.values()), individuais }
  }, [filtered])


  // Filtros para busca de itens e usuários no modal emergencial
  const filteredItensCatalogo = useMemo(() => {
    if (!searchItem) return itensCatalogo
    const searchLower = searchItem.toLowerCase()
    return itensCatalogo.filter(item => 
      item.item_nome?.toLowerCase().includes(searchLower) ||
      item.item_codigo?.toLowerCase().includes(searchLower) ||
      item.categoria?.toLowerCase().includes(searchLower)
    )
  }, [itensCatalogo, searchItem])

  const filteredUsuarios = useMemo(() => {
    if (!searchUser) return usuarios.filter(usuario => usuario.status !== 'demitido')
    const searchLower = searchUser.toLowerCase()
    return usuarios.filter(usuario => 
      usuario.status !== 'demitido' && (
        usuario.nome?.toLowerCase().includes(searchLower) ||
        usuario.matricula?.toLowerCase().includes(searchLower) ||
        usuario.cargo?.toLowerCase().includes(searchLower)
      )
    )
  }, [usuarios, searchUser])


  // Filtro para funcionários na entrega novo funcionário
  const filteredFuncionariosEntrega = useMemo(() => {
    console.log('🔍 Filtrando funcionários - termo de busca:', searchFuncionario)
    console.log('🔍 Funcionários disponíveis:', funcionariosFiltrados.length)
    
    if (!searchFuncionario.trim()) {
      console.log('📋 Sem termo de busca, retornando todos os funcionários')
      return funcionariosFiltrados
    }
    
    const searchLower = searchFuncionario.toLowerCase()
    const filtered = funcionariosFiltrados.filter(funcionario =>
      funcionario.nome.toLowerCase().includes(searchLower) ||
      funcionario.matricula?.toLowerCase().includes(searchLower) ||
      funcionario.cargo?.toLowerCase().includes(searchLower)
    )
    
    console.log('✅ Funcionários filtrados encontrados:', filtered.length)
    console.log('📦 Primeiro funcionário filtrado:', filtered[0])
    
    return filtered
  }, [funcionariosFiltrados, searchFuncionario])

  // const startIndex = (page - 1) * pageSize
  // const visible = filtered.slice(startIndex, startIndex + pageSize)

  // Função para filtrar módulos por cargo selecionado e contrato da base
  const filteredModulos = useMemo(() => {
    if (!novoFuncionarioForm.cargo_id) return []
    let filtered = modulosPredefinidos.filter(modulo => modulo.cargo_id === novoFuncionarioForm.cargo_id)
    // Filtrar pelo contrato da base selecionada
    if (novoFuncionarioForm.base_id) {
      const baseSelecionada = bases.find(b => b.id === novoFuncionarioForm.base_id)
      if (baseSelecionada?.contrato_id) {
        filtered = filtered.filter(modulo => modulo.contrato_id === baseSelecionada.contrato_id)
      }
    }
    return filtered
  }, [modulosPredefinidos, novoFuncionarioForm.cargo_id, novoFuncionarioForm.base_id, bases])

  // Filtros para entrega equipe
  const filteredEquipesEntrega = useMemo(() => {
    console.log('🔍 Filtrando equipes - termo de busca:', searchEquipe)
    console.log('🔍 Equipes disponíveis:', equipesFiltradas.length)
    
    if (!searchEquipe.trim()) {
      console.log('📋 Sem termo de busca, retornando todas as equipes')
      return equipesFiltradas
    }
    
    const searchLower = searchEquipe.toLowerCase()
    const filtered = equipesFiltradas.filter(equipe =>
      equipe.nome.toLowerCase().includes(searchLower) ||
      equipe.operacao?.toLowerCase().includes(searchLower)
    )
    
    console.log('✅ Equipes filtradas encontradas:', filtered.length)
    return filtered
  }, [equipesFiltradas, searchEquipe])

  const filteredResponsaveisEquipe = useMemo(() => {
    console.log('🔍 Filtrando responsáveis equipe - termo de busca:', searchResponsavelEquipe)
    console.log('🔍 Responsáveis disponíveis:', funcionariosFiltrados.length)
    
    if (!searchResponsavelEquipe.trim()) {
      return funcionariosFiltrados
    }
    
    const searchLower = searchResponsavelEquipe.toLowerCase()
    const filtered = funcionariosFiltrados.filter(funcionario =>
      funcionario.nome.toLowerCase().includes(searchLower) ||
      funcionario.matricula?.toLowerCase().includes(searchLower) ||
      funcionario.cargo?.toLowerCase().includes(searchLower)
    )
    
    console.log('✅ Responsáveis filtrados encontrados:', filtered.length)
    return filtered
  }, [funcionariosFiltrados, searchResponsavelEquipe])

  // Função para filtrar módulos por operação da equipe selecionada
  const filteredModulosEquipe = useMemo(() => {
    if (!entregaEquipeForm.equipe_id) return []
    const equipeSelecionada = equipesFiltradas.find(e => e.id === entregaEquipeForm.equipe_id)
    if (!equipeSelecionada?.operacao_id) return []
    return modulosPredefinidosEquipe.filter(modulo => modulo.operacao_id === equipeSelecionada.operacao_id)
  }, [modulosPredefinidosEquipe, entregaEquipeForm.equipe_id, equipesFiltradas])

  // Status counts from API (server-side)
  const countPend = apiStats.pendente
  const countAprov = apiStats.aprovada
  const countRej = apiStats.rejeitada
  const countAguardando = apiStats.aguardando_estoque
  const countEntregue = apiStats.entregue
  const countDevolvida = apiStats.devolvida

  // Verificar se o usuário tem acesso a alguma base
  if (bases.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Solicitações</h1>
            <p className="text-gray-600">Gerencie as solicitações do almoxarifado</p>
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

  // Mostrar loading enquanto sessão não está pronta
  if (loading || !sessionReady) {
    return <div className="p-6">Carregando...</div>
  }

  if (!user) {
    return <div className="p-6 text-red-600">Acesso negado.</div>
  }

  // Função para carregar inventário do funcionário/equipe
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async function loadInventario() {
    if (!selected) {
      console.log('❌ [INVENTARIO] Nenhuma solicitação selecionada')
      return
    }
    
    console.log('🔍 [INVENTARIO] Carregando inventário para:', {
      solicitacaoId: selected.id,
      destinatarioEquipe: selected.destinatario_equipe,
      destinatarioId: selected.destinatario_id,
      tipoSolicitacao: selected.tipo_solicitacao
    })
    
    try {
      let inventario: (InventarioFuncionario | InventarioEquipe)[] = []
      
      if (selected.destinatario_equipe) {
        console.log('🏢 [INVENTARIO] Buscando inventário da equipe:', selected.destinatario_equipe.id)
        // Se é equipe, buscar inventário da equipe
        inventario = await inventarioService.getInventarioByEquipe(selected.destinatario_equipe.id)
      } else if (selected.destinatario_id) {
        console.log('👤 [INVENTARIO] Buscando inventário do funcionário:', selected.destinatario_id)
        // Se é funcionário individual, buscar inventário do funcionário
        inventario = await inventarioService.getInventarioByFuncionario(selected.destinatario_id)
      } else {
        console.log('⚠️ [INVENTARIO] Nenhum destinatário identificado')
      }
      
      setInventarioItems(inventario)
      console.log('✅ [INVENTARIO] Inventário carregado:', inventario.length, 'itens')
      console.log('📋 [INVENTARIO] Primeiros itens:', inventario.slice(0, 3))
    } catch (error) {
      console.error('❌ [INVENTARIO] Erro ao carregar inventário:', error)
      setInventarioItems([])
    }
  }

  async function doApprove() {
    if (!selected || !user) return
    
    // Validações adicionais
    if (!approveQty || approveQty.trim() === '') {
      notify('Quantidade é obrigatória', 'error')
      return
    }

    const q = parseInt(approveQty)
    if (isNaN(q) || q < 1) {
      notify('Quantidade deve ser um número maior que zero', 'error')
      return
    }

    if (q > selected.quantidade_solicitada) {
      notify(`Quantidade aprovada (${q}) não pode ser maior que solicitada (${selected.quantidade_solicitada})`, 'error')
      return
    }

    approveMutation.mutate({
      id: selected.id,
      quantidade: q,
      observacoes: approveObs,
      baseId: approveBaseId || undefined
    })
    
    setApproveOpen(false)
    setSelected(null)
    setApproveQty('')
    setApproveObs('')
    setApproveBaseId('')
    setInventarioItems([])
  }

  async function doReject() {
    if (!selected || !user) return
    
    // Validações adicionais
    if (!rejectReason || rejectReason.trim() === '') {
      notify('Motivo da rejeição é obrigatório', 'error')
      return
    }

    if (rejectReason.trim().length < 10) {
      notify('Motivo da rejeição deve ter pelo menos 10 caracteres', 'error')
      return
    }

    rejectMutation.mutate({
      id: selected.id,
      motivo: rejectReason.trim()
    })
    
    setRejectOpen(false)
    setSelected(null)
    setRejectReason('')
  }


  // Função para carregar usuários (removida - agora usando React Query)

  // Função para carregar bases ativas (removida - agora usando React Query)

  // Função para abrir modal de solicitação emergencial
  function openEmergencyModal() {
    // Dados já estão sendo carregados via React Query
    setEmergencyOpen(true)
  }

  // Função para abrir modal de entrega equipe
  async function openEntregaEquipeModal() {
    try {
      console.log('🔄 Abrindo modal de entrega equipe...')
      setEntregaEquipeOpen(true)
      
      // Carregar dados necessários
      console.log('📡 Carregando dados necessários...')
      await Promise.all([
        loadModulosPredefinidosEquipe(),
        loadEquipes(),
        loadFuncionariosAtivos(),
        loadGruposItensEquipe()
      ])
      
      console.log('✅ Dados carregados com sucesso')
      console.log('📦 Módulos de equipes carregados:', modulosPredefinidosEquipe.length)
      console.log('📦 Equipes carregadas:', equipesFiltradas.length)
      console.log('📦 Funcionários carregados:', funcionariosFiltrados.length)
      
      // Focar no campo de busca
      setTimeout(() => {
        const searchInput = document.querySelector('input[placeholder*="Buscar equipe"]') as HTMLInputElement
        if (searchInput) {
          searchInput.focus()
        }
      }, 100)
    } catch (error) {
      console.error('❌ Erro ao abrir modal:', error)
      notify('Erro ao carregar dados', 'error')
    }
  }

  // Função para abrir modal de entrega novo funcionário
  async function openNovoFuncionarioModal() {
    try {
      console.log('🔄 Abrindo modal de novo funcionário...')
      setNovoFuncionarioOpen(true)
      
      // Carregar funcionários ativos
      console.log('📡 Carregando funcionários ativos...')
      await loadFuncionariosAtivos()
      
      console.log('✅ Dados carregados com sucesso')
      console.log('📦 Módulos carregados:', modulosPredefinidos.length)
      console.log('📦 Cargos carregados:', cargos.length)
      console.log('📦 Funcionários carregados:', funcionariosFiltrados.length)
      
      // Focar no campo de busca
      setTimeout(() => {
        const searchInput = document.querySelector('input[placeholder*="Buscar funcionário"]') as HTMLInputElement
        if (searchInput) {
          searchInput.focus()
        }
      }, 100)
    } catch (error) {
      console.error('❌ Erro ao abrir modal:', error)
      notify('Erro ao carregar dados', 'error')
    }
  }

  // Função para carregar equipes
  async function loadEquipes() {
    try {
      console.log('🔄 Carregando equipes...')
      const { data: equipes, error } = await supabase
        .from('equipes')
        .select('id, nome, operacao, operacao_id')
        .eq('status', 'active')
        .order('nome', { ascending: true })

      if (error) throw error

      setEquipesFiltradas(equipes || [])
      console.log('✅ Equipes carregadas:', equipes?.length || 0)
    } catch (error) {
      console.error('❌ Erro ao carregar equipes:', error)
      notify('Erro ao carregar equipes', 'error')
    }
  }








  // Função para carregar funcionários ativos (não demitidos)
  async function loadFuncionariosAtivos() {
    try {
      console.log('🔄 Carregando funcionários ativos...')
      // Usar o mesmo sistema que funciona na solicitação emergencial
      const usuariosData = await userService.getAll()
      console.log('📦 Todos os usuários carregados:', usuariosData.length)
      
      // Filtrar apenas funcionários ativos (mesmo filtro da emergencial)
      const funcionariosAtivos = usuariosData.filter(usuario => 
        usuario.status !== 'demitido'
      )
      console.log('✅ Funcionários ativos filtrados:', funcionariosAtivos.length)
      console.log('📦 Primeiro funcionário ativo (exemplo):', funcionariosAtivos[0])
      
      setFuncionariosFiltrados(funcionariosAtivos)
      // setUsuarios não é mais necessário - dados já vêm do React Query
    } catch (error) {
      console.error('❌ Erro ao carregar funcionários:', error)
      notify('Erro ao carregar funcionários', 'error')
    }
  }

  // Função para carregar itens de estoque para equipes
  async function loadItensEstoqueEquipe(baseId?: string) {
    try {
      console.log('🔄 Base selecionada para equipes:', baseId)
      // Os dados são carregados automaticamente pelo React Query quando base_id muda
      // Não precisamos fazer chamadas manuais aqui
    } catch (error) {
      console.error('❌ Erro ao carregar itens de estoque:', error)
      notify('Erro ao carregar itens de estoque', 'error')
    }
  }

  // Função para carregar grupos de itens para equipes
  async function loadGruposItensEquipe() {
    try {
      console.log('🔄 Carregando grupos de itens para equipes...')
      const grupos = await moduloPredefinidoEquipeService.getGruposItens()
      console.log('✅ Grupos de itens carregados:', grupos.length)
      // setGruposItensEquipe não é mais necessário - dados já vêm do React Query
    } catch (error) {
      console.error('❌ Erro ao carregar grupos de itens:', error)
      notify('Erro ao carregar grupos de itens', 'error')
    }
  }

  // Função para carregar variações de um grupo para equipes
  async function loadVariacoesGrupoEquipe(grupoId: string) {
    try {
      console.log('🔄 Carregando variações do grupo para equipes:', grupoId)
      const variacoes = await moduloPredefinidoEquipeService.getVariacoesGrupo(grupoId)
      console.log('✅ Variações carregadas:', variacoes.length)
      setVariacoesGrupoEquipe(variacoes)
    } catch (error) {
      console.error('❌ Erro ao carregar variações:', error)
      notify('Erro ao carregar variações', 'error')
    }
  }


  // Função para carregar módulos pré-definidos de equipes
  async function loadModulosPredefinidosEquipe() {
    try {
      console.log('🔄 Carregando módulos pré-definidos de equipes...')
      const modulos = await moduloPredefinidoEquipeService.getModulosPredefinidosEquipe({ ativo: true })
      console.log('✅ Módulos de equipes carregados:', modulos.length)
      console.log('📦 Primeiro módulo de equipe (exemplo):', modulos[0])
      // setModulosPredefinidosEquipe não é mais necessário - dados já vêm do React Query
    } catch (error) {
      console.error('❌ Erro ao carregar módulos de equipes:', error)
      notify('Erro ao carregar módulos de equipes', 'error')
    }
  }


  // Função para selecionar funcionário e preencher automaticamente cargo e módulo
  async function selecionarFuncionario(funcionarioId: string) {
    console.log('🔍 Selecionando funcionário:', funcionarioId)
    const funcionario = funcionariosFiltrados.find(f => f.id === funcionarioId)
    console.log('🔍 Funcionário encontrado:', funcionario)
    
    if (!funcionario) return

    // Encontrar o cargo do funcionário
    const cargoFuncionario = cargos.find(c => c.nome === funcionario.cargo)
    console.log('🔍 Cargo encontrado:', cargoFuncionario)
    console.log('🔍 Lista de cargos disponíveis:', cargos)
    
    if (cargoFuncionario) {
      // Preencher cargo - módulo será selecionado após escolher a base (depende do contrato)
      const currentBaseId = novoFuncionarioForm.base_id
      let moduloAutoId = ''
      
      // Se já tem base selecionada, tentar encontrar módulo compatível (cargo + contrato da base)
      if (currentBaseId) {
        const baseSelecionada = bases.find(b => b.id === currentBaseId)
        if (baseSelecionada?.contrato_id) {
          const moduloCargo = modulosPredefinidos.find(m => 
            m.cargo_id === cargoFuncionario.id && m.contrato_id === baseSelecionada.contrato_id
          )
          if (moduloCargo) {
            moduloAutoId = moduloCargo.modulo_id || moduloCargo.id
            console.log('🔍 Módulo encontrado (cargo + contrato):', moduloCargo)
            await loadItensModulo(moduloCargo.modulo_id || moduloCargo.id)
          }
        }
      }
      
      setNovoFuncionarioForm({
        ...novoFuncionarioForm,
        funcionario_id: funcionarioId,
        cargo_id: cargoFuncionario.id,
        modulo_predefinido_id: moduloAutoId
      })

      if (!moduloAutoId) {
        setItensModuloSelecionado([])
      }
    } else {
      console.log('⚠️ Cargo não encontrado para o funcionário')
      // Se não encontrar cargo correspondente, só preencher funcionário
      setNovoFuncionarioForm({
        ...novoFuncionarioForm,
        funcionario_id: funcionarioId,
        cargo_id: '',
        modulo_predefinido_id: ''
      })
      setItensModuloSelecionado([])
    }
  }

  // Função para selecionar equipe
  async function selecionarEquipe(equipeId: string) {
    console.log('🔍 Selecionando equipe:', equipeId)
    const equipe = equipesFiltradas.find(e => e.id === equipeId)
    console.log('🔍 Equipe encontrada:', equipe)
    
    if (!equipe) return

    setEntregaEquipeForm({
      ...entregaEquipeForm,
      equipe_id: equipeId
    })
  }

  // Função para selecionar responsável da equipe
  async function selecionarResponsavelEquipe(responsavelId: string) {
    console.log('🔍 Selecionando responsável equipe:', responsavelId)
    const responsavel = funcionariosFiltrados.find(f => f.id === responsavelId)
    console.log('🔍 Responsável encontrado:', responsavel)
    
    if (!responsavel) return

    setEntregaEquipeForm({
      ...entregaEquipeForm,
      responsavel_equipe_id: responsavelId
    })
  }

  // Função para selecionar base e carregar itens
  function selecionarBaseEquipe(baseId: string) {
    setEntregaEquipeForm(prev => ({ ...prev, base_id: baseId }))
    loadItensEstoqueEquipe(baseId)
  }

  // Função para carregar itens de um módulo
  async function loadItensModulo(moduloId: string) {
    try {
      console.log('🔄 loadItensModulo - moduloId recebido:', moduloId)
      const itens = await moduloPredefinidoService.getItensModulo(moduloId)
      console.log('📦 loadItensModulo - itens retornados:', itens.length, itens)
      const itensComQuantidade = itens.map(item => ({
        id: item.id,
        item_estoque_id: item.item_estoque_id,
        item_catalogo_id: item.item_catalogo_id,
        nome: item.item_catalogo?.nome || item.item_estoque?.nome || item.grupo_item?.nome_grupo || 'Item',
        codigo: item.item_catalogo?.codigo || item.item_estoque?.codigo || '',
        quantidade_padrao: item.quantidade_padrao,
        quantidade_solicitada: item.quantidade_padrao,
        obrigatorio: item.obrigatorio,
        ordem: item.ordem,
        grupo_item_id: item.grupo_item_id,
        variacao_item_id: item.variacao_item_id,
        grupo_item: item.grupo_item,
        variacao_item: item.variacao_item,
        variacao_selecionada: item.variacao_item_id || undefined
      }))
      setItensModuloSelecionado(itensComQuantidade)
    } catch (error) {
      console.error('Erro ao carregar itens do módulo:', error)
      notify('Erro ao carregar itens do módulo', 'error')
    }
  }

  // Função para carregar itens de um módulo para equipe
  async function loadItensModuloEquipe(moduloId: string) {
    try {
      console.log('🔄 [FRONTEND] Carregando itens do módulo:', moduloId)
      const itens = await moduloPredefinidoEquipeService.getItensModuloEquipe(moduloId)
      console.log('📦 [FRONTEND] Itens carregados:', itens.length, itens)
      setItensModuloEquipeSelecionado(itens)
    } catch (error) {
      console.error('Erro ao carregar itens do módulo de equipe:', error)
      notify('Erro ao carregar itens do módulo de equipe', 'error')
    }
  }

  // Função para alterar quantidade de um item
  function alterarQuantidadeItem(itemId: string, novaQuantidade: number) {
    setItensModuloSelecionado(prev => 
      prev.map(item => 
        item.id === itemId 
          ? { ...item, quantidade_solicitada: Math.max(0, novaQuantidade) }
          : item
      )
    )
  }

  // Função para remover item da lista
  function removerItemLista(itemId: string) {
    setItensModuloSelecionado(prev => 
      prev.filter(item => item.id !== itemId || item.obrigatorio)
    )
  }

  // Função para alterar quantidade de um item de equipe
  function alterarQuantidadeItemEquipe(itemId: string, novaQuantidade: number) {
    setItensIndividuaisEquipe(prev => 
      prev.map(item => 
        item.id === itemId 
          ? { ...item, quantidade_solicitada: Math.max(0, novaQuantidade) }
          : item
      )
    )
  }

  // Função para adicionar item individual para equipe
  function adicionarItemIndividualEquipe(item: ItemEstoqueCompleto) {
    const novoItem = {
      id: `item_${Date.now()}`,
      item_estoque_id: item.item_estoque_id,
      nome: item.item_nome,
      codigo: item.item_codigo,
      quantidade_solicitada: 1
    }
    setItensIndividuaisEquipe(prev => [...prev, novoItem])
  }

  // Função para adicionar grupo de itens para equipe
  function adicionarGrupoEquipe(grupo: { id: string; nome_grupo: string; categoria: string }) {
    const novoItem = {
      id: `grupo_${Date.now()}`,
      item_estoque_id: '',
      nome: grupo.nome_grupo,
      codigo: grupo.categoria,
      quantidade_solicitada: 1,
      grupo_item_id: grupo.id,
      grupo_item: grupo
    }
    setItensIndividuaisEquipe(prev => [...prev, novoItem])
    loadVariacoesGrupoEquipe(grupo.id)
  }

  // Função para remover item individual de equipe
  function removerItemIndividualEquipe(itemId: string) {
    setItensIndividuaisEquipe(prev => prev.filter(item => item.id !== itemId))
  }

  // Função para selecionar variação de item de equipe
  function selecionarVariacaoEquipe(itemId: string, variacaoId: string) {
    const variacao = variacoesGrupoEquipe.find(v => v.id === variacaoId)
    if (!variacao) return

    setItensIndividuaisEquipe(prev => 
      prev.map(item => 
        item.id === itemId 
          ? { 
              ...item, 
              variacao_item_id: variacaoId,
              variacao_selecionada: variacaoId,
              item_estoque_id: variacao.item_estoque_id
            }
          : item
      )
    )
  }

  // Função para carregar dados quando base for selecionada
  async function loadDadosItensIndividuais(baseId: string) {
    try {
      console.log('🔄 Base selecionada para itens individuais:', baseId)
      // Os dados são carregados automaticamente pelo React Query quando base_id muda
      // Não precisamos fazer chamadas manuais aqui
    } catch (error) {
      console.error('❌ Erro ao carregar dados para itens individuais:', error)
    }
  }


  // Função para adicionar item individual à lista de novo funcionário
  function adicionarItemIndividualNovoFuncionario(item: ItemEstoqueCompleto) {
    const novoItem = {
      id: `individual_${Date.now()}_${Math.random()}`,
      item_estoque_id: item.item_estoque_id,
      nome: item.item_nome,
      codigo: item.item_codigo,
      quantidade_solicitada: 1,
      grupo_item_id: undefined,
      variacao_item_id: undefined,
      grupo_item: undefined,
      variacao_item: undefined,
      variacao_selecionada: undefined
    }

    setItensIndividuaisNovoFuncionario(prev => [...prev, novoItem])
    setSearchItemNovoFuncionario('')
    notify('Item adicionado à lista', 'success')
  }

  // Função para adicionar grupo de itens à lista de novo funcionário
  function adicionarGrupoIndividualNovoFuncionario(grupo: { id: string; nome_grupo: string; categoria: string }) {
    const novoItem = {
      id: `grupo_${Date.now()}_${Math.random()}`,
      item_estoque_id: '',
      nome: grupo.nome_grupo,
      codigo: `GRUPO-${grupo.nome_grupo.toUpperCase()}`,
      quantidade_solicitada: 1,
      grupo_item_id: grupo.id,
      variacao_item_id: undefined,
      grupo_item: { id: grupo.id, nome_grupo: grupo.nome_grupo },
      variacao_item: undefined,
      variacao_selecionada: undefined
    }

    setItensIndividuaisNovoFuncionario(prev => [...prev, novoItem])
    setSearchGrupoNovoFuncionario('')
    loadVariacoesGrupoNovoFuncionario(grupo.id)
    notify('Grupo adicionado à lista', 'success')
  }

  // Função para alterar quantidade de item individual
  function alterarQuantidadeItemIndividualNovoFuncionario(itemId: string, novaQuantidade: number) {
    if (novaQuantidade < 0) return

    setItensIndividuaisNovoFuncionario(prev => 
      prev.map(item => 
        item.id === itemId 
          ? { ...item, quantidade_solicitada: novaQuantidade }
          : item
      )
    )
  }

  // Função para remover item individual da lista
  function removerItemIndividualNovoFuncionario(itemId: string) {
    setItensIndividuaisNovoFuncionario(prev => 
      prev.filter(item => item.id !== itemId)
    )
    notify('Item removido da lista', 'success')
  }

  // Função para carregar variações de um grupo
  async function loadVariacoesGrupoNovoFuncionario(grupoId: string) {
    try {
      console.log('🔄 Carregando variações do grupo para novo funcionário:', grupoId)
      const { data: variacoes, error } = await supabase
        .from('variacoes_itens')
        .select(`
          id,
          nome_variacao,
          item_catalogo_id,
          item_catalogo:itens_catalogo!item_catalogo_id (id, nome, codigo)
        `)
        .eq('grupo_id', grupoId)
        .eq('ativo', true)
        .order('nome_variacao', { ascending: true })

      if (error) throw error

      setVariacoesGrupoNovoFuncionario(variacoes || [])
      console.log('✅ Variações carregadas para novo funcionário:', variacoes?.length || 0)
    } catch (error) {
      console.error('❌ Erro ao carregar variações para novo funcionário:', error)
    }
  }

  // Função para selecionar variação de item individual
  function selecionarVariacaoItemIndividualNovoFuncionario(itemId: string, variacaoId: string) {
    const variacao = variacoesGrupoNovoFuncionario.find(v => v.id === variacaoId)
    if (!variacao) return

    setItensIndividuaisNovoFuncionario(prev => 
      prev.map(item => 
        item.id === itemId 
          ? { 
              ...item, 
              variacao_item_id: variacaoId,
              variacao_selecionada: variacaoId,
              item_estoque_id: variacao.item_catalogo_id
            }
          : item
      )
    )
  }


  // Função para adicionar item individual à solicitação emergencial
  function addItemEmergencial() {
    if (!emergencyForm.item_id || !emergencyForm.quantidade_solicitada) {
      notify('Selecione um item e informe a quantidade', 'error')
      return
    }

    const itemSelecionado = itensCatalogo.find(item => item.item_estoque_id === emergencyForm.item_id)
    if (!itemSelecionado) {
      notify('Item não encontrado', 'error')
      return
    }

    // Verificar se o item já foi adicionado
    const itemJaAdicionado = itensIndividuaisEmergencial.find(item => item.item_estoque_id === emergencyForm.item_id)
    if (itemJaAdicionado) {
      notify('Este item já foi adicionado à lista', 'error')
      return
    }

    const novoItem: SolicitacaoItemComTipoMotivo = {
      id: `emergency_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      item_estoque_id: emergencyForm.item_id,
      nome: itemSelecionado.item_nome || '',
      codigo: itemSelecionado.item_codigo || '',
      quantidade_solicitada: parseInt(emergencyForm.quantidade_solicitada),
      tipo_troca: emergencyForm.tipo_troca,
      motivo_solicitacao: emergencyForm.motivo_solicitacao || '',
      observacoes: emergencyForm.observacoes || undefined
    }

    setItensIndividuaisEmergencial(prev => [...prev, novoItem])
    
    // Limpar campos de seleção
    setEmergencyForm(prev => ({ ...prev, item_id: '', quantidade_solicitada: '' }))
    setSearchItem('')
    
    notify('Item adicionado à lista', 'success')
  }

  // Função para remover item individual da solicitação emergencial
  function removeItemEmergencial(itemId: string) {
    setItensIndividuaisEmergencial(prev => prev.filter(item => item.id !== itemId))
    notify('Item removido da lista', 'success')
  }

  // Função para atualizar tipo e motivo de um item específico
  function updateItemTipoMotivo(itemId: string, campo: 'tipo_troca' | 'motivo_solicitacao' | 'observacoes', valor: string) {
    setItensIndividuaisEmergencial(prev => 
      prev.map(item => 
        item.id === itemId 
          ? { ...item, [campo]: valor }
          : item
      )
    )
  }

  // Função para limpar todos os itens da solicitação emergencial
  function clearItensEmergencial() {
    setItensIndividuaisEmergencial([])
    setEmergencyForm(prev => ({ ...prev, item_id: '', quantidade_solicitada: '' }))
    setSearchItem('')
    notify('Lista de itens limpa', 'success')
  }

  // Função para criar solicitação emergencial
  async function createEmergencyRequest() {
    if (!user) return

    // Bloquear se já estiver processando
    if (loadingEmergency) {
      return
    }

    // Validações
    if (itensIndividuaisEmergencial.length === 0) {
      notify('Adicione pelo menos um item à lista', 'error')
      return
    }
    if (!emergencyForm.solicitante_id) {
      notify('Selecione um funcionário', 'error')
      return
    }
    if (!emergencyForm.base_id) {
      notify('Selecione uma base', 'error')
      return
    }
    if (!emergencyForm.motivo_solicitacao.trim()) {
      notify('Motivo da solicitação é obrigatório', 'error')
      return
    }

    // Ativar loading imediatamente para bloquear cliques duplicados
    setLoadingEmergency(true)

    try {
      let solicitacoesCriadas = 0
      const erros: string[] = []

      // Criar uma solicitação para cada item
      for (const item of itensIndividuaisEmergencial) {
        try {
          // O item_estoque_id já é o ID correto do item na base selecionada
          if (!item.item_estoque_id) {
            erros.push(`Item "${item.nome}" não possui ID válido`)
            continue
          }

          // Criar a solicitação usando os dados específicos do item
          const solicitacaoData = {
            item_id: item.item_estoque_id, // ID do item em itens_estoque (já vinculado à base correta)
            solicitante_id: user.id, // Quem está fazendo a solicitação (almoxarifado/supervisor)
            destinatario_id: emergencyForm.solicitante_id, // Quem vai receber o item (funcionário)
            base_id: emergencyForm.base_id, // Base de onde puxar o estoque
            quantidade_solicitada: item.quantidade_solicitada,
            prioridade: emergencyForm.prioridade,
            motivo_solicitacao: item.motivo_solicitacao, // Usar motivo específico do item
            tipo_troca: item.tipo_troca, // Usar tipo específico do item
            observacoes: item.observacoes || undefined, // Usar observações específicas do item
          }

          console.log(`🚨 [EMERGENCIAL] Criando solicitação ${solicitacoesCriadas + 1}/${itensIndividuaisEmergencial.length}:`, solicitacaoData)

          const novaSolicitacao = await estoqueService.criarSolicitacao(solicitacaoData)

          // Se marcado para aprovar automaticamente
          if (emergencyForm.aprovar_automaticamente) {
            console.log(`⚡ [EMERGENCIAL] Aprovando automaticamente solicitação ${solicitacoesCriadas + 1}...`)
            await duplaAprovacaoService.aprovarAlmoxarifado({
              solicitacaoId: novaSolicitacao.id,
              aprovadorId: user.id,
              quantidadeAprovada: item.quantidade_solicitada,
              observacoes: 'Solicitação emergencial aprovada automaticamente pelo almoxarife'
            })
          }

          solicitacoesCriadas++
        } catch (error) {
          console.error(`❌ [EMERGENCIAL] Erro ao criar solicitação para item "${item.nome}":`, error)
          erros.push(`Erro ao criar solicitação para "${item.nome}": ${error instanceof Error ? error.message : 'Erro desconhecido'}`)
        }
      }

      // Mostrar resultado
      if (solicitacoesCriadas > 0) {
        const mensagem = emergencyForm.aprovar_automaticamente 
          ? `${solicitacoesCriadas} solicitação(ões) emergencial(is) criada(s) e aprovada(s) automaticamente!`
          : `${solicitacoesCriadas} solicitação(ões) emergencial(is) criada(s) com sucesso!`
        notify(mensagem, 'success')
      }

      if (erros.length > 0) {
        console.error('❌ [EMERGENCIAL] Erros encontrados:', erros)
        notify(`Alguns itens tiveram erro: ${erros.join('; ')}`, 'warning')
      }

      // Resetar formulário e fechar modal
      setEmergencyForm({
        item_id: '',
        solicitante_id: '',
        base_id: '',
        quantidade_solicitada: '',
        prioridade: 'urgente',
        motivo_solicitacao: '',
        tipo_troca: 'fornecimento',
        observacoes: '',
        aprovar_automaticamente: true
      })
      setItensIndividuaisEmergencial([])
      setSearchItem('')
      setSearchUser('')
      setEmergencyOpen(false)
      loadDataFromApi(page)

    } catch (error) {
      console.error('❌ [EMERGENCIAL] Erro geral:', error)
      notify(`Erro ao criar solicitações emergenciais: ${error instanceof Error ? error.message : 'Erro desconhecido'}`, 'error')
    } finally {
      setLoadingEmergency(false)
    }
  }

  // Função para criar grupo de entrega para novo funcionário
  async function createNovoFuncionarioGroup() {
    if (!user) return

    // Validações
    if (!novoFuncionarioForm.funcionario_id) {
      notify('Selecione um funcionário', 'error')
      return
    }
    if (!novoFuncionarioForm.cargo_id) {
      notify('Selecione um cargo', 'error')
      return
    }
    if (!novoFuncionarioForm.base_id) {
      notify('Selecione uma base', 'error')
      return
    }
    if (!novoFuncionarioForm.modulo_predefinido_id && itensIndividuaisNovoFuncionario.length === 0) {
      notify('Selecione um módulo pré-definido ou adicione itens individuais', 'error')
      return
    }

    // Impedir múltiplos cliques
    if (isSubmittingNovoFuncionario) return

    try {
      setIsSubmittingNovoFuncionario(true)
      let solicitacoesCriadas = 0

      // Se há módulo selecionado, criar grupo com módulo
      if (novoFuncionarioForm.modulo_predefinido_id) {
        // Criar grupo de entrega
        const grupo = await moduloPredefinidoService.criarGrupoEntrega(
          {
            funcionario_id: novoFuncionarioForm.funcionario_id,
            cargo_id: novoFuncionarioForm.cargo_id,
            modulo_predefinido_id: novoFuncionarioForm.modulo_predefinido_id,
            observacoes: novoFuncionarioForm.observacoes || undefined
          },
          user.id
        )

        // Criar solicitações baseadas no módulo pré-definido
        solicitacoesCriadas = await moduloPredefinidoService.criarSolicitacoesModuloPredefinido(
          grupo.id,
          novoFuncionarioForm.modulo_predefinido_id,
          user.id,
          novoFuncionarioForm.funcionario_id,
          'Entrega para novo funcionário'
        )
      } else {
        // Criar grupo sem módulo (apenas itens individuais)
        await moduloPredefinidoService.criarGrupoEntrega(
          {
            funcionario_id: novoFuncionarioForm.funcionario_id,
            cargo_id: novoFuncionarioForm.cargo_id,
            observacoes: novoFuncionarioForm.observacoes || undefined
          },
          user.id
        )

        // Criar solicitações para itens individuais
        for (const item of itensIndividuaisNovoFuncionario) {
          if (item.grupo_item_id && !item.variacao_selecionada) {
            notify(`Selecione uma variação para o grupo: ${item.nome}`, 'error')
            return
          }

          const itemEstoqueId = item.variacao_selecionada || item.item_estoque_id
          if (!itemEstoqueId) continue

          await estoqueService.criarSolicitacao({
            item_id: itemEstoqueId,
            solicitante_id: user.id,
            destinatario_id: novoFuncionarioForm.funcionario_id,
            base_id: novoFuncionarioForm.base_id,
            quantidade_solicitada: item.quantidade_solicitada,
            prioridade: 'normal',
            tipo_troca: 'fornecimento',
            motivo_solicitacao: 'Entrega para novo funcionário - Item individual',
            observacoes: novoFuncionarioForm.observacoes
          })

          solicitacoesCriadas++
        }
      }

      // Se há itens individuais adicionais, criar solicitações para eles também
      if (novoFuncionarioForm.modulo_predefinido_id && itensIndividuaisNovoFuncionario.length > 0) {
        // Buscar o grupo criado para adicionar itens individuais
        const grupos = await moduloPredefinidoService.getGruposEntrega()
        const grupoCriado = grupos.find(g => 
          g.funcionario_id === novoFuncionarioForm.funcionario_id && 
          g.cargo_id === novoFuncionarioForm.cargo_id
        )

        if (grupoCriado) {
          for (const item of itensIndividuaisNovoFuncionario) {
            if (item.grupo_item_id && !item.variacao_selecionada) {
              notify(`Selecione uma variação para o grupo: ${item.nome}`, 'error')
              return
            }

            const itemEstoqueId = item.variacao_selecionada || item.item_estoque_id
            if (!itemEstoqueId) continue

            await estoqueService.criarSolicitacao({
              item_id: itemEstoqueId,
              solicitante_id: user.id,
              destinatario_id: novoFuncionarioForm.funcionario_id,
              base_id: novoFuncionarioForm.base_id,
              quantidade_solicitada: item.quantidade_solicitada,
              prioridade: 'normal',
              tipo_troca: 'fornecimento',
              motivo_solicitacao: 'Entrega para novo funcionário - Item individual adicional',
              observacoes: novoFuncionarioForm.observacoes
            })

            solicitacoesCriadas++
          }
        }
      }

      notify(
        `Grupo de entrega criado com sucesso! ${solicitacoesCriadas} solicitação(ões) criada(s).`,
        'success'
      )

      // Resetar formulário e fechar modal
      setNovoFuncionarioForm({
        funcionario_id: '',
        cargo_id: '',
        modulo_predefinido_id: '',
        base_id: '',
        observacoes: ''
      })
      setSearchFuncionario('')
      setItensModuloSelecionado([])
      setItensIndividuaisNovoFuncionario([])
      setNovoFuncionarioOpen(false)
      loadDataFromApi(page)

    } catch (error) {
      console.error('❌ [NOVO FUNCIONÁRIO] Erro:', error)
      notify(`Erro ao criar grupo de entrega: ${error instanceof Error ? error.message : 'Erro desconhecido'}`, 'error')
    } finally {
      setIsSubmittingNovoFuncionario(false)
    }
  }

  // Função para criar grupo de entrega para equipe
  async function createEntregaEquipeGroup() {
    if (!user) return

    // Validações
    if (!entregaEquipeForm.equipe_id) {
      notify('Selecione uma equipe', 'error')
      return
    }
    if (!entregaEquipeForm.responsavel_equipe_id) {
      notify('Selecione um responsável pela equipe', 'error')
      return
    }
    if (!entregaEquipeForm.base_id) {
      notify('Selecione uma base', 'error')
      return
    }
    // Validar que há itens para solicitar (módulo ou individuais)
    if (!entregaEquipeForm.modulo_predefinido_id && itensIndividuaisEquipe.length === 0) {
      notify('Selecione um módulo pré-definido ou adicione itens individuais', 'error')
      return
    }

    try {
      let solicitacoesCriadas = 0

      // Se há módulo selecionado, criar solicitações do módulo
      if (entregaEquipeForm.modulo_predefinido_id) {
        solicitacoesCriadas = await estoqueService.criarSolicitacoesParaEquipe(
          entregaEquipeForm.modulo_predefinido_id,
          entregaEquipeForm.equipe_id,
          entregaEquipeForm.responsavel_equipe_id,
          entregaEquipeForm.base_id,
          user.id,
          'Entrega para equipe',
          entregaEquipeForm.observacoes || undefined
        )
      }

      // Se há itens individuais, criar solicitações individuais
      if (itensIndividuaisEquipe.length > 0) {
        console.log('🔄 [FRONTEND] Criando solicitações individuais para equipe:', itensIndividuaisEquipe.length)
        console.log('📋 [FRONTEND] Lista de itens individuais:', itensIndividuaisEquipe)
        
        for (let i = 0; i < itensIndividuaisEquipe.length; i++) {
          const item = itensIndividuaisEquipe[i]
          
          if (!item.item_estoque_id) {
            console.warn('⚠️ [FRONTEND] Item sem item_estoque_id:', item)
            continue
          }

          console.log(`🔄 [FRONTEND] Criando solicitação ${i + 1}/${itensIndividuaisEquipe.length} para item:`, item.nome, 'ID:', item.item_estoque_id)
          
          try {
            const resultado = await estoqueService.criarSolicitacaoEquipe({
              item_id: item.item_estoque_id,
              solicitante_id: user.id,
              destinatario_equipe_id: entregaEquipeForm.equipe_id,
              responsavel_equipe_id: entregaEquipeForm.responsavel_equipe_id,
              base_id: entregaEquipeForm.base_id,
              quantidade_solicitada: item.quantidade_solicitada,
              prioridade: 'normal',
              tipo_troca: 'fornecimento',
              motivo_solicitacao: 'Entrega individual para equipe',
              observacoes: entregaEquipeForm.observacoes || undefined,
              tipo_solicitacao: 'individual'
            })
            console.log('✅ [FRONTEND] Solicitação criada para item:', item.nome, 'Resultado:', resultado)
            solicitacoesCriadas++
          } catch (error) {
            console.error('❌ [FRONTEND] Erro ao criar solicitação para item:', item.nome, error)
            notify(`Erro ao criar solicitação para ${item.nome}: ${error instanceof Error ? error.message : 'Erro desconhecido'}`, 'error')
            // Continuar com o próximo item mesmo se um falhar
          }
        }
        
        console.log(`📊 [FRONTEND] Total de solicitações individuais criadas: ${solicitacoesCriadas}`)
      }

      notify(
        `Solicitações para equipe criadas com sucesso! ${solicitacoesCriadas} solicitação(ões) criada(s).`,
        'success'
      )

      // Resetar formulário e fechar modal
      setEntregaEquipeForm({
        equipe_id: '',
        responsavel_equipe_id: '',
        modulo_predefinido_id: '',
        base_id: '',
        observacoes: ''
      })
      setSearchEquipe('')
      setSearchResponsavelEquipe('')
      setEntregaEquipeOpen(false)
      loadDataFromApi(page)

    } catch (error) {
      console.error('❌ [ENTREGA EQUIPE] Erro:', error)
      notify(`Erro ao criar solicitações para equipe: ${error instanceof Error ? error.message : 'Erro desconhecido'}`, 'error')
    }
  }

  // Função para filtrar funcionários
  // const filteredFuncionarios = useMemo(() => {
  //   if (!searchFuncionario) return usuarios.filter(usuario => usuario.status !== 'demitido')
  //   const searchLower = searchFuncionario.toLowerCase()
  //   return usuarios.filter(usuario => 
  //     usuario.status !== 'demitido' && (
  //       usuario.nome?.toLowerCase().includes(searchLower) ||
  //       usuario.matricula?.toLowerCase().includes(searchLower) ||
  //       usuario.cargo?.toLowerCase().includes(searchLower)
  //     )
  //   )
  // }, [usuarios, searchFuncionario])

  // Função para entregar item (agora usa mutation para prevenir múltiplos cliques)
  function doDeliver() {
    deliverMutation.mutate()
  }

  const handleCancel = async () => {
    if (!selected || !cancelReason) return

    try {
      await estoqueService.cancelarSolicitacaoAprovada(
        selected.id,
        cancelReason,
        user!.id
      )
      notify('Solicitação cancelada com sucesso!', 'success')
      setCancelOpen(false)
      setCancelReason('')
      loadDataFromApi(page)
    } catch (e) {
      console.error(`❌ [UI] Erro ao cancelar:`, e)
      notify(`Erro ao cancelar solicitação: ${e instanceof Error ? e.message : 'Erro desconhecido'}`, 'error')
    }
  }

  const handleReturn = async () => {
    if (!selected || !returnReason || !newItemId) return

    // Usar a quantidade aprovada/entregue como quantidade fixa
    const quantidadeFixa = selected.quantidade_aprovada || selected.quantidade_solicitada
    if (!quantidadeFixa) {
      notify('Erro: Não foi possível determinar a quantidade entregue', 'error')
      return
    }

    try {
      console.log('🔄 [UI] Iniciando correção/troca de item:', {
        solicitacaoId: selected.id,
        solicitacaoStatus: selected.status,
        itemDevolvidoId: selected.item_id,
        novoItemId: newItemId,
        quantidade: quantidadeFixa,
        motivo: returnReason
      })

      await estoqueService.processarDevolucaoComTroca(
        selected.id,
        selected.item_id,
        newItemId,
        quantidadeFixa, // Usar quantidade fixa
        returnReason,
        returnObservations,
        user!.id
      )
      notify(selected?.status === 'entregue' ? 'Troca processada com sucesso!' : 'Correção de item processada com sucesso!', 'success')
      setReturnOpen(false)
      setReturnReason('')
      setReturnObservations('')
      setNewItemId('')
      loadDataFromApi(page)
    } catch (e) {
      console.error(`❌ [UI] Erro ao processar correção:`, e)
      notify(`Erro ao processar correção: ${e instanceof Error ? e.message : 'Erro desconhecido'}`, 'error')
    }
  }

  const handleSimpleReturn = async () => {
    if (!selected || !simpleReturnReason?.trim() || !simpleReturnQuantity) return

    // Validar quantidade - não pode ser maior que a quantidade entregue
    const quantidadeEntregue = selected?.quantidade_entregue || selected?.quantidade_aprovada || 0
    const quantidadeDevolver = parseInt(simpleReturnQuantity)
    
    if (quantidadeDevolver > quantidadeEntregue) {
      notify(`Quantidade inválida! Máximo permitido: ${quantidadeEntregue} item(s)`, 'error')
      return
    }

    if (quantidadeDevolver <= 0) {
      notify('Quantidade deve ser maior que zero', 'error')
      return
    }

    try {
      
      console.log('🔄 [DEVOLUÇÃO] Iniciando devolução:', {
        selectedId: selected.id,
        itemId: selected.item_id,
        quantidade: simpleReturnQuantity,
        motivo: simpleReturnReason
      })
      
      // Usar o serviço de estoque para registrar a devolução corretamente
      const funcionarioId = selected.destinatario_id || selected.solicitante_id
      const movimentacao = await estoqueService.movimentarEstoque({
        item_id: selected.item_id,
        tipo: 'devolucao',
        quantidade: parseInt(simpleReturnQuantity),
        motivo: `Devolução: ${simpleReturnReason}`,
        usuario_id: user!.id,
        solicitante_id: selected.solicitante_id,
        destinatario_id: funcionarioId, // ✅ ADICIONADO: quem está devolvendo o item
        documento_referencia: `SOL-${selected.id}`,
        observacoes: `Devolução após entrega. Motivo: ${simpleReturnReason}`,
        base_id: selected.base?.id
      })

      console.log('✅ [DEVOLUÇÃO] Movimentação criada:', movimentacao)

      // REMOVER ITEM DO INVENTÁRIO DO FUNCIONÁRIO
      
      console.log('🔄 [DEVOLUÇÃO] Removendo item do inventário:', {
        funcionarioId,
        itemId: selected.item_id,
        quantidade: parseInt(simpleReturnQuantity)
      })

      // Verificar inventário atual do funcionário
      const { data: inventarioAtual, error: inventarioError } = await supabase
        .from('inventario_funcionario')
        .select('id, quantidade, item_estoque_id, funcionario_id')
        .eq('funcionario_id', funcionarioId)
        .eq('item_estoque_id', selected.item_id)
        .single()

      if (inventarioError && inventarioError.code !== 'PGRST116') {
        console.error('❌ [DEVOLUÇÃO] Erro ao buscar inventário:', inventarioError)
        throw inventarioError
      }

      if (inventarioAtual) {
        const novaQuantidade = inventarioAtual.quantidade - parseInt(simpleReturnQuantity)
        
        if (novaQuantidade <= 0) {
          // Remover completamente do inventário
          const { error: deleteError } = await supabase
            .from('inventario_funcionario')
            .delete()
            .eq('id', inventarioAtual.id)

          if (deleteError) {
            console.error('❌ [DEVOLUÇÃO] Erro ao remover do inventário:', deleteError)
            throw deleteError
          }
          
          console.log('✅ [DEVOLUÇÃO] Item removido completamente do inventário')
        } else {
          // Atualizar quantidade no inventário
          const { error: updateInventarioError } = await supabase
            .from('inventario_funcionario')
            .update({
              quantidade: novaQuantidade,
              atualizado_em: new Date().toISOString()
            })
            .eq('id', inventarioAtual.id)

          if (updateInventarioError) {
            console.error('❌ [DEVOLUÇÃO] Erro ao atualizar inventário:', updateInventarioError)
            throw updateInventarioError
          }
          
          console.log('✅ [DEVOLUÇÃO] Inventário atualizado:', novaQuantidade)
        }
      } else {
        console.log('⚠️ [DEVOLUÇÃO] Item não encontrado no inventário do funcionário')
      }

        // Buscar histórico original da entrega para pegar solicitante_original_id e base_id
        const { data: historicoOriginal } = await supabase
          .from('historico_funcionarios')
          .select('solicitante_original_id, base_id, data_entrega, responsavel_entrega')
          .eq('funcionario_id', funcionarioId)
          .eq('item_id', selected.item_id)
          .eq('tipo_movimentacao', 'entrega')
          .order('data_entrega', { ascending: false })
          .limit(1)
          .maybeSingle()

        // Criar registro no histórico de funcionários
        try {
          const { data: historicoInsercao, error: historicoError } = await supabase
            .from('historico_funcionarios')
            .insert({
              funcionario_id: funcionarioId,
              item_id: selected.item_id,
              quantidade: parseInt(simpleReturnQuantity),
              tipo_movimentacao: 'devolucao',
              data_entrega: historicoOriginal?.data_entrega || '1900-01-01T00:00:00Z',
              data_devolucao: new Date().toISOString(),
              condicao_entrega: 'usado_bom',
              condicao_devolucao: 'bom',
              observacoes_devolucao: `Devolução após entrega via solicitação. Motivo: ${simpleReturnReason}`,
              responsavel_entrega: historicoOriginal?.responsavel_entrega || user!.id,
              responsavel_devolucao: user!.id,
              solicitante_original_id: historicoOriginal?.solicitante_original_id || selected.solicitante_id, // ✅ Salvar solicitante_original_id
              base_id: historicoOriginal?.base_id || selected.base_id, // ✅ Salvar base_id
              status: 'devolvido'
            })
          .select('*')
          .single()

        if (historicoError) {
          console.error('❌ [DEVOLUÇÃO] Erro ao criar histórico:', historicoError)
          // Não falha a operação se não conseguir criar o histórico
        } else {
          console.log('✅ [DEVOLUÇÃO] Histórico criado:', historicoInsercao)
        }
      } catch (histError) {
        console.error('❌ [DEVOLUÇÃO] Erro ao criar histórico:', histError)
        // Continua mesmo com erro no histórico
      }

      // Atualizar solicitação original como devolvida
      console.log('🔄 [DEVOLUÇÃO] Atualizando solicitação para devolvida:', {
        id: selected.id,
        status_atual: selected.status,
        novo_status: 'devolvida'
      })
      
      const { data: solicitacaoAtualizada, error: updateError } = await supabase
        .from('solicitacoes_itens')
        .update({
          status: 'devolvida',
          observacoes_devolucao: `Devolvido após entrega. Motivo: ${simpleReturnReason}`,
          atualizado_em: new Date().toISOString()
        })
        .eq('id', selected.id)
        .select('*')
        .single()

      if (updateError) {
        console.error('❌ [DEVOLUÇÃO] Erro ao atualizar solicitação:', updateError)
        throw updateError
      }

      console.log('✅ [DEVOLUÇÃO] Solicitação atualizada:', {
        id: solicitacaoAtualizada?.id,
        novo_status: solicitacaoAtualizada?.status
      })

      notify('Devolução processada com sucesso!', 'success')
      setSimpleReturnOpen(false)
      setSimpleReturnReason('')
      setSimpleReturnQuantity('')
      
      // Recarregar dados
      console.log('🔄 [DEVOLUÇÃO] Recarregando solicitações...')
      loadDataFromApi(page)
      
      // Forçar re-render do componente
      console.log('🔄 [DEVOLUÇÃO] Forçando re-render...')
      // setSolicitacoes não é mais necessário - dados já vêm do React Query
      
    } catch (e) {
      console.error(`❌ [UI] Erro ao processar devolução simples:`, e)
      notify(`Erro ao processar devolução: ${e instanceof Error ? e.message : 'Erro desconhecido'}`, 'error')
    } finally {
    }
  }

  return (
    <div>
      <div className="max-w-7xl mx-auto px-4 py-8 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Solicitações de Estoque</h1>
            <p className="text-sm text-muted-foreground">Gerencie aprovações, rejeições e entregas</p>
          </div>
          <Button 
            onClick={() => router.push('/almoxarifado/devolucoes')}
            className="bg-purple-600 hover:bg-purple-700 text-white"
          >
            <ArrowLeftRight className="w-4 h-4 mr-2" />
            Processar Devoluções
          </Button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-7 gap-3">
          <Card onClick={() => { setStatusFilter('pendente'); setPage(1) }} className="hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader className="pb-2">
              <CardDescription className="text-xs font-medium text-gray-600">PENDENTES</CardDescription>
              <CardTitle className="text-xl text-amber-600">{countPend}</CardTitle>
            </CardHeader>
          </Card>
          <Card onClick={() => { setStatusFilter('aprovada'); setPage(1) }} className="hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader className="pb-2">
              <CardDescription className="text-xs font-medium text-gray-600">APROVADAS</CardDescription>
              <CardTitle className="text-xl text-emerald-600">{countAprov}</CardTitle>
            </CardHeader>
          </Card>
          <Card onClick={() => { setStatusFilter('aguardando_estoque'); setPage(1) }} className="hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader className="pb-2">
              <CardDescription className="text-xs font-medium text-gray-600">AGUARDANDO</CardDescription>
              <CardTitle className="text-xl text-orange-600">{countAguardando}</CardTitle>
            </CardHeader>
          </Card>
          <Card onClick={() => { setStatusFilter('entregue'); setPage(1) }} className="hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader className="pb-2">
              <CardDescription className="text-xs font-medium text-gray-600">ENTREGUES</CardDescription>
              <CardTitle className="text-xl text-purple-600">{countEntregue}</CardTitle>
            </CardHeader>
          </Card>
          <Card onClick={() => { setStatusFilter('rejeitada'); setPage(1) }} className="hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader className="pb-2">
              <CardDescription className="text-xs font-medium text-gray-600">REJEITADAS</CardDescription>
              <CardTitle className="text-xl text-red-600">{countRej}</CardTitle>
            </CardHeader>
          </Card>
          <Card onClick={() => { setStatusFilter('devolvida'); setPage(1) }} className="hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader className="pb-2">
              <CardDescription className="text-xs font-medium text-gray-600">DEVOLVIDAS</CardDescription>
              <CardTitle className="text-xl text-gray-600">{countDevolvida}</CardTitle>
            </CardHeader>
          </Card>
          <Card onClick={() => { setStatusFilter('todas'); setPage(1) }} className="hover:shadow-md transition-shadow cursor-pointer border-2 border-blue-200">
            <CardHeader className="pb-2">
              <CardDescription className="text-xs font-medium text-gray-600">TOTAL</CardDescription>
              <CardTitle className="text-xl text-blue-600">{apiStats.total}</CardTitle>
            </CardHeader>
          </Card>
        </div>
        
        {/* Filtro de Data + Botões de Ação no mesmo container */}
        <div className="bg-white rounded-lg border border-gray-200 p-2 shadow-sm flex flex-wrap items-center gap-2">
          <DateFilter
            selectedFilter={dateFilter}
            onFilterChange={handleDateFilterChange}
            onDateRangeChange={handleDateRangeChange}
            startDate={dateRange.start}
            endDate={dateRange.end}
          />
          <div className="h-6 w-px bg-gray-200 hidden sm:block" />
          <Button 
            onClick={openEmergencyModal}
            className="bg-red-600 hover:bg-red-700 text-white"
            size="sm"
          >
            <AlertTriangle className="w-4 h-4 mr-2" />
            Emergencial
          </Button>
          <Button 
            onClick={openNovoFuncionarioModal}
            className="bg-blue-600 hover:bg-blue-700 text-white"
            size="sm"
          >
            <Users className="w-4 h-4 mr-2" />
            Novo Funcionário
          </Button>
          <Button 
            onClick={openEntregaEquipeModal}
            className="bg-green-600 hover:bg-green-700 text-white"
            size="sm"
          >
            <Users className="w-4 h-4 mr-2" />
            Entrega Equipe
          </Button>
          <Button 
            onClick={async () => {
              try {
                notify('Verificando estoque...', 'info')
                const { reativadas, movidas } = await estoqueService.reativarSolicitacoesComEstoque()
                const partes = []
                if (reativadas > 0) partes.push(`${reativadas} reativada(s) para aprovada`)
                if (movidas > 0) partes.push(`${movidas} movida(s) para aguardando estoque`)
                if (partes.length > 0) {
                  notify(partes.join(' · '), 'success')
                } else {
                  notify('Tudo em ordem — nenhuma alteração necessária', 'info')
                }
                loadDataFromApi(page)
              } catch (error) {
                console.error('Erro ao verificar estoque:', error)
                notify('Erro ao verificar estoque', 'error')
              }
            }}
            className="bg-orange-600 hover:bg-orange-700 text-white"
            size="sm"
            title="Reativa aprovadas com estoque · Move aprovadas sem estoque para aguardando"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Verificar Estoque
          </Button>
        </div>

      <div className="flex flex-wrap items-center gap-2">
        <Input className="w-full max-w-md" placeholder="Buscar por item, solicitante, destinatário, contrato ou base..." value={filters.search} onChange={e => setFilters(prev => ({ ...prev, search: e.target.value }))} />
        
        <Select value={contratoFilter} onValueChange={setContratoFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Contrato" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os Contratos</SelectItem>
            {contratos.map(contrato => (
              <SelectItem key={contrato.id} value={contrato.id}>
                {contrato.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={baseFilter} onValueChange={setBaseFilter}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Base" />
          </SelectTrigger>
          <SelectContent>
            {bases.length > 1 && (
              <SelectItem value="todas">
                Todas as Bases ({bases.length})
              </SelectItem>
            )}
            {bases.map(base => (
              <SelectItem key={base.id} value={base.id}>
                {base.nome} ({base.codigo})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Ativas</SelectItem>
            <SelectItem value="pendente">Pendentes</SelectItem>
            <SelectItem value="aprovada">Aprovadas</SelectItem>
            <SelectItem value="rejeitada">Rejeitadas</SelectItem>
            <SelectItem value="aguardando_estoque">Aguardando Estoque</SelectItem>
            <SelectItem value="entregue">Entregues</SelectItem>
          </SelectContent>
        </Select>
        
        <Button variant="outline" onClick={() => loadDataFromApi(page)} disabled={solicitacoesLoading}>{solicitacoesLoading ? 'Atualizando...' : 'Atualizar'}</Button>
      </div>

      {/* Contador e loading */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-600">
          {solicitacoesLoading ? 'Carregando...' : `${apiPagination.total} solicitações encontradas`}
          {groupedSolicitacoes.grupos.length > 0 && (
            <span className="ml-2 text-blue-600 font-medium">
              ({groupedSolicitacoes.grupos.length} grupos de entrega)
            </span>
          )}
        </div>
        <div className="text-xs text-gray-500">
          Página {page} de {Math.max(1, Math.ceil(apiPagination.total / pageSize))}
        </div>
      </div>

      {/* Loading indicator */}
      {solicitacoesLoading && (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      )}

      {/* Renderizar grupos de entrega */}
      {!solicitacoesLoading && groupedSolicitacoes.grupos.map((grupo, grupoIndex) => {
        const primeiraSolicitacao = grupo[0]
        const grupoStatus = primeiraSolicitacao.grupo_entrega?.status || 'pendente'
        const funcionarioNome = primeiraSolicitacao.grupo_entrega?.funcionario?.nome || 'Funcionário não encontrado'
        const moduloNome = primeiraSolicitacao.modulo_predefinido?.nome_modulo || 'Módulo não encontrado'

        return (
          <div key={`grupo-${primeiraSolicitacao.grupo_entrega_id || grupoIndex}`} className="border-2 border-blue-200 rounded-lg overflow-hidden mb-4">
            <div className="p-3 bg-blue-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                <span className="font-bold text-sm">GRUPO: {funcionarioNome}</span>
                <span className="text-xs opacity-80">{moduloNome} • {grupo.length} itens</span>
              </div>
              <span className="text-xs font-bold capitalize bg-white/20 px-2 py-1 rounded">{grupoStatus}</span>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left p-2 font-medium text-gray-600">#</th>
                  <th className="text-left p-2 font-medium text-gray-600">Item</th>
                  <th className="text-left p-2 font-medium text-gray-600">Qtd</th>
                  <th className="text-left p-2 font-medium text-gray-600">Tipo</th>
                  <th className="text-left p-2 font-medium text-gray-600">Status</th>
                  <th className="text-left p-2 font-medium text-gray-600">Evidências</th>
                </tr>
              </thead>
              <tbody>
                {grupo.map((solicitacao, itemIndex) => (
                  <tr key={solicitacao.id} className="border-b hover:bg-gray-50">
                    <td className="p-2 text-gray-500">{itemIndex + 1}</td>
                    <td className="p-2">
                      <div className="font-medium">{solicitacao.item?.nome || 'Item'}</div>
                      {solicitacao.numero_solicitacao && <span className="text-xs text-gray-500">{solicitacao.numero_solicitacao}</span>}
                      {solicitacao.motivo_solicitacao && <div className="text-xs text-gray-400 truncate max-w-[200px]">{solicitacao.motivo_solicitacao}</div>}
                    </td>
                    <td className="p-2">{solicitacao.quantidade_solicitada}</td>
                    <td className="p-2">
                      <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                        solicitacao.tipo_troca === 'fornecimento' ? 'bg-green-100 text-green-700' :
                        solicitacao.tipo_troca === 'troca' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'
                      }`}>{solicitacao.tipo_troca}</span>
                    </td>
                    <td className="p-2">
                      <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                        solicitacao.status === 'pendente' ? 'bg-yellow-100 text-yellow-700' :
                        solicitacao.status === 'aprovada' ? 'bg-green-100 text-green-700' :
                        solicitacao.status === 'entregue' ? 'bg-purple-100 text-purple-700' :
                        solicitacao.status === 'rejeitada' ? 'bg-red-100 text-red-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>{solicitacao.status}</span>
                    </td>
                    <td className="p-2">
                      {(solicitacao.evidencia_url || solicitacao.assinatura_digital) && (
                        <div className="flex items-center gap-1">
                          {solicitacao.evidencia_url && (
                            solicitacao.evidencia_url.startsWith('file://') ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={solicitacao.evidencia_url} alt="Evidência" className="w-8 h-8 object-cover rounded cursor-pointer" onClick={() => window.open(solicitacao.evidencia_url, '_blank')} />
                            ) : (
                              <Image src={solicitacao.evidencia_url} alt="Evidência" width={32} height={32} className="w-8 h-8 object-cover rounded cursor-pointer" onClick={() => window.open(solicitacao.evidencia_url, '_blank')} />
                            )
                          )}
                          {solicitacao.assinatura_digital && (
                            <SignatureRenderer signatureData={solicitacao.assinatura_digital} width={40} height={20} className="w-10" />
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      })}

      {/* Tabela de solicitações individuais - LEVE */}
      {!solicitacoesLoading && groupedSolicitacoes.individuais.length > 0 && (
        <div className="border rounded-lg overflow-hidden bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left p-2 font-medium text-gray-600">Nº</th>
                <th className="text-left p-2 font-medium text-gray-600">Item</th>
                <th className="text-center p-2 font-medium text-gray-600">Qtd</th>
                <th className="text-left p-2 font-medium text-gray-600">Tipo</th>
                <th className="text-left p-2 font-medium text-gray-600">Destinatário</th>
                <th className="text-left p-2 font-medium text-gray-600">Solicitante</th>
                <th className="text-left p-2 font-medium text-gray-600">Base</th>
                <th className="text-left p-2 font-medium text-gray-600">Status</th>
                <th className="text-left p-2 font-medium text-gray-600">Aprovação</th>
                <th className="text-left p-2 font-medium text-gray-600">Data</th>
                <th className="text-center p-2 font-medium text-gray-600"></th>
              </tr>
            </thead>
            <tbody>
              {groupedSolicitacoes.individuais.map(s => (
                <tr 
                  key={s.id} 
                  className="border-b hover:bg-blue-50 cursor-pointer transition-colors"
                  onClick={() => router.push(`/almoxarifado/solicitacoes/${s.id}`)}
                >
                  <td className="p-2 text-xs text-gray-500">{s.numero_solicitacao || '-'}</td>
                  <td className="p-2">
                    <div className="font-medium text-gray-900">{s.item?.nome || 'Item'}</div>
                    {s.item?.codigo && <div className="text-xs text-gray-500">{s.item.codigo}</div>}
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
                        <div className="text-xs">{s.destinatario?.nome || '-'}</div>
                        {s.destinatario?.matricula && <div className="text-xs text-gray-400">({s.destinatario.matricula})</div>}
                      </div>
                    )}
                  </td>
                  <td className="p-2">
                    <div className="text-xs">{s.solicitante?.nome || '-'}</div>
                    {s.solicitante?.matricula && <div className="text-xs text-gray-400">({s.solicitante.matricula})</div>}
                  </td>
                  <td className="p-2 text-xs">{bases.find(b => b.id === s.base_id)?.nome || '-'}</td>
                  <td className="p-2">
                    <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${
                      s.status === 'pendente' ? 'bg-yellow-100 text-yellow-700' :
                      s.status === 'aprovada' ? 'bg-green-100 text-green-700' :
                      s.status === 'entregue' ? 'bg-purple-100 text-purple-700' :
                      s.status === 'rejeitada' ? 'bg-red-100 text-red-700' :
                      s.status === 'aguardando_estoque' ? 'bg-orange-100 text-orange-700' :
                      s.status === 'devolvida' ? 'bg-gray-100 text-gray-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>{s.status === 'pendente' && s.aprovado_almoxarifado_por && !s.aprovado_sesmt_por ? 'Pendente SESMT' : s.status}</span>
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
      {!solicitacoesLoading && groupedSolicitacoes.grupos.length === 0 && groupedSolicitacoes.individuais.length === 0 && (
        <div className="text-center py-10 text-sm text-gray-500 bg-white border rounded-lg">
          Nenhuma solicitação encontrada.
        </div>
      )}

      {/* Paginação leve (padrão portaria: chama loadDataFromApi diretamente) */}
      {apiPagination.total > 0 && (
        <div className="flex items-center justify-between py-3">
          <div className="text-xs text-gray-500">
            Mostrando {((page - 1) * pageSize) + 1} a {Math.min(page * pageSize, apiPagination.total)} de {apiPagination.total}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { const p = Math.max(1, page - 1); setPage(p); loadDataFromApi(p) }}
              disabled={page <= 1 || solicitacoesLoading}
              className="px-3 py-1 text-sm border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Anterior
            </button>
            <span className="text-sm font-medium">
              {page} / {Math.max(1, Math.ceil(apiPagination.total / pageSize))}
            </span>
            <button
              onClick={() => { const p = Math.min(Math.ceil(apiPagination.total / pageSize), page + 1); setPage(p); loadDataFromApi(p) }}
              disabled={page >= Math.ceil(apiPagination.total / pageSize) || solicitacoesLoading}
              className="px-3 py-1 text-sm border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Próxima
            </button>
            <select
              value={pageSize}
              disabled
              className="text-sm border rounded px-2 py-1"
            >
              <option value={20}>20/pág</option>
              <option value={50}>50/pág</option>
              <option value={100}>100/pág</option>
            </select>
          </div>
        </div>
      )}

      {/* Aprovar Dialog */}
      <Dialog open={approveOpen} onOpenChange={setApproveOpen}>
        <DialogContent className="w-[80vw] h-[95vh] max-w-none overflow-hidden">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Aprovar Solicitação</DialogTitle>
            <DialogDescription className="text-base">Defina a quantidade, base de entrega e analise o inventário.</DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            {/* INVENTÁRIO - PARTE SUPERIOR */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm font-semibold flex items-center gap-2">
                  <span>📦</span>
                  Inventário disponível
                  {inventarioItems.length > 0 && (
                    <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">
                      {inventarioItems.length} itens
                    </span>
                  )}
                </Label>
                <div className="border border-gray-200 rounded-lg bg-gray-50 h-[45vh] overflow-y-auto">
                  {inventarioItems.length > 0 ? (
                    <div className="p-4">
                      {(() => {
                        // Agrupar itens por categoria
                        const itensPorCategoria = inventarioItems.reduce((acc, item) => {
                          // Tentar diferentes formas de acessar a categoria
                          const categoria = (item as { item_estoque?: { categoria?: string }; categoria?: string }).item_estoque?.categoria || 
                                          (item as { item_estoque?: { categoria?: string }; categoria?: string }).categoria || 
                                          'Outros'
                          if (!acc[categoria]) {
                            acc[categoria] = []
                          }
                          acc[categoria].push(item)
                          return acc
                        }, {} as Record<string, typeof inventarioItems>)

                        return Object.entries(itensPorCategoria).map(([categoria, itens]) => (
                          <div key={categoria} className="mb-6">
                            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-300">
                              <span className="text-lg font-bold text-gray-800 capitalize">
                                {categoria === 'epi' ? '🦺 EPI' : 
                                 categoria === 'ferramental' ? '🔧 Ferramental' :
                                 categoria === 'consumivel' ? '📦 Consumível' :
                                 categoria === 'equipamento' ? '⚙️ Equipamento' :
                                 '📋 Outros'}
                              </span>
                              <span className="bg-gray-200 text-gray-700 text-xs px-2 py-1 rounded-full">
                                {itens.length} itens
                              </span>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                              {itens.map((item) => {
                                const isFuncionario = 'quantidade' in item
                                const nomeItem = (item as { item_estoque?: { nome?: string } }).item_estoque?.nome || 'Item sem nome'
                                const quantidade = isFuncionario 
                                  ? (item as { quantidade: number }).quantidade
                                  : (item as { quantidade_disponivel: number }).quantidade_disponivel
                                const codigo = (item as { item_estoque?: { codigo?: string } }).item_estoque?.codigo || 'N/A'
                                
                                return (
                                  <div key={item.id} className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm hover:shadow-md transition-shadow">
                                    <div className="flex items-start justify-between">
                                      <div className="flex-1">
                                        <div className="font-medium text-gray-900 text-sm mb-1 line-clamp-2">
                                          {nomeItem}
                                        </div>
                                        <div className="text-xs text-gray-500 mb-2">
                                          Código: {codigo}
                                        </div>
                                        <div className="space-y-1 text-xs text-gray-600">
                                          <div className="flex items-center gap-1">
                                            <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                                            <span>Qtd: <span className="font-semibold">{quantidade}</span></span>
                                          </div>
                                          <div className="flex items-center gap-1">
                                            <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                                            <span>Status: <span className="font-semibold">{item.status}</span></span>
                                          </div>
                                          <div className="flex items-center gap-1">
                                            <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
                                            <span>Data: <span className="font-semibold">{new Date(item.data_entrega).toLocaleDateString('pt-BR')}</span></span>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        ))
                      })()}
                    </div>
                  ) : (
                    <div className="p-8 text-center">
                      <div className="text-gray-400 text-4xl mb-3">📦</div>
                      <div className="text-gray-500 text-sm">
                        Nenhum item encontrado no inventário
                      </div>
                    </div>
                  )}
                </div>
                <p className="text-xs text-gray-500">
                  Inventário atual do destinatário para análise
                </p>
              </div>
            </div>

            {/* DADOS DA APROVAÇÃO - PARTE INFERIOR */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">Quantidade a aprovar <span className="text-red-500">*</span></Label>
                  <Input 
                    value={approveQty} 
                    onChange={e => setApproveQty(e.target.value)} 
                    type="number"
                    min={1}
                    max={selected?.quantidade_solicitada || undefined}
                    placeholder={`Máx: ${selected?.quantidade_solicitada || ''}`}
                    className="h-10"
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="approve-base" className="text-sm font-semibold">Base de entrega (opcional)</Label>
                  <Select value={approveBaseId || 'current'} onValueChange={(value) => setApproveBaseId(value === 'current' ? '' : value)}>
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder={selected ? `Base atual: ${bases.find(b => b.id === selected.base_id)?.nome || 'N/A'}` : 'Selecione uma base'} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="current">Manter base atual</SelectItem>
                      {bases.map(base => (
                        <SelectItem key={base.id} value={base.id}>
                          {base.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-gray-500">
                    Se alterar a base, o sistema buscará o item equivalente na nova base
                  </p>
                </div>
                
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">Observações</Label>
                  <Textarea 
                    value={approveObs} 
                    onChange={e => setApproveObs(e.target.value)} 
                    rows={3} 
                    className="resize-none"
                  />
                </div>
              </div>
            </div>
          
          <DialogFooter className="mt-6">
            <Button variant="outline" onClick={() => setApproveOpen(false)} className="h-10">
              Cancelar
            </Button>
            <Button 
              onClick={doApprove} 
              className="h-10 bg-green-600 hover:bg-green-700"
              disabled={!approveQty || parseInt(approveQty) < 1}
            >
              Confirmar Aprovação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rejeitar Dialog */}
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rejeitar Solicitação</DialogTitle>
            <DialogDescription>Informe o motivo da rejeição.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <div className="text-sm">Motivo</div>
              <Textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={doReject}>Rejeitar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Entregar Dialog */}
      <Dialog open={deliverOpen} onOpenChange={(open) => {
        setDeliverOpen(open)
        if (!open) {
          // Limpar campos ao fechar o modal
          setDeliverLaudos([])
          setDeliverQty('')
          setDeliverObs('')
          setDeliverNumeroLaudo('')
          setDeliverValidadeLaudo('')
          setDeliverBaseId('')
          setSelected(null)
        }
      }}>
        <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
          <DialogHeader className="flex-shrink-0 pb-2">
            <DialogTitle className="text-lg">Entregar Item</DialogTitle>
            <DialogDescription className="text-xs">Confirme a quantidade e observações da entrega.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 overflow-y-auto flex-1 min-h-0 pr-1">
            {/* Informações do item */}
            {selected && (
              <div className="bg-gray-50 p-2 rounded-lg space-y-1 text-xs">
                <div className="font-medium text-gray-700">
                  📦 {selected.item?.nome}
                </div>
                <div className="text-gray-600">
                  👤 {selected.solicitante?.nome} • ✅ {selected.quantidade_aprovada} aprovadas
                </div>
                {Boolean(selected.item?.requer_laudo) && (
                  <div className="text-blue-600 font-medium">
                    ⚠️ Requer laudo técnico
                  </div>
                )}
                {Boolean(selected.item?.requer_ca) && (
                  <div className="text-green-600 font-medium">
                    🛡️ Requer CA
                  </div>
                )}
                {Boolean(selected.item?.requer_rastreabilidade) && (
                  <div className="text-purple-600 font-medium">
                    🔗 Requer rastreabilidade
                  </div>
                )}
              </div>
            )}
            
            <div className="space-y-2">
              {/* Seleção de Base */}
              <div className="space-y-1">
                <div className="text-xs font-medium">Base de origem *</div>
                <select 
                  value={deliverBaseId} 
                  onChange={e => setDeliverBaseId(e.target.value)}
                  className={`w-full p-1.5 text-sm border rounded ${!deliverBaseId ? 'border-red-300' : 'border-gray-300'}`}
                >
                  <option value="">Selecione a base...</option>
                  {availableBases.map(base => (
                    <option key={base.id} value={base.id}>
                      {base.nome} ({base.codigo})
                    </option>
                  ))}
                </select>
                {availableBases.length === 0 && (
                  <div className="text-xs text-red-600">
                    Nenhuma base disponível
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <div className="text-xs font-medium">Quantidade a entregar *</div>
                <Input 
                  value={deliverQty} 
                  onChange={e => setDeliverQty(e.target.value)} 
                  type="number" 
                  placeholder="Digite a quantidade"
                  className={`p-1.5 text-sm ${!deliverQty ? 'border-red-300' : ''}`}
                />
              </div>
              
              {/* Campos de Laudo (se necessário) */}
              {Boolean(selected?.item?.requer_laudo) && (
                <>
                  <div className="bg-blue-50 border border-blue-200 rounded p-2 mb-1">
                    <div className="text-xs font-medium text-blue-800">
                      ⚠️ {parseInt(deliverQty) > 1 ? `${deliverQty} laudos necessários (um por unidade)` : 'Laudo técnico obrigatório'}
                    </div>
                  </div>
                  
                  {/* Se quantidade > 1, mostrar múltiplos laudos */}
                  {parseInt(deliverQty) > 1 && deliverLaudos.length > 0 ? (
                    <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-1">
                      {deliverLaudos.map((laudo, index) => (
                        <div key={index} className="border border-gray-200 rounded p-2 space-y-2 bg-white">
                          <div className="text-xs font-semibold text-gray-700">
                            Laudo {index + 1}/{deliverLaudos.length}
                          </div>
                          
                          <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1">
                              <div className="text-xs font-medium">Número *</div>
                              <Input 
                                value={laudo.numero} 
                                onChange={e => updateLaudoNumero(index, e.target.value)} 
                                placeholder="L001/2024"
                                className={`p-1.5 text-sm ${!laudo.numero ? 'border-red-300' : ''}`}
                                required
                              />
                            </div>
                            
                            <div className="space-y-1">
                              <div className="text-xs font-medium">Validade *</div>
                              <Input 
                                type="text"
                                value={laudo.validade}
                                onChange={e => updateLaudoValidade(index, e.target.value)}
                                placeholder="DD/MM/AAAA"
                                maxLength={10}
                                className={`p-1.5 text-sm ${!laudo.validade ? 'border-red-300' : ''}`}
                                required
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    /* Se quantidade = 1, mostrar campos únicos */
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <div className="text-xs font-medium">Número *</div>
                        <Input 
                          value={deliverNumeroLaudo} 
                          onChange={e => setDeliverNumeroLaudo(e.target.value)} 
                          placeholder="L001/2024"
                          className={`p-1.5 text-sm ${!deliverNumeroLaudo ? 'border-red-300' : ''}`}
                          required
                        />
                      </div>
                      
                      <div className="space-y-1">
                        <div className="text-xs font-medium">Validade *</div>
                        <Input 
                          type="text"
                          value={deliverValidadeLaudo}
                          onChange={handleValidadeLaudoChange}
                          placeholder="DD/MM/AAAA"
                          maxLength={10}
                          className={`p-1.5 text-sm ${!deliverValidadeLaudo ? 'border-red-300' : ''}`}
                          required
                        />
                      </div>
                    </div>
                  )}
                </>
              )}
              
              {/* Campos de CA (se necessário) */}
              {Boolean(selected?.item?.requer_ca) && (
                <>
                  <div className="bg-green-50 border border-green-200 rounded p-2 mb-1">
                    <div className="text-xs font-medium text-green-800">
                      🛡️ CA obrigatório para este item
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs font-medium">Número do CA *</div>
                    <Input 
                      value={deliverNumeroCa} 
                      onChange={e => setDeliverNumeroCa(e.target.value)} 
                      placeholder="CA 12345"
                      className={`p-1.5 text-sm ${!deliverNumeroCa ? 'border-red-300' : ''}`}
                      required
                    />
                  </div>
                </>
              )}

              {/* Campos de Rastreabilidade (se necessário) */}
              {Boolean(selected?.item?.requer_rastreabilidade) && (
                <>
                  <div className="bg-purple-50 border border-purple-200 rounded p-2 mb-1">
                    <div className="text-xs font-medium text-purple-800">
                      🔗 Rastreabilidade obrigatória — {parseInt(deliverQty) > 1 ? `${deliverQty} números necessários (um por unidade)` : '1 número necessário'}
                    </div>
                  </div>
                  <div className="space-y-2 max-h-[30vh] overflow-y-auto pr-1">
                    {deliverNumerosRastreabilidade.map((numero, index) => (
                      <div key={index} className="space-y-1">
                        <div className="text-xs font-medium">
                          {deliverNumerosRastreabilidade.length > 1 ? `Nº Rastreabilidade ${index + 1} *` : 'Nº Rastreabilidade *'}
                        </div>
                        <Input 
                          value={numero} 
                          onChange={e => updateRastreabilidade(index, e.target.value)} 
                          placeholder="Ex: SN-2024-001"
                          className={`p-1.5 text-sm ${!numero ? 'border-red-300' : ''}`}
                          required
                        />
                      </div>
                    ))}
                  </div>
                </>
              )}

              <div className="space-y-1">
                <div className="text-xs font-medium">Observações</div>
                <Textarea 
                  value={deliverObs} 
                  onChange={e => setDeliverObs(e.target.value)} 
                  rows={2}
                  className="p-1.5 text-sm"
                  placeholder="Observações..."
                />
              </div>
            </div>
          </div>
          <DialogFooter className="flex-shrink-0 pt-4 border-t mt-4">
            <Button 
              variant="outline" 
              onClick={() => setDeliverOpen(false)}
              disabled={deliverMutation.isPending}
            >
              Cancelar
            </Button>
            <Button 
              className="bg-emerald-600 hover:bg-emerald-600/90" 
              onClick={doDeliver}
              disabled={deliverMutation.isPending}
            >
              {deliverMutation.isPending ? 'Entregando...' : 'Entregar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Solicitação Emergencial */}
      <Dialog open={emergencyOpen} onOpenChange={(open) => {
        setEmergencyOpen(open)
        if (!open) {
          // Resetar loading quando modal for fechado
          setLoadingEmergency(false)
        }
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" />
              Solicitação Emergencial
            </DialogTitle>
            <DialogDescription>
              Crie uma solicitação emergencial que pode ser aprovada automaticamente pelo almoxarife.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Seleção de Base */}
            <div className="space-y-2">
              <Label htmlFor="base">Base *</Label>
              <Select
                value={emergencyForm.base_id}
                onValueChange={(value) => setEmergencyForm(prev => ({ ...prev, base_id: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a base" />
                </SelectTrigger>
                <SelectContent position="popper">
                  {basesEmergenciais.map(base => (
                    <SelectItem key={base.id} value={base.id}>
                      {base.nome} - {base.codigo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Seção de Adicionar Itens */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">Adicionar Itens à Solicitação</Label>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    {itensIndividuaisEmergencial.length} itens selecionados
                  </Badge>
                  {itensIndividuaisEmergencial.length > 0 && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={clearItensEmergencial}
                      className="text-red-600 hover:text-red-700"
                    >
                      <X className="h-3 w-3 mr-1" />
                      Limpar
                    </Button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="item">Item</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Digite para buscar item..."
                      value={searchItem}
                      onChange={(e) => setSearchItem(e.target.value)}
                      className="pl-10"
                    />
                    {searchItem && (
                      <X 
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 cursor-pointer hover:text-gray-600" 
                        onClick={() => setSearchItem('')}
                      />
                    )}
                  </div>
                  {searchItem && filteredItensCatalogo.length > 0 && (
                    <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-md bg-white shadow-sm">
                      {filteredItensCatalogo.map(item => (
                        <div
                          key={item.item_estoque_id}
                          className={`p-2 cursor-pointer hover:bg-gray-50 border-b last:border-b-0 ${
                            emergencyForm.item_id === item.item_estoque_id ? 'bg-blue-50 border-blue-200' : ''
                          }`}
                          onClick={() => {
                            setEmergencyForm(prev => ({ ...prev, item_id: item.item_estoque_id }))
                            setSearchItem(item.item_nome)
                          }}
                        >
                          <div className="font-medium">{item.item_nome}</div>
                          <div className="text-sm text-gray-500">
                            {item.item_codigo} - Estoque: {item.estoque_atual || item.total_estoque || 0}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {emergencyForm.item_id && !searchItem && (
                    <div className="text-sm text-blue-600">
                      Item selecionado: {itensCatalogo.find(i => i.item_estoque_id === emergencyForm.item_id)?.item_nome}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="quantidade">Quantidade</Label>
                  <Input
                    id="quantidade"
                    type="number"
                    min="1"
                    value={emergencyForm.quantidade_solicitada}
                    onChange={(e) => setEmergencyForm(prev => ({ ...prev, quantidade_solicitada: e.target.value }))}
                    placeholder="Ex: 5"
                  />
                </div>

                <div className="space-y-2">
                  <Label>&nbsp;</Label>
                  <Button
                    type="button"
                    onClick={addItemEmergencial}
                    disabled={!emergencyForm.item_id || !emergencyForm.quantidade_solicitada}
                    className="w-full bg-blue-600 hover:bg-blue-700"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Adicionar Item
                  </Button>
                </div>
              </div>

              {/* Lista de Itens Adicionados */}
              {itensIndividuaisEmergencial.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Package className="w-4 h-4 text-blue-600" />
                    <Label className="text-sm font-semibold">Itens Selecionados</Label>
                  </div>
                  
                  <div className="max-h-96 overflow-y-auto border border-gray-200 rounded-lg">
                    <div className="space-y-3 p-4">
                      {itensIndividuaisEmergencial.map((item) => (
                        <div key={item.id} className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex-1">
                              <div className="font-medium text-sm">{item.nome}</div>
                              <div className="text-xs text-gray-500">
                                {item.codigo} - Qtd: {item.quantidade_solicitada}
                              </div>
                            </div>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => removeItemEmergencial(item.id)}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                          
                          {/* Campos de tipo e motivo específicos para cada item */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div className="space-y-2">
                              <Label className="text-xs font-medium">Tipo</Label>
                              <Select
                                value={item.tipo_troca}
                                onValueChange={(value) => updateItemTipoMotivo(item.id, 'tipo_troca', value)}
                              >
                                <SelectTrigger className="h-8 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="fornecimento">Fornecimento</SelectItem>
                                  <SelectItem value="troca">Troca</SelectItem>
                                  <SelectItem value="desconto">Desconto</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            
                            <div className="space-y-2">
                              <Label className="text-xs font-medium">Motivo</Label>
                              <Input
                                value={item.motivo_solicitacao}
                                onChange={(e) => updateItemTipoMotivo(item.id, 'motivo_solicitacao', e.target.value)}
                                placeholder="Motivo específico..."
                                className="h-8 text-xs"
                              />
                            </div>
                          </div>
                          
                          <div className="mt-3">
                            <Label className="text-xs font-medium">Observações (opcional)</Label>
                            <Input
                              value={item.observacoes || ''}
                              onChange={(e) => updateItemTipoMotivo(item.id, 'observacoes', e.target.value)}
                              placeholder="Observações adicionais..."
                              className="h-8 text-xs mt-1"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-2">
                <Label htmlFor="solicitante">Funcionário *</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Digite para buscar funcionário..."
                    value={searchUser}
                    onChange={(e) => setSearchUser(e.target.value)}
                    className="pl-10"
                  />
                  {searchUser && (
                    <X 
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 cursor-pointer hover:text-gray-600" 
                      onClick={() => setSearchUser('')}
                    />
                  )}
                </div>
                {searchUser && filteredUsuarios.length > 0 && (
                  <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-md bg-white shadow-sm">
                    {filteredUsuarios.map(usuario => (
                      <div
                        key={usuario.id}
                        className={`p-2 cursor-pointer hover:bg-gray-50 border-b last:border-b-0 ${
                          emergencyForm.solicitante_id === usuario.id ? 'bg-blue-50 border-blue-200' : ''
                        }`}
                        onClick={() => {
                          setEmergencyForm(prev => ({ ...prev, solicitante_id: usuario.id }))
                          setSearchUser(usuario.nome)
                        }}
                      >
                        <div className="font-medium">
                          {usuario.nome} {usuario.id === user?.id ? '(Você mesmo)' : ''}
                        </div>
                        <div className="text-sm text-gray-500">
                          {usuario.cargo || 'Funcionário'} {usuario.matricula ? `- Mat. ${usuario.matricula}` : ''}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {emergencyForm.solicitante_id && !searchUser && (
                  <div className="text-sm text-blue-600">
                    Funcionário selecionado: {usuarios.find(u => u.id === emergencyForm.solicitante_id)?.nome}
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="prioridade">Prioridade</Label>
                <Select value={emergencyForm.prioridade} onValueChange={(value) => setEmergencyForm(prev => ({ ...prev, prioridade: value as 'baixa' | 'normal' | 'alta' | 'urgente' }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="urgente">🔴 Urgente</SelectItem>
                    <SelectItem value="alta">🟡 Alta</SelectItem>
                    <SelectItem value="normal">🟢 Normal</SelectItem>
                    <SelectItem value="baixa">⚪ Baixa</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="tipo">Tipo</Label>
                <Select value={emergencyForm.tipo_troca} onValueChange={(value) => setEmergencyForm(prev => ({ ...prev, tipo_troca: value as 'desconto' | 'troca' | 'fornecimento' }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fornecimento">Fornecimento</SelectItem>
                    <SelectItem value="troca">Troca</SelectItem>
                    <SelectItem value="desconto">Desconto</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="motivo">Motivo da Solicitação *</Label>
              <Textarea
                id="motivo"
                value={emergencyForm.motivo_solicitacao}
                onChange={(e) => setEmergencyForm(prev => ({ ...prev, motivo_solicitacao: e.target.value }))}
                placeholder="Descreva o motivo da solicitação emergencial..."
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="observacoes">Observações</Label>
              <Textarea
                id="observacoes"
                value={emergencyForm.observacoes}
                onChange={(e) => setEmergencyForm(prev => ({ ...prev, observacoes: e.target.value }))}
                placeholder="Observações adicionais..."
                rows={2}
              />
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="aprovar_automaticamente"
                checked={emergencyForm.aprovar_automaticamente}
                onChange={(e) => setEmergencyForm(prev => ({ ...prev, aprovar_automaticamente: e.target.checked }))}
                className="w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-500"
              />
              <Label htmlFor="aprovar_automaticamente" className="text-sm">
                ⚡ Aprovar automaticamente (solicitação emergencial)
              </Label>
            </div>
          </div>

          <DialogFooter className="flex items-center justify-between pt-4 border-t">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Badge variant="outline" className="text-xs">
                {itensIndividuaisEmergencial.length} itens selecionados
              </Badge>
              {emergencyForm.aprovar_automaticamente && (
                <Badge variant="destructive" className="text-xs">
                  Aprovação automática
                </Badge>
              )}
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => {
                setEmergencyOpen(false)
                setSearchItem('')
                setSearchUser('')
                setItensIndividuaisEmergencial([])
                setLoadingEmergency(false)
                setEmergencyForm({
                  item_id: '',
                  solicitante_id: '',
                  base_id: '',
                  quantidade_solicitada: '',
                  prioridade: 'urgente',
                  motivo_solicitacao: '',
                  tipo_troca: 'fornecimento',
                  observacoes: '',
                  aprovar_automaticamente: true
                })
              }}>
                Cancelar
              </Button>
              <Button 
                onClick={createEmergencyRequest}
                className="bg-red-600 hover:bg-red-700"
                disabled={loadingEmergency || itensIndividuaisEmergencial.length === 0 || !emergencyForm.solicitante_id || !emergencyForm.base_id || !emergencyForm.motivo_solicitacao.trim()}
              >
                {loadingEmergency ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Processando...
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-4 h-4 mr-2" />
                    Criar Solicitações ({itensIndividuaisEmergencial.length} itens)
                  </>
                )}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Cancelamento */}
      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancelar Solicitação</DialogTitle>
            <DialogDescription>
              Cancelar a solicitação aprovada de {selected?.item?.nome} para {selected?.destinatario_equipe ? `${selected.destinatario_equipe.nome} (Responsável: ${selected?.responsavel_equipe?.nome || 'Não informado'})` : selected?.destinatario?.nome}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cancelReason">Motivo do Cancelamento *</Label>
              <Textarea
                id="cancelReason"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Descreva o motivo do cancelamento..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setCancelOpen(false)
              setCancelReason('')
            }}>
              Cancelar
            </Button>
            <Button 
              onClick={handleCancel}
              className="bg-orange-600 hover:bg-orange-700"
              disabled={!cancelReason.trim()}
            >
              Confirmar Cancelamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Correção de Item */}
      <Dialog open={returnOpen} onOpenChange={setReturnOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {selected?.status === 'entregue' ? 'Trocar Item' : 'Correção de Item'}
            </DialogTitle>
            <DialogDescription>
              {selected?.status === 'entregue' 
                ? `Trocar o item ${selected?.item?.nome} entregue para ${selected?.destinatario_equipe ? `${selected.destinatario_equipe.nome} (Responsável: ${selected?.responsavel_equipe?.nome || 'Não informado'})` : selected?.destinatario?.nome}`
                : `Processar correção do item ${selected?.item?.nome} e criar nova solicitação`
              }
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="returnQuantity">Quantidade a Devolver *</Label>
                <Input
                  id="returnQuantity"
                  type="number"
                  min="1"
                  max={selected?.quantidade_aprovada || selected?.quantidade_solicitada}
                  value={selected?.quantidade_aprovada || selected?.quantidade_solicitada || ''}
                  readOnly
                  disabled
                  className="bg-gray-50 cursor-not-allowed"
                  placeholder="Quantidade entregue"
                />
                <p className="text-xs text-gray-500">
                  Quantidade fixa baseada no que foi entregue: {selected?.quantidade_aprovada || selected?.quantidade_solicitada}
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="newItem">Novo Item *</Label>
                <SearchableSelect
                  items={itensCatalogo
                    .filter(item => item.item_estoque_id !== selected?.item_id)
                    .map(item => ({
                      id: item.item_estoque_id,
                      nome: item.item_nome,
                      codigo: item.item_codigo,
                      categoria: item.categoria
                    }))}
                  value={newItemId}
                  onValueChange={setNewItemId}
                  placeholder="Digite para buscar o novo item..."
                  className="w-full"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="returnReason">
                {selected?.status === 'entregue' ? 'Motivo da Troca *' : 'Motivo da Correção *'}
              </Label>
              <Textarea
                id="returnReason"
                value={returnReason}
                onChange={(e) => setReturnReason(e.target.value)}
                placeholder={selected?.status === 'entregue' 
                  ? "Ex: Tamanho não coube, item não serviu, etc..."
                  : "Ex: Tamanho não coube, item danificado, etc..."
                }
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="returnObservations">Observações</Label>
              <Textarea
                id="returnObservations"
                value={returnObservations}
                onChange={(e) => setReturnObservations(e.target.value)}
                placeholder={selected?.status === 'entregue'
                  ? "Observações adicionais sobre a troca..."
                  : "Observações adicionais sobre a correção..."
                }
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setReturnOpen(false)
              setReturnReason('')
              setReturnObservations('')
              setNewItemId('')
            }}>
              Cancelar
            </Button>
            <Button 
              onClick={handleReturn}
              className="bg-blue-600 hover:bg-blue-700"
              disabled={!returnReason.trim() || !newItemId}
            >
              {selected?.status === 'entregue' ? 'Processar Troca' : 'Processar Correção'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Devolução */}
      <Dialog open={simpleReturnOpen} onOpenChange={setSimpleReturnOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Devolver Item</DialogTitle>
            <DialogDescription>
              Devolver o item {selected?.item?.nome} que foi entregue para {selected?.destinatario_equipe ? `${selected.destinatario_equipe.nome} (Responsável: ${selected?.responsavel_equipe?.nome || 'Não informado'})` : selected?.destinatario?.nome}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="simpleReturnQuantity">Quantidade a Devolver *</Label>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm text-gray-600">
                  Quantidade entregue: <span className="font-medium text-green-600">{selected?.quantidade_entregue || selected?.quantidade_aprovada || 0}</span>
                </span>
              </div>
              <Input
                id="simpleReturnQuantity"
                type="number"
                min="1"
                max={selected?.quantidade_entregue || selected?.quantidade_aprovada || 0}
                value={simpleReturnQuantity}
                onChange={(e) => setSimpleReturnQuantity(e.target.value)}
                placeholder={`Ex: ${selected?.quantidade_entregue || selected?.quantidade_aprovada || 1}`}
                className="w-full"
              />
              <p className="text-xs text-gray-500">
                Máximo: {selected?.quantidade_entregue || selected?.quantidade_aprovada || 0} item(s)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="simpleReturnReason">Motivo da Devolução *</Label>
              <Textarea
                id="simpleReturnReason"
                value={simpleReturnReason}
                onChange={(e) => {
                  const value = e.target.value;
                  setSimpleReturnReason(value);
                }}
                placeholder="Ex: Funcionário saiu da empresa, item não é mais necessário, etc..."
                rows={3}
                className="resize-none"
                autoComplete="off"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setSimpleReturnOpen(false)
              setSimpleReturnReason('')
              setSimpleReturnQuantity('')
            }}>
              Cancelar
            </Button>
            <Button 
              onClick={handleSimpleReturn}
              className="bg-green-600 hover:bg-green-700"
              disabled={!simpleReturnReason || !simpleReturnQuantity || simpleReturnReason.length < 3}
            >
              Devolver Item
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Modal de Entrega Novo Funcionário */}
      <Dialog open={novoFuncionarioOpen} onOpenChange={setNovoFuncionarioOpen}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-blue-600">
              <Users className="w-5 h-5" />
              Entrega para Novo Funcionário
            </DialogTitle>
            <DialogDescription>
              Crie um grupo de entrega com itens pré-definidos baseados no cargo do funcionário.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* Seção 1: Seleção de Funcionário e Cargo */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Funcionário */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Label className="text-sm font-semibold">Funcionário</Label>
                  <Badge variant="destructive" className="text-xs">Obrigatório</Badge>
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Digite para buscar funcionário..."
                    value={searchFuncionario}
                    onChange={(e) => setSearchFuncionario(e.target.value)}
                    className="pl-10"
                  />
                  {searchFuncionario && (
                    <X 
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 cursor-pointer hover:text-gray-600" 
                      onClick={() => setSearchFuncionario('')}
                    />
                  )}
                </div>
                {searchFuncionario && filteredFuncionariosEntrega.length > 0 && (
                  <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-md bg-white shadow-sm">
                    {filteredFuncionariosEntrega.map(funcionario => (
                      <div
                        key={funcionario.id}
                        className={`p-3 cursor-pointer hover:bg-gray-50 border-b last:border-b-0 ${
                          novoFuncionarioForm.funcionario_id === funcionario.id ? 'bg-blue-50 border-blue-200' : ''
                        }`}
                        onClick={() => {
                          selecionarFuncionario(funcionario.id)
                          setSearchFuncionario('') // Limpar busca para fechar a lista
                        }}
                      >
                        <div className="font-medium">{funcionario.nome}</div>
                        <div className="text-sm text-gray-500 flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            {funcionario.cargo || 'Funcionário'}
                          </Badge>
                          {funcionario.matricula && (
                            <Badge variant="secondary" className="text-xs">
                              Mat. {funcionario.matricula}
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {novoFuncionarioForm.funcionario_id && !searchFuncionario && (
                  <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-md">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <div className="text-sm text-green-700">
                      <strong>Selecionado:</strong> {funcionariosFiltrados.find(u => u.id === novoFuncionarioForm.funcionario_id)?.nome}
                    </div>
                  </div>
                )}
              </div>
              </div>

              {/* Cargo */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Label className="text-sm font-semibold">Cargo</Label>
                  <Badge variant="destructive" className="text-xs">Obrigatório</Badge>
                </div>
                <Select
                  value={novoFuncionarioForm.cargo_id}
                  onValueChange={async (value) => {
                    // Tentar auto-selecionar módulo se base já está definida
                    let moduloAutoId = ''
                    if (value && novoFuncionarioForm.base_id) {
                      const baseSelecionada = bases.find(b => b.id === novoFuncionarioForm.base_id)
                      if (baseSelecionada?.contrato_id) {
                        const moduloCargo = modulosPredefinidos.find(m => 
                          m.cargo_id === value && m.contrato_id === baseSelecionada.contrato_id
                        )
                        if (moduloCargo) {
                          moduloAutoId = moduloCargo.modulo_id || moduloCargo.id
                        }
                      }
                    }
                    setNovoFuncionarioForm(prev => ({ 
                      ...prev, 
                      cargo_id: value,
                      modulo_predefinido_id: moduloAutoId
                    }))
                    if (moduloAutoId) {
                      await loadItensModulo(moduloAutoId)
                    } else {
                      setItensModuloSelecionado([])
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o cargo" />
                  </SelectTrigger>
                  <SelectContent>
                    {cargos.map(cargo => (
                      <SelectItem key={cargo.id} value={cargo.id}>
                        {cargo.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Seção 2: Seleção de Base */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Label className="text-sm font-semibold">Base</Label>
                <Badge variant="destructive" className="text-xs">Obrigatório</Badge>
              </div>
              <Select
                value={novoFuncionarioForm.base_id}
                onValueChange={async (value) => {
                  // Tentar auto-selecionar módulo se cargo já está definido
                  let moduloAutoId = ''
                  if (value && novoFuncionarioForm.cargo_id) {
                    const baseSelecionada = bases.find(b => b.id === value)
                    if (baseSelecionada?.contrato_id) {
                      const moduloCargo = modulosPredefinidos.find(m => 
                        m.cargo_id === novoFuncionarioForm.cargo_id && m.contrato_id === baseSelecionada.contrato_id
                      )
                      if (moduloCargo) {
                        moduloAutoId = moduloCargo.modulo_id || moduloCargo.id
                      }
                    }
                  }
                  setNovoFuncionarioForm(prev => ({ 
                    ...prev, 
                    base_id: value,
                    modulo_predefinido_id: moduloAutoId
                  }))
                  if (moduloAutoId) {
                    await loadItensModulo(moduloAutoId)
                  } else {
                    setItensModuloSelecionado([])
                  }
                  if (value) {
                    await loadDadosItensIndividuais(value)
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a base" />
                </SelectTrigger>
                <SelectContent>
                  {bases.map(base => (
                    <SelectItem key={base.id} value={base.id}>
                      {base.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Seção 3: Módulo Pré-definido */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Label className="text-sm font-semibold">Módulo Pré-definido</Label>
                  <Badge variant="destructive" className="text-xs">Obrigatório</Badge>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    window.open('/almoxarifado/modulos-predefinidos', '_blank')
                  }}
                  className="text-blue-600 border-blue-200 hover:bg-blue-50"
                >
                  <Settings className="w-4 h-4 mr-2" />
                  Gerenciar Módulos
                </Button>
              </div>
              
              <Select
                value={novoFuncionarioForm.modulo_predefinido_id}
                onValueChange={async (value) => {
                  setNovoFuncionarioForm(prev => ({ ...prev, modulo_predefinido_id: value }))
                  if (value) {
                    await loadItensModulo(value)
                  } else {
                    setItensModuloSelecionado([])
                  }
                }}
                disabled={!novoFuncionarioForm.cargo_id || !novoFuncionarioForm.base_id}
              >
                <SelectTrigger>
                  <SelectValue placeholder={!novoFuncionarioForm.cargo_id ? "Primeiro selecione um cargo" : !novoFuncionarioForm.base_id ? "Primeiro selecione a base" : "Selecione o módulo"} />
                </SelectTrigger>
                <SelectContent>
                  {filteredModulos.map(modulo => (
                    <SelectItem key={modulo.modulo_id || modulo.id} value={modulo.modulo_id || modulo.id}>
                      <div className="flex items-center justify-between w-full">
                        <span>{modulo.nome_modulo}</span>
                        <div className="flex gap-1 ml-2">
                          <Badge variant="outline" className="text-xs">
                            {modulo.total_itens || 0} itens
                          </Badge>
                          <Badge variant="secondary" className="text-xs">
                            {modulo.itens_obrigatorios || 0} obrigatórios
                          </Badge>
                        </div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Lista de Itens do Módulo */}
            {itensModuloSelecionado.length > 0 && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Label className="text-lg font-semibold">Itens do Módulo</Label>
                    <Badge variant="outline" className="text-xs">
                      {itensModuloSelecionado.length} itens
                    </Badge>
                  </div>
                </div>
                
                <div className="space-y-3 max-h-80 overflow-y-auto">
                  {itensModuloSelecionado
                    .sort((a, b) => a.ordem - b.ordem)
                    .map(item => (
                      <div key={item.id} className="p-5 border border-blue-200 rounded-lg bg-gradient-to-r from-blue-50 to-blue-100 hover:shadow-lg transition-shadow">
                        <div className="space-y-3">
                          {/* Linha superior: Nome e status obrigatório */}
                          <div className="flex items-center gap-4">
                            <div className="font-semibold text-base text-gray-900">{item.nome}</div>
                            {item.obrigatorio ? (
                              <Badge variant="destructive" className="text-sm px-3 py-1 font-semibold">Obrigatório</Badge>
                            ) : (
                              <Badge variant="secondary" className="text-sm px-3 py-1 font-semibold">Opcional</Badge>
                            )}
                          </div>
                          
                          {/* Linha inferior: Todos os dados na mesma linha */}
                          <div className="flex items-center gap-4">
                            {/* Código */}
                            <Badge variant="outline" className="text-sm px-3 py-1 font-medium">
                              {item.codigo}
                            </Badge>
                            
                            {/* Detectar se é um grupo (tem grupo_item_id mas não item_estoque_id/item_catalogo_id) */}
                            {item.grupo_item_id && !item.item_estoque_id && !item.item_catalogo_id && item.grupo_item && (
                              <>
                                <Badge variant="default" className="text-sm px-3 py-1 font-medium">
                                  <Package className="w-4 h-4 mr-2" />
                                  Grupo: {item.grupo_item.nome_grupo}
                                </Badge>
                                <Badge variant="outline" className="text-sm px-3 py-1 font-medium">
                                  {item.grupo_item.variacoes?.length || 0} variações
                                </Badge>
                                <div className="flex-1 max-w-xs">
                                  <Select
                                    value={item.variacao_selecionada || ''}
                                    onValueChange={(value) => {
                                      setItensModuloSelecionado(prev => prev.map(i => 
                                        i.id === item.id 
                                          ? { 
                                              ...i, 
                                              variacao_selecionada: value, 
                                              variacao_item: item.grupo_item?.variacoes?.find(v => v.id === value)
                                            }
                                          : i
                                      ))
                                    }}
                                  >
                                    <SelectTrigger className="h-10 text-sm font-medium border-2 border-blue-200 focus:border-blue-400">
                                      <SelectValue placeholder="Selecione a variação" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {item.grupo_item?.variacoes?.map(variacao => (
                                        <SelectItem key={variacao.id} value={variacao.id}>
                                          <div className="flex items-center justify-between w-full">
                                            <span>{variacao.nome_variacao}</span>
                                            {variacao.item_estoque?.estoque_atual !== undefined && (
                                            <Badge variant="outline" className="text-xs ml-2">
                                              Estoque: {variacao.item_estoque.estoque_atual}
                                            </Badge>
                                          )}
                                        </div>
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                </div>
                              </>
                            )}

                            {/* Seleção de Variação para Itens Individuais com Grupo */}
                            {(item.item_estoque_id || item.item_catalogo_id) && item.grupo_item && (
                              <>
                                <Badge variant="secondary" className="text-sm px-3 py-1 font-medium">
                                  <Package className="w-4 h-4 mr-2" />
                                  Item do Grupo: {item.grupo_item.nome_grupo}
                                </Badge>
                                <div className="flex-1 max-w-xs">
                                  <Select
                                    value={item.variacao_selecionada || ''}
                                    onValueChange={(value) => {
                                      setItensModuloSelecionado(prev => prev.map(i => 
                                        i.id === item.id 
                                          ? { 
                                              ...i, 
                                              variacao_selecionada: value, 
                                              variacao_item: item.grupo_item?.variacoes?.find(v => v.id === value)
                                            }
                                          : i
                                      ))
                                    }}
                                  >
                                    <SelectTrigger className="h-10 text-sm font-medium border-2 border-blue-200 focus:border-blue-400">
                                      <SelectValue placeholder="Selecione a variação" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {item.grupo_item?.variacoes?.map(variacao => (
                                        <SelectItem key={variacao.id} value={variacao.id}>
                                          <div className="flex items-center justify-between w-full">
                                            <span>{variacao.nome_variacao}</span>
                                            {variacao.item_estoque?.estoque_atual !== undefined && (
                                              <Badge variant="outline" className="text-xs ml-2">
                                                Estoque: {variacao.item_estoque.estoque_atual}
                                              </Badge>
                                            )}
                                          </div>
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              </>
                            )}
                            {/* Controles de quantidade - cor roxa e número maior */}
                            <div className="flex items-center gap-2 bg-gradient-to-r from-purple-50 to-purple-100 p-3 rounded-lg border-2 border-purple-200">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => alterarQuantidadeItem(item.id, item.quantidade_solicitada - 1)}
                                disabled={item.quantidade_solicitada <= 0}
                                className="h-10 w-10 p-0 text-lg font-bold text-purple-600 border-purple-300 hover:bg-purple-100 hover:border-purple-400"
                              >
                                -
                              </Button>
                              <div className="w-16 h-10 flex items-center justify-center bg-white border-2 border-purple-300 rounded-md">
                                <span className="text-xl font-bold text-purple-700">{item.quantidade_solicitada}</span>
                              </div>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => alterarQuantidadeItem(item.id, item.quantidade_solicitada + 1)}
                                className="h-10 w-10 p-0 text-lg font-bold text-purple-600 border-purple-300 hover:bg-purple-100 hover:border-purple-400"
                              >
                                +
                              </Button>
                              {!item.obrigatorio && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => removerItemLista(item.id)}
                                  className="text-red-600 border-red-200 hover:bg-red-50 h-8 w-8 p-0 ml-2"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Seção 4: Itens Individuais (Alternativa ao módulo) */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Plus className="w-5 h-5 text-blue-600" />
                  <Label className="text-sm font-semibold">Itens Individuais</Label>
                  <Badge variant="outline" className="text-xs">Opcional</Badge>
                </div>
                <div className="text-xs text-gray-500">
                  Adicione itens específicos caso não encontre um módulo adequado
                </div>
              </div>

              {/* Busca de Itens */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Busca por Item Individual */}
                <div className="space-y-2">
                  <Label className="text-xs font-medium">Buscar Item Individual</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Digite para buscar item..."
                      value={searchItemNovoFuncionario}
                      onChange={(e) => setSearchItemNovoFuncionario(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  {searchItemNovoFuncionario && (
                    <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-md bg-white shadow-sm">
                      {itensEstoqueNovoFuncionario
                        .filter(item => {
                          const searchLower = searchItemNovoFuncionario.toLowerCase()
                          const nome = item.item_nome?.toLowerCase() || ''
                          const codigo = item.item_codigo?.toLowerCase() || ''
                          const categoria = item.categoria?.toLowerCase() || ''
                          
                          return nome.includes(searchLower) ||
                                 codigo.includes(searchLower) ||
                                 categoria.includes(searchLower)
                        })
                        .map(item => (
                          <div
                            key={item.item_estoque_id}
                            className="p-2 cursor-pointer hover:bg-gray-50 border-b last:border-b-0"
                            onClick={() => {
                              adicionarItemIndividualNovoFuncionario(item)
                              setSearchItemNovoFuncionario('')
                            }}
                          >
                            <div className="text-sm font-medium">{item.item_nome}</div>
                            <div className="text-xs text-gray-500">Código: {item.item_codigo}</div>
                          </div>
                        ))}
                    </div>
                  )}
                </div>

                {/* Busca por Grupo */}
                <div className="space-y-2">
                  <Label className="text-xs font-medium">Buscar por Grupo</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Digite para buscar grupo..."
                      value={searchGrupoNovoFuncionario}
                      onChange={(e) => setSearchGrupoNovoFuncionario(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  {searchGrupoNovoFuncionario && (
                    <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-md bg-white shadow-sm">
                      {gruposItensNovoFuncionario
                        .filter(grupo => {
                          const searchLower = searchGrupoNovoFuncionario.toLowerCase()
                          const nomeGrupo = grupo.nome_grupo?.toLowerCase() || ''
                          const categoria = grupo.categoria?.toLowerCase() || ''
                          
                          return nomeGrupo.includes(searchLower) ||
                                 categoria.includes(searchLower)
                        })
                        .map(grupo => (
                          <div
                            key={grupo.id}
                            className="p-2 cursor-pointer hover:bg-gray-50 border-b last:border-b-0"
                            onClick={() => {
                              adicionarGrupoIndividualNovoFuncionario(grupo)
                              setSearchGrupoNovoFuncionario('')
                            }}
                          >
                            <div className="text-sm font-medium">{grupo.nome_grupo}</div>
                            <div className="text-xs text-gray-500">Categoria: {grupo.categoria}</div>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Lista de Itens Individuais Adicionados */}
              {itensIndividuaisNovoFuncionario.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Package className="w-4 h-4 text-blue-600" />
                    <Label className="text-sm font-semibold">Itens Adicionados</Label>
                    <Badge variant="secondary" className="text-xs">
                      {itensIndividuaisNovoFuncionario.length} itens
                    </Badge>
                  </div>
                  
                  <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-lg">
                    <div className="space-y-2 p-4">
                      {itensIndividuaisNovoFuncionario.map((item) => (
                        <div key={item.id} className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                          <div className="flex-1">
                            <div className="font-medium text-sm">{item.nome}</div>
                            <div className="text-xs text-gray-500">
                              Código: {item.codigo}
                            </div>
                            {item.grupo_item_id && !item.variacao_selecionada && (
                              <div className="mt-2">
                                <Select onValueChange={(value) => selecionarVariacaoItemIndividualNovoFuncionario(item.id, value)}>
                                  <SelectTrigger className="w-full">
                                    <SelectValue placeholder="Selecione uma variação" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {variacoesGrupoNovoFuncionario.map(variacao => (
                                      <SelectItem key={variacao.id} value={variacao.id}>
                                        {variacao.nome_variacao}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => alterarQuantidadeItemIndividualNovoFuncionario(item.id, item.quantidade_solicitada - 1)}
                                disabled={item.quantidade_solicitada <= 1}
                              >
                                -
                              </Button>
                              <span className="text-sm font-medium w-8 text-center">
                                {item.quantidade_solicitada}
                              </span>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => alterarQuantidadeItemIndividualNovoFuncionario(item.id, item.quantidade_solicitada + 1)}
                              >
                                +
                              </Button>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => removerItemIndividualNovoFuncionario(item.id)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Seção 4: Observações */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Label className="text-sm font-semibold">Observações</Label>
                <Badge variant="outline" className="text-xs">Opcional</Badge>
              </div>
              <Textarea
                id="observacoes"
                value={novoFuncionarioForm.observacoes}
                onChange={(e) => setNovoFuncionarioForm(prev => ({ ...prev, observacoes: e.target.value }))}
                placeholder="Observações sobre a entrega..."
                rows={3}
                className="resize-none"
              />
            </div>
          <DialogFooter className="flex items-center justify-between pt-4 border-t">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Badge variant="outline" className="text-xs">
                {itensModuloSelecionado.length + itensIndividuaisNovoFuncionario.length} itens selecionados
              </Badge>
              {itensModuloSelecionado.filter(item => item.obrigatorio).length > 0 && (
                <Badge variant="destructive" className="text-xs">
                  {itensModuloSelecionado.filter(item => item.obrigatorio).length} obrigatórios
                </Badge>
              )}
              {itensIndividuaisNovoFuncionario.length > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {itensIndividuaisNovoFuncionario.length} individuais
                </Badge>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => {
                setNovoFuncionarioOpen(false)
                setSearchFuncionario('')
                setItensModuloSelecionado([])
                setItensIndividuaisNovoFuncionario([])
                setNovoFuncionarioForm({
                  funcionario_id: '',
                  cargo_id: '',
                  modulo_predefinido_id: '',
                  base_id: '',
                  observacoes: ''
                })
              }}>
                Cancelar
              </Button>
              <Button 
                onClick={createNovoFuncionarioGroup}
                className="bg-blue-600 hover:bg-blue-700"
                disabled={isSubmittingNovoFuncionario || !novoFuncionarioForm.funcionario_id || !novoFuncionarioForm.cargo_id || !novoFuncionarioForm.base_id || (itensModuloSelecionado.length === 0 && itensIndividuaisNovoFuncionario.length === 0)}
              >
                {isSubmittingNovoFuncionario ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Enviando...
                  </>
                ) : (
                  <>
                    <Users className="w-4 h-4 mr-2" />
                    Criar Grupo de Entrega ({itensModuloSelecionado.length + itensIndividuaisNovoFuncionario.length} itens)
                  </>
                )}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      {/* Modal de Entrega Equipe */}
      <Dialog open={entregaEquipeOpen} onOpenChange={setEntregaEquipeOpen}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-600">
              <Users className="w-5 h-5" />
              Entrega para Equipe
            </DialogTitle>
            <DialogDescription>
              Crie solicitações com itens pré-definidos baseados em módulos para uma equipe específica.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* Seção 1: Seleção de Equipe e Responsável */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Equipe */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Label className="text-sm font-semibold">Equipe</Label>
                  <Badge variant="destructive" className="text-xs">Obrigatório</Badge>
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Digite para buscar equipe..."
                    value={searchEquipe}
                    onChange={(e) => setSearchEquipe(e.target.value)}
                    className="pl-10"
                  />
                  {searchEquipe && (
                    <X 
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 cursor-pointer hover:text-gray-600" 
                      onClick={() => setSearchEquipe('')}
                    />
                  )}
                </div>
                {searchEquipe && filteredEquipesEntrega.length > 0 && (
                  <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-md bg-white shadow-sm">
                    {filteredEquipesEntrega.map(equipe => (
                      <div
                        key={equipe.id}
                        className={`p-3 cursor-pointer hover:bg-gray-50 border-b last:border-b-0 ${
                          entregaEquipeForm.equipe_id === equipe.id ? 'bg-green-50 border-green-200' : ''
                        }`}
                        onClick={() => {
                          selecionarEquipe(equipe.id)
                          setSearchEquipe('') // Limpar busca para fechar a lista
                        }}
                      >
                        <div className="font-medium">{equipe.nome}</div>
                        <div className="text-sm text-gray-500 flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            {equipe.operacao || 'Operação'}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {entregaEquipeForm.equipe_id && !searchEquipe && (
                  <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-md">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <div className="text-sm text-green-700">
                      <strong>Selecionado:</strong> {equipesFiltradas.find(e => e.id === entregaEquipeForm.equipe_id)?.nome}
                    </div>
                  </div>
                )}
              </div>

              {/* Responsável */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Label className="text-sm font-semibold">Responsável pela Equipe</Label>
                  <Badge variant="destructive" className="text-xs">Obrigatório</Badge>
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Digite para buscar responsável..."
                    value={searchResponsavelEquipe}
                    onChange={(e) => setSearchResponsavelEquipe(e.target.value)}
                    className="pl-10"
                  />
                  {searchResponsavelEquipe && (
                    <X 
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 cursor-pointer hover:text-gray-600" 
                      onClick={() => setSearchResponsavelEquipe('')}
                    />
                  )}
                </div>
                {searchResponsavelEquipe && filteredResponsaveisEquipe.length > 0 && (
                  <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-md bg-white shadow-sm">
                    {filteredResponsaveisEquipe.map(responsavel => (
                      <div
                        key={responsavel.id}
                        className={`p-3 cursor-pointer hover:bg-gray-50 border-b last:border-b-0 ${
                          entregaEquipeForm.responsavel_equipe_id === responsavel.id ? 'bg-green-50 border-green-200' : ''
                        }`}
                        onClick={() => {
                          selecionarResponsavelEquipe(responsavel.id)
                          setSearchResponsavelEquipe('') // Limpar busca para fechar a lista
                        }}
                      >
                        <div className="font-medium">{responsavel.nome}</div>
                        <div className="text-sm text-gray-500 flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            {responsavel.cargo || 'Funcionário'}
                          </Badge>
                          {responsavel.matricula && (
                            <Badge variant="secondary" className="text-xs">
                              Mat. {responsavel.matricula}
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {entregaEquipeForm.responsavel_equipe_id && !searchResponsavelEquipe && (
                  <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-md">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <div className="text-sm text-green-700">
                      <strong>Selecionado:</strong> {funcionariosFiltrados.find(f => f.id === entregaEquipeForm.responsavel_equipe_id)?.nome}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Seção 2: Seleção de Base */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Label className="text-sm font-semibold">Base</Label>
                <Badge variant="destructive" className="text-xs">Obrigatório</Badge>
              </div>
              <Select
                value={entregaEquipeForm.base_id}
                onValueChange={(value) => selecionarBaseEquipe(value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a base" />
                </SelectTrigger>
                <SelectContent>
                  {bases.map(base => (
                    <SelectItem key={base.id} value={base.id}>
                      {base.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Seção 3: Módulo Pré-definido */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Label className="text-sm font-semibold">Módulo Pré-definido</Label>
                  <Badge variant="outline" className="text-xs">Opcional</Badge>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    window.open('/almoxarifado/modulos-predefinidos-equipe', '_blank')
                  }}
                  className="text-green-600 border-green-200 hover:bg-green-50"
                >
                  <Settings className="w-4 h-4 mr-2" />
                  Gerenciar Módulos
                </Button>
              </div>
              
              <Select
                value={entregaEquipeForm.modulo_predefinido_id}
                onValueChange={async (value) => {
                  console.log('🔄 [FRONTEND] Módulo selecionado:', value)
                  setEntregaEquipeForm(prev => ({ ...prev, modulo_predefinido_id: value }))
                  if (value) {
                    await loadItensModuloEquipe(value)
                  } else {
                    console.log('🧹 [FRONTEND] Limpando itens do módulo')
                    setItensModuloEquipeSelecionado([])
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o módulo (opcional)" />
                </SelectTrigger>
                <SelectContent>
                  {filteredModulosEquipe.map(modulo => (
                    <SelectItem key={modulo.id} value={modulo.id}>
                      <div className="flex items-center justify-between w-full">
                        <span>{modulo.nome_modulo}</span>
                        <div className="flex gap-1 ml-2">
                          <Badge variant="outline" className="text-xs">
                            {modulo.total_itens || 0} itens
                          </Badge>
                          <Badge variant="secondary" className="text-xs">
                            {modulo.itens_obrigatorios || 0} obrigatórios
                          </Badge>
                        </div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Lista de Itens do Módulo */}
            {itensModuloEquipeSelecionado.length > 0 && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Package className="w-5 h-5 text-green-600" />
                    <Label className="text-sm font-semibold">Itens do Módulo</Label>
                    <Badge variant="secondary" className="text-xs">
                      {itensModuloEquipeSelecionado.length} itens
                    </Badge>
                  </div>
                </div>
                
                <div className="max-h-96 overflow-y-auto border border-gray-200 rounded-lg">
                  <div className="space-y-2 p-4">
                    {itensModuloEquipeSelecionado.map((item) => (
                      <div key={item.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex-1">
                          <div className="font-medium text-sm">{item.item_nome || 'Nome não disponível'}</div>
                          <div className="text-xs text-gray-500 flex items-center gap-2">
                            <span>Código: {item.item_codigo || 'N/A'}</span>
                            {item.obrigatorio && (
                              <Badge variant="destructive" className="text-xs">
                                Obrigatório
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-sm text-gray-600">
                            Qtd: <strong>{item.quantidade_padrao}</strong>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Seção 4: Itens Individuais */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Plus className="w-5 h-5 text-blue-600" />
                  <Label className="text-sm font-semibold">Itens Individuais</Label>
                  {!entregaEquipeForm.modulo_predefinido_id && (
                    <Badge variant="destructive" className="text-xs">Obrigatório</Badge>
                  )}
                  {entregaEquipeForm.modulo_predefinido_id && (
                    <Badge variant="outline" className="text-xs">Opcional</Badge>
                  )}
                </div>
                <div className="text-xs text-gray-500">
                  {!entregaEquipeForm.modulo_predefinido_id 
                    ? 'Adicione pelo menos um item individual à solicitação'
                    : 'Adicione itens específicos adicionais ao módulo selecionado'
                  }
                </div>
              </div>

              {/* Busca de Itens */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Busca por Item Individual */}
                <div className="space-y-2">
                  <Label className="text-xs font-medium">Buscar Item Individual</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Digite para buscar item..."
                      value={searchItemEquipe}
                      onChange={(e) => setSearchItemEquipe(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  {searchItemEquipe && (
                    <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-md bg-white shadow-sm">
                      {itensEstoqueEquipe
                        .filter(item => {
                          const searchLower = searchItemEquipe.toLowerCase()
                          const nome = item.item_nome?.toLowerCase() || ''
                          const codigo = item.item_codigo?.toLowerCase() || ''
                          const categoria = item.categoria?.toLowerCase() || ''
                          
                          return nome.includes(searchLower) ||
                                 codigo.includes(searchLower) ||
                                 categoria.includes(searchLower)
                        })
                        .map(item => (
                          <div
                            key={item.item_estoque_id}
                            className="p-2 cursor-pointer hover:bg-gray-50 border-b last:border-b-0"
                            onClick={() => {
                              adicionarItemIndividualEquipe(item)
                              setSearchItemEquipe('')
                            }}
                          >
                            <div className="text-sm font-medium">{item.item_nome}</div>
                            <div className="text-xs text-gray-500">Código: {item.item_codigo}</div>
                          </div>
                        ))}
                    </div>
                  )}
                </div>

                {/* Busca por Grupo */}
                <div className="space-y-2">
                  <Label className="text-xs font-medium">Buscar por Grupo</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Digite para buscar grupo..."
                      value={searchGrupoEquipe}
                      onChange={(e) => setSearchGrupoEquipe(e.target.value)}
                      className="pl-10"
                    />
                    {searchGrupoEquipe && (
                      <X 
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 cursor-pointer hover:text-gray-600" 
                        onClick={() => setSearchGrupoEquipe('')}
                      />
                    )}
                  </div>
                  {searchGrupoEquipe && (
                    <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-md bg-white shadow-sm">
                      {gruposItensEquipe
                        .filter(grupo => {
                          const searchLower = searchGrupoEquipe.toLowerCase()
                          const nomeGrupo = grupo.nome_grupo?.toLowerCase() || ''
                          const categoria = grupo.categoria?.toLowerCase() || ''
                          
                          return nomeGrupo.includes(searchLower) ||
                                 categoria.includes(searchLower)
                        })
                        .map(grupo => (
                          <div
                            key={grupo.id}
                            className="p-2 cursor-pointer hover:bg-gray-50 border-b last:border-b-0"
                            onClick={() => {
                              adicionarGrupoEquipe(grupo)
                              setSearchGrupoEquipe('')
                            }}
                          >
                            <div className="text-sm font-medium">{grupo.nome_grupo}</div>
                            <div className="text-xs text-gray-500">Categoria: {grupo.categoria}</div>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Lista de Itens Individuais Adicionados */}
              {itensIndividuaisEquipe.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Package className="w-4 h-4 text-blue-600" />
                    <Label className="text-sm font-semibold">Itens Adicionados</Label>
                    <Badge variant="secondary" className="text-xs">
                      {itensIndividuaisEquipe.length} itens
                    </Badge>
                  </div>
                  
                  <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-lg">
                    <div className="space-y-2 p-4">
                      {itensIndividuaisEquipe.map((item) => (
                        <div key={item.id} className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                          <div className="flex-1">
                            <div className="font-medium text-sm">{item.nome}</div>
                            <div className="text-xs text-gray-500">
                              Código: {item.codigo}
                            </div>
                            {item.grupo_item_id && !item.variacao_selecionada && (
                              <div className="mt-2">
                                <Select onValueChange={(value) => selecionarVariacaoEquipe(item.id, value)}>
                                  <SelectTrigger className="w-full">
                                    <SelectValue placeholder="Selecione uma variação" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {variacoesGrupoEquipe.map(variacao => (
                                      <SelectItem key={variacao.id} value={variacao.id}>
                                        {variacao.nome_variacao}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => alterarQuantidadeItemEquipe(item.id, item.quantidade_solicitada - 1)}
                                disabled={item.quantidade_solicitada <= 1}
                              >
                                -
                              </Button>
                              <span className="text-sm font-medium w-8 text-center">
                                {item.quantidade_solicitada}
                              </span>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => alterarQuantidadeItemEquipe(item.id, item.quantidade_solicitada + 1)}
                              >
                                +
                              </Button>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => removerItemIndividualEquipe(item.id)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Observações */}
            <div className="space-y-3">
              <Label className="text-sm font-semibold">Observações</Label>
              <Textarea
                placeholder="Observações adicionais sobre a entrega..."
                value={entregaEquipeForm.observacoes}
                onChange={(e) => setEntregaEquipeForm(prev => ({ ...prev, observacoes: e.target.value }))}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter className="flex gap-3">
            <div className="flex gap-3 w-full">
              <Button 
                variant="outline" 
                onClick={() => {
                  setEntregaEquipeForm({
                    equipe_id: '',
                    responsavel_equipe_id: '',
                    modulo_predefinido_id: '',
                    base_id: '',
                    observacoes: ''
                  })
                  setSearchEquipe('')
                  setSearchResponsavelEquipe('')
                  setEntregaEquipeOpen(false)
                }}>
                Cancelar
              </Button>
              <Button 
                onClick={() => {
                  console.log('🔍 DEBUG - Estados antes de criar:', {
                    entregaEquipeForm,
                    itensModuloEquipeSelecionado: itensModuloEquipeSelecionado.length,
                    itensIndividuaisEquipe: itensIndividuaisEquipe.length,
                    podeCriar: !entregaEquipeForm.equipe_id || !entregaEquipeForm.responsavel_equipe_id || !entregaEquipeForm.base_id || (itensModuloEquipeSelecionado.length === 0 && itensIndividuaisEquipe.length === 0)
                  })
                  createEntregaEquipeGroup()
                }}
                className="bg-green-600 hover:bg-green-700"
                disabled={!entregaEquipeForm.equipe_id || !entregaEquipeForm.responsavel_equipe_id || !entregaEquipeForm.base_id || (itensModuloEquipeSelecionado.length === 0 && itensIndividuaisEquipe.length === 0)}
              >
                <Users className="w-4 h-4 mr-2" />
                Criar Solicitações ({itensModuloEquipeSelecionado.length + itensIndividuaisEquipe.length} itens)
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
    </div>
  )
}
