'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { userService } from '@/services/userService';
import { locationService } from '@/services/locationService';
import { inventarioService } from '@/services/inventarioService';
import { Base } from '@/types';
import { useState, useMemo, useEffect, useCallback } from 'react';
import { MagnifyingGlassIcon, DocumentTextIcon, PencilIcon, TrashIcon, CheckCircleIcon, XCircleIcon, DocumentArrowDownIcon, EyeIcon } from '@heroicons/react/24/outline';
import { useNotification } from '@/contexts/NotificationContext';
import { useAuth } from '@/contexts/AuthContext';
import { validarCPF } from '@/utils/cpfUtils';
import { supabase } from '@/lib/supabase';
import { PERMISSION_CODES } from '@/hooks/useModularPermissions';
import ProtectedRoute from '@/components/ProtectedRoute';
import { InventarioFuncionario } from '@/types/almoxarifado';
import { User } from '@/types/index';
import { descontoMaterialPdfService } from '@/services/descontoMaterialPdfService';
import { descontoMaterialExcelService } from '@/services/descontoMaterialExcelService';


interface UserWithCPF extends User {
  cpf?: string;
  base_id?: string;
}

interface ItemDesconto {
  id: string;
  tipo_item_id: string;
  nome_item: string;
  quantidade: number;
  valor_unitario: number;
  valor_total: number;
  motivo_desconto: string;
  inventario_funcionario_id?: string; // Se veio do inventário
}

interface OrdemDescontoMaterial {
  id?: string;
  funcionario_id: string;
  funcionario_nome: string;
  funcionario_cpf: string;
  funcionario_matricula: string;
  base_id: string;
  base_nome: string;
  descricao: string;
  valor_total: number;
  status: 'pendente' | 'assinada' | 'recusada';
  itens: ItemDesconto[];
  documentos_comprobatórios: string[];
  testemunhas: string[];
  criado_por: string;
  criado_em: string;
  assinado_em?: string;
  recusado_em?: string;
  motivo_recusa?: string;
}

const statusOptions = [
  { key: 'all', label: 'Todos' },
  { key: 'pendente', label: 'Pendente' },
  { key: 'assinada', label: 'Assinada' },
  { key: 'recusada', label: 'Recusada' },
];

export default function DescontoMaterialPage() {
  return (
    <ProtectedRoute requiredPermissions={[
      PERMISSION_CODES.ALMOXARIFADO.DASHBOARD_ADMINISTRATIVO,
      PERMISSION_CODES.ALMOXARIFADO.RELATORIOS_CONSUMO
    ]}>
      <DescontoMaterialContent />
    </ProtectedRoute>
  );
}

function DescontoMaterialContent() {
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();
  const { notify } = useNotification();

  // Queries principais
  const {
    data: ordens = [],
    isLoading: ordensLoading
  } = useQuery({
    queryKey: ['ordens_desconto_material'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ordens_desconto')
        .select(`
          *,
          funcionario:usuarios(nome, matricula, cpf),
          base:bases(nome),
          criado_por_info:usuarios!criado_por(nome)
        `)
        .eq('almoxarifado', true)
        .order('criado_em', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const {
    data: users = [],
    isLoading: usersLoading
  } = useQuery({
    queryKey: ['users'],
    queryFn: userService.getAll,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  const {
    data: bases = [],
    isLoading: basesLoading
  } = useQuery<Base[]>({
    queryKey: ['bases'],
    queryFn: locationService.getAll,
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  });

  const {
    data: inventarios = [],
    isLoading: inventariosLoading
  } = useQuery({
    queryKey: ['inventario_funcionarios'],
    queryFn: inventarioService.getInventarioFuncionarios,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  });

  const {
    data: tiposItens = [],
    isLoading: tiposItensLoading
  } = useQuery({
    queryKey: ['tipos_itens'],
    queryFn: inventarioService.getTiposItens,
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  });

  // Estados locais
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [userFilter, setUserFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [cpfError, setCpfError] = useState('');

  // Estados do formulário
  const [formData, setFormData] = useState<Partial<OrdemDescontoMaterial>>({
    funcionario_id: '',
    funcionario_nome: '',
    funcionario_cpf: '',
    funcionario_matricula: '',
    base_id: '',
    base_nome: '',
    descricao: '',
    valor_total: 0,
    itens: [],
    documentos_comprobatórios: [],
    testemunhas: [],
    status: 'pendente'
  });

  const [selectedInventarioItems, setSelectedInventarioItems] = useState<InventarioFuncionario[]>([]);
  const [showInventarioModal, setShowInventarioModal] = useState(false);

  // Filtros e paginação
  const filteredOrdens = useMemo(() => {
    return ordens.filter(ordem => {
      const matchesSearch = !search || 
        ordem.funcionario?.nome?.toLowerCase().includes(search.toLowerCase()) ||
        ordem.funcionario?.matricula?.toLowerCase().includes(search.toLowerCase()) ||
        ordem.descricao?.toLowerCase().includes(search.toLowerCase());
      
      const matchesStatus = statusFilter === 'all' || ordem.status === statusFilter;
      const matchesUser = !userFilter || ordem.funcionario_id === userFilter;
      
      return matchesSearch && matchesStatus && matchesUser;
    });
  }, [ordens, search, statusFilter, userFilter]);

  const itemsPerPage = 10;
  const totalPages = Math.ceil(filteredOrdens.length / itemsPerPage);
  const paginatedOrdens = filteredOrdens.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Mutations
  const createMutation = useMutation({
    mutationFn: async (ordem: OrdemDescontoMaterial) => {
      const { data, error } = await supabase
        .from('ordens_desconto')
        .insert([{
          funcionario_id: ordem.funcionario_id,
          funcionario_nome: ordem.funcionario_nome,
          funcionario_cpf: ordem.funcionario_cpf,
          funcionario_matricula: ordem.funcionario_matricula,
          base_id: ordem.base_id,
          base_nome: ordem.base_nome,
          descricao: ordem.descricao,
          valor_total: ordem.valor_total,
          itens_inventario: ordem.itens,
          documentos_comprobatórios: ordem.documentos_comprobatórios,
          testemunhas: ordem.testemunhas,
          status: ordem.status,
          almoxarifado: true,
          criado_por: currentUser?.id
        }])
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ordens_desconto_material'] });
      setShowModal(false);
      resetForm();
      notify('Ordem de desconto criada com sucesso!', 'success');
    },
    onError: (error: Error) => {
      notify('Erro ao criar ordem de desconto: ' + error.message, 'error');
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...ordem }: OrdemDescontoMaterial) => {
      const { data, error } = await supabase
        .from('ordens_desconto')
        .update({
          ...ordem,
          itens_inventario: ordem.itens
        })
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ordens_desconto_material'] });
      setShowModal(false);
      resetForm();
      notify('Ordem de desconto atualizada com sucesso!', 'success');
    },
    onError: (error: Error) => {
      notify('Erro ao atualizar ordem de desconto: ' + error.message, 'error');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('ordens_desconto')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ordens_desconto_material'] });
      notify('Ordem de desconto excluída com sucesso!', 'success');
    },
    onError: (error: Error) => {
      notify('Erro ao excluir ordem de desconto: ' + error.message, 'error');
    }
  });

  // Funções auxiliares
  const resetForm = () => {
    setFormData({
      funcionario_id: '',
      funcionario_nome: '',
      funcionario_cpf: '',
      funcionario_matricula: '',
      base_id: '',
      base_nome: '',
      descricao: '',
      valor_total: 0,
      itens: [],
      documentos_comprobatórios: [],
      testemunhas: [],
      status: 'pendente'
    });
    setSelectedInventarioItems([]);
    setCpfError('');
  };

  const handleUserSelect = (user: UserWithCPF) => {
    setFormData(prev => ({
      ...prev,
      funcionario_id: user.id,
      funcionario_nome: user.nome,
      funcionario_cpf: user.cpf || '',
      funcionario_matricula: user.matricula || '',
      base_id: user.base_id || '',
      base_nome: bases.find(b => b.id === user.base_id)?.nome || ''
    }));
    setShowAutocomplete(false);
  };

  const handleCPFChange = (cpf: string) => {
    setFormData(prev => ({ ...prev, funcionario_cpf: cpf }));
    
    if (cpf && cpf.length === 11) {
      const isValid = validarCPF(cpf);
      setCpfError(isValid ? '' : 'CPF inválido');
    } else {
      setCpfError('');
    }
  };

  const addItemFromInventario = (inventarioItem: InventarioFuncionario) => {
    const tipoItem = tiposItens.find(t => t.id === inventarioItem.item_estoque_id);
    if (!tipoItem) return;

    const newItem: ItemDesconto = {
      id: `inv_${inventarioItem.id}`,
      tipo_item_id: inventarioItem.item_estoque_id,
      nome_item: tipoItem.nome,
      quantidade: inventarioItem.quantidade,
      valor_unitario: 0, // Será preenchido pelo usuário
      valor_total: 0,
      motivo_desconto: '',
      inventario_funcionario_id: inventarioItem.id
    };

    setFormData(prev => ({
      ...prev,
      itens: [...(prev.itens || []), newItem]
    }));

    // Remover do inventário (marcar para descarte)
    setSelectedInventarioItems(prev => [...prev, inventarioItem]);
  };

  const addItemIndividual = () => {
    const newItem: ItemDesconto = {
      id: `ind_${Date.now()}`,
      tipo_item_id: '',
      nome_item: '',
      quantidade: 1,
      valor_unitario: 0,
      valor_total: 0,
      motivo_desconto: ''
    };

    setFormData(prev => ({
      ...prev,
      itens: [...(prev.itens || []), newItem]
    }));
  };

  const updateItem = (itemId: string, field: keyof ItemDesconto, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      itens: prev.itens?.map(item => {
        if (item.id === itemId) {
          const updatedItem = { ...item, [field]: value };
          if (field === 'valor_unitario' || field === 'quantidade') {
            updatedItem.valor_total = updatedItem.valor_unitario * updatedItem.quantidade;
          }
          return updatedItem;
        }
        return item;
      })
    }));
  };

  const removeItem = (itemId: string) => {
    setFormData(prev => ({
      ...prev,
      itens: prev.itens?.filter(item => item.id !== itemId) || []
    }));
  };

  const calculateTotal = useCallback(() => {
    const total = formData.itens?.reduce((sum, item) => sum + item.valor_total, 0) || 0;
    setFormData(prev => ({ ...prev, valor_total: total }));
  }, [formData.itens]);

  useEffect(() => {
    calculateTotal();
  }, [formData.itens, calculateTotal]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.funcionario_id || !formData.descricao || !formData.itens?.length) {
      notify('Preencha todos os campos obrigatórios', 'error');
      return;
    }

    if ((formData.valor_total || 0) <= 0) {
      notify('O valor total deve ser maior que zero', 'error');
      return;
    }

    const ordemData: OrdemDescontoMaterial = {
      ...formData,
      funcionario_id: formData.funcionario_id!,
      funcionario_nome: formData.funcionario_nome!,
      funcionario_cpf: formData.funcionario_cpf!,
      funcionario_matricula: formData.funcionario_matricula!,
      base_id: formData.base_id!,
      base_nome: formData.base_nome!,
      descricao: formData.descricao!,
      valor_total: formData.valor_total || 0,
      itens: formData.itens!,
      documentos_comprobatórios: formData.documentos_comprobatórios || [],
      testemunhas: formData.testemunhas || [],
      status: 'pendente',
      criado_por: currentUser?.id || '',
      criado_em: new Date().toISOString()
    };

    if (formData.id) {
      updateMutation.mutate(ordemData);
    } else {
      createMutation.mutate(ordemData);
    }
  };

  const handleEdit = (ordem: OrdemDescontoMaterial) => {
    setFormData({
      id: ordem.id,
      funcionario_id: ordem.funcionario_id,
      funcionario_nome: ordem.funcionario_nome,
      funcionario_cpf: ordem.funcionario_cpf,
      funcionario_matricula: ordem.funcionario_matricula,
      base_id: ordem.base_id,
      base_nome: ordem.base_nome,
      descricao: ordem.descricao,
      valor_total: ordem.valor_total,
      itens: ordem.itens || [],
      documentos_comprobatórios: ordem.documentos_comprobatórios || [],
      testemunhas: ordem.testemunhas || [],
      status: ordem.status
    });
    setShowModal(true);
  };

  const handleDelete = (id: string) => {
    if (confirm('Tem certeza que deseja excluir esta ordem de desconto?')) {
      deleteMutation.mutate(id);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      pendente: { color: 'bg-yellow-100 text-yellow-800', label: 'Pendente' },
      assinada: { color: 'bg-green-100 text-green-800', label: 'Assinada' },
      recusada: { color: 'bg-red-100 text-red-800', label: 'Recusada' }
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pendente;
    
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${config.color}`}>
        {config.label}
      </span>
    );
  };

  if (ordensLoading || usersLoading || basesLoading || inventariosLoading || tiposItensLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Desconto de Material</h1>
        <p className="text-gray-600">Gerencie ordens de desconto de material do almoxarifado</p>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {statusOptions.map(option => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Funcionário
            </label>
            <select
              value={userFilter}
              onChange={(e) => setUserFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todos os funcionários</option>
              {users.map(user => (
                <option key={user.id} value={user.id}>
                  {user.nome} ({user.matricula})
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Buscar
            </label>
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar por nome, matrícula ou descrição..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Botões de Ação */}
      <div className="mb-6 flex flex-wrap gap-3">
        <button
          onClick={() => {
            resetForm();
            setShowModal(true);
          }}
          className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          Nova Ordem de Desconto
        </button>
        
        <button
          onClick={async () => {
            try {
              await descontoMaterialExcelService.downloadPlanilhaOrdens({
                status: statusFilter !== 'all' ? statusFilter : undefined
              });
              notify('Planilha de ordens baixada com sucesso!', 'success');
            } catch (error) {
              notify('Erro ao baixar planilha: ' + (error as Error).message, 'error');
            }
          }}
          className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
        >
          <DocumentArrowDownIcon className="h-4 w-4 inline mr-2" />
          Baixar Planilha
        </button>
        
        <button
          onClick={async () => {
            try {
              await descontoMaterialExcelService.downloadPlanilhaItens({
                status: statusFilter !== 'all' ? statusFilter : undefined
              });
              notify('Planilha de itens descartados baixada com sucesso!', 'success');
            } catch (error) {
              notify('Erro ao baixar planilha: ' + (error as Error).message, 'error');
            }
          }}
          className="bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
        >
          <DocumentArrowDownIcon className="h-4 w-4 inline mr-2" />
          Itens Descartados
        </button>
      </div>

      {/* Lista de Ordens */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Funcionário
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Descrição
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Valor
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Data
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {paginatedOrdens.map((ordem) => (
                <tr key={ordem.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {ordem.funcionario?.nome || ordem.funcionario_nome}
                      </div>
                      <div className="text-sm text-gray-500">
                        {ordem.funcionario?.matricula || ordem.funcionario_matricula}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900 max-w-xs truncate">
                      {ordem.descricao}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatCurrency(ordem.valor_total)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getStatusBadge(ordem.status)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDate(ordem.criado_em)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleEdit(ordem)}
                        className="text-blue-600 hover:text-blue-900"
                        title="Editar"
                      >
                        <PencilIcon className="h-4 w-4" />
                      </button>
                      <button
                        onClick={async () => {
                          try {
                            await descontoMaterialPdfService.downloadPdf(ordem.id);
                            notify('PDF baixado com sucesso!', 'success');
                          } catch (error) {
                            notify('Erro ao gerar PDF: ' + (error as Error).message, 'error');
                          }
                        }}
                        className="text-green-600 hover:text-green-900"
                        title="Baixar PDF"
                      >
                        <DocumentTextIcon className="h-4 w-4" />
                      </button>
                      <button
                        onClick={async () => {
                          try {
                            await descontoMaterialPdfService.visualizarPdf(ordem.id);
                          } catch (error) {
                            notify('Erro ao visualizar PDF: ' + (error as Error).message, 'error');
                          }
                        }}
                        className="text-purple-600 hover:text-purple-900"
                        title="Visualizar PDF"
                      >
                        <EyeIcon className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(ordem.id)}
                        className="text-red-600 hover:text-red-900"
                        title="Excluir"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
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
                  <span className="font-medium">{Math.min(currentPage * itemsPerPage, filteredOrdens.length)}</span> de{' '}
                  <span className="font-medium">{filteredOrdens.length}</span> resultados
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

      {/* Modal de criação/edição */}
      {showModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-4xl shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">
                  {formData.id ? 'Editar' : 'Nova'} Ordem de Desconto de Material
                </h3>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XCircleIcon className="h-6 w-6" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Dados do Funcionário */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Funcionário *
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={formData.funcionario_nome || ''}
                        onChange={(e) => {
                          setFormData(prev => ({ ...prev, funcionario_nome: e.target.value }));
                          setShowAutocomplete(true);
                        }}
                        placeholder="Digite o nome do funcionário..."
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                      />
                      {showAutocomplete && (
                        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
                          {users
                            .filter(user => 
                              user.nome.toLowerCase().includes((formData.funcionario_nome || '').toLowerCase())
                            )
                            .slice(0, 10)
                            .map(user => (
                              <div
                                key={user.id}
                                onClick={() => handleUserSelect(user)}
                                className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
                              >
                                <div className="font-medium">{user.nome}</div>
                                <div className="text-sm text-gray-500">
                                  {user.matricula} - {user.cpf}
                                </div>
                              </div>
                            ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      CPF *
                    </label>
                    <input
                      type="text"
                      value={formData.funcionario_cpf || ''}
                      onChange={(e) => handleCPFChange(e.target.value)}
                      placeholder="000.000.000-00"
                      className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        cpfError ? 'border-red-500' : 'border-gray-300'
                      }`}
                      required
                    />
                    {cpfError && (
                      <p className="mt-1 text-sm text-red-600">{cpfError}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Matrícula *
                    </label>
                    <input
                      type="text"
                      value={formData.funcionario_matricula || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, funcionario_matricula: e.target.value }))}
                      placeholder="Matrícula do funcionário"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Base *
                    </label>
                    <select
                      value={formData.base_id || ''}
                      onChange={(e) => {
                        const base = bases.find(b => b.id === e.target.value);
                        setFormData(prev => ({
                          ...prev,
                          base_id: e.target.value,
                          base_nome: base?.nome || ''
                        }));
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    >
                      <option value="">Selecione uma base</option>
                      {bases.map(base => (
                        <option key={base.id} value={base.id}>
                          {base.nome}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Descrição */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Descrição do Desconto *
                  </label>
                  <textarea
                    value={formData.descricao || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, descricao: e.target.value }))}
                    placeholder="Descreva o motivo do desconto..."
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                {/* Itens */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <label className="block text-sm font-medium text-gray-700">
                      Itens para Desconto
                    </label>
                    <div className="flex space-x-2">
                      <button
                        type="button"
                        onClick={() => setShowInventarioModal(true)}
                        className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700"
                      >
                        Do Inventário
                      </button>
                      <button
                        type="button"
                        onClick={addItemIndividual}
                        className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
                      >
                        Adicionar Item
                      </button>
                    </div>
                  </div>

                  {formData.itens && formData.itens.length > 0 && (
                    <div className="space-y-4">
                      {formData.itens.map((item, index) => (
                        <div key={item.id} className="border border-gray-200 rounded-lg p-4">
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="font-medium">Item {index + 1}</h4>
                            <button
                              type="button"
                              onClick={() => removeItem(item.id)}
                              className="text-red-600 hover:text-red-800"
                            >
                              <TrashIcon className="h-4 w-4" />
                            </button>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Item
                              </label>
                              {item.inventario_funcionario_id ? (
                                <input
                                  type="text"
                                  value={item.nome_item}
                                  readOnly
                                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50"
                                />
                              ) : (
                                <select
                                  value={item.tipo_item_id}
                                  onChange={(e) => {
                                    const tipoItem = tiposItens.find(t => t.id === e.target.value);
                                    updateItem(item.id, 'tipo_item_id', e.target.value);
                                    updateItem(item.id, 'nome_item', tipoItem?.nome || '');
                                  }}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                  <option value="">Selecione um item</option>
                                  {tiposItens.map(tipo => (
                                    <option key={tipo.id} value={tipo.id}>
                                      {tipo.nome}
                                    </option>
                                  ))}
                                </select>
                              )}
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Quantidade
                              </label>
                              <input
                                type="number"
                                value={item.quantidade}
                                onChange={(e) => updateItem(item.id, 'quantidade', parseInt(e.target.value) || 0)}
                                min="1"
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Valor Unitário
                              </label>
                              <input
                                type="number"
                                step="0.01"
                                value={item.valor_unitario}
                                onChange={(e) => updateItem(item.id, 'valor_unitario', parseFloat(e.target.value) || 0)}
                                min="0"
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            </div>

                            <div className="md:col-span-3">
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Motivo do Desconto
                              </label>
                              <input
                                type="text"
                                value={item.motivo_desconto}
                                onChange={(e) => updateItem(item.id, 'motivo_desconto', e.target.value)}
                                placeholder="Motivo específico para este item..."
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            </div>

                            <div className="md:col-span-3">
                              <div className="text-right">
                                <span className="text-sm text-gray-600">Valor Total: </span>
                                <span className="font-medium">{formatCurrency(item.valor_total)}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                    <div className="flex justify-between items-center">
                      <span className="text-lg font-medium">Total da Ordem:</span>
                      <span className="text-xl font-bold text-blue-600">
                        {formatCurrency(formData.valor_total || 0)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Testemunhas */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Testemunhas
                  </label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Digite as testemunhas separadas por vírgula"
                    value={Array.isArray(formData.testemunhas) ? formData.testemunhas.join(', ') : ''}
                    onChange={(e) => {
                      const testemunhas = e.target.value.split(',').map(t => t.trim()).filter(t => t);
                      setFormData(prev => ({ ...prev, testemunhas }));
                    }}
                  />
                </div>

                {/* Botões */}
                <div className="flex justify-end space-x-3 pt-4 border-t">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={createMutation.isPending || updateMutation.isPending}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                  >
                    {createMutation.isPending || updateMutation.isPending ? 'Salvando...' : 'Salvar'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Seleção do Inventário */}
      {showInventarioModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-6xl shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">
                  Selecionar Itens do Inventário
                </h3>
                <button
                  onClick={() => setShowInventarioModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XCircleIcon className="h-6 w-6" />
                </button>
              </div>

              <div className="max-h-96 overflow-y-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {inventarios
                    .filter(inv => inv.funcionario_id === formData.funcionario_id && inv.status === 'em_uso')
                    .map(inventario => {
                      const tipoItem = tiposItens.find(t => t.id === inventario.item_estoque_id);
                      const isSelected = selectedInventarioItems.some(s => s.id === inventario.id);
                      
                      return (
                        <div
                          key={inventario.id}
                          className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                            isSelected 
                              ? 'border-blue-500 bg-blue-50' 
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                          onClick={() => {
                            if (isSelected) {
                              setSelectedInventarioItems(prev => prev.filter(s => s.id !== inventario.id));
                            } else {
                              setSelectedInventarioItems(prev => [...prev, inventario]);
                            }
                          }}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-medium text-sm">{tipoItem?.nome || 'Item não encontrado'}</h4>
                            {isSelected && (
                              <CheckCircleIcon className="h-5 w-5 text-blue-600" />
                            )}
                          </div>
                          <div className="text-sm text-gray-600">
                            <p>Quantidade: {inventario.quantidade}</p>
                            <p>Data Entrega: {formatDate(inventario.data_entrega)}</p>
                            {inventario.data_vencimento && (
                              <p>Vencimento: {formatDate(inventario.data_vencimento)}</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t mt-4">
                <button
                  type="button"
                  onClick={() => setShowInventarioModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    selectedInventarioItems.forEach(item => addItemFromInventario(item));
                    setShowInventarioModal(false);
                    setSelectedInventarioItems([]);
                  }}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                >
                  Adicionar Selecionados
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

