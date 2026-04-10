'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useNotification } from '@/contexts/NotificationContext'
import { useModularPermissions, PERMISSION_CODES } from '@/hooks/useModularPermissions'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  Car, 
  Eye, 
  X, 
  User,
  FileText,
  AlertCircle,
  CheckCircle,
  Clock,
  Search,
  Filter,
  Unlock
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'

interface ChecklistVeicular {
  id: string
  veiculo: {
    id: string
    placa: string
    prefixo: string | null
    modelo: string
    marca: string
    contrato: {
      id: string
      nome: string
      codigo: string
    } | null
  } | null
  equipe: {
    id: string
    nome: string
    contrato: {
      id: string
      nome: string
      codigo: string
    } | null
  } | {
    nome: string
  }
  motorista: {
    nome: string
    cnh: string
    validade_cnh: string
    categoria: string
    condicoes_adequadas: boolean
    justificativa_condicoes: string | null
  }
  data_checklist: string
  validade_crlv: string | null
  quilometragem: {
    atual: number | null
    saida: number | null
    chegada: number | null
  }
  status: string
  itens: unknown[]
  laudos_status: unknown[]
  requer_liberacao_supervisor: boolean
  liberacao: {
    supervisor_id: string
    supervisor_nome: string
    justificativa: string
    data: string
  } | null
  criado_em: string
}

export default function ChecklistsVeicularesPage() {
  const { user } = useAuth()
  const { notify } = useNotification()
  const { hasPermission } = useModularPermissions()
  const [checklists, setChecklists] = useState<ChecklistVeicular[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [selectedChecklist, setSelectedChecklist] = useState<ChecklistVeicular | null>(null)
  const [showDetails, setShowDetails] = useState(false)
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [showLiberarModal, setShowLiberarModal] = useState(false)
  const [rejectMotivo, setRejectMotivo] = useState('')
  const [liberarJustificativa, setLiberarJustificativa] = useState('')

  // Verificar permissões
  const canView = hasPermission(PERMISSION_CODES.CHECKLIST.VEICULO_VISUALIZAR)
  const canReject = hasPermission(PERMISSION_CODES.CHECKLIST.VEICULO_REJEITAR)
  const canLiberate = hasPermission(PERMISSION_CODES.CHECKLIST.VEICULO_LIBERAR)

  useEffect(() => {
    if (user && canView) {
      loadChecklists()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, canView])

  const loadChecklists = async () => {
    try {
      setLoading(true)
      const { data: { session } } = await (await import('@/lib/supabase')).supabase.auth.getSession()
      
      if (!session?.access_token) {
        notify('Sessão expirada. Faça login novamente.', 'error')
        return
      }

      const response = await fetch('/api/checklist/veiculares', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      })

      if (!response.ok) {
        throw new Error('Erro ao carregar checklists')
      }

      const data = await response.json()
      setChecklists(data.checklists || [])
    } catch (error) {
      console.error('Erro ao carregar checklists:', error)
      notify('Erro ao carregar checklists veiculares', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleRejeitar = async () => {
    if (!selectedChecklist || !rejectMotivo.trim()) {
      notify('Informe o motivo da rejeição', 'error')
      return
    }

    try {
      const { data: { session } } = await (await import('@/lib/supabase')).supabase.auth.getSession()
      
      if (!session?.access_token) {
        notify('Sessão expirada. Faça login novamente.', 'error')
        return
      }

      const response = await fetch(`/api/checklist/veiculares/${selectedChecklist.id}/rejeitar`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          motivo: rejectMotivo
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Erro ao rejeitar checklist')
      }

      notify('Checklist rejeitado com sucesso', 'success')
      setShowRejectModal(false)
      setRejectMotivo('')
      setSelectedChecklist(null)
      loadChecklists()
    } catch (error) {
      console.error('Erro ao rejeitar checklist:', error)
      const errorMessage = error instanceof Error ? error.message : 'Erro ao rejeitar checklist';
      notify(errorMessage, 'error')
    }
  }

  const handleLiberar = async () => {
    if (!selectedChecklist || !liberarJustificativa.trim()) {
      notify('Informe a justificativa da liberação', 'error')
      return
    }

    try {
      const { data: { session } } = await (await import('@/lib/supabase')).supabase.auth.getSession()
      
      if (!session?.access_token) {
        notify('Sessão expirada. Faça login novamente.', 'error')
        return
      }

      const response = await fetch(`/api/checklist/veiculares/${selectedChecklist.id}/liberar`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          justificativa: liberarJustificativa
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Erro ao liberar checklist')
      }

      notify('Checklist liberado com sucesso', 'success')
      setShowLiberarModal(false)
      setLiberarJustificativa('')
      setSelectedChecklist(null)
      loadChecklists()
    } catch (error) {
      console.error('Erro ao liberar checklist:', error)
      const errorMessage = error instanceof Error ? error.message : 'Erro ao liberar checklist';
      notify(errorMessage, 'error')
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'aprovado':
        return <Badge className="bg-green-100 text-green-800"><CheckCircle className="h-3 w-3 mr-1" />Aprovado</Badge>
      case 'rejeitado':
        return <Badge className="bg-red-100 text-red-800"><X className="h-3 w-3 mr-1" />Rejeitado</Badge>
      case 'pendente':
        return <Badge className="bg-yellow-100 text-yellow-800"><Clock className="h-3 w-3 mr-1" />Pendente</Badge>
      default:
        return <Badge className="bg-gray-100 text-gray-800">{status}</Badge>
    }
  }

  const filteredChecklists = checklists.filter(checklist => {
    const matchesSearch = 
      checklist.veiculo?.placa.toLowerCase().includes(searchTerm.toLowerCase()) ||
      checklist.veiculo?.prefixo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      checklist.motorista.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (typeof checklist.equipe === 'object' && 'nome' in checklist.equipe && checklist.equipe.nome.toLowerCase().includes(searchTerm.toLowerCase()))
    
    const matchesStatus = statusFilter === 'all' || checklist.status === statusFilter

    return matchesSearch && matchesStatus
  })

  if (!canView) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Acesso Negado</h2>
          <p className="text-gray-600">Você não tem permissão para visualizar checklists veiculares</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Checklists Veiculares</h1>
        <p className="text-gray-600">
          Visualize e gerencie checklists veiculares dos contratos que você tem acesso
        </p>
      </div>

      {/* Filtros */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Buscar por placa, prefixo, motorista ou equipe..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-gray-400" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
              >
                <option value="all">Todos os status</option>
                <option value="pendente">Pendente</option>
                <option value="aprovado">Aprovado</option>
                <option value="rejeitado">Rejeitado</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Checklists */}
      {filteredChecklists.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">Nenhum checklist encontrado</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredChecklists.map((checklist) => (
            <Card key={checklist.id} className="hover:shadow-md transition-shadow">
              <CardContent className="pt-6">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <Car className="h-5 w-5 text-blue-600" />
                      <div>
                        <h3 className="font-semibold text-lg">
                          {checklist.veiculo?.placa || 'N/A'}
                          {checklist.veiculo?.prefixo && (
                            <span className="text-gray-500 ml-2">({checklist.veiculo.prefixo})</span>
                          )}
                        </h3>
                        <p className="text-sm text-gray-600">
                          {checklist.veiculo?.marca} {checklist.veiculo?.modelo}
                        </p>
                      </div>
                      {getStatusBadge(checklist.status)}
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 text-sm">
                      <div>
                        <span className="text-gray-500">Motorista:</span>
                        <p className="font-medium">{checklist.motorista.nome}</p>
                      </div>
                      <div>
                        <span className="text-gray-500">Equipe:</span>
                        <p className="font-medium">
                          {typeof checklist.equipe === 'object' && 'nome' in checklist.equipe 
                            ? checklist.equipe.nome 
                            : 'N/A'}
                        </p>
                      </div>
                      <div>
                        <span className="text-gray-500">Data:</span>
                        <p className="font-medium">
                          {new Date(checklist.data_checklist).toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                      <div>
                        <span className="text-gray-500">Contrato:</span>
                        <p className="font-medium">
                          {checklist.veiculo?.contrato?.nome || 
                           (typeof checklist.equipe === 'object' && 'contrato' in checklist.equipe && checklist.equipe.contrato?.nome) ||
                           'N/A'}
                        </p>
                      </div>
                    </div>

                    {checklist.requer_liberacao_supervisor && (
                      <div className="mt-3 flex items-center gap-2 text-sm text-yellow-600">
                        <AlertCircle className="h-4 w-4" />
                        <span>Requer liberação de supervisor</span>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedChecklist(checklist)
                        setShowDetails(true)
                      }}
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      Ver Detalhes
                    </Button>
                    {checklist.status === 'pendente' && canReject && (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => {
                          setSelectedChecklist(checklist)
                          setShowRejectModal(true)
                        }}
                      >
                        <X className="h-4 w-4 mr-2" />
                        Rejeitar
                      </Button>
                    )}
                    {checklist.status === 'rejeitado' && canLiberate && (
                      <Button
                        variant="default"
                        size="sm"
                        className="bg-green-600 hover:bg-green-700"
                        onClick={() => {
                          setSelectedChecklist(checklist)
                          setShowLiberarModal(true)
                        }}
                      >
                        <Unlock className="h-4 w-4 mr-2" />
                        Liberar
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Modal de Detalhes */}
      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalhes do Checklist Veicular</DialogTitle>
            <DialogDescription>
              Informações completas do checklist
            </DialogDescription>
          </DialogHeader>
          
          {selectedChecklist && (
            <div className="space-y-6">
              {/* Veículo */}
              <div>
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <Car className="h-5 w-5" />
                  Informações do Veículo
                </h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Placa:</span>
                    <p className="font-medium">{selectedChecklist.veiculo?.placa || 'N/A'}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Prefixo:</span>
                    <p className="font-medium">{selectedChecklist.veiculo?.prefixo || 'N/A'}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Modelo:</span>
                    <p className="font-medium">{selectedChecklist.veiculo?.modelo || 'N/A'}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Marca:</span>
                    <p className="font-medium">{selectedChecklist.veiculo?.marca || 'N/A'}</p>
                  </div>
                </div>
              </div>

              {/* Motorista */}
              <div>
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Informações do Motorista
                </h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Nome:</span>
                    <p className="font-medium">{selectedChecklist.motorista.nome}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">CNH:</span>
                    <p className="font-medium">{selectedChecklist.motorista.cnh}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Categoria:</span>
                    <p className="font-medium">{selectedChecklist.motorista.categoria}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Validade CNH:</span>
                    <p className="font-medium">
                      {selectedChecklist.motorista.validade_cnh 
                        ? new Date(selectedChecklist.motorista.validade_cnh).toLocaleDateString('pt-BR')
                        : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-500">Condições Adequadas:</span>
                    <p className="font-medium">
                      {selectedChecklist.motorista.condicoes_adequadas ? 'Sim' : 'Não'}
                    </p>
                  </div>
                  {selectedChecklist.motorista.justificativa_condicoes && (
                    <div className="col-span-2">
                      <span className="text-gray-500">Justificativa:</span>
                      <p className="font-medium">{selectedChecklist.motorista.justificativa_condicoes}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Quilometragem */}
              <div>
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <Car className="h-5 w-5" />
                  Quilometragem
                </h3>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Atual:</span>
                    <p className="font-medium">{selectedChecklist.quilometragem.atual || 'N/A'}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Saída:</span>
                    <p className="font-medium">{selectedChecklist.quilometragem.saida || 'N/A'}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Chegada:</span>
                    <p className="font-medium">{selectedChecklist.quilometragem.chegada || 'N/A'}</p>
                  </div>
                </div>
              </div>

              {/* Itens do Checklist */}
              {selectedChecklist.itens && selectedChecklist.itens.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Itens Verificados
                  </h3>
                  <div className="space-y-2">
                    {selectedChecklist.itens.map((item: unknown, index: number) => {
                      const checklistItem = item as { descricao?: string; nome?: string; status?: string; observacao?: string };
                      return (
                      <div key={index} className="p-3 bg-gray-50 rounded-lg text-sm">
                        <p className="font-medium">{checklistItem.descricao || checklistItem.nome || `Item ${index + 1}`}</p>
                        {checklistItem.status && (
                          <p className="text-gray-600 mt-1">
                            Status: <span className="font-medium">{checklistItem.status}</span>
                          </p>
                        )}
                        {checklistItem.observacao && (
                          <p className="text-gray-600 mt-1">{checklistItem.observacao}</p>
                        )}
                      </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Liberação */}
              {selectedChecklist.liberacao && (
                <div>
                  <h3 className="font-semibold mb-3">Liberação</h3>
                  <div className="p-3 bg-blue-50 rounded-lg text-sm">
                    <p><span className="text-gray-500">Supervisor:</span> {selectedChecklist.liberacao.supervisor_nome}</p>
                    <p className="mt-1"><span className="text-gray-500">Data:</span> {new Date(selectedChecklist.liberacao.data).toLocaleString('pt-BR')}</p>
                    <p className="mt-1"><span className="text-gray-500">Justificativa:</span> {selectedChecklist.liberacao.justificativa}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button onClick={() => setShowDetails(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Rejeição */}
      <Dialog open={showRejectModal} onOpenChange={setShowRejectModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rejeitar Checklist</DialogTitle>
            <DialogDescription>
              Informe o motivo da rejeição do checklist veicular
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="motivo">Motivo da Rejeição *</Label>
              <Textarea
                id="motivo"
                placeholder="Descreva o motivo da rejeição..."
                value={rejectMotivo}
                onChange={(e) => setRejectMotivo(e.target.value)}
                rows={4}
                className="mt-2"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowRejectModal(false)
              setRejectMotivo('')
            }}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleRejeitar}>
              Confirmar Rejeição
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Liberação */}
      <Dialog open={showLiberarModal} onOpenChange={setShowLiberarModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Liberar Checklist</DialogTitle>
            <DialogDescription>
              Informe a justificativa para liberar este checklist veicular rejeitado
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="justificativa">Justificativa da Liberação *</Label>
              <Textarea
                id="justificativa"
                placeholder="Descreva a justificativa para liberar o checklist..."
                value={liberarJustificativa}
                onChange={(e) => setLiberarJustificativa(e.target.value)}
                rows={4}
                className="mt-2"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowLiberarModal(false)
              setLiberarJustificativa('')
            }}>
              Cancelar
            </Button>
            <Button 
              className="bg-green-600 hover:bg-green-700"
              onClick={handleLiberar}
            >
              <Unlock className="h-4 w-4 mr-2" />
              Confirmar Liberação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

