'use client';

import React, { useState, useMemo } from 'react';
import { MagnifyingGlassIcon, ChevronLeftIcon, ChevronRightIcon, KeyIcon, UsersIcon, EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';
import { useQuery } from '@tanstack/react-query';
import { userService } from '@/services/userService';
import { contratoService } from '@/services/contratoService';
import { baseService } from '@/services/baseService';
import { User } from '@/types';
import { Contrato, Base } from '@/types/contratos';
import { useAuth } from '@/contexts/AuthContext';
import { filterManageableUsers } from '@/utils/permissions';
import { generatePassword, PRESET_PASSWORDS, evaluatePasswordStrength } from '@/utils/passwordGenerator';
import ProtectedRoute from '@/components/ProtectedRoute';
import { supabase } from '@/lib/supabase';

// Shadcn/ui components
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';

// Níveis de acesso e operações serão buscados dinamicamente do banco de dados

// Senhas padrão sugeridas (mantidas para compatibilidade)
const defaultPasswords = [
  '123456',
  'senha123',
  'usuario123',
  'temp123',
  'padrao123',
];

// Extensão local do tipo User para incluir contratos e bases
type UserWithAccess = User & { 
  contratos?: { id: string; nome: string }[]; 
  bases?: { id: string; nome: string }[];
};

export default function ResetPasswordsPage() {
  // const queryClient = useQueryClient(); // TODO: Use when mutations are implemented
  const [searchTerm, setSearchTerm] = useState('');
  const [accessLevelFilter, setAccessLevelFilter] = useState('');
  const [operacaoFilter, setOperacaoFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const { user: currentUser, userLocationIds } = useAuth();
  
  // Estados para reset de senhas
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [defaultPassword, setDefaultPassword] = useState('');
  const [customPassword, setCustomPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [resetReason, setResetReason] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [resetResults, setResetResults] = useState<{success: string[], failed: string[], errors: {user: string, error: string}[], recreated: string[]}>({success: [], failed: [], errors: [], recreated: []});
  const [progress, setProgress] = useState({processed: 0, total: 0});
  
  // Estados para gerador de senhas
  const [showGenerator, setShowGenerator] = useState(false);
  const [generatedPasswords, setGeneratedPasswords] = useState<string[]>([]);
  const [selectedPreset, setSelectedPreset] = useState('');
  
  const [success, setSuccess] = useState<string>('');
  const [error, setError] = useState<string>('');

  // Estados de paginação
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(50);

  // Debounce para busca
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Query para contadores totais
  const {
    data: countsData = { total: 0, ativo: 0, pendente: 0, inativo: 0 },
    isLoading: countsLoading,
    isFetching: countsFetching
  } = useQuery({
    queryKey: ['users-counts', debouncedSearchTerm, accessLevelFilter, operacaoFilter, statusFilter],
    queryFn: () => userService.getCounts({
      search: debouncedSearchTerm,
      accessLevel: accessLevelFilter,
      operacao: operacaoFilter,
      status: statusFilter
    }),
    staleTime: 1000 * 5,
    gcTime: 1000 * 60,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  // Query paginada
  const {
    data: paginatedData = { users: [], total: 0, totalPages: 1 },
    isLoading: paginatedLoading,
    isFetching: paginatedFetching,
    // error: usersError // TODO: Handle error display
  } = useQuery({
    queryKey: ['users-paginated', currentPage, pageSize, debouncedSearchTerm, accessLevelFilter, operacaoFilter, statusFilter],
    queryFn: () => userService.getPaginated(currentPage, pageSize, {
      search: debouncedSearchTerm,
      accessLevel: accessLevelFilter,
      operacao: operacaoFilter,
      status: statusFilter
    }),
    staleTime: 1000 * 10,
    gcTime: 1000 * 60,
    placeholderData: (previousData) => previousData,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  const loading = countsLoading || paginatedLoading;
  const isSearching = countsFetching || paginatedFetching;

  // Query para contratos
  const { data: contratos = [] } = useQuery({
    queryKey: ['contratos'],
    queryFn: contratoService.getAll,
    staleTime: 1000 * 60 * 30,
  });

  // Query para bases
  const { data: bases = [] } = useQuery({
    queryKey: ['bases'],
    queryFn: baseService.getAll,
    staleTime: 1000 * 60 * 30,
  });

  // Query para contratos dos usuários visíveis
  const { data: userContratosMap = {} } = useQuery({
    queryKey: ['user-contratos-page', paginatedData.users.map((u: User) => u.id)],
    queryFn: async () => {
      if (!paginatedData.users.length) return {};
      const userIds = paginatedData.users.map((user: User) => user.id);
      return await userService.getAllUsersContratos(userIds);
    },
    enabled: Boolean(paginatedData.users.length),
    staleTime: 1000 * 60 * 5,
  });

  // Query para bases dos usuários visíveis
  const { data: userBasesMap = {} } = useQuery({
    queryKey: ['user-bases-page', paginatedData.users.map((u: User) => u.id)],
    queryFn: async () => {
      if (!paginatedData.users.length) return {};
      const userIds = paginatedData.users.map((user: User) => user.id);
      return await userService.getAllUsersBases(userIds);
    },
    enabled: Boolean(paginatedData.users.length),
    staleTime: 1000 * 60 * 5,
  });

  // Query para todos os usuários filtrados (para seleção em massa)
  const { data: allActiveUsersData = [] } = useQuery({
    queryKey: ['all-active-users', debouncedSearchTerm, accessLevelFilter, operacaoFilter, statusFilter],
    queryFn: async () => {
      const filters = {
        search: debouncedSearchTerm,
        accessLevel: accessLevelFilter,
        operacao: operacaoFilter,
        status: statusFilter || undefined // Usar o filtro de status selecionado
      };
      // Usar getPaginated com um limite muito alto para obter todos os usuários
      const result = await userService.getPaginated(1, 10000, filters);
      return result.users;
    },
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 10,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  // Query para buscar níveis de acesso únicos dos usuários
  const { data: accessLevels = [] } = useQuery({
    queryKey: ['access-levels'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('usuarios')
        .select('nivel_acesso')
        .not('nivel_acesso', 'is', null)
        .neq('nivel_acesso', '');
      
      if (error) throw error;
      
      // Extrair níveis únicos e criar array com id e name
      const uniqueLevels = [...new Set(data.map(user => user.nivel_acesso))]
        .map(level => ({
          id: level,
          name: level.charAt(0).toUpperCase() + level.slice(1).replace('_', ' ')
        }));
      
      return uniqueLevels.sort((a, b) => a.name.localeCompare(b.name));
    },
    staleTime: 1000 * 60 * 30, // Cache por 30 minutos
    gcTime: 1000 * 60 * 60, // Manter no cache por 1 hora
  });

  // Query para buscar operações únicas dos usuários
  const { data: operacoes = [] } = useQuery({
    queryKey: ['operacoes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('usuarios')
        .select('operacao')
        .not('operacao', 'is', null)
        .neq('operacao', '');
      
      if (error) throw error;
      
      // Extrair operações únicas e criar array com id e name
      const uniqueOperacoes = [...new Set(data.map(user => user.operacao))]
        .map(operacao => ({
          id: operacao,
          name: operacao.charAt(0).toUpperCase() + operacao.slice(1).replace('_', ' ')
        }));
      
      return uniqueOperacoes.sort((a, b) => a.name.localeCompare(b.name));
    },
    staleTime: 1000 * 60 * 30, // Cache por 30 minutos
    gcTime: 1000 * 60 * 60, // Manter no cache por 1 hora
  });

  // Combinar usuários com seus contratos e bases
  const users = (paginatedData?.users || []).map((user: User) => ({
    ...user,
    contratos: contratos.filter((contrato: Contrato) =>
      userContratosMap[user.id]?.includes(contrato.id) || false
    ),
    bases: bases.filter((base: Base) =>
      userBasesMap[user.id]?.includes(base.id) || false
    )
  }));

  const totalUsers = paginatedData.total || 0;
  const totalPages = paginatedData.totalPages || 1;

  // Aplicar filtros de permissão
  const filteredUsers = useMemo(() => {
    const manageableUsers = filterManageableUsers(currentUser?.nivel_acesso, users as UserWithAccess[]);
    return manageableUsers.filter(user => {
      return currentUser?.nivel_acesso === 'admin' ||
        user.contratos?.some(contrato => userLocationIds.includes(contrato.id));
    });
  }, [users, currentUser?.nivel_acesso, userLocationIds]);

  // Calcular usuários elegíveis para seleção em massa (aplicando todos os filtros)
  const eligibleUsersForSelection = useMemo(() => {
    const manageableUsers = filterManageableUsers(currentUser?.nivel_acesso, allActiveUsersData as UserWithAccess[]);
    const filteredByLocation = manageableUsers.filter(user => {
      return currentUser?.nivel_acesso === 'admin' ||
        user.contratos?.some(contrato => userLocationIds.includes(contrato.id));
    });
    
    // Apenas usuários com auth_usuario_id podem ter senha resetada
    // O filtro de status já foi aplicado na query allActiveUsersData
    return filteredByLocation.filter(user => user.auth_usuario_id);
  }, [allActiveUsersData, currentUser?.nivel_acesso, userLocationIds]);

  // Funções de seleção
  const handleSelectUser = (userId: string, checked: boolean) => {
    if (checked) {
      setSelectedUsers(prev => [...prev, userId]);
    } else {
      setSelectedUsers(prev => prev.filter(id => id !== userId));
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      // Selecionar todos os usuários filtrados (independente da paginação)
      const eligibleUsers = eligibleUsersForSelection.map(user => user.id);
      setSelectedUsers(prev => {
        // Adicionar os novos sem duplicar
        const newIds = eligibleUsers.filter(id => !prev.includes(id));
        return [...prev, ...newIds];
      });
    } else {
      // Desmarcar todos os usuários filtrados
      const eligibleUsers = eligibleUsersForSelection.map(user => user.id);
      setSelectedUsers(prev => prev.filter(id => !eligibleUsers.includes(id)));
    }
  };

  // const selectedUsersData = filteredUsers.filter(user => selectedUsers.includes(user.id)); // TODO: Use for bulk operations

  // Funções do gerador de senhas
  const handleGeneratePasswords = (presetKey?: string) => {
    const preset = presetKey ? PRESET_PASSWORDS[presetKey as keyof typeof PRESET_PASSWORDS] : null;
    const options = preset?.options || {
      length: 10,
      includeUppercase: true,
      includeLowercase: true,
      includeNumbers: true,
      includeSymbols: false,
    };

    const passwords = [];
    for (let i = 0; i < 5; i++) {
      passwords.push(generatePassword(options));
    }
    setGeneratedPasswords(passwords);
  };

  const handleSelectGeneratedPassword = (password: string) => {
    setCustomPassword(password);
    setDefaultPassword('');
    setShowGenerator(false);
  };

  // Função para reset em massa
  const handleBulkPasswordReset = async () => {
    if (selectedUsers.length === 0) {
      setError('Selecione pelo menos um usuário.');
      return;
    }

    const passwordToUse = customPassword || defaultPassword;
    if (!passwordToUse) {
      setError('Digite ou selecione uma senha padrão.');
      return;
    }

    if (passwordToUse.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.');
      return;
    }

    const confirmMessage = `Tem certeza que deseja resetar a senha de ${selectedUsers.length} usuários?\n\nSenha: ${passwordToUse}\nMotivo: ${resetReason || 'Não informado'}`;
    
    if (!confirm(confirmMessage)) {
      return;
    }

    setIsProcessing(true);
    setError('');
    setSuccess('');
    setResetResults({success: [], failed: [], errors: [], recreated: []});
    setProgress({processed: 0, total: selectedUsers.length});

    const results = {success: [] as string[], failed: [] as string[], errors: [] as {user: string, error: string}[], recreated: [] as string[]};

    // Função para identificar erros temporários que podem ser tentados novamente
    const isTemporaryError = (error: string): boolean => {
      const temporaryErrors = [
        'timeout',
        'network',
        'connection',
        'rate limit',
        'too many requests',
        'service unavailable',
        'internal server error',
        'gateway timeout',
        'bad gateway',
        'temporarily unavailable'
      ];
      
      return temporaryErrors.some(tempError => 
        error.toLowerCase().includes(tempError)
      );
    };

    // Função para processar um usuário individual
    const processUser = async (userId: string) => {
      // Buscar o usuário em todos os usuários filtrados (não apenas na página atual)
      const user = eligibleUsersForSelection.find(u => u.id === userId) || 
                   allActiveUsersData.find((u: User) => u.id === userId);
      if (!user) {
        return {
          type: 'failed',
          user: userId,
          error: 'Usuário não encontrado'
        };
      }
      
      // Verificar se tem email válido
      if (!user.email || user.email.trim() === '') {
        return {
          type: 'failed',
          user: user.nome || userId,
          error: 'Email não encontrado'
        };
      }

      try {
        console.log(`Processando usuário:`, { 
          id: user.id, 
          nome: user.nome, 
          email: user.email, 
          auth_usuario_id: user.auth_usuario_id 
        });
        
        const res = await fetch('/api/users/reset-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            auth_user_id: user.auth_usuario_id,
            user_id: user.id,
            newPassword: passwordToUse,
            admin_id: currentUser?.id,
            reason: resetReason || 'Reset em massa via painel administrativo'
          }),
        });

        if (res.ok) {
          const data = await res.json();
          if (data.message && data.message.includes('recriado')) {
            return { type: 'recreated', user: user.nome };
          } else {
            return { type: 'success', user: user.nome };
          }
        } else {
          const data = await res.json();
          console.error(`Erro ao resetar senha de ${user.nome}:`, data);
          return {
            type: 'failed',
            user: user.nome,
            error: data.error || 'Erro desconhecido'
          };
        }
      } catch (error) {
        console.error(`Erro de rede ao resetar senha de ${user.nome}:`, error);
        return {
          type: 'failed',
          user: user.nome,
          error: 'Erro de conexão'
        };
      }
    };

    // Processar usuários em lotes sequenciais com retry logic para melhor confiabilidade
    const BATCH_SIZE = 5; // Reduzir tamanho do lote para evitar rate limiting
    const MAX_RETRIES = 3; // Máximo de tentativas por usuário
    const DELAY_BETWEEN_BATCHES = 2000; // Delay de 2 segundos entre lotes
    
    const batches = [];
    for (let i = 0; i < selectedUsers.length; i += BATCH_SIZE) {
      const batch = selectedUsers.slice(i, i + BATCH_SIZE);
      batches.push(batch);
    }

    // Processar cada lote sequencialmente com delay
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      console.log(`Processando lote ${batchIndex + 1}/${batches.length} com ${batch.length} usuários`);
      
      // Processar usuários do lote com retry logic
      const batchPromises = batch.map(async (userId) => {
        let lastError = null;
        
        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
          try {
            const result = await processUser(userId);
            
            // Se foi sucesso ou erro definitivo (não temporário), retornar
            if (result.type === 'success' || result.type === 'recreated' || 
                (result.type === 'failed' && !isTemporaryError(result.error))) {
              return result;
            }
            
            // Se é erro temporário e não é a última tentativa, aguardar antes de tentar novamente
            if (attempt < MAX_RETRIES) {
              const delay = attempt * 1000; // Delay progressivo: 1s, 2s, 3s
              console.log(`Tentativa ${attempt} falhou para usuário ${userId}, tentando novamente em ${delay}ms...`);
              await new Promise(resolve => setTimeout(resolve, delay));
            }
            
            lastError = result.error;
          } catch (error) {
            lastError = error instanceof Error ? error.message : 'Erro desconhecido';
            
            if (attempt < MAX_RETRIES) {
              const delay = attempt * 1000;
              console.log(`Tentativa ${attempt} falhou para usuário ${userId}, tentando novamente em ${delay}ms...`);
              await new Promise(resolve => setTimeout(resolve, delay));
            }
          }
        }
        
        // Se chegou aqui, todas as tentativas falharam
        return {
          type: 'failed',
          user: userId,
          error: `Falhou após ${MAX_RETRIES} tentativas. Último erro: ${lastError}`
        };
      });
      
      const batchResults = await Promise.allSettled(batchPromises);
      
      // Processar resultados do lote
      batchResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          const userResult = result.value;
          switch (userResult.type) {
            case 'success':
              results.success.push(userResult.user);
              break;
            case 'recreated':
              results.recreated.push(userResult.user);
              break;
            case 'failed':
              results.failed.push(userResult.user);
              results.errors.push({user: userResult.user, error: userResult.error});
              break;
          }
        } else {
          // Se a promise foi rejeitada, adicionar como erro
          const userId = batch[index];
          results.failed.push(userId);
          results.errors.push({user: userId, error: `Erro inesperado: ${result.reason}`});
        }
      });
      
      // Atualizar progresso e resultados em tempo real
      setProgress(prev => ({...prev, processed: prev.processed + batch.length}));
      setResetResults({...results});
      
      // Delay entre lotes para evitar rate limiting
      if (batchIndex < batches.length - 1) {
        console.log(`Aguardando ${DELAY_BETWEEN_BATCHES}ms antes do próximo lote...`);
        await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
      }
    }

    setResetResults(results);
    setIsProcessing(false);

    if (results.success.length > 0) {
      setSuccess(`${results.success.length} senhas resetadas com sucesso!`);
    }
    if (results.recreated.length > 0) {
      setSuccess(prev => prev ? `${prev} ${results.recreated.length} usuários recriados no Auth.` : `${results.recreated.length} usuários recriados no sistema de autenticação!`);
    }
    if (results.failed.length > 0) {
      setError(`${results.failed.length} usuários falharam no reset.`);
    }

    // Limpar seleções após o processo
    setSelectedUsers([]);
    setCustomPassword('');
    setDefaultPassword('');
    setResetReason('');

    setTimeout(() => {
      setSuccess('');
      setError('');
    }, 5000);
  };

  // Verificar se o usuário pode acessar a página
  const canAccess = currentUser?.nivel_acesso === 'admin' ||
    currentUser?.nivel_acesso === 'diretor' ||
    currentUser?.nivel_acesso === 'manager';

  if (!canAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white p-8 rounded shadow text-center">
          <h2 className="text-xl font-bold mb-2">Acesso negado</h2>
          <p className="text-gray-600">Apenas administradores e diretores podem acessar o reset de senhas em massa.</p>
        </div>
      </div>
    );
  }

  return (
    <ProtectedRoute requiredAccessLevel={["admin"]}>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header Section */}
        <div className="mb-10">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gradient-to-r from-orange-600 to-red-600 rounded-xl shadow-lg">
                  <KeyIcon className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                    Reset de Senhas em Massa
                  </h1>
                  <p className="text-gray-600 font-medium">Defina uma senha padrão para múltiplos usuários simultaneamente</p>
                </div>
              </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 lg:gap-6">
              <Card className="bg-gradient-to-br from-blue-500 to-blue-600 border-0 shadow-lg">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between text-white">
                    <div>
                      <div className="text-2xl font-bold">{countsData.total}</div>
                      <div className="text-blue-100 text-sm font-medium">Total</div>
                    </div>
                    <UsersIcon className="w-6 h-6 opacity-80" />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-emerald-500 to-green-600 border-0 shadow-lg">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between text-white">
                    <div>
                      <div className="text-2xl font-bold">{selectedUsers.length}</div>
                      <div className="text-emerald-100 text-sm font-medium">Selecionados</div>
                    </div>
                    <div className="p-1 bg-white/20 rounded-lg">
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-orange-500 to-red-500 border-0 shadow-lg">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between text-white">
                    <div>
                      <div className="text-2xl font-bold">{countsData.ativo}</div>
                      <div className="text-orange-100 text-sm font-medium">Ativos</div>
                    </div>
                    <KeyIcon className="w-6 h-6 opacity-80" />
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>

        {/* Barra de Progresso */}
        {isProcessing && progress.total > 0 && (
          <Card className="mb-6 border-blue-200 bg-blue-50">
            <CardContent className="p-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-blue-800">
                    Processando reset de senhas...
                  </span>
                  <span className="text-sm text-blue-600">
                    {progress.processed} de {progress.total} usuários
                  </span>
                </div>
                <div className="w-full bg-blue-200 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300 ease-out"
                    style={{ width: `${(progress.processed / progress.total) * 100}%` }}
                  ></div>
                </div>
                <div className="text-xs text-blue-600 text-center">
                  {Math.round((progress.processed / progress.total) * 100)}% concluído
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Alerts */}
        {error && (
          <Card className="mb-6 border-red-200 bg-red-50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-1 bg-red-100 rounded-full">
                  <svg className="w-4 h-4 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <p className="text-red-800 font-medium">{error}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {success && (
          <Card className="mb-6 border-green-200 bg-green-50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-1 bg-green-100 rounded-full">
                  <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
                <p className="text-green-800 font-medium">{success}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Resultados do Reset */}
        {(resetResults.success.length > 0 || resetResults.failed.length > 0 || resetResults.recreated.length > 0) && (
          <Card className="mb-6 border-blue-200 bg-blue-50">
            <CardHeader>
              <CardTitle className="text-blue-800 flex items-center gap-2">
                <KeyIcon className="w-5 h-5" />
                Resultados do Reset
              </CardTitle>
            </CardHeader>
            <CardContent>
              {resetResults.success.length > 0 && (
                <div className="mb-4">
                  <h4 className="font-medium text-green-800 mb-2">✅ Sucessos ({resetResults.success.length})</h4>
                  <div className="flex flex-wrap gap-2">
                    {resetResults.success.map(name => (
                      <Badge key={name} variant="outline" className="bg-green-50 border-green-200 text-green-700">
                        {name}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              
              {resetResults.recreated.length > 0 && (
                <div className="mb-4">
                  <h4 className="font-medium text-blue-800 mb-2">🔄 Usuários Recriados ({resetResults.recreated.length})</h4>
                  <div className="flex flex-wrap gap-2">
                    {resetResults.recreated.map(name => (
                      <Badge key={name} variant="outline" className="bg-blue-50 border-blue-200 text-blue-700">
                        {name}
                      </Badge>
                    ))}
                  </div>
                  <p className="text-sm text-blue-600 mt-2">
                    Estes usuários foram recriados no sistema de autenticação e tiveram suas senhas definidas.
                  </p>
                </div>
              )}
              {resetResults.failed.length > 0 && (
                <div>
                  <h4 className="font-medium text-red-800 mb-2">❌ Falhas ({resetResults.failed.length})</h4>
                  <div className="space-y-2">
                    {resetResults.errors.map((error, index) => (
                      <div key={index} className="flex items-center justify-between p-2 bg-red-50 border border-red-200 rounded">
                        <span className="text-red-800 font-medium">{error.user}</span>
                        <Badge variant="outline" className="bg-red-100 border-red-300 text-red-700 text-xs">
                          {error.error}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Configuração de Senha Padrão */}
        <Card className="mb-6 shadow-sm border-0 bg-white/70 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-700">
              <KeyIcon className="w-5 h-5" />
              Configuração de Senha Padrão
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Senhas Padrão */}
              <div>
                <Label className="text-sm font-medium text-gray-700 mb-2 block">Senhas Padrão Sugeridas</Label>
                <div className="space-y-2">
                  {defaultPasswords.map(password => (
                    <div key={password} className="flex items-center space-x-2">
                      <Checkbox
                        id={password}
                        checked={defaultPassword === password}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setDefaultPassword(password);
                            setCustomPassword('');
                          } else {
                            setDefaultPassword('');
                          }
                        }}
                      />
                      <label
                        htmlFor={password}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                      >
                        {password}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Senha Customizada */}
              <div className="space-y-4">
                <div>
                  <Label className="text-sm font-medium text-gray-700">Senha Customizada</Label>
                  <div className="space-y-3 mt-1">
                    <div className="relative">
                      <Input
                        type={showPassword ? "text" : "password"}
                        placeholder="Digite uma senha personalizada..."
                        value={customPassword}
                        onChange={(e) => {
                          setCustomPassword(e.target.value);
                          if (e.target.value) setDefaultPassword('');
                        }}
                        className="pr-10"
                      />
                      <button
                        type="button"
                        className="absolute inset-y-0 right-0 pr-3 flex items-center"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? (
                          <EyeSlashIcon className="h-4 w-4 text-gray-400" />
                        ) : (
                          <EyeIcon className="h-4 w-4 text-gray-400" />
                        )}
                      </button>
                    </div>

                    {/* Gerador de Senhas */}
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setShowGenerator(!showGenerator)}
                        className="text-blue-600 border-blue-200 hover:bg-blue-50"
                      >
                        <svg className="h-4 w-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                        </svg>
                        {showGenerator ? 'Fechar Gerador' : 'Gerar Senhas'}
                      </Button>

                      {customPassword && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500">Força:</span>
                          {(() => {
                            const strength = evaluatePasswordStrength(customPassword);
                            const colors = {
                              muito_fraca: 'text-red-600 bg-red-100',
                              fraca: 'text-orange-600 bg-orange-100',
                              media: 'text-yellow-600 bg-yellow-100',
                              forte: 'text-green-600 bg-green-100',
                              muito_forte: 'text-emerald-600 bg-emerald-100'
                            };
                            return (
                              <Badge variant="outline" className={colors[strength.level]}>
                                {strength.level.replace('_', ' ').toUpperCase()}
                              </Badge>
                            );
                          })()}
                        </div>
                      )}
                    </div>

                    {/* Interface do Gerador */}
                    {showGenerator && (
                      <Card className="border-blue-200 bg-blue-50">
                        <CardContent className="p-4">
                          <div className="space-y-3">
                            <div className="flex items-center gap-2 mb-3">
                              <svg className="h-4 w-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                              </svg>
                              <h4 className="text-sm font-semibold text-blue-800">Gerador de Senhas Seguras</h4>
                            </div>

                            {/* Presets */}
                            <div className="grid grid-cols-2 gap-2">
                              {Object.entries(PRESET_PASSWORDS).map(([key, preset]) => (
                                <Button
                                  key={key}
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setSelectedPreset(key);
                                    handleGeneratePasswords(key);
                                  }}
                                  className={`text-xs h-auto py-2 px-3 ${selectedPreset === key ? 'bg-blue-100 border-blue-300' : ''}`}
                                >
                                  <div className="text-center">
                                    <div className="font-medium">{preset.name}</div>
                                    <div className="text-xs text-gray-500 mt-1">{preset.description}</div>
                                  </div>
                                </Button>
                              ))}
                            </div>

                            {/* Senhas Geradas */}
                            {generatedPasswords.length > 0 && (
                              <div className="space-y-2">
                                <Label className="text-xs font-medium text-blue-700">Senhas Geradas (clique para selecionar):</Label>
                                <div className="space-y-1">
                                  {generatedPasswords.map((password, index) => {
                                    const strength = evaluatePasswordStrength(password);
                                    return (
                                      <button
                                        key={index}
                                        type="button"
                                        onClick={() => handleSelectGeneratedPassword(password)}
                                        className="w-full text-left p-2 bg-white border border-gray-200 rounded hover:bg-gray-50 transition-colors"
                                      >
                                        <div className="flex items-center justify-between">
                                          <code className="text-sm font-mono">{password}</code>
                                          <Badge variant="outline" className="text-xs">
                                            {strength.level.replace('_', ' ')}
                                          </Badge>
                                        </div>
                                      </button>
                                    );
                                  })}
                                </div>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleGeneratePasswords(selectedPreset)}
                                  className="w-full text-blue-600"
                                >
                                  Gerar Novas Senhas
                                </Button>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                </div>

                <div>
                  <Label className="text-sm font-medium text-gray-700">Motivo do Reset</Label>
                  <Textarea
                    placeholder="Descreva o motivo para o reset das senhas..."
                    value={resetReason}
                    onChange={(e) => setResetReason(e.target.value)}
                    rows={3}
                  />
                </div>
              </div>
            </div>

            {/* Preview da senha selecionada */}
            {(defaultPassword || customPassword) && (
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-center gap-2">
                  <KeyIcon className="w-4 h-4 text-yellow-600" />
                  <span className="text-sm font-medium text-yellow-800">
                    Senha selecionada: <code className="bg-yellow-100 px-2 py-1 rounded text-yellow-900">{customPassword || defaultPassword}</code>
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Search and Filters */}
        <Card className="mb-6 shadow-sm border-0 bg-white/70 backdrop-blur-sm">
          <CardContent className="p-6">
            <div className="space-y-4">
              {/* Search Bar */}
              <div className="relative">
                <Input
                  type="text"
                  placeholder="🔍 Buscar usuários por nome, email, departamento..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-12 pr-12 h-12 text-base border-2 border-gray-200 focus:border-blue-500 rounded-xl shadow-sm"
                />
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
                </div>
                {isSearching && (
                  <div className="absolute inset-y-0 right-0 pr-4 flex items-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                  </div>
                )}
              </div>

              {/* Filters */}
              <div className="flex flex-wrap gap-3">
                <Select value={accessLevelFilter || "all"} onValueChange={(value) => setAccessLevelFilter(value === "all" ? "" : value)}>
                  <SelectTrigger className="w-[180px] h-10">
                    <SelectValue placeholder="Todos os Níveis" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os Níveis</SelectItem>
                    {accessLevels.map((level) => (
                      <SelectItem key={level.id} value={level.id}>{level.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={operacaoFilter || "all"} onValueChange={(value) => setOperacaoFilter(value === "all" ? "" : value)}>
                  <SelectTrigger className="w-[180px] h-10">
                    <SelectValue placeholder="Todas as Operações" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as Operações</SelectItem>
                    {operacoes.map((operacao) => (
                      <SelectItem key={operacao.id} value={operacao.id}>{operacao.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={statusFilter || "all"} onValueChange={(value) => setStatusFilter(value === "all" ? "" : value)}>
                  <SelectTrigger className="w-[150px] h-10">
                    <SelectValue placeholder="Todos os Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os Status</SelectItem>
                    <SelectItem value="ativo">Ativo</SelectItem>
                    <SelectItem value="pendente">Pendente</SelectItem>
                    <SelectItem value="inativo">Inativo</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Controles de Seleção e Ação */}
              <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                <div className="flex items-center gap-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="select-all"
                      checked={eligibleUsersForSelection.length > 0 && eligibleUsersForSelection.every(user => selectedUsers.includes(user.id))}
                      onCheckedChange={handleSelectAll}
                    />
                    <label htmlFor="select-all" className="text-sm font-medium">
                      Selecionar todos os filtrados ({eligibleUsersForSelection.length})
                    </label>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {selectedUsers.length > 0 && (
                    <Badge variant="secondary" className="bg-blue-50 text-blue-700">
                      {selectedUsers.length} selecionados
                    </Badge>
                  )}
                  <Button
                    onClick={handleBulkPasswordReset}
                    disabled={selectedUsers.length === 0 || (!defaultPassword && !customPassword) || isProcessing}
                    className="bg-orange-600 hover:bg-orange-700 text-white"
                  >
                    {isProcessing ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Processando... ({progress.processed}/{progress.total})
                      </>
                    ) : (
                      <>
                        <KeyIcon className="h-4 w-4 mr-2" />
                        Resetar Senhas ({selectedUsers.length})
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Lista de Usuários */}
        {loading ? (
          <Card>
            <CardContent className="p-8">
              <div className="flex flex-col items-center justify-center space-y-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <p className="text-gray-600 font-medium">Carregando usuários...</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <div className="divide-y divide-gray-200">
                {filteredUsers.map((user) => {
                  const isEligible = user.auth_usuario_id; // Apenas precisa ter auth_usuario_id para resetar senha
                  const isSelected = selectedUsers.includes(user.id);
                  
                  return (
                    <div key={user.id} className={`p-4 hover:bg-gray-50 transition-colors ${!isEligible ? 'opacity-50' : ''}`}>
                      <div className="flex items-center gap-4">
                        {/* Checkbox */}
                        <div className="flex-shrink-0">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={(checked) => handleSelectUser(user.id, checked as boolean)}
                            disabled={!isEligible}
                          />
                        </div>

                        {/* Avatar */}
                        <div className="flex-shrink-0">
                          <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
                            <span className="text-white font-bold text-sm">
                              {user.nome.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                            </span>
                          </div>
                        </div>

                        {/* Informações do Usuário */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <div>
                              <h3 className="text-lg font-semibold text-gray-900">{user.nome}</h3>
                              <p className="text-sm text-gray-600">{user.email}</p>
                              <div className="flex items-center gap-3 text-sm text-gray-500 mt-1">
                                <span>{user.departamento}</span>
                                <span>•</span>
                                <span>{user.posicao}</span>
                                {user.matricula && (
                                  <>
                                    <span>•</span>
                                    <Badge variant="outline" className="text-xs">
                                      Mat: {user.matricula}
                                    </Badge>
                                  </>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <Badge
                                variant={
                                  user.status === 'ativo' ? 'default' :
                                    user.status === 'inativo' ? 'destructive' : 
                                    user.status === 'suspenso' ? 'secondary' : 'secondary'
                                }
                              >
                                {user.status === 'ativo' ? '✓ Ativo' :
                                  user.status === 'inativo' ? '✗ Inativo' : 
                                  user.status === 'suspenso' ? '⏸️ Suspenso' : '⏳ Pendente'}
                              </Badge>
                              
                              {!user.auth_usuario_id && (
                                <Badge variant="outline" className="text-yellow-600 border-yellow-300">
                                  Sem Auth ID
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Controles de Paginação */}
        {!loading && totalPages > 1 && (
          <Card className="mt-6">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <span>
                    Mostrando {((currentPage - 1) * pageSize) + 1} a {Math.min(currentPage * pageSize, totalUsers)} de {totalUsers} usuários
                  </span>
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

                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum;
                      if (totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (currentPage <= 3) {
                        pageNum = i + 1;
                      } else if (currentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + i;
                      } else {
                        pageNum = currentPage - 2 + i;
                      }

                      return (
                        <Button
                          key={pageNum}
                          variant={currentPage === pageNum ? "default" : "outline"}
                          size="sm"
                          onClick={() => setCurrentPage(pageNum)}
                          className="h-8 w-8 p-0"
                        >
                          {pageNum}
                        </Button>
                      );
                    })}
                  </div>

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
            </CardContent>
          </Card>
        )}
      </div>
    </div>
    </ProtectedRoute>
  );
}
