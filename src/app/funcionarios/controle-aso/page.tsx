'use client';

import { useState, useEffect, Suspense } from 'react';
import { supabase } from '@/lib/supabase';
import { useNotification } from '@/contexts/NotificationContext';
import { useAuth } from '@/contexts/AuthContext';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DateInput } from '@/components/ui/date-input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { 
  UserIcon, 
  ExclamationTriangleIcon, 
  CheckCircleIcon, 
  ClockIcon, 
  MagnifyingGlassIcon, 
  CalendarIcon,
  ChevronLeftIcon, 
  ChevronRightIcon,
  // PlusIcon,
  PencilIcon,
  EyeIcon
} from '@heroicons/react/24/outline';
import { useQuery } from '@tanstack/react-query';
import { useModularPermissions, PERMISSION_CODES } from '@/hooks/useModularPermissions';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useSearchParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';

interface FuncionarioASO {
  id: string;
  nome: string;
  matricula: string;
  cargo: string;
  operacao: string;
  base_nome?: string;
  contrato_nome?: string;
  contrato_id?: string;
  data_ultimo_exame_aso?: string;
  data_agendamento_aso?: string;
  validade_aso?: string;
  status: 'vencido' | 'proximo' | 'valido' | 'sem_aso' | 'agendado';
  dias_vencimento: number;
  dias_agendamento?: number;
}

export default function ControleASOPage() {
  return (
    <ProtectedRoute requiredPermissions={[
      PERMISSION_CODES.FUNCIONARIOS.VISUALIZAR,
      PERMISSION_CODES.FUNCIONARIOS.EDITAR_FUNCIONARIOS
    ]}>
      <Suspense fallback={<div>Carregando...</div>}>
        <ControleASOContent />
      </Suspense>
    </ProtectedRoute>
  );
}

function ControleASOContent() {
  const { user } = useAuth();
  const { hasPermission } = useModularPermissions();
  const searchParams = useSearchParams();
  const router = useRouter();
  
  // Verificações de permissão específicas
  const canViewFuncionarios = hasPermission(PERMISSION_CODES.FUNCIONARIOS.VISUALIZAR);
  const canEditFuncionarios = hasPermission(PERMISSION_CODES.FUNCIONARIOS.EDITAR_FUNCIONARIOS);
  
  // Parâmetros para destacar funcionário específico (vindo de notificações)
  // const highlightFuncionarioId = searchParams?.get('highlight');
  const highlightMatricula = searchParams?.get('matricula');
  
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'vencido' | 'proximo' | 'valido' | 'sem_aso' | 'agendado'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [operacaoFilter, setOperacaoFilter] = useState<string>("all");
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedFuncionario, setSelectedFuncionario] = useState<FuncionarioASO | null>(null);
  const [editData, setEditData] = useState({
    data_ultimo_exame_aso: '',
    data_agendamento_aso: '',
    validade_aso: ''
  });
  
  const { notify } = useNotification();

  // Buscar funcionários com ASO
  const {
    data: funcionariosData,
    isLoading: loading,
    error,
    refetch
  } = useQuery({
    queryKey: ['funcionarios_aso'],
    queryFn: async () => {
      try {
        // Usar a view específica para controle de ASO
        const { data, error } = await supabase
          .from('funcionarios_controle_aso')
          .select(`
            id,
            nome,
            matricula,
            cargo,
            operacao,
            data_ultimo_exame_aso,
            data_agendamento_aso,
            validade_aso,
            status,
            base_nome,
            contrato_nome,
            contrato_id
          `)
          .order('nome');

        if (error) throw error;

        // Processar dados e calcular status
        const funcionariosProcessados = data?.map(funcionario => {
          const hoje = new Date();
          let status: FuncionarioASO['status'] = 'sem_aso';
          let diasVencimento = 0;
          let diasAgendamento = 0;

          // Verificar se tem agendamento
          if (funcionario.data_agendamento_aso) {
            const dataAgendamento = new Date(funcionario.data_agendamento_aso);
            diasAgendamento = Math.ceil((dataAgendamento.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
            
            if (diasAgendamento <= 0) {
              status = 'agendado';
            } else {
              status = 'agendado';
            }
          }
          // Verificar validade do ASO
          else if (funcionario.validade_aso) {
            const dataVencimento = new Date(funcionario.validade_aso);
            diasVencimento = Math.ceil((dataVencimento.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
            
            if (diasVencimento < 0) {
              status = 'vencido';
            } else if (diasVencimento <= 30) {
              status = 'proximo';
            } else {
              status = 'valido';
            }
          }
          // Verificar último exame (calcular validade)
          else if (funcionario.data_ultimo_exame_aso) {
            const dataUltimoExame = new Date(funcionario.data_ultimo_exame_aso);
            const dataVencimento = new Date(dataUltimoExame.getTime() + (365 * 24 * 60 * 60 * 1000));
            diasVencimento = Math.ceil((dataVencimento.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
            
            if (diasVencimento < 0) {
              status = 'vencido';
            } else if (diasVencimento <= 30) {
              status = 'proximo';
            } else {
              status = 'valido';
            }
          }

          return {
            id: funcionario.id,
            nome: funcionario.nome,
            matricula: funcionario.matricula,
            cargo: funcionario.cargo,
            operacao: funcionario.operacao,
            base_nome: funcionario.base_nome,
            contrato_nome: funcionario.contrato_nome,
            contrato_id: funcionario.contrato_id,
            data_ultimo_exame_aso: funcionario.data_ultimo_exame_aso,
            data_agendamento_aso: funcionario.data_agendamento_aso,
            validade_aso: funcionario.validade_aso,
            status,
            dias_vencimento: diasVencimento,
            dias_agendamento: diasAgendamento
          };
        }) || [];

        return { funcionarios: funcionariosProcessados };
      } catch (err) {
        console.error('❌ Erro ao buscar funcionários:', err);
        throw err;
      }
    },
    retry: 1,
    staleTime: 2 * 60 * 1000, // 2 minutos
    gcTime: 10 * 60 * 1000, // 10 minutos
  });

  useEffect(() => {
    if (error) {
      notify('Erro ao carregar funcionários', 'error');
    }
  }, [error, notify]);

  // Processar dados dos funcionários
  const funcionarios = funcionariosData?.funcionarios || [];

  // Debug: Log do usuário logado
  console.log('👤 Usuário logado:', {
    user: user,
    userContratoOrigemId: user?.contrato_origem_id,
    userNivelAcesso: user?.nivel_acesso,
    userEmail: user?.email,
    userNome: user?.nome
  });
  
  // Debug: Log dos primeiros funcionários
  console.log('📋 Primeiros funcionários da view:', funcionarios.slice(0, 3).map(f => ({
    nome: f.nome,
    contrato_id: f.contrato_id,
    contrato_nome: f.contrato_nome
  })));

  // Primeiro, remover duplicações por ID do funcionário
  const funcionariosUnicos = funcionarios.reduce((acc: FuncionarioASO[], funcionario: FuncionarioASO) => {
    const existe = acc.find(f => f.id === funcionario.id);
    if (!existe) {
      acc.push(funcionario);
    }
    return acc;
  }, []);

  console.log(`📊 Funcionários antes da deduplicação: ${funcionarios.length}`);
  console.log(`📊 Funcionários após deduplicação: ${funcionariosUnicos.length}`);

  // Filtrar funcionários baseado no contrato de origem do usuário logado
  const filteredFuncionariosByAccess = funcionariosUnicos.filter((funcionario: FuncionarioASO) => {
    // TEMPORÁRIO: Forçar filtro por contrato de origem mesmo para admin (para teste)
    // Se for admin, pode ver todos os funcionários
    // if (user?.nivel_acesso === 'admin') {
    //   return true;
    // }
    
    // Debug: Log da comparação
    console.log(`🔍 Comparando: user.contrato_origem_id (${user?.contrato_origem_id}) === funcionario.contrato_id (${funcionario.contrato_id}) = ${user?.contrato_origem_id === funcionario.contrato_id}`);
    console.log(`👤 Funcionário: ${funcionario.nome} - Contrato: ${funcionario.contrato_id}`);
    
    // Para todos os usuários (incluindo admin temporariamente), filtrar pelo contrato de origem
    // user.contrato_origem_id === funcionario.contrato_id
    return user?.contrato_origem_id === funcionario.contrato_id;
  });

  // Filtrar automaticamente pelo funcionário destacado quando vindo de notificação
  useEffect(() => {
    if (highlightMatricula && filteredFuncionariosByAccess.length > 0) {
      console.log(`🔔 Destacando funcionário da notificação: ${highlightMatricula}`);
      setSearch(highlightMatricula);
      
      // Verificar se há ASO vencido ou próximo do vencimento para este funcionário
      const funcionarioASO = filteredFuncionariosByAccess.find((funcionario: FuncionarioASO) => 
        funcionario.matricula === highlightMatricula
      );
      
      if (funcionarioASO) {
        if (funcionarioASO.status === 'vencido') {
          setStatusFilter('vencido');
        } else if (funcionarioASO.status === 'proximo') {
          setStatusFilter('proximo');
        }
      }
    }
  }, [highlightMatricula, filteredFuncionariosByAccess]);

  // Filtrar funcionários
  const filteredFuncionarios = filteredFuncionariosByAccess.filter((funcionario: FuncionarioASO) => {
    const matchesSearch = !search || 
      funcionario.nome.toLowerCase().includes(search.toLowerCase()) ||
      funcionario.matricula.toLowerCase().includes(search.toLowerCase()) ||
      funcionario.cargo.toLowerCase().includes(search.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || funcionario.status === statusFilter;
    
    const matchesOperacao = operacaoFilter === 'all' || funcionario.operacao === operacaoFilter;
    
    return matchesSearch && matchesStatus && matchesOperacao;
  });

  // Paginação
  const totalPages = Math.ceil(filteredFuncionarios.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedFuncionarios = filteredFuncionarios.slice(startIndex, endIndex);

  // Estatísticas
  const stats = {
    total: filteredFuncionarios.length,
    vencidos: filteredFuncionarios.filter(f => f.status === 'vencido').length,
    proximos: filteredFuncionarios.filter(f => f.status === 'proximo').length,
    validos: filteredFuncionarios.filter(f => f.status === 'valido').length,
    sem_aso: filteredFuncionarios.filter(f => f.status === 'sem_aso').length,
    agendados: filteredFuncionarios.filter(f => f.status === 'agendado').length
  };

  // Funções de status
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'vencido':
        return <Badge className="bg-red-100 text-red-800 border-red-200">Vencido</Badge>;
      case 'proximo':
        return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">Próximo</Badge>;
      case 'valido':
        return <Badge className="bg-green-100 text-green-800 border-green-200">Válido</Badge>;
      case 'agendado':
        return <Badge className="bg-blue-100 text-blue-800 border-blue-200">Agendado</Badge>;
      case 'sem_aso':
        return <Badge className="bg-gray-100 text-gray-800 border-gray-200">Sem ASO</Badge>;
      default:
        return <Badge className="bg-gray-100 text-gray-800 border-gray-200">Desconhecido</Badge>;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'vencido':
        return <ExclamationTriangleIcon className="h-5 w-5 text-red-500" />;
      case 'proximo':
        return <ClockIcon className="h-5 w-5 text-yellow-500" />;
      case 'valido':
        return <CheckCircleIcon className="h-5 w-5 text-green-500" />;
      case 'agendado':
        return <CalendarIcon className="h-5 w-5 text-blue-500" />;
      case 'sem_aso':
        return <UserIcon className="h-5 w-5 text-gray-500" />;
      default:
        return <UserIcon className="h-5 w-5 text-gray-500" />;
    }
  };

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return 'Não informado';
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  const formatDateTime = (dateTimeString: string | undefined) => {
    if (!dateTimeString) return 'Não informado';
    return new Date(dateTimeString).toLocaleString('pt-BR');
  };

  // Função para abrir modal de edição
  const openEditModal = (funcionario: FuncionarioASO) => {
    setSelectedFuncionario(funcionario);
    setEditData({
      data_ultimo_exame_aso: funcionario.data_ultimo_exame_aso || '',
      data_agendamento_aso: funcionario.data_agendamento_aso ? funcionario.data_agendamento_aso.split('T')[0] : '',
      validade_aso: funcionario.validade_aso || ''
    });
    setShowEditModal(true);
  };

  // Função para salvar edição
  const handleSaveEdit = async () => {
    if (!selectedFuncionario) return;

    try {
      const updateData: Record<string, unknown> = {};
      
      if (editData.data_ultimo_exame_aso) {
        updateData.data_ultimo_exame_aso = editData.data_ultimo_exame_aso;
      }
      
      if (editData.data_agendamento_aso) {
        updateData.data_agendamento_aso = editData.data_agendamento_aso + 'T00:00:00.000Z';
      }
      
      if (editData.validade_aso) {
        updateData.validade_aso = editData.validade_aso;
      }

      const { error } = await supabase
        .from('usuarios')
        .update(updateData)
        .eq('id', selectedFuncionario.id);

      if (error) throw error;

      toast.success('ASO atualizado com sucesso!');
      setShowEditModal(false);
      refetch();
    } catch (error) {
      console.error('Erro ao atualizar ASO:', error);
      toast.error('Erro ao atualizar ASO');
    }
  };

  if (!canViewFuncionarios) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <ExclamationTriangleIcon className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Acesso Negado</h2>
          <p className="text-gray-600">Você não tem permissão para visualizar funcionários.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Controle de ASO</h1>
              <p className="mt-2 text-gray-600">
                Gerencie os Atestados de Saúde Ocupacional dos funcionários
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button
                onClick={() => router.push('/funcionarios')}
                variant="outline"
                className="flex items-center gap-2"
              >
                <UserIcon className="h-4 w-4" />
                Ver Funcionários
              </Button>
            </div>
          </div>
        </div>

        {/* Estatísticas */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 mb-8">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
                </div>
                <UserIcon className="h-8 w-8 text-gray-400" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Vencidos</p>
                  <p className="text-2xl font-bold text-red-600">{stats.vencidos}</p>
                </div>
                <ExclamationTriangleIcon className="h-8 w-8 text-red-400" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Próximos</p>
                  <p className="text-2xl font-bold text-yellow-600">{stats.proximos}</p>
                </div>
                <ClockIcon className="h-8 w-8 text-yellow-400" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Válidos</p>
                  <p className="text-2xl font-bold text-green-600">{stats.validos}</p>
                </div>
                <CheckCircleIcon className="h-8 w-8 text-green-400" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Agendados</p>
                  <p className="text-2xl font-bold text-blue-600">{stats.agendados}</p>
                </div>
                <CalendarIcon className="h-8 w-8 text-blue-400" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Sem ASO</p>
                  <p className="text-2xl font-bold text-gray-600">{stats.sem_aso}</p>
                </div>
                <UserIcon className="h-8 w-8 text-gray-400" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filtros */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <Label htmlFor="search">Buscar</Label>
                <div className="relative">
                  <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="search"
                    placeholder="Nome, matrícula ou cargo..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              
              <div>
                <Label htmlFor="status">Status</Label>
                <Select value={statusFilter} onValueChange={(value: 'all' | 'vencido' | 'proximo' | 'valido' | 'sem_aso' | 'agendado') => setStatusFilter(value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Filtrar por status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="vencido">Vencidos</SelectItem>
                    <SelectItem value="proximo">Próximos do Vencimento</SelectItem>
                    <SelectItem value="valido">Válidos</SelectItem>
                    <SelectItem value="agendado">Agendados</SelectItem>
                    <SelectItem value="sem_aso">Sem ASO</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="operacao">Operação</Label>
                <Select value={operacaoFilter} onValueChange={setOperacaoFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Filtrar por operação" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    <SelectItem value="EMERGENCIA">Emergência</SelectItem>
                    <SelectItem value="TÉCNICA LM">Técnica LM</SelectItem>
                    <SelectItem value="TÉCNICA LV">Técnica LV</SelectItem>
                    <SelectItem value="ALMOXARIFADO">Almoxarifado</SelectItem>
                    <SelectItem value="ASG">ASG</SelectItem>
                    <SelectItem value="COD">COD</SelectItem>
                    <SelectItem value="COMERCIAL">Comercial</SelectItem>
                    <SelectItem value="FATURAMENTO">Faturamento</SelectItem>
                    <SelectItem value="FROTA">Frota</SelectItem>
                    <SelectItem value="GERAL">Geral</SelectItem>
                    <SelectItem value="MONITORIA">Monitoria</SelectItem>
                    <SelectItem value="RH">RH</SelectItem>
                    <SelectItem value="SEG TRAB">Segurança do Trabalho</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="itemsPerPage">Itens por página</Label>
                <Select value={itemsPerPage.toString()} onValueChange={(value) => setItemsPerPage(Number(value))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="20">20</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Lista de funcionários */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Funcionários ({filteredFuncionarios.length})</span>
              {loading && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-2 text-gray-600">Carregando funcionários...</p>
              </div>
            ) : filteredFuncionarios.length === 0 ? (
              <div className="text-center py-8">
                <UserIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">Nenhum funcionário encontrado</p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-3 px-4 font-medium text-gray-900">Funcionário</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-900">Cargo</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-900">Operação</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-900">Status</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-900">Último Exame</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-900">Validade</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-900">Agendamento</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-900">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedFuncionarios.map((funcionario) => (
                        <tr key={funcionario.id} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="py-3 px-4">
                            <div>
                              <p className="font-medium text-gray-900">{funcionario.nome}</p>
                              <p className="text-sm text-gray-500">Matrícula: {funcionario.matricula}</p>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-gray-900">{funcionario.cargo}</td>
                          <td className="py-3 px-4 text-gray-900">{funcionario.operacao}</td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              {getStatusIcon(funcionario.status)}
                              {getStatusBadge(funcionario.status)}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-gray-900">
                            {formatDate(funcionario.data_ultimo_exame_aso)}
                          </td>
                          <td className="py-3 px-4 text-gray-900">
                            {funcionario.validade_aso ? (
                              <div>
                                <p>{formatDate(funcionario.validade_aso)}</p>
                                {funcionario.dias_vencimento !== 0 && (
                                  <p className="text-sm text-gray-500">
                                    {funcionario.dias_vencimento > 0 
                                      ? `${funcionario.dias_vencimento} dias restantes`
                                      : `${Math.abs(funcionario.dias_vencimento)} dias vencido`
                                    }
                                  </p>
                                )}
                              </div>
                            ) : (
                              'Não informado'
                            )}
                          </td>
                          <td className="py-3 px-4 text-gray-900">
                            {funcionario.data_agendamento_aso ? (
                              <div>
                                <p>{formatDateTime(funcionario.data_agendamento_aso)}</p>
                                {funcionario.dias_agendamento !== undefined && (
                                  <p className="text-sm text-gray-500">
                                    {funcionario.dias_agendamento > 0 
                                      ? `${funcionario.dias_agendamento} dias restantes`
                                      : `${Math.abs(funcionario.dias_agendamento)} dias atrás`
                                    }
                                  </p>
                                )}
                              </div>
                            ) : (
                              'Não agendado'
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => router.push(`/funcionarios/${funcionario.id}`)}
                                className="flex items-center gap-1"
                              >
                                <EyeIcon className="h-4 w-4" />
                                Ver
                              </Button>
                              {canEditFuncionarios && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => openEditModal(funcionario)}
                                  className="flex items-center gap-1"
                                >
                                  <PencilIcon className="h-4 w-4" />
                                  Editar
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Paginação */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-6">
                    <div className="text-sm text-gray-700">
                      Mostrando {startIndex + 1} a {Math.min(endIndex, filteredFuncionarios.length)} de {filteredFuncionarios.length} funcionários
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                        disabled={currentPage === 1}
                      >
                        <ChevronLeftIcon className="h-4 w-4" />
                      </Button>
                      <span className="text-sm text-gray-700">
                        Página {currentPage} de {totalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                        disabled={currentPage === totalPages}
                      >
                        <ChevronRightIcon className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Modal de edição */}
        <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Editar ASO - {selectedFuncionario?.nome}</DialogTitle>
              <DialogDescription>
                Atualize as informações do Atestado de Saúde Ocupacional
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="data_ultimo_exame_aso">Data do Último Exame</Label>
                <DateInput
                  id="data_ultimo_exame_aso"
                  value={editData.data_ultimo_exame_aso}
                  onChange={(value) => setEditData({ ...editData, data_ultimo_exame_aso: value })}
                  placeholder="DD/MM/AAAA"
                />
              </div>
              
              <div>
                <Label htmlFor="data_agendamento_aso">Data do Próximo Agendamento</Label>
                <Input
                  id="data_agendamento_aso"
                  type="datetime-local"
                  value={editData.data_agendamento_aso}
                  onChange={(e) => setEditData({ ...editData, data_agendamento_aso: e.target.value })}
                />
              </div>
              
              <div>
                <Label htmlFor="validade_aso">Validade do ASO</Label>
                <DateInput
                  id="validade_aso"
                  value={editData.validade_aso}
                  onChange={(value) => setEditData({ ...editData, validade_aso: value })}
                  placeholder="DD/MM/AAAA"
                />
              </div>
            </div>
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowEditModal(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSaveEdit}>
                Salvar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
