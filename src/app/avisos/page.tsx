'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { warningService } from '@/services/warningService';
import { userService } from '@/services/userService';
import { locationService } from '@/services/locationService';
import { Base } from '@/types';
import { useState, useEffect, memo, useCallback, useMemo } from 'react';
import { MagnifyingGlassIcon, DocumentTextIcon, ArrowUpTrayIcon, PencilIcon, PlusIcon, ChevronDownIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { PERMISSION_CODES } from '@/hooks/useModularPermissions';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { TestemunhaAutocomplete } from '@/components/ui/TestemunhaAutocomplete';
import { Warning, WarningType } from '@/types/warning';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
// import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DateFilterType } from '@/components/ui/date-filter';

// const statusOptions = [
//   { key: 'all', label: 'Todos' },
//   { key: 'pendente', label: 'Pendente' },
//   { key: 'assinado', label: 'Assinado' },
//   { key: 'recusado', label: 'Recusado' },
// ];

// const tipoAvisoOptions = [
//   { key: 'all', label: 'Todos' },
//   { key: 'advertencia', label: 'Advertência' },
//   { key: 'suspensao', label: 'Suspensão' },
//   { key: 'falta_grave', label: 'Falta Grave' },
// ];

// Componente de Card de Aviso minimalista
const WarningCard = memo(({ 
  warning, 
  user, 
  base, 
  expandedWarningId, 
  setExpandedWarningId,
  handleEditWarning,
  handleFileUpload,
  uploadingFile,
  getStatusBadge,
  getTipoAvisoBadge
}: {
  warning: Warning;
  user: { id: string; nome: string };
  base: { id: string; nome: string };
  expandedWarningId: string | null;
  setExpandedWarningId: (id: string | null) => void;
  handleEditWarning: (warning: Warning) => void;
  handleFileUpload: (id: string, file: File) => void;
  uploadingFile: string | null;
  getStatusBadge: (status: string) => React.ReactElement;
  getTipoAvisoBadge: (tipo: string) => React.ReactElement;
}) => (
  <div className="flex items-center gap-4 p-4 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
    {/* Avatar + Nome */}
    <div className="flex items-center gap-3 flex-1 min-w-0">
      <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center text-white font-bold flex-shrink-0">
        {user?.nome?.charAt(0).toUpperCase() || '?'}
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-semibold text-gray-900 truncate">{user?.nome || 'Usuário não encontrado'}</div>
        <div className="text-xs text-gray-500">{String((user as Record<string, unknown>)?.matricula || 'N/A')} - {String((user as Record<string, unknown>)?.cargo || 'N/A')}</div>
      </div>
    </div>

    {/* Tipo e Status */}
    <div className="flex items-center gap-2 flex-shrink-0">
      {getTipoAvisoBadge(warning.tipo_aviso)}
      {getStatusBadge(warning.status)}
    </div>

    {/* Informações */}
    <div className="hidden lg:flex items-center gap-4 flex-shrink-0">
      <div className="text-sm">
        <div className="text-gray-500 text-xs">Motivo</div>
        <div className="font-medium text-gray-900">{warning.motivo}</div>
      </div>
      <div className="text-sm">
        <div className="text-gray-500 text-xs">Base</div>
        <div className="font-medium text-gray-900">{base?.nome || 'N/A'}</div>
      </div>
      <div className="text-sm">
        <div className="text-gray-500 text-xs">Ocorrência</div>
        <div className="font-medium text-gray-900">{new Date(warning.data_ocorrencia).toLocaleDateString('pt-BR')}</div>
      </div>
    </div>

    {/* Ações */}
    <div className="flex items-center gap-1 flex-shrink-0">
      {warning.status === 'pendente' && (
        <label className="cursor-pointer">
          <Button
            size="sm"
            variant="ghost"
            disabled={uploadingFile === warning.id}
            title="Upload"
          >
            <ArrowUpTrayIcon className="h-4 w-4" />
          </Button>
          <input
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={e => {
              const file = e.target.files?.[0];
              if (file) {
                handleFileUpload(warning.id, file);
              }
            }}
          />
        </label>
      )}
      
      {warning.arquivo_assinado_url && (
        <Button
          size="sm"
          variant="ghost"
          asChild
          title="Ver PDF"
        >
          <a
            href={warning.arquivo_assinado_url}
            target="_blank"
            rel="noopener noreferrer"
          >
            <DocumentTextIcon className="h-4 w-4" />
          </a>
        </Button>
      )}

      {warning.status === 'pendente' && (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => handleEditWarning(warning)}
          title="Editar"
        >
          <PencilIcon className="h-4 w-4" />
        </Button>
      )}

      {warning.status === 'recusado' && (warning.testemunha1_nome || warning.testemunha2_nome) && (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setExpandedWarningId(expandedWarningId === warning.id ? null : warning.id)}
          title="Ver testemunhas"
        >
          {expandedWarningId === warning.id ? (
            <ChevronDownIcon className="h-4 w-4" />
          ) : (
            <ChevronRightIcon className="h-4 w-4" />
          )}
        </Button>
      )}
    </div>
  </div>
));

WarningCard.displayName = 'WarningCard';

function WarningsContent() {
  const searchParams = useSearchParams();
  const { user: currentUser } = useAuth();

  // Queries principais com configurações otimizadas
  const {
    data: warnings = [],
    isLoading: warningsLoading
  } = useQuery({
    queryKey: ['warnings'],
    queryFn: warningService.getAll,
    staleTime: 5 * 60 * 1000, // 5 minutos
    gcTime: 10 * 60 * 1000, // 10 minutos
  });

  const {
    data: users = [],
    isLoading: usersLoading
  } = useQuery({
    queryKey: ['users'],
    queryFn: userService.getAll,
    staleTime: 10 * 60 * 1000, // 10 minutos
    gcTime: 30 * 60 * 1000, // 30 minutos
  });

  const {
    data: bases = [],
    isLoading: basesLoading
  } = useQuery<Base[]>({
    queryKey: ['bases'],
    queryFn: locationService.getAll,
    staleTime: 30 * 60 * 1000, // 30 minutos
    gcTime: 60 * 60 * 1000, // 1 hora
  });

  // Estados para filtros e busca
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [tipoAvisoFilter, setTipoAvisoFilter] = useState('all');
  const [baseFilter, setBaseFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState<DateFilterType>('todos');
  const [dateRange, setDateRange] = useState<{ start: Date | null; end: Date | null }>({
    start: null,
    end: null
  });
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingWarning, setEditingWarning] = useState<Warning | null>(null);
  
          // Estados do formulário
          const [formData, setFormData] = useState({
            tipo_aviso: 'advertencia',
            target_user_id: '',
            base_id: '',
            motivo: '',
            data_ocorrencia: '',
            periodo_suspensao: '',
            data_inicio_suspensao: '',
            data_fim_suspensao: '',
            data_retorno_conclusoes: '',
            observacoes: ''
          });

          const [isCreating, setIsCreating] = useState(false);
  const [creatingProgress, setCreatingProgress] = useState('');
  
  // Estados para sistema de upload de arquivo assinado
  const [uploadingFile, setUploadingFile] = useState<string | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedWarning, setSelectedWarning] = useState<Warning | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadAction, setUploadAction] = useState<'assinado' | 'recusado' | null>(null);
  const [testemunhas, setTestemunhas] = useState({
    testemunha1_nome: '',
    testemunha1_cpf: '',
    testemunha2_nome: '',
    testemunha2_cpf: ''
  });

  // Linha expandida para ver detalhes
  const [expandedWarningId, setExpandedWarningId] = useState<string | null>(null);

  // Mapear usuários para busca rápida
  const userMap = useMemo(() => {
    const map: Record<string, string> = {};
    users.forEach(user => {
      map[user.id] = user.nome;
    });
    return map;
  }, [users]);

  // Mapear bases para busca rápida
  const baseMap = useMemo(() => {
    const map: Record<string, string> = {};
    bases.forEach(base => {
      map[base.id] = base.nome;
    });
    return map;
  }, [bases]);

  // Filtros aplicados
  const filteredWarnings = useMemo(() => {
    return warnings.filter(warning => {
      // Filtro por status
      const matchesStatus = statusFilter === 'all' || warning.status === statusFilter;
      
      // Filtro por tipo de aviso
      const matchesTipo = tipoAvisoFilter === 'all' || warning.tipo_aviso === tipoAvisoFilter;
      
      // Filtro por usuário
      
      // Filtro por base
      const matchesBase = baseFilter === 'all' || warning.base_id === baseFilter;
      
      // Filtro por data - se "todos" estiver selecionado ou não houver range, mostra tudo
      const matchesDate = dateFilter === 'todos' || !dateRange.start || !dateRange.end
        ? true
        : (() => {
            const warningDate = new Date(warning.data_ocorrencia);
            const startDate = new Date(dateRange.start);
            const endDate = new Date(dateRange.end);
            // Ajustar para comparar apenas a data (sem hora)
            warningDate.setHours(0, 0, 0, 0);
            startDate.setHours(0, 0, 0, 0);
            endDate.setHours(23, 59, 59, 999);
            return warningDate >= startDate && warningDate <= endDate;
          })();
      
      // Filtro por busca
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = !searchTerm ||
        (userMap[warning.target_user_id]?.toLowerCase().includes(searchLower)) ||
        (userMap[warning.created_by]?.toLowerCase().includes(searchLower)) ||
        (warning.motivo?.toLowerCase().includes(searchLower)) ||
        (warning.observacoes?.toLowerCase().includes(searchLower)) ||
        (baseMap[warning.base_id]?.toLowerCase().includes(searchLower));
      
      return matchesStatus && matchesTipo && matchesBase && matchesDate && matchesSearch;
    });
  }, [warnings, statusFilter, tipoAvisoFilter, baseFilter, dateFilter, dateRange, searchTerm, userMap, baseMap]);

  // Estatísticas por tipo de medida
  const statistics = useMemo(() => {
    const stats = {
      advertencia: { total: 0, pendente: 0, assinado: 0, recusado: 0 },
      suspensao: { total: 0, pendente: 0, assinado: 0, recusado: 0 },
      falta_grave: { total: 0, pendente: 0, assinado: 0, recusado: 0 }
    };

    warnings.forEach(warning => {
      const status = warning.recusado ? 'recusado' : warning.arquivo_assinado_url ? 'assinado' : 'pendente';
      
      if (stats[warning.tipo_aviso as keyof typeof stats]) {
        stats[warning.tipo_aviso as keyof typeof stats].total++;
        stats[warning.tipo_aviso as keyof typeof stats][status as keyof typeof stats.advertencia]++;
      }
    });

    return stats;
  }, [warnings]);

  const queryClient = useQueryClient();

  // Funções para badges modernos
  const getStatusBadge = useCallback((status: string) => {
    switch (status) {
      case 'pendente':
        return <Badge className="bg-orange-500 hover:bg-orange-600 text-xs">Pendente</Badge>;
      case 'assinado':
        return <Badge className="bg-green-500 hover:bg-green-600 text-xs">Assinado</Badge>;
      case 'recusado':
        return <Badge className="bg-red-500 hover:bg-red-600 text-xs">Recusado</Badge>;
      default:
        return <Badge variant="secondary" className="text-xs">{status}</Badge>;
    }
  }, []);

  const getTipoAvisoBadge = useCallback((tipo: string) => {
    switch (tipo) {
      case 'advertencia':
        return <Badge className="bg-yellow-500 hover:bg-yellow-600 text-xs">Advertência</Badge>;
      case 'suspensao':
        return <Badge className="bg-orange-600 hover:bg-orange-700 text-xs">Suspensão</Badge>;
      case 'falta_grave':
        return <Badge className="bg-red-600 hover:bg-red-700 text-xs">Falta Grave</Badge>;
      default:
        return <Badge variant="secondary" className="text-xs">{tipo}</Badge>;
    }
  }, []);

  // Mutation para criar aviso
  // const createMutation = useMutation({
  //   mutationFn: warningService.create,
  //   onSuccess: () => {
  //     queryClient.invalidateQueries({ queryKey: ['warnings'] });
  //     setIsCreateModalOpen(false);
  //     setIsCreating(false);
  //     setCreatingProgress('');
  //     setFormData({
  //       tipo_aviso: 'advertencia',
  //       target_user_id: '',
  //       base_id: '',
  //       motivo: '',
  //       data_ocorrencia: '',
  //       periodo_suspensao: '',
  //       data_inicio_suspensao: '',
  //       data_fim_suspensao: '',
  //       data_retorno_conclusoes: '',
  //       observacoes: ''
  //     });
  //   },
  //   onError: (error: unknown) => {
  //     setIsCreating(false);
  //     setCreatingProgress('');
  //     console.error('Erro ao criar aviso:', error);
  //     const errorMessage = (error as Error)?.message || 'Erro ao criar aviso';
  //     alert(errorMessage);
  //   }
  // });

  // Mutation para upload de arquivo assinado
  const uploadFileMutation = useMutation({
    mutationFn: async ({
      warningId,
      file,
      action,
      testemunhas
    }: {
      warningId: string;
      file: File;
      action: 'assinado' | 'recusado';
      testemunhas?: {
        testemunha1_nome: string;
        testemunha1_cpf: string;
        testemunha2_nome: string;
        testemunha2_cpf: string;
      };
    }) => {
      return await warningService.uploadSignedFile(warningId, file, action, testemunhas);
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['warnings'] });
      setUploadingFile(null);
      setShowUploadModal(false);
      setSelectedWarning(null);
      setSelectedFile(null);
      setUploadAction(null);
      setTestemunhas({
        testemunha1_nome: '',
        testemunha1_cpf: '',
        testemunha2_nome: '',
        testemunha2_cpf: ''
      });

      const actionText = variables.action === 'assinado' ? 'assinado' : 'recusado';
      alert(`Arquivo ${actionText} enviado com sucesso!`);
    },
    onError: (error: unknown) => {
      setUploadingFile(null);
      console.error('Erro no upload:', error);
      const errorMessage = (error as Error)?.message || 'Erro ao enviar arquivo';
      alert(errorMessage);
    }
  });

  // Mutation para editar aviso
  const editMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Warning> }) => {
      return await warningService.edit(id, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warnings'] });
      setIsEditModalOpen(false);
      setEditingWarning(null);
      alert('Aviso editado com sucesso!');
    },
    onError: (error: unknown) => {
      console.error('Erro ao editar aviso:', error);
      const errorMessage = (error as Error)?.message || 'Erro ao editar aviso';
      alert(errorMessage);
    }
  });

  // Função para lidar com upload de arquivo
  const handleFileUpload = (warningId: string, file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      alert('Arquivo muito grande. Máximo 10MB.');
      return;
    }
    if (file.type !== 'application/pdf') {
      alert('Apenas arquivos PDF são aceitos.');
      return;
    }
    
    setSelectedFile(file);
    setSelectedWarning(warnings.find(w => w.id === warningId));
    setShowUploadModal(true);
  };

  // Função para confirmar upload
  const handleConfirmUpload = () => {
    if (!selectedFile || !selectedWarning || !uploadAction) return;
    
    setUploadingFile(selectedWarning.id);
    uploadFileMutation.mutate({
      warningId: selectedWarning.id,
      file: selectedFile,
      action: uploadAction,
      testemunhas: uploadAction === 'recusado' ? testemunhas : undefined
    });
  };

  // Função para editar aviso
  const handleEditWarning = (warning: Warning) => {
    setEditingWarning(warning);
    setFormData({
      tipo_aviso: warning.tipo_aviso,
      target_user_id: warning.target_user_id || '',
      base_id: warning.base_id || '',
      motivo: warning.motivo || '',
      data_ocorrencia: warning.data_ocorrencia || '',
      periodo_suspensao: String(warning.periodo_suspensao || ''),
      data_inicio_suspensao: warning.data_inicio_suspensao || '',
      data_fim_suspensao: warning.data_fim_suspensao || '',
      data_retorno_conclusoes: warning.data_retorno_conclusoes || '',
      observacoes: warning.observacoes || ''
    });
    setIsEditModalOpen(true);
  };

  // Função para salvar edição
  const handleSaveEdit = () => {
    if (!editingWarning) return;
    
    // Calcular período automaticamente para suspensão
    let periodoCalculado = undefined;
    if (formData.tipo_aviso === 'suspensao' && formData.data_inicio_suspensao && formData.data_fim_suspensao) {
      const inicio = new Date(formData.data_inicio_suspensao);
      const fim = new Date(formData.data_fim_suspensao);
      periodoCalculado = Math.ceil((fim.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    }
    
    editMutation.mutate({
      id: editingWarning.id,
      updates: {
        ...formData,
        tipo_aviso: formData.tipo_aviso as WarningType,
        periodo_suspensao: periodoCalculado,
        base_id: formData.base_id || undefined
      }
    });
  };

          // Função para criar aviso
          const handleCreateWarning = async () => {
            // Validação básica
            if (!formData.target_user_id) {
              alert('Selecione um funcionário');
              return;
            }
            if (!formData.base_id || formData.base_id === '') {
              alert('Selecione uma base');
              return;
            }
            if (!formData.motivo.trim()) {
              alert('Motivo é obrigatório');
              return;
            }
            if (!formData.data_ocorrencia) {
              alert('Data da ocorrência é obrigatória');
              return;
            }

            // Validações específicas por tipo
            if (formData.tipo_aviso === 'suspensao') {
              if (!formData.periodo_suspensao || parseInt(formData.periodo_suspensao) < 1) {
                alert('Período de suspensão deve ser pelo menos 1 dia');
                return;
              }
              if (!formData.data_inicio_suspensao) {
                alert('Data de início da suspensão é obrigatória');
                return;
              }
            }

            if (formData.tipo_aviso === 'falta_grave') {
              if (!formData.data_retorno_conclusoes) {
                alert('Data de retorno das conclusões é obrigatória');
                return;
              }
            }

            setIsCreating(true);
            setCreatingProgress('Validando dados...');
            try {
              console.log('🚀 Criando aviso com dados:', formData);
              
              setCreatingProgress('Preparando dados...');
              const warningData: Partial<Warning> = {
                ...formData,
                tipo_aviso: formData.tipo_aviso as WarningType,
                created_by: currentUser?.id || '',
                base_id: formData.base_id || undefined, // Enviar undefined se não selecionado
                periodo_suspensao: formData.periodo_suspensao ? parseInt(formData.periodo_suspensao) : undefined,
                // Calcular data_fim_suspensao automaticamente
                data_fim_suspensao: formData.tipo_aviso === 'suspensao' && formData.data_inicio_suspensao && formData.periodo_suspensao 
                  ? (() => {
                      const inicio = new Date(formData.data_inicio_suspensao);
                      const fim = new Date(inicio);
                      fim.setDate(fim.getDate() + parseInt(formData.periodo_suspensao));
                      return fim.toISOString().split('T')[0];
                    })()
                  : undefined
              };

              setCreatingProgress('Salvando no banco de dados...');
              await warningService.create(warningData);
              
              setCreatingProgress('Gerando PDF...');
              // Simular tempo de geração do PDF
              await new Promise(resolve => setTimeout(resolve, 2000));
              
              setCreatingProgress('Finalizando...');
              
              // Limpar formulário e fechar modal
              setFormData({
                tipo_aviso: 'advertencia',
                target_user_id: '',
                base_id: '',
                motivo: '',
                data_ocorrencia: '',
                periodo_suspensao: '',
                data_inicio_suspensao: '',
                data_fim_suspensao: '',
                data_retorno_conclusoes: '',
                observacoes: ''
              });
              setIsCreateModalOpen(false);
              alert('Aviso criado com sucesso!');
              
            } catch (error) {
              console.error('Erro ao criar aviso:', error);
              alert('Erro ao criar aviso: ' + (error as Error).message);
            } finally {
              setIsCreating(false);
              setCreatingProgress('');
            }
          };

          // Capturar parâmetros da URL para pré-selecionar funcionário
          useEffect(() => {
            const funcionarioId = searchParams.get('funcionario');
            if (funcionarioId) {
              setFormData(prev => ({
                ...prev,
                target_user_id: funcionarioId
              }));
              setIsCreateModalOpen(true);
            }
          }, [searchParams]);

          if (warningsLoading || usersLoading || basesLoading) {
            return (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            );
          }

          return (
    <>
    <div className="space-y-4 p-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex-shrink-0">
          <h1 className="text-2xl font-bold text-gray-900">Medidas Disciplinares</h1>
          <p className="text-sm text-gray-600">Gerencie advertências, suspensões e faltas graves</p>
        </div>
        <Button
          size="sm"
          onClick={() => setIsCreateModalOpen(true)}
          disabled={isCreating}
          className="h-8 px-2 text-xs"
        >
          {isCreating ? (
            <>
              <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-white mr-1.5"></div>
              {creatingProgress}
            </>
          ) : (
            <>
              <PlusIcon className="h-3.5 w-3.5 mr-1.5" />
              Novo Aviso
            </>
          )}
        </Button>
      </div>

      {/* Cards de Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card Advertência */}
        <Card 
          className={`cursor-pointer transition-colors ${
            tipoAvisoFilter === 'advertencia' ? 'ring-2 ring-blue-500' : ''
          }`}
          onClick={() => setTipoAvisoFilter(tipoAvisoFilter === 'advertencia' ? 'all' : 'advertencia')}
        >
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-4">
              <div className="font-semibold text-gray-900">Advertências</div>
              <div className="text-2xl font-bold text-gray-900">{statistics.advertencia.total}</div>
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="text-center">
                <div className="text-gray-500 mb-1">Pendente</div>
                <div className="font-bold text-orange-600">{statistics.advertencia.pendente}</div>
              </div>
              <div className="text-center">
                <div className="text-gray-500 mb-1">Assinado</div>
                <div className="font-bold text-green-600">{statistics.advertencia.assinado}</div>
              </div>
              <div className="text-center">
                <div className="text-gray-500 mb-1">Recusado</div>
                <div className="font-bold text-red-600">{statistics.advertencia.recusado}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Card Suspensão */}
        <Card 
          className={`cursor-pointer transition-colors ${
            tipoAvisoFilter === 'suspensao' ? 'ring-2 ring-orange-500' : ''
          }`}
          onClick={() => setTipoAvisoFilter(tipoAvisoFilter === 'suspensao' ? 'all' : 'suspensao')}
        >
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-4">
              <div className="font-semibold text-gray-900">Suspensões</div>
              <div className="text-2xl font-bold text-gray-900">{statistics.suspensao.total}</div>
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="text-center">
                <div className="text-gray-500 mb-1">Pendente</div>
                <div className="font-bold text-orange-600">{statistics.suspensao.pendente}</div>
              </div>
              <div className="text-center">
                <div className="text-gray-500 mb-1">Assinado</div>
                <div className="font-bold text-green-600">{statistics.suspensao.assinado}</div>
              </div>
              <div className="text-center">
                <div className="text-gray-500 mb-1">Recusado</div>
                <div className="font-bold text-red-600">{statistics.suspensao.recusado}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Card Falta Grave */}
        <Card 
          className={`cursor-pointer transition-colors ${
            tipoAvisoFilter === 'falta_grave' ? 'ring-2 ring-red-500' : ''
          }`}
          onClick={() => setTipoAvisoFilter(tipoAvisoFilter === 'falta_grave' ? 'all' : 'falta_grave')}
        >
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-4">
              <div className="font-semibold text-gray-900">Falta Grave</div>
              <div className="text-2xl font-bold text-gray-900">{statistics.falta_grave.total}</div>
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="text-center">
                <div className="text-gray-500 mb-1">Pendente</div>
                <div className="font-bold text-orange-600">{statistics.falta_grave.pendente}</div>
              </div>
              <div className="text-center">
                <div className="text-gray-500 mb-1">Assinado</div>
                <div className="font-bold text-green-600">{statistics.falta_grave.assinado}</div>
              </div>
              <div className="text-center">
                <div className="text-gray-500 mb-1">Recusado</div>
                <div className="font-bold text-red-600">{statistics.falta_grave.recusado}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Busca */}
            <div className="flex flex-col sm:col-span-2 lg:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Buscar</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  placeholder="Buscar por nome, motivo, base..."
                  className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            {/* Status */}
            <div className="flex flex-col">
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecione o status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="assinado">Assinado</SelectItem>
                  <SelectItem value="recusado">Recusado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Tipo de Aviso */}
            <div className="flex flex-col">
              <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Aviso</label>
              <Select value={tipoAvisoFilter} onValueChange={setTipoAvisoFilter}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="advertencia">Advertência</SelectItem>
                  <SelectItem value="suspensao">Suspensão</SelectItem>
                  <SelectItem value="falta_grave">Falta Grave</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Base */}
            <div className="flex flex-col">
              <label className="block text-sm font-medium text-gray-700 mb-1">Base</label>
              <Select value={baseFilter} onValueChange={setBaseFilter}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecione a base" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {bases.map(base => (
                    <SelectItem key={base.id} value={base.id}>
                      {base.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Período - agora como Select */}
            <div className="flex flex-col">
              <label className="block text-sm font-medium text-gray-700 mb-1">Período</label>
              <Select 
                value={dateFilter} 
                onValueChange={(value: string) => {
                  const filter = value as DateFilterType;
                  setDateFilter(filter);
                  if (filter === 'todos') {
                    setDateRange({ start: null, end: null });
                    return;
                  }
                  if (filter === 'periodo') return;
                  const now = new Date();
                  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                  let start: Date;
                  const end = new Date(today.getTime() + 24 * 60 * 60 * 1000 - 1);
                  switch (filter) {
                    case 'hoje': start = today; break;
                    case '7dias': start = new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000); break;
                    case '1mes': start = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000); break;
                    case '6meses': start = new Date(today.getTime() - 180 * 24 * 60 * 60 * 1000); break;
                    case '1ano': start = new Date(today.getTime() - 365 * 24 * 60 * 60 * 1000); break;
                    default: start = today;
                  }
                  setDateRange({ start, end });
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecione o período" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="hoje">Hoje</SelectItem>
                  <SelectItem value="7dias">Últimos 7 dias</SelectItem>
                  <SelectItem value="1mes">Último mês</SelectItem>
                  <SelectItem value="6meses">Últimos 6 meses</SelectItem>
                  <SelectItem value="1ano">Último ano</SelectItem>
                  <SelectItem value="periodo">Período personalizado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Campos de data personalizada - aparece quando "periodo" selecionado */}
            {dateFilter === 'periodo' && (
              <div className="sm:col-span-2 lg:col-span-5 flex flex-wrap items-end gap-3">
                <div className="flex flex-col">
                  <label className="text-xs font-medium text-gray-600 mb-1">Data Inicial</label>
                  <input
                    type="date"
                    value={dateRange.start ? dateRange.start.toISOString().split('T')[0] : ''}
                    onChange={(e) => {
                      const start = e.target.value ? new Date(e.target.value) : null;
                      setDateRange(prev => ({ ...prev, start }));
                    }}
                    className="px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div className="flex flex-col">
                  <label className="text-xs font-medium text-gray-600 mb-1">Data Final</label>
                  <input
                    type="date"
                    value={dateRange.end ? dateRange.end.toISOString().split('T')[0] : ''}
                    onChange={(e) => {
                      const end = e.target.value ? new Date(e.target.value) : null;
                      setDateRange(prev => ({ ...prev, end }));
                    }}
                    className="px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Contador */}
      <div className="flex items-center gap-2 text-sm text-gray-600">
        <DocumentTextIcon className="h-4 w-4" />
        <span>{filteredWarnings.length} aviso(s)</span>
      </div>

      {/* Lista de avisos */}
      <Card>
        <CardContent className="p-0">
          {filteredWarnings.length === 0 ? (
            <div className="p-12 text-center">
              <DocumentTextIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Nenhum aviso encontrado</h3>
              <p className="text-sm text-gray-600">Ajuste os filtros ou crie um novo aviso</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {filteredWarnings.map((warning: Warning) => {
                const user = users.find(u => u.id === warning.target_user_id);
                const base = bases.find(b => b.id === warning.base_id);
                
                return (
                  <div key={warning.id}>
                    <WarningCard
                      warning={warning}
                      user={user || { id: '', nome: 'N/A' }}
                      base={base || { id: '', nome: 'N/A' }}
                      expandedWarningId={expandedWarningId}
                      setExpandedWarningId={setExpandedWarningId}
                      handleEditWarning={handleEditWarning}
                      handleFileUpload={handleFileUpload}
                      uploadingFile={uploadingFile}
                      getStatusBadge={getStatusBadge}
                      getTipoAvisoBadge={getTipoAvisoBadge}
                    />
                    
                    {/* Detalhes expandidos - testemunhas */}
                    {expandedWarningId === warning.id && warning.status === 'recusado' && (warning.testemunha1_nome || warning.testemunha2_nome) && (
                      <div className="px-4 pb-4 bg-gray-50">
                        <div className="p-4 bg-white border border-gray-200 rounded-lg">
                          <h4 className="font-semibold text-gray-900 mb-3">Testemunhas</h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {warning.testemunha1_nome && (
                              <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                                <div className="text-xs text-gray-500 mb-1">Testemunha 1</div>
                                <div className="text-sm font-medium text-gray-900">{warning.testemunha1_nome}</div>
                                {warning.testemunha1_cpf && (
                                  <div className="text-xs text-gray-600 mt-1">CPF: {warning.testemunha1_cpf}</div>
                                )}
                              </div>
                            )}
                            {warning.testemunha2_nome && (
                              <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                                <div className="text-xs text-gray-500 mb-1">Testemunha 2</div>
                                <div className="text-sm font-medium text-gray-900">{warning.testemunha2_nome}</div>
                                {warning.testemunha2_cpf && (
                                  <div className="text-xs text-gray-600 mt-1">CPF: {warning.testemunha2_cpf}</div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>

    {/* Modal de Criação */}
    {isCreateModalOpen && (
      <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
        <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-2xl shadow-lg rounded-md bg-white">
          <div className="mt-3">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">Criar Novo Aviso</h3>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              {/* Funcionário pré-selecionado ou seleção */}
              {searchParams.get('funcionario') ? (
                <div className="bg-blue-50 p-4 rounded-lg">
                  <h4 className="font-medium text-blue-900 mb-2">Funcionário Selecionado:</h4>
                  <p className="text-blue-800">
                    {searchParams.get('nome')} - Matrícula: {searchParams.get('matricula')}
                  </p>
                  <p className="text-blue-700 text-sm">
                    Cargo: {searchParams.get('cargo')}
                  </p>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Funcionário *
                  </label>
                  <select 
                    value={formData.target_user_id}
                    onChange={(e) => setFormData(prev => ({ ...prev, target_user_id: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Selecione um funcionário</option>
                    {users.map(user => (
                      <option key={user.id} value={user.id}>
                        {user.nome} - {user.matricula} ({user.cargo})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Seleção de Base */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Base *
                </label>
                <select 
                  value={formData.base_id}
                  onChange={(e) => setFormData(prev => ({ ...prev, base_id: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Selecione uma base</option>
                  {bases.map(base => (
                    <option key={base.id} value={base.id}>
                      {base.nome} - {base.estado}
                    </option>
                  ))}
                </select>
              </div>

              {/* Formulário básico */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tipo de Aviso *
                </label>
                <select
                  value={formData.tipo_aviso}
                  onChange={(e) => {
                    const newTipo = e.target.value;
                    setFormData(prev => ({
                      ...prev,
                      tipo_aviso: newTipo,
                      // Limpar descrição se não for advertência
                    }));
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="advertencia">Advertência</option>
                  <option value="suspensao">Suspensão</option>
                  <option value="falta_grave">Falta Grave</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Motivo *
                </label>
                <input
                  type="text"
                  value={formData.motivo}
                  onChange={(e) => setFormData(prev => ({ ...prev, motivo: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Ex: Atraso, falta, comportamento inadequado..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Data da Ocorrência *
                </label>
                <input
                  type="date"
                  value={formData.data_ocorrencia}
                  onChange={(e) => setFormData(prev => ({ ...prev, data_ocorrencia: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Campos específicos para Suspensão */}
              {formData.tipo_aviso === 'suspensao' && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Período (dias) *
                      </label>
                      <input
                        type="number"
                        value={formData.periodo_suspensao}
                        onChange={(e) => setFormData(prev => ({ ...prev, periodo_suspensao: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        min="1"
                        placeholder="Ex: 3"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Data de Início *
                      </label>
                      <input
                        type="date"
                        value={formData.data_inicio_suspensao}
                        onChange={(e) => setFormData(prev => ({ ...prev, data_inicio_suspensao: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                  {formData.data_inicio_suspensao && formData.periodo_suspensao && (
                    <div className="bg-blue-50 p-3 rounded-lg">
                      <p className="text-sm text-blue-800">
                        <strong>Data de Fim:</strong> {
                          (() => {
                            const inicio = new Date(formData.data_inicio_suspensao);
                            const fim = new Date(inicio);
                            fim.setDate(fim.getDate() + parseInt(formData.periodo_suspensao));
                            return fim.toLocaleDateString('pt-BR');
                          })()
                        }
                      </p>
                    </div>
                  )}
                </>
              )}

              {/* Campo específico para Falta Grave */}
              {formData.tipo_aviso === 'falta_grave' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Data de Retorno das Conclusões *
                  </label>
                  <input
                    type="date"
                    value={formData.data_retorno_conclusoes}
                    onChange={(e) => setFormData(prev => ({ ...prev, data_retorno_conclusoes: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              )}

              {/* Observações */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Observações
                </label>
                <textarea
                  rows={3}
                  value={formData.observacoes}
                  onChange={(e) => setFormData(prev => ({ ...prev, observacoes: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Observações adicionais..."
                />
              </div>

              {/* Botões */}
              <div className="flex justify-end space-x-3 pt-4 border-t">
                <button
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                    onClick={handleCreateWarning}
                    disabled={isCreating}
                    className={`px-4 py-2 text-sm font-medium text-white border border-transparent rounded-md flex items-center gap-2 ${
                      isCreating 
                        ? 'bg-gray-400 cursor-not-allowed' 
                        : 'bg-blue-600 hover:bg-blue-700'
                    }`}
                  >
                    {isCreating ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        {creatingProgress || 'Criando...'}
                      </>
                    ) : (
                      'Criar Aviso'
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de confirmação de upload */}
      {showUploadModal && selectedWarning && selectedFile && (
        <div className="fixed inset-0 bg-white/10 backdrop-blur-md flex items-center justify-center z-50 py-6">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-2 pt-6 pb-10 px-8 relative border border-blue-100 flex flex-col gap-6 max-h-[90vh] overflow-y-auto">
            <button
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-2xl"
              onClick={() => {
                setShowUploadModal(false);
                setSelectedWarning(null);
                setSelectedFile(null);
                setUploadAction(null);
              }}
              aria-label="Fechar modal"
            >×</button>

            <div className="flex flex-col items-center gap-1 mb-2">
              <span className="flex items-center justify-center bg-blue-50 rounded-full w-10 h-10">
                <ArrowUpTrayIcon className="h-5 w-5 text-blue-600" />
              </span>
              <h3 className="text-lg font-semibold text-gray-900 text-center mt-1">Confirmar Upload</h3>
              <p className="text-sm text-gray-600 text-center">Arquivo: {selectedFile.name}</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tipo de Upload *
                </label>
                <div className="space-y-2">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="uploadAction"
                      value="assinado"
                      checked={uploadAction === 'assinado'}
                      onChange={(e) => setUploadAction(e.target.value as 'assinado')}
                      className="mr-2"
                    />
                    <span className="text-sm text-gray-700">Arquivo Assinado</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="uploadAction"
                      value="recusado"
                      checked={uploadAction === 'recusado'}
                      onChange={(e) => setUploadAction(e.target.value as 'recusado')}
                      className="mr-2"
                    />
                    <span className="text-sm text-gray-700">Arquivo Recusado (com testemunhas)</span>
                  </label>
                </div>
              </div>

              {/* Campos de testemunhas - só aparecem se for recusado */}
              {uploadAction === 'recusado' && (
                <div className="space-y-4 border-t pt-4">
                  <h4 className="text-sm font-medium text-gray-700">Dados das Testemunhas</h4>
                  <p className="text-sm text-gray-600 mb-4">Para recusas, é necessário informar duas testemunhas que presenciaram a recusa.</p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <TestemunhaAutocomplete
                      value={testemunhas.testemunha1_nome}
                      onChange={(value) => setTestemunhas(prev => ({ ...prev, testemunha1_nome: value }))}
                      cpfValue={testemunhas.testemunha1_cpf}
                      onCpfChange={(cpf) => setTestemunhas(prev => ({ ...prev, testemunha1_cpf: cpf }))}
                      label="1ª Testemunha"
                      placeholder="Digite para buscar testemunha..."
                      required
                    />
                    <TestemunhaAutocomplete
                      value={testemunhas.testemunha2_nome}
                      onChange={(value) => setTestemunhas(prev => ({ ...prev, testemunha2_nome: value }))}
                      cpfValue={testemunhas.testemunha2_cpf}
                      onCpfChange={(cpf) => setTestemunhas(prev => ({ ...prev, testemunha2_cpf: cpf }))}
                      label="2ª Testemunha"
                      placeholder="Digite para buscar testemunha..."
                      required
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end space-x-3 pt-4 border-t">
              <button
                onClick={() => {
                  setShowUploadModal(false);
                  setSelectedWarning(null);
                  setSelectedFile(null);
                  setUploadAction(null);
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmUpload}
                disabled={!uploadAction || (uploadAction === 'recusado' && (!testemunhas.testemunha1_nome || !testemunhas.testemunha1_cpf || !testemunhas.testemunha2_nome || !testemunhas.testemunha2_cpf)) || uploadingFile === selectedWarning?.id}
                className={`px-4 py-2 text-sm font-medium text-white border border-transparent rounded-md flex items-center gap-2 ${
                  !uploadAction || (uploadAction === 'recusado' && (!testemunhas.testemunha1_nome || !testemunhas.testemunha1_cpf || !testemunhas.testemunha2_nome || !testemunhas.testemunha2_cpf)) || uploadingFile === selectedWarning?.id
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {uploadingFile === selectedWarning?.id ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Enviando...
                  </>
                ) : (
                  'Confirmar Upload'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Edição */}
      {isEditModalOpen && editingWarning && (
        <div className="fixed inset-0 bg-white/10 backdrop-blur-md flex items-center justify-center z-50 py-6">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-2 pt-6 pb-10 px-8 relative border border-blue-100 flex flex-col gap-6 max-h-[90vh] overflow-y-auto">
            <button 
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-2xl" 
              onClick={() => {
                setIsEditModalOpen(false);
                setEditingWarning(null);
              }}
              aria-label="Fechar modal"
            >
              ×
            </button>

            <div className="flex flex-col items-center gap-1 mb-2">
              <span className="flex items-center justify-center bg-green-50 rounded-full w-10 h-10">
                <PencilIcon className="h-5 w-5 text-green-600" />
              </span>
              <h3 className="text-lg font-semibold text-gray-900 text-center mt-1">Editar Aviso</h3>
            </div>

            <form className="flex flex-col gap-4">
              {/* Formulário de edição - mesmo do modal de criação */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tipo de Aviso *
                </label>
                <select
                  value={formData.tipo_aviso}
                  onChange={(e) => {
                    const newTipo = e.target.value;
                    setFormData(prev => ({
                      ...prev,
                      tipo_aviso: newTipo,
                      // Limpar descrição se não for advertência
                    }));
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="advertencia">Advertência</option>
                    <option value="suspensao">Suspensão</option>
                    <option value="falta_grave">Falta Grave</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Funcionário *
                  </label>
                  <select
                    value={formData.target_user_id}
                    onChange={(e) => setFormData(prev => ({ ...prev, target_user_id: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Selecione um funcionário</option>
                    {users.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.nome} - {user.matricula}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Base *
                  </label>
                  <select
                    value={formData.base_id}
                    onChange={(e) => setFormData(prev => ({ ...prev, base_id: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Selecione uma base</option>
                    {bases.map((base) => (
                      <option key={base.id} value={base.id}>
                        {base.nome}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Motivo *
                  </label>
                  <input
                    type="text"
                    value={formData.motivo}
                    onChange={(e) => setFormData(prev => ({ ...prev, motivo: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Ex: Atraso, falta, comportamento inadequado..."
                  />
                </div>


                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Data da Ocorrência *
                  </label>
                  <input
                    type="date"
                    value={formData.data_ocorrencia}
                    onChange={(e) => setFormData(prev => ({ ...prev, data_ocorrencia: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {/* Campos específicos para suspensão */}
                {formData.tipo_aviso === 'suspensao' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Período de Suspensão (dias) - Calculado automaticamente
                      </label>
                      <input
                        type="number"
                        value={formData.data_inicio_suspensao && formData.data_fim_suspensao 
                          ? Math.ceil((new Date(formData.data_fim_suspensao).getTime() - new Date(formData.data_inicio_suspensao).getTime()) / (1000 * 60 * 60 * 24)) + 1
                          : formData.periodo_suspensao || ''
                        }
                        readOnly
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-600 cursor-not-allowed"
                        placeholder="Será calculado automaticamente"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        O período é calculado automaticamente baseado nas datas de início e fim
                      </p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Data Início Suspensão
                        </label>
                        <input
                          type="date"
                          value={formData.data_inicio_suspensao}
                          onChange={(e) => setFormData(prev => ({ ...prev, data_inicio_suspensao: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Data Fim Suspensão
                        </label>
                        <input
                          type="date"
                          value={formData.data_fim_suspensao}
                          onChange={(e) => setFormData(prev => ({ ...prev, data_fim_suspensao: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                    </div>
                  </>
                )}

                {/* Campo específico para falta grave */}
                {formData.tipo_aviso === 'falta_grave' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Data Retorno das Conclusões
                    </label>
                    <input
                      type="date"
                      value={formData.data_retorno_conclusoes}
                      onChange={(e) => setFormData(prev => ({ ...prev, data_retorno_conclusoes: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Observações
                  </label>
                  <textarea
                    rows={3}
                    value={formData.observacoes}
                    onChange={(e) => setFormData(prev => ({ ...prev, observacoes: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Observações adicionais..."
                  />
                </div>

              <div className="flex justify-end space-x-3 pt-4 border-t">
                <button
                  onClick={() => {
                    setIsEditModalOpen(false);
                    setEditingWarning(null);
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveEdit}
                  disabled={editMutation.isPending}
                  className={`px-4 py-2 text-sm font-medium text-white border border-transparent rounded-md flex items-center gap-2 ${
                    editMutation.isPending
                      ? 'bg-gray-400 cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-700'
                  }`}
                >
                  {editMutation.isPending ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Salvando...
                    </>
                  ) : (
                    'Salvar Alterações'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

export default function WarningsPage() {
  return (
    <ProtectedRoute requiredPermissions={[
      PERMISSION_CODES.MEDIDAS.VISUALIZAR,
      PERMISSION_CODES.MEDIDAS.CRIAR,
      PERMISSION_CODES.MEDIDAS.EDITAR
    ]}>
      <Suspense fallback={<div className="p-6">Carregando...</div>}>
        <WarningsContent />
      </Suspense>
    </ProtectedRoute>
  );
}
