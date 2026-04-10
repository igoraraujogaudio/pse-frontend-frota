'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DateInput } from '@/components/ui/date-input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { 
  UsersIcon, 
  PlusIcon,
  PencilIcon,
  KeyIcon,
  DevicePhoneMobileIcon,
  ComputerDesktopIcon
} from '@heroicons/react/24/outline';
import { modularPermissionService } from '@/services/modularPermissionService';
import { userService } from '@/services/userService';
import type { 
  FuncionalidadeModular, 
  ModuloSistema, 
  Plataforma, 
  PerfilAcesso, 
  UsuarioPermissaoModular 
} from '@/types/permissions';
import type { User } from '@/types';

interface UserPermissionsEditorProps {
  usuarios: User[];
  onUpdate?: () => void;
}

export default function UserPermissionsEditor({ usuarios, onUpdate }: UserPermissionsEditorProps) {
  const [loading, setLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  
  // Estados para dados modulares
  const [funcionalidadesModulares, setFuncionalidadesModulares] = useState<FuncionalidadeModular[]>([]);
  const [modulosSistema, setModulosSistema] = useState<ModuloSistema[]>([]);
  const [plataformas, setPlataformas] = useState<Plataforma[]>([]);
  const [perfisAcesso, setPerfisAcesso] = useState<PerfilAcesso[]>([]);
  const [usuarioPermissoesModulares, setUsuarioPermissoesModulares] = useState<UsuarioPermissaoModular[]>([]);

  // Estados para formulário de usuário
  const [formData, setFormData] = useState({
    nome: '',
    email: '',
    nivel_acesso: '',
    perfil_acesso_id: '', // ✅ CORREÇÃO: Adicionado campo para perfil de acesso
    departamento: '',
    cargo: '',
    matricula: '',
    cpf: '',
    telefone: '',
    telefone_empresarial: '',
    cnh: '',
    validade_cnh: '',
    cnh_categoria: '',
    operacao: '',
    turno: '',
    status: 'ativo',
    data_admissao: '',
    data_nascimento: ''
  });

  // Estados para permissões modulares
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);

  // Carregar dados modulares
  useEffect(() => {
    loadModularData();
  }, []);

  const loadModularData = async () => {
    setLoading(true);
    try {
      const [
        funcionalidadesData,
        modulosData,
        plataformasData,
        perfisData,
        permissoesData
      ] = await Promise.all([
        modularPermissionService.getFuncionalidadesModulares(),
        modularPermissionService.getModulosSistema(),
        modularPermissionService.getPlataformas(),
        modularPermissionService.getPerfisAcesso(),
        modularPermissionService.getAllUsuarioPermissoesModulares()
      ]);

      setFuncionalidadesModulares(funcionalidadesData);
      setModulosSistema(modulosData);
      setPlataformas(plataformasData);
      setPerfisAcesso(perfisData);
      setUsuarioPermissoesModulares(permissoesData);
    } catch (error) {
      console.error('Erro ao carregar dados modulares:', error);
    } finally {
      setLoading(false);
    }
  };

  // Abrir diálogo de edição
  const openEditDialog = (usuario: User) => {
    setSelectedUser(usuario);
    
    // ✅ CORREÇÃO: Buscar perfil_acesso_id baseado no nivel_acesso
    const perfilCorrespondente = perfisAcesso.find(p => p.codigo === usuario.nivel_acesso);
    
    setFormData({
      nome: usuario.nome || '',
      email: usuario.email || '',
      nivel_acesso: usuario.nivel_acesso || '',
      perfil_acesso_id: perfilCorrespondente?.id || '', // ✅ CORREÇÃO: Usar perfil_id em vez de nivel_acesso
      departamento: usuario.departamento || '',
      cargo: usuario.cargo || '',
      matricula: usuario.matricula || '',
      cpf: usuario.cpf || '',
      telefone: usuario.telefone || '',
      telefone_empresarial: usuario.telefone_empresarial || '',
      cnh: usuario.cnh || '',
      validade_cnh: usuario.validade_cnh || '',
      cnh_categoria: usuario.cnh_categoria || '',
      operacao: usuario.operacao || '',
      turno: usuario.turno || '',
      status: usuario.status || 'ativo',
      data_admissao: usuario.data_admissao || '',
      data_nascimento: usuario.data_nascimento || ''
    });

    // Carregar permissões do usuário
    const permissoesUsuario = usuarioPermissoesModulares
      .filter(up => up.usuario_id === usuario.id && up.concedido)
      .map(up => up.funcionalidade_id);
    setSelectedPermissions(permissoesUsuario);

    setIsEditDialogOpen(true);
  };

  // Abrir diálogo de criação
  const openCreateDialog = () => {
    setSelectedUser(null);
    setFormData({
      nome: '',
      email: '',
      nivel_acesso: '',
      perfil_acesso_id: '', // ✅ CORREÇÃO: Adicionado campo para perfil de acesso
      departamento: '',
      cargo: '',
      matricula: '',
      cpf: '',
      telefone: '',
      telefone_empresarial: '',
      cnh: '',
      validade_cnh: '',
      cnh_categoria: '',
      operacao: '',
      turno: '',
      status: 'ativo',
      data_admissao: '',
      data_nascimento: ''
    });
    setSelectedPermissions([]);
    setIsCreateDialogOpen(true);
  };

  // Salvar usuário
  const saveUser = async () => {
    try {
      console.log('💾 Iniciando salvamento do usuário...');
      console.log('📋 Dados do formulário:', formData);
      console.log('👤 Usuário selecionado:', selectedUser);
      console.log('🔐 Permissões selecionadas:', selectedPermissions);

      if (selectedUser) {
        // Atualizar usuário existente
        console.log('🔄 Atualizando usuário existente...');
        try {
          // ✅ CORREÇÃO: Derivar nivel_acesso do perfil_acesso_id
          const perfilSelecionado = perfisAcesso.find(p => p.id === formData.perfil_acesso_id);
          const nivelAcessoDerivado = perfilSelecionado?.codigo || formData.nivel_acesso;

          // Filtrar apenas campos que existem na tabela usuarios e tratar campos de data
          const camposValidos = {
            nome: formData.nome,
            email: formData.email,
            departamento: formData.departamento,
            cargo: formData.cargo,
            matricula: formData.matricula,
            cpf: formData.cpf,
            telefone: formData.telefone,
            telefone_empresarial: formData.telefone_empresarial,
            cnh: formData.cnh,
            validade_cnh: formData.validade_cnh || undefined, // Converter string vazia para undefined
            cnh_categoria: formData.cnh_categoria,
            nivel_acesso: nivelAcessoDerivado, // ✅ CORREÇÃO: Usar nivel_acesso derivado do perfil_id
            perfil_acesso_id: formData.perfil_acesso_id, // ✅ CORREÇÃO: Enviar perfil_acesso_id para a API derivar nivel_acesso
            operacao: formData.operacao || undefined, // ✅ CORREÇÃO: Converter string vazia para undefined
            status: formData.status,
            data_admissao: formData.data_admissao || undefined, // Converter string vazia para undefined
            data_nascimento: formData.data_nascimento || undefined // Converter string vazia para undefined
            // Removendo 'turno' que não existe na tabela
          };

          console.log('📤 Dados sendo enviados para atualização:', {
            id: selectedUser.id,
            camposValidos: camposValidos,
            camposRemovidos: ['turno'], // Campos que foram removidos
            camposConvertidos: ['validade_cnh', 'data_admissao', 'data_nascimento'] // Campos convertidos de string vazia para null
          });
          
          await userService.update(selectedUser.id, camposValidos);
          console.log('✅ Usuário atualizado com sucesso!');
        } catch (updateError) {
          console.error('❌ Erro ao atualizar usuário:', updateError);
          console.error('❌ Detalhes do erro de atualização:', {
            message: updateError instanceof Error ? updateError.message : 'Erro desconhecido',
            stack: updateError instanceof Error ? updateError.stack : undefined,
            error: updateError
          });
          throw updateError;
        }
      } else {
        // Criar novo usuário
        console.log('➕ Criando novo usuário...');
        try {
          // ✅ CORREÇÃO: Derivar nivel_acesso do perfil_acesso_id
          const perfilSelecionado = perfisAcesso.find(p => p.id === formData.perfil_acesso_id);
          const nivelAcessoDerivado = perfilSelecionado?.codigo || formData.nivel_acesso;

          // Filtrar apenas campos que existem na tabela usuarios e tratar campos de data
          const camposValidos = {
            nome: formData.nome,
            email: formData.email,
            departamento: formData.departamento,
            cargo: formData.cargo,
            matricula: formData.matricula,
            cpf: formData.cpf,
            telefone: formData.telefone,
            telefone_empresarial: formData.telefone_empresarial,
            cnh: formData.cnh,
            validade_cnh: formData.validade_cnh || undefined, // Converter string vazia para undefined
            cnh_categoria: formData.cnh_categoria,
            nivel_acesso: nivelAcessoDerivado, // ✅ CORREÇÃO: Usar nivel_acesso derivado do perfil_id
            perfil_acesso_id: formData.perfil_acesso_id, // ✅ CORREÇÃO: Enviar perfil_acesso_id para a API derivar nivel_acesso
            operacao: formData.operacao || undefined, // ✅ CORREÇÃO: Converter string vazia para undefined
            status: formData.status,
            data_admissao: formData.data_admissao || undefined, // Converter string vazia para undefined
            data_nascimento: formData.data_nascimento || undefined // Converter string vazia para undefined
            // Removendo 'turno' que não existe na tabela
          };

          console.log('📤 Dados sendo enviados para criação:', {
            camposValidos: camposValidos,
            camposRemovidos: ['turno'], // Campos que foram removidos
            camposConvertidos: ['validade_cnh', 'data_admissao', 'data_nascimento'] // Campos convertidos de string vazia para null
          });

          const newUser = await userService.create(camposValidos);
          console.log('✅ Usuário criado com sucesso:', newUser);
          setSelectedUser(newUser);
        } catch (createError) {
          console.error('❌ Erro ao criar usuário:', createError);
          throw createError;
        }
      }

      // Salvar permissões modulares
      if (selectedUser || formData.nome) {
        console.log('🔐 Processando permissões modulares...');
        const userId = selectedUser?.id || (await userService.getAll()).find(u => u.nome === formData.nome)?.id;
        console.log('🆔 ID do usuário:', userId);
        
        if (userId) {
          try {
            // Remover permissões existentes
            console.log('🗑️ Removendo permissões existentes...');
            // ✅ CORREÇÃO: Remover apenas as permissões que estavam selecionadas anteriormente
            const permissoesUsuarioAnteriores = usuarioPermissoesModulares
              .filter(up => up.usuario_id === userId && up.concedido)
              .map(up => up.funcionalidade_id);
            console.log(`📋 ${permissoesUsuarioAnteriores.length} permissões anteriores encontradas`);
            
            for (const funcionalidadeId of permissoesUsuarioAnteriores) {
              console.log(`🗑️ Removendo permissão: ${funcionalidadeId}`);
              try {
                await modularPermissionService.revokeUserPermissionModular(userId, funcionalidadeId);
              } catch (revokeError) {
                console.error(`❌ Erro ao remover permissão ${funcionalidadeId}:`, revokeError);
                throw revokeError;
              }
            }

            // Adicionar novas permissões
            console.log('➕ Adicionando novas permissões...');
            console.log('🔍 Permissões selecionadas:', selectedPermissions);
            console.log('🔍 ID do usuário:', userId);
            
            for (const funcionalidadeId of selectedPermissions) {
              console.log(`➕ Concedendo permissão: ${funcionalidadeId}`);
              try {
                const result = await modularPermissionService.grantUserPermissionModular({
                  usuario_id: userId,
                  funcionalidade_id: funcionalidadeId,
                  concedido: true,
                  tipo_permissao: 'adicional',
                  motivo: 'Permissão concedida via interface administrativa',
                  concedido_por: undefined, // TODO: Pegar do usuário logado
                  data_inicio: new Date().toISOString(),
                  ativo: true,
                  temporaria: false
                });
                console.log(`✅ Permissão ${funcionalidadeId} salva com sucesso:`, result);
              } catch (grantError) {
                console.error(`❌ Erro ao conceder permissão ${funcionalidadeId}:`, grantError);
                throw grantError;
              }
            }
            console.log('✅ Permissões modulares processadas com sucesso!');
          } catch (permissionsError) {
            console.error('❌ Erro ao processar permissões modulares:', permissionsError);
            throw permissionsError;
          }
        } else {
          console.log('⚠️ ID do usuário não encontrado, pulando permissões modulares');
        }
      }

      console.log('✅ Salvamento concluído com sucesso!');
      setIsEditDialogOpen(false);
      setIsCreateDialogOpen(false);
      onUpdate?.();
    } catch (error) {
      console.error('❌ Erro ao salvar usuário:', error);
      console.error('❌ Detalhes do erro:', {
        message: error instanceof Error ? error.message : 'Erro desconhecido',
        stack: error instanceof Error ? error.stack : undefined,
        error: error
      });
    }
  };

  // Toggle permissão
  const togglePermission = (funcionalidadeId: string) => {
    setSelectedPermissions(prev => 
      prev.includes(funcionalidadeId)
        ? prev.filter(id => id !== funcionalidadeId)
        : [...prev, funcionalidadeId]
    );
  };

  // Agrupar funcionalidades por módulo e plataforma
  const funcionalidadesPorModulo = modulosSistema.map(modulo => {
    const funcionalidadesModulo = funcionalidadesModulares.filter(f => f.modulo_id === modulo.id);
    
    
    const funcionalidadesPorPlataforma = plataformas.map(plataforma => {
      const funcionalidadesPlataforma = funcionalidadesModulo.filter(f => f.plataforma_id === plataforma.id);
      
      return {
        ...plataforma,
        funcionalidades: funcionalidadesPlataforma,
        total: funcionalidadesPlataforma.length
      };
    });

    return {
      ...modulo,
      plataformas: funcionalidadesPorPlataforma,
      totalFuncionalidades: funcionalidadesModulo.length
    };
  });

  if (loading) {
    return (
      <div className="text-center p-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Carregando editor de usuários...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">👥 Editor de Usuários e Permissões</h2>
          <p className="text-gray-600 mt-1">
            Gerencie usuários e suas permissões modulares (113 funcionalidades)
          </p>
        </div>
        <Button onClick={openCreateDialog} className="bg-green-600 hover:bg-green-700">
          <PlusIcon className="h-4 w-4 mr-2" />
          Criar Usuário
        </Button>
      </div>

      {/* Lista de Usuários */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UsersIcon className="h-5 w-5" />
            Usuários ({usuarios.length})
          </CardTitle>
          <CardDescription>
            Clique em um usuário para editar suas permissões modulares
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {usuarios.map(usuario => {
              const permissoesUsuario = usuarioPermissoesModulares.filter(up => up.usuario_id === usuario.id);
              return (
                <div key={usuario.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer" onClick={() => openEditDialog(usuario)}>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-gray-900">{usuario.nome}</h3>
                    <Badge variant={
                      usuario.status === 'ativo' ? "default" : 
                      usuario.status === 'suspenso' ? "secondary" : "secondary"
                    }>
                      {usuario.status === 'ativo' ? 'Ativo' : 
                       usuario.status === 'suspenso' ? 'Suspenso' : usuario.status}
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-600 mb-2">{usuario.email}</p>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span>Nível:</span>
                      <Badge variant="outline">{usuario.nivel_acesso}</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>Permissões Modulares:</span>
                      <Badge variant="outline">{permissoesUsuario.length}</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>Departamento:</span>
                      <span className="text-gray-600">{usuario.departamento || 'N/A'}</span>
                    </div>
                  </div>
                  <Button size="sm" className="w-full mt-3" onClick={(e) => { e.stopPropagation(); openEditDialog(usuario); }}>
                    <PencilIcon className="h-4 w-4 mr-2" />
                    Editar
                  </Button>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Diálogo de Edição/Criação */}
      <Dialog open={isEditDialogOpen || isCreateDialogOpen} onOpenChange={(open) => {
        if (!open) {
          setIsEditDialogOpen(false);
          setIsCreateDialogOpen(false);
        }
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedUser ? 'Editar Usuário' : 'Criar Novo Usuário'}
            </DialogTitle>
            <DialogDescription>
              {selectedUser ? 'Edite as informações do usuário e suas permissões modulares' : 'Crie um novo usuário e configure suas permissões modulares'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Informações Básicas */}
            <Card>
              <CardHeader>
                <CardTitle>Informações Básicas</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Informações Pessoais */}
                <div>
                  <h4 className="text-lg font-semibold mb-4">Informações Pessoais</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="nome">Nome *</Label>
                      <Input
                        id="nome"
                        value={formData.nome}
                        onChange={(e) => setFormData(prev => ({ ...prev, nome: e.target.value }))}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="email">Email *</Label>
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="cpf">CPF</Label>
                      <Input
                        id="cpf"
                        value={formData.cpf}
                        onChange={(e) => setFormData(prev => ({ ...prev, cpf: e.target.value }))}
                        placeholder="000.000.000-00"
                      />
                    </div>
                    <div>
                      <Label htmlFor="data_nascimento">Data de Nascimento</Label>
                      <DateInput
                        id="data_nascimento"
                        value={formData.data_nascimento}
                        onChange={(value) => setFormData(prev => ({ ...prev, data_nascimento: value }))}
                        placeholder="DD/MM/AAAA"
                      />
                    </div>
                    <div>
                      <Label htmlFor="telefone">Telefone Pessoal</Label>
                      <Input
                        id="telefone"
                        value={formData.telefone}
                        onChange={(e) => setFormData(prev => ({ ...prev, telefone: e.target.value }))}
                        placeholder="(00) 00000-0000"
                      />
                    </div>
                    <div>
                      <Label htmlFor="telefone_empresarial">Telefone Empresarial</Label>
                      <Input
                        id="telefone_empresarial"
                        value={formData.telefone_empresarial}
                        onChange={(e) => setFormData(prev => ({ ...prev, telefone_empresarial: e.target.value }))}
                        placeholder="(00) 00000-0000"
                      />
                    </div>
                  </div>
                </div>

                {/* Informações Profissionais */}
                <div>
                  <h4 className="text-lg font-semibold mb-4">Informações Profissionais</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="matricula">Matrícula</Label>
                      <Input
                        id="matricula"
                        value={formData.matricula}
                        onChange={(e) => setFormData(prev => ({ ...prev, matricula: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="departamento">Departamento</Label>
                      <Input
                        id="departamento"
                        value={formData.departamento}
                        onChange={(e) => setFormData(prev => ({ ...prev, departamento: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="cargo">Cargo</Label>
                      <Input
                        id="cargo"
                        value={formData.cargo}
                        onChange={(e) => setFormData(prev => ({ ...prev, cargo: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="operacao">Operação</Label>
                      <Input
                        id="operacao"
                        value={formData.operacao}
                        onChange={(e) => setFormData(prev => ({ ...prev, operacao: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="turno">Turno</Label>
                      <Select value={formData.turno} onValueChange={(value) => setFormData(prev => ({ ...prev, turno: value }))}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o turno" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="manha">Manhã</SelectItem>
                          <SelectItem value="tarde">Tarde</SelectItem>
                          <SelectItem value="noite">Noite</SelectItem>
                          <SelectItem value="integral">Integral</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="data_admissao">Data de Admissão</Label>
                      <DateInput
                        id="data_admissao"
                        value={formData.data_admissao}
                        onChange={(value) => setFormData(prev => ({ ...prev, data_admissao: value }))}
                        placeholder="DD/MM/AAAA"
                      />
                    </div>
                  </div>
                </div>

                {/* Informações de Acesso */}
                <div>
                  <h4 className="text-lg font-semibold mb-4">Informações de Acesso</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="perfil_acesso_id">Perfil de Acesso *</Label>
                      <Select value={formData.perfil_acesso_id} onValueChange={(value) => {
                        const perfilSelecionado = perfisAcesso.find(p => p.id === value);
                        setFormData(prev => ({ 
                          ...prev, 
                          perfil_acesso_id: value,
                          nivel_acesso: perfilSelecionado?.codigo || prev.nivel_acesso // ✅ CORREÇÃO: Deriva nivel_acesso do perfil
                        }));
                      }}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o perfil de acesso" />
                        </SelectTrigger>
                        <SelectContent>
                          {perfisAcesso.map(perfil => (
                            <SelectItem key={perfil.id} value={perfil.id}>
                              {perfil.nome} ({perfil.codigo})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {formData.nivel_acesso && (
                        <p className="text-sm text-gray-500 mt-1">
                          Nível de acesso: <span className="font-medium">{formData.nivel_acesso}</span>
                        </p>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="status">Status</Label>
                      <Select value={formData.status} onValueChange={(value) => setFormData(prev => ({ ...prev, status: value }))}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ativo">Ativo</SelectItem>
                          <SelectItem value="inativo">Inativo</SelectItem>
                          <SelectItem value="suspenso">Suspenso</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                {/* Informações da CNH */}
                <div>
                  <h4 className="text-lg font-semibold mb-4">Informações da CNH</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="cnh">Número da CNH</Label>
                      <Input
                        id="cnh"
                        value={formData.cnh}
                        onChange={(e) => setFormData(prev => ({ ...prev, cnh: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="validade_cnh">Validade da CNH</Label>
                      <DateInput
                        id="validade_cnh"
                        value={formData.validade_cnh}
                        onChange={(value) => setFormData(prev => ({ ...prev, validade_cnh: value }))}
                        placeholder="DD/MM/AAAA"
                      />
                    </div>
                    <div>
                      <Label htmlFor="cnh_categoria">Categoria da CNH</Label>
                      <Select value={formData.cnh_categoria} onValueChange={(value) => setFormData(prev => ({ ...prev, cnh_categoria: value }))}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione a categoria" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="A">A</SelectItem>
                          <SelectItem value="B">B</SelectItem>
                          <SelectItem value="C">C</SelectItem>
                          <SelectItem value="D">D</SelectItem>
                          <SelectItem value="E">E</SelectItem>
                          <SelectItem value="AB">AB</SelectItem>
                          <SelectItem value="AC">AC</SelectItem>
                          <SelectItem value="AD">AD</SelectItem>
                          <SelectItem value="AE">AE</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Permissões Modulares */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <KeyIcon className="h-5 w-5" />
                  Permissões Modulares ({selectedPermissions.length} selecionadas)
                </CardTitle>
                <CardDescription>
                  Selecione as funcionalidades modulares que este usuário pode acessar
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {funcionalidadesPorModulo.map(modulo => (
                    <div key={modulo.id} className="border rounded-lg p-4">
                      <h3 className="font-semibold text-gray-900 mb-4">{modulo.nome}</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {modulo.plataformas.map(plataforma => (
                          <div key={plataforma.id} className={`p-4 rounded-lg border-l-4 ${
                            plataforma.id === 'site' 
                              ? 'bg-blue-50 border-blue-400' 
                              : 'bg-green-50 border-green-400'
                          }`}>
                            <div className="flex items-center gap-3 mb-4">
                              {plataforma.id === 'site' ? (
                                <ComputerDesktopIcon className="h-6 w-6 text-blue-600" />
                              ) : (
                                <DevicePhoneMobileIcon className="h-6 w-6 text-green-600" />
                              )}
                              <h4 className="font-semibold">{plataforma.nome}</h4>
                              <Badge variant="outline">{plataforma.total} funcionalidades</Badge>
                            </div>
                            <div className="space-y-2">
                              {plataforma.funcionalidades.map(funcionalidade => (
                                <div key={funcionalidade.id} className="flex items-center space-x-2">
                                  <Checkbox
                                    id={funcionalidade.id}
                                    checked={selectedPermissions.includes(funcionalidade.id)}
                                    onCheckedChange={() => togglePermission(funcionalidade.id)}
                                  />
                                  <Label htmlFor={funcionalidade.id} className="text-sm">
                                    {funcionalidade.nome}
                                  </Label>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Botões de Ação */}
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => {
                setIsEditDialogOpen(false);
                setIsCreateDialogOpen(false);
              }}>
                Cancelar
              </Button>
              <Button onClick={saveUser} className="bg-blue-600 hover:bg-blue-700">
                {selectedUser ? 'Salvar Alterações' : 'Criar Usuário'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
