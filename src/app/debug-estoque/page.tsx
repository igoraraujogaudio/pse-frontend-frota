'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useModularPermissions, PERMISSION_CODES } from '@/hooks/useModularPermissions'
import { useWebAlmoxarifadoPermissions } from '@/hooks/useWebAlmoxarifadoPermissions'

export default function DebugEstoque() {
  const { user } = useAuth()
  const { hasPermission, userPermissions, loading } = useModularPermissions()
  const { 
    canCreateNewItem, 
    canDeleteItem
  } = useWebAlmoxarifadoPermissions()

  const [debugInfo, setDebugInfo] = useState<Record<string, unknown> | null>(null)

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
          CRIAR_NOVO_ITEM_WEB: {
            hasPermission: hasPermission(PERMISSION_CODES.ALMOXARIFADO.CRIAR_NOVO_ITEM_WEB),
            canCreateNewItem: canCreateNewItem(),
            codigo: PERMISSION_CODES.ALMOXARIFADO.CRIAR_NOVO_ITEM_WEB
          },
          EXCLUIR_ITEM_WEB: {
            hasPermission: hasPermission(PERMISSION_CODES.ALMOXARIFADO.EXCLUIR_ITEM_WEB),
            canDeleteItem: canDeleteItem(),
            codigo: PERMISSION_CODES.ALMOXARIFADO.EXCLUIR_ITEM_WEB
          }
        },
        allUserPermissions: userPermissions?.map(p => ({
          funcionalidade_codigo: p.funcionalidade?.codigo,
          tipo_permissao: p.tipo_permissao,
          concedido: p.concedido,
          ativo: p.ativo
        })) || []
      }
      
      setDebugInfo(info)
      console.log('🔍 DEBUG ESTOQUE:', info)
    }
  }, [user, loading, hasPermission, canCreateNewItem, canDeleteItem, userPermissions])

  if (loading) return <div>Carregando...</div>
  if (!user) return <div>Usuário não logado</div>

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Debug Estoque</h1>
      
      <div className="space-y-4">
        <div className="bg-gray-100 p-4 rounded">
          <h2 className="font-bold">Usuário:</h2>
          <p>Nome: {user.nome}</p>
          <p>Email: {user.email}</p>
          <p>Nível: {user.nivel_acesso}</p>
        </div>

        <div className="bg-blue-50 p-4 rounded">
          <h2 className="font-bold">Permissões:</h2>
          <p>Criar Item: {canCreateNewItem() ? '✅ SIM' : '❌ NÃO'}</p>
          <p>Excluir Item: {canDeleteItem() ? '✅ SIM' : '❌ NÃO'}</p>
        </div>

        <div className="bg-yellow-50 p-4 rounded">
          <h2 className="font-bold">hasPermission():</h2>
          <p>Criar Item: {hasPermission(PERMISSION_CODES.ALMOXARIFADO.CRIAR_NOVO_ITEM_WEB) ? '✅ SIM' : '❌ NÃO'}</p>
          <p>Excluir Item: {hasPermission(PERMISSION_CODES.ALMOXARIFADO.EXCLUIR_ITEM_WEB) ? '✅ SIM' : '❌ NÃO'}</p>
        </div>

        <div className="bg-green-50 p-4 rounded">
          <h2 className="font-bold">Todas as Permissões:</h2>
          <pre className="text-xs overflow-auto max-h-40">
            {JSON.stringify(debugInfo?.allUserPermissions, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  )
}
