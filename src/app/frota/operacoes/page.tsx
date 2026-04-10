'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/contexts/AuthContext'
import ProtectedRoute from '@/components/ProtectedRoute'
import { PERMISSION_CODES } from '@/hooks/useModularPermissions'
import { OperacoesAtividadesService } from '@/services/operacoesAtividadesService'
import type { OperacaoPadrao, OperacaoFormData } from '@/types/operacoes-atividades'
import { PlusIcon, PencilIcon, TrashIcon, MagnifyingGlassIcon, FunnelIcon } from '@heroicons/react/24/outline'

interface Contract {
  id: string;
  nome: string;
  codigo: string;
}

// Shadcn/ui components
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';

// Sistema de toast simples
const showToast = (type: 'success' | 'error', message: string) => {
  const toast = document.createElement('div');
  toast.className = `fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg transition-all duration-300 transform translate-x-full ${
    type === 'success' 
      ? 'bg-green-500 text-white' 
      : 'bg-red-500 text-white'
  }`;
  toast.textContent = message;
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.classList.remove('translate-x-full');
  }, 100);
  
  setTimeout(() => {
    toast.classList.add('translate-x-full');
    setTimeout(() => {
      if (document.body.contains(toast)) {
        document.body.removeChild(toast);
      }
    }, 300);
  }, 3000);
};

export default function OperacoesPage() {
  return (
    <ProtectedRoute requiredPermissions={[
      PERMISSION_CODES.CONFIGURACOES.GERENCIAR_OPERACOES,
    ]}>
      <OperacoesContent />
    </ProtectedRoute>
  );
}

function OperacoesContent() {
  const { user, userContratoIds } = useAuth();
  const queryClient = useQueryClient();
  const isAdmin = user?.nivel_acesso === 'admin' || user?.nivel_acesso === 'diretor';

  // Buscar contratos
  const { data: contratos, isLoading: loadingContratos } = useQuery<Contract[]>({
    queryKey: ['contracts'],
    queryFn: async () => {
      const res = await fetch('/api/admin/contracts');
      if (!res.ok) {
        throw new Error('Failed to fetch contracts');
      }
      const data = await res.json();
      return data.contracts || [];
    },
    retry: 3,
    retryDelay: 1000,
  });

  const safeContratos = Array.isArray(contratos) ? contratos : [];
  const contratosPermitidos = safeContratos.filter(contrato => 
    isAdmin || (userContratoIds && userContratoIds.includes(contrato.id))
  );

  // Estados
  const [searchTerm, setSearchTerm] = useState('');
  const [contratoFilter, setContratoFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingOperacao, setEditingOperacao] = useState<OperacaoPadrao | null>(null);
  const [operacaoForm, setOperacaoForm] = useState<OperacaoFormData & { requerEncarregado?: boolean }>({
    codigo: '',
    nome: '',
    descricao: '',
    contratoId: '',
    requerEncarregado: false,
    ativo: true,
    ordem: 0,
  });

  // Carregar operações
  const { data: operacoes, isLoading: loadingOperacoes } = useQuery<OperacaoPadrao[]>({
    queryKey: ['operacoes', contratoFilter, userContratoIds],
    queryFn: async () => {
      const filter: { ativo: boolean; contratoId?: string } = { ativo: true };
      if (contratoFilter !== 'all') {
        filter.contratoId = contratoFilter;
      } else if (!isAdmin && userContratoIds) {
        // Para não-admin, filtrar por contratos permitidos
        const operacoesAll: OperacaoPadrao[] = [];
        for (const contratoId of userContratoIds) {
          const ops = await OperacoesAtividadesService.getOperacoes({ 
            contratoId,
            ativo: true 
          });
          operacoesAll.push(...ops);
        }
        return operacoesAll;
      }
      return OperacoesAtividadesService.getOperacoes(filter);
    },
    retry: 3,
    retryDelay: 1000,
  });

  const safeOperacoes = Array.isArray(operacoes) ? operacoes : [];

  // Filtrar operações
  const filteredOperacoes = safeOperacoes.filter(operacao => {
    const matchesSearch = 
      operacao.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      operacao.codigo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (operacao.descricao && operacao.descricao.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesStatus = statusFilter === 'all' || 
      (statusFilter === 'active' && operacao.ativo) ||
      (statusFilter === 'inactive' && !operacao.ativo);

    return matchesSearch && matchesStatus;
  });

  // Mutations
  const createOperacaoMutation = useMutation({
    mutationFn: (data: OperacaoFormData & { requerEncarregado?: boolean }) =>
      OperacoesAtividadesService.createOperacao(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['operacoes'] });
      setShowCreateModal(false);
      setOperacaoForm({
        codigo: '',
        nome: '',
        descricao: '',
        contratoId: '',
        requerEncarregado: false,
        ativo: true,
        ordem: 0,
      });
      showToast('success', 'Operação criada com sucesso!');
    },
    onError: (error: Error) => {
      console.error('Erro ao criar operação:', error);
      showToast('error', error.message || 'Erro ao criar operação. Tente novamente.');
    }
  });

  const updateOperacaoMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: OperacaoFormData & { requerEncarregado?: boolean } }) =>
      OperacoesAtividadesService.updateOperacao(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['operacoes'] });
      setEditingOperacao(null);
      setOperacaoForm({
        codigo: '',
        nome: '',
        descricao: '',
        contratoId: '',
        requerEncarregado: false,
        ativo: true,
        ordem: 0,
      });
      showToast('success', 'Operação atualizada com sucesso!');
    },
    onError: (error: Error) => {
      console.error('Erro ao atualizar operação:', error);
      showToast('error', error.message || 'Erro ao atualizar operação. Tente novamente.');
    }
  });

  const deleteOperacaoMutation = useMutation({
    mutationFn: (id: string) => OperacoesAtividadesService.deleteOperacao(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['operacoes'] });
      showToast('success', 'Operação excluída com sucesso!');
    },
    onError: (error: Error) => {
      console.error('Erro ao excluir operação:', error);
      showToast('error', error.message || 'Erro ao excluir operação. Tente novamente.');
    }
  });

  // Handlers
  const handleCreate = () => {
    if (!operacaoForm.nome || !operacaoForm.codigo || !operacaoForm.contratoId) {
      showToast('error', 'Preencha todos os campos obrigatórios');
      return;
    }
    createOperacaoMutation.mutate(operacaoForm);
  };

  const handleEdit = (operacao: OperacaoPadrao) => {
    setEditingOperacao(operacao);
    setOperacaoForm({
      codigo: operacao.codigo,
      nome: operacao.nome,
      descricao: operacao.descricao || '',
      contratoId: operacao.contratoId || '',
      requerEncarregado: operacao.requerEncarregado || false,
      ativo: operacao.ativo,
      ordem: operacao.ordem || 0,
    });
    setShowCreateModal(true);
  };

  const handleUpdate = () => {
    if (!editingOperacao) return;
    if (!operacaoForm.nome || !operacaoForm.codigo || !operacaoForm.contratoId) {
      showToast('error', 'Preencha todos os campos obrigatórios');
      return;
    }
    updateOperacaoMutation.mutate({ id: editingOperacao.id, data: operacaoForm });
  };

  const handleDelete = (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta operação?')) return;
    deleteOperacaoMutation.mutate(id);
  };

  const handleCloseModal = () => {
    setShowCreateModal(false);
    setEditingOperacao(null);
    setOperacaoForm({
      codigo: '',
      nome: '',
      descricao: '',
      contratoId: '',
      requerEncarregado: false,
      ativo: true,
      ordem: 0,
    });
  };

  if (loadingOperacoes || loadingContratos) {
    return (
      <div className="bg-gray-50 flex items-center justify-center py-20">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Carregando dados...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-50">
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Definição de Operações</h1>
                <p className="text-gray-600 mt-1">Gerencie as operações padrão do sistema</p>
              </div>
              <div className="flex gap-3">
                <Button
                  onClick={() => setShowCreateModal(true)}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <PlusIcon className="h-4 w-4 mr-2" />
                  Nova Operação
                </Button>
              </div>
            </div>
          </div>

          {/* Filtros */}
          <div className="mb-6 flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <MagnifyingGlassIcon className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, código ou descrição..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={contratoFilter} onValueChange={setContratoFilter}>
              <SelectTrigger className="w-[200px]">
                <FunnelIcon className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filtrar por contrato" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Contratos</SelectItem>
                {contratosPermitidos.map(contrato => (
                  <SelectItem key={contrato.id} value={contrato.id}>
                    {contrato.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={(value: 'all' | 'active' | 'inactive') => setStatusFilter(value)}>
              <SelectTrigger className="w-[180px]">
                <FunnelIcon className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filtrar por status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="active">Ativas</SelectItem>
                <SelectItem value="inactive">Inativas</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Tabela */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Contrato</TableHead>
                  <TableHead>Requer Encarregado</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Ordem</TableHead>
                  <TableHead className="text-center">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOperacoes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-gray-500 py-8">
                      Nenhuma operação encontrada
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredOperacoes.map((operacao) => {
                    const contrato = safeContratos.find(c => c.id === operacao.contratoId);
                    return (
                      <TableRow key={operacao.id}>
                        <TableCell className="font-medium">{operacao.codigo}</TableCell>
                        <TableCell>{operacao.nome}</TableCell>
                        <TableCell className="max-w-xs truncate">
                          {operacao.descricao || '-'}
                        </TableCell>
                        <TableCell>{contrato ? contrato.nome : '-'}</TableCell>
                        <TableCell>
                          {operacao.requerEncarregado ? (
                            <Badge variant="default">Sim</Badge>
                          ) : (
                            <Badge variant="secondary">Não</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {operacao.ativo ? (
                            <Badge variant="default">Ativa</Badge>
                          ) : (
                            <Badge variant="secondary">Inativa</Badge>
                          )}
                        </TableCell>
                        <TableCell>{operacao.ordem || 0}</TableCell>
                        <TableCell className="text-center">
                          <div className="flex gap-2 justify-center">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEdit(operacao)}
                            >
                              <PencilIcon className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDelete(operacao.id)}
                              className="text-red-600 border-red-600 hover:bg-red-50"
                            >
                              <TrashIcon className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {/* Modal de Criação/Edição */}
          <Dialog open={showCreateModal} onOpenChange={handleCloseModal}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>
                  {editingOperacao ? 'Editar Operação' : 'Nova Operação'}
                </DialogTitle>
                <DialogDescription>
                  {editingOperacao 
                    ? 'Atualize os dados da operação'
                    : 'Preencha os dados para criar uma nova operação'}
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="codigo">Código *</Label>
                    <Input
                      id="codigo"
                      placeholder="Ex: OP-001"
                      value={operacaoForm.codigo}
                      onChange={(e) => setOperacaoForm({ ...operacaoForm, codigo: e.target.value })}
                    />
                  </div>

                  <div>
                    <Label htmlFor="ordem">Ordem</Label>
                    <Input
                      id="ordem"
                      type="number"
                      min="0"
                      value={operacaoForm.ordem}
                      onChange={(e) => setOperacaoForm({ ...operacaoForm, ordem: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="nome">Nome *</Label>
                  <Input
                    id="nome"
                    placeholder="Ex: Manutenção Preventiva"
                    value={operacaoForm.nome}
                    onChange={(e) => setOperacaoForm({ ...operacaoForm, nome: e.target.value })}
                  />
                </div>

                <div>
                  <Label htmlFor="descricao">Descrição</Label>
                  <Textarea
                    id="descricao"
                    placeholder="Descreva a operação..."
                    value={operacaoForm.descricao}
                    onChange={(e) => setOperacaoForm({ ...operacaoForm, descricao: e.target.value })}
                    rows={3}
                  />
                </div>

                <div>
                  <Label htmlFor="contrato">Contrato *</Label>
                  <Select 
                    value={operacaoForm.contratoId} 
                    onValueChange={(value) => setOperacaoForm({ ...operacaoForm, contratoId: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o contrato" />
                    </SelectTrigger>
                    <SelectContent>
                      {contratosPermitidos.map(contrato => (
                        <SelectItem key={contrato.id} value={contrato.id}>
                          {contrato.nome} ({contrato.codigo})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="ativo"
                      checked={operacaoForm.ativo}
                      onCheckedChange={(checked) => setOperacaoForm({ ...operacaoForm, ativo: checked })}
                    />
                    <Label htmlFor="ativo">Operação Ativa</Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Switch
                      id="requerEncarregado"
                      checked={operacaoForm.requerEncarregado}
                      onCheckedChange={(checked) => setOperacaoForm({ ...operacaoForm, requerEncarregado: checked })}
                    />
                    <Label htmlFor="requerEncarregado">Requer Encarregado</Label>
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={handleCloseModal}>
                  Cancelar
                </Button>
                <Button
                  onClick={editingOperacao ? handleUpdate : handleCreate}
                  disabled={createOperacaoMutation.isPending || updateOperacaoMutation.isPending}
                >
                  {createOperacaoMutation.isPending || updateOperacaoMutation.isPending
                    ? 'Salvando...'
                    : editingOperacao 
                      ? 'Atualizar'
                      : 'Criar Operação'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </div>
  );
}

