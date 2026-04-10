'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import {
  Package, Search, Loader2, Plus, Building2, AlertTriangle,
  ArrowUpCircle, History, TrendingUp, TrendingDown, Hash
} from 'lucide-react';
import {
  EstoqueMaterialBaseService,
  EstoqueMaterialBaseComDetalhes,
  MovimentacaoMaterialBase,
} from '@/services/estoqueMaterialBaseService';
import { MateriaisService } from '@/services/materiaisService';
import { Material } from '@/types/materiais';
import { useAuth } from '@/contexts/AuthContext';

const CONTRATO_GOIAS = '03413132-fba2-459e-911f-478b9af69d21';

interface Base {
  id: string;
  nome: string;
  codigo: string;
}

export default function EstoqueMateriaisPage() {
  const { user } = useAuth();

  // Bases
  const [bases, setBases] = useState<Base[]>([]);
  const [selectedBase, setSelectedBase] = useState('');
  const [loadingBases, setLoadingBases] = useState(true);

  // Estoque
  const [estoque, setEstoque] = useState<EstoqueMaterialBaseComDetalhes[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  // Modal de entrada
  const [showEntradaModal, setShowEntradaModal] = useState(false);
  const [buscaMat, setBuscaMat] = useState('');
  const [matSelecionado, setMatSelecionado] = useState<Material | null>(null);
  const [entradaQtd, setEntradaQtd] = useState('');
  const [entradaMotivo, setEntradaMotivo] = useState('');
  const [listaMat, setListaMat] = useState<Material[]>([]);
  const [loadingMat, setLoadingMat] = useState(false);
  const [savingEntrada, setSavingEntrada] = useState(false);

  // Modal de histórico
  const [showHistModal, setShowHistModal] = useState(false);
  const [histItem, setHistItem] = useState<EstoqueMaterialBaseComDetalhes | null>(null);
  const [movimentacoes, setMovimentacoes] = useState<MovimentacaoMaterialBase[]>([]);
  const [loadingMov, setLoadingMov] = useState(false);

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

  // Carregar estoque quando base muda
  const loadEstoque = useCallback(async () => {
    if (!selectedBase) return;
    setLoading(true);
    try {
      const data = await EstoqueMaterialBaseService.getByBase(selectedBase);
      setEstoque(data);
    } catch (err) {
      console.error('Erro ao carregar estoque:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedBase]);

  useEffect(() => {
    if (selectedBase) loadEstoque();
  }, [selectedBase, loadEstoque]);

  // Carregar materiais para o searchbox da modal de entrada
  const loadMateriais = useCallback(async () => {
    if (listaMat.length > 0) return;
    setLoadingMat(true);
    try {
      const data = await MateriaisService.getAll();
      setListaMat(data);
    } catch (err) {
      console.error('Erro ao carregar materiais:', err);
    } finally {
      setLoadingMat(false);
    }
  }, [listaMat.length]);

  // Filtro de busca
  const estoqueFiltrado = estoque.filter(item => {
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    return (
      item.material?.descricaoMaterial?.toLowerCase().includes(s) ||
      item.material?.numeroMaterial?.toLowerCase().includes(s)
    );
  });

  // Estatísticas
  const totalItens = estoque.length;
  const totalBaixoEstoque = estoque.filter(i => i.quantidade <= i.quantidadeMinima && i.quantidadeMinima > 0).length;
  const totalZerado = estoque.filter(i => i.quantidade === 0).length;

  // Abrir modal de entrada
  const handleAbrirEntrada = () => {
    setBuscaMat('');
    setMatSelecionado(null);
    setEntradaQtd('');
    setEntradaMotivo('');
    setShowEntradaModal(true);
    loadMateriais();
  };

  // Salvar entrada
  const handleSalvarEntrada = async () => {
    if (!matSelecionado?.id || !selectedBase || !entradaQtd) return;
    const qtd = parseFloat(entradaQtd);
    if (isNaN(qtd) || qtd <= 0) return;

    setSavingEntrada(true);
    try {
      await EstoqueMaterialBaseService.darEntrada({
        baseId: selectedBase,
        materialId: matSelecionado.id,
        quantidade: qtd,
        motivo: entradaMotivo.trim() || undefined,
        usuarioId: user?.id,
        usuarioNome: user?.nome,
      });
      setShowEntradaModal(false);
      loadEstoque();
    } catch (err) {
      alert(`Erro ao dar entrada: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSavingEntrada(false);
    }
  };

  // Abrir histórico
  const handleAbrirHistorico = async (item: EstoqueMaterialBaseComDetalhes) => {
    if (!item.id) return;
    setHistItem(item);
    setShowHistModal(true);
    setLoadingMov(true);
    try {
      const data = await EstoqueMaterialBaseService.getMovimentacoes(item.id);
      setMovimentacoes(data);
    } catch (err) {
      console.error('Erro ao carregar movimentações:', err);
    } finally {
      setLoadingMov(false);
    }
  };

  // Resultados do searchbox
  const matFiltrados = buscaMat.trim()
    ? listaMat
        .filter(m =>
          m.descricaoMaterial.toLowerCase().includes(buscaMat.toLowerCase()) ||
          m.numeroMaterial?.toLowerCase().includes(buscaMat.toLowerCase())
        )
        .slice(0, 15)
    : [];

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Package className="h-6 w-6 text-blue-600" />
            Estoque de Materiais
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Controle de estoque de materiais por base
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Seletor de Base */}
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-gray-500" />
            {loadingBases ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Select value={selectedBase} onValueChange={setSelectedBase}>
                <SelectTrigger className="w-[200px] h-9 text-sm">
                  <SelectValue placeholder="Selecione a base" />
                </SelectTrigger>
                <SelectContent>
                  {bases.map(b => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <Button onClick={handleAbrirEntrada} disabled={!selectedBase} className="bg-green-600 hover:bg-green-700 text-white h-9">
            <Plus className="h-4 w-4 mr-1" />
            Dar Entrada
          </Button>
        </div>
      </div>

      {/* Cards de estatísticas */}
      {selectedBase && !loading && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100">
                <Package className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Total de Itens</p>
                <p className="text-xl font-bold text-gray-900">{totalItens}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-100">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Abaixo do Mínimo</p>
                <p className="text-xl font-bold text-amber-600">{totalBaixoEstoque}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-100">
                <TrendingDown className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Estoque Zerado</p>
                <p className="text-xl font-bold text-red-600">{totalZerado}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Busca */}
      {selectedBase && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Buscar por descrição ou número do material..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-10"
          />
        </div>
      )}

      {/* Tabela de estoque */}
      {!selectedBase ? (
        <Card>
          <CardContent className="p-12 text-center text-gray-500">
            <Building2 className="h-12 w-12 mx-auto mb-3 text-gray-300" />
            <p className="font-medium">Selecione uma base</p>
            <p className="text-sm">Escolha uma base para visualizar o estoque de materiais.</p>
          </CardContent>
        </Card>
      ) : loading ? (
        <Card>
          <CardContent className="p-12 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-blue-600 mr-2" />
            <span className="text-gray-600">Carregando estoque...</span>
          </CardContent>
        </Card>
      ) : estoqueFiltrado.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center text-gray-500">
            <Package className="h-12 w-12 mx-auto mb-3 text-gray-300" />
            <p className="font-medium">Nenhum material encontrado</p>
            <p className="text-sm">{search ? 'Tente outra busca.' : 'Clique em "Dar Entrada" para adicionar materiais.'}</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center justify-between">
              <span>Materiais em Estoque ({estoqueFiltrado.length})</span>
              <span className="text-xs font-normal text-gray-500">
                Base: {bases.find(b => b.id === selectedBase)?.nome}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Material</TableHead>
                  <TableHead className="w-24">Nº Material</TableHead>
                  <TableHead className="w-16 text-center">UN</TableHead>
                  <TableHead className="w-28 text-right">Quantidade</TableHead>
                  <TableHead className="w-28 text-right">Mínimo</TableHead>
                  <TableHead className="w-24 text-center">Status</TableHead>
                  <TableHead className="w-20 text-center">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {estoqueFiltrado.map(item => {
                  const baixo = item.quantidadeMinima > 0 && item.quantidade <= item.quantidadeMinima;
                  const zerado = item.quantidade === 0;
                  return (
                    <TableRow key={item.id} className={zerado ? 'bg-red-50' : baixo ? 'bg-amber-50' : ''}>
                      <TableCell>
                        <div className="font-medium text-sm">{item.material?.descricaoMaterial || '—'}</div>
                      </TableCell>
                      <TableCell className="text-sm text-gray-600">
                        {item.material?.numeroMaterial || '—'}
                      </TableCell>
                      <TableCell className="text-center text-sm text-gray-600">
                        {item.material?.unidadeMedida || 'UN'}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={`font-semibold text-sm ${zerado ? 'text-red-600' : baixo ? 'text-amber-600' : 'text-gray-900'}`}>
                          {item.quantidade.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 4 })}
                        </span>
                      </TableCell>
                      <TableCell className="text-right text-sm text-gray-500">
                        {item.quantidadeMinima > 0 ? item.quantidadeMinima.toLocaleString('pt-BR') : '—'}
                      </TableCell>
                      <TableCell className="text-center">
                        {zerado ? (
                          <Badge variant="destructive" className="text-[10px] px-1.5 py-0">Zerado</Badge>
                        ) : baixo ? (
                          <Badge className="bg-amber-100 text-amber-700 border-0 text-[10px] px-1.5 py-0">Baixo</Badge>
                        ) : (
                          <Badge className="bg-green-100 text-green-700 border-0 text-[10px] px-1.5 py-0">OK</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          title="Ver Histórico"
                          onClick={() => handleAbrirHistorico(item)}
                        >
                          <History className="h-3.5 w-3.5 text-gray-500" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Modal de Dar Entrada */}
      <Dialog open={showEntradaModal} onOpenChange={open => { if (!open) setShowEntradaModal(false); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <ArrowUpCircle className="h-5 w-5 text-green-600" />
              Dar Entrada de Material
            </DialogTitle>
            <DialogDescription className="text-xs">
              Base: {bases.find(b => b.id === selectedBase)?.nome}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Busca de material */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700 flex items-center gap-1">
                <Search className="h-3 w-3" /> Material
              </label>
              <Input
                placeholder="Buscar por descrição ou número..."
                value={buscaMat}
                onChange={e => { setBuscaMat(e.target.value); setMatSelecionado(null); }}
                className="h-9 text-sm"
                autoFocus
              />
              {buscaMat.trim() && !matSelecionado && (
                <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-md bg-white shadow-sm">
                  {loadingMat ? (
                    <div className="p-3 text-center text-sm text-gray-500">
                      <Loader2 className="h-4 w-4 animate-spin inline mr-1" /> Carregando...
                    </div>
                  ) : matFiltrados.length === 0 ? (
                    <p className="px-3 py-2 text-xs text-gray-400">Nenhum material encontrado</p>
                  ) : (
                    matFiltrados.map(m => (
                      <button
                        key={m.id}
                        onClick={() => { setMatSelecionado(m); setBuscaMat(m.descricaoMaterial); }}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 border-b border-gray-100 last:border-0 transition-colors"
                      >
                        <span className="font-medium">{m.descricaoMaterial}</span>
                        {m.numeroMaterial && <span className="text-gray-400 ml-1 text-xs">({m.numeroMaterial})</span>}
                        {m.unidadeMedida && <span className="text-gray-400 ml-1 text-xs">{m.unidadeMedida}</span>}
                      </button>
                    ))
                  )}
                </div>
              )}
              {matSelecionado && (
                <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-md p-2">
                  <Hash className="h-3.5 w-3.5 text-green-600" />
                  <div className="text-xs">
                    <span className="font-medium text-green-800">{matSelecionado.descricaoMaterial}</span>
                    {matSelecionado.numeroMaterial && (
                      <span className="text-green-600 ml-1">({matSelecionado.numeroMaterial})</span>
                    )}
                    <span className="text-green-500 ml-1">{matSelecionado.unidadeMedida}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Quantidade */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">Quantidade</label>
              <Input
                type="number"
                min={0}
                step="0.01"
                placeholder="Ex: 100"
                value={entradaQtd}
                onChange={e => setEntradaQtd(e.target.value)}
                className="h-9 text-sm"
              />
            </div>

            {/* Motivo */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">Motivo (opcional)</label>
              <Textarea
                placeholder="Ex: Recebimento NF 12345, compra direta..."
                value={entradaMotivo}
                onChange={e => setEntradaMotivo(e.target.value)}
                rows={2}
                className="text-sm resize-none"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setShowEntradaModal(false)}>
              Cancelar
            </Button>
            <Button
              size="sm"
              className="bg-green-600 hover:bg-green-700 text-white"
              onClick={handleSalvarEntrada}
              disabled={!matSelecionado || !entradaQtd || parseFloat(entradaQtd) <= 0 || savingEntrada}
            >
              {savingEntrada ? (
                <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> Salvando...</>
              ) : (
                <><ArrowUpCircle className="h-3.5 w-3.5 mr-1" /> Confirmar Entrada</>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Histórico */}
      <Dialog open={showHistModal} onOpenChange={open => { if (!open) setShowHistModal(false); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <History className="h-5 w-5 text-blue-600" />
              Histórico de Movimentações
            </DialogTitle>
            <DialogDescription className="text-xs">
              {histItem?.material?.descricaoMaterial}
              {histItem?.material?.numeroMaterial && ` (${histItem.material.numeroMaterial})`}
            </DialogDescription>
          </DialogHeader>

          {loadingMov ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-blue-600 mr-2" />
              <span className="text-gray-500 text-sm">Carregando...</span>
            </div>
          ) : movimentacoes.length === 0 ? (
            <div className="text-center py-8 text-gray-500 text-sm">
              Nenhuma movimentação registrada.
            </div>
          ) : (
            <div className="max-h-80 overflow-y-auto space-y-2">
              {movimentacoes.map(mov => (
                <div key={mov.id} className="flex items-start gap-3 border border-gray-100 rounded-lg p-3">
                  <div className={`p-1.5 rounded-full ${
                    mov.tipo === 'entrada' ? 'bg-green-100' : mov.tipo === 'saida' ? 'bg-red-100' : 'bg-blue-100'
                  }`}>
                    {mov.tipo === 'entrada' ? (
                      <TrendingUp className="h-3.5 w-3.5 text-green-600" />
                    ) : mov.tipo === 'saida' ? (
                      <TrendingDown className="h-3.5 w-3.5 text-red-600" />
                    ) : (
                      <ArrowUpCircle className="h-3.5 w-3.5 text-blue-600" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge className={`text-[10px] px-1.5 py-0 border-0 ${
                        mov.tipo === 'entrada' ? 'bg-green-100 text-green-700' :
                        mov.tipo === 'saida' ? 'bg-red-100 text-red-700' :
                        'bg-blue-100 text-blue-700'
                      }`}>
                        {mov.tipo === 'entrada' ? 'Entrada' : mov.tipo === 'saida' ? 'Saída' : 'Ajuste'}
                      </Badge>
                      <span className="text-xs text-gray-500">
                        {new Date(mov.createdAt).toLocaleString('pt-BR')}
                      </span>
                    </div>
                    <div className="text-sm mt-1">
                      <span className="font-medium">
                        {mov.tipo === 'entrada' ? '+' : mov.tipo === 'saida' ? '-' : ''}
                        {mov.quantidade.toLocaleString('pt-BR')}
                      </span>
                      <span className="text-gray-400 text-xs ml-2">
                        ({mov.quantidadeAnterior.toLocaleString('pt-BR')} → {mov.quantidadeAtual.toLocaleString('pt-BR')})
                      </span>
                    </div>
                    {mov.motivo && (
                      <p className="text-xs text-gray-500 mt-0.5">{mov.motivo}</p>
                    )}
                    {mov.usuarioNome && (
                      <p className="text-xs text-gray-400 mt-0.5">Por: {mov.usuarioNome}</p>
                    )}
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
