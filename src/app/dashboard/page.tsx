'use client'

import { useState, useEffect } from 'react'
import { apresentacaoTurnoService } from '@/services/apresentacaoTurnoService'
import { DashboardApresentacaoTurno, FuncionariosPorEquipe } from '@/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { 
  Users, 
  ClipboardCheck, 
  Car, 
  Clock, 
  AlertCircle,
  Eye,
  ThumbsUp,
  ThumbsDown
} from 'lucide-react'

interface ChecklistFuncionario {
  id: string;
  funcionario_nome: string;
  equipe: string;
  turno: string;
  status: 'pendente' | 'aprovado' | 'rejeitado';
  data_apresentacao: string;
  supervisor?: string;
  observacoes?: string;
}

interface ChecklistVeiculo {
  id: string;
  prefixo: string;
  placa: string;
  equipe: string;
  turno: string;
  status: 'pendente' | 'aprovado' | 'rejeitado';
  data_verificacao: string;
  verificador?: string;
  observacoes?: string;
}

export default function DashboardPage() {
  const [dashboardData, setDashboardData] = useState<DashboardApresentacaoTurno[]>([])
  const [funcionariosPorEquipe, setFuncionariosPorEquipe] = useState<FuncionariosPorEquipe[]>([])
  const [checklistsFuncionarios, setChecklistsFuncionarios] = useState<ChecklistFuncionario[]>([])
  const [checklistsVeiculos, setChecklistsVeiculos] = useState<ChecklistVeiculo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadDashboardData()
  }, [])

  const loadDashboardData = async () => {
    try {
      setLoading(true)
      const [dashboard, funcionarios] = await Promise.all([
        apresentacaoTurnoService.getDashboardApresentacoes(),
        apresentacaoTurnoService.getFuncionariosPorEquipe()
      ])
      
      setDashboardData(dashboard)
      setFuncionariosPorEquipe(funcionarios)
      
      // Mock data para checklists (será substituído por dados reais)
      setChecklistsFuncionarios([
        {
          id: '1',
          funcionario_nome: 'João Silva',
          equipe: 'Equipe Operacional A',
          turno: 'A',
          status: 'pendente',
          data_apresentacao: new Date().toISOString().split('T')[0]
        },
        {
          id: '2',
          funcionario_nome: 'Maria Santos',
          equipe: 'Equipe Operacional B',
          turno: 'B',
          status: 'aprovado',
          data_apresentacao: new Date().toISOString().split('T')[0],
          supervisor: 'Carlos Supervisor'
        }
      ])
      
      setChecklistsVeiculos([
        {
          id: '1',
          prefixo: 'VAN-001',
          placa: 'ABC-1234',
          equipe: 'Equipe Operacional A',
          turno: 'A',
          status: 'pendente',
          data_verificacao: new Date().toISOString().split('T')[0]
        },
        {
          id: '2',
          prefixo: 'VAN-002',
          placa: 'DEF-5678',
          equipe: 'Equipe Operacional B',
          turno: 'B',
          status: 'aprovado',
          data_verificacao: new Date().toISOString().split('T')[0],
          verificador: 'Pedro Verificador'
        }
      ])
    } catch (err) {
      setError('Erro ao carregar dados do dashboard')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const getTurnoColor = (turno: string) => {
    switch (turno) {
      case 'A': return 'bg-blue-100 text-blue-800'
      case 'B': return 'bg-green-100 text-green-800'
      case 'C': return 'bg-purple-100 text-purple-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  // const getStatusColor = (status: string) => { // TODO: Use for status styling
  //   switch (status) {
  //     case 'ativo': return 'bg-green-100 text-green-800'
  //     case 'finalizado': return 'bg-blue-100 text-blue-800'
  //     case 'transferido': return 'bg-yellow-100 text-yellow-800'
  //     default: return 'bg-gray-100 text-gray-800'
  //   }
  // }

  const getChecklistStatusColor = (status: string) => {
    switch (status) {
      case 'pendente': return 'bg-yellow-100 text-yellow-800'
      case 'aprovado': return 'bg-green-100 text-green-800'
      case 'rejeitado': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const handleAprovarChecklist = (id: string, tipo: 'funcionario' | 'veiculo') => {
    // Aqui será implementada a lógica de aprovação
    console.log(`Aprovando ${tipo} com ID: ${id}`)
  }

  const handleRejeitarChecklist = (id: string, tipo: 'funcionario' | 'veiculo') => {
    // Aqui será implementada a lógica de rejeição
    console.log(`Rejeitando ${tipo} com ID: ${id}`)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Erro ao carregar dashboard</h2>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Dashboard de Gestão</h1>
        <p className="text-gray-600">
          Visão geral das equipes apresentadas, checklists e status operacional
        </p>
      </div>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Equipes Ativas</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{funcionariosPorEquipe.length}</div>
            <p className="text-xs text-muted-foreground">
              Equipes com funcionários apresentados hoje
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Funcionários</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {funcionariosPorEquipe.reduce((sum, item) => sum + item.total_funcionarios, 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              Funcionários ativos em todas as equipes
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Checklists Pendentes</CardTitle>
            <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {checklistsFuncionarios.filter(c => c.status === 'pendente').length + 
               checklistsVeiculos.filter(c => c.status === 'pendente').length}
            </div>
            <p className="text-xs text-muted-foreground">
              Checklists aguardando aprovação
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Turno Atual</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {new Date().getHours() < 6 ? 'C' : new Date().getHours() < 14 ? 'A' : 'B'}
            </div>
            <p className="text-xs text-muted-foreground">
              Turno de trabalho atual
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs de Conteúdo */}
      <Tabs defaultValue="equipes" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="equipes">Equipes Apresentadas</TabsTrigger>
          <TabsTrigger value="funcionarios">Funcionários por Equipe</TabsTrigger>
          <TabsTrigger value="checklists-funcionarios">Checklists Funcionários</TabsTrigger>
          <TabsTrigger value="checklists-veiculos">Checklists Veículos</TabsTrigger>
        </TabsList>

        {/* Tab: Equipes Apresentadas */}
        <TabsContent value="equipes" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Equipes Apresentadas Hoje
              </CardTitle>
            </CardHeader>
            <CardContent>
              {dashboardData.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  Nenhuma equipe apresentada hoje
                </div>
              ) : (
                <div className="space-y-4">
                  {dashboardData.map((item, index) => (
                    <div key={index} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <Badge className={getTurnoColor(item.turno)}>
                            Turno {item.turno}
                          </Badge>
                          <span className="font-medium">{item.operacao}</span>
                        </div>
                        <div className="text-right">
                          <div className="text-sm text-gray-500">Equipe</div>
                          <div className="font-medium">{item.equipe_nome}</div>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <div className="text-gray-500">Prefixo</div>
                          <div className="font-medium">{item.prefixo_veiculo}</div>
                        </div>
                        <div>
                          <div className="text-gray-500">Funcionários Ativos</div>
                          <div className="font-medium">{item.funcionarios_ativos}</div>
                        </div>
                        <div>
                          <div className="text-gray-500">Primeira Apresentação</div>
                          <div className="font-medium">
                            {new Date(item.primeira_apresentacao).toLocaleTimeString('pt-BR', {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </div>
                        </div>
                        <div>
                          <div className="text-gray-500">Última Apresentação</div>
                          <div className="font-medium">
                            {new Date(item.ultima_apresentacao).toLocaleTimeString('pt-BR', {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Funcionários por Equipe */}
        <TabsContent value="funcionarios" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Distribuição de Funcionários por Equipe
              </CardTitle>
            </CardHeader>
            <CardContent>
              {funcionariosPorEquipe.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  Nenhuma equipe com funcionários ativos
                </div>
              ) : (
                <div className="space-y-4">
                  {funcionariosPorEquipe.map((item, index) => (
                    <div key={index} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <Badge className={getTurnoColor(item.turno)}>
                            Turno {item.turno}
                          </Badge>
                          <span className="font-medium">{item.equipe_nome}</span>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold text-blue-600">
                            {item.total_funcionarios}
                          </div>
                          <div className="text-sm text-gray-500">Funcionários</div>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <div className="text-gray-500">Operação</div>
                          <div className="font-medium">{item.operacao}</div>
                        </div>
                        <div>
                          <div className="text-gray-500">Prefixo do Veículo</div>
                          <div className="font-medium">{item.prefixo_fixo}</div>
                        </div>
                      </div>
                      
                      {item.nomes_funcionarios.length > 0 && (
                        <div className="mt-3">
                          <div className="text-gray-500 text-sm mb-2">Funcionários Ativos:</div>
                          <div className="flex flex-wrap gap-2">
                            {item.nomes_funcionarios.map((nome, idx) => (
                              <Badge key={idx} variant="outline" className="text-xs">
                                {nome}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Checklists de Funcionários */}
        <TabsContent value="checklists-funcionarios" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ClipboardCheck className="h-5 w-5" />
                Checklists de Funcionários
              </CardTitle>
            </CardHeader>
            <CardContent>
              {checklistsFuncionarios.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  Nenhum checklist de funcionário encontrado
                </div>
              ) : (
                <div className="space-y-4">
                  {checklistsFuncionarios.map((checklist) => (
                    <div key={checklist.id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <span className="font-medium">{checklist.funcionario_nome}</span>
                          <Badge className={getTurnoColor(checklist.turno)}>
                            Turno {checklist.turno}
                          </Badge>
                          <Badge className={getChecklistStatusColor(checklist.status)}>
                            {checklist.status === 'pendente' ? 'Pendente' : 
                             checklist.status === 'aprovado' ? 'Aprovado' : 'Rejeitado'}
                          </Badge>
                        </div>
                        <div className="flex gap-2">
                          {checklist.status === 'pendente' && (
                            <>
                              <Button 
                                size="sm" 
                                onClick={() => handleAprovarChecklist(checklist.id, 'funcionario')}
                                className="bg-green-600 hover:bg-green-700"
                              >
                                <ThumbsUp className="h-4 w-4 mr-1" />
                                Aprovar
                              </Button>
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => handleRejeitarChecklist(checklist.id, 'funcionario')}
                              >
                                <ThumbsDown className="h-4 w-4 mr-1" />
                                Rejeitar
                              </Button>
                            </>
                          )}
                          <Button size="sm" variant="outline">
                            <Eye className="h-4 w-4 mr-1" />
                            Ver
                          </Button>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <div className="text-gray-500">Equipe</div>
                          <div className="font-medium">{checklist.equipe}</div>
                        </div>
                        <div>
                          <div className="text-gray-500">Data</div>
                          <div className="font-medium">
                            {new Date(checklist.data_apresentacao).toLocaleDateString('pt-BR')}
                          </div>
                        </div>
                      </div>
                      
                      {checklist.supervisor && (
                        <div className="mt-3 text-sm">
                          <span className="text-gray-500">Supervisor: </span>
                          <span className="font-medium">{checklist.supervisor}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Checklists de Veículos */}
        <TabsContent value="checklists-veiculos" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Car className="h-5 w-5" />
                Checklists de Veículos
              </CardTitle>
            </CardHeader>
            <CardContent>
              {checklistsVeiculos.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  Nenhum checklist de veículo encontrado
                </div>
              ) : (
                <div className="space-y-4">
                  {checklistsVeiculos.map((checklist) => (
                    <div key={checklist.id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <span className="font-medium">{checklist.prefixo}</span>
                          <span className="text-sm text-gray-500">({checklist.placa})</span>
                          <Badge className={getTurnoColor(checklist.turno)}>
                            Turno {checklist.turno}
                          </Badge>
                          <Badge className={getChecklistStatusColor(checklist.status)}>
                            {checklist.status === 'pendente' ? 'Pendente' : 
                             checklist.status === 'aprovado' ? 'Aprovado' : 'Rejeitado'}
                          </Badge>
                        </div>
                        <div className="flex gap-2">
                          {checklist.status === 'pendente' && (
                            <>
                              <Button 
                                size="sm" 
                                onClick={() => handleAprovarChecklist(checklist.id, 'veiculo')}
                                className="bg-green-600 hover:bg-green-700"
                              >
                                <ThumbsUp className="h-4 w-4 mr-1" />
                                Aprovar
                              </Button>
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => handleRejeitarChecklist(checklist.id, 'veiculo')}
                              >
                                <ThumbsDown className="h-4 w-4 mr-1" />
                                Rejeitar
                              </Button>
                            </>
                          )}
                          <Button size="sm" variant="outline">
                            <Eye className="h-4 w-4 mr-1" />
                            Ver
                          </Button>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <div className="text-gray-500">Equipe</div>
                          <div className="font-medium">{checklist.equipe}</div>
                        </div>
                        <div>
                          <div className="text-gray-500">Data</div>
                          <div className="font-medium">
                            {new Date(checklist.data_verificacao).toLocaleDateString('pt-BR')}
                          </div>
                        </div>
                      </div>
                      
                      {checklist.verificador && (
                        <div className="mt-3 text-sm">
                          <span className="text-gray-500">Verificador: </span>
                          <span className="font-medium">{checklist.verificador}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
} 