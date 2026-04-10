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
  Package, Search, Loader2, CheckCircle, RotateCcw,
  AlertTriangle, Plus, Trash2, Eye, ClipboardList
} from 'lucide-react';
import { DevolucaoMaterialObraService } from '@/services/devolucaoMaterialObraService';
import { DevolucaoMaterialObra } from '@/types/entrega-material-obra';
import { useAuth } from '@/contexts/AuthContext';

const CONTRATO_GOIAS = '03413132-fba2-459e-911f-478b9af69d21';

interface Base { id: string; nome: string; codigo: string; }
interface Equipe { id: string; nome: string; }
interface ObraOption { id: string; numeroProjeto: string; enderecoObra?: string; }
interface MaterialOption { id: string; numeroMaterial: string; descricaoMaterial: string; unidadeMedida: string; }

export default function DevolucoesObraPage() {
  useAuth();

  // Lista
  const [devolucoes, setDevolucoes] = useState<DevolucaoMaterialObra[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');

  // Bases
  const [bases, setBases] = useState<Base[]>([]);
  const [selectedBase, setSelectedBase] = useState('');

  // Nova devolução
  const [showNova, setShowNova] = useState(false);
  const [equipes, setEquipes] = useState<Equipe[]>([]); // eslint-disable-line @typescript-eslint/no-unused-vars
  const [obras, setObras] = useState<ObraOption[]>([]);
  const [materiais, setMateriais] = useState<MaterialOption[]>([]); // eslint-disable-line @typescript-eslint/no-unused-vars
  const [loadingEquipes, setLoadingEquipes] = useState(false); // eslint-disable-line @typescript-eslint/no-unused-vars
  const [loadingObras, setLoadingObras] = useState(false); // eslint-disable-line @typescript-eslint/no-unused-vars
  const [obraSearch, setObraSearch] = useState('');
  const [matSearch, setMatSearch] = useState('');

  // Materiais entregues pelo fluxo (carregados ao selecionar programação)
  const [materiaisEntregues, setMateriaisEntregues] = useState<MaterialOption[]>([]);
  const [loadingMateriaisEntregues, setLoadingMateriaisEntregues] = useState(false);

  const [novaObraId, setNovaObraId] = useState('');
  const [novaObraLabel, setNovaObraLabel] = useState('');
  const [novaEquipeId, setNovaEquipeId] = useState('');
  const [novaEtapa, setNovaEtapa] = useState('');

  // Programações da obra selecionada (equipe+etapa do calendário)
  const [programacoesObra, setProgramacoesObra] = useState<Array<{
    id: string; equipeId: string; equipeNome: string; etapa: string; data: string; fluxoDefinido: boolean;
  }>>([]);
  const [loadingProgs, setLoadingProgs] = useState(false);
  const [progSelecionadaId, setProgSelecionadaId] = useState('');
  const [novaObs, setNovaObs] = useState('');
  const [novaItens, setNovaItens] = useState<Array<{
    materialId?: string | null;
    descricao: string;
    numeroMaterial?: string;
    unidade: string;
    quantidade: number;
    condicao: 'bom' | 'danificado' | 'sucata';
    observacoes: string;
  }>>([]);
  const [saving, setSaving] = useState(false);

  // Detalhes
  const [showDetalhes, setShowDetalhes] = useState(false);
  const [detalhesDev, setDetalhesDev] = useState<DevolucaoMaterialObra | null>(null);
  const [loadingDetalhes, setLoadingDetalhes] = useState(false);

  // Load bases
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('bases')
        .select('id, nome, codigo')
        .eq('contrato_id', CONTRATO_GOIAS)
        .eq('ativa', true)
        .order('nome');
      setBases(data || []);
      if (data?.length) setSelectedBase(data[0].id);
    })();
  }, []);

  // Load devoluções
  const loadDevolucoes = useCallback(async () => {
    setLoading(true);
    try {
      const filtros: Record<string, string> = {};
      if (selectedBase) filtros.baseId = selectedBase;
      if (statusFilter !== 'todos') filtros.status = statusFilter;
      const data = await DevolucaoMaterialObraService.listar(filtros);
      setDevolucoes(data);
    } catch (err) {
      console.error('Erro ao carregar devoluções:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedBase, statusFilter]);

  useEffect(() => {
    if (selectedBase) loadDevolucoes();
  }, [loadDevolucoes, selectedBase]);

  // Ao selecionar obra, buscar programações do calendário
  useEffect(() => {
    if (!novaObraId) {
      setProgramacoesObra([]);
      setProgSelecionadaId('');
      setNovaEquipeId('');
      setNovaEtapa('');
      return;
    }
    (async () => {
      setLoadingProgs(true);
      try {
        const { data, error } = await supabase
          .from('obra_programacao_equipe')
          .select(`
            id, equipe_id, etapa, data, fluxo_definido,
            equipe:equipes(id, nome)
          `)
          .eq('obra_id', novaObraId)
          .order('data', { ascending: false });
        if (error) throw error;
        setProgramacoesObra((data || []).map((p: any) => ({ // eslint-disable-line @typescript-eslint/no-explicit-any
          id: p.id,
          equipeId: p.equipe_id,
          equipeNome: p.equipe?.nome || '-',
          etapa: p.etapa || 'FINAL',
          data: p.data,
          fluxoDefinido: p.fluxo_definido ?? false,
        })));
      } catch (err) {
        console.error('Erro ao buscar programações da obra:', err);
      } finally {
        setLoadingProgs(false);
      }
    })();
  }, [novaObraId]);

  // Buscar obras
  useEffect(() => {
    if (!showNova || obraSearch.length < 2) { setObras([]); return; }
    const timer = setTimeout(async () => {
      setLoadingObras(true);
      const { data } = await supabase
        .from('obras_manutencao')
        .select('id, numero_projeto, endereco_obra')
        .or(`numero_projeto.ilike.%${obraSearch}%,endereco_obra.ilike.%${obraSearch}%`)
        .limit(20);
      setObras((data || []).map((o: any) => ({ id: o.id, numeroProjeto: o.numero_projeto, enderecoObra: o.endereco_obra }))); // eslint-disable-line @typescript-eslint/no-explicit-any
      setLoadingObras(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [obraSearch, showNova]);

  // Carregar materiais entregues no fluxo ao selecionar programação
  useEffect(() => {
    if (!progSelecionadaId || !novaObraId || !novaEquipeId) {
      setMateriaisEntregues([]);
      setNovaItens([]);
      return;
    }
    (async () => {
      setLoadingMateriaisEntregues(true);
      try {
        const { data, error } = await supabase
          .from('obra_entrega_almoxarifado')
          .select('material_id, descricao, numero_material, unidade, quantidade')
          .eq('programacao_id', progSelecionadaId)
          .eq('equipe_id', novaEquipeId)
          .eq('obra_id', novaObraId)
          .in('status', ['aceito', 'entregue']);
        if (error) throw error;
        // Agrupar por material_id, somando quantidades
        const mapa = new Map<string, MaterialOption & { totalEntregue: number }>();
        for (const row of (data || [])) {
          const key = row.material_id || row.descricao;
          if (mapa.has(key)) {
            mapa.get(key)!.totalEntregue += Number(row.quantidade);
          } else {
            mapa.set(key, {
              id: row.material_id || '',
              numeroMaterial: row.numero_material || '',
              descricaoMaterial: row.descricao,
              unidadeMedida: row.unidade,
              totalEntregue: Number(row.quantidade),
            });
          }
        }
        setMateriaisEntregues(Array.from(mapa.values()));
      } catch (err) {
        console.error('Erro ao buscar materiais entregues:', err);
      } finally {
        setLoadingMateriaisEntregues(false);
      }
    })();
  }, [progSelecionadaId, novaObraId, novaEquipeId]);

  // Buscar materiais (apenas quando não há programação selecionada — fallback desativado)
  useEffect(() => {
    if (!showNova || matSearch.length < 2 || progSelecionadaId) { setMateriais([]); return; }
    const timer = setTimeout(async () => {
      const { data } = await supabase
        .from('lista_materiais')
        .select('id, numero_material, descricao_material, unidade_medida')
        .eq('contrato_id', CONTRATO_GOIAS)
        .or(`numero_material.ilike.%${matSearch}%,descricao_material.ilike.%${matSearch}%`)
        .limit(30);
      setMateriais((data || []).map((m: any) => ({ // eslint-disable-line @typescript-eslint/no-explicit-any
        id: m.id,
        numeroMaterial: m.numero_material,
        descricaoMaterial: m.descricao_material,
        unidadeMedida: m.unidade_medida,
      })));
    }, 300);
    return () => clearTimeout(timer);
  }, [matSearch, showNova, progSelecionadaId]);

  // Adicionar item material
  const addItem = (mat: MaterialOption) => {
    if (novaItens.some(i => i.materialId === mat.id)) return;
    setNovaItens(prev => [...prev, {
      materialId: mat.id,
      descricao: mat.descricaoMaterial,
      numeroMaterial: mat.numeroMaterial,
      unidade: mat.unidadeMedida,
      quantidade: 1,
      condicao: 'bom',
      observacoes: '',
    }]);
    setMatSearch('');
    setMateriais([]);
  };

  const removeItem = (idx: number) => setNovaItens(prev => prev.filter((_, i) => i !== idx));

  // Salvar nova devolução
  const handleSalvar = async () => {
    if (!novaObraId || !novaEquipeId || !selectedBase || novaItens.length === 0) {
      alert('Preencha obra, equipe, base e pelo menos um material.');
      return;
    }

    let userId = '';
    try {
      const { data: authData } = await supabase.auth.getUser();
      if (authData.user) {
        const { data: userData } = await supabase.from('usuarios').select('id').eq('email', authData.user.email).single();
        userId = userData?.id || '';
      }
    } catch {}

    setSaving(true);
    try {
      await DevolucaoMaterialObraService.criar({
        obraId: novaObraId,
        equipeId: novaEquipeId,
        baseId: selectedBase,
        etapa: novaEtapa || undefined,
        devolvidoPara: userId || undefined,
        observacoes: novaObs || undefined,
        itens: novaItens,
      });

      setShowNova(false);
      resetForm();
      loadDevolucoes();
      alert('Devolução registrada com sucesso! Materiais em bom estado retornados ao estoque.');
    } catch (err) {
      console.error('Erro ao registrar devolução:', err);
      alert('Erro ao registrar devolução.');
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setNovaObraId('');
    setNovaObraLabel('');
    setNovaEquipeId('');
    setNovaEtapa('');
    setNovaObs('');
    setNovaItens([]);
    setObraSearch('');
    setMatSearch('');
    setProgramacoesObra([]);
    setProgSelecionadaId('');
    setMateriaisEntregues([]);
  };

  // Ver detalhes
  const handleVerDetalhes = async (dev: DevolucaoMaterialObra) => {
    setShowDetalhes(true);
    setLoadingDetalhes(true);
    try {
      const full = await DevolucaoMaterialObraService.getById(dev.id!);
      setDetalhesDev(full);
    } catch (err) {
      console.error('Erro:', err);
    } finally {
      setLoadingDetalhes(false);
    }
  };

  const statusBadge = (status: string) => {
    const map: Record<string, { label: string; cls: string }> = {
      devolvido: { label: 'Devolvido', cls: 'bg-green-100 text-green-800' },
      cancelado: { label: 'Cancelado', cls: 'bg-gray-100 text-gray-800' },
    };
    const s = map[status] || { label: status, cls: 'bg-gray-100' };
    return <Badge className={s.cls}>{s.label}</Badge>;
  };

  const condicaoBadge = (c: string) => {
    const map: Record<string, { label: string; cls: string }> = {
      bom: { label: 'Bom', cls: 'bg-green-100 text-green-800' },
      danificado: { label: 'Danificado', cls: 'bg-amber-100 text-amber-800' },
      sucata: { label: 'Sucata', cls: 'bg-red-100 text-red-800' },
    };
    const s = map[c] || { label: c, cls: 'bg-gray-100' };
    return <Badge className={s.cls}>{s.label}</Badge>;
  };

  const filtered = devolucoes.filter(d => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      d.obra?.numeroProjeto?.toLowerCase().includes(s) ||
      d.equipe?.nome?.toLowerCase().includes(s) ||
      d.etapa?.toLowerCase().includes(s)
    );
  });

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <RotateCcw className="h-7 w-7 text-orange-600" />
            Devoluções de Material — Obra
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Registrar e acompanhar devoluções de materiais de obras
          </p>
        </div>
        <Button onClick={() => { resetForm(); setShowNova(true); }} className="bg-orange-600 hover:bg-orange-700">
          <Plus className="h-4 w-4 mr-2" /> Nova Devolução
        </Button>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex gap-4 items-end flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <Label className="text-xs mb-1 block">Buscar</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input placeholder="Obra, equipe..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
              </div>
            </div>
            <div className="w-48">
              <Label className="text-xs mb-1 block">Base</Label>
              <Select value={selectedBase} onValueChange={setSelectedBase}>
                <SelectTrigger><SelectValue placeholder="Base" /></SelectTrigger>
                <SelectContent>
                  {bases.map(b => <SelectItem key={b.id} value={b.id}>{b.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="w-40">
              <Label className="text-xs mb-1 block">Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="devolvido">Devolvido</SelectItem>
                  <SelectItem value="cancelado">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-orange-600" />
            Devoluções Registradas
            <Badge variant="outline" className="ml-2">{filtered.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-orange-600 mx-auto" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12">
              <Package className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">Nenhuma devolução encontrada</p>
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
                    <TableHead>Base</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(dev => (
                    <TableRow key={dev.id} className="hover:bg-orange-50/50">
                      <TableCell className="font-medium">
                        {new Date(dev.dataDevolucao + 'T12:00:00').toLocaleDateString('pt-BR')}
                      </TableCell>
                      <TableCell>
                        <span className="font-semibold text-blue-700">{dev.obra?.numeroProjeto}</span>
                      </TableCell>
                      <TableCell>{dev.equipe?.nome || '-'}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{dev.etapa || '-'}</Badge>
                      </TableCell>
                      <TableCell>{dev.base?.nome || '-'}</TableCell>
                      <TableCell className="text-center">{statusBadge(dev.status)}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="outline" size="sm" onClick={() => handleVerDetalhes(dev)} className="text-xs">
                          <Eye className="h-3.5 w-3.5 mr-1" /> Detalhes
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ===== MODAL NOVA DEVOLUÇÃO ===== */}
      <Dialog open={showNova} onOpenChange={setShowNova}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RotateCcw className="h-5 w-5 text-orange-600" />
              Registrar Devolução de Materiais
            </DialogTitle>
            <DialogDescription>
              Informe a obra, equipe, etapa e os materiais devolvidos
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Obra */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Obra *</Label>
              {novaObraId ? (
                <div className="flex items-center gap-2">
                  <Badge className="bg-blue-100 text-blue-800">{novaObraLabel}</Badge>
                  <button type="button" className="text-xs text-red-500 hover:underline" onClick={() => { setNovaObraId(''); setNovaObraLabel(''); }}>Alterar</button>
                </div>
              ) : (
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Buscar obra por número ou endereço..."
                    value={obraSearch}
                    onChange={(e) => setObraSearch(e.target.value)}
                    className="pl-10"
                  />
                  {obras.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-40 overflow-y-auto">
                      {obras.map(o => (
                        <button
                          key={o.id}
                          type="button"
                          onClick={() => { setNovaObraId(o.id); setNovaObraLabel(o.numeroProjeto); setObras([]); setObraSearch(''); }}
                          className="w-full text-left px-3 py-2 hover:bg-blue-50 text-sm border-b last:border-b-0"
                        >
                          <span className="font-semibold">{o.numeroProjeto}</span>
                          {o.enderecoObra && <span className="text-gray-500 ml-2 text-xs">{o.enderecoObra}</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Programação (Equipe + Etapa do calendário) */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Programação (Equipe · Etapa · Data) *</Label>
              {!novaObraId ? (
                <p className="text-xs text-gray-400 italic">Selecione uma obra primeiro</p>
              ) : loadingProgs ? (
                <div className="flex items-center gap-2 py-2">
                  <Loader2 className="h-4 w-4 animate-spin text-orange-500" />
                  <span className="text-xs text-gray-500">Buscando programações...</span>
                </div>
              ) : programacoesObra.length === 0 ? (
                <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-sm text-amber-800">
                  <AlertTriangle className="h-4 w-4" />
                  Nenhuma programação encontrada para esta obra no calendário.
                </div>
              ) : (
                <Select
                  value={progSelecionadaId}
                  onValueChange={(v) => {
                    setProgSelecionadaId(v);
                    const prog = programacoesObra.find(p => p.id === v);
                    if (prog) {
                      setNovaEquipeId(prog.equipeId);
                      setNovaEtapa(prog.etapa);
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecionar programação..." />
                  </SelectTrigger>
                  <SelectContent>
                    {programacoesObra.map(p => (
                      <SelectItem key={p.id} value={p.id}>
                        {new Date(p.data + 'T12:00:00').toLocaleDateString('pt-BR')} · {p.etapa} · {p.equipeNome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {progSelecionadaId && (() => {
                const prog = programacoesObra.find(p => p.id === progSelecionadaId);
                return prog ? (
                  <div className="grid grid-cols-3 gap-2 mt-2">
                    <div className="bg-orange-50 rounded-md p-2">
                      <div className="text-[10px] text-orange-600 font-medium">Equipe</div>
                      <div className="text-sm font-semibold">{prog.equipeNome}</div>
                    </div>
                    <div className="bg-blue-50 rounded-md p-2">
                      <div className="text-[10px] text-blue-600 font-medium">Etapa</div>
                      <div className="text-sm font-semibold">{prog.etapa}</div>
                    </div>
                    <div className="bg-gray-50 rounded-md p-2">
                      <div className="text-[10px] text-gray-600 font-medium">Data</div>
                      <div className="text-sm font-semibold">{new Date(prog.data + 'T12:00:00').toLocaleDateString('pt-BR')}</div>
                    </div>
                  </div>
                ) : null;
              })()}
            </div>

            {/* Materiais */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Materiais Devolvidos *</Label>

              {progSelecionadaId ? (
                // Programação selecionada: mostrar apenas materiais entregues no fluxo
                loadingMateriaisEntregues ? (
                  <div className="flex items-center gap-2 py-2">
                    <Loader2 className="h-4 w-4 animate-spin text-orange-500" />
                    <span className="text-xs text-gray-500">Carregando materiais entregues...</span>
                  </div>
                ) : materiaisEntregues.length === 0 ? (
                  <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-sm text-amber-800">
                    <AlertTriangle className="h-4 w-4" />
                    Nenhum material entregue encontrado para esta programação.
                  </div>
                ) : (
                  <div className="border rounded-lg overflow-hidden">
                    <div className="bg-orange-50 px-3 py-1.5 text-xs text-orange-700 font-medium border-b">
                      Selecione os materiais a devolver (apenas materiais entregues no fluxo)
                    </div>
                    {materiaisEntregues.map(m => {
                      const jaAdicionado = novaItens.some(i => i.materialId === m.id);
                      return (
                        <div key={m.id} className={`flex items-center justify-between px-3 py-2 border-b last:border-b-0 text-sm ${jaAdicionado ? 'bg-green-50' : 'hover:bg-orange-50'}`}>
                          <div>
                            <span className="font-medium text-blue-700">{m.numeroMaterial}</span>
                            <span className="text-gray-600 ml-2">{m.descricaoMaterial}</span>
                            <span className="text-gray-400 ml-1 text-xs">({m.unidadeMedida})</span>
                          </div>
                          {jaAdicionado ? (
                            <Badge className="bg-green-100 text-green-700 text-xs">Adicionado</Badge>
                          ) : (
                            <button
                              type="button"
                              onClick={() => addItem(m)}
                              className="text-xs text-orange-600 hover:text-orange-800 font-medium"
                            >
                              <Plus className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )
              ) : (
                // Sem programação: busca livre desativada
                <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-500">
                  <AlertTriangle className="h-4 w-4" />
                  Selecione uma programação para ver os materiais disponíveis para devolução.
                </div>
              )}

              {novaItens.length > 0 && (
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50">
                        <TableHead>Material</TableHead>
                        <TableHead className="w-24">Qtd</TableHead>
                        <TableHead className="w-36">Condição</TableHead>
                        <TableHead className="w-10"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {novaItens.map((item, idx) => (
                        <TableRow key={idx}>
                          <TableCell>
                            <div className="text-sm font-medium">{item.descricao}</div>
                            <div className="text-xs text-gray-400">{item.numeroMaterial} · {item.unidade}</div>
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min={0.01}
                              step="0.01"
                              value={item.quantidade}
                              onChange={(e) => {
                                const copy = [...novaItens];
                                copy[idx].quantidade = parseFloat(e.target.value) || 0;
                                setNovaItens(copy);
                              }}
                              className="h-8 text-sm text-right"
                            />
                          </TableCell>
                          <TableCell>
                            <Select
                              value={item.condicao}
                              onValueChange={(v) => {
                                const copy = [...novaItens];
                                copy[idx].condicao = v as 'bom' | 'danificado' | 'sucata';
                                setNovaItens(copy);
                              }}
                            >
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="bom">Bom estado</SelectItem>
                                <SelectItem value="danificado">Danificado</SelectItem>
                                <SelectItem value="sucata">Sucata</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <button type="button" onClick={() => removeItem(idx)} className="text-red-500 hover:text-red-700">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>

            {/* Observações */}
            <div className="space-y-1">
              <Label className="text-xs">Observações</Label>
              <Textarea value={novaObs} onChange={(e) => setNovaObs(e.target.value)} placeholder="Observações sobre a devolução..." rows={2} className="text-sm" />
            </div>
          </div>

          {/* Ações */}
          <div className="flex gap-3 justify-end pt-2 border-t">
            <Button variant="outline" onClick={() => setShowNova(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={handleSalvar} disabled={saving || !novaObraId || !novaEquipeId || novaItens.length === 0} className="bg-orange-600 hover:bg-orange-700">
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle className="h-4 w-4 mr-2" />}
              Registrar Devolução
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ===== MODAL DETALHES ===== */}
      <Dialog open={showDetalhes} onOpenChange={setShowDetalhes}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5 text-orange-600" />
              Detalhes da Devolução
            </DialogTitle>
          </DialogHeader>

          {loadingDetalhes ? (
            <div className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin text-orange-600 mx-auto" /></div>
          ) : detalhesDev ? (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div className="bg-blue-50 rounded-lg p-2.5">
                  <div className="text-xs text-blue-600 font-medium">Obra</div>
                  <div className="font-semibold">{detalhesDev.obra?.numeroProjeto}</div>
                </div>
                <div className="bg-orange-50 rounded-lg p-2.5">
                  <div className="text-xs text-orange-600 font-medium">Equipe</div>
                  <div className="font-semibold">{detalhesDev.equipe?.nome}</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-2.5">
                  <div className="text-xs text-gray-600 font-medium">Etapa / Status</div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{detalhesDev.etapa || '-'}</Badge>
                    {statusBadge(detalhesDev.status)}
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-semibold mb-2">Itens Devolvidos</h4>
                <div className="space-y-2">
                  {detalhesDev.itens?.map((item) => (
                    <div key={item.id} className="border rounded-lg p-3 flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium">{item.descricao}</div>
                        <div className="text-xs text-gray-500">{item.numeroMaterial} · {item.quantidade} {item.unidade}</div>
                      </div>
                      {condicaoBadge(item.condicao)}
                    </div>
                  ))}
                </div>
              </div>

              {detalhesDev.observacoes && (
                <div>
                  <h4 className="text-sm font-semibold mb-1">Observações</h4>
                  <p className="text-sm text-gray-600">{detalhesDev.observacoes}</p>
                </div>
              )}
            </div>
          ) : (
            <p className="text-center text-gray-500 py-8">Devolução não encontrada.</p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
