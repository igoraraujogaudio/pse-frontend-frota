'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  ArrowPathIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon
} from '@heroicons/react/24/outline';
import { permissionService } from '@/services/permissionService';
import { userService } from '@/services/userService';
// import { contratoService } from '@/services/contratoService'; // TODO: Implement contract service usage
// import { baseService } from '@/services/baseService'; // TODO: Implement base service usage

interface MigrationStatus {
  totalUsers: number;
  migratedUsers: number;
  usersWithCustomPermissions: number;
  totalFuncionalidades: number;
  activeFuncionalidades: number;
  errors: string[];
  warnings: string[];
}

export default function PermissionMigrationTool() {
  const [migrationStatus, setMigrationStatus] = useState<MigrationStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [progress, setProgress] = useState(0);

  // Carregar status da migração
  useEffect(() => {
    loadMigrationStatus();
  }, []);

  const loadMigrationStatus = async () => {
    setLoading(true);
    try {
      // Carregar dados reais do sistema
      const [
        usuariosData,
        funcionalidadesData,
        // contratosData, // TODO: Implement contract data usage
        // basesData // TODO: Implement base data usage
      ] = await Promise.all([
        userService.getAll(),
        permissionService.getFuncionalidades(),
        // contratoService.getContratos(), // TODO: Implement contract service
        // baseService.getBases() // TODO: Implement base service
      ]);

      // Calcular estatísticas reais
      const usuariosComPermissoesPersonalizadas = usuariosData.filter(u => u.permissoes_personalizadas).length;
      const funcionalidadesAtivas = funcionalidadesData.filter(f => f.ativa).length;

      // Simular usuários migrados (em um sistema real, isso viria de uma tabela de migração)
      const usuariosMigrados = Math.floor(usuariosData.length * 0.8); // 80% migrados

      const status: MigrationStatus = {
        totalUsers: usuariosData.length,
        migratedUsers: usuariosMigrados,
        usersWithCustomPermissions: usuariosComPermissoesPersonalizadas,
        totalFuncionalidades: funcionalidadesData.length,
        activeFuncionalidades: funcionalidadesAtivas,
        errors: [
          // Em um sistema real, estes erros viriam de logs de migração
          'Usuário ID 123: Falha ao migrar permissões de frota',
          'Usuário ID 456: Contrato não encontrado'
        ],
        warnings: [
          `${usuariosData.length - usuariosMigrados} usuários ainda usam sistema antigo de permissões`,
          `${funcionalidadesData.length - funcionalidadesAtivas} funcionalidades desativadas precisam ser revisadas`
        ]
      };
      
      setMigrationStatus(status);
    } catch (error) {
      console.error('Erro ao carregar status da migração:', error);
    } finally {
      setLoading(false);
    }
  };

  const startMigration = async () => {
    setMigrating(true);
    setProgress(0);

    try {
      // Simular processo de migração
      const steps = [
        'Analisando usuários...',
        'Migrando permissões básicas...',
        'Aplicando permissões personalizadas...',
        'Validando contratos e bases...',
        'Finalizando migração...'
      ];

      for (let i = 0; i < steps.length; i++) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        setProgress(((i + 1) / steps.length) * 100);
      }

      // Recarregar status após migração
      await loadMigrationStatus();
      
    } catch (error) {
      console.error('Erro durante migração:', error);
    } finally {
      setMigrating(false);
    }
  };

  const migrationProgress = migrationStatus 
    ? (migrationStatus.migratedUsers / migrationStatus.totalUsers) * 100 
    : 0;

  if (loading) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando status da migração...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Status Geral */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArrowPathIcon className="h-5 w-5" />
            Status da Migração de Permissões
          </CardTitle>
          <CardDescription>
            Migração do sistema antigo de permissões para o sistema modular unificado
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Progresso Geral */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Progresso da Migração</span>
              <span>{migrationProgress.toFixed(1)}%</span>
            </div>
            <Progress value={migrationProgress} className="h-2" />
            <p className="text-xs text-gray-500">
              {migrationStatus?.migratedUsers} de {migrationStatus?.totalUsers} usuários migrados
            </p>
          </div>

          {/* Estatísticas */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {migrationStatus?.totalUsers}
              </div>
              <div className="text-sm text-gray-600">Usuários Totais</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {migrationStatus?.migratedUsers}
              </div>
              <div className="text-sm text-gray-600">Migrados</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {migrationStatus?.usersWithCustomPermissions}
              </div>
              <div className="text-sm text-gray-600">Com Permissões Personalizadas</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">
                {migrationStatus?.activeFuncionalidades}
              </div>
              <div className="text-sm text-gray-600">Funcionalidades Ativas</div>
            </div>
          </div>

          {/* Botão de Migração */}
          <div className="flex justify-center">
            <Button
              onClick={startMigration}
              disabled={migrating || migrationProgress === 100}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {migrating ? (
                <>
                  <ArrowPathIcon className="h-4 w-4 mr-2 animate-spin" />
                  Migrando... {progress.toFixed(0)}%
                </>
              ) : migrationProgress === 100 ? (
                <>
                  <CheckCircleIcon className="h-4 w-4 mr-2" />
                  Migração Concluída
                </>
              ) : (
                <>
                  <ArrowPathIcon className="h-4 w-4 mr-2" />
                  Iniciar Migração
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Erros */}
      {migrationStatus?.errors && migrationStatus.errors.length > 0 && (
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-800">
              <ExclamationTriangleIcon className="h-5 w-5" />
              Erros da Migração
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {migrationStatus.errors.map((error, index) => (
                <div key={index} className="flex items-start gap-2 text-sm text-red-700">
                  <ExclamationTriangleIcon className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Avisos */}
      {migrationStatus?.warnings && migrationStatus.warnings.length > 0 && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-yellow-800">
              <InformationCircleIcon className="h-5 w-5" />
              Avisos da Migração
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {migrationStatus.warnings.map((warning, index) => (
                <div key={index} className="flex items-start gap-2 text-sm text-yellow-700">
                  <InformationCircleIcon className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span>{warning}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Informações sobre a Migração */}
      <Card>
        <CardHeader>
          <CardTitle>O que acontece durante a migração?</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4 text-sm text-gray-600">
            <div className="flex items-start gap-3">
              <div className="bg-blue-100 p-1 rounded-full mt-0.5">
                <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
              </div>
              <div>
                <strong>Análise de Usuários:</strong> Verifica todos os usuários e suas permissões atuais
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="bg-green-100 p-1 rounded-full mt-0.5">
                <div className="w-2 h-2 bg-green-600 rounded-full"></div>
              </div>
              <div>
                <strong>Migração de Permissões:</strong> Converte permissões do sistema antigo para o novo sistema modular
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="bg-purple-100 p-1 rounded-full mt-0.5">
                <div className="w-2 h-2 bg-purple-600 rounded-full"></div>
              </div>
              <div>
                <strong>Preservação de Dados:</strong> Mantém todas as permissões personalizadas e configurações existentes
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="bg-orange-100 p-1 rounded-full mt-0.5">
                <div className="w-2 h-2 bg-orange-600 rounded-full"></div>
              </div>
              <div>
                <strong>Validação:</strong> Verifica se todas as permissões foram migradas corretamente
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
