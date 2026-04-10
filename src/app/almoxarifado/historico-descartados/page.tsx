'use client';

import { useQuery } from '@tanstack/react-query';
import { useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { PERMISSION_CODES } from '@/hooks/useModularPermissions';
import ProtectedRoute from '@/components/ProtectedRoute';
import { CheckCircleIcon, XCircleIcon, ClockIcon, EyeIcon, MagnifyingGlassIcon, DocumentArrowDownIcon } from '@heroicons/react/24/outline';
import { descontoMaterialExcelService } from '@/services/descontoMaterialExcelService';
import { useNotification } from '@/contexts/NotificationContext';

interface ItemHistorico {
  inventario_funcionario_id?: string;
  tipo_item_id: string;
  nome_item: string;
  quantidade: number;
  valor_unitario: number;
  valor_total: number;
  motivo_desconto: string;
  data_descarte: string;
  status_descarte: string;
  data_reteste?: string;
  resultado_reteste?: string;
  observacoes_reteste?: string;
  responsavel_reteste?: string;
}

interface OrdemDesconto {
  id: string;
  created_by: string;
  target_user_id: string;
  valor_total: number;
  descricao: string;
  placa?: string;
  cpf?: string;
  base_id?: string;
  status: string;
  created_at: string;
  data_assinatura?: string;
  criado_por_setor?: string;
  // Campos que precisamos buscar de outras tabelas
  funcionario_nome?: string;
  funcionario_matricula?: string;
  funcionario_cpf?: string;
  base_nome?: string;
  historico_descarte?: ItemHistorico[];
}

export default function HistoricoDescartadosPage() {
  return (
    <ProtectedRoute requiredPermissions={[
      PERMISSION_CODES.ALMOXARIFADO.DASHBOARD_ADMINISTRATIVO,
      PERMISSION_CODES.ALMOXARIFADO.RELATORIOS_CONSUMO
    ]}>
      <HistoricoDescartadosContent />
    </ProtectedRoute>
  );
}

function HistoricoDescartadosContent() {
  const { notify } = useNotification();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedItem, setSelectedItem] = useState<{
    ordem: OrdemDesconto;
    item: ItemHistorico;
    itemIndex: number;
  } | null>(null);

  // Query para buscar ordens com histórico de descarte
  const {
    data: ordens = [],
    isLoading,
    error
  } = useQuery({
    queryKey: ['historico_descartados'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('discount_orders')
        .select(`
          *,
          target_user:usuarios!target_user_id(
            nome,
            matricula,
            cpf
          ),
          base:bases!base_id(
            nome
          )
        `)
        .eq('criado_por_setor', 'almoxarifado')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      // Transformar os dados para o formato esperado
      return data.map((order: Record<string, unknown>) => ({
        ...order,
        funcionario_nome: (order.target_user as Record<string, unknown>)?.nome as string || 'N/A',
        funcionario_matricula: (order.target_user as Record<string, unknown>)?.matricula as string || 'N/A',
        funcionario_cpf: (order.target_user as Record<string, unknown>)?.cpf as string || (order.cpf as string) || 'N/A',
        base_nome: (order.base as Record<string, unknown>)?.nome as string || 'N/A',
        historico_descarte: [] // Por enquanto vazio, pois não temos essa estrutura
      })) as unknown as OrdemDesconto[];
    },
    staleTime: 5 * 60 * 1000,
  });

  // Flatten todos os itens descartados de todas as ordens
  const todosItens = useMemo(() => {
    const itens: Array<{
      ordem: OrdemDesconto;
      item: ItemHistorico;
      itemIndex: number;
    }> = [];

    ordens.forEach(ordem => {
      // Como não temos historico_descarte, vamos criar um item baseado na ordem
      if (ordem.historico_descarte && ordem.historico_descarte.length > 0) {
        ordem.historico_descarte.forEach((item, index) => {
          itens.push({
            ordem,
            item,
            itemIndex: index
          });
        });
      } else {
        // Criar um item fictício baseado na ordem para exibir
        const itemFicticio: ItemHistorico = {
          tipo_item_id: ordem.id,
          nome_item: ordem.descricao || 'Item não especificado',
          quantidade: 1,
          valor_unitario: ordem.valor_total,
          valor_total: ordem.valor_total,
          motivo_desconto: ordem.descricao || 'Desconto aplicado',
          data_descarte: ordem.created_at,
          status_descarte: ordem.status === 'assinada' ? 'descartado' : 'pendente'
        };
        
        itens.push({
          ordem,
          item: itemFicticio,
          itemIndex: 0
        });
      }
    });

    return itens;
  }, [ordens]);

  // Filtros
  const filteredItens = useMemo(() => {
    return todosItens.filter(({ item, ordem }) => {
      const matchesSearch = !search || 
        item.nome_item.toLowerCase().includes(search.toLowerCase()) ||
        ordem.funcionario_nome?.toLowerCase().includes(search.toLowerCase()) ||
        ordem.funcionario_matricula?.toLowerCase().includes(search.toLowerCase()) ||
        item.motivo_desconto.toLowerCase().includes(search.toLowerCase());
      
      const matchesStatus = statusFilter === 'all' || item.status_descarte === statusFilter;
      
      let matchesDate = true;
      if (dateFilter !== 'all') {
        const itemDate = new Date(item.data_descarte);
        const now = new Date();
        const diffDays = Math.floor((now.getTime() - itemDate.getTime()) / (1000 * 60 * 60 * 24));
        
        switch (dateFilter) {
          case 'today':
            matchesDate = diffDays === 0;
            break;
          case 'week':
            matchesDate = diffDays <= 7;
            break;
          case 'month':
            matchesDate = diffDays <= 30;
            break;
          case 'year':
            matchesDate = diffDays <= 365;
            break;
        }
      }
      
      return matchesSearch && matchesStatus && matchesDate;
    });
  }, [todosItens, search, statusFilter, dateFilter]);

  // Paginação
  const itemsPerPage = 20;
  const totalPages = Math.ceil(filteredItens.length / itemsPerPage);
  const paginatedItens = filteredItens.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('pt-BR');
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      descartado: { color: 'bg-red-100 text-red-800', label: 'Descartado', icon: XCircleIcon },
      reteste: { color: 'bg-yellow-100 text-yellow-800', label: 'Em Reteste', icon: ClockIcon },
      recuperado: { color: 'bg-green-100 text-green-800', label: 'Recuperado', icon: CheckCircleIcon }
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.descartado;
    const Icon = config.icon;
    
    return (
      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${config.color}`}>
        <Icon className="h-3 w-3 mr-1" />
        {config.label}
      </span>
    );
  };

  const getResultadoBadge = (resultado: string) => {
    const resultadoConfig = {
      aprovado: { color: 'bg-green-100 text-green-800', label: 'Aprovado' },
      reprovado: { color: 'bg-red-100 text-red-800', label: 'Reprovado' },
      pendente: { color: 'bg-yellow-100 text-yellow-800', label: 'Pendente' }
    };

    const config = resultadoConfig[resultado as keyof typeof resultadoConfig] || resultadoConfig.pendente;
    
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${config.color}`}>
        {config.label}
      </span>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600">Erro ao carregar histórico: {error.message}</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Histórico de Itens Descartados</h1>
            <p className="text-gray-600">Visualize o histórico completo de itens descartados do almoxarifado</p>
          </div>
          <button
            onClick={async () => {
              try {
                await descontoMaterialExcelService.downloadPlanilhaItens({
                  status: statusFilter !== 'all' ? statusFilter : undefined
                });
                notify('Planilha de histórico baixada com sucesso!', 'success');
              } catch (error) {
                notify('Erro ao baixar planilha: ' + (error as Error).message, 'error');
              }
            }}
            className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            <DocumentArrowDownIcon className="h-4 w-4 inline mr-2" />
            Baixar Planilha
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Buscar
            </label>
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar por item, funcionário, matrícula ou motivo..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Todos os status</option>
              <option value="descartado">Descartado</option>
              <option value="reteste">Em Reteste</option>
              <option value="recuperado">Recuperado</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Período
            </label>
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Todo período</option>
              <option value="today">Hoje</option>
              <option value="week">Última semana</option>
              <option value="month">Último mês</option>
              <option value="year">Último ano</option>
            </select>
          </div>
        </div>
      </div>

      {/* Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-2xl font-bold text-gray-900">{todosItens.length}</div>
          <div className="text-sm text-gray-600">Total de Itens</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-2xl font-bold text-red-600">
            {todosItens.filter(({ item }) => item.status_descarte === 'descartado').length}
          </div>
          <div className="text-sm text-gray-600">Descartados</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-2xl font-bold text-yellow-600">
            {todosItens.filter(({ item }) => item.status_descarte === 'reteste').length}
          </div>
          <div className="text-sm text-gray-600">Em Reteste</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-2xl font-bold text-green-600">
            {todosItens.filter(({ item }) => item.status_descarte === 'recuperado').length}
          </div>
          <div className="text-sm text-gray-600">Recuperados</div>
        </div>
      </div>

      {/* Lista de Itens */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Item
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Funcionário
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Quantidade
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Valor
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Data Descarte
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Reteste
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {paginatedItens.map(({ ordem, item, itemIndex }) => (
                <tr key={`${ordem.id}-${itemIndex}`} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {item.nome_item}
                      </div>
                      <div className="text-sm text-gray-500 max-w-xs truncate">
                        {item.motivo_desconto}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {ordem.funcionario_nome}
                      </div>
                      <div className="text-sm text-gray-500">
                        {ordem.funcionario_matricula}
                      </div>
                      <div className="text-xs text-gray-400">
                        {ordem.base_nome}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {item.quantidade}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatCurrency(item.valor_total)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getStatusBadge(item.status_descarte)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDateTime(item.data_descarte)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {item.resultado_reteste ? (
                      <div>
                        {getResultadoBadge(item.resultado_reteste)}
                        {item.data_reteste && (
                          <div className="text-xs text-gray-500 mt-1">
                            {formatDate(item.data_reteste)}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-sm text-gray-400">Não realizado</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button
                      onClick={() => setSelectedItem({ ordem, item, itemIndex })}
                      className="text-blue-600 hover:text-blue-900"
                    >
                      <EyeIcon className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Paginação */}
        {totalPages > 1 && (
          <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
            <div className="flex-1 flex justify-between sm:hidden">
              <button
                className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >Anterior</button>
              <button
                className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >Próxima</button>
            </div>
            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-gray-700">
                  Mostrando <span className="font-medium">{((currentPage - 1) * itemsPerPage) + 1}</span> até{' '}
                  <span className="font-medium">{Math.min(currentPage * itemsPerPage, filteredItens.length)}</span> de{' '}
                  <span className="font-medium">{filteredItens.length}</span> resultados
                </p>
              </div>
              <div>
                <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                  <button
                    className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50"
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >Anterior</button>
                  <button
                    className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50"
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                  >Próxima</button>
                </nav>
              </div>
            </div>
          </div>
        )}
      </div>

      {filteredItens.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500">Nenhum item encontrado com os filtros aplicados.</p>
        </div>
      )}

      {/* Modal de Detalhes */}
      {selectedItem && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-2xl shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">
                  Detalhes do Item Descartado
                </h3>
                <button
                  onClick={() => setSelectedItem(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XCircleIcon className="h-6 w-6" />
                </button>
              </div>

              <div className="space-y-4">
                {/* Informações do Item */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-medium text-gray-900 mb-2">Informações do Item</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium">Nome:</span> {selectedItem.item.nome_item}
                    </div>
                    <div>
                      <span className="font-medium">Quantidade:</span> {selectedItem.item.quantidade}
                    </div>
                    <div>
                      <span className="font-medium">Valor Unitário:</span> {formatCurrency(selectedItem.item.valor_unitario)}
                    </div>
                    <div>
                      <span className="font-medium">Valor Total:</span> {formatCurrency(selectedItem.item.valor_total)}
                    </div>
                  </div>
                </div>

                {/* Informações do Funcionário */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-medium text-gray-900 mb-2">Funcionário</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium">Nome:</span> {selectedItem.ordem.funcionario_nome}
                    </div>
                    <div>
                      <span className="font-medium">Matrícula:</span> {selectedItem.ordem.funcionario_matricula}
                    </div>
                    <div>
                      <span className="font-medium">CPF:</span> {selectedItem.ordem.funcionario_cpf}
                    </div>
                    <div>
                      <span className="font-medium">Base:</span> {selectedItem.ordem.base_nome}
                    </div>
                  </div>
                </div>

                {/* Informações do Descarte */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-medium text-gray-900 mb-2">Descarte</h4>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="font-medium">Motivo:</span> {selectedItem.item.motivo_desconto}
                    </div>
                    <div>
                      <span className="font-medium">Data do Descarte:</span> {formatDateTime(selectedItem.item.data_descarte)}
                    </div>
                    <div>
                      <span className="font-medium">Status:</span> {getStatusBadge(selectedItem.item.status_descarte)}
                    </div>
                    <div>
                      <span className="font-medium">Descrição da Ordem:</span> {selectedItem.ordem.descricao}
                    </div>
                  </div>
                </div>

                {/* Informações do Reteste */}
                {selectedItem.item.data_reteste && (
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h4 className="font-medium text-gray-900 mb-2">Reteste</h4>
                    <div className="space-y-2 text-sm">
                      <div>
                        <span className="font-medium">Data do Reteste:</span> {formatDateTime(selectedItem.item.data_reteste)}
                      </div>
                      <div>
                        <span className="font-medium">Resultado:</span> {getResultadoBadge(selectedItem.item.resultado_reteste || 'pendente')}
                      </div>
                      {selectedItem.item.observacoes_reteste && (
                        <div>
                          <span className="font-medium">Observações:</span>
                          <div className="mt-1 p-2 bg-white rounded border text-gray-700">
                            {selectedItem.item.observacoes_reteste}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end pt-4 border-t mt-4">
                <button
                  onClick={() => setSelectedItem(null)}
                  className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
