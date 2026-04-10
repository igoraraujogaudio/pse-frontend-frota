'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useModularPermissions } from '@/hooks/useModularPermissions'
import type { UsuarioPermissaoModular } from '@/types/permissions'

export default function TestePermissoesPage() {
  const { user } = useAuth()
  const { userPermissions, loading } = useModularPermissions()
  const [permissoesIndividuais, setPermissoesIndividuais] = useState<UsuarioPermissaoModular[]>([])
  const [permissoesPerfil, setPermissoesPerfil] = useState<UsuarioPermissaoModular[]>([])

  useEffect(() => {
    if (user && userPermissions) {
      // Separar permissões individuais e de perfil
      const individuais = userPermissions.filter(p => 
        p.tipo_permissao === 'adicional' || p.tipo_permissao === 'restricao'
      )
      const perfil = userPermissions.filter(p => 
        p.tipo_permissao !== 'adicional' && p.tipo_permissao !== 'restricao'
      )
      
      setPermissoesIndividuais(individuais)
      setPermissoesPerfil(perfil)
      
      console.log('🔍 DEBUG - Usuário:', user)
      console.log('🔍 DEBUG - Permissões individuais:', individuais)
      console.log('🔍 DEBUG - Permissões do perfil:', perfil)
    }
  }, [user, userPermissions])

  if (loading) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-4">Teste de Permissões</h1>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-4">Teste de Permissões</h1>
        <p>Usuário não logado</p>
      </div>
    )
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Teste de Permissões - {user.nome}</h1>
      
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
            <strong>Email:</strong> {user.email}
          </div>
          <div>
            <strong>Matrícula:</strong> {user.matricula}
          </div>
          <div>
            <strong>Nível de Acesso:</strong> {user.nivel_acesso}
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
                <div className="grid grid-cols-2 gap-2">
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
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Permissões do Perfil */}
      <div className="bg-green-50 p-4 rounded-lg mb-6">
        <h2 className="text-lg font-semibold mb-2">
          Permissões do Perfil ({permissoesPerfil.length})
        </h2>
        {permissoesPerfil.length === 0 ? (
          <p className="text-gray-600">Nenhuma permissão do perfil encontrada</p>
        ) : (
          <div className="space-y-2">
            {permissoesPerfil.map((perm, index) => (
              <div key={index} className="bg-white p-3 rounded border">
                <div className="grid grid-cols-2 gap-2">
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
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Permissões específicas do estoque */}
      <div className="bg-yellow-50 p-4 rounded-lg mb-6">
        <h2 className="text-lg font-semibold mb-2">Permissões Específicas do Estoque</h2>
        <div className="space-y-2">
          {[
            'almoxarifado.web.criar_novo_item',
            'almoxarifado.web.editar_quantidade_item',
            'almoxarifado.web.editar_dados_item',
            'almoxarifado.web.excluir_item'
          ].map(codigo => {
            const perm = userPermissions.find(p => p.funcionalidade?.codigo === codigo)
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
                          Ativo: {perm.ativo ? 'SIM' : 'NÃO'}
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
        <h2 className="text-lg font-semibold mb-2">Debug Completo</h2>
        <pre className="bg-white p-3 rounded border text-xs overflow-auto max-h-96">
          {JSON.stringify({
            usuario: user,
            totalPermissoes: userPermissions.length,
            permissoesIndividuais: permissoesIndividuais.length,
            permissoesPerfil: permissoesPerfil.length,
            todasPermissoes: userPermissions
          }, null, 2)}
        </pre>
      </div>
    </div>
  )
}
