'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { ObraProgramacaoEquipe } from '@/services/obraProgramacaoEquipeService';
import { ObraFluxoService, FluxoMaterial, FluxoMO, SaldoItem, EntregaAlmoxarifado } from '@/services/obraFluxoService';
import { ObraRecursosCorrigidosService } from '@/services/obraRecursosCorrigidosService';
import { MateriaisService } from '@/services/materiaisService';
import { MaoDeObraService } from '@/services/maoDeObraService';
import { ObraMaterialCorrigido, ObraMaoDeObraCorrigida } from '@/types/obra-recursos-corrigidos';
import { ObraMaterial } from '@/types/materiais';
import { Material } from '@/types/materiais';
import { MaoDeObra } from '@/types/mao-de-obra';
import { AlertTriangle, CheckCircle2, Package, HardHat, Loader2, Plus, Trash2, Search } from 'lucide-react';

interface Props {
  programacao: ObraProgramacaoEquipe;
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

type TabKey = 'material' | 'mo';

function SaldoBadge({ item }: { item: SaldoItem }) {
  const disponivel = item.saldo - item.entregue;
  return (
    <div className="flex items-center gap-2">
      <div className="text-center">
        <div className="text-xs text-gray-500">{item.fonte === 'corrigido' ? 'Corrigido' : 'Original'}</div>
        <div className="font-semibold">{item.saldo}</div>
      </div>
      <div className="text-center">
        <div className="text-xs text-gray-500">Entregue</div>
        <div className="font-semibold text-blue-600">{item.entregue}</div>
      </div>
      <div className="text-center">
        <div className="text-xs text-gray-500">Solicitado</div>
        <div className={`font-semibold ${item.foraDeReserva ? 'text-red-600' : 'text-green-600'}`}>
          {item.solicitado}
        </div>
      </div>
      {item.foraDeReserva && (
        <Badge variant="destructive" className="text-[10px] px-1 py-0">
          <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />
          Fora de reserva ({(item.solicitado - disponivel).toFixed(2)} a mais)
        </Badge>
      )}
    </div>
  );
}

export function FluxoEtapaModal({ programacao, isOpen, onClose, onSaved }: Props) {
  const [activeTab, setActiveTab] = useState<TabKey>('material');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Recursos da obra
  const [corrigidosMat, setCorrigidosMat] = useState<ObraMaterialCorrigido[]>([]);
  const [corrigidosMO, setCorrigidosMO] = useState<ObraMaoDeObraCorrigida[]>([]);
  const [originaisMat, setOriginaisMat] = useState<ObraMaterial[]>([]);

  // Fluxo atual (editável)
  const [fluxoMat, setFluxoMat] = useState<FluxoMaterial[]>([]);
  const [fluxoMO, setFluxoMO] = useState<FluxoMO[]>([]);

  // Entregas já feitas pelo almoxarifado
  const [entregas, setEntregas] = useState<EntregaAlmoxarifado[]>([]);

  // Saldo calculado
  const [saldoMat, setSaldoMat] = useState<SaldoItem[]>([]);

  // Listas completas para busca avulsa
  const [listaMat, setListaMat] = useState<Material[]>([]);
  const [listaMO, setListaMO] = useState<MaoDeObra[]>([]);

  // Estado formulário avulso Material
  const [showFormMat, setShowFormMat] = useState(false);
  const [buscaMat, setBuscaMat] = useState('');
  const [matSelecionado, setMatSelecionado] = useState<Material | null>(null);
  const [novoMatQtd, setNovoMatQtd] = useState('');

  // Estado formulário avulso MO
  const [showFormMO, setShowFormMO] = useState(false);
  const [buscaMO, setBuscaMO] = useState('');
  const [moSelecionado, setMoSelecionado] = useState<MaoDeObra | null>(null);
  const [novoMOQtd, setNovoMOQtd] = useState('');

  const obraId = programacao.obraId;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [corrMat, corrMO, origMat, origMO, fMat, fMO, entrg] = await Promise.all([
        ObraRecursosCorrigidosService.getMateriaisByObra(obraId),
        ObraRecursosCorrigidosService.getMaoDeObraByObra(obraId),
        MateriaisService.getObraMateriais(obraId),
        MaoDeObraService.getObraMaoDeObra(obraId),
        ObraFluxoService.getFluxoMaterial(programacao.id!),
        ObraFluxoService.getFluxoMO(programacao.id!),
        ObraFluxoService.getEntregasByObra(obraId),
      ]);
      setCorrigidosMat(corrMat);
      setCorrigidosMO(corrMO);
      setOriginaisMat(origMat);

      // Se fluxo ainda não definido, pré-preencher com corrigido ou original
      if (fMat.length === 0) {
        const fonte = corrMat.length > 0 ? corrMat : origMat.map(o => ({
          id: undefined,
          obraId,
          materialId: o.materialId,
          descricaoMaterial: o.material?.descricaoMaterial ?? '',
          numeroMaterial: o.material?.numeroMaterial,
          unidadeMedida: o.material?.unidadeMedida ?? 'UN',
          quantidade: o.quantidade,
        } as ObraMaterialCorrigido));
        setFluxoMat(fonte.map(r => ({
          programacaoId: programacao.id!,
          materialId: r.materialId ?? null,
          descricao: r.descricaoMaterial ?? '',
          numeroMaterial: r.numeroMaterial,
          unidade: r.unidadeMedida ?? 'UN',
          quantidade: r.quantidade,
          fonte: corrMat.length > 0 ? 'corrigido' : 'original',
        })));
      } else {
        setFluxoMat(fMat);
      }

      if (fMO.length === 0) {
        const fonteMO = corrMO.length > 0 ? corrMO : origMO.map(o => ({
          id: undefined,
          obraId,
          maoDeObraId: o.maoDeObraId,
          descricao: o.maoDeObra?.descricao ?? '',
          codigo: o.maoDeObra?.codigoNovo,
          up: o.maoDeObra?.up,
          quantidade: o.quantidade,
        } as ObraMaoDeObraCorrigida));
        setFluxoMO(fonteMO.map(r => ({
          programacaoId: programacao.id!,
          maoDeObraId: r.maoDeObraId ?? null,
          descricao: r.descricao ?? '',
          codigo: r.codigo,
          up: r.up,
          quantidade: r.quantidade,
          fonte: corrMO.length > 0 ? 'corrigido' : 'original',
        })));
      } else {
        setFluxoMO(fMO);
      }

      setEntregas(entrg);

      // Carregar listas completas para busca avulsa
      const [allMat, allMO] = await Promise.all([
        MateriaisService.getAll(),
        MaoDeObraService.getAll(),
      ]);
      setListaMat(allMat);
      setListaMO(allMO);
    } catch (e) {
      console.error('Erro ao carregar fluxo:', e);
    } finally {
      setLoading(false);
    }
  }, [obraId, programacao.id]);

  useEffect(() => {
    if (isOpen && programacao.id) load();
  }, [isOpen, programacao.id, load]);

  // Recalcular saldo quando fluxo ou entregas mudam
  useEffect(() => {
    if (!fluxoMat.length) { setSaldoMat([]); return; }
    const corrSource = corrigidosMat.map(r => ({ descricao: r.descricaoMaterial ?? '', quantidade: r.quantidade, materialId: r.materialId }));
    const origSource = originaisMat.map(r => ({ descricao: r.material?.descricaoMaterial ?? '', quantidade: r.quantidade, materialId: r.materialId }));
    ObraFluxoService.calcularSaldo(programacao.id!, obraId, fluxoMat, entregas, corrSource, origSource)
      .then(setSaldoMat)
      .catch(console.error);
  }, [fluxoMat, entregas, corrigidosMat, originaisMat, programacao.id, obraId]);

  const handleSave = async () => {
    if (!programacao.id) return;
    setSaving(true);
    try {
      await Promise.all([
        ObraFluxoService.saveFluxoMaterial(programacao.id, fluxoMat),
        ObraFluxoService.saveFluxoMO(programacao.id, fluxoMO),
        ObraFluxoService.marcarFluxoDefinido(programacao.id, true),
      ]);
      onSaved();
      onClose();
    } catch (e) {
      console.error('Erro ao salvar fluxo:', e);
      alert('Erro ao salvar fluxo. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  const updateMatQtd = (idx: number, qtd: string) => {
    setFluxoMat(prev => prev.map((item, i) => i === idx ? { ...item, quantidade: parseFloat(qtd) || 0 } : item));
  };

  const removeMat = (idx: number) => {
    setFluxoMat(prev => prev.filter((_, i) => i !== idx));
  };

  const updateMOQtd = (idx: number, qtd: string) => {
    setFluxoMO(prev => prev.map((item, i) => i === idx ? { ...item, quantidade: parseFloat(qtd) || 0 } : item));
  };

  const removeMO = (idx: number) => {
    setFluxoMO(prev => prev.filter((_, i) => i !== idx));
  };

  const handleAdicionarMatAvulso = () => {
    if (!matSelecionado) return;
    const novo: FluxoMaterial = {
      programacaoId: programacao.id!,
      materialId: matSelecionado.id ?? null,
      descricao: matSelecionado.descricaoMaterial,
      numeroMaterial: matSelecionado.numeroMaterial,
      unidade: matSelecionado.unidadeMedida || 'UN',
      quantidade: parseFloat(novoMatQtd) || 0,
      fonte: 'corrigido',
    };
    setFluxoMat(prev => [...prev, novo]);
    setShowFormMat(false);
    setBuscaMat('');
    setMatSelecionado(null);
    setNovoMatQtd('');
  };

  const handleAdicionarMOAvulso = () => {
    if (!moSelecionado) return;
    const novo: FluxoMO = {
      programacaoId: programacao.id!,
      maoDeObraId: moSelecionado.id ?? null,
      descricao: moSelecionado.descricao,
      codigo: moSelecionado.codigoNovo,
      up: moSelecionado.up,
      quantidade: parseFloat(novoMOQtd) || 0,
      fonte: 'corrigido',
    };
    setFluxoMO(prev => [...prev, novo]);
    setShowFormMO(false);
    setBuscaMO('');
    setMoSelecionado(null);
    setNovoMOQtd('');
  };

  const temForaDeReserva = saldoMat.some(s => s.foraDeReserva);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-blue-600" />
            Definir Fluxo — {programacao.obra?.numeroProjeto}
          </DialogTitle>
          <DialogDescription>
            Etapa {programacao.etapa} · {programacao.data} ·{' '}
            <span className="text-xs">
              {corrigidosMat.length > 0 || corrigidosMO.length > 0
                ? 'Usando recursos corrigidos pela Equatorial'
                : 'Usando recursos originais (sem correção cadastrada)'}
            </span>
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-blue-600 mr-2" />
            <span className="text-gray-600">Carregando recursos...</span>
          </div>
        ) : (
          <>
            {temForaDeReserva && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800">
                <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <div>
                  <strong>Atenção: itens fora de reserva.</strong> O solicitado excede o saldo disponível (saldo − já entregue). Você pode continuar, mas os itens marcados serão registrados como <em>fora de reserva</em>.
                </div>
              </div>
            )}

            <Tabs value={activeTab} onValueChange={v => setActiveTab(v as TabKey)}>
              <TabsList className="grid grid-cols-2">
                <TabsTrigger value="material" className="flex items-center gap-1.5">
                  <Package className="h-3.5 w-3.5" />
                  Material ({fluxoMat.length})
                </TabsTrigger>
                <TabsTrigger value="mo" className="flex items-center gap-1.5">
                  <HardHat className="h-3.5 w-3.5" />
                  Mão de Obra ({fluxoMO.length})
                </TabsTrigger>
              </TabsList>

              {/* ===== ABA MATERIAL ===== */}
              <TabsContent value="material" className="mt-4 space-y-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold flex items-center justify-between">
                      <span>Materiais do Fluxo</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500 font-normal">
                          Saldo = {corrigidosMat.length > 0 ? 'Corrigido' : 'Original'} − Entregue ao almoxarifado
                        </span>
                        <Button variant="outline" size="sm" onClick={() => setShowFormMat(true)} className="h-7 text-xs">
                          <Plus className="h-3 w-3 mr-1" /> Adicionar
                        </Button>
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {fluxoMat.length === 0 ? (
                      <div className="text-center py-6 text-gray-500 text-sm">
                        Nenhum material definido. Clique em &quot;Adicionar&quot; ou cadastre recursos na obra.
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Descrição</TableHead>
                            <TableHead className="w-16">UN</TableHead>
                            <TableHead className="w-24 text-right">Solicitado</TableHead>
                            <TableHead className="text-center">Saldo / Entregue / Status</TableHead>
                            <TableHead className="w-8"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {fluxoMat.map((item, idx) => {
                            const sItem = saldoMat[idx];
                            return (
                              <TableRow key={idx} className={sItem?.foraDeReserva ? 'bg-red-50' : ''}>
                                <TableCell>
                                  <div className="font-medium text-sm">{item.descricao || '—'}</div>
                                  {item.numeroMaterial && (
                                    <div className="text-xs text-gray-500">Nº {item.numeroMaterial}</div>
                                  )}
                                  <Badge variant="outline" className="text-[10px] px-1 py-0 mt-0.5">
                                    {item.fonte}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-sm">{item.unidade}</TableCell>
                                <TableCell>
                                  <Input
                                    type="number"
                                    min={0}
                                    step="0.01"
                                    value={item.quantidade}
                                    onChange={e => updateMatQtd(idx, e.target.value)}
                                    className="h-7 text-right text-sm w-24"
                                  />
                                </TableCell>
                                <TableCell>
                                  {sItem ? (
                                    <SaldoBadge item={sItem} />
                                  ) : (
                                    <span className="text-xs text-gray-400">—</span>
                                  )}
                                </TableCell>
                                <TableCell>
                                  <button onClick={() => removeMat(idx)} className="text-red-400 hover:text-red-600">
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    )}

                    {/* Formulário busca material avulso */}
                    {showFormMat && (
                      <div className="border-2 border-dashed border-blue-300 rounded-lg p-3 space-y-2 bg-blue-50 mt-3">
                        <p className="text-xs font-semibold text-blue-700 flex items-center gap-1">
                          <Search className="h-3 w-3" /> Buscar material para adicionar
                        </p>
                        <Input
                          placeholder="Buscar por descrição ou número do material..."
                          value={buscaMat}
                          onChange={e => { setBuscaMat(e.target.value); setMatSelecionado(null); }}
                          className="h-8 text-xs"
                          autoFocus
                        />
                        {buscaMat.trim() && !matSelecionado && (
                          <div className="max-h-40 overflow-y-auto border border-blue-200 rounded bg-white">
                            {listaMat
                              .filter(m => m.descricaoMaterial.toLowerCase().includes(buscaMat.toLowerCase()) || m.numeroMaterial?.toLowerCase().includes(buscaMat.toLowerCase()))
                              .slice(0, 15)
                              .map(m => (
                                <button
                                  key={m.id}
                                  onClick={() => { setMatSelecionado(m); setBuscaMat(m.descricaoMaterial); }}
                                  className="w-full text-left px-2 py-1.5 text-xs hover:bg-blue-50 border-b border-gray-100 last:border-0"
                                >
                                  <span className="font-medium">{m.descricaoMaterial}</span>
                                  {m.numeroMaterial && <span className="text-gray-400 ml-1">({m.numeroMaterial})</span>}
                                  {m.unidadeMedida && <span className="text-gray-400 ml-1">· {m.unidadeMedida}</span>}
                                </button>
                              ))}
                            {listaMat.filter(m => m.descricaoMaterial.toLowerCase().includes(buscaMat.toLowerCase()) || m.numeroMaterial?.toLowerCase().includes(buscaMat.toLowerCase())).length === 0 && (
                              <p className="px-2 py-2 text-xs text-gray-400">Nenhum resultado</p>
                            )}
                          </div>
                        )}
                        {matSelecionado && (
                          <div className="flex gap-2 items-center">
                            <Input placeholder="Qtd" value={novoMatQtd} onChange={e => setNovoMatQtd(e.target.value)} className="h-8 text-xs w-24" type="number" min={0} step="0.01" />
                            <span className="text-xs text-gray-500">{matSelecionado.unidadeMedida}</span>
                          </div>
                        )}
                        <div className="flex gap-2">
                          <Button size="sm" className="h-7 text-xs" onClick={handleAdicionarMatAvulso} disabled={!matSelecionado}>Adicionar</Button>
                          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { setShowFormMat(false); setBuscaMat(''); setMatSelecionado(null); setNovoMatQtd(''); }}>Cancelar</Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Resumo de entregas */}
                {entregas.length > 0 && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Entregas do Almoxarifado (toda a obra)</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Descrição</TableHead>
                            <TableHead>Data</TableHead>
                            <TableHead className="text-right">Qtd</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {entregas.map(e => (
                            <TableRow key={e.id}>
                              <TableCell className="text-sm">{e.descricao}</TableCell>
                              <TableCell className="text-sm">{e.dataEntrega}</TableCell>
                              <TableCell className="text-right text-sm">{e.quantidade} {e.unidade}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              {/* ===== ABA MÃO DE OBRA ===== */}
              <TabsContent value="mo" className="mt-4 space-y-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold flex items-center justify-between">
                      <span>Mão de Obra do Fluxo</span>
                      <Button variant="outline" size="sm" onClick={() => setShowFormMO(true)} className="h-7 text-xs">
                        <Plus className="h-3 w-3 mr-1" /> Adicionar
                      </Button>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {fluxoMO.length === 0 ? (
                      <div className="text-center py-6 text-gray-500 text-sm">
                        Nenhuma MO definida. Clique em &quot;Adicionar&quot; ou cadastre recursos na obra.
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Descrição</TableHead>
                            <TableHead className="w-20">Código</TableHead>
                            <TableHead className="w-20">UP</TableHead>
                            <TableHead className="w-24 text-right">Quantidade</TableHead>
                            <TableHead className="w-8"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {fluxoMO.map((item, idx) => (
                            <TableRow key={idx}>
                              <TableCell>
                                <div className="font-medium text-sm">{item.descricao || '—'}</div>
                                <Badge variant="outline" className="text-[10px] px-1 py-0 mt-0.5">
                                  {item.fonte}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-sm text-gray-600">{item.codigo ?? '—'}</TableCell>
                              <TableCell className="text-sm text-gray-600">{item.up ?? '—'}</TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  min={0}
                                  step="0.01"
                                  value={item.quantidade}
                                  onChange={e => updateMOQtd(idx, e.target.value)}
                                  className="h-7 text-right text-sm w-24"
                                />
                              </TableCell>
                              <TableCell>
                                <button onClick={() => removeMO(idx)} className="text-red-400 hover:text-red-600">
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}

                    {/* Formulário busca MO avulsa */}
                    {showFormMO && (
                      <div className="border-2 border-dashed border-orange-300 rounded-lg p-3 space-y-2 bg-orange-50 mt-3">
                        <p className="text-xs font-semibold text-orange-700 flex items-center gap-1">
                          <Search className="h-3 w-3" /> Buscar mão de obra para adicionar
                        </p>
                        <Input
                          placeholder="Buscar por descrição ou código..."
                          value={buscaMO}
                          onChange={e => { setBuscaMO(e.target.value); setMoSelecionado(null); }}
                          className="h-8 text-xs"
                          autoFocus
                        />
                        {buscaMO.trim() && !moSelecionado && (
                          <div className="max-h-40 overflow-y-auto border border-orange-200 rounded bg-white">
                            {listaMO
                              .filter(m => m.descricao.toLowerCase().includes(buscaMO.toLowerCase()) || m.codigoNovo?.toLowerCase().includes(buscaMO.toLowerCase()))
                              .slice(0, 15)
                              .map(m => (
                                <button
                                  key={m.id}
                                  onClick={() => { setMoSelecionado(m); setBuscaMO(m.descricao); }}
                                  className="w-full text-left px-2 py-1.5 text-xs hover:bg-orange-50 border-b border-gray-100 last:border-0"
                                >
                                  <span className="font-medium">{m.descricao}</span>
                                  {m.codigoNovo && <span className="text-gray-400 ml-1">({m.codigoNovo})</span>}
                                  {m.up && <span className="text-gray-400 ml-1">· UP: {m.up}</span>}
                                </button>
                              ))}
                            {listaMO.filter(m => m.descricao.toLowerCase().includes(buscaMO.toLowerCase()) || m.codigoNovo?.toLowerCase().includes(buscaMO.toLowerCase())).length === 0 && (
                              <p className="px-2 py-2 text-xs text-gray-400">Nenhum resultado</p>
                            )}
                          </div>
                        )}
                        {moSelecionado && (
                          <div className="flex gap-2 items-center">
                            <Input placeholder="Qtd" value={novoMOQtd} onChange={e => setNovoMOQtd(e.target.value)} className="h-8 text-xs w-24" type="number" min={0} step="0.01" />
                            {moSelecionado.up && <span className="text-xs text-gray-500">UP: {moSelecionado.up}</span>}
                          </div>
                        )}
                        <div className="flex gap-2">
                          <Button size="sm" className="h-7 text-xs" onClick={handleAdicionarMOAvulso} disabled={!moSelecionado}>Adicionar</Button>
                          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { setShowFormMO(false); setBuscaMO(''); setMoSelecionado(null); setNovoMOQtd(''); }}>Cancelar</Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>

            <div className="flex items-center justify-between pt-4 border-t mt-2">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                {temForaDeReserva ? (
                  <>
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                    <span className="text-amber-700">Há itens fora de reserva (não impeditivo)</span>
                  </>
                ) : fluxoMat.length > 0 || fluxoMO.length > 0 ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <span className="text-green-700">Todos os itens dentro da reserva</span>
                  </>
                ) : null}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
                <Button onClick={handleSave} disabled={saving} className="bg-blue-600 hover:bg-blue-700 text-white">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                  Salvar Fluxo
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
