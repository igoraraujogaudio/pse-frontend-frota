'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { 
  Loader2, 
  Package, 
  Building2, 
  Search, 
  Plus, 
  Edit, 
  AlertTriangle, 
  ShoppingCart,
  FileText,
  BarChart,
  FileSpreadsheet,
  Trash2,
  Warehouse,
  Shield,
  Link,
} from 'lucide-react'
import { baseService } from '@/services/baseService'
import { estoqueService } from '@/services/estoqueService'
import { catalogoService, type ItemEstoqueCompleto, type EstoqueStatsCatalogo } from '@/services/catalogoService'
import { retesteService } from '@/services/retesteService'
import { useNotification } from '@/contexts/NotificationContext'
import { parseBrazilianCurrency, formatBrazilianCurrency, isValidCurrency } from '@/utils/currencyUtils'
import type { ItemEstoque } from '@/types'
import { supabase } from '@/lib/supabase'
import * as XLSX from 'xlsx'
import { PERMISSION_CODES, useModularPermissions } from '@/hooks/useModularPermissions'
import { useWebAlmoxarifadoPermissions } from '@/hooks/useWebAlmoxarifadoPermissions'
import { useUnifiedPermissions } from '@/hooks/useUnifiedPermissions'
import ProtectedRoute from '@/components/ProtectedRoute'
import { UNIDADES_MEDIDA } from '@/constants/unidadesMedida'

// Removido - usando EstoqueStatsCatalogo do catalogoService

// Componente para seleção múltipla de bases
type MultiSelectBasesProps = {
  options: { id: string; nome: string }[];
  value: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
};

function MultiSelectBases({ options, value, onChange, placeholder = "Selecione as bases..." }: MultiSelectBasesProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !(ref.current as HTMLDivElement).contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (id: string) => {
    if (value.includes(id)) {
      onChange(value.filter((v: string) => v !== id));
    } else {
      onChange([...value, id]);
    }
  };

  const handleSelectAll = () => {
    if (value.length === options.length) {
      onChange([]);
    } else {
      onChange(options.map(opt => opt.id));
    }
  };

  return (
    <div className="relative" ref={ref}>
      <div
        className="w-full min-h-[38px] flex flex-wrap items-center gap-1 px-3 py-2 border border-input rounded-md bg-background cursor-pointer focus-within:ring-2 focus-within:ring-ring"
        onClick={() => setOpen((o) => !o)}
        tabIndex={0}
      >
        <Building2 className="h-4 w-4 mr-2 text-muted-foreground" />
        {value.length === 0 && (
          <span className="text-muted-foreground text-sm">{placeholder}</span>
        )}
        {value.length > 0 && (
          <span className="text-sm text-muted-foreground">
            {value.length === options.length 
              ? `Todas as bases (${value.length})`
              : `${value.length} base${value.length > 1 ? 's' : ''} selecionada${value.length > 1 ? 's' : ''}`
            }
          </span>
        )}
        {value.length > 0 && value.length < options.length && (
          <div className="flex flex-wrap gap-1 ml-2">
            {value.map((id: string) => {
              const opt = options.find((o: { id: string; nome: string }) => o.id === id);
              return (
                <span key={id} className="bg-primary/10 text-primary rounded px-2 py-0.5 text-xs flex items-center gap-1">
                  {opt?.nome}
                  <button
                    type="button"
                    className="ml-1 text-primary hover:text-primary/80 focus:outline-none"
                    onClick={e => { e.stopPropagation(); onChange(value.filter((v: string) => v !== id)); }}
                    aria-label="Remover"
                  >
                    ×
                  </button>
                </span>
              );
            })}
          </div>
        )}
      </div>
      {open && (
        <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg max-h-64 overflow-auto">
          <div
            className="px-3 py-2 cursor-pointer hover:bg-accent border-b flex items-center gap-2 font-medium"
            onClick={handleSelectAll}
          >
            <input
              type="checkbox"
              checked={value.length === options.length}
              readOnly
              className="accent-primary"
            />
            <span>Selecionar todas</span>
          </div>
          {options.map((opt: { id: string; nome: string }) => (
            <div
              key={opt.id}
              className={`px-3 py-2 cursor-pointer hover:bg-accent flex items-center gap-2 ${value.includes(opt.id) ? "bg-accent" : ""}`}
              onClick={() => handleSelect(opt.id)}
            >
              <input
                type="checkbox"
                checked={value.includes(opt.id)}
                readOnly
                className="accent-primary"
              />
              <span>{opt.nome}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function EstoquePage() {
  return (
    <ProtectedRoute requiredPermissions={[
      PERMISSION_CODES.ALMOXARIFADO.VISUALIZAR_ESTOQUE
    ]}>
      <EstoqueContent />
    </ProtectedRoute>
  );
}

function EstoqueContent() {
  const router = useRouter()
  const { notify } = useNotification()
  const queryClient = useQueryClient()
  const { hasPermission } = useModularPermissions()
  const { 
    canCreateNewItem, 
    canDeleteItem,
    canEditItemQuantity
  } = useWebAlmoxarifadoPermissions()
  const { hasBaseAccess, getBaseAccessType } = useUnifiedPermissions()
  
  // Estados principais
  const [selectedBases, setSelectedBases] = useState<string[]>([])
  
  // Estados de filtros
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategoria, setSelectedCategoria] = useState<string>('all')
  const [showAbaixoMinimo, setShowAbaixoMinimo] = useState(false)
  const [showComLaudo, setShowComLaudo] = useState(false)
  const [showComCA, setShowComCA] = useState(false)
  const [showComRastreabilidade, setShowComRastreabilidade] = useState(false)
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc' | null>(null)
  
  // Estados de modais
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [itemToDelete, setItemToDelete] = useState<ItemEstoqueCompleto | null>(null)
  const [editingItem, setEditingItem] = useState<string | null>(null)
  const [editingField, setEditingField] = useState<string | null>(null)
  const [editingValue, setEditingValue] = useState<string>('')
  const [exportando, setExportando] = useState(false)
  const [showExportDialog, setShowExportDialog] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  
  // Tipo para o formulário
  type FormData = {
    codigo: string
    nome: string
    descricao: string
    categoria: ItemEstoque['categoria']
    subcategoria: string
    unidade_medida: string
    estoque_minimo: number
    estoque_atual: number
    valor_unitario: number
    fornecedor: string
    localizacao: string
    status: ItemEstoque['status']
    requer_certificacao: boolean
    requer_laudo: boolean
    observacoes: string
    base_id: string
    validade: string
  }

  // Estados do formulário
  const [formData, setFormData] = useState<FormData>({
    codigo: '',
    nome: '',
    descricao: '',
    categoria: 'epi',
    subcategoria: '',
    unidade_medida: 'UN',
    estoque_minimo: 0,
    estoque_atual: 0,
    valor_unitario: 0,
    fornecedor: '',
    localizacao: '',
    status: 'ativo',
    requer_certificacao: false,
    requer_laudo: false,
    observacoes: '',
    base_id: '',
    validade: ''
  })

  // React Query para bases
  const { data: allBases = [] } = useQuery({
    queryKey: ['bases-ativas'],
    queryFn: () => baseService.getBasesAtivas(),
    staleTime: 5 * 60 * 1000, // 5 minutos
    gcTime: 10 * 60 * 1000, // 10 minutos
  })

  // Filtrar bases baseado nas permissões do usuário
  const bases = allBases.filter(base => hasBaseAccess(base.id))

  // Verificar se as bases selecionadas ainda são válidas após mudança de permissões
  useEffect(() => {
    const basesInvalidas = selectedBases.filter(baseId => !hasBaseAccess(baseId))
    if (basesInvalidas.length > 0) {
      setSelectedBases(selectedBases.filter(baseId => hasBaseAccess(baseId)))
      notify('Algumas bases selecionadas não estão mais disponíveis. Filtro atualizado.', 'warning')
    }
  }, [selectedBases, hasBaseAccess, notify])

  // Auto-selecionar base se usuário tem acesso a apenas uma
  useEffect(() => {
    if (bases.length === 1 && selectedBases.length === 0) {
      setSelectedBases([bases[0].id])
      notify(`Acesso limitado à base: ${bases[0].nome}`, 'info')
    }
  }, [bases, selectedBases, notify])

  // React Query para itens de estoque
  const { data: itensEstoque = [], isLoading: itensLoading } = useQuery({
    queryKey: ['itens-estoque', selectedBases, bases.map(b => b.id)],
    queryFn: async () => {
      if (selectedBases.length === 0) {
        // Se nenhuma base selecionada, mostrar todas as bases permitidas
        const baseIds = bases.map(base => base.id)
        // Passar as bases permitidas para filtrar no backend
        return catalogoService.getItensCatalogoAgregados(baseIds)
      } else if (selectedBases.length === 1) {
        // Se apenas uma base selecionada, usar método otimizado
        return catalogoService.getItensCatalogoComEstoque(selectedBases[0])
      } else {
        // Múltiplas bases selecionadas - passar as bases selecionadas para filtrar no backend
        return catalogoService.getItensCatalogoAgregados(selectedBases)
      }
    },
    staleTime: 2 * 60 * 1000, // 2 minutos
    gcTime: 5 * 60 * 1000, // 5 minutos
  })

  // React Query para estatísticas
  const { data: stats = {
    total_itens: 0,
    itens_abaixo_minimo: 0,
    total_categorias: {},
    valor_total: 0,
    itens_por_base: {}
  } } = useQuery({
    queryKey: ['estatisticas-estoque', selectedBases, bases.map(b => b.id)],
    queryFn: async () => {
      const baseIdsParaFiltrar = selectedBases.length === 0 ? bases.map(base => base.id) : selectedBases
      
      // Buscar itens já filtrados pelas bases permitidas/selecionadas
      const itensFiltrados = await catalogoService.getItensCatalogoAgregados(baseIdsParaFiltrar)
      
      const stats: EstoqueStatsCatalogo = {
        total_itens: itensFiltrados.length,
        itens_abaixo_minimo: 0,
        total_categorias: {},
        valor_total: 0,
        itens_por_base: {}
      }

      itensFiltrados.forEach(item => {
        // Contar itens abaixo do mínimo (total ou alguma base individual)
        const estoqueAtual = item.total_estoque || item.estoque_atual || 0
        const estoqueMinimo = item.total_minimo || item.estoque_minimo || 0
        
        const totalAbaixoMinimo = estoqueAtual < estoqueMinimo
        const temBaseAbaixoMinimo = item.bases_com_estoque 
          ? item.bases_com_estoque.some(base => base.estoque_atual < base.estoque_minimo)
          : false
        
        if (totalAbaixoMinimo || temBaseAbaixoMinimo) {
          stats.itens_abaixo_minimo++
        }

        // Contar por categoria
        if (!stats.total_categorias[item.categoria]) {
          stats.total_categorias[item.categoria] = 0
        }
        stats.total_categorias[item.categoria]++

        // Calcular valor total
        const valorUnitario = item.valor_unitario || 0
        stats.valor_total += estoqueAtual * valorUnitario

        // Contar por base
        if (item.bases_com_estoque) {
          item.bases_com_estoque.forEach(base => {
            if (!stats.itens_por_base[base.base_nome]) {
              stats.itens_por_base[base.base_nome] = 0
            }
            stats.itens_por_base[base.base_nome] += base.estoque_atual
          })
        }
      })

      return stats
    },
    staleTime: 2 * 60 * 1000, // 2 minutos
    gcTime: 5 * 60 * 1000, // 5 minutos
  })

  const loading = itensLoading

  // React Query para itens em reteste (indicador visual)
  const { data: retestePorCatalogo = new Map<string, number>() } = useQuery({
    queryKey: ['itens-reteste-estoque', selectedBases, bases.map(b => b.id)],
    queryFn: async () => {
      const baseIds = selectedBases.length > 0 ? selectedBases : bases.map(b => b.id)
      if (baseIds.length === 0) return new Map<string, number>()
      const results = await Promise.all(
        baseIds.map(baseId => retesteService.getItensComReteste(baseId))
      )
      const allReteste = results.flat()
      if (allReteste.length === 0) return new Map<string, number>()

      // Buscar item_catalogo_id para cada item_estoque_id
      const estoqueIds = [...new Set(allReteste.map(r => r.item_estoque_id).filter(Boolean))]
      const { data: mapping } = await supabase
        .from('itens_estoque')
        .select('id, item_catalogo_id')
        .in('id', estoqueIds)

      const estoqueToCalogo = new Map<string, string>()
      ;(mapping || []).forEach((m: { id: string; item_catalogo_id: string }) => estoqueToCalogo.set(m.id, m.item_catalogo_id))

      const byCatalogoId = new Map<string, number>()
      allReteste.forEach(r => {
        const catalogoId = estoqueToCalogo.get(r.item_estoque_id)
        if (catalogoId) {
          byCatalogoId.set(catalogoId, (byCatalogoId.get(catalogoId) || 0) + r.quantidade_reteste)
        }
      })
      return byCatalogoId
    },
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
  })

  // Função calculateStats removida - agora usando catalogoService.getEstatisticasEstoque()

  // Remover duplicatas baseado em item_catalogo_id antes de filtrar
  const itensUnicos = Array.from(
    new Map(itensEstoque.map(item => [item.item_catalogo_id, item])).values()
  )

  // Filtrar e ordenar itens
  const filteredItens = itensUnicos.filter(item => {
    const matchesSearch = item.item_nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.item_codigo.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesCategoria = selectedCategoria === 'all' || item.categoria === selectedCategoria
    
    // Para estoque, usar total_estoque se disponível (agregação) ou estoque_atual (base específica)
    const estoqueAtual = item.total_estoque || item.estoque_atual
    const estoqueMinimo = item.total_minimo || item.estoque_minimo
    
    // Verificar se está abaixo do mínimo: total ou alguma base individual
    const totalAbaixoMinimo = estoqueAtual < estoqueMinimo
    const temBaseAbaixoMinimo = item.bases_com_estoque 
      ? item.bases_com_estoque.some(base => base.estoque_atual < base.estoque_minimo)
      : false
    const estaAbaixoMinimo = totalAbaixoMinimo || temBaseAbaixoMinimo
    
    const matchesMinimo = !showAbaixoMinimo || estaAbaixoMinimo
    const matchesLaudo = !showComLaudo || item.requer_laudo
    const matchesCA = !showComCA || item.requer_ca
    const matchesRastreabilidade = !showComRastreabilidade || item.requer_rastreabilidade

    return matchesSearch && matchesCategoria && matchesMinimo && matchesLaudo && matchesCA && matchesRastreabilidade
  }).sort((a, b) => {
    if (sortOrder === 'asc') {
      return a.item_nome.localeCompare(b.item_nome, 'pt-BR')
    } else if (sortOrder === 'desc') {
      return b.item_nome.localeCompare(a.item_nome, 'pt-BR')
    }
    return 0
  })

  // Handlers de formulário
  const handleInputChange = (field: string, value: string | number | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleSortToggle = () => {
    if (sortOrder === null) {
      setSortOrder('asc')
    } else if (sortOrder === 'asc') {
      setSortOrder('desc')
    } else {
      setSortOrder(null)
    }
  }

  // Mutation para criar item
  const createItemMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      // 1. Criar item no catálogo
      const { data: itemCatalogo, error: catalogoError } = await supabase
        .from('itens_catalogo')
        .insert({
          codigo: formData.codigo,
          nome: formData.nome,
          descricao: formData.descricao,
          categoria: formData.categoria,
          subcategoria: formData.subcategoria,
          unidade_medida: formData.unidade_medida,
          valor_unitario: formData.valor_unitario,
          fornecedor: formData.fornecedor,
          validade: formData.validade || null,
          observacoes: formData.observacoes,
          requer_certificacao: formData.requer_certificacao,
          requer_laudo: formData.requer_laudo,
          ativo: true
        })
        .select('id')
        .single()

      if (catalogoError) {
        console.error('Erro ao criar item no catálogo:', catalogoError)
        throw catalogoError
      }

      // 2. Adicionar item à base específica
      await catalogoService.adicionarItemABase(
        itemCatalogo.id,
        formData.base_id,
        formData.estoque_minimo,
        formData.estoque_atual,
        formData.localizacao,
        formData.observacoes
      )

      return itemCatalogo
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['itens-estoque'] })
      queryClient.invalidateQueries({ queryKey: ['estatisticas-estoque'] })
      notify('Item criado com sucesso', 'success')
      setShowCreateDialog(false)
      resetForm()
    },
    onError: (error) => {
      console.error('Erro ao criar item:', error)
      notify('Erro ao criar item', 'error')
    }
  })

  const handleCreateItem = async () => {
    // VERIFICAR PERMISSÃO ANTES DE CRIAR
    if (!canCreateNewItem()) {
      notify('Você não tem permissão para criar novos itens', 'error')
      return
    }

    if (!formData.codigo || !formData.nome) {
      notify('Código e nome são obrigatórios', 'error')
      return
    }

    if (!formData.base_id) {
      notify('Base é obrigatória para criar item', 'error')
      return
    }

    // VERIFICAR ACESSO À BASE SELECIONADA
    if (!hasBaseAccess(formData.base_id)) {
      notify('Você não tem acesso à base selecionada', 'error')
      return
    }

    // VERIFICAR TIPO DE ACESSO À BASE (se for 'leitura', não pode criar)
    const baseAccessType = getBaseAccessType(formData.base_id)
    if (baseAccessType === 'leitura') {
      notify('Você tem apenas permissão de leitura nesta base', 'error')
      return
    }

    createItemMutation.mutate(formData)
  }

  const handleUpdateItem = async (itemId: string, field: string, value: string | number | boolean) => {
    // VERIFICAR PERMISSÃO ANTES DE ATUALIZAR
    // Para edição do nome, código, categoria e unidade_medida, usar permissão de CRIAR NOVO ITEM
    // Para edição de quantidade, usar permissão de editar quantidade
    const hasPermission = ['nome', 'codigo', 'categoria', 'unidade_medida'].includes(field) ? canCreateNewItem() : canEditItemQuantity()
    
    if (!hasPermission) {
      notify('Você não tem permissão para editar este campo', 'error')
      return
    }

    // VERIFICAR ACESSO ÀS BASES SELECIONADAS
    if (selectedBases.length > 0) {
      const basesSemAcesso = selectedBases.filter(baseId => !hasBaseAccess(baseId))
      if (basesSemAcesso.length > 0) {
        notify('Você não tem acesso a algumas bases selecionadas', 'error')
        return
      }

      // VERIFICAR TIPO DE ACESSO ÀS BASES (se alguma for 'leitura', não pode editar)
      const basesComLeitura = selectedBases.filter(baseId => getBaseAccessType(baseId) === 'leitura')
      if (basesComLeitura.length > 0) {
        notify('Você tem apenas permissão de leitura em algumas bases selecionadas', 'error')
        return
      }
    }

    try {
      // Se estamos editando quantidade, precisamos atualizar o estoque específico da base
      // Só permite editar se exatamente uma base estiver selecionada
      if ((field === 'estoque_atual' || field === 'estoque_minimo') && selectedBases.length === 1) {
        // Buscar o item_estoque específico desta base
        const { data: itemEstoque, error: fetchError } = await supabase
          .from('itens_estoque')
          .select('id')
          .eq('item_catalogo_id', itemId)
          .eq('base_id', selectedBases[0])
          .single()

        if (fetchError && fetchError.code === 'PGRST116') {
          // Item não existe no estoque desta base - criar automaticamente
          // Primeiro, buscar os dados do catálogo para preencher campos obrigatórios
          const { data: itemCatalogo, error: catalogoError } = await supabase
            .from('itens_catalogo')
            .select('codigo, nome, categoria, unidade_medida')
            .eq('id', itemId)
            .single()

          if (catalogoError || !itemCatalogo) {
            console.error('Erro ao buscar dados do catálogo:', catalogoError)
            notify('Erro ao buscar dados do item', 'error')
            return
          }

          const { error: createError } = await supabase
            .from('itens_estoque')
            .insert({
              // Campos obrigatórios da tabela original
              codigo: itemCatalogo.codigo,
              nome: itemCatalogo.nome,
              categoria: itemCatalogo.categoria,
              unidade_medida: itemCatalogo.unidade_medida,
              // Campos do novo sistema
              item_catalogo_id: itemId,
              base_id: selectedBases[0],
              estoque_atual: field === 'estoque_atual' ? (value as number) : 0,
              estoque_minimo: field === 'estoque_minimo' ? (value as number) : 0,
              status: 'ativo'
            })
            .select('id')
            .single()

          if (createError) {
            console.error('Erro ao criar item no estoque:', createError)
            notify('Erro ao criar item no estoque', 'error')
            return
          }

          notify('Item adicionado ao estoque da base com sucesso', 'success')
        } else if (fetchError) {
          console.error('Erro ao buscar item no estoque:', fetchError)
          notify('Erro ao localizar item no estoque', 'error')
          return
        } else if (itemEstoque) {
          // Item existe - atualizar
          await estoqueService.updateItem(itemEstoque.id, { [field]: value })
          notify('Quantidade atualizada com sucesso', 'success')
        }
      } else if (field === 'estoque_atual' || field === 'estoque_minimo') {
        // Tentando editar quantidade sem base específica selecionada
        notify('Selecione exatamente uma base para editar quantidades', 'error')
        return
      } else if (field === 'unidade_medida') {
        // Para unidade de medida, usar função de sincronização
        const { data, error } = await supabase.rpc('atualizar_unidade_medida_item_validada', {
          p_item_catalogo_id: itemId,
          p_nova_unidade_medida: value
        })
        
        if (error) {
          console.error('Erro ao atualizar unidade de medida:', error)
          notify('Erro ao atualizar unidade de medida', 'error')
          return
        }
        
        if (data?.sucesso) {
          notify(`Unidade de medida atualizada: ${data.unidade_anterior} → ${data.unidade_nova}`, 'success')
        } else {
          notify(data?.erro || 'Erro ao atualizar unidade de medida', 'error')
        }
      } else {
        // Para outros campos (nome, código, categoria, etc.), atualizar o catálogo
        await supabase
          .from('itens_catalogo')
          .update({ [field]: value })
          .eq('id', itemId)
        
        // Se for categoria, também precisa atualizar itens_estoque (campos duplicados para retrocompatibilidade)
        if (field === 'categoria') {
          await supabase
            .from('itens_estoque')
            .update({ categoria: value })
            .eq('item_catalogo_id', itemId)
        }
        
        notify('Item do catálogo atualizado com sucesso', 'success')
      }
      
      // Recarregar dados
      queryClient.invalidateQueries({ queryKey: ['itens-estoque', selectedBases] })
    } catch (error) {
      console.error('Erro ao atualizar item:', error)
      notify('Erro ao atualizar item', 'error')
    }
  }

  const handleEditField = (itemId: string, field: string) => {
    // VERIFICAR PERMISSÃO ANTES DE EDITAR
    const hasPermission = ['nome', 'codigo', 'categoria', 'unidade_medida'].includes(field) ? canCreateNewItem() : canEditItemQuantity()
    
    if (!hasPermission) {
      notify('Você não tem permissão para editar este campo', 'error')
      return
    }

    // VERIFICAR ACESSO ÀS BASES SELECIONADAS
    if (selectedBases.length > 0) {
      const basesSemAcesso = selectedBases.filter(baseId => !hasBaseAccess(baseId))
      if (basesSemAcesso.length > 0) {
        notify('Você não tem acesso a algumas bases selecionadas', 'error')
        return
      }

      // VERIFICAR TIPO DE ACESSO ÀS BASES (se alguma for 'leitura', não pode editar)
      const basesComLeitura = selectedBases.filter(baseId => getBaseAccessType(baseId) === 'leitura')
      if (basesComLeitura.length > 0) {
        notify('Você tem apenas permissão de leitura em algumas bases selecionadas', 'error')
        return
      }
    }
    
    // Encontrar o item para pegar o valor atual
    const item = itensEstoque.find(i => i.item_catalogo_id === itemId)
    if (item) {
      let initialValue = ''
      if (field === 'nome') initialValue = item.item_nome
      else if (field === 'codigo') initialValue = item.item_codigo
      else if (field === 'categoria') initialValue = item.categoria
      else if (field === 'unidade_medida') initialValue = item.unidade_medida
      else if (field === 'estoque_atual') initialValue = item.estoque_atual?.toString() || '0'
      else if (field === 'estoque_minimo') initialValue = item.estoque_minimo?.toString() || '0'
      
      setEditingValue(initialValue)
    }
    
    setEditingItem(itemId)
    setEditingField(field)
    
    // Usar setTimeout para garantir que o DOM seja atualizado antes de focar
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus()
        inputRef.current.select()
      }
    }, 50)
  }

  const handleSaveField = async (itemId: string, field: string, value: string | number) => {
    // Validação específica para nome
    if (field === 'nome' && (!value || value.toString().trim() === '')) {
      notify('Nome é obrigatório', 'error')
      return
    }

    try {
      await handleUpdateItem(itemId, field, value)
      setEditingItem(null)
      setEditingField(null)
    } catch (error) {
      console.error('Erro ao salvar campo:', error)
    }
  }

  const handleCancelEdit = () => {
    setEditingItem(null)
    setEditingField(null)
    setEditingValue('')
  }

  // Mutation para excluir item
  const deleteItemMutation = useMutation({
    mutationFn: async (itemToDelete: ItemEstoqueCompleto) => {
      if (selectedBases.length === 1) {
        // Excluir apenas o item_estoque específico desta base
        const { data: itemEstoque, error: fetchError } = await supabase
          .from('itens_estoque')
          .select('id')
          .eq('item_catalogo_id', itemToDelete.item_catalogo_id)
          .eq('base_id', selectedBases[0])
          .single()

        if (fetchError || !itemEstoque) {
          throw new Error('Erro ao localizar item no estoque')
        }

        await estoqueService.deleteItem(itemEstoque.id)
        return { success: true, message: 'Item removido do estoque desta base com sucesso' }
      } else {
        // Excluir item completo do catálogo e de todas as bases
        const resultado = await catalogoService.excluirItemCompleto(itemToDelete.item_catalogo_id)
        return resultado
      }
    },
    onSuccess: (resultado) => {
      if (resultado.success) {
        queryClient.invalidateQueries({ queryKey: ['itens-estoque'] })
        queryClient.invalidateQueries({ queryKey: ['estatisticas-estoque'] })
        notify(resultado.message, 'success')
        setShowDeleteDialog(false)
        setItemToDelete(null)
      } else {
        // Mostrar bases com estoque
        const basesComEstoque = resultado.basesComEstoque || []
        const mensagemBases = basesComEstoque.map(base => 
          `${base.base_nome}: ${base.estoque_atual} unidades`
        ).join(', ')
        
        notify(
          `${resultado.message}. Bases com estoque: ${mensagemBases}`, 
          'error'
        )
      }
    },
    onError: (error) => {
      console.error('Erro ao excluir item:', error)
      notify(error.message || 'Erro ao excluir item', 'error')
    }
  })

  const handleDeleteItem = async () => {
    if (!itemToDelete) return

    // VERIFICAR PERMISSÃO ANTES DE EXCLUIR
    if (!canDeleteItem()) {
      notify('Você não tem permissão para excluir itens', 'error')
      setShowDeleteDialog(false)
      setItemToDelete(null)
      return
    }

    // VERIFICAR ACESSO ÀS BASES SELECIONADAS
    if (selectedBases.length > 0) {
      const basesSemAcesso = selectedBases.filter(baseId => !hasBaseAccess(baseId))
      if (basesSemAcesso.length > 0) {
        notify('Você não tem acesso a algumas bases selecionadas', 'error')
        setShowDeleteDialog(false)
        setItemToDelete(null)
        return
      }

      // VERIFICAR TIPO DE ACESSO ÀS BASES (se alguma for 'leitura', não pode excluir)
      const basesComLeitura = selectedBases.filter(baseId => getBaseAccessType(baseId) === 'leitura')
      if (basesComLeitura.length > 0) {
        notify('Você tem apenas permissão de leitura em algumas bases selecionadas', 'error')
        setShowDeleteDialog(false)
        setItemToDelete(null)
        return
      }
    }

    deleteItemMutation.mutate(itemToDelete)
  }

  const confirmDeleteItem = (item: ItemEstoqueCompleto) => {
    setItemToDelete(item)
    setShowDeleteDialog(true)
  }

  // Variável para controlar estado de loading das mutations
  const updating = createItemMutation.isPending || deleteItemMutation.isPending

  const resetForm = () => {
    setFormData({
      codigo: '',
      nome: '',
      descricao: '',
      categoria: 'epi',
      subcategoria: '',
      unidade_medida: 'UN',
      estoque_minimo: 0,
      estoque_atual: 0,
      valor_unitario: 0,
      fornecedor: '',
      localizacao: '',
      status: 'ativo',
      requer_certificacao: false,
      requer_laudo: false,
      observacoes: '',
      base_id: selectedBases.length === 1 ? selectedBases[0] : '',
      validade: ''
    })
  }

  // Função para exportar estoque para Excel
  const exportarEstoqueExcel = async (formato: 'juntas' | 'separadas' = 'juntas') => {
    try {
      setExportando(true)
      
      // Preparar dados para Excel baseado nos filtros atuais
      let dadosParaExportar = itensEstoque
      
      // Aplicar filtros se necessário
      if (selectedCategoria !== 'all') {
        dadosParaExportar = dadosParaExportar.filter(item => item.categoria === selectedCategoria)
      }
      
      if (showAbaixoMinimo) {
        dadosParaExportar = dadosParaExportar.filter(item => item.estoque_atual <= item.estoque_minimo)
      }
      
      if (searchTerm) {
        const termo = searchTerm.toLowerCase()
        dadosParaExportar = dadosParaExportar.filter(item => 
          item.item_nome.toLowerCase().includes(termo) ||
          item.item_codigo.toLowerCase().includes(termo) ||
          (item.item_descricao && item.item_descricao.toLowerCase().includes(termo))
        )
      }
      
      // Criar workbook
      const wb = XLSX.utils.book_new()

      if (formato === 'separadas' && (selectedBases.length === 0 || selectedBases.length > 1)) {
        // Exportar cada base em uma planilha separada
        const basesUnicas = new Set<string>()
        dadosParaExportar.forEach(item => {
          if (item.bases_com_estoque) {
            item.bases_com_estoque.forEach(base => {
              // Se há bases selecionadas, filtrar apenas essas; senão, incluir todas
              if (selectedBases.length === 0 || selectedBases.includes(base.base_id)) {
                basesUnicas.add(base.base_id)
              }
            })
          } else if (item.base_id) {
            if (selectedBases.length === 0 || selectedBases.includes(item.base_id)) {
              basesUnicas.add(item.base_id)
            }
          }
        })

        // Buscar nomes das bases
        const basesComNome = Array.from(basesUnicas).map(baseId => {
          const base = bases.find(b => b.id === baseId)
          return { id: baseId, nome: base?.nome || 'Base Desconhecida' }
        })

        // Criar uma planilha para cada base
        for (const baseInfo of basesComNome) {
          const dadosBase = dadosParaExportar
            .filter(item => {
              if (item.bases_com_estoque) {
                return item.bases_com_estoque.some(b => b.base_id === baseInfo.id)
              }
              return item.base_id === baseInfo.id
            })
            .map(item => {
              const baseEstoque = item.bases_com_estoque?.find(b => b.base_id === baseInfo.id)
              return {
                'Código': item.item_codigo || '',
                'Nome': item.item_nome || '',
                'Descrição': item.item_descricao || '',
                'Categoria': item.categoria || '',
                'Subcategoria': item.subcategoria || '',
                'Unidade Medida': item.unidade_medida || '',
                'Estoque Atual': baseEstoque?.estoque_atual || item.estoque_atual || 0,
                'Estoque Mínimo': baseEstoque?.estoque_minimo || item.estoque_minimo || 0,
                'Estoque Máximo': 0,
                'Valor Unitário': item.valor_unitario || 0,
                'Valor Total': (baseEstoque?.estoque_atual || item.estoque_atual || 0) * (item.valor_unitario || 0),
                'Status': item.status_estoque || '',
                'Fornecedor': item.fornecedor || '',
                'Localização': item.localizacao_base || '',
                'Requer Certificação': item.requer_certificacao ? 'Sim' : 'Não',
                'Requer Laudo': item.requer_laudo ? 'Sim' : 'Não',
                'Observações': item.observacoes_base || ''
              }
            })

          if (dadosBase.length > 0) {
            const ws = XLSX.utils.json_to_sheet(dadosBase)
            const colWidths = [
              { wch: 15 }, { wch: 30 }, { wch: 40 }, { wch: 15 }, { wch: 15 },
              { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 },
              { wch: 12 }, { wch: 10 }, { wch: 20 }, { wch: 20 }, { wch: 15 },
              { wch: 12 }, { wch: 40 }
            ]
            ws['!cols'] = colWidths
            XLSX.utils.book_append_sheet(wb, ws, baseInfo.nome.substring(0, 31)) // Excel limita a 31 caracteres
          }
        }
      } else {
        // Exportar todas as bases juntas (formato atual)
        const dadosExcel = dadosParaExportar.map(item => ({
          'Código': item.item_codigo || '',
          'Nome': item.item_nome || '',
          'Descrição': item.item_descricao || '',
          'Categoria': item.categoria || '',
          'Subcategoria': item.subcategoria || '',
          'Unidade Medida': item.unidade_medida || '',
          'Estoque Atual': item.estoque_atual || 0,
          'Estoque Mínimo': item.estoque_minimo || 0,
          'Estoque Máximo': 0,
          'Valor Unitário': item.valor_unitario || 0,
          'Valor Total': (item.estoque_atual || 0) * (item.valor_unitario || 0),
          'Status': item.status_estoque || '',
          'Fornecedor': item.fornecedor || '',
          'Localização': item.localizacao_base || '',
          'Requer Certificação': item.requer_certificacao ? 'Sim' : 'Não',
          'Requer Laudo': item.requer_laudo ? 'Sim' : 'Não',
          'Base': item.base_nome || '',
          'Observações': item.observacoes_base || ''
        }))

        const ws = XLSX.utils.json_to_sheet(dadosExcel)
        const colWidths = [
          { wch: 15 }, { wch: 30 }, { wch: 40 }, { wch: 15 }, { wch: 15 },
          { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 },
          { wch: 12 }, { wch: 10 }, { wch: 20 }, { wch: 20 }, { wch: 15 },
          { wch: 12 }, { wch: 20 }, { wch: 40 }
        ]
        ws['!cols'] = colWidths
        XLSX.utils.book_append_sheet(wb, ws, 'Estoque')
      }
      
      // Gerar nome do arquivo com data e filtros
      const dataAtual = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')
      let nomeArquivo = `Estoque_${dataAtual}`
      
      if (selectedCategoria !== 'all') {
        nomeArquivo += `_${selectedCategoria.toUpperCase()}`
      }
      
      if (showAbaixoMinimo) {
        nomeArquivo += '_ABAIXO_MINIMO'
      }
      
      if (searchTerm) {
        nomeArquivo += `_${searchTerm.substring(0, 10)}`
      }
      
      nomeArquivo += '.xlsx'
      
      // Download
      XLSX.writeFile(wb, nomeArquivo)
      notify(`Relatório de estoque exportado com sucesso! (${dadosParaExportar.length} itens)`, 'success')
    } catch (error) {
      console.error('Erro ao exportar estoque:', error)
      notify('Erro ao exportar relatório de estoque', 'error')
    } finally {
      setExportando(false)
    }
  }

  // Verificar se o usuário tem acesso a alguma base
  if (bases.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Estoque</h1>
            <p className="text-gray-600">Gerencie os itens do almoxarifado</p>
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Carregando estoque...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Estoque</h1>
          <p className="text-gray-600">Gerencie os itens do almoxarifado</p>
        </div>
        <div className="flex gap-2">
          {hasPermission(PERMISSION_CODES.ALMOXARIFADO.CRIAR_ALMOXARIFADO) && (
            <Button 
              variant="default"
              onClick={() => router.push('/almoxarifado/criar-almoxarifado')}
            >
              <Warehouse className="h-4 w-4 mr-2" />
              Criar Almoxarifado
            </Button>
          )}
          <Button variant="outline" onClick={() => router.push('/almoxarifado/relatorios')}>
            <BarChart className="h-4 w-4 mr-2" />
            Relatórios
          </Button>
          <Button 
            variant="outline" 
            onClick={() => {
              if (selectedBases.length === 0) {
                setShowExportDialog(true)
              } else {
                exportarEstoqueExcel('juntas')
              }
            }}
            disabled={exportando}
          >
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            {exportando ? 'Exportando...' : 'Exportar Excel'}
          </Button>
          {canCreateNewItem() && (
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Item
            </Button>
          )}
        </div>
      </div>

      {/* Cards de Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {/* Total de Itens */}
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => {
          setSelectedCategoria('all')
          setShowAbaixoMinimo(false)
          setShowComLaudo(false)
          setShowComCA(false)
          setShowComRastreabilidade(false)
        }}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Itens</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total_itens}</div>
            <p className="text-xs text-muted-foreground">Itens cadastrados</p>
          </CardContent>
        </Card>

        {/* Abaixo do Mínimo */}
        <Card className={`cursor-pointer hover:shadow-md transition-shadow ${showAbaixoMinimo ? 'ring-2 ring-red-500' : ''}`} 
              onClick={() => setShowAbaixoMinimo(!showAbaixoMinimo)}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Abaixo do Mínimo</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.itens_abaixo_minimo}</div>
            <p className="text-xs text-muted-foreground">Requer reposição</p>
          </CardContent>
        </Card>

        {/* Valor Total */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Valor Total</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold truncate" title={new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stats.valor_total)}>
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stats.valor_total)}
            </div>
            <p className="text-xs text-muted-foreground">Valor do estoque</p>
          </CardContent>
        </Card>

        {/* Com Laudo */}
        <Card className={`cursor-pointer hover:shadow-md transition-shadow ${showComLaudo ? 'ring-2 ring-blue-500' : ''}`} 
              onClick={() => setShowComLaudo(!showComLaudo)}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Requer Laudo</CardTitle>
            <FileText className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {itensEstoque.filter(item => item.requer_laudo).length}
            </div>
            <p className="text-xs text-muted-foreground">Itens com laudo</p>
          </CardContent>
        </Card>

        {/* Com CA */}
        <Card className={`cursor-pointer hover:shadow-md transition-shadow ${showComCA ? 'ring-2 ring-green-500' : ''}`} 
              onClick={() => setShowComCA(!showComCA)}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Requer CA</CardTitle>
            <Shield className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {itensEstoque.filter(item => item.requer_ca).length}
            </div>
            <p className="text-xs text-muted-foreground">Itens com CA</p>
          </CardContent>
        </Card>

        {/* Com Rastreabilidade */}
        <Card className={`cursor-pointer hover:shadow-md transition-shadow ${showComRastreabilidade ? 'ring-2 ring-purple-500' : ''}`} 
              onClick={() => setShowComRastreabilidade(!showComRastreabilidade)}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Rastreabilidade</CardTitle>
            <Link className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              {itensEstoque.filter(item => item.requer_rastreabilidade).length}
            </div>
            <p className="text-xs text-muted-foreground">Itens rastreáveis</p>
          </CardContent>
        </Card>
      </div>

      {/* Filtros por Categoria */}
      <div className="flex flex-wrap gap-2">
        <Button 
          variant={selectedCategoria === 'all' ? 'default' : 'outline'} 
          size="sm"
          onClick={() => setSelectedCategoria('all')}
        >
          Todas ({stats.total_itens})
        </Button>
        {Object.entries(stats.total_categorias).map(([categoria, count]) => (
          <Button
            key={categoria}
            variant={selectedCategoria === categoria ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedCategoria(categoria)}
          >
            {categoria.toUpperCase()} ({count})
          </Button>
        ))}
      </div>

      {/* Filtros e Busca */}
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Seletor de Bases (Múltipla Seleção) */}
        <div className={`${
          selectedBases.length > 1 && selectedBases.length < bases.length 
            ? 'flex-1' 
            : 'w-full sm:w-auto sm:min-w-[200px]'
        }`}>
          <MultiSelectBases
            options={bases.map(base => ({ id: base.id, nome: base.nome }))}
            value={selectedBases}
            onChange={setSelectedBases}
            placeholder="Selecione as bases..."
          />
        </div>

        {/* Busca */}
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Buscar por nome ou código..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
      </div>

      {/* Lista de Itens */}
      <div className="bg-white rounded-lg border">
        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold">
            Itens do Estoque ({filteredItens.length})
          </h2>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th 
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                  onClick={handleSortToggle}
                  title="Clique para ordenar A-Z"
                >
                  <div className="flex items-center gap-1">
                    Item
                    {sortOrder === 'asc' && <span className="text-blue-600">↑</span>}
                    {sortOrder === 'desc' && <span className="text-blue-600">↓</span>}
                    {sortOrder === null && <span className="text-gray-400">↕</span>}
                  </div>
                </th>
                <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Categoria
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Unidade
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[200px]">
                  Estoque
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[150px]">
                  Mínimo
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Valor Unit.
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Laudo
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  CA
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Rastreab.
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredItens.map((item) => (
                <tr key={item.item_catalogo_id} className="hover:bg-gray-50">
                  <td className="px-4 py-4">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {editingItem === item.item_catalogo_id && editingField === 'nome' && canCreateNewItem() ? (
                          <div className="flex items-center gap-2">
                            <Input
                              ref={inputRef}
                              type="text"
                              value={editingValue}
                              onChange={(e) => setEditingValue(e.target.value)}
                              className="w-full"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  handleSaveField(item.item_catalogo_id, 'nome', editingValue)
                                } else if (e.key === 'Escape') {
                                  handleCancelEdit()
                                }
                              }}
                              onFocus={(e) => {
                                // Selecionar todo o texto quando focar
                                e.target.select()
                              }}
                            />
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                handleSaveField(item.item_catalogo_id, 'nome', editingValue)
                              }}
                            >
                              ✓
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={handleCancelEdit}
                            >
                              ✕
                            </Button>
                          </div>
                        ) : (
                          <div 
                            className={`${canCreateNewItem() ? 'cursor-pointer hover:bg-gray-100' : 'cursor-default'} p-1 rounded`}
                            onClick={() => canCreateNewItem() && handleEditField(item.item_catalogo_id, 'nome')}
                            title={canCreateNewItem() ? 'Clique para editar nome' : 'Sem permissão para editar nome'}
                          >
                            {item.item_nome}
                          </div>
                        )}
                      </div>
                      <div className="text-sm text-gray-500">
                        {editingItem === item.item_catalogo_id && editingField === 'codigo' && canCreateNewItem() ? (
                          <div className="flex items-center gap-2">
                            <Input
                              ref={inputRef}
                              type="text"
                              value={editingValue}
                              onChange={(e) => setEditingValue(e.target.value)}
                              className="w-full text-sm"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  handleSaveField(item.item_catalogo_id, 'codigo', editingValue)
                                } else if (e.key === 'Escape') {
                                  handleCancelEdit()
                                }
                              }}
                              onFocus={(e) => {
                                e.target.select()
                              }}
                            />
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                handleSaveField(item.item_catalogo_id, 'codigo', editingValue)
                              }}
                            >
                              ✓
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={handleCancelEdit}
                            >
                              ✕
                            </Button>
                          </div>
                        ) : (
                          <div 
                            className={`${canCreateNewItem() ? 'cursor-pointer hover:bg-gray-100' : 'cursor-default'} p-1 rounded`}
                            onClick={() => canCreateNewItem() && handleEditField(item.item_catalogo_id, 'codigo')}
                            title={canCreateNewItem() ? 'Clique para editar código' : 'Sem permissão para editar código'}
                          >
                            {item.item_codigo}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-2 py-4">
                    {editingItem === item.item_catalogo_id && editingField === 'categoria' && canCreateNewItem() ? (
                      <div className="flex items-center gap-2">
                        <Select
                          value={editingValue}
                          onValueChange={(value) => {
                            handleSaveField(item.item_catalogo_id, 'categoria', value)
                          }}
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="epi">EPI</SelectItem>
                            <SelectItem value="ferramental">Ferramental</SelectItem>
                            <SelectItem value="consumivel">Consumível</SelectItem>
                            <SelectItem value="equipamento">Equipamento</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditingItem(null)
                            setEditingField(null)
                          }}
                        >
                          ✕
                        </Button>
                      </div>
                    ) : (
                      <Badge 
                        variant="outline"
                        className={`${canCreateNewItem() ? 'cursor-pointer hover:bg-gray-100' : 'cursor-default'}`}
                        onClick={() => canCreateNewItem() && handleEditField(item.item_catalogo_id, 'categoria')}
                        title={canCreateNewItem() ? 'Clique para editar categoria' : 'Sem permissão para editar categoria'}
                      >
                        {item.categoria.toUpperCase()}
                      </Badge>
                    )}
                  </td>
                  <td className="px-4 py-4">
                    {editingItem === item.item_catalogo_id && editingField === 'unidade_medida' && canCreateNewItem() ? (
                      <div className="flex items-center gap-2">
                        <Select
                          value={item.unidade_medida}
                          onValueChange={(value) => {
                            handleSaveField(item.item_catalogo_id, 'unidade_medida', value)
                          }}
                        >
                          <SelectTrigger className="w-24">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {UNIDADES_MEDIDA.map(unidade => (
                              <SelectItem key={unidade.value} value={unidade.value}>
                                {unidade.value}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditingItem(null)
                            setEditingField(null)
                          }}
                        >
                          ✕
                        </Button>
                      </div>
                    ) : (
                      <div 
                        className={`${canCreateNewItem() ? 'cursor-pointer hover:bg-gray-100' : 'cursor-default'} p-1 rounded`}
                        onClick={() => canCreateNewItem() && handleEditField(item.item_catalogo_id, 'unidade_medida')}
                        title={canCreateNewItem() ? 'Clique para editar unidade de medida' : 'Sem permissão para editar unidade de medida'}
                      >
                        {item.unidade_medida}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-4 min-w-[200px]">
                    {(() => {
                      const estoqueAtual = item.total_estoque || item.estoque_atual
                      const estoqueMinimo = item.total_minimo || item.estoque_minimo
                      const isEditing = editingItem === item.item_catalogo_id && editingField === 'estoque_atual'
                      
                      // Verificar se alguma base individual está abaixo do mínimo
                      const temBaseAbaixoMinimo = (selectedBases.length === 0 || selectedBases.length > 1) && item.bases_com_estoque 
                        ? item.bases_com_estoque.some(base => base.estoque_atual < base.estoque_minimo)
                        : false
                      
                      const estaAbaixoMinimo = estoqueAtual < estoqueMinimo || temBaseAbaixoMinimo
                      
                      return isEditing && canEditItemQuantity() ? (
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            value={editingValue}
                            onChange={(e) => setEditingValue(e.target.value)}
                            className="w-20"
                            onBlur={() => {
                              handleSaveField(item.item_catalogo_id, 'estoque_atual', parseInt(editingValue) || 0)
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                handleSaveField(item.item_catalogo_id, 'estoque_atual', parseInt(editingValue) || 0)
                              } else if (e.key === 'Escape') {
                                handleCancelEdit()
                              }
                            }}
                            autoFocus
                          />
                        </div>
                      ) : (
                        <div 
                          className={`${canEditItemQuantity() && selectedBases.length === 1 ? 'cursor-pointer hover:bg-gray-100' : 'cursor-default'} p-1 rounded ${
                            estaAbaixoMinimo ? 'text-red-600 font-semibold' : ''
                          }`}
                          onClick={() => canEditItemQuantity() && selectedBases.length === 1 && handleEditField(item.item_catalogo_id, 'estoque_atual')}
                          title={canEditItemQuantity() && selectedBases.length === 1 ? 'Clique para editar quantidade' : 'Selecione exatamente uma base para editar'}
                        >
                          {estoqueAtual} {item.unidade_medida}
                          {(() => {
                            const qtdReteste = retestePorCatalogo.get(item.item_catalogo_id)
                            return qtdReteste && qtdReteste > 0 ? (
                              <span className="ml-2 inline-flex items-center bg-amber-100 text-amber-700 text-xs px-1.5 py-0.5 rounded-full">
                                {qtdReteste} em reteste
                              </span>
                            ) : null
                          })()}
                          {(selectedBases.length === 0 || selectedBases.length > 1) && item.bases_com_estoque && (
                            <div className="text-xs text-gray-500 mt-1">
                              {item.bases_com_estoque.map(base => {
                                const estaAbaixoMinimo = base.estoque_atual < base.estoque_minimo
                                return (
                                  <div key={base.base_id} className="flex items-baseline">
                                    <span className="flex-shrink-0 whitespace-nowrap">{base.base_nome}:</span>
                                    <span className="flex-1"></span>
                                    <span className={`flex-shrink-0 text-right tabular-nums min-w-[30px] ${estaAbaixoMinimo ? 'text-red-600 font-semibold' : ''}`}>
                                      {base.estoque_atual}
                                    </span>
                                  </div>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      )
                    })()}
                  </td>
                  <td className="px-4 py-4 min-w-[150px]">
                    {(() => {
                      const isEditing = editingItem === item.item_catalogo_id && editingField === 'estoque_minimo'
                      
                      return isEditing && canEditItemQuantity() && selectedBases.length === 1 ? (
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            value={editingValue}
                            onChange={(e) => setEditingValue(e.target.value)}
                            className="w-20"
                            onBlur={() => {
                              handleSaveField(item.item_catalogo_id, 'estoque_minimo', parseInt(editingValue) || 0)
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                handleSaveField(item.item_catalogo_id, 'estoque_minimo', parseInt(editingValue) || 0)
                              } else if (e.key === 'Escape') {
                                handleCancelEdit()
                              }
                            }}
                            autoFocus
                          />
                        </div>
                      ) : (
                        <div 
                          className={`${canEditItemQuantity() && selectedBases.length === 1 ? 'cursor-pointer hover:bg-gray-100' : 'cursor-default'} p-1 rounded text-sm`}
                          onClick={() => canEditItemQuantity() && selectedBases.length === 1 && handleEditField(item.item_catalogo_id, 'estoque_minimo')}
                          title={canEditItemQuantity() && selectedBases.length === 1 ? 'Clique para editar estoque mínimo' : 'Selecione exatamente uma base para editar'}
                        >
                          {(selectedBases.length === 0 || selectedBases.length > 1) && item.bases_com_estoque ? (
                            <>
                              <div className="text-sm font-medium text-center">
                                {item.total_minimo || item.estoque_minimo || 0} {item.unidade_medida}
                              </div>
                              <div className="text-xs text-gray-500 mt-1">
                                {item.bases_com_estoque.map(base => (
                                  <div key={base.base_id} className="text-center">
                                    <span className="tabular-nums">Min: {base.estoque_minimo}</span>
                                  </div>
                                ))}
                              </div>
                            </>
                          ) : (
                            <>
                              {item.estoque_minimo || 0} {item.unidade_medida}
                              {selectedBases.length === 1 && item.base_nome && (
                                <div className="text-xs text-gray-500 mt-0.5">
                                  Base: {item.base_nome}
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      )
                    })()}
                  </td>
                  <td className="px-4 py-4">
                    <div 
                      className="cursor-pointer hover:bg-gray-100 p-1 rounded text-sm"
                      onClick={() => {
                        const currentValue = item.valor_unitario ? formatBrazilianCurrency(item.valor_unitario) : '0,00'
                        const newValue = prompt('Novo valor unitário:', currentValue)
                        if (newValue !== null && isValidCurrency(newValue)) {
                          const parsedValue = parseBrazilianCurrency(newValue)
                          handleUpdateItem(item.item_catalogo_id, 'valor_unitario', parsedValue)
                        }
                      }}
                    >
                      {item.valor_unitario ? 
                        new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.valor_unitario) 
                        : '-'}
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <Switch
                      checked={item.requer_laudo || false}
                      onCheckedChange={(checked) => handleUpdateItem(item.item_catalogo_id, 'requer_laudo', checked)}
                    />
                  </td>
                  <td className="px-4 py-4">
                    <Switch
                      checked={item.requer_ca || false}
                      onCheckedChange={(checked) => handleUpdateItem(item.item_catalogo_id, 'requer_ca', checked)}
                    />
                  </td>
                  <td className="px-4 py-4">
                    <Switch
                      checked={item.requer_rastreabilidade || false}
                      onCheckedChange={(checked) => handleUpdateItem(item.item_catalogo_id, 'requer_rastreabilidade', checked)}
                    />
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex gap-2">
                      {canCreateNewItem() && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            if (item.item_catalogo_id === editingItem) {
                              setEditingItem(null)
                              setEditingField(null)
                            } else {
                              setEditingItem(item.item_catalogo_id)
                              setEditingField('nome') // Definir qual campo será editado
                            }
                          }}
                          title="Editar nome do item"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      )}
                      {canDeleteItem() && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => confirmDeleteItem(item)}
                          title="Excluir item"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredItens.length === 0 && (
          <div className="text-center py-8">
            <Package className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">Nenhum item encontrado</h3>
            <p className="mt-1 text-sm text-gray-500">
              Tente ajustar os filtros ou criar um novo item.
            </p>
          </div>
        )}
      </div>

      {/* Modal de Criação */}
      {canCreateNewItem() && (
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Criar Novo Item</DialogTitle>
            <DialogDescription>
              Adicione um novo item ao estoque do almoxarifado
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="codigo">Código *</Label>
              <Input
                id="codigo"
                value={formData.codigo}
                onChange={(e) => handleInputChange('codigo', e.target.value)}
                placeholder="Ex: EPI001"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="nome">Nome *</Label>
              <Input
                id="nome"
                value={formData.nome}
                onChange={(e) => handleInputChange('nome', e.target.value)}
                placeholder="Ex: Capacete de Segurança"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="categoria">Categoria</Label>
              <Select value={formData.categoria} onValueChange={(value) => handleInputChange('categoria', value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="epi">EPI</SelectItem>
                  <SelectItem value="ferramental">Ferramental</SelectItem>
                  <SelectItem value="consumivel">Consumível</SelectItem>
                  <SelectItem value="equipamento">Equipamento</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="unidade_medida">Unidade</Label>
              <Select value={formData.unidade_medida} onValueChange={(value) => handleInputChange('unidade_medida', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a unidade" />
                </SelectTrigger>
                <SelectContent>
                  {UNIDADES_MEDIDA.map(unidade => (
                    <SelectItem key={unidade.value} value={unidade.value}>
                      {unidade.value} - {unidade.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="estoque_atual">Estoque Atual</Label>
              <Input
                id="estoque_atual"
                type="number"
                value={formData.estoque_atual}
                onChange={(e) => handleInputChange('estoque_atual', parseInt(e.target.value) || 0)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="estoque_minimo">Estoque Mínimo (por Base) *</Label>
              <Input
                id="estoque_minimo"
                type="number"
                value={formData.estoque_minimo}
                onChange={(e) => handleInputChange('estoque_minimo', parseInt(e.target.value) || 0)}
                placeholder="Mínimo para a base selecionada"
              />
              <p className="text-xs text-gray-500">
                O estoque mínimo é definido por base. Cada base pode ter um valor diferente para o mesmo item.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="valor_unitario">Valor Unitário</Label>
              <Input
                id="valor_unitario"
                type="text"
                placeholder="0,00"
                value={formData.valor_unitario ? formatBrazilianCurrency(formData.valor_unitario) : ''}
                onChange={(e) => {
                  const inputValue = e.target.value
                  if (isValidCurrency(inputValue)) {
                    const parsedValue = parseBrazilianCurrency(inputValue)
                    handleInputChange('valor_unitario', parsedValue)
                  }
                }}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="base_id">Base</Label>
              <Select value={formData.base_id} onValueChange={(value) => handleInputChange('base_id', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma base" />
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

            <div className="col-span-2 space-y-2">
              <Label htmlFor="descricao">Descrição</Label>
              <Textarea
                id="descricao"
                value={formData.descricao}
                onChange={(e) => handleInputChange('descricao', e.target.value)}
                placeholder="Descrição detalhada do item"
              />
            </div>

            <div className="col-span-2 flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Switch
                  id="requer_certificacao"
                  checked={formData.requer_certificacao}
                  onCheckedChange={(checked) => handleInputChange('requer_certificacao', checked)}
                />
                <Label htmlFor="requer_certificacao">Requer Certificação</Label>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="requer_laudo"
                  checked={formData.requer_laudo}
                  onCheckedChange={(checked) => handleInputChange('requer_laudo', checked)}
                />
                <Label htmlFor="requer_laudo">Requer Laudo</Label>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreateItem} disabled={updating}>
              {updating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Criar Item
            </Button>
          </DialogFooter>
        </DialogContent>
        </Dialog>
      )}

      {/* Modal de Confirmação de Exclusão */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Confirmar Exclusão
            </DialogTitle>
            <DialogDescription>
              {selectedBases.length === 0 || selectedBases.length > 1
                ? 'Esta ação irá excluir o item do catálogo e de todas as bases. Esta ação não pode ser desfeita.'
                : 'Esta ação irá remover o item apenas do estoque desta base específica. Esta ação não pode ser desfeita.'
              }
            </DialogDescription>
          </DialogHeader>

          {itemToDelete && (
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="space-y-2">
                <div>
                  <span className="font-medium">Nome:</span> {itemToDelete.item_nome}
                </div>
                <div>
                  <span className="font-medium">Código:</span> {itemToDelete.item_codigo}
                </div>
                <div>
                  <span className="font-medium">Categoria:</span> {itemToDelete.categoria.toUpperCase()}
                </div>
                {selectedBases.length === 0 || selectedBases.length > 1 ? (
                  <div>
                    <span className="font-medium">Estoque total:</span> {itemToDelete.total_estoque || itemToDelete.estoque_atual} {itemToDelete.unidade_medida}
                    {itemToDelete.bases_com_estoque && itemToDelete.bases_com_estoque.length > 0 && (
                      <div className="mt-2 text-sm text-gray-600">
                        <span className="font-medium">Bases com estoque:</span>
                        <ul className="list-disc list-inside ml-2">
                          {itemToDelete.bases_com_estoque.map(base => (
                            <li key={base.base_id}>
                              {base.base_nome}: {base.estoque_atual} {itemToDelete.unidade_medida}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ) : (
                  <div>
                    <span className="font-medium">Estoque atual:</span> {itemToDelete.estoque_atual} {itemToDelete.unidade_medida}
                    <div className="text-sm text-gray-600 mt-1">
                      Base: {itemToDelete.base_nome}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setShowDeleteDialog(false)
                setItemToDelete(null)
              }}
            >
              Cancelar
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleDeleteItem}
              disabled={updating}
            >
              {updating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {selectedBases.length === 0 || selectedBases.length > 1 ? 'Excluir Item Completamente' : 'Remover da Base'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Escolher Formato de Exportação */}
      <Dialog open={showExportDialog} onOpenChange={setShowExportDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Formato de Exportação</DialogTitle>
            <DialogDescription>
              Escolha como deseja exportar os dados do estoque
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <Button
              variant="outline"
              className="w-full justify-start h-auto p-4"
              onClick={() => {
                setShowExportDialog(false)
                exportarEstoqueExcel('juntas')
              }}
            >
              <div className="text-left">
                <div className="font-semibold">Todas as Bases Juntas</div>
                <div className="text-sm text-gray-500 mt-1">
                  Exporta todos os itens em uma única planilha, agregando os valores de todas as bases
                </div>
              </div>
            </Button>

            <Button
              variant="outline"
              className="w-full justify-start h-auto p-4"
              onClick={() => {
                setShowExportDialog(false)
                exportarEstoqueExcel('separadas')
              }}
            >
              <div className="text-left">
                <div className="font-semibold">Bases Separadas</div>
                <div className="text-sm text-gray-500 mt-1">
                  Cria uma planilha separada para cada base com seus respectivos itens e quantidades
                </div>
              </div>
            </Button>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowExportDialog(false)}>
              Cancelar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
    </div>
  )
}