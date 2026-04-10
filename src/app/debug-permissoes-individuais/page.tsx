'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useModularPermissions } from '@/hooks/useModularPermissions'
import type { UsuarioPermissaoModular } from '@/types/permissions'

export default function DebugPermissoesIndividuaisPage() {
  const { user } = useAuth()
  const { userPermissions, loading } = useModularPermissions()
  const [permissoesIndividuais, setPermissoesIndividuais] = useState<UsuarioPermissaoModular[]>([])

  useEffect(() => {
    if (user && userPermissions) {
      // Filtrar apenas permissões individuais
      const individuais = userPermissions.filter(p => 
        p.tipo_permissao === 'adicional' || p.tipo_permissao === 'restricao'
      )
      
      setPermissoesIndividuais(individuais)
      
      console.log('🔍 DEBUG - Usuário:', user)
      console.log('🔍 DEBUG - Permissões individuais:', individuais)
    }
  }, [user, userPermissions])

  if (loading) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-4">Debug Permissões Individuais</h1>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-4">Debug Permissões Individuais</h1>
        <p>Usuário não logado</p>
      </div>
    )
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Debug Permissões Individuais - {user.nome}</h1>
      
      {/* Informações do usuário */}
      <div className="bg-gray-100 p-4 rounded-lg mb-6">
        <h2 className="text-lg font-semibold mb-2">Informações do Usuário</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <strong>ID:</strong> {user.id}
          </div>
          <div>
            <strong>Nome:</strong> {user.nome}
          </div>
          <div>
            <strong>Matrícula:</strong> {user.matricula}
          </div>
          <div>
            <strong>Nível de Acesso:</strong> {user.nivel_acesso}
          </div>
          <div>
            <strong>Permissões Personalizadas:</strong> {user.permissoes_personalizadas ? 'SIM' : 'NÃO'}
          </div>
        </div>
      </div>

      {/* Resumo */}
      <div className="bg-blue-50 p-4 rounded-lg mb-6">
        <h2 className="text-lg font-semibold mb-2">Resumo</h2>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">{permissoesIndividuais.length}</div>
            <div className="text-sm text-gray-600">Permissões Individuais</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">
              {permissoesIndividuais.filter(p => p.concedido).length}
            </div>
            <div className="text-sm text-gray-600">Concedidas</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600">
              {permissoesIndividuais.filter(p => !p.concedido).length}
            </div>
            <div className="text-sm text-gray-600">Negadas</div>
          </div>
        </div>
      </div>

      {/* Permissões Individuais */}
      <div className="bg-blue-50 p-4 rounded-lg mb-6">
        <h2 className="text-lg font-semibold mb-2">
          Permissões Individuais ({permissoesIndividuais.length})
        </h2>
        {permissoesIndividuais.length === 0 ? (
          <p className="text-gray-600">Nenhuma permissão individual encontrada</p>
        ) : (
          <div className="space-y-2">
            {permissoesIndividuais.map((perm, index) => (
              <div key={index} className="bg-white p-3 rounded border">
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <strong>Código:</strong> {perm.funcionalidade?.codigo || 'N/A'}
                  </div>
                  <div>
                    <strong>Nome:</strong> {perm.funcionalidade?.nome || 'N/A'}
                  </div>
                  <div>
                    <strong>Tipo:</strong> {String(perm.tipo_permissao)}
                  </div>
                  <div>
                    <strong>Concedido:</strong> 
                    <span className={`ml-1 px-2 py-1 rounded text-xs ${
                      perm.concedido ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {perm.concedido ? 'SIM' : 'NÃO'}
                    </span>
                  </div>
                  <div>
                    <strong>Ativo:</strong> 
                    <span className={`ml-1 px-2 py-1 rounded text-xs ${
                      perm.ativo ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {perm.ativo ? 'SIM' : 'NÃO'}
                    </span>
                  </div>
                  <div>
                    <strong>Usuário ID:</strong> {String(perm.usuario_id)}
                  </div>
                  <div>
                    <strong>ID da Permissão:</strong> {String(perm.id)}
                  </div>
                  <div>
                    <strong>Criado em:</strong> {new Date(perm.criado_em).toLocaleString()}
                  </div>
                  <div>
                    <strong>Data Fim:</strong> {perm.data_fim ? new Date(perm.data_fim).toLocaleString() : 'N/A'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Permissões específicas do estoque */}
      <div className="bg-yellow-50 p-4 rounded-lg mb-6">
        <h2 className="text-lg font-semibold mb-2">Permissões Individuais do Estoque</h2>
        <div className="space-y-2">
          {[
            'almoxarifado.web.criar_novo_item',
            'almoxarifado.web.editar_quantidade_item',
            'almoxarifado.web.editar_dados_item',
            'almoxarifado.web.excluir_item'
          ].map(codigo => {
            const perm = permissoesIndividuais.find(p => p.funcionalidade?.codigo === codigo)
            return (
              <div key={codigo} className="bg-white p-3 rounded border">
                <div className="flex items-center justify-between">
                  <div>
                    <strong>{codigo}</strong>
                    <div className="text-sm text-gray-600">
                      {perm ? (
                        <>
                          Tipo: {perm.tipo_permissao} | 
                          Concedido: {perm.concedido ? 'SIM' : 'NÃO'} | 
                          Ativo: {perm.ativo ? 'SIM' : 'NÃO'} |
                          ID: {perm.id}
                        </>
                      ) : (
                        'NÃO ENCONTRADA'
                      )}
                    </div>
                  </div>
                  <div className={`px-3 py-1 rounded text-sm ${
                    perm && perm.concedido && perm.ativo 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {perm && perm.concedido && perm.ativo ? 'PERMITIDO' : 'NEGADO'}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Debug completo */}
      <div className="bg-gray-50 p-4 rounded-lg">
        <h2 className="text-lg font-semibold mb-2">Debug Completo - Permissões Individuais</h2>
        <pre className="bg-white p-3 rounded border text-xs overflow-auto max-h-96">
          {JSON.stringify(permissoesIndividuais, null, 2)}
        </pre>
      </div>
    </div>
  )
}
