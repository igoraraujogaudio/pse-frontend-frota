'use client'

import { useWebAlmoxarifadoPermissions } from '@/hooks/useWebAlmoxarifadoPermissions'
import { useModularPermissions } from '@/hooks/useModularPermissions'
import { useAuth } from '@/contexts/AuthContext'
import { PERMISSION_CODES } from '@/hooks/useModularPermissions'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export function PermissionDebugger() {
  const { user } = useAuth()
  const { 
    canCreateNewItem,
    canEditItemQuantity,
    canEditItemData,
    canDeleteItem
  } = useWebAlmoxarifadoPermissions()
  
  const { 
    userPermissions, 
    loading,
    hasPermission 
  } = useModularPermissions()

  if (loading) {
    return <div>Carregando permissões...</div>
  }

  const almoxarifadoPermissions = userPermissions.filter(p => 
    p.funcionalidade?.codigo?.includes('almoxarifado')
  )

  const createItemPermission = userPermissions.find(p => 
    p.funcionalidade?.codigo === PERMISSION_CODES.ALMOXARIFADO.CRIAR_NOVO_ITEM_WEB
  )

  return (
    <div className="space-y-4 p-4">
      <Card>
        <CardHeader>
          <CardTitle>Debug de Permissões - Almoxarifado</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="font-semibold">Usuário Atual:</h3>
            <p>ID: {user?.id}</p>
            <p>Nome: {user?.nome}</p>
            <p>Nível de Acesso: {user?.nivel_acesso}</p>
          </div>

          <div>
            <h3 className="font-semibold">Permissões Web Almoxarifado:</h3>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant={canCreateNewItem() ? "default" : "secondary"}>
                  {canCreateNewItem() ? "SIM" : "NÃO"}
                </Badge>
                <span>Criar Novo Item Web</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={canEditItemQuantity() ? "default" : "secondary"}>
                  {canEditItemQuantity() ? "SIM" : "NÃO"}
                </Badge>
                <span>Editar Quantidade Item Web</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={canEditItemData() ? "default" : "secondary"}>
                  {canEditItemData() ? "SIM" : "NÃO"}
                </Badge>
                <span>Editar Dados Item Web</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={canDeleteItem() ? "default" : "secondary"}>
                  {canDeleteItem() ? "SIM" : "NÃO"}
                </Badge>
                <span>Excluir Item Web</span>
              </div>
            </div>
          </div>

          <div>
            <h3 className="font-semibold">Permissão Específica - Criar Novo Item Web:</h3>
            {createItemPermission ? (
              <div className="bg-gray-100 p-3 rounded">
                <p><strong>ID:</strong> {createItemPermission.id}</p>
                <p><strong>Concedido:</strong> {createItemPermission.concedido ? "SIM" : "NÃO"}</p>
                <p><strong>Tipo:</strong> {createItemPermission.tipo_permissao}</p>
                <p><strong>Ativo:</strong> {createItemPermission.ativo ? "SIM" : "NÃO"}</p>
                <p><strong>Motivo:</strong> {createItemPermission.motivo || "N/A"}</p>
                <p><strong>Data Início:</strong> {createItemPermission.data_inicio}</p>
                <p><strong>Data Fim:</strong> {createItemPermission.data_fim || "N/A"}</p>
                <p><strong>Código Funcionalidade:</strong> {createItemPermission.funcionalidade?.codigo}</p>
              </div>
            ) : (
              <p className="text-red-500">❌ Permissão não encontrada</p>
            )}
          </div>

          <div>
            <h3 className="font-semibold">Análise da Lógica de Permissões:</h3>
            <div className="bg-blue-50 p-3 rounded">
              <p><strong>Nível de Acesso:</strong> {user?.nivel_acesso}</p>
              <p><strong>É Admin/Diretor:</strong> {['admin', 'diretor'].includes(user?.nivel_acesso || '') ? "SIM" : "NÃO"}</p>
              <p><strong>Permissão Personalizada:</strong> {createItemPermission && createItemPermission.tipo_permissao !== 'adicional' && createItemPermission.tipo_permissao !== 'restricao' ? "SIM" : "NÃO"}</p>
              <p><strong>Permissão do Perfil:</strong> {createItemPermission && (createItemPermission.tipo_permissao === 'adicional' || createItemPermission.tipo_permissao === 'restricao') ? "SIM" : "NÃO"}</p>
              <p><strong>Resultado Final:</strong> {canCreateNewItem() ? "✅ TEM ACESSO" : "❌ SEM ACESSO"}</p>
            </div>
          </div>

          <div>
            <h3 className="font-semibold">Todas as Permissões de Almoxarifado:</h3>
            <div className="space-y-2">
              {almoxarifadoPermissions.map(permission => (
                <div key={permission.id} className="bg-gray-50 p-2 rounded">
                  <div className="flex items-center gap-2">
                    <Badge variant={permission.concedido ? "default" : "destructive"}>
                      {permission.concedido ? "SIM" : "NÃO"}
                    </Badge>
                    <span className="font-mono text-sm">{permission.funcionalidade?.codigo}</span>
                  </div>
                  <p className="text-xs text-gray-600">
                    Tipo: {permission.tipo_permissao} | Ativo: {permission.ativo ? "SIM" : "NÃO"}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="font-semibold">Verificação Direta:</h3>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant={hasPermission(PERMISSION_CODES.ALMOXARIFADO.CRIAR_NOVO_ITEM_WEB) ? "default" : "secondary"}>
                  {hasPermission(PERMISSION_CODES.ALMOXARIFADO.CRIAR_NOVO_ITEM_WEB) ? "SIM" : "NÃO"}
                </Badge>
                <span>hasPermission(&apos;almoxarifado.web.criar_novo_item&apos;)</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
