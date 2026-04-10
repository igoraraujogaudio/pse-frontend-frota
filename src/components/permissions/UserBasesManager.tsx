'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { 
  MagnifyingGlassIcon, 
  UserIcon, 
  BuildingOfficeIcon,
  PlusIcon,
  CheckCircleIcon,
  XCircleIcon
} from '@heroicons/react/24/outline';
import type { User } from '@/types';
import type { Base, Contrato, UsuarioBase, UsuarioContrato } from '@/types/contratos';
import { userService } from '@/services/userService';
import { baseService } from '@/services/baseService';
import { contratoService } from '@/services/contratoService';

interface Props {
  usuarios: User[];
  onUserUpdate?: () => Promise<void>;
}

export default function UserBasesManager({ usuarios, onUserUpdate }: Props) {
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCargo, setFilterCargo] = useState('');
  const [filterOperacao, setFilterOperacao] = useState('');
  const [filterDepartamento, setFilterDepartamento] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [userBases, setUserBases] = useState<UsuarioBase[]>([]);
  const [userContratos, setUserContratos] = useState<UsuarioContrato[]>([]);
  const [availableBases, setAvailableBases] = useState<Base[]>([]);
  const [availableContratos, setAvailableContratos] = useState<Contrato[]>([]);
  const [showBasesDialog, setShowBasesDialog] = useState(false);
  const [showContratosDialog, setShowContratosDialog] = useState(false);
  const [selectedBases, setSelectedBases] = useState<string[]>([]);
  const [selectedContratos, setSelectedContratos] = useState<string[]>([]);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // Obter valores únicos para os filtros
  const cargosUnicos = [...new Set(usuarios.map(u => u.cargo).filter(Boolean))];
  const operacoesUnicas = [...new Set(usuarios.map(u => u.operacao).filter(Boolean))];
  const departamentosUnicos = [...new Set(usuarios.map(u => u.departamento).filter(Boolean))];

  // Filtrar usuários baseado na busca e filtros
  const filteredUsers = usuarios.filter(user => {
    const matchesSearch = !searchTerm || 
      user.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.cpf?.includes(searchTerm) ||
      user.cargo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.operacao?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.departamento?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.posicao?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesCargo = !filterCargo || filterCargo === 'all' || user.cargo === filterCargo;
    const matchesOperacao = !filterOperacao || filterOperacao === 'all' || user.operacao === filterOperacao;
    const matchesDepartamento = !filterDepartamento || filterDepartamento === 'all' || user.departamento === filterDepartamento;

    return matchesSearch && matchesCargo && matchesOperacao && matchesDepartamento;
  });

  // Carregar dados iniciais
  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      const [basesData, contratosData] = await Promise.all([
        baseService.getBases(),
        contratoService.getAll()
      ]);
      setAvailableBases(basesData);
      setAvailableContratos(contratosData);
    } catch (error) {
      console.error('Erro ao carregar dados iniciais:', error);
      setMessage({ type: 'error', text: 'Erro ao carregar dados iniciais' });
    } finally {
      setLoading(false);
    }
  };

  const loadUserData = async (user: User) => {
    try {
      setLoading(true);
      const [basesData, contratosData] = await Promise.all([
        userService.getUserBases(user.id),
        userService.getUserContratos(user.id)
      ]);
      
      setUserBases(basesData);
      setUserContratos(contratosData as UsuarioContrato[]);
      setSelectedUser(user);
    } catch (error) {
      console.error('Erro ao carregar dados do usuário:', error);
      setMessage({ type: 'error', text: 'Erro ao carregar dados do usuário' });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenBasesDialog = (user: User) => {
    setSelectedUser(user);
    setSelectedBases(userBases.filter(ub => ub.ativo).map(ub => ub.base_id));
    setShowBasesDialog(true);
  };

  const handleOpenContratosDialog = (user: User) => {
    setSelectedUser(user);
    setSelectedContratos(userContratos.filter(uc => uc.ativo).map(uc => uc.contrato_id));
    setShowContratosDialog(true);
  };

  const handleUpdateUserBases = async () => {
    if (!selectedUser) return;

    try {
      setLoading(true);
      await userService.updateUserBases(selectedUser.id, selectedBases);
      setMessage({ type: 'success', text: 'Bases do usuário atualizadas com sucesso!' });
      setShowBasesDialog(false);
      
      // Recarregar dados do usuário
      await loadUserData(selectedUser);
      
      // Notificar componente pai se necessário
      if (onUserUpdate) {
        await onUserUpdate();
      }
    } catch (error) {
      console.error('Erro ao atualizar bases do usuário:', error);
      setMessage({ type: 'error', text: 'Erro ao atualizar bases do usuário' });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateUserContratos = async () => {
    if (!selectedUser) return;

    try {
      setLoading(true);
      await userService.updateUserContratos(selectedUser.id, selectedContratos);
      setMessage({ type: 'success', text: 'Contratos do usuário atualizados com sucesso!' });
      setShowContratosDialog(false);
      
      // Recarregar dados do usuário
      await loadUserData(selectedUser);
      
      // Notificar componente pai se necessário
      if (onUserUpdate) {
        await onUserUpdate();
      }
    } catch (error) {
      console.error('Erro ao atualizar contratos do usuário:', error);
      setMessage({ type: 'error', text: 'Erro ao atualizar contratos do usuário' });
    } finally {
      setLoading(false);
    }
  };

  const clearMessage = () => {
    setTimeout(() => setMessage(null), 5000);
  };

  useEffect(() => {
    if (message) {
      clearMessage();
    }
  }, [message]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BuildingOfficeIcon className="h-5 w-5" />
            Gerenciamento de Bases e Contratos dos Usuários
          </CardTitle>
          <CardDescription>
            Visualize e gerencie as bases e contratos associados a cada usuário do sistema
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Mensagens */}
      {message && (
        <div className={`p-4 rounded-md ${
          message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' :
          message.type === 'error' ? 'bg-red-50 text-red-800 border border-red-200' :
          'bg-blue-50 text-blue-800 border border-blue-200'
        }`}>
          {message.text}
        </div>
      )}

      {/* Busca e Filtros */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-4">
            {/* Campo de busca principal */}
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Buscar usuários por nome, email, CPF, cargo, operação, departamento ou posição..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            {/* Filtros adicionais */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="filter-cargo" className="text-sm font-medium text-gray-700">
                  Filtrar por Cargo
                </Label>
                <Select value={filterCargo} onValueChange={setFilterCargo}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos os cargos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os cargos</SelectItem>
                    {cargosUnicos.map(cargo => (
                      <SelectItem key={cargo} value={cargo!}>{cargo}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="filter-operacao" className="text-sm font-medium text-gray-700">
                  Filtrar por Operação
                </Label>
                <Select value={filterOperacao} onValueChange={setFilterOperacao}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todas as operações" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as operações</SelectItem>
                    {operacoesUnicas.map(operacao => (
                      <SelectItem key={operacao} value={operacao!}>{operacao}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="filter-departamento" className="text-sm font-medium text-gray-700">
                  Filtrar por Departamento
                </Label>
                <Select value={filterDepartamento} onValueChange={setFilterDepartamento}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos os departamentos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os departamentos</SelectItem>
                    {departamentosUnicos.map(departamento => (
                      <SelectItem key={departamento} value={departamento!}>{departamento}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            {/* Contador de resultados */}
            <div className="text-sm text-gray-600">
              Mostrando {filteredUsers.length} de {usuarios.length} usuários
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Usuários */}
      <div className="grid gap-4">
        {filteredUsers.map((user) => (
          <Card key={user.id} className="hover:shadow-md transition-shadow">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <UserIcon className="h-5 w-5 text-gray-500" />
                    <div>
                      <h3 className="font-semibold text-lg">{user.nome}</h3>
                      <p className="text-sm text-gray-600">{user.email}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline">{user.nivel_acesso}</Badge>
                        {user.status === 'ativo' ? (
                          <Badge variant="default" className="bg-green-100 text-green-800">
                            <CheckCircleIcon className="h-3 w-3 mr-1" />
                            Ativo
                          </Badge>
                        ) : (
                          <Badge variant="destructive">
                            <XCircleIcon className="h-3 w-3 mr-1" />
                            Inativo
                          </Badge>
                        )}
                      </div>
                      {/* Informações adicionais */}
                      <div className="mt-2 space-y-1">
                        {user.cargo && (
                          <p className="text-xs text-gray-500">
                            <span className="font-medium">Cargo:</span> {user.cargo}
                          </p>
                        )}
                        {user.operacao && (
                          <p className="text-xs text-gray-500">
                            <span className="font-medium">Operação:</span> {user.operacao}
                          </p>
                        )}
                        {user.departamento && (
                          <p className="text-xs text-gray-500">
                            <span className="font-medium">Departamento:</span> {user.departamento}
                          </p>
                        )}
                        {user.posicao && (
                          <p className="text-xs text-gray-500">
                            <span className="font-medium">Posição:</span> {user.posicao}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => loadUserData(user)}
                    disabled={loading}
                  >
                    <BuildingOfficeIcon className="h-4 w-4 mr-2" />
                    Ver Detalhes
                  </Button>
                </div>
              </div>

              {/* Detalhes do usuário selecionado */}
              {selectedUser?.id === user.id && (
                <div className="mt-4 pt-4 border-t">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Bases */}
                    <div>
                      <h4 className="font-medium mb-2">Bases Associadas</h4>
                      <div className="space-y-2">
                        {userBases.filter(ub => ub.ativo).length > 0 ? (
                          userBases.filter(ub => ub.ativo).map((userBase) => (
                            <div key={userBase.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                              <span className="text-sm">
                                {userBase.base?.nome || `Base ID: ${userBase.base_id}`}
                              </span>
                              <Badge variant="outline" className="text-xs">
                                {userBase.tipo_acesso}
                              </Badge>
                            </div>
                          ))
                        ) : (
                          <p className="text-sm text-gray-500">Nenhuma base associada</p>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenBasesDialog(user)}
                          className="w-full"
                        >
                          <PlusIcon className="h-4 w-4 mr-2" />
                          Gerenciar Bases
                        </Button>
                      </div>
                    </div>

                    {/* Contratos */}
                    <div>
                      <h4 className="font-medium mb-2">Contratos Associados</h4>
                      <div className="space-y-2">
                        {userContratos.filter(uc => uc.ativo).length > 0 ? (
                          userContratos.filter(uc => uc.ativo).map((userContrato) => (
                            <div key={userContrato.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                              <span className="text-sm">
                                {userContrato.contrato?.nome || `Contrato ID: ${userContrato.contrato_id}`}
                              </span>
                              <Badge variant="outline" className="text-xs">
                                {userContrato.perfil_contrato}
                              </Badge>
                            </div>
                          ))
                        ) : (
                          <p className="text-sm text-gray-500">Nenhum contrato associado</p>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenContratosDialog(user)}
                          className="w-full"
                        >
                          <PlusIcon className="h-4 w-4 mr-2" />
                          Gerenciar Contratos
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Dialog para gerenciar bases */}
      <Dialog open={showBasesDialog} onOpenChange={setShowBasesDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Gerenciar Bases - {selectedUser?.nome}</DialogTitle>
            <DialogDescription>
              Selecione as bases às quais este usuário terá acesso
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="grid gap-2">
              {availableBases.map((base) => (
                <div key={base.id} className="flex items-center space-x-2">
                  <Switch
                    id={`base-${base.id}`}
                    checked={selectedBases.includes(base.id)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedBases([...selectedBases, base.id]);
                      } else {
                        setSelectedBases(selectedBases.filter(id => id !== base.id));
                      }
                    }}
                  />
                  <Label htmlFor={`base-${base.id}`} className="flex-1">
                    <div className="flex items-center justify-between">
                      <span>{base.nome}</span>
                      <Badge variant="outline" className="text-xs">
                        {base.codigo}
                      </Badge>
                    </div>
                  </Label>
                </div>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBasesDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleUpdateUserBases} disabled={loading}>
              {loading ? 'Salvando...' : 'Salvar Alterações'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog para gerenciar contratos */}
      <Dialog open={showContratosDialog} onOpenChange={setShowContratosDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Gerenciar Contratos - {selectedUser?.nome}</DialogTitle>
            <DialogDescription>
              Selecione os contratos aos quais este usuário terá acesso
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="grid gap-2">
              {availableContratos.map((contrato) => (
                <div key={contrato.id} className="flex items-center space-x-2">
                  <Switch
                    id={`contrato-${contrato.id}`}
                    checked={selectedContratos.includes(contrato.id)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedContratos([...selectedContratos, contrato.id]);
                      } else {
                        setSelectedContratos(selectedContratos.filter(id => id !== contrato.id));
                      }
                    }}
                  />
                  <Label htmlFor={`contrato-${contrato.id}`} className="flex-1">
                    <div className="flex items-center justify-between">
                      <span>{contrato.nome}</span>
                      <Badge variant="outline" className="text-xs">
                        {contrato.codigo}
                      </Badge>
                    </div>
                  </Label>
                </div>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowContratosDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleUpdateUserContratos} disabled={loading}>
              {loading ? 'Salvando...' : 'Salvar Alterações'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
