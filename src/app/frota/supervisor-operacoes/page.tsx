'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { 
  PlusIcon, 
  PencilIcon, 
  TrashIcon,
  CheckIcon,
  XMarkIcon,
  MagnifyingGlassIcon
} from '@heroicons/react/24/outline';
import { supervisorOperacaoService, type SupervisorOperacao } from '@/services/supervisorOperacaoService';
import { userService } from '@/services/userService';
import { OperacoesAtividadesService } from '@/services/operacoesAtividadesService';
import { contratoService } from '@/services/contratoService';
import { useModularPermissions, PERMISSION_CODES } from '@/hooks/useModularPermissions';
import PermissionGuard from '@/components/permissions/PermissionGuard';
import type { User } from '@/types';
import type { Contrato } from '@/types/contratos';
import type { OperacaoPadrao } from '@/types/operacoes-atividades';

export default function SupervisorOperacoesPage() {
  const router = useRouter();
  const { hasPermission } = useModularPermissions();

  // Estados
  const [loading, setLoading] = useState(true);
  const [atribuicoes, setAtribuicoes] = useState<SupervisorOperacao[]>([]);
  const [supervisores, setSupervisores] = useState<User[]>([]);
  const [operacoes, setOperacoes] = useState<OperacaoPadrao[]>([]);
  const [contratos, setContratos] = useState<Contrato[]>([]);
  
  // Filtros
  const [filtroContrato, setFiltroContrato] = useState<string>('todos');
  const [filtroSupervisor, setFiltroSupervisor] = useState<string>('todos');
  const [filtroOperacao, setFiltroOperacao] = useState<string>('todos');
  const [pesquisa, setPesquisa] = useState('');
  
  // Modal
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState<SupervisorOperacao | null>(null);
  const [formData, setFormData] = useState({
    supervisor_id: '',
    operacao_id: '',
    contrato_id: '',
    ativo: true
  });
  const [buscaSupervisor, setBuscaSupervisor] = useState('');
  const [supervisoresFiltrados, setSupervisoresFiltrados] = useState<User[]>([]);
  const [mostrarSugestoesSupervisor, setMostrarSugestoesSupervisor] = useState(false);
  const [supervisorSelecionado, setSupervisorSelecionado] = useState<User | null>(null);

  // Verificar permissão
  const podeGerenciar = hasPermission(PERMISSION_CODES.CONFIGURACOES.GERENCIAR_OPERACOES_SUPERVISOR);

  // Carregar dados
  const carregarDados = useCallback(async () => {
    try {
      setLoading(true);

      // Carregar supervisores (apenas nível supervisor)
      const usuarios = await userService.getAll();
      const supervisoresFiltrados = usuarios.filter(u => 
        u.nivel_acesso === 'supervisor' && u.status === 'ativo'
      );
      setSupervisores(supervisoresFiltrados);

      // Carregar operações
      const ops = await OperacoesAtividadesService.getOperacoes({ ativo: true });
      setOperacoes(ops);

      // Carregar contratos
      const conts = await contratoService.getAll();
      setContratos(conts.filter(c => c.status === 'ativo'));

      // Carregar atribuições
      const atribs = await supervisorOperacaoService.getAll();
      setAtribuicoes(atribs);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      alert('Erro ao carregar dados. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (podeGerenciar) {
      carregarDados();
    } else {
      router.push('/');
    }
  }, [podeGerenciar, carregarDados, router]);

  // Filtrar atribuições
  const atribuicoesFiltradas = atribuicoes.filter(atrib => {
    if (filtroContrato !== 'todos' && atrib.contrato_id !== filtroContrato) return false;
    if (filtroSupervisor !== 'todos' && atrib.supervisor_id !== filtroSupervisor) return false;
    if (filtroOperacao !== 'todos' && atrib.operacao_id !== filtroOperacao) return false;
    if (pesquisa) {
      const pesquisaLower = pesquisa.toLowerCase();
      const supervisorNome = atrib.supervisor?.nome?.toLowerCase() || '';
      const operacaoNome = atrib.operacao?.nome?.toLowerCase() || '';
      const contratoNome = atrib.contrato?.nome?.toLowerCase() || '';
      if (!supervisorNome.includes(pesquisaLower) && 
          !operacaoNome.includes(pesquisaLower) && 
          !contratoNome.includes(pesquisaLower)) {
        return false;
      }
    }
    return true;
  });

  // Abrir modal para criar/editar
  const abrirModal = (atribuicao?: SupervisorOperacao) => {
    if (atribuicao) {
      setEditando(atribuicao);
      setFormData({
        supervisor_id: atribuicao.supervisor_id,
        operacao_id: atribuicao.operacao_id,
        contrato_id: atribuicao.contrato_id,
        ativo: atribuicao.ativo
      });
      // Buscar supervisor selecionado
      const supervisor = supervisores.find(s => s.id === atribuicao.supervisor_id);
      setSupervisorSelecionado(supervisor || null);
      setBuscaSupervisor(supervisor ? `${supervisor.nome} (${supervisor.matricula})` : '');
    } else {
      setEditando(null);
      setFormData({
        supervisor_id: '',
        operacao_id: '',
        contrato_id: '',
        ativo: true
      });
      setSupervisorSelecionado(null);
      setBuscaSupervisor('');
    }
    setModalAberto(true);
    setMostrarSugestoesSupervisor(false);
  };

  // Fechar modal
  const fecharModal = () => {
    setModalAberto(false);
    setEditando(null);
    setFormData({
      supervisor_id: '',
      operacao_id: '',
      contrato_id: '',
      ativo: true
    });
    setSupervisorSelecionado(null);
    setBuscaSupervisor('');
    setMostrarSugestoesSupervisor(false);
  };

  // Buscar supervisores conforme digitação
  useEffect(() => {
    if (buscaSupervisor.trim() === '') {
      setSupervisoresFiltrados([]);
      return;
    }

    const termo = buscaSupervisor.toLowerCase();
    const filtrados = supervisores.filter(supervisor =>
      supervisor.nome.toLowerCase().includes(termo) ||
      supervisor.matricula?.toLowerCase().includes(termo) ||
      supervisor.email?.toLowerCase().includes(termo)
    ).slice(0, 10); // Limitar a 10 resultados
    
    setSupervisoresFiltrados(filtrados);
    setMostrarSugestoesSupervisor(true);
  }, [buscaSupervisor, supervisores]);

  // Selecionar supervisor da busca
  const selecionarSupervisor = (supervisor: User) => {
    setSupervisorSelecionado(supervisor);
    setFormData(prev => ({ ...prev, supervisor_id: supervisor.id }));
    setBuscaSupervisor(`${supervisor.nome} (${supervisor.matricula})`);
    setMostrarSugestoesSupervisor(false);
  };

  // Fechar sugestões ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.supervisor-search-container')) {
        setMostrarSugestoesSupervisor(false);
      }
    };

    if (mostrarSugestoesSupervisor) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [mostrarSugestoesSupervisor]);

  // Salvar atribuição
  const salvarAtribuicao = async () => {
    try {
      if (!formData.supervisor_id || !formData.operacao_id || !formData.contrato_id) {
        alert('Preencha todos os campos obrigatórios');
        return;
      }

      // Verificar se já existe
      const existe = await supervisorOperacaoService.exists(
        formData.supervisor_id,
        formData.operacao_id,
        formData.contrato_id
      );

      if (existe && !editando) {
        alert('Esta atribuição já existe!');
        return;
      }

      if (editando) {
        await supervisorOperacaoService.update(editando.id, formData);
      } else {
        await supervisorOperacaoService.create(formData);
      }

      await carregarDados();
      fecharModal();
    } catch (error) {
      console.error('Erro ao salvar atribuição:', error);
      alert(error instanceof Error ? error.message : 'Erro ao salvar atribuição. Tente novamente.');
    }
  };

  // Toggle ativo/inativo
  const toggleAtivo = async (atribuicao: SupervisorOperacao) => {
    try {
      await supervisorOperacaoService.toggleActive(atribuicao.id, !atribuicao.ativo);
      await carregarDados();
    } catch (error) {
      console.error('Erro ao alterar status:', error);
      alert('Erro ao alterar status. Tente novamente.');
    }
  };

  // Deletar atribuição
  const deletarAtribuicao = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta atribuição?')) return;

    try {
      await supervisorOperacaoService.delete(id);
      await carregarDados();
    } catch (error) {
      console.error('Erro ao deletar atribuição:', error);
      alert('Erro ao deletar atribuição. Tente novamente.');
    }
  };

  // Filtrar operações por contrato selecionado
  const operacoesFiltradas = formData.contrato_id
    ? operacoes.filter(op => op.contratoId === formData.contrato_id)
    : operacoes;

  if (!podeGerenciar) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">Você não tem permissão para acessar esta página.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Gerenciar Operações por Supervisor</h2>
          <p className="text-gray-600 mt-2">
            Atribua operações a supervisores por contrato. Isso define quais checklists de veículos cada supervisor pode aprovar.
          </p>
        </div>
        <PermissionGuard codigo={PERMISSION_CODES.CONFIGURACOES.GERENCIAR_OPERACOES_SUPERVISOR}>
          <Button onClick={() => abrirModal()}>
            <PlusIcon className="h-5 w-5 mr-2" />
            Nova Atribuição
          </Button>
        </PermissionGuard>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="pesquisa">Pesquisar</Label>
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <Input
                  id="pesquisa"
                  placeholder="Supervisor, operação ou contrato..."
                  value={pesquisa}
                  onChange={(e) => setPesquisa(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="filtro-contrato">Contrato</Label>
              <Select value={filtroContrato} onValueChange={setFiltroContrato}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos os contratos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os contratos</SelectItem>
                  {contratos.map(contrato => (
                    <SelectItem key={contrato.id} value={contrato.id}>
                      {contrato.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="filtro-supervisor">Supervisor</Label>
              <Select value={filtroSupervisor} onValueChange={setFiltroSupervisor}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos os supervisores" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os supervisores</SelectItem>
                  {supervisores.map(supervisor => (
                    <SelectItem key={supervisor.id} value={supervisor.id}>
                      {supervisor.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="filtro-operacao">Operação</Label>
              <Select value={filtroOperacao} onValueChange={setFiltroOperacao}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas as operações" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas as operações</SelectItem>
                  {operacoes.map(operacao => (
                    <SelectItem key={operacao.id} value={operacao.id}>
                      {operacao.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabela de Atribuições */}
      <Card>
        <CardHeader>
          <CardTitle>Atribuições de Operações</CardTitle>
          <CardDescription>
            {atribuicoesFiltradas.length} de {atribuicoes.length} atribuições
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Carregando...</div>
          ) : atribuicoesFiltradas.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              Nenhuma atribuição encontrada
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-3">Supervisor</th>
                    <th className="text-left p-3">Operação</th>
                    <th className="text-left p-3">Contrato</th>
                    <th className="text-left p-3">Status</th>
                    <th className="text-left p-3">Criado em</th>
                    <th className="text-right p-3">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {atribuicoesFiltradas.map(atrib => (
                    <tr key={atrib.id} className="border-b hover:bg-gray-50">
                      <td className="p-3">
                        <div>
                          <div className="font-medium">{atrib.supervisor?.nome || 'N/A'}</div>
                          <div className="text-sm text-gray-500">{atrib.supervisor?.email || ''}</div>
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="font-medium">{atrib.operacao?.nome || 'N/A'}</div>
                        <div className="text-sm text-gray-500">{atrib.operacao?.codigo || ''}</div>
                      </td>
                      <td className="p-3">{atrib.contrato?.nome || 'N/A'}</td>
                      <td className="p-3">
                        <Badge variant={atrib.ativo ? 'default' : 'secondary'}>
                          {atrib.ativo ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </td>
                      <td className="p-3 text-sm text-gray-500">
                        {new Date(atrib.criado_em).toLocaleDateString('pt-BR')}
                      </td>
                      <td className="p-3">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleAtivo(atrib)}
                            title={atrib.ativo ? 'Desativar' : 'Ativar'}
                          >
                            {atrib.ativo ? (
                              <XMarkIcon className="h-4 w-4" />
                            ) : (
                              <CheckIcon className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => abrirModal(atrib)}
                          >
                            <PencilIcon className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deletarAtribuicao(atrib.id)}
                          >
                            <TrashIcon className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal de Criar/Editar */}
      <Dialog open={modalAberto} onOpenChange={setModalAberto}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editando ? 'Editar Atribuição' : 'Nova Atribuição'}
            </DialogTitle>
            <DialogDescription>
              {editando 
                ? 'Edite a atribuição de operação para o supervisor'
                : 'Atribua uma operação a um supervisor para um contrato específico'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="contrato">Contrato *</Label>
              <Select
                value={formData.contrato_id}
                onValueChange={(value) => setFormData({ ...formData, contrato_id: value, operacao_id: '' })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o contrato" />
                </SelectTrigger>
                <SelectContent>
                  {contratos.map(contrato => (
                    <SelectItem key={contrato.id} value={contrato.id}>
                      {contrato.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="relative supervisor-search-container">
              <Label htmlFor="supervisor">Supervisor *</Label>
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <Input
                  id="supervisor"
                  placeholder="Buscar supervisor por nome, matrícula ou email..."
                  value={buscaSupervisor}
                  onChange={(e) => {
                    setBuscaSupervisor(e.target.value);
                    if (!e.target.value) {
                      setSupervisorSelecionado(null);
                      setFormData(prev => ({ ...prev, supervisor_id: '' }));
                    }
                  }}
                  onFocus={() => {
                    if (buscaSupervisor.trim() && supervisoresFiltrados.length > 0) {
                      setMostrarSugestoesSupervisor(true);
                    }
                  }}
                  className="pl-10"
                />
                {supervisorSelecionado && (
                  <button
                    type="button"
                    onClick={() => {
                      setSupervisorSelecionado(null);
                      setBuscaSupervisor('');
                      setFormData(prev => ({ ...prev, supervisor_id: '' }));
                    }}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <XMarkIcon className="h-5 w-5" />
                  </button>
                )}
              </div>
              {mostrarSugestoesSupervisor && supervisoresFiltrados.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-auto">
                  {supervisoresFiltrados.map(supervisor => (
                    <button
                      key={supervisor.id}
                      type="button"
                      onClick={() => selecionarSupervisor(supervisor)}
                      className="w-full text-left px-4 py-2 hover:bg-gray-100 transition-colors"
                    >
                      <div className="font-medium">{supervisor.nome}</div>
                      <div className="text-sm text-gray-500">
                        {supervisor.matricula && `Matrícula: ${supervisor.matricula}`}
                        {supervisor.email && ` • ${supervisor.email}`}
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {mostrarSugestoesSupervisor && buscaSupervisor.trim() && supervisoresFiltrados.length === 0 && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg p-4 text-sm text-gray-500">
                  Nenhum supervisor encontrado
                </div>
              )}
            </div>
            <div>
              <Label htmlFor="operacao">Operação *</Label>
              <Select
                value={formData.operacao_id}
                onValueChange={(value) => setFormData({ ...formData, operacao_id: value })}
                disabled={!formData.contrato_id}
              >
                <SelectTrigger>
                  <SelectValue placeholder={formData.contrato_id ? "Selecione a operação" : "Selecione primeiro o contrato"} />
                </SelectTrigger>
                <SelectContent>
                  {operacoesFiltradas.length === 0 ? (
                    <SelectItem value="vazio" disabled>
                      Nenhuma operação disponível para este contrato
                    </SelectItem>
                  ) : (
                    operacoesFiltradas.map(operacao => (
                      <SelectItem key={operacao.id} value={operacao.id}>
                        {operacao.nome} ({operacao.codigo})
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {!formData.contrato_id && (
                <p className="text-sm text-gray-500 mt-1">
                  Selecione primeiro o contrato para ver as operações disponíveis
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={fecharModal}>
              Cancelar
            </Button>
            <Button onClick={salvarAtribuicao}>
              {editando ? 'Salvar Alterações' : 'Criar Atribuição'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

