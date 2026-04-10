'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Loader2, ShoppingCart, Download, Trash2, ChevronUp, ChevronDown,
  Building2, Package, AlertCircle, Info, Eye, X, ArrowRightLeft, FileSpreadsheet,
} from 'lucide-react'
import { baseService } from '@/services/baseService'
import { pedidoCompraService } from '@/services/pedidoCompraService'
import { useNotification } from '@/contexts/NotificationContext'
import { useUnifiedPermissions } from '@/hooks/useUnifiedPermissions'
import { useAuth } from '@/contexts/AuthContext'
import { PERMISSION_CODES } from '@/hooks/useModularPermissions'
import ProtectedRoute from '@/components/ProtectedRoute'
import {
  ordenarItens, filtrarPorCategoria, calcularValorTotal, validarQuantidade, removerItem,
} from '@/utils/pedidoCompraUtils'
import { gerarPedidoCompraXLS } from '@/utils/pedidoCompraExcel'
import { gerarRelatorioSolicitacoesXLS } from '@/utils/pedidoCompraSolicitacoesExcel'
import type { ItemPedidoCompra, GrupoBase, SugestaoTransferencia } from '@/types/pedido-compra'

type CampoOrdenacao = keyof ItemPedidoCompra
type DirecaoOrdenacao = 'asc' | 'desc'
const CATEGORIAS = ['EPI', 'ferramental', 'consumível', 'equipamento'] as const

// ============================================================
// MultiSelectBases — mesmo componente da página de estoque
// ============================================================
type MultiSelectBasesProps = {
  options: { id: string; nome: string }[]
  value: string[]
  onChange: (selected: string[]) => void
  placeholder?: string
}

function MultiSelectBases({ options, value, onChange, placeholder = "Selecione as bases..." }: MultiSelectBasesProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const handleSelect = (id: string) => {
    onChange(value.includes(id) ? value.filter(v => v !== id) : [...value, id])
  }
  const handleSelectAll = () => {
    onChange(value.length === options.length ? [] : options.map(o => o.id))
  }

  return (
    <div className="relative" ref={ref}>
      <div
        className="w-full min-h-[38px] flex flex-wrap items-center gap-1 px-3 py-2 border border-input rounded-md bg-background cursor-pointer focus-within:ring-2 focus-within:ring-ring"
        onClick={() => setOpen(o => !o)} tabIndex={0}
      >
        <Building2 className="h-4 w-4 mr-2 text-muted-foreground" />
        {value.length === 0 && <span className="text-muted-foreground text-sm">{placeholder}</span>}
        {value.length > 0 && (
          <span className="text-sm text-muted-foreground">
            {value.length === options.length
              ? `Todas as bases (${value.length})`
              : `${value.length} base${value.length > 1 ? 's' : ''} selecionada${value.length > 1 ? 's' : ''}`}
          </span>
        )}
        {value.length > 0 && value.length < options.length && (
          <div className="flex flex-wrap gap-1 ml-2">
            {value.map(id => {
              const opt = options.find(o => o.id === id)
              return (
                <span key={id} className="bg-primary/10 text-primary rounded px-2 py-0.5 text-xs flex items-center gap-1">
                  {opt?.nome}
                  <button type="button" className="ml-1 text-primary hover:text-primary/80 focus:outline-none"
                    onClick={e => { e.stopPropagation(); onChange(value.filter(v => v !== id)) }} aria-label="Remover">×</button>
                </span>
              )
            })}
          </div>
        )}
      </div>
      {open && (
        <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg max-h-64 overflow-auto">
          <div className="px-3 py-2 cursor-pointer hover:bg-accent border-b flex items-center gap-2 font-medium" onClick={handleSelectAll}>
            <input type="checkbox" checked={value.length === options.length} readOnly className="accent-primary" />
            <span>Selecionar todas</span>
          </div>
          {options.map(opt => (
            <div key={opt.id} className={`px-3 py-2 cursor-pointer hover:bg-accent flex items-center gap-2 ${value.includes(opt.id) ? "bg-accent" : ""}`}
              onClick={() => handleSelect(opt.id)}>
              <input type="checkbox" checked={value.includes(opt.id)} readOnly className="accent-primary" />
              <span>{opt.nome}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function PedidoCompraPage() {
  return (
    <ProtectedRoute requiredPermissions={[PERMISSION_CODES.ALMOXARIFADO.GERENCIAR_COMPRAS]}>
      <PedidoCompraContent />
    </ProtectedRoute>
  )
}

function PedidoCompraContent() {
  const { notify } = useNotification()
  const { hasBaseAccess } = useUnifiedPermissions()
  const { user } = useAuth()

  const [selectedBases, setSelectedBases] = useState<string[]>([])
  const [selectedContrato, setSelectedContrato] = useState<string>('')
  const [grupos, setGrupos] = useState<GrupoBase[]>([])
  const [sugestoes, setSugestoes] = useState<SugestaoTransferencia[]>([])
  const [filtroCategoria, setFiltroCategoria] = useState<string | null>(null)
  const [ordenacao, setOrdenacao] = useState<{ campo: CampoOrdenacao; direcao: DirecaoOrdenacao }>({
    campo: 'nome', direcao: 'asc',
  })
  const [itemDetalheId, setItemDetalheId] = useState<string | null>(null)
  const [gerandoXls, setGerandoXls] = useState(false)
  const [mostrarSugestoes, setMostrarSugestoes] = useState(true)
  const [sugestoesCarregando, setSugestoesCarregando] = useState(false)

  // Carregar bases ativas
  const { data: allBases = [] } = useQuery({
    queryKey: ['bases-ativas'],
    queryFn: () => baseService.getBasesAtivas(),
    staleTime: 5 * 60 * 1000,
  })

  const bases = useMemo(() => allBases.filter(base => hasBaseAccess(base.id)), [allBases, hasBaseAccess])

  // Derivar contratos únicos das bases acessíveis
  const contratos = useMemo(() => {
    const map = new Map<string, { id: string; nome: string }>()
    for (const base of bases) {
      if (base.contrato_id && base.contrato) {
        map.set(base.contrato_id, { id: base.contrato_id, nome: base.contrato.nome })
      }
    }
    return Array.from(map.values()).sort((a, b) => a.nome.localeCompare(b.nome))
  }, [bases])

  // Bases filtradas pelo contrato selecionado
  const basesFiltradas = useMemo(() => {
    if (!selectedContrato) return bases
    return bases.filter(b => b.contrato_id === selectedContrato)
  }, [bases, selectedContrato])

  // Quando muda o contrato, resetar bases selecionadas
  const handleContratoChange = (contratoId: string) => {
    setSelectedContrato(contratoId)
    setSelectedBases([])
    setGrupos([])
    setSugestoes([])
  }

  // Auto-selecionar se só tem uma base filtrada
  useEffect(() => {
    if (basesFiltradas.length === 1 && selectedBases.length === 0) {
      setSelectedBases([basesFiltradas[0].id])
    }
  }, [basesFiltradas, selectedBases.length])

  // Bases efetivas (selecionadas ou todas filtradas se nenhuma selecionada)
  const basesEfetivas = useMemo(
    () => selectedBases.length > 0 ? selectedBases : basesFiltradas.map(b => b.id),
    [selectedBases, basesFiltradas]
  )

  // Map de info de bases (para sugestões)
  const basesInfoMap = useMemo(() => {
    const map = new Map<string, { nome: string; contrato_nome: string }>()
    for (const base of bases) {
      map.set(base.id, { nome: base.nome, contrato_nome: base.contrato?.nome || 'N/A' })
    }
    return map
  }, [bases])

  // Carregar dados do pedido pelas bases selecionadas
  const { data: dadosGrupos, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['pedido-compra', basesEfetivas],
    queryFn: () => pedidoCompraService.carregarDadosPedidoPorBases(basesEfetivas, basesInfoMap),
    enabled: basesEfetivas.length > 0,
    staleTime: 2 * 60 * 1000,
  })

  useEffect(() => {
    if (dadosGrupos) setGrupos(dadosGrupos)
  }, [dadosGrupos])

  // Buscar sugestões de transferência
  const todosItens = useMemo(() => grupos.flatMap(g => g.itens), [grupos])
  const allBaseIds = useMemo(() => bases.map(b => b.id), [bases])

  useEffect(() => {
    if (todosItens.length === 0 || allBaseIds.length === 0) {
      setSugestoes([])
      return
    }
    setSugestoesCarregando(true)
    pedidoCompraService
      .buscarSugestoesTransferencia('', todosItens, allBaseIds, basesInfoMap)
      .then(setSugestoes)
      .catch(() => setSugestoes([]))
      .finally(() => setSugestoesCarregando(false))
  }, [todosItens, allBaseIds, basesInfoMap])

  const valorTotal = useMemo(() => calcularValorTotal(todosItens), [todosItens])

  const handleOrdenacao = (campo: CampoOrdenacao) => {
    setOrdenacao(prev => ({
      campo, direcao: prev.campo === campo && prev.direcao === 'asc' ? 'desc' : 'asc',
    }))
  }

  const handleQuantidadeChange = (itemId: string, valor: string) => {
    const num = parseInt(valor, 10)
    if (isNaN(num)) return
    if (!validarQuantidade(num)) { notify('Quantidade não pode ser negativa', 'error'); return }
    setGrupos(prev => prev.map(g => ({
      ...g, itens: g.itens.map(item => item.id === itemId ? { ...item, quantidade_editada: num } : item),
    })))
  }

  const handleRemoverItem = (itemId: string) => {
    setGrupos(prev => prev.map(g => ({
      ...g, itens: removerItem(g.itens, itemId),
    })).filter(g => g.itens.length > 0))
  }

  // Contrato para gerar pedido
  const contratoParaPedido = useMemo(() => {
    if (selectedContrato) {
      return contratos.find(c => c.id === selectedContrato) || null
    }
    // Se não selecionou contrato, derivar da primeira base efetiva
    const baseSel = bases.find(b => basesEfetivas.includes(b.id))
    if (!baseSel?.contrato_id || !baseSel?.contrato) return null
    return { id: baseSel.contrato_id, nome: baseSel.contrato.nome }
  }, [selectedContrato, contratos, bases, basesEfetivas])

  const handleGerarXls = async () => {
    if (todosItens.length === 0 || !contratoParaPedido || !user) return
    setGerandoXls(true)
    try {
      const numeroPedido = await pedidoCompraService.gerarNumeroPedido(contratoParaPedido.id)
      const dados = {
        numero_pedido: numeroPedido,
        contrato_nome: contratoParaPedido.nome,
        data_geracao: new Date().toLocaleDateString('pt-BR'),
        almoxarife_nome: user.nome || 'N/A',
        itens: todosItens,
        valor_total_estimado: valorTotal,
      }
      gerarPedidoCompraXLS(dados)
      await pedidoCompraService.salvarPedido(dados, contratoParaPedido.id, user.id)
      notify('Pedido de compra gerado com sucesso!', 'success')
    } catch (err) {
      console.error('Erro ao gerar pedido:', err)
      notify('Erro ao gerar pedido de compra. Tente novamente.', 'error')
    } finally {
      setGerandoXls(false)
    }
  }

  const handleGerarRelatorioSolicitacoes = () => {
    if (grupos.length === 0 || !user) return
    try {
      gerarRelatorioSolicitacoesXLS({
        contrato_nome: contratoParaPedido?.nome || 'Todos',
        data_geracao: new Date().toLocaleDateString('pt-BR'),
        almoxarife_nome: user.nome || 'N/A',
        grupos,
      })
      notify('Relatório de solicitações gerado com sucesso!', 'success')
    } catch (err) {
      console.error('Erro ao gerar relatório:', err)
      notify('Erro ao gerar relatório de solicitações. Tente novamente.', 'error')
    }
  }

  const itemDetalhe = todosItens.find(i => i.id === itemDetalheId)

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <ShoppingCart className="h-8 w-8" />
          Pedido de Compra
        </h1>
        <p className="text-muted-foreground mt-1">
          Gere pedidos de compra baseados na necessidade de reposição
        </p>
      </div>

      {/* Seletor de Contrato + Bases */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Filtrar por Contrato e Bases
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Seletor de Contrato */}
          <div>
            <label className="text-sm font-medium text-muted-foreground mb-1 block">Contrato</label>
            <select
              className="w-full min-h-[38px] px-3 py-2 border border-input rounded-md bg-background text-sm focus:ring-2 focus:ring-ring"
              value={selectedContrato}
              onChange={e => handleContratoChange(e.target.value)}
            >
              <option value="">Todos os contratos</option>
              {contratos.map(c => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </select>
          </div>
          {/* Seletor de Bases */}
          <div>
            <label className="text-sm font-medium text-muted-foreground mb-1 block">Bases</label>
            <MultiSelectBases
              options={basesFiltradas.map(b => ({ id: b.id, nome: b.nome }))}
              value={selectedBases}
              onChange={setSelectedBases}
              placeholder="Selecione as bases..."
            />
            {selectedBases.length === 0 && basesFiltradas.length > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                Nenhuma base selecionada — mostrando todas as bases {selectedContrato ? 'do contrato' : 'acessíveis'}.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {basesFiltradas.length === 0 && (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-muted-foreground space-y-2">
              <Info className="h-12 w-12 mx-auto opacity-50" />
              <p className="text-lg font-medium">Nenhuma base disponível</p>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span className="ml-2 text-muted-foreground">Carregando dados do pedido...</span>
        </div>
      )}

      {isError && (
        <Card>
          <CardContent className="py-8">
            <div className="text-center space-y-3">
              <AlertCircle className="h-10 w-10 mx-auto text-destructive" />
              <p className="text-destructive font-medium">Erro ao carregar dados</p>
              <p className="text-sm text-muted-foreground">
                {error instanceof Error ? error.message : 'Ocorreu um erro inesperado.'}
              </p>
              <Button variant="outline" onClick={() => refetch()}>Tentar novamente</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Conteúdo principal */}
      {!isLoading && !isError && basesEfetivas.length > 0 && (
        <>
          {/* Resumo */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm font-medium">Itens no Pedido</CardTitle></CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{todosItens.length}</div>
                <p className="text-xs text-muted-foreground">em {grupos.length} base(s)</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm font-medium">Valor Total Estimado</CardTitle></CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">R$ {valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm font-medium">Gerar Pedido</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                <Button className="w-full" onClick={handleGerarXls} disabled={todosItens.length === 0 || gerandoXls || !contratoParaPedido}>
                  {gerandoXls ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Gerando...</> : <><Download className="h-4 w-4 mr-2" />Gerar Pedido XLS</>}
                </Button>
                <Button variant="outline" className="w-full" onClick={handleGerarRelatorioSolicitacoes} disabled={todosItens.length === 0}>
                  <FileSpreadsheet className="h-4 w-4 mr-2" />Relatório Solicitações
                </Button>
                {todosItens.length === 0 && <p className="text-xs text-muted-foreground mt-2 text-center">Nenhum item para gerar pedido</p>}
                {!contratoParaPedido && todosItens.length > 0 && <p className="text-xs text-amber-600 mt-2 text-center">Bases sem contrato vinculado</p>}
              </CardContent>
            </Card>
          </div>

          {/* Alertas de Transferência */}
          {(sugestoes.length > 0 || sugestoesCarregando) && (
            <Card className="border-amber-300 bg-amber-50">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-amber-800">
                    <ArrowRightLeft className="h-5 w-5" />
                    Sugestões de Transferência {sugestoesCarregando ? '' : `(${sugestoes.length})`}
                  </CardTitle>
                  <Button variant="ghost" size="sm" onClick={() => setMostrarSugestoes(!mostrarSugestoes)}>
                    {mostrarSugestoes ? 'Ocultar' : 'Mostrar'}
                  </Button>
                </div>
                <p className="text-sm text-amber-700">
                  Itens com excesso em outras bases que podem suprir a necessidade
                </p>
              </CardHeader>
              {mostrarSugestoes && (
                <CardContent>
                  {sugestoesCarregando ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="h-5 w-5 animate-spin text-amber-600" />
                      <span className="ml-2 text-sm text-amber-700">Buscando sugestões...</span>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-amber-200">
                            <th className="text-left p-2">Item</th>
                            <th className="text-left p-2">Base Origem</th>
                            <th className="text-left p-2">Contrato</th>
                            <th className="text-right p-2">Excesso</th>
                            <th className="text-center p-2">→</th>
                            <th className="text-left p-2">Base Destino</th>
                            <th className="text-right p-2">Necessidade</th>
                            <th className="text-right p-2">Qtd. Sugerida</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sugestoes.map((s, i) => (
                            <tr key={i} className="border-b border-amber-100 hover:bg-amber-100/50">
                              <td className="p-2"><span className="font-mono text-xs">{s.item_codigo}</span> {s.item_nome}</td>
                              <td className="p-2">{s.base_origem_nome}</td>
                              <td className="p-2"><Badge variant="outline">{s.contrato_origem_nome}</Badge></td>
                              <td className="p-2 text-right text-green-700 font-medium">+{s.excesso}</td>
                              <td className="p-2 text-center"><ArrowRightLeft className="h-3 w-3 inline" /></td>
                              <td className="p-2">{s.base_destino_nome}</td>
                              <td className="p-2 text-right text-red-700 font-medium">-{s.necessidade}</td>
                              <td className="p-2 text-right font-semibold">{s.quantidade_sugerida} {s.unidade_medida}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              )}
            </Card>
          )}

          {/* Filtro por categoria */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Categoria:</span>
            <select className="px-3 py-1.5 border border-input rounded-md bg-background text-sm"
              value={filtroCategoria || ''} onChange={e => setFiltroCategoria(e.target.value || null)}>
              <option value="">Todas</option>
              {CATEGORIAS.map(cat => <option key={cat} value={cat}>{cat}</option>)}
            </select>
          </div>

          {/* Itens agrupados por base */}
          {grupos.length === 0 ? (
            <Card>
              <CardContent className="py-8">
                <div className="text-center text-muted-foreground">
                  Nenhum item necessita reposição nas bases selecionadas.
                </div>
              </CardContent>
            </Card>
          ) : (
            grupos.map(grupo => {
              const itensFiltrados = ordenarItens(filtrarPorCategoria(grupo.itens, filtroCategoria), ordenacao.campo, ordenacao.direcao)
              if (itensFiltrados.length === 0) return null
              return (
                <Card key={grupo.base_id}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Package className="h-5 w-5" />
                      {grupo.base_nome}
                      <Badge variant="secondary">{itensFiltrados.length} itens</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b">
                            <SortableHeader campo="codigo" label="Código" ordenacao={ordenacao} onClick={handleOrdenacao} />
                            <SortableHeader campo="nome" label="Nome" ordenacao={ordenacao} onClick={handleOrdenacao} />
                            <SortableHeader campo="categoria" label="Categoria" ordenacao={ordenacao} onClick={handleOrdenacao} />
                            <th className="text-left p-2 text-sm font-medium">Unidade</th>
                            <SortableHeader campo="estoque_atual" label="Estoque" ordenacao={ordenacao} onClick={handleOrdenacao} align="right" />
                            <SortableHeader campo="estoque_minimo" label="Mínimo" ordenacao={ordenacao} onClick={handleOrdenacao} align="right" />
                            <SortableHeader campo="quantidade_solicitacoes" label="Solic. Aguard." ordenacao={ordenacao} onClick={handleOrdenacao} align="right" />
                            <SortableHeader campo="quantidade_necessaria" label="Qtd. Necessária" ordenacao={ordenacao} onClick={handleOrdenacao} align="right" />
                            <th className="text-right p-2 text-sm font-medium">Qtd. Pedido</th>
                            <th className="text-center p-2 text-sm font-medium">Ações</th>
                          </tr>
                        </thead>
                        <tbody>
                          {itensFiltrados.map(item => (
                            <tr key={item.id} className={`border-b hover:bg-muted/50 ${item.estoque_atual === 0 ? 'bg-red-50' : ''}`}>
                              <td className="p-2 font-mono text-sm">{item.codigo}</td>
                              <td className="p-2">{item.nome}</td>
                              <td className="p-2"><Badge variant="secondary">{item.categoria}</Badge></td>
                              <td className="p-2 text-sm">{item.unidade_medida}</td>
                              <td className="p-2 text-right">
                                <span className={item.estoque_atual === 0 ? 'text-destructive font-semibold' : ''}>{item.estoque_atual}</span>
                              </td>
                              <td className="p-2 text-right">{item.estoque_minimo}</td>
                              <td className="p-2 text-right">
                                <button className="text-primary underline cursor-pointer hover:text-primary/80"
                                  onClick={() => setItemDetalheId(item.id)} title="Ver solicitações">{item.quantidade_solicitacoes}</button>
                              </td>
                              <td className="p-2 text-right text-muted-foreground">{item.quantidade_necessaria}</td>
                              <td className="p-2 text-right">
                                <input type="number" min={0} className="w-20 px-2 py-1 border border-input rounded-md text-right text-sm"
                                  value={item.quantidade_editada ?? item.quantidade_necessaria}
                                  onChange={e => handleQuantidadeChange(item.id, e.target.value)} />
                              </td>
                              <td className="p-2 text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <Button variant="ghost" size="sm" onClick={() => setItemDetalheId(item.id)} title="Ver detalhes"><Eye className="h-4 w-4" /></Button>
                                  <Button variant="ghost" size="sm" onClick={() => handleRemoverItem(item.id)} title="Remover" className="text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              )
            })
          )}
        </>
      )}

      {/* Modal de Detalhamento */}
      {itemDetalhe && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <Card className="w-full max-w-lg mx-4 max-h-[80vh] overflow-auto">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Solicitações Aguardando — {itemDetalhe.nome}</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setItemDetalheId(null)}><X className="h-4 w-4" /></Button>
              </div>
              <p className="text-sm text-muted-foreground">
                Base: {itemDetalhe.base_nome} · Total: {itemDetalhe.solicitacoes.length} solicitação(ões)
              </p>
            </CardHeader>
            <CardContent>
              {itemDetalhe.solicitacoes.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">Nenhuma solicitação aguardando estoque.</p>
              ) : (
                <div className="space-y-3">
                  {itemDetalhe.solicitacoes.map(sol => (
                    <div key={sol.id} className="border rounded-md p-3 space-y-1">
                      <div className="flex justify-between text-sm"><span className="font-medium">Solicitante:</span><span>{sol.solicitante_nome}</span></div>
                      <div className="flex justify-between text-sm"><span className="font-medium">Destinatário:</span><span>{sol.destinatario_nome}</span></div>
                      <div className="flex justify-between text-sm"><span className="font-medium">Qtd. Aprovada:</span><span>{sol.quantidade_aprovada}</span></div>
                      <div className="flex justify-between text-sm"><span className="font-medium">Data:</span><span>{new Date(sol.criado_em).toLocaleDateString('pt-BR')}</span></div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

function SortableHeader({ campo, label, ordenacao, onClick, align = 'left' }: {
  campo: CampoOrdenacao; label: string
  ordenacao: { campo: CampoOrdenacao; direcao: DirecaoOrdenacao }
  onClick: (campo: CampoOrdenacao) => void; align?: 'left' | 'right'
}) {
  const isActive = ordenacao.campo === campo
  return (
    <th className={`p-2 text-sm font-medium cursor-pointer select-none hover:bg-muted/50 ${align === 'right' ? 'text-right' : 'text-left'}`}
      onClick={() => onClick(campo)}>
      <span className="inline-flex items-center gap-1">
        {label}
        {isActive && (ordenacao.direcao === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
      </span>
    </th>
  )
}
