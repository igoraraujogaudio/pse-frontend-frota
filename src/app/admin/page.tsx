'use client';

import { useState, useEffect } from 'react';
import AdminRoute from '@/components/AdminRoute';
import { MagnifyingGlassIcon, TrashIcon, UsersIcon, DocumentIcon, TruckIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';

interface Location {
  id: string;
  name: string;
  vehicleCount: number;
  documentCount: number;
  userCount: number;
}

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  department: string;
  status: string;
}

interface Vehicle {
  id: string;
  plate: string;
  model: string;
  brand: string;
  year: number;
  status: string;
}

interface Document {
  id: string;
  name: string;
  type: string;
  vehiclePlate: string;
}

export default function AdminPage() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<string>('');
  const [users, setUsers] = useState<User[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState<string>('');
  const [excludeRoles, setExcludeRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  
  // Estados para seleção individual de usuários
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [excludeIndividualUsers, setExcludeIndividualUsers] = useState<Set<string>>(new Set());

  // Carregar locais com contadores
  useEffect(() => {
    fetchLocations();
  }, []);

  // Carregar dados quando local for selecionado
  useEffect(() => {
    if (selectedLocation) {
      fetchLocationData(selectedLocation);
      // Resetar seleções ao trocar de local
      setSelectedUsers(new Set());
      setExcludeIndividualUsers(new Set());
    }
  }, [selectedLocation]);

  const fetchLocations = async () => {
    try {
      const response = await fetch('/api/admin/locations');
      if (response.ok) {
        const data = await response.json();
        setLocations(data);
      }
    } catch (error) {
      console.error('Erro ao carregar locais:', error);
    }
  };

  const fetchLocationData = async (locationId: string) => {
    setLoading(true);
    try {
      // Carregar usuários
      const usersResponse = await fetch(`/api/admin/location/${locationId}/users`);
      if (usersResponse.ok) {
        const usersData = await usersResponse.json();
        setUsers(usersData);
      }

      // Carregar veículos
      const vehiclesResponse = await fetch(`/api/admin/location/${locationId}/vehicles`);
      if (vehiclesResponse.ok) {
        const vehiclesData = await vehiclesResponse.json();
        setVehicles(vehiclesData);
      }

      // Carregar documentos
      const documentsResponse = await fetch(`/api/admin/location/${locationId}/documents`);
      if (documentsResponse.ok) {
        const documentsData = await documentsResponse.json();
        setDocuments(documentsData);
      }
    } catch (error) {
      console.error('Erro ao carregar dados do local:', error);
    } finally {
      setLoading(false);
    }
  };

  // Funções para gerenciar seleção de usuários
  const handleUserSelection = (userId: string, checked: boolean) => {
    if (checked) {
      setSelectedUsers(prev => new Set([...prev, userId]));
    } else {
      setSelectedUsers(prev => {
        const newSet = new Set(prev);
        newSet.delete(userId);
        return newSet;
      });
    }
  };

  const handleSelectAllUsers = (checked: boolean) => {
    if (checked) {
      setSelectedUsers(new Set(filteredUsers.map(user => user.id)));
    } else {
      setSelectedUsers(new Set());
    }
  };

  // Funções para gerenciar exclusão individual de usuários
  const handleExcludeUserFromDeletion = (userId: string, checked: boolean) => {
    if (checked) {
      setExcludeIndividualUsers(prev => new Set([...prev, userId]));
    } else {
      setExcludeIndividualUsers(prev => {
        const newSet = new Set(prev);
        newSet.delete(userId);
        return newSet;
      });
    }
  };

  const handleSelectAllExcludeUsers = (checked: boolean) => {
    if (checked) {
      setExcludeIndividualUsers(new Set(filteredUsers.map(user => user.id)));
    } else {
      setExcludeIndividualUsers(new Set());
    }
  };

  const handleDelete = async (action: 'users' | 'vehicles' | 'documents' | 'all') => {
    if (!selectedLocation) return;

    const confirmMessage = {
      users: 'Tem certeza que deseja excluir TODOS os colaboradores deste local?',
      vehicles: 'Tem certeza que deseja excluir TODOS os veículos deste local?',
      documents: 'Tem certeza que deseja excluir TODOS os documentos deste local?',
      all: 'Tem certeza que deseja EXCLUIR TUDO deste local? (Colaboradores, veículos e documentos)'
    };

    if (!confirm(confirmMessage[action])) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/admin/location/${selectedLocation}/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action,
          excludeRoles: excludeRoles,
          excludeUserIds: Array.from(excludeIndividualUsers) // Adicionar IDs de usuários individuais a não excluir
        })
      });

      if (response.ok) {
        const result = await response.json();
        const protectedInfo = result.protected || {};
        const messageText = `Operação ${action} executada com sucesso! ` +
          (protectedInfo.usersByRole > 0 ? `${protectedInfo.usersByRole} usuários protegidos por nível de acesso. ` : '') +
          (protectedInfo.usersIndividual > 0 ? `${protectedInfo.usersIndividual} usuários protegidos individualmente.` : '');
        
        setMessage({ type: 'success', text: messageText });
        // Recarregar dados
        fetchLocationData(selectedLocation);
        fetchLocations(); // Atualizar contadores
        // Resetar seleções
        setSelectedUsers(new Set());
        setExcludeIndividualUsers(new Set());
      } else {
        const error = await response.json();
        setMessage({ type: 'error', text: error.message || 'Erro ao executar operação' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Erro de conexão' });
    } finally {
      setLoading(false);
    }
  };

  // Filtros
  const filteredUsers = users.filter(user => {
    const matchesSearch = user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.department.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = !filterRole || user.role === filterRole;
    const notExcluded = !excludeRoles.includes(user.role);
    return matchesSearch && matchesRole && notExcluded;
  });

  const filteredVehicles = vehicles.filter(vehicle => 
    vehicle.plate.toLowerCase().includes(searchTerm.toLowerCase()) ||
    vehicle.model.toLowerCase().includes(searchTerm.toLowerCase()) ||
    vehicle.brand.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredDocuments = documents.filter(doc => 
    doc.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    doc.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
    doc.vehiclePlate.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Estatísticas
  const selectedLocationData = locations.find(loc => loc.id === selectedLocation);
  const totalUsers = users.length;
  const totalVehicles = vehicles.length;
  const totalDocuments = documents.length;

  const availableRoles = Array.from(new Set(users.map(user => user.role)));

  return (
    <AdminRoute>
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Painel Administrativo</h1>
            <p className="mt-2 text-gray-600">
              Gerencie locais, colaboradores, veículos e documentos do sistema
            </p>
          </div>

          {/* Seleção de Local */}
          <div className="bg-white rounded-lg shadow p-6 mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Selecionar Local</h2>
            <select
              value={selectedLocation}
              onChange={(e) => setSelectedLocation(e.target.value)}
              className="w-full max-w-md px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Selecione um local...</option>
              {locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.name} ({location.vehicleCount} veículos, {location.documentCount} docs, {location.userCount} usuários)
                </option>
              ))}
            </select>
          </div>

          {selectedLocation && (
            <>
              {/* Resumo Estatístico */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                <div className="bg-white rounded-lg shadow p-6">
                  <div className="flex items-center">
                    <UsersIcon className="h-8 w-8 text-blue-600" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">Colaboradores</p>
                      <p className="text-2xl font-bold text-gray-900">{totalUsers}</p>
                    </div>
                  </div>
                </div>
                <div className="bg-white rounded-lg shadow p-6">
                  <div className="flex items-center">
                    <TruckIcon className="h-8 w-8 text-green-600" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">Veículos</p>
                      <p className="text-2xl font-bold text-gray-900">{totalVehicles}</p>
                    </div>
                  </div>
                </div>
                <div className="bg-white rounded-lg shadow p-6">
                  <div className="flex items-center">
                    <DocumentIcon className="h-8 w-8 text-purple-600" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">Documentos</p>
                      <p className="text-2xl font-bold text-gray-900">{totalDocuments}</p>
                    </div>
                  </div>
                </div>
                <div className="bg-white rounded-lg shadow p-6">
                  <div className="flex items-center">
                    <ExclamationTriangleIcon className="h-8 w-8 text-red-600" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">Local</p>
                      <p className="text-lg font-bold text-gray-900">{selectedLocationData?.name}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Controles de Exclusão */}
              <div className="bg-white rounded-lg shadow p-6 mb-8">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Controles de Exclusão</h3>
                
                {/* Proteção de Níveis de Acesso */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Níveis de Acesso a NÃO Excluir:
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {availableRoles.map((role) => (
                      <label key={role} className="flex items-center">
                        <input
                          type="checkbox"
                          checked={excludeRoles.includes(role)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setExcludeRoles([...excludeRoles, role]);
                            } else {
                              setExcludeRoles(excludeRoles.filter(r => r !== role));
                            }
                          }}
                          className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <span className="text-sm text-gray-700">{role}</span>
                      </label>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Usuários com estes níveis de acesso NÃO serão excluídos
                  </p>
                </div>

                {/* Botões de Ação */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <button
                    onClick={() => handleDelete('users')}
                    disabled={loading}
                    className="bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white px-4 py-2 rounded-md flex items-center justify-center transition-colors"
                  >
                    <UsersIcon className="h-4 w-4 mr-2" />
                    Excluir Colaboradores
                  </button>
                  <button
                    onClick={() => handleDelete('vehicles')}
                    disabled={loading}
                    className="bg-orange-600 hover:bg-orange-700 disabled:bg-orange-400 text-white px-4 py-2 rounded-md flex items-center justify-center transition-colors"
                  >
                    <TruckIcon className="h-4 w-4 mr-2" />
                    Excluir Veículos
                  </button>
                  <button
                    onClick={() => handleDelete('documents')}
                    disabled={loading}
                    className="bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white px-4 py-2 rounded-md flex items-center justify-center transition-colors"
                  >
                    <DocumentIcon className="h-4 w-4 mr-2" />
                    Excluir Documentos
                  </button>
                  <button
                    onClick={() => handleDelete('all')}
                    disabled={loading}
                    className="bg-red-800 hover:bg-red-900 disabled:bg-red-600 text-white px-4 py-2 rounded-md flex items-center justify-center transition-colors"
                  >
                    <TrashIcon className="h-4 w-4 mr-2" />
                    Excluir TUDO
                  </button>
                </div>
              </div>

              {/* Barra de Pesquisa */}
              <div className="bg-white rounded-lg shadow p-6 mb-8">
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="flex-1">
                    <div className="relative">
                      <MagnifyingGlassIcon className="h-5 w-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Pesquisar por nome, email, placa, modelo..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                  <div className="md:w-48">
                    <select
                      value={filterRole}
                      onChange={(e) => setFilterRole(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Todos os níveis</option>
                      {availableRoles.map((role) => (
                        <option key={role} value={role}>{role}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Mensagens */}
              {message && (
                <div className={`mb-6 p-4 rounded-md ${
                  message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'
                }`}>
                  {message.text}
                </div>
              )}

              {/* Abas de Conteúdo */}
              <div className="bg-white rounded-lg shadow">
                <div className="border-b border-gray-200">
                  <nav className="-mb-px flex space-x-8 px-6">
                    <button className="py-4 px-1 border-b-2 border-blue-500 text-blue-600 font-medium">
                      Colaboradores ({filteredUsers.length})
                    </button>
                    <button className="py-4 px-1 border-b-2 border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 font-medium">
                      Veículos ({filteredVehicles.length})
                    </button>
                    <button className="py-4 px-1 border-b-2 border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 font-medium">
                      Documentos ({filteredDocuments.length})
                    </button>
                  </nav>
                </div>

                <div className="p-6">
                  {loading ? (
                    <div className="text-center py-8">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                      <p className="mt-2 text-gray-600">Carregando dados...</p>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {/* Lista de Colaboradores */}
                      <div>
                        <h4 className="text-lg font-medium text-gray-900 mb-4">Colaboradores</h4>
                        
                        {/* Controles de Seleção */}
                        <div className="mb-4 space-y-3">
                          {/* Resumo de Proteção */}
                          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                            <div className="flex items-center justify-between">
                              <div className="text-sm text-blue-800">
                                <span className="font-medium">Resumo de Proteção:</span>
                                <span className="ml-2 text-red-600">{selectedUsers.size} usuários marcados para exclusão</span>
                                <span className="mx-2">|</span>
                                <span className="text-green-600">{excludeIndividualUsers.size} usuários protegidos individualmente</span>
                                <span className="mx-2">|</span>
                                <span className="text-blue-600">{excludeRoles.length} níveis de acesso protegidos</span>
                              </div>
                            </div>
                          </div>
                          
                          {/* Controles de Seleção */}
                          <div className="flex flex-wrap gap-4 items-center">
                            <div className="flex items-center gap-2">
                              <label className="text-sm font-medium text-gray-700">
                                Selecionar todos para exclusão:
                              </label>
                              <input
                                type="checkbox"
                                checked={selectedUsers.size === filteredUsers.length && filteredUsers.length > 0}
                                onChange={(e) => handleSelectAllUsers(e.target.checked)}
                                className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded"
                              />
                            </div>
                            
                            <div className="flex items-center gap-2">
                              <label className="text-sm font-medium text-gray-700">
                                Proteger todos da exclusão:
                              </label>
                              <input
                                type="checkbox"
                                checked={excludeIndividualUsers.size === filteredUsers.length && filteredUsers.length > 0}
                                onChange={(e) => handleSelectAllExcludeUsers(e.target.checked)}
                                className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                              />
                            </div>
                          </div>
                        </div>

                        {filteredUsers.length === 0 ? (
                          <p className="text-gray-500 text-center py-4">Nenhum colaborador encontrado</p>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                              <thead className="bg-gray-50">
                                <tr>
                                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    <span className="text-red-600">Excluir</span>
                                  </th>
                                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    <span className="text-green-600">Proteger</span>
                                  </th>
                                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nome</th>
                                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Departamento</th>
                                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nível</th>
                                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                </tr>
                              </thead>
                              <tbody className="bg-white divide-y divide-gray-200">
                                {filteredUsers.map((user) => (
                                  <tr key={user.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                      <input
                                        type="checkbox"
                                        checked={selectedUsers.has(user.id)}
                                        onChange={(e) => handleUserSelection(user.id, e.target.checked)}
                                        className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded"
                                        title="Selecionar para exclusão"
                                      />
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                      <input
                                        type="checkbox"
                                        checked={excludeIndividualUsers.has(user.id)}
                                        onChange={(e) => handleExcludeUserFromDeletion(user.id, e.target.checked)}
                                        className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                                        title="Proteger da exclusão"
                                      />
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{user.name}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{user.email}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{user.department}</td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                        user.role === 'admin' ? 'bg-red-100 text-red-800' :
                                        user.role === 'manager' ? 'bg-yellow-100 text-yellow-800' :
                                        'bg-blue-100 text-blue-800'
                                      }`}>
                                        {user.role}
                                      </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                        user.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                      }`}>
                                        {user.status}
                                      </span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </AdminRoute>
  );
}
