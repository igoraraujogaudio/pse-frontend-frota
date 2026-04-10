'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useNotification } from '@/contexts/NotificationContext'
import { useQuery } from '@tanstack/react-query'
import { estoqueService } from '@/services/estoqueService'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PieChart, TrendingUp, Package, DollarSign, Calendar, Filter, FileSpreadsheet, Database, FileText, ArrowUpRight, ArrowDownRight, Wallet, Receipt, Building2, LineChart } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList } from 'recharts'
import * as XLSX from 'xlsx'
import { PERMISSION_CODES } from '@/hooks/useModularPermissions'
import ProtectedRoute from '@/components/ProtectedRoute'
import { baseService } from '@/services/baseService'
import { useUnifiedPermissions } from '@/hooks/useUnifiedPermissions'

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

// interface RelatorioDashboard {
//   total_itens: number
//   valor_total: number
//   itens_por_categoria: { categoria: string; quantidade: number; valor: number }[]
//   status_estoque: { status: string; quantidade: number }[]
//   top_itens_valor: RelatorioEstoque[]
//   itens_sem_movimentacao: RelatorioEstoque[]
// }

interface MovimentacaoEstoque {
  id: string
  item_id: string
  tipo: 'entrada' | 'saida' | 'transferencia' | 'ajuste' | 'devolucao'
  quantidade: number
  quantidade_anterior?: number
  quantidade_atual?: number
  motivo: string
  documento_referencia?: string
  usuario_id: string
  solicitante_id?: string
  local_origem?: string
  local_destino?: string
  observacoes?: string
  base_id?: string
  criado_em: string
  item?: {
    id: string
    nome: string
    codigo: string
    categoria: string
    valor_unitario?: number
  }
  usuario?: {
    id: string
    nome: string
  }
  solicitante?: {
    id: string
    nome: string
  }
  base?: {
    id: string
    nome: string
  }
}

interface MovimentacaoFinanceira {
  tipo: 'entrada' | 'saida'
  quantidade: number
  valor_unitario: number
  valor_total: number
  data: string
  item_nome: string
  item_codigo: string
  categoria: string
  motivo: string
  documento_referencia?: string
  usuario_nome?: string
  base_nome?: string
}

export default function RelatoriosEstoquePage() {
  return (
    <ProtectedRoute requiredPermissions={[
      PERMISSION_CODES.ALMOXARIFADO.RELATORIOS_FINANCEIROS
    ]}>
      <RelatoriosContent />
    </ProtectedRoute>
  );
}

function RelatoriosContent() {
  const { notify } = useNotification()
  const { hasBaseAccess } = useUnifiedPermissions()
  
  const [activeTab, setActiveTab] = useState('dashboard')
  const [periodo, setPeriodo] = useState<'hoje' | 'semana' | 'mes' | 'trimestre' | 'ano'>('mes')
  const [dataInicio, setDataInicio] = useState('')
  const [dataFim, setDataFim] = useState('')
  const [exportando, setExportando] = useState(false)
  const [tipoMovimentacao, setTipoMovimentacao] = useState<'todas' | 'entrada' | 'saida'>('todas')
  const [selectedBases, setSelectedBases] = useState<string[]>([])
  const [mesSelecionado, setMesSelecionado] = useState(new Date().toISOString().slice(0, 7))
  const [anoSelecionado, setAnoSelecionado] = useState(new Date().getFullYear().toString())
  const [periodoPersonalizado, setPeriodoPersonalizado] = useState(false)
  const [dataInicioDashboard, setDataInicioDashboard] = useState('')
  const [dataFimDashboard, setDataFimDashboard] = useState('')

  // React Query para bases
  const { data: allBases = [] } = useQuery({
    queryKey: ['bases-ativas'],
    queryFn: () => baseService.getBasesAtivas(),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
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

  // React Query para dados do dashboard (dia a dia)
  const { data: dadosDashboard, isLoading: loadingDashboard } = useQuery({
    queryKey: ['dashboard-dia-a-dia', mesSelecionado, anoSelecionado, periodoPersonalizado, dataInicioDashboard, dataFimDashboard, tipoMovimentacao, selectedBases, bases.map(b => b.id)],
    queryFn: async () => {
      try {
        // Calcular período baseado no filtro selecionado
        let dataInicio: string
        let dataFim: string

        if (periodoPersonalizado && dataInicioDashboard && dataFimDashboard) {
          // Usar período personalizado
          dataInicio = dataInicioDashboard
          dataFim = dataFimDashboard
        } else if (mesSelecionado) {
          // Usar mês selecionado
          const [ano, mes] = mesSelecionado.split('-')
          dataInicio = `${ano}-${mes}-01`
          const ultimoDia = new Date(parseInt(ano), parseInt(mes), 0).getDate()
          dataFim = `${ano}-${mes}-${ultimoDia.toString().padStart(2, '0')}`
        } else {
          // Usar ano selecionado
          dataInicio = `${anoSelecionado}-01-01`
          dataFim = `${anoSelecionado}-12-31`
        }

        const movimentacoes = await estoqueService.getMovimentacoesPorPeriodo(dataInicio, dataFim)

        // Filtrar por tipo
        let movimentacoesFiltradas = movimentacoes
        if (tipoMovimentacao !== 'todas') {
          movimentacoesFiltradas = movimentacoes.filter((mov: MovimentacaoEstoque) => mov.tipo === tipoMovimentacao)
        }

        // Filtrar por bases
        const baseIdsParaFiltrar = selectedBases.length === 0 ? bases.map(base => base.id) : selectedBases
        movimentacoesFiltradas = movimentacoesFiltradas.filter((mov: MovimentacaoEstoque) => 
          mov.base_id && baseIdsParaFiltrar.includes(mov.base_id)
        )

        // Criar mapa de bases para nomes
        const basesMap = new Map(bases.map(b => [b.id, b.nome]))
        const basesAtivas = bases.filter(b => baseIdsParaFiltrar.includes(b.id))

        // Agrupar por dia e por base
        const dadosPorDiaEBase: Record<string, Record<string, { entradas: number; saidas: number; quantidade: number; baseNome: string }>> = {}
        
        movimentacoesFiltradas.forEach((mov: MovimentacaoEstoque) => {
          const data = mov.criado_em.split('T')[0]
          if (!mov.base_id) return
          
          const baseId: string = mov.base_id
          const baseNome = basesMap.get(baseId) || 'Base desconhecida'
          
          if (!dadosPorDiaEBase[data]) {
            dadosPorDiaEBase[data] = {}
          }
          if (!dadosPorDiaEBase[data][baseId]) {
            dadosPorDiaEBase[data][baseId] = { entradas: 0, saidas: 0, quantidade: 0, baseNome }
          }
          
          const valorTotal = (mov.item?.valor_unitario || 0) * mov.quantidade
          
          if (mov.tipo === 'entrada') {
            dadosPorDiaEBase[data][baseId].entradas += valorTotal
          } else if (mov.tipo === 'saida') {
            dadosPorDiaEBase[data][baseId].saidas += valorTotal
          }
          dadosPorDiaEBase[data][baseId].quantidade += 1
        })

        // Converter para array ordenado
        const dadosArray = Object.entries(dadosPorDiaEBase)
          .map(([data, basesDoDia]) => {
            const porBase = Object.entries(basesDoDia).map(([baseId, valores]) => ({
              baseId,
              baseNome: valores.baseNome,
              entradas: valores.entradas,
              saidas: valores.saidas,
              quantidade: valores.quantidade,
              saldo: valores.entradas - valores.saidas
            }))
            
            const totalDia = porBase.reduce((acc, b) => ({
              entradas: acc.entradas + b.entradas,
              saidas: acc.saidas + b.saidas,
              quantidade: acc.quantidade + b.quantidade
            }), { entradas: 0, saidas: 0, quantidade: 0 })

            return {
              data,
              dataFormatada: new Date(data + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
              porBase,
              totalEntradas: totalDia.entradas,
              totalSaidas: totalDia.saidas,
              totalQuantidade: totalDia.quantidade,
              saldo: totalDia.entradas - totalDia.saidas
            }
          })
          .sort((a, b) => a.data.localeCompare(b.data))

        // Calcular totais gerais
        const totalEntradas = dadosArray.reduce((acc, d) => acc + d.totalEntradas, 0)
        const totalSaidas = dadosArray.reduce((acc, d) => acc + d.totalSaidas, 0)
        const totalMovimentacoes = dadosArray.reduce((acc, d) => acc + d.totalQuantidade, 0)

        // Calcular totais por base
        const totaisPorBase: Record<string, { entradas: number; saidas: number; saldo: number }> = {}
        basesAtivas.forEach(base => {
          totaisPorBase[base.id] = { entradas: 0, saidas: 0, saldo: 0 }
        })
        
        dadosArray.forEach(dia => {
          dia.porBase.forEach(baseData => {
            if (totaisPorBase[baseData.baseId]) {
              totaisPorBase[baseData.baseId].entradas += baseData.entradas
              totaisPorBase[baseData.baseId].saidas += baseData.saidas
              totaisPorBase[baseData.baseId].saldo += baseData.saldo
            }
          })
        })

        return {
          dadosPorDia: dadosArray,
          basesAtivas,
          totaisPorBase,
          totalEntradas,
          totalSaidas,
          saldoLiquido: totalEntradas - totalSaidas,
          totalMovimentacoes
        }
      } catch (error) {
        console.error('Erro ao processar dados do dashboard:', error)
        return {
          dadosPorDia: [],
          basesAtivas: [],
          totaisPorBase: {},
          totalEntradas: 0,
          totalSaidas: 0,
          saldoLiquido: 0,
          totalMovimentacoes: 0
        }
      }
    },
    enabled: activeTab === 'dashboard',
    staleTime: 2 * 60 * 1000,
  })

  // React Query para movimentações financeiras
  const { data: movimentacoesFinanceiras, isLoading: loadingMovimentacoes, error: errorMovimentacoes } = useQuery({
    queryKey: ['movimentacoes-financeiras', periodo, dataInicio, dataFim, tipoMovimentacao, selectedBases, bases.map(b => b.id)],
    queryFn: async () => {
      try {
        let movimentacoes = []
      
      if (dataInicio && dataFim) {
        movimentacoes = await estoqueService.getMovimentacoesPorPeriodo(dataInicio, dataFim)
      } else {
        const hoje = new Date().toISOString().split('T')[0]
        let dataInicioFiltro = hoje
        let dataFimFiltro = hoje
        
        switch (periodo) {
          case 'hoje':
            dataInicioFiltro = hoje
            dataFimFiltro = hoje
            break
          case 'semana':
            const semanaAtras = new Date()
            semanaAtras.setDate(semanaAtras.getDate() - 7)
            dataInicioFiltro = semanaAtras.toISOString().split('T')[0]
            dataFimFiltro = hoje
            break
          case 'mes':
            const inicioMes = new Date()
            inicioMes.setDate(1)
            dataInicioFiltro = inicioMes.toISOString().split('T')[0]
            dataFimFiltro = hoje
            break
          case 'trimestre':
            const inicioTrimestre = new Date()
            inicioTrimestre.setMonth(inicioTrimestre.getMonth() - 3)
            dataInicioFiltro = inicioTrimestre.toISOString().split('T')[0]
            dataFimFiltro = hoje
            break
          case 'ano':
            const inicioAno = new Date()
            inicioAno.setMonth(0, 1)
            dataInicioFiltro = inicioAno.toISOString().split('T')[0]
            dataFimFiltro = hoje
            break
        }
        
        movimentacoes = await estoqueService.getMovimentacoesPorPeriodo(dataInicioFiltro, dataFimFiltro)
      }

      // Filtrar por tipo de movimentação
      let movimentacoesFiltradas = movimentacoes
      if (tipoMovimentacao !== 'todas') {
        movimentacoesFiltradas = movimentacoes.filter((mov: MovimentacaoEstoque) => mov.tipo === tipoMovimentacao)
      }
      
      // Filtrar por bases permitidas e selecionadas
      const baseIdsParaFiltrar = selectedBases.length === 0 ? bases.map(base => base.id) : selectedBases
      movimentacoesFiltradas = movimentacoesFiltradas.filter((mov: MovimentacaoEstoque) => 
        mov.base_id && baseIdsParaFiltrar.includes(mov.base_id)
      )

      // Processar movimentações financeiras (incluindo itens sem valor)
      const movimentacoesComValor: MovimentacaoFinanceira[] = movimentacoesFiltradas
        .map((mov: MovimentacaoEstoque) => ({
          tipo: mov.tipo === 'entrada' ? 'entrada' : 'saida',
          quantidade: mov.quantidade,
          valor_unitario: mov.item?.valor_unitario || 0,
          valor_total: (mov.item?.valor_unitario || 0) * mov.quantidade,
          data: mov.criado_em,
          item_nome: mov.item?.nome || '',
          item_codigo: mov.item?.codigo || '',
          categoria: mov.item?.categoria || '',
          motivo: mov.motivo,
          documento_referencia: mov.documento_referencia,
          usuario_nome: mov.usuario?.nome,
          base_nome: mov.base?.nome
        }))

      // Calcular totais
      const totalEntradas = movimentacoesComValor
        .filter(m => m.tipo === 'entrada')
        .reduce((acc, m) => acc + m.valor_total, 0)
      
      const totalSaidas = movimentacoesComValor
        .filter(m => m.tipo === 'saida')
        .reduce((acc, m) => acc + m.valor_total, 0)
      
      const saldoLiquido = totalEntradas - totalSaidas

      // Agrupar por categoria
      const porCategoria = movimentacoesComValor.reduce((acc, mov) => {
        if (!acc[mov.categoria]) {
          acc[mov.categoria] = { entradas: 0, saidas: 0, saldo: 0 }
        }
        if (mov.tipo === 'entrada') {
          acc[mov.categoria].entradas += mov.valor_total
        } else {
          acc[mov.categoria].saidas += mov.valor_total
        }
        acc[mov.categoria].saldo = acc[mov.categoria].entradas - acc[mov.categoria].saidas
        return acc
      }, {} as Record<string, { entradas: number; saidas: number; saldo: number }>)
      
      // Agrupar por base
      const porBase = movimentacoesComValor.reduce((acc, mov) => {
        const baseNome = mov.base_nome || 'Sem Base'
        if (!acc[baseNome]) {
          acc[baseNome] = { entradas: 0, saidas: 0, saldo: 0, quantidade: 0 }
        }
        if (mov.tipo === 'entrada') {
          acc[baseNome].entradas += mov.valor_total
        } else {
          acc[baseNome].saidas += mov.valor_total
        }
        acc[baseNome].saldo = acc[baseNome].entradas - acc[baseNome].saidas
        acc[baseNome].quantidade += 1
        return acc
      }, {} as Record<string, { entradas: number; saidas: number; saldo: number; quantidade: number }>)
      
      // Agrupar por item
      const porItem = movimentacoesComValor.reduce((acc, mov) => {
        const itemKey = `${mov.item_codigo} - ${mov.item_nome}`
        if (!acc[itemKey]) {
          acc[itemKey] = {
            item_nome: mov.item_nome,
            item_codigo: mov.item_codigo,
            categoria: mov.categoria,
            quantidade_entradas: 0,
            quantidade_saidas: 0,
            valor_entradas: 0,
            valor_saidas: 0,
            saldo_quantidade: 0,
            saldo_valor: 0
          }
        }
        if (mov.tipo === 'entrada') {
          acc[itemKey].quantidade_entradas += mov.quantidade
          acc[itemKey].valor_entradas += mov.valor_total
        } else {
          acc[itemKey].quantidade_saidas += mov.quantidade
          acc[itemKey].valor_saidas += mov.valor_total
        }
        acc[itemKey].saldo_quantidade = acc[itemKey].quantidade_entradas - acc[itemKey].quantidade_saidas
        acc[itemKey].saldo_valor = acc[itemKey].valor_entradas - acc[itemKey].valor_saidas
        return acc
      }, {} as Record<string, {
        item_nome: string;
        item_codigo: string;
        categoria: string;
        quantidade_entradas: number;
        quantidade_saidas: number;
        valor_entradas: number;
        valor_saidas: number;
        saldo_quantidade: number;
        saldo_valor: number;
      }>)

        return {
          movimentacoes: movimentacoesComValor,
          totalEntradas,
          totalSaidas,
          saldoLiquido,
          porCategoria,
          porBase,
          porItem,
          quantidadeMovimentacoes: movimentacoesComValor.length
        }
      } catch (error) {
        console.error('Erro ao processar movimentações financeiras:', error)
        return {
          movimentacoes: [],
          totalEntradas: 0,
          totalSaidas: 0,
          saldoLiquido: 0,
          porCategoria: {},
          porBase: {},
          porItem: {},
          quantidadeMovimentacoes: 0
        }
      }
    },
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: false,
  })

  // Log de erros
  React.useEffect(() => {
    if (errorMovimentacoes) {
      console.error('Erro ao carregar movimentações:', errorMovimentacoes)
      notify('Erro ao carregar relatórios financeiros', 'error')
    }
  }, [errorMovimentacoes, notify])


  // Funções de exportação Excel
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const exportarEstoqueCompleto = async (): Promise<void> => {
    try {
      setExportando(true)
      const relatorio = await estoqueService.getRelatorioEstoque()
      
      // Preparar dados para Excel
      const dadosExcel = relatorio.map(item => ({
        'Código': item.codigo || '',
        'Nome': item.nome || '',
        'Categoria': item.categoria || '',
        'Estoque Atual': item.estoque_atual || 0,
        'Estoque Mínimo': item.estoque_minimo || 0,
        'Estoque Máximo': item.estoque_maximo || 0,
        'Valor Unitário': item.valor_unitario || 0,
        'Valor Total': item.valor_total || 0,
        'Status Estoque': item.status_estoque || '',
        'Unidade Medida': item.unidade_medida || '',
        'Base': item.base?.nome || '',
        'Última Movimentação': item.ultima_movimentacao ? 
          new Date(item.ultima_movimentacao).toLocaleDateString('pt-BR') : '',
        'Criado em': item.criado_em ? 
          new Date(item.criado_em).toLocaleDateString('pt-BR') : '',
        'Observações': item.observacoes || ''
      }))

      // Criar workbook
      const wb = XLSX.utils.book_new()
      const ws = XLSX.utils.json_to_sheet(dadosExcel)
      
      // Configurar larguras das colunas
      const colWidths = [
        { wch: 15 }, // Código
        { wch: 30 }, // Nome
        { wch: 15 }, // Categoria
        { wch: 12 }, // Estoque Atual
        { wch: 12 }, // Estoque Mínimo
        { wch: 12 }, // Estoque Máximo
        { wch: 12 }, // Valor Unitário
        { wch: 12 }, // Valor Total
        { wch: 15 }, // Status Estoque
        { wch: 12 }, // Unidade Medida
        { wch: 20 }, // Base
        { wch: 15 }, // Última Movimentação
        { wch: 15 }, // Criado em
        { wch: 30 }  // Observações
      ]
      ws['!cols'] = colWidths

      XLSX.utils.book_append_sheet(wb, ws, 'Estoque Completo')
      
      // Gerar nome do arquivo com data
      const dataAtual = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')
      const nomeArquivo = `Estoque_Completo_${dataAtual}.xlsx`
      
      // Download
      XLSX.writeFile(wb, nomeArquivo)
      notify('Relatório de estoque exportado com sucesso!', 'success')
    } catch (error) {
      console.error('Erro ao exportar estoque:', error)
      notify('Erro ao exportar relatório de estoque', 'error')
    } finally {
      setExportando(false)
    }
  }

  const exportarMovimentacoes = async () => {
    try {
      setExportando(true)
      
      // Buscar movimentações do backend com filtros de data
      let movimentacoes = []
      
      if (dataInicio && dataFim) {
        // Usar período personalizado
        movimentacoes = await estoqueService.getMovimentacoesPorPeriodo(dataInicio, dataFim)
      } else {
        // Usar período padrão baseado na seleção
        const hoje = new Date().toISOString().split('T')[0]
        let dataInicioFiltro = hoje
        let dataFimFiltro = hoje
        
        switch (periodo) {
          case 'hoje':
            dataInicioFiltro = hoje
            dataFimFiltro = hoje
            break
          case 'semana':
            const semanaAtras = new Date()
            semanaAtras.setDate(semanaAtras.getDate() - 7)
            dataInicioFiltro = semanaAtras.toISOString().split('T')[0]
            dataFimFiltro = hoje
            break
          case 'mes':
            const inicioMes = new Date()
            inicioMes.setDate(1)
            dataInicioFiltro = inicioMes.toISOString().split('T')[0]
            dataFimFiltro = hoje
            break
          case 'trimestre':
            const inicioTrimestre = new Date()
            inicioTrimestre.setMonth(inicioTrimestre.getMonth() - 3)
            dataInicioFiltro = inicioTrimestre.toISOString().split('T')[0]
            dataFimFiltro = hoje
            break
          case 'ano':
            const inicioAno = new Date()
            inicioAno.setMonth(0, 1)
            dataInicioFiltro = inicioAno.toISOString().split('T')[0]
            dataFimFiltro = hoje
            break
        }
        
        movimentacoes = await estoqueService.getMovimentacoesPorPeriodo(dataInicioFiltro, dataFimFiltro)
      }
      
      // Preparar dados para Excel
      const dadosExcel = movimentacoes.map((mov: MovimentacaoEstoque) => ({
        'Data': mov.criado_em ? 
          new Date(mov.criado_em).toLocaleDateString('pt-BR') : '',
        'Item': mov.item?.nome || '',
        'Código': mov.item?.codigo || '',
        'Tipo': mov.tipo || '',
        'Quantidade': mov.quantidade || 0,
        'Quantidade Anterior': mov.quantidade_anterior || 0,
        'Quantidade Atual': mov.quantidade_atual || 0,
        'Usuário': mov.usuario?.nome || '',
        'Solicitante': mov.solicitante?.nome || '',
        'Motivo': mov.motivo || '',
        'Observações': mov.observacoes || '',
        'Base': mov.base?.nome || '',
        'Local Origem': mov.local_origem || '',
        'Local Destino': mov.local_destino || '',
        'Documento Referência': mov.documento_referencia || ''
      }))

      // Criar workbook
      const wb = XLSX.utils.book_new()
      const ws = XLSX.utils.json_to_sheet(dadosExcel)
      
      // Configurar larguras das colunas
      const colWidths = [
        { wch: 12 }, // Data
        { wch: 30 }, // Item
        { wch: 15 }, // Código
        { wch: 15 }, // Tipo
        { wch: 12 }, // Quantidade
        { wch: 15 }, // Quantidade Anterior
        { wch: 15 }, // Quantidade Atual
        { wch: 20 }, // Usuário
        { wch: 20 }, // Solicitante
        { wch: 30 }, // Motivo
        { wch: 30 }, // Observações
        { wch: 20 }, // Base
        { wch: 20 }, // Local Origem
        { wch: 20 }, // Local Destino
        { wch: 20 }  // Documento Referência
      ]
      ws['!cols'] = colWidths

      XLSX.utils.book_append_sheet(wb, ws, 'Movimentações')
      
      // Gerar nome do arquivo com data
      const dataAtual = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')
      const nomeArquivo = `Movimentacoes_Estoque_${dataAtual}.xlsx`
      
      // Download
      XLSX.writeFile(wb, nomeArquivo)
      notify('Relatório de movimentações exportado com sucesso!', 'success')
    } catch (error) {
      console.error('Erro ao exportar movimentações:', error)
      notify('Erro ao exportar relatório de movimentações', 'error')
    } finally {
      setExportando(false)
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const exportarSolicitacoes = async (): Promise<void> => {
    try {
      setExportando(true)
      
      // Buscar todas as solicitações
      const [pendentes, aprovadas, rejeitadas, aguardandoEstoque] = await Promise.all([
        estoqueService.getSolicitacoesPorStatus('pendente'),
        estoqueService.getSolicitacoesPorStatus('aprovada'),
        estoqueService.getSolicitacoesPorStatus('rejeitada'),
        estoqueService.getSolicitacoesPorStatus('aguardando_estoque')
      ])
      
      const todasSolicitacoes = [...pendentes, ...aprovadas, ...rejeitadas, ...aguardandoEstoque]
      
      // Preparar dados para Excel
      const dadosExcel = todasSolicitacoes.map(sol => ({
        'Data Solicitação': sol.criado_em ? 
          new Date(sol.criado_em).toLocaleDateString('pt-BR') : '',
        'Item': sol.item?.nome || '',
        'Código': sol.item?.codigo || '',
        'Solicitante': sol.solicitante?.nome || '',
        'Destinatário': sol.destinatario?.nome || '',
        'Quantidade Solicitada': sol.quantidade_solicitada || 0,
        'Quantidade Aprovada': sol.quantidade_aprovada || 0,
        'Quantidade Entregue': sol.quantidade_entregue || 0,
        'Status': sol.status || '',
        'Prioridade': sol.prioridade || '',
        'Motivo': sol.motivo_solicitacao || '',
        'Tipo Troca': sol.tipo_troca || '',
        'Aprovado por': sol.aprovado_por || '',
        'Data Aprovação': sol.aprovado_em ? 
          new Date(sol.aprovado_em).toLocaleDateString('pt-BR') : '',
        'Entregue por': sol.entregue_por || '',
        'Data Entrega': sol.entregue_em ? 
          new Date(sol.entregue_em).toLocaleDateString('pt-BR') : '',
        'Observações': sol.observacoes || '',
        'Base': sol.base?.nome || ''
      }))

      // Criar workbook
      const wb = XLSX.utils.book_new()
      const ws = XLSX.utils.json_to_sheet(dadosExcel)
      
      // Configurar larguras das colunas
      const colWidths = [
        { wch: 15 }, // Data Solicitação
        { wch: 30 }, // Item
        { wch: 15 }, // Código
        { wch: 20 }, // Solicitante
        { wch: 20 }, // Destinatário
        { wch: 12 }, // Quantidade Solicitada
        { wch: 12 }, // Quantidade Aprovada
        { wch: 12 }, // Quantidade Entregue
        { wch: 15 }, // Status
        { wch: 12 }, // Prioridade
        { wch: 30 }, // Motivo
        { wch: 15 }, // Tipo Troca
        { wch: 20 }, // Aprovado por
        { wch: 15 }, // Data Aprovação
        { wch: 20 }, // Entregue por
        { wch: 15 }, // Data Entrega
        { wch: 30 }, // Observações
        { wch: 20 }, // Contrato Origem
        { wch: 20 }  // Base Destino
      ]
      ws['!cols'] = colWidths

      XLSX.utils.book_append_sheet(wb, ws, 'Solicitações')
      
      // Gerar nome do arquivo com data
      const dataAtual = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')
      const nomeArquivo = `Solicitacoes_Estoque_${dataAtual}.xlsx`
      
      // Download
      XLSX.writeFile(wb, nomeArquivo)
      notify('Relatório de solicitações exportado com sucesso!', 'success')
    } catch (error) {
      console.error('Erro ao exportar solicitações:', error)
      notify('Erro ao exportar relatório de solicitações', 'error')
    } finally {
      setExportando(false)
    }
  }

  // Função para exportar Relatório Zeus (com códigos formatados em 13 dígitos)
  const exportarMovimentacoesFinanceiras = async () => {
    try {
      setExportando(true)
      
      if (!movimentacoesFinanceiras?.movimentacoes) {
        notify('Nenhuma movimentação financeira para exportar', 'warning')
        return
      }
      
      // Preparar dados para Excel
      const dadosExcel: Array<Record<string, string | number>> = movimentacoesFinanceiras.movimentacoes.map((mov: MovimentacaoFinanceira) => ({
        'Data': new Date(mov.data).toLocaleDateString('pt-BR'),
        'Tipo': mov.tipo === 'entrada' ? 'ENTRADA' : 'SAÍDA',
        'Item': mov.item_nome,
        'Código': mov.item_codigo,
        'Categoria': mov.categoria,
        'Quantidade': mov.quantidade,
        'Valor Unitário': mov.valor_unitario,
        'Valor Total': mov.valor_total,
        'Motivo': mov.motivo,
        'Documento': mov.documento_referencia || '',
        'Usuário': mov.usuario_nome || '',
        'Base': mov.base_nome || ''
      }))

      // Adicionar linha de totais
      dadosExcel.push({
        'Data': '',
        'Tipo': 'TOTAIS',
        'Item': '',
        'Código': '',
        'Categoria': '',
        'Quantidade': '',
        'Valor Unitário': '',
        'Valor Total': '',
        'Motivo': '',
        'Documento': '',
        'Usuário': ''
      })
      
      dadosExcel.push({
        'Data': '',
        'Tipo': 'Total Entradas',
        'Item': '',
        'Código': '',
        'Categoria': '',
        'Quantidade': '',
        'Valor Unitário': '',
        'Valor Total': movimentacoesFinanceiras.totalEntradas,
        'Motivo': '',
        'Documento': '',
        'Usuário': ''
      })
      
      dadosExcel.push({
        'Data': '',
        'Tipo': 'Total Saídas',
        'Item': '',
        'Código': '',
        'Categoria': '',
        'Quantidade': '',
        'Valor Unitário': '',
        'Valor Total': movimentacoesFinanceiras.totalSaidas,
        'Motivo': '',
        'Documento': '',
        'Usuário': ''
      })
      
      dadosExcel.push({
        'Data': '',
        'Tipo': 'Saldo Líquido',
        'Item': '',
        'Código': '',
        'Categoria': '',
        'Quantidade': '',
        'Valor Unitário': '',
        'Valor Total': movimentacoesFinanceiras.saldoLiquido,
        'Motivo': '',
        'Documento': '',
        'Usuário': ''
      })

      // Criar workbook
      const wb = XLSX.utils.book_new()
      const ws = XLSX.utils.json_to_sheet(dadosExcel)
      
      // Configurar larguras das colunas
      const colWidths = [
        { wch: 12 },  // Data
        { wch: 10 },  // Tipo
        { wch: 35 },  // Item
        { wch: 15 },  // Código
        { wch: 20 },  // Categoria
        { wch: 12 },  // Quantidade
        { wch: 15 },  // Valor Unitário
        { wch: 15 },  // Valor Total
        { wch: 30 },  // Motivo
        { wch: 20 },  // Documento
        { wch: 25 },  // Usuário
        { wch: 25 }   // Base
      ]
      ws['!cols'] = colWidths

      XLSX.utils.book_append_sheet(wb, ws, 'Movimentações Financeiras')
      
      // Gerar nome do arquivo com data
      const dataAtual = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')
      const nomeArquivo = `Movimentacoes_Financeiras_${dataAtual}.xlsx`
      
      // Download
      XLSX.writeFile(wb, nomeArquivo)
      notify('Relatório financeiro exportado com sucesso!', 'success')
    } catch (error) {
      console.error('Erro ao exportar movimentações financeiras:', error)
      notify('Erro ao exportar relatório financeiro', 'error')
    } finally {
      setExportando(false)
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const exportarRelatorioZeus = async (): Promise<void> => {
    try {
      setExportando(true)
      const relatorio = await estoqueService.getRelatorioEstoque()
      
      // Preparar dados para Excel com códigos formatados em 13 dígitos
      const dadosExcel = relatorio.map(item => ({
        'Código': formatarCodigoZeus(item.codigo), // Código formatado com 13 dígitos
        'Nome': item.nome || '',
        'Categoria': item.categoria || '',
        'Estoque Atual': item.estoque_atual || 0,
        'Estoque Mínimo': item.estoque_minimo || 0,
        'Estoque Máximo': item.estoque_maximo || 0,
        'Valor Unitário': item.valor_unitario || 0,
        'Valor Total': item.valor_total || 0,
        'Status Estoque': item.status_estoque || '',
        'Unidade Medida': item.unidade_medida || '',
        'Base': item.base?.nome || '',
        'Última Movimentação': item.ultima_movimentacao ? 
          new Date(item.ultima_movimentacao).toLocaleDateString('pt-BR') : '',
        'Criado em': item.criado_em ? 
          new Date(item.criado_em).toLocaleDateString('pt-BR') : '',
        'Observações': item.observacoes || ''
      }))

      // Criar workbook
      const wb = XLSX.utils.book_new()
      const ws = XLSX.utils.json_to_sheet(dadosExcel)
      
      // Configurar larguras das colunas
      const colWidths = [
        { wch: 15 }, // Código (13 dígitos)
        { wch: 30 }, // Nome
        { wch: 15 }, // Categoria
        { wch: 12 }, // Estoque Atual
        { wch: 12 }, // Estoque Mínimo
        { wch: 12 }, // Estoque Máximo
        { wch: 12 }, // Valor Unitário
        { wch: 12 }, // Valor Total
        { wch: 15 }, // Status Estoque
        { wch: 12 }, // Unidade Medida
        { wch: 20 }, // Base
        { wch: 15 }, // Última Movimentação
        { wch: 15 }, // Criado em
        { wch: 30 }  // Observações
      ]
      ws['!cols'] = colWidths

      XLSX.utils.book_append_sheet(wb, ws, 'Relatório Zeus')
      
      // Gerar nome do arquivo com data
      const dataAtual = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')
      const nomeArquivo = `Relatorio_Zeus_Estoque_${dataAtual}.xlsx`
      
      // Download
      XLSX.writeFile(wb, nomeArquivo)
      notify('Relatório Zeus exportado com sucesso!', 'success')
    } catch (error) {
      console.error('Erro ao exportar Relatório Zeus:', error)
      notify('Erro ao exportar Relatório Zeus', 'error')
    } finally {
      setExportando(false)
    }
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value)
  }

  // Função para formatar código com 13 dígitos (preenchendo com zeros à esquerda)
  const formatarCodigoZeus = (codigo: string | number): string => {
    const codigoStr = String(codigo || '')
    return codigoStr.padStart(13, '0')
  }

  // const getStatusColor = (status: string): string => {
  //   switch (status) {
  //     case 'normal': return 'bg-green-100 text-green-800'
  //     case 'baixo': return 'bg-yellow-100 text-yellow-800'
  //     case 'critico': return 'bg-red-100 text-red-800'
  //     default: return 'bg-gray-100 text-gray-800'
  //   }
  // }

  const getCategoriaColor = (categoria: string) => {
    const colors = [
      'bg-blue-100 text-blue-800',
      'bg-green-100 text-green-800',
      'bg-purple-100 text-purple-800',
      'bg-orange-100 text-orange-800',
      'bg-red-100 text-red-800',
      'bg-indigo-100 text-indigo-800'
    ]
    const index = categoria.charCodeAt(0) % colors.length
    return colors[index]
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Wallet className="h-8 w-8 text-green-600" />
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Relatórios Financeiros - Almoxarifado</h1>
            <p className="text-gray-600">Movimentações financeiras de entrada e saída de materiais</p>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2 mb-6">
          <TabsTrigger value="dashboard" className="flex items-center gap-2">
            <LineChart className="h-4 w-4" />
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="relatorios" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Relatórios
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-6">
          {/* Filtros do Dashboard */}
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-4">
                <div className="flex items-center gap-4 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4 text-gray-500" />
                    <span className="text-sm font-medium text-gray-700">Filtros:</span>
                  </div>
                  
                  {!periodoPersonalizado ? (
                    <>
                      <div className="flex items-center gap-2">
                        <Label htmlFor="mes" className="text-sm">Mês:</Label>
                        <Input
                          id="mes"
                          type="month"
                          value={mesSelecionado}
                          onChange={(e) => setMesSelecionado(e.target.value)}
                          className="w-40"
                        />
                      </div>

                      <div className="flex items-center gap-2">
                        <Label htmlFor="ano" className="text-sm">Ano:</Label>
                        <Select value={anoSelecionado} onValueChange={setAnoSelecionado}>
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Array.from({ length: 5 }, (_, i) => {
                              const year = new Date().getFullYear() - i
                              return <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                            })}
                          </SelectContent>
                        </Select>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center gap-2">
                        <Label htmlFor="dataInicioDash" className="text-sm">Início:</Label>
                        <Input
                          id="dataInicioDash"
                          type="date"
                          value={dataInicioDashboard}
                          onChange={(e) => setDataInicioDashboard(e.target.value)}
                          className="w-40"
                        />
                      </div>

                      <div className="flex items-center gap-2">
                        <Label htmlFor="dataFimDash" className="text-sm">Fim:</Label>
                        <Input
                          id="dataFimDash"
                          type="date"
                          value={dataFimDashboard}
                          onChange={(e) => setDataFimDashboard(e.target.value)}
                          className="w-40"
                        />
                      </div>
                    </>
                  )}

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setPeriodoPersonalizado(!periodoPersonalizado)
                      if (periodoPersonalizado) {
                        setDataInicioDashboard('')
                        setDataFimDashboard('')
                      }
                    }}
                    className="ml-2"
                  >
                    {periodoPersonalizado ? 'Período Padrão' : 'Período Personalizado'}
                  </Button>

                  <div className="flex items-center gap-2 ml-4">
                    <span className="text-sm font-medium text-gray-700">Tipo:</span>
                  </div>
                  <Select value={tipoMovimentacao} onValueChange={(v) => setTipoMovimentacao(v as 'todas' | 'entrada' | 'saida')}>
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todas">Todas</SelectItem>
                      <SelectItem value="entrada">Entradas</SelectItem>
                      <SelectItem value="saida">Saídas</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Filtro de Bases */}
                {bases.length > 0 && (
                  <div className="flex items-start gap-4 pt-4 border-t">
                    <div className="flex items-center gap-2 min-w-[80px]">
                      <Database className="h-4 w-4 text-gray-500" />
                      <span className="text-sm font-medium text-gray-700">Bases:</span>
                    </div>
                    <div className={`${
                      selectedBases.length > 1 && selectedBases.length < bases.length 
                        ? 'flex-1' 
                        : 'w-full sm:w-auto sm:min-w-[300px]'
                    }`}>
                      <MultiSelectBases
                        options={bases.map(base => ({ id: base.id, nome: base.nome }))}
                        value={selectedBases}
                        onChange={setSelectedBases}
                        placeholder="Selecione as bases..."
                      />
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Gráficos e Visualizações do Dashboard */}
          {loadingDashboard ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Carregando dados do dashboard...</p>
            </div>
          ) : dadosDashboard ? (
            <div className="space-y-6">
              {/* Cards de Resumo */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="border-green-200 bg-green-50">
                  <CardHeader className="pb-2">
                    <CardDescription className="flex items-center gap-2 text-green-700">
                      <ArrowUpRight className="h-4 w-4" />
                      Total Entradas
                    </CardDescription>
                    <CardTitle className="text-2xl text-green-700">
                      {formatCurrency(dadosDashboard.totalEntradas)}
                    </CardTitle>
                  </CardHeader>
                </Card>
                <Card className="border-red-200 bg-red-50">
                  <CardHeader className="pb-2">
                    <CardDescription className="flex items-center gap-2 text-red-700">
                      <ArrowDownRight className="h-4 w-4" />
                      Total Saídas
                    </CardDescription>
                    <CardTitle className="text-2xl text-red-700">
                      {formatCurrency(dadosDashboard.totalSaidas)}
                    </CardTitle>
                  </CardHeader>
                </Card>
                <Card className={`border-2 ${dadosDashboard.saldoLiquido >= 0 ? 'border-blue-300 bg-blue-50' : 'border-orange-300 bg-orange-50'}`}>
                  <CardHeader className="pb-2">
                    <CardDescription className={`flex items-center gap-2 ${dadosDashboard.saldoLiquido >= 0 ? 'text-blue-700' : 'text-orange-700'}`}>
                      <Wallet className="h-4 w-4" />
                      Saldo Líquido
                    </CardDescription>
                    <CardTitle className={`text-2xl ${dadosDashboard.saldoLiquido >= 0 ? 'text-blue-700' : 'text-orange-700'}`}>
                      {formatCurrency(dadosDashboard.saldoLiquido)}
                    </CardTitle>
                  </CardHeader>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription className="flex items-center gap-2">
                      <Receipt className="h-4 w-4" />
                      Movimentações
                    </CardDescription>
                    <CardTitle className="text-2xl text-slate-700">
                      {dadosDashboard.totalMovimentacoes}
                    </CardTitle>
                  </CardHeader>
                </Card>
              </div>

              {/* Gráfico de Barras Dia a Dia */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart className="h-5 w-5" />
                    Movimentações Dia a Dia
                  </CardTitle>
                  <CardDescription>Visualização diária de entradas e saídas no período selecionado</CardDescription>
                </CardHeader>
                <CardContent>
                  {dadosDashboard.dadosPorDia.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                      <Package className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                      <p>Nenhuma movimentação encontrada no período selecionado</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Legenda de Bases - Apenas Saídas */}
                      <div className="flex items-center justify-center gap-4 flex-wrap mb-4 pb-4 border-b">
                        {dadosDashboard.basesAtivas.map((base, index) => {
                          const cores = [
                            'bg-blue-500',
                            'bg-green-500',
                            'bg-purple-500',
                            'bg-orange-500',
                            'bg-pink-500',
                            'bg-indigo-500',
                          ]
                          const cor = cores[index % cores.length]
                          const totais = dadosDashboard.totaisPorBase[base.id]
                          
                          return (
                            <div key={base.id} className="flex items-center gap-2 text-sm">
                              <div className={`w-4 h-4 ${cor} rounded`}></div>
                              <span className="font-medium">{base.nome}</span>
                              {totais && (
                                <span className="text-xs text-gray-500">
                                  ({formatCurrency(totais.saidas)})
                                </span>
                              )}
                            </div>
                          )
                        })}
                      </div>

                      {/* Gráfico de Colunas - Eixo X: Dias, Eixo Y: Valores */}
                      <div className="overflow-x-auto pb-4">
                        {(() => {
                          // Calcular valor máximo para escala do eixo Y (maior total de saídas em um único dia)
                          // const maxValorBruto = Math.max(
                          //   ...dadosDashboard.dadosPorDia.map(d => d.totalSaidas),
                          //   1
                          // )
                          
                          // Arredondar para cima para um valor mais legível
                          // const ordemGrandeza = Math.pow(10, Math.floor(Math.log10(maxValorBruto)))
                          // const maxValor = Math.ceil(maxValorBruto / ordemGrandeza) * ordemGrandeza


                          // Cores para cada base
                          const coresRecharts = [
                            '#3b82f6', // blue-500
                            '#22c55e', // green-500
                            '#a855f7', // purple-500
                            '#f97316', // orange-500
                            '#ec4899', // pink-500
                            '#6366f1', // indigo-500
                          ]

                          // Transformar dados para formato do Recharts (garantir todas as bases com 0)
                          const dadosGrafico = dadosDashboard.dadosPorDia.map(dia => {
                            const diaData: Record<string, string | number> = { data: dia.dataFormatada }
                            dadosDashboard.basesAtivas.forEach(base => {
                              diaData[base.nome] = 0
                            })
                            dia.porBase.forEach(baseData => {
                              diaData[baseData.baseNome] = baseData.saidas || 0
                            })
                            return diaData
                          })

                          // Identificar bases que realmente têm dados no período
                          const basesComDados = new Set<string>()
                          dadosDashboard.dadosPorDia.forEach(dia => {
                            dia.porBase.forEach(baseData => {
                              if (baseData.saidas > 0) {
                                basesComDados.add(baseData.baseNome)
                              }
                            })
                          })

                          // Filtrar apenas bases ativas que têm dados
                          const basesParaRenderizar = dadosDashboard.basesAtivas.filter(base => 
                            basesComDados.has(base.nome)
                          )

                          // Calcular totais por dia para exibir acima das colunas
                          const totaisPorDia = dadosGrafico.map(dia => {
                            const total = Object.keys(dia)
                              .filter(key => key !== 'data')
                              .reduce((sum, key) => {
                                const value = dia[key]
                                return sum + (typeof value === 'number' ? value : 0)
                              }, 0)
                            return { ...dia, total }
                          })

                          // Tooltip customizado
                          const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) => {
                            if (active && payload && payload.length) {
                              // Calcular total
                              const total = payload.reduce((sum: number, entry: { value: number }) => sum + (entry.value || 0), 0)
                              
                              return (
                                <div className="bg-gray-900 text-white p-3 rounded-lg shadow-xl border border-gray-700">
                                  <p className="font-semibold mb-2">{label}</p>
                                  {payload.map((entry: { name: string; value: number; color: string }, index: number) => (
                                    <div key={index} className="flex items-center gap-2 text-sm">
                                      <div className="w-3 h-3 rounded" style={{ backgroundColor: entry.color }}></div>
                                      <span className="text-gray-300">{entry.name}:</span>
                                      <span className="font-medium">{formatCurrency(entry.value)}</span>
                                    </div>
                                  ))}
                                  <div className="border-t border-gray-700 mt-2 pt-2 flex justify-between text-sm">
                                    <span className="text-gray-300 font-semibold">Total:</span>
                                    <span className="font-bold text-green-400">{formatCurrency(total)}</span>
                                  </div>
                                </div>
                              )
                            }
                            return null
                          }

                          // Componente para renderizar totais acima das barras
                          const renderTotaisCustomizados = (baseIndex: number) => {
                            const LabelComponent = (props: { x: number; y: number; width: number; height: number; index: number }) => {
                            const { x, y, width, index } = props
                            
                            // Pegar dados do dia atual
                            const dia = totaisPorDia[index]
                            if (!dia) return null
                            
                            const valoresDoDia = basesParaRenderizar.map(base => {
                              const value = dia[base.nome as keyof typeof dia]
                              return typeof value === 'number' ? value : 0
                            })
                            const totalDoDia = valoresDoDia.reduce((sum, v) => sum + v, 0)
                            if (totalDoDia <= 0) return null

                            const maiorValorDoDia = Math.max(...valoresDoDia, 0)
                            
                            // Verificar se esta barra é a mais alta do dia
                            const baseNome = basesParaRenderizar[baseIndex]?.nome
                            const valorDestaBarra = baseNome ? (typeof dia[baseNome as keyof typeof dia] === 'number' ? dia[baseNome as keyof typeof dia] as number : 0) : 0
                            if (valorDestaBarra !== maiorValorDoDia) return null
                            
                            const numBarras = basesParaRenderizar.length
                            const barWidth = width
                            const gapEntreBars = 8
                            
                            // Calcular posição X da primeira barra a partir da posição atual
                            const offsetParaPrimeira = (barWidth + gapEntreBars) * baseIndex
                            const primeiraBarraX = x - offsetParaPrimeira
                            const grupoWidth = (numBarras * barWidth) + ((numBarras - 1) * gapEntreBars)
                            const centroDia = primeiraBarraX + (grupoWidth / 2)
                            const linhaX2 = primeiraBarraX + grupoWidth
                            
                            // Usar o Y desta barra (que é a mais alta)
                            const yTexto = y - 10
                            const yLinha = y - 2

                            return (
                              <g>
                                <text
                                  x={centroDia}
                                  y={yTexto}
                                  fill="#1f2937"
                                  textAnchor="middle"
                                  fontSize="12"
                                  fontWeight="700"
                                >
                                  {formatCurrency(totalDoDia)}
                                </text>
                                <line
                                  x1={primeiraBarraX}
                                  x2={linhaX2}
                                  y1={yLinha}
                                  y2={yLinha}
                                  stroke="#9ca3af"
                                  strokeWidth="2"
                                />
                              </g>
                            )
                          }
                          LabelComponent.displayName = `TotalLabel_${baseIndex}`
                          return LabelComponent
                          }

                          return (
                            <div className="w-full h-[600px] px-1 py-1">
                              <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={totaisPorDia} margin={{ top: 40, right: 10, left: 10, bottom: 30 }} barGap={8}>
                                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                                  <XAxis 
                                    dataKey="data" 
                                    tick={{ fontSize: 12, fill: '#374151' }}
                                    tickLine={false}
                                    axisLine={{ stroke: '#d1d5db' }}
                                  />
                                  <YAxis 
                                    tickFormatter={(value) => formatCurrency(value)}
                                    tick={{ fontSize: 12, fill: '#6b7280' }}
                                  />
                                  <Tooltip content={<CustomTooltip />} />
                                  {basesParaRenderizar.map((base, index) => {
                                    return (
                                      <Bar 
                                        key={base.id}
                                        dataKey={base.nome}
                                        fill={coresRecharts[index % coresRecharts.length]}
                                      >
                                        <LabelList content={renderTotaisCustomizados(index) as never} />
                                      </Bar>
                                    )
                                  })}
                                </BarChart>
                              </ResponsiveContainer>
                            </div>
                          )
                        })()}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : null}
        </TabsContent>

        <TabsContent value="relatorios" className="space-y-6">

          {/* Filtros e Exportações */}
          <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="space-y-4">
            {/* Filtros */}
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-gray-500" />
                <span className="text-sm font-medium text-gray-700">Período:</span>
              </div>
              <Select value={periodo} onValueChange={(v) => {
                setPeriodo(v as 'hoje' | 'semana' | 'mes' | 'trimestre' | 'ano')
                setDataInicio('')
                setDataFim('')
              }}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hoje">Hoje</SelectItem>
                  <SelectItem value="semana">Últimos 7 dias</SelectItem>
                  <SelectItem value="mes">Mês atual</SelectItem>
                  <SelectItem value="trimestre">Trimestre</SelectItem>
                  <SelectItem value="ano">Ano atual</SelectItem>
                </SelectContent>
              </Select>
              
              <div className="flex items-center gap-2 ml-4">
                <span className="text-sm font-medium text-gray-700">Tipo:</span>
              </div>
              <Select value={tipoMovimentacao} onValueChange={(v) => setTipoMovimentacao(v as 'todas' | 'entrada' | 'saida')}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas</SelectItem>
                  <SelectItem value="entrada">Entradas</SelectItem>
                  <SelectItem value="saida">Saídas</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Filtro de Bases */}
            {bases.length > 0 && (
              <div className="flex items-start gap-4 pt-4 border-t">
                <div className="flex items-center gap-2 min-w-[80px]">
                  <Database className="h-4 w-4 text-gray-500" />
                  <span className="text-sm font-medium text-gray-700">Bases:</span>
                </div>
                <div className={`${
                  selectedBases.length > 1 && selectedBases.length < bases.length 
                    ? 'flex-1' 
                    : 'w-full sm:w-auto sm:min-w-[300px]'
                }`}>
                  <MultiSelectBases
                    options={bases.map(base => ({ id: base.id, nome: base.nome }))}
                    value={selectedBases}
                    onChange={setSelectedBases}
                    placeholder="Selecione as bases..."
                  />
                </div>
              </div>
            )}

            {/* Filtros por Data */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-gray-500" />
                <span className="text-sm font-medium text-gray-700">Período Personalizado:</span>
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="dataInicio" className="text-sm">De:</Label>
                <Input
                  id="dataInicio"
                  type="date"
                  value={dataInicio}
                  onChange={(e) => setDataInicio(e.target.value)}
                  className="w-40"
                  placeholder="dd/mm/aaaa"
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="dataFim" className="text-sm">Até:</Label>
                <Input
                  id="dataFim"
                  type="date"
                  value={dataFim}
                  onChange={(e) => setDataFim(e.target.value)}
                  className="w-40"
                  placeholder="dd/mm/aaaa"
                />
              </div>
            </div>

            {/* Botões de Exportação */}
            <div className="flex items-center gap-2 pt-2 border-t">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium text-gray-700">Exportar Excel:</span>
              </div>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={exportarMovimentacoesFinanceiras}
                  disabled={exportando || !movimentacoesFinanceiras?.movimentacoes?.length}
                  className="bg-green-50 border-green-200 text-green-700 hover:bg-green-100"
                >
                  <DollarSign className="h-4 w-4 mr-2" />
                  Relatório Financeiro
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={exportarMovimentacoes}
                  disabled={exportando}
                >
                  <TrendingUp className="h-4 w-4 mr-2" />
                  Movimentações Completas
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {loadingMovimentacoes ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Carregando movimentações financeiras...</p>
        </div>
      ) : movimentacoesFinanceiras ? (
        <div className="space-y-6">
          {/* Estatísticas Financeiras Principais */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="border-green-200 bg-green-50">
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-2 text-green-700">
                  <ArrowUpRight className="h-4 w-4" />
                  Total Entradas
                </CardDescription>
                <CardTitle className="text-2xl text-green-700">
                  {formatCurrency(movimentacoesFinanceiras.totalEntradas)}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card className="border-red-200 bg-red-50">
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-2 text-red-700">
                  <ArrowDownRight className="h-4 w-4" />
                  Total Saídas
                </CardDescription>
                <CardTitle className="text-2xl text-red-700">
                  {formatCurrency(movimentacoesFinanceiras.totalSaidas)}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card className={`border-2 ${movimentacoesFinanceiras.saldoLiquido >= 0 ? 'border-blue-300 bg-blue-50' : 'border-orange-300 bg-orange-50'}`}>
              <CardHeader className="pb-2">
                <CardDescription className={`flex items-center gap-2 ${movimentacoesFinanceiras.saldoLiquido >= 0 ? 'text-blue-700' : 'text-orange-700'}`}>
                  <Wallet className="h-4 w-4" />
                  Saldo Líquido
                </CardDescription>
                <CardTitle className={`text-2xl ${movimentacoesFinanceiras.saldoLiquido >= 0 ? 'text-blue-700' : 'text-orange-700'}`}>
                  {formatCurrency(movimentacoesFinanceiras.saldoLiquido)}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-2">
                  <Receipt className="h-4 w-4" />
                  Movimentações
                </CardDescription>
                <CardTitle className="text-2xl text-slate-700">
                  {movimentacoesFinanceiras.quantidadeMovimentacoes}
                </CardTitle>
              </CardHeader>
            </Card>
          </div>

          {/* Análises Financeiras */}
          <div className="grid grid-cols-1 gap-6">
            {/* Totais por Base */}
            {Object.keys(movimentacoesFinanceiras.porBase).length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Database className="h-5 w-5" />
                    Totais por Base
                  </CardTitle>
                  <CardDescription>Movimentações financeiras agrupadas por base</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {Object.entries(movimentacoesFinanceiras.porBase)
                      .sort(([, a], [, b]) => Math.abs(b.saldo) - Math.abs(a.saldo))
                      .map(([baseNome, valores]) => (
                      <div key={baseNome} className="group relative p-5 border border-slate-200 rounded-xl bg-gradient-to-br from-white to-slate-50 hover:shadow-md transition-all duration-200">
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex-1">
                            <h3 className="text-lg font-semibold text-slate-800 mb-1">
                              {baseNome}
                            </h3>
                            <span className="text-sm text-slate-500">
                              {valores.quantidade} movimentações
                            </span>
                          </div>
                          <div className={`px-4 py-2 rounded-lg font-bold text-lg ${
                            valores.saldo >= 0 
                              ? 'bg-blue-50 text-blue-700' 
                              : 'bg-orange-50 text-orange-700'
                          }`}>
                            {formatCurrency(valores.saldo)}
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="bg-white rounded-lg p-3 border border-green-100">
                            <div className="text-xs text-slate-600 mb-1">Entradas</div>
                            <div className="text-base font-semibold text-green-600">
                              {formatCurrency(valores.entradas)}
                            </div>
                          </div>
                          <div className="bg-white rounded-lg p-3 border border-red-100">
                            <div className="text-xs text-slate-600 mb-1">Saídas</div>
                            <div className="text-base font-semibold text-red-600">
                              {formatCurrency(valores.saidas)}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Totais por Item */}
            {Object.keys(movimentacoesFinanceiras.porItem).length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Package className="h-5 w-5" />
                    Totais por Item
                  </CardTitle>
                  <CardDescription>Quantidades e valores de entrada/saída por item no período</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-3 px-2 text-sm font-semibold text-gray-700">Item</th>
                          <th className="text-left py-3 px-2 text-sm font-semibold text-gray-700">Categoria</th>
                          <th className="text-right py-3 px-2 text-sm font-semibold text-gray-700">Qtd Entradas</th>
                          <th className="text-right py-3 px-2 text-sm font-semibold text-gray-700">Valor Entradas</th>
                          <th className="text-right py-3 px-2 text-sm font-semibold text-gray-700">Qtd Saídas</th>
                          <th className="text-right py-3 px-2 text-sm font-semibold text-gray-700">Valor Saídas</th>
                          <th className="text-right py-3 px-2 text-sm font-semibold text-gray-700">Saldo Qtd</th>
                          <th className="text-right py-3 px-2 text-sm font-semibold text-gray-700">Saldo Valor</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(movimentacoesFinanceiras.porItem)
                          .sort(([, a], [, b]) => Math.abs(b.saldo_valor) - Math.abs(a.saldo_valor))
                          .map(([itemKey, dados]) => (
                          <tr key={itemKey} className="border-b hover:bg-gray-50">
                            <td className="py-3 px-2 text-sm">
                              <div className="font-medium text-gray-900">{dados.item_nome}</div>
                              <div className="text-xs text-gray-500">{dados.item_codigo}</div>
                            </td>
                            <td className="py-3 px-2 text-sm">
                              <Badge variant="outline" className="text-xs">{dados.categoria}</Badge>
                            </td>
                            <td className="py-3 px-2 text-sm text-right font-medium text-green-700">
                              {dados.quantidade_entradas}
                            </td>
                            <td className="py-3 px-2 text-sm text-right text-green-600">
                              {formatCurrency(dados.valor_entradas)}
                            </td>
                            <td className="py-3 px-2 text-sm text-right font-medium text-red-700">
                              {dados.quantidade_saidas}
                            </td>
                            <td className="py-3 px-2 text-sm text-right text-red-600">
                              {formatCurrency(dados.valor_saidas)}
                            </td>
                            <td className="py-3 px-2 text-sm text-right font-bold">
                              <span className={dados.saldo_quantidade >= 0 ? 'text-blue-600' : 'text-orange-600'}>
                                {dados.saldo_quantidade > 0 ? '+' : ''}{dados.saldo_quantidade}
                              </span>
                            </td>
                            <td className="py-3 px-2 text-sm text-right font-bold">
                              <span className={dados.saldo_valor >= 0 ? 'text-blue-600' : 'text-orange-600'}>
                                {formatCurrency(dados.saldo_valor)}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Movimentações por Categoria */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PieChart className="h-5 w-5" />
                  Movimentações Financeiras por Categoria
                </CardTitle>
                <CardDescription>Entradas, saídas e saldo por categoria</CardDescription>
              </CardHeader>
              <CardContent>
                {Object.keys(movimentacoesFinanceiras.porCategoria).length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Package className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <p>Nenhuma movimentação financeira no período selecionado</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {Object.entries(movimentacoesFinanceiras.porCategoria).map(([categoria, valores]) => (
                      <div key={categoria} className="p-4 border rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <Badge className={getCategoriaColor(categoria)}>
                            {categoria}
                          </Badge>
                          <span className={`font-bold ${valores.saldo >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
                            Saldo: {formatCurrency(valores.saldo)}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div className="flex items-center justify-between">
                            <span className="text-gray-600">Entradas:</span>
                            <span className="font-medium text-green-600">{formatCurrency(valores.entradas)}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-gray-600">Saídas:</span>
                            <span className="font-medium text-red-600">{formatCurrency(valores.saidas)}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

        </div>
      ) : (
        <Card>
          <CardContent className="text-center py-12">
            <Wallet className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p className="text-gray-500">Nenhuma movimentação financeira encontrada</p>
            <p className="text-sm text-gray-400 mt-2">Selecione um período diferente ou verifique se há movimentações com valores cadastrados</p>
          </CardContent>
        </Card>
      )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
