import React, { useEffect, useState } from 'react';
import { useModularPermissions } from '@/hooks/useModularPermissions';
import { useWebAlmoxarifadoPermissions } from '@/hooks/useWebAlmoxarifadoPermissions';

interface FuncionalidadeInfo {
  codigo: string;
  nome: string;
  ativa: boolean;
  categoria: string;
}

interface UserPermissionInfo {
  codigo: string;
  nome: string;
  concedido: boolean;
  ativo: boolean;
  tipo_permissao: string;
}

interface DebugInfo {
  modular: {
    loading: boolean;
    error: string | null;
    funcionalidadesCount: number;
    userPermissionsCount: number;
    hasEditQuantityPermission: boolean;
    hasEditQuantityMobilePermission: boolean;
  };
  almoxarifado: {
    canEditItemQuantity: boolean;
    canEditItemQuantityMobile: boolean;
    canOnlyEditQuantity: boolean;
  };
  funcionalidades: FuncionalidadeInfo[];
  userPermissions: UserPermissionInfo[];
}

export const DebugPermissions: React.FC = () => {
  const modularPermissions = useModularPermissions();
  const almoxarifadoPermissions = useWebAlmoxarifadoPermissions();
  const [debugInfo, setDebugInfo] = useState<DebugInfo | null>(null);

  useEffect(() => {
    const info = {
      // Informações do hook modular
      modular: {
        loading: modularPermissions.loading,
        error: modularPermissions.error,
        funcionalidadesCount: modularPermissions.funcionalidades.length,
        userPermissionsCount: modularPermissions.userPermissions.length,
        hasEditQuantityPermission: modularPermissions.hasPermission('almoxarifado.web.editar_quantidade_item'),
        hasEditQuantityMobilePermission: modularPermissions.hasPermission('almoxarifado.mobile.editar_quantidade_item'),
      },
      // Informações do hook almoxarifado
      almoxarifado: {
        canEditItemQuantity: almoxarifadoPermissions.canEditItemQuantity(),
        canEditItemQuantityMobile: almoxarifadoPermissions.canEditItemQuantityMobile(),
        canOnlyEditQuantity: almoxarifadoPermissions.canOnlyEditQuantity(),
      },
      // Funcionalidades específicas
      funcionalidades: modularPermissions.funcionalidades
        .filter(f => f.codigo.includes('editar_quantidade'))
        .map(f => ({
          codigo: f.codigo,
          nome: f.nome,
          ativa: f.ativa,
          categoria: f.categoria,
        })),
      // Permissões do usuário específicas
      userPermissions: modularPermissions.userPermissions
        .filter(p => p.funcionalidade?.codigo.includes('editar_quantidade'))
        .map(p => ({
          codigo: p.funcionalidade?.codigo || 'N/A',
          nome: p.funcionalidade?.nome || 'N/A',
          concedido: p.concedido,
          ativo: p.ativo,
          tipo_permissao: p.tipo_permissao,
        })),
    };
    
    setDebugInfo(info);
  }, [modularPermissions, almoxarifadoPermissions]);

  if (!debugInfo) return <div>Carregando debug...</div>;

  return (
    <div className="p-4 bg-gray-100 rounded-lg">
      <h3 className="text-lg font-bold mb-4">🔍 Debug de Permissões</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Hook Modular */}
        <div className="bg-white p-4 rounded">
          <h4 className="font-semibold mb-2">Hook Modular</h4>
          <div className="text-sm space-y-1">
            <div>Loading: {debugInfo.modular.loading ? 'Sim' : 'Não'}</div>
            <div>Error: {debugInfo.modular.error || 'Nenhum'}</div>
            <div>Funcionalidades: {debugInfo.modular.funcionalidadesCount}</div>
            <div>Permissões do usuário: {debugInfo.modular.userPermissionsCount}</div>
            <div className="font-semibold">
              Pode editar quantidade (Web): {debugInfo.modular.hasEditQuantityPermission ? '✅ Sim' : '❌ Não'}
            </div>
            <div className="font-semibold">
              Pode editar quantidade (Mobile): {debugInfo.modular.hasEditQuantityMobilePermission ? '✅ Sim' : '❌ Não'}
            </div>
          </div>
        </div>

        {/* Hook Almoxarifado */}
        <div className="bg-white p-4 rounded">
          <h4 className="font-semibold mb-2">Hook Almoxarifado</h4>
          <div className="text-sm space-y-1">
            <div className="font-semibold">
              canEditItemQuantity: {debugInfo.almoxarifado.canEditItemQuantity ? '✅ Sim' : '❌ Não'}
            </div>
            <div className="font-semibold">
              canEditItemQuantityMobile: {debugInfo.almoxarifado.canEditItemQuantityMobile ? '✅ Sim' : '❌ Não'}
            </div>
            <div className="font-semibold">
              canOnlyEditQuantity: {debugInfo.almoxarifado.canOnlyEditQuantity ? '✅ Sim' : '❌ Não'}
            </div>
          </div>
        </div>
      </div>

      {/* Funcionalidades */}
      <div className="mt-4 bg-white p-4 rounded">
        <h4 className="font-semibold mb-2">Funcionalidades de Edição de Quantidade</h4>
        {debugInfo.funcionalidades.length > 0 ? (
          <div className="text-sm space-y-2">
            {debugInfo.funcionalidades.map((f: FuncionalidadeInfo, index: number) => (
              <div key={index} className="border p-2 rounded">
                <div><strong>Código:</strong> {f.codigo}</div>
                <div><strong>Nome:</strong> {f.nome}</div>
                <div><strong>Ativa:</strong> {f.ativa ? 'Sim' : 'Não'}</div>
                <div><strong>Categoria:</strong> {f.categoria}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-red-600">❌ Nenhuma funcionalidade de edição de quantidade encontrada!</div>
        )}
      </div>

      {/* Permissões do usuário */}
      <div className="mt-4 bg-white p-4 rounded">
        <h4 className="font-semibold mb-2">Permissões do Usuário</h4>
        {debugInfo.userPermissions.length > 0 ? (
          <div className="text-sm space-y-2">
            {debugInfo.userPermissions.map((p: UserPermissionInfo, index: number) => (
              <div key={index} className="border p-2 rounded">
                <div><strong>Código:</strong> {p.codigo}</div>
                <div><strong>Nome:</strong> {p.nome}</div>
                <div><strong>Concedido:</strong> {p.concedido ? 'Sim' : 'Não'}</div>
                <div><strong>Ativo:</strong> {p.ativo ? 'Sim' : 'Não'}</div>
                <div><strong>Tipo:</strong> {p.tipo_permissao}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-red-600">❌ Nenhuma permissão de edição de quantidade encontrada para o usuário!</div>
        )}
      </div>

      {/* Ações de debug */}
      <div className="mt-4 bg-white p-4 rounded">
        <h4 className="font-semibold mb-2">Ações de Debug</h4>
        <div className="space-x-2">
          <button 
            onClick={() => modularPermissions.refreshPermissions()}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Recarregar Permissões
          </button>
          <button 
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
          >
            Recarregar Página
          </button>
        </div>
      </div>
    </div>
  );
};

export default DebugPermissions;

