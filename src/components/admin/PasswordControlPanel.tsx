"use client";

import { useState, useEffect, useCallback } from 'react';
import { useNotification } from '@/contexts/NotificationContext';

interface PasswordControlStats {
  total: number;
  mustChange: number;
  forcedByAdmin: number;
  firstLogin: number;
}

export default function PasswordControlPanel() {
  const { notify } = useNotification();
  const [stats, setStats] = useState<PasswordControlStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [statsLoading, setStatsLoading] = useState(true);

  // Carregar estatísticas
  const loadStats = useCallback(async () => {
    try {
      setStatsLoading(true);
      const response = await fetch('/api/admin/password-control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get_stats' })
      });

      const data = await response.json();
      if (data.success) {
        setStats(data.stats);
      } else {
        notify('Erro ao carregar estatísticas: ' + data.error, 'error');
      }
    } catch {
      notify('Erro ao carregar estatísticas', 'error');
    } finally {
      setStatsLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const handleAction = async (action: string, userId?: string) => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/password-control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, userId })
      });

      const data = await response.json();
      if (data.success) {
        notify(data.message, 'success');
        // Recarregar estatísticas
        await loadStats();
      } else {
        notify('Erro: ' + data.error, 'error');
      }
    } catch {
      notify('Erro ao executar ação', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-medium text-gray-900">
          Controle de Mudança de Senha
        </h3>
        <button
          onClick={() => loadStats()}
          disabled={statsLoading}
          className="text-sm text-blue-600 hover:text-blue-800 disabled:opacity-50"
        >
          {statsLoading ? 'Carregando...' : 'Atualizar'}
        </button>
      </div>

      {/* Estatísticas */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="text-sm font-medium text-blue-800">Total de Usuários</div>
            <div className="text-2xl font-bold text-blue-900">{stats.total}</div>
          </div>
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="text-sm font-medium text-yellow-800">Devem Mudar Senha</div>
            <div className="text-2xl font-bold text-yellow-900">{stats.mustChange}</div>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="text-sm font-medium text-red-800">Forçados pelo Admin</div>
            <div className="text-2xl font-bold text-red-900">{stats.forcedByAdmin}</div>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="text-sm font-medium text-green-800">Primeiro Login</div>
            <div className="text-2xl font-bold text-green-900">{stats.firstLogin}</div>
          </div>
        </div>
      )}

      {/* Ações Administrativas */}
      <div className="space-y-4">
        <div className="border-t pt-6">
          <h4 className="text-md font-medium text-gray-900 mb-4">Ações Administrativas</h4>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Forçar todos */}
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <h5 className="font-medium text-red-900 mb-2">Forçar Mudança de Senha</h5>
              <p className="text-sm text-red-700 mb-3">
                Marca todos os usuários ativos para mudar senha no próximo login.
              </p>
              <button
                onClick={() => handleAction('force_all')}
                disabled={loading}
                className="w-full bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Processando...' : 'Forçar Todos os Usuários'}
              </button>
            </div>

            {/* Cancelar todos */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <h5 className="font-medium text-green-900 mb-2">Cancelar Força de Mudança</h5>
              <p className="text-sm text-green-700 mb-3">
                Remove a obrigatoriedade de mudança de senha para todos os usuários.
              </p>
              <button
                onClick={() => handleAction('cancel_all')}
                disabled={loading}
                className="w-full bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Processando...' : 'Cancelar Para Todos'}
              </button>
            </div>
          </div>
        </div>

        {/* Avisos */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800">
                Aviso Importante
              </h3>
              <div className="mt-2 text-sm text-yellow-700">
                <ul className="list-disc list-inside space-y-1">
                  <li>Usuários com mudança de senha obrigatória não conseguirão acessar o sistema até alterarem a senha</li>
                  <li>A ação &quot;Forçar Todos&quot; afetará todos os usuários ativos do sistema</li>
                  <li>Use com cuidado em ambientes de produção</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
