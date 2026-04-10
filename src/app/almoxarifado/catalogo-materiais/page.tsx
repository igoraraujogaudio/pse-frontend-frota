'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import {
  Package, Search, Loader2, Building2, CheckCircle2, Link2,
  AlertCircle, ListChecks, RefreshCw
} from 'lucide-react';
import { MateriaisService } from '@/services/materiaisService';
import { EstoqueMaterialBaseService } from '@/services/estoqueMaterialBaseService';
import { Material } from '@/types/materiais';
import { useAuth } from '@/contexts/AuthContext';

const CONTRATO_GOIAS = '03413132-fba2-459e-911f-478b9af69d21';

interface Base {
  id: string;
  nome: string;
  codigo: string;
}

export default function CatalogoMateriaisPage() {
  useAuth();

  // Bases
  const [bases, setBases] = useState<Base[]>([]);
  const [selectedBase, setSelectedBase] = useState('');
  const [loadingBases, setLoadingBases] = useState(true);

  // Materiais do contrato (catálogo)
  const [materiais, setMateriais] = useState<Material[]>([]);
  const [loadingMat, setLoadingMat] = useState(true);
  const [search, setSearch] = useState('');

  // Materiais já na base selecionada
  const [materiaisNaBase, setMateriaisNaBase] = useState<Set<string>>(new Set());
  const [loadingBase, setLoadingBase] = useState(false);

  // Seleção para popular
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());

  // Modal popular em lote
  const [showPopularModal, setShowPopularModal] = useState(false);
  const [popularTodos, setPopularTodos] = useState(false);
  const [saving, setSaving] = useState(false);
  const [resultado, setResultado] = useState<string | null>(null);

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

  // Carregar materiais do contrato
  useEffect(() => {
    const load = async () => {
      setLoadingMat(true);
      try {
        const data = await MateriaisService.getAll(CONTRATO_GOIAS);
        setMateriais(data);
      } catch (err) {
        console.error('Erro ao carregar materiais:', err);
      } finally {
        setLoadingMat(false);
      }
    };
    load();
  }, []);

  // Carregar quais materiais já estão na base selecionada
  const loadMateriaisNaBase = useCallback(async () => {
    if (!selectedBase) return;
    setLoadingBase(true);
    try {
      const ids = await EstoqueMaterialBaseService.getMateriaisIdsNaBase(selectedBase);
      setMateriaisNaBase(ids);
    } catch (err) {
      console.error('Erro ao verificar materiais na base:', err);
    } finally {
      setLoadingBase(false);
    }
  }, [selectedBase]);

  useEffect(() => {
    if (selectedBase) {
      loadMateriaisNaBase();
      setSelecionados(new Set());
    }
  }, [selectedBase, loadMateriaisNaBase]);

  // Filtro de busca
  const materiaisFiltrados = materiais.filter(m => {
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    return (
      m.descricaoMaterial.toLowerCase().includes(s) ||
      m.numeroMaterial?.toLowerCase().includes(s)
    );
  });

  // Stats
  const totalMateriais = materiais.length;
  const totalNaBase = materiaisNaBase.size;
  const totalFaltando = materiais.filter(m => m.id && !materiaisNaBase.has(m.id)).length;

  // Toggle seleção
  const toggleSelecionado = (materialId: string) => {
    setSelecionados(prev => {
      const next = new Set(prev);
      if (next.has(materialId)) {
        next.delete(materialId);
      } else {
        next.add(materialId);
      }
      return next;
    });
  };

  // Selecionar todos que faltam (visíveis)
  const selecionarTodosFaltando = () => {
    const faltando = materiaisFiltrados
      .filter(m => m.id && !materiaisNaBase.has(m.id))
      .map(m => m.id!);
    setSelecionados(new Set(faltando));
  };

  // Limpar seleção
  const limparSelecao = () => setSelecionados(new Set());

  // Popular selecionados na base
  const handlePopular = async () => {
    if (!selectedBase) return;
    setSaving(true);
    setResultado(null);
    try {
      let count: number;
      if (popularTodos) {
        count = await EstoqueMaterialBaseService.popularTodosMateriaisDoContrato(selectedBase, CONTRATO_GOIAS);
      } else {
        count = await EstoqueMaterialBaseService.popularMateriaisNaBase(selectedBase, Array.from(selecionados));
      }
      setResultado(`${count} material(is) adicionado(s) à base com sucesso!`);
      await loadMateriaisNaBase();
      setSelecionados(new Set());
    } catch (err) {
      setResultado(`Erro: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSaving(false);
    }
  };

  const baseNome = bases.find(b => b.id === selectedBase)?.nome || '';

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ListChecks className="h-6 w-6 text-blue-600" />
            Catálogo de Materiais
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Gerencie quais materiais estão disponíveis em cada base
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
        </div>
      </div>

      {/* Cards de estatísticas */}
      {selectedBase && !loadingMat && !loadingBase && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100">
                <Package className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Total no Contrato</p>
                <p className="text-xl font-bold text-gray-900">{totalMateriais}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Na Base {baseNome}</p>
                <p className="text-xl font-bold text-green-600">{totalNaBase}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-100">
                <AlertCircle className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Faltando na Base</p>
                <p className="text-xl font-bold text-amber-600">{totalFaltando}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Barra de ações */}
      {selectedBase && (
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Buscar por descrição ou número..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 h-9"
            />
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              onClick={selecionarTodosFaltando}
              disabled={totalFaltando === 0}
            >
              Selecionar Faltantes ({totalFaltando})
            </Button>
            {selecionados.size > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                onClick={limparSelecao}
              >
                Limpar ({selecionados.size})
              </Button>
            )}
            <Button
              size="sm"
              className="h-8 text-xs bg-blue-600 hover:bg-blue-700 text-white"
              onClick={() => { setPopularTodos(false); setResultado(null); setShowPopularModal(true); }}
              disabled={selecionados.size === 0 && totalFaltando === 0}
            >
              <Link2 className="h-3.5 w-3.5 mr-1" />
              Popular na Base
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              title="Recarregar"
              onClick={loadMateriaisNaBase}
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}

      {/* Tabela */}
      {!selectedBase ? (
        <Card>
          <CardContent className="p-12 text-center text-gray-500">
            <Building2 className="h-12 w-12 mx-auto mb-3 text-gray-300" />
            <p className="font-medium">Selecione uma base</p>
            <p className="text-sm">Escolha uma base para ver e popular os materiais.</p>
          </CardContent>
        </Card>
      ) : loadingMat || loadingBase ? (
        <Card>
          <CardContent className="p-12 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-blue-600 mr-2" />
            <span className="text-gray-600">Carregando materiais...</span>
          </CardContent>
        </Card>
      ) : materiaisFiltrados.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center text-gray-500">
            <Package className="h-12 w-12 mx-auto mb-3 text-gray-300" />
            <p className="font-medium">Nenhum material encontrado</p>
            <p className="text-sm">{search ? 'Tente outra busca.' : 'Nenhum material cadastrado no contrato.'}</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center justify-between">
              <span>Materiais do Contrato ({materiaisFiltrados.length})</span>
              <span className="text-xs font-normal text-gray-500">
                Base: {baseNome} · {selecionados.size > 0 ? `${selecionados.size} selecionado(s)` : ''}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-[60vh] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10"></TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead className="w-28">Nº Material</TableHead>
                    <TableHead className="w-16 text-center">UN</TableHead>
                    <TableHead className="w-28 text-center">Na Base?</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {materiaisFiltrados.map(mat => {
                    const jaExiste = mat.id ? materiaisNaBase.has(mat.id) : false;
                    const selecionado = mat.id ? selecionados.has(mat.id) : false;
                    return (
                      <TableRow
                        key={mat.id}
                        className={`${jaExiste ? 'bg-green-50/50' : ''} ${selecionado ? 'bg-blue-50' : ''}`}
                      >
                        <TableCell className="text-center">
                          {!jaExiste && mat.id && (
                            <Checkbox
                              checked={selecionado}
                              onCheckedChange={() => toggleSelecionado(mat.id!)}
                            />
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="font-medium text-sm">{mat.descricaoMaterial}</div>
                        </TableCell>
                        <TableCell className="text-sm text-gray-600">
                          {mat.numeroMaterial || '—'}
                        </TableCell>
                        <TableCell className="text-center text-sm text-gray-600">
                          {mat.unidadeMedida || 'UN'}
                        </TableCell>
                        <TableCell className="text-center">
                          {jaExiste ? (
                            <Badge className="bg-green-100 text-green-700 border-0 text-[10px] px-1.5 py-0">
                              <CheckCircle2 className="h-3 w-3 mr-0.5" />
                              Sim
                            </Badge>
                          ) : (
                            <Badge className="bg-gray-100 text-gray-500 border-0 text-[10px] px-1.5 py-0">
                              Não
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Modal de Popular */}
      <Dialog open={showPopularModal} onOpenChange={open => { if (!open) setShowPopularModal(false); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Link2 className="h-5 w-5 text-blue-600" />
              Popular Materiais na Base
            </DialogTitle>
            <DialogDescription className="text-xs">
              Base: {baseNome}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {resultado ? (
              <div className={`p-3 rounded-lg text-sm ${resultado.startsWith('Erro') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
                {resultado}
              </div>
            ) : (
              <>
                <div className="space-y-3">
                  <button
                    onClick={() => setPopularTodos(false)}
                    className={`w-full text-left p-3 rounded-lg border-2 transition-all ${
                      !popularTodos ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="font-medium text-sm">Apenas selecionados</div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {selecionados.size} material(is) selecionado(s)
                    </div>
                  </button>
                  <button
                    onClick={() => setPopularTodos(true)}
                    className={`w-full text-left p-3 rounded-lg border-2 transition-all ${
                      popularTodos ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="font-medium text-sm">Todos do contrato</div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      Adiciona todos os {totalFaltando} materiais que ainda faltam na base
                    </div>
                  </button>
                </div>

                <p className="text-xs text-gray-500">
                  Materiais serão adicionados com estoque 0. Materiais já existentes na base serão ignorados.
                </p>
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShowPopularModal(false)}>
              {resultado ? 'Fechar' : 'Cancelar'}
            </Button>
            {!resultado && (
              <Button
                size="sm"
                className="bg-blue-600 hover:bg-blue-700 text-white"
                onClick={handlePopular}
                disabled={saving || (!popularTodos && selecionados.size === 0)}
              >
                {saving ? (
                  <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> Populando...</>
                ) : (
                  <><Link2 className="h-3.5 w-3.5 mr-1" /> Confirmar</>
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
