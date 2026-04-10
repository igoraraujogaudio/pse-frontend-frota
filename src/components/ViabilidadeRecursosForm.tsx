'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MateriaisService } from '@/services/materiaisService';
import { MaoDeObraService } from '@/services/maoDeObraService';
import { ViabilidadeRecursosService } from '@/services/viabilidadeRecursosService';
import { ObraMaterial } from '@/types/materiais';
import { ObraMaoDeObra, MaoDeObra } from '@/types/mao-de-obra';
import { Material } from '@/types/materiais';
import { ViabilidadeMaterial, ViabilidadeMaoDeObra, ComparativoItemMaterial, ComparativoItemMO, DecisaoRecurso } from '@/types/viabilidade-recursos';
import {
  Plus, Trash2, Search, Package, HardHat, ArrowRight,
  TrendingUp, TrendingDown, Minus, AlertTriangle, CheckCircle2,
  ChevronRight, RotateCcw
} from 'lucide-react';

const MAX_SELECT = 50;

type Etapa = 'lancamento' | 'comparativo' | 'decisao';

interface Props {
  obraId: string;
  onConcluir: () => void;
  onCancelar: () => void;
}

export function ViabilidadeRecursosForm({ obraId, onConcluir, onCancelar }: Props) {
  const [etapa, setEtapa] = useState<Etapa>('lancamento');
  const [activeTab, setActiveTab] = useState<'materiais' | 'mao-de-obra'>('materiais');
  const [saving, setSaving] = useState(false);
  const [aplicando, setAplicando] = useState(false);

  // Dados originais (cadastro)
  const [originaisMat, setOriginaisMat] = useState<ObraMaterial[]>([]);
  const [originaisMO, setOriginaisMO] = useState<ObraMaoDeObra[]>([]);

  // Dados de viabilidade (o que de fato será usado)
  const [viabMat, setViabMat] = useState<ViabilidadeMaterial[]>([]);
  const [viabMO, setViabMO] = useState<ViabilidadeMaoDeObra[]>([]);

  // Catálogos para busca
  const [catalogoMat, setCatalogoMat] = useState<Material[]>([]);
  const [catalogoMO, setCatalogoMO] = useState<MaoDeObra[]>([]);

  // Form mat
  const [searchMat, setSearchMat] = useState('');
  const [selMatId, setSelMatId] = useState('');
  const [selMatNome, setSelMatNome] = useState('');
  const [qtdMat, setQtdMat] = useState('');
  const [valorMat, setValorMat] = useState('');

  // Form MO
  const [searchMO, setSearchMO] = useState('');
  const [selMOId, setSelMOId] = useState('');
  const [selMONome, setSelMONome] = useState('');
  const [qtdMO, setQtdMO] = useState('');
  const [valorMO, setValorMO] = useState('');

  // Comparativo
  const [comparativoMat, setComparativoMat] = useState<ComparativoItemMaterial[]>([]);
  const [comparativoMO, setComparativoMO] = useState<ComparativoItemMO[]>([]);

  const loadAll = useCallback(async () => {
    const [om, omo, vm, vmo, cat, catmo] = await Promise.all([
      MateriaisService.getObraMateriais(obraId),
      MaoDeObraService.getObraMaoDeObra(obraId),
      ViabilidadeRecursosService.getMateriaisByObra(obraId),
      ViabilidadeRecursosService.getMaoDeObraByObra(obraId),
      MateriaisService.getAll(),
      MaoDeObraService.getAll(),
    ]);
    setOriginaisMat(om);
    setOriginaisMO(omo);
    setViabMat(vm);
    setViabMO(vmo);
    setCatalogoMat(cat);
    setCatalogoMO(catmo);
  }, [obraId]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // ===== Handlers materiais =====
  const handleAddMat = async () => {
    if (!selMatId || !qtdMat) { alert('Selecione o material e informe a quantidade'); return; }
    setSaving(true);
    try {
      const valor = valorMat ? parseFloat(valorMat.replace(/\./g, '').replace(',', '.')) : undefined;
      await ViabilidadeRecursosService.upsertMaterial({
        obraId,
        materialId: selMatId,
        quantidade: parseFloat(qtdMat),
        valorUnitario: valor,
      });
      resetFormMat();
      const updated = await ViabilidadeRecursosService.getMateriaisByObra(obraId);
      setViabMat(updated);
    } catch (e) {
      alert('Erro ao salvar material de viabilidade.');
      console.error(e);
    } finally { setSaving(false); }
  };

  const handleDeleteMat = async (id: string) => {
    if (!confirm('Remover este material da viabilidade?')) return;
    await ViabilidadeRecursosService.deleteMaterial(id);
    setViabMat(prev => prev.filter(v => v.id !== id));
  };

  const resetFormMat = () => { setSelMatId(''); setSelMatNome(''); setQtdMat(''); setValorMat(''); setSearchMat(''); };

  // ===== Handlers MO =====
  const handleAddMO = async () => {
    if (!selMOId || !qtdMO) { alert('Selecione a mão de obra e informe a quantidade'); return; }
    setSaving(true);
    try {
      const mo = catalogoMO.find(m => m.id === selMOId);
      const valor = valorMO ? parseFloat(valorMO.replace(/\./g, '').replace(',', '.')) : mo?.valorUnitario;
      await ViabilidadeRecursosService.upsertMaoDeObra({
        obraId,
        maoDeObraId: selMOId,
        quantidade: parseFloat(qtdMO),
        valorUnitario: valor,
      });
      resetFormMO();
      const updated = await ViabilidadeRecursosService.getMaoDeObraByObra(obraId);
      setViabMO(updated);
    } catch (e) {
      alert('Erro ao salvar mão de obra de viabilidade.');
      console.error(e);
    } finally { setSaving(false); }
  };

  const handleDeleteMO = async (id: string) => {
    if (!confirm('Remover esta mão de obra da viabilidade?')) return;
    await ViabilidadeRecursosService.deleteMaoDeObra(id);
    setViabMO(prev => prev.filter(v => v.id !== id));
  };

  const resetFormMO = () => { setSelMOId(''); setSelMONome(''); setQtdMO(''); setValorMO(''); setSearchMO(''); };

  // ===== Ir para comparativo =====
  const irParaComparativo = () => {
    // Montar comparativo materiais
    const allMatIds = new Set([
      ...originaisMat.map(o => o.materialId),
      ...viabMat.map(v => v.materialId),
    ]);

    const compMat: ComparativoItemMaterial[] = Array.from(allMatIds).map(matId => {
      const orig = originaisMat.find(o => o.materialId === matId);
      const viab = viabMat.find(v => v.materialId === matId);
      const material = orig?.material || viab?.material || catalogoMat.find(m => m.id === matId);

      let status: ComparativoItemMaterial['status'] = 'igual';
      if (!orig) status = 'novo';
      else if (!viab) status = 'removido';
      else if (viab.quantidade > orig.quantidade) status = 'aumentou';
      else if (viab.quantidade < orig.quantidade) status = 'diminuiu';

      // Decidir automaticamente se igual (sem diferença)
      const decisaoAuto: DecisaoRecurso = status === 'igual' ? 'manter_original' : (viab?.decisao || 'pendente');

      return {
        materialId: matId,
        material,
        quantidadeOriginal: orig?.quantidade,
        valorUnitarioOriginal: orig?.valorUnitario,
        valorTotalOriginal: orig?.valorTotal,
        obraMaterialId: orig?.id,
        quantidadeViabilidade: viab?.quantidade,
        valorUnitarioViabilidade: viab?.valorUnitario,
        valorTotalViabilidade: viab?.valorTotal,
        viabilidadeId: viab?.id,
        decisao: decisaoAuto,
        status,
      };
    });

    // Montar comparativo MO
    const allMOIds = new Set([
      ...originaisMO.map(o => o.maoDeObraId),
      ...viabMO.map(v => v.maoDeObraId),
    ]);

    const compMO: ComparativoItemMO[] = Array.from(allMOIds).map(moId => {
      const orig = originaisMO.find(o => o.maoDeObraId === moId);
      const viab = viabMO.find(v => v.maoDeObraId === moId);
      const maoDeObra = orig?.maoDeObra || viab?.maoDeObra || catalogoMO.find(m => m.id === moId);

      let status: ComparativoItemMO['status'] = 'igual';
      if (!orig) status = 'novo';
      else if (!viab) status = 'removido';
      else if (viab.quantidade > orig.quantidade) status = 'aumentou';
      else if (viab.quantidade < orig.quantidade) status = 'diminuiu';

      const decisaoAuto: DecisaoRecurso = status === 'igual' ? 'manter_original' : (viab?.decisao || 'pendente');

      return {
        maoDeObraId: moId,
        maoDeObra,
        quantidadeOriginal: orig?.quantidade,
        valorUnitarioOriginal: orig?.valorUnitario,
        valorTotalOriginal: orig?.valorTotal,
        obraMaoDeObraId: orig?.id,
        quantidadeViabilidade: viab?.quantidade,
        valorUnitarioViabilidade: viab?.valorUnitario,
        valorTotalViabilidade: viab?.valorTotal,
        viabilidadeId: viab?.id,
        decisao: decisaoAuto,
        status,
      };
    });

    setComparativoMat(compMat);
    setComparativoMO(compMO);
    setEtapa('comparativo');
  };

  // ===== Aplicar decisões =====
  const handleAplicar = async () => {
    // Verificar pendentes
    const pendenteMat = comparativoMat.filter(c => c.decisao === 'pendente' && c.status !== 'igual');
    const pendenteMO = comparativoMO.filter(c => c.decisao === 'pendente' && c.status !== 'igual');
    if (pendenteMat.length > 0 || pendenteMO.length > 0) {
      alert(`Ainda há ${pendenteMat.length + pendenteMO.length} item(s) sem decisão. Defina "Manter Original" ou "Usar Viabilidade" para todos.`);
      return;
    }

    setAplicando(true);
    try {
      // Salvar decisões nas tabelas de viabilidade
      for (const item of comparativoMat) {
        if (item.viabilidadeId) {
          await ViabilidadeRecursosService.updateDecisaoMaterial(item.viabilidadeId, item.decisao);
        }
      }
      for (const item of comparativoMO) {
        if (item.viabilidadeId) {
          await ViabilidadeRecursosService.updateDecisaoMaoDeObra(item.viabilidadeId, item.decisao);
        }
      }
      // Aplicar: copiar viabilidade → originais
      await ViabilidadeRecursosService.aplicarDecisoes(obraId);
      onConcluir();
    } catch (e) {
      alert('Erro ao aplicar decisões.');
      console.error(e);
    } finally { setAplicando(false); }
  };

  // ===== Helpers =====
  const filteredCatMat = catalogoMat
    .filter(m => m.descricaoMaterial.toLowerCase().includes(searchMat.toLowerCase()) || m.numeroMaterial.toLowerCase().includes(searchMat.toLowerCase()))
    .slice(0, MAX_SELECT);

  const filteredCatMO = catalogoMO
    .filter(m => m.descricao.toLowerCase().includes(searchMO.toLowerCase()) || m.codigoNovo.toLowerCase().includes(searchMO.toLowerCase()))
    .slice(0, MAX_SELECT);

  const fmtVal = (v?: number) => v != null ? `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '-';
  const fmtQtd = (v?: number) => v != null ? v.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '-';

  const statusBadge = (status: ComparativoItemMaterial['status'] | ComparativoItemMO['status']) => {
    const map = {
      igual: <Badge className="bg-gray-100 text-gray-700 text-xs"><Minus className="h-3 w-3 mr-1" />Igual</Badge>,
      aumentou: <Badge className="bg-orange-100 text-orange-700 text-xs"><TrendingUp className="h-3 w-3 mr-1" />Aumentou</Badge>,
      diminuiu: <Badge className="bg-blue-100 text-blue-700 text-xs"><TrendingDown className="h-3 w-3 mr-1" />Diminuiu</Badge>,
      novo: <Badge className="bg-green-100 text-green-700 text-xs"><Plus className="h-3 w-3 mr-1" />Novo</Badge>,
      removido: <Badge className="bg-red-100 text-red-700 text-xs"><Trash2 className="h-3 w-3 mr-1" />Removido</Badge>,
    };
    return map[status];
  };

  const pendentesCount = comparativoMat.filter(c => c.decisao === 'pendente' && c.status !== 'igual').length
    + comparativoMO.filter(c => c.decisao === 'pendente' && c.status !== 'igual').length;

  // ===================================================
  // RENDER ETAPA 1: LANÇAMENTO
  // ===================================================
  if (etapa === 'lancamento') {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <AlertTriangle className="h-5 w-5 text-yellow-600 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-yellow-800">Recursos de Viabilidade</p>
            <p className="text-xs text-yellow-700">Lance os materiais e mão de obra que serão de fato utilizados. Pode ser diferente do cadastro original.</p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={v => setActiveTab(v as 'materiais' | 'mao-de-obra')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="materiais" className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              Materiais ({viabMat.length})
            </TabsTrigger>
            <TabsTrigger value="mao-de-obra" className="flex items-center gap-2">
              <HardHat className="h-4 w-4" />
              Mão de Obra ({viabMO.length})
            </TabsTrigger>
          </TabsList>

          {/* Tab Materiais */}
          <TabsContent value="materiais" className="space-y-4 mt-3">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Adicionar Material</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs">Material *</Label>
                  {selMatId ? (
                    <div className="flex items-center justify-between p-2 bg-blue-50 border border-blue-200 rounded">
                      <span className="text-sm font-medium">{selMatNome}</span>
                      <Button variant="ghost" size="sm" onClick={resetFormMat}>Trocar</Button>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <div className="relative">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
                        <Input placeholder="Buscar por código ou descrição..." value={searchMat} onChange={e => setSearchMat(e.target.value)} className="pl-8 h-8 text-sm" />
                      </div>
                      {searchMat.length > 1 && (
                        <div className="border rounded max-h-40 overflow-y-auto bg-white shadow-sm">
                          {filteredCatMat.length === 0
                            ? <p className="text-xs text-gray-400 p-2 text-center">Nenhum material encontrado</p>
                            : filteredCatMat.map(m => (
                              <button key={m.id} type="button"
                                className="w-full text-left px-3 py-1.5 text-xs hover:bg-blue-50 border-b last:border-b-0"
                                onClick={() => { setSelMatId(m.id!); setSelMatNome(`${m.numeroMaterial} - ${m.descricaoMaterial}`); setSearchMat(''); }}>
                                <span className="font-medium">{m.numeroMaterial}</span> — {m.descricaoMaterial}
                              </button>
                            ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Quantidade *</Label>
                    <Input type="number" step="0.01" value={qtdMat} onChange={e => setQtdMat(e.target.value)} placeholder="0.00" className="h-8 text-sm" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Valor Unitário (R$)</Label>
                    <Input type="text" value={valorMat}
                      onChange={e => {
                        const v = e.target.value.replace(/\D/g, '');
                        setValorMat(v === '' ? '' : (parseFloat(v) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 }));
                      }}
                      placeholder="0,00" className="h-8 text-sm" />
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button size="sm" onClick={handleAddMat} disabled={saving} className="bg-blue-600 hover:bg-blue-700">
                    <Plus className="h-4 w-4 mr-1" /> Adicionar
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Materiais Lançados na Viabilidade</CardTitle>
                <CardDescription className="text-xs">
                  Original: {originaisMat.length} item(s) · Viabilidade: {viabMat.length} item(s)
                </CardDescription>
              </CardHeader>
              <CardContent>
                {viabMat.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-4">Nenhum material lançado ainda</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Código</TableHead>
                        <TableHead className="text-xs">Descrição</TableHead>
                        <TableHead className="text-xs text-right">Qtd</TableHead>
                        <TableHead className="text-xs text-right">Valor Unit.</TableHead>
                        <TableHead className="text-xs text-right">Total</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {viabMat.map(vm => (
                        <TableRow key={vm.id}>
                          <TableCell className="text-xs font-medium">{vm.material?.numeroMaterial || '-'}</TableCell>
                          <TableCell className="text-xs max-w-[180px] truncate">{vm.material?.descricaoMaterial || '-'}</TableCell>
                          <TableCell className="text-xs text-right">{fmtQtd(vm.quantidade)}</TableCell>
                          <TableCell className="text-xs text-right">{fmtVal(vm.valorUnitario)}</TableCell>
                          <TableCell className="text-xs text-right font-medium text-green-700">{fmtVal(vm.valorTotal)}</TableCell>
                          <TableCell>
                            <Button variant="ghost" size="sm" onClick={() => handleDeleteMat(vm.id!)} className="text-red-500 hover:text-red-700 h-6 w-6 p-0">
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab Mão de Obra */}
          <TabsContent value="mao-de-obra" className="space-y-4 mt-3">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Adicionar Mão de Obra</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs">Serviço *</Label>
                  {selMOId ? (
                    <div className="flex items-center justify-between p-2 bg-orange-50 border border-orange-200 rounded">
                      <span className="text-sm font-medium">{selMONome}</span>
                      <Button variant="ghost" size="sm" onClick={resetFormMO}>Trocar</Button>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <div className="relative">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
                        <Input placeholder="Buscar por código ou descrição..." value={searchMO} onChange={e => setSearchMO(e.target.value)} className="pl-8 h-8 text-sm" />
                      </div>
                      {searchMO.length > 1 && (
                        <div className="border rounded max-h-40 overflow-y-auto bg-white shadow-sm">
                          {filteredCatMO.length === 0
                            ? <p className="text-xs text-gray-400 p-2 text-center">Nenhum serviço encontrado</p>
                            : filteredCatMO.map(m => (
                              <button key={m.id} type="button"
                                className="w-full text-left px-3 py-1.5 text-xs hover:bg-orange-50 border-b last:border-b-0"
                                onClick={() => { setSelMOId(m.id!); setSelMONome(`${m.codigoNovo} - ${m.descricao}`); if (m.valorUnitario) setValorMO(m.valorUnitario.toLocaleString('pt-BR', { minimumFractionDigits: 2 })); setSearchMO(''); }}>
                                <span className="font-medium">{m.codigoNovo}</span> — {m.descricao}
                              </button>
                            ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Quantidade *</Label>
                    <Input type="number" step="0.01" value={qtdMO} onChange={e => setQtdMO(e.target.value)} placeholder="0.00" className="h-8 text-sm" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Valor Unitário (R$)</Label>
                    <Input type="text" value={valorMO}
                      onChange={e => {
                        const v = e.target.value.replace(/\D/g, '');
                        setValorMO(v === '' ? '' : (parseFloat(v) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 }));
                      }}
                      placeholder="0,00" className="h-8 text-sm" />
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button size="sm" onClick={handleAddMO} disabled={saving} className="bg-orange-600 hover:bg-orange-700">
                    <Plus className="h-4 w-4 mr-1" /> Adicionar
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Mão de Obra Lançada na Viabilidade</CardTitle>
                <CardDescription className="text-xs">
                  Original: {originaisMO.length} item(s) · Viabilidade: {viabMO.length} item(s)
                </CardDescription>
              </CardHeader>
              <CardContent>
                {viabMO.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-4">Nenhuma mão de obra lançada ainda</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Código</TableHead>
                        <TableHead className="text-xs">Descrição</TableHead>
                        <TableHead className="text-xs text-right">Qtd</TableHead>
                        <TableHead className="text-xs text-right">Valor Unit.</TableHead>
                        <TableHead className="text-xs text-right">Total</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {viabMO.map(vm => (
                        <TableRow key={vm.id}>
                          <TableCell className="text-xs font-medium">{vm.maoDeObra?.codigoNovo || '-'}</TableCell>
                          <TableCell className="text-xs max-w-[180px] truncate">{vm.maoDeObra?.descricao || '-'}</TableCell>
                          <TableCell className="text-xs text-right">{fmtQtd(vm.quantidade)}</TableCell>
                          <TableCell className="text-xs text-right">{fmtVal(vm.valorUnitario)}</TableCell>
                          <TableCell className="text-xs text-right font-medium text-green-700">{fmtVal(vm.valorTotal)}</TableCell>
                          <TableCell>
                            <Button variant="ghost" size="sm" onClick={() => handleDeleteMO(vm.id!)} className="text-red-500 hover:text-red-700 h-6 w-6 p-0">
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="flex justify-between pt-2 border-t">
          <Button variant="outline" onClick={onCancelar}>Cancelar</Button>
          <Button onClick={irParaComparativo} className="bg-blue-600 hover:bg-blue-700">
            Ver Comparativo <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </div>
    );
  }

  // ===================================================
  // RENDER ETAPA 2 + 3: COMPARATIVO + DECISÃO (juntas)
  // ===================================================
  const renderDecisaoButtons = (
    item: ComparativoItemMaterial | ComparativoItemMO,
    onDecisao: (decisao: DecisaoRecurso) => void
  ) => {
    if (item.status === 'igual') {
      return <Badge className="bg-gray-100 text-gray-600 text-xs">Sem alteração</Badge>;
    }
    return (
      <div className="flex gap-1">
        <button
          type="button"
          onClick={() => onDecisao('manter_original')}
          className={`px-2 py-1 rounded text-xs font-medium border transition-colors ${
            item.decisao === 'manter_original'
              ? 'bg-blue-600 text-white border-blue-600'
              : 'bg-white text-blue-600 border-blue-300 hover:bg-blue-50'
          }`}
        >
          <RotateCcw className="h-3 w-3 inline mr-1" />Manter Original
        </button>
        <button
          type="button"
          onClick={() => onDecisao('usar_viabilidade')}
          className={`px-2 py-1 rounded text-xs font-medium border transition-colors ${
            item.decisao === 'usar_viabilidade'
              ? 'bg-green-600 text-white border-green-600'
              : 'bg-white text-green-600 border-green-300 hover:bg-green-50'
          }`}
        >
          <CheckCircle2 className="h-3 w-3 inline mr-1" />Usar Viabilidade
        </button>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Header comparativo */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ArrowRight className="h-5 w-5 text-blue-600" />
          <div>
            <p className="text-sm font-bold text-gray-900">Comparativo: Original vs Viabilidade</p>
            <p className="text-xs text-gray-500">Decida o que manter ou atualizar em cada item com diferença</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => setEtapa('lancamento')}>
          ← Voltar ao Lançamento
        </Button>
      </div>

      {pendentesCount > 0 && (
        <div className="flex items-center gap-2 p-2 bg-amber-50 border border-amber-300 rounded text-xs text-amber-800">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {pendentesCount} item(s) ainda precisam de decisão
        </div>
      )}

      <Tabs value={activeTab} onValueChange={v => setActiveTab(v as 'materiais' | 'mao-de-obra')}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="materiais">
            <Package className="h-4 w-4 mr-2" />
            Materiais ({comparativoMat.length})
          </TabsTrigger>
          <TabsTrigger value="mao-de-obra">
            <HardHat className="h-4 w-4 mr-2" />
            Mão de Obra ({comparativoMO.length})
          </TabsTrigger>
        </TabsList>

        {/* Comparativo Materiais */}
        <TabsContent value="materiais" className="mt-3">
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="text-left p-2 font-medium text-gray-600">Material</th>
                      <th className="text-center p-2 font-medium text-gray-600">Status</th>
                      <th className="text-right p-2 font-medium text-blue-700">Qtd Original</th>
                      <th className="text-right p-2 font-medium text-blue-700">Total Original</th>
                      <th className="text-right p-2 font-medium text-green-700">Qtd Viabilidade</th>
                      <th className="text-right p-2 font-medium text-green-700">Total Viabilidade</th>
                      <th className="text-center p-2 font-medium text-gray-600">Decisão</th>
                    </tr>
                  </thead>
                  <tbody>
                    {comparativoMat.map((item, i) => (
                      <tr key={item.materialId} className={`border-b ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'} ${item.decisao === 'pendente' && item.status !== 'igual' ? 'bg-amber-50' : ''}`}>
                        <td className="p-2">
                          <p className="font-medium">{item.material?.numeroMaterial || '-'}</p>
                          <p className="text-gray-500 truncate max-w-[160px]">{item.material?.descricaoMaterial || '-'}</p>
                        </td>
                        <td className="p-2 text-center">{statusBadge(item.status)}</td>
                        <td className="p-2 text-right text-blue-800">{fmtQtd(item.quantidadeOriginal)}</td>
                        <td className="p-2 text-right text-blue-800">{fmtVal(item.valorTotalOriginal)}</td>
                        <td className="p-2 text-right text-green-800">{fmtQtd(item.quantidadeViabilidade)}</td>
                        <td className="p-2 text-right text-green-800">{fmtVal(item.valorTotalViabilidade)}</td>
                        <td className="p-2 text-center">
                          {renderDecisaoButtons(item, (d) => {
                            setComparativoMat(prev => prev.map(c => c.materialId === item.materialId ? { ...c, decisao: d } : c));
                          })}
                        </td>
                      </tr>
                    ))}
                    {comparativoMat.length === 0 && (
                      <tr><td colSpan={7} className="p-4 text-center text-gray-400">Nenhum material para comparar</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Comparativo MO */}
        <TabsContent value="mao-de-obra" className="mt-3">
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="text-left p-2 font-medium text-gray-600">Serviço</th>
                      <th className="text-center p-2 font-medium text-gray-600">Status</th>
                      <th className="text-right p-2 font-medium text-blue-700">Qtd Original</th>
                      <th className="text-right p-2 font-medium text-blue-700">Total Original</th>
                      <th className="text-right p-2 font-medium text-green-700">Qtd Viabilidade</th>
                      <th className="text-right p-2 font-medium text-green-700">Total Viabilidade</th>
                      <th className="text-center p-2 font-medium text-gray-600">Decisão</th>
                    </tr>
                  </thead>
                  <tbody>
                    {comparativoMO.map((item, i) => (
                      <tr key={item.maoDeObraId} className={`border-b ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'} ${item.decisao === 'pendente' && item.status !== 'igual' ? 'bg-amber-50' : ''}`}>
                        <td className="p-2">
                          <p className="font-medium">{item.maoDeObra?.codigoNovo || '-'}</p>
                          <p className="text-gray-500 truncate max-w-[160px]">{item.maoDeObra?.descricao || '-'}</p>
                        </td>
                        <td className="p-2 text-center">{statusBadge(item.status)}</td>
                        <td className="p-2 text-right text-blue-800">{fmtQtd(item.quantidadeOriginal)}</td>
                        <td className="p-2 text-right text-blue-800">{fmtVal(item.valorTotalOriginal)}</td>
                        <td className="p-2 text-right text-green-800">{fmtQtd(item.quantidadeViabilidade)}</td>
                        <td className="p-2 text-right text-green-800">{fmtVal(item.valorTotalViabilidade)}</td>
                        <td className="p-2 text-center">
                          {renderDecisaoButtons(item, (d) => {
                            setComparativoMO(prev => prev.map(c => c.maoDeObraId === item.maoDeObraId ? { ...c, decisao: d } : c));
                          })}
                        </td>
                      </tr>
                    ))}
                    {comparativoMO.length === 0 && (
                      <tr><td colSpan={7} className="p-4 text-center text-gray-400">Nenhuma mão de obra para comparar</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="flex justify-between pt-2 border-t">
        <Button variant="outline" onClick={onCancelar}>Cancelar</Button>
        <Button
          onClick={handleAplicar}
          disabled={aplicando || pendentesCount > 0}
          className="bg-green-600 hover:bg-green-700"
        >
          {aplicando ? (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
          ) : (
            <CheckCircle2 className="h-4 w-4 mr-2" />
          )}
          Aplicar Decisões e Avançar
        </Button>
      </div>
    </div>
  );
}
