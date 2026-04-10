'use client';

import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { modularPermissionService } from '@/services/modularPermissionService';
import { 
  UserPlusIcon,
  PencilIcon,
  KeyIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  EyeIcon,
  EyeSlashIcon,
  ShieldCheckIcon,
  UserMinusIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';
// import { userService } from '@/services/userService'; // TODO: Implement user service usage
import { useAuth } from '@/contexts/AuthContext';
import type { User } from '@/types';
import type { Contrato, Base } from '@/types/contratos';
import type { FuncionalidadeModular, UsuarioPermissaoModular, PerfilAcesso } from '@/types/permissions';

interface UserManagementProps {
  usuarios: User[];
  contratos: Contrato[];
  bases: Base[];
  funcionalidadesModulares: FuncionalidadeModular[];
  onUserUpdate: () => void;
}

interface CreateUserForm {
  nome: string;
  email: string;
  cpf: string;
  telefone: string;
  nivel_acesso: string;
  operacao: string;
  cnh: string;
  cnh_vencimento: string;
  contrato_ids: string[];
  base_ids: string[];
}

interface EditUserForm {
  id: string;
  nome: string;
  email: string;
  cpf: string;
  telefone: string;
  nivel_acesso: string;
  operacao: string;
  cnh: string;
  cnh_vencimento: string;
  status: string;
  contrato_ids: string[];
  base_ids: string[];
}

interface ResetPasswordForm {
  userId: string;
  userName: string;
  newPassword: string;
  reason: string;
  showPassword: boolean;
}

interface DismissUserForm {
  userId: string;
  userName: string;
  tipo_demissao: string;
  observacoes: string;
}

// Removido NIVEL_ACESSO_OPTIONS estático - agora usando perfis da base de dados

const OPERACAO_OPTIONS = [
  { value: 'linha_viva', label: 'Linha Viva' },
  { value: 'comercial', label: 'Comercial' },
  { value: 'emergencia', label: 'Emergência' },
  { value: 'manutencao', label: 'Manutenção' },
  { value: 'almoxarifado', label: 'Almoxarifado' },
  { value: 'portaria', label: 'Portaria' },
  { value: 'geral', label: 'Geral' },
];

const STATUS_OPTIONS = [
  { value: 'ativo', label: 'Ativo' },
  { value: 'inativo', label: 'Inativo' },
  { value: 'pendente', label: 'Pendente' },
];

const TIPOS_DEMISSAO = [
  { value: 'sem_justa_causa', label: 'Sem Justa Causa' },
  { value: 'com_justa_causa', label: 'Com Justa Causa' },
  { value: 'pedido_demissao', label: 'Pedido de Demissão' },
  { value: 'aposentadoria', label: 'Aposentadoria' },
  { value: 'falecimento', label: 'Falecimento' },
  { value: 'outros', label: 'Outros' }
];

export default function ModularUserManagement({ usuarios, funcionalidadesModulares, onUserUpdate }: UserManagementProps) {
  const { user: currentUser } = useAuth();
  const [activeAction, setActiveAction] = useState<'create' | 'edit' | 'reset' | 'permissions' | 'dismiss' | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  
  // Estados para perfis de acesso da base de dados
  const [perfisAcesso, setPerfisAcesso] = useState<PerfilAcesso[]>([]);
  const [loadingPerfis, setLoadingPerfis] = useState(true);
  
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
        setMessage({ type: 'error', text: 'Erro ao carregar perfis de acesso' });
      } finally {
        setLoadingPerfis(false);
      }
    };

    loadPerfisAcesso();
  }, []);
  
  // Estados para permissões
  const [selectedUserForPermissions, setSelectedUserForPermissions] = useState<User | null>(null);
  const [userPermissions, setUserPermissions] = useState<UsuarioPermissaoModular[]>([]);
  const [, setMatrixPermissions] = useState<Record<string, boolean>>({});
  const [permissionsLoading, setPermissionsLoading] = useState(false);
  
  // Estados para criar usuário
  const [createForm, setCreateForm] = useState<CreateUserForm>({
    nome: '',
    email: '',
    cpf: '',
    telefone: '',
    nivel_acesso: '',
    operacao: '',
    cnh: '',
    cnh_vencimento: '',
    contrato_ids: [],
    base_ids: []
  });

  // Estados para editar usuário
  const [editForm, setEditForm] = useState<EditUserForm>({
    id: '',
    nome: '',
    email: '',
    cpf: '',
    telefone: '',
    nivel_acesso: '',
    operacao: '',
    cnh: '',
    cnh_vencimento: '',
    status: '',
    contrato_ids: [],
    base_ids: []
  });

  // Estados para resetar senha
  const [resetForm, setResetForm] = useState<ResetPasswordForm>({
    userId: '',
    userName: '',
    newPassword: '',
    reason: '',
    showPassword: false
  });

  // Estados para demitir usuário
  const [dismissForm, setDismissForm] = useState<DismissUserForm>({
    userId: '',
    userName: '',
    tipo_demissao: 'sem_justa_causa',
    observacoes: ''
  });

  const clearMessage = () => {
    setTimeout(() => setMessage(null), 5000);
  };

  // Funções para permissões
  const loadUserPermissions = async (userId: string) => {
    try {
      const permissions = await modularPermissionService.getUserPermissionsModulares(userId);
      setUserPermissions(permissions);
    } catch {
      console.error('Erro ao carregar permissões modulares do usuário');
      setUserPermissions([]);
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const loadMatrixPermissions = async (_user: User) => {
    // Não existe mais conceito de "matriz" ou "inerente"
    // Permissões são APENAS as que existem na tabela usuario_permissoes_modulares
    setMatrixPermissions({});
  };

  const hasPermission = (funcionalidadeId: string): boolean => {
    if (!selectedUserForPermissions) return false;
    
    // Admin e diretor têm acesso total
    if (['admin', 'diretor'].includes(selectedUserForPermissions.nivel_acesso)) {
      return true;
    }
    
    // Sem registro = sem acesso
    const permission = userPermissions.find(p => 
      p.funcionalidade_id === funcionalidadeId
    );
    
    return permission ? (permission.concedido && permission.ativo) : false;
  };

  const handlePermissionToggle = async (funcionalidadeId: string, granted: boolean) => {
    if (!selectedUserForPermissions) return;
    
    setPermissionsLoading(true);
    try {
      if (granted) {
        await modularPermissionService.grantUserPermissionModular({
          usuario_id: selectedUserForPermissions.id,
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
        await modularPermissionService.revokeUserPermissionModular(selectedUserForPermissions.id, funcionalidadeId);
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
              usuario_id: selectedUserForPermissions.id,
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
      
      setMessage({ type: 'success', text: 'Permissão alterada com sucesso!' });
      
      // Atualizar indicador de permissões personalizadas sem recarregar a página
      if (!selectedUserForPermissions.permissoes_personalizadas) {
        selectedUserForPermissions.permissoes_personalizadas = true;
      }
      
      // NÃO RECARREGAR A PÁGINA TODA - só atualizar localmente
      // onUserUpdate(); // REMOVIDO para não recarregar
    } catch {
      console.error('Erro ao alterar permissão');
      setMessage({ type: 'error', text: 'Erro ao alterar permissão. Tente novamente.' });
    } finally {
      setPermissionsLoading(false);
      clearMessage();
    }
  };

  const openPermissionsModal = async (user: User) => {
    setSelectedUserForPermissions(user);
    setActiveAction('permissions');
    setPermissionsLoading(true);
    
    try {
      // Debug: Verificar estado das funcionalidades modulares
      console.log('🔍 DEBUG - Abrindo modal de permissões para:', user.nome);
      console.log('📊 Estado atual das funcionalidades modulares:', {
        total: funcionalidadesModulares?.length || 0,
        primeiroExemplo: funcionalidadesModulares?.[0],
        todasValidas: funcionalidadesModulares?.every((f: FuncionalidadeModular) => f && f.id && f.nome) || false
      });
      
      // Executar debug do serviço se necessário
      if (!funcionalidadesModulares || funcionalidadesModulares.length === 0) {
        console.log('⚠️ Executando debug do serviço de permissões...');
        await modularPermissionService.debugFuncionalidadesModulares();
      }
      
      await Promise.all([
        loadUserPermissions(user.id),
        loadMatrixPermissions(user)
      ]);
    } catch {
      console.error('Erro ao carregar dados de permissões');
    } finally {
      setPermissionsLoading(false);
    }
  };

  // Agrupar funcionalidades por módulo
  const funcionalidadesPorModulo = useMemo(() => {
    if (!funcionalidadesModulares || funcionalidadesModulares.length === 0) {
      console.log('⚠️ Nenhuma funcionalidade modular encontrada');
      return {};
    }
    
    console.log('🔍 Processando funcionalidades modulares:', funcionalidadesModulares.length);
    
    return funcionalidadesModulares.reduce((acc: Record<string, FuncionalidadeModular[]>, func: FuncionalidadeModular) => {
      // Verificar se a funcionalidade é válida
      if (!func || !func.id || !func.nome) {
        console.warn('⚠️ Funcionalidade inválida encontrada:', func);
        return acc;
      }
      
      const modulo = func.modulo_id || 'outros';
      if (!acc[modulo]) {
        acc[modulo] = [];
      }
      acc[modulo].push(func);
      return acc;
    }, {} as Record<string, FuncionalidadeModular[]>);
  }, [funcionalidadesModulares]);

  // Função para criar usuário
  const handleCreateUser = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/users/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createForm)
      });

      if (!response.ok) {
        throw new Error('Erro ao criar usuário');
      }

      setMessage({ type: 'success', text: `Usuário ${createForm.nome} criado com sucesso!` });
      setCreateForm({
        nome: '',
        email: '',
        cpf: '',
        telefone: '',
        nivel_acesso: '',
        operacao: '',
        cnh: '',
        cnh_vencimento: '',
        contrato_ids: [],
        base_ids: []
      });
      setActiveAction(null);
      onUserUpdate();
    } catch {
      setMessage({ type: 'error', text: 'Erro ao criar usuário. Tente novamente.' });
    } finally {
      setLoading(false);
      clearMessage();
    }
  };

  // Função para editar usuário
  const handleEditUser = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/users/${editForm.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm)
      });

      if (!response.ok) {
        throw new Error('Erro ao editar usuário');
      }

      setMessage({ type: 'success', text: `Usuário ${editForm.nome} atualizado com sucesso!` });
      setActiveAction(null);
      onUserUpdate();
    } catch {
      setMessage({ type: 'error', text: 'Erro ao editar usuário. Tente novamente.' });
    } finally {
      setLoading(false);
      clearMessage();
    }
  };

  // Função para resetar senha
  const handleResetPassword = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/users/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          auth_user_id: resetForm.userId,
          newPassword: resetForm.newPassword,
          admin_id: 'current_admin_id', // Em produção, pegar do contexto
          reason: resetForm.reason
        })
      });

      if (!response.ok) {
        throw new Error('Erro ao resetar senha');
      }

      setMessage({ type: 'success', text: `Senha do usuário ${resetForm.userName} resetada com sucesso!` });
      setResetForm({
        userId: '',
        userName: '',
        newPassword: '',
        reason: '',
        showPassword: false
      });
      setActiveAction(null);
    } catch {
      setMessage({ type: 'error', text: 'Erro ao resetar senha. Tente novamente.' });
    } finally {
      setLoading(false);
      clearMessage();
    }
  };

  // Função para demitir usuário
  const handleDismissUser = async () => {
    setLoading(true);
    try {
        const response = await fetch('/api/users/dismiss', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            usuario_id: dismissForm.userId,
            tipo_demissao: dismissForm.tipo_demissao,
            observacoes: dismissForm.observacoes
          })
        });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao demitir usuário');
      }

      setMessage({ type: 'success', text: `Usuário ${dismissForm.userName} demitido com sucesso!` });
      setDismissForm({
        userId: '',
        userName: '',
        tipo_demissao: 'sem_justa_causa',
        observacoes: ''
      });
      setActiveAction(null);
      onUserUpdate();
    } catch (error) {
      setMessage({ 
        type: 'error', 
        text: error instanceof Error ? error.message : 'Erro ao demitir usuário. Tente novamente.' 
      });
    } finally {
      setLoading(false);
      clearMessage();
    }
  };

  // Função para abrir modal de edição
  const openEditModal = (user: User) => {
    setEditForm({
      id: user.id,
      nome: user.nome || '',
      email: user.email || '',
      cpf: user.cpf || '',
      telefone: user.telefone || '',
      nivel_acesso: user.nivel_acesso || '',
      operacao: user.operacao || '',
      cnh: user.cnh || '',
      cnh_vencimento: user.cnh_vencimento || '',
      status: user.status || 'ativo',
      contrato_ids: user.contratos?.map(c => c.id) || [],
      base_ids: user.bases?.map(b => b.id) || []
    });
    setActiveAction('edit');
  };

  // Função para abrir modal de reset de senha
  const openResetModal = (user: User) => {
    setResetForm({
      userId: user.auth_usuario_id || '',
      userName: user.nome || '',
      newPassword: '',
      reason: '',
      showPassword: false
    });
    setActiveAction('reset');
  };

  // Função para abrir modal de demissão
  const openDismissModal = (user: User) => {
    setDismissForm({
      userId: user.id,
      userName: user.nome || '',
      tipo_demissao: 'sem_justa_causa',
      observacoes: ''
    });
    setActiveAction('dismiss');
  };

  // Gerar senha aleatória
  const generateRandomPassword = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setResetForm(prev => ({ ...prev, newPassword: password }));
  };

  return (
    <div className="space-y-6">
      {/* Mensagens */}
      {message && (
        <Alert className={`${message.type === 'error' ? 'border-red-200 bg-red-50' : 'border-green-200 bg-green-50'}`}>
          <div className="flex items-center gap-2">
            {message.type === 'error' && <ExclamationTriangleIcon className="h-5 w-5 text-red-600" />}
            {message.type === 'success' && <CheckCircleIcon className="h-5 w-5 text-green-600" />}
            {message.type === 'info' && <InformationCircleIcon className="h-5 w-5 text-blue-600" />}
            <AlertDescription className={message.type === 'error' ? 'text-red-800' : 'text-green-800'}>
              {message.text}
            </AlertDescription>
          </div>
        </Alert>
      )}

      {/* Botões de Ação */}
      <div className="flex gap-4">
        <Button 
          onClick={() => setActiveAction('create')}
          className="bg-blue-600 hover:bg-blue-700"
        >
          <UserPlusIcon className="h-4 w-4 mr-2" />
          Criar Usuário
        </Button>
      </div>

      {/* Lista de Usuários com Ações */}
      <Card>
        <CardHeader>
          <CardTitle>Usuários do Sistema</CardTitle>
          <CardDescription>
            Gerencie usuários, permissões e acessos
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {usuarios.map((user) => (
              <div key={user.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <h3 className="font-semibold">{user.nome}</h3>
                    <Badge variant={
                      user.status === 'ativo' ? 'default' : 
                      user.status === 'suspenso' ? 'secondary' : 'secondary'
                    }>
                      {user.status === 'ativo' ? 'Ativo' : 
                       user.status === 'suspenso' ? 'Suspenso' : user.status}
                    </Badge>
                    <Badge variant="outline">{user.nivel_acesso}</Badge>
                  </div>
                  <p className="text-sm text-gray-600">{user.email}</p>
                  <p className="text-xs text-gray-500">
                    Operação: {user.operacao} | Contratos: {user.contratos?.length || 0} | Bases: {user.bases?.length || 0}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openEditModal(user)}
                  >
                    <PencilIcon className="h-4 w-4 mr-1" />
                    Editar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openPermissionsModal(user)}
                  >
                    <ShieldCheckIcon className="h-4 w-4 mr-1" />
                    Permissões
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openResetModal(user)}
                  >
                    <KeyIcon className="h-4 w-4 mr-1" />
                    Resetar Senha
                  </Button>
                  {user.status === 'ativo' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openDismissModal(user)}
                      className="text-red-600 border-red-600 hover:bg-red-50"
                    >
                      <UserMinusIcon className="h-4 w-4 mr-1" />
                      Demitir
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Modal: Criar Usuário */}
      <Dialog open={activeAction === 'create'} onOpenChange={() => setActiveAction(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Criar Novo Usuário</DialogTitle>
            <DialogDescription>
              Preencha os dados do novo usuário
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="create-nome">Nome Completo</Label>
                <Input
                  id="create-nome"
                  value={createForm.nome}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, nome: e.target.value }))}
                  placeholder="Nome completo"
                />
              </div>
              <div>
                <Label htmlFor="create-email">Email</Label>
                <Input
                  id="create-email"
                  type="email"
                  value={createForm.email}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="email@exemplo.com"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="create-cpf">CPF</Label>
                <Input
                  id="create-cpf"
                  value={createForm.cpf}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, cpf: e.target.value }))}
                  placeholder="000.000.000-00"
                />
              </div>
              <div>
                <Label htmlFor="create-telefone">Telefone</Label>
                <Input
                  id="create-telefone"
                  value={createForm.telefone}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, telefone: e.target.value }))}
                  placeholder="(00) 00000-0000"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="create-nivel">Nível de Acesso</Label>
                <Select value={createForm.nivel_acesso} onValueChange={(value) => setCreateForm(prev => ({ ...prev, nivel_acesso: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o nível" />
                  </SelectTrigger>
                  <SelectContent>
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
              <div>
                <Label htmlFor="create-operacao">Operação</Label>
                <Select value={createForm.operacao} onValueChange={(value) => setCreateForm(prev => ({ ...prev, operacao: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a operação" />
                  </SelectTrigger>
                  <SelectContent>
                    {OPERACAO_OPTIONS.map(option => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="create-cnh">CNH</Label>
                <Input
                  id="create-cnh"
                  value={createForm.cnh}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, cnh: e.target.value }))}
                  placeholder="Número da CNH"
                />
              </div>
              <div>
                <Label htmlFor="create-cnh-vencimento">Vencimento CNH</Label>
                <Input
                  id="create-cnh-vencimento"
                  type="date"
                  value={createForm.cnh_vencimento}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, cnh_vencimento: e.target.value }))}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setActiveAction(null)}>
              Cancelar
            </Button>
            <Button onClick={handleCreateUser} disabled={loading}>
              {loading ? 'Criando...' : 'Criar Usuário'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Editar Usuário */}
      <Dialog open={activeAction === 'edit'} onOpenChange={() => setActiveAction(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Usuário</DialogTitle>
            <DialogDescription>
              Atualize os dados do usuário
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-nome">Nome Completo</Label>
                <Input
                  id="edit-nome"
                  value={editForm.nome}
                  onChange={(e) => setEditForm(prev => ({ ...prev, nome: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="edit-email">Email</Label>
                <Input
                  id="edit-email"
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm(prev => ({ ...prev, email: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-cpf">CPF</Label>
                <Input
                  id="edit-cpf"
                  value={editForm.cpf}
                  onChange={(e) => setEditForm(prev => ({ ...prev, cpf: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="edit-telefone">Telefone</Label>
                <Input
                  id="edit-telefone"
                  value={editForm.telefone}
                  onChange={(e) => setEditForm(prev => ({ ...prev, telefone: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="edit-nivel">Nível de Acesso</Label>
                <Select value={editForm.nivel_acesso} onValueChange={(value) => setEditForm(prev => ({ ...prev, nivel_acesso: value }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
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
              <div>
                <Label htmlFor="edit-operacao">Operação</Label>
                <Select value={editForm.operacao} onValueChange={(value) => setEditForm(prev => ({ ...prev, operacao: value }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {OPERACAO_OPTIONS.map(option => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="edit-status">Status</Label>
                <Select value={editForm.status} onValueChange={(value) => setEditForm(prev => ({ ...prev, status: value }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map(option => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-cnh">CNH</Label>
                <Input
                  id="edit-cnh"
                  value={editForm.cnh}
                  onChange={(e) => setEditForm(prev => ({ ...prev, cnh: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="edit-cnh-vencimento">Vencimento CNH</Label>
                <Input
                  id="edit-cnh-vencimento"
                  type="date"
                  value={editForm.cnh_vencimento}
                  onChange={(e) => setEditForm(prev => ({ ...prev, cnh_vencimento: e.target.value }))}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setActiveAction(null)}>
              Cancelar
            </Button>
            <Button onClick={handleEditUser} disabled={loading}>
              {loading ? 'Salvando...' : 'Salvar Alterações'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Resetar Senha */}
      <Dialog open={activeAction === 'reset'} onOpenChange={() => setActiveAction(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resetar Senha</DialogTitle>
            <DialogDescription>
              Redefinir senha para: {resetForm.userName}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="reset-password">Nova Senha</Label>
              <div className="flex gap-2">
                <Input
                  id="reset-password"
                  type={resetForm.showPassword ? 'text' : 'password'}
                  value={resetForm.newPassword}
                  onChange={(e) => setResetForm(prev => ({ ...prev, newPassword: e.target.value }))}
                  placeholder="Digite a nova senha"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setResetForm(prev => ({ ...prev, showPassword: !prev.showPassword }))}
                >
                  {resetForm.showPassword ? <EyeSlashIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={generateRandomPassword}
                >
                  Gerar
                </Button>
              </div>
            </div>
            
            <div>
              <Label htmlFor="reset-reason">Motivo</Label>
              <Textarea
                id="reset-reason"
                value={resetForm.reason}
                onChange={(e) => setResetForm(prev => ({ ...prev, reason: e.target.value }))}
                placeholder="Motivo da redefinição de senha"
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setActiveAction(null)}>
              Cancelar
            </Button>
            <Button onClick={handleResetPassword} disabled={loading || !resetForm.newPassword}>
              {loading ? 'Resetando...' : 'Resetar Senha'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Editar Permissões */}
      <Dialog open={activeAction === 'permissions'} onOpenChange={() => setActiveAction(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheckIcon className="h-5 w-5" />
              Permissões de {selectedUserForPermissions?.nome}
            </DialogTitle>
            <DialogDescription>
              Configure permissões específicas para este usuário. 
              Nível atual: <Badge variant="outline">{selectedUserForPermissions?.nivel_acesso}</Badge>
            </DialogDescription>
          </DialogHeader>

          {/* Legenda visual */}
          <div className="px-6 pb-4">
            <div className="flex flex-wrap gap-2 text-xs">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-green-100 border border-green-200 rounded"></div>
                <span>Com acesso</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-white border border-gray-200 rounded"></div>
                <span>Sem acesso</span>
              </div>
            </div>
          </div>

          {permissionsLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : !funcionalidadesModulares || funcionalidadesModulares.length === 0 ? (
            <div className="px-6 py-8 text-center">
              <div className="text-gray-500 mb-4">
                <ShieldCheckIcon className="h-12 w-12 mx-auto mb-2" />
                <p>Nenhuma funcionalidade modular encontrada.</p>
                <p className="text-sm">Verifique se as funcionalidades estão configuradas corretamente.</p>
              </div>
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
                    <div className="space-y-3">
                      {(funcs as FuncionalidadeModular[]).map((func: FuncionalidadeModular) => {
                        // Validação adicional para evitar renderização de dados inválidos
                        if (!func || !func.id || !func.nome) {
                          console.warn('⚠️ Tentativa de renderizar funcionalidade inválida:', func);
                          return null;
                        }
                        
                        const hasAccess = hasPermission(func.id);
                        
                        return (
                          <div key={`${modulo}-${func.id}`} 
                               className={`flex items-center justify-between p-3 border rounded-lg ${
                                 hasAccess ? 'bg-green-50 border-green-200' : ''
                               }`}>
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <h4 className="font-medium text-sm">{func.nome}</h4>
                                <Badge variant="outline" className="text-xs">
                                  {func.categoria || 'N/A'}
                                </Badge>
                              </div>
                              {func.descricao && (
                                <p className="text-xs text-gray-600 mt-1">{func.descricao}</p>
                              )}
                              <code className="text-xs text-gray-500 bg-gray-100 px-1 rounded">
                                {func.codigo || 'N/A'}
                              </code>
                            </div>
                            
                            <div className="flex items-center gap-2">
                              <Switch
                                checked={hasAccess}
                                onCheckedChange={(checked) => {
                                  handlePermissionToggle(func.id, checked);
                                }}
                                disabled={permissionsLoading}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </TabsContent>
                ))}
              </Tabs>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setActiveAction(null)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Demitir Usuário */}
      <Dialog open={activeAction === 'dismiss'} onOpenChange={() => setActiveAction(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <UserMinusIcon className="h-5 w-5" />
              Demitir Funcionário
            </DialogTitle>
            <DialogDescription>
              Tem certeza que deseja demitir <strong>{dismissForm.userName}</strong>?
              Esta ação irá mover o funcionário para a lista de demitidos.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="dismiss-tipo">Tipo de Demissão</Label>
              <Select 
                value={dismissForm.tipo_demissao} 
                onValueChange={(value) => setDismissForm(prev => ({ ...prev, tipo_demissao: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  {TIPOS_DEMISSAO.map(tipo => (
                    <SelectItem key={tipo.value} value={tipo.value}>
                      {tipo.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="dismiss-observacoes">Observações Adicionais</Label>
              <Textarea
                id="dismiss-observacoes"
                value={dismissForm.observacoes}
                onChange={(e) => setDismissForm(prev => ({ ...prev, observacoes: e.target.value }))}
                placeholder="Observações adicionais (opcional)..."
                rows={2}
              />
            </div>

            <Alert className="border-red-200 bg-red-50">
              <ExclamationTriangleIcon className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-800">
                <strong>Atenção:</strong> Esta ação irá marcar o funcionário como demitido e removê-lo da lista de funcionários ativos. 
                O funcionário poderá ser reativado posteriormente se necessário.
              </AlertDescription>
            </Alert>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setActiveAction(null)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleDismissUser} 
              disabled={loading}
              className="bg-red-600 hover:bg-red-700"
            >
              {loading ? (
                <>
                  <ArrowPathIcon className="h-4 w-4 mr-2 animate-spin" />
                  Demitindo...
                </>
              ) : (
                <>
                  <UserMinusIcon className="h-4 w-4 mr-2" />
                  Confirmar Demissão
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
