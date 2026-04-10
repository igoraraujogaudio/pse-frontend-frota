'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
// import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs' // TODO: Implement tabs
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Loader2, Users, Building2, Eye, Home, Plus, Trash2, Search } from 'lucide-react'
import { contratoService } from '@/services/contratoService'
import { userService } from '@/services/userService'
import type { User, Contrato } from '@/types'
import ProtectedRoute from '@/components/ProtectedRoute'

interface UsuarioContratoCompleto {
  contrato_id: string;
  contrato_nome: string;
  contrato_codigo: string;
  tipo_acesso: 'origem' | 'visualizacao';
  perfil_contrato: string;
  is_origem: boolean;
}

export default function ManageContratosOrigemPage() {
  const [loading, setLoading] = useState(true)
  const [usuarios, setUsuarios] = useState<User[]>([])
  const [contratos, setContratos] = useState<Contrato[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [userContratos, setUserContratos] = useState<UsuarioContratoCompleto[]>([])
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [selectedContrato, setSelectedContrato] = useState('')
  const [selectedPerfil, setSelectedPerfil] = useState('operador')
  const [updating, setUpdating] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      const [usuariosData, contratosData] = await Promise.all([
        userService.getAll(),
        contratoService.getContratosAtivos()
      ])

      setUsuarios(usuariosData)
      setContratos(contratosData)
    } catch (error) {
      console.error('Erro ao carregar dados:', error)
      setMessage({ type: 'error', text: 'Erro ao carregar dados' })
    } finally {
      setLoading(false)
    }
  }

  const loadUserContratos = async (user: User) => {
    try {
      const contratos = await contratoService.getUsuarioContratosCompleto(user.id)
      setUserContratos(contratos)
    } catch (error) {
      console.error('Erro ao carregar contratos do usuário:', error)
      setMessage({ type: 'error', text: 'Erro ao carregar contratos do usuário' })
    }
  }

  const handleSelectUser = async (user: User) => {
    setSelectedUser(user)
    await loadUserContratos(user)
  }

  const handleSetOrigemContrato = async (contratoId: string) => {
    if (!selectedUser) return

    try {
      setUpdating(true)
      await contratoService.setUsuarioContratoOrigem(selectedUser.id, contratoId)
      await loadUserContratos(selectedUser)
      setMessage({ type: 'success', text: 'Contrato de origem definido com sucesso!' })
    } catch (error) {
      console.error('Erro ao definir contrato de origem:', error)
      setMessage({ type: 'error', text: 'Erro ao definir contrato de origem' })
    } finally {
      setUpdating(false)
    }
  }

  const handleAddVisualizacaoContrato = async () => {
    if (!selectedUser || !selectedContrato) return

    try {
      setUpdating(true)
      await contratoService.addUsuarioContratoVisualizacao(
        selectedUser.id, 
        selectedContrato, 
        selectedPerfil
      )
      await loadUserContratos(selectedUser)
      setShowAddDialog(false)
      setSelectedContrato('')
      setSelectedPerfil('operador')
      setMessage({ type: 'success', text: 'Contrato de visualização adicionado com sucesso!' })
    } catch (error) {
      console.error('Erro ao adicionar contrato de visualização:', error)
      setMessage({ type: 'error', text: 'Erro ao adicionar contrato de visualização' })
    } finally {
      setUpdating(false)
    }
  }

  const handleRemoveContrato = async (contratoId: string) => {
    if (!selectedUser) return

    if (!confirm('Tem certeza que deseja remover este contrato?')) return

    try {
      setUpdating(true)
      await contratoService.removeUsuarioContrato(selectedUser.id, contratoId)
      await loadUserContratos(selectedUser)
      setMessage({ type: 'success', text: 'Contrato removido com sucesso!' })
    } catch (error) {
      console.error('Erro ao remover contrato:', error)
      setMessage({ type: 'error', text: 'Erro ao remover contrato' })
    } finally {
      setUpdating(false)
    }
  }

  const filteredUsuarios = usuarios.filter(usuario =>
    usuario.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    usuario.matricula?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    usuario.email.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const availableContratos = contratos.filter(contrato => 
    !userContratos.some(uc => uc.contrato_id === contrato.id)
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <ProtectedRoute requiredAccessLevel={["admin"]}>
      <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Building2 className="h-8 w-8" />
        <div>
          <h1 className="text-3xl font-bold">Gestão de Contratos de Origem</h1>
          <p className="text-muted-foreground">
            Configure contratos de origem e visualização para usuários
          </p>
        </div>
      </div>

      {message && (
        <div className={`p-4 rounded-md ${
          message.type === 'success' ? 'bg-green-50 text-green-700' : 
          message.type === 'error' ? 'bg-red-50 text-red-700' : 
          'bg-blue-50 text-blue-700'
        }`}>
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Lista de Usuários */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Usuários
            </CardTitle>
            <CardDescription>
              Selecione um usuário para gerenciar seus contratos
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar usuário..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            <div className="space-y-2 max-h-96 overflow-y-auto">
              {filteredUsuarios.map(usuario => (
                <div
                  key={usuario.id}
                  className={`p-3 rounded-lg border cursor-pointer hover:bg-accent transition-colors ${
                    selectedUser?.id === usuario.id ? 'bg-accent border-primary' : ''
                  }`}
                  onClick={() => handleSelectUser(usuario)}
                >
                  <div className="font-medium">{usuario.nome}</div>
                  <div className="text-sm text-muted-foreground">
                    {usuario.matricula} • {usuario.email}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {usuario.departamento} - {usuario.cargo}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Contratos do Usuário */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Contratos do Usuário
              {selectedUser && (
                <Badge variant="secondary">{selectedUser.nome}</Badge>
              )}
            </CardTitle>
            <CardDescription>
              Gerencie contratos de origem e visualização
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!selectedUser ? (
              <div className="text-center py-8 text-muted-foreground">
                Selecione um usuário para ver seus contratos
              </div>
            ) : (
              <>
                <div className="flex justify-between items-center">
                  <div className="text-sm text-muted-foreground">
                    {userContratos.length} contratos configurados
                  </div>
                  <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
                    <DialogTrigger asChild>
                      <Button size="sm">
                        <Plus className="h-4 w-4 mr-2" />
                        Adicionar
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Adicionar Contrato de Visualização</DialogTitle>
                        <DialogDescription>
                          Adicione um contrato que o usuário pode visualizar
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <Label>Contrato</Label>
                          <Select value={selectedContrato} onValueChange={setSelectedContrato}>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione um contrato" />
                            </SelectTrigger>
                            <SelectContent>
                              {availableContratos.map(contrato => (
                                <SelectItem key={contrato.id} value={contrato.id}>
                                  {contrato.nome} ({contrato.codigo})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>Perfil</Label>
                          <Select value={selectedPerfil} onValueChange={setSelectedPerfil}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="operador">Operador</SelectItem>
                              <SelectItem value="supervisor">Supervisor</SelectItem>
                              <SelectItem value="gestor">Gestor</SelectItem>
                              <SelectItem value="administrador">Administrador</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <DialogFooter>
                        <Button
                          onClick={handleAddVisualizacaoContrato}
                          disabled={!selectedContrato || updating}
                        >
                          {updating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          Adicionar
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>

                <div className="space-y-3">
                  {userContratos.map(contrato => (
                    <div
                      key={contrato.contrato_id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        {contrato.is_origem ? (
                          <Home className="h-4 w-4 text-blue-600" />
                        ) : (
                          <Eye className="h-4 w-4 text-green-600" />
                        )}
                        <div>
                          <div className="font-medium">{contrato.contrato_nome}</div>
                          <div className="text-sm text-muted-foreground">
                            {contrato.contrato_codigo} • {contrato.perfil_contrato}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={contrato.is_origem ? "default" : "secondary"}>
                          {contrato.is_origem ? "Origem" : "Visualização"}
                        </Badge>
                        {!contrato.is_origem ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleSetOrigemContrato(contrato.contrato_id)}
                            disabled={updating}
                          >
                            Definir como Origem
                          </Button>
                        ) : null}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleRemoveContrato(contrato.contrato_id)}
                          disabled={updating}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                {userContratos.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    Nenhum contrato configurado para este usuário
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
    </ProtectedRoute>
  )
}
