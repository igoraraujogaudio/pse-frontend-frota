'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { 
  CogIcon,
  ArrowPathIcon,
  DocumentTextIcon,
  ChartBarIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  InformationCircleIcon
} from '@heroicons/react/24/outline';
import { permissionService } from '@/services/permissionService';
import { userService } from '@/services/userService';
import { contratoService } from '@/services/contratoService';
import { baseService } from '@/services/baseService';

interface SystemStats {
  totalUsers: number;
  activeUsers: number;
  totalFuncionalidades: number;
  activeFuncionalidades: number;
  totalContratos: number;
  activeContratos: number;
  totalBases: number;
  activeBases: number;
  usersWithCustomPermissions: number;
}

interface SystemConfig {
  enableLegacySystem: boolean;
  autoMigrateUsers: boolean;
  enableAuditLog: boolean;
  maxLoginAttempts: number;
  sessionTimeout: number;
  enableEmailNotifications: boolean;
}

export default function AdvancedConfigurations() {
  const [systemStats, setSystemStats] = useState<SystemStats | null>(null);
  const [systemConfig, setSystemConfig] = useState<SystemConfig>({
    enableLegacySystem: true,
    autoMigrateUsers: false,
    enableAuditLog: true,
    maxLoginAttempts: 5,
    sessionTimeout: 30,
    enableEmailNotifications: true
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // Carregar dados do sistema
  useEffect(() => {
    loadSystemData();
  }, []);

  const loadSystemData = async () => {
    setLoading(true);
    try {
      const [
        usuariosData,
        funcionalidadesData,
        contratosData,
        basesData
      ] = await Promise.all([
        userService.getAll(),
        permissionService.getFuncionalidades(),
        contratoService.getContratos(),
        baseService.getBases()
      ]);

      const stats: SystemStats = {
        totalUsers: usuariosData.length,
        activeUsers: usuariosData.filter(u => u.status === 'ativo').length,
        totalFuncionalidades: funcionalidadesData.length,
        activeFuncionalidades: funcionalidadesData.filter(f => f.ativa).length,
        totalContratos: contratosData.length,
        activeContratos: contratosData.filter(c => c.status === 'ativo').length,
        totalBases: basesData.length,
        activeBases: basesData.filter(b => b.ativa).length,
        usersWithCustomPermissions: usuariosData.filter(u => u.permissoes_personalizadas).length
      };

      setSystemStats(stats);
    } catch (error) {
      console.error('Erro ao carregar dados do sistema:', error);
      setMessage({ type: 'error', text: 'Erro ao carregar dados do sistema' });
    } finally {
      setLoading(false);
    }
  };

  const handleConfigChange = (key: keyof SystemConfig, value: unknown) => {
    setSystemConfig(prev => ({ ...prev, [key]: value }));
  };

  const handleSaveConfig = async () => {
    setSaving(true);
    try {
      // Em um sistema real, aqui seria feita a chamada para salvar as configurações
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simular delay
      
      setMessage({ type: 'success', text: 'Configurações salvas com sucesso!' });
      setTimeout(() => setMessage(null), 3000);
    } catch {
      setMessage({ type: 'error', text: 'Erro ao salvar configurações' });
    } finally {
      setSaving(false);
    }
  };

  const handleSyncLegacySystem = async () => {
    setSaving(true);
    try {
      // Simular sincronização com sistema legado
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      setMessage({ type: 'success', text: 'Sincronização com sistema legado concluída!' });
      await loadSystemData(); // Recarregar dados
    } catch {
      setMessage({ type: 'error', text: 'Erro na sincronização' });
    } finally {
      setSaving(false);
    }
  };

  const handleGenerateReport = async () => {
    setSaving(true);
    try {
      // Simular geração de relatório
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      setMessage({ type: 'success', text: 'Relatório gerado com sucesso! Download iniciado.' });
    } catch {
      setMessage({ type: 'error', text: 'Erro ao gerar relatório' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando configurações...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Configurações Avançadas</h2>
        <p className="text-gray-600">Configure o sistema de controle de acesso</p>
      </div>

      {/* Mensagens */}
      {message && (
        <Card className={`border-2 ${
          message.type === 'error' ? 'border-red-200 bg-red-50' :
          message.type === 'success' ? 'border-green-200 bg-green-50' :
          'border-blue-200 bg-blue-50'
        }`}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              {message.type === 'error' && <ExclamationTriangleIcon className="h-5 w-5 text-red-600" />}
              {message.type === 'success' && <CheckCircleIcon className="h-5 w-5 text-green-600" />}
              {message.type === 'info' && <InformationCircleIcon className="h-5 w-5 text-blue-600" />}
              <p className={`font-medium ${
                message.type === 'error' ? 'text-red-800' :
                message.type === 'success' ? 'text-green-800' :
                'text-blue-800'
              }`}>
                {message.text}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Estatísticas do Sistema */}
      {systemStats && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ChartBarIcon className="h-5 w-5" />
              Estatísticas do Sistema
            </CardTitle>
            <CardDescription>
              Visão geral dos dados do sistema de controle de acesso
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{systemStats.totalUsers}</div>
                <div className="text-sm text-gray-600">Usuários Totais</div>
                <div className="text-xs text-green-600">{systemStats.activeUsers} ativos</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{systemStats.activeFuncionalidades}</div>
                <div className="text-sm text-gray-600">Funcionalidades</div>
                <div className="text-xs text-gray-500">{systemStats.totalFuncionalidades} total</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">{systemStats.activeContratos}</div>
                <div className="text-sm text-gray-600">Contratos</div>
                <div className="text-xs text-gray-500">{systemStats.totalContratos} total</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">{systemStats.activeBases}</div>
                <div className="text-sm text-gray-600">Bases</div>
                <div className="text-xs text-gray-500">{systemStats.totalBases} total</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Configurações do Sistema */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CogIcon className="h-5 w-5" />
            Configurações do Sistema
          </CardTitle>
          <CardDescription>
            Configure comportamentos e funcionalidades do sistema
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="legacy-system">Sistema Legado</Label>
                  <p className="text-sm text-gray-500">Manter compatibilidade com sistema antigo</p>
                </div>
                <Switch
                  id="legacy-system"
                  checked={systemConfig.enableLegacySystem}
                  onCheckedChange={(checked) => handleConfigChange('enableLegacySystem', checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="auto-migrate">Migração Automática</Label>
                  <p className="text-sm text-gray-500">Migrar usuários automaticamente</p>
                </div>
                <Switch
                  id="auto-migrate"
                  checked={systemConfig.autoMigrateUsers}
                  onCheckedChange={(checked) => handleConfigChange('autoMigrateUsers', checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="audit-log">Log de Auditoria</Label>
                  <p className="text-sm text-gray-500">Registrar ações dos usuários</p>
                </div>
                <Switch
                  id="audit-log"
                  checked={systemConfig.enableAuditLog}
                  onCheckedChange={(checked) => handleConfigChange('enableAuditLog', checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="email-notifications">Notificações por Email</Label>
                  <p className="text-sm text-gray-500">Enviar notificações por email</p>
                </div>
                <Switch
                  id="email-notifications"
                  checked={systemConfig.enableEmailNotifications}
                  onCheckedChange={(checked) => handleConfigChange('enableEmailNotifications', checked)}
                />
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <Label htmlFor="max-login-attempts">Tentativas de Login</Label>
                <Input
                  id="max-login-attempts"
                  type="number"
                  value={systemConfig.maxLoginAttempts}
                  onChange={(e) => handleConfigChange('maxLoginAttempts', parseInt(e.target.value))}
                  min="1"
                  max="10"
                />
                <p className="text-sm text-gray-500">Máximo de tentativas antes de bloquear</p>
              </div>

              <div>
                <Label htmlFor="session-timeout">Timeout da Sessão (minutos)</Label>
                <Input
                  id="session-timeout"
                  type="number"
                  value={systemConfig.sessionTimeout}
                  onChange={(e) => handleConfigChange('sessionTimeout', parseInt(e.target.value))}
                  min="5"
                  max="480"
                />
                <p className="text-sm text-gray-500">Tempo limite para sessão inativa</p>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={handleSaveConfig} disabled={saving} className="bg-blue-600 hover:bg-blue-700">
              {saving ? 'Salvando...' : 'Salvar Configurações'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Ferramentas Administrativas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-2 border-dashed border-gray-200 hover:border-blue-300 transition-colors">
          <CardContent className="p-4">
            <div className="text-center">
              <div className="bg-blue-100 p-3 rounded-full w-fit mx-auto mb-3">
                <ArrowPathIcon className="h-8 w-8 text-blue-600" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">
                Sincronização
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                Sincronizar com sistema legado
              </p>
              <Button 
                onClick={handleSyncLegacySystem} 
                disabled={saving}
                variant="outline" 
                size="sm" 
                className="w-full"
              >
                {saving ? 'Sincronizando...' : 'Sincronizar'}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-2 border-dashed border-gray-200 hover:border-green-300 transition-colors">
          <CardContent className="p-4">
            <div className="text-center">
              <div className="bg-green-100 p-3 rounded-full w-fit mx-auto mb-3">
                <DocumentTextIcon className="h-8 w-8 text-green-600" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">
                Relatórios
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                Gerar relatórios de acesso
              </p>
              <Button 
                onClick={handleGenerateReport} 
                disabled={saving}
                variant="outline" 
                size="sm" 
                className="w-full"
              >
                {saving ? 'Gerando...' : 'Gerar Relatório'}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-2 border-dashed border-gray-200 hover:border-orange-300 transition-colors">
          <CardContent className="p-4">
            <div className="text-center">
              <div className="bg-orange-100 p-3 rounded-full w-fit mx-auto mb-3">
                <CogIcon className="h-8 w-8 text-orange-600" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">
                Manutenção
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                Ferramentas de manutenção
              </p>
              <Button variant="outline" size="sm" className="w-full">
                Acessar
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

