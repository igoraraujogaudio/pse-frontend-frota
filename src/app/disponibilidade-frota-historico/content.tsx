'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  TruckIcon,
  WrenchScrewdriverIcon,
  CheckCircleIcon,
  UserGroupIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  CalendarIcon,
  BuildingOfficeIcon,
  ClockIcon,
  DocumentTextIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';
import { useAuth } from '@/contexts/AuthContext';
import { useNotification } from '@/contexts/NotificationContext';
import { PERMISSION_CODES, useModularPermissions } from '@/hooks/useModularPermissions';
import {
  disponibilidadeFrotaService,
  DisponibilidadeRota,
  StatusDisponibilidade,
} from '@/services/disponibilidadeRotaService';

const STATUS_CONFIG: Record<StatusDisponibilidade, { label: string; color: string; bg: string; icon: typeof CheckCircleIcon }> = {
  disponivel: { label: 'Disponível', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200', icon: CheckCircleIcon },
  em_operacao: { label: 'Em Operação', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200', icon: UserGroupIcon },
  manutencao: { label: 'Manutenção', color: 'text-red-700', bg: 'bg-red-50 border-red-200', icon: WrenchScrewdriverIcon },
};

function formatDateBr(iso: string | undefined): string {
  if (!iso) return '-';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function formatDateTimeBr(iso: string | undefined): string {
  if (!iso) return '-';
  try {
    const dt = new Date(iso);
    const d = dt.toLocaleDateString('pt-BR');
    const t = dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    return `${d} ${t}`;
  } catch {
    return iso;
  }
}

export function HistoricoContent() {
  const { notify } = useNotification();
  const { userContratoIds } = useAuth();
  const { hasPermission } = useModularPermissions();
  const canViewAll = hasPermission(PERMISSION_CODES.DISPONIBILIDADE_FROTA.VISUALIZAR_TODOS_CONTRATOS);

  const [loading, setLoading] = useState(true);
  const [registros, setRegistros] = useState<DisponibilidadeRota[]>([]);
  const [contratos, setContratos] = useState<Array<{ id: string; nome: string; codigo?: string }>>([]);

  // Filtros
  const [filtroContrato, setFiltroContrato] = useState('');
  const [filtroDataInicio, setFiltroDataInicio] = useState('');
  const [filtroDataFim, setFiltroDataFim] = useState('');
  const [filtroStatus, setFiltroStatus] = useState<StatusDisponibilidade | ''>('');
  const [filtroVeiculo, setFiltroVeiculo] = useState('');
  const [showFiltros, setShowFiltros] = useState(true);

  // Detalhes
  const [selectedRegistro, setSelectedRegistro] = useState<DisponibilidadeRota | null>(null);

  // Converter data ISO para BR
  const isoToBr = (iso: string): string => { // eslint-disable-line @typescript-eslint/no-unused-vars
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

  const loadContratos = useCallback(async () => {
    try {
      const data = await disponibilidadeFrotaService.getContratos();
      if (canViewAll) {
        setContratos(data);
      } else {
        setContratos(data.filter(c => userContratoIds?.includes(c.id)));
      }
    } catch {
      // silenciar
    }
  }, [canViewAll, userContratoIds]);

  const loadRegistros = useCallback(async () => {
    setLoading(true);
    try {
      const data = await disponibilidadeFrotaService.getHistorico({
        contratoId: filtroContrato || undefined,
        dataInicio: filtroDataInicio || undefined,
        dataFim: filtroDataFim || undefined,
        status: (filtroStatus as StatusDisponibilidade) || undefined,
        veiculoBusca: filtroVeiculo || undefined,
      });

      // Se não é admin, filtra pelos contratos do usuário
      let resultado = data;
      if (!canViewAll && userContratoIds && userContratoIds.length > 0) {
        resultado = data.filter(r => userContratoIds.includes(r.contrato_id));
      }

      setRegistros(resultado);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar histórico';
      notify(message, 'error');
    } finally {
      setLoading(false);
    }
  }, [filtroContrato, filtroDataInicio, filtroDataFim, filtroStatus, filtroVeiculo, canViewAll, userContratoIds, notify]);

  useEffect(() => { loadContratos(); }, [loadContratos]);
  useEffect(() => { loadRegistros(); }, [loadRegistros]);

  // Agrupar por data
  const registrosPorData = registros.reduce<Record<string, DisponibilidadeRota[]>>((acc, reg) => {
    const data = reg.data_referencia;
    if (!acc[data]) acc[data] = [];
    acc[data].push(reg);
    return acc;
  }, {});
  const datasOrdenadas = Object.keys(registrosPorData).sort((a, b) => b.localeCompare(a));

  // Contadores
  const totalRegistros = registros.length;
  const totalManutencao = registros.filter(r => r.status === 'manutencao').length;
  const totalEmOperacao = registros.filter(r => r.status === 'em_operacao').length;
  const totalDisponivel = registros.filter(r => r.status === 'disponivel').length;

  return (
    <div className="bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <DocumentTextIcon className="w-7 h-7 text-cyan-600" />
              Histórico de Disponibilidade
            </h1>
            <p className="text-sm text-gray-500 mt-1">Visualização de todos os registros de disponibilidade de frota</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowFiltros(!showFiltros)}
              className={clsx(
                'flex items-center gap-1 px-3 py-2 rounded-lg text-sm border',
                showFiltros ? 'bg-cyan-50 text-cyan-700 border-cyan-200' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
              )}
            >
              <FunnelIcon className="w-4 h-4" />
              Filtros
            </button>
            <button
              onClick={loadRegistros}
              disabled={loading}
              className="flex items-center gap-1 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm disabled:opacity-50"
            >
              <ArrowPathIcon className={clsx('w-4 h-4', loading && 'animate-spin')} />
              Atualizar
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-2 space-y-4">
        {/* Filtros */}
        {showFiltros && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Contrato</label>
                <select
                  value={filtroContrato}
                  onChange={e => setFiltroContrato(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="">Todos</option>
                  {contratos.map(c => (
                    <option key={c.id} value={c.id}>{c.nome}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Data Início</label>
                <input
                  type="date"
                  value={filtroDataInicio}
                  onChange={e => setFiltroDataInicio(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm cursor-pointer"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Data Fim</label>
                <input
                  type="date"
                  value={filtroDataFim}
                  onChange={e => setFiltroDataFim(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm cursor-pointer"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
                <select
                  value={filtroStatus}
                  onChange={e => setFiltroStatus(e.target.value as StatusDisponibilidade | '')}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="">Todos</option>
                  <option value="disponivel">Disponível</option>
                  <option value="em_operacao">Em Operação</option>
                  <option value="manutencao">Manutenção</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Veículo</label>
                <div className="relative">
                  <MagnifyingGlassIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={filtroVeiculo}
                    onChange={e => setFiltroVeiculo(e.target.value)}
                    placeholder="Placa ou modelo..."
                    className="w-full border border-gray-300 rounded-lg pl-9 pr-3 py-2 text-sm"
                  />
                </div>
              </div>
            </div>
            {(filtroContrato || filtroDataInicio || filtroDataFim || filtroStatus || filtroVeiculo) && (
              <div className="mt-3 flex justify-end">
                <button
                  onClick={() => {
                    setFiltroContrato('');
                    setFiltroDataInicio('');
                    setFiltroDataFim('');
                    setFiltroStatus('');
                    setFiltroVeiculo('');
                  }}
                  className="text-xs text-gray-500 hover:text-gray-700 underline"
                >
                  Limpar filtros
                </button>
              </div>
            )}
          </div>
        )}

        {/* Resumo */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 text-center">
            <div className="text-2xl font-bold text-gray-900">{totalRegistros}</div>
            <div className="text-xs text-gray-500 mt-1">Total de registros</div>
          </div>
          <div className="bg-emerald-50 rounded-xl shadow-sm border border-emerald-200 p-4 text-center">
            <div className="text-2xl font-bold text-emerald-700">{totalDisponivel}</div>
            <div className="text-xs text-emerald-600 mt-1">Disponíveis</div>
          </div>
          <div className="bg-blue-50 rounded-xl shadow-sm border border-blue-200 p-4 text-center">
            <div className="text-2xl font-bold text-blue-700">{totalEmOperacao}</div>
            <div className="text-xs text-blue-600 mt-1">Em Operação</div>
          </div>
          <div className="bg-red-50 rounded-xl shadow-sm border border-red-200 p-4 text-center">
            <div className="text-2xl font-bold text-red-700">{totalManutencao}</div>
            <div className="text-xs text-red-600 mt-1">Em Manutenção</div>
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-cyan-600" />
          </div>
        )}

        {/* Registros agrupados por data */}
        {!loading && datasOrdenadas.length === 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
            <TruckIcon className="w-12 h-12 text-gray-300 mx-auto" />
            <p className="text-gray-500 mt-3">Nenhum registro encontrado</p>
            <p className="text-gray-400 text-sm mt-1">Ajuste os filtros para encontrar registros</p>
          </div>
        )}

        {!loading && datasOrdenadas.map(data => {
          const regs = registrosPorData[data];
          const manut = regs.filter(r => r.status === 'manutencao').length;
          const oper = regs.filter(r => r.status === 'em_operacao').length;
          const disp = regs.filter(r => r.status === 'disponivel').length;

          return (
            <div key={data} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CalendarIcon className="w-4 h-4 text-gray-500" />
                  <h3 className="font-semibold text-gray-800 text-sm">{formatDateBr(data)}</h3>
                  <span className="text-xs text-gray-400">({regs.length} registros)</span>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  {disp > 0 && <span className="text-emerald-600 font-medium">{disp} disponíveis</span>}
                  {oper > 0 && <span className="text-blue-600 font-medium">{oper} em operação</span>}
                  {manut > 0 && <span className="text-red-600 font-medium">{manut} manutenção</span>}
                </div>
              </div>

              {/* Tabela */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50/50 text-left text-xs text-gray-500 uppercase tracking-wide">
                      <th className="px-4 py-2 font-medium">Veículo</th>
                      <th className="px-4 py-2 font-medium">Contrato</th>
                      <th className="px-4 py-2 font-medium">Status</th>
                      <th className="px-4 py-2 font-medium">Equipe</th>
                      <th className="px-4 py-2 font-medium">Manutenção</th>
                      <th className="px-4 py-2 font-medium">Previsão</th>
                      <th className="px-4 py-2 font-medium">Oficina</th>
                      <th className="px-4 py-2 font-medium">Complexidade</th>
                      <th className="px-4 py-2 font-medium">Setor</th>
                      <th className="px-4 py-2 font-medium">Enviado por</th>
                      <th className="px-4 py-2 font-medium">Enviado em</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {regs.map(reg => {
                      const veiculo = Array.isArray(reg.veiculo) ? reg.veiculo[0] : reg.veiculo;
                      const contrato = Array.isArray(reg.contrato) ? reg.contrato[0] : reg.contrato;
                      const equipe = Array.isArray(reg.equipe) ? reg.equipe[0] : reg.equipe;
                      const oficina = Array.isArray(reg.oficina) ? reg.oficina[0] : reg.oficina;
                      const enviadoPor = Array.isArray(reg.enviado_por_usuario) ? reg.enviado_por_usuario[0] : reg.enviado_por_usuario;
                      const cfg = STATUS_CONFIG[reg.status];

                      return (
                        <tr
                          key={reg.id}
                          className="hover:bg-gray-50 cursor-pointer transition-colors"
                          onClick={() => setSelectedRegistro(reg)}
                        >
                          <td className="px-4 py-2.5">
                            <span className="font-bold text-gray-900">{veiculo?.placa || '-'}</span>
                            <span className="ml-1 text-gray-500 text-xs">{veiculo?.modelo || ''}</span>
                          </td>
                          <td className="px-4 py-2.5 text-gray-600 text-xs">{contrato?.nome || '-'}</td>
                          <td className="px-4 py-2.5">
                            <span className={clsx('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border', cfg.bg, cfg.color)}>
                              <cfg.icon className="w-3 h-3" />
                              {cfg.label}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-gray-600 text-xs">
                            {equipe?.nome || '-'}
                          </td>
                          <td className="px-4 py-2.5 text-xs text-gray-600 max-w-[200px] truncate">
                            {reg.status === 'manutencao' ? (
                              <span className="text-red-600">{reg.manutencao_problema || '-'}</span>
                            ) : '-'}
                          </td>
                          <td className="px-4 py-2.5 text-xs text-gray-600">
                            {reg.manutencao_previsao ? formatDateBr(reg.manutencao_previsao) : '-'}
                          </td>
                          <td className="px-4 py-2.5 text-xs text-gray-600">
                            {reg.manutencao_oficina_nome || oficina?.nome || '-'}
                          </td>
                          <td className="px-4 py-2.5 text-xs text-gray-600">
                            {reg.manutencao_complexidade ? (reg.manutencao_complexidade === 'alta' ? 'Alta' : reg.manutencao_complexidade === 'media' ? 'Média' : 'Baixa') : '-'}
                          </td>
                          <td className="px-4 py-2.5 text-xs text-gray-600">
                            {reg.manutencao_setor || '-'}
                          </td>
                          <td className="px-4 py-2.5 text-xs text-gray-600">
                            {enviadoPor?.nome || '-'}
                          </td>
                          <td className="px-4 py-2.5 text-xs text-gray-400">
                            {formatDateTimeBr(reg.enviado_em)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal de detalhes */}
      {selectedRegistro && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setSelectedRegistro(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-bold text-gray-900">Detalhes do Registro</h3>
              <button onClick={() => setSelectedRegistro(null)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="px-6 py-4 space-y-4">
              {(() => {
                const reg = selectedRegistro;
                const veiculo = Array.isArray(reg.veiculo) ? reg.veiculo[0] : reg.veiculo;
                const contrato = Array.isArray(reg.contrato) ? reg.contrato[0] : reg.contrato;
                const equipe = Array.isArray(reg.equipe) ? reg.equipe[0] : reg.equipe;
                const oficina = Array.isArray(reg.oficina) ? reg.oficina[0] : reg.oficina;
                const enviadoPor = Array.isArray(reg.enviado_por_usuario) ? reg.enviado_por_usuario[0] : reg.enviado_por_usuario;
                const cfg = STATUS_CONFIG[reg.status];

                return (
                  <>
                    {/* Status */}
                    <div className="flex items-center justify-between">
                      <span className={clsx('inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border', cfg.bg, cfg.color)}>
                        <cfg.icon className="w-4 h-4" />
                        {cfg.label}
                      </span>
                      <span className="text-sm text-gray-500">{formatDateBr(reg.data_referencia)}</span>
                    </div>

                    {/* Veículo */}
                    <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                      <TruckIcon className="w-5 h-5 text-gray-400 mt-0.5" />
                      <div>
                        <div className="font-bold text-gray-900">{veiculo?.placa || '-'}</div>
                        <div className="text-sm text-gray-500">{veiculo?.modelo || ''} {veiculo?.tipo_veiculo ? `• ${veiculo.tipo_veiculo}` : ''}</div>
                      </div>
                    </div>

                    {/* Contrato */}
                    <div className="flex items-start gap-3">
                      <BuildingOfficeIcon className="w-5 h-5 text-gray-400 mt-0.5" />
                      <div>
                        <div className="text-xs text-gray-500">Contrato</div>
                        <div className="text-sm text-gray-900">{contrato?.nome || '-'}</div>
                      </div>
                    </div>

                    {/* Equipe */}
                    {equipe && (
                      <div className="flex items-start gap-3">
                        <UserGroupIcon className="w-5 h-5 text-gray-400 mt-0.5" />
                        <div>
                          <div className="text-xs text-gray-500">Equipe</div>
                          <div className="text-sm text-gray-900">{equipe.nome}</div>
                        </div>
                      </div>
                    )}

                    {/* Manutenção */}
                    {reg.status === 'manutencao' && (
                      <div className="border border-red-200 rounded-lg p-4 bg-red-50/50 space-y-3">
                        <h4 className="font-semibold text-red-700 text-sm flex items-center gap-1.5">
                          <WrenchScrewdriverIcon className="w-4 h-4" />
                          Dados da Manutenção
                        </h4>

                        <div>
                          <div className="text-xs text-gray-500">Problema</div>
                          <div className="text-sm text-gray-900">{reg.manutencao_problema || '-'}</div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <div className="text-xs text-gray-500">Previsão de conclusão</div>
                            <div className="text-sm text-gray-900">{reg.manutencao_previsao ? formatDateBr(reg.manutencao_previsao) : 'Não informada'}</div>
                          </div>
                          <div>
                            <div className="text-xs text-gray-500">Oficina</div>
                            <div className="text-sm text-gray-900">{reg.manutencao_oficina_nome || oficina?.nome || 'Não informada'}</div>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <div className="text-xs text-gray-500">Complexidade</div>
                            <div className="text-sm text-gray-900">{reg.manutencao_complexidade ? (reg.manutencao_complexidade === 'alta' ? 'Alta' : reg.manutencao_complexidade === 'media' ? 'Média' : 'Baixa') : 'Não informada'}</div>
                          </div>
                          <div>
                            <div className="text-xs text-gray-500">Setor</div>
                            <div className="text-sm text-gray-900">{reg.manutencao_setor || 'Não informado'}</div>
                          </div>
                        </div>

                        <div>
                          <div className="text-xs text-gray-500">Início da manutenção</div>
                          <div className="text-sm text-gray-900">{formatDateTimeBr(reg.criado_em)}</div>
                        </div>
                      </div>
                    )}

                    {/* Observações */}
                    {reg.observacoes && (
                      <div className="flex items-start gap-3">
                        <DocumentTextIcon className="w-5 h-5 text-gray-400 mt-0.5" />
                        <div>
                          <div className="text-xs text-gray-500">Observações</div>
                          <div className="text-sm text-gray-900">{reg.observacoes}</div>
                        </div>
                      </div>
                    )}

                    {/* Metadados */}
                    <div className="border-t border-gray-200 pt-3 space-y-2">
                      <div className="flex items-center gap-2 text-xs text-gray-400">
                        <ClockIcon className="w-3.5 h-3.5" />
                        Enviado por <span className="text-gray-600 font-medium">{enviadoPor?.nome || '-'}</span> em {formatDateTimeBr(reg.enviado_em)}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-400">
                        <ClockIcon className="w-3.5 h-3.5" />
                        Criado em {formatDateTimeBr(reg.criado_em)} • Atualizado em {formatDateTimeBr(reg.atualizado_em)}
                      </div>
                      {reg.reuniao_encerrada && (
                        <div className="flex items-center gap-2 text-xs text-amber-600">
                          <ExclamationTriangleIcon className="w-3.5 h-3.5" />
                          Reunião encerrada em {formatDateTimeBr(reg.reuniao_encerrada_em)}
                        </div>
                      )}
                    </div>
                  </>
                );
              })()}
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end">
              <button
                onClick={() => setSelectedRegistro(null)}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
