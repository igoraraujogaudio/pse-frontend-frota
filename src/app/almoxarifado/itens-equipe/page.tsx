'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import { 
  Loader2, 
  Settings, 
  Package, 
  Plus, 
  Search,
  Trash2, 
  CheckCircle,
  AlertCircle,
  Users,
  Download
} from 'lucide-react'
import { catalogoService, type ItemCatalogo } from '@/services/catalogoService'
import { teamService } from '@/services/teamService'
import { contratoService } from '@/services/contratoService'
import { useNotification } from '@/contexts/NotificationContext'
import type { Team } from '@/types/team'
import type { Contrato } from '@/types/contratos'
import * as XLSX from 'xlsx'
import { Upload, FileSpreadsheet } from 'lucide-react'

// Tipo estendido para incluir contrato do join do Supabase
type TeamWithContrato = Team & {
  contrato?: { id: string; nome: string; codigo?: string } | null
}

interface ItemObrigatorio {
  id?: string
  item_id: string // item_catalogo_id
  item?: ItemCatalogo
  operacao: string
  obrigatorio: boolean
  quantidade_minima: number
  observacoes?: string
}

interface ConfiguracaoOperacao {
  operacao: string
  contrato_id?: string
  contrato_nome?: string
  itens_obrigatorios: ItemObrigatorio[]
  total_itens: number
  total_obrigatorios: number
}

export default function ItensEquipePage() {
  const { notify } = useNotification()
  
  // Estados principais
  const [loading, setLoading] = useState(true)
  const [itensCatalogo, setItensCatalogo] = useState<ItemCatalogo[]>([])
  const [equipes, setEquipes] = useState<Team[]>([])
  const [configuracoes, setConfiguracoes] = useState<ConfiguracaoOperacao[]>([])
  
  // Estados de filtros
  const [selectedContrato, setSelectedContrato] = useState<string>('all')
  const [selectedOperacao, setSelectedOperacao] = useState<string>('all')
  const [searchTerm, setSearchTerm] = useState('')
  
  // Estados do modal
  const [showConfigDialog, setShowConfigDialog] = useState(false)
  const [editingOperacao, setEditingOperacao] = useState<string>('')
  const [itensOperacao, setItensOperacao] = useState<ItemObrigatorio[]>([])
  const [updating, setUpdating] = useState(false)
  
  // Estados do modal de upload Excel
  const [showUploadDialog, setShowUploadDialog] = useState(false)
  const [uploadContrato, setUploadContrato] = useState<string>('')
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [contratos, setContratos] = useState<Contrato[]>([])

  // Obter operações únicas das equipes por contrato
  const getOperacoesPorContrato = () => {
    const operacoesPorContrato: { [key: string]: { operacoes: Set<string>, contrato_nome: string } } = {}
    
    equipes.forEach(equipe => {
      const teamWithContrato = equipe as TeamWithContrato
      const contratoId = teamWithContrato.contrato_id || 'sem_contrato'
      const contrato = teamWithContrato.contrato
      const contratoNome = contrato?.nome || 'Sem Contrato'
      
      if (!operacoesPorContrato[contratoId]) {
        operacoesPorContrato[contratoId] = {
          operacoes: new Set(),
          contrato_nome: contratoNome
        }
      }
      
      operacoesPorContrato[contratoId].operacoes.add(equipe.operacao)
    })
    
    return operacoesPorContrato
  }
  
  const operacoesPorContrato = getOperacoesPorContrato()
  const contratosDisponiveis = Object.keys(operacoesPorContrato)

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      
      // Carregar contratos
      const contratosData = await contratoService.getAll()
      setContratos(contratosData)
      
      // Carregar equipes reais
      const equipesData = await teamService.getAll()
      setEquipes(equipesData)
      
      // Carregar itens do catálogo (todos os itens ativos)
      const itens = await catalogoService.getTodosItensCatalogo()
      // Filtrar apenas itens ativos
      const itensAtivos = itens.filter(item => item.ativo)
      setItensCatalogo(itensAtivos)
      
      // Gerar configurações baseadas nas operações das equipes reais
      const configsData: ConfiguracaoOperacao[] = []
      const operacoesPorContrato = getOperacoesPorContratoFromData(equipesData)
      
      Object.entries(operacoesPorContrato).forEach(([contratoId, { operacoes, contrato_nome }]) => {
        Array.from(operacoes).forEach(operacao => {
          configsData.push({
            operacao: `${operacao} (${contrato_nome})`,
            contrato_id: contratoId,
            contrato_nome,
            itens_obrigatorios: [],
            total_itens: 0,
            total_obrigatorios: 0
          })
        })
      })
      
      setConfiguracoes(configsData)
      
    } catch (error) {
      console.error('Erro ao carregar dados:', error)
      notify('Erro ao carregar dados', 'error')
    } finally {
      setLoading(false)
    }
  }, [notify])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Função auxiliar para obter operações por contrato dos dados
  const getOperacoesPorContratoFromData = (equipesData: Team[]) => {
    const operacoesPorContrato: { [key: string]: { operacoes: Set<string>, contrato_nome: string } } = {}
    
    equipesData.forEach(equipe => {
      const teamWithContrato = equipe as TeamWithContrato
      const contratoId = teamWithContrato.contrato_id || 'sem_contrato'
      const contrato = teamWithContrato.contrato
      const contratoNome = contrato?.nome || 'Sem Contrato'
      
      if (!operacoesPorContrato[contratoId]) {
        operacoesPorContrato[contratoId] = {
          operacoes: new Set(),
          contrato_nome: contratoNome
        }
      }
      
      operacoesPorContrato[contratoId].operacoes.add(equipe.operacao)
    })
    
    return operacoesPorContrato
  }

  const handleEditOperacao = (operacao: string) => {
    setEditingOperacao(operacao)
    
    // Carregar itens já configurados para esta operação
    const config = configuracoes.find(c => c.operacao === operacao)
    if (config) {
      setItensOperacao([...config.itens_obrigatorios])
    } else {
      setItensOperacao([])
    }
    
    setShowConfigDialog(true)
  }

  const handleAddItem = () => {
    setItensOperacao(prev => [...prev, {
      item_id: '',
      operacao: editingOperacao,
      obrigatorio: true,
      quantidade_minima: 1,
      observacoes: ''
    }])
  }

  const handleRemoveItem = (index: number) => {
    setItensOperacao(prev => prev.filter((_, i) => i !== index))
  }

  const handleItemChange = (index: number, field: keyof ItemObrigatorio, value: string | number | boolean) => {
    setItensOperacao(prev => prev.map((item, i) => 
      i === index ? { ...item, [field]: value } : item
    ))
  }

  const handleSaveConfiguracao = async () => {
    if (!editingOperacao) {
      notify('Operação não selecionada', 'error')
      return
    }

    // Validar itens duplicados
    const itemIds = itensOperacao.map(item => item.item_id).filter(id => id)
    const uniqueIds = new Set(itemIds)
    if (itemIds.length !== uniqueIds.size) {
      notify('Existem itens duplicados na configuração', 'error')
      return
    }

    try {
      setUpdating(true)
      
      // TODO: Implementar salvamento real
      console.log('Salvando configuração:', {
        operacao: editingOperacao,
        itens: itensOperacao.filter(item => item.item_id)
      })
      
      // Atualizar localmente
      setConfiguracoes(prev => prev.map(config => 
        config.operacao === editingOperacao 
          ? {
              ...config,
              itens_obrigatorios: itensOperacao.filter(item => item.item_id),
              total_itens: itensOperacao.filter(item => item.item_id).length,
              total_obrigatorios: itensOperacao.filter(item => item.item_id && item.obrigatorio).length
            }
          : config
      ))
      
      notify('Configuração salva com sucesso', 'success')
      setShowConfigDialog(false)
      
    } catch (error) {
      console.error('Erro ao salvar configuração:', error)
      notify('Erro ao salvar configuração', 'error')
    } finally {
      setUpdating(false)
    }
  }

  const downloadTemplate = () => {
    try {
      // Criar dados de exemplo para o template
      const templateData = [
        ['operacao', 'codigo', 'obrigatorio', 'quantidade'],
        ['AFERICAO', 'EPI001', 'Sim', 1],
        ['AFERICAO', 'FER001', 'Sim', 2],
        ['CORTE', 'EPI002', 'Sim', 1],
        ['CORTE', 'CONS001', 'Não', 5],
        ['LIGAÇAO NOVA', 'EPI003', 'Sim', 1],
        ['LIGAÇAO NOVA', 'EQUIP001', 'Sim', 1]
      ]

      // Criar workbook
      const workbook = XLSX.utils.book_new()
      const worksheet = XLSX.utils.aoa_to_sheet(templateData)

      // Ajustar largura das colunas
      const columnWidths = [
        { wch: 20 }, // operacao
        { wch: 15 }, // codigo
        { wch: 15 }, // obrigatorio
        { wch: 12 }  // quantidade
      ]
      worksheet['!cols'] = columnWidths

      // Adicionar worksheet ao workbook
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Itens por Equipe')

      // Gerar e baixar o arquivo
      const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })
      const blob = new Blob([excelBuffer], { 
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
      })
      
      const link = document.createElement('a')
      link.download = 'template-itens-equipe.xlsx'
      link.href = URL.createObjectURL(blob)
      link.click()
      URL.revokeObjectURL(link.href)
      
      notify('Template baixado com sucesso!', 'success')
    } catch (error) {
      console.error('Erro ao gerar template:', error)
      notify('Erro ao gerar template', 'error')
    }
  }

  const handleUploadExcel = async () => {
    if (!uploadContrato) {
      notify('Selecione um contrato antes de fazer o upload', 'error')
      return
    }

    if (!uploadFile) {
      notify('Selecione um arquivo Excel', 'error')
      return
    }

    try {
      setUploading(true)

      // Ler arquivo Excel
      const arrayBuffer = await uploadFile.arrayBuffer()
      const workbook = XLSX.read(arrayBuffer, { type: 'array' })
      
      if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
        throw new Error('Arquivo Excel não contém planilhas')
      }

      const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
      const jsonData = XLSX.utils.sheet_to_json(firstSheet, { 
        defval: '',
        raw: false 
      }) as Array<Record<string, unknown>>

      if (jsonData.length === 0) {
        throw new Error('Arquivo Excel está vazio')
      }

      // Detectar colunas (case-insensitive)
      const firstRow = jsonData[0]
      const keys = Object.keys(firstRow)
      
      const operacaoKey = keys.find(k => 
        k.toLowerCase().includes('operacao') || 
        k.toLowerCase().includes('operação') ||
        k.toLowerCase() === 'op'
      )
      
      const codigoKey = keys.find(k => 
        k.toLowerCase().includes('codigo') || 
        k.toLowerCase().includes('código') ||
        k.toLowerCase() === 'cod'
      )
      
      const obrigatorioKey = keys.find(k => 
        k.toLowerCase().includes('obrigatorio') || 
        k.toLowerCase().includes('obrigatório') ||
        k.toLowerCase() === 'obrig'
      )
      
      const quantidadeKey = keys.find(k => 
        k.toLowerCase().includes('quantidade') || 
        k.toLowerCase() === 'qtd' ||
        k.toLowerCase() === 'quant'
      )

      if (!operacaoKey || !codigoKey) {
        throw new Error(
          `Arquivo Excel deve conter colunas "operacao" e "codigo". ` +
          `Colunas encontradas: ${keys.join(', ')}`
        )
      }

      // Processar dados
      const contrato = contratos.find(c => c.id === uploadContrato)
      if (!contrato) {
        throw new Error('Contrato não encontrado')
      }

      const operacoesProcessadas: { [operacao: string]: ItemObrigatorio[] } = {}

      for (const row of jsonData) {
        const operacao = String(row[operacaoKey] || '').trim()
        const codigo = String(row[codigoKey] || '').trim()
        
        if (!operacao || !codigo) continue

        // Buscar item no catálogo pelo código
        const itemCatalogo = itensCatalogo.find(i => 
          i.codigo.toLowerCase() === codigo.toLowerCase()
        )

        if (!itemCatalogo) {
          console.warn(`Item com código "${codigo}" não encontrado no catálogo`)
          continue
        }

        const operacaoKeyFull = `${operacao} (${contrato.nome})`
        
        if (!operacoesProcessadas[operacaoKeyFull]) {
          operacoesProcessadas[operacaoKeyFull] = []
        }

        const obrigatorio = obrigatorioKey 
          ? String(row[obrigatorioKey] || '').toLowerCase().includes('sim') || 
            String(row[obrigatorioKey] || '').toLowerCase().includes('true') ||
            String(row[obrigatorioKey] || '').toLowerCase().includes('1')
          : true

        const quantidade = quantidadeKey 
          ? parseInt(String(row[quantidadeKey] || '1')) || 1
          : 1

        operacoesProcessadas[operacaoKeyFull].push({
          item_id: itemCatalogo.id,
          operacao: operacaoKeyFull,
          obrigatorio,
          quantidade_minima: quantidade,
          observacoes: ''
        })
      }

      // Atualizar configurações
      setConfiguracoes(prev => {
        const updated = [...prev]
        
        Object.entries(operacoesProcessadas).forEach(([operacao, itens]) => {
          const configIndex = updated.findIndex(c => c.operacao === operacao)
          
          if (configIndex >= 0) {
            // Mesclar com itens existentes (evitar duplicatas)
            const existingIds = new Set(updated[configIndex].itens_obrigatorios.map(i => i.item_id))
            const newItens = itens.filter(i => !existingIds.has(i.item_id))
            
            updated[configIndex] = {
              ...updated[configIndex],
              itens_obrigatorios: [...updated[configIndex].itens_obrigatorios, ...newItens],
              total_itens: updated[configIndex].itens_obrigatorios.length + newItens.length,
              total_obrigatorios: [...updated[configIndex].itens_obrigatorios, ...newItens]
                .filter(i => i.obrigatorio).length
            }
          } else {
            // Criar nova configuração
            updated.push({
              operacao,
              contrato_id: uploadContrato,
              contrato_nome: contrato.nome,
              itens_obrigatorios: itens,
              total_itens: itens.length,
              total_obrigatorios: itens.filter(i => i.obrigatorio).length
            })
          }
        })
        
        return updated
      })

      const totalItens = Object.values(operacoesProcessadas).reduce((sum, itens) => sum + itens.length, 0)
      notify(`Upload realizado com sucesso! ${totalItens} item(ns) processado(s).`, 'success')
      
      setShowUploadDialog(false)
      setUploadFile(null)
      setUploadContrato('')
      
    } catch (error) {
      console.error('Erro ao processar Excel:', error)
      notify(`Erro ao processar Excel: ${error instanceof Error ? error.message : 'Erro desconhecido'}`, 'error')
    } finally {
      setUploading(false)
    }
  }

  const filteredConfiguracoes = configuracoes.filter(config => {
    const matchesContrato = selectedContrato === 'all' || config.contrato_id === selectedContrato
    const matchesOperacao = selectedOperacao === 'all' || config.operacao.includes(selectedOperacao)
    const matchesSearch = config.operacao.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         config.contrato_nome?.toLowerCase().includes(searchTerm.toLowerCase())
    
    return matchesContrato && matchesOperacao && matchesSearch
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Carregando configurações...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Itens por Equipe</h1>
          <p className="text-gray-600">Configure itens obrigatórios para checklists de equipe por operação</p>
        </div>
        <Button onClick={() => setShowUploadDialog(true)} variant="outline">
          <Upload className="h-4 w-4 mr-2" />
          Upload por Planilha
        </Button>
      </div>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Contratos</CardTitle>
            <Settings className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
            <div className="text-2xl font-bold">
              {contratosDisponiveis.length}
            </div>
            <p className="text-xs text-muted-foreground">
              Contratos com equipes
            </p>
        </CardContent>
      </Card>

      <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Operações Configuradas</CardTitle>
            <Settings className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
            <div className="text-2xl font-bold">
              {configuracoes.filter(c => c.total_itens > 0).length}
                         </div>
            <p className="text-xs text-muted-foreground">
              de {configuracoes.length} operações
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Itens</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {configuracoes.reduce((total, c) => total + c.total_itens, 0)}
                      </div>
            <p className="text-xs text-muted-foreground">
              Itens configurados
            </p>
        </CardContent>
      </Card>

      <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Itens Obrigatórios</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
        </CardHeader>
        <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {configuracoes.reduce((total, c) => total + c.total_obrigatorios, 0)}
                      </div>
            <p className="text-xs text-muted-foreground">
              Obrigatórios no checklist
            </p>
        </CardContent>
      </Card>
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <Select value={selectedContrato} onValueChange={setSelectedContrato}>
                 <SelectTrigger>
              <SelectValue placeholder="Filtrar por contrato" />
                 </SelectTrigger>
                 <SelectContent>
              <SelectItem value="all">Todos os Contratos</SelectItem>
              {contratosDisponiveis.map(contratoId => {
                const contratoInfo = operacoesPorContrato[contratoId]
                return (
                  <SelectItem key={contratoId} value={contratoId}>
                    {contratoInfo.contrato_nome}
                     </SelectItem>
                )
              })}
                 </SelectContent>
               </Select>
             </div>
            
        <div className="flex-1">
          <Select value={selectedOperacao} onValueChange={setSelectedOperacao}>
                <SelectTrigger>
              <SelectValue placeholder="Filtrar por operação" />
                </SelectTrigger>
                <SelectContent>
              <SelectItem value="all">Todas as Operações</SelectItem>
              {Array.from(new Set(
                Object.values(operacoesPorContrato).flatMap(info => Array.from(info.operacoes))
              )).map(operacao => (
                <SelectItem key={operacao} value={operacao}>
                  {operacao}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
              placeholder="Buscar operação ou contrato..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
              />
            </div>
            </div>
            </div>
            
      {/* Lista de Operações */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredConfiguracoes.map((config) => (
          <Card key={config.operacao} className="hover:shadow-md transition-shadow">
            <CardHeader>
              <div className="flex justify-between items-start">
            <div>
                  <CardTitle className="text-lg">{config.operacao}</CardTitle>
                  <CardDescription>
                    {config.contrato_nome}
                  </CardDescription>
            </div>
                <Badge 
                  variant={config.total_itens > 0 ? 'default' : 'outline'}
                  className={config.total_itens > 0 ? 'bg-green-100 text-green-800' : ''}
                >
                  {config.total_itens > 0 ? 'Configurado' : 'Não configurado'}
                </Badge>
            </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Estatísticas */}
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="text-center p-2 bg-gray-50 rounded">
                    <div className="font-semibold">{config.total_itens}</div>
                    <div className="text-gray-500">Total Itens</div>
            </div>
                  <div className="text-center p-2 bg-green-50 rounded">
                    <div className="font-semibold text-green-700">{config.total_obrigatorios}</div>
                    <div className="text-green-600">Obrigatórios</div>
            </div>
            </div>
            
                {/* Lista de Itens */}
                {config.itens_obrigatorios.length > 0 && (
                  <div className="space-y-1">
                    <Label className="text-xs font-medium text-gray-500">ITENS CONFIGURADOS:</Label>
                    <div className="space-y-1">
                      {config.itens_obrigatorios.slice(0, 3).map((item, index) => {
                        const itemCatalogo = itensCatalogo.find(i => i.id === item.item_id)
                        return (
                          <div key={index} className="flex items-center gap-2 text-xs">
                            {item.obrigatorio ? (
                              <CheckCircle className="h-3 w-3 text-green-500" />
                            ) : (
                              <AlertCircle className="h-3 w-3 text-orange-500" />
                            )}
                            <span className="truncate">
                              {itemCatalogo?.nome || 'Item não encontrado'}
                            </span>
            </div>
                        )
                      })}
                      {config.itens_obrigatorios.length > 3 && (
                        <div className="text-xs text-gray-500">
                          +{config.itens_obrigatorios.length - 3} mais itens...
            </div>
                      )}
          </div>
          </div>
                )}

                {/* Ação */}
                <Button 
                  className="w-full"
                  onClick={() => handleEditOperacao(config.operacao)}
                  variant={config.total_itens > 0 ? 'outline' : 'default'}
                >
                  <Settings className="h-4 w-4 mr-2" />
                  {config.total_itens > 0 ? 'Editar Configuração' : 'Configurar Itens'}
            </Button>
          </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredConfiguracoes.length === 0 && (
        <div className="text-center py-8">
          <Users className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">Nenhuma operação encontrada</h3>
          <p className="mt-1 text-sm text-gray-500">
            Tente ajustar os filtros de busca.
          </p>
        </div>
      )}

      {/* Modal de Configuração */}
      <Dialog open={showConfigDialog} onOpenChange={setShowConfigDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Configurar Itens - {editingOperacao}
            </DialogTitle>
            <DialogDescription>
              Defina quais itens são obrigatórios para equipes desta operação
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Botão Adicionar */}
            <div className="flex justify-between items-center">
              <Label className="text-base font-semibold">Itens da Operação</Label>
              <Button type="button" size="sm" onClick={handleAddItem}>
                <Plus className="h-4 w-4 mr-1" />
                Adicionar Item
              </Button>
            </div>

            {/* Lista de Itens */}
            {itensOperacao.map((item, index) => (
              <Card key={index} className="p-4">
                <div className="grid grid-cols-12 gap-4 items-end">
                  {/* Seleção do Item */}
                  <div className="col-span-5">
                    <Label className="text-sm">Item</Label>
                    <SearchableSelect
                      items={itensCatalogo.map(itemCatalogo => ({
                        id: itemCatalogo.id,
                        nome: itemCatalogo.nome,
                        codigo: itemCatalogo.codigo,
                        categoria: itemCatalogo.categoria,
                        unidade: itemCatalogo.unidade_medida
                      }))}
                      value={item.item_id}
                      onValueChange={(value) => handleItemChange(index, 'item_id', value)}
                      placeholder="Digite para buscar item..."
                    />
                  </div>
            
                  {/* Quantidade Mínima */}
                  <div className="col-span-2">
                    <Label className="text-sm">Qtd. Mín.</Label>
              <Input
                      type="number"
                      min="1"
                      value={item.quantidade_minima}
                      onChange={(e) => handleItemChange(index, 'quantidade_minima', parseInt(e.target.value) || 1)}
              />
            </div>
            
                  {/* Obrigatório */}
                  <div className="col-span-2">
                    <Label className="text-sm">Obrigatório</Label>
                    <div className="flex items-center space-x-2 mt-1">
                      <Switch
                        checked={item.obrigatorio}
                        onCheckedChange={(checked) => handleItemChange(index, 'obrigatorio', checked)}
                      />
                      <span className="text-sm">
                        {item.obrigatorio ? 'Sim' : 'Não'}
                      </span>
            </div>
            </div>
            
                  {/* Observações */}
                  <div className="col-span-2">
                    <Label className="text-sm">Observações</Label>
              <Input
                      value={item.observacoes || ''}
                      onChange={(e) => handleItemChange(index, 'observacoes', e.target.value)}
                      placeholder="Obs."
              />
            </div>
            
                  {/* Remover */}
                  <div className="col-span-1 flex justify-end">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveItem(index)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
            </div>
          </div>
              </Card>
            ))}

            {itensOperacao.length === 0 && (
              <div className="text-center py-8 border-2 border-dashed border-gray-300 rounded-lg">
                <Package className="mx-auto h-12 w-12 text-gray-400" />
                <p className="mt-2 text-sm text-gray-500">
                  Nenhum item configurado. Clique em &quot;Adicionar Item&quot; para começar.
                </p>
          </div>
            )}

            {/* Informações */}
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="flex">
                <div className="flex-shrink-0">
                  <AlertCircle className="h-5 w-5 text-blue-400" />
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-blue-800">
                    Como funciona?
                  </h3>
                  <div className="mt-2 text-sm text-blue-700">
                    <ul className="list-disc list-inside space-y-1">
                      <li>Itens <strong>obrigatórios</strong> aparecerão automaticamente nos checklists de equipe</li>
                      <li>Itens <strong>opcionais</strong> podem ser adicionados conforme necessário</li>
                      <li>A <strong>quantidade mínima</strong> define quantos itens a equipe deve ter</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfigDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveConfiguracao} disabled={updating}>
              {updating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar Configuração
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Upload Excel */}
      <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5" />
                Upload por Planilha Excel
              </div>
            </DialogTitle>
            <DialogDescription>
              Selecione o contrato e faça upload de uma planilha Excel com as configurações de itens por operação
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Seleção de Contrato */}
            <div>
              <Label className="text-sm font-semibold">Contrato *</Label>
              <Select 
                value={uploadContrato} 
                onValueChange={setUploadContrato}
                disabled={uploading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o contrato" />
                </SelectTrigger>
                <SelectContent>
                  {contratos.map(contrato => (
                    <SelectItem key={contrato.id} value={contrato.id}>
                      {contrato.nome} {contrato.codigo ? `(${contrato.codigo})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Upload de Arquivo */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-sm font-semibold">Arquivo Excel *</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={downloadTemplate}
                  className="flex items-center gap-2"
                >
                  <Download className="h-4 w-4" />
                  Baixar Template
                </Button>
              </div>
              <div className="mt-2">
                <Input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                  disabled={uploading || !uploadContrato}
                  className="cursor-pointer"
                />
                <p className="text-xs text-gray-500 mt-2">
                  Formatos aceitos: Excel (.xlsx, .xls)
                </p>
              </div>
            </div>

            {/* Instruções */}
            <div className="bg-blue-50 p-4 rounded-lg">
              <h4 className="text-sm font-semibold text-blue-900 mb-2">Formato da Planilha:</h4>
              <ul className="text-xs text-blue-800 space-y-1 list-disc list-inside">
                <li><strong>operacao</strong> - Nome da operação (obrigatório)</li>
                <li><strong>codigo</strong> - Código do item no catálogo (obrigatório)</li>
                <li><strong>obrigatorio</strong> - &quot;Sim&quot; ou &quot;Não&quot; (opcional, padrão: Sim)</li>
                <li><strong>quantidade</strong> - Quantidade mínima (opcional, padrão: 1)</li>
              </ul>
              <p className="text-xs text-blue-700 mt-2">
                <strong>Exemplo:</strong> operacao | codigo | obrigatorio | quantidade
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setShowUploadDialog(false)
                setUploadFile(null)
                setUploadContrato('')
              }}
              disabled={uploading}
            >
              Cancelar
            </Button>
            <Button 
              onClick={handleUploadExcel} 
              disabled={uploading || !uploadContrato || !uploadFile}
            >
              {uploading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {uploading ? 'Processando...' : 'Fazer Upload'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}