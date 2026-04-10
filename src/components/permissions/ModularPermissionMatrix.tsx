'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  CogIcon, 
  DevicePhoneMobileIcon,
  ComputerDesktopIcon,
  BuildingOfficeIcon
} from '@heroicons/react/24/outline';
import { useModularPermissions, PERMISSION_CODES } from '@/hooks/useModularPermissions';
import type { 
  FuncionalidadeModular, 
  ModuloSistema, 
  Plataforma, 
  PerfilAcesso
} from '@/types/permissions';

interface ModularPermissionMatrixProps {
  funcionalidadesModulares: FuncionalidadeModular[];
  modulosSistema: ModuloSistema[];
  plataformas: Plataforma[];
  perfisAcesso: PerfilAcesso[];
}

export default function ModularPermissionMatrix({ 
  funcionalidadesModulares, 
  modulosSistema, 
  plataformas, 
  // perfisAcesso // TODO: Implement profile access functionality
}: ModularPermissionMatrixProps) {
  const [activeTab, setActiveTab] = useState('por_modulo');
  
  // Hook modular para permissões do usuário atual
  const { hasPermission } = useModularPermissions();

  // Verificações de permissão
  const canViewMatrix = hasPermission(PERMISSION_CODES.CONFIGURACOES.GERENCIAR_PERMISSOES);

  if (!canViewMatrix) {
    return (
      <div className="text-center p-8">
        <div className="bg-red-50 p-6 rounded-lg">
          <h3 className="text-lg font-semibold text-red-800 mb-2">Acesso Negado</h3>
          <p className="text-red-600">Você não tem permissão para visualizar a matriz de permissões modulares.</p>
        </div>
      </div>
    );
  }

  // Agrupar funcionalidades por módulo e plataforma
  const getFuncionalidadesByModulo = (moduloId: string) => {
    return funcionalidadesModulares.filter(f => f.modulo?.codigo === moduloId);
  };

  const getFuncionalidadesByPlataforma = (plataformaId: string) => {
    return funcionalidadesModulares.filter(f => f.plataforma?.codigo === plataformaId);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">🎯 Matriz de Permissões Modulares</h2>
          <p className="text-gray-600 mt-1">
            Visualize todas as 113 funcionalidades modulares organizadas por módulo e plataforma
          </p>
        </div>
        <div className="flex gap-2">
          <Badge variant="outline" className="bg-blue-100 text-blue-800">
            💻 Web: {funcionalidadesModulares.filter(f => f.plataforma?.codigo === 'site').length}
          </Badge>
          <Badge variant="outline" className="bg-green-100 text-green-800">
            📱 Mobile: {funcionalidadesModulares.filter(f => f.plataforma?.codigo === 'mobile').length}
          </Badge>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="por_modulo" className="flex items-center gap-2">
            <BuildingOfficeIcon className="h-4 w-4" />
            Por Módulo
          </TabsTrigger>
          <TabsTrigger value="por_plataforma" className="flex items-center gap-2">
            <DevicePhoneMobileIcon className="h-4 w-4" />
            Por Plataforma
          </TabsTrigger>
          <TabsTrigger value="todas" className="flex items-center gap-2">
            <CogIcon className="h-4 w-4" />
            Todas
          </TabsTrigger>
        </TabsList>

        {/* Tab: Por Módulo */}
        <TabsContent value="por_modulo" className="space-y-6">
          <div className="space-y-6">
            {modulosSistema.map(modulo => {
              const funcionalidadesModulo = getFuncionalidadesByModulo(modulo.id);
              return (
                <Card key={modulo.id}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BuildingOfficeIcon className="h-5 w-5" />
                      {modulo.nome} ({funcionalidadesModulo.length} funcionalidades)
                    </CardTitle>
                    <CardDescription>
                      Funcionalidades do módulo {modulo.nome} organizadas por plataforma
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {plataformas.map(plataforma => {
                        const funcionalidadesPlataforma = funcionalidadesModulo.filter(f => f.plataforma?.id === plataforma.id);
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
                            <div className="space-y-2 max-h-80 overflow-y-auto">
                              {funcionalidadesPlataforma.map(func => (
                                <div key={func.id} className="flex items-center justify-between text-sm p-3 bg-white rounded border hover:shadow-sm transition-shadow">
                                  <div className="flex-1">
                                    <div className="font-medium text-gray-900">{func.nome}</div>
                                    <div className="text-xs text-gray-500 mt-1">{func.codigo}</div>
                                  </div>
                                  <div className="flex gap-2">
                                    <Badge variant={func.ativa ? "default" : "secondary"} className="text-xs">
                                      {func.ativa ? "✅ Ativa" : "❌ Inativa"}
                                    </Badge>
                                    <Badge variant="outline" className="text-xs">
                                      {func.modulo?.nome || 'N/A'}
                                    </Badge>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* Tab: Por Plataforma */}
        <TabsContent value="por_plataforma" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {plataformas.map(plataforma => {
              const funcionalidadesPlataforma = getFuncionalidadesByPlataforma(plataforma.id);
              return (
                <Card key={plataforma.id}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      {plataforma.id === 'site' ? (
                        <ComputerDesktopIcon className="h-5 w-5 text-blue-600" />
                      ) : (
                        <DevicePhoneMobileIcon className="h-5 w-5 text-green-600" />
                      )}
                      {plataforma.nome} ({funcionalidadesPlataforma.length} funcionalidades)
                    </CardTitle>
                    <CardDescription>
                      Todas as funcionalidades da plataforma {plataforma.nome}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {modulosSistema.map(modulo => {
                        const funcionalidadesModulo = funcionalidadesPlataforma.filter(f => f.modulo?.id === modulo.id);
                        if (funcionalidadesModulo.length === 0) return null;
                        
                        return (
                          <div key={modulo.id} className="border rounded-lg p-4">
                            <div className="flex items-center justify-between mb-3">
                              <h4 className="font-semibold text-gray-900">{modulo.nome}</h4>
                              <Badge variant="outline">{funcionalidadesModulo.length} funcionalidades</Badge>
                            </div>
                            <div className="space-y-2">
                              {funcionalidadesModulo.map(func => (
                                <div key={func.id} className="flex items-center justify-between text-sm p-2 bg-gray-50 rounded">
                                  <div className="flex-1">
                                    <div className="font-medium text-gray-900">{func.nome}</div>
                                    <div className="text-xs text-gray-500 mt-1">{func.codigo}</div>
                                  </div>
                                  <Badge variant={func.ativa ? "default" : "secondary"} className="text-xs">
                                    {func.ativa ? "✅" : "❌"}
                                  </Badge>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* Tab: Todas as Funcionalidades */}
        <TabsContent value="todas" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CogIcon className="h-5 w-5" />
                Todas as Funcionalidades Modulares ({funcionalidadesModulares.length})
              </CardTitle>
              <CardDescription>
                Lista completa de todas as funcionalidades modulares do sistema
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {funcionalidadesModulares.map(func => (
                  <div key={func.id} className={`flex items-center justify-between p-4 rounded-lg border-l-4 ${
                    func.plataforma?.codigo === 'site' 
                      ? 'bg-blue-50 border-blue-400' 
                      : 'bg-green-50 border-green-400'
                  }`}>
                    <div className="flex items-center gap-3 flex-1">
                      {func.plataforma?.codigo === 'site' ? (
                        <ComputerDesktopIcon className="h-5 w-5 text-blue-600" />
                      ) : (
                        <DevicePhoneMobileIcon className="h-5 w-5 text-green-600" />
                      )}
                      <div className="flex-1">
                        <div className="font-semibold text-gray-900">{func.nome}</div>
                        <div className="text-sm text-gray-500 mt-1">{func.codigo}</div>
                        <div className="text-xs text-gray-400 mt-1">
                          Módulo: {func.modulo?.nome || 'N/A'} | Plataforma: {func.plataforma?.nome || 'N/A'}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Badge className={func.plataforma?.codigo === 'site' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}>
                        {func.plataforma?.codigo === 'site' ? '💻 Web' : '📱 Mobile'}
                      </Badge>
                      <Badge variant="outline">{func.modulo?.nome || 'N/A'}</Badge>
                      <Badge variant={func.ativa ? "default" : "secondary"}>
                        {func.ativa ? "✅ Ativa" : "❌ Inativa"}
                      </Badge>
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

