'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import {
  Package, Search, Loader2, CheckCircle, Truck, Users,
  Calendar, AlertTriangle, Eye, ClipboardList, User
} from 'lucide-react';
import { EntregaMaterialObraService } from '@/services/entregaMaterialObraService';
import { ProgramacaoComFluxo } from '@/types/entrega-material-obra';
import { useAuth } from '@/contexts/AuthContext';

const CONTRATO_GOIAS = '03413132-fba2-459e-911f-478b9af69d21';

interface Base {
  id: string;
  nome: string;
  codigo: string;
}

type StatusEntregaFilter = 'todas' | 'pendente' | 'entregue';

export default function EntregasObraPage() {
  useAuth();
  const [programacoes, setProgramacoes] = useState<ProgramacaoComFluxo[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [bases, setBases] = useState<Base[]>([]);
  const [selectedBase, setSelectedBase] = useState<string>('');
  const [loadingBases, setLoadingBases] = useState(true); // eslint-disable-line @typescript-eslint/no-unused-vars
  const [statusFilter, setStatusFilter] = useState<StatusEntregaFilter>('pendente');

  // Modal de entrega
  const [showEntregaModal, setShowEntregaModal] = useState(false);
  const [progSelecionada, setProgSelecionada] = useState<ProgramacaoComFluxo | null>(null);
  const [entregaItens, setEntregaItens] = useState<Array<{
    materialId?: string | null;
    descricao: string;
    numeroMaterial?: string;
    unidade: string;
    quantidade: number;
    quantidadeOriginal: number;
    selecionado: boolean;
  }>>([]);
  const [entregaObs, setEntregaObs] = useState('');
  const [saving, setSaving] = useState(false);

  // Funcionário recebedor
  const [buscaFunc, setBuscaFunc] = useState('');
  const [funcSelecionado, setFuncSelecionado] = useState<{ id: string; nome: string } | null>(null);
  const [funcionarios, setFuncionarios] = useState<Array<{ id: string; nome: string; matricula?: string }>>([]);
  const [loadingFunc, setLoadingFunc] = useState(false);

  // Modal de detalhes
  const [showDetalhesModal, setShowDetalhesModal] = useState(false);
  const [detalhesEntregas, setDetalhesEntregas] = useState<any[]>([]); // eslint-disable-line @typescript-eslint/no-explicit-any
  const [loadingDetalhes, setLoadingDetalhes] = useState(false);

  // Carregar bases
  useEffect(() => {
    const loadBases = async () => {
      try {
        const { data, error } = await supabase
          .from('bases')
          .select('id, nome, codigo')
          .eq('contrato_id', CONTRATO_GOIAS)
          .eq('ativa', true)
          .order('nome');
        if (error) throw error;
        setBases(data || []);
        if (data?.length) setSelectedBase(data[0].id);
      } catch (err) {
        console.error('Erro ao carregar bases:', err);
      } finally {
        setLoadingBases(false);
      }
    };
    loadBases();
  }, []);

  // Carregar programações pendentes
  const loadProgramacoes = useCallback(async () => {
    setLoading(true);
    try {
      const data = await EntregaMaterialObraService.getProgramacoesPendentes();
      setProgramacoes(data);
    } catch (err) {
      console.error('Erro ao carregar programações:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProgramacoes();
  }, [loadProgramacoes]);

  // Contagens por status
  const countPendente = programacoes.filter(p => (p.entregasRealizadas ?? 0) === 0).length;
  const countEntregue = programacoes.filter(p => (p.entregasRealizadas ?? 0) > 0).length;

  // Filtrar programações
  const filtered = programacoes.filter(p => {
    // Filtro por status de entrega
    if (statusFilter === 'pendente' && (p.entregasRealizadas ?? 0) > 0) return false;
    if (statusFilter === 'entregue' && (p.entregasRealizadas ?? 0) === 0) return false;

    if (search) {
      const s = search.toLowerCase();
      const match =
        p.obra?.numeroProjeto?.toLowerCase().includes(s) ||
        p.obra?.enderecoObra?.toLowerCase().includes(s) ||
        p.equipe?.nome?.toLowerCase().includes(s) ||
        p.etapa?.toLowerCase().includes(s);
      if (!match) return false;
    }
    return true;
  });

  // Carregar funcionários
  const loadFuncionarios = async () => {
    if (funcionarios.length > 0) return;
    setLoadingFunc(true);
    try {
      const { data, error } = await supabase
        .from('usuarios')
        .select('id, nome, matricula')
        .eq('status', 'ativo')
        .order('nome');
      if (error) throw error;
      setFuncionarios(data || []);
    } catch (err) {
      console.error('Erro ao carregar funcionários:', err);
    } finally {
      setLoadingFunc(false);
    }
  };

  // Abrir modal de entrega
  const handleAbrirEntrega = (prog: ProgramacaoComFluxo) => {
    setProgSelecionada(prog);
    setEntregaItens((prog.materiaisFluxo || []).map(m => ({
      materialId: m.materialId,
      descricao: m.descricao,
      numeroMaterial: m.numeroMaterial,
      unidade: m.unidade,
      quantidade: m.quantidade,
      quantidadeOriginal: m.quantidade,
      selecionado: true,
    })));
    setEntregaObs('');
    setBuscaFunc('');
    setFuncSelecionado(null);
    setShowEntregaModal(true);
    loadFuncionarios();
  };

  // Salvar entrega
  const handleSalvarEntrega = async () => {
    if (!progSelecionada || !selectedBase) return;

    const itensSelecionados = entregaItens.filter(i => i.selecionado && i.quantidade > 0);
    if (itensSelecionados.length === 0) {
      alert('Selecione pelo menos um material para entregar.');
      return;
    }

    // Buscar userId
    let userId = '';
    try {
      const { data: authData } = await supabase.auth.getUser();
      if (authData.user) {
        const { data: userData } = await supabase
          .from('usuarios')
          .select('id')
          .eq('email', authData.user.email)
          .single();
        userId = userData?.id || '';
      }
    } catch {}

    setSaving(true);
    try {
      await EntregaMaterialObraService.registrarEntrega({
        obraId: progSelecionada.obraId,
        programacaoId: progSelecionada.id,
        equipeId: progSelecionada.equipeId,
        baseId: selectedBase,
        entreguePor: userId,
        recebidoPor: funcSelecionado?.id,
        recebidoPorNome: funcSelecionado?.nome,
        itens: itensSelecionados.map(i => ({
          materialId: i.materialId,
          descricao: i.descricao,
          numeroMaterial: i.numeroMaterial,
          unidade: i.unidade,
          quantidade: i.quantidade,
        })),
        observacoes: entregaObs || undefined,
      });

      setShowEntregaModal(false);
      loadProgramacoes();
      alert('Entrega registrada com sucesso! Aguardando aceite do encarregado.');
    } catch (err) {
      console.error('Erro ao registrar entrega:', err);
      alert('Erro ao registrar entrega.');
    } finally {
      setSaving(false);
    }
  };

  // Ver detalhes de entregas já feitas
  const handleVerDetalhes = async (prog: ProgramacaoComFluxo) => {
    setProgSelecionada(prog);
    setLoadingDetalhes(true);
    setShowDetalhesModal(true);
    try {
      const entregas = await EntregaMaterialObraService.getByProgramacao(prog.id);
      setDetalhesEntregas(entregas);
    } catch (err) {
      console.error('Erro ao carregar detalhes:', err);
    } finally {
      setLoadingDetalhes(false);
    }
  };

  const statusBadge = (status: string) => {
    const map: Record<string, { label: string; cls: string }> = {
      pendente: { label: 'Pendente', cls: 'bg-yellow-100 text-yellow-800' },
      entregue: { label: 'Entregue', cls: 'bg-blue-100 text-blue-800' },
      aceito: { label: 'Aceito', cls: 'bg-green-100 text-green-800' },
      recusado: { label: 'Recusado', cls: 'bg-red-100 text-red-800' },
      cancelado: { label: 'Cancelado', cls: 'bg-gray-100 text-gray-800' },
    };
    const s = map[status] || { label: status, cls: 'bg-gray-100 text-gray-800' };
    return <Badge className={s.cls}>{s.label}</Badge>;
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Truck className="h-7 w-7 text-blue-600" />
            Entregas de Material — Obra
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Programações com fluxo definido — entrega de materiais
          </p>
        </div>
      </div>

      {/* Cards de status */}
      <div className="grid grid-cols-3 gap-4">
        <Card
          onClick={() => setStatusFilter('pendente')}
          className={`hover:shadow-md transition-shadow cursor-pointer ${
            statusFilter === 'pendente' ? 'ring-2 ring-amber-400' : ''
          }`}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-gray-500 uppercase">Pendentes</CardTitle>
            <div className="text-2xl font-bold text-amber-600">{countPendente}</div>
          </CardHeader>
        </Card>
        <Card
          onClick={() => setStatusFilter('entregue')}
          className={`hover:shadow-md transition-shadow cursor-pointer ${
            statusFilter === 'entregue' ? 'ring-2 ring-green-400' : ''
          }`}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-gray-500 uppercase">Entregues</CardTitle>
            <div className="text-2xl font-bold text-green-600">{countEntregue}</div>
          </CardHeader>
        </Card>
        <Card
          onClick={() => setStatusFilter('todas')}
          className={`hover:shadow-md transition-shadow cursor-pointer ${
            statusFilter === 'todas' ? 'ring-2 ring-blue-400' : ''
          }`}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-gray-500 uppercase">Total</CardTitle>
            <div className="text-2xl font-bold text-blue-600">{programacoes.length}</div>
          </CardHeader>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex gap-4 items-end flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <Label className="text-xs mb-1 block">Buscar</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Obra, equipe, endereço..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="w-48">
              <Label className="text-xs mb-1 block">Base de Saída</Label>
              <Select value={selectedBase} onValueChange={setSelectedBase}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar base" />
                </SelectTrigger>
                <SelectContent>
                  {bases.map(b => (
                    <SelectItem key={b.id} value={b.id}>{b.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista de programações */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-blue-600" />
            {statusFilter === 'pendente' ? 'Pendentes de Entrega' : statusFilter === 'entregue' ? 'Entregas Realizadas' : 'Todas as Programações'}
            <Badge variant="outline" className="ml-2">{filtered.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto" />
              <p className="text-gray-500 mt-2">Carregando...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12">
              <Package className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">Nenhuma programação com fluxo definido encontrada</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Obra</TableHead>
                    <TableHead>Equipe</TableHead>
                    <TableHead>Etapa</TableHead>
                    <TableHead className="text-center">Materiais</TableHead>
                    <TableHead className="text-center">Entregas</TableHead>
                    <TableHead className="text-center">Status Exec.</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((prog) => {
                    const totalMat = prog.materiaisFluxo?.length || 0;
                    const entregasFeitas = prog.entregasRealizadas || 0;
                    return (
                      <TableRow key={prog.id} className="hover:bg-blue-50/50">
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-1.5">
                            <Calendar className="h-3.5 w-3.5 text-gray-400" />
                            {new Date(prog.data + 'T12:00:00').toLocaleDateString('pt-BR')}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <span className="font-semibold text-blue-700">{prog.obra?.numeroProjeto}</span>
                            {prog.obra?.enderecoObra && (
                              <div className="text-xs text-gray-500 truncate max-w-[200px]">{prog.obra.enderecoObra}</div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <Users className="h-3.5 w-3.5 text-gray-400" />
                            {prog.equipe?.nome || '-'}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="font-semibold">
                            {prog.etapa || 'FINAL'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge className="bg-blue-100 text-blue-800">{totalMat}</Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          {entregasFeitas > 0 ? (
                            <Badge className="bg-green-100 text-green-800">{entregasFeitas}</Badge>
                          ) : (
                            <Badge className="bg-gray-100 text-gray-500">0</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge className={
                            prog.statusExecucao === 'EXEC' ? 'bg-green-100 text-green-800' :
                            prog.statusExecucao === 'CANC' ? 'bg-red-100 text-red-800' :
                            'bg-blue-100 text-blue-800'
                          }>
                            {prog.statusExecucao || 'PROG'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-1.5 justify-end">
                            {entregasFeitas > 0 && (
                              <Button variant="outline" size="sm" onClick={() => handleVerDetalhes(prog)} className="text-xs">
                                <Eye className="h-3.5 w-3.5 mr-1" /> Detalhes
                              </Button>
                            )}
                            {entregasFeitas === 0 ? (
                              <Button size="sm" onClick={() => handleAbrirEntrega(prog)} className="bg-green-600 hover:bg-green-700 text-white text-xs">
                                <Truck className="h-3.5 w-3.5 mr-1" /> Entregar
                              </Button>
                            ) : (
                              <Badge className="bg-green-100 text-green-700 border-0 text-xs px-2 py-1">
                                <CheckCircle className="h-3 w-3 mr-1" /> Entregue
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ===== MODAL DE ENTREGA ===== */}
      <Dialog open={showEntregaModal} onOpenChange={setShowEntregaModal}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5 text-green-600" />
              Registrar Entrega de Materiais
            </DialogTitle>
            <DialogDescription>
              {progSelecionada?.obra?.numeroProjeto} — Equipe {progSelecionada?.equipe?.nome} — Etapa {progSelecionada?.etapa || 'FINAL'}
            </DialogDescription>
          </DialogHeader>

          {/* Info da programação */}
          <div className="grid grid-cols-3 gap-3 text-sm">
            <div className="bg-blue-50 rounded-lg p-2.5">
              <div className="text-xs text-blue-600 font-medium">Obra</div>
              <div className="font-semibold">{progSelecionada?.obra?.numeroProjeto}</div>
              <div className="text-xs text-gray-500 truncate">{progSelecionada?.obra?.enderecoObra}</div>
            </div>
            <div className="bg-orange-50 rounded-lg p-2.5">
              <div className="text-xs text-orange-600 font-medium">Equipe</div>
              <div className="font-semibold">{progSelecionada?.equipe?.nome}</div>
            </div>
            <div className="bg-green-50 rounded-lg p-2.5">
              <div className="text-xs text-green-600 font-medium">Base de Saída</div>
              <div className="font-semibold">{bases.find(b => b.id === selectedBase)?.nome || '-'}</div>
            </div>
          </div>

          {!selectedBase && (
            <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-sm text-amber-800">
              <AlertTriangle className="h-4 w-4" />
              Selecione uma base de saída nos filtros antes de registrar a entrega.
            </div>
          )}

          {/* Funcionário Recebedor */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium flex items-center gap-1">
              <User className="h-3 w-3" /> Funcionário Recebedor
            </Label>
            <div className="relative">
              <Input
                placeholder="Buscar funcionário pelo nome..."
                value={buscaFunc}
                onChange={e => { setBuscaFunc(e.target.value); setFuncSelecionado(null); }}
                className="h-9 text-sm"
              />
              {buscaFunc.trim() && !funcSelecionado && (
                <div className="absolute z-20 w-full mt-1 max-h-40 overflow-y-auto border border-gray-200 rounded-md bg-white shadow-lg">
                  {loadingFunc ? (
                    <div className="p-3 text-center text-sm text-gray-500">
                      <Loader2 className="h-4 w-4 animate-spin inline mr-1" /> Carregando...
                    </div>
                  ) : (
                    funcionarios
                      .filter(f => f.nome.toLowerCase().includes(buscaFunc.toLowerCase()))
                      .slice(0, 10)
                      .map(f => (
                        <button
                          key={f.id}
                          onClick={() => { setFuncSelecionado({ id: f.id, nome: f.nome }); setBuscaFunc(f.nome); }}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 border-b border-gray-100 last:border-0 transition-colors"
                        >
                          <span className="font-medium">{f.nome}</span>
                          {f.matricula && <span className="text-gray-400 ml-2 text-xs">Mat: {f.matricula}</span>}
                        </button>
                      ))
                  )}
                  {!loadingFunc && funcionarios.filter(f => f.nome.toLowerCase().includes(buscaFunc.toLowerCase())).length === 0 && (
                    <p className="px-3 py-2 text-xs text-gray-400">Nenhum funcionário encontrado</p>
                  )}
                </div>
              )}
            </div>
            {funcSelecionado && (
              <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-md p-2">
                <User className="h-3.5 w-3.5 text-blue-600" />
                <span className="text-xs font-medium text-blue-800">{funcSelecionado.nome}</span>
              </div>
            )}
          </div>

          {/* Tabela de materiais */}
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead className="w-10">
                    <input
                      type="checkbox"
                      checked={entregaItens.every(i => i.selecionado)}
                      onChange={(e) => setEntregaItens(prev => prev.map(i => ({ ...i, selecionado: e.target.checked })))}
                      className="w-4 h-4"
                    />
                  </TableHead>
                  <TableHead>Material</TableHead>
                  <TableHead>Código</TableHead>
                  <TableHead>Unid.</TableHead>
                  <TableHead className="text-right">Solicitado</TableHead>
                  <TableHead className="text-right">Entregar</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entregaItens.map((item, idx) => (
                  <TableRow key={idx} className={item.selecionado ? '' : 'opacity-40'}>
                    <TableCell>
                      <input
                        type="checkbox"
                        checked={item.selecionado}
                        onChange={(e) => {
                          const copy = [...entregaItens];
                          copy[idx].selecionado = e.target.checked;
                          setEntregaItens(copy);
                        }}
                        className="w-4 h-4"
                      />
                    </TableCell>
                    <TableCell className="font-medium text-sm max-w-[250px] truncate">{item.descricao}</TableCell>
                    <TableCell className="text-xs text-gray-500">{item.numeroMaterial || '-'}</TableCell>
                    <TableCell className="text-xs">{item.unidade}</TableCell>
                    <TableCell className="text-right font-medium">{item.quantidadeOriginal}</TableCell>
                    <TableCell className="text-right">
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={item.quantidade}
                        onChange={(e) => {
                          const copy = [...entregaItens];
                          copy[idx].quantidade = parseFloat(e.target.value) || 0;
                          setEntregaItens(copy);
                        }}
                        disabled={!item.selecionado}
                        className="w-24 h-8 text-right text-sm ml-auto"
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Observações */}
          <div className="space-y-1">
            <Label className="text-xs">Observações</Label>
            <Textarea
              value={entregaObs}
              onChange={(e) => setEntregaObs(e.target.value)}
              placeholder="Observações sobre a entrega..."
              rows={2}
              className="text-sm"
            />
          </div>

          {/* Ações */}
          <div className="flex gap-3 justify-end pt-2 border-t">
            <Button variant="outline" onClick={() => setShowEntregaModal(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button
              onClick={handleSalvarEntrega}
              disabled={saving || !selectedBase}
              className="bg-green-600 hover:bg-green-700"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <CheckCircle className="h-4 w-4 mr-2" />
              )}
              Confirmar Entrega
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ===== MODAL DE DETALHES ===== */}
      <Dialog open={showDetalhesModal} onOpenChange={setShowDetalhesModal}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5 text-blue-600" />
              Entregas Realizadas
            </DialogTitle>
            <DialogDescription>
              {progSelecionada?.obra?.numeroProjeto} — Equipe {progSelecionada?.equipe?.nome}
            </DialogDescription>
          </DialogHeader>

          {loadingDetalhes ? (
            <div className="text-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-blue-600 mx-auto" />
            </div>
          ) : detalhesEntregas.length === 0 ? (
            <p className="text-center text-gray-500 py-8">Nenhuma entrega registrada.</p>
          ) : (
            <div className="space-y-2">
              {detalhesEntregas.map((e: any) => ( // eslint-disable-line @typescript-eslint/no-explicit-any
                <div key={e.id} className="border rounded-lg p-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="text-sm">
                      <span className="font-semibold">{e.descricao}</span>
                      {e.numeroMaterial && <span className="text-gray-500 ml-2">({e.numeroMaterial})</span>}
                    </div>
                    {statusBadge(e.status)}
                  </div>
                  <div className="flex gap-4 text-xs text-gray-500">
                    <span>Qtd: <strong>{e.quantidade}</strong> {e.unidade}</span>
                    <span>Data: {new Date(e.dataEntrega + 'T12:00:00').toLocaleDateString('pt-BR')}</span>
                    {e.base && <span>Base: {e.base.nome}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
