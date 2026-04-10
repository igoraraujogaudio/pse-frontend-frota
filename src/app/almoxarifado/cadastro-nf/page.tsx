'use client'

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { useNotification } from '@/contexts/NotificationContext'
import { useUnifiedPermissions } from '@/hooks/useUnifiedPermissions'
import { useWebAlmoxarifadoPermissions } from '@/hooks/useWebAlmoxarifadoPermissions'
import { estoqueService } from '@/services/estoqueService'
import { ItemEstoque, NotaFiscal, ItemNotaFiscal } from '@/types'
import type { UsuarioContrato } from '@/types/contratos'
import { parseBrazilianCurrency, formatBrazilianCurrency, isValidCurrency } from '@/utils/currencyUtils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { FileText, Plus, Trash2, Edit, Package, DollarSign, Hash, Loader2 } from 'lucide-react'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { supabase } from '@/lib/supabase'
import { baseService } from '@/services/baseService'
import type { Base } from '@/types'
import { validateAndFormatCNPJ } from '@/utils/cnpj'

interface ItemNF {
  item_id?: string
  codigo_item?: string
  descricao: string
  quantidade: number
  valor_unitario: number
  valor_total: number
  unidade: string
  observacoes?: string
  item?: ItemEstoque
  estoque_atual?: number // Estoque do item quando foi adicionado
}

export default function CadastroNFPage() {
  const router = useRouter()
  const { user } = useAuth()
  const { notify } = useNotification()
  const { userContratos, loading: loadingPermissions } = useUnifiedPermissions()
  const { canRegisterNF, loading: loadingModularPermissions, permissionsLoaded } = useWebAlmoxarifadoPermissions()
  
  // Ref para evitar notificações duplicadas
  const hasShownPermissionError = useRef(false)

  // Tipo de entrada
  const [tipoEntrada, setTipoEntrada] = useState<'nota_fiscal' | 'transferencia'>('nota_fiscal')
  
  // Dados da NF
  const [numero, setNumero] = useState('')
  const [serie, setSerie] = useState('')
  const [numeroPedido, setNumeroPedido] = useState('')
  const [fornecedor, setFornecedor] = useState('')
  const [cnpjFornecedor, setCnpjFornecedor] = useState('')
  const [dataEmissao, setDataEmissao] = useState('')
  const [dataRecebimento, setDataRecebimento] = useState(new Date().toISOString().split('T')[0])
  const [observacoes, setObservacoes] = useState('')
  
  // Dados da Transferência
  const [baseOrigemId, setBaseOrigemId] = useState<string>('')
  const [numeroTransferencia, setNumeroTransferencia] = useState<string>('')

  // Itens da NF
  const [itensNF, setItensNF] = useState<ItemNF[]>([])
  const [showItemModal, setShowItemModal] = useState(false)
  const [editingItemIndex, setEditingItemIndex] = useState<number | null>(null)

  // Item sendo editado
  const [itemDescricao, setItemDescricao] = useState('')
  const [itemCodigo, setItemCodigo] = useState('')
  const [itemQuantidade, setItemQuantidade] = useState('')
  const [itemValorUnitario, setItemValorUnitario] = useState('')
  const [itemUnidade, setItemUnidade] = useState('UN')
  const [itemObservacoes, setItemObservacoes] = useState('')
  const [selectedItem, setSelectedItem] = useState<ItemEstoque | null>(null)

  // Estados
  const [loading, setLoading] = useState(false)
  const [itensEstoque, setItensEstoque] = useState<ItemEstoque[]>([])
  const [showCreateItemModal, setShowCreateItemModal] = useState(false)
  const [uploadingFile, setUploadingFile] = useState(false)
  const [nfFile, setNfFile] = useState<File | null>(null)
  const [nfFileUrl, setNfFileUrl] = useState<string>('')
  const [bases, setBases] = useState<Base[]>([])
  const [baseSelecionada, setBaseSelecionada] = useState<string>('')
  const [contratoId, setContratoId] = useState<string>('')
  const [cnpjError, setCnpjError] = useState<string>('')

  // Estados do formulário de criação de item
  const [newItemForm, setNewItemForm] = useState({
    codigo: '',
    nome: '',
    categoria: 'epi' as 'epi' | 'ferramental' | 'consumivel' | 'equipamento',
    subcategoria: '',
    descricao: '',
    unidade_medida: 'UN',
    valor_unitario: 0,
    estoque_atual: 0,
    estoque_minimo: 0,
    fornecedor: '',
    localizacao: '',
    validade: '',
    observacoes: '',
    requer_certificacao: false,
    requer_laudo: false,
    NCM: '',
    base_id: '',
    status: 'ativo' as const
  })

  const handleCnpjChange = (value: string) => {
    const result = validateAndFormatCNPJ(value)
    setCnpjFornecedor(result.formatted)
    setCnpjError(result.error)
  }

  // Filtrar bases permitidas para o usuário (por contrato)
  const basesPermitidas = useMemo(() => {
    // Se não há bases carregadas, retornar vazio
    if (!bases.length) {
      return []
    }
    
    // Se ainda está carregando permissões, retornar vazio para evitar mostrar bases não autorizadas
    if (loadingPermissions) {
      return []
    }
    
    // Admin e diretor têm acesso a todas as bases
    if (user && ['admin', 'diretor'].includes(user.nivel_acesso)) {
      console.log('ℹ️ Usuário admin/diretor - acesso total às bases')
      return bases
    }
    
    // Obter IDs dos contratos que o usuário tem acesso
    const userContratoIds = userContratos
      .filter((uc: UsuarioContrato) => uc.ativo && (!uc.data_fim || new Date(uc.data_fim) >= new Date()))
      .map((uc: UsuarioContrato) => uc.contrato_id)
    
    // Filtrar bases dos contratos do usuário
    const basesPorContrato = bases.filter(base => 
      base.contrato_id && userContratoIds.includes(base.contrato_id)
    )
    
    console.log('🔍 Bases filtradas por contrato:', {
      totalBases: bases.length,
      userContratoIds,
      basesPorContrato: basesPorContrato.length
    })
    
    return basesPorContrato
  }, [bases, userContratos, loadingPermissions, user])

  const loadItensEstoque = useCallback(async () => {
    // Só carregar itens se houver base selecionada
    if (!baseSelecionada) {
      setItensEstoque([])
      return
    }

    try {
      // Carregar itens apenas da base selecionada
      const itens = await estoqueService.getItensPorCategoria('epi', baseSelecionada)
      const ferramental = await estoqueService.getItensPorCategoria('ferramental', baseSelecionada)
      const consumivel = await estoqueService.getItensPorCategoria('consumivel', baseSelecionada)
      const equipamento = await estoqueService.getItensPorCategoria('equipamento', baseSelecionada)

      const todosItens = [...itens, ...ferramental, ...consumivel, ...equipamento]
        .sort((a, b) => a.nome.localeCompare(b.nome))

      setItensEstoque(todosItens)
    } catch (error) {
      console.error('Erro ao carregar itens:', error)
      notify('Erro ao carregar itens do estoque', 'error')
    }
  }, [notify, baseSelecionada])

  // Verificar permissões e carregar bases
  useEffect(() => {
    if (!user) {
      router.push('/login')
      return
    }

    // Aguardar carregamento das permissões modulares antes de verificar
    if (loadingModularPermissions || !permissionsLoaded) {
      console.log('⏳ Aguardando carregamento de permissões modulares...', {
        loadingModularPermissions,
        permissionsLoaded
      })
      return
    }

    const hasPermission = canRegisterNF()
    
    console.log('🔍 Verificação de permissão CADASTRAR_NF_WEB:', {
      userId: user.id,
      nivelAcesso: user.nivel_acesso,
      hasPermission,
      permissionsLoaded
    })
    
    if (!hasPermission) {
      // Evitar notificações duplicadas
      if (!hasShownPermissionError.current) {
        hasShownPermissionError.current = true
        console.warn('❌ Acesso negado - usuário não tem permissão CADASTRAR_NF_WEB')
        // Usar setTimeout para evitar loop infinito
        setTimeout(() => {
          notify('Acesso negado. Você não tem permissão para cadastrar notas fiscais.', 'error')
          router.push('/dashboard')
        }, 0)
      }
      return
    }
    
    // Resetar flag se tiver permissão
    hasShownPermissionError.current = false
    
    // Carregar bases
    const carregarBases = async () => {
      try {
        const basesData = await baseService.getBasesAtivas()
        setBases(basesData)
      } catch (error) {
        console.error('Erro ao carregar bases:', error)
      }
    }
    
    carregarBases()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, router, loadingModularPermissions, permissionsLoaded])

  // Selecionar primeira base permitida quando basesPermitidas mudar
  useEffect(() => {
    if (!baseSelecionada && basesPermitidas.length > 0) {
      setBaseSelecionada(basesPermitidas[0].id)
      setContratoId(basesPermitidas[0].contrato_id || '')
    }
  }, [basesPermitidas, baseSelecionada])

  // Carregar itens quando base selecionada mudar
  useEffect(() => {
    if (baseSelecionada) {
      loadItensEstoque()
    }
  }, [baseSelecionada, loadItensEstoque])

  const resetItemForm = () => {
    setItemDescricao('')
    setItemCodigo('')
    setItemQuantidade('')
    setItemValorUnitario('')
    setItemUnidade('UN')
    setItemObservacoes('')
    setSelectedItem(null)
  }

  const resetForm = () => {
    // Limpar tipo de entrada
    setTipoEntrada('nota_fiscal')
    
    // Limpar dados da NF
    setNumero('')
    setSerie('')
    setNumeroPedido('')
    setFornecedor('')
    setCnpjFornecedor('')
    setDataEmissao('')
    setDataRecebimento(new Date().toISOString().split('T')[0])
    setObservacoes('')
    
    // Limpar dados da Transferência
    setBaseOrigemId('')
    setNumeroTransferencia('')
    
    // Limpar itens
    setItensNF([])
    resetItemForm()
    
    // Limpar arquivo
    setNfFile(null)
    setNfFileUrl('')
    setCnpjError('')
  }

  const handleAddItem = () => {
    if (!itemDescricao || !itemQuantidade || !itemValorUnitario) {
      notify('Preencha todos os campos obrigatórios', 'error')
      return
    }

    // Verificar se o item já existe na lista (por código ou nome)
    const itemJaExiste = itensNF.some(item => 
      (item.codigo_item && itemCodigo && item.codigo_item === itemCodigo) ||
      (item.descricao && itemDescricao && item.descricao.toLowerCase() === itemDescricao.toLowerCase())
    )

    if (itemJaExiste) {
      notify('Este item já foi adicionado à lista. Não é possível duplicar itens.', 'error')
      return
    }

    const quantidade = parseInt(itemQuantidade)
    const valorUnitario = parseBrazilianCurrency(itemValorUnitario)
    const valorTotal = quantidade * valorUnitario

    const novoItem: ItemNF = {
      item_id: selectedItem?.id,
      codigo_item: itemCodigo || undefined,
      descricao: itemDescricao,
      quantidade,
      valor_unitario: valorUnitario,
      valor_total: valorTotal,
      unidade: itemUnidade,
      observacoes: itemObservacoes || undefined,
      item: selectedItem || undefined,
      estoque_atual: selectedItem?.estoque_atual
    }

    if (editingItemIndex !== null) {
      const novosItens = [...itensNF]
      novosItens[editingItemIndex] = novoItem
      setItensNF(novosItens)
      setEditingItemIndex(null)
    } else {
      setItensNF([...itensNF, novoItem])
    }

    setShowItemModal(false)
    resetItemForm()
  }

  const handleEditItem = (index: number) => {
    const item = itensNF[index]
    setItemDescricao(item.descricao)
    setItemCodigo(item.codigo_item || '')
    setItemQuantidade(item.quantidade.toString())
    setItemValorUnitario(formatBrazilianCurrency(item.valor_unitario))
    setItemUnidade(item.unidade)
    setItemObservacoes(item.observacoes || '')
    
    // Buscar item atualizado do estoque se tiver item_id
    if (item.item_id) {
      const itemAtualizado = itensEstoque.find(i => i.id === item.item_id)
      if (itemAtualizado) {
        setSelectedItem(itemAtualizado)
      } else {
        setSelectedItem(item.item || null)
      }
    } else {
      setSelectedItem(item.item || null)
    }
    
    setEditingItemIndex(index)
    setShowItemModal(true)
  }

  const handleRemoveItem = (index: number) => {
    const novosItens = itensNF.filter((_, i) => i !== index)
    setItensNF(novosItens)
  }

  const handleCreateNewItem = async () => {
    if (!newItemForm.codigo || !newItemForm.nome) {
      notify('Código e nome são obrigatórios', 'error')
      return
    }

    try {
      setLoading(true)
      
      // Sanitizar dados para garantir valores numéricos válidos
      const sanitizeNumericField = (value: unknown): number => {
        if (typeof value === 'number') return value
        if (typeof value === 'string') {
          const num = parseBrazilianCurrency(value)
          return isNaN(num) ? 0 : num
        }
        return 0
      }
      
      const itemData = {
        ...newItemForm,
        base_id: baseSelecionada,
        valor_unitario: sanitizeNumericField(newItemForm.valor_unitario),
        estoque_atual: sanitizeNumericField(newItemForm.estoque_atual),
        estoque_minimo: sanitizeNumericField(newItemForm.estoque_minimo),
        NCM: newItemForm.NCM && newItemForm.NCM.trim() !== '' ? newItemForm.NCM : undefined,
        subcategoria: newItemForm.subcategoria && newItemForm.subcategoria.trim() !== '' ? newItemForm.subcategoria : undefined,
        localizacao: newItemForm.localizacao && newItemForm.localizacao.trim() !== '' ? newItemForm.localizacao : undefined,
        validade: newItemForm.validade && newItemForm.validade.trim() !== '' ? newItemForm.validade : undefined,
        observacoes: newItemForm.observacoes && newItemForm.observacoes.trim() !== '' ? newItemForm.observacoes : undefined,
        fornecedor: newItemForm.fornecedor && newItemForm.fornecedor.trim() !== '' ? newItemForm.fornecedor : undefined,
        descricao: newItemForm.descricao && newItemForm.descricao.trim() !== '' ? newItemForm.descricao : undefined
      }
      
      console.log('Dados do item a serem enviados:', itemData)
      
      const novoItem = await estoqueService.createItem(itemData)
      notify('Item criado com sucesso', 'success')
      setShowCreateItemModal(false)
      
      // Preencher automaticamente o modal de adicionar item com o novo item criado
      setSelectedItem(novoItem)
      setItemDescricao(novoItem.nome)
      setItemCodigo(novoItem.codigo || '')
      setItemUnidade(novoItem.unidade_medida || 'UN')
      
      // Resetar formulário
      setNewItemForm({
        codigo: '',
        nome: '',
        categoria: 'epi' as 'epi' | 'ferramental' | 'consumivel' | 'equipamento',
        subcategoria: '',
        descricao: '',
        unidade_medida: 'UN',
        valor_unitario: 0,
        estoque_atual: 0,
        estoque_minimo: 0,
        fornecedor: '',
        localizacao: '',
        validade: '',
        observacoes: '',
        requer_certificacao: false,
        requer_laudo: false,
        NCM: '',
        base_id: '',
        status: 'ativo' as const
      })
      
      // Recarregar itens
      await loadItensEstoque()
    } catch (error) {
      console.error('Erro ao criar item:', error)
      notify('Erro ao criar item', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleFileUpload = async (file: File) => {
    try {
      setUploadingFile(true)

      // Validar tipo de arquivo
      const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png']
      if (!allowedTypes.includes(file.type)) {
        throw new Error('Tipo de arquivo não permitido. Use PDF, JPG ou PNG.')
      }

      // Validar tamanho do arquivo (50MB)
      const maxSize = 50 * 1024 * 1024 // 50MB
      if (file.size > maxSize) {
        throw new Error('Arquivo muito grande. Tamanho máximo: 50MB.')
      }
      
      // Gerar nome único para o arquivo
      const fileExt = file.name.split('.').pop()
      const fileName = `nf_${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`
      const filePath = `notas-fiscais/${fileName}`

      console.log('Fazendo upload do arquivo:', { fileName, filePath, fileSize: file.size })

      // Upload para o bucket
      const { error: uploadError } = await supabase.storage
        .from('notas-fiscais')
        .upload(filePath, file)

      if (uploadError) {
        console.error('Erro no upload:', uploadError)
        throw new Error(`Erro no upload: ${uploadError.message}`)
      }

      // Obter URL pública
      const { data: urlData } = supabase.storage
        .from('notas-fiscais')
        .getPublicUrl(filePath)

      setNfFileUrl(urlData.publicUrl)
      setNfFile(file)
      notify('Arquivo enviado com sucesso', 'success')
    } catch (error) {
      console.error('Erro no upload:', error)
      notify(error instanceof Error ? error.message : 'Erro no upload do arquivo', 'error')
    } finally {
      setUploadingFile(false)
    }
  }

  const handleSubmit = async () => {
    if (!dataRecebimento || itensNF.length === 0 || !baseSelecionada) {
      notify('Preencha todos os campos obrigatórios', 'error')
      return
    }

    // Validações específicas por tipo
    if (tipoEntrada === 'nota_fiscal') {
      if (!numero || !fornecedor || !dataEmissao) {
        notify('Preencha todos os campos obrigatórios da Nota Fiscal', 'error')
        return
      }
      // Verificar se CNPJ foi preenchido e é válido
      if (cnpjFornecedor && cnpjError) {
        notify('CNPJ inválido. Corrija antes de continuar.', 'error')
        return
      }
    } else if (tipoEntrada === 'transferencia') {
      if (!baseOrigemId) {
        notify('Selecione a base de origem da transferência', 'error')
        return
      }
    }

    setLoading(true)
    try {
      const itensFormatados: Omit<ItemNotaFiscal, 'id' | 'nota_fiscal_id'>[] = itensNF.map(item => ({
        item_id: item.item_id || undefined,
        codigo_item: item.codigo_item || undefined,
        descricao: item.descricao,
        quantidade: item.quantidade,
        valor_unitario: item.valor_unitario,
        valor_total: item.valor_total,
        unidade: item.unidade,
        observacoes: item.observacoes || undefined
      }))

      if (tipoEntrada === 'nota_fiscal') {
        const notaFiscal: Omit<NotaFiscal, 'id' | 'criado_em' | 'atualizado_em'> = {
          numero,
          serie,
          numero_pedido: numeroPedido || undefined,
          fornecedor,
          cnpj_fornecedor: cnpjFornecedor || undefined,
          data_emissao: dataEmissao,
          data_recebimento: dataRecebimento,
          valor_total: valorTotalNF,
          status: 'recebida',
          observacoes: observacoes || undefined,
          arquivo_url: nfFileUrl || undefined,
          usuario_recebimento: user?.id || '',
          usuario_conferencia: undefined,
          base_id: baseSelecionada,
          contrato_id: contratoId || undefined
        }

        await estoqueService.processarNotaFiscal(notaFiscal, itensFormatados)
        notify('Entrada de material processada com sucesso!', 'success')
      } else {
        // Processar recebimento de transferência
        await estoqueService.processarRecebimentoTransferencia(
          {
            base_origem_id: baseOrigemId,
            base_destino_id: baseSelecionada,
            numero_transferencia: numeroTransferencia || undefined,
            data_recebimento: dataRecebimento,
            observacoes: observacoes || undefined,
            usuario_recebimento: user?.id || '',
            contrato_destino_id: contratoId || undefined
          },
          itensFormatados
        )
        notify('Recebimento de transferência processado com sucesso!', 'success')
      }
      
      // Limpar formulário após sucesso
      resetForm()
      
      router.push('/almoxarifado')
    } catch (error) {
      console.error('Erro ao processar entrada:', error)
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido'
      notify(`Erro ao processar entrada de material: ${errorMessage}`, 'error')
    } finally {
      setLoading(false)
    }
  }

  const valorTotalNF = itensNF.reduce((acc, item) => acc + item.valor_total, 0)

  // Mostrar loading enquanto permissões estão carregando
  if (!user || loadingModularPermissions || !permissionsLoaded) {
    return (
      <div className="container mx-auto px-8 py-6 max-w-full">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
            <p className="text-gray-600">Carregando permissões...</p>
          </div>
        </div>
      </div>
    )
  }

  // Verificar permissão após carregamento
  if (!canRegisterNF()) {
    return null
  }

  return (
    <div className="container mx-auto px-8 py-6 max-w-full">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-blue-100 rounded-lg">
            <FileText className="h-8 w-8 text-blue-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Entrada de Material</h1>
            <p className="text-gray-600">Processar entrada de materiais no estoque</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Formulário da NF */}
        <div className="lg:col-span-8 space-y-4">
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="h-4 w-4" />
                Dados da Entrada de Material
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5 pt-0">
              {/* Tipo de Entrada */}
              <div className="space-y-1">
                <Label htmlFor="tipo-entrada" className="text-xs font-medium">Tipo de Entrada *</Label>
                <Select 
                  value={tipoEntrada} 
                  onValueChange={(value: 'nota_fiscal' | 'transferencia') => {
                    setTipoEntrada(value)
                    // Limpar campos específicos ao trocar tipo
                    if (value === 'transferencia') {
                      setNumero('')
                      setSerie('')
                      setFornecedor('')
                      setCnpjFornecedor('')
                      setDataEmissao('')
                    } else {
                      setBaseOrigemId('')
                      setNumeroTransferencia('')
                    }
                  }}
                >
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder="Selecione o tipo de entrada" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nota_fiscal">Nota Fiscal</SelectItem>
                    <SelectItem value="transferencia">Recebimento via Transferência</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Campos da Transferência */}
              {tipoEntrada === 'transferencia' && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label htmlFor="base-origem" className="text-xs font-medium">Base de Origem *</Label>
                      <Select 
                        value={baseOrigemId} 
                        onValueChange={setBaseOrigemId}
                      >
                        <SelectTrigger className="h-8 text-sm">
                          <SelectValue placeholder="Selecione a base de origem" />
                        </SelectTrigger>
                        <SelectContent>
                          {basesPermitidas.map(base => (
                            <SelectItem key={base.id} value={base.id}>
                              {base.nome}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="numero-transferencia" className="text-xs font-medium">Número da Transferência (Opcional)</Label>
                      <Input
                        id="numero-transferencia"
                        value={numeroTransferencia}
                        onChange={(e) => setNumeroTransferencia(e.target.value)}
                        placeholder="Número da transferência"
                        className="h-8 text-sm"
                      />
                    </div>
                  </div>
                </>
              )}

              {/* Campos da Nota Fiscal */}
              {tipoEntrada === 'nota_fiscal' && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label htmlFor="numero-nf" className="text-xs font-medium">Número da NF *</Label>
                      <Input
                        id="numero-nf"
                        value={numero}
                        onChange={(e) => setNumero(e.target.value)}
                        placeholder="Número da nota fiscal (opcional)"
                        required
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="serie-nf" className="text-xs font-medium">Série</Label>
                      <Input
                        id="serie-nf"
                        value={serie}
                        onChange={(e) => setSerie(e.target.value)}
                        placeholder="Série da NF"
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="numero-pedido" className="text-xs font-medium">Número do Pedido</Label>
                      <Input
                        id="numero-pedido"
                        value={numeroPedido}
                        onChange={(e) => setNumeroPedido(e.target.value)}
                        placeholder="Número do pedido de compra"
                        className="h-8 text-sm"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label htmlFor="fornecedor" className="text-xs font-medium">Fornecedor *</Label>
                      <Input
                        id="fornecedor"
                        value={fornecedor}
                        onChange={(e) => setFornecedor(e.target.value)}
                        placeholder="Nome do fornecedor"
                        required
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="cnpj-fornecedor" className="text-xs font-medium">CNPJ do Fornecedor</Label>
                      <Input
                        id="cnpj-fornecedor"
                        value={cnpjFornecedor}
                        onChange={(e) => handleCnpjChange(e.target.value)}
                        placeholder="00.000.000/0000-00"
                        className={`h-8 text-sm ${cnpjError ? 'border-red-500' : ''}`}
                      />
                      {cnpjError && (
                        <p className="text-xs text-red-600">{cnpjError}</p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label htmlFor="data-emissao" className="text-xs font-medium">Data de Emissão *</Label>
                      <Input
                        id="data-emissao"
                        type="date"
                        value={dataEmissao}
                        onChange={(e) => setDataEmissao(e.target.value)}
                        required
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="data-recebimento-nf" className="text-xs font-medium">Data de Recebimento *</Label>
                      <Input
                        id="data-recebimento-nf"
                        type="date"
                        value={dataRecebimento}
                        onChange={(e) => setDataRecebimento(e.target.value)}
                        required
                        className="h-8 text-sm"
                      />
                    </div>
                  </div>
                </>
              )}

              {/* Campos de Data de Recebimento para Transferência */}
              {tipoEntrada === 'transferencia' && (
                <div className="grid grid-cols-1 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="data-recebimento-transf" className="text-xs font-medium">Data de Recebimento *</Label>
                    <Input
                      id="data-recebimento-transf"
                      type="date"
                      value={dataRecebimento}
                      onChange={(e) => setDataRecebimento(e.target.value)}
                      required
                      className="h-8 text-sm"
                    />
                  </div>
                </div>
              )}

              {/* Base Destino (comum para ambos) */}
              <div className="space-y-1">
                <Label htmlFor="base-nf" className="text-xs font-medium">Base Destino *</Label>
                {basesPermitidas.length === 0 && !loadingPermissions ? (
                  <div className="text-xs text-yellow-600 bg-yellow-50 border border-yellow-200 rounded-md p-1.5">
                    {bases.length === 0 
                      ? 'Carregando bases...' 
                      : 'Nenhuma base disponível. Verifique se você tem contratos e bases associados no seu perfil.'}
                  </div>
                ) : loadingPermissions ? (
                  <div className="text-xs text-blue-600 bg-blue-50 border border-blue-200 rounded-md p-1.5">
                    Carregando bases...
                  </div>
                ) : (
                  <Select 
                    value={baseSelecionada} 
                    onValueChange={(baseId) => {
                      setBaseSelecionada(baseId)
                      const baseEncontrada = basesPermitidas.find(b => b.id === baseId)
                      setContratoId(baseEncontrada?.contrato_id || '')
                      // Limpar itens quando mudar a base (serão recarregados pelo useEffect)
                      setItensEstoque([])
                    }}
                  >
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue placeholder="Selecione uma base" />
                    </SelectTrigger>
                    <SelectContent>
                      {basesPermitidas.map(base => (
                        <SelectItem key={base.id} value={base.id}>
                          {base.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="data-emissao" className="text-xs font-medium">Data de Emissão *</Label>
                  <Input
                    id="data-emissao"
                    type="date"
                    value={dataEmissao}
                    onChange={(e) => setDataEmissao(e.target.value)}
                    required
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="data-recebimento" className="text-xs font-medium">Data de Recebimento *</Label>
                  <Input
                    id="data-recebimento"
                    type="date"
                    value={dataRecebimento}
                    onChange={(e) => setDataRecebimento(e.target.value)}
                    required
                    className="h-8 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="observacoes" className="text-xs font-medium">Observações</Label>
                  <Textarea
                    id="observacoes"
                    value={observacoes}
                    onChange={(e) => setObservacoes(e.target.value)}
                    placeholder="Observações adicionais"
                    rows={2}
                    className="text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="nf-file" className="text-xs font-medium">Arquivo da Nota Fiscal (Opcional)</Label>
                  <div className="flex gap-2">
                    <Input
                      id="nf-file"
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) {
                          handleFileUpload(file)
                        }
                      }}
                      disabled={uploadingFile}
                    />
                    {nfFile && (
                      <div className="flex items-center gap-2 text-sm text-green-600">
                        <FileText className="h-4 w-4" />
                        {nfFile.name}
                      </div>
                    )}
                  </div>
                  {uploadingFile && (
                    <div className="flex items-center gap-2 text-sm text-blue-600">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Enviando arquivo...
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Lateral Direita - Itens, Resumo e Ações */}
        <div className="lg:col-span-4 space-y-4">
          {/* Itens de Entrada */}
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Package className="h-4 w-4" />
                  Itens de Entrada
                </CardTitle>
                <Dialog open={showItemModal} onOpenChange={setShowItemModal}>
                  <DialogTrigger asChild>
                    <Button onClick={() => { setShowItemModal(true); resetItemForm() }} size="sm">
                      <Plus className="h-4 w-4 mr-2" />
                      Adicionar Item
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>
                        {editingItemIndex !== null ? 'Editar Item' : 'Adicionar Item'}
                      </DialogTitle>
                      <DialogDescription>
                        Preencha os dados do item de entrada
                      </DialogDescription>
                    </DialogHeader>
                    
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="item-search">Item do Estoque (opcional)</Label>
                        <SearchableSelect
                          items={itensEstoque.map(item => ({
                            id: item.id,
                            nome: item.nome,
                            codigo: item.codigo,
                            categoria: item.categoria,
                            estoque: item.estoque_atual,
                            unidade: item.unidade_medida
                          }))}
                          value={selectedItem?.id || ''}
                          onValueChange={(itemId) => {
                            const item = itensEstoque.find(i => i.id === itemId)
                            if (item) {
                              setSelectedItem(item)
                              setItemDescricao(item.nome)
                              setItemCodigo(item.codigo || '')
                              setItemUnidade(item.unidade_medida || 'UN')
                            }
                          }}
                          placeholder="Buscar item..."
                          className="w-full"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="item-codigo">Código do Item</Label>
                        <Input
                          id="item-codigo"
                          value={itemCodigo}
                          onChange={(e) => setItemCodigo(e.target.value)}
                          placeholder="Código do item"
                          disabled={!!selectedItem}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="item-descricao">Descrição *</Label>
                        <Input
                          id="item-descricao"
                          value={itemDescricao}
                          onChange={(e) => setItemDescricao(e.target.value)}
                          placeholder="Descrição do item"
                          required
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="item-quantidade">Quantidade *</Label>
                          <Input
                            id="item-quantidade"
                            type="number"
                            value={itemQuantidade}
                            onChange={(e) => setItemQuantidade(e.target.value)}
                            placeholder="0"
                            min="1"
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="item-unidade">Unidade</Label>
                          {selectedItem ? (
                            // Quando item é selecionado, mostra a unidade do item diretamente
                            <Input
                              id="item-unidade"
                              value={itemUnidade}
                              disabled
                              className="bg-gray-50"
                            />
                          ) : (
                            // Quando não há item selecionado, permite escolher manualmente
                            <Select value={itemUnidade} onValueChange={setItemUnidade}>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="UN">Unidade</SelectItem>
                                <SelectItem value="KG">Quilograma</SelectItem>
                                <SelectItem value="L">Litro</SelectItem>
                                <SelectItem value="M">Metro</SelectItem>
                                <SelectItem value="PCT">Pacote</SelectItem>
                                <SelectItem value="CX">Caixa</SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="item-valor">Valor Unitário *</Label>
                        <Input
                          id="item-valor"
                          type="text"
                          value={itemValorUnitario}
                          onChange={(e) => {
                            const inputValue = e.target.value
                            if (isValidCurrency(inputValue)) {
                              setItemValorUnitario(inputValue)
                            }
                          }}
                          placeholder="0,00"
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="item-observacoes">Observações</Label>
                        <Textarea
                          id="item-observacoes"
                          value={itemObservacoes}
                          onChange={(e) => setItemObservacoes(e.target.value)}
                          placeholder="Observações do item"
                          rows={2}
                        />
                      </div>
                    </div>

                    <DialogFooter>
                      <Button variant="outline" onClick={() => setShowItemModal(false)}>
                        Cancelar
                      </Button>
                      <Button onClick={handleAddItem}>
                        {editingItemIndex !== null ? 'Atualizar' : 'Adicionar'}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {itensNF.length === 0 ? (
                <div className="text-center py-6 text-gray-500">
                  <Package className="h-10 w-10 mx-auto mb-3 text-gray-300" />
                  <p className="text-sm">Nenhum item adicionado</p>
                  <p className="text-xs text-gray-400 mt-1">Clique em &quot;Adicionar Item&quot; para começar</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {itensNF.map((item, index) => (
                    <div key={index} className="flex items-center justify-between p-3 border rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm text-gray-900 truncate">{item.descricao}</div>
                        <div className="text-xs text-gray-600 mt-1">
                          {item.quantidade} {item.unidade} • R$ {formatBrazilianCurrency(item.valor_unitario)} cada
                        </div>
                        {item.estoque_atual !== undefined && (
                          <div className="text-xs text-blue-600 mt-1">
                            Estoque: {item.estoque_atual} {item.unidade}
                          </div>
                        )}
                        {item.observacoes && (
                          <div className="text-xs text-gray-500 mt-1 italic truncate">{item.observacoes}</div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 ml-2">
                        <Badge variant="secondary" className="text-sm font-semibold px-2 py-1">
                          R$ {item.valor_total.toFixed(2)}
                        </Badge>
                        <div className="flex gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditItem(index)}
                            className="h-7 w-7 p-0"
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleRemoveItem(index)}
                            className="h-7 w-7 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-base">
                <DollarSign className="h-4 w-4" />
                Resumo da Entrada
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-0">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Total de Itens:</span>
                <span className="font-semibold">{itensNF.length}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Valor Total:</span>
                <span className="text-2xl font-bold text-green-600">
                  R$ {valorTotalNF.toFixed(2)}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-base">
                <Hash className="h-4 w-4" />
                Ações
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Button
                onClick={handleSubmit}
                disabled={loading || itensNF.length === 0}
                className="w-full"
                size="lg"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processando...
                  </>
                ) : (
                  'Processar Entrada de Material'
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Modal de Criação de Novo Item */}
      <Dialog open={showCreateItemModal} onOpenChange={setShowCreateItemModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Criar Novo Item</DialogTitle>
            <DialogDescription>
              Crie um novo item no estoque. As quantidades e valores serão preenchidos no próximo passo.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="codigo">Código *</Label>
                <Input
                  id="codigo"
                  value={newItemForm.codigo}
                  onChange={(e) => setNewItemForm(prev => ({ ...prev, codigo: e.target.value }))}
                  placeholder="Ex: EPI001"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="nome">Nome *</Label>
                <Input
                  id="nome"
                  value={newItemForm.nome}
                  onChange={(e) => setNewItemForm(prev => ({ ...prev, nome: e.target.value }))}
                  placeholder="Ex: Capacete de Segurança"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="categoria">Categoria</Label>
                <Select value={newItemForm.categoria} onValueChange={(value) => setNewItemForm(prev => ({ ...prev, categoria: value as 'epi' | 'ferramental' | 'consumivel' | 'equipamento' }))}>
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
                <Input
                  id="unidade_medida"
                  value={newItemForm.unidade_medida}
                  onChange={(e) => setNewItemForm(prev => ({ ...prev, unidade_medida: e.target.value }))}
                  placeholder="Ex: UN, KG, L"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="descricao">Descrição</Label>
              <Textarea
                id="descricao"
                value={newItemForm.descricao}
                onChange={(e) => setNewItemForm(prev => ({ ...prev, descricao: e.target.value }))}
                placeholder="Descrição detalhada do item"
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="fornecedor">Fornecedor</Label>
              <Input
                id="fornecedor"
                value={newItemForm.fornecedor}
                onChange={(e) => setNewItemForm(prev => ({ ...prev, fornecedor: e.target.value }))}
                placeholder="Nome do fornecedor"
              />
            </div>

              <div className="space-y-2">
                <Label htmlFor="base-item">Base *</Label>
                {basesPermitidas.length === 0 && !loadingPermissions ? (
                  <div className="text-sm text-yellow-600 bg-yellow-50 border border-yellow-200 rounded-md p-3">
                    {bases.length === 0 
                      ? 'Carregando bases...' 
                      : 'Nenhuma base disponível. Verifique se você tem contratos e bases associados no seu perfil.'}
                  </div>
                ) : loadingPermissions ? (
                  <div className="text-sm text-blue-600 bg-blue-50 border border-blue-200 rounded-md p-3">
                    Carregando bases...
                  </div>
                ) : (
                <Select 
                  value={baseSelecionada} 
                  onValueChange={(baseId) => {
                    setBaseSelecionada(baseId)
                    const baseEncontrada = basesPermitidas.find(b => b.id === baseId)
                    setContratoId(baseEncontrada?.contrato_id || '')
                    // Limpar itens quando mudar a base (serão recarregados pelo useEffect)
                    setItensEstoque([])
                  }}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Selecione uma base" />
                  </SelectTrigger>
                  <SelectContent>
                    {basesPermitidas.map(base => (
                      <SelectItem key={base.id} value={base.id}>
                        {base.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateItemModal(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreateNewItem} disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Criando...
                </>
              ) : (
                'Criar Item'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
