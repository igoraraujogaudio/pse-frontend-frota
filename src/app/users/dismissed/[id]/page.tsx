'use client';

import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import PermissionGuard from '@/components/PermissionGuard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { 
  ArrowLeftIcon,
  UserIcon,
  ClipboardDocumentListIcon,
  CubeIcon,
  ClockIcon,
  DocumentTextIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';

import { PERMISSION_CODES } from '@/hooks/useModularPermissions';

interface FuncionarioDetalhes {
  id: string;
  nome: string;
  email: string;
  matricula: string;
  cpf?: string;
  telefone?: string;
  cargo: string;
  posicao?: string;
  operacao: string;
  base_id?: string;
  contrato_id?: string;
  departamento?: string;
  status: string;
  nivel_acesso: string;
  criado_em: string;
  atualizado_em: string;
  data_demissao: string;
  tipo_demissao: string;
  observacoes_demissao?: string;
  demitido_por?: string;
  demitido_por_nome?: string;
  base_nome?: string;
  contrato_nome?: string;
}

interface HistoricoItem {
  id: string;
  tipo: string;
  descricao: string;
  data: string;
  usuario_responsavel?: string;
  observacoes?: string;
}

interface ChecklistItem {
  id: string;
  item: string;
  status: 'pendente' | 'concluido' | 'nao_aplicavel';
  data_conclusao?: string;
  responsavel?: string;
  observacoes?: string;
}

interface InventarioItem {
  id: string;
  item_nome: string;
  item_codigo?: string;
  quantidade: number;
  status: string;
  data_entrega?: string;
  data_devolucao?: string;
  observacoes?: string;
}

interface Movimentacao {
  id: string;
  tipo: string;
  descricao: string;
  data: string;
  valor?: number;
  status: string;
  observacoes?: string;
}

// Funções de fetch para TanStack Query
const fetchFuncionarioDetalhes = async (funcionarioId: string): Promise<FuncionarioDetalhes> => {
  const response = await fetch(`/api/users/dismissed/${funcionarioId}`);
  if (!response.ok) throw new Error('Erro ao carregar funcionário');
  const data = await response.json();
  return data.funcionario;
};

const fetchHistorico = async (funcionarioId: string): Promise<HistoricoItem[]> => {
  const response = await fetch(`/api/users/dismissed/${funcionarioId}/historico`);
  if (!response.ok) return [];
  const data = await response.json();
  return data.historico || [];
};

const fetchChecklist = async (funcionarioId: string): Promise<ChecklistItem[]> => {
  const response = await fetch(`/api/users/dismissed/${funcionarioId}/checklist`);
  if (!response.ok) return [];
  const data = await response.json();
  return data.checklist || [];
};

const fetchInventario = async (funcionarioId: string): Promise<InventarioItem[]> => {
  const response = await fetch(`/api/users/dismissed/${funcionarioId}/inventario`);
  if (!response.ok) return [];
  const data = await response.json();
  return data.inventario || [];
};

const fetchMovimentacoes = async (funcionarioId: string): Promise<Movimentacao[]> => {
  const response = await fetch(`/api/users/dismissed/${funcionarioId}/movimentacoes`);
  if (!response.ok) return [];
  const data = await response.json();
  return data.movimentacoes || [];
};

export default function FuncionarioDemitidoDetalhes() {
  const params = useParams();
  const router = useRouter();
  const funcionarioId = params.id as string;

  // Queries com TanStack Query
  const { 
    data: funcionario, 
    isLoading: loadingFuncionario, 
    error: errorFuncionario 
  } = useQuery({
    queryKey: ['funcionario-detalhes', funcionarioId],
    queryFn: () => fetchFuncionarioDetalhes(funcionarioId),
    enabled: !!funcionarioId,
  });

  const { 
    data: historico = [], 
    isLoading: loadingHistorico 
  } = useQuery({
    queryKey: ['funcionario-historico', funcionarioId],
    queryFn: () => fetchHistorico(funcionarioId),
    enabled: !!funcionarioId,
  });

  const { 
    data: checklist = [], 
    isLoading: loadingChecklist 
  } = useQuery({
    queryKey: ['funcionario-checklist', funcionarioId],
    queryFn: () => fetchChecklist(funcionarioId),
    enabled: !!funcionarioId,
  });

  const { 
    data: inventario = [], 
    isLoading: loadingInventario 
  } = useQuery({
    queryKey: ['funcionario-inventario', funcionarioId],
    queryFn: () => fetchInventario(funcionarioId),
    enabled: !!funcionarioId,
  });

  const { 
    data: movimentacoes = [], 
    isLoading: loadingMovimentacoes 
  } = useQuery({
    queryKey: ['funcionario-movimentacoes', funcionarioId],
    queryFn: () => fetchMovimentacoes(funcionarioId),
    enabled: !!funcionarioId,
  });

  const loading = loadingFuncionario || loadingHistorico || loadingChecklist || loadingInventario || loadingMovimentacoes;

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'concluido': return 'bg-green-100 text-green-800';
      case 'pendente': return 'bg-yellow-100 text-yellow-800';
      case 'nao_aplicavel': return 'bg-gray-100 text-gray-800';
      case 'demitido': return 'bg-red-100 text-red-800';
      default: return 'bg-blue-100 text-blue-800';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Error handling
  if (errorFuncionario) {
    return (
      <PermissionGuard requiredPermissions={[PERMISSION_CODES.FUNCIONARIOS.VISUALIZAR_DEMITIDOS]}>
        <div className="container mx-auto p-6">
          <div className="text-center">
            <ExclamationTriangleIcon className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Erro ao carregar funcionário</h1>
            <p className="text-gray-600 mb-4">Ocorreu um erro ao carregar os detalhes do funcionário.</p>
            <Button onClick={() => router.push('/users/dismissed')}>
              <ArrowLeftIcon className="h-4 w-4 mr-2" />
              Voltar
            </Button>
          </div>
        </div>
      </PermissionGuard>
    );
  }

  if (loading) {
    return (
      <PermissionGuard requiredPermissions={[PERMISSION_CODES.FUNCIONARIOS.VISUALIZAR_DEMITIDOS]}>
        <div className="container mx-auto p-6">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Carregando detalhes do funcionário...</p>
            </div>
          </div>
        </div>
      </PermissionGuard>
    );
  }

  if (!funcionario) {
    return (
      <PermissionGuard requiredPermissions={[PERMISSION_CODES.FUNCIONARIOS.VISUALIZAR_DEMITIDOS]}>
        <div className="container mx-auto p-6">
          <div className="text-center">
            <ExclamationTriangleIcon className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Funcionário não encontrado</h1>
            <p className="text-gray-600 mb-4">O funcionário solicitado não foi encontrado ou não existe.</p>
            <Button onClick={() => router.push('/users/dismissed')}>
              <ArrowLeftIcon className="h-4 w-4 mr-2" />
              Voltar
            </Button>
          </div>
        </div>
      </PermissionGuard>
    );
  }

  return (
    <PermissionGuard requiredPermissions={[PERMISSION_CODES.FUNCIONARIOS.VISUALIZAR_DEMITIDOS]}>
      <div className="container mx-auto p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button 
              variant="outline" 
              onClick={() => router.push('/users/dismissed')}
              className="flex items-center gap-2"
            >
              <ArrowLeftIcon className="h-4 w-4" />
              Voltar
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{funcionario.nome}</h1>
              <p className="text-gray-600">Detalhes do funcionário demitido</p>
            </div>
          </div>
          <Badge className={`${getStatusColor(funcionario.status)} px-3 py-1`}>
            {funcionario.status.toUpperCase()}
          </Badge>
        </div>

        {/* Informações Básicas */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserIcon className="h-5 w-5" />
              Informações Básicas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <Label className="text-sm font-medium text-gray-500">Matrícula</Label>
                <p className="text-lg font-semibold">{funcionario.matricula}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-500">Email</Label>
                <p className="text-lg">{funcionario.email}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-500">CPF</Label>
                <p className="text-lg">{funcionario.cpf || 'Não informado'}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-500">Cargo</Label>
                <p className="text-lg">{funcionario.cargo}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-500">Operação</Label>
                <p className="text-lg">{funcionario.operacao}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-500">Base</Label>
                <p className="text-lg">{funcionario.base_nome || 'Não informado'}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-500">Data de Demissão</Label>
                <p className="text-lg font-semibold text-red-600">
                  {formatDate(funcionario.data_demissao)}
                </p>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-500">Tipo de Demissão</Label>
                <p className="text-lg">{funcionario.tipo_demissao}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-500">Demitido por</Label>
                <p className="text-lg">{funcionario.demitido_por_nome || 'Sistema'}</p>
              </div>
            </div>
            {funcionario.observacoes_demissao && (
              <div className="mt-4">
                <Label className="text-sm font-medium text-gray-500">Observações da Demissão</Label>
                <p className="text-lg bg-gray-50 p-3 rounded-md">{funcionario.observacoes_demissao}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tabs com Detalhes */}
        <Tabs defaultValue="historico" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="historico" className="flex items-center gap-2">
              <ClockIcon className="h-4 w-4" />
              Histórico
            </TabsTrigger>
            <TabsTrigger value="checklist" className="flex items-center gap-2">
              <ClipboardDocumentListIcon className="h-4 w-4" />
              Checklist
            </TabsTrigger>
            <TabsTrigger value="inventario" className="flex items-center gap-2">
              <CubeIcon className="h-4 w-4" />
              Inventário
            </TabsTrigger>
            <TabsTrigger value="movimentacoes" className="flex items-center gap-2">
              <DocumentTextIcon className="h-4 w-4" />
              Movimentações
            </TabsTrigger>
          </TabsList>

          {/* Tab Histórico */}
          <TabsContent value="historico" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Histórico do Funcionário</CardTitle>
              </CardHeader>
              <CardContent>
                {loadingHistorico ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3"></div>
                    <p className="text-gray-600">Carregando histórico...</p>
                  </div>
                ) : historico.length > 0 ? (
                  <div className="space-y-4">
                    {historico.map((item) => (
                      <div key={item.id} className="border-l-4 border-blue-500 pl-4 py-2">
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-semibold">{item.descricao}</h4>
                            <p className="text-sm text-gray-600">{item.tipo}</p>
                            {item.observacoes && (
                              <p className="text-sm text-gray-500 mt-1">{item.observacoes}</p>
                            )}
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-gray-500">{formatDate(item.data)}</p>
                            {item.usuario_responsavel && (
                              <p className="text-xs text-gray-400">{item.usuario_responsavel}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <ClockIcon className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <p>Nenhum histórico encontrado para este funcionário.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab Checklist */}
          <TabsContent value="checklist" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Checklist de Demissão</CardTitle>
              </CardHeader>
              <CardContent>
                {loadingChecklist ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3"></div>
                    <p className="text-gray-600">Carregando checklist...</p>
                  </div>
                ) : checklist.length > 0 ? (
                  <div className="space-y-3">
                    {checklist.map((item) => (
                      <div key={item.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className={`w-3 h-3 rounded-full ${
                            item.status === 'concluido' ? 'bg-green-500' :
                            item.status === 'pendente' ? 'bg-yellow-500' : 'bg-gray-400'
                          }`}></div>
                          <span className="font-medium">{item.item}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={getStatusColor(item.status)}>
                            {item.status.replace('_', ' ').toUpperCase()}
                          </Badge>
                          {item.data_conclusao && (
                            <span className="text-sm text-gray-500">
                              {formatDate(item.data_conclusao)}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <ClipboardDocumentListIcon className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <p>Nenhum item de checklist encontrado.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab Inventário */}
          <TabsContent value="inventario" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Inventário do Funcionário</CardTitle>
              </CardHeader>
              <CardContent>
                {loadingInventario ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3"></div>
                    <p className="text-gray-600">Carregando inventário...</p>
                  </div>
                ) : inventario.length > 0 ? (
                  <div className="space-y-3">
                    {inventario.map((item) => (
                      <div key={item.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <h4 className="font-semibold">{item.item_nome}</h4>
                          {item.item_codigo && (
                            <p className="text-sm text-gray-600">Código: {item.item_codigo}</p>
                          )}
                          <p className="text-sm text-gray-500">Quantidade: {item.quantidade}</p>
                          {item.observacoes && (
                            <p className="text-sm text-gray-500 mt-1">{item.observacoes}</p>
                          )}
                        </div>
                        <div className="text-right">
                          <Badge className={getStatusColor(item.status)}>
                            {item.status.toUpperCase()}
                          </Badge>
                          {item.data_entrega && (
                            <p className="text-sm text-gray-500 mt-1">
                              Entregue: {formatDate(item.data_entrega)}
                            </p>
                          )}
                          {item.data_devolucao && (
                            <p className="text-sm text-gray-500">
                              Devolvido: {formatDate(item.data_devolucao)}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <CubeIcon className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <p>Nenhum item de inventário encontrado.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab Movimentações */}
          <TabsContent value="movimentacoes" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Movimentações</CardTitle>
              </CardHeader>
              <CardContent>
                {loadingMovimentacoes ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3"></div>
                    <p className="text-gray-600">Carregando movimentações...</p>
                  </div>
                ) : movimentacoes.length > 0 ? (
                  <div className="space-y-3">
                    {movimentacoes.map((mov) => (
                      <div key={mov.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <h4 className="font-semibold">{mov.descricao}</h4>
                          <p className="text-sm text-gray-600">{mov.tipo}</p>
                          {mov.observacoes && (
                            <p className="text-sm text-gray-500 mt-1">{mov.observacoes}</p>
                          )}
                        </div>
                        <div className="text-right">
                          <Badge className={getStatusColor(mov.status)}>
                            {mov.status.toUpperCase()}
                          </Badge>
                          <p className="text-sm text-gray-500 mt-1">{formatDate(mov.data)}</p>
                          {mov.valor && (
                            <p className="text-sm font-semibold text-green-600">
                              R$ {mov.valor.toFixed(2)}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <DocumentTextIcon className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <p>Nenhuma movimentação encontrada.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </PermissionGuard>
  );
}
