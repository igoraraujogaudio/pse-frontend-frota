'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/contexts/AuthContext';
import { useModularPermissions, PERMISSION_CODES } from '@/hooks/useModularPermissions';
import { OperacoesAtividadesService } from '@/services/operacoesAtividadesService';
import { SetoresService } from '@/services/setoresService';
import { ContratoService } from '@/services/contratoService';
import type { Contrato } from '@/types/contratos';
import { 
  OperacaoPadrao, 
  AtividadePadrao, 
  AtividadeComOperacao,
  OperacaoFormData,
  AtividadeFormData
} from '@/types/operacoes-atividades';
import { 
  SetorPadrao, 
  SetorFormData, 
  OperacaoComSetores
} from '@/types/setores';

export default function OperacoesAtividadesPage() {
  useAuth();
  const { hasAnyPermission, loading: permissionsLoading } = useModularPermissions();
  
  // Estados
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [selectedContrato, setSelectedContrato] = useState<string>('');
  const [operacoes, setOperacoes] = useState<OperacaoPadrao[]>([]);
  const [atividades, setAtividades] = useState<AtividadeComOperacao[]>([]);
  const [setores, setSetores] = useState<SetorPadrao[]>([]);
  const [operacoesComSetores, setOperacoesComSetores] = useState<OperacaoComSetores[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Estados para formulários
  const [operacaoForm, setOperacaoForm] = useState<OperacaoFormData & { requerEncarregado?: boolean }>({
    codigo: '',
    nome: '',
    descricao: '',
    contratoId: '',
    requerEncarregado: false,
    ativo: true,
    ordem: 0
  });
  
  const [atividadeForm, setAtividadeForm] = useState<AtividadeFormData>({
    codigo: '',
    nome: '',
    descricao: '',
    operacaoId: '',
    contratoId: '',
    ativo: true,
    ordem: 0
  });

  const [setorForm, setSetorForm] = useState<SetorFormData>({
    codigo: '',
    nome: '',
    descricao: '',
    ativo: true,
    contratoId: '',
    ordem: 0
  });
  
  // Estados para modais
  const [operacaoModalOpen, setOperacaoModalOpen] = useState(false);
  const [atividadeModalOpen, setAtividadeModalOpen] = useState(false);
  const [setorModalOpen, setSetorModalOpen] = useState(false);
  const [operacaoSetoresModalOpen, setOperacaoSetoresModalOpen] = useState(false);
  const [editingOperacao, setEditingOperacao] = useState<OperacaoPadrao | null>(null);
  const [editingAtividade, setEditingAtividade] = useState<AtividadePadrao | null>(null);
  const [editingSetor, setEditingSetor] = useState<SetorPadrao | null>(null);
  const [selectedOperacaoParaSetores, setSelectedOperacaoParaSetores] = useState<OperacaoPadrao | null>(null);
  const [setoresSelecionados, setSetoresSelecionados] = useState<string[]>([]);
  
  // Estados para filtros
  const [operacaoSearch, setOperacaoSearch] = useState('');
  const [atividadeSearch, setAtividadeSearch] = useState('');
  const [selectedOperacaoFilter, setSelectedOperacaoFilter] = useState<string>('all');

  // Verificar permissões
  const canManageOperacoes = hasAnyPermission([
    PERMISSION_CODES.ALMOXARIFADO.CONFIGURACOES_SISTEMA,
    PERMISSION_CODES.ALMOXARIFADO.GERENCIAR_USUARIOS
  ]);

  // Carregar dados
  const loadContratos = async () => {
    try {
      const contratoService = new ContratoService();
      const contratosData = await contratoService.getContratosAtivos();
      setContratos(contratosData);
      
      // Selecionar o primeiro contrato por padrão se houver
      if (contratosData.length > 0 && !selectedContrato) {
        setSelectedContrato(contratosData[0].id);
      }
    } catch (err) {
      console.error('Erro ao carregar contratos:', err);
      setError('Erro ao carregar contratos. Tente novamente.');
    }
  };

  const loadOperacoes = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const filter = selectedContrato ? { contratoId: selectedContrato } : {};
      const operacoesData = await OperacoesAtividadesService.getOperacoes(filter);
      setOperacoes(operacoesData);
    } catch (err) {
      console.error('Erro ao carregar operações:', err);
      setError('Erro ao carregar operações. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const loadAtividades = async () => {
    try {
      setError(null);
      
      const filter = selectedContrato ? { contratoId: selectedContrato } : {};
      const atividadesData = await OperacoesAtividadesService.getAtividades(filter);
      setAtividades(atividadesData);
    } catch (err) {
      console.error('Erro ao carregar atividades:', err);
      setError('Erro ao carregar atividades. Tente novamente.');
    }
  };

  const loadSetores = async () => {
    try {
      setError(null);
      
      const filter = selectedContrato ? { contratoId: selectedContrato } : {};
      const setoresData = await SetoresService.getSetores(filter);
      setSetores(setoresData);
    } catch (err) {
      console.error('Erro ao carregar setores:', err);
      setError('Erro ao carregar setores. Tente novamente.');
    }
  };

  const loadOperacoesComSetores = async () => {
    try {
      const operacoesComSetoresData = await SetoresService.getOperacoesComSetores(selectedContrato || undefined);
      setOperacoesComSetores(operacoesComSetoresData);
    } catch (err) {
      console.error('Erro ao carregar operações com setores:', err);
    }
  };

  useEffect(() => {
    loadContratos();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedContrato) {
      loadOperacoes();
      loadAtividades();
      loadSetores();
      loadOperacoesComSetores();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedContrato]);

  // Se não tem permissão, mostrar mensagem
  if (!permissionsLoading && !canManageOperacoes) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <h1 className="text-xl font-semibold text-red-800 mb-2">Acesso Negado</h1>
          <p className="text-red-600">
            Você não tem permissão para gerenciar operações e atividades.
          </p>
        </div>
      </div>
    );
  }

  // Handlers para operações
  const handleCreateOperacao = async () => {
    try {
      await OperacoesAtividadesService.createOperacao(operacaoForm);
      setOperacaoModalOpen(false);
      setOperacaoForm({
        codigo: '',
        nome: '',
        descricao: '',
        contratoId: selectedContrato,
        requerEncarregado: false,
        ativo: true,
        ordem: 0
      });
      await loadOperacoes();
    } catch (err) {
      console.error('Erro ao criar operação:', err);
      setError('Erro ao criar operação. Tente novamente.');
    }
  };

  const handleEditOperacao = async () => {
    if (!editingOperacao) return;
    
    try {
      await OperacoesAtividadesService.updateOperacao(editingOperacao.id, operacaoForm);
      setOperacaoModalOpen(false);
      setEditingOperacao(null);
      setOperacaoForm({
        codigo: '',
        nome: '',
        descricao: '',
        contratoId: selectedContrato,
        requerEncarregado: false,
        ativo: true,
        ordem: 0
      });
      await loadOperacoes();
    } catch (err) {
      console.error('Erro ao editar operação:', err);
      setError('Erro ao editar operação. Tente novamente.');
    }
  };

  const handleDeleteOperacao = async (id: string) => {
    if (!confirm('Tem certeza que deseja deletar esta operação?')) return;
    
    try {
      await OperacoesAtividadesService.deleteOperacao(id);
      await loadOperacoes();
    } catch (err) {
      console.error('Erro ao deletar operação:', err);
      setError('Erro ao deletar operação. Tente novamente.');
    }
  };

  // Handlers para atividades
  const handleCreateAtividade = async () => {
    try {
      await OperacoesAtividadesService.createAtividade(atividadeForm);
      setAtividadeModalOpen(false);
      setAtividadeForm({
        codigo: '',
        nome: '',
        descricao: '',
        operacaoId: '',
        contratoId: selectedContrato,
        ativo: true,
        ordem: 0
      });
      await loadAtividades();
    } catch (err) {
      console.error('Erro ao criar atividade:', err);
      setError('Erro ao criar atividade. Tente novamente.');
    }
  };

  const handleEditAtividade = async () => {
    if (!editingAtividade) return;
    
    try {
      await OperacoesAtividadesService.updateAtividade(editingAtividade.id, atividadeForm);
      setAtividadeModalOpen(false);
      setEditingAtividade(null);
      setAtividadeForm({
        codigo: '',
        nome: '',
        descricao: '',
        operacaoId: '',
        contratoId: selectedContrato,
        ativo: true,
        ordem: 0
      });
      await loadAtividades();
    } catch (err) {
      console.error('Erro ao editar atividade:', err);
      setError('Erro ao editar atividade. Tente novamente.');
    }
  };

  const handleDeleteAtividade = async (id: string) => {
    if (!confirm('Tem certeza que deseja deletar esta atividade?')) return;
    
    try {
      await OperacoesAtividadesService.deleteAtividade(id);
      await loadAtividades();
    } catch (err) {
      console.error('Erro ao deletar atividade:', err);
      setError('Erro ao deletar atividade. Tente novamente.');
    }
  };

  // Handlers para setores
  const handleCreateSetor = async () => {
    try {
      await SetoresService.createSetor(setorForm);
      setSetorModalOpen(false);
      setSetorForm({
        codigo: '',
        nome: '',
        descricao: '',
        ativo: true,
        contratoId: selectedContrato,
        ordem: 0
      });
      await loadSetores();
    } catch (err) {
      console.error('Erro ao criar setor:', err);
      setError('Erro ao criar setor. Tente novamente.');
    }
  };

  const handleEditSetor = async () => {
    if (!editingSetor) return;
    
    try {
      await SetoresService.updateSetor(editingSetor.id, setorForm);
      setSetorModalOpen(false);
      setEditingSetor(null);
      setSetorForm({
        codigo: '',
        nome: '',
        descricao: '',
        ativo: true,
        contratoId: selectedContrato,
        ordem: 0
      });
      await loadSetores();
    } catch (err) {
      console.error('Erro ao editar setor:', err);
      setError('Erro ao editar setor. Tente novamente.');
    }
  };

  const handleDeleteSetor = async (id: string) => {
    if (!confirm('Tem certeza que deseja deletar este setor?')) return;
    
    try {
      await SetoresService.deleteSetor(id);
      await loadSetores();
    } catch (err) {
      console.error('Erro ao deletar setor:', err);
      setError('Erro ao deletar setor. Tente novamente.');
    }
  };

  // Handlers para relacionamento operação-setor
  const handleOpenOperacaoSetores = (operacao: OperacaoPadrao) => {
    setSelectedOperacaoParaSetores(operacao);
    const operacaoComSetores = operacoesComSetores.find(op => op.id === operacao.id);
    setSetoresSelecionados(operacaoComSetores?.setores.map(s => s.id) || []);
    setOperacaoSetoresModalOpen(true);
  };

  const handleSalvarSetoresOperacao = async () => {
    if (!selectedOperacaoParaSetores) return;
    
    try {
      await SetoresService.atualizarSetoresOperacao(selectedOperacaoParaSetores.id, setoresSelecionados);
      setOperacaoSetoresModalOpen(false);
      setSelectedOperacaoParaSetores(null);
      setSetoresSelecionados([]);
      await loadOperacoesComSetores();
    } catch (err) {
      console.error('Erro ao salvar setores da operação:', err);
      setError('Erro ao salvar setores da operação. Tente novamente.');
    }
  };

  // Abrir modal de edição
  const openEditOperacao = (operacao: OperacaoPadrao) => {
    setEditingOperacao(operacao);
    setOperacaoForm({
      codigo: operacao.codigo,
      nome: operacao.nome,
      descricao: operacao.descricao || '',
      contratoId: operacao.contratoId || selectedContrato,
      requerEncarregado: operacao.requerEncarregado || false,
      ativo: operacao.ativo,
      ordem: operacao.ordem
    });
    setOperacaoModalOpen(true);
  };

  const openEditAtividade = (atividade: AtividadePadrao) => {
    setEditingAtividade(atividade);
    setAtividadeForm({
      codigo: atividade.codigo,
      nome: atividade.nome,
      descricao: atividade.descricao || '',
      operacaoId: atividade.operacaoId || '',
      contratoId: atividade.contratoId || selectedContrato,
      ativo: atividade.ativo,
      ordem: atividade.ordem
    });
    setAtividadeModalOpen(true);
  };

  const openEditSetor = (setor: SetorPadrao) => {
    setEditingSetor(setor);
    setSetorForm({
      codigo: setor.codigo,
      nome: setor.nome,
      descricao: setor.descricao || '',
      ativo: setor.ativo,
      contratoId: setor.contratoId || selectedContrato,
      ordem: setor.ordem
    });
    setSetorModalOpen(true);
  };

  // Filtrar dados
  const filteredOperacoes = operacoes.filter(op => 
    op.nome.toLowerCase().includes(operacaoSearch.toLowerCase()) ||
    op.codigo.toLowerCase().includes(operacaoSearch.toLowerCase())
  );

  const filteredAtividades = atividades.filter(at => {
    const matchesSearch = at.nome.toLowerCase().includes(atividadeSearch.toLowerCase()) ||
                         at.codigo.toLowerCase().includes(atividadeSearch.toLowerCase());
    const matchesOperacao = selectedOperacaoFilter === 'all' || !selectedOperacaoFilter || at.operacaoId === selectedOperacaoFilter;
    return matchesSearch && matchesOperacao;
  });

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Operações e Atividades Padrão
        </h1>
        <p className="text-gray-600">
          Gerencie as operações e atividades padrão do sistema por contrato
        </p>
      </div>

      {/* Seletor de Contrato */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Selecionar Contrato</CardTitle>
          <CardDescription>
            As operações e atividades são específicas por contrato
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Select value={selectedContrato} onValueChange={setSelectedContrato}>
            <SelectTrigger className="w-full max-w-md">
              <SelectValue placeholder="Selecione um contrato" />
            </SelectTrigger>
            <SelectContent>
              {contratos.map((contrato) => (
                <SelectItem key={contrato.id} value={contrato.id}>
                  {contrato.nome} ({contrato.codigo})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <div className="text-red-800">{error}</div>
          <Button 
            onClick={() => {
              loadOperacoes();
              loadAtividades();
            }} 
            variant="outline" 
            size="sm" 
            className="mt-2"
          >
            Tentar novamente
          </Button>
        </div>
      )}

      <Tabs defaultValue="operacoes" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="operacoes">Operações</TabsTrigger>
          <TabsTrigger value="setores">Setores</TabsTrigger>
          <TabsTrigger value="atividades">Atividades</TabsTrigger>
        </TabsList>

        {/* Tab Operações */}
        <TabsContent value="operacoes" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Operações Padrão</CardTitle>
                  <CardDescription>
                    Gerencie as operações padrão do sistema (Técnica LM, Emergência, etc.)
                  </CardDescription>
                </div>
                <Dialog open={operacaoModalOpen} onOpenChange={setOperacaoModalOpen}>
                  <DialogTrigger asChild>
                    <Button 
                      onClick={() => {
                        setEditingOperacao(null);
                        setOperacaoForm({
                          codigo: '',
                          nome: '',
                          descricao: '',
                          contratoId: selectedContrato,
                          ativo: true,
                          ordem: 0
                        });
                      }}
                      disabled={!selectedContrato}
                    >
                      Nova Operação
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                      <DialogTitle>
                        {editingOperacao ? 'Editar Operação' : 'Nova Operação'}
                      </DialogTitle>
                      <DialogDescription>
                        {editingOperacao 
                          ? 'Edite os dados da operação' 
                          : 'Preencha os dados da nova operação'
                        }
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="codigo" className="text-right">
                          Código
                        </Label>
                        <Input
                          id="codigo"
                          value={operacaoForm.codigo}
                          onChange={(e) => setOperacaoForm(prev => ({ ...prev, codigo: e.target.value.toUpperCase() }))}
                          className="col-span-3"
                          placeholder="Ex: TEC_LM"
                        />
                      </div>
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="nome" className="text-right">
                          Nome
                        </Label>
                        <Input
                          id="nome"
                          value={operacaoForm.nome}
                          onChange={(e) => setOperacaoForm(prev => ({ ...prev, nome: e.target.value }))}
                          className="col-span-3"
                          placeholder="Ex: Técnica LM"
                        />
                      </div>
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="descricao" className="text-right">
                          Descrição
                        </Label>
                        <Textarea
                          id="descricao"
                          value={operacaoForm.descricao}
                          onChange={(e) => setOperacaoForm(prev => ({ ...prev, descricao: e.target.value }))}
                          className="col-span-3"
                          placeholder="Descrição da operação"
                        />
                      </div>
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="ordem" className="text-right">
                          Ordem
                        </Label>
                        <Input
                          id="ordem"
                          type="number"
                          value={operacaoForm.ordem}
                          onChange={(e) => setOperacaoForm(prev => ({ ...prev, ordem: parseInt(e.target.value) || 0 }))}
                          className="col-span-3"
                        />
                      </div>
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="requer_encarregado" className="text-right">
                          Requer Encarregado
                        </Label>
                        <Switch
                          id="requer_encarregado"
                          checked={operacaoForm.requerEncarregado || false}
                          onCheckedChange={(checked) => setOperacaoForm(prev => ({ ...prev, requerEncarregado: checked }))}
                        />
                      </div>
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="ativo" className="text-right">
                          Ativo
                        </Label>
                        <Switch
                          id="ativo"
                          checked={operacaoForm.ativo}
                          onCheckedChange={(checked) => setOperacaoForm(prev => ({ ...prev, ativo: checked }))}
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setOperacaoModalOpen(false)}>
                        Cancelar
                      </Button>
                      <Button onClick={editingOperacao ? handleEditOperacao : handleCreateOperacao}>
                        {editingOperacao ? 'Salvar' : 'Criar'}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              <div className="mb-4">
                <Input
                  placeholder="Buscar operações..."
                  value={operacaoSearch}
                  onChange={(e) => setOperacaoSearch(e.target.value)}
                  className="max-w-sm"
                />
              </div>
              
              {loading ? (
                <div className="text-center py-8">Carregando operações...</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Código</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Encarregado</TableHead>
                      <TableHead>Setores</TableHead>
                      <TableHead>Ordem</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredOperacoes.map((operacao) => (
                      <TableRow key={operacao.id}>
                        <TableCell className="font-mono">{operacao.codigo}</TableCell>
                        <TableCell className="font-medium">{operacao.nome}</TableCell>
                        <TableCell>{operacao.descricao || '-'}</TableCell>
                        <TableCell>
                          {operacao.requerEncarregado ? (
                            <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-300">
                              Sim
                            </Badge>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {operacoesComSetores.find(op => op.id === operacao.id)?.setores.map(setor => (
                              <Badge key={setor.id} variant="outline" className="text-xs">
                                {setor.codigo}
                              </Badge>
                            )) || <span className="text-gray-500 text-sm">Nenhum</span>}
                          </div>
                        </TableCell>
                        <TableCell>{operacao.ordem}</TableCell>
                        <TableCell>
                          <Badge variant={operacao.ativo ? "default" : "secondary"}>
                            {operacao.ativo ? 'Ativo' : 'Inativo'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openEditOperacao(operacao)}
                            >
                              Editar
                            </Button>
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => handleOpenOperacaoSetores(operacao)}
                            >
                              Setores
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleDeleteOperacao(operacao.id)}
                            >
                              Deletar
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab Setores */}
        <TabsContent value="setores" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Setores Padrão</CardTitle>
                  <CardDescription>
                    Gerencie os setores do sistema (OBRA, MANUT, EMERG, etc.)
                  </CardDescription>
                </div>
                <Dialog open={setorModalOpen} onOpenChange={setSetorModalOpen}>
                  <DialogTrigger asChild>
                    <Button onClick={() => {
                      setEditingSetor(null);
                      setSetorForm({
                        codigo: '',
                        nome: '',
                        descricao: '',
                        ativo: true,
                        contratoId: selectedContrato,
                        ordem: 0
                      });
                    }}>
                      Novo Setor
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                      <DialogTitle>
                        {editingSetor ? 'Editar Setor' : 'Novo Setor'}
                      </DialogTitle>
                      <DialogDescription>
                        {editingSetor ? 'Edite as informações do setor.' : 'Crie um novo setor padrão.'}
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="setor-codigo" className="text-right">
                          Código *
                        </Label>
                        <Input
                          id="setor-codigo"
                          value={setorForm.codigo}
                          onChange={(e) => setSetorForm({...setorForm, codigo: e.target.value})}
                          className="col-span-3"
                          placeholder="Ex: OBRA"
                        />
                      </div>
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="setor-nome" className="text-right">
                          Nome *
                        </Label>
                        <Input
                          id="setor-nome"
                          value={setorForm.nome}
                          onChange={(e) => setSetorForm({...setorForm, nome: e.target.value})}
                          className="col-span-3"
                          placeholder="Ex: Obra"
                        />
                      </div>
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="setor-descricao" className="text-right">
                          Descrição
                        </Label>
                        <Textarea
                          id="setor-descricao"
                          value={setorForm.descricao}
                          onChange={(e) => setSetorForm({...setorForm, descricao: e.target.value})}
                          className="col-span-3"
                          placeholder="Descrição do setor..."
                        />
                      </div>
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="setor-ordem" className="text-right">
                          Ordem
                        </Label>
                        <Input
                          id="setor-ordem"
                          type="number"
                          value={setorForm.ordem}
                          onChange={(e) => setSetorForm({...setorForm, ordem: parseInt(e.target.value) || 0})}
                          className="col-span-3"
                        />
                      </div>
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="setor-ativo" className="text-right">
                          Ativo
                        </Label>
                        <Switch
                          id="setor-ativo"
                          checked={setorForm.ativo}
                          onCheckedChange={(checked) => setSetorForm({...setorForm, ativo: checked})}
                          className="col-span-3"
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setSetorModalOpen(false)}>
                        Cancelar
                      </Button>
                      <Button onClick={editingSetor ? handleEditSetor : handleCreateSetor}>
                        {editingSetor ? 'Salvar' : 'Criar'}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center py-8">
                  <div className="text-gray-500">Carregando setores...</div>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Código</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Ordem</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {setores.map((setor) => (
                      <TableRow key={setor.id}>
                        <TableCell className="font-mono">{setor.codigo}</TableCell>
                        <TableCell className="font-medium">{setor.nome}</TableCell>
                        <TableCell>{setor.descricao || '-'}</TableCell>
                        <TableCell>{setor.ordem}</TableCell>
                        <TableCell>
                          <Badge variant={setor.ativo ? "default" : "secondary"}>
                            {setor.ativo ? 'Ativo' : 'Inativo'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openEditSetor(setor)}
                            >
                              Editar
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleDeleteSetor(setor.id)}
                            >
                              Deletar
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab Atividades */}
        <TabsContent value="atividades" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Atividades Padrão</CardTitle>
                  <CardDescription>
                    Gerencie as atividades padrão do sistema (Obra, Manutenção, PDOA, etc.)
                  </CardDescription>
                </div>
                <Dialog open={atividadeModalOpen} onOpenChange={setAtividadeModalOpen}>
                  <DialogTrigger asChild>
                    <Button 
                      onClick={() => {
                        setEditingAtividade(null);
                        setAtividadeForm({
                          codigo: '',
                          nome: '',
                          descricao: '',
                          operacaoId: '',
                          contratoId: selectedContrato,
                          ativo: true,
                          ordem: 0
                        });
                      }}
                      disabled={!selectedContrato}
                    >
                      Nova Atividade
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                      <DialogTitle>
                        {editingAtividade ? 'Editar Atividade' : 'Nova Atividade'}
                      </DialogTitle>
                      <DialogDescription>
                        {editingAtividade 
                          ? 'Edite os dados da atividade' 
                          : 'Preencha os dados da nova atividade'
                        }
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="atividade-codigo" className="text-right">
                          Código
                        </Label>
                        <Input
                          id="atividade-codigo"
                          value={atividadeForm.codigo}
                          onChange={(e) => setAtividadeForm(prev => ({ ...prev, codigo: e.target.value.toUpperCase() }))}
                          className="col-span-3"
                          placeholder="Ex: OBRA"
                        />
                      </div>
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="atividade-nome" className="text-right">
                          Nome
                        </Label>
                        <Input
                          id="atividade-nome"
                          value={atividadeForm.nome}
                          onChange={(e) => setAtividadeForm(prev => ({ ...prev, nome: e.target.value }))}
                          className="col-span-3"
                          placeholder="Ex: Obra"
                        />
                      </div>
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="atividade-operacao" className="text-right">
                          Operação
                        </Label>
                        <Select
                          value={atividadeForm.operacaoId}
                          onValueChange={(value) => setAtividadeForm(prev => ({ ...prev, operacaoId: value }))}
                        >
                          <SelectTrigger className="col-span-3">
                            <SelectValue placeholder="Selecione uma operação" />
                          </SelectTrigger>
                          <SelectContent>
                            {operacoes.map((operacao) => (
                              <SelectItem key={operacao.id} value={operacao.id}>
                                {operacao.nome} ({operacao.codigo})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="atividade-descricao" className="text-right">
                          Descrição
                        </Label>
                        <Textarea
                          id="atividade-descricao"
                          value={atividadeForm.descricao}
                          onChange={(e) => setAtividadeForm(prev => ({ ...prev, descricao: e.target.value }))}
                          className="col-span-3"
                          placeholder="Descrição da atividade"
                        />
                      </div>
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="atividade-ordem" className="text-right">
                          Ordem
                        </Label>
                        <Input
                          id="atividade-ordem"
                          type="number"
                          value={atividadeForm.ordem}
                          onChange={(e) => setAtividadeForm(prev => ({ ...prev, ordem: parseInt(e.target.value) || 0 }))}
                          className="col-span-3"
                        />
                      </div>
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="atividade-ativo" className="text-right">
                          Ativo
                        </Label>
                        <Switch
                          id="atividade-ativo"
                          checked={atividadeForm.ativo}
                          onCheckedChange={(checked) => setAtividadeForm(prev => ({ ...prev, ativo: checked }))}
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setAtividadeModalOpen(false)}>
                        Cancelar
                      </Button>
                      <Button onClick={editingAtividade ? handleEditAtividade : handleCreateAtividade}>
                        {editingAtividade ? 'Salvar' : 'Criar'}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              <div className="mb-4 flex gap-4">
                <Input
                  placeholder="Buscar atividades..."
                  value={atividadeSearch}
                  onChange={(e) => setAtividadeSearch(e.target.value)}
                  className="max-w-sm"
                />
                <Select value={selectedOperacaoFilter} onValueChange={setSelectedOperacaoFilter}>
                  <SelectTrigger className="w-64">
                    <SelectValue placeholder="Filtrar por operação" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as operações</SelectItem>
                    {operacoes.map((operacao) => (
                      <SelectItem key={operacao.id} value={operacao.id}>
                        {operacao.nome} ({operacao.codigo})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Operação</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Ordem</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAtividades.map((atividade) => (
                    <TableRow key={atividade.id}>
                      <TableCell className="font-mono">{atividade.codigo}</TableCell>
                      <TableCell className="font-medium">{atividade.nome}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {atividade.operacaoNome}
                        </Badge>
                      </TableCell>
                      <TableCell>{atividade.descricao || '-'}</TableCell>
                      <TableCell>{atividade.ordem}</TableCell>
                      <TableCell>
                        <Badge variant={atividade.ativo ? "default" : "secondary"}>
                          {atividade.ativo ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEditAtividade(atividade)}
                          >
                            Editar
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDeleteAtividade(atividade.id)}
                          >
                            Deletar
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Modal para gerenciar setores de uma operação */}
      <Dialog open={operacaoSetoresModalOpen} onOpenChange={setOperacaoSetoresModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              Gerenciar Setores - {selectedOperacaoParaSetores?.nome}
            </DialogTitle>
            <DialogDescription>
              Selecione os setores disponíveis para esta operação.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="space-y-3">
              {setores.map((setor) => (
                <div key={setor.id} className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id={`setor-${setor.id}`}
                    checked={setoresSelecionados.includes(setor.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSetoresSelecionados([...setoresSelecionados, setor.id]);
                      } else {
                        setSetoresSelecionados(setoresSelecionados.filter(id => id !== setor.id));
                      }
                    }}
                    className="rounded border-gray-300"
                  />
                  <label htmlFor={`setor-${setor.id}`} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded mr-2">{setor.codigo}</span>
                    {setor.nome}
                  </label>
                </div>
              ))}
              {setores.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  Nenhum setor encontrado. Crie setores primeiro.
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOperacaoSetoresModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSalvarSetoresOperacao}>
              Salvar Setores
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

