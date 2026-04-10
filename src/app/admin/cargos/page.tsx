'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useModularPermissions, PERMISSION_CODES } from '@/hooks/useModularPermissions';
import { 
  getNivelAcessoByPerfil,
  getNomePerfilById
} from '@/utils/perfilUtils';
import { 
  PlusIcon, 
  PencilIcon, 
  TrashIcon, 
  UsersIcon, 
  ShieldCheckIcon 
} from '@heroicons/react/24/outline';

interface Cargo {
  id: string;
  nome: string;
  nivel_acesso: string;
  perfil_acesso_id?: string;
  ativo: boolean;
  criado_em: string;
  atualizado_em: string;
}

interface PerfilAcesso {
  id: string;
  codigo: string;
  nome: string;
  descricao?: string;
  nivel_hierarquia: number;
  cor?: string;
  ativo: boolean;
}

export default function CargosPage() {
  const [cargos, setCargos] = useState<Cargo[]>([]);
  const [perfisAcesso, setPerfisAcesso] = useState<PerfilAcesso[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isNiveisDialogOpen, setIsNiveisDialogOpen] = useState(false);
  const [editingCargo, setEditingCargo] = useState<Cargo | null>(null);
  const [editingPerfil, setEditingPerfil] = useState<PerfilAcesso | null>(null);
  const [formData, setFormData] = useState({
    nome: '',
    nivel_acesso: '',
    perfil_acesso_id: ''
  });
  const [nivelFormData, setNivelFormData] = useState({
    codigo: '',
    nome: '',
    descricao: '',
    nivel_hierarquia: 0,
    cor: '#6b7280'
  });

  // Verificar permissão
  const { hasPermission } = useModularPermissions();
  const canManageCargos = hasPermission(PERMISSION_CODES.FUNCIONARIOS.GERENCIAR_CARGOS);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Carregar cargos
      const cargosResponse = await fetch('/api/cargos');
      if (cargosResponse.ok) {
        const cargosData = await cargosResponse.json();
        setCargos(cargosData.cargos || []);
      }

      // Carregar perfis de acesso
      const perfisResponse = await fetch('/api/perfis-acesso');
      if (perfisResponse.ok) {
        const perfisData = await perfisResponse.json();
        setPerfisAcesso(perfisData.perfis || []);
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCargo = async () => {
    // Validação
    if (!formData.nome.trim()) {
      alert('Nome do cargo é obrigatório');
      return;
    }
    if (!formData.nivel_acesso) {
      alert('Nível de acesso é obrigatório');
      return;
    }
    if (!formData.perfil_acesso_id) {
      alert('Perfil de acesso é obrigatório');
      return;
    }

    try {
      const response = await fetch('/api/cargos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        await loadData();
        setIsCreateDialogOpen(false);
        setFormData({ nome: '', nivel_acesso: '', perfil_acesso_id: '' });
      } else {
        const error = await response.json();
        alert(`Erro ao criar cargo: ${error.error || 'Erro desconhecido'}`);
      }
    } catch (error) {
      console.error('Erro ao criar cargo:', error);
      alert('Erro ao criar cargo');
    }
  };

  const handleUpdateCargo = async () => {
    if (!editingCargo) return;

    // Validação
    if (!formData.nivel_acesso) {
      alert('Nível de acesso é obrigatório');
      return;
    }
    if (!formData.perfil_acesso_id) {
      alert('Perfil de acesso é obrigatório');
      return;
    }

    try {
      const response = await fetch(`/api/cargos/${editingCargo.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nivel_acesso: formData.nivel_acesso,
          perfil_acesso_id: formData.perfil_acesso_id
        })
      });

      if (response.ok) {
        await loadData();
        setIsEditDialogOpen(false);
        setEditingCargo(null);
        setFormData({ nome: '', nivel_acesso: '', perfil_acesso_id: '' });
      } else {
        const error = await response.json();
        alert(`Erro ao atualizar cargo: ${error.error || 'Erro desconhecido'}`);
      }
    } catch (error) {
      console.error('Erro ao atualizar cargo:', error);
      alert('Erro ao atualizar cargo');
    }
  };

  const handleDeleteCargo = async (cargoId: string) => {
    if (!confirm('Tem certeza que deseja desativar este cargo?')) return;

    try {
      const response = await fetch(`/api/cargos/${cargoId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        await loadData();
      }
    } catch (error) {
      console.error('Erro ao desativar cargo:', error);
    }
  };

  const handleCreateNivel = async () => {
    // Validação
    if (!nivelFormData.codigo.trim()) {
      alert('Código do nível é obrigatório');
      return;
    }
    if (!nivelFormData.nome.trim()) {
      alert('Nome do nível é obrigatório');
      return;
    }
    if (nivelFormData.nivel_hierarquia <= 0) {
      alert('Nível de hierarquia deve ser maior que 0');
      return;
    }

    try {
      const response = await fetch('/api/perfis-acesso', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nivelFormData)
      });

      if (response.ok) {
        await loadData();
        setIsNiveisDialogOpen(false);
        setNivelFormData({ codigo: '', nome: '', descricao: '', nivel_hierarquia: 0, cor: '#6b7280' });
        alert('Perfil de acesso criado com sucesso!');
      } else {
        const error = await response.json();
        alert(`Erro ao criar perfil: ${error.error || 'Erro desconhecido'}`);
      }
    } catch (error) {
      console.error('Erro ao criar perfil:', error);
      alert('Erro ao criar perfil de acesso');
    }
  };

  const handleUpdateNivel = async () => {
    if (!editingPerfil) return;

    // Validação
    if (!nivelFormData.codigo.trim()) {
      alert('Código do nível é obrigatório');
      return;
    }
    if (!nivelFormData.nome.trim()) {
      alert('Nome do nível é obrigatório');
      return;
    }
    if (nivelFormData.nivel_hierarquia <= 0) {
      alert('Nível de hierarquia deve ser maior que 0');
      return;
    }

    try {
      const response = await fetch(`/api/perfis-acesso/${editingPerfil.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nivelFormData)
      });

      if (response.ok) {
        await loadData();
        setEditingPerfil(null);
        setNivelFormData({ codigo: '', nome: '', descricao: '', nivel_hierarquia: 0, cor: '#6b7280' });
        alert('Perfil de acesso atualizado com sucesso!');
      } else {
        const error = await response.json();
        alert(`Erro ao atualizar perfil: ${error.error || 'Erro desconhecido'}`);
      }
    } catch (error) {
      console.error('Erro ao atualizar perfil:', error);
      alert('Erro ao atualizar perfil de acesso');
    }
  };

  const handleDeleteNivel = async (perfilId: string) => {
    if (!confirm('Tem certeza que deseja desativar este perfil de acesso?')) return;

    try {
      const response = await fetch(`/api/perfis-acesso/${perfilId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        await loadData();
        alert('Perfil de acesso desativado com sucesso!');
      } else {
        const error = await response.json();
        alert(`Erro ao desativar perfil: ${error.error || 'Erro desconhecido'}`);
      }
    } catch (error) {
      console.error('Erro ao desativar perfil:', error);
      alert('Erro ao desativar perfil de acesso');
    }
  };

  const openEditDialog = (cargo: Cargo) => {
    setEditingCargo(cargo);
    setFormData({
      nome: cargo.nome,
      nivel_acesso: cargo.nivel_acesso,
      perfil_acesso_id: cargo.perfil_acesso_id || ''
    });
    setIsEditDialogOpen(true);
  };

  const filteredCargos = cargos.filter(cargo => {
    const nomeMatch = cargo.nome.toLowerCase().includes(searchTerm.toLowerCase());
    const nivelMatch = cargo.nivel_acesso.toLowerCase().includes(searchTerm.toLowerCase());
    const perfilMatch = cargo.perfil_acesso_id ? 
      getNomePerfilById(cargo.perfil_acesso_id, perfisAcesso).toLowerCase().includes(searchTerm.toLowerCase()) : false;
    
    return nomeMatch || nivelMatch || perfilMatch;
  });

  // Função para obter nível de acesso pelo perfil (usando utilitário)
  const getNivelAcesso = (perfilId: string) => {
    return getNivelAcessoByPerfil(perfilId, perfisAcesso);
  };

  const getNivelAcessoColor = (nivel: string) => {
    const colors: Record<string, string> = {
      admin: 'bg-red-100 text-red-800',
      diretor: 'bg-orange-100 text-orange-800',
      manager: 'bg-yellow-100 text-yellow-800',
      gerente: 'bg-amber-100 text-amber-800',
      fleet_manager: 'bg-green-100 text-green-800',
      gestor: 'bg-emerald-100 text-emerald-800',
      gestor_almoxarifado: 'bg-teal-100 text-teal-800',
      coordenador: 'bg-cyan-100 text-cyan-800',
      supervisor: 'bg-blue-100 text-blue-800',
      almoxarifado: 'bg-indigo-100 text-indigo-800',
      operacao: 'bg-gray-100 text-gray-800',
      rh: 'bg-purple-100 text-purple-800',
      portaria: 'bg-pink-100 text-pink-800',
      financeiro: 'bg-indigo-100 text-indigo-800',
      engenheiro_seguranca: 'bg-red-100 text-red-800',
      tst: 'bg-orange-100 text-orange-800'
    };
    return colors[nivel] || 'bg-gray-100 text-gray-800';
  };

  // Debug: mostrar informações de permissão
  console.log('🔍 DEBUG - Permissões:', {
    canManageCargos,
    permissionCode: PERMISSION_CODES.FUNCIONARIOS.GERENCIAR_CARGOS
  });

  if (!canManageCargos) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="bg-red-100 p-6 rounded-lg">
            <h1 className="text-2xl font-bold text-red-800 mb-2">Acesso Negado</h1>
            <p className="text-red-600">Você não tem permissão para gerenciar cargos.</p>
            <p className="text-sm text-red-500 mt-2">
              Permissão necessária: {PERMISSION_CODES.FUNCIONARIOS.GERENCIAR_CARGOS}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Gerenciar Cargos</h1>
        <p className="text-gray-600 mt-2">
          Gerencie os cargos e níveis de acesso do sistema
        </p>
      </div>

      {/* Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="bg-blue-500 p-3 rounded-full">
                <UsersIcon className="h-6 w-6 text-white" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-blue-700">Total de Cargos</p>
                <p className="text-2xl font-bold text-blue-900">{cargos.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="bg-green-500 p-3 rounded-full">
                <ShieldCheckIcon className="h-6 w-6 text-white" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-green-700">Perfis de Acesso</p>
                <p className="text-2xl font-bold text-green-900">{perfisAcesso.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="bg-purple-500 p-3 rounded-full">
                <UsersIcon className="h-6 w-6 text-white" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-purple-700">Níveis de Acesso</p>
                <p className="text-2xl font-bold text-purple-900">
                  {new Set(cargos.map(c => c.perfil_acesso_id ? getNivelAcesso(c.perfil_acesso_id) : c.nivel_acesso)).size}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Controls */}
      <Card className="mb-8">
        <CardHeader>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <CardTitle>Lista de Cargos</CardTitle>
              <CardDescription>
                Gerencie os cargos e seus respectivos níveis de acesso
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Buscar cargos..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-64"
              />
              <Dialog open={isNiveisDialogOpen} onOpenChange={setIsNiveisDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline">
                    <ShieldCheckIcon className="h-4 w-4 mr-2" />
                    Gerenciar Perfis
                  </Button>
                </DialogTrigger>
              </Dialog>
              <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <PlusIcon className="h-4 w-4 mr-2" />
                    Novo Cargo
                  </Button>
                </DialogTrigger>
              </Dialog>
              {/* Botão de teste temporário */}
              <Button 
                variant="outline" 
                onClick={() => {
                  console.log('🔍 DEBUG - Estado atual:', {
                    canManageCargos,
                    cargos: cargos.length,
                    perfisAcesso: perfisAcesso.length,
                    loading
                  });
                  alert(`Permissão: ${canManageCargos ? 'SIM' : 'NÃO'}\nCargos: ${cargos.length}\nPerfis: ${perfisAcesso.length}`);
                }}
              >
                🔍 Debug
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Lista de Cargos */}
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <CardTitle>Lista de Cargos</CardTitle>
              <CardDescription>
                Gerencie os cargos e seus respectivos níveis de acesso
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredCargos.map((cargo) => (
                  <div key={cargo.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                        <UsersIcon className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="font-medium">{cargo.nome}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          {cargo.perfil_acesso_id ? (
                            <>
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${getNivelAcessoColor(getNivelAcesso(cargo.perfil_acesso_id))}`}>
                                {getNivelAcesso(cargo.perfil_acesso_id)}
                              </span>
                              <span className="text-xs text-gray-500">
                                Perfil: {getNomePerfilById(cargo.perfil_acesso_id, perfisAcesso)}
                              </span>
                            </>
                          ) : (
                            <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                              {cargo.nivel_acesso} (legado)
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEditDialog(cargo)}
                      >
                        <PencilIcon className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteCargo(cargo.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                {filteredCargos.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    Nenhum cargo encontrado
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

      {/* Dialogs */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Criar Novo Cargo</DialogTitle>
            <DialogDescription>
              Adicione um novo cargo ao sistema
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="nome">Nome do Cargo</Label>
              <Input
                id="nome"
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                placeholder="Ex: Supervisor de Operações"
              />
            </div>
            <div>
              <Label htmlFor="nivel_acesso">Nível de Acesso</Label>
              <Select value={formData.nivel_acesso} onValueChange={(value) => setFormData({ ...formData, nivel_acesso: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o nível de acesso" />
                </SelectTrigger>
                <SelectContent>
                  {perfisAcesso.map((perfil) => (
                    <SelectItem key={perfil.codigo} value={perfil.codigo}>
                      {perfil.nome} - {perfil.descricao}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="perfil_acesso">Perfil de Acesso *</Label>
              <p className="text-xs text-gray-500 mb-2">
                Cada nível de acesso deve estar vinculado a um perfil de acesso específico.
              </p>
              <Select value={formData.perfil_acesso_id} onValueChange={(value) => setFormData({ ...formData, perfil_acesso_id: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o perfil de acesso" />
                </SelectTrigger>
                <SelectContent>
                  {perfisAcesso.map((perfil) => (
                    <SelectItem key={perfil.id} value={perfil.id}>
                      {perfil.nome} - {perfil.descricao}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleCreateCargo}>
                Criar Cargo
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog para editar cargo */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Cargo</DialogTitle>
            <DialogDescription>
              Edite as informações do cargo
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit_nome">Nome do Cargo</Label>
              <Input
                id="edit_nome"
                value={formData.nome}
                disabled
                className="bg-gray-50"
              />
            </div>
            <div>
              <Label htmlFor="edit_nivel_acesso">Nível de Acesso</Label>
              <Select value={formData.nivel_acesso} onValueChange={(value) => setFormData({ ...formData, nivel_acesso: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o nível de acesso" />
                </SelectTrigger>
                <SelectContent>
                  {perfisAcesso.map((perfil) => (
                    <SelectItem key={perfil.codigo} value={perfil.codigo}>
                      {perfil.nome} - {perfil.descricao}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="edit_perfil_acesso">Perfil de Acesso *</Label>
              <p className="text-xs text-gray-500 mb-2">
                Cada nível de acesso deve estar vinculado a um perfil de acesso específico.
              </p>
              <Select value={formData.perfil_acesso_id} onValueChange={(value) => setFormData({ ...formData, perfil_acesso_id: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o perfil de acesso" />
                </SelectTrigger>
                <SelectContent>
                  {perfisAcesso.map((perfil) => (
                    <SelectItem key={perfil.id} value={perfil.id}>
                      {perfil.nome} - {perfil.descricao}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleUpdateCargo}>
                Salvar Alterações
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog para Gerenciar Perfis de Acesso */}
      <Dialog open={isNiveisDialogOpen} onOpenChange={setIsNiveisDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Gerenciar Perfis de Acesso</DialogTitle>
            <DialogDescription>
              Crie e edite perfis de acesso para o sistema. Cada perfil define um nível de acesso com permissões específicas.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* Formulário para criar/editar perfil de acesso */}
            <div className="border rounded-lg p-4">
              <h3 className="text-lg font-semibold mb-4">
                {editingPerfil ? 'Editar Perfil de Acesso' : 'Criar Novo Perfil de Acesso'}
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                Um perfil de acesso define um nível de acesso com permissões específicas. 
                Cada cargo deve estar vinculado a um perfil de acesso.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="codigo">Código do Nível *</Label>
                  <Input
                    id="codigo"
                    value={nivelFormData.codigo}
                    onChange={(e) => setNivelFormData({ ...nivelFormData, codigo: e.target.value })}
                    placeholder="Ex: engenheiro_seguranca, tst, rh"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Código único para identificar o nível de acesso
                  </p>
                </div>
                <div>
                  <Label htmlFor="nome">Nome do Perfil *</Label>
                  <Input
                    id="nome"
                    value={nivelFormData.nome}
                    onChange={(e) => setNivelFormData({ ...nivelFormData, nome: e.target.value })}
                    placeholder="Ex: Engenheiro de Segurança"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Nome amigável do perfil de acesso
                  </p>
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="descricao">Descrição</Label>
                  <Input
                    id="descricao"
                    value={nivelFormData.descricao}
                    onChange={(e) => setNivelFormData({ ...nivelFormData, descricao: e.target.value })}
                    placeholder="Ex: Acesso completo para engenheiro de segurança do trabalho"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Descrição detalhada das permissões deste perfil
                  </p>
                </div>
                <div>
                  <Label htmlFor="hierarquia">Nível de Hierarquia *</Label>
                  <Input
                    id="hierarquia"
                    type="number"
                    value={nivelFormData.nivel_hierarquia}
                    onChange={(e) => setNivelFormData({ ...nivelFormData, nivel_hierarquia: parseInt(e.target.value) || 0 })}
                    placeholder="Ex: 8"
                    min="1"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Número menor = maior hierarquia (1 = Admin, 2 = Diretor, etc.)
                  </p>
                </div>
                <div>
                  <Label htmlFor="cor">Cor do Perfil</Label>
                  <div className="flex gap-2">
                    <Input
                      id="cor"
                      type="color"
                      value={nivelFormData.cor}
                      onChange={(e) => setNivelFormData({ ...nivelFormData, cor: e.target.value })}
                      className="w-16 h-10"
                    />
                    <Input
                      value={nivelFormData.cor}
                      onChange={(e) => setNivelFormData({ ...nivelFormData, cor: e.target.value })}
                      placeholder="#dc2626"
                      className="flex-1"
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Cor para identificar visualmente o perfil
                  </p>
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <Button variant="outline" onClick={() => {
                  setNivelFormData({ codigo: '', nome: '', descricao: '', nivel_hierarquia: 0, cor: '#6b7280' });
                  setEditingPerfil(null);
                }}>
                  {editingPerfil ? 'Cancelar' : 'Limpar'}
                </Button>
                {editingPerfil ? (
                  <Button onClick={handleUpdateNivel}>
                    <PencilIcon className="h-4 w-4 mr-2" />
                    Salvar Alterações
                  </Button>
                ) : (
                  <Button onClick={handleCreateNivel}>
                    <PlusIcon className="h-4 w-4 mr-2" />
                    Criar Perfil
                  </Button>
                )}
              </div>
            </div>

            {/* Lista de perfis de acesso existentes */}
            <div className="border rounded-lg p-4">
              <h3 className="text-lg font-semibold mb-4">Perfis de Acesso Existentes</h3>
              <p className="text-sm text-gray-600 mb-4">
                Estes são os perfis de acesso disponíveis no sistema. Cada perfil pode ser usado por múltiplos cargos.
              </p>
              <div className="space-y-3">
                {perfisAcesso.map((perfil) => (
                  <div key={perfil.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-4">
                      <div 
                        className="w-6 h-6 rounded-full border-2 border-white shadow-sm" 
                        style={{ backgroundColor: perfil.cor || '#6b7280' }}
                      ></div>
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">{perfil.nome}</div>
                        <div className="text-sm text-gray-500">
                          <span className="font-mono bg-gray-100 px-2 py-1 rounded text-xs">
                            {perfil.codigo}
                          </span>
                          <span className="mx-2">•</span>
                          <span>Hierarquia: {perfil.nivel_hierarquia}</span>
                        </div>
                        {perfil.descricao && (
                          <div className="text-sm text-gray-600 mt-1">{perfil.descricao}</div>
                        )}
                        <div className="text-xs text-gray-400 mt-1">
                          {cargos.filter(c => c.perfil_acesso_id === perfil.id).length} cargo(s) vinculado(s)
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setEditingPerfil(perfil);
                          setNivelFormData({
                            codigo: perfil.codigo,
                            nome: perfil.nome,
                            descricao: perfil.descricao || '',
                            nivel_hierarquia: perfil.nivel_hierarquia,
                            cor: perfil.cor || '#6b7280'
                          });
                        }}
                        title="Editar perfil"
                      >
                        <PencilIcon className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteNivel(perfil.id)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        title="Desativar perfil"
                        disabled={cargos.filter(c => c.perfil_acesso_id === perfil.id).length > 0}
                      >
                        <TrashIcon className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                {perfisAcesso.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <ShieldCheckIcon className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <p>Nenhum perfil de acesso encontrado</p>
                    <p className="text-sm">Crie o primeiro perfil de acesso acima</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}