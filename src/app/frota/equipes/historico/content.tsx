'use client';
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { allocationLogService, AllocationLogWithDetails } from '@/services/allocationLogService';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function HistoricoAlocacoesContent() {
  const [actionFilter, setActionFilter] = useState<'all' | 'alocar' | 'remover' | 'realocar'>('all');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Buscar logs de alocação
  const { data: logs = [], isLoading } = useQuery<AllocationLogWithDetails[]>({
    queryKey: ['allocation-logs', actionFilter, dateFilter],
    queryFn: async () => {
      let logs = await allocationLogService.getAll();
      
      // Filtrar por ação
      if (actionFilter !== 'all') {
        logs = logs.filter(log => log.acao === actionFilter);
      }
      
      // Filtrar por data
      if (dateFilter !== 'all') {
        const now = new Date();
        const startDate = new Date();
        
        switch (dateFilter) {
          case 'today':
            startDate.setHours(0, 0, 0, 0);
            break;
          case 'week':
            startDate.setDate(now.getDate() - 7);
            break;
          case 'month':
            startDate.setMonth(now.getMonth() - 1);
            break;
        }
        
        logs = logs.filter(log => new Date(log.data_alteracao) >= startDate);
      }
      
      return logs;
    },
  });

  // Filtrar por termo de busca
  const filteredLogs = logs.filter(log => {
    const searchLower = searchTerm.toLowerCase();
    return (
      log.veiculo.placa.toLowerCase().includes(searchLower) ||
      log.veiculo.marca_equipamento.toLowerCase().includes(searchLower) ||
      log.veiculo.modelo.toLowerCase().includes(searchLower) ||
      (log.equipe_anterior?.nome.toLowerCase().includes(searchLower)) ||
      (log.equipe_nova?.nome.toLowerCase().includes(searchLower)) ||
      log.usuario.nome.toLowerCase().includes(searchLower)
    );
  });

  // Função para obter cor do badge baseado na ação
  const getActionBadgeVariant = (action: string) => {
    switch (action) {
      case 'alocar':
        return 'bg-green-100 text-green-800';
      case 'remover':
        return 'bg-red-100 text-red-800';
      case 'realocar':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Função para traduzir ação
  const translateAction = (action: string) => {
    switch (action) {
      case 'alocar':
        return 'Alocado';
      case 'remover':
        return 'Removido';
      case 'realocar':
        return 'Realocado';
      default:
        return action;
    }
  };

  // Função para exportar dados
  const exportToCSV = () => {
    const headers = ['Data', 'Ação', 'Veículo', 'Equipe Anterior', 'Equipe Nova', 'Usuário'];
    const csvContent = [
      headers.join(','),
      ...filteredLogs.map(log => [
        format(new Date(log.data_alteracao), 'dd/MM/yyyy HH:mm', { locale: ptBR }),
        translateAction(log.acao),
        log.veiculo.placa,
        log.equipe_anterior?.nome || 'Nenhuma',
        log.equipe_nova?.nome || 'Nenhuma',
        log.usuario.nome
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `historico_alocacoes_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="bg-gray-50">
      <div className="max-w-7xl mx-auto py-2 sm:px-6 lg:px-8">
        <div className="px-4 py-2 sm:px-0">
          {/* Header */}
          <div className="mb-4">
            <h1 className="text-2xl font-bold text-gray-900">Histórico de Alocações</h1>
            <p className="text-gray-600 mt-1">Rastreabilidade completa de todas as alterações de alocação de veículos</p>
          </div>

          {/* Filtros */}
          <div className="mb-3 bg-white p-4 rounded-lg shadow-sm border border-gray-100">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <input
                  type="text"
                  placeholder="Buscar por placa, equipe ou usuário..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <select 
                value={actionFilter} 
                onChange={(e) => setActionFilter(e.target.value as 'all' | 'alocar' | 'remover' | 'realocar')}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">Todas as ações</option>
                <option value="alocar">Alocações</option>
                <option value="remover">Remoções</option>
                <option value="realocar">Realocações</option>
              </select>

              <select 
                value={dateFilter} 
                onChange={(e) => setDateFilter(e.target.value as 'all' | 'today' | 'week' | 'month')}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">Todo período</option>
                <option value="today">Hoje</option>
                <option value="week">Última semana</option>
                <option value="month">Último mês</option>
              </select>

              <button 
                onClick={exportToCSV} 
                className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500"
              >
                📥 Exportar CSV
              </button>
            </div>
          </div>

          {/* Estatísticas */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-4">
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total de Registros</p>
                  <p className="text-2xl font-semibold text-gray-900 mt-1">{filteredLogs.length}</p>
                </div>
                <div className="p-3 rounded-lg bg-blue-500">
                  <span className="text-white text-xl">📊</span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Alocações</p>
                  <p className="text-2xl font-semibold text-green-600 mt-1">
                    {filteredLogs.filter(log => log.acao === 'alocar').length}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-green-500">
                  <span className="text-white text-xl">➕</span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Remoções</p>
                  <p className="text-2xl font-semibold text-red-600 mt-1">
                    {filteredLogs.filter(log => log.acao === 'remover').length}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-red-500">
                  <span className="text-white text-xl">➖</span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Realocações</p>
                  <p className="text-2xl font-semibold text-purple-600 mt-1">
                    {filteredLogs.filter(log => log.acao === 'realocar').length}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-purple-500">
                  <span className="text-white text-xl">↔️</span>
                </div>
              </div>
            </div>
          </div>

          {/* Tabela de Logs */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Data/Hora</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ação</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Veículo</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Equipe Anterior</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Equipe Nova</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Usuário</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Detalhes</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {isLoading ? (
                    <tr>
                      <td colSpan={7} className="text-center py-8">
                        <div className="flex items-center justify-center">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                          <span className="ml-2">Carregando histórico...</span>
                        </div>
                      </td>
                    </tr>
                  ) : filteredLogs.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-8 text-gray-500">
                        Nenhum registro encontrado
                      </td>
                    </tr>
                  ) : (
                    filteredLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap font-mono text-sm">
                          {format(new Date(log.data_alteracao), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getActionBadgeVariant(log.acao)}`}>
                            {translateAction(log.acao)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>
                            <div className="font-medium">{log.veiculo.placa}</div>
                            <div className="text-sm text-gray-500">
                              {log.veiculo.marca_equipamento} {log.veiculo.modelo}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {log.equipe_anterior ? (
                            <div>
                              <div className="font-medium">{log.equipe_anterior.nome}</div>
                              {log.equipe_anterior.prefixo_fixo && (
                                <div className="text-sm text-gray-500">{log.equipe_anterior.prefixo_fixo}</div>
                              )}
                            </div>
                          ) : (
                            <span className="text-gray-400">Nenhuma</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {log.equipe_nova ? (
                            <div>
                              <div className="font-medium">{log.equipe_nova.nome}</div>
                              {log.equipe_nova.prefixo_fixo && (
                                <div className="text-sm text-gray-500">{log.equipe_nova.prefixo_fixo}</div>
                              )}
                            </div>
                          ) : (
                            <span className="text-gray-400">Nenhuma</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>
                            <div className="font-medium">{log.usuario.nome}</div>
                            <div className="text-sm text-gray-500">{log.usuario.email}</div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-xs text-gray-500">
                            <div>IP: {log.ip_address || 'N/A'}</div>
                            <div>UA: {log.user_agent ? log.user_agent.substring(0, 30) + '...' : 'N/A'}</div>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
