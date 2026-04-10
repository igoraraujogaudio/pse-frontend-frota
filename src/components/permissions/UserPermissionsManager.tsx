'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { 
  MagnifyingGlassIcon, 
  UserIcon, 
  PencilIcon,
  ShieldCheckIcon,
  LockClosedIcon,
  PlusIcon,
  KeyIcon
} from '@heroicons/react/24/outline';
import type { FuncionalidadeModular, UsuarioPermissaoModular, ModuloSistema, PerfilAcesso } from '@/types/permissions';
import type { User } from '@/types';
import { modularPermissionService } from '@/services/modularPermissionService';
import { userService } from '@/services/userService';
import { baseService } from '@/services/baseService';
import { useAuth } from '@/contexts/AuthContext';
import { useCreateFuncionario } from '@/hooks/useFuncionarios';
import { useUpdateFuncionario } from '@/hooks/useFuncionarios';
import { validarCPF, formatarCPF } from '@/utils/cpfUtils';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';

interface Props {
  usuarios: User[];
  funcionalidadesModulares: FuncionalidadeModular[];
  contratos: { id: string; nome: string; codigo: string }[];
  modulosSistema?: ModuloSistema[];
  onUserUpdate?: () => Promise<void>;
}

interface CreateFuncionarioForm {
  nome: string;
  email: string;
  matricula: string;
  cpf: string;
  telefone: string;
  cargo: string;
  operacao: string;
  senha: string;
  perfil_acesso_id: string;
  contrato_id: string;
  base_id: string;
}

export default function ModularUserPermissionsManager({ 
  usuarios, 
  funcionalidadesModulares, 
  contratos = [],
  modulosSistema = [],
  onUserUpdate = async () => {}
}: Props) {
  const { user: currentUser } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedNivel, setSelectedNivel] = useState<string>('all');
  // const [selectedContrato, setSelectedContrato] = useState<string>('all');
  const [selectedCargo, setSelectedCargo] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [userPermissions, setUserPermissions] = useState<UsuarioPermissaoModular[]>([]);
  const [loading, setLoading] = useState(false);
  const [permissionLoading, setPermissionLoading] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditingLevel, setIsEditingLevel] = useState(false);
  const [newLevel, setNewLevel] = useState<string>('');
  
  // Estados para perfis de acesso da base de dados
  const [perfisAcesso, setPerfisAcesso] = useState<PerfilAcesso[]>([]);
  const [loadingPerfis, setLoadingPerfis] = useState(true);
  
  // Estados para criação de funcionário
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [createForm, setCreateForm] = useState<CreateFuncionarioForm>({
    nome: '',
    email: '',
    matricula: '',
    cpf: '',
    telefone: '',
    cargo: '',
    operacao: '',
    senha: '',
    perfil_acesso_id: '',
    contrato_id: '',
    base_id: ''
  });
  const [bases, setBases] = useState<{ id: string; nome: string; contrato_id: string }[]>([]);
  const [cargos, setCargos] = useState<{ id: string; nome: string; perfil_acesso_id?: string }[]>([]);
  const [loadingCreate, setLoadingCreate] = useState(false);
  const [cpfError, setCpfError] = useState('');
  
  const createFuncionarioMutation = useCreateFuncionario();
  const updateFuncionarioMutation = useUpdateFuncionario();
  
  // Estados para edição de funcionário
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editForm, setEditForm] = useState<CreateFuncionarioForm>({
    nome: '',
    email: '',
    matricula: '',
    cpf: '',
    telefone: '',
    cargo: '',
    operacao: '',
    senha: '',
    perfil_acesso_id: '',
    contrato_id: '',
    base_id: ''
  });
  const [editingUserId, setEditingUserId] = useState<string>('');
  
  // Estados para reset de senha
  const [isResetPasswordDialogOpen, setIsResetPasswordDialogOpen] = useState(false);
  const [resetPasswordUserId, setResetPasswordUserId] = useState<string>('');
  const [resetPasswordUserName, setResetPasswordUserName] = useState<string>('');
  const [resetPasswordDefault, setResetPasswordDefault] = useState('PSE2025');
  const [resetPasswordCustom, setResetPasswordCustom] = useState('');
  const [resetPasswordReason, setResetPasswordReason] = useState('');
  const [resetPasswordLoading, setResetPasswordLoading] = useState(false);
  const [resetPasswordReativar, setResetPasswordReativar] = useState(false);
  const [resetPasswordTrocaObrigatoria, setResetPasswordTrocaObrigatoria] = useState(true);
  
  // Carregar perfis de acesso da base de dados
  useEffect(() => {
    const loadPerfisAcesso = async () => {
      try {
        setLoadingPerfis(true);
        const perfis = await modularPermissionService.getPerfisAcesso();
        setPerfisAcesso(perfis);
        console.log('✅ Perfis de acesso carregados:', perfis.length);
      } catch (error) {
        console.error('❌ Erro ao carregar perfis de acesso:', error);
      } finally {
        setLoadingPerfis(false);
      }
    };

    loadPerfisAcesso();
  }, []);

  // Carregar dados do usuário quando abrir modal de edição
  useEffect(() => {
    if (isEditDialogOpen && editingUserId) {
      const loadUserData = async () => {
        const userToEdit = usuarios.find(u => u.id === editingUserId);
        if (userToEdit) {
          // Buscar contrato e base do usuário
          let contratoId = '';
          let baseId = '';
          let perfilAcessoId = '';
          
          try {
            // Buscar contrato do usuário (pegar o primeiro ativo)
            const { data: usuarioContratos, error: errorContrato } = await supabase
              .from('usuario_contratos')
              .select('contrato_id')
              .eq('usuario_id', editingUserId)
              .eq('ativo', true)
              .order('data_inicio', { ascending: false })
              .limit(1);
            
            if (!errorContrato && usuarioContratos && usuarioContratos.length > 0) {
              contratoId = usuarioContratos[0].contrato_id;
            }
            
            // Buscar base do usuário (pegar a primeira ativa)
            const { data: usuarioBases, error: errorBase } = await supabase
              .from('usuario_bases')
              .select('base_id')
              .eq('usuario_id', editingUserId)
              .eq('ativo', true)
              .order('data_inicio', { ascending: false })
              .limit(1);
            
            if (!errorBase && usuarioBases && usuarioBases.length > 0) {
              baseId = usuarioBases[0].base_id;
            }
            
            // Buscar perfil de acesso pelo código do nível de acesso
            if (userToEdit.nivel_acesso) {
              const perfil = perfisAcesso.find(p => p.codigo === userToEdit.nivel_acesso);
              if (perfil) {
                perfilAcessoId = perfil.id;
              }
            }
          } catch (error) {
            console.error('Erro ao carregar dados do usuário:', error);
          }
          
          setEditForm({
            nome: userToEdit.nome || '',
            email: userToEdit.email || '',
            matricula: userToEdit.matricula || '',
            cpf: userToEdit.cpf || '',
            telefone: userToEdit.telefone || '',
            cargo: userToEdit.cargo || '',
            operacao: userToEdit.operacao || '',
            senha: '',
            perfil_acesso_id: perfilAcessoId,
            contrato_id: contratoId,
            base_id: baseId
          });
        }
      };
      
      loadUserData();
    }
  }, [isEditDialogOpen, editingUserId, usuarios, perfisAcesso]);

  // Carregar bases e cargos quando o modal abrir
  useEffect(() => {
    if (isCreateDialogOpen || isEditDialogOpen) {
      const loadData = async () => {
        try {
          const [basesData, cargosResponse] = await Promise.all([
            baseService.getBases(),
            fetch('/api/cargos').then(res => res.json()).catch(() => ({ cargos: [] }))
          ]);
          
          setBases(basesData.filter((b: { contrato_id?: string }) => b.contrato_id !== undefined) as { id: string; nome: string; contrato_id: string }[]);
          setCargos(cargosResponse.cargos || []);
        } catch (error) {
          console.error('❌ Erro ao carregar dados:', error);
        }
      };
      
      loadData();
    }
  }, [isCreateDialogOpen, isEditDialogOpen]);

  // Filtrar usuários
  const filteredUsers = useMemo(() => {
    return usuarios.filter(user => {
      const matchesSearch = !searchTerm || 
        user.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (user.cargo && user.cargo.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (user.matricula && user.matricula.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const matchesNivel = selectedNivel === 'all' || user.nivel_acesso === selectedNivel;
      const matchesCargo = selectedCargo === 'all' || (user.cargo && user.cargo === selectedCargo);
      const matchesStatus = selectedStatus === 'all' || user.status === selectedStatus;
      
      return matchesSearch && matchesNivel && matchesCargo && matchesStatus;
    });
  }, [usuarios, searchTerm, selectedNivel, selectedCargo, selectedStatus]);

  // Obter cargos únicos dos usuários
  const cargosUnicos = useMemo(() => {
    const cargos = usuarios
      .map(user => user.cargo)
      .filter(cargo => cargo && cargo.trim() !== '')
      .filter((cargo, index, array) => array.indexOf(cargo) === index)
      .sort();
    
    return cargos;
  }, [usuarios]);

  // Função para obter nome do módulo
  const getModuloNome = useCallback((moduloId: string): string => {
    const modulo = modulosSistema.find(m => m.id === moduloId);
    return modulo?.nome || moduloId;
  }, [modulosSistema]);

  // Agrupar funcionalidades por módulo
  const funcionalidadesPorModulo = useMemo(() => {
    if (!funcionalidadesModulares || funcionalidadesModulares.length === 0) {
      console.log('⚠️ Nenhuma funcionalidade modular encontrada');
      return {};
    }
    
    console.log('🔍 Processando funcionalidades modulares:', funcionalidadesModulares.length);
    console.log('🔍 Módulos disponíveis:', modulosSistema.length);
    
    return funcionalidadesModulares.reduce((acc, func) => {
      // Verificar se a funcionalidade é válida
      if (!func || !func.id || !func.nome) {
        console.warn('⚠️ Funcionalidade inválida encontrada:', func);
        return acc;
      }
      
      const moduloNome = getModuloNome(func.modulo_id);
      if (!acc[moduloNome]) {
        acc[moduloNome] = [];
      }
      acc[moduloNome].push(func);
      return acc;
    }, {} as Record<string, FuncionalidadeModular[]>);
  }, [funcionalidadesModulares, modulosSistema, getModuloNome]);

  const loadUserPermissions = async (userId: string) => {
    setLoading(true);
    try {
      console.log('Carregando permissões modulares para usuário:', userId);
      const permissions = await modularPermissionService.getUserPermissionsModulares(userId);
      console.log('Permissões modulares carregadas:', permissions);
      setUserPermissions(permissions);
    } catch (error) {
      console.error('Erro ao carregar permissões modulares:', error);
      setUserPermissions([]);
    } finally {
      setLoading(false);
    }
  };

  const handleUserSelect = async (user: User) => {
    setSelectedUser(user);
    setNewLevel(user.nivel_acesso);
    await loadUserPermissions(user.id);
    setIsDialogOpen(true);
  };

  const handlePermissionToggle = async (funcionalidadeId: string, granted: boolean) => {
    if (!selectedUser) {
      console.error('Nenhum usuário selecionado');
      return;
    }

    setPermissionLoading(true);
    try {
      if (granted) {
        await modularPermissionService.grantUserPermissionModular({
          usuario_id: selectedUser.id,
          funcionalidade_id: funcionalidadeId,
          concedido: true,
          tipo_permissao: 'adicional',
          motivo: 'Concedido via interface administrativa',
          ativo: true,
          temporaria: false,
          data_inicio: new Date().toISOString(),
          concedido_por: currentUser?.id
        });
      } else {
        await modularPermissionService.revokeUserPermissionModular(selectedUser.id, funcionalidadeId);
      }

      // Atualizar estado local
      setUserPermissions(prevPermissions => {
        const existingIndex = prevPermissions.findIndex(p => p.funcionalidade_id === funcionalidadeId);
        
        if (granted) {
          if (existingIndex >= 0) {
            const updated = [...prevPermissions];
            updated[existingIndex] = {
              ...updated[existingIndex],
              concedido: true,
              ativo: true,
              tipo_permissao: 'adicional',
              data_inicio: new Date().toISOString(),
              concedido_por: currentUser?.id
            };
            return updated;
          } else {
            return [...prevPermissions, {
              id: `temp-${Date.now()}`,
              usuario_id: selectedUser.id,
              funcionalidade_id: funcionalidadeId,
              concedido: true,
              ativo: true,
              tipo_permissao: 'adicional',
              motivo: 'Concedido via interface administrativa',
              temporaria: false,
              data_inicio: new Date().toISOString(),
              concedido_por: currentUser?.id,
              criado_em: new Date().toISOString(),
              atualizado_em: new Date().toISOString()
            }];
          }
        } else {
          if (existingIndex >= 0) {
            return prevPermissions.filter((_, index) => index !== existingIndex);
          }
          return prevPermissions;
        }
      });
      
      console.log('Permissão alterada com sucesso - estado atualizado localmente');
      
      // Atualizar indicador de permissões personalizadas sem recarregar a página
      if (!selectedUser.permissoes_personalizadas) {
        selectedUser.permissoes_personalizadas = true;
      }
      
      // NÃO RECARREGAR A PÁGINA TODA - só atualizar localmente
      // onUserUpdate(); // REMOVIDO para não recarregar
    } catch (error) {
      console.error('Erro ao alterar permissão modular:', error);
      console.error('Detalhes do erro:', {
        message: error instanceof Error ? error.message : 'Erro desconhecido',
        stack: error instanceof Error ? error.stack : undefined,
        userId: selectedUser?.id,
        funcionalidadeId: funcionalidadeId,
        granted: granted
      });
      alert(`Erro ao alterar permissão: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    } finally {
      setPermissionLoading(false);
    }
  };

  // Estado para cache de permissões da matriz
  const [, setMatrixPermissions] = useState<Record<string, boolean>>({});

  const loadMatrixPermissions = useCallback(async () => {
    // Não existe mais conceito de "matriz" ou "inerente"
    // Permissões são APENAS as que existem na tabela usuario_permissoes_modulares
    setMatrixPermissions({});
  }, []);

  // Carregar permissões da matriz quando usuário muda
  useEffect(() => {
    if (selectedUser) {
      loadMatrixPermissions();
    }
  }, [selectedUser, loadMatrixPermissions]);

  const hasPermission = (funcionalidadeId: string): boolean => {
    if (!selectedUser) return false;
    
    // Admin e diretor têm acesso total
    if (['admin', 'diretor'].includes(selectedUser.nivel_acesso)) {
      return true;
    }
    
    // Verificar se há permissão explícita na tabela
    // Sem registro = sem acesso
    const permission = userPermissions.find(p => 
      p.funcionalidade_id === funcionalidadeId
    );
    
    return permission ? (permission.concedido && permission.ativo) : false;
  };

  // Função para verificar se o usuário atual pode alterar níveis de acesso
  const canChangeAccessLevel = (): boolean => {
    if (!currentUser) return false;
    
    // Apenas administradores e diretores podem alterar níveis de acesso
    return ['admin', 'diretor'].includes(currentUser.nivel_acesso);
  };

  // Função para verificar se pode alterar o nível de acesso de um usuário específico
  const canChangeUserAccessLevel = (targetUser: User): boolean => {
    if (!currentUser || !canChangeAccessLevel()) return false;
    
    // Administradores podem alterar qualquer usuário
    if (currentUser.nivel_acesso === 'admin') return true;
    
    // Diretores não podem alterar outros diretores ou administradores
    if (currentUser.nivel_acesso === 'diretor') {
      return !['admin', 'diretor'].includes(targetUser.nivel_acesso);
    }
    
    return false;
  };

  // Função para alterar nível de acesso
  const handleLevelChange = async () => {
    if (!selectedUser || !newLevel || newLevel === selectedUser.nivel_acesso) {
      return;
    }

    // Verificar permissões
    if (!canChangeUserAccessLevel(selectedUser)) {
      alert('Você não tem permissão para alterar o nível de acesso deste usuário.');
      return;
    }

    // Confirmação de alteração
    const confirmMessage = `Tem certeza que deseja alterar o nível de acesso de ${selectedUser.nome} de "${selectedUser.nivel_acesso}" para "${newLevel}"?\n\nAs permissões padrão do novo perfil serão aplicadas automaticamente.`;
    
    if (!confirm(confirmMessage)) {
      return;
    }

    setLoading(true);
    try {
      console.log('Alterando nível de acesso:', { 
        userId: selectedUser.id, 
        oldLevel: selectedUser.nivel_acesso, 
        newLevel,
        changedBy: currentUser?.id
      });
      
      // Buscar o perfil correspondente ao novo nível
      const novoPerfil = perfisAcesso.find(p => p.codigo === newLevel);
      
      if (!novoPerfil) {
        toast.error('Perfil não encontrado');
        return;
      }
      
      // Atualizar o usuário no banco de dados - AMBOS os campos
      await userService.update(selectedUser.id, {
        perfil_acesso_id: novoPerfil.id,
        nivel_acesso: newLevel
      });

      // Atualizar o usuário localmente
      selectedUser.nivel_acesso = newLevel;
      selectedUser.perfil_acesso_id = novoPerfil.id;
      
      if (novoPerfil) {
        console.log('Aplicando permissões padrão do novo perfil:', novoPerfil.nome);
        
        try {
          // Aplicar permissões padrão do novo perfil automaticamente
          await modularPermissionService.applyProfileDefaultPermissions(
            selectedUser.id,
            novoPerfil.id,
            currentUser?.id || null,
            'mudanca_perfil_admin'
          );
          
          console.log('✅ Permissões padrão aplicadas automaticamente');
          
          // Recarregar permissões do usuário
          await loadUserPermissions(selectedUser.id);
        } catch (permError) {
          console.warn('⚠️ Erro ao aplicar permissões padrão:', permError);
          // Não falha a operação principal
        }
      }
      
      // Recarregar permissões da matriz para o novo nível
      await loadMatrixPermissions();
      
      console.log('Nível de acesso alterado com sucesso');
      setIsEditingLevel(false);
      
      // Mostrar mensagem de sucesso
      toast.success(
        `Nível de acesso alterado com sucesso!`,
        {
          description: `${selectedUser.nome} agora tem o perfil: ${nivelAcessoOptions.find(opt => opt.value === newLevel)?.label || newLevel}. As permissões padrão foram aplicadas automaticamente.`
        }
      );
      
    } catch (error) {
      console.error('Erro ao alterar nível de acesso:', error);
      toast.error(
        'Erro ao alterar nível de acesso',
        {
          description: error instanceof Error ? error.message : 'Erro desconhecido'
        }
      );
    } finally {
      setLoading(false);
    }
  };

  // Usar perfis de acesso da base de dados
  const nivelAcessoOptions = perfisAcesso.map(perfil => ({
    value: perfil.codigo,
    label: perfil.nome,
    description: perfil.descricao || ''
  }));

  const getPermissionBadge = (user: User) => {
    const customCount = user.permissoes_personalizadas ? 
      userPermissions?.filter(p => p.ativo && p.concedido).length || 0 : 0;
    
    if (customCount > 0) {
      return (
        <Badge variant="secondary" className="ml-2">
          +{customCount} personalizadas
        </Badge>
      );
    }
    
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <UserIcon className="h-6 w-6" />
            Gerenciar Permissões Modulares de Usuários
          </h2>
          <p className="text-gray-600 mt-1">
            Configure permissões específicas para cada usuário no sistema modular
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-2xl font-bold text-blue-600">{filteredUsers.length}</div>
            <div className="text-sm text-gray-500">usuários encontrados</div>
          </div>
          <Button 
            onClick={() => setIsCreateDialogOpen(true)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-lg"
          >
            <PlusIcon className="h-4 w-4" />
            Novo Funcionário
          </Button>
        </div>
      </div>

      {/* Filtros Modernos */}
      <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-xl">
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Busca */}
            <div className="lg:col-span-2">
              <label className="text-sm font-semibold text-gray-700 mb-2 block">
                Buscar Usuário
              </label>
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Nome, email, cargo ou matrícula..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 border-gray-200 focus:border-blue-500 focus:ring-blue-500 rounded-xl"
                />
              </div>
            </div>

            {/* Nível de Acesso */}
            <div>
              <label className="text-sm font-semibold text-gray-700 mb-2 block">
                Nível de Acesso
              </label>
              <Select value={selectedNivel} onValueChange={setSelectedNivel}>
                <SelectTrigger className="border-gray-200 focus:border-blue-500 focus:ring-blue-500 rounded-xl">
                  <SelectValue placeholder="Todos os níveis" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os níveis</SelectItem>
                  {loadingPerfis ? (
                    <SelectItem value="loading" disabled>Carregando perfis...</SelectItem>
                  ) : (
                    perfisAcesso.map(perfil => (
                      <SelectItem key={perfil.id} value={perfil.codigo}>
                        {perfil.nome} ({perfil.codigo})
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Cargo */}
            <div>
              <label className="text-sm font-semibold text-gray-700 mb-2 block">
                Cargo
              </label>
              <Select value={selectedCargo} onValueChange={setSelectedCargo}>
                <SelectTrigger className="border-gray-200 focus:border-blue-500 focus:ring-blue-500 rounded-xl">
                  <SelectValue placeholder="Todos os cargos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os cargos</SelectItem>
                  {cargosUnicos.map(cargo => (
                    <SelectItem key={cargo} value={cargo || ''}>
                      {cargo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Status */}
            <div>
              <label className="text-sm font-semibold text-gray-700 mb-2 block">
                Status
              </label>
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger className="border-gray-200 focus:border-blue-500 focus:ring-blue-500 rounded-xl">
                  <SelectValue placeholder="Todos os status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os status</SelectItem>
                  <SelectItem value="ativo">Ativo</SelectItem>
                  <SelectItem value="inativo">Inativo</SelectItem>
                  <SelectItem value="pendente">Pendente</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Usuários */}
      <div className="grid gap-6">
        {filteredUsers.map((user, index) => (
          <Card 
            key={`user-${user.id}-${index}`}
            className="group hover:shadow-xl transition-all duration-300 cursor-pointer border-0 bg-gradient-to-r from-white to-gray-50/50"
            onClick={() => handleUserSelect(user)}
          >
            <CardContent className="p-6">
              <div className="flex justify-between items-start">
                <div className="space-y-4 flex-1">
                  {/* Header do Usuário */}
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-gradient-to-br from-blue-500 via-purple-600 to-indigo-600 rounded-2xl flex items-center justify-center text-white font-bold text-xl shadow-lg group-hover:shadow-xl transition-all duration-300">
                      {user.nome.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <h3 className="text-xl font-bold text-gray-900 group-hover:text-blue-600 transition-colors duration-200">
                        {user.nome}
                      </h3>
                      <p className="text-gray-600 font-medium">{user.email}</p>
                      {user.matricula && (
                        <p className="text-sm text-gray-500">Matrícula: {user.matricula}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      {getPermissionBadge(user)}
                      {user.permissoes_personalizadas && (
                        <ShieldCheckIcon className="h-5 w-5 text-blue-500" />
                      )}
                    </div>
                  </div>

                  {/* Informações do Usuário */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Nível de Acesso</p>
                      <Badge variant="outline" className="mt-1">
                        {nivelAcessoOptions.find(opt => opt.value === user.nivel_acesso)?.label || user.nivel_acesso}
                      </Badge>
                    </div>
                    
                    {user.cargo && (
                      <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Cargo</p>
                        <p className="text-sm font-medium text-gray-900 mt-1">{user.cargo}</p>
                      </div>
                    )}
                    
                    {user.departamento && (
                      <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Departamento</p>
                        <Badge variant="secondary" className="mt-1">{user.departamento}</Badge>
                      </div>
                    )}
                    
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</p>
                      <Badge 
                        variant={user.status === 'ativo' ? 'default' : 'secondary'} 
                        className={`mt-1 ${
                          user.status === 'ativo' 
                            ? 'bg-green-100 text-green-800 hover:bg-green-200' 
                            : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                        }`}
                      >
                        {user.status}
                      </Badge>
                    </div>
                  </div>

                  {/* Ações */}
                  <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <PencilIcon className="h-4 w-4" />
                      <span>Clique para gerenciar permissões</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button 
                        variant="ghost" 
                        size="sm"
                        className="opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                        onClick={(e) => {
                          e.stopPropagation();
                          const userToEdit = usuarios.find(u => u.id === user.id);
                          if (userToEdit) {
                            setEditingUserId(userToEdit.id);
                            // Não resetar o formulário aqui - o useEffect vai carregar os dados corretos
                            setIsEditDialogOpen(true);
                          }
                        }}
                        title="Editar funcionário"
                      >
                        <PencilIcon className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        className="opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                        onClick={(e) => {
                          e.stopPropagation();
                          setResetPasswordUserId(user.id);
                          setResetPasswordUserName(user.nome);
                          setResetPasswordDefault('PSE2025');
                          setResetPasswordCustom('');
                          setResetPasswordReason('');
                          setResetPasswordReativar(user.status === 'demitido');
                          setResetPasswordTrocaObrigatoria(true);
                          setIsResetPasswordDialogOpen(true);
                        }}
                        title="Resetar senha"
                      >
                        <KeyIcon className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Mensagem quando não há usuários */}
      {filteredUsers.length === 0 && (
        <Card className="text-center py-12">
          <CardContent>
            <UserIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Nenhum usuário encontrado</h3>
            <p className="text-gray-600">
              Tente ajustar os filtros de busca para encontrar usuários.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Dialog de Edição de Permissões */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheckIcon className="h-5 w-5" />
              Permissões de {selectedUser?.nome}
            </DialogTitle>
            <DialogDescription>
              Configure permissões específicas para este usuário. 
              Nível atual: <Badge variant="outline">{selectedUser?.nivel_acesso}</Badge>
            </DialogDescription>
          </DialogHeader>

          {/* Seção de Alteração de Nível de Acesso */}
          <div className="px-6 pb-4">
            <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <LockClosedIcon className="h-5 w-5 text-blue-600" />
                    <div>
                      <h3 className="font-semibold text-gray-900">Nível de Acesso</h3>
                      <p className="text-sm text-gray-600">
                        Alterar o nível de acesso do usuário
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {!isEditingLevel ? (
                      <>
                        <Badge variant="outline" className="text-sm">
                          {nivelAcessoOptions.find(opt => opt.value === selectedUser?.nivel_acesso)?.label || selectedUser?.nivel_acesso}
                        </Badge>
                        {selectedUser && canChangeUserAccessLevel(selectedUser) ? (
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => setIsEditingLevel(true)}
                            disabled={loading}
                            title="Alterar nível de acesso"
                          >
                            <PencilIcon className="h-4 w-4 mr-1" />
                            Alterar
                          </Button>
                        ) : (
                          <div className="flex items-center gap-1 text-xs text-gray-500">
                            <ShieldCheckIcon className="h-3 w-3" />
                            <span>Sem permissão</span>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Select value={newLevel} onValueChange={setNewLevel}>
                          <SelectTrigger className="w-48">
                            <SelectValue placeholder="Selecione o nível" />
                          </SelectTrigger>
                          <SelectContent>
                            {nivelAcessoOptions.map(option => (
                              <SelectItem key={option.value} value={option.value}>
                                <div>
                                  <div className="font-medium">{option.label}</div>
                                  <div className="text-xs text-gray-500">{option.description}</div>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button 
                          variant="default" 
                          size="sm"
                          onClick={handleLevelChange}
                          disabled={loading || newLevel === selectedUser?.nivel_acesso}
                        >
                          {loading ? 'Salvando...' : 'Salvar'}
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => {
                            setIsEditingLevel(false);
                            setNewLevel(selectedUser?.nivel_acesso || '');
                          }}
                          disabled={loading}
                        >
                          Cancelar
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Legenda visual */}
          <div className="px-6 pb-4">
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-gray-700 mb-3">Legenda de Permissões</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-green-100 border border-green-300 rounded flex items-center justify-center">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  </div>
                  <span className="text-gray-700">Com acesso</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-gray-100 border border-gray-300 rounded flex items-center justify-center">
                    <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                  </div>
                  <span className="text-gray-700">Sem acesso</span>
                </div>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <div className="px-6 space-y-6">
              {/* Tabs por Módulo */}
              <Tabs defaultValue={Object.keys(funcionalidadesPorModulo)[0]} className="w-full">
                <TabsList className="grid w-full grid-cols-6">
                  {Object.keys(funcionalidadesPorModulo).map(modulo => (
                    <TabsTrigger key={modulo} value={modulo} className="text-xs">
                      {modulo.charAt(0).toUpperCase() + modulo.slice(1)}
                    </TabsTrigger>
                  ))}
                </TabsList>

                {Object.entries(funcionalidadesPorModulo).map(([modulo, funcs]) => (
                  <TabsContent key={modulo} value={modulo} className="mt-4">
                    <div className="space-y-4">
                      {/* Header do Módulo */}
                      <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg p-4 border">
                        <h3 className="text-lg font-semibold text-gray-900 capitalize">
                          Módulo: {modulo}
                        </h3>
                        <p className="text-sm text-gray-600">
                          {funcs.length} funcionalidades disponíveis
                        </p>
                      </div>

                      {/* Lista de Funcionalidades */}
                      <div className="space-y-3">
                        {funcs.map(func => {
                          // Validação adicional para evitar renderização de dados inválidos
                          if (!func || !func.id || !func.nome) {
                            console.warn('⚠️ Tentativa de renderizar funcionalidade inválida:', func);
                            return null;
                          }
                          
                          const hasAccess = hasPermission(func.id);
                          
                          return (
                            <div key={`${modulo}-${func.id}`} 
                                 className={`group flex items-center justify-between p-4 border rounded-xl transition-all duration-200 hover:shadow-md ${
                                   hasAccess ? 'bg-green-50 border-green-200 hover:bg-green-100' : 
                                   'bg-white border-gray-200 hover:bg-gray-50'
                                 }`}>
                              <div className="flex-1">
                                <div className="flex items-start justify-between">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-2">
                                      <h4 className="font-semibold text-gray-900">{func.nome}</h4>
                                    </div>
                                    
                                    {func.descricao && (
                                      <p className="text-sm text-gray-600 mb-2">{func.descricao}</p>
                                    )}
                                    
                                    <div className="flex items-center gap-2">
                                      <Badge variant="outline" className="text-xs">
                                        {func.categoria || 'Geral'}
                                      </Badge>
                                      <Badge variant="outline" className="text-xs font-mono">
                                        {func.codigo || 'N/A'}
                                      </Badge>
                                    </div>
                                  </div>
                                  
                                  <div className="flex items-center gap-3 ml-4">
                                    <Switch
                                      checked={hasAccess}
                                      onCheckedChange={(checked) => {
                                        handlePermissionToggle(func.id, checked);
                                      }}
                                      disabled={permissionLoading}
                                      className="data-[state=checked]:bg-green-600"
                                    />
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </TabsContent>
                ))}
              </Tabs>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Criação de Funcionário */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PlusIcon className="h-5 w-5" />
              Criar Novo Funcionário
            </DialogTitle>
            <DialogDescription>
              Preencha os dados do funcionário. Os campos de Perfil/Nível de Acesso, Contrato e Base são destacados abaixo.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 px-6">
            {/* Seção Destacada: Perfil, Contrato e Base */}
            <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-300">
              <CardContent className="p-6">
                <h3 className="text-lg font-bold text-blue-900 mb-4 flex items-center gap-2">
                  <ShieldCheckIcon className="h-5 w-5" />
                  Configurações de Acesso e Origem
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Perfil/Nível de Acesso */}
                  <div>
                    <Label htmlFor="create-perfil" className="text-sm font-semibold text-gray-700 mb-2 block">
                      Perfil/Nível de Acesso *
                    </Label>
                    <Select 
                      value={createForm.perfil_acesso_id} 
                      onValueChange={(value) => setCreateForm({ ...createForm, perfil_acesso_id: value })}
                    >
                      <SelectTrigger className="border-blue-300 focus:border-blue-500 focus:ring-blue-500">
                        <SelectValue placeholder="Selecione o perfil" />
                      </SelectTrigger>
                      <SelectContent>
                        {loadingPerfis ? (
                          <SelectItem value="loading" disabled>Carregando perfis...</SelectItem>
                        ) : (
                          perfisAcesso.map(perfil => (
                            <SelectItem key={perfil.id} value={perfil.id}>
                              {perfil.nome} ({perfil.codigo})
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Contrato */}
                  <div>
                    <Label htmlFor="create-contrato" className="text-sm font-semibold text-gray-700 mb-2 block">
                      Contrato Origem *
                    </Label>
                    <Select 
                      value={createForm.contrato_id} 
                      onValueChange={(value) => {
                        setCreateForm({ ...createForm, contrato_id: value, base_id: '' });
                      }}
                    >
                      <SelectTrigger className="border-blue-300 focus:border-blue-500 focus:ring-blue-500">
                        <SelectValue placeholder="Selecione o contrato" />
                      </SelectTrigger>
                      <SelectContent>
                        {(contratos || []).length > 0 ? (
                          (contratos || []).map((contrato: { id: string; nome: string; codigo: string }) => (
                            <SelectItem key={contrato.id} value={contrato.id}>
                              {contrato.nome}
                            </SelectItem>
                          ))
                        ) : (
                          <SelectItem value="no-contracts" disabled>
                            Nenhum contrato disponível
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Base */}
                  <div>
                    <Label htmlFor="create-base" className="text-sm font-semibold text-gray-700 mb-2 block">
                      Base {(() => {
                        const contratoSelecionado = contratos?.find(c => c.id === createForm.contrato_id);
                        const temBases = contratoSelecionado && bases.some(b => b.contrato_id === createForm.contrato_id);
                        return temBases ? '*' : '';
                      })()}
                    </Label>
                    <Select 
                      value={createForm.base_id} 
                      onValueChange={(value) => setCreateForm({ ...createForm, base_id: value })}
                      disabled={!createForm.contrato_id}
                    >
                      <SelectTrigger className="border-blue-300 focus:border-blue-500 focus:ring-blue-500">
                        <SelectValue placeholder={!createForm.contrato_id ? "Selecione um contrato primeiro" : "Selecione uma base"} />
                      </SelectTrigger>
                      <SelectContent>
                        {bases
                          .filter(base => base.contrato_id === createForm.contrato_id)
                          .map((base) => (
                            <SelectItem key={base.id} value={base.id}>
                              {base.nome}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Informações Básicas */}
            <div>
              <h3 className="text-lg font-semibold mb-4 text-gray-800">Informações Básicas</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="create-nome">Nome *</Label>
                  <Input
                    id="create-nome"
                    value={createForm.nome}
                    onChange={(e) => setCreateForm({ ...createForm, nome: e.target.value })}
                    placeholder="Nome completo"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="create-matricula">Matrícula *</Label>
                  <Input
                    id="create-matricula"
                    value={createForm.matricula}
                    onChange={(e) => setCreateForm({ ...createForm, matricula: e.target.value })}
                    placeholder="Número da matrícula"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="create-email">Email *</Label>
                  <Input
                    id="create-email"
                    type="email"
                    value={createForm.email}
                    onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                    placeholder="email@exemplo.com"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="create-cpf">CPF</Label>
                  <Input
                    id="create-cpf"
                    value={createForm.cpf}
                    onChange={(e) => {
                      const formattedCPF = formatarCPF(e.target.value);
                      setCreateForm({ ...createForm, cpf: formattedCPF });
                      if (formattedCPF.replace(/\D/g, '').length === 11) {
                        if (!validarCPF(formattedCPF)) {
                          setCpfError('CPF inválido');
                        } else {
                          setCpfError('');
                        }
                      } else {
                        setCpfError('');
                      }
                    }}
                    placeholder="000.000.000-00"
                    maxLength={14}
                    className={cpfError ? 'border-red-500' : ''}
                  />
                  {cpfError && <span className="text-xs text-red-500 mt-1">{cpfError}</span>}
                </div>
                <div>
                  <Label htmlFor="create-telefone">Telefone</Label>
                  <Input
                    id="create-telefone"
                    value={createForm.telefone}
                    onChange={(e) => setCreateForm({ ...createForm, telefone: e.target.value })}
                    placeholder="(00) 00000-0000"
                  />
                </div>
                <div>
                  <Label htmlFor="create-cargo">Cargo *</Label>
                  <Select 
                    value={createForm.cargo} 
                    onValueChange={(value) => setCreateForm({ ...createForm, cargo: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o cargo" />
                    </SelectTrigger>
                    <SelectContent>
                      {cargos.map((cargo) => (
                        <SelectItem key={cargo.id} value={cargo.nome}>
                          {cargo.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="create-operacao">Operação</Label>
                  <Select 
                    value={createForm.operacao} 
                    onValueChange={(value) => setCreateForm({ ...createForm, operacao: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a operação" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="geral">Geral</SelectItem>
                      <SelectItem value="logistica">Logística</SelectItem>
                      <SelectItem value="administrativo">Administrativo</SelectItem>
                      <SelectItem value="operacional">Operacional</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="create-senha">Senha *</Label>
                  <Input
                    id="create-senha"
                    type="password"
                    value={createForm.senha}
                    onChange={(e) => setCreateForm({ ...createForm, senha: e.target.value })}
                    placeholder="Senha inicial"
                    required
                  />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setIsCreateDialogOpen(false);
                setCreateForm({
                  nome: '',
                  email: '',
                  matricula: '',
                  cpf: '',
                  telefone: '',
                  cargo: '',
                  operacao: '',
                  senha: '',
                  perfil_acesso_id: '',
                  contrato_id: '',
                  base_id: ''
                });
                setCpfError('');
              }}
            >
              Cancelar
            </Button>
            <Button 
              onClick={async () => {
                // Validações
                if (!createForm.nome.trim()) {
                  toast.error('Nome é obrigatório');
                  return;
                }
                if (!createForm.matricula.trim()) {
                  toast.error('Matrícula é obrigatória');
                  return;
                }
                if (!createForm.email.trim()) {
                  toast.error('Email é obrigatório');
                  return;
                }
                // Validar CPF apenas se preenchido
                if (createForm.cpf.trim() && createForm.cpf.replace(/\D/g, '').length === 11 && !validarCPF(createForm.cpf)) {
                  toast.error('CPF inválido');
                  return;
                }
                if (!createForm.cargo.trim()) {
                  toast.error('Cargo é obrigatório');
                  return;
                }
                if (!createForm.perfil_acesso_id.trim()) {
                  toast.error('Perfil/Nível de Acesso é obrigatório');
                  return;
                }
                if (!createForm.contrato_id.trim()) {
                  toast.error('Contrato é obrigatório');
                  return;
                }
                const contratoSelecionado = contratos?.find(c => c.id === createForm.contrato_id);
                const temBases = contratoSelecionado && bases.some(b => b.contrato_id === createForm.contrato_id);
                if (temBases && !createForm.base_id.trim()) {
                  toast.error('Base é obrigatória para este contrato');
                  return;
                }
                if (!createForm.senha.trim()) {
                  toast.error('Senha é obrigatória');
                  return;
                }

                setLoadingCreate(true);
                try {
                  // Buscar o perfil de acesso selecionado para obter o código do nível
                  const perfilSelecionado = perfisAcesso.find(p => p.id === createForm.perfil_acesso_id);
                  
                  // Preparar dados para a API
                  const apiData = {
                    nome: createForm.nome,
                    email: createForm.email,
                    matricula: createForm.matricula,
                    cpf: createForm.cpf.trim() ? createForm.cpf.replace(/\D/g, '') : undefined,
                    telefone: createForm.telefone,
                    cargo: createForm.cargo,
                    operacao: createForm.operacao,
                    contrato_id: createForm.contrato_id,
                    base_id: createForm.base_id || undefined,
                    senha: createForm.senha,
                    perfil_acesso_id: createForm.perfil_acesso_id,
                    nivel_acesso: perfilSelecionado?.codigo || 'operacao'
                  };

                  await createFuncionarioMutation.mutateAsync(apiData);
                  
                  setIsCreateDialogOpen(false);
                  setCreateForm({
                    nome: '',
                    email: '',
                    matricula: '',
                    cpf: '',
                    telefone: '',
                    cargo: '',
                    operacao: '',
                    senha: '',
                    perfil_acesso_id: '',
                    contrato_id: '',
                    base_id: ''
                  });
                  setCpfError('');
                  
                  // Recarregar a lista de usuários
                  if (onUserUpdate) {
                    await onUserUpdate();
                  }
                } catch (error) {
                  console.error('Erro ao criar funcionário:', error);
                  toast.error('Erro ao criar funcionário');
                } finally {
                  setLoadingCreate(false);
                }
              }}
              disabled={loadingCreate}
            >
              {loadingCreate ? 'Criando...' : 'Criar Funcionário'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Edição de Funcionário */}
      <Dialog 
        open={isEditDialogOpen} 
        onOpenChange={(open) => {
          setIsEditDialogOpen(open);
          if (!open) {
            // Resetar quando o diálogo fechar
            setEditingUserId('');
            setEditForm({
              nome: '',
              email: '',
              matricula: '',
              cpf: '',
              telefone: '',
              cargo: '',
              operacao: '',
              senha: '',
              perfil_acesso_id: '',
              contrato_id: '',
              base_id: ''
            });
          }
        }}
      >
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PencilIcon className="h-5 w-5" />
              Editar Funcionário
            </DialogTitle>
            <DialogDescription>
              Atualize as informações do funcionário. O CPF não é obrigatório.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 px-6">
            {/* Seção Destacada: Perfil, Contrato e Base */}
            <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-300">
              <CardContent className="p-6">
                <h3 className="text-lg font-bold text-blue-900 mb-4 flex items-center gap-2">
                  <ShieldCheckIcon className="h-5 w-5" />
                  Configurações de Acesso e Origem
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Perfil/Nível de Acesso */}
                  <div>
                    <Label htmlFor="edit-perfil" className="text-sm font-semibold text-gray-700 mb-2 block">
                      Perfil/Nível de Acesso *
                    </Label>
                    <Select 
                      value={editForm.perfil_acesso_id} 
                      onValueChange={(value) => setEditForm({ ...editForm, perfil_acesso_id: value })}
                    >
                      <SelectTrigger className="border-blue-300 focus:border-blue-500 focus:ring-blue-500">
                        <SelectValue placeholder="Selecione o perfil" />
                      </SelectTrigger>
                      <SelectContent>
                        {loadingPerfis ? (
                          <SelectItem value="loading" disabled>Carregando perfis...</SelectItem>
                        ) : (
                          perfisAcesso.map(perfil => (
                            <SelectItem key={perfil.id} value={perfil.id}>
                              {perfil.nome} ({perfil.codigo})
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Contrato */}
                  <div>
                    <Label htmlFor="edit-contrato" className="text-sm font-semibold text-gray-700 mb-2 block">
                      Contrato Origem *
                    </Label>
                    <Select 
                      value={editForm.contrato_id} 
                      onValueChange={(value) => {
                        setEditForm({ ...editForm, contrato_id: value, base_id: '' });
                      }}
                    >
                      <SelectTrigger className="border-blue-300 focus:border-blue-500 focus:ring-blue-500">
                        <SelectValue placeholder="Selecione o contrato" />
                      </SelectTrigger>
                      <SelectContent>
                        {(contratos || []).length > 0 ? (
                          (contratos || []).map((contrato: { id: string; nome: string; codigo: string }) => (
                            <SelectItem key={contrato.id} value={contrato.id}>
                              {contrato.nome}
                            </SelectItem>
                          ))
                        ) : (
                          <SelectItem value="no-contracts" disabled>
                            Nenhum contrato disponível
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Base */}
                  <div>
                    <Label htmlFor="edit-base" className="text-sm font-semibold text-gray-700 mb-2 block">
                      Base {(() => {
                        const contratoSelecionado = contratos?.find(c => c.id === editForm.contrato_id);
                        const temBases = contratoSelecionado && bases.some(b => b.contrato_id === editForm.contrato_id);
                        return temBases ? '*' : '';
                      })()}
                    </Label>
                    <Select 
                      value={editForm.base_id} 
                      onValueChange={(value) => setEditForm({ ...editForm, base_id: value })}
                      disabled={!editForm.contrato_id}
                    >
                      <SelectTrigger className="border-blue-300 focus:border-blue-500 focus:ring-blue-500">
                        <SelectValue placeholder={!editForm.contrato_id ? "Selecione um contrato primeiro" : "Selecione uma base"} />
                      </SelectTrigger>
                      <SelectContent>
                        {bases
                          .filter(base => base.contrato_id === editForm.contrato_id)
                          .map((base) => (
                            <SelectItem key={base.id} value={base.id}>
                              {base.nome}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Informações Básicas */}
            <div>
              <h3 className="text-lg font-semibold mb-4 text-gray-800">Informações Básicas</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-nome">Nome *</Label>
                  <Input
                    id="edit-nome"
                    value={editForm.nome}
                    onChange={(e) => setEditForm({ ...editForm, nome: e.target.value })}
                    placeholder="Nome completo"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="edit-matricula">Matrícula *</Label>
                  <Input
                    id="edit-matricula"
                    value={editForm.matricula}
                    onChange={(e) => setEditForm({ ...editForm, matricula: e.target.value })}
                    placeholder="Número da matrícula"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="edit-email">Email *</Label>
                  <Input
                    id="edit-email"
                    type="email"
                    value={editForm.email}
                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                    placeholder="email@exemplo.com"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="edit-cpf">CPF</Label>
                  <Input
                    id="edit-cpf"
                    value={editForm.cpf}
                    onChange={(e) => {
                      const formattedCPF = formatarCPF(e.target.value);
                      setEditForm({ ...editForm, cpf: formattedCPF });
                    }}
                    placeholder="000.000.000-00"
                    maxLength={14}
                  />
                </div>
                <div>
                  <Label htmlFor="edit-telefone">Telefone</Label>
                  <Input
                    id="edit-telefone"
                    value={editForm.telefone}
                    onChange={(e) => setEditForm({ ...editForm, telefone: e.target.value })}
                    placeholder="(00) 00000-0000"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-cargo">Cargo *</Label>
                  <Select 
                    value={editForm.cargo} 
                    onValueChange={(value) => setEditForm({ ...editForm, cargo: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o cargo" />
                    </SelectTrigger>
                    <SelectContent>
                      {cargos.map((cargo) => (
                        <SelectItem key={cargo.id} value={cargo.nome}>
                          {cargo.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="edit-operacao">Operação</Label>
                  <Select 
                    value={editForm.operacao} 
                    onValueChange={(value) => setEditForm({ ...editForm, operacao: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a operação" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="geral">Geral</SelectItem>
                      <SelectItem value="logistica">Logística</SelectItem>
                      <SelectItem value="administrativo">Administrativo</SelectItem>
                      <SelectItem value="operacional">Operacional</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setIsEditDialogOpen(false);
                setEditingUserId('');
                // Resetar formulário ao fechar para garantir que os dados sejam recarregados na próxima abertura
                setEditForm({
                  nome: '',
                  email: '',
                  matricula: '',
                  cpf: '',
                  telefone: '',
                  cargo: '',
                  operacao: '',
                  senha: '',
                  perfil_acesso_id: '',
                  contrato_id: '',
                  base_id: ''
                });
              }}
            >
              Cancelar
            </Button>
            <Button 
              onClick={async () => {
                // Validações
                if (!editForm.nome.trim()) {
                  toast.error('Nome é obrigatório');
                  return;
                }
                if (!editForm.matricula.trim()) {
                  toast.error('Matrícula é obrigatória');
                  return;
                }
                if (!editForm.email.trim()) {
                  toast.error('Email é obrigatório');
                  return;
                }
                if (editForm.cpf.trim() && editForm.cpf.replace(/\D/g, '').length === 11 && !validarCPF(editForm.cpf)) {
                  toast.error('CPF inválido');
                  return;
                }
                if (!editForm.cargo.trim()) {
                  toast.error('Cargo é obrigatório');
                  return;
                }
                if (!editForm.perfil_acesso_id.trim()) {
                  toast.error('Perfil/Nível de Acesso é obrigatório');
                  return;
                }
                if (!editForm.contrato_id.trim()) {
                  toast.error('Contrato é obrigatório');
                  return;
                }
                const contratoSelecionado = contratos?.find(c => c.id === editForm.contrato_id);
                const temBases = contratoSelecionado && bases.some(b => b.contrato_id === editForm.contrato_id);
                if (temBases && !editForm.base_id.trim()) {
                  toast.error('Base é obrigatória para este contrato');
                  return;
                }

                try {
                  // Buscar o perfil de acesso selecionado para obter o código do nível
                  const perfilSelecionado = perfisAcesso.find(p => p.id === editForm.perfil_acesso_id);
                  const userToEdit = usuarios.find(u => u.id === editingUserId);
                  
                  const apiData = {
                    nome: editForm.nome,
                    email: editForm.email,
                    matricula: editForm.matricula,
                    cpf: editForm.cpf.trim() ? editForm.cpf.replace(/\D/g, '') : undefined,
                    telefone: editForm.telefone,
                    cargo: editForm.cargo,
                    operacao: editForm.operacao || undefined,
                    contrato_id: editForm.contrato_id,
                    base_id: editForm.base_id || undefined,
                    perfil_acesso_id: editForm.perfil_acesso_id,
                    nivel_acesso: perfilSelecionado?.codigo || userToEdit?.nivel_acesso || 'operacao'
                  };
                  
                  // Também atualizar contrato e base através das tabelas de relacionamento
                  if (editForm.contrato_id) {
                    try {
                      // Desativar contratos antigos
                      await supabase
                        .from('usuario_contratos')
                        .update({ ativo: false })
                        .eq('usuario_id', editingUserId);
                      
                      // Criar novo relacionamento com contrato
                      await supabase
                        .from('usuario_contratos')
                        .insert({
                          usuario_id: editingUserId,
                          contrato_id: editForm.contrato_id,
                          perfil_contrato: 'operador',
                          tipo_acesso: 'origem',
                          ativo: true,
                          data_inicio: new Date().toISOString()
                        });
                    } catch (error) {
                      console.error('Erro ao atualizar contrato:', error);
                    }
                  }
                  
                  if (editForm.base_id) {
                    try {
                      // Desativar bases antigas
                      await supabase
                        .from('usuario_bases')
                        .update({ ativo: false })
                        .eq('usuario_id', editingUserId);
                      
                      // Criar novo relacionamento com base
                      await supabase
                        .from('usuario_bases')
                        .insert({
                          usuario_id: editingUserId,
                          base_id: editForm.base_id,
                          tipo_acesso: 'total',
                          ativo: true,
                          data_inicio: new Date().toISOString()
                        });
                    } catch (error) {
                      console.error('Erro ao atualizar base:', error);
                    }
                  }

                  await updateFuncionarioMutation.mutateAsync({ id: editingUserId, data: apiData });
                  
                  setIsEditDialogOpen(false);
                  setEditingUserId('');
                  // Resetar formulário após salvar
                  setEditForm({
                    nome: '',
                    email: '',
                    matricula: '',
                    cpf: '',
                    telefone: '',
                    cargo: '',
                    operacao: '',
                    senha: '',
                    perfil_acesso_id: '',
                    contrato_id: '',
                    base_id: ''
                  });
                  
                  if (onUserUpdate) {
                    await onUserUpdate();
                  }
                } catch (error) {
                  console.error('Erro ao atualizar funcionário:', error);
                  toast.error('Erro ao atualizar funcionário');
                }
              }}
              disabled={updateFuncionarioMutation.isPending}
            >
              {updateFuncionarioMutation.isPending ? 'Salvando...' : 'Salvar Alterações'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Reset de Senha */}
      <Dialog open={isResetPasswordDialogOpen} onOpenChange={setIsResetPasswordDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyIcon className="h-5 w-5" />
              Resetar Senha - {resetPasswordUserName}
            </DialogTitle>
            <DialogDescription>
              Defina uma nova senha para o funcionário. A senha padrão PSE2025 está pré-selecionada.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 px-6">
            {/* Senhas Padrão */}
            <div>
              <Label className="text-sm font-medium text-gray-700 mb-2 block">Senhas Padrão Sugeridas</Label>
              <div className="space-y-2">
                {['PSE2025', '123456', 'senha123', 'usuario123'].map(password => (
                  <div key={password} className="flex items-center space-x-2">
                    <input
                      type="radio"
                      id={`reset-${password}`}
                      name="reset-password"
                      checked={resetPasswordDefault === password && !resetPasswordCustom}
                      onChange={() => {
                        setResetPasswordDefault(password);
                        setResetPasswordCustom('');
                      }}
                      className="h-4 w-4 text-blue-600"
                    />
                    <label
                      htmlFor={`reset-${password}`}
                      className="text-sm font-medium cursor-pointer"
                    >
                      {password}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            {/* Senha Customizada */}
            <div>
              <Label className="text-sm font-medium text-gray-700 mb-2 block">Senha Customizada</Label>
              <Input
                type="password"
                placeholder="Digite uma senha personalizada..."
                value={resetPasswordCustom}
                onChange={(e) => {
                  setResetPasswordCustom(e.target.value);
                  if (e.target.value) setResetPasswordDefault('');
                }}
                className="w-full"
              />
            </div>

            {/* Motivo */}
            <div>
              <Label className="text-sm font-medium text-gray-700 mb-2 block">Motivo do Reset</Label>
              <Input
                placeholder="Motivo do reset de senha..."
                value={resetPasswordReason}
                onChange={(e) => setResetPasswordReason(e.target.value)}
                className="w-full"
              />
            </div>

            {/* Opções Adicionais */}
            <div className="space-y-3 pt-4 border-t border-gray-200">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="reset-reativar"
                  checked={resetPasswordReativar}
                  onChange={(e) => setResetPasswordReativar(e.target.checked)}
                  className="h-4 w-4 text-blue-600 rounded"
                />
                <Label htmlFor="reset-reativar" className="text-sm font-medium text-gray-700 cursor-pointer">
                  Reativar usuário (se estiver demitido)
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="reset-troca-obrigatoria"
                  checked={resetPasswordTrocaObrigatoria}
                  onChange={(e) => setResetPasswordTrocaObrigatoria(e.target.checked)}
                  className="h-4 w-4 text-blue-600 rounded"
                />
                <Label htmlFor="reset-troca-obrigatoria" className="text-sm font-medium text-gray-700 cursor-pointer">
                  Tornar troca de senha obrigatória no próximo login
                </Label>
              </div>
            </div>

            {/* Senha Selecionada */}
            {(resetPasswordDefault || resetPasswordCustom) && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <p className="text-sm text-yellow-800">
                  Senha selecionada: <code className="bg-yellow-100 px-2 py-1 rounded text-yellow-900">{resetPasswordCustom || resetPasswordDefault}</code>
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setIsResetPasswordDialogOpen(false);
                setResetPasswordUserId('');
                setResetPasswordUserName('');
                setResetPasswordDefault('PSE2025');
                setResetPasswordCustom('');
                setResetPasswordReason('');
                setResetPasswordReativar(false);
                setResetPasswordTrocaObrigatoria(true);
              }}
            >
              Cancelar
            </Button>
            <Button 
              onClick={async () => {
                const passwordToUse = resetPasswordCustom || resetPasswordDefault;
                if (!passwordToUse) {
                  toast.error('Selecione ou digite uma senha');
                  return;
                }

                if (passwordToUse.length < 6) {
                  toast.error('A senha deve ter pelo menos 6 caracteres');
                  return;
                }

                const user = usuarios.find(u => u.id === resetPasswordUserId);
                if (!user) {
                  toast.error('Usuário não encontrado');
                  return;
                }

                if (!user.email || user.email.trim() === '') {
                  toast.error('Email não encontrado para este usuário');
                  return;
                }

                setResetPasswordLoading(true);
                try {
                  // Resetar senha
                  const res = await fetch('/api/users/reset-password', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      auth_user_id: user.auth_usuario_id,
                      user_id: user.id,
                      newPassword: passwordToUse,
                      admin_id: currentUser?.id,
                      reason: resetPasswordReason || 'Reset de senha via controle de acesso'
                    }),
                  });

                  if (res.ok) {
                    // Se reativar usuário foi marcado e o usuário está demitido
                    if (resetPasswordReativar && user.status === 'demitido') {
                      try {
                        const reactivateRes = await fetch('/api/users/dismiss', {
                          method: 'PUT',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            usuario_id: user.id,
                            nova_senha: passwordToUse,
                            observacoes_reativacao: resetPasswordReason || 'Reativado via reset de senha'
                          }),
                        });

                        if (!reactivateRes.ok) {
                          console.warn('Aviso: Não foi possível reativar usuário');
                        }
                      } catch (error) {
                        console.error('Erro ao reativar usuário:', error);
                      }
                    }

                    // Se troca obrigatória foi marcada
                    if (resetPasswordTrocaObrigatoria) {
                      try {
                        await supabase
                          .from('usuarios')
                          .update({ 
                            forcar_mudanca_senha: true,
                            deve_mudar_senha: true
                          })
                          .eq('id', user.id);
                      } catch (error) {
                        console.error('Erro ao definir troca de senha obrigatória:', error);
                      }
                    }

                    toast.success('Senha resetada com sucesso!');
                    setIsResetPasswordDialogOpen(false);
                    setResetPasswordUserId('');
                    setResetPasswordUserName('');
                    setResetPasswordDefault('PSE2025');
                    setResetPasswordCustom('');
                    setResetPasswordReason('');
                    setResetPasswordReativar(false);
                    setResetPasswordTrocaObrigatoria(true);
                    
                    // Recarregar dados
                    if (onUserUpdate) {
                      await onUserUpdate();
                    }
                  } else {
                    const data = await res.json();
                    toast.error(data.error || 'Erro ao resetar senha');
                  }
                } catch (error) {
                  console.error('Erro ao resetar senha:', error);
                  toast.error('Erro ao resetar senha');
                } finally {
                  setResetPasswordLoading(false);
                }
              }}
              disabled={resetPasswordLoading}
            >
              {resetPasswordLoading ? 'Resetando...' : 'Resetar Senha'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
