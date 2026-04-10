'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { PERMISSION_CODES } from '@/hooks/useModularPermissions';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useNotification } from '@/contexts/NotificationContext';
import { useAuth } from '@/contexts/AuthContext';
import { retesteService, ItemRetesteCompleto } from '@/services/retesteService';
import {
  MagnifyingGlassIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowPathIcon,
  PaperAirplaneIcon,
  CurrencyDollarIcon,
  DocumentTextIcon,
} from '@heroicons/react/24/outline';

type TabType = 'em_reteste' | 'historico' | 'enviar';

export default function RetestePage() {
  return (
    <ProtectedRoute requiredPermissions={[
      PERMISSION_CODES.ALMOXARIFADO.GERENCIAR_RETESTE,
      PERMISSION_CODES.ALMOXARIFADO.DASHBOARD_ADMINISTRATIVO,
      PERMISSION_CODES.ALMOXARIFADO.GERENCIAR_ESTOQUE
    ]}>
      <RetesteContent />
    </ProtectedRoute>
  );
}

function RetesteContent() {
  const { user } = useAuth();
  const { notify } = useNotification();
  const queryClient = useQueryClient();

  // Tab state
  const [activeTab, setActiveTab] = useState<TabType>('em_reteste');

  // Filters - Em Reteste
  const [search, setSearch] = useState('');
  const [baseFilter, setBaseFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Filters - Histórico
  const [historicoSearch, setHistoricoSearch] = useState('');
  const [historicoResultado, setHistoricoResultado] = useState('');
  const [historicoDataInicio, setHistoricoDataInicio] = useState('');
  const [historicoDataFim, setHistoricoDataFim] = useState('');

  // Modal states
  const [showConcluirModal, setShowConcluirModal] = useState(false);
  const [showDestinoModal, setShowDestinoModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ItemRetesteCompleto | null>(null);
  const [itemReprovado, setItemReprovado] = useState<ItemRetesteCompleto | null>(null);

  // Concluir modal form
  const [conclusaoStatus, setConclusaoStatus] = useState<'aprovado' | 'reprovado'>('aprovado');
  const [conclusaoObservacoes, setConclusaoObservacoes] = useState('');
  const [conclusaoLaudo, setConclusaoLaudo] = useState('');

  // Destino modal form
  const [destinoOpcao, setDestinoOpcao] = useState<'descartar' | 'reenviar'>('descartar');
  const [destinoMotivo, setDestinoMotivo] = useState('');

  // Enviar para reteste form
  const [enviarBase, setEnviarBase] = useState('');
  const [enviarItem, setEnviarItem] = useState('');
  const [enviarQuantidade, setEnviarQuantidade] = useState(1);
  const [enviarMotivo, setEnviarMotivo] = useState('');
  const [enviarSearchItem, setEnviarSearchItem] = useState('');
  const [enviarErroQuantidade, setEnviarErroQuantidade] = useState('');

  // ============================================================================
  // QUERIES
  // ============================================================================

  // Bases query
  const { data: bases = [] } = useQuery({
    queryKey: ['bases'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bases')
        .select('id, nome, codigo')
        .eq('ativa', true)
        .order('nome');
      if (error) throw error;
      return data || [];
    },
    staleTime: 10 * 60 * 1000,
  });

  // Estatísticas
  const { data: estatisticas } = useQuery({
    queryKey: ['reteste_estatisticas'],
    queryFn: () => retesteService.getEstatisticasRetestePeriodo(),
    staleTime: 2 * 60 * 1000,
  });

  // Itens em reteste (com filtros)
  const {
    data: itensReteste = [],
    isLoading: loadingReteste,
  } = useQuery({
    queryKey: ['itens_reteste_filtrados', baseFilter, statusFilter, search],
    queryFn: () => retesteService.getItensRetesteComFiltros({
      base_id: baseFilter || undefined,
      status: statusFilter || undefined,
      search: search || undefined,
    }),
    staleTime: 1 * 60 * 1000,
  });

  // Histórico (itens concluídos)
  const {
    data: historicoReteste = [],
    isLoading: loadingHistorico,
  } = useQuery({
    queryKey: ['reteste_historico'],
    queryFn: async () => {
      const query = supabase
        .from('vw_itens_reteste_completo')
        .select('*')
        .in('status', ['aprovado', 'reprovado'])
        .order('data_conclusao', { ascending: false });

      const { data, error } = await query;
      if (error) throw error;
      return data as ItemRetesteCompleto[];
    },
    staleTime: 2 * 60 * 1000,
  });

  // Itens de estoque da base selecionada (para enviar para reteste)
  const { data: itensEstoqueBase = [] } = useQuery({
    queryKey: ['itens_estoque_base', enviarBase],
    queryFn: async () => {
      if (!enviarBase) return [];
      const { data, error } = await supabase
        .from('itens_estoque')
        .select('id, nome, codigo, categoria, estoque_atual, valor_unitario')
        .eq('base_id', enviarBase)
        .eq('status', 'ativo')
        .gt('estoque_atual', 0)
        .order('nome');
      if (error) throw error;
      return data || [];
    },
    enabled: !!enviarBase,
    staleTime: 1 * 60 * 1000,
  });

  // ============================================================================
  // MUTATIONS
  // ============================================================================

  const concluirRetesteMutation = useMutation({
    mutationFn: async () => {
      if (!selectedItem || !user?.id) throw new Error('Dados inválidos');
      if (!conclusaoObservacoes.trim()) throw new Error('Observações são obrigatórias');

      return retesteService.concluirRetesteV2({
        reteste_id: selectedItem.id,
        status: conclusaoStatus,
        observacoes: conclusaoObservacoes,
        numero_laudo: conclusaoLaudo || undefined,
        usuario_conclusao: user.id,
      });
    },
    onSuccess: (result) => {
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: ['itens_reteste_filtrados'] });
        queryClient.invalidateQueries({ queryKey: ['reteste_historico'] });
        queryClient.invalidateQueries({ queryKey: ['reteste_estatisticas'] });
        notify(`Reteste ${conclusaoStatus === 'aprovado' ? 'aprovado' : 'reprovado'} com sucesso!`, 'success');

        if (conclusaoStatus === 'reprovado' && selectedItem) {
          setItemReprovado(selectedItem);
          setShowDestinoModal(true);
        }

        setShowConcluirModal(false);
        resetConcluirForm();
      } else {
        notify(result.message || 'Erro ao concluir reteste', 'error');
      }
    },
    onError: (error: Error) => {
      notify('Erro ao concluir reteste: ' + error.message, 'error');
    },
  });

  const descartarMutation = useMutation({
    mutationFn: async () => {
      if (!itemReprovado || !user?.id) throw new Error('Dados inválidos');
      if (!destinoMotivo.trim()) throw new Error('Motivo é obrigatório');

      return retesteService.descartarItemReteste({
        reteste_id: itemReprovado.id,
        motivo: destinoMotivo,
        responsavel: user.id,
      });
    },
    onSuccess: (result) => {
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: ['itens_reteste_filtrados'] });
        queryClient.invalidateQueries({ queryKey: ['reteste_historico'] });
        queryClient.invalidateQueries({ queryKey: ['reteste_estatisticas'] });
        notify('Item descartado com sucesso!', 'success');
        setShowDestinoModal(false);
        resetDestinoForm();
      } else {
        notify(result.message || 'Erro ao descartar item', 'error');
      }
    },
    onError: (error: Error) => {
      notify('Erro ao descartar item: ' + error.message, 'error');
    },
  });

  const reenviarMutation = useMutation({
    mutationFn: async () => {
      if (!itemReprovado || !user?.id) throw new Error('Dados inválidos');
      if (!destinoMotivo.trim()) throw new Error('Motivo é obrigatório');

      return retesteService.reenviarParaReteste({
        reteste_id: itemReprovado.id,
        motivo: destinoMotivo,
        responsavel: user.id,
      });
    },
    onSuccess: (result) => {
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: ['itens_reteste_filtrados'] });
        queryClient.invalidateQueries({ queryKey: ['reteste_historico'] });
        queryClient.invalidateQueries({ queryKey: ['reteste_estatisticas'] });
        notify('Item reenviado para reteste com sucesso!', 'success');
        setShowDestinoModal(false);
        resetDestinoForm();
      } else {
        notify(result.message || 'Erro ao reenviar para reteste', 'error');
      }
    },
    onError: (error: Error) => {
      notify('Erro ao reenviar para reteste: ' + error.message, 'error');
    },
  });

  const enviarEstoqueMutation = useMutation({
    mutationFn: async () => {
      if (!enviarItem || !enviarBase || !user?.id) throw new Error('Preencha todos os campos');
      if (!enviarMotivo.trim()) throw new Error('Motivo é obrigatório');
      if (enviarQuantidade <= 0) throw new Error('Quantidade deve ser maior que zero');

      return retesteService.enviarEstoqueParaReteste({
        item_estoque_id: enviarItem,
        base_id: enviarBase,
        quantidade: enviarQuantidade,
        motivo: enviarMotivo,
        responsavel: user.id,
      });
    },
    onSuccess: (result) => {
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: ['itens_reteste_filtrados'] });
        queryClient.invalidateQueries({ queryKey: ['reteste_estatisticas'] });
        queryClient.invalidateQueries({ queryKey: ['itens_estoque_base'] });
        notify('Item enviado para reteste com sucesso!', 'success');
        resetEnviarForm();
      } else {
        if (result.disponivel !== undefined && result.disponivel !== null) {
          setEnviarErroQuantidade(`Estoque insuficiente. Disponível: ${result.disponivel}`);
        }
        notify(result.message || 'Erro ao enviar para reteste', 'error');
      }
    },
    onError: (error: Error) => {
      notify('Erro ao enviar para reteste: ' + error.message, 'error');
    },
  });

  // ============================================================================
  // HELPERS
  // ============================================================================

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString('pt-BR');

  const formatDateTime = (dateString: string) =>
    new Date(dateString).toLocaleString('pt-BR');

  const getOrigemLabel = (item: ItemRetesteCompleto) => {
    if (item.origem === 'estoque') return 'Estoque';
    if (item.origem === 'reenvio') return 'Reenvio';
    if (item.equipe_nome) return `Equipe: ${item.equipe_nome}`;
    if (item.funcionario_nome) return item.funcionario_nome;
    return 'Devolução';
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, { color: string; label: string; Icon: typeof CheckCircleIcon }> = {
      em_reteste: { color: 'bg-yellow-100 text-yellow-800', label: 'Em Reteste', Icon: ClockIcon },
      aprovado: { color: 'bg-green-100 text-green-800', label: 'Aprovado', Icon: CheckCircleIcon },
      reprovado: { color: 'bg-red-100 text-red-800', label: 'Reprovado', Icon: XCircleIcon },
    };
    const c = config[status] || config.em_reteste;
    return (
      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${c.color}`}>
        <c.Icon className="h-3 w-3 mr-1" />
        {c.label}
      </span>
    );
  };

  const resetConcluirForm = () => {
    setConclusaoStatus('aprovado');
    setConclusaoObservacoes('');
    setConclusaoLaudo('');
    setSelectedItem(null);
  };

  const resetDestinoForm = () => {
    setDestinoOpcao('descartar');
    setDestinoMotivo('');
    setItemReprovado(null);
  };

  const resetEnviarForm = () => {
    setEnviarItem('');
    setEnviarQuantidade(1);
    setEnviarMotivo('');
    setEnviarSearchItem('');
    setEnviarErroQuantidade('');
  };

  // ============================================================================
  // FILTERED DATA
  // ============================================================================

  const historicoFiltrado = useMemo(() => {
    return historicoReteste.filter(item => {
      if (historicoResultado && item.status !== historicoResultado) return false;
      if (historicoDataInicio && item.data_conclusao && item.data_conclusao < historicoDataInicio) return false;
      if (historicoDataFim && item.data_conclusao && item.data_conclusao > historicoDataFim + 'T23:59:59') return false;
      if (historicoSearch) {
        const s = historicoSearch.toLowerCase();
        const matchNome = item.nome_item?.toLowerCase().includes(s);
        const matchCodigo = item.codigo_item?.toLowerCase().includes(s);
        const matchFunc = item.funcionario_nome?.toLowerCase().includes(s);
        if (!matchNome && !matchCodigo && !matchFunc) return false;
      }
      return true;
    });
  }, [historicoReteste, historicoResultado, historicoDataInicio, historicoDataFim, historicoSearch]);

  const filteredItensEstoque = useMemo(() => {
    if (!enviarSearchItem) return itensEstoqueBase;
    const s = enviarSearchItem.toLowerCase();
    return itensEstoqueBase.filter((item: { nome?: string; codigo?: string }) =>
      item.nome?.toLowerCase().includes(s) ||
      item.codigo?.toLowerCase().includes(s)
    );
  }, [itensEstoqueBase, enviarSearchItem]);

  const selectedEstoqueItem = useMemo(() => {
    return itensEstoqueBase.find((item: { id: string }) => item.id === enviarItem);
  }, [itensEstoqueBase, enviarItem]);

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Controle de Reteste</h1>
        <p className="text-gray-600">Gerencie itens em processo de reteste, histórico e envio para reteste</p>
      </div>

      {/* Estatísticas */}
      <EstatisticasReteste estatisticas={estatisticas} formatCurrency={formatCurrency} />

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8 px-6">
            <button
              onClick={() => setActiveTab('em_reteste')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'em_reteste'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Em Reteste
            </button>
            <button
              onClick={() => setActiveTab('historico')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'historico'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Histórico
            </button>
            <button
              onClick={() => setActiveTab('enviar')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'enviar'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Enviar para Reteste
            </button>
          </nav>
        </div>

        {/* Tab: Em Reteste */}
        {activeTab === 'em_reteste' && (
          <div>
            {/* Filtros */}
            <div className="p-4 border-b border-gray-200">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="md:col-span-2">
                  <div className="relative">
                    <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Buscar por item, código ou funcionário..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div>
                  <select
                    value={baseFilter}
                    onChange={(e) => setBaseFilter(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Todas as bases</option>
                    {bases.map((base: { id: string; nome: string }) => (
                      <option key={base.id} value={base.id}>{base.nome}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Todos os status</option>
                    <option value="em_reteste">Em Reteste</option>
                    <option value="aprovado">Aprovado</option>
                    <option value="reprovado">Reprovado</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Tabela */}
            <div className="p-6">
              {loadingReteste ? (
                <div className="flex items-center justify-center h-32">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : itensReteste.length === 0 ? (
                <div className="text-center py-12">
                  <ClockIcon className="mx-auto h-12 w-12 text-gray-400" />
                  <p className="mt-2 text-gray-500">Nenhum item encontrado</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Item</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Qtd</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Base</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Origem</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Data Entrada</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Motivo</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {itensReteste.map((item) => (
                        <tr key={item.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">{item.nome_item}</div>
                            <div className="text-sm text-gray-500">{item.codigo_item}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.quantidade}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.base_nome}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{getOrigemLabel(item)}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatDate(item.data_entrada_reteste)}</td>
                          <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">{item.motivo_reteste}</td>
                          <td className="px-6 py-4 whitespace-nowrap">{getStatusBadge(item.status)}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            {item.status === 'em_reteste' && (
                              <button
                                onClick={() => {
                                  setSelectedItem(item);
                                  setShowConcluirModal(true);
                                }}
                                className="inline-flex items-center px-3 py-1 bg-blue-600 text-white text-xs font-medium rounded-md hover:bg-blue-700"
                              >
                                <CheckCircleIcon className="h-4 w-4 mr-1" />
                                Concluir
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab: Histórico */}
        {activeTab === 'historico' && (
          <div>
            {/* Filtros do Histórico */}
            <div className="p-4 border-b border-gray-200">
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <div className="md:col-span-2">
                  <div className="relative">
                    <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Buscar por item, código ou funcionário..."
                      value={historicoSearch}
                      onChange={(e) => setHistoricoSearch(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div>
                  <select
                    value={historicoResultado}
                    onChange={(e) => setHistoricoResultado(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Todos os resultados</option>
                    <option value="aprovado">Aprovado</option>
                    <option value="reprovado">Reprovado</option>
                  </select>
                </div>
                <div>
                  <input
                    type="date"
                    value={historicoDataInicio}
                    onChange={(e) => setHistoricoDataInicio(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Data início"
                  />
                </div>
                <div>
                  <input
                    type="date"
                    value={historicoDataFim}
                    onChange={(e) => setHistoricoDataFim(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Data fim"
                  />
                </div>
              </div>
            </div>

            {/* Tabela Histórico */}
            <div className="p-6">
              {loadingHistorico ? (
                <div className="flex items-center justify-center h-32">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : historicoFiltrado.length === 0 ? (
                <div className="text-center py-12">
                  <DocumentTextIcon className="mx-auto h-12 w-12 text-gray-400" />
                  <p className="mt-2 text-gray-500">Nenhum registro no histórico</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Item</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Resultado</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Data Entrada</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Data Conclusão</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Responsável</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Observações</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nº Laudo</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {historicoFiltrado.map((item) => (
                        <tr key={item.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">{item.nome_item}</div>
                            <div className="text-sm text-gray-500">{item.codigo_item}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">{getStatusBadge(item.status)}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatDate(item.data_entrada_reteste)}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {item.data_conclusao ? formatDateTime(item.data_conclusao) : '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {item.usuario_conclusao_nome || '-'}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">
                            {item.observacoes_reteste || '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {item.numero_laudo || '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab: Enviar para Reteste */}
        {activeTab === 'enviar' && (
          <div className="p-6">
            <div className="max-w-3xl mx-auto">
              {/* Header com ícone */}
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <PaperAirplaneIcon className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Enviar Item do Estoque para Reteste</h3>
                  <p className="text-sm text-gray-500">
                    A quantidade será subtraída do estoque disponível e ficará separada até a conclusão do reteste.
                  </p>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Coluna esquerda: Formulário */}
                <div className="space-y-5">
                  {/* Step 1: Base */}
                  <div className="bg-white border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold">1</span>
                      <label className="text-sm font-medium text-gray-900">Selecione a Base</label>
                    </div>
                    <select
                      value={enviarBase}
                      onChange={(e) => {
                        setEnviarBase(e.target.value);
                        setEnviarItem('');
                        setEnviarQuantidade(1);
                        setEnviarErroQuantidade('');
                      }}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-sm"
                    >
                      <option value="">Selecione uma base...</option>
                      {bases.map((base: { id: string; nome: string }) => (
                        <option key={base.id} value={base.id}>{base.nome}</option>
                      ))}
                    </select>
                  </div>

                  {/* Step 2: Item */}
                  <div className={`bg-white border rounded-lg p-4 transition-all ${enviarBase ? 'border-gray-200' : 'border-dashed border-gray-200 opacity-50'}`}>
                    <div className="flex items-center gap-2 mb-3">
                      <span className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${enviarBase ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'}`}>2</span>
                      <label className="text-sm font-medium text-gray-900">Selecione o Item</label>
                    </div>
                    {enviarBase ? (
                      <>
                        {/* Item selecionado */}
                        {enviarItem && selectedEstoqueItem ? (
                          <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-lg">
                            <div>
                              <div className="font-medium text-sm text-gray-900">{selectedEstoqueItem.nome}</div>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-xs text-gray-500">Cód: {selectedEstoqueItem.codigo}</span>
                                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                                  Estoque: {selectedEstoqueItem.estoque_atual}
                                </span>
                              </div>
                            </div>
                            <button
                              onClick={() => {
                                setEnviarItem('');
                                setEnviarQuantidade(1);
                                setEnviarErroQuantidade('');
                              }}
                              className="text-xs text-blue-600 hover:text-blue-800 font-medium px-2 py-1 rounded hover:bg-blue-100 transition-colors"
                            >
                              Trocar
                            </button>
                          </div>
                        ) : (
                          <>
                            <div className="relative mb-3">
                              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                              <input
                                type="text"
                                placeholder="Buscar por nome ou código..."
                                value={enviarSearchItem}
                                onChange={(e) => setEnviarSearchItem(e.target.value)}
                                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                              />
                            </div>
                            <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
                              {filteredItensEstoque.length === 0 ? (
                                <div className="p-4 text-center text-sm text-gray-400">Nenhum item encontrado</div>
                              ) : (
                                filteredItensEstoque.map((item: { id: string; nome: string; codigo: string; estoque_atual: number }) => (
                                  <button
                                    key={item.id}
                                    onClick={() => {
                                      setEnviarItem(item.id);
                                      setEnviarQuantidade(1);
                                      setEnviarErroQuantidade('');
                                    }}
                                    className="w-full text-left px-4 py-3 text-sm hover:bg-blue-50 transition-colors"
                                  >
                                    <div className="font-medium text-gray-900">{item.nome}</div>
                                    <div className="flex items-center justify-between mt-0.5">
                                      <span className="text-xs text-gray-500">Cód: {item.codigo}</span>
                                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                                        item.estoque_atual > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                      }`}>
                                        Estoque: {item.estoque_atual}
                                      </span>
                                    </div>
                                  </button>
                                ))
                              )}
                            </div>
                          </>
                        )}
                      </>
                    ) : (
                      <p className="text-sm text-gray-400 italic">Selecione uma base primeiro</p>
                    )}
                  </div>

                  {/* Step 3: Quantidade */}
                  <div className={`bg-white border rounded-lg p-4 transition-all ${enviarItem ? 'border-gray-200' : 'border-dashed border-gray-200 opacity-50'}`}>
                    <div className="flex items-center gap-2 mb-3">
                      <span className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${enviarItem ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'}`}>3</span>
                      <label className="text-sm font-medium text-gray-900">Quantidade</label>
                      {selectedEstoqueItem && (
                        <span className="ml-auto text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                          Disponível: {selectedEstoqueItem.estoque_atual}
                        </span>
                      )}
                    </div>
                    {enviarItem ? (
                      <>
                        <input
                          type="number"
                          min={1}
                          max={selectedEstoqueItem?.estoque_atual || 1}
                          value={enviarQuantidade}
                          onChange={(e) => {
                            const val = parseInt(e.target.value) || 0;
                            setEnviarQuantidade(val);
                            if (selectedEstoqueItem && val > selectedEstoqueItem.estoque_atual) {
                              setEnviarErroQuantidade(`Quantidade excede o estoque disponível (${selectedEstoqueItem.estoque_atual})`);
                            } else if (val <= 0) {
                              setEnviarErroQuantidade('Quantidade deve ser maior que zero');
                            } else {
                              setEnviarErroQuantidade('');
                            }
                          }}
                          className={`w-full px-3 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm ${
                            enviarErroQuantidade ? 'border-red-400 bg-red-50' : 'border-gray-300'
                          }`}
                        />
                        {enviarErroQuantidade && (
                          <p className="mt-1.5 text-xs text-red-600 flex items-center gap-1">
                            <XCircleIcon className="h-3.5 w-3.5" />
                            {enviarErroQuantidade}
                          </p>
                        )}
                      </>
                    ) : (
                      <p className="text-sm text-gray-400 italic">Selecione um item primeiro</p>
                    )}
                  </div>

                  {/* Step 4: Motivo */}
                  <div className="bg-white border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold">4</span>
                      <label className="text-sm font-medium text-gray-900">Motivo do Reteste</label>
                    </div>
                    <textarea
                      value={enviarMotivo}
                      onChange={(e) => setEnviarMotivo(e.target.value)}
                      rows={3}
                      placeholder="Descreva o motivo para enviar este item para reteste..."
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm resize-none"
                    />
                  </div>
                </div>

                {/* Coluna direita: Resumo */}
                <div className="md:sticky md:top-6 self-start">
                  <div className="bg-gradient-to-br from-gray-50 to-blue-50 border border-gray-200 rounded-lg p-5">
                    <h4 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      <DocumentTextIcon className="h-4 w-4 text-blue-600" />
                      Resumo do Envio
                    </h4>

                    <div className="space-y-3">
                      <div className="flex justify-between items-center py-2 border-b border-gray-200">
                        <span className="text-xs text-gray-500">Base</span>
                        <span className="text-sm font-medium text-gray-900">
                          {enviarBase ? bases.find((b: { id: string; nome: string }) => b.id === enviarBase)?.nome || '—' : '—'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b border-gray-200">
                        <span className="text-xs text-gray-500">Item</span>
                        <span className="text-sm font-medium text-gray-900 text-right max-w-[60%] truncate">
                          {selectedEstoqueItem?.nome || '—'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b border-gray-200">
                        <span className="text-xs text-gray-500">Quantidade</span>
                        <span className={`text-sm font-medium ${enviarErroQuantidade ? 'text-red-600' : 'text-gray-900'}`}>
                          {enviarItem ? enviarQuantidade : '—'}
                        </span>
                      </div>
                      <div className="flex justify-between items-start py-2">
                        <span className="text-xs text-gray-500">Motivo</span>
                        <span className="text-sm text-gray-900 text-right max-w-[60%] line-clamp-2">
                          {enviarMotivo.trim() || '—'}
                        </span>
                      </div>
                    </div>

                    {/* Info box */}
                    <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                      <p className="text-xs text-amber-800">
                        ⚠️ Ao confirmar, a quantidade será removida do estoque normal e ficará em área separada de reteste até aprovação ou reprovação.
                      </p>
                    </div>

                    {/* Botão */}
                    <button
                      onClick={() => enviarEstoqueMutation.mutate()}
                      disabled={
                        enviarEstoqueMutation.isPending ||
                        !enviarBase ||
                        !enviarItem ||
                        !enviarMotivo.trim() ||
                        enviarQuantidade <= 0 ||
                        !!enviarErroQuantidade
                      }
                      className="mt-4 w-full inline-flex items-center justify-center px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-medium text-sm shadow-sm"
                    >
                      <PaperAirplaneIcon className="h-4 w-4 mr-2" />
                      {enviarEstoqueMutation.isPending ? 'Enviando...' : 'Confirmar Envio para Reteste'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal Concluir Reteste */}
      {showConcluirModal && selectedItem && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-lg shadow-lg rounded-md bg-white">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">Concluir Reteste</h3>
              <button
                onClick={() => { setShowConcluirModal(false); resetConcluirForm(); }}
                className="text-gray-400 hover:text-gray-600"
              >
                <XCircleIcon className="h-6 w-6" />
              </button>
            </div>

            <div className="mb-4 p-3 bg-gray-50 rounded-md">
              <p className="text-sm font-medium text-gray-900">{selectedItem.nome_item}</p>
              <p className="text-sm text-gray-500">{selectedItem.codigo_item} — Qtd: {selectedItem.quantidade}</p>
            </div>

            <div className="space-y-4">
              {/* Resultado */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Resultado *</label>
                <div className="flex space-x-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="resultado"
                      value="aprovado"
                      checked={conclusaoStatus === 'aprovado'}
                      onChange={() => setConclusaoStatus('aprovado')}
                      className="mr-2 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">Aprovado</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="resultado"
                      value="reprovado"
                      checked={conclusaoStatus === 'reprovado'}
                      onChange={() => setConclusaoStatus('reprovado')}
                      className="mr-2 text-red-600 focus:ring-red-500"
                    />
                    <span className="text-sm text-gray-700">Reprovado</span>
                  </label>
                </div>
              </div>

              {/* Observações */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Observações *</label>
                <textarea
                  value={conclusaoObservacoes}
                  onChange={(e) => setConclusaoObservacoes(e.target.value)}
                  rows={3}
                  placeholder="Descreva as observações da conclusão do reteste..."
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    !conclusaoObservacoes.trim() ? 'border-gray-300' : 'border-gray-300'
                  }`}
                />
              </div>

              {/* Número de Laudo */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Número de Laudo (opcional)</label>
                <input
                  type="text"
                  value={conclusaoLaudo}
                  onChange={(e) => setConclusaoLaudo(e.target.value)}
                  placeholder="Ex: LAU-2024-001"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-4 border-t mt-4">
              <button
                onClick={() => { setShowConcluirModal(false); resetConcluirForm(); }}
                className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
              >
                Cancelar
              </button>
              <button
                onClick={() => concluirRetesteMutation.mutate()}
                disabled={concluirRetesteMutation.isPending || !conclusaoObservacoes.trim()}
                className={`px-4 py-2 text-white rounded-md disabled:opacity-50 ${
                  conclusaoStatus === 'aprovado'
                    ? 'bg-green-600 hover:bg-green-700'
                    : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {concluirRetesteMutation.isPending
                  ? 'Processando...'
                  : conclusaoStatus === 'aprovado'
                    ? 'Aprovar'
                    : 'Reprovar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Destino Reprovado */}
      {showDestinoModal && itemReprovado && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-lg shadow-lg rounded-md bg-white">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">Destino do Item Reprovado</h3>
              <button
                onClick={() => { setShowDestinoModal(false); resetDestinoForm(); }}
                className="text-gray-400 hover:text-gray-600"
              >
                <XCircleIcon className="h-6 w-6" />
              </button>
            </div>

            <div className="mb-4 p-3 bg-red-50 rounded-md">
              <p className="text-sm font-medium text-red-900">{itemReprovado.nome_item}</p>
              <p className="text-sm text-red-700">{itemReprovado.codigo_item} — Qtd: {itemReprovado.quantidade}</p>
              <p className="text-xs text-red-600 mt-1">Item reprovado no reteste. Selecione o destino:</p>
            </div>

            <div className="space-y-4">
              {/* Opções */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Destino *</label>
                <div className="space-y-2">
                  <label className="flex items-center p-3 border rounded-md cursor-pointer hover:bg-gray-50">
                    <input
                      type="radio"
                      name="destino"
                      value="descartar"
                      checked={destinoOpcao === 'descartar'}
                      onChange={() => setDestinoOpcao('descartar')}
                      className="mr-3 text-red-600 focus:ring-red-500"
                    />
                    <div>
                      <span className="text-sm font-medium text-gray-900">Descartar</span>
                      <p className="text-xs text-gray-500">O item será registrado como descartado</p>
                    </div>
                  </label>
                  <label className="flex items-center p-3 border rounded-md cursor-pointer hover:bg-gray-50">
                    <input
                      type="radio"
                      name="destino"
                      value="reenviar"
                      checked={destinoOpcao === 'reenviar'}
                      onChange={() => setDestinoOpcao('reenviar')}
                      className="mr-3 text-blue-600 focus:ring-blue-500"
                    />
                    <div>
                      <span className="text-sm font-medium text-gray-900">Reenviar para Reteste</span>
                      <p className="text-xs text-gray-500">O item será enviado para um novo ciclo de reteste</p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Motivo */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Motivo *</label>
                <textarea
                  value={destinoMotivo}
                  onChange={(e) => setDestinoMotivo(e.target.value)}
                  rows={3}
                  placeholder={destinoOpcao === 'descartar'
                    ? 'Descreva o motivo do descarte...'
                    : 'Descreva o motivo para reenviar ao reteste...'}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-4 border-t mt-4">
              <button
                onClick={() => { setShowDestinoModal(false); resetDestinoForm(); }}
                className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  if (destinoOpcao === 'descartar') {
                    descartarMutation.mutate();
                  } else {
                    reenviarMutation.mutate();
                  }
                }}
                disabled={
                  (descartarMutation.isPending || reenviarMutation.isPending) ||
                  !destinoMotivo.trim()
                }
                className={`px-4 py-2 text-white rounded-md disabled:opacity-50 ${
                  destinoOpcao === 'descartar'
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {(descartarMutation.isPending || reenviarMutation.isPending)
                  ? 'Processando...'
                  : destinoOpcao === 'descartar'
                    ? 'Descartar'
                    : 'Reenviar para Reteste'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// COMPONENTE: Estatísticas
// ============================================================================

function EstatisticasReteste({
  estatisticas,
  formatCurrency,
}: {
  estatisticas?: {
    totalEmReteste: number;
    aprovadosPeriodo: number;
    reprovadosPeriodo: number;
    aguardandoAvaliacao: number;
    valorTotalEmReteste: number;
  };
  formatCurrency: (value: number) => string;
}) {
  const stats = estatisticas || {
    totalEmReteste: 0,
    aprovadosPeriodo: 0,
    reprovadosPeriodo: 0,
    aguardandoAvaliacao: 0,
    valorTotalEmReteste: 0,
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex items-center">
          <ClockIcon className="h-8 w-8 text-yellow-500 mr-3" />
          <div>
            <div className="text-2xl font-bold text-gray-900">{stats.totalEmReteste}</div>
            <div className="text-sm text-gray-600">Em Reteste</div>
          </div>
        </div>
      </div>
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex items-center">
          <CheckCircleIcon className="h-8 w-8 text-green-500 mr-3" />
          <div>
            <div className="text-2xl font-bold text-green-600">{stats.aprovadosPeriodo}</div>
            <div className="text-sm text-gray-600">Aprovados</div>
          </div>
        </div>
      </div>
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex items-center">
          <XCircleIcon className="h-8 w-8 text-red-500 mr-3" />
          <div>
            <div className="text-2xl font-bold text-red-600">{stats.reprovadosPeriodo}</div>
            <div className="text-sm text-gray-600">Reprovados</div>
          </div>
        </div>
      </div>
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex items-center">
          <ArrowPathIcon className="h-8 w-8 text-blue-500 mr-3" />
          <div>
            <div className="text-2xl font-bold text-blue-600">{stats.aguardandoAvaliacao}</div>
            <div className="text-sm text-gray-600">Aguardando</div>
          </div>
        </div>
      </div>
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex items-center">
          <CurrencyDollarIcon className="h-8 w-8 text-purple-500 mr-3" />
          <div>
            <div className="text-2xl font-bold text-purple-600">{formatCurrency(stats.valorTotalEmReteste)}</div>
            <div className="text-sm text-gray-600">Valor em Reteste</div>
          </div>
        </div>
      </div>
    </div>
  );
}
