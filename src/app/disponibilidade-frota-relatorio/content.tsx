'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  DocumentArrowDownIcon,
  FunnelIcon,
  ArrowPathIcon,
  ChartBarIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
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

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  disponivel: { label: 'Disponível', color: 'text-emerald-700', bg: 'bg-emerald-50' },
  em_operacao: { label: 'Em Operação', color: 'text-blue-700', bg: 'bg-blue-50' },
  manutencao: { label: 'Manutenção', color: 'text-red-700', bg: 'bg-red-50' },
};

const MANUT_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  em_manutencao: { label: 'Em Manutenção', color: 'text-red-700', bg: 'bg-red-50' },
  em_orcamento: { label: 'Em Orçamento', color: 'text-amber-700', bg: 'bg-amber-50' },
};

export function RelatorioContent() {
  const { notify } = useNotification();
  const { user } = useAuth();
  const { hasPermission } = useModularPermissions();
  const canViewAll = hasPermission(PERMISSION_CODES.DISPONIBILIDADE_FROTA.VISUALIZAR_TODOS_CONTRATOS);

  const [loading, setLoading] = useState(false);
  const [contratos, setContratos] = useState<Array<{ id: string; nome: string; codigo?: string }>>([]);
  const [selectedContrato, setSelectedContrato] = useState('');
  const [registros, setRegistros] = useState<DisponibilidadeRota[]>([]);

  const hoje = disponibilidadeFrotaService.getDataHojeBrasilia();
  const trinta = (() => { const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().split('T')[0]; })();
  const [dataInicio, setDataInicio] = useState(trinta);
  const [dataFim, setDataFim] = useState(hoje);
  const [statusFilter, setStatusFilter] = useState('');
  const [busca, setBusca] = useState('');
  const [page, setPage] = useState(1);
  const perPage = 50;

  // Modal detalhes
  const [detalhes, setDetalhes] = useState<DisponibilidadeRota | null>(null);

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
      setPage(1);
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : 'Erro ao carregar dados', 'error');
    } finally {
      setLoading(false);
    }
  }, [selectedContrato, dataInicio, dataFim, notify]);

  useEffect(() => { loadContratos(); }, [loadContratos]);
  useEffect(() => { loadDados(); }, [loadDados]);

  const getVeiculo = (r: DisponibilidadeRota) => {
    const v: any = Array.isArray(r.veiculo) ? r.veiculo[0] : r.veiculo; // eslint-disable-line @typescript-eslint/no-explicit-any
    return v || { placa: '?', modelo: '?' };
  };
  const getContrato = (r: DisponibilidadeRota) => {
    const c: any = Array.isArray(r.contrato) ? r.contrato[0] : r.contrato; // eslint-disable-line @typescript-eslint/no-explicit-any
    return c || { nome: '?' };
  };
  const getEquipe = (r: DisponibilidadeRota) => {
    const e: any = Array.isArray(r.equipe) ? r.equipe[0] : r.equipe; // eslint-disable-line @typescript-eslint/no-explicit-any
    return e?.nome || '';
  };

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

  // Filtrar
  const filtered = useMemo(() => {
    let res = registros;
    if (statusFilter) res = res.filter(r => r.status === statusFilter);
    if (busca.trim()) {
      const b = busca.toLowerCase();
      res = res.filter(r => {
        const v = getVeiculo(r);
        const c = getContrato(r);
        return (
          v.placa?.toLowerCase().includes(b) ||
          v.modelo?.toLowerCase().includes(b) ||
          c.nome?.toLowerCase().includes(b) ||
          r.manutencao_problema?.toLowerCase().includes(b) ||
          r.manutencao_oficina_nome?.toLowerCase().includes(b)
        );
      });
    }
    return res;
  }, [registros, statusFilter, busca]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const paginated = filtered.slice((page - 1) * perPage, page * perPage);

  // Resumo filtrado
  const resumo = useMemo(() => ({
    total: filtered.length,
    disponivel: filtered.filter(r => r.status === 'disponivel').length,
    em_operacao: filtered.filter(r => r.status === 'em_operacao').length,
    manutencao: filtered.filter(r => r.status === 'manutencao').length,
    em_manutencao: filtered.filter(r => r.manutencao_tipo === 'em_manutencao').length,
    em_orcamento: filtered.filter(r => r.manutencao_tipo === 'em_orcamento').length,
  }), [filtered]);

  // Export CSV
  const exportCSV = () => {
    if (filtered.length === 0) return;
    const header = 'Data;Contrato;Placa;Modelo;Status;Tipo Manutencao;Problema;Previsao;Oficina;Complexidade;Setor;Equipe;Observacoes;Enviado Em\n';
    const rows = filtered.map(r => {
      const v = getVeiculo(r);
      const c = getContrato(r);
      const eq = getEquipe(r);
      const complexLabel = r.manutencao_complexidade ? (r.manutencao_complexidade === 'alta' ? 'Alta' : r.manutencao_complexidade === 'media' ? 'Média' : 'Baixa') : '';
      return [
        isoToBr(r.data_referencia),
        c.nome,
        v.placa,
        v.modelo,
        STATUS_LABELS[r.status]?.label || r.status,
        MANUT_LABELS[r.manutencao_tipo || '']?.label || '',
        (r.manutencao_problema || '').replace(/;/g, ',').replace(/\n/g, ' '),
        r.manutencao_previsao ? isoToBr(r.manutencao_previsao) : '',
        r.manutencao_oficina_nome || '',
        complexLabel,
        r.manutencao_setor || '',
        eq,
        (r.observacoes || '').replace(/;/g, ',').replace(/\n/g, ' '),
        r.enviado_em ? new Date(r.enviado_em).toLocaleString('pt-BR') : '',
      ].join(';');
    }).join('\n');
    const bom = '\uFEFF';
    const blob = new Blob([bom + header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `relatorio_disponibilidade_${dataInicio}_${dataFim}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <DocumentArrowDownIcon className="w-7 h-7 text-cyan-600" />
              Relatório — Disponibilidade de Frota
            </h1>
            <p className="text-sm text-gray-500 mt-1">Extração detalhada com filtros avançados</p>
          </div>
          <Link href="/disponibilidade-frota-dashboard" className="flex items-center gap-1 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm">
            <ChartBarIcon className="w-4 h-4" /> Dashboard
          </Link>
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
            <div>
              <label className="text-xs text-gray-500">Status</label>
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="block border border-gray-300 rounded-lg px-3 py-1.5 text-sm">
                <option value="">Todos</option>
                <option value="disponivel">Disponível</option>
                <option value="em_operacao">Em Operação</option>
                <option value="manutencao">Manutenção</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500">Buscar</label>
              <div className="relative">
                <MagnifyingGlassIcon className="w-4 h-4 absolute left-2.5 top-2 text-gray-400" />
                <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Placa, modelo, oficina..." className="block border border-gray-300 rounded-lg pl-8 pr-3 py-1.5 text-sm w-52" />
              </div>
            </div>
            <button onClick={loadDados} disabled={loading} className="mt-4 flex items-center gap-1 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg text-sm disabled:opacity-50">
              <ArrowPathIcon className={clsx('w-4 h-4', loading && 'animate-spin')} /> Buscar
            </button>
            <button onClick={exportCSV} disabled={filtered.length === 0} className="mt-4 flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm disabled:opacity-50">
              <DocumentArrowDownIcon className="w-4 h-4" /> Exportar CSV ({filtered.length})
            </button>
          </div>
        </div>

        {/* Resumo badges */}
        <div className="flex gap-3 flex-wrap">
          <span className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-gray-100 text-gray-700">{resumo.total} registros</span>
          <span className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-700">{resumo.disponivel} disponíveis</span>
          <span className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-50 text-blue-700">{resumo.em_operacao} em operação</span>
          <span className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-50 text-red-700">{resumo.manutencao} manutenção</span>
          {resumo.em_manutencao > 0 && <span className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-50 text-red-600">{resumo.em_manutencao} em manutenção</span>}
          {resumo.em_orcamento > 0 && <span className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-50 text-amber-700">{resumo.em_orcamento} em orçamento</span>}
        </div>

        {/* Tabela */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <ArrowPathIcon className="w-8 h-8 animate-spin text-gray-300" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-20 text-gray-400">
              <DocumentArrowDownIcon className="w-12 h-12 mx-auto mb-3" />
              <p>Nenhum registro encontrado</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200 text-gray-600">
                    <tr>
                      <th className="text-left px-4 py-2.5 font-medium">Data</th>
                      <th className="text-left px-4 py-2.5 font-medium">Contrato</th>
                      <th className="text-left px-4 py-2.5 font-medium">Placa</th>
                      <th className="text-left px-4 py-2.5 font-medium">Modelo</th>
                      <th className="text-center px-4 py-2.5 font-medium">Status</th>
                      <th className="text-center px-4 py-2.5 font-medium">Tipo</th>
                      <th className="text-left px-4 py-2.5 font-medium">Problema</th>
                      <th className="text-center px-4 py-2.5 font-medium">Previsão</th>
                      <th className="text-left px-4 py-2.5 font-medium">Oficina</th>
                      <th className="text-center px-4 py-2.5 font-medium">Complexidade</th>
                      <th className="text-center px-4 py-2.5 font-medium">Setor</th>
                      <th className="text-left px-4 py-2.5 font-medium">Equipe</th>
                      <th className="text-center px-4 py-2.5 font-medium w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {paginated.map((r, i) => {
                      const v = getVeiculo(r);
                      const c = getContrato(r);
                      const eq = getEquipe(r);
                      const sl = STATUS_LABELS[r.status];
                      const ml = r.manutencao_tipo ? MANUT_LABELS[r.manutencao_tipo] : null;
                      return (
                        <tr key={r.id || i} className="hover:bg-gray-50 cursor-pointer" onClick={() => setDetalhes(r)}>
                          <td className="px-4 py-2 text-gray-900 whitespace-nowrap">{isoToBr(r.data_referencia)}</td>
                          <td className="px-4 py-2 text-gray-700 whitespace-nowrap">{c.nome}</td>
                          <td className="px-4 py-2 font-semibold text-gray-900 whitespace-nowrap">{v.placa}</td>
                          <td className="px-4 py-2 text-gray-600 whitespace-nowrap">{v.modelo}</td>
                          <td className="px-4 py-2 text-center">
                            <span className={clsx('inline-block px-2 py-0.5 rounded text-xs font-semibold', sl?.bg, sl?.color)}>{sl?.label}</span>
                          </td>
                          <td className="px-4 py-2 text-center">
                            {ml && <span className={clsx('inline-block px-2 py-0.5 rounded text-xs font-semibold', ml.bg, ml.color)}>{ml.label}</span>}
                          </td>
                          <td className="px-4 py-2 text-gray-600 max-w-[200px] truncate">{r.manutencao_problema || '-'}</td>
                          <td className="px-4 py-2 text-center text-gray-600 whitespace-nowrap">{r.manutencao_previsao ? isoToBr(r.manutencao_previsao) : '-'}</td>
                          <td className="px-4 py-2 text-gray-600 whitespace-nowrap">{r.manutencao_oficina_nome || '-'}</td>
                          <td className="px-4 py-2 text-center text-gray-600 whitespace-nowrap">{r.manutencao_complexidade ? (r.manutencao_complexidade === 'alta' ? 'Alta' : r.manutencao_complexidade === 'media' ? 'Média' : 'Baixa') : '-'}</td>
                          <td className="px-4 py-2 text-center text-gray-600 whitespace-nowrap">{r.manutencao_setor || '-'}</td>
                          <td className="px-4 py-2 text-gray-600 whitespace-nowrap">{eq || '-'}</td>
                          <td className="px-4 py-2 text-center">
                            <MagnifyingGlassIcon className="w-4 h-4 text-gray-400" />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {/* Paginação */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50">
                  <span className="text-xs text-gray-500">{filtered.length} registros — Página {page} de {totalPages}</span>
                  <div className="flex gap-1">
                    <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1 text-xs rounded border border-gray-300 disabled:opacity-30 hover:bg-gray-100">Anterior</button>
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      const p = page <= 3 ? i + 1 : page + i - 2;
                      if (p < 1 || p > totalPages) return null;
                      return (
                        <button key={p} onClick={() => setPage(p)} className={clsx('px-3 py-1 text-xs rounded border', p === page ? 'bg-cyan-600 text-white border-cyan-600' : 'border-gray-300 hover:bg-gray-100')}>
                          {p}
                        </button>
                      );
                    })}
                    <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)} className="px-3 py-1 text-xs rounded border border-gray-300 disabled:opacity-30 hover:bg-gray-100">Próximo</button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Modal detalhes */}
      {detalhes && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setDetalhes(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-bold text-gray-900">Detalhes do Registro</h3>
              <button onClick={() => setDetalhes(null)}><XMarkIcon className="w-5 h-5 text-gray-500 hover:text-gray-700" /></button>
            </div>
            <div className="px-6 py-4 space-y-3">
              {(() => {
                const v = getVeiculo(detalhes);
                const c = getContrato(detalhes);
                const eq = getEquipe(detalhes);
                const sl = STATUS_LABELS[detalhes.status];
                const ml = detalhes.manutencao_tipo ? MANUT_LABELS[detalhes.manutencao_tipo] : null;
                return (
                  <>
                    <DetailRow label="Data" value={isoToBr(detalhes.data_referencia)} />
                    <DetailRow label="Contrato" value={c.nome} />
                    <DetailRow label="Veículo" value={`${v.placa} — ${v.modelo}`} />
                    <DetailRow label="Status">
                      <span className={clsx('px-2 py-0.5 rounded text-xs font-semibold', sl?.bg, sl?.color)}>{sl?.label}</span>
                    </DetailRow>
                    {ml && (
                      <DetailRow label="Tipo Manutenção">
                        <span className={clsx('px-2 py-0.5 rounded text-xs font-semibold', ml.bg, ml.color)}>{ml.label}</span>
                      </DetailRow>
                    )}
                    {eq && <DetailRow label="Equipe" value={eq} />}
                    {detalhes.manutencao_problema && <DetailRow label="Problema" value={detalhes.manutencao_problema} />}
                    {detalhes.manutencao_previsao && <DetailRow label="Previsão" value={isoToBr(detalhes.manutencao_previsao)} />}
                    {detalhes.manutencao_oficina_nome && <DetailRow label="Oficina" value={detalhes.manutencao_oficina_nome} />}
                    {detalhes.manutencao_complexidade && <DetailRow label="Complexidade" value={detalhes.manutencao_complexidade === 'alta' ? 'Alta' : detalhes.manutencao_complexidade === 'media' ? 'Média' : 'Baixa'} />}
                    {detalhes.manutencao_setor && <DetailRow label="Setor" value={detalhes.manutencao_setor} />}
                    {detalhes.observacoes && <DetailRow label="Observações" value={detalhes.observacoes} />}
                    {detalhes.enviado_em && <DetailRow label="Enviado em" value={new Date(detalhes.enviado_em).toLocaleString('pt-BR')} />}
                    {detalhes.reuniao_encerrada && detalhes.reuniao_encerrada_em && (
                      <DetailRow label="Publicado em" value={new Date(detalhes.reuniao_encerrada_em).toLocaleString('pt-BR')} />
                    )}
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DetailRow({ label, value, children }: { label: string; value?: string; children?: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-2 border-b border-gray-100 last:border-0">
      <span className="text-xs font-medium text-gray-500 w-28 shrink-0 pt-0.5">{label}</span>
      <span className="text-sm text-gray-900">{children || value}</span>
    </div>
  );
}
