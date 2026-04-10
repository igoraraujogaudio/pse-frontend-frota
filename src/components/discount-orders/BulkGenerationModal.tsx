'use client';

import { useState, useMemo, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useNotification } from '@/contexts/NotificationContext';
import { DiscountOrder } from '@/types/discountOrder';
import { User } from '@/types/index';
import { 
  DocumentArrowDownIcon, 
  CheckCircleIcon, 
  XCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';

interface BulkGenerationModalProps {
  isOpen: boolean;
  onClose: () => void;
  orders: DiscountOrder[];
  users: User[];
}

interface SelectedOrder extends DiscountOrder {
  selected: boolean;
}

export default function BulkGenerationModal({ 
  isOpen, 
  onClose, 
  orders, 
  users 
}: BulkGenerationModalProps) {
  const { notify } = useNotification();
  const [selectedOrders, setSelectedOrders] = useState<SelectedOrder[]>([]);
  const [selectAll, setSelectAll] = useState(false);

  // Filtrar apenas ordens que já têm PDF gerado para download
  const pendingOrders = useMemo(() => {
    return orders.filter(order => {
      const status = order.recusado ? 'recusada' : order.status === 'assinada' ? 'assinada' : 'pendente';
      // Só mostrar ordens que JÁ têm arquivo gerado para download
      return status === 'pendente' && order.arquivo_assinado_url;
    });
  }, [orders]);

  // Inicializar seleções quando modal abrir
  useEffect(() => {
    if (isOpen && pendingOrders.length > 0) {
      const initialSelected = pendingOrders.map(order => ({ ...order, selected: false }));
      setSelectedOrders(initialSelected);
      setSelectAll(false);
    }
  }, [isOpen, pendingOrders]);

  // Criar mapa de usuários para busca rápida
  const userMap = useMemo(() => {
    const map: Record<string, User> = {};
    users.forEach(user => {
      map[user.id] = user;
    });
    return map;
  }, [users]);

  // Mutation para download em massa
  const bulkDownloadMutation = useMutation({
    mutationFn: async (orderIds: string[]) => {
      const url = '/api/discount-orders/bulk-download';
      console.log('🌐 URL sendo chamada:', url);
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ orderIds }),
      });

      if (!response.ok) {
        let errorMessage = 'Erro ao baixar PDFs em massa';
        try {
          const error = await response.json();
          errorMessage = error.error || errorMessage;
        } catch {
          errorMessage = `Erro HTTP ${response.status}: ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }

      return response;
    },
    onSuccess: async (response) => {
      const successfulCount = parseInt(response.headers.get('X-Successful-Count') || '0');
      const failedCount = parseInt(response.headers.get('X-Failed-Count') || '0');
      
      // Criar blob e fazer download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ordens_desconto_download_${Date.now()}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      notify(
        `Download concluído! ${successfulCount} PDFs baixados${failedCount > 0 ? `, ${failedCount} com erro` : ''}`,
        'success'
      );
      
      onClose();
    },
    onError: (error: Error) => {
      notify(`Erro no download em massa: ${error.message}`, 'error');
    }
  });

  // Função para alternar seleção de uma ordem
  const toggleOrderSelection = (orderId: string) => {
    setSelectedOrders(prev => 
      prev.map(order => 
        order.id === orderId 
          ? { ...order, selected: !order.selected }
          : order
      )
    );
  };

  // Função para selecionar/desselecionar todas
  const toggleSelectAll = () => {
    const newSelectAll = !selectAll;
    setSelectAll(newSelectAll);
    setSelectedOrders(prev => 
      prev.map(order => ({ ...order, selected: newSelectAll }))
    );
  };

  // Obter ordens selecionadas
  const selectedOrderIds = selectedOrders.filter(order => order.selected).map(order => order.id);

  // Função para download em massa
  const handleBulkDownload = () => {
    console.log('🔍 Debug - handleBulkDownload chamado');
    console.log('📋 selectedOrderIds:', selectedOrderIds);
    console.log('📊 selectedOrders:', selectedOrders.filter(o => o.selected));
    
    if (selectedOrderIds.length === 0) {
      notify('Selecione pelo menos uma ordem para download', 'warning');
      return;
    }

    console.log('🚀 Enviando para API de download:', selectedOrderIds);
    bulkDownloadMutation.mutate(selectedOrderIds);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center bg-blue-50 rounded-full w-10 h-10">
              <DocumentArrowDownIcon className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                Download em Massa - Modelos de Pedentes
              </h2>
              <p className="text-sm text-gray-600">
                Selecione as ordens de desconto pendentes para baixar os modelos
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl"
            aria-label="Fechar modal"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {/* Summary */}
          <div className="p-4 bg-gray-50 border-b border-gray-200">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="flex items-center gap-2">
                <ClockIcon className="h-5 w-5 text-orange-500" />
                <div>
                  <p className="text-sm font-medium text-gray-900">Total Pendentes</p>
                  <p className="text-lg font-semibold text-orange-600">{pendingOrders.length}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircleIcon className="h-5 w-5 text-green-500" />
                <div>
                  <p className="text-sm font-medium text-gray-900">Selecionadas</p>
                  <p className="text-lg font-semibold text-green-600">{selectedOrderIds.length}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <ExclamationTriangleIcon className="h-5 w-5 text-yellow-500" />
                <div>
                  <p className="text-sm font-medium text-gray-900">Valor Total</p>
                  <p className="text-lg font-semibold text-yellow-600">
                    R$ {selectedOrders
                      .filter(order => order.selected)
                      .reduce((sum, order) => sum + (order.valor_total || 0), 0)
                      .toLocaleString('pt-BR', { minimumFractionDigits: 2 })
                    }
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <DocumentArrowDownIcon className="h-5 w-5 text-blue-500" />
                <div>
                  <p className="text-sm font-medium text-gray-900">Status</p>
                  <p className="text-sm font-semibold text-blue-600">
                    {bulkDownloadMutation.isPending ? 'Baixando...' : 'Pronto'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Orders List */}
          <div className="flex-1 overflow-y-auto">
            {pendingOrders.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                <XCircleIcon className="h-12 w-12 mb-4" />
                <p className="text-lg font-medium">Nenhuma ordem pendente encontrada</p>
                <p className="text-sm">Todas as ordens já foram processadas</p>
              </div>
            ) : (
              <div className="p-4">
                {/* Select All */}
                <div className="flex items-center gap-3 mb-4 p-3 bg-gray-50 rounded-lg">
                  <input
                    type="checkbox"
                    id="select-all"
                    checked={selectAll}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="select-all" className="text-sm font-medium text-gray-900">
                    Selecionar todas as ordens ({pendingOrders.length})
                  </label>
                </div>

                {/* Orders Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {selectedOrders.map((order) => {
                    const user = userMap[order.target_user_id];
                    const status = order.recusado ? 'recusada' : order.status === 'assinada' ? 'assinada' : 'pendente';
                    
                    return (
                      <div
                        key={order.id}
                        className={`border rounded-lg p-4 cursor-pointer transition-all ${
                          order.selected
                            ? 'border-blue-500 bg-blue-50 shadow-md'
                            : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
                        }`}
                        onClick={() => toggleOrderSelection(order.id)}
                      >
                        <div className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            checked={order.selected}
                            onChange={() => toggleOrderSelection(order.id)}
                            className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 mt-1"
                            onClick={(e) => e.stopPropagation()}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-xs font-medium text-gray-500">ID: {order.id.slice(0, 8)}</span>
                              <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                                status === 'pendente' 
                                  ? 'bg-orange-100 text-orange-700'
                                  : status === 'assinada'
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-red-100 text-red-700'
                              }`}>
                                {status === 'pendente' ? 'Pendente' : status === 'assinada' ? 'Assinada' : 'Recusada'}
                              </span>
                            </div>
                            
                            <h3 className="font-medium text-gray-900 truncate">
                              {user?.nome || 'Usuário não encontrado'}
                            </h3>
                            
                            <div className="text-sm text-gray-600 space-y-1 mt-2">
                              <p><span className="font-medium">Matrícula:</span> {user?.matricula || 'N/A'}</p>
                              <p><span className="font-medium">CPF:</span> {order.cpf || 'N/A'}</p>
                              <p><span className="font-medium">Valor:</span> R$ {order.valor_total?.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) || '0,00'}</p>
                              {order.placa && (
                                <p><span className="font-medium">Placa:</span> {order.placa}</p>
                              )}
                              <p><span className="font-medium">Data:</span> {
                                order.data_geracao 
                                  ? new Date(order.data_geracao).toLocaleDateString('pt-BR')
                                  : 'N/A'
                              }</p>
                            </div>
                            
                            <div className="mt-3">
                              <p className="text-xs text-gray-500 line-clamp-2">
                                {order.descricao}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50">
          <div className="text-sm text-gray-600">
            {selectedOrderIds.length > 0 && (
              <p>
                {selectedOrderIds.length} ordem(ns) selecionada(s) • 
                Valor total: R$ {selectedOrders
                  .filter(order => order.selected)
                  .reduce((sum, order) => sum + (order.valor_total || 0), 0)
                  .toLocaleString('pt-BR', { minimumFractionDigits: 2 })
                }
              </p>
            )}
          </div>
          
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500"
              disabled={bulkDownloadMutation.isPending}
            >
              Cancelar
            </button>
            <button
              onClick={handleBulkDownload}
              disabled={selectedOrderIds.length === 0 || bulkDownloadMutation.isPending}
              className="px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {bulkDownloadMutation.isPending ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Baixando PDFs...
                </>
              ) : (
                <>
                  <DocumentArrowDownIcon className="h-4 w-4" />
                  Baixar {selectedOrderIds.length} PDF(s)
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
