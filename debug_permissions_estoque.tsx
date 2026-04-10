'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useModularPermissions, PERMISSION_CODES } from '@/hooks/useModularPermissions'
import { useWebAlmoxarifadoPermissions } from '@/hooks/useWebAlmoxarifadoPermissions'

export default function DebugPermissionsEstoque() {
  const { user } = useAuth()
  const { hasPermission, userPermissions, loading } = useModularPermissions()
  const { 
    canCreateNewItem, 
    canEditItemQuantity, 
    canEditItemData,
    canDeleteItem
  } = useWebAlmoxarifadoPermissions()

  const [debugInfo, setDebugInfo] = useState<any>(null)

  useEffect(() => {
    if (user && !loading) {
      const info = {
        user: {
          id: user.id,
          nome: user.nome,
          email: user.email,
          nivel_acesso: user.nivel_acesso
        },
        permissions: {
          // Permissões específicas do estoque
          CRIAR_NOVO_ITEM_WEB: {
            hasPermission: hasPermission(PERMISSION_CODES.ALMOXARIFADO.CRIAR_NOVO_ITEM_WEB),
            canCreateNewItem: canCreateNewItem(),
            codigo: PERMISSION_CODES.ALMOXARIFADO.CRIAR_NOVO_ITEM_WEB
          },
          EDITAR_QUANTIDADE_ITEM_WEB: {
            hasPermission: hasPermission(PERMISSION_CODES.ALMOXARIFADO.EDITAR_QUANTIDADE_ITEM_WEB),
            canEditItemQuantity: canEditItemQuantity(),
            codigo: PERMISSION_CODES.ALMOXARIFADO.EDITAR_QUANTIDADE_ITEM_WEB
          },
          EDITAR_DADOS_ITEM_WEB: {
            hasPermission: hasPermission(PERMISSION_CODES.ALMOXARIFADO.EDITAR_DADOS_ITEM_WEB),
            canEditItemData: canEditItemData(),
            codigo: PERMISSION_CODES.ALMOXARIFADO.EDITAR_DADOS_ITEM_WEB
          },
          EXCLUIR_ITEM_WEB: {
            hasPermission: hasPermission(PERMISSION_CODES.ALMOXARIFADO.EXCLUIR_ITEM_WEB),
            canDeleteItem: canDeleteItem(),
            codigo: PERMISSION_CODES.ALMOXARIFADO.EXCLUIR_ITEM_WEB
          }
        },
        allUserPermissions: userPermissions?.map(p => ({
          id: p.id,
          funcionalidade_codigo: p.funcionalidade?.codigo,
          tipo_permissao: p.tipo_permissao,
          concedido: p.concedido,
          ativo: p.ativo,
          data_fim: p.data_fim,
          motivo: p.motivo
        })) || []
      }
      
      setDebugInfo(info)
      console.log('🔍 DEBUG PERMISSÕES ESTOQUE:', info)
    }
  }, [user, loading, hasPermission, canCreateNewItem, canEditItemQuantity, canEditItemData, canDeleteItem, userPermissions])

  if (loading) {
    return <div>Carregando permissões...</div>
  }

  if (!user) {
    return <div>Usuário não logado</div>
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Debug - Permissões do Estoque</h1>
      
      <div className="space-y-6">
        {/* Informações do Usuário */}
        <div className="bg-gray-100 p-4 rounded-lg">
          <h2 className="text-lg font-semibold mb-2">Informações do Usuário</h2>
          <pre className="text-sm">{JSON.stringify(debugInfo?.user, null, 2)}</pre>
        </div>

        {/* Permissões Específicas */}
        <div className="bg-blue-50 p-4 rounded-lg">
          <h2 className="text-lg font-semibold mb-2">Permissões Específicas do Estoque</h2>
          <div className="space-y-2">
            {debugInfo?.permissions && Object.entries(debugInfo.permissions).map(([key, perm]: [string, any]) => (
              <div key={key} className="flex items-center gap-4 p-2 bg-white rounded border">
                <span className="font-medium w-48">{key}:</span>
                <span className={`px-2 py-1 rounded text-sm ${perm.hasPermission ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                  hasPermission: {perm.hasPermission ? 'SIM' : 'NÃO'}
                </span>
                <span className={`px-2 py-1 rounded text-sm ${perm.canCreateNewItem || perm.canEditItemQuantity || perm.canEditItemData || perm.canDeleteItem ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                  Hook: {perm.canCreateNewItem || perm.canEditItemQuantity || perm.canEditItemData || perm.canDeleteItem ? 'SIM' : 'NÃO'}
                </span>
                <span className="text-xs text-gray-600">{perm.codigo}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Todas as Permissões do Usuário */}
        <div className="bg-yellow-50 p-4 rounded-lg">
          <h2 className="text-lg font-semibold mb-2">Todas as Permissões do Usuário</h2>
          <div className="max-h-96 overflow-y-auto">
            <pre className="text-xs">{JSON.stringify(debugInfo?.allUserPermissions, null, 2)}</pre>
          </div>
        </div>

        {/* Permissões Relacionadas ao Almoxarifado */}
        <div className="bg-green-50 p-4 rounded-lg">
          <h2 className="text-lg font-semibold mb-2">Permissões Relacionadas ao Almoxarifado</h2>
          <div className="space-y-1">
            {debugInfo?.allUserPermissions?.filter((p: any) => 
              p.funcionalidade_codigo?.includes('almoxarifado')
            ).map((perm: any, index: number) => (
              <div key={index} className="flex items-center gap-2 p-1 bg-white rounded text-sm">
                <span className={`px-2 py-1 rounded text-xs ${perm.concedido ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                  {perm.concedido ? 'SIM' : 'NÃO'}
                </span>
                <span className="font-medium">{perm.funcionalidade_codigo}</span>
                <span className="text-xs text-gray-500">({perm.tipo_permissao})</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
