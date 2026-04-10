'use client';

import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useModularPermissions, PERMISSION_CODES } from '@/hooks/useModularPermissions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Package, 
  Car, 
  Users, 
  ShieldCheck,
  AlertTriangle,
  ArrowRight,
  UserCog,
  LogOut,
  User as UserIcon,
  HardHat,
} from 'lucide-react';

interface HubModule {
  id: string;
  name: string;
  description: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  color: string;
  bgColor: string;
  path: string;
  permissions: string[];
}

export default function HubPage() {
  const { user, loading: authLoading, signOut } = useAuth();
  const router = useRouter();
  const { hasPermission, hasAnyPermission, loading: permissionsLoading } = useModularPermissions();
  const [availableModules, setAvailableModules] = useState<HubModule[]>([]);

  // Definir todos os módulos disponíveis no sistema (baseado no header)
  const allModules: HubModule[] = useMemo(() => [
    {
      id: 'almoxarifado',
      name: 'Almoxarifado',
      description: 'Gestão completa de estoque, EPIs e materiais',
      icon: Package,
      color: 'text-green-600',
      bgColor: 'bg-green-50 hover:bg-green-100',
      path: '/almoxarifado',
      permissions: [
        PERMISSION_CODES.ALMOXARIFADO.DASHBOARD_COMPLETO,
        PERMISSION_CODES.ALMOXARIFADO.VISUALIZAR_ESTOQUE,
        PERMISSION_CODES.ALMOXARIFADO.GERENCIAR_ESTOQUE,
        PERMISSION_CODES.ALMOXARIFADO.SOLICITAR_MATERIAL,
        PERMISSION_CODES.ALMOXARIFADO.APROVAR_SOLICITACOES,
        PERMISSION_CODES.ALMOXARIFADO.ENTREGAR_MATERIAL,
        PERMISSION_CODES.ALMOXARIFADO.CADASTRAR_NF,
        PERMISSION_CODES.ALMOXARIFADO.RELATORIOS_AVANCADOS,
      ]
    },
    {
      id: 'frota',
      name: 'Frota',
      description: 'Gestão de veículos, manutenções e controle operacional',
      icon: Car,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50 hover:bg-blue-100',
      path: '/frota',
      permissions: [
        PERMISSION_CODES.VEICULOS.DASHBOARD_FROTA,
        PERMISSION_CODES.VEICULOS.LISTAR_VEICULOS,
        PERMISSION_CODES.VEICULOS.CADASTRAR_VEICULO,
        PERMISSION_CODES.VEICULOS.GESTAO_COMPLETA_FROTA,
        PERMISSION_CODES.VEICULOS.RELATORIO_FROTA,
        PERMISSION_CODES.MANUTENCAO.DASHBOARD_MANUTENCOES,
        PERMISSION_CODES.MANUTENCAO.INDICAR_MANUTENCAO,
        PERMISSION_CODES.MANUTENCAO.APROVAR_MANUTENCAO,
      ]
    },
    {
      id: 'funcionarios',
      name: 'Funcionários',
      description: 'Gestão completa de funcionários da empresa',
      icon: Users,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50 hover:bg-purple-100',
      path: '/funcionarios',
      permissions: [
        PERMISSION_CODES.FUNCIONARIOS.VISUALIZAR,
        PERMISSION_CODES.FUNCIONARIOS.CRIAR,
        PERMISSION_CODES.FUNCIONARIOS.EDITAR,
        PERMISSION_CODES.FUNCIONARIOS.DEMITIR,
        PERMISSION_CODES.FUNCIONARIOS.VISUALIZAR_DEMITIDOS,
      ]
    },
    {
      id: 'sesmt',
      name: 'SESMT',
      description: 'Segurança e Medicina do Trabalho',
      icon: ShieldCheck,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50 hover:bg-orange-100',
      path: '/sesmt',
      permissions: [
        PERMISSION_CODES.SESMT.DASHBOARD_SESMT,
        PERMISSION_CODES.SESMT.VISUALIZAR_LAUDOS,
        PERMISSION_CODES.SESMT.GERENCIAR_LAUDOS,
        PERMISSION_CODES.SESMT.APROVAR_SOLICITACOES_SESMT,
        PERMISSION_CODES.SESMT.VISUALIZAR_SOLICITACOES_SESMT,
      ]
    },
    {
      id: 'usuarios',
      name: 'Usuários',
      description: 'Gestão de usuários e controle de acesso',
      icon: UserCog,
      color: 'text-red-600',
      bgColor: 'bg-red-50 hover:bg-red-100',
      path: '/admin/access-control',
      permissions: [
        PERMISSION_CODES.CONFIGURACOES.GERENCIAR_USUARIOS,
        PERMISSION_CODES.CONFIGURACOES.GERENCIAR_PERMISSOES,
      ]
    },
    {
      id: 'obras-manutencao',
      name: 'Obras e Manutenção',
      description: 'Gestão de obras, manutenções e programação de equipes',
      icon: HardHat,
      color: 'text-amber-600',
      bgColor: 'bg-amber-50 hover:bg-amber-100',
      path: '/obras-manutencao',
      permissions: [
        PERMISSION_CODES.OBRAS_MANUTENCAO.VISUALIZAR,
        PERMISSION_CODES.OBRAS_MANUTENCAO.CRIAR,
        PERMISSION_CODES.OBRAS_MANUTENCAO.EDITAR,
        PERMISSION_CODES.OBRAS_MANUTENCAO.PROGRAMACAO,
        PERMISSION_CODES.OBRAS_MANUTENCAO.RETORNO_EXECUCAO,
      ]
    },
  ], []);

  // Filtrar módulos baseado nas permissões do usuário
  useEffect(() => {
    if (!permissionsLoading && user) {
      const filtered = allModules.filter(module => {
        // ✅ CORREÇÃO: Usar permissões modulares em vez de hierarquia antiga
        // Se não tem permissões específicas, verificar se tem permissão de admin
        if (module.permissions.length === 0) {
          return hasPermission(PERMISSION_CODES.CONFIGURACOES.GERENCIAR_USUARIOS);
        }
        
        // Verificar se tem pelo menos uma permissão do módulo
        return hasAnyPermission(module.permissions);
      });
      
      // Se o usuário só tem acesso a 1 módulo, redirecionar direto
      if (filtered.length === 1) {
        router.replace(filtered[0].path);
        return;
      }
      
      setAvailableModules(filtered);
    }
  }, [user, permissionsLoading, hasPermission, hasAnyPermission, allModules, router]);

  // Redirecionar usuários não autenticados
  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login');
    }
  }, [user, authLoading, router]);

  if (authLoading || permissionsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const handleModuleClick = (module: HubModule) => {
    router.push(module.path);
  };

  return (
    <div className="h-screen overflow-y-auto bg-gradient-to-br from-blue-50 via-white to-green-50">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <div className="mb-8 md:mb-12">
          {/* User bar */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
            <Image src="/logo_pse.png" alt="PSE" width={120} height={40} className="h-8 sm:h-10 w-auto" />
            <div className="flex items-center gap-2 sm:gap-3 bg-white/80 backdrop-blur-sm rounded-full px-3 sm:px-4 py-2 shadow-sm border border-gray-200 w-full sm:w-auto">
              <div className="p-1.5 bg-blue-100 rounded-full shrink-0">
                <UserIcon className="h-4 w-4 text-blue-600" />
              </div>
              <div className="text-xs sm:text-sm min-w-0 flex-1">
                <span className="font-medium text-gray-900 truncate block sm:inline">{user.nome || user.email}</span>
                <span className="hidden sm:inline mx-2 text-gray-300">•</span>
                <span className="text-gray-500 block sm:inline">{user.nivel_acesso}</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => signOut()}
                className="text-red-500 hover:text-red-700 hover:bg-red-50 rounded-full ml-1 h-8 w-8 p-0 shrink-0"
                title="Sair do sistema"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Módulos Disponíveis */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {availableModules.map((module) => {
            const IconComponent = module.icon;
            return (
              <Card 
                key={module.id}
                className={`cursor-pointer transition-all duration-200 hover:shadow-lg hover:scale-105 border-0 ${module.bgColor}`}
                onClick={() => handleModuleClick(module)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className={`p-3 rounded-lg ${module.bgColor.replace('hover:', '')}`}>
                      <IconComponent className={`h-6 w-6 ${module.color}`} />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <CardTitle className={`text-lg font-semibold mb-2 ${module.color}`}>
                    {module.name}
                  </CardTitle>
                  <p className="text-gray-600 text-sm mb-4 leading-relaxed">
                    {module.description}
                  </p>
                  <Button 
                      variant="ghost" 
                      size="sm" 
                      className={`${module.color} hover:bg-white/50 p-0 h-auto font-medium`}
                    >
                      Acessar
                      <ArrowRight className="h-4 w-4 ml-1" />
                    </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Mensagem quando não há módulos disponíveis */}
        {availableModules.length === 0 && (
          <div className="text-center py-12">
            <AlertTriangle className="h-16 w-16 text-yellow-500 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              Nenhum módulo disponível
            </h3>
            <p className="text-gray-600 mb-4">
              Você não possui permissões para acessar nenhum módulo do sistema.
            </p>
            <p className="text-sm text-gray-500">
              Entre em contato com o administrador para solicitar acesso.
            </p>
          </div>
        )}

        {/* Footer com informações do sistema */}
        <div className="mt-16 text-center">
          <div className="inline-flex items-center gap-2 text-sm text-gray-500 bg-white/50 px-4 py-2 rounded-full">
            <span>Sistema PSE v2.0</span>
            <span>•</span>
            <span>Sistema Modular</span>
            <span>•</span>
            <span>{availableModules.length} módulos disponíveis</span>
          </div>
        </div>
      </div>
    </div>
  );
}
