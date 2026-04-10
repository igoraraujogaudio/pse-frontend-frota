'use client'

import React, { useState } from 'react'
import { useNotification } from '@/contexts/NotificationContext'
import { useAuth } from '@/contexts/AuthContext'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { baseService } from '@/services/baseService'
import { catalogoService, type ItemCatalogo } from '@/services/catalogoService'
import { estoqueService } from '@/services/estoqueService'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  Loader2,
  Package,
  Plus,
  Edit,
  Trash2,
  Search,
  Link2,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Building2,
  Info,
  FileSpreadsheet,
  FileText,
  Upload
} from 'lucide-react'
import { PERMISSION_CODES } from '@/hooks/useModularPermissions'
import { useUnifiedPermissions } from '@/hooks/useUnifiedPermissions'
import ProtectedRoute from '@/components/ProtectedRoute'
import { UNIDADES_MEDIDA } from '@/constants/unidadesMedida'
import { formatBrazilianCurrency } from '@/utils/currencyUtils'
import * as XLSX from 'xlsx'

export default function CatalogoPage() {
  return (
    <ProtectedRoute requiredPermissions={[
      PERMISSION_CODES.ALMOXARIFADO.GERENCIAR_CATALOGO,
      PERMISSION_CODES.ALMOXARIFADO.VISUALIZAR_CATALOGO
    ]}>
      <CatalogoContent />
    </ProtectedRoute>
  );
}

function CatalogoContent() {
  const { notify } = useNotification()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const { hasBaseAccess } = useUnifiedPermissions()

  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategoria, setSelectedCategoria] = useState<string>('all')
  const [showInativos, setShowInativos] = useState(false)
  const [showApenasComLaudo, setShowApenasComLaudo] = useState(false)
  const [showApenasComCA, setShowApenasComCA] = useState(false)
  const [showApenasComRastreabilidade, setShowApenasComRastreabilidade] = useState(false)

  // Estados de modais
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showLinkDialog, setShowLinkDialog] = useState(false)
  const [showApplyDialog, setShowApplyDialog] = useState(false)
  const [showSyncAllDialog, setShowSyncAllDialog] = useState(false)
  const [showUploadDialog, setShowUploadDialog] = useState(false)
  const [showUploadMassDialog, setShowUploadMassDialog] = useState(false)
  const [showZerarEstoqueDialog, setShowZerarEstoqueDialog] = useState(false)
  const [selectedItem, setSelectedItem] = useState<ItemCatalogo | null>(null)
  const [selectedBases, setSelectedBases] = useState<string[]>([])
  const [selectedBaseSync, setSelectedBaseSync] = useState<string[]>([])
  const [exportando, setExportando] = useState(false)

  // Estados para upload de estoque
  const [uploadBaseId, setUploadBaseId] = useState<string>('')
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadPreview, setUploadPreview] = useState<Array<{ codigo: string; quantidade: number }>>([])
  const [processandoUpload, setProcessandoUpload] = useState(false)

  // Estados para upload em massa de criação de itens
  const [uploadMassFile, setUploadMassFile] = useState<File | null>(null)
  const [uploadMassPreview, setUploadMassPreview] = useState<Array<Partial<FormData>>>([])
  const [processandoUploadMass, setProcessandoUploadMass] = useState(false)

  // Estados para zerar estoque
  const [zerarEstoqueBaseId, setZerarEstoqueBaseId] = useState<string>('')
  const [zerandoEstoque, setZerandoEstoque] = useState(false)
  const [itensComEstoque, setItensComEstoque] = useState<number>(0)

  // Formulário
  type FormData = {
    codigo: string
    nome: string
    descricao: string
    categoria: ItemCatalogo['categoria']
    subcategoria: string
    unidade_medida: string
    valor_unitario: number
    fornecedor: string
    // Validade removida do formulário visual, pois pertence ao lote/entrada
    observacoes: string
    requer_certificacao: boolean
    requer_laudo: boolean
    requer_rastreabilidade: boolean
    requer_ca: boolean
    NCM: number
    ativo: boolean
  }

  const [formData, setFormData] = useState<FormData>({
    codigo: '',
    nome: '',
    descricao: '',
    categoria: 'epi',
    subcategoria: '',
    unidade_medida: 'UN',
    valor_unitario: 0,
    fornecedor: '',
    // validade removida
    observacoes: '',
    requer_certificacao: false,
    requer_laudo: false,
    requer_rastreabilidade: false,
    requer_ca: false,
    NCM: 0,
    ativo: true
  })

  // React Query para bases
  const { data: allBases = [] } = useQuery({
    queryKey: ['bases-ativas'],
    queryFn: () => baseService.getBasesAtivas(),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  })

  // Filtrar bases que o usuário tem acesso
  // IMPORTANTE: Mostrar TODAS as bases ativas que o usuário tem acesso, não apenas as que já têm itens
  const bases = allBases.filter(base => hasBaseAccess(base.id))

  // Debug: verificar se bases estão sendo filtradas incorretamente
  React.useEffect(() => {
    if (allBases.length > 0) {
      const basesComAcesso = allBases.filter(b => hasBaseAccess(b.id))
      const basesSemAcesso = allBases.filter(b => !hasBaseAccess(b.id))

      console.log('🔍 [CATALOGO] Debug bases:', {
        totalBases: allBases.length,
        basesComAcesso: basesComAcesso.length,
        basesSemAcesso: basesSemAcesso.length,
        nomesBasesComAcesso: basesComAcesso.map(b => `${b.nome} (${b.codigo || 'sem código'})`),
        nomesBasesSemAcesso: basesSemAcesso.map(b => `${b.nome} (${b.codigo || 'sem código'})`)
      })
    }
  }, [allBases, hasBaseAccess])

  // React Query para itens do catálogo
  const { data: itensCatalogo = [], isLoading: itensLoading } = useQuery({
    queryKey: ['itens-catalogo'],
    queryFn: () => catalogoService.getTodosItensCatalogo(),
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
  })

  // Filtrar itens
  const filteredItens = itensCatalogo.filter(item => {
    const matchesSearch = item.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.codigo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.descricao && item.descricao.toLowerCase().includes(searchTerm.toLowerCase()))
    const matchesCategoria = selectedCategoria === 'all' || item.categoria === selectedCategoria
    const matchesAtivo = showInativos || item.ativo
    const matchesLaudo = !showApenasComLaudo || item.requer_laudo
    const matchesCA = !showApenasComCA || item.requer_ca
    const matchesRastreabilidade = !showApenasComRastreabilidade || item.requer_rastreabilidade

    return matchesSearch && matchesCategoria && matchesAtivo && matchesLaudo && matchesCA && matchesRastreabilidade
  })

  // Mutation para criar item
  const createItemMutation = useMutation({
    mutationFn: (data: FormData) => catalogoService.criarItemCatalogo(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['itens-catalogo'] })
      notify('Item criado no catálogo com sucesso', 'success')
      setShowCreateDialog(false)
      resetForm()
    },
    onError: (error: Error | unknown) => {
      console.error('Erro ao criar item:', error)
      const message = error instanceof Error ? error.message : 'Erro desconhecido'
      notify(`Erro ao criar item: ${message}`, 'error')
    }
  })

  // Mutation para atualizar item
  const updateItemMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<FormData> }) =>
      catalogoService.atualizarItemCatalogo(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['itens-catalogo'] })
      queryClient.invalidateQueries({ queryKey: ['itens-estoque'] })
      notify('Item atualizado com sucesso', 'success')
      setShowEditDialog(false)
      setSelectedItem(null)
      resetForm()
    },
    onError: (error: Error | unknown) => {
      console.error('Erro ao atualizar item:', error)
      const message = error instanceof Error ? error.message : 'Erro desconhecido'
      notify(`Erro ao atualizar item: ${message}`, 'error')
    }
  })

  // Mutation para deletar item
  const deleteItemMutation = useMutation({
    mutationFn: (itemId: string) => catalogoService.excluirItemCompleto(itemId),
    onSuccess: (result) => {
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: ['itens-catalogo'] })
        queryClient.invalidateQueries({ queryKey: ['itens-estoque'] })
        notify(result.message, 'success')
        setShowDeleteDialog(false)
        setSelectedItem(null)
      } else {
        const basesMsg = result.basesComEstoque?.map(b => `${b.base_nome}: ${b.estoque_atual}`).join(', ')
        notify(`${result.message}. Bases com estoque: ${basesMsg}`, 'error')
      }
    },
    onError: (error: Error | unknown) => {
      console.error('Erro ao deletar item:', error)
      const message = error instanceof Error ? error.message : 'Erro desconhecido'
      notify(`Erro ao deletar item: ${message}`, 'error')
    }
  })

  // Mutation para vincular itens a bases
  const linkItemMutation = useMutation({
    mutationFn: async ({ itemId, baseIds }: { itemId: string; baseIds: string[] }) => {
      const promises = baseIds.map(baseId =>
        catalogoService.adicionarItemABase(itemId, baseId, 0, 0)
      )
      await Promise.all(promises)
      return { basesVinculadas: baseIds.length }
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['itens-estoque'] })
      queryClient.invalidateQueries({ queryKey: ['itens-catalogo'] })
      notify(`Item vinculado a ${result.basesVinculadas} base(s) com sucesso`, 'success')
      setShowLinkDialog(false)
      setSelectedItem(null)
      setSelectedBases([])
    },
    onError: (error: Error | unknown) => {
      console.error('Erro ao vincular item:', error)
      const message = error instanceof Error ? error.message : 'Erro desconhecido'
      notify(`Erro ao vincular item: ${message}`, 'error')
    }
  })

  // Mutation para aplicar edições às bases
  const applyEditionsMutation = useMutation({
    mutationFn: ({ itemId, campos }: { itemId: string; campos: Array<'codigo' | 'nome' | 'categoria' | 'unidade_medida' | 'NCM' | 'requer_laudo' | 'valor_unitario'> }) =>
      catalogoService.aplicarEdicoesABases(itemId, campos),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['itens-estoque'] })
      queryClient.invalidateQueries({ queryKey: ['itens-catalogo'] })
      notify(`Edições aplicadas a ${result.basesAtualizadas} base(s) com sucesso`, 'success')
      setShowApplyDialog(false)
      setSelectedItem(null)
    },
    onError: (error: Error | unknown) => {
      console.error('Erro ao aplicar edições:', error)
      const message = error instanceof Error ? error.message : 'Erro desconhecido'
      notify(`Erro ao aplicar edições: ${message}`, 'error')
    }
  })

  // Mutation para sincronizar todos os itens com múltiplas bases
  const syncAllItemsMutation = useMutation({
    mutationFn: async (baseIds: string[]) => {
      const results = []
      for (const baseId of baseIds) {
        const result = await catalogoService.sincronizarTodosItensComBase(baseId)
        results.push({ baseId, ...result })
      }
      return results
    },
    onSuccess: (results) => {
      queryClient.invalidateQueries({ queryKey: ['itens-estoque'] })
      queryClient.invalidateQueries({ queryKey: ['itens-catalogo'] })

      const totalVinculados = results.reduce((sum, r) => sum + r.itens_vinculados, 0)
      const totalJaVinculados = results.reduce((sum, r) => sum + r.itens_ja_vinculados, 0)

      notify(
        `Sincronização concluída para ${results.length} base(s)! ${totalVinculados} item(ns) vinculado(s). ${totalJaVinculados} já estavam vinculados.`,
        'success'
      )
      setShowSyncAllDialog(false)
      setSelectedBaseSync([])
    },
    onError: (error: Error | unknown) => {
      console.error('Erro ao sincronizar itens:', error)
      const message = error instanceof Error ? error.message : 'Erro desconhecido'
      notify(`Erro ao sincronizar itens: ${message}`, 'error')
    }
  })

  const resetForm = () => {
    setFormData({
      codigo: '',
      nome: '',
      descricao: '',
      categoria: 'epi',
      subcategoria: '',
      unidade_medida: 'UN',
      valor_unitario: 0,
      fornecedor: '',
      // validade removida
      observacoes: '',
      requer_certificacao: false,
      requer_laudo: false,
      requer_rastreabilidade: false,
      requer_ca: false,
      NCM: 0,
      ativo: true
    })
  }

  const handleCreateItem = () => {
    if (!formData.codigo || !formData.nome) {
      notify('Código e nome são obrigatórios', 'error')
      return
    }
    createItemMutation.mutate(formData)
  }

  const handleEditItem = (item: ItemCatalogo) => {
    setSelectedItem(item)
    setFormData({
      codigo: item.codigo,
      nome: item.nome,
      descricao: item.descricao || '',
      categoria: item.categoria,
      subcategoria: item.subcategoria || '',
      unidade_medida: item.unidade_medida,
      valor_unitario: item.valor_unitario || 0,
      fornecedor: item.fornecedor || '',
      // validade removida
      observacoes: item.observacoes || '',
      requer_certificacao: item.requer_certificacao,
      requer_laudo: item.requer_laudo,
      requer_rastreabilidade: item.requer_rastreabilidade || false,
      requer_ca: item.requer_ca || false,
      NCM: item.NCM || 0,
      ativo: item.ativo
    })
    setShowEditDialog(true)
  }

  const handleUpdateItem = () => {
    if (!selectedItem || !formData.codigo || !formData.nome) {
      notify('Código e nome são obrigatórios', 'error')
      return
    }
    updateItemMutation.mutate({ id: selectedItem.id, data: formData })
  }

  const handleDeleteItem = (item: ItemCatalogo) => {
    setSelectedItem(item)
    setShowDeleteDialog(true)
  }

  const confirmDeleteItem = () => {
    if (!selectedItem) return
    deleteItemMutation.mutate(selectedItem.id)
  }

  const handleLinkItem = (item: ItemCatalogo) => {
    setSelectedItem(item)
    setSelectedBases([])
    setShowLinkDialog(true)
  }

  const handleLinkToBases = () => {
    if (!selectedItem || selectedBases.length === 0) {
      notify('Selecione pelo menos uma base', 'error')
      return
    }
    linkItemMutation.mutate({ itemId: selectedItem.id, baseIds: selectedBases })
  }

  const handleApplyEditions = (item: ItemCatalogo) => {
    setSelectedItem(item)
    setShowApplyDialog(true)
  }

  const confirmApplyEditions = () => {
    if (!selectedItem) return

    const campos: Array<'codigo' | 'nome' | 'categoria' | 'unidade_medida' | 'NCM' | 'requer_laudo' | 'valor_unitario'> = [
      'codigo',
      'nome',
      'categoria',
      'unidade_medida',
      'NCM',
      'requer_laudo',
      'valor_unitario'
    ]

    applyEditionsMutation.mutate({ itemId: selectedItem.id, campos })
  }

  // Buscar bases com item quando necessário
  const { data: basesComItem = [] } = useQuery({
    queryKey: ['bases-com-item', selectedItem?.id],
    queryFn: () => selectedItem ? catalogoService.getBasesComItem(selectedItem.id) : [],
    enabled: !!selectedItem && (showLinkDialog || showApplyDialog),
    staleTime: 1 * 60 * 1000,
  })

  // Buscar quantidade de itens com estoque na base selecionada
  const { data: countItensComEstoque = 0 } = useQuery({
    queryKey: ['itens-com-estoque', zerarEstoqueBaseId],
    queryFn: async (): Promise<number> => {
      if (!zerarEstoqueBaseId) return 0
      const { count, error } = await supabase
        .from('itens_estoque')
        .select('*', { count: 'exact', head: true })
        .eq('base_id', zerarEstoqueBaseId)
        .eq('status', 'ativo')
        .gt('estoque_atual', 0)

      if (error) throw error
      return count ?? 0
    },
    enabled: !!zerarEstoqueBaseId && showZerarEstoqueDialog,
    staleTime: 0,
  })

  // Atualizar contador quando a query retornar
  React.useEffect(() => {
    setItensComEstoque(countItensComEstoque)
  }, [countItensComEstoque])

  // Estatísticas
  const stats = {
    total: itensCatalogo.length,
    ativos: itensCatalogo.filter(i => i.ativo).length,
    inativos: itensCatalogo.filter(i => !i.ativo).length,
    requeremLaudo: itensCatalogo.filter(i => i.requer_laudo).length,
    porCategoria: {
      epi: itensCatalogo.filter(i => i.categoria === 'epi').length,
      ferramental: itensCatalogo.filter(i => i.categoria === 'ferramental').length,
      consumivel: itensCatalogo.filter(i => i.categoria === 'consumivel').length,
      equipamento: itensCatalogo.filter(i => i.categoria === 'equipamento').length,
    }
  }

  // Função para exportar para Excel
  const exportarExcel = () => {
    if (filteredItens.length === 0) {
      notify('Não há itens para exportar', 'warning')
      return
    }

    setExportando(true)
    try {
      // Preparar dados para a planilha
      const worksheetData = [
        [
          'Código',
          'Nome',
          'Descrição',
          'Categoria',
          'Subcategoria',
          'Unidade de Medida',
          'Valor Unitário',
          'Fornecedor',
          'Fornecedor',
          // 'Validade', // Removido
          'NCM',
          'Requer Certificação',
          'Requer Laudo',
          'Requer Rastreabilidade',
          'Requer CA',
          'Observações',
          'Status',
          'Data de Criação',
          'Data de Atualização'
        ]
      ]

      filteredItens.forEach((item) => {
        worksheetData.push([
          item.codigo || '',
          item.nome || '',
          item.descricao || '',
          item.categoria || '',
          item.subcategoria || '',
          item.unidade_medida || '',
          item.valor_unitario ? formatBrazilianCurrency(item.valor_unitario) : '',
          item.fornecedor || '',
          // item.validade || '', // Removido
          String(item.NCM || ''),
          item.requer_certificacao ? 'Sim' : 'Não',
          item.requer_laudo ? 'Sim' : 'Não',
          item.requer_rastreabilidade ? 'Sim' : 'Não',
          item.requer_ca ? 'Sim' : 'Não',
          item.observacoes || '',
          item.ativo ? 'Ativo' : 'Inativo',
          item.criado_em ? new Date(item.criado_em).toLocaleString('pt-BR') : '',
          item.atualizado_em ? new Date(item.atualizado_em).toLocaleString('pt-BR') : ''
        ])
      })

      // Criar workbook e worksheet
      const workbook = XLSX.utils.book_new()
      const worksheet = XLSX.utils.aoa_to_sheet(worksheetData)

      // Ajustar largura das colunas
      const columnWidths = [
        { wch: 15 }, // Código
        { wch: 30 }, // Nome
        { wch: 40 }, // Descrição
        { wch: 15 }, // Categoria
        { wch: 20 }, // Subcategoria
        { wch: 18 }, // Unidade de Medida
        { wch: 15 }, // Valor Unitário
        { wch: 25 }, // Fornecedor
        // { wch: 12 }, // Validade - Removido
        { wch: 12 }, // NCM
        { wch: 18 }, // Requer Certificação
        { wch: 15 }, // Requer Laudo
        { wch: 40 }, // Observações
        { wch: 10 }, // Status
        { wch: 20 }, // Data de Criação
        { wch: 20 }  // Data de Atualização
      ]
      worksheet['!cols'] = columnWidths

      // Adicionar worksheet ao workbook
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Catálogo de Itens')

      // Gerar e baixar o arquivo Excel
      const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })
      const blob = new Blob([excelBuffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      })

      const link = document.createElement('a')
      const dataAtual = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')
      link.download = `catalogo-itens-${dataAtual}.xlsx`
      link.href = URL.createObjectURL(blob)
      link.click()
      URL.revokeObjectURL(link.href)

      notify(`Relatório Excel gerado com sucesso! ${filteredItens.length} item(ns) exportado(s).`, 'success')
    } catch (error) {
      console.error('Erro ao exportar Excel:', error)
      notify('Erro ao gerar relatório Excel', 'error')
    } finally {
      setExportando(false)
    }
  }

  // Função para processar arquivo de upload em massa de criação
  const handleMassFileUpload = async (file: File) => {
    try {
      const extension = file.name.split('.').pop()?.toLowerCase()

      if (extension === 'csv') {
        const text = await file.text()
        const lines = text.split('\n').filter(line => line.trim())
        const headers = lines[0].split(',').map(h => h.trim().toLowerCase())

        // Campos obrigatórios
        const codigoIndex = headers.findIndex(h => h === 'codigo' || h === 'código')
        const nomeIndex = headers.findIndex(h => h === 'nome')
        const categoriaIndex = headers.findIndex(h => h === 'categoria')
        const unidadeIndex = headers.findIndex(h => h.includes('unidade') || h === 'unidade_medida' || h === 'unidade medida')

        if (codigoIndex === -1 || nomeIndex === -1 || categoriaIndex === -1 || unidadeIndex === -1) {
          throw new Error('Arquivo CSV deve conter colunas obrigatórias: codigo, nome, categoria, unidade_medida')
        }

        // Campos opcionais
        const descricaoIndex = headers.findIndex(h => h === 'descricao' || h === 'descrição')
        const subcategoriaIndex = headers.findIndex(h => h === 'subcategoria' || h === 'subcategoria')
        const valorIndex = headers.findIndex(h => h.includes('valor') || h === 'valor_unitario' || h === 'valor unitario')
        const fornecedorIndex = headers.findIndex(h => h === 'fornecedor')
        // Validade removida da importação
        const ncmIndex = headers.findIndex(h => h === 'ncm' || h === 'NCM')
        const observacoesIndex = headers.findIndex(h => h === 'observacoes' || h === 'observações')
        const requerCertIndex = headers.findIndex(h => h.includes('certificacao') || h.includes('certificação'))
        const requerLaudoIndex = headers.findIndex(h => h.includes('laudo'))
        const requerRastreabilidadeIndex = headers.findIndex(h => h.includes('rastreabilidade'))
        const requerCaIndex = headers.findIndex(h => h === 'requer_ca' || h === 'requer ca' || h === 'ca')

        const data: Array<Partial<FormData>> = []
        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split(',').map(v => v.trim())
          const codigo = values[codigoIndex]
          const nome = values[nomeIndex]
          const categoria = values[categoriaIndex]?.toLowerCase()
          const unidade = values[unidadeIndex]

          if (!codigo || !nome || !categoria || !unidade) {
            continue // Pular linhas inválidas
          }

          // Validar categoria
          const categoriasValidas = ['epi', 'ferramental', 'consumivel', 'equipamento']
          if (!categoriasValidas.includes(categoria)) {
            continue // Pular se categoria inválida
          }

          const item: Partial<FormData> = {
            codigo,
            nome,
            categoria: categoria as ItemCatalogo['categoria'],
            unidade_medida: unidade,
            descricao: descricaoIndex >= 0 ? values[descricaoIndex] : '',
            subcategoria: subcategoriaIndex >= 0 ? values[subcategoriaIndex] : '',
            valor_unitario: valorIndex >= 0 ? parseFloat(values[valorIndex]?.replace(',', '.') || '0') : 0,
            fornecedor: fornecedorIndex >= 0 ? values[fornecedorIndex] : '',
            // validade removida
            NCM: ncmIndex >= 0 ? parseInt(values[ncmIndex] || '0') : 0,
            observacoes: observacoesIndex >= 0 ? values[observacoesIndex] : '',
            requer_certificacao: requerCertIndex >= 0 ? (values[requerCertIndex]?.toLowerCase() === 'sim' || values[requerCertIndex]?.toLowerCase() === 'true' || values[requerCertIndex] === '1') : false,
            requer_laudo: requerLaudoIndex >= 0 ? (values[requerLaudoIndex]?.toLowerCase() === 'sim' || values[requerLaudoIndex]?.toLowerCase() === 'true' || values[requerLaudoIndex] === '1') : false,
            requer_rastreabilidade: requerRastreabilidadeIndex >= 0 ? (values[requerRastreabilidadeIndex]?.toLowerCase() === 'sim' || values[requerRastreabilidadeIndex]?.toLowerCase() === 'true' || values[requerRastreabilidadeIndex] === '1') : false,
            requer_ca: requerCaIndex >= 0 ? (values[requerCaIndex]?.toLowerCase() === 'sim' || values[requerCaIndex]?.toLowerCase() === 'true' || values[requerCaIndex] === '1') : false,
            ativo: true
          }

          data.push(item)
        }

        if (data.length === 0) {
          throw new Error('Nenhum item válido encontrado no arquivo')
        }

        setUploadMassPreview(data)
      } else if (extension === 'xlsx' || extension === 'xls') {
        const arrayBuffer = await file.arrayBuffer()
        const workbook = XLSX.read(arrayBuffer, {
          type: 'array',
          cellDates: false,
          cellNF: false,
          cellText: false
        })

        if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
          throw new Error('Arquivo Excel não contém planilhas')
        }

        const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
        const jsonData = XLSX.utils.sheet_to_json(firstSheet, {
          defval: '',
          raw: false
        }) as Array<Record<string, unknown>>

        if (jsonData.length === 0) {
          throw new Error('Arquivo Excel está vazio ou não contém dados')
        }

        const firstRow = jsonData[0]
        const keys = Object.keys(firstRow)

        // Buscar colunas obrigatórias
        const codigoKey = keys.find(k =>
          k.toLowerCase().includes('codigo') ||
          k.toLowerCase().includes('código') ||
          k.toLowerCase() === 'cod' ||
          k.toLowerCase() === 'code'
        )
        const nomeKey = keys.find(k => k.toLowerCase() === 'nome')
        const categoriaKey = keys.find(k => k.toLowerCase() === 'categoria')
        const unidadeKey = keys.find(k =>
          k.toLowerCase().includes('unidade') ||
          k.toLowerCase().includes('unidade_medida') ||
          k.toLowerCase() === 'unidade medida'
        )

        if (!codigoKey || !nomeKey || !categoriaKey || !unidadeKey) {
          throw new Error(
            `Arquivo Excel deve conter colunas obrigatórias: codigo, nome, categoria, unidade_medida. ` +
            `Colunas encontradas: ${keys.join(', ')}`
          )
        }

        // Buscar colunas opcionais
        const descricaoKey = keys.find(k => k.toLowerCase().includes('descricao') || k.toLowerCase().includes('descrição'))
        const subcategoriaKey = keys.find(k => k.toLowerCase() === 'subcategoria')
        const valorKey = keys.find(k => k.toLowerCase().includes('valor') || k.toLowerCase().includes('valor_unitario'))
        const fornecedorKey = keys.find(k => k.toLowerCase() === 'fornecedor')
        // validade removida
        const ncmKey = keys.find(k => k.toLowerCase() === 'ncm')
        const observacoesKey = keys.find(k => k.toLowerCase().includes('observacoes') || k.toLowerCase().includes('observações'))
        const requerCertKey = keys.find(k => k.toLowerCase().includes('certificacao') || k.toLowerCase().includes('certificação'))
        const requerLaudoKey = keys.find(k => k.toLowerCase().includes('laudo'))
        const requerRastreabilidadeKey = keys.find(k => k.toLowerCase().includes('rastreabilidade'))
        const requerCaKey = keys.find(k => k.toLowerCase() === 'requer_ca' || k.toLowerCase() === 'requer ca' || k.toLowerCase() === 'ca')

        const data: Array<Partial<FormData>> = []
        for (const row of jsonData) {
          const codigo = String(row[codigoKey] || '').trim()
          const nome = String(row[nomeKey] || '').trim()
          const categoria = String(row[categoriaKey] || '').trim().toLowerCase()
          const unidade = String(row[unidadeKey] || '').trim()

          if (!codigo || !nome || !categoria || !unidade) {
            continue // Pular linhas inválidas
          }

          // Validar categoria
          const categoriasValidas = ['epi', 'ferramental', 'consumivel', 'equipamento']
          if (!categoriasValidas.includes(categoria)) {
            continue // Pular se categoria inválida
          }

          const item: Partial<FormData> = {
            codigo,
            nome,
            categoria: categoria as ItemCatalogo['categoria'],
            unidade_medida: unidade,
            descricao: descricaoKey ? String(row[descricaoKey] || '').trim() : '',
            subcategoria: subcategoriaKey ? String(row[subcategoriaKey] || '').trim() : '',
            valor_unitario: valorKey ? parseFloat(String(row[valorKey] || '0').replace(',', '.')) : 0,
            fornecedor: fornecedorKey ? String(row[fornecedorKey] || '').trim() : '',
            // validade removida
            NCM: ncmKey ? parseInt(String(row[ncmKey] || '0')) : 0,
            observacoes: observacoesKey ? String(row[observacoesKey] || '').trim() : '',
            requer_certificacao: requerCertKey ? (
              String(row[requerCertKey] || '').toLowerCase() === 'sim' ||
              String(row[requerCertKey] || '').toLowerCase() === 'true' ||
              String(row[requerCertKey] || '') === '1'
            ) : false,
            requer_laudo: requerLaudoKey ? (
              String(row[requerLaudoKey] || '').toLowerCase() === 'sim' ||
              String(row[requerLaudoKey] || '').toLowerCase() === 'true' ||
              String(row[requerLaudoKey] || '') === '1'
            ) : false,
            requer_rastreabilidade: requerRastreabilidadeKey ? (
              String(row[requerRastreabilidadeKey] || '').toLowerCase() === 'sim' ||
              String(row[requerRastreabilidadeKey] || '').toLowerCase() === 'true' ||
              String(row[requerRastreabilidadeKey] || '') === '1'
            ) : false,
            requer_ca: requerCaKey ? (
              String(row[requerCaKey] || '').toLowerCase() === 'sim' ||
              String(row[requerCaKey] || '').toLowerCase() === 'true' ||
              String(row[requerCaKey] || '') === '1'
            ) : false,
            ativo: true
          }

          data.push(item)
        }

        if (data.length === 0) {
          throw new Error('Nenhum item válido encontrado no arquivo. Verifique se as colunas obrigatórias contêm dados válidos.')
        }

        setUploadMassPreview(data)
      } else {
        throw new Error('Formato de arquivo não suportado. Use CSV ou Excel (.xlsx, .xls)')
      }
    } catch (error) {
      console.error('Erro ao processar arquivo:', error)
      notify(error instanceof Error ? error.message : 'Erro ao processar arquivo', 'error')
      setUploadMassFile(null)
      setUploadMassPreview([])
    }
  }

  // Função para processar upload em massa e criar itens
  const processarUploadMass = async () => {
    if (!uploadMassFile || uploadMassPreview.length === 0) {
      notify('Nenhum arquivo ou dados para processar', 'error')
      return
    }

    if (!user) {
      notify('Usuário não autenticado', 'error')
      return
    }

    setProcessandoUploadMass(true)

    try {
      let sucesso = 0
      let erros = 0
      const errosDetalhes: string[] = []

      // Verificar códigos duplicados no arquivo
      const codigosArquivo = uploadMassPreview.map(item => item.codigo).filter(Boolean)
      const codigosDuplicados = codigosArquivo.filter((codigo, index) => codigosArquivo.indexOf(codigo) !== index)
      if (codigosDuplicados.length > 0) {
        const codigosUnicos = [...new Set(codigosDuplicados)]
        notify(`Aviso: Códigos duplicados no arquivo: ${codigosUnicos.join(', ')}. Apenas o primeiro será criado.`, 'warning')
      }

      // Verificar códigos já existentes no catálogo
      const codigosExistentes = new Set<string>()
      for (const item of uploadMassPreview) {
        if (!item.codigo) continue

        // Verificar se já existe no catálogo
        const { data: itemExistente } = await supabase
          .from('itens_catalogo')
          .select('id, codigo')
          .eq('codigo', item.codigo)
          .single()

        if (itemExistente) {
          codigosExistentes.add(item.codigo)
          continue // Pular itens que já existem
        }

        // Criar item
        try {
          const itemData: Omit<ItemCatalogo, 'id' | 'criado_em' | 'atualizado_em'> = {
            codigo: item.codigo!,
            nome: item.nome!,
            descricao: item.descricao || undefined,
            categoria: item.categoria!,
            subcategoria: item.subcategoria || undefined,
            unidade_medida: item.unidade_medida!,
            valor_unitario: item.valor_unitario || undefined,
            fornecedor: item.fornecedor || undefined,
            // validade removida
            observacoes: item.observacoes || undefined,
            requer_certificacao: item.requer_certificacao || false,
            requer_laudo: item.requer_laudo || false,
            requer_rastreabilidade: item.requer_rastreabilidade || false,
            requer_ca: item.requer_ca || false,
            NCM: item.NCM || undefined,
            ativo: item.ativo !== undefined ? item.ativo : true
          }

          await catalogoService.criarItemCatalogo(itemData)
          sucesso++
        } catch (error) {
          erros++
          errosDetalhes.push(`Código ${item.codigo}: ${error instanceof Error ? error.message : 'Erro desconhecido'}`)
        }
      }

      // Invalidar queries para atualizar a interface
      queryClient.invalidateQueries({ queryKey: ['itens-catalogo'] })

      // Mostrar resultado
      if (sucesso > 0) {
        let mensagem = `Upload processado! ${sucesso} item(ns) criado(s) com sucesso.`
        if (codigosExistentes.size > 0) {
          mensagem += ` ${codigosExistentes.size} item(ns) já existiam e foram ignorados.`
        }
        if (erros > 0) {
          mensagem += ` ${erros} erro(s).`
        }
        notify(mensagem, erros > 0 ? 'warning' : 'success')
      } else {
        notify(`Nenhum item foi criado. ${erros} erro(s) encontrado(s).`, 'error')
      }

      if (erros > 0 && errosDetalhes.length > 0) {
        console.error('Erros detalhados:', errosDetalhes)
      }

      // Limpar estados
      setShowUploadMassDialog(false)
      setUploadMassFile(null)
      setUploadMassPreview([])
    } catch (error) {
      console.error('Erro ao processar upload em massa:', error)
      notify('Erro ao processar upload de arquivo', 'error')
    } finally {
      setProcessandoUploadMass(false)
    }
  }

  // Função para processar arquivo de upload
  const handleFileUpload = async (file: File) => {
    try {
      const extension = file.name.split('.').pop()?.toLowerCase()

      if (extension === 'csv') {
        const text = await file.text()
        const lines = text.split('\n').filter(line => line.trim())
        const headers = lines[0].split(',').map(h => h.trim().toLowerCase())

        const codigoIndex = headers.findIndex(h => h === 'codigo' || h === 'código')
        const quantidadeIndex = headers.findIndex(h => h === 'quantidade' || h === 'qtd' || h === 'qty')

        if (codigoIndex === -1 || quantidadeIndex === -1) {
          throw new Error('Arquivo CSV deve conter colunas "codigo" e "quantidade"')
        }

        const data: Array<{ codigo: string; quantidade: number }> = []
        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split(',').map(v => v.trim())
          const codigo = values[codigoIndex]
          const quantidade = parseFloat(values[quantidadeIndex])

          if (codigo && !isNaN(quantidade) && quantidade > 0) {
            data.push({ codigo, quantidade })
          }
        }

        setUploadPreview(data)
      } else if (extension === 'xlsx' || extension === 'xls') {
        const arrayBuffer = await file.arrayBuffer()
        // Configurações para suportar tanto XLSX quanto XLS antigo
        const workbook = XLSX.read(arrayBuffer, {
          type: 'array',
          cellDates: false,
          cellNF: false,
          cellText: false
        })

        if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
          throw new Error('Arquivo Excel não contém planilhas')
        }

        const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
        // Converter para JSON com header na primeira linha
        const jsonData = XLSX.utils.sheet_to_json(firstSheet, {
          defval: '',
          raw: false
        }) as Array<Record<string, unknown>>

        if (jsonData.length === 0) {
          throw new Error('Arquivo Excel está vazio ou não contém dados')
        }

        // Detectar nomes de colunas (case-insensitive e com variações)
        const firstRow = jsonData[0]
        const keys = Object.keys(firstRow)

        // Buscar coluna de código
        const codigoKey = keys.find(k =>
          k.toLowerCase().includes('codigo') ||
          k.toLowerCase().includes('código') ||
          k.toLowerCase() === 'cod' ||
          k.toLowerCase() === 'code'
        )

        // Buscar coluna de quantidade
        const quantidadeKey = keys.find(k =>
          k.toLowerCase().includes('quantidade') ||
          k.toLowerCase() === 'qtd' ||
          k.toLowerCase() === 'qty' ||
          k.toLowerCase() === 'quant' ||
          k.toLowerCase() === 'qtde'
        )

        if (!codigoKey || !quantidadeKey) {
          throw new Error(
            `Arquivo Excel deve conter colunas "codigo" e "quantidade". ` +
            `Colunas encontradas: ${keys.join(', ')}`
          )
        }

        const data: Array<{ codigo: string; quantidade: number }> = []
        for (const row of jsonData) {
          const codigo = String(row[codigoKey] || '').trim()
          const quantidadeStr = String(row[quantidadeKey] || '0').trim().replace(',', '.')
          const quantidade = parseFloat(quantidadeStr)

          if (codigo && !isNaN(quantidade) && quantidade > 0) {
            data.push({ codigo, quantidade })
          }
        }

        if (data.length === 0) {
          throw new Error('Nenhum dado válido encontrado no arquivo. Verifique se as colunas "codigo" e "quantidade" contêm dados válidos.')
        }

        setUploadPreview(data)
      } else {
        throw new Error('Formato de arquivo não suportado. Use CSV ou Excel (.xlsx, .xls)')
      }
    } catch (error) {
      console.error('Erro ao processar arquivo:', error)
      notify(error instanceof Error ? error.message : 'Erro ao processar arquivo', 'error')
      setUploadFile(null)
      setUploadPreview([])
    }
  }

  // Função para processar upload e aumentar estoque (otimizada em lotes)
  const processarUpload = async () => {
    if (!uploadBaseId) {
      notify('Selecione uma base antes de processar', 'error')
      return
    }

    if (!uploadFile || uploadPreview.length === 0) {
      notify('Nenhum arquivo ou dados para processar', 'error')
      return
    }

    if (!user) {
      notify('Usuário não autenticado', 'error')
      return
    }

    setProcessandoUpload(true)

    try {
      let sucesso = 0
      let erros = 0
      const errosDetalhes: string[] = []

      // PASSO 1: Buscar todos os códigos em lotes (para evitar limite de parâmetros)
      const codigos = uploadPreview.map(item => item.codigo).filter(Boolean)
      const mapaCatalogo = new Map<string, string>()
      const batchSize = 100

      if (codigos.length > 0) {
        // Processar em lotes de 100 códigos para evitar limite de parâmetros
        for (let i = 0; i < codigos.length; i += batchSize) {
          const batch = codigos.slice(i, i + batchSize)

          try {
            const { data: itensCatalogo, error: catalogoError } = await supabase
              .from('itens_catalogo')
              .select('id, codigo')
              .in('codigo', batch)
              .eq('ativo', true)

            if (catalogoError) {
              console.error(`Erro ao buscar lote de itens do catálogo ${Math.floor(i / batchSize) + 1}:`, catalogoError)
              // Continuar mesmo se houver erro em um lote
              continue
            }

            // Adicionar ao mapa
            itensCatalogo?.forEach(item => {
              if (item.codigo) {
                mapaCatalogo.set(item.codigo, item.id)
              }
            })
          } catch (error) {
            console.error(`Erro ao processar lote de catálogo ${Math.floor(i / batchSize) + 1}:`, error)
            // Continuar mesmo se houver erro
            continue
          }
        }
      }

      // PASSO 2: Buscar todos os itens de estoque em lotes (para evitar limite de parâmetros)
      const itemCatalogoIds = Array.from(mapaCatalogo.values())
      const mapaEstoque = new Map<string, { id: string; estoque_atual: number; codigo: string }>()

      if (itemCatalogoIds.length > 0) {
        // Processar em lotes de 100 IDs para evitar limite de parâmetros
        for (let i = 0; i < itemCatalogoIds.length; i += batchSize) {
          const batch = itemCatalogoIds.slice(i, i + batchSize)

          try {
            const { data: itensEstoque, error: estoqueError } = await supabase
              .from('itens_estoque')
              .select('id, item_catalogo_id, estoque_atual, codigo')
              .in('item_catalogo_id', batch)
              .eq('base_id', uploadBaseId)
              .eq('status', 'ativo')

            if (estoqueError) {
              console.error(`Erro ao buscar lote de itens de estoque ${Math.floor(i / batchSize) + 1}:`, estoqueError)
              // Continuar mesmo se houver erro em um lote
              continue
            }

            // Adicionar ao mapa
            itensEstoque?.forEach(item => {
              mapaEstoque.set(item.item_catalogo_id, {
                id: item.id,
                estoque_atual: item.estoque_atual || 0,
                codigo: item.codigo || ''
              })
            })
          } catch (error) {
            console.error(`Erro ao processar lote de estoque ${Math.floor(i / batchSize) + 1}:`, error)
            // Continuar mesmo se houver erro
            continue
          }
        }
      }

      // PASSO 3: Preparar todas as movimentações
      const movimentacoes: Array<{
        item_id: string
        tipo: string
        quantidade: number
        quantidade_anterior: number
        quantidade_atual: number
        motivo: string
        usuario_id: string
        base_id: string
        observacoes: string
        criado_em: string
      }> = []

      const dataAtual = new Date().toLocaleString('pt-BR')

      for (const item of uploadPreview) {
        const itemCatalogoId = mapaCatalogo.get(item.codigo)
        if (!itemCatalogoId) {
          erros++
          errosDetalhes.push(`Código ${item.codigo}: Item não encontrado no catálogo`)
          continue
        }

        const itemEstoque = mapaEstoque.get(itemCatalogoId)
        if (!itemEstoque) {
          erros++
          errosDetalhes.push(`Código ${item.codigo}: Item não encontrado no estoque da base selecionada`)
          continue
        }

        const quantidadeAnterior = itemEstoque.estoque_atual
        const quantidadeAtual = quantidadeAnterior + item.quantidade

        movimentacoes.push({
          item_id: itemEstoque.id,
          tipo: 'entrada',
          quantidade: item.quantidade,
          quantidade_anterior: quantidadeAnterior,
          quantidade_atual: quantidadeAtual,
          motivo: 'Entrada por upload de arquivo',
          usuario_id: user.id,
          base_id: uploadBaseId,
          observacoes: `Upload em lote - ${dataAtual}`,
          criado_em: new Date().toISOString()
        })
      }

      // PASSO 4: Inserir movimentações em lotes
      if (movimentacoes.length > 0) {
        const batchSize = 100
        for (let i = 0; i < movimentacoes.length; i += batchSize) {
          const batch = movimentacoes.slice(i, i + batchSize)
          const { error: movError } = await supabase
            .from('movimentacoes_estoque')
            .insert(batch)

          if (movError) {
            console.error(`Erro ao inserir lote ${i / batchSize + 1}:`, movError)
            erros += batch.length
            errosDetalhes.push(`Erro ao processar lote: ${movError.message}`)
          } else {
            sucesso += batch.length
          }
        }
      }

      // Invalidar queries para atualizar a interface
      queryClient.invalidateQueries({ queryKey: ['itens-estoque'] })
      queryClient.invalidateQueries({ queryKey: ['itens-catalogo'] })

      // Mostrar resultado
      if (sucesso > 0) {
        notify(
          `Upload processado! ${sucesso} item(ns) atualizado(s) com sucesso.${erros > 0 ? ` ${erros} erro(s).` : ''}`,
          erros > 0 ? 'warning' : 'success'
        )
      } else {
        notify(`Nenhum item foi atualizado. ${erros} erro(s) encontrado(s).`, 'error')
      }

      if (erros > 0 && errosDetalhes.length > 0) {
        console.error('Erros detalhados:', errosDetalhes)
      }

      // Limpar estados
      setShowUploadDialog(false)
      setUploadFile(null)
      setUploadPreview([])
      setUploadBaseId('')
    } catch (error) {
      console.error('Erro ao processar upload:', error)
      notify('Erro ao processar upload de arquivo', 'error')
    } finally {
      setProcessandoUpload(false)
    }
  }

  // Função para zerar todo o estoque de uma base
  const zerarEstoqueBase = async () => {
    if (!zerarEstoqueBaseId) {
      notify('Selecione uma base', 'error')
      return
    }

    if (!user) {
      notify('Usuário não autenticado', 'error')
      return
    }

    setZerandoEstoque(true)

    try {
      // Buscar todos os itens de estoque da base com estoque > 0
      const { data: itensEstoque, error: fetchError } = await supabase
        .from('itens_estoque')
        .select('id, codigo, nome, estoque_atual')
        .eq('base_id', zerarEstoqueBaseId)
        .eq('status', 'ativo')
        .gt('estoque_atual', 0)

      if (fetchError) {
        throw fetchError
      }

      if (!itensEstoque || itensEstoque.length === 0) {
        notify('Nenhum item com estoque encontrado nesta base', 'warning')
        setShowZerarEstoqueDialog(false)
        setZerarEstoqueBaseId('')
        return
      }

      let sucesso = 0
      let erros = 0
      const errosDetalhes: string[] = []

      // Zerar estoque de cada item usando ajuste para 0
      // Processar em lotes para evitar sobrecarga
      const batchSize = 50
      for (let i = 0; i < itensEstoque.length; i += batchSize) {
        const batch = itensEstoque.slice(i, i + batchSize)

        await Promise.allSettled(
          batch.map(async (item) => {
            try {
              // Tentar usar movimentação primeiro
              try {
                await estoqueService.movimentarEstoque({
                  item_id: item.id,
                  tipo: 'ajuste',
                  quantidade: 0, // Ajuste para zero
                  motivo: 'Zerar estoque da base',
                  usuario_id: user.id,
                  base_id: zerarEstoqueBaseId,
                  observacoes: `Zeramento em lote - ${new Date().toLocaleString('pt-BR')}`
                })

                sucesso++
              } catch {
                // Se a movimentação falhar, tentar atualizar diretamente e registrar movimentação manualmente
                const quantidadeAnterior = item.estoque_atual || 0

                if (quantidadeAnterior > 0) {
                  // Atualizar estoque diretamente
                  const { error: updateError } = await supabase
                    .from('itens_estoque')
                    .update({
                      estoque_atual: 0,
                      atualizado_em: new Date().toISOString()
                    })
                    .eq('id', item.id)
                    .eq('base_id', zerarEstoqueBaseId)

                  if (updateError) {
                    throw updateError
                  }

                  // Registrar movimentação manualmente
                  const { error: movError2 } = await supabase
                    .from('movimentacoes_estoque')
                    .insert({
                      item_id: item.id,
                      tipo: 'ajuste',
                      quantidade: 0,
                      quantidade_anterior: quantidadeAnterior,
                      quantidade_atual: 0,
                      motivo: 'Zerar estoque da base',
                      usuario_id: user.id,
                      base_id: zerarEstoqueBaseId,
                      observacoes: `Zeramento em lote - ${new Date().toLocaleString('pt-BR')}`,
                      criado_em: new Date().toISOString()
                    })

                  if (movError2) {
                    console.warn(`Movimentação não registrada para item ${item.id}, mas estoque foi zerado:`, movError2)
                  }

                  sucesso++
                } else {
                  // Item já está zerado
                  sucesso++
                }
              }
            } catch (error) {
              erros++
              // Capturar melhor os detalhes do erro
              let errorMessage = 'Erro desconhecido'

              if (error instanceof Error) {
                errorMessage = error.message
              } else if (typeof error === 'object' && error !== null) {
                // Tentar extrair mensagem de erro do Supabase ou outros objetos
                const errorObj = error as Record<string, unknown>
                errorMessage = (errorObj.message as string) ||
                  ((errorObj.error as Record<string, unknown>)?.message as string) ||
                  (errorObj.details as string) ||
                  (errorObj.hint as string) ||
                  JSON.stringify(error)
              } else if (typeof error === 'string') {
                errorMessage = error
              }

              const itemLabel = item.codigo || item.nome || item.id
              errosDetalhes.push(`${itemLabel}: ${errorMessage}`)
              console.error(`Erro ao zerar estoque do item ${itemLabel} (ID: ${item.id}):`, error)
            }
          })
        )
      }

      // Invalidar queries para atualizar a interface
      queryClient.invalidateQueries({ queryKey: ['itens-estoque'] })
      queryClient.invalidateQueries({ queryKey: ['itens-catalogo'] })

      // Mostrar resultado
      if (sucesso > 0) {
        notify(
          `Estoque zerado! ${sucesso} item(ns) atualizado(s) com sucesso.${erros > 0 ? ` ${erros} erro(s).` : ''}`,
          erros > 0 ? 'warning' : 'success'
        )
      } else {
        notify(`Nenhum item foi atualizado. ${erros} erro(s) encontrado(s).`, 'error')
      }

      if (erros > 0 && errosDetalhes.length > 0) {
        console.error('Erros detalhados:', errosDetalhes)
      }

      // Limpar estados
      setShowZerarEstoqueDialog(false)
      setZerarEstoqueBaseId('')
      setItensComEstoque(0)
    } catch (error) {
      console.error('Erro ao zerar estoque:', error)
      notify('Erro ao zerar estoque da base', 'error')
    } finally {
      setZerandoEstoque(false)
    }
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Catálogo de Itens</h1>
          <p className="text-gray-600">Gerencie os itens do catálogo central</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={exportarExcel}
            disabled={exportando || filteredItens.length === 0}
          >
            {exportando ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Exportando...
              </>
            ) : (
              <>
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Exportar Excel
              </>
            )}
          </Button>
          <Button
            variant="outline"
            onClick={() => { setShowUploadMassDialog(true); setUploadMassFile(null); setUploadMassPreview([]) }}
          >
            <Upload className="h-4 w-4 mr-2" />
            Upload em Massa
          </Button>
          <Button
            variant="outline"
            onClick={() => { setShowUploadDialog(true); setUploadBaseId(''); setUploadFile(null); setUploadPreview([]) }}
            disabled={bases.length === 0}
          >
            <Upload className="h-4 w-4 mr-2" />
            Upload Estoque
          </Button>
          <Button
            variant="outline"
            onClick={() => { setShowZerarEstoqueDialog(true); setZerarEstoqueBaseId(''); setItensComEstoque(0) }}
            disabled={bases.length === 0}
            className="text-red-600 hover:text-red-700 hover:bg-red-50"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Zerar Estoque
          </Button>
          <Button
            variant="outline"
            onClick={() => setShowSyncAllDialog(true)}
            disabled={bases.length === 0}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Sincronizar Todos com Base
          </Button>
          <Button onClick={() => { resetForm(); setShowCreateDialog(true) }}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Item
          </Button>
        </div>
      </div>

      {/* Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">Itens no catálogo</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ativos</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.ativos}</div>
            <p className="text-xs text-muted-foreground">Itens ativos</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">EPI</CardTitle>
            <Package className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.porCategoria.epi}</div>
            <p className="text-xs text-muted-foreground">Itens EPI</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ferramental</CardTitle>
            <Package className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{stats.porCategoria.ferramental}</div>
            <p className="text-xs text-muted-foreground">Itens Ferramental</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Consumível</CardTitle>
            <Package className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{stats.porCategoria.consumivel}</div>
            <p className="text-xs text-muted-foreground">Itens Consumível</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Equipamento</CardTitle>
            <Package className="h-4 w-4 text-indigo-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-indigo-600">{stats.porCategoria.equipamento}</div>
            <p className="text-xs text-muted-foreground">Itens Equipamento</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Requerem Laudo</CardTitle>
            <FileText className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.requeremLaudo}</div>
            <p className="text-xs text-muted-foreground">Itens com laudo</p>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Buscar por código, nome ou descrição..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={selectedCategoria} onValueChange={setSelectedCategoria}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as categorias</SelectItem>
                <SelectItem value="epi">EPI</SelectItem>
                <SelectItem value="ferramental">Ferramental</SelectItem>
                <SelectItem value="consumivel">Consumível</SelectItem>
                <SelectItem value="equipamento">Equipamento</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center space-x-2">
              <Switch
                id="show-inativos"
                checked={showInativos}
                onCheckedChange={setShowInativos}
              />
              <Label htmlFor="show-inativos">Mostrar inativos</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="show-apenas-com-laudo"
                checked={showApenasComLaudo}
                onCheckedChange={setShowApenasComLaudo}
              />
              <Label htmlFor="show-apenas-com-laudo">Apenas com laudo</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="show-apenas-com-ca"
                checked={showApenasComCA}
                onCheckedChange={setShowApenasComCA}
              />
              <Label htmlFor="show-apenas-com-ca">Apenas com CA</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="show-apenas-com-rastreabilidade"
                checked={showApenasComRastreabilidade}
                onCheckedChange={setShowApenasComRastreabilidade}
              />
              <Label htmlFor="show-apenas-com-rastreabilidade">Apenas com rastreabilidade</Label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabela de Itens */}
      <Card>
        <CardHeader>
          <CardTitle>Itens do Catálogo</CardTitle>
          <CardDescription>
            {filteredItens.length} item(ns) encontrado(s)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {itensLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">Carregando itens...</span>
            </div>
          ) : filteredItens.length === 0 ? (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Nenhum item encontrado</AlertTitle>
              <AlertDescription>
                {searchTerm || selectedCategoria !== 'all'
                  ? 'Tente ajustar os filtros de busca'
                  : 'Comece adicionando um novo item ao catálogo'}
              </AlertDescription>
            </Alert>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Unidade</TableHead>
                    <TableHead>Valor Unitário</TableHead>
                    <TableHead>Laudo</TableHead>
                    <TableHead>Rastreab.</TableHead>
                    <TableHead>CA</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredItens.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-mono text-sm">{item.codigo}</TableCell>
                      <TableCell className="font-medium">{item.nome}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{item.categoria}</Badge>
                      </TableCell>
                      <TableCell>{item.unidade_medida}</TableCell>
                      <TableCell>
                        {item.valor_unitario
                          ? formatBrazilianCurrency(item.valor_unitario)
                          : '-'}
                      </TableCell>
                      <TableCell>
                        {item.requer_laudo ? (
                          <Badge variant="destructive" className="text-xs">Sim</Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs">Não</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {item.requer_rastreabilidade ? (
                          <Badge className="text-xs bg-purple-600">Sim</Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs">Não</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {item.requer_ca ? (
                          <Badge className="text-xs bg-amber-600">Sim</Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs">Não</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={item.ativo ? 'default' : 'secondary'}>
                          {item.ativo ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditItem(item)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleLinkItem(item)}
                          >
                            <Link2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleApplyEditions(item)}
                          >
                            <RefreshCw className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteItem(item)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog: Criar Item */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Criar Novo Item no Catálogo</DialogTitle>
            <DialogDescription>
              Adicione um novo item ao catálogo central. Este item poderá ser vinculado às bases posteriormente.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="codigo">Código *</Label>
                <Input
                  id="codigo"
                  value={formData.codigo}
                  onChange={(e) => setFormData({ ...formData, codigo: e.target.value })}
                  placeholder="Ex: EPI-001"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nome">Nome *</Label>
                <Input
                  id="nome"
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  placeholder="Nome do item"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="descricao">Descrição</Label>
              <Textarea
                id="descricao"
                value={formData.descricao}
                onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                placeholder="Descrição detalhada do item"
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="categoria">Categoria *</Label>
                <Select
                  value={formData.categoria}
                  onValueChange={(value) => setFormData({ ...formData, categoria: value as ItemCatalogo['categoria'] })}
                >
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
                <Label htmlFor="subcategoria">Subcategoria</Label>
                <Input
                  id="subcategoria"
                  value={formData.subcategoria}
                  onChange={(e) => setFormData({ ...formData, subcategoria: e.target.value })}
                  placeholder="Ex: Proteção Auditiva"
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="unidade_medida">Unidade de Medida *</Label>
                <Select
                  value={formData.unidade_medida}
                  onValueChange={(value) => setFormData({ ...formData, unidade_medida: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {UNIDADES_MEDIDA.map(unidade => (
                      <SelectItem key={unidade.value} value={unidade.value}>{unidade.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="valor_unitario">Valor Unitário</Label>
                <Input
                  id="valor_unitario"
                  type="number"
                  step="0.01"
                  value={formData.valor_unitario}
                  onChange={(e) => setFormData({ ...formData, valor_unitario: parseFloat(e.target.value) || 0 })}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="NCM">NCM</Label>
                <Input
                  id="NCM"
                  type="number"
                  value={formData.NCM}
                  onChange={(e) => setFormData({ ...formData, NCM: parseInt(e.target.value) || 0 })}
                  placeholder="Código NCM"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-2">
                <Label htmlFor="fornecedor">Fornecedor</Label>
                <Input
                  id="fornecedor"
                  value={formData.fornecedor}
                  onChange={(e) => setFormData({ ...formData, fornecedor: e.target.value })}
                  placeholder="Nome do fornecedor"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="observacoes">Observações</Label>
              <Textarea
                id="observacoes"
                value={formData.observacoes}
                onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                placeholder="Observações adicionais"
                rows={2}
              />
            </div>
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center space-x-2">
                <Switch
                  id="requer_certificacao"
                  checked={formData.requer_certificacao}
                  onCheckedChange={(checked) => setFormData({ ...formData, requer_certificacao: checked })}
                />
                <Label htmlFor="requer_certificacao">Requer Certificação</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="requer_laudo"
                  checked={formData.requer_laudo}
                  onCheckedChange={(checked) => setFormData({ ...formData, requer_laudo: checked })}
                />
                <Label htmlFor="requer_laudo">Requer Laudo</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="requer_rastreabilidade"
                  checked={formData.requer_rastreabilidade}
                  onCheckedChange={(checked) => setFormData({ ...formData, requer_rastreabilidade: checked })}
                />
                <Label htmlFor="requer_rastreabilidade">Requer Rastreabilidade</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="requer_ca"
                  checked={formData.requer_ca}
                  onCheckedChange={(checked) => setFormData({ ...formData, requer_ca: checked })}
                />
                <Label htmlFor="requer_ca">Requer CA</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="ativo"
                  checked={formData.ativo}
                  onCheckedChange={(checked) => setFormData({ ...formData, ativo: checked })}
                />
                <Label htmlFor="ativo">Ativo</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowCreateDialog(false); resetForm() }}>
              Cancelar
            </Button>
            <Button
              onClick={handleCreateItem}
              disabled={createItemMutation.isPending}
            >
              {createItemMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Criando...
                </>
              ) : (
                'Criar Item'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Editar Item */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Item do Catálogo</DialogTitle>
            <DialogDescription>
              Edite as informações do item. Use &quot;Aplicar às Bases&quot; para sincronizar mudanças.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Mesmo formulário do criar, mas com dados preenchidos */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-codigo">Código *</Label>
                <Input
                  id="edit-codigo"
                  value={formData.codigo}
                  onChange={(e) => setFormData({ ...formData, codigo: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-nome">Nome *</Label>
                <Input
                  id="edit-nome"
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-descricao">Descrição</Label>
              <Textarea
                id="edit-descricao"
                value={formData.descricao}
                onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-categoria">Categoria *</Label>
                <Select
                  value={formData.categoria}
                  onValueChange={(value) => setFormData({ ...formData, categoria: value as ItemCatalogo['categoria'] })}
                >
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
                <Label htmlFor="edit-subcategoria">Subcategoria</Label>
                <Input
                  id="edit-subcategoria"
                  value={formData.subcategoria}
                  onChange={(e) => setFormData({ ...formData, subcategoria: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-unidade_medida">Unidade de Medida *</Label>
                <Select
                  value={formData.unidade_medida}
                  onValueChange={(value) => setFormData({ ...formData, unidade_medida: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {UNIDADES_MEDIDA.map(unidade => (
                      <SelectItem key={unidade.value} value={unidade.value}>{unidade.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-valor_unitario">Valor Unitário</Label>
                <Input
                  id="edit-valor_unitario"
                  type="number"
                  step="0.01"
                  value={formData.valor_unitario}
                  onChange={(e) => setFormData({ ...formData, valor_unitario: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-NCM">NCM</Label>
                <Input
                  id="edit-NCM"
                  type="number"
                  value={formData.NCM}
                  onChange={(e) => setFormData({ ...formData, NCM: parseInt(e.target.value) || 0 })}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-fornecedor">Fornecedor</Label>
                <Input
                  id="edit-fornecedor"
                  value={formData.fornecedor}
                  onChange={(e) => setFormData({ ...formData, fornecedor: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-observacoes">Observações</Label>
              <Textarea
                id="edit-observacoes"
                value={formData.observacoes}
                onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                rows={2}
              />
            </div>
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center space-x-2">
                <Switch
                  id="edit-requer_certificacao"
                  checked={formData.requer_certificacao}
                  onCheckedChange={(checked) => setFormData({ ...formData, requer_certificacao: checked })}
                />
                <Label htmlFor="edit-requer_certificacao">Requer Certificação</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="edit-requer_laudo"
                  checked={formData.requer_laudo}
                  onCheckedChange={(checked) => setFormData({ ...formData, requer_laudo: checked })}
                />
                <Label htmlFor="edit-requer_laudo">Requer Laudo</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="edit-requer_rastreabilidade"
                  checked={formData.requer_rastreabilidade}
                  onCheckedChange={(checked) => setFormData({ ...formData, requer_rastreabilidade: checked })}
                />
                <Label htmlFor="edit-requer_rastreabilidade">Requer Rastreabilidade</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="edit-requer_ca"
                  checked={formData.requer_ca}
                  onCheckedChange={(checked) => setFormData({ ...formData, requer_ca: checked })}
                />
                <Label htmlFor="edit-requer_ca">Requer CA</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="edit-ativo"
                  checked={formData.ativo}
                  onCheckedChange={(checked) => setFormData({ ...formData, ativo: checked })}
                />
                <Label htmlFor="edit-ativo">Ativo</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowEditDialog(false); setSelectedItem(null); resetForm() }}>
              Cancelar
            </Button>
            <Button
              onClick={handleUpdateItem}
              disabled={updateItemMutation.isPending}
            >
              {updateItemMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Atualizando...
                </>
              ) : (
                'Salvar Alterações'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Deletar Item */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir Item do Catálogo</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir este item? Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          {selectedItem && (
            <div className="space-y-2">
              <p className="text-sm text-gray-600">
                <strong>Item:</strong> {selectedItem.nome} ({selectedItem.codigo})
              </p>
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Atenção</AlertTitle>
                <AlertDescription>
                  O item só pode ser excluído se não tiver estoque em nenhuma base.
                  Se houver estoque, você precisará zerar o estoque em todas as bases primeiro.
                </AlertDescription>
              </Alert>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowDeleteDialog(false); setSelectedItem(null) }}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDeleteItem}
              disabled={deleteItemMutation.isPending}
            >
              {deleteItemMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Excluindo...
                </>
              ) : (
                'Excluir Item'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Vincular Item a Bases */}
      <Dialog open={showLinkDialog} onOpenChange={setShowLinkDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Vincular Item a Bases</DialogTitle>
            <DialogDescription>
              Selecione as bases onde este item será vinculado. O item será criado no estoque de cada base selecionada.
            </DialogDescription>
          </DialogHeader>
          {selectedItem && (
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg">
                <p className="font-medium">{selectedItem.nome}</p>
                <p className="text-sm text-muted-foreground">Código: {selectedItem.codigo}</p>
              </div>

              {basesComItem.length > 0 && (
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertTitle>Bases já vinculadas</AlertTitle>
                  <AlertDescription>
                    Este item já está vinculado às seguintes bases: {basesComItem.map(b => b.base_nome).join(', ')}
                  </AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label>Selecione as bases</Label>
                <div className="border rounded-lg p-4 max-h-[300px] overflow-y-auto space-y-2">
                  {bases.map((base) => {
                    const jaVinculada = basesComItem.some(b => b.base_id === base.id)
                    return (
                      <div key={base.id} className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id={`base-${base.id}`}
                          checked={selectedBases.includes(base.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedBases([...selectedBases, base.id])
                            } else {
                              setSelectedBases(selectedBases.filter(id => id !== base.id))
                            }
                          }}
                          disabled={jaVinculada}
                          className="rounded"
                        />
                        <Label
                          htmlFor={`base-${base.id}`}
                          className={`flex-1 cursor-pointer ${jaVinculada ? 'text-muted-foreground' : ''}`}
                        >
                          {base.nome}
                          {base.codigo && ` (${base.codigo})`}
                          {jaVinculada && <Badge variant="outline" className="ml-2">Já vinculada</Badge>}
                        </Label>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowLinkDialog(false); setSelectedItem(null); setSelectedBases([]) }}>
              Cancelar
            </Button>
            <Button
              onClick={handleLinkToBases}
              disabled={linkItemMutation.isPending || selectedBases.length === 0}
            >
              {linkItemMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Vinculando...
                </>
              ) : (
                <>
                  <Link2 className="mr-2 h-4 w-4" />
                  Vincular a {selectedBases.length} base(s)
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Aplicar Edições às Bases */}
      <Dialog open={showApplyDialog} onOpenChange={setShowApplyDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Aplicar Edições às Bases</DialogTitle>
            <DialogDescription>
              Sincronize as alterações do catálogo para todas as bases que têm este item vinculado.
            </DialogDescription>
          </DialogHeader>
          {selectedItem && (
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg">
                <p className="font-medium">{selectedItem.nome}</p>
                <p className="text-sm text-muted-foreground">Código: {selectedItem.codigo}</p>
              </div>

              {basesComItem.length > 0 ? (
                <>
                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertTitle>Bases que serão atualizadas</AlertTitle>
                    <AlertDescription>
                      As seguintes bases têm este item vinculado e serão atualizadas:
                    </AlertDescription>
                  </Alert>
                  <div className="space-y-2">
                    {basesComItem.map((base) => (
                      <div key={base.base_id} className="flex items-center justify-between p-2 bg-muted rounded">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4" />
                          <span>{base.base_nome}</span>
                        </div>
                        <Badge variant="outline">Estoque: {base.estoque_atual}</Badge>
                      </div>
                    ))}
                  </div>
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Campos que serão sincronizados</AlertTitle>
                    <AlertDescription>
                      Código, Nome, Categoria, Unidade de Medida, NCM e Requerimento de Laudo serão atualizados em todas as bases.
                    </AlertDescription>
                  </Alert>
                </>
              ) : (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Nenhuma base vinculada</AlertTitle>
                  <AlertDescription>
                    Este item não está vinculado a nenhuma base. Vincule o item a uma base primeiro.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowApplyDialog(false); setSelectedItem(null) }}>
              Cancelar
            </Button>
            <Button
              onClick={confirmApplyEditions}
              disabled={applyEditionsMutation.isPending || basesComItem.length === 0}
            >
              {applyEditionsMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Aplicando...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Aplicar a {basesComItem.length} base(s)
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Sincronizar Todos os Itens com Base */}
      <Dialog open={showSyncAllDialog} onOpenChange={setShowSyncAllDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Sincronizar Todos os Itens do Catálogo com Base</DialogTitle>
            <DialogDescription>
              Esta ação irá vincular todos os itens ativos do catálogo às bases selecionadas.
              Itens que já estão vinculados serão ignorados.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Alert>
              <Info className="h-4 w-4" />
              <AlertTitle>Informação</AlertTitle>
              <AlertDescription>
                Esta operação irá criar registros de estoque para todos os itens ativos do catálogo
                que ainda não estão vinculados às bases selecionadas. Os itens serão criados com estoque zero.
              </AlertDescription>
            </Alert>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="base-sync">Selecione as Bases</Label>
                {bases.length > 0 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (selectedBaseSync.length === bases.length) {
                        setSelectedBaseSync([])
                      } else {
                        setSelectedBaseSync(bases.map(b => b.id))
                      }
                    }}
                    className="h-auto py-1 px-2 text-xs"
                  >
                    {selectedBaseSync.length === bases.length ? 'Desmarcar todas' : 'Selecionar todas'}
                  </Button>
                )}
              </div>

              {bases.length === 0 ? (
                <p className="text-sm text-gray-500">Nenhuma base disponível</p>
              ) : (
                <div className="border rounded-lg max-h-[300px] overflow-y-auto p-3 space-y-2">
                  {bases.map((base) => (
                    <div key={base.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`base-${base.id}`}
                        checked={selectedBaseSync.includes(base.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedBaseSync([...selectedBaseSync, base.id])
                          } else {
                            setSelectedBaseSync(selectedBaseSync.filter(id => id !== base.id))
                          }
                        }}
                      />
                      <Label
                        htmlFor={`base-${base.id}`}
                        className="text-sm font-normal cursor-pointer flex-1"
                      >
                        {base.nome}
                        {base.codigo && <span className="text-gray-500"> ({base.codigo})</span>}
                      </Label>
                    </div>
                  ))}
                </div>
              )}

              {bases.length > 0 && (
                <p className="text-xs text-gray-500">
                  {selectedBaseSync.length > 0
                    ? `${selectedBaseSync.length} de ${bases.length} base(s) selecionada(s)`
                    : `${bases.length} base(s) disponível(is) para sincronização`
                  }
                </p>
              )}
            </div>

            {selectedBaseSync.length > 0 && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Atenção</AlertTitle>
                <AlertDescription>
                  Você está prestes a sincronizar todos os {stats.ativos} itens ativos do catálogo
                  com {selectedBaseSync.length} base(s) selecionada(s). Esta operação pode levar alguns instantes.
                </AlertDescription>
              </Alert>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowSyncAllDialog(false)
                setSelectedBaseSync([])
              }}
            >
              Cancelar
            </Button>
            <Button
              onClick={() => {
                if (selectedBaseSync.length === 0) {
                  notify('Selecione pelo menos uma base', 'error')
                  return
                }
                syncAllItemsMutation.mutate(selectedBaseSync)
              }}
              disabled={syncAllItemsMutation.isPending || selectedBaseSync.length === 0}
            >
              {syncAllItemsMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sincronizando...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Sincronizar Todos os Itens
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Upload de Estoque */}
      <Dialog open={showUploadDialog} onOpenChange={(open) => {
        setShowUploadDialog(open)
        if (!open) {
          setUploadFile(null)
          setUploadPreview([])
          setUploadBaseId('')
        }
      }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Upload de Estoque em Lote</DialogTitle>
            <DialogDescription>
              Faça upload de um arquivo CSV ou Excel com código e quantidade dos itens para aumentar o estoque na base selecionada.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Alert>
              <Info className="h-4 w-4" />
              <AlertTitle>Formato do arquivo</AlertTitle>
              <AlertDescription>
                O arquivo deve conter colunas: <strong>codigo</strong> e <strong>quantidade</strong>.
                Formatos suportados: CSV (.csv) ou Excel (.xlsx, .xls)
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label htmlFor="upload-base">Selecione a Base *</Label>
              <Select value={uploadBaseId} onValueChange={setUploadBaseId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma base" />
                </SelectTrigger>
                <SelectContent>
                  {bases.map((base) => (
                    <SelectItem key={base.id} value={base.id}>
                      {base.nome}
                      {base.codigo && ` (${base.codigo})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="upload-file">Arquivo *</Label>
              <Input
                id="upload-file"
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={async (e) => {
                  const file = e.target.files?.[0]
                  if (file) {
                    setUploadFile(file)
                    await handleFileUpload(file)
                  }
                }}
                disabled={processandoUpload}
              />
              <p className="text-xs text-gray-500">
                Formatos aceitos: CSV, Excel (.xlsx, .xls). O arquivo deve conter colunas: <strong>codigo</strong> e <strong>quantidade</strong>
              </p>
            </div>

            {uploadPreview.length > 0 && (
              <div className="space-y-2">
                <Label>Preview dos dados ({uploadPreview.length} item(ns))</Label>
                <div className="border rounded-lg max-h-[300px] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Código</TableHead>
                        <TableHead>Quantidade</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {uploadPreview.slice(0, 50).map((item, index) => (
                        <TableRow key={index}>
                          <TableCell className="font-mono text-sm">{item.codigo}</TableCell>
                          <TableCell>{item.quantidade}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {uploadPreview.length > 50 && (
                    <div className="p-2 text-sm text-gray-500 text-center">
                      ... e mais {uploadPreview.length - 50} item(ns)
                    </div>
                  )}
                </div>
              </div>
            )}

            {!uploadBaseId && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Atenção</AlertTitle>
                <AlertDescription>
                  Selecione uma base antes de fazer o upload do arquivo.
                </AlertDescription>
              </Alert>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowUploadDialog(false)
                setUploadFile(null)
                setUploadPreview([])
                setUploadBaseId('')
              }}
              disabled={processandoUpload}
            >
              Cancelar
            </Button>
            <Button
              onClick={processarUpload}
              disabled={processandoUpload || !uploadBaseId || !uploadFile || uploadPreview.length === 0}
            >
              {processandoUpload ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processando...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Processar Upload ({uploadPreview.length} item(ns))
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Upload em Massa de Criação de Itens */}
      <Dialog open={showUploadMassDialog} onOpenChange={(open) => {
        setShowUploadMassDialog(open)
        if (!open) {
          setUploadMassFile(null)
          setUploadMassPreview([])
        }
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Upload em Massa - Criar Itens no Catálogo</DialogTitle>
            <DialogDescription>
              Faça upload de um arquivo CSV ou Excel com os dados dos itens para criar múltiplos itens no catálogo de uma vez.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Alert>
              <Info className="h-4 w-4" />
              <AlertTitle>Formato do arquivo</AlertTitle>
              <AlertDescription>
                O arquivo deve conter as seguintes colunas obrigatórias: <strong>codigo</strong>, <strong>nome</strong>, <strong>categoria</strong>, <strong>unidade_medida</strong>.
                <br />
                Colunas opcionais: descricao, subcategoria, valor_unitario, fornecedor, validade, NCM, observacoes, requer_certificacao, requer_laudo.
                <br />
                Formatos suportados: CSV (.csv) ou Excel (.xlsx, .xls)
                <br />
                <strong>Categorias válidas:</strong> epi, ferramental, consumivel, equipamento
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label htmlFor="upload-mass-file">Arquivo *</Label>
              <Input
                id="upload-mass-file"
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={async (e) => {
                  const file = e.target.files?.[0]
                  if (file) {
                    setUploadMassFile(file)
                    await handleMassFileUpload(file)
                  }
                }}
                disabled={processandoUploadMass}
              />
              <p className="text-xs text-gray-500">
                Formatos aceitos: CSV, Excel (.xlsx, .xls). O arquivo deve conter colunas obrigatórias: codigo, nome, categoria, unidade_medida
              </p>
            </div>

            {uploadMassPreview.length > 0 && (
              <div className="space-y-2">
                <Label>Preview dos dados ({uploadMassPreview.length} item(ns))</Label>
                <div className="border rounded-lg max-h-[400px] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Código</TableHead>
                        <TableHead>Nome</TableHead>
                        <TableHead>Categoria</TableHead>
                        <TableHead>Unidade</TableHead>
                        <TableHead>Valor Unit.</TableHead>
                        <TableHead>Requer Laudo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {uploadMassPreview.slice(0, 50).map((item, index) => (
                        <TableRow key={index}>
                          <TableCell className="font-mono text-sm">{item.codigo}</TableCell>
                          <TableCell className="max-w-[200px] truncate">{item.nome}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{item.categoria}</Badge>
                          </TableCell>
                          <TableCell>{item.unidade_medida}</TableCell>
                          <TableCell>
                            {item.valor_unitario ? formatBrazilianCurrency(item.valor_unitario) : '-'}
                          </TableCell>
                          <TableCell>
                            {item.requer_laudo ? (
                              <Badge variant="destructive" className="text-xs">Sim</Badge>
                            ) : (
                              <Badge variant="outline" className="text-xs">Não</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {uploadMassPreview.length > 50 && (
                    <div className="p-2 text-sm text-gray-500 text-center">
                      ... e mais {uploadMassPreview.length - 50} item(ns)
                    </div>
                  )}
                </div>
              </div>
            )}

            {uploadMassPreview.length > 0 && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Atenção</AlertTitle>
                <AlertDescription>
                  Você está prestes a criar {uploadMassPreview.length} item(ns) no catálogo.
                  Itens com códigos já existentes serão ignorados. Esta operação pode levar alguns instantes.
                </AlertDescription>
              </Alert>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowUploadMassDialog(false)
                setUploadMassFile(null)
                setUploadMassPreview([])
              }}
              disabled={processandoUploadMass}
            >
              Cancelar
            </Button>
            <Button
              onClick={processarUploadMass}
              disabled={processandoUploadMass || !uploadMassFile || uploadMassPreview.length === 0}
            >
              {processandoUploadMass ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processando...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Criar {uploadMassPreview.length} Item(ns)
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Zerar Estoque da Base */}
      <Dialog open={showZerarEstoqueDialog} onOpenChange={(open) => {
        setShowZerarEstoqueDialog(open)
        if (!open) {
          setZerarEstoqueBaseId('')
          setItensComEstoque(0)
        }
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-red-600">Zerar Estoque da Base</DialogTitle>
            <DialogDescription>
              Esta ação irá zerar o estoque de todos os itens da base selecionada. Esta operação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Atenção - Operação Irreversível</AlertTitle>
              <AlertDescription>
                Esta ação irá zerar o estoque de <strong>todos os itens</strong> da base selecionada.
                Todas as movimentações serão registradas no histórico, mas o estoque será zerado.
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label htmlFor="zerar-base">Selecione a Base *</Label>
              <Select
                value={zerarEstoqueBaseId}
                onValueChange={(value) => {
                  setZerarEstoqueBaseId(value)
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma base" />
                </SelectTrigger>
                <SelectContent>
                  {bases.map((base) => (
                    <SelectItem key={base.id} value={base.id}>
                      {base.nome}
                      {base.codigo && ` (${base.codigo})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {zerarEstoqueBaseId && (
              <>
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertTitle>Informação</AlertTitle>
                  <AlertDescription>
                    {itensComEstoque > 0 ? (
                      <>
                        Esta base possui <strong>{itensComEstoque} item(ns)</strong> com estoque maior que zero que serão zerados.
                      </>
                    ) : (
                      <>
                        Verificando quantidade de itens com estoque...
                      </>
                    )}
                  </AlertDescription>
                </Alert>

                {itensComEstoque === 0 && zerarEstoqueBaseId && (
                  <Alert>
                    <CheckCircle2 className="h-4 w-4" />
                    <AlertTitle>Nenhum item com estoque</AlertTitle>
                    <AlertDescription>
                      Esta base não possui itens com estoque maior que zero.
                    </AlertDescription>
                  </Alert>
                )}
              </>
            )}

            {zerarEstoqueBaseId && itensComEstoque > 0 && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Confirmação Necessária</AlertTitle>
                <AlertDescription>
                  Você está prestes a zerar o estoque de <strong>{itensComEstoque} item(ns)</strong> da base selecionada.
                  Esta ação registrará movimentações de ajuste para cada item, mas não pode ser desfeita.
                </AlertDescription>
              </Alert>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowZerarEstoqueDialog(false)
                setZerarEstoqueBaseId('')
                setItensComEstoque(0)
              }}
              disabled={zerandoEstoque}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={zerarEstoqueBase}
              disabled={zerandoEstoque || !zerarEstoqueBaseId || itensComEstoque === 0}
            >
              {zerandoEstoque ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Zerando...
                </>
              ) : (
                <>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Zerar Estoque ({itensComEstoque} item(ns))
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

