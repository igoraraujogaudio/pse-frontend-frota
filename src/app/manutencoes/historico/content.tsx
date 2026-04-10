"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { maintenanceService } from "@/services/maintenanceService";
import { Maintenance } from "@/types";
import { CurrencyDollarIcon, ChartBarIcon, WrenchScrewdriverIcon, BuildingOfficeIcon } from "@heroicons/react/24/outline";
import MaintenanceDetailCard from '../MaintenanceDetailCard';

function formatDate(date: string | undefined) {
  if (!date) return "-";
  return new Date(date).toLocaleDateString("pt-BR");
}

export function MaintenanceHistoryContent() {
  const [selectedWorkshop, setSelectedWorkshop] = useState<string>("Todas Oficinas");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [expanded, setExpanded] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState('');

  // React Query para buscar dados
  const {
    data: maintenances = [],
    isLoading: loadingMaintenances,
    error: errorMaintenances
  } = useQuery<Maintenance[], Error>({ 
    queryKey: ['maintenances'], 
    queryFn: maintenanceService.getAll 
  });

  const loading = loadingMaintenances;
  const error = errorMaintenances;

  // Removido filtro por locais (tabela descontinuada)

  // Filtros dinâmicos
  const workshops = [
    "Todas Oficinas",
    ...Array.from(new Set(maintenances.map(m => m.oficina?.nome).filter(Boolean)))
  ];

  // Filtrar apenas finalizadas, canceladas ou rejeitadas
  const filteredHistory = maintenances.filter(item => {
    const isFinal = item.status === 'retornado' || item.status === 'cancelada' || item.status === 'rejeitada';
    if (!isFinal) return false;
    const byWorkshop = selectedWorkshop === "Todas Oficinas" || item.oficina?.nome === selectedWorkshop;
    const byDate = (!startDate || new Date(item.criado_em) >= new Date(startDate)) && (!endDate || new Date(item.criado_em) <= new Date(endDate));
    const bySearch = !searchTerm || (
      item.veiculo?.placa?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.veiculo?.modelo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.veiculo?.tipo_modelo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.oficina?.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.descricao?.toLowerCase().includes(searchTerm.toLowerCase())
    );
    return byWorkshop && byDate && bySearch;
  });

  // Cálculos para os cards de resumo
  const totalCost = filteredHistory.reduce((acc, m) => acc + (m.custo_estimado || 0), 0);
  const totalCount = filteredHistory.length;
  let months = 1;
  if (filteredHistory.length > 1) {
    const dates = filteredHistory.map(m => new Date(m.criado_em)).sort((a, b) => a.getTime() - b.getTime());
    const first = dates[0];
    const last = dates[dates.length - 1];
    months = (last.getFullYear() - first.getFullYear()) * 12 + (last.getMonth() - first.getMonth()) + 1;
    months = Math.max(months, 1);
  }
  const monthlyCost = totalCost / months;

  // Nota: Os locais já devem vir populados do join no maintenanceService.getAll()
  // Se algum local não estiver populado, será exibido como '-'

  if (loading) {
    return <div className="flex items-center justify-center py-20 text-gray-500">Carregando...</div>;
  }

  if (error) {
    return (
      <div className="bg-gray-50 flex items-center justify-center py-20">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Erro ao carregar dados</h1>
          <p className="text-gray-600">{String(error)}</p>
        </div>
      </div>
    );
  }

  return (
    <main>
      <div className="max-w-7xl mx-auto py-2 px-4">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Histórico de Manutenções</h1>
        <p className="text-gray-600 mb-4">Veja todas as manutenções finalizadas ou canceladas.</p>
        {/* Cards de resumo */}
        <div className="mb-4 grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className="flex items-center gap-4 bg-blue-50 border rounded-xl p-5 border-blue-100">
            <CurrencyDollarIcon className="h-8 w-8 text-blue-600" />
            <div>
              <div className="text-2xl font-bold text-blue-700">R$ {totalCost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
              <div className="text-sm text-blue-800 font-medium">Custo Total</div>
            </div>
          </div>
          <div className="flex items-center gap-4 bg-green-50 border rounded-xl p-5 border-green-100">
            <ChartBarIcon className="h-8 w-8 text-green-600" />
            <div>
              <div className="text-2xl font-bold text-green-700">R$ {monthlyCost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
              <div className="text-sm text-green-800 font-medium">Custo Médio Mensal</div>
            </div>
          </div>
          <div className="flex items-center gap-4 bg-yellow-50 border rounded-xl p-5 border-yellow-100">
            <WrenchScrewdriverIcon className="h-8 w-8 text-yellow-600" />
            <div>
              <div className="text-2xl font-bold text-yellow-700">{totalCount}</div>
              <div className="text-sm text-yellow-800 font-medium">Total de Manutenções</div>
            </div>
          </div>
        </div>
        {/* Filtros */}
        <div className="flex flex-wrap gap-4 mb-4 items-end">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Pesquisar</label>
            <input
              type="text"
              className="rounded-lg border border-gray-200 py-2 px-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Buscar por placa, modelo, local, oficina, descrição..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Oficina</label>
            <select
              className="rounded-lg border border-gray-200 py-2 px-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={selectedWorkshop}
              onChange={e => setSelectedWorkshop(e.target.value)}
            >
              {workshops.map(w => (
                <option key={w} value={w}>{w}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Período</label>
            <div className="flex gap-2">
              <input
                type="date"
                className="rounded-lg border border-gray-200 py-2 px-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
              />
              <span className="text-gray-500 self-center">a</span>
              <input
                type="date"
                className="rounded-lg border border-gray-200 py-2 px-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
              />
            </div>
          </div>
        </div>
        {/* Lista de manutenções */}
        <div className="space-y-6">
          {filteredHistory.length === 0 ? (
            <div className="text-center text-gray-500 py-10">Nenhuma manutenção encontrada.</div>
          ) : filteredHistory.map((item) => (
            <div key={item.id} className="bg-white rounded-xl shadow-sm border border-gray-100">
              <button
                className="w-full flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-0 bg-gradient-to-r from-blue-50/70 to-white border-b border-blue-100 rounded-t-xl shadow-sm hover:bg-blue-50/40 transition-colors text-left"
                onClick={() => setExpanded(expanded === item.id ? "" : item.id)}
              >
                <div className="flex items-center gap-3 min-w-[220px] p-4">
                  <span className="inline-block bg-blue-100 text-blue-700 rounded-lg px-4 py-1 text-lg font-bold tracking-widest shadow-sm border border-blue-200">
                    {item.veiculo?.placa || "-"}
                  </span>
                  {item.veiculo?.tipo_modelo && (
                    <span className="inline-block bg-gray-200 text-gray-600 rounded px-2 py-0.5 text-xs font-semibold uppercase tracking-wide border border-gray-300">
                      {item.veiculo.tipo_modelo}
                    </span>
                  )}
                  {item.veiculo?.contrato?.nome ? (
                    <span className="inline-block bg-gray-100 text-gray-700 rounded px-3 py-1.5 text-sm font-semibold border border-gray-200">
                      {item.veiculo.contrato.nome}
                    </span>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-3 justify-end flex-1 p-4">
                  {/* Oficina - ícone prédio */}
                  <span className="flex items-center gap-1 text-gray-900 font-semibold">
                    <BuildingOfficeIcon className="w-4 h-4 text-blue-400" />
                    {item.oficina?.nome || "-"}
                  </span>
                  {/* Status */}
                  <span className="flex items-center gap-1 text-gray-900 font-semibold">
                    <svg className="w-4 h-4 text-yellow-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3" /></svg>
                    {item.status === 'retornado' ? 'Finalizada' : item.status === 'cancelada' ? 'Cancelada' : 'Rejeitada'}
                  </span>
                  {/* Data de início - ícone calendário simples */}
                  <span className="flex items-center gap-1 text-gray-900 font-semibold">
                    <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" /><path strokeLinecap="round" strokeLinejoin="round" d="M16 2v4M8 2v4M3 10h18" /></svg>
                    {formatDate(item.criado_em || '')}
                  </span>
                  {/* Dias em manutenção - ícone relógio */}
                  {item.em_manutencao_em && (item.retornado_em || item.cancelado_em) && (
                    <span className="flex items-center gap-1 text-gray-900 font-semibold">
                      <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2" /></svg>
                      {(() => {
                        const start = new Date(item.em_manutencao_em || '');
                        const end = new Date(item.retornado_em || item.cancelado_em || '');
                        const diff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
                        return `${diff} dia${diff !== 1 ? 's' : ''}`;
                      })()}
                    </span>
                  )}
                  {/* Custo */}
                  <span className="flex items-center gap-1 text-gray-900 font-semibold">
                    <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm0 0V4m0 16v-4" /></svg>
                    R$ {(item.custo_estimado || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </button>
              {expanded === item.id && (
                <MaintenanceDetailCard maintenance={item} expanded={expanded === item.id} onClose={() => setExpanded("")} />
              )}
            </div>
          ))}
        </div>
      </div>
    </main>
  );
} 