'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ChartBarIcon,
  FunnelIcon,
  ArrowPathIcon,
  TruckIcon,
  WrenchScrewdriverIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ClockIcon,
  ArrowTrendingUpIcon,
  DocumentArrowDownIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { useNotification } from '@/contexts/NotificationContext';
import { PERMISSION_CODES, useModularPermissions } from '@/hooks/useModularPermissions';
import {
  disponibilidadeFrotaService,
  DisponibilidadeRota,
} from '@/services/disponibilidadeRotaService';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area,
} from 'recharts';

const CORES = {
  disponivel: '#10b981',
  em_operacao: '#3b82f6',
  manutencao: '#ef4444',
  em_orcamento: '#f59e0b',
  em_manutencao: '#dc2626',
};

export function DashboardContent() {
  const { notify } = useNotification();
  const { user } = useAuth();
  const { hasPermission } = useModularPermissions();
  const canViewAll = hasPermission(PERMISSION_CODES.DISPONIBILIDADE_FROTA.VISUALIZAR_TODOS_CONTRATOS);

  const [loading, setLoading] = useState(false);
  const [contratos, setContratos] = useState<Array<{ id: string; nome: string; codigo?: string }>>([]);
  const [selectedContrato, setSelectedContrato] = useState('');
  const [registros, setRegistros] = useState<DisponibilidadeRota[]>([]);

  // Filtros de data — padrão: mês atual
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _hoje = disponibilidadeFrotaService.getDataHojeBrasilia();
  const mesAtualInicio = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`; })();
  const mesAtualFim = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()}`; })();
  const mesAtualValue = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; })();
  const [dataInicio, setDataInicio] = useState(mesAtualInicio);
  const [dataFim, setDataFim] = useState(mesAtualFim);
  const [selectedMonth, setSelectedMonth] = useState(mesAtualValue);
  const [modoVisualizacao, setModoVisualizacao] = useState<'diario' | 'mensal'>('diario');

  const loadContratos = useCallback(async () => {
    try {
      const data = await disponibilidadeFrotaService.getContratos();
      const ids = (user as any)?.contratoIds || []; // eslint-disable-line @typescript-eslint/no-explicit-any
      if (canViewAll) { setContratos(data); }
      else { setContratos(data.filter(c => ids.includes(c.id) || (user as any)?.contrato_origem_id === c.id)); } // eslint-disable-line @typescript-eslint/no-explicit-any
    } catch { /* silenciar */ }
  }, [canViewAll, user]);

  const loadDados = useCallback(async () => {
    if (!dataInicio || !dataFim) return;
    setLoading(true);
    try {
      const data = await disponibilidadeFrotaService.getAnalytics({
        contratoId: selectedContrato || undefined,
        dataInicio,
        dataFim,
      });
      setRegistros(data);
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : 'Erro ao carregar dados', 'error');
    } finally {
      setLoading(false);
    }
  }, [selectedContrato, dataInicio, dataFim, notify]);

  useEffect(() => { loadContratos(); }, [loadContratos]);
  useEffect(() => { loadDados(); }, [loadDados]);

  // --- Helpers para extrair join ---
  const getVeiculo = (r: DisponibilidadeRota) => {
    const v: any = Array.isArray(r.veiculo) ? r.veiculo[0] : r.veiculo; // eslint-disable-line @typescript-eslint/no-explicit-any
    return v || { placa: '?', modelo: '?' };
  };
  const getContrato = (r: DisponibilidadeRota) => {
    const c: any = Array.isArray(r.contrato) ? r.contrato[0] : r.contrato; // eslint-disable-line @typescript-eslint/no-explicit-any
    return c || { nome: '?' };
  };

  // === KPIs ===
  const kpis = useMemo(() => {
    const total = registros.length;
    const disponiveis = registros.filter(r => r.status === 'disponivel').length;
    const emOperacao = registros.filter(r => r.status === 'em_operacao').length;
    const manut = registros.filter(r => r.status === 'manutencao').length;
    // Tratar registros antigos sem manutencao_tipo como em_manutencao
    const emManut = registros.filter(r => r.status === 'manutencao' && r.manutencao_tipo !== 'em_orcamento').length;
    const emOrc = registros.filter(r => r.manutencao_tipo === 'em_orcamento').length;
    const veiculosUnicos = new Set(registros.map(r => r.veiculo_id)).size;
    const diasUnicos = new Set(registros.map(r => r.data_referencia)).size;

    // Veículos únicos em operação HOJE (última data do período)
    const ultimaData = registros.length > 0 ? registros.map(r => r.data_referencia).sort().pop() : '';
    const registrosHoje = registros.filter(r => r.data_referencia === ultimaData);
    const veiculosEmOperacaoHoje = new Set(registrosHoje.filter(r => r.status === 'em_operacao').map(r => r.veiculo_id)).size;

    const operacionais = disponiveis + emOperacao;
    const taxaOperacionais = total > 0 ? (operacionais / total * 100).toFixed(1) : '0';
    const taxaDisp = total > 0 ? (disponiveis / total * 100).toFixed(1) : '0';
    const taxaOperacao = total > 0 ? (emOperacao / total * 100).toFixed(1) : '0';
    const taxaManut = total > 0 ? (manut / total * 100).toFixed(1) : '0';

    return { total, disponiveis, emOperacao, operacionais, manut, emManut, emOrc, veiculosUnicos, diasUnicos, veiculosEmOperacaoHoje, taxaOperacionais, taxaDisp, taxaOperacao, taxaManut };
  }, [registros]);

  // === Gráfico: evolução diária ===
  const evolucaoDiaria = useMemo(() => {
    const porDia: Record<string, { data: string; disponivel: number; em_operacao: number; manutencao: number; total: number }> = {};
    registros.forEach(r => {
      if (!porDia[r.data_referencia]) {
        porDia[r.data_referencia] = { data: r.data_referencia, disponivel: 0, em_operacao: 0, manutencao: 0, total: 0 };
      }
      porDia[r.data_referencia][r.status]++;
      porDia[r.data_referencia].total++;
    });
    return Object.values(porDia).sort((a, b) => a.data.localeCompare(b.data)).map(d => ({
      ...d,
      dataLabel: d.data.split('-').reverse().join('/'),
    }));
  }, [registros]);

  // === Gráfico: evolução mensal ===
  const evolucaoMensal = useMemo(() => {
    const porMes: Record<string, { mes: string; disponivel: number; em_operacao: number; manutencao: number; total: number }> = {};
    registros.forEach(r => {
      const mes = r.data_referencia.substring(0, 7); // YYYY-MM
      if (!porMes[mes]) porMes[mes] = { mes, disponivel: 0, em_operacao: 0, manutencao: 0, total: 0 };
      porMes[mes][r.status]++;
      porMes[mes].total++;
    });
    const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    return Object.values(porMes).sort((a, b) => a.mes.localeCompare(b.mes)).map(d => ({
      ...d,
      dataLabel: `${meses[parseInt(d.mes.split('-')[1]) - 1]}/${d.mes.split('-')[0].slice(2)}`,
    }));
  }, [registros]);

  const evolucaoAtual = modoVisualizacao === 'mensal' ? evolucaoMensal : evolucaoDiaria;

  // === Gráfico: pizza distribuição geral ===
  const pizzaStatus = useMemo(() => [
    { name: 'Reserva', value: kpis.disponiveis, color: CORES.disponivel },
    { name: 'Operação', value: kpis.emOperacao, color: CORES.em_operacao },
    { name: 'Manut.', value: kpis.emManut, color: CORES.em_manutencao },
    { name: 'Orçam.', value: kpis.emOrc, color: CORES.em_orcamento },
  ].filter(d => d.value > 0), [kpis]);

  // === Top veículos em manutenção (reincidência) ===
  const topManutencao = useMemo(() => {
    const contagem: Record<string, { placa: string; modelo: string; dias: number; contrato: string }> = {};
    registros.filter(r => r.status === 'manutencao').forEach(r => {
      const v = getVeiculo(r);
      const c = getContrato(r);
      const key = r.veiculo_id;
      if (!contagem[key]) contagem[key] = { placa: v.placa, modelo: v.modelo, dias: 0, contrato: c.nome };
      contagem[key].dias++;
    });
    return Object.values(contagem).sort((a, b) => b.dias - a.dias).slice(0, 15);
  }, [registros]);

  // === Tempo médio em oficina por veículo (dias consecutivos em manutenção) ===
  const tempoOficina = useMemo(() => {
    // Agrupar por veículo todas as datas em manutenção
    const porVeiculo: Record<string, { placa: string; modelo: string; contrato: string; datas: string[] }> = {};
    registros.filter(r => r.status === 'manutencao').forEach(r => {
      const v = getVeiculo(r);
      const c = getContrato(r);
      if (!porVeiculo[r.veiculo_id]) porVeiculo[r.veiculo_id] = { placa: v.placa, modelo: v.modelo, contrato: c.nome, datas: [] };
      porVeiculo[r.veiculo_id].datas.push(r.data_referencia);
    });

    // Para cada veículo, calcular períodos consecutivos
    const resultado: Array<{ placa: string; modelo: string; contrato: string; periodos: number; diasTotal: number; mediaPerido: number }> = [];
    Object.values(porVeiculo).forEach(v => {
      const datas = [...new Set(v.datas)].sort();
      if (datas.length === 0) return;
      let periodos = 1;
      for (let i = 1; i < datas.length; i++) {
        const prev = new Date(datas[i - 1]);
        const curr = new Date(datas[i]);
        const diff = (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24);
        if (diff > 1) periodos++;
      }
      resultado.push({
        placa: v.placa,
        modelo: v.modelo,
        contrato: v.contrato,
        periodos,
        diasTotal: datas.length,
        mediaPerido: Math.round(datas.length / periodos * 10) / 10,
      });
    });
    return resultado.sort((a, b) => b.diasTotal - a.diasTotal).slice(0, 15);
  }, [registros]);

  // === Disponibilidade por contrato ===
  const porContrato = useMemo(() => {
    const agg: Record<string, { nome: string; disponivel: number; em_operacao: number; manutencao: number; total: number }> = {};
    registros.forEach(r => {
      const c = getContrato(r);
      const key = r.contrato_id;
      if (!agg[key]) agg[key] = { nome: c.nome || '?', disponivel: 0, em_operacao: 0, manutencao: 0, total: 0 };
      agg[key][r.status]++;
      agg[key].total++;
    });
    return Object.values(agg).sort((a, b) => b.total - a.total);
  }, [registros]);

  // === Manutenção: tipo breakdown ===
  const manutTipoChart = useMemo(() => {
    const porDia: Record<string, { data: string; em_manutencao: number; em_orcamento: number }> = {};
    registros.filter(r => r.status === 'manutencao').forEach(r => {
      if (!porDia[r.data_referencia]) porDia[r.data_referencia] = { data: r.data_referencia, em_manutencao: 0, em_orcamento: 0 };
      if (r.manutencao_tipo === 'em_orcamento') porDia[r.data_referencia].em_orcamento++;
      else porDia[r.data_referencia].em_manutencao++;
    });
    return Object.values(porDia).sort((a, b) => a.data.localeCompare(b.data)).map(d => ({
      ...d,
      dataLabel: d.data.split('-').reverse().join('/'),
    }));
  }, [registros]);

  // === Taxas ao longo do tempo ===
  const taxaDiaria = useMemo(() => {
    return evolucaoDiaria.map(d => ({
      dataLabel: d.dataLabel,
      operacionais_pct: d.total > 0 ? Math.round((d.disponivel + d.em_operacao) / d.total * 1000) / 10 : 0,
      operacao_pct: d.total > 0 ? Math.round(d.em_operacao / d.total * 1000) / 10 : 0,
      disponivel_pct: d.total > 0 ? Math.round(d.disponivel / d.total * 1000) / 10 : 0,
      manut_pct: d.total > 0 ? Math.round(d.manutencao / d.total * 1000) / 10 : 0,
    }));
  }, [evolucaoDiaria]);

  const taxaMensal = useMemo(() => {
    return evolucaoMensal.map(d => ({
      dataLabel: d.dataLabel,
      operacionais_pct: d.total > 0 ? Math.round((d.disponivel + d.em_operacao) / d.total * 1000) / 10 : 0,
      operacao_pct: d.total > 0 ? Math.round(d.em_operacao / d.total * 1000) / 10 : 0,
      disponivel_pct: d.total > 0 ? Math.round(d.disponivel / d.total * 1000) / 10 : 0,
      manut_pct: d.total > 0 ? Math.round(d.manutencao / d.total * 1000) / 10 : 0,
    }));
  }, [evolucaoMensal]);

  const taxaAtual = modoVisualizacao === 'mensal' ? taxaMensal : taxaDiaria;

  // === Oficinas mais utilizadas ===
  const topOficinas = useMemo(() => {
    const contagem: Record<string, { nome: string; qtd: number }> = {};
    registros.filter(r => r.status === 'manutencao').forEach(r => {
      const nome = r.manutencao_oficina_nome || ((r as any).oficina?.nome) || 'Não informada'; // eslint-disable-line @typescript-eslint/no-explicit-any
      if (!contagem[nome]) contagem[nome] = { nome, qtd: 0 };
      contagem[nome].qtd++;
    });
    return Object.values(contagem).sort((a, b) => b.qtd - a.qtd).slice(0, 10);
  }, [registros]);

  const isoToBr = (iso: string) => {
    if (!iso) return '';
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  };

  const brToIso = (br: string): string => { // eslint-disable-line @typescript-eslint/no-unused-vars
    if (!br || br.length < 10) return '';
    const [d, m, y] = br.split('/');
    return `${y}-${m}-${d}`;
  };

  const formatDateInput = (value: string): string => { // eslint-disable-line @typescript-eslint/no-unused-vars
    const nums = value.replace(/\D/g, '');
    if (nums.length <= 2) return nums;
    if (nums.length <= 4) return `${nums.slice(0, 2)}/${nums.slice(2)}`;
    return `${nums.slice(0, 2)}/${nums.slice(2, 4)}/${nums.slice(4, 8)}`;
  };

  // Export CSV
  const exportCSV = () => {
    if (registros.length === 0) return;
    const header = 'Data;Contrato;Placa;Modelo;Status;Tipo Manutenção;Problema;Previsão;Oficina;Complexidade;Setor;Observações\n';
    const rows = registros.map(r => {
      const v = getVeiculo(r);
      const c = getContrato(r);
      const statusLabel = r.status === 'disponivel' ? 'Disponível' : r.status === 'em_operacao' ? 'Em Operação' : 'Manutenção';
      const tipoLabel = r.manutencao_tipo === 'em_orcamento' ? 'Em Orçamento' : r.manutencao_tipo === 'em_manutencao' ? 'Em Manutenção' : '';
      const complexLabel = r.manutencao_complexidade ? (r.manutencao_complexidade === 'alta' ? 'Alta' : r.manutencao_complexidade === 'media' ? 'Média' : 'Baixa') : '';
      return [
        isoToBr(r.data_referencia),
        c.nome,
        v.placa,
        v.modelo,
        statusLabel,
        tipoLabel,
        (r.manutencao_problema || '').replace(/;/g, ','),
        r.manutencao_previsao ? isoToBr(r.manutencao_previsao) : '',
        r.manutencao_oficina_nome || '',
        complexLabel,
        r.manutencao_setor || '',
        (r.observacoes || '').replace(/;/g, ','),
      ].join(';');
    }).join('\n');
    const bom = '\uFEFF';
    const blob = new Blob([bom + header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `disponibilidade_frota_${dataInicio}_${dataFim}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <ChartBarIcon className="w-7 h-7 text-cyan-600" />
              Dashboard — Disponibilidade de Frota
            </h1>
            <p className="text-sm text-gray-500 mt-1">Análise estratégica de disponibilidade, manutenção e reincidência</p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/disponibilidade-frota-relatorio" className="flex items-center gap-1 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm">
              <DocumentArrowDownIcon className="w-4 h-4" /> Relatório
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto px-6 py-6 space-y-6">
        {/* Filtros */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center gap-3 flex-wrap">
            <FunnelIcon className="w-5 h-5 text-gray-400" />
            <div>
              <label className="text-xs text-gray-500">Contrato</label>
              <select value={selectedContrato} onChange={e => setSelectedContrato(e.target.value)} className="block border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-48">
                <option value="">Todos</option>
                {contratos.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500">Mês</label>
              <input
                type="month"
                value={selectedMonth}
                onChange={e => {
                  if (!e.target.value) return;
                  setSelectedMonth(e.target.value);
                  const [y, m] = e.target.value.split('-').map(Number);
                  const primeiro = `${y}-${String(m).padStart(2, '0')}-01`;
                  const ultimo = `${y}-${String(m).padStart(2, '0')}-${new Date(y, m, 0).getDate()}`;
                  setDataInicio(primeiro);
                  setDataFim(ultimo);
                }}
                className="block border border-gray-300 rounded-lg px-3 py-1.5 text-sm cursor-pointer"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500">De</label>
              <input
                type="date"
                value={dataInicio}
                onChange={e => { if (e.target.value) setDataInicio(e.target.value); }}
                className="block border border-gray-300 rounded-lg px-3 py-1.5 text-sm cursor-pointer"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500">Até</label>
              <input
                type="date"
                value={dataFim}
                onChange={e => { if (e.target.value) setDataFim(e.target.value); }}
                className="block border border-gray-300 rounded-lg px-3 py-1.5 text-sm cursor-pointer"
              />
            </div>
            <button onClick={loadDados} disabled={loading} className="mt-4 flex items-center gap-1 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg text-sm disabled:opacity-50">
              <ArrowPathIcon className={clsx('w-4 h-4', loading && 'animate-spin')} /> Atualizar
            </button>
            <button onClick={exportCSV} disabled={registros.length === 0} className="mt-4 flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm disabled:opacity-50">
              <DocumentArrowDownIcon className="w-4 h-4" /> Exportar CSV
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <ArrowPathIcon className="w-8 h-8 animate-spin text-gray-300" />
          </div>
        ) : registros.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <ChartBarIcon className="w-16 h-16 mx-auto mb-4" />
            <p className="text-lg">Nenhum registro encontrado para o período selecionado</p>
          </div>
        ) : (
          <>
            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
              <KpiCard icon={<TruckIcon className="w-5 h-5" />} label="Veículos" value={kpis.veiculosUnicos} color="text-gray-700" bg="bg-gray-50" />
              <KpiCard icon={<ArrowTrendingUpIcon className="w-5 h-5" />} label="Disponibilidade no Mês" value={`${kpis.taxaOperacionais}%`} sub={`${kpis.operacionais} de ${kpis.total}`} color="text-cyan-700" bg="bg-cyan-50" />
              <KpiCard icon={<CheckCircleIcon className="w-5 h-5" />} label="Reserva" value={`${kpis.taxaDisp}%`} sub={`${kpis.disponiveis}`} color="text-emerald-700" bg="bg-emerald-50" />
              <KpiCard icon={<TruckIcon className="w-5 h-5" />} label="Em Operação %" value={`${kpis.taxaOperacao}%`} sub={`${kpis.emOperacao}`} color="text-blue-700" bg="bg-blue-50" />
              <KpiCard icon={<WrenchScrewdriverIcon className="w-5 h-5" />} label="Manutenção" value={`${kpis.taxaManut}%`} sub={`${kpis.manut}`} color="text-red-700" bg="bg-red-50" />
              <KpiCard icon={<UserGroupIcon className="w-5 h-5" />} label="Em Operação" value={kpis.veiculosEmOperacaoHoje} sub="veículos hoje" color="text-blue-700" bg="bg-blue-50" />
              <KpiCard icon={<WrenchScrewdriverIcon className="w-5 h-5" />} label="Em Manutenção" value={kpis.emManut} color="text-red-600" bg="bg-red-50" />
              <KpiCard icon={<ExclamationTriangleIcon className="w-5 h-5" />} label="Em Orçamento" value={kpis.emOrc} color="text-amber-600" bg="bg-amber-50" />
            </div>

            {/* Row 1: Evolução + Pizza */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                    <ArrowTrendingUpIcon className="w-4 h-4" /> Evolução de Status
                  </h3>
                  <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
                    <button onClick={() => setModoVisualizacao('diario')} className={clsx('px-3 py-1 text-xs rounded-md transition-colors', modoVisualizacao === 'diario' ? 'bg-white shadow text-gray-900 font-medium' : 'text-gray-500 hover:text-gray-700')}>Diário</button>
                    <button onClick={() => setModoVisualizacao('mensal')} className={clsx('px-3 py-1 text-xs rounded-md transition-colors', modoVisualizacao === 'mensal' ? 'bg-white shadow text-gray-900 font-medium' : 'text-gray-500 hover:text-gray-700')}>Mensal</button>
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={evolucaoAtual} barSize={evolucaoAtual.length > 30 ? 8 : 20}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis dataKey="dataLabel" tick={{ fontSize: 10 }} interval={evolucaoAtual.length > 15 ? Math.floor(evolucaoAtual.length / 8) : 0} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend iconSize={10} wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="disponivel" name="Reserva" fill={CORES.disponivel} stackId="a" />
                    <Bar dataKey="em_operacao" name="Em Operação" fill={CORES.em_operacao} stackId="a" />
                    <Bar dataKey="manutencao" name="Manutenção" fill={CORES.manutencao} stackId="a" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                <h3 className="text-sm font-semibold text-gray-800 mb-3">Distribuição Geral</h3>
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie data={pizzaStatus} cx="50%" cy="50%" outerRadius={90} innerRadius={45} dataKey="value" label={({ percent }: { percent?: number }) => `${((percent ?? 0) * 100).toFixed(0)}%`} labelLine={true}>
                      {pizzaStatus.map((d, i) => <Cell key={i} fill={d.color} />)}
                    </Pie>
                    <Tooltip />
                    <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Row 2: Taxa disp + Manutenção por tipo */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                <h3 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                  <CheckCircleIcon className="w-4 h-4 text-cyan-600" /> Taxas ao Longo do Tempo (%)
                </h3>
                <ResponsiveContainer width="100%" height={260}>
                  <AreaChart data={taxaAtual}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis dataKey="dataLabel" tick={{ fontSize: 10 }} interval={taxaAtual.length > 15 ? Math.floor(taxaAtual.length / 8) : 0} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    <Tooltip formatter={(v: any) => `${v}%`} />
                    <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                    <Area type="monotone" dataKey="operacionais_pct" name="Disponibilidade" stroke="#0891b2" fill="#0891b2" fillOpacity={0.08} strokeWidth={2} strokeDasharray="5 3" />
                    <Area type="monotone" dataKey="operacao_pct" name="Em Operação" stroke={CORES.em_operacao} fill={CORES.em_operacao} fillOpacity={0.1} strokeWidth={2} />
                    <Area type="monotone" dataKey="disponivel_pct" name="Reserva" stroke={CORES.disponivel} fill={CORES.disponivel} fillOpacity={0.1} strokeWidth={2} />
                    <Area type="monotone" dataKey="manut_pct" name="Manutenção" stroke={CORES.manutencao} fill={CORES.manutencao} fillOpacity={0.1} strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                <h3 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                  <WrenchScrewdriverIcon className="w-4 h-4 text-red-600" /> Manutenção vs Orçamento
                </h3>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={manutTipoChart} barSize={manutTipoChart.length > 30 ? 8 : 20}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis dataKey="dataLabel" tick={{ fontSize: 10 }} interval={manutTipoChart.length > 15 ? Math.floor(manutTipoChart.length / 8) : 0} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend iconSize={10} wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="em_manutencao" name="Em Manutenção" fill={CORES.em_manutencao} stackId="a" />
                    <Bar dataKey="em_orcamento" name="Em Orçamento" fill={CORES.em_orcamento} stackId="a" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Row 3: Por contrato */}
            {porContrato.length > 1 && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                <h3 className="text-sm font-semibold text-gray-800 mb-3">Disponibilidade por Contrato</h3>
                <ResponsiveContainer width="100%" height={Math.max(200, porContrato.length * 40)}>
                  <BarChart data={porContrato} layout="vertical" barSize={18}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis dataKey="nome" type="category" width={160} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend iconSize={10} wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="disponivel" name="Reserva" fill={CORES.disponivel} stackId="a" />
                    <Bar dataKey="em_operacao" name="Em Operação" fill={CORES.em_operacao} stackId="a" />
                    <Bar dataKey="manutencao" name="Manutenção" fill={CORES.manutencao} stackId="a" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Row 4: Gráficos de Reincidência + Tempo Oficina */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Gráfico Reincidência */}
              {topManutencao.length > 0 && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                  <h3 className="text-sm font-semibold text-red-800 mb-3 flex items-center gap-2">
                    <ExclamationTriangleIcon className="w-4 h-4" /> Reincidência em Manutenção (dias)
                  </h3>
                  <ResponsiveContainer width="100%" height={Math.max(200, topManutencao.length * 32)}>
                    <BarChart data={topManutencao} layout="vertical" barSize={16}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                      <XAxis type="number" tick={{ fontSize: 11 }} />
                      <YAxis dataKey="placa" type="category" width={100} tick={{ fontSize: 10 }} />
                      <Tooltip formatter={(v: any) => [`${v} dias`, 'Dias em manutenção']} /> {/* eslint-disable-line @typescript-eslint/no-explicit-any */}
                      <Bar dataKey="dias" name="Dias" fill={CORES.manutencao} radius={[0, 4, 4, 0]}>
                        {topManutencao.map((d, i) => (
                          <Cell key={i} fill={d.dias >= 10 ? '#dc2626' : d.dias >= 5 ? '#f59e0b' : '#ef4444'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
              {/* Gráfico Tempo em Oficina */}
              {tempoOficina.length > 0 && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                  <h3 className="text-sm font-semibold text-amber-800 mb-3 flex items-center gap-2">
                    <ClockIcon className="w-4 h-4" /> Tempo em Oficina (dias total vs períodos)
                  </h3>
                  <ResponsiveContainer width="100%" height={Math.max(200, tempoOficina.length * 32)}>
                    <BarChart data={tempoOficina} layout="vertical" barSize={14}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                      <XAxis type="number" tick={{ fontSize: 11 }} />
                      <YAxis dataKey="placa" type="category" width={100} tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Legend iconSize={10} wrapperStyle={{ fontSize: 12 }} />
                      <Bar dataKey="diasTotal" name="Dias Total" fill="#f59e0b" radius={[0, 4, 4, 0]} />
                      <Bar dataKey="periodos" name="Períodos" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Row 5: Tabelas detalhadas lado a lado */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Top Reincidência em Manutenção */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="px-4 py-3 bg-red-50 border-b border-red-100">
                  <h3 className="text-sm font-semibold text-red-800 flex items-center gap-2">
                    <ExclamationTriangleIcon className="w-4 h-4" /> Reincidência em Manutenção — Detalhes
                  </h3>
                  <p className="text-xs text-red-600">Veículos com mais dias em manutenção no período</p>
                </div>
                <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-gray-600 sticky top-0">
                      <tr>
                        <th className="text-left px-4 py-2 font-medium">Veículo</th>
                        <th className="text-left px-4 py-2 font-medium">Contrato</th>
                        <th className="text-center px-4 py-2 font-medium">Dias</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {topManutencao.map((v, i) => (
                        <tr key={i} className="hover:bg-gray-50">
                          <td className="px-4 py-2 font-medium text-gray-900">{v.placa} <span className="text-gray-400 font-normal text-xs">{v.modelo}</span></td>
                          <td className="px-4 py-2 text-gray-600">{v.contrato}</td>
                          <td className="px-4 py-2 text-center">
                            <span className={clsx('inline-block px-2 py-0.5 rounded text-xs font-bold', v.dias >= 10 ? 'bg-red-100 text-red-700' : v.dias >= 5 ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-700')}>
                              {v.dias}
                            </span>
                          </td>
                        </tr>
                      ))}
                      {topManutencao.length === 0 && (
                        <tr><td colSpan={3} className="px-4 py-6 text-center text-gray-400">Nenhum veículo em manutenção no período</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Tempo em Oficina */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="px-4 py-3 bg-amber-50 border-b border-amber-100">
                  <h3 className="text-sm font-semibold text-amber-800 flex items-center gap-2">
                    <ClockIcon className="w-4 h-4" /> Tempo em Oficina — Detalhes
                  </h3>
                  <p className="text-xs text-amber-600">Análise de períodos e duração em manutenção</p>
                </div>
                <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-gray-600 sticky top-0">
                      <tr>
                        <th className="text-left px-4 py-2 font-medium">Veículo</th>
                        <th className="text-center px-4 py-2 font-medium">Períodos</th>
                        <th className="text-center px-4 py-2 font-medium">Dias Total</th>
                        <th className="text-center px-4 py-2 font-medium">Média/Período</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {tempoOficina.map((v, i) => (
                        <tr key={i} className="hover:bg-gray-50">
                          <td className="px-4 py-2 font-medium text-gray-900">{v.placa} <span className="text-gray-400 font-normal text-xs">{v.modelo}</span></td>
                          <td className="px-4 py-2 text-center">
                            <span className={clsx('inline-block px-2 py-0.5 rounded text-xs font-bold', v.periodos >= 3 ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700')}>
                              {v.periodos}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-center font-semibold">{v.diasTotal}</td>
                          <td className="px-4 py-2 text-center text-gray-600">{v.mediaPerido} dias</td>
                        </tr>
                      ))}
                      {tempoOficina.length === 0 && (
                        <tr><td colSpan={4} className="px-4 py-6 text-center text-gray-400">Nenhum dado disponível</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Row 5: Top Oficinas */}
            {topOficinas.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                <h3 className="text-sm font-semibold text-gray-800 mb-3">Oficinas Mais Utilizadas</h3>
                <ResponsiveContainer width="100%" height={Math.max(200, topOficinas.length * 35)}>
                  <BarChart data={topOficinas} layout="vertical" barSize={18}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis dataKey="nome" type="category" width={200} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="qtd" name="Registros" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function KpiCard({ icon, label, value, sub, color, bg }: { icon: React.ReactNode; label: string; value: string | number; sub?: string; color: string; bg: string }) {
  return (
    <div className={clsx('rounded-xl border border-gray-200 p-3', bg)}>
      <div className={clsx('flex items-center gap-1.5 mb-1', color)}>{icon}<span className="text-xs font-medium">{label}</span></div>
      <div className={clsx('text-2xl font-bold', color)}>{value}</div>
      {sub && <div className="text-xs text-gray-500 mt-0.5">{sub}</div>}
    </div>
  );
}
