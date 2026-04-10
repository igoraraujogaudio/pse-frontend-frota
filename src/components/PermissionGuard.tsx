'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ShieldExclamationIcon } from '@heroicons/react/24/outline';
import { useModularPermissions } from '@/hooks/useModularPermissions';

interface PermissionGuardProps {
  children: React.ReactNode;
  requiredPermissions: string[];
  fallbackMessage?: string;
}

export default function PermissionGuard({ 
  children, 
  requiredPermissions, 
  fallbackMessage = 'Você não tem permissão para acessar esta página.' 
}: PermissionGuardProps) {
  const router = useRouter();
  const { loading, userPermissions, funcionalidades } = useModularPermissions();

  // Verificar se o usuário tem pelo menos uma das permissões necessárias
  // Usar verificação direta para funcionários (sem fallback admin/diretor)
  const hasPermission = (() => {
    if (loading) return false;
    
    // Verificar se tem pelo menos uma das permissões necessárias
    return requiredPermissions.some(permissionCode => {
      // Encontrar a funcionalidade correspondente
      const funcionalidade = funcionalidades.find(f => f.codigo === permissionCode);
      if (!funcionalidade) return false;
      
      // Verificar se o usuário tem permissão específica para esta funcionalidade
      const hasPermission = userPermissions.some(p => 
        p.funcionalidade_id === funcionalidade.id && 
        p.ativo &&
        p.concedido &&
        (!p.data_fim || new Date(p.data_fim) >= new Date())
      );
      
      return hasPermission;
    });
  })();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Verificando permissões...</p>
        </div>
      </div>
    );
  }

  if (!hasPermission) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <ShieldExclamationIcon className="h-16 w-16 text-red-500 mx-auto" />
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Acesso Negado</h2>
                <p className="text-gray-600 mt-2">{fallbackMessage}</p>
              </div>
              <div className="space-y-2">
                <p className="text-sm text-gray-500">
                  Permissões necessárias:
                </p>
                <div className="flex flex-wrap gap-2 justify-center">
                  {requiredPermissions.map((permission) => (
                    <span 
                      key={permission}
                      className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded"
                    >
                      {permission}
                    </span>
                  ))}
                </div>
              </div>
              <Button 
                onClick={() => router.back()}
                variant="outline"
                className="w-full"
              >
                Voltar
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}
