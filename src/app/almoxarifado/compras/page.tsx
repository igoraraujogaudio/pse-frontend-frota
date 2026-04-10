'use client'

import { useState, useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Loader2, 
  ShoppingCart, 
  Clock, 
  TrendingUp,
  Building2,
  Package,
  Download
} from 'lucide-react'
import { baseService } from '@/services/baseService'
import { useNotification } from '@/contexts/NotificationContext'
import { useUnifiedPermissions } from '@/hooks/useUnifiedPermissions'
import { PERMISSION_CODES } from '@/hooks/useModularPermissions'
import ProtectedRoute from '@/components/ProtectedRoute'
import * as XLSX from 'xlsx'

type ItemCompra = {
  item_catalogo_id: string
  item_codigo: string
  item_nome: string
  categoria: string
  unidade_medida: string
  base_id: string
  base_nome: string
  estoque_atual: number
  estoque_minimo: number
  quantidade_necessaria: number
  valor_unitario: number
  valor_total: number
  fornecedor: string
  solicitacoes_aguardando: number
  ultima_compra: string | null
  motivo_compra: string
}

type ItemTempo = {
  item_catalogo_id: string
  item_codigo: string
  item_nome: string
  categoria: string
  base_id: string
  base_nome: string
  estoque_atual: number
  estoque_minimo: number
  tempo_medio_entrega_dias: number
  ultima_entrada: string | null
  proxima_entrada_estimada: string | null
  status_urgencia: string
  fornecedor: string
}

type ItemTop = {
  item_catalogo_id: string
  item_codigo: string
  item_nome: string
  categoria: string
  total_solicitacoes: number
  quantidade_total: number
  estoque_atual_total: number
  estoque_minimo_total: number
  valor_unitario: number
  fornecedor: string
  bases_com_deficit: number
  ultima_solicitacao: string
}

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

export default function ComprasPage() {
  return (
    <ProtectedRoute requiredPermissions={[
      PERMISSION_CODES.ALMOXARIFADO.GERENCIAR_COMPRAS
    ]}>
      <ComprasContent />
    </ProtectedRoute>
  )
}

function ComprasContent() {
  const { notify } = useNotification()
  const { hasBaseAccess } = useUnifiedPermissions()
  const [selectedBases, setSelectedBases] = useState<string[]>([])
  const [activeTab, setActiveTab] = useState('necessarios')

  const { data: allBases = [] } = useQuery({
    queryKey: ['bases-ativas'],
    queryFn: () => baseService.getBasesAtivas(),
    staleTime: 5 * 60 * 1000,
  })

  const bases = allBases.filter(base => hasBaseAccess(base.id))

  useEffect(() => {
    if (bases.length > 0 && selectedBases.length === 0) {
      const allBaseIds = bases.map(base => base.id)
      setSelectedBases(allBaseIds)
      if (bases.length === 1) {
        notify(`Acesso limitado à base: ${bases[0].nome}`, 'info')
      } else {
        notify(`${bases.length} bases selecionadas automaticamente`, 'info')
      }
    }
  }, [bases, selectedBases, notify])

  const { data: comprasData, isLoading } = useQuery({
    queryKey: ['compras-data', selectedBases],
    queryFn: async () => {
      if (selectedBases.length === 0) return null
      
      const baseIds = selectedBases.join(',')
      const response = await fetch(`/api/almoxarifado/compras?baseIds=${baseIds}`)
      
      if (!response.ok) {
        throw new Error('Erro ao carregar dados de compras')
      }
      
      return response.json()
    },
    enabled: selectedBases.length > 0,
    staleTime: 2 * 60 * 1000,
  })

  const itensCompra: ItemCompra[] = comprasData?.itensCompra || []
  const itensPorTempo: ItemTempo[] = comprasData?.itensPorTempo || []
  const top3Itens: ItemTop[] = comprasData?.top3Itens || []

  const handleExportExcel = (tipo: 'necessarios' | 'tempo' | 'top3') => {
    let dados: Record<string, string | number>[] = []
    let nomeAba = ''

    if (tipo === 'necessarios') {
      nomeAba = 'Itens Necessários'
      dados = itensCompra.map(item => ({
        'Código': item.item_codigo,
        'Nome': item.item_nome,
        'Categoria': item.categoria,
        'Base': item.base_nome,
        'Estoque Atual': item.estoque_atual,
        'Estoque Mínimo': item.estoque_minimo,
        'Quantidade Necessária': item.quantidade_necessaria,
        'Valor Unitário': item.valor_unitario?.toFixed(2) || '0.00',
        'Valor Total': item.valor_total?.toFixed(2) || '0.00',
        'Fornecedor': item.fornecedor || '',
        'Solicitações Aguardando': item.solicitacoes_aguardando,
        'Motivo': item.motivo_compra
      }))
    } else if (tipo === 'tempo') {
      nomeAba = 'Tempo de Entrega'
      dados = itensPorTempo.map(item => ({
        'Código': item.item_codigo,
        'Nome': item.item_nome,
        'Categoria': item.categoria,
        'Base': item.base_nome,
        'Estoque Atual': item.estoque_atual,
        'Estoque Mínimo': item.estoque_minimo,
        'Tempo Médio (dias)': item.tempo_medio_entrega_dias,
        'Última Entrada': item.ultima_entrada ? new Date(item.ultima_entrada).toLocaleDateString('pt-BR') : '',
        'Próxima Entrada Estimada': item.proxima_entrada_estimada ? new Date(item.proxima_entrada_estimada).toLocaleDateString('pt-BR') : '',
        'Urgência': item.status_urgencia,
        'Fornecedor': item.fornecedor || ''
      }))
    } else {
      nomeAba = 'Top 3 Mais Solicitados'
      dados = top3Itens.map(item => ({
        'Código': item.item_codigo,
        'Nome': item.item_nome,
        'Categoria': item.categoria,
        'Total Solicitações': item.total_solicitacoes,
        'Quantidade Total': item.quantidade_total,
        'Estoque Atual Total': item.estoque_atual_total,
        'Estoque Mínimo Total': item.estoque_minimo_total,
        'Valor Unitário': item.valor_unitario?.toFixed(2) || '0.00',
        'Fornecedor': item.fornecedor || '',
        'Bases com Déficit': item.bases_com_deficit,
        'Última Solicitação': new Date(item.ultima_solicitacao).toLocaleDateString('pt-BR')
      }))
    }

    if (dados.length === 0) {
      notify('Não há dados para exportar', 'warning')
      return
    }

    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(dados)
    XLSX.utils.book_append_sheet(wb, ws, nomeAba)
    XLSX.writeFile(wb, `compras_${tipo}_${new Date().toISOString().split('T')[0]}.xlsx`)
    notify('Relatório exportado com sucesso', 'success')
  }

  const valorTotalCompras = itensCompra.reduce((acc, item) => acc + (item.valor_total || 0), 0)

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <ShoppingCart className="h-8 w-8" />
            Compras - Almoxarifado
          </h1>
          <p className="text-muted-foreground mt-1">
            Relatórios e pedidos de compras baseados em estoque e demanda
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Filtrar por Bases
          </CardTitle>
        </CardHeader>
        <CardContent>
          <MultiSelectBases
            options={bases}
            value={selectedBases}
            onChange={setSelectedBases}
            placeholder="Selecione as bases..."
          />
        </CardContent>
      </Card>

      {selectedBases.length > 0 && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Itens Necessários</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{itensCompra.length}</div>
                <p className="text-xs text-muted-foreground">
                  Aguardando estoque ou abaixo do mínimo
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Valor Total Estimado</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  R$ {valorTotalCompras.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </div>
                <p className="text-xs text-muted-foreground">
                  Baseado nos itens necessários
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Itens com Lead Time</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{itensPorTempo.length}</div>
                <p className="text-xs text-muted-foreground">
                  Com histórico de tempo de entrega
                </p>
              </CardContent>
            </Card>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="necessarios" className="flex items-center gap-2">
                <Package className="h-4 w-4" />
                Itens Necessários
              </TabsTrigger>
              <TabsTrigger value="tempo" className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Tempo de Entrega
              </TabsTrigger>
              <TabsTrigger value="top3" className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Top 3 Solicitados
              </TabsTrigger>
            </TabsList>

            <TabsContent value="necessarios" className="space-y-4">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Itens Necessários para Compra</CardTitle>
                      <CardDescription>
                        Itens aguardando estoque ou abaixo do estoque mínimo
                      </CardDescription>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleExportExcel('necessarios')}
                      disabled={itensCompra.length === 0}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Exportar Excel
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-8 w-8 animate-spin" />
                    </div>
                  ) : itensCompra.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      Nenhum item necessário para compra
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left p-2">Código</th>
                            <th className="text-left p-2">Nome</th>
                            <th className="text-left p-2">Base</th>
                            <th className="text-right p-2">Estoque</th>
                            <th className="text-right p-2">Mínimo</th>
                            <th className="text-right p-2">Necessário</th>
                            <th className="text-right p-2">Valor Un.</th>
                            <th className="text-right p-2">Valor Total</th>
                            <th className="text-left p-2">Motivo</th>
                          </tr>
                        </thead>
                        <tbody>
                          {itensCompra.map((item, idx) => (
                            <tr key={idx} className="border-b hover:bg-muted/50">
                              <td className="p-2 font-mono text-sm">{item.item_codigo}</td>
                              <td className="p-2">{item.item_nome}</td>
                              <td className="p-2 text-sm">{item.base_nome}</td>
                              <td className="p-2 text-right">{item.estoque_atual}</td>
                              <td className="p-2 text-right">{item.estoque_minimo}</td>
                              <td className="p-2 text-right font-semibold">{item.quantidade_necessaria}</td>
                              <td className="p-2 text-right">
                                R$ {item.valor_unitario?.toFixed(2) || '0.00'}
                              </td>
                              <td className="p-2 text-right font-semibold">
                                R$ {item.valor_total?.toFixed(2) || '0.00'}
                              </td>
                              <td className="p-2">
                                <Badge variant={
                                  item.motivo_compra.includes('Aguardando') ? 'destructive' : 'secondary'
                                }>
                                  {item.motivo_compra}
                                </Badge>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="tempo" className="space-y-4">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Itens por Tempo de Entrega</CardTitle>
                      <CardDescription>
                        Baseado no histórico de entradas dos últimos 12 meses
                      </CardDescription>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleExportExcel('tempo')}
                      disabled={itensPorTempo.length === 0}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Exportar Excel
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-8 w-8 animate-spin" />
                    </div>
                  ) : itensPorTempo.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      Nenhum item com histórico de tempo de entrega
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left p-2">Código</th>
                            <th className="text-left p-2">Nome</th>
                            <th className="text-left p-2">Base</th>
                            <th className="text-right p-2">Estoque</th>
                            <th className="text-right p-2">Tempo Médio</th>
                            <th className="text-left p-2">Última Entrada</th>
                            <th className="text-left p-2">Próxima Estimada</th>
                            <th className="text-left p-2">Urgência</th>
                          </tr>
                        </thead>
                        <tbody>
                          {itensPorTempo.map((item, idx) => (
                            <tr key={idx} className="border-b hover:bg-muted/50">
                              <td className="p-2 font-mono text-sm">{item.item_codigo}</td>
                              <td className="p-2">{item.item_nome}</td>
                              <td className="p-2 text-sm">{item.base_nome}</td>
                              <td className="p-2 text-right">{item.estoque_atual}</td>
                              <td className="p-2 text-right">
                                {item.tempo_medio_entrega_dias} dias
                              </td>
                              <td className="p-2 text-sm">
                                {item.ultima_entrada 
                                  ? new Date(item.ultima_entrada).toLocaleDateString('pt-BR')
                                  : '-'
                                }
                              </td>
                              <td className="p-2 text-sm">
                                {item.proxima_entrada_estimada
                                  ? new Date(item.proxima_entrada_estimada).toLocaleDateString('pt-BR')
                                  : '-'
                                }
                              </td>
                              <td className="p-2">
                                <Badge variant={
                                  item.status_urgencia === 'CRÍTICO' ? 'destructive' :
                                  item.status_urgencia === 'URGENTE' ? 'destructive' :
                                  item.status_urgencia === 'ATENÇÃO' ? 'secondary' : 'outline'
                                }>
                                  {item.status_urgencia}
                                </Badge>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="top3" className="space-y-4">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Top 3 Itens Mais Solicitados</CardTitle>
                      <CardDescription>
                        Baseado nas solicitações dos últimos 90 dias
                      </CardDescription>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleExportExcel('top3')}
                      disabled={top3Itens.length === 0}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Exportar Excel
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-8 w-8 animate-spin" />
                    </div>
                  ) : top3Itens.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      Nenhum item solicitado nos últimos 90 dias
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {top3Itens.map((item, idx) => (
                        <Card key={idx} className="border-2">
                          <CardHeader>
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <Badge variant="default" className="text-lg">
                                    #{idx + 1}
                                  </Badge>
                                  <CardTitle className="text-xl">{item.item_nome}</CardTitle>
                                </div>
                                <CardDescription className="mt-1">
                                  Código: {item.item_codigo} | Categoria: {item.categoria}
                                </CardDescription>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                              <div>
                                <p className="text-sm text-muted-foreground">Total Solicitações</p>
                                <p className="text-2xl font-bold">{item.total_solicitacoes}</p>
                              </div>
                              <div>
                                <p className="text-sm text-muted-foreground">Quantidade Total</p>
                                <p className="text-2xl font-bold">{item.quantidade_total}</p>
                              </div>
                              <div>
                                <p className="text-sm text-muted-foreground">Estoque Atual</p>
                                <p className="text-2xl font-bold">{item.estoque_atual_total}</p>
                              </div>
                              <div>
                                <p className="text-sm text-muted-foreground">Bases com Déficit</p>
                                <p className="text-2xl font-bold text-destructive">
                                  {item.bases_com_deficit}
                                </p>
                              </div>
                            </div>
                            <div className="mt-4 flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">
                                Fornecedor: {item.fornecedor || 'Não informado'}
                              </span>
                              <span className="text-muted-foreground">
                                Última solicitação: {new Date(item.ultima_solicitacao).toLocaleDateString('pt-BR')}
                              </span>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  )
}
