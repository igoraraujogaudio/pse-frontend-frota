'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ObraManutencao } from '@/types/obras-manutencao';
import { ObraMaterial } from '@/types/materiais';
import { ObraMaoDeObra } from '@/types/mao-de-obra';
import { ViabilidadeMaterial, ViabilidadeMaoDeObra, ComparativoItemMaterial, ComparativoItemMO } from '@/types/viabilidade-recursos';
import { MateriaisService } from '@/services/materiaisService';
import { MaoDeObraService } from '@/services/maoDeObraService';
import { ViabilidadeRecursosService } from '@/services/viabilidadeRecursosService';
import { ObraMaterialRetirado, DESTINO_LABELS, DESTINO_COLORS } from '@/types/obra-material-retirado';
import { ObraMaterialRetiradoService } from '@/services/obraMaterialRetiradoService';
import { ObraRecursosCorrigidosService } from '@/services/obraRecursosCorrigidosService';
import { ObraMaterialCorrigido, ObraMaoDeObraCorrigida } from '@/types/obra-recursos-corrigidos';
import { FileDown, FileSpreadsheet, Plus, Loader2, Upload, Trash2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface Props { obra: ObraManutencao; basesMap?: Map<string, string>; }

const fmtQtd = (v?: number) => v != null ? v.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '—';
const fmtR$  = (v?: number) => v != null ? `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '—';

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  igual:    { label: 'Igual',     cls: 'bg-gray-100 text-gray-600' },
  aumentou: { label: 'Aumentou',  cls: 'bg-orange-100 text-orange-700' },
  diminuiu: { label: 'Diminuiu',  cls: 'bg-blue-100 text-blue-700' },
  novo:     { label: 'Novo',      cls: 'bg-green-100 text-green-700' },
  removido: { label: 'Removido',  cls: 'bg-red-100 text-red-700' },
};

// ===== helpers =====
function buildCompMat(orig: ObraMaterial[], viab: ViabilidadeMaterial[]): ComparativoItemMaterial[] {
  const map = new Map<string, ComparativoItemMaterial>();
  for (const o of orig) {
    map.set(o.materialId, { materialId: o.materialId, material: o.material, quantidadeOriginal: o.quantidade, valorUnitarioOriginal: o.valorUnitario, valorTotalOriginal: o.valorTotal, obraMaterialId: o.id, decisao: 'pendente', status: 'removido' });
  }
  for (const v of viab) {
    const e = map.get(v.materialId);
    if (e) { e.quantidadeViabilidade = v.quantidade; e.valorUnitarioViabilidade = v.valorUnitario; e.valorTotalViabilidade = v.valorTotal; e.viabilidadeId = v.id; e.decisao = v.decisao; const d = v.quantidade - (e.quantidadeOriginal ?? 0); e.status = d === 0 ? 'igual' : d > 0 ? 'aumentou' : 'diminuiu'; }
    else { map.set(v.materialId, { materialId: v.materialId, material: v.material, quantidadeViabilidade: v.quantidade, valorUnitarioViabilidade: v.valorUnitario, valorTotalViabilidade: v.valorTotal, viabilidadeId: v.id, decisao: v.decisao, status: 'novo' }); }
  }
  return Array.from(map.values());
}
function buildCompMO(orig: ObraMaoDeObra[], viab: ViabilidadeMaoDeObra[]): ComparativoItemMO[] {
  const map = new Map<string, ComparativoItemMO>();
  for (const o of orig) {
    map.set(o.maoDeObraId, { maoDeObraId: o.maoDeObraId, maoDeObra: o.maoDeObra, quantidadeOriginal: o.quantidade, valorUnitarioOriginal: o.valorUnitario, valorTotalOriginal: o.valorTotal, obraMaoDeObraId: o.id, decisao: 'pendente', status: 'removido' });
  }
  for (const v of viab) {
    const e = map.get(v.maoDeObraId);
    if (e) { e.quantidadeViabilidade = v.quantidade; e.valorUnitarioViabilidade = v.valorUnitario; e.valorTotalViabilidade = v.valorTotal; e.viabilidadeId = v.id; e.decisao = v.decisao; const d = v.quantidade - (e.quantidadeOriginal ?? 0); e.status = d === 0 ? 'igual' : d > 0 ? 'aumentou' : 'diminuiu'; }
    else { map.set(v.maoDeObraId, { maoDeObraId: v.maoDeObraId, maoDeObra: v.maoDeObra, quantidadeViabilidade: v.quantidade, valorUnitarioViabilidade: v.valorUnitario, valorTotalViabilidade: v.valorTotal, viabilidadeId: v.id, decisao: v.decisao, status: 'novo' }); }
  }
  return Array.from(map.values());
}

export function ComparativoViabilidade({ obra, basesMap }: Props) {
  const baseNome = basesMap?.get(obra.base) || obra.base;
  const [loading, setLoading] = useState(true);
  const [compMat, setCompMat] = useState<ComparativoItemMaterial[]>([]);
  const [compMO,  setCompMO]  = useState<ComparativoItemMO[]>([]);
  const [retirados, setRetirados] = useState<ObraMaterialRetirado[]>([]);
  const [corrigidosMat, setCorrigidosMat] = useState<ObraMaterialCorrigido[]>([]);
  const [corrigidosMO,  setCorrigidosMO]  = useState<ObraMaoDeObraCorrigida[]>([]);
  const [savingCorr, setSavingCorr] = useState(false);

  // form manual material corrigido
  const [cMatDesc, setCMatDesc] = useState('');
  const [cMatNum,  setCMatNum]  = useState('');
  const [cMatUn,   setCMatUn]   = useState('UN');
  const [cMatQtd,  setCMatQtd]  = useState('');
  const [cMatVu,   setCMatVu]   = useState('');

  // form manual MO corrigida
  const [cMODesc, setCMODesc] = useState('');
  const [cMOCod,  setCMOCod]  = useState('');
  const [cMOUp,   setCMOUp]   = useState('');
  const [cMOQtd,  setCMOQtd]  = useState('');
  const [cMOVu,   setCMOVu]   = useState('');

  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [origMat, origMO, viabMat, viabMO, ret, corrMat, corrMO] = await Promise.all([
        MateriaisService.getObraMateriais(obra.id!),
        MaoDeObraService.getObraMaoDeObra(obra.id!),
        ViabilidadeRecursosService.getMateriaisByObra(obra.id!),
        ViabilidadeRecursosService.getMaoDeObraByObra(obra.id!),
        ObraMaterialRetiradoService.getByObra(obra.id!),
        ObraRecursosCorrigidosService.getMateriaisByObra(obra.id!),
        ObraRecursosCorrigidosService.getMaoDeObraByObra(obra.id!),
      ]);
      setCompMat(buildCompMat(origMat, viabMat));
      setCompMO(buildCompMO(origMO, viabMO));
      setRetirados(ret);
      setCorrigidosMat(corrMat);
      setCorrigidosMO(corrMO);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [obra.id]);

  useEffect(() => { load(); }, [load]);

  // totais
  const tOrigMat  = compMat.reduce((s, r) => s + (r.valorTotalOriginal ?? 0), 0);
  const tViabMat  = compMat.reduce((s, r) => s + (r.valorTotalViabilidade ?? 0), 0);
  const tCorrMat  = corrigidosMat.reduce((s, r) => s + (r.valorTotal ?? 0), 0);
  const tOrigMO   = compMO.reduce((s, r) => s + (r.valorTotalOriginal ?? 0), 0);
  const tViabMO   = compMO.reduce((s, r) => s + (r.valorTotalViabilidade ?? 0), 0);
  const tCorrMO   = corrigidosMO.reduce((s, r) => s + (r.valorTotal ?? 0), 0);

  // ===== upload planilha corrigida =====
  const handleUploadPlanilha = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSavingCorr(true);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf);
      // espera aba 'Materiais' e aba 'Mão de Obra'
      const wsMat = wb.Sheets[wb.SheetNames[0]];
      const wsMO  = wb.Sheets[wb.SheetNames[1]];
      const rowsMat: Record<string, unknown>[] = XLSX.utils.sheet_to_json(wsMat, { defval: '' });
      const rowsMO:  Record<string, unknown>[] = wsMO ? XLSX.utils.sheet_to_json(wsMO, { defval: '' }) : [];

      const matItems = rowsMat
        .filter(r => r['Descrição'] || r['Descricao'])
        .map(r => ({
          descricaoMaterial: String(r['Descrição'] || r['Descricao'] || ''),
          numeroMaterial:    String(r['Nº Material'] || r['Numero'] || ''),
          unidadeMedida:     String(r['UN'] || r['Unidade'] || 'UN'),
          quantidade:        parseFloat(String(r['Quantidade'] || r['Qtd'] || 0)) || 0,
          valorUnitario:     parseFloat(String(r['Valor Unit.'] || r['Valor Unitario'] || 0)) || undefined,
        }));

      const moItems = rowsMO
        .filter(r => r['Descrição'] || r['Descricao'])
        .map(r => ({
          descricao:    String(r['Descrição'] || r['Descricao'] || ''),
          codigo:       String(r['Código'] || r['Codigo'] || ''),
          up:           String(r['UP'] || ''),
          quantidade:   parseFloat(String(r['Quantidade'] || r['Qtd'] || 0)) || 0,
          valorUnitario: parseFloat(String(r['Valor Unit.'] || r['Valor Unitario'] || 0)) || undefined,
        }));

      await ObraRecursosCorrigidosService.upsertMaterial(obra.id!, matItems);
      await ObraRecursosCorrigidosService.upsertMaoDeObra(obra.id!, moItems);
      const [corrMat, corrMO] = await Promise.all([
        ObraRecursosCorrigidosService.getMateriaisByObra(obra.id!),
        ObraRecursosCorrigidosService.getMaoDeObraByObra(obra.id!),
      ]);
      setCorrigidosMat(corrMat);
      setCorrigidosMO(corrMO);
    } catch (err) {
      alert('Erro ao importar planilha. Verifique o formato.');
      console.error(err);
    } finally {
      setSavingCorr(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const addMatCorrigido = async () => {
    if (!cMatDesc || !cMatQtd) return;
    setSavingCorr(true);
    try {
      const novo = await ObraRecursosCorrigidosService.addMaterial({ obraId: obra.id!, descricaoMaterial: cMatDesc, numeroMaterial: cMatNum, unidadeMedida: cMatUn, quantidade: parseFloat(cMatQtd), valorUnitario: cMatVu ? parseFloat(cMatVu) : undefined });
      setCorrigidosMat(p => [...p, novo]);
      setCMatDesc(''); setCMatNum(''); setCMatUn('UN'); setCMatQtd(''); setCMatVu('');
    } finally { setSavingCorr(false); }
  };

  const addMOCorrigida = async () => {
    if (!cMODesc || !cMOQtd) return;
    setSavingCorr(true);
    try {
      const novo = await ObraRecursosCorrigidosService.addMaoDeObra({ obraId: obra.id!, descricao: cMODesc, codigo: cMOCod, up: cMOUp, quantidade: parseFloat(cMOQtd), valorUnitario: cMOVu ? parseFloat(cMOVu) : undefined });
      setCorrigidosMO(p => [...p, novo]);
      setCMODesc(''); setCMOCod(''); setCMOUp(''); setCMOQtd(''); setCMOVu('');
    } finally { setSavingCorr(false); }
  };

  // ===== exportações =====
  const exportExcel = () => {
    const wb = XLSX.utils.book_new();
    const info = [`Obra: ${obra.numeroProjeto}`, '', `Município: ${obra.municipio}`, '', `Base: ${baseNome}`];

    const wsMat = XLSX.utils.aoa_to_sheet([
      ['COMPARATIVO DE MATERIAIS'], info, [],
      ['Nº Material','Descrição','UN','Qtd Original','Total Orig.','Qtd Viabilidade','Total Viab.','Qtd Corrigido','Total Corrigido','Δ Orig→Viab','Δ Viab→Corr','Status'],
      ...compMat.map(r => [
        r.material?.numeroMaterial ?? '', r.material?.descricaoMaterial ?? '', r.material?.unidadeMedida ?? '',
        r.quantidadeOriginal ?? '', r.valorTotalOriginal ?? '',
        r.quantidadeViabilidade ?? '', r.valorTotalViabilidade ?? '',
        corrigidosMat.find(c => c.numeroMaterial === r.material?.numeroMaterial)?.quantidade ?? '',
        corrigidosMat.find(c => c.numeroMaterial === r.material?.numeroMaterial)?.valorTotal ?? '',
        r.quantidadeViabilidade != null && r.quantidadeOriginal != null ? r.quantidadeViabilidade - r.quantidadeOriginal : '',
        '',
        STATUS_BADGE[r.status]?.label ?? '',
      ]),
      [], ['', '', '', 'TOTAL ORIGINAL', tOrigMat, 'TOTAL VIABILIDADE', tViabMat, 'TOTAL CORRIGIDO', tCorrMat],
    ]);
    XLSX.utils.book_append_sheet(wb, wsMat, 'Materiais');

    const wsMO = XLSX.utils.aoa_to_sheet([
      ['COMPARATIVO DE MÃO DE OBRA'], info, [],
      ['Código','Descrição','UP','Qtd Original','Total Orig.','Qtd Viabilidade','Total Viab.','Qtd Corrigido','Total Corrigido','Δ Orig→Viab','Status'],
      ...compMO.map(r => [
        r.maoDeObra?.codigoNovo ?? '', r.maoDeObra?.descricao ?? '', r.maoDeObra?.up ?? '',
        r.quantidadeOriginal ?? '', r.valorTotalOriginal ?? '',
        r.quantidadeViabilidade ?? '', r.valorTotalViabilidade ?? '',
        '', '', r.quantidadeViabilidade != null && r.quantidadeOriginal != null ? r.quantidadeViabilidade - r.quantidadeOriginal : '',
        STATUS_BADGE[r.status]?.label ?? '',
      ]),
      [], ['', '', '', 'TOTAL ORIGINAL', tOrigMO, 'TOTAL VIABILIDADE', tViabMO, 'TOTAL CORRIGIDO', tCorrMO],
    ]);
    XLSX.utils.book_append_sheet(wb, wsMO, 'Mão de Obra');

    const wsRet = XLSX.utils.aoa_to_sheet([
      ['MATERIAL RETIRADO'], info, [],
      ['Nº Material','Descrição','UN','Quantidade','Destino','Observações'],
      ...retirados.map(r => [r.numeroMaterial ?? '', r.descricaoMaterial ?? '', r.unidadeMedida ?? '', r.quantidade, DESTINO_LABELS[r.destino], r.observacoes ?? '']),
    ]);
    XLSX.utils.book_append_sheet(wb, wsRet, 'Mat. Retirado');

    XLSX.writeFile(wb, `Comparativo_${obra.numeroProjeto}_${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  const exportPDF = () => {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const hdr = (t: string) => {
      doc.setFontSize(12); doc.setFont('helvetica','bold'); doc.text(t, 14, 13);
      doc.setFontSize(8); doc.setFont('helvetica','normal');
      doc.text(`Obra: ${obra.numeroProjeto}  |  Município: ${obra.municipio}  |  Base: ${baseNome}  |  ${new Date().toLocaleDateString('pt-BR')}`, 14, 19);
    };
    const st = { fontSize: 7, cellPadding: 1.5 };
    const hs = { fillColor: [30,64,175] as [number,number,number], textColor: 255 as number };
    const fs = { fillColor: [235,235,235] as [number,number,number], fontStyle: 'bold' as const };

    hdr('COMPARATIVO MATERIAIS — Original vs Viabilidade vs Corrigido (Equatorial)');
    autoTable(doc, { startY: 23,
      head: [['Nº Mat.','Descrição','UN','Qtd Orig.','Total Orig.','Qtd Viab.','Total Viab.','Qtd Corr.','Total Corr.','Δ','Status']],
      body: compMat.map(r => [
        r.material?.numeroMaterial??'—', r.material?.descricaoMaterial??'—', r.material?.unidadeMedida??'—',
        fmtQtd(r.quantidadeOriginal), fmtR$(r.valorTotalOriginal),
        fmtQtd(r.quantidadeViabilidade), fmtR$(r.valorTotalViabilidade),
        fmtQtd(corrigidosMat.find(c=>c.numeroMaterial===r.material?.numeroMaterial)?.quantidade),
        fmtR$(corrigidosMat.find(c=>c.numeroMaterial===r.material?.numeroMaterial)?.valorTotal),
        r.quantidadeViabilidade!=null&&r.quantidadeOriginal!=null ? fmtQtd(r.quantidadeViabilidade-r.quantidadeOriginal) : '—',
        STATUS_BADGE[r.status]?.label??'',
      ]),
      foot:[['','','','Orig.',fmtR$(tOrigMat),'Viab.',fmtR$(tViabMat),'Corr.',fmtR$(tCorrMat),'','']],
      styles:st, headStyles:hs, footStyles:fs, columnStyles:{1:{cellWidth:55}},
    });

    doc.addPage();
    hdr('COMPARATIVO MÃO DE OBRA — Original vs Viabilidade vs Corrigido (Equatorial)');
    autoTable(doc, { startY: 23,
      head: [['Código','Descrição','UP','Qtd Orig.','Total Orig.','Qtd Viab.','Total Viab.','Qtd Corr.','Total Corr.','Δ','Status']],
      body: compMO.map(r => [
        r.maoDeObra?.codigoNovo??'—', r.maoDeObra?.descricao??'—', r.maoDeObra?.up??'—',
        fmtQtd(r.quantidadeOriginal), fmtR$(r.valorTotalOriginal),
        fmtQtd(r.quantidadeViabilidade), fmtR$(r.valorTotalViabilidade),
        '—','—',
        r.quantidadeViabilidade!=null&&r.quantidadeOriginal!=null ? fmtQtd(r.quantidadeViabilidade-r.quantidadeOriginal) : '—',
        STATUS_BADGE[r.status]?.label??'',
      ]),
      foot:[['','','','Orig.',fmtR$(tOrigMO),'Viab.',fmtR$(tViabMO),'Corr.',fmtR$(tCorrMO),'','']],
      styles:st, headStyles:hs, footStyles:fs, columnStyles:{1:{cellWidth:65}},
    });

    if (retirados.length > 0) {
      doc.addPage(); hdr('MATERIAL RETIRADO EM CAMPO');
      autoTable(doc, { startY: 23,
        head:[['Nº Material','Descrição','UN','Quantidade','Destino','Obs.']],
        body: retirados.map(r=>[r.numeroMaterial??'—',r.descricaoMaterial??'—',r.unidadeMedida??'—',fmtQtd(r.quantidade),DESTINO_LABELS[r.destino],r.observacoes??'']),
        styles:st, headStyles:hs, columnStyles:{1:{cellWidth:70}},
      });
    }
    doc.save(`Comparativo_${obra.numeroProjeto}_${new Date().toISOString().slice(0,10)}.pdf`);
  };

  if (loading) return (
    <div className="flex items-center justify-center py-16 text-gray-400">
      <Loader2 className="h-6 w-6 animate-spin mr-2" />
      <span className="text-sm">Carregando comparativo...</span>
    </div>
  );

  // ===== RENDER =====
  return (
    <div className="space-y-4">

      {/* Totais + exportação */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {/* ORIGINAL */}
          <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 min-w-[130px]">
            <p className="text-[10px] font-semibold uppercase text-gray-400">🔵 Original</p>
            <p className="text-base font-bold text-gray-700">{fmtR$(tOrigMat + tOrigMO)}</p>
            <p className="text-[10px] text-gray-400">Mat {fmtR$(tOrigMat)} · MO {fmtR$(tOrigMO)}</p>
          </div>
          {/* VIABILIDADE */}
          <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 min-w-[130px]">
            <p className="text-[10px] font-semibold uppercase text-amber-600">🟡 Viabilidade</p>
            <p className="text-base font-bold text-amber-700">{fmtR$(tViabMat + tViabMO)}</p>
            <p className="text-[10px] text-amber-500">Mat {fmtR$(tViabMat)} · MO {fmtR$(tViabMO)}</p>
          </div>
          {/* CORRIGIDO */}
          <div className="rounded-lg border border-green-300 bg-green-50 px-3 py-2 min-w-[130px]">
            <p className="text-[10px] font-semibold uppercase text-green-600">✅ Corrigido (Equatorial)</p>
            <p className="text-base font-bold text-green-700">{fmtR$(tCorrMat + tCorrMO)}</p>
            <p className="text-[10px] text-green-500">Mat {fmtR$(tCorrMat)} · MO {fmtR$(tCorrMO)}</p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={exportExcel} className="gap-1.5">
            <FileSpreadsheet className="h-4 w-4 text-green-600" /> Excel
          </Button>
          <Button variant="outline" size="sm" onClick={exportPDF} className="gap-1.5">
            <FileDown className="h-4 w-4 text-red-600" /> PDF
          </Button>
        </div>
      </div>

      {/* Tabs das 3 seções */}
      <Tabs defaultValue="materiais">
        <TabsList className="w-full grid grid-cols-4">
          <TabsTrigger value="materiais" className="text-xs">Materiais ({compMat.length})</TabsTrigger>
          <TabsTrigger value="mao-de-obra" className="text-xs">Mão de Obra ({compMO.length})</TabsTrigger>
          <TabsTrigger value="retirado" className="text-xs">Mat. Retirado ({retirados.length})</TabsTrigger>
          <TabsTrigger value="corrigido" className="text-xs text-green-700 font-semibold">✅ Corrigido Equatorial</TabsTrigger>
        </TabsList>

        {/* ===== MATERIAIS ===== */}
        <TabsContent value="materiais" className="mt-3">
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="text-[11px]">
                      <TableHead className="w-24 bg-gray-50">Nº Material</TableHead>
                      <TableHead className="bg-gray-50">Descrição</TableHead>
                      <TableHead className="w-10 bg-gray-50">UN</TableHead>
                      {/* Original */}
                      <TableHead className="text-right bg-blue-50 text-blue-700 font-bold border-l border-blue-200">Qtd Orig.</TableHead>
                      <TableHead className="text-right bg-blue-50 text-blue-700 font-bold">Total Orig.</TableHead>
                      {/* Viabilidade */}
                      <TableHead className="text-right bg-amber-50 text-amber-700 font-bold border-l border-amber-200">Qtd Viab.</TableHead>
                      <TableHead className="text-right bg-amber-50 text-amber-700 font-bold">Total Viab.</TableHead>
                      {/* Corrigido */}
                      <TableHead className="text-right bg-green-50 text-green-700 font-bold border-l border-green-200">Qtd Corr.</TableHead>
                      <TableHead className="text-right bg-green-50 text-green-700 font-bold">Total Corr.</TableHead>
                      <TableHead className="text-center bg-gray-50 w-20">Δ</TableHead>
                      <TableHead className="text-center bg-gray-50 w-20">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {compMat.length === 0 && (
                      <TableRow><TableCell colSpan={11} className="text-center py-8 text-gray-400 text-sm">Nenhum material registrado</TableCell></TableRow>
                    )}
                    {compMat.map((r, i) => {
                      const corr = corrigidosMat.find(c => c.numeroMaterial === r.material?.numeroMaterial || c.descricaoMaterial === r.material?.descricaoMaterial);
                      const diff = r.quantidadeViabilidade != null && r.quantidadeOriginal != null ? r.quantidadeViabilidade - r.quantidadeOriginal : null;
                      const sb = STATUS_BADGE[r.status];
                      return (
                        <TableRow key={r.materialId + i} className="text-[11px]">
                          <TableCell className="font-mono text-gray-500">{r.material?.numeroMaterial ?? '—'}</TableCell>
                          <TableCell className="max-w-[180px] truncate font-medium">{r.material?.descricaoMaterial ?? '—'}</TableCell>
                          <TableCell className="text-gray-400">{r.material?.unidadeMedida ?? '—'}</TableCell>
                          <TableCell className="text-right bg-blue-50/60 border-l border-blue-100">{fmtQtd(r.quantidadeOriginal)}</TableCell>
                          <TableCell className="text-right bg-blue-50/60 text-blue-700">{fmtR$(r.valorTotalOriginal)}</TableCell>
                          <TableCell className="text-right bg-amber-50/60 border-l border-amber-100 font-medium">{fmtQtd(r.quantidadeViabilidade)}</TableCell>
                          <TableCell className="text-right bg-amber-50/60 text-amber-700 font-medium">{fmtR$(r.valorTotalViabilidade)}</TableCell>
                          <TableCell className="text-right bg-green-50/60 border-l border-green-100 font-medium">{fmtQtd(corr?.quantidade)}</TableCell>
                          <TableCell className="text-right bg-green-50/60 text-green-700 font-medium">{fmtR$(corr?.valorTotal)}</TableCell>
                          <TableCell className="text-center">
                            {diff != null ? <span className={diff > 0 ? 'text-orange-600 font-semibold' : diff < 0 ? 'text-green-600 font-semibold' : 'text-gray-400'}>{diff > 0 ? '+' : ''}{fmtQtd(diff)}</span> : '—'}
                          </TableCell>
                          <TableCell className="text-center">
                            <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium ${sb.cls}`}>{sb.label}</span>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              <div className="flex gap-6 justify-end px-4 py-2 bg-gray-50 border-t text-xs font-medium">
                <span className="text-blue-700">🔵 Orig: {fmtR$(tOrigMat)}</span>
                <span className="text-amber-700">🟡 Viab: {fmtR$(tViabMat)}</span>
                <span className="text-green-700">✅ Corr: {fmtR$(tCorrMat)}</span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== MÃO DE OBRA ===== */}
        <TabsContent value="mao-de-obra" className="mt-3">
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="text-[11px]">
                      <TableHead className="w-24 bg-gray-50">Código</TableHead>
                      <TableHead className="bg-gray-50">Descrição</TableHead>
                      <TableHead className="w-12 bg-gray-50">UP</TableHead>
                      <TableHead className="text-right bg-blue-50 text-blue-700 font-bold border-l border-blue-200">Qtd Orig.</TableHead>
                      <TableHead className="text-right bg-blue-50 text-blue-700 font-bold">Total Orig.</TableHead>
                      <TableHead className="text-right bg-amber-50 text-amber-700 font-bold border-l border-amber-200">Qtd Viab.</TableHead>
                      <TableHead className="text-right bg-amber-50 text-amber-700 font-bold">Total Viab.</TableHead>
                      <TableHead className="text-right bg-green-50 text-green-700 font-bold border-l border-green-200">Qtd Corr.</TableHead>
                      <TableHead className="text-right bg-green-50 text-green-700 font-bold">Total Corr.</TableHead>
                      <TableHead className="text-center bg-gray-50 w-20">Δ</TableHead>
                      <TableHead className="text-center bg-gray-50 w-20">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {compMO.length === 0 && (
                      <TableRow><TableCell colSpan={11} className="text-center py-8 text-gray-400 text-sm">Nenhuma mão de obra registrada</TableCell></TableRow>
                    )}
                    {compMO.map((r, i) => {
                      const corr = corrigidosMO.find(c => c.codigo === r.maoDeObra?.codigoNovo || c.descricao === r.maoDeObra?.descricao);
                      const diff = r.quantidadeViabilidade != null && r.quantidadeOriginal != null ? r.quantidadeViabilidade - r.quantidadeOriginal : null;
                      const sb = STATUS_BADGE[r.status];
                      return (
                        <TableRow key={r.maoDeObraId + i} className="text-[11px]">
                          <TableCell className="font-mono text-gray-500">{r.maoDeObra?.codigoNovo ?? '—'}</TableCell>
                          <TableCell className="max-w-[180px] truncate font-medium">{r.maoDeObra?.descricao ?? '—'}</TableCell>
                          <TableCell className="text-gray-400">{r.maoDeObra?.up ?? '—'}</TableCell>
                          <TableCell className="text-right bg-blue-50/60 border-l border-blue-100">{fmtQtd(r.quantidadeOriginal)}</TableCell>
                          <TableCell className="text-right bg-blue-50/60 text-blue-700">{fmtR$(r.valorTotalOriginal)}</TableCell>
                          <TableCell className="text-right bg-amber-50/60 border-l border-amber-100 font-medium">{fmtQtd(r.quantidadeViabilidade)}</TableCell>
                          <TableCell className="text-right bg-amber-50/60 text-amber-700 font-medium">{fmtR$(r.valorTotalViabilidade)}</TableCell>
                          <TableCell className="text-right bg-green-50/60 border-l border-green-100 font-medium">{fmtQtd(corr?.quantidade)}</TableCell>
                          <TableCell className="text-right bg-green-50/60 text-green-700 font-medium">{fmtR$(corr?.valorTotal)}</TableCell>
                          <TableCell className="text-center">
                            {diff != null ? <span className={diff > 0 ? 'text-orange-600 font-semibold' : diff < 0 ? 'text-green-600 font-semibold' : 'text-gray-400'}>{diff > 0 ? '+' : ''}{fmtQtd(diff)}</span> : '—'}
                          </TableCell>
                          <TableCell className="text-center">
                            <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium ${sb.cls}`}>{sb.label}</span>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              <div className="flex gap-6 justify-end px-4 py-2 bg-gray-50 border-t text-xs font-medium">
                <span className="text-blue-700">🔵 Orig: {fmtR$(tOrigMO)}</span>
                <span className="text-amber-700">🟡 Viab: {fmtR$(tViabMO)}</span>
                <span className="text-green-700">✅ Corr: {fmtR$(tCorrMO)}</span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== MATERIAL RETIRADO ===== */}
        <TabsContent value="retirado" className="mt-3">
          <Card>
            <CardContent className="p-0">
              {retirados.length === 0 ? (
                <p className="text-center py-10 text-sm text-gray-400">Nenhum material retirado registrado</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="text-[11px] bg-gray-50">
                        <TableHead>Nº Material</TableHead><TableHead>Descrição</TableHead><TableHead>UN</TableHead>
                        <TableHead className="text-right">Quantidade</TableHead><TableHead className="text-center">Destino</TableHead><TableHead>Obs.</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {retirados.map(r => (
                        <TableRow key={r.id} className="text-[11px]">
                          <TableCell className="font-mono">{r.numeroMaterial??'—'}</TableCell>
                          <TableCell className="truncate max-w-[200px]">{r.descricaoMaterial??'—'}</TableCell>
                          <TableCell>{r.unidadeMedida??'—'}</TableCell>
                          <TableCell className="text-right">{fmtQtd(r.quantidade)}</TableCell>
                          <TableCell className="text-center"><Badge className={`text-[10px] ${DESTINO_COLORS[r.destino]}`}>{DESTINO_LABELS[r.destino]}</Badge></TableCell>
                          <TableCell className="text-gray-400">{r.observacoes??''}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== CORRIGIDO EQUATORIAL ===== */}
        <TabsContent value="corrigido" className="mt-3 space-y-4">
          {/* Upload planilha */}
          <Card className="border-green-200 bg-green-50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-green-800 flex items-center gap-2"><Upload className="h-4 w-4" /> Importar Planilha Corrigida (Equatorial)</CardTitle>
              <CardDescription className="text-xs text-green-700">Faça upload da planilha Excel enviada pela Equatorial. Aba 1 = Materiais, Aba 2 = Mão de Obra. Colunas esperadas: Descrição, Nº Material, UN, Quantidade, Valor Unit.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleUploadPlanilha} className="hidden" />
                <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={savingCorr} className="gap-2 border-green-400 text-green-700">
                  {savingCorr ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
                  Selecionar planilha...
                </Button>
                <span className="text-xs text-green-600">O upload substitui todos os itens corrigidos anteriores.</span>
              </div>
            </CardContent>
          </Card>

          {/* Entrada manual — Materiais */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Materiais Corrigidos ({corrigidosMat.length})</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-6 gap-2">
                <div className="col-span-2 space-y-1"><Label className="text-xs">Descrição *</Label><Input value={cMatDesc} onChange={e=>setCMatDesc(e.target.value)} placeholder="Ex: Cabo 16mm²" className="h-8 text-xs" /></div>
                <div className="space-y-1"><Label className="text-xs">Nº Material</Label><Input value={cMatNum} onChange={e=>setCMatNum(e.target.value)} placeholder="Cód." className="h-8 text-xs" /></div>
                <div className="space-y-1"><Label className="text-xs">UN</Label><Input value={cMatUn} onChange={e=>setCMatUn(e.target.value)} placeholder="UN" className="h-8 text-xs" /></div>
                <div className="space-y-1"><Label className="text-xs">Qtd *</Label><Input type="number" value={cMatQtd} onChange={e=>setCMatQtd(e.target.value)} placeholder="0" className="h-8 text-xs" /></div>
                <div className="space-y-1"><Label className="text-xs">Vlr Unit.</Label><Input type="number" value={cMatVu} onChange={e=>setCMatVu(e.target.value)} placeholder="0,00" className="h-8 text-xs" /></div>
              </div>
              <div className="flex justify-end"><Button size="sm" onClick={addMatCorrigido} disabled={savingCorr||!cMatDesc||!cMatQtd} className="gap-1 bg-green-600 hover:bg-green-700"><Plus className="h-3.5 w-3.5" />Adicionar</Button></div>
              {corrigidosMat.length > 0 && (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader><TableRow className="text-[11px] bg-gray-50"><TableHead>Nº</TableHead><TableHead>Descrição</TableHead><TableHead>UN</TableHead><TableHead className="text-right">Qtd</TableHead><TableHead className="text-right">Vlr Unit.</TableHead><TableHead className="text-right">Total</TableHead><TableHead /></TableRow></TableHeader>
                    <TableBody>
                      {corrigidosMat.map(r => (
                        <TableRow key={r.id} className="text-[11px]">
                          <TableCell className="font-mono">{r.numeroMaterial??'—'}</TableCell>
                          <TableCell className="truncate max-w-[160px]">{r.descricaoMaterial??'—'}</TableCell>
                          <TableCell>{r.unidadeMedida??'—'}</TableCell>
                          <TableCell className="text-right">{fmtQtd(r.quantidade)}</TableCell>
                          <TableCell className="text-right">{fmtR$(r.valorUnitario)}</TableCell>
                          <TableCell className="text-right font-medium text-green-700">{fmtR$(r.valorTotal)}</TableCell>
                          <TableCell><Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-red-400" onClick={async()=>{await ObraRecursosCorrigidosService.deleteMaterial(r.id!);setCorrigidosMat(p=>p.filter(x=>x.id!==r.id));}}><Trash2 className="h-3.5 w-3.5"/></Button></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
              <div className="flex justify-end text-xs font-medium text-green-700">Total Materiais Corrigidos: {fmtR$(tCorrMat)}</div>
            </CardContent>
          </Card>

          {/* Entrada manual — MO */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Mão de Obra Corrigida ({corrigidosMO.length})</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-6 gap-2">
                <div className="col-span-2 space-y-1"><Label className="text-xs">Descrição *</Label><Input value={cMODesc} onChange={e=>setCMODesc(e.target.value)} placeholder="Ex: Instalação de poste" className="h-8 text-xs" /></div>
                <div className="space-y-1"><Label className="text-xs">Código</Label><Input value={cMOCod} onChange={e=>setCMOCod(e.target.value)} placeholder="Cód." className="h-8 text-xs" /></div>
                <div className="space-y-1"><Label className="text-xs">UP</Label><Input value={cMOUp} onChange={e=>setCMOUp(e.target.value)} placeholder="UP" className="h-8 text-xs" /></div>
                <div className="space-y-1"><Label className="text-xs">Qtd *</Label><Input type="number" value={cMOQtd} onChange={e=>setCMOQtd(e.target.value)} placeholder="0" className="h-8 text-xs" /></div>
                <div className="space-y-1"><Label className="text-xs">Vlr Unit.</Label><Input type="number" value={cMOVu} onChange={e=>setCMOVu(e.target.value)} placeholder="0,00" className="h-8 text-xs" /></div>
              </div>
              <div className="flex justify-end"><Button size="sm" onClick={addMOCorrigida} disabled={savingCorr||!cMODesc||!cMOQtd} className="gap-1 bg-green-600 hover:bg-green-700"><Plus className="h-3.5 w-3.5" />Adicionar</Button></div>
              {corrigidosMO.length > 0 && (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader><TableRow className="text-[11px] bg-gray-50"><TableHead>Código</TableHead><TableHead>Descrição</TableHead><TableHead>UP</TableHead><TableHead className="text-right">Qtd</TableHead><TableHead className="text-right">Vlr Unit.</TableHead><TableHead className="text-right">Total</TableHead><TableHead /></TableRow></TableHeader>
                    <TableBody>
                      {corrigidosMO.map(r => (
                        <TableRow key={r.id} className="text-[11px]">
                          <TableCell className="font-mono">{r.codigo??'—'}</TableCell>
                          <TableCell className="truncate max-w-[160px]">{r.descricao??'—'}</TableCell>
                          <TableCell>{r.up??'—'}</TableCell>
                          <TableCell className="text-right">{fmtQtd(r.quantidade)}</TableCell>
                          <TableCell className="text-right">{fmtR$(r.valorUnitario)}</TableCell>
                          <TableCell className="text-right font-medium text-green-700">{fmtR$(r.valorTotal)}</TableCell>
                          <TableCell><Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-red-400" onClick={async()=>{await ObraRecursosCorrigidosService.deleteMaoDeObra(r.id!);setCorrigidosMO(p=>p.filter(x=>x.id!==r.id));}}><Trash2 className="h-3.5 w-3.5"/></Button></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
              <div className="flex justify-end text-xs font-medium text-green-700">Total MO Corrigida: {fmtR$(tCorrMO)}</div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
