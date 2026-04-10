'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Squares2X2Icon as TableIcon,
  MagnifyingGlassIcon,
  CheckCircleIcon,
  XCircleIcon,
  PencilIcon,
  CheckIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import { modularPermissionService } from '@/services/modularPermissionService';
import type { FuncionalidadeModular, ModuloSistema, Plataforma, PerfilAcesso } from '@/types/permissions';

// interface NivelAcessoOption {
//   value: string;
//   label: string;
//   description: string;
// }

// interface ModuloInfo {
//   id: string;
//   nome: string;
//   icon: string;
//   color: string;
// }

interface Props {
  funcionalidadesModulares: FuncionalidadeModular[];
  modulosSistema: ModuloSistema[];
  plataformas: Plataforma[];
  perfisAcesso: PerfilAcesso[];
}

export default function ModularPermissionMatrix({ 
  funcionalidadesModulares, 
  modulosSistema, 
  plataformas,
  perfisAcesso
}: Props) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedModule, setSelectedModule] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [matrizConfiguracoes, setMatrizConfiguracoes] = useState<Record<string, Record<string, boolean>>>({});
  const [changes, setChanges] = useState<Record<string, Record<string, boolean>>>({});
  // const [niveis, setNiveis] = useState<string[]>([]); // TODO: Implement dynamic levels

  // Hierarquia de permissões (índices menores = mais permissões)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _hierarchy = [
    'admin', 'diretor', 'manager', 'gerente', 'fleet_manager', 
    'gestor', 'gestor_almoxarifado', 'coordenador', 'supervisor', 
    'portaria', 'almoxarifado', 'operacao'
  ];

  const loadMatrizPermissoes = useCallback(async () => {
    try {
      setLoading(true);
      const matriz = await modularPermissionService.getPerfilFuncionalidadesPadrao();
      // Converter para formato de matriz
      const matrizConfiguracoes: Record<string, Record<string, boolean>> = {};
      
      matriz.forEach((item) => {
        if (!matrizConfiguracoes[item.funcionalidade_id]) {
          matrizConfiguracoes[item.funcionalidade_id] = {};
        }
        // Usar o código do perfil em vez do ID
        const perfil = perfisAcesso.find(p => p.id === item.perfil_id);
        if (perfil) {
          matrizConfiguracoes[item.funcionalidade_id][perfil.codigo] = item.concedido;
        }
      });
      
      setMatrizConfiguracoes(matrizConfiguracoes);
    } catch (error) {
      console.error('Erro ao carregar matriz de permissões modulares:', error);
    } finally {
      setLoading(false);
    }
  }, [perfisAcesso]);

  // Carregar matriz de permissões
  useEffect(() => {
    loadMatrizPermissoes();
  }, [loadMatrizPermissoes]);

  // Verificar se tem permissão (considerando configurações personalizadas)
  const hasPermissionCustom = (funcionalidade: FuncionalidadeModular, nivelAcesso: string): boolean => {
    const funcId = funcionalidade.id;
    
    // Se há configuração personalizada, usar ela
    if (matrizConfiguracoes[funcId] && matrizConfiguracoes[funcId][nivelAcesso] !== undefined) {
      return matrizConfiguracoes[funcId][nivelAcesso];
    }
    
    // Sem configuração = sem acesso (admin/diretor são tratados separadamente)
    return ['admin', 'diretor'].includes(nivelAcesso);
  };

  // Alternar permissão
  const togglePermission = (funcionalidadeId: string, nivelAcesso: string) => {
    if (!isEditing) return;
    
    const currentValue = matrizConfiguracoes[funcionalidadeId]?.[nivelAcesso] || false;
    
    setChanges(prev => ({
      ...prev,
      [funcionalidadeId]: {
        ...prev[funcionalidadeId],
        [nivelAcesso]: !currentValue
      }
    }));

    setMatrizConfiguracoes(prev => ({
      ...prev,
      [funcionalidadeId]: {
        ...prev[funcionalidadeId],
        [nivelAcesso]: !currentValue
      }
    }));
  };

  // Salvar alterações
  const saveChanges = async () => {
    try {
      setSaving(true);
      
      // Atualizar usando o serviço modular
      for (const funcionalidadeId of Object.keys(changes)) {
        for (const nivelAcesso of Object.keys(changes[funcionalidadeId])) {
          // Encontrar o ID do perfil pelo código
          const perfil = perfisAcesso.find(p => p.codigo === nivelAcesso);
          if (perfil) {
            await modularPermissionService.updatePerfilFuncionalidadesPadrao(
              perfil.id,
              funcionalidadeId,
              changes[funcionalidadeId][nivelAcesso]
            );
          }
        }
      }

      setChanges({});
      setIsEditing(false);
      
      // Recarregar matriz
      await loadMatrizPermissoes();
      
    } catch (error) {
      console.error('Erro ao salvar configurações modulares:', error);
    } finally {
      setSaving(false);
    }
  };

  // Cancelar edição
  const cancelEdit = () => {
    setChanges({});
    setIsEditing(false);
    loadMatrizPermissoes();
  };

  // Filtrar funcionalidades modulares
  const filteredFuncionalidades = useMemo(() => {
    return funcionalidadesModulares.filter(func => {
      const matchesSearch = !searchTerm || 
        func.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
        func.codigo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        func.descricao?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesModule = selectedModule === 'all' || func.modulo_id === selectedModule;
      const matchesCategory = selectedCategory === 'all' || func.plataforma_id === selectedCategory;
      
      return matchesSearch && matchesModule && matchesCategory && func.ativa;
    });
  }, [funcionalidadesModulares, searchTerm, selectedModule, selectedCategory]);

  const getModuleIcon = (moduloId: string) => {
    const modulo = modulosSistema.find(m => m.id === moduloId);
    return modulo?.nome || '📋';
  };

  const getPlatformColor = (plataformaId: string) => {
    const plataforma = plataformas.find(p => p.id === plataformaId);
    if (plataforma?.codigo === 'site') {
      return 'bg-blue-100 text-blue-800';
    } else if (plataforma?.codigo === 'mobile') {
      return 'bg-green-100 text-green-800';
    }
    return 'bg-gray-100 text-gray-800';
  };

  // Agrupar funcionalidades por módulo
  const funcionalidadesPorModulo = useMemo(() => {
    return filteredFuncionalidades.reduce((acc, func) => {
      if (!acc[func.modulo_id]) {
        acc[func.modulo_id] = [];
      }
      acc[func.modulo_id].push(func);
      return acc;
    }, {} as Record<string, FuncionalidadeModular[]>);
  }, [filteredFuncionalidades]);

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TableIcon className="h-5 w-5" />
            Matriz de Permissões Modulares por Perfil
          </CardTitle>
          <CardDescription>
            Configure as permissões padrão para cada perfil de acesso no sistema modular
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Buscar funcionalidades..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <Select value={selectedModule} onValueChange={setSelectedModule}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Módulo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os módulos</SelectItem>
                {modulosSistema.map(modulo => (
                  <SelectItem key={modulo.id} value={modulo.id}>
                    {modulo.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Plataforma" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as plataformas</SelectItem>
                {plataformas.map(plataforma => (
                  <SelectItem key={plataforma.id} value={plataforma.id}>
                    {plataforma.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Legenda */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <CheckCircleIcon className="h-4 w-4 text-green-600" />
              <span>Permitido</span>
            </div>
            <div className="flex items-center gap-2">
              <XCircleIcon className="h-4 w-4 text-red-600" />
              <span>Negado</span>
            </div>
            {isEditing && (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-blue-100 border-2 border-blue-400 rounded-full"></div>
                <span>Alteração pendente</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Controles de Edição */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <PencilIcon className="h-5 w-5 text-blue-600" />
              <span className="font-medium">Editar Permissões</span>
              {isEditing && (
                <Badge variant="secondary" className="ml-2">
                  {Object.keys(changes).length > 0 
                    ? `${Object.keys(changes).reduce((acc, funcId) => acc + Object.keys(changes[funcId]).length, 0)} alterações`
                    : 'Modo edição'
                  }
                </Badge>
              )}
            </div>
            
            <div className="flex gap-2">
              {!isEditing ? (
                <Button 
                  onClick={() => setIsEditing(true)}
                  variant="outline"
                  size="sm"
                  disabled={loading}
                >
                  <PencilIcon className="h-4 w-4 mr-1" />
                  Editar
                </Button>
              ) : (
                <>
                  <Button 
                    onClick={cancelEdit}
                    variant="outline" 
                    size="sm"
                    disabled={saving}
                  >
                    <XMarkIcon className="h-4 w-4 mr-1" />
                    Cancelar
                  </Button>
                  <Button 
                    onClick={saveChanges}
                    size="sm"
                    disabled={saving || Object.keys(changes).length === 0}
                  >
                    {saving ? (
                      <>Salvando...</>
                    ) : (
                      <>
                        <CheckIcon className="h-4 w-4 mr-1" />
                        Salvar ({Object.keys(changes).reduce((acc, funcId) => acc + Object.keys(changes[funcId]).length, 0)})
                      </>
                    )}
                  </Button>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Matriz de Permissões */}
      <div className="space-y-6">
        {loading ? (
          <Card>
            <CardContent className="p-8 text-center">
              <div className="text-gray-500">Carregando matriz de permissões...</div>
            </CardContent>
          </Card>
        ) : (
          Object.entries(funcionalidadesPorModulo).map(([moduloId, funcs]) => (
            <Card key={moduloId}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <span className="text-2xl">{getModuleIcon(moduloId)}</span>
                  Módulo: {moduloId.charAt(0).toUpperCase() + moduloId.slice(1)}
                  <Badge variant="outline">{funcs.length} funcionalidades</Badge>
                  {isEditing && (
                    <Badge variant="secondary" className="ml-auto">
                      Clique nos ícones para editar
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-3 font-medium">Funcionalidade</th>
                        {perfisAcesso.map(perfil => (
                          <th key={perfil.codigo} 
                              className="text-center p-2 font-medium min-w-[100px]">
                            <div className="text-xs">
                              {perfil.nome}
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {funcs.map(func => (
                        <tr key={func.id} className="border-b hover:bg-gray-50">
                          <td className="p-3">
                            <div>
                              <div className="font-medium text-sm">{func.nome}</div>
                              <div className="text-xs text-gray-600 mt-1">
                                {func.descricao}
                              </div>
                              <div className="flex items-center gap-2 mt-2">
                                <Badge className={getPlatformColor(func.plataforma_id)} variant="secondary">
                                  {plataformas.find(p => p.id === func.plataforma_id)?.nome || 'N/A'}
                                </Badge>
                                <code className="text-xs text-gray-500 bg-gray-100 px-1 rounded">
                                  {func.codigo}
                                </code>
                              </div>
                            </div>
                          </td>
                          {perfisAcesso.map(perfil => {
                            const permitted = hasPermissionCustom(func, perfil.codigo);
                            const hasChanges = changes[func.id]?.[perfil.codigo] !== undefined;
                            
                            return (
                              <td key={perfil.codigo} className="p-2 text-center">
                                <div className="flex items-center justify-center">
                                  {isEditing ? (
                                    <button
                                      onClick={() => togglePermission(func.id, perfil.codigo)}
                                      className={`p-1 rounded-full transition-all hover:scale-110 ${
                                        hasChanges ? 'ring-2 ring-blue-400 ring-offset-1' : ''
                                      }`}
                                      title={`Clique para ${permitted ? 'negar' : 'permitir'} acesso`}
                                    >
                                      {permitted ? (
                                        <CheckCircleIcon className="h-5 w-5 text-green-600" />
                                      ) : (
                                        <XCircleIcon className="h-5 w-5 text-red-600" />
                                      )}
                                    </button>
                                  ) : (
                                    <div className="flex items-center justify-center">
                                      {permitted ? (
                                        <CheckCircleIcon className="h-5 w-5 text-green-600" />
                                      ) : (
                                        <XCircleIcon className="h-5 w-5 text-red-600" />
                                      )}
                                    </div>
                                  )}
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Resumo */}
      <Card>
        <CardHeader>
          <CardTitle>Resumo da Matriz</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-blue-600">
                {filteredFuncionalidades.length}
              </div>
              <div className="text-sm text-gray-600">Funcionalidades</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-600">
                {perfisAcesso.length}
              </div>
              <div className="text-sm text-gray-600">Perfis de Acesso</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-purple-600">
                {Object.keys(funcionalidadesPorModulo).length}
              </div>
              <div className="text-sm text-gray-600">Módulos</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-orange-600">
                {perfisAcesso.reduce((acc: number, perfil) => {
                  return acc + filteredFuncionalidades.filter(func => hasPermissionCustom(func, perfil.codigo)).length;
                }, 0)}
              </div>
              <div className="text-sm text-gray-600">Permissões Padrão</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
