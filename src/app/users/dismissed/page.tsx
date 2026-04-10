'use client';

import { useState, useEffect } from 'react';
import PermissionGuard from '@/components/PermissionGuard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { 
  ArrowPathIcon,
  MagnifyingGlassIcon,
  ChartBarIcon,
  EyeIcon
} from '@heroicons/react/24/outline';
import { toast } from 'sonner';
import { PERMISSION_CODES } from '@/hooks/useModularPermissions';

interface FuncionarioDemitido {
  id: string;
  nome: string;
  email: string;
  matricula: string;
  cpf?: string;
  telefone?: string;
  cargo: string;
  posicao?: string;
  operacao: string;
  base_id?: string;
  contrato_id?: string;
  departamento?: string;
  status: string;
  nivel_acesso: string;
  criado_em: string;
  atualizado_em: string;
  data_demissao: string;
  tipo_demissao: string;
  observacoes_demissao?: string;
  demitido_por?: string;
  demitido_por_nome?: string;
  base_nome?: string;
  contrato_nome?: string;
}

interface ReativarForm {
  usuario_id: string;
  observacoes_reativacao: string;
}

interface Estatisticas {
  total_demissoes: number;
  total_reativacoes: number;
  demissoes_por_tipo: Record<string, number>;
  demissoes_por_mes: Record<string, number>;
  demissoes_por_base: Record<string, number>;
}

export default function FuncionariosDemitidosPage() {
  const [funcionariosDemitidos, setFuncionariosDemitidos] = useState<FuncionarioDemitido[]>([]);
  const [estatisticas, setEstatisticas] = useState<Estatisticas | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTipo, setFilterTipo] = useState('todos');
  const [filterBase] = useState('todos');
  const [activeAction, setActiveAction] = useState<'reativar' | 'estatisticas' | null>(null);
  const [reativarForm, setReativarForm] = useState<ReativarForm>({
    usuario_id: '',
    observacoes_reativacao: ''
  });

  useEffect(() => {
    loadFuncionariosDemitidos();
    loadEstatisticas();
  }, []);

  const loadFuncionariosDemitidos = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/users/dismissed');
      if (!response.ok) throw new Error('Erro ao carregar funcionários demitidos');
      
      const data = await response.json();
      setFuncionariosDemitidos(data.data || []);
    } catch (error) {
      console.error('Erro ao carregar funcionários demitidos:', error);
      toast.error('Erro ao carregar funcionários demitidos');
    } finally {
      setLoading(false);
    }
  };

  const loadEstatisticas = async () => {
    try {
      const response = await fetch('/api/users/statistics');
      if (!response.ok) throw new Error('Erro ao carregar estatísticas');
      
      const data = await response.json();
      setEstatisticas(data.statistics);
    } catch (error) {
      console.error('Erro ao carregar estatísticas:', error);
    }
  };

  const handleReativarFuncionario = async () => {
    try {
      const response = await fetch('/api/users/reactivate', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reativarForm)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao reativar funcionário');
      }

      toast.success('Funcionário reativado com sucesso!');
      setActiveAction(null);
      setReativarForm({
        usuario_id: '',
        observacoes_reativacao: ''
      });
      await loadFuncionariosDemitidos();
      await loadEstatisticas();
    } catch (error) {
      console.error('Erro ao reativar funcionário:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao reativar funcionário');
    }
  };

  const openReativarModal = (funcionario: FuncionarioDemitido) => {
    setReativarForm({
      usuario_id: funcionario.id,
      observacoes_reativacao: ''
    });
    setActiveAction('reativar');
  };

  // Filtrar funcionários demitidos
  const filteredFuncionarios = funcionariosDemitidos.filter(funcionario => {
    const matchesSearch = funcionario.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         funcionario.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         funcionario.matricula.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesTipo = filterTipo === 'todos' || funcionario.tipo_demissao === filterTipo;
    const matchesBase = filterBase === 'todos' || funcionario.base_id === filterBase;
    
    return matchesSearch && matchesTipo && matchesBase;
  });

  const getTipoDemissaoBadge = (tipo: string) => {
    const tipos = {
      'sem_justa_causa': { label: 'Sem Justa Causa', variant: 'default' as const },
      'com_justa_causa': { label: 'Com Justa Causa', variant: 'destructive' as const },
      'pedido_demissao': { label: 'Pedido de Demissão', variant: 'secondary' as const },
      'aposentadoria': { label: 'Aposentadoria', variant: 'outline' as const },
      'falecimento': { label: 'Falecimento', variant: 'outline' as const },
      'outros': { label: 'Outros', variant: 'outline' as const }
    };
    
    const tipoInfo = tipos[tipo as keyof typeof tipos] || { label: tipo, variant: 'outline' as const };
    return <Badge variant={tipoInfo.variant}>{tipoInfo.label}</Badge>;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Carregando funcionários demitidos...</p>
        </div>
      </div>
    );
  }

  return (
    <PermissionGuard 
      requiredPermissions={[PERMISSION_CODES.FUNCIONARIOS.VISUALIZAR_DEMITIDOS]}
      fallbackMessage="Você não tem permissão para visualizar funcionários demitidos."
    >
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Funcionários Demitidos</h1>
            <p className="text-gray-600">Gerencie funcionários que foram demitidos</p>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline"
              onClick={() => setActiveAction('estatisticas')}
              className="flex items-center gap-2"
            >
              <ChartBarIcon className="h-4 w-4" />
              Estatísticas
            </Button>
          </div>
        </div>

        {/* Estatísticas Rápidas */}
        {estatisticas && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600">{estatisticas.total_demissoes}</div>
                  <p className="text-sm text-gray-600">Total Demitidos</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{estatisticas.total_reativacoes}</div>
                  <p className="text-sm text-gray-600">Reativados</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">{filteredFuncionarios.length}</div>
                  <p className="text-sm text-gray-600">Atualmente Demitidos</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600">
                    {Object.keys(estatisticas.demissoes_por_tipo).length}
                  </div>
                  <p className="text-sm text-gray-600">Tipos de Demissão</p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Filtros */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex gap-4 items-end">
              <div className="flex-1">
                <Label htmlFor="search">Buscar</Label>
                <div className="relative">
                  <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="search"
                    placeholder="Nome, email ou matrícula..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <div className="w-48">
                <Label htmlFor="tipo">Tipo de Demissão</Label>
                <Select value={filterTipo} onValueChange={setFilterTipo}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="sem_justa_causa">Sem Justa Causa</SelectItem>
                    <SelectItem value="com_justa_causa">Com Justa Causa</SelectItem>
                    <SelectItem value="pedido_demissao">Pedido de Demissão</SelectItem>
                    <SelectItem value="aposentadoria">Aposentadoria</SelectItem>
                    <SelectItem value="falecimento">Falecimento</SelectItem>
                    <SelectItem value="outros">Outros</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Lista de Funcionários Demitidos */}
        <div className="grid gap-4">
          {filteredFuncionarios.map((funcionario) => (
            <Card 
              key={funcionario.id} 
              className="hover:shadow-md transition-shadow duration-200"
            >
              <CardContent className="pt-6">
                <div className="flex justify-between items-start">
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <h3 className="text-lg font-semibold">{funcionario.nome}</h3>
                      <Badge variant="destructive">Demitido</Badge>
                      {getTipoDemissaoBadge(funcionario.tipo_demissao)}
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600">
                      <div>
                        <span className="font-medium">Email:</span> {funcionario.email}
                      </div>
                      <div>
                        <span className="font-medium">Matrícula:</span> {funcionario.matricula}
                      </div>
                      <div>
                        <span className="font-medium">Cargo:</span> {funcionario.cargo}
                      </div>
                      <div>
                        <span className="font-medium">Operação:</span> {funcionario.operacao}
                      </div>
                      <div>
                        <span className="font-medium">Data Demissão:</span> {formatDate(funcionario.data_demissao)}
                      </div>
                      {funcionario.base_nome && (
                        <div>
                          <span className="font-medium">Base:</span> {funcionario.base_nome}
                        </div>
                      )}
                      {funcionario.contrato_nome && (
                        <div>
                          <span className="font-medium">Contrato:</span> {funcionario.contrato_nome}
                        </div>
                      )}
                      {funcionario.demitido_por_nome && (
                        <div>
                          <span className="font-medium">Demitido por:</span> {funcionario.demitido_por_nome}
                        </div>
                      )}
                    </div>
                    {funcionario.observacoes_demissao && (
                      <div className="text-sm text-gray-600">
                        <span className="font-medium">Observações:</span> {funcionario.observacoes_demissao}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2 items-center">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        window.location.href = `/users/dismissed/${funcionario.id}`;
                      }}
                      className="flex items-center gap-2"
                    >
                      <EyeIcon className="h-4 w-4" />
                      Ver Detalhes
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openReativarModal(funcionario)}
                      className="text-green-600 border-green-600 hover:bg-green-50"
                    >
                      <ArrowPathIcon className="h-4 w-4 mr-1" />
                      Reativar
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Modal de Reativar Funcionário */}
        <Dialog open={activeAction === 'reativar'} onOpenChange={(open) => !open && setActiveAction(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-green-600">
                <ArrowPathIcon className="h-5 w-5" />
                Reativar Funcionário
              </DialogTitle>
              <DialogDescription>
                Tem certeza que deseja reativar este funcionário?
                Ele voltará para a lista de funcionários ativos.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="reativar-observacoes">Observações da Reativação</Label>
                <Textarea
                  id="reativar-observacoes"
                  value={reativarForm.observacoes_reativacao}
                  onChange={(e) => setReativarForm({ ...reativarForm, observacoes_reativacao: e.target.value })}
                  placeholder="Motivo da reativação (opcional)..."
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setActiveAction(null)}>
                Cancelar
              </Button>
              <Button 
                onClick={() => {
                  if (confirm('Tem certeza que deseja reativar este funcionário?')) {
                    handleReativarFuncionario();
                  }
                }}
                className="bg-green-600 hover:bg-green-700"
              >
                <ArrowPathIcon className="h-4 w-4 mr-2" />
                Confirmar Reativação
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Modal de Estatísticas */}
        <Dialog open={activeAction === 'estatisticas'} onOpenChange={(open) => !open && setActiveAction(null)}>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ChartBarIcon className="h-5 w-5" />
                Estatísticas de Demissões
              </DialogTitle>
              <DialogDescription>
                Relatório completo de demissões e reativações
              </DialogDescription>
            </DialogHeader>
            
            {estatisticas && (
              <div className="space-y-6">
                {/* Demissões por Tipo */}
                <Card>
                  <CardHeader>
                    <CardTitle>Demissões por Tipo</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                      {estatisticas.demissoes_por_tipo && Object.entries(estatisticas.demissoes_por_tipo).map(([tipo, count]) => (
                        <div key={tipo} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                          <span className="capitalize">{tipo.replace('_', ' ')}</span>
                          <Badge variant="outline">{count}</Badge>
                        </div>
                      ))}
                      {(!estatisticas.demissoes_por_tipo || Object.keys(estatisticas.demissoes_por_tipo).length === 0) && (
                        <div className="col-span-2 text-center text-gray-500 py-4">
                          Nenhuma demissão por tipo encontrada
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Demissões por Mês */}
                <Card>
                  <CardHeader>
                    <CardTitle>Demissões por Mês</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 gap-2">
                      {estatisticas.demissoes_por_mes && Object.entries(estatisticas.demissoes_por_mes).map(([mes, count]) => (
                        <div key={mes} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                          <span>{mes}</span>
                          <Badge variant="outline">{count}</Badge>
                        </div>
                      ))}
                      {(!estatisticas.demissoes_por_mes || Object.keys(estatisticas.demissoes_por_mes).length === 0) && (
                        <div className="col-span-3 text-center text-gray-500 py-4">
                          Nenhuma demissão por mês encontrada
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Demissões por Base */}
                <Card>
                  <CardHeader>
                    <CardTitle>Demissões por Base</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-2">
                      {estatisticas.demissoes_por_base && Object.entries(estatisticas.demissoes_por_base).map(([base, count]) => (
                        <div key={base} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                          <span>{base}</span>
                          <Badge variant="outline">{count}</Badge>
                        </div>
                      ))}
                      {(!estatisticas.demissoes_por_base || Object.keys(estatisticas.demissoes_por_base).length === 0) && (
                        <div className="col-span-2 text-center text-gray-500 py-4">
                          Nenhuma demissão por base encontrada
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setActiveAction(null)}>
                Fechar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </PermissionGuard>
  );
}