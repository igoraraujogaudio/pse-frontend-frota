'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
// import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog' // Unused
import { Checkbox } from '@/components/ui/checkbox'
import { Loader2, Users, Building2, Eye, Home, Search, UserCheck } from 'lucide-react' // Removed unused icons
import { contratoService } from '@/services/contratoService'
import { baseService } from '@/services/baseService'
import { userService } from '@/services/userService'
import type { User, Contrato } from '@/types'
import type { Base } from '@/types/contratos' // Removed unused types
import ProtectedRoute from '@/components/ProtectedRoute'

// interface UsuarioContratoCompleto {
//   contrato_id: string;
//   contrato_nome: string;
//   contrato_codigo: string;
//   tipo_acesso: 'origem' | 'visualizacao';
//   perfil_contrato: string;
//   is_origem: boolean;
// } // TODO: Use for complete user-contract data

export default function ManageAllContratosPage() {
  const [loading, setLoading] = useState(true)
  const [usuarios, setUsuarios] = useState<User[]>([])
  const [contratos, setContratos] = useState<Contrato[]>([])
  const [bases, setBases] = useState<Base[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set())
  const [allSelected, setAllSelected] = useState(false)
  const [activeTab, setActiveTab] = useState('contratos-origem')
  
  // Estados para contratos de origem
  const [selectedContratoOrigem, setSelectedContratoOrigem] = useState('')
  // const [showOrigemDialog, setShowOrigemDialog] = useState(false) // TODO: Implement origin dialog
  
  // Estados para contratos de visualização
  const [selectedContratoVisualizacao, setSelectedContratoVisualizacao] = useState('')
  const [selectedPerfilVisualizacao, setSelectedPerfilVisualizacao] = useState('operador')
  // const [showVisualizacaoDialog, setShowVisualizacaoDialog] = useState(false) // TODO: Implement visualization dialog
  
  // Estados para bases
  const [selectedBase, setSelectedBase] = useState('')
  const [selectedTipoAcessoBase, setSelectedTipoAcessoBase] = useState('total')
  // const [showBaseDialog, setShowBaseDialog] = useState(false) // TODO: Implement base dialog
  
  const [updating, setUpdating] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      const [usuariosData, contratosData, basesData] = await Promise.all([
        userService.getAll(),
        contratoService.getContratosAtivos(),
        baseService.getBasesAtivas()
      ])

      setUsuarios(usuariosData)
      setContratos(contratosData)
      setBases(basesData)
    } catch (error) {
      console.error('Erro ao carregar dados:', error)
      setMessage({ type: 'error', text: 'Erro ao carregar dados' })
    } finally {
      setLoading(false)
    }
  }

  const filteredUsuarios = usuarios.filter(usuario =>
    usuario.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    usuario.matricula?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    usuario.email.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleSelectUser = (userId: string, checked: boolean) => {
    const newSelected = new Set(selectedUsers)
    if (checked) {
      newSelected.add(userId)
    } else {
      newSelected.delete(userId)
    }
    setSelectedUsers(newSelected)
    setAllSelected(newSelected.size === filteredUsuarios.length)
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedUsers(new Set(filteredUsuarios.map(u => u.id)))
      setAllSelected(true)
    } else {
      setSelectedUsers(new Set())
      setAllSelected(false)
    }
  }

  const handleBulkSetContratoOrigem = async () => {
    if (!selectedContratoOrigem || selectedUsers.size === 0) return

    try {
      setUpdating(true)
      
      // Aplicar para todos os usuários selecionados
      await Promise.all(
        Array.from(selectedUsers).map(userId =>
          contratoService.setUsuarioContratoOrigem(userId, selectedContratoOrigem)
        )
      )

      // setShowOrigemDialog(false) // TODO: Implement origin dialog
      setSelectedContratoOrigem('')
      setSelectedUsers(new Set())
      setAllSelected(false)
      setMessage({ 
        type: 'success', 
        text: `Contrato de origem definido para ${selectedUsers.size} usuários!` 
      })
    } catch (error) {
      console.error('Erro ao definir contrato de origem em massa:', error)
      setMessage({ type: 'error', text: 'Erro ao definir contrato de origem em massa' })
    } finally {
      setUpdating(false)
    }
  }

  const handleBulkAddVisualizacaoContrato = async () => {
    if (!selectedContratoVisualizacao || selectedUsers.size === 0) return

    try {
      setUpdating(true)
      
      await Promise.all(
        Array.from(selectedUsers).map(userId =>
          contratoService.addUsuarioContratoVisualizacao(
            userId, 
            selectedContratoVisualizacao, 
            selectedPerfilVisualizacao
          )
        )
      )

      // setShowVisualizacaoDialog(false) // TODO: Implement visualization dialog
      setSelectedContratoVisualizacao('')
      setSelectedPerfilVisualizacao('operador')
      setSelectedUsers(new Set())
      setAllSelected(false)
      setMessage({ 
        type: 'success', 
        text: `Contrato de visualização adicionado para ${selectedUsers.size} usuários!` 
      })
    } catch (error) {
      console.error('Erro ao adicionar contrato de visualização em massa:', error)
      setMessage({ type: 'error', text: 'Erro ao adicionar contrato de visualização em massa' })
    } finally {
      setUpdating(false)
    }
  }

  const handleBulkAssignBase = async () => {
    if (!selectedBase || selectedUsers.size === 0) return

    try {
      setUpdating(true)
      
      await Promise.all(
        Array.from(selectedUsers).map(userId =>
          baseService.assignUserToBase(userId, selectedBase, selectedTipoAcessoBase as 'total' | 'restrito' | 'leitura')
        )
      )

      // setShowBaseDialog(false) // TODO: Implement base dialog
      setSelectedBase('')
      setSelectedTipoAcessoBase('total')
      setSelectedUsers(new Set())
      setAllSelected(false)
      setMessage({ 
        type: 'success', 
        text: `Base atribuída para ${selectedUsers.size} usuários!` 
      })
    } catch (error) {
      console.error('Erro ao atribuir base em massa:', error)
      setMessage({ type: 'error', text: 'Erro ao atribuir base em massa' })
    } finally {
      setUpdating(false)
    }
  }

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
          <h1 className="text-3xl font-bold">Gestão Completa de Contratos e Bases</h1>
          <p className="text-muted-foreground">
            Configure contratos de origem, visualização e bases para usuários em massa
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Lista de Usuários */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Usuários ({filteredUsuarios.length})
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={handleSelectAll}
                />
                <span className="text-sm text-muted-foreground">
                  Selecionar todos
                </span>
              </div>
            </CardTitle>
            <CardDescription>
              Selecione usuários para aplicar configurações em massa
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

            {selectedUsers.size > 0 && (
              <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-blue-900">
                    {selectedUsers.size} usuários selecionados
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setSelectedUsers(new Set())
                      setAllSelected(false)
                    }}
                  >
                    Limpar seleção
                  </Button>
                </div>
              </div>
            )}

            <div className="space-y-2 max-h-96 overflow-y-auto">
              {filteredUsuarios.map(usuario => (
                <div
                  key={usuario.id}
                  className={`p-3 rounded-lg border transition-colors ${
                    selectedUsers.has(usuario.id) ? 'bg-blue-50 border-blue-200' : 'hover:bg-accent'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <Checkbox
                      checked={selectedUsers.has(usuario.id)}
                      onCheckedChange={(checked) => handleSelectUser(usuario.id, checked as boolean)}
                    />
                    <div className="flex-1">
                      <div className="font-medium">{usuario.nome}</div>
                      <div className="text-sm text-muted-foreground">
                        {usuario.matricula} • {usuario.email}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {usuario.departamento} - {usuario.cargo}
                      </div>
                      {usuario.contrato_origem && (
                        <Badge variant="outline" className="mt-1">
                          🏠 {usuario.contrato_origem.nome}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Ações em Massa */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserCheck className="h-5 w-5" />
              Ações em Massa
            </CardTitle>
            <CardDescription>
              Configure contratos e bases para usuários selecionados
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="contratos-origem" className="text-xs">
                  🏠 Origem
                </TabsTrigger>
                <TabsTrigger value="contratos-visualizacao" className="text-xs">
                  👁️ Visual.
                </TabsTrigger>
                <TabsTrigger value="bases" className="text-xs">
                  📍 Bases
                </TabsTrigger>
              </TabsList>

              {/* Contrato de Origem */}
              <TabsContent value="contratos-origem" className="space-y-4">
                <div>
                  <Label>Contrato de Origem</Label>
                  <Select value={selectedContratoOrigem} onValueChange={setSelectedContratoOrigem}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um contrato" />
                    </SelectTrigger>
                    <SelectContent>
                      {contratos.map(contrato => (
                        <SelectItem key={contrato.id} value={contrato.id}>
                          {contrato.nome} ({contrato.codigo})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  onClick={handleBulkSetContratoOrigem}
                  disabled={!selectedContratoOrigem || selectedUsers.size === 0 || updating}
                  className="w-full"
                >
                  {updating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <Home className="mr-2 h-4 w-4" />
                  Definir Origem ({selectedUsers.size})
                </Button>
              </TabsContent>

              {/* Contrato de Visualização */}
              <TabsContent value="contratos-visualizacao" className="space-y-4">
                <div>
                  <Label>Contrato de Visualização</Label>
                  <Select value={selectedContratoVisualizacao} onValueChange={setSelectedContratoVisualizacao}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um contrato" />
                    </SelectTrigger>
                    <SelectContent>
                      {contratos.map(contrato => (
                        <SelectItem key={contrato.id} value={contrato.id}>
                          {contrato.nome} ({contrato.codigo})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Perfil</Label>
                  <Select value={selectedPerfilVisualizacao} onValueChange={setSelectedPerfilVisualizacao}>
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
                <Button
                  onClick={handleBulkAddVisualizacaoContrato}
                  disabled={!selectedContratoVisualizacao || selectedUsers.size === 0 || updating}
                  className="w-full"
                >
                  {updating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <Eye className="mr-2 h-4 w-4" />
                  Adicionar Visualização ({selectedUsers.size})
                </Button>
              </TabsContent>

              {/* Bases */}
              <TabsContent value="bases" className="space-y-4">
                <div>
                  <Label>Base</Label>
                  <Select value={selectedBase} onValueChange={setSelectedBase}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione uma base" />
                    </SelectTrigger>
                    <SelectContent>
                      {bases.map(base => (
                        <SelectItem key={base.id} value={base.id}>
                          {base.nome} ({base.codigo})
                          {base.contrato && ` - ${base.contrato.nome}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Tipo de Acesso</Label>
                  <Select value={selectedTipoAcessoBase} onValueChange={setSelectedTipoAcessoBase}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="total">Total</SelectItem>
                      <SelectItem value="restrito">Restrito</SelectItem>
                      <SelectItem value="leitura">Leitura</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  onClick={handleBulkAssignBase}
                  disabled={!selectedBase || selectedUsers.size === 0 || updating}
                  className="w-full"
                >
                  {updating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <Building2 className="mr-2 h-4 w-4" />
                  Atribuir Base ({selectedUsers.size})
                </Button>
              </TabsContent>
            </Tabs>

            {selectedUsers.size === 0 && (
              <div className="text-center py-8 text-muted-foreground text-sm">
                Selecione usuários para habilitar as ações em massa
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Estatísticas */}
      <Card>
        <CardHeader>
          <CardTitle>Estatísticas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{usuarios.length}</div>
              <div className="text-sm text-muted-foreground">Total de Usuários</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{contratos.length}</div>
              <div className="text-sm text-muted-foreground">Contratos Ativos</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">{bases.length}</div>
              <div className="text-sm text-muted-foreground">Bases Ativas</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">{selectedUsers.size}</div>
              <div className="text-sm text-muted-foreground">Usuários Selecionados</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
    </ProtectedRoute>
  )
}
