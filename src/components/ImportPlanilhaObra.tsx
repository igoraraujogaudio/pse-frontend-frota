'use client';

import React, { useState, useRef } from 'react';
import { Upload, Download, Trash2, FileSpreadsheet, Package, HardHat, AlertCircle, CheckCircle2 } from 'lucide-react';
import * as XLSX from 'xlsx';

export interface MaterialImportRow {
  numeroMaterial: string;
  quantidade: number;
}

export interface MaoDeObraImportRow {
  codigoNovo: string;
  quantidade: number;
}

interface ImportPlanilhaObraProps {
  materiaisImport: MaterialImportRow[];
  setMateriaisImport: (items: MaterialImportRow[]) => void;
  maoDeObraImport: MaoDeObraImportRow[];
  setMaoDeObraImport: (items: MaoDeObraImportRow[]) => void;
}

function downloadTemplateMateriais() {
  const headers = [
    ['CODIGO_NOVO', 'QUANTIDADE'],
    ['MAT-001', 10],
    ['MAT-002', 500],
    ['MAT-003', 2],
  ];

  const ws = XLSX.utils.aoa_to_sheet(headers);
  ws['!cols'] = [
    { wch: 20 },
    { wch: 12 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Materiais');
  XLSX.writeFile(wb, 'template_materiais_obra.xlsx');
}

function downloadTemplateMaoDeObra() {
  const headers = [
    ['CODIGO_NOVO', 'QUANTIDADE'],
    ['COD-001', 5],
    ['COD-002', 500],
    ['COD-003', 2],
  ];

  const ws = XLSX.utils.aoa_to_sheet(headers);
  ws['!cols'] = [
    { wch: 15 },
    { wch: 12 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Mao de Obra');
  XLSX.writeFile(wb, 'template_mao_de_obra_obra.xlsx');
}

function parseMateriaisFile(file: File): Promise<MaterialImportRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' });

        const items: MaterialImportRow[] = rows.map((row: Record<string, unknown>) => ({
          numeroMaterial: String(row['CODIGO_NOVO'] || row['codigo_novo'] || row['Codigo Novo'] || row['CodigoNovo'] || row['NUMERO_MATERIAL'] || row['numero_material'] || row['CODIGO'] || row['codigo'] || '').trim(),
          quantidade: parseFloat(String(row['QUANTIDADE'] || row['quantidade'] || row['Quantidade'] || row['QTD'] || 0)) || 0,
        })).filter((item: MaterialImportRow) => item.numeroMaterial && item.quantidade > 0);

        resolve(items);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

function parseMaoDeObraFile(file: File): Promise<MaoDeObraImportRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' });

        const items: MaoDeObraImportRow[] = rows.map((row: Record<string, unknown>) => ({
          codigoNovo: String(row['CODIGO_NOVO'] || row['codigo_novo'] || row['Codigo Novo'] || row['CodigoNovo'] || row['CODIGOS NOVOS'] || row['CODIGO'] || row['codigo'] || '').trim(),
          quantidade: parseFloat(String(row['QUANTIDADE'] || row['quantidade'] || row['Quantidade'] || row['QTD'] || 0)) || 0,
        })).filter((item: MaoDeObraImportRow) => item.codigoNovo && item.quantidade > 0);

        resolve(items);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

export default function ImportPlanilhaObra({ materiaisImport, setMateriaisImport, maoDeObraImport, setMaoDeObraImport }: ImportPlanilhaObraProps) {
  const [loadingMat, setLoadingMat] = useState(false);
  const [loadingMO, setLoadingMO] = useState(false);
  const [errorMat, setErrorMat] = useState<string | null>(null);
  const [errorMO, setErrorMO] = useState<string | null>(null);
  const fileRefMat = useRef<HTMLInputElement>(null);
  const fileRefMO = useRef<HTMLInputElement>(null);

  const handleMateriaisFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoadingMat(true);
    setErrorMat(null);
    try {
      const items = await parseMateriaisFile(file);
      if (items.length === 0) {
        setErrorMat('Nenhum item válido encontrado. Verifique as colunas CODIGO_NOVO e QUANTIDADE.');
      } else {
        setMateriaisImport(items);
      }
    } catch {
      setErrorMat('Erro ao ler a planilha. Verifique o formato do arquivo.');
    } finally {
      setLoadingMat(false);
      if (fileRefMat.current) fileRefMat.current.value = '';
    }
  };

  const handleMOFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoadingMO(true);
    setErrorMO(null);
    try {
      const items = await parseMaoDeObraFile(file);
      if (items.length === 0) {
        setErrorMO('Nenhum item válido encontrado. Verifique as colunas CODIGO_NOVO e QUANTIDADE.');
      } else {
        setMaoDeObraImport(items);
      }
    } catch {
      setErrorMO('Erro ao ler a planilha. Verifique o formato do arquivo.');
    } finally {
      setLoadingMO(false);
      if (fileRefMO.current) fileRefMO.current.value = '';
    }
  };

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1">
        <FileSpreadsheet className="h-3 w-3" /> Planilhas de Reserva
      </p>

      <div className="grid grid-cols-2 gap-2">
        {/* MATERIAIS */}
        <div className="border rounded-lg p-2 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold flex items-center gap-1"><Package className="h-3 w-3 text-blue-500" />Materiais</span>
            <button type="button" onClick={downloadTemplateMateriais} className="text-xs text-blue-600 border border-blue-300 rounded px-2 py-0.5 hover:bg-blue-50 flex items-center gap-1 transition-colors">
              <Download className="h-3 w-3" /> Template
            </button>
          </div>

          <input ref={fileRefMat} type="file" accept=".xlsx,.xls,.csv" onChange={handleMateriaisFile} className="hidden" />

          {materiaisImport.length === 0 ? (
            <>
              <button type="button" onClick={() => fileRefMat.current?.click()} disabled={loadingMat} className="w-full border-2 border-dashed rounded-md py-3 text-center hover:border-blue-400 transition-colors">
                {loadingMat ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mx-auto" />
                ) : (
                  <>
                    <Upload className="h-4 w-4 text-blue-400 mx-auto" />
                    <p className="text-[10px] text-gray-500 mt-0.5">Importar .xlsx</p>
                  </>
                )}
              </button>
              {errorMat && <p className="text-[10px] text-red-500 flex items-center gap-1"><AlertCircle className="h-3 w-3" />{errorMat}</p>}
            </>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-green-600 flex items-center gap-1"><CheckCircle2 className="h-3 w-3" />{materiaisImport.length} itens</span>
                <button type="button" onClick={() => setMateriaisImport([])} className="text-[10px] text-red-500 hover:underline flex items-center gap-0.5"><Trash2 className="h-2.5 w-2.5" />Limpar</button>
              </div>
              <div className="max-h-28 overflow-y-auto border rounded text-[10px]">
                {materiaisImport.map((m, i) => (
                  <div key={i} className="flex justify-between px-1.5 py-0.5 border-b last:border-b-0 hover:bg-gray-50">
                    <span className="truncate flex-1"><span className="font-medium">{m.numeroMaterial}</span></span>
                    <span className="text-gray-500 ml-2 whitespace-nowrap">x{m.quantidade}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* MÃO DE OBRA */}
        <div className="border rounded-lg p-2 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold flex items-center gap-1"><HardHat className="h-3 w-3 text-orange-500" />Mão de Obra</span>
            <button type="button" onClick={downloadTemplateMaoDeObra} className="text-xs text-orange-600 border border-orange-300 rounded px-2 py-0.5 hover:bg-orange-50 flex items-center gap-1 transition-colors">
              <Download className="h-3 w-3" /> Template
            </button>
          </div>

          <input ref={fileRefMO} type="file" accept=".xlsx,.xls,.csv" onChange={handleMOFile} className="hidden" />

          {maoDeObraImport.length === 0 ? (
            <>
              <button type="button" onClick={() => fileRefMO.current?.click()} disabled={loadingMO} className="w-full border-2 border-dashed rounded-md py-3 text-center hover:border-orange-400 transition-colors">
                {loadingMO ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-orange-600 mx-auto" />
                ) : (
                  <>
                    <Upload className="h-4 w-4 text-orange-400 mx-auto" />
                    <p className="text-[10px] text-gray-500 mt-0.5">Importar .xlsx</p>
                  </>
                )}
              </button>
              {errorMO && <p className="text-[10px] text-red-500 flex items-center gap-1"><AlertCircle className="h-3 w-3" />{errorMO}</p>}
            </>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-green-600 flex items-center gap-1"><CheckCircle2 className="h-3 w-3" />{maoDeObraImport.length} itens</span>
                <button type="button" onClick={() => setMaoDeObraImport([])} className="text-[10px] text-red-500 hover:underline flex items-center gap-0.5"><Trash2 className="h-2.5 w-2.5" />Limpar</button>
              </div>
              <div className="max-h-28 overflow-y-auto border rounded text-[10px]">
                {maoDeObraImport.map((m, i) => (
                  <div key={i} className="flex justify-between px-1.5 py-0.5 border-b last:border-b-0 hover:bg-gray-50">
                    <span className="truncate flex-1"><span className="font-medium">{m.codigoNovo}</span></span>
                    <span className="text-gray-500 ml-2 whitespace-nowrap">x{m.quantidade}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export { ImportPlanilhaObra };
