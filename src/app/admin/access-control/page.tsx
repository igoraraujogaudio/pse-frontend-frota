'use client';

import { useState, useEffect, useCallback } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  UsersIcon, 
  CogIcon, 
  ShieldCheckIcon, 
  PlusIcon,
  KeyIcon,
  BuildingOfficeIcon,
  ArrowPathIcon,
  BriefcaseIcon
} from '@heroicons/react/24/outline';
import { modularPermissionService } from '@/services/modularPermissionService';
import { contratoService } from '@/services/contratoService';
import { userService } from '@/services/userService';
import { baseService } from '@/services/baseService';
import type { 
  FuncionalidadeModular,
  ModuloSistema,
  Plataforma,
  PerfilAcesso,
  UsuarioPermissaoModular,
  GrupoPermissoesModulares,
  PerfilFuncionalidadesPadrao
} from '@/types/permissions';
import type { Contrato, Base } from '@/types/contratos';
import type { User } from '@/types';
import PermissionMigrationTool from '@/components/permissions/PermissionMigrationTool';
import { useModularPermissions } from '@/hooks/useModularPermissions';
import ManageContratosPage from '@/app/users/manage-contratos/page';
import BasesManagementPage from '@/app/admin/bases/page';
import AdvancedConfigurations from '@/components/permissions/AdvancedConfigurations';
import ModularUserPermissionsManager from '@/components/permissions/UserPermissionsManager';
import ProfilePermissionsManager from '@/components/permissions/ProfilePermissionsManager';
import CargoProfileManager from '@/components/permissions/CargoProfileManager';
import UserBasesManager from '@/components/permissions/UserBasesManager';
import FuncionariosDemitidosSummary from '@/components/FuncionariosDemitidosSummary';

export default function ModularAccessControlPage() {
  const [activeTab, setActiveTab] = useState('usuarios');
  const [loading, setLoading] = useState(false);
  
  // Estados para dados modulares
  const [usuarios, setUsuarios] = useState<User[]>([]);
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [, setBases] = useState<Base[]>([]);

  // Estados para sistema modular
  const [funcionalidadesModulares, setFuncionalidadesModulares] = useState<FuncionalidadeModular[]>([]);
  const [modulosSistema, setModulosSistema] = useState<ModuloSistema[]>([]);
  const [plataformas, setPlataformas] = useState<Plataforma[]>([]);
  const [perfisAcesso, setPerfisAcesso] = useState<PerfilAcesso[]>([]);
  const [, setUsuarioPermissoesModulares] = useState<UsuarioPermissaoModular[]>([]);
  const [gruposPermissoesModulares, setGruposPermissoesModulares] = useState<GrupoPermissoesModulares[]>([]);
  const [perfilFuncionalidadesPadrao, setPerfilFuncionalidadesPadrao] = useState<PerfilFuncionalidadesPadrao[]>([]);

  // Estados para funcionários demitidos
  const [estatisticasDemitidos, setEstatisticasDemitidos] = useState<{
    total_demitidos: number;
    reativaveis: number;
    reativados: number;
    demissoes_ultimos_30_dias: number;
  }>({
    total_demitidos: 0,
    reativaveis: 0,
    reativados: 0,
    demissoes_ultimos_30_dias: 0
  });

  // Hook modular para permissões do usuário atual
  const { } = useModularPermissions();

  // Função para carregar estatísticas de funcionários demitidos
  const carregarEstatisticasDemitidos = async () => {
    try {
      const response = await fetch('/api/users/dismissed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'stats' })
      });

      if (response.ok) {
        const data = await response.json();
        setEstatisticasDemitidos(data.estatisticas);
        console.log('✅ Estatísticas de funcionários demitidos carregadas:', data.estatisticas);
      } else {
        console.warn('⚠️ Erro ao carregar estatísticas de funcionários demitidos');
      }
    } catch (error) {
      console.error('❌ Erro ao carregar estatísticas de funcionários demitidos:', error);
    }
  };

  const loadInitialData = useCallback(async () => {
    setLoading(true);
    try {
      console.log('🔄 Iniciando carregamento de dados...');
      
      // Carregar usuários primeiro para debug
      console.log('📋 Carregando usuários...');
      const usuariosData = await userService.getAll();
      console.log('✅ Usuários carregados:', usuariosData.length);
      
      // Carregar estatísticas de funcionários demitidos
      console.log('📊 Carregando estatísticas de funcionários demitidos...');
      await carregarEstatisticasDemitidos();
      
      const [
        contratosData,
        basesData,
        // Dados modulares
        funcionalidadesModularesData,
        modulosSistemaData,
        plataformasData,
        perfisAcessoData,
        usuarioPermissoesModularesData,
        perfilFuncionalidadesPadraoData
      ] = await Promise.all([
        contratoService.getContratos(),
        baseService.getBases(),
        // Carregar dados modulares
        modularPermissionService.getFuncionalidadesModulares(),
        modularPermissionService.getModulosSistema(),
        modularPermissionService.getPlataformas(),
        modularPermissionService.getPerfisAcesso(),
        modularPermissionService.getAllUsuarioPermissoesModulares(),
        modularPermissionService.getPerfilFuncionalidadesPadrao()
      ]);

      // Carregar grupos de permissões modulares separadamente (pode não existir)
      let gruposPermissoesModularesData: GrupoPermissoesModulares[] = [];
      try {
        console.log('📋 Carregando grupos de permissões modulares...');
        gruposPermissoesModularesData = await modularPermissionService.getGruposPermissoesModulares();
        console.log('✅ Grupos de permissões modulares carregados:', gruposPermissoesModularesData.length);
      } catch (error) {
        console.warn('⚠️ Grupos de permissões modulares não encontrados:', error);
      }

      // Atualizar estados
      setUsuarios(usuariosData);
      setContratos(contratosData);
      setBases(basesData);
      setFuncionalidadesModulares(funcionalidadesModularesData);
      setModulosSistema(modulosSistemaData);
      setPlataformas(plataformasData);
      setPerfisAcesso(perfisAcessoData);
      setUsuarioPermissoesModulares(usuarioPermissoesModularesData);
      setGruposPermissoesModulares(gruposPermissoesModularesData);
      setPerfilFuncionalidadesPadrao(perfilFuncionalidadesPadraoData);

      console.log('✅ Todos os dados carregados com sucesso!');
      console.log('📊 Resumo dos dados:');
      console.log('- Usuários:', usuariosData.length);
      console.log('- Contratos:', contratosData.length);
      console.log('- Bases:', basesData.length);
      console.log('- Funcionalidades Modulares:', funcionalidadesModularesData.length);
      console.log('- Módulos Sistema:', modulosSistemaData.length);
      console.log('- Plataformas:', plataformasData.length);
      console.log('- Perfis Acesso:', perfisAcessoData.length);
      console.log('- Usuário Permissões Modulares:', usuarioPermissoesModularesData.length);
      console.log('- Grupos Permissões Modulares:', gruposPermissoesModularesData.length);
      console.log('- Perfil Funcionalidades Padrão:', perfilFuncionalidadesPadraoData.length);

    } catch (error) {
      console.error('❌ Erro ao carregar dados iniciais:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Carregar dados iniciais
  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-lg text-gray-600">Carregando sistema de controle de acesso...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold text-gray-900">
          🎯 Controle de Acesso Modular
        </h1>
        <p className="text-xl text-gray-600 max-w-3xl mx-auto">
          Sistema unificado de gerenciamento de permissões com 113 funcionalidades distribuídas entre Web e Mobile
        </p>
        
        {/* Status Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
          <Card className="text-center">
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-blue-600">{usuarios.length}</div>
              <p className="text-sm text-gray-600">Usuários</p>
            </CardContent>
          </Card>
          <Card className="text-center">
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-green-600">{funcionalidadesModulares.length}</div>
              <p className="text-sm text-gray-600">Funcionalidades</p>
            </CardContent>
          </Card>
          <Card className="text-center">
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-purple-600">{modulosSistema.length}</div>
              <p className="text-sm text-gray-600">Módulos</p>
            </CardContent>
          </Card>
          <Card className="text-center">
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-orange-600">{plataformas.length}</div>
              <p className="text-sm text-gray-600">Plataformas</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Componente de Resumo de Funcionários Demitidos */}
      <FuncionariosDemitidosSummary 
        totalDemitidos={estatisticasDemitidos.total_demitidos}
        reativaveis={estatisticasDemitidos.reativaveis}
        reativados={estatisticasDemitidos.reativados}
        demissoesUltimos30Dias={estatisticasDemitidos.demissoes_ultimos_30_dias}
      />

      {/* Debug Info */}
      <Card className="mb-4">
        <CardContent className="pt-6">
          <div className="text-sm text-gray-600">
            <p><strong>Active Tab:</strong> {activeTab}</p>
            <p><strong>Usuários carregados:</strong> {usuarios.length}</p>
            <p><strong>Contratos carregados:</strong> {contratos.length}</p>
            <p><strong>Funcionalidades modulares:</strong> {funcionalidadesModulares.length}</p>
          </div>
        </CardContent>
      </Card>

      {/* Tabs Principais - Reorganizadas */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="usuarios" className="flex items-center gap-2">
            <UsersIcon className="h-4 w-4" />
            Usuários
          </TabsTrigger>
          <TabsTrigger value="usuarios-bases" className="flex items-center gap-2">
            <BuildingOfficeIcon className="h-4 w-4" />
            Usuários & Bases
          </TabsTrigger>
          <TabsTrigger value="contratos" className="flex items-center gap-2">
            <BuildingOfficeIcon className="h-4 w-4" />
            Contratos & Bases
          </TabsTrigger>
          <TabsTrigger value="configuracoes" className="flex items-center gap-2">
            <CogIcon className="h-4 w-4" />
            Configurações
          </TabsTrigger>
        </TabsList>

        {/* Tab: Usuários - Permissões e Gerenciamento */}
        <TabsContent value="usuarios" className="space-y-6">
          <Tabs defaultValue="permissoes" className="space-y-6">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="permissoes" className="flex items-center gap-2">
                <ShieldCheckIcon className="h-4 w-4" />
                Permissões Modulares
              </TabsTrigger>
              <TabsTrigger value="perfis" className="flex items-center gap-2">
                <KeyIcon className="h-4 w-4" />
                Perfis & Templates
              </TabsTrigger>
              <TabsTrigger value="perfis-cargo" className="flex items-center gap-2">
                <BriefcaseIcon className="h-4 w-4" />
                Perfis por Cargo
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="permissoes">
              <ModularUserPermissionsManager 
                usuarios={usuarios}
                funcionalidadesModulares={funcionalidadesModulares}
                contratos={contratos}
                modulosSistema={modulosSistema}
                onUserUpdate={loadInitialData}
              />
            </TabsContent>
            
            <TabsContent value="perfis">
              <ProfilePermissionsManager />
            </TabsContent>

            <TabsContent value="perfis-cargo">
              <CargoProfileManager
                perfisAcesso={perfisAcesso}
                perfilFuncionalidadesPadrao={perfilFuncionalidadesPadrao}
              />
            </TabsContent>
          </Tabs>
        </TabsContent>

        {/* Tab: Usuários & Bases */}
        <TabsContent value="usuarios-bases" className="space-y-6">
          <UserBasesManager 
            usuarios={usuarios}
            onUserUpdate={loadInitialData}
          />
        </TabsContent>

        {/* Tab: Contratos e Bases */}
        <TabsContent value="contratos" className="space-y-6">
          <Tabs defaultValue="contratos" className="space-y-6">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="contratos" className="flex items-center gap-2">
                <BuildingOfficeIcon className="h-4 w-4" />
                Gestão de Contratos
              </TabsTrigger>
              <TabsTrigger value="bases" className="flex items-center gap-2">
                <BuildingOfficeIcon className="h-4 w-4" />
                Gestão de Bases
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="contratos">
              <ManageContratosPage />
            </TabsContent>
            
            <TabsContent value="bases">
              <BasesManagementPage />
            </TabsContent>
          </Tabs>
        </TabsContent>

        {/* Tab: Configurações - Sistema Modular e Avançadas */}
        <TabsContent value="configuracoes" className="space-y-6">
          <Tabs defaultValue="sistema" className="space-y-6">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="sistema" className="flex items-center gap-2">
                <ArrowPathIcon className="h-4 w-4" />
                Sistema Modular
              </TabsTrigger>
              <TabsTrigger value="matriz" className="flex items-center gap-2">
                <CogIcon className="h-4 w-4" />
                Matriz de Permissões
              </TabsTrigger>
              <TabsTrigger value="avancadas" className="flex items-center gap-2">
                <PlusIcon className="h-4 w-4" />
                Configurações Avançadas
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="sistema">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ArrowPathIcon className="h-5 w-5" />
                    Sistema Modular de Permissões
                  </CardTitle>
                  <CardDescription>
                    Sistema modular com 113 funcionalidades distribuídas entre Web e Mobile
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 lg:grid-cols-1 gap-6">
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold text-gray-900">Sistema Modular Ativo</h3>
                      <div className="bg-blue-50 p-4 rounded-lg">
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span>Funcionalidades Modulares:</span>
                            <Badge variant="default">{funcionalidadesModulares.length}</Badge>
                          </div>
                          <div className="flex justify-between">
                            <span>Usuários com Permissões Modulares:</span>
                            <Badge variant="default">{usuarios.length}</Badge>
                          </div>
                          <div className="flex justify-between">
                            <span>Grupos Modulares:</span>
                            <Badge variant="default">{gruposPermissoesModulares.length}</Badge>
                          </div>
                          <div className="flex justify-between">
                            <span>Perfis de Acesso:</span>
                            <Badge variant="default">{perfisAcesso.length}</Badge>
                          </div>
                          <div className="flex justify-between">
                            <span>Módulos:</span>
                            <Badge variant="default">{modulosSistema.length}</Badge>
                          </div>
                          <div className="flex justify-between">
                            <span>Plataformas:</span>
                            <Badge variant="default">{plataformas.length}</Badge>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Status do Sistema Modular */}
                  <div className="mt-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Status do Sistema Modular</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="text-center p-4 bg-green-50 rounded-lg">
                        <h4 className="text-xl font-bold text-green-900">{funcionalidadesModulares.length}</h4>
                        <p className="text-green-700">Funcionalidades Ativas</p>
                        <p className="text-sm text-green-600 mt-1">Sistema Modular</p>
                      </div>
                      <div className="text-center p-4 bg-blue-50 rounded-lg">
                        <h4 className="text-xl font-bold text-blue-900">{usuarios.length}</h4>
                        <p className="text-blue-700">Usuários Ativos</p>
                        <p className="text-sm text-blue-600 mt-1">Com permissões modulares</p>
                      </div>
                      <div className="text-center p-4 bg-purple-50 rounded-lg">
                        <h4 className="text-xl font-bold text-purple-900">{perfilFuncionalidadesPadrao.length}</h4>
                        <p className="text-purple-700">Perfis Padrão</p>
                        <p className="text-sm text-purple-600 mt-1">Configurados</p>
                      </div>
                    </div>
                  </div>

                  {/* Ferramenta de Migração */}
                  <div className="mt-6">
                    <PermissionMigrationTool />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="matriz">
              <Card>
                <CardHeader>
                  <CardTitle>Matriz de Permissões Modulares</CardTitle>
                  <CardDescription>
                    Funcionalidades: {funcionalidadesModulares.length} | 
                    Módulos: {modulosSistema.length} | 
                    Plataformas: {plataformas.length} | 
                    Perfis: {perfisAcesso.length}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p>Matriz de permissões em desenvolvimento...</p>
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="avancadas">
              <AdvancedConfigurations />
            </TabsContent>
          </Tabs>
        </TabsContent>
      </Tabs>
    </div>
  );
}