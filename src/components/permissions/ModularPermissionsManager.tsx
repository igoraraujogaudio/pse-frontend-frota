'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  UsersIcon, 
  CogIcon, 
  ShieldCheckIcon, 
  KeyIcon,
  BuildingOfficeIcon,
  DevicePhoneMobileIcon,
  ComputerDesktopIcon
} from '@heroicons/react/24/outline';
import { useModularPermissions, PERMISSION_CODES } from '@/hooks/useModularPermissions';
import { modularPermissionService } from '@/services/modularPermissionService';
import type { 
  FuncionalidadeModular, 
  ModuloSistema, 
  Plataforma, 
  PerfilAcesso, 
  UsuarioPermissaoModular 
} from '@/types/permissions';

interface ModularPermissionsManagerProps {
  usuarios: Record<string, unknown>[];
  onUpdate?: () => void;
}

export default function ModularPermissionsManager({ usuarios }: ModularPermissionsManagerProps) {
  const [activeTab, setActiveTab] = useState('funcionalidades');
  const [loading, setLoading] = useState(false);
  
  // Estados para dados modulares
  const [funcionalidadesModulares, setFuncionalidadesModulares] = useState<FuncionalidadeModular[]>([]);
  const [modulosSistema, setModulosSistema] = useState<ModuloSistema[]>([]);
  const [plataformas, setPlataformas] = useState<Plataforma[]>([]);
  const [perfisAcesso, setPerfisAcesso] = useState<PerfilAcesso[]>([]);
  const [usuarioPermissoesModulares, setUsuarioPermissoesModulares] = useState<UsuarioPermissaoModular[]>([]);

  // Hook modular para permissões do usuário atual
  const { hasPermission } = useModularPermissions();

  const loadModularData = useCallback(async () => {
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
      
      // Debug: Log dos dados carregados
      console.log('🔍 Debug ModularPermissionsManager:');
      console.log('- Funcionalidades Modulares:', funcionalidadesData.length);
      console.log('- Módulos Sistema:', modulosData.length);
      console.log('- Plataformas:', plataformasData.length);
      console.log('- Perfis Acesso:', perfisData.length);
      console.log('- Usuários:', usuarios.length);
      console.log('- Usuário Permissões Modulares:', permissoesData.length);
      console.log('- Primeira funcionalidade:', funcionalidadesData[0]);
      console.log('- Primeiro módulo:', modulosData[0]);
      console.log('- Primeira plataforma:', plataformasData[0]);
    } catch (error) {
      console.error('Erro ao carregar dados modulares:', error);
    } finally {
      setLoading(false);
    }
  }, [usuarios.length]);

  // Carregar dados modulares
  useEffect(() => {
    loadModularData();
  }, [loadModularData]);

  // Verificações de permissão - usando sistema modular
  const canManageModularPermissions = hasPermission(PERMISSION_CODES.CONFIGURACOES.GERENCIAR_PERMISSOES);
  const canConfigureSystem = hasPermission(PERMISSION_CODES.CONFIGURACOES.CONFIGURAR_SISTEMA);
  
  // Debug: Log das permissões
  console.log('🔍 Debug Permissões ModularPermissionsManager:');
  console.log('- canManageModularPermissions:', canManageModularPermissions);
  console.log('- canConfigureSystem:', canConfigureSystem);
  console.log('- PERMISSION_CODES.CONFIGURACOES.GERENCIAR_PERMISSOES:', PERMISSION_CODES.CONFIGURACOES.GERENCIAR_PERMISSOES);

  // TEMPORÁRIO: Comentado para permitir acesso total
  // if (!canManageModularPermissions) {
  //   return (
  //     <div className="text-center p-8">
  //       <div className="bg-red-50 p-6 rounded-lg">
  //         <h3 className="text-lg font-semibold text-red-800 mb-2">Acesso Negado</h3>
  //         <p className="text-red-600">Você não tem permissão para gerenciar permissões modulares.</p>
  //       </div>
  //     </div>
  //   );
  // }

  if (loading) {
    return (
      <div className="text-center p-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Carregando sistema modular...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">🚀 Gerenciador de Permissões Modulares</h2>
          <p className="text-gray-600 mt-1">
            Gerencie as 113 funcionalidades modulares do sistema (Web + Mobile)
          </p>
        </div>
        <Button onClick={loadModularData} variant="outline">
          <CogIcon className="h-4 w-4 mr-2" />
          Atualizar Dados
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-center">
              <div className="bg-blue-500 p-2 rounded-full">
                <CogIcon className="h-5 w-5 text-white" />
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-blue-700">Funcionalidades</p>
                <p className="text-xl font-bold text-blue-900">{funcionalidadesModulares.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
          <CardContent className="p-4">
            <div className="flex items-center">
              <div className="bg-green-500 p-2 rounded-full">
                <BuildingOfficeIcon className="h-5 w-5 text-white" />
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-green-700">Módulos</p>
                <p className="text-xl font-bold text-green-900">{modulosSistema.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
          <CardContent className="p-4">
            <div className="flex items-center">
              <div className="bg-purple-500 p-2 rounded-full">
                <KeyIcon className="h-5 w-5 text-white" />
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-purple-700">Permissões</p>
                <p className="text-xl font-bold text-purple-900">{usuarioPermissoesModulares.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
          <CardContent className="p-4">
            <div className="flex items-center">
              <div className="bg-orange-500 p-2 rounded-full">
                <UsersIcon className="h-5 w-5 text-white" />
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-orange-700">Perfis</p>
                <p className="text-xl font-bold text-orange-900">{perfisAcesso.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="funcionalidades" className="flex items-center gap-2">
            <CogIcon className="h-4 w-4" />
            Funcionalidades
          </TabsTrigger>
          <TabsTrigger value="usuarios" className="flex items-center gap-2">
            <UsersIcon className="h-4 w-4" />
            Usuários
          </TabsTrigger>
          <TabsTrigger value="modulos" className="flex items-center gap-2">
            <BuildingOfficeIcon className="h-4 w-4" />
            Módulos
          </TabsTrigger>
          <TabsTrigger value="plataformas" className="flex items-center gap-2">
            <DevicePhoneMobileIcon className="h-4 w-4" />
            Plataformas
          </TabsTrigger>
          <TabsTrigger value="perfis" className="flex items-center gap-2">
            <ShieldCheckIcon className="h-4 w-4" />
            Perfis
          </TabsTrigger>
        </TabsList>

        {/* Tab: Funcionalidades Modulares */}
        <TabsContent value="funcionalidades" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CogIcon className="h-5 w-5" />
                Funcionalidades Modulares ({funcionalidadesModulares.length})
              </CardTitle>
              <CardDescription>
                Lista completa das funcionalidades modulares por módulo e plataforma
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {modulosSistema.map(modulo => {
                  const funcionalidadesModulo = funcionalidadesModulares.filter(f => f.modulo_id === modulo.id);
                  return (
                    <div key={modulo.id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-semibold text-gray-900">{modulo.nome}</h3>
                        <Badge variant="outline">{funcionalidadesModulo.length} funcionalidades</Badge>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {plataformas.map(plataforma => {
                          const funcionalidadesPlataforma = funcionalidadesModulo.filter(f => f.plataforma_id === plataforma.id);
                          return (
                            <div key={plataforma.id} className={`p-4 rounded-lg border-l-4 shadow-sm ${
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
                                <div className="flex-1">
                                  <h4 className="font-semibold text-gray-900">{plataforma.nome}</h4>
                                  <p className="text-sm text-gray-500">{plataforma.id}</p>
                                </div>
                                <Badge className={plataforma.id === 'site' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}>
                                  {funcionalidadesPlataforma.length} funcionalidades
                                </Badge>
                              </div>
                              <div className="space-y-2 max-h-64 overflow-y-auto">
                                {funcionalidadesPlataforma.map(func => (
                                  <div key={func.id} className="flex items-center justify-between text-sm p-3 bg-white rounded border hover:shadow-sm transition-shadow">
                                    <div className="flex-1">
                                      <div className="font-medium text-gray-900">{func.nome}</div>
                                      <div className="text-xs text-gray-500 mt-1">{func.codigo}</div>
                                    </div>
                                    <Badge variant={func.ativa ? "default" : "secondary"} className="text-xs">
                                      {func.ativa ? "✅ Ativa" : "❌ Inativa"}
                                    </Badge>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Usuários com Permissões Modulares */}
        <TabsContent value="usuarios" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UsersIcon className="h-5 w-5" />
                Todos os Usuários ({usuarios.length})
              </CardTitle>
              <CardDescription>
                Todos os usuários do sistema ({usuarios.length} total)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {usuarios.map(usuario => {
                  const permissoesUsuario = usuarioPermissoesModulares.filter(up => up.usuario_id === usuario.id);
                  return (
                    <div key={usuario.id as string} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h3 className="font-semibold text-gray-900">{usuario.nome as string}</h3>
                          <p className="text-sm text-gray-500">{usuario.email as string}</p>
                        </div>
                        <div className="flex gap-2">
                          <Badge variant="outline">{usuario.nivel_acesso as string}</Badge>
                          <Badge variant="default">{permissoesUsuario.length} permissões</Badge>
                        </div>
                      </div>
                      {/* ✅ NOVO: Divisão visual por plataforma */}
                      <div className="space-y-4">
                        {plataformas.map(plataforma => {
                          const permissoesPlataforma = permissoesUsuario.filter(permissao => {
                            const funcionalidade = funcionalidadesModulares.find(f => f.id === permissao.funcionalidade_id);
                            return funcionalidade?.plataforma?.id === plataforma.id;
                          });
                          
                          if (permissoesPlataforma.length === 0) return null;
                          
                          return (
                            <div key={plataforma.id} className={`p-4 rounded-lg border-l-4 shadow-sm ${
                              plataforma.id === 'site' 
                                ? 'bg-blue-50 border-blue-400' 
                                : 'bg-green-50 border-green-400'
                            }`}>
                              <div className="flex items-center gap-3 mb-3">
                                {plataforma.id === 'site' ? (
                                  <ComputerDesktopIcon className="h-5 w-5 text-blue-600" />
                                ) : (
                                  <DevicePhoneMobileIcon className="h-5 w-5 text-green-600" />
                                )}
                                <h4 className="font-semibold text-gray-900">{plataforma.nome}</h4>
                                <Badge className={plataforma.id === 'site' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}>
                                  {permissoesPlataforma.length} permissões
                                </Badge>
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                {permissoesPlataforma.map(permissao => {
                                  const funcionalidade = funcionalidadesModulares.find(f => f.id === permissao.funcionalidade_id);
                                  if (!funcionalidade) return null;
                                  return (
                                    <div key={permissao.id} className="p-3 bg-white rounded border hover:shadow-sm transition-shadow">
                                      <div className="flex items-center justify-between">
                                        <div className="flex-1">
                                          <div className="font-medium text-gray-900 text-sm">{funcionalidade.nome}</div>
                                          <div className="text-xs text-gray-500 mt-1">{funcionalidade.codigo}</div>
                                          <div className="text-xs text-gray-400 mt-1">Módulo: {funcionalidade.modulo?.nome || 'N/A'}</div>
                                        </div>
                                        <Badge variant={funcionalidade.ativa ? "default" : "secondary"} className="text-xs">
                                          {funcionalidade.ativa ? "✅" : "❌"}
                                        </Badge>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Módulos */}
        <TabsContent value="modulos" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BuildingOfficeIcon className="h-5 w-5" />
                Módulos do Sistema ({modulosSistema.length})
              </CardTitle>
              <CardDescription>
                Módulos disponíveis no sistema modular
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {modulosSistema.map(modulo => {
                  const funcionalidadesModulo = funcionalidadesModulares.filter(f => f.modulo_id === modulo.id);
                  return (
                    <div key={modulo.id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-semibold text-gray-900">{modulo.nome}</h3>
                        <Badge variant="outline">{funcionalidadesModulo.length}</Badge>
                      </div>
                      <div className="space-y-2 text-sm text-gray-600">
                        <div className="flex justify-between">
                          <span>Total Funcionalidades:</span>
                          <span className="font-medium">{funcionalidadesModulo.length}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Funcionalidades Ativas:</span>
                          <span className="font-medium">{funcionalidadesModulo.filter(f => f.ativa).length}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Web:</span>
                          <span className="font-medium">{funcionalidadesModulo.filter(f => f.plataforma?.codigo === 'site').length}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Mobile:</span>
                          <span className="font-medium">{funcionalidadesModulo.filter(f => f.plataforma?.codigo === 'mobile').length}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Plataformas */}
        <TabsContent value="plataformas" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DevicePhoneMobileIcon className="h-5 w-5" />
                Plataformas ({plataformas.length})
              </CardTitle>
              <CardDescription>
                Plataformas disponíveis no sistema modular
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {plataformas.map(plataforma => {
                  const funcionalidadesPlataforma = funcionalidadesModulares.filter(f => f.plataforma?.id === plataforma.id);
                  return (
                    <div key={plataforma.id} className="border rounded-lg p-6">
                      <div className="flex items-center gap-3 mb-4">
                        {plataforma.id === 'site' ? (
                          <ComputerDesktopIcon className="h-8 w-8 text-blue-600" />
                        ) : (
                          <DevicePhoneMobileIcon className="h-8 w-8 text-green-600" />
                        )}
                        <div>
                          <h3 className="font-semibold text-gray-900 text-lg">{plataforma.nome}</h3>
                          <p className="text-sm text-gray-500">{plataforma.id}</p>
                        </div>
                        <Badge variant="outline">{funcionalidadesPlataforma.length}</Badge>
                      </div>
                      <div className="space-y-3 text-sm text-gray-600">
                        <div className="flex justify-between">
                          <span>Total Funcionalidades:</span>
                          <span className="font-medium">{funcionalidadesPlataforma.length}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Funcionalidades Ativas:</span>
                          <span className="font-medium">{funcionalidadesPlataforma.filter(f => f.ativa).length}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Status:</span>
                          <Badge variant={plataforma.ativa ? "default" : "secondary"}>
                            {plataforma.ativa ? "Ativa" : "Inativa"}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Perfis */}
        <TabsContent value="perfis" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheckIcon className="h-5 w-5" />
                Perfis de Acesso ({perfisAcesso.length})
              </CardTitle>
              <CardDescription>
                Perfis de acesso disponíveis no sistema modular
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {perfisAcesso.map(perfil => (
                  <div key={perfil.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold text-gray-900">{perfil.nome}</h3>
                      <Badge variant="outline">Nível {perfil.nivel_hierarquia}</Badge>
                    </div>
                    <p className="text-sm text-gray-600 mb-3">{perfil.descricao}</p>
                    <div className="space-y-2 text-sm text-gray-600">
                      <div className="flex justify-between">
                        <span>ID:</span>
                        <span className="font-medium">{perfil.id}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Nível:</span>
                        <span className="font-medium">{perfil.nivel_hierarquia}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Status:</span>
                        <Badge variant={perfil.ativo ? "default" : "secondary"}>
                          {perfil.ativo ? "Ativo" : "Inativo"}
                        </Badge>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
