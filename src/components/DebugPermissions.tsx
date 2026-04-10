'use client';

import { useState } from 'react';
import { useModularPermissions, PERMISSION_CODES } from '@/hooks/useModularPermissions';
import { useAuth } from '@/contexts/AuthContext';

export default function DebugPermissions() {
  const { user } = useAuth();
  const { 
    hasPermission, 
    funcionalidades, 
    modulos, 
    plataformas, 
    perfis,
    customPermissions,
    loading,
    error,
    getPermissionStats
  } = useModularPermissions();

  const [testPermission, setTestPermission] = useState<string>('');

  const stats = getPermissionStats();

  if (loading) {
    return (
      <div className="p-6 bg-white rounded-lg shadow">
        <h2 className="text-xl font-bold mb-4">🔍 Debug Permissions - Carregando...</h2>
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-5/6"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-lg">
        <h2 className="text-xl font-bold text-red-800 mb-2">❌ Erro no Debug</h2>
        <p className="text-red-600">{error}</p>
      </div>
    );
  }

  return (
    <div className="p-6 bg-white rounded-lg shadow space-y-6">
      <h2 className="text-2xl font-bold text-gray-800">🔍 Debug Sistema Modular</h2>
      
      {/* Informações do Usuário */}
      <div className="bg-blue-50 p-4 rounded-lg">
        <h3 className="text-lg font-semibold text-blue-800 mb-2">👤 Usuário Atual</h3>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div><strong>Nome:</strong> {user?.nome}</div>
          <div><strong>Email:</strong> {user?.email}</div>
          <div><strong>Nível:</strong> {user?.nivel_acesso}</div>
          <div><strong>Status:</strong> {user?.status}</div>
        </div>
      </div>

      {/* Estatísticas */}
      <div className="bg-green-50 p-4 rounded-lg">
        <h3 className="text-lg font-semibold text-green-800 mb-2">📊 Estatísticas</h3>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div><strong>Total Custom:</strong> {stats.totalCustom}</div>
          <div><strong>Adicionais:</strong> {stats.additionalPermissions}</div>
          <div><strong>Restrições:</strong> {stats.restrictions}</div>
          <div><strong>Personalizadas:</strong> {stats.hasCustomPermissions ? 'SIM' : 'NÃO'}</div>
        </div>
      </div>

      {/* Teste de Permissões */}
      <div className="bg-yellow-50 p-4 rounded-lg">
        <h3 className="text-lg font-semibold text-yellow-800 mb-2">🧪 Teste de Permissões</h3>
        
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Testar Permissão:
            </label>
            <input
              type="text"
              value={testPermission}
              onChange={(e) => setTestPermission(e.target.value)}
              placeholder="Ex: almoxarifado.site.dashboard_completo"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {testPermission && (
              <div className="mt-2">
                <span className={`px-2 py-1 rounded text-sm ${
                  hasPermission(testPermission) 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-red-100 text-red-800'
                }`}>
                  {hasPermission(testPermission) ? '✅ TEM PERMISSÃO' : '❌ NÃO TEM PERMISSÃO'}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Permissões por Módulo */}
      <div className="bg-purple-50 p-4 rounded-lg">
        <h3 className="text-lg font-semibold text-purple-800 mb-2">📦 Permissões por Módulo</h3>
        <div className="grid grid-cols-2 gap-2 text-sm">
          {Object.entries(stats.modulePermissions).map(([modulo, count]) => (
            <div key={modulo} className="flex justify-between">
              <span>{modulo}:</span>
              <span className="font-semibold">{count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Permissões por Plataforma */}
      <div className="bg-indigo-50 p-4 rounded-lg">
        <h3 className="text-lg font-semibold text-indigo-800 mb-2">🌐 Permissões por Plataforma</h3>
        <div className="grid grid-cols-2 gap-2 text-sm">
          {Object.entries(stats.platformPermissions).map(([plataforma, count]) => (
            <div key={plataforma} className="flex justify-between">
              <span>{plataforma}:</span>
              <span className="font-semibold">{count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Testes Rápidos */}
      <div className="bg-gray-50 p-4 rounded-lg">
        <h3 className="text-lg font-semibold text-gray-800 mb-2">⚡ Testes Rápidos</h3>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="flex justify-between">
            <span>Almoxarifado Dashboard:</span>
            <span className={hasPermission(PERMISSION_CODES.ALMOXARIFADO.DASHBOARD_COMPLETO) ? 'text-green-600' : 'text-red-600'}>
              {hasPermission(PERMISSION_CODES.ALMOXARIFADO.DASHBOARD_COMPLETO) ? '✅' : '❌'}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Veículos Dashboard:</span>
            <span className={hasPermission(PERMISSION_CODES.VEICULOS.DASHBOARD_FROTA) ? 'text-green-600' : 'text-red-600'}>
              {hasPermission(PERMISSION_CODES.VEICULOS.DASHBOARD_FROTA) ? '✅' : '❌'}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Manutenção Dashboard:</span>
            <span className={hasPermission(PERMISSION_CODES.MANUTENCAO.DASHBOARD_MANUTENCOES) ? 'text-green-600' : 'text-red-600'}>
              {hasPermission(PERMISSION_CODES.MANUTENCAO.DASHBOARD_MANUTENCOES) ? '✅' : '❌'}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Laudos Gerenciar:</span>
            <span className={hasPermission(PERMISSION_CODES.LAUDOS.GERENCIAR_LAUDOS) ? 'text-green-600' : 'text-red-600'}>
              {hasPermission(PERMISSION_CODES.LAUDOS.GERENCIAR_LAUDOS) ? '✅' : '❌'}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Portaria Relatórios:</span>
            <span className={hasPermission(PERMISSION_CODES.PORTARIA.RELATORIO_MOVIMENTACOES) ? 'text-green-600' : 'text-red-600'}>
              {hasPermission(PERMISSION_CODES.PORTARIA.RELATORIO_MOVIMENTACOES) ? '✅' : '❌'}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Equipes Gerenciar:</span>
            <span className={hasPermission(PERMISSION_CODES.EQUIPES.GERENCIAR_EQUIPES) ? 'text-green-600' : 'text-red-600'}>
              {hasPermission(PERMISSION_CODES.EQUIPES.GERENCIAR_EQUIPES) ? '✅' : '❌'}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Checklist Configurar:</span>
            <span className={hasPermission(PERMISSION_CODES.CHECKLIST.CONFIGURAR_CHECKLISTS) ? 'text-green-600' : 'text-red-600'}>
              {hasPermission(PERMISSION_CODES.CHECKLIST.CONFIGURAR_CHECKLISTS) ? '✅' : '❌'}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Relatórios Dashboard:</span>
            <span className={hasPermission(PERMISSION_CODES.RELATORIOS.DASHBOARD_EXECUTIVO) ? 'text-green-600' : 'text-red-600'}>
              {hasPermission(PERMISSION_CODES.RELATORIOS.DASHBOARD_EXECUTIVO) ? '✅' : '❌'}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Configurações Usuários:</span>
            <span className={hasPermission(PERMISSION_CODES.CONFIGURACOES.GERENCIAR_USUARIOS) ? 'text-green-600' : 'text-red-600'}>
              {hasPermission(PERMISSION_CODES.CONFIGURACOES.GERENCIAR_USUARIOS) ? '✅' : '❌'}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Apresentação Configurar:</span>
            <span className={hasPermission(PERMISSION_CODES.APRESENTACAO_EQUIPE.CONFIGURAR_APRESENTACAO) ? 'text-green-600' : 'text-red-600'}>
              {hasPermission(PERMISSION_CODES.APRESENTACAO_EQUIPE.CONFIGURAR_APRESENTACAO) ? '✅' : '❌'}
            </span>
          </div>
        </div>
      </div>

      {/* Dados do Sistema */}
      <div className="bg-slate-50 p-4 rounded-lg">
        <h3 className="text-lg font-semibold text-slate-800 mb-2">🗂️ Dados do Sistema</h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <h4 className="font-semibold text-slate-700 mb-1">Módulos ({modulos.length})</h4>
            <div className="max-h-32 overflow-y-auto">
              {modulos.map(modulo => (
                <div key={modulo.id} className="text-xs">
                  {modulo.nome} ({modulo.codigo})
                </div>
              ))}
            </div>
          </div>
          <div>
            <h4 className="font-semibold text-slate-700 mb-1">Plataformas ({plataformas.length})</h4>
            <div className="max-h-32 overflow-y-auto">
              {plataformas.map(plataforma => (
                <div key={plataforma.id} className="text-xs">
                  {plataforma.nome} ({plataforma.codigo})
                </div>
              ))}
            </div>
          </div>
          <div>
            <h4 className="font-semibold text-slate-700 mb-1">Perfis ({perfis.length})</h4>
            <div className="max-h-32 overflow-y-auto">
              {perfis.map(perfil => (
                <div key={perfil.id} className="text-xs">
                  {perfil.nome} (Nível: {perfil.nivel_hierarquia})
                </div>
              ))}
            </div>
          </div>
          <div>
            <h4 className="font-semibold text-slate-700 mb-1">Funcionalidades ({funcionalidades.length})</h4>
            <div className="max-h-32 overflow-y-auto">
              {funcionalidades.slice(0, 10).map(func => (
                <div key={func.id} className="text-xs">
                  {func.nome} ({func.codigo})
                </div>
              ))}
              {funcionalidades.length > 10 && (
                <div className="text-xs text-gray-500">
                  ... e mais {funcionalidades.length - 10} funcionalidades
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Permissões Personalizadas */}
      {customPermissions.length > 0 && (
        <div className="bg-orange-50 p-4 rounded-lg">
          <h3 className="text-lg font-semibold text-orange-800 mb-2">
            🔧 Permissões Personalizadas ({customPermissions.length})
          </h3>
          <div className="max-h-48 overflow-y-auto">
            {customPermissions.map(permission => (
              <div key={permission.id} className="text-sm border-b border-orange-200 py-1">
                <div className="flex justify-between">
                  <span className="font-medium">
                    {permission.funcionalidade?.nome || 'N/A'}
                  </span>
                  <span className={`px-2 py-1 rounded text-xs ${
                    permission.concedido 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {permission.concedido ? 'CONCEDIDO' : 'NEGADO'}
                  </span>
                </div>
                <div className="text-xs text-gray-600">
                  {permission.funcionalidade?.codigo} | {permission.tipo_permissao}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* JSON Debug */}
      <details className="bg-gray-100 p-4 rounded-lg">
        <summary className="cursor-pointer font-semibold text-gray-800">
          🔍 JSON Debug (Clique para expandir)
        </summary>
        <pre className="mt-2 text-xs overflow-auto bg-white p-2 rounded border">
          {JSON.stringify({
            user: {
              id: user?.id,
              nome: user?.nome,
              nivel_acesso: user?.nivel_acesso,
              status: user?.status
            },
            stats,
            customPermissions: customPermissions.map(p => ({
              funcionalidade: p.funcionalidade?.codigo,
              concedido: p.concedido,
              tipo: p.tipo_permissao
            }))
          }, null, 2)}
        </pre>
      </details>
    </div>
  );
}


