'use client';

import React, { useState } from 'react';
import { X, Upload, FileSpreadsheet, AlertCircle } from 'lucide-react';
import { NetworkMaintenanceService } from '@/services/networkMaintenanceService';
import { ImportedNetworkMaintenanceData } from '@/types/maintenance-schedule';
import * as XLSX from 'xlsx';

interface ImportExcelModalProps {
  onClose: () => void;
  onImportComplete: () => void;
}

export function ImportExcelModal({ onClose, onImportComplete }: ImportExcelModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  type PreviewRow = Record<string, unknown>;
  const [previewData, setPreviewData] = useState<PreviewRow[]>([]);
  const [error, setError] = useState<string>('');

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setError('');
      previewExcelData(selectedFile);
    }
  };

  const previewExcelData = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet);
        
        setPreviewData(jsonData.slice(0, 5)); // Mostrar apenas 5 linhas de preview
      } catch {
        setError('Erro ao ler o arquivo Excel. Verifique se o formato está correto.');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const processExcelData = (jsonData: Record<string, unknown>[]): ImportedNetworkMaintenanceData[] => {
    const groupedData: Record<string, ImportedNetworkMaintenanceData> = {};

    jsonData.forEach((row) => {
      // Mapear colunas do Excel para os campos esperados
      const date = formatDate(row['Data'] || row['DATE'] || row['data']);
      if (!date) return;

      const getStr = (keys: string[]): string => {
        for (const k of keys) {
          const v = row[k];
          if (typeof v === 'string') return v;
        }
        return '';
      };
      const getNum = (keys: string[]): number => {
        for (const k of keys) {
          const v = row[k];
          if (typeof v === 'number') return v;
          if (typeof v === 'string') {
            const n = parseFloat(v.replace(/[^0-9.,-]/g, '').replace(',', '.'));
            if (!isNaN(n)) return n;
          }
        }
        return 0;
      };

      // Obter o status da ordem (ANTES de normalizar para log)
      const rawStatus = getStr(['Status','STATUS','status', 'SITUAÇÃO', 'Situação']);
      
      // Normalizar o status
      const statusNormalizado = (rawStatus || 'PROG').toUpperCase().trim().replace(/\s+/g, ' ');

      // IMPORTANTE: Filtrar ordens com status ADIADO, ANTECIPADO ou RETIRADO
      // Verificar se contém essas palavras em qualquer parte do status
      if (statusNormalizado.includes('ADIADO') || statusNormalizado.includes('ANTECIPADO') || statusNormalizado.includes('RETIRADO')) {
        console.log(`🚫 IGNORANDO OS com status ADIADO/ANTECIPADO/RETIRADO: "${rawStatus}" (normalizado: "${statusNormalizado}")`);
        return; // PULAR COMPLETAMENTE ESTA ORDEM - NÃO IMPORTAR
      }

      // Mapear status do SharePoint para os valores do sistema
      // SharePoint: CONCLUIDO, CANCELADO, PARCIAL PLANEJADO, PARCIAL NÃO PLANEJADO
      // Sistema: EXEC, CANC, PARP, PANP, PROG
      let statusFinal = 'PROG'; // Padrão
      
      if (statusNormalizado.includes('CONCLUIDO') || statusNormalizado.includes('CONCLUÍDA')) {
        statusFinal = 'EXEC'; // Executada
      } else if (statusNormalizado.includes('CANCELADO') || statusNormalizado.includes('CANCELADA')) {
        statusFinal = 'CANC'; // Cancelada
      } else if (statusNormalizado.includes('PARCIAL') && statusNormalizado.includes('NÃO PLANEJADO')) {
        statusFinal = 'PANP'; // Parcial Não Planejada
      } else if (statusNormalizado.includes('PARCIAL') && statusNormalizado.includes('PLANEJADO')) {
        statusFinal = 'PARP'; // Parcial Planejada
      } else if (statusNormalizado.includes('PROGRAMADO') || statusNormalizado.includes('PROGRAMADA')) {
        statusFinal = 'PROG'; // Programada
      }

      if (!groupedData[date]) {
        groupedData[date] = {
          date,
          activities: []
        };
      }

      // Obter responsável (pode ter múltiplas equipes separadas por / ou |)
      const responsavelRaw = getStr(['Responsável','RESPONSAVEL','Responsavel','responsavel','Equipe','TEAM','equipe']);
      // Obter valor (pode ter múltiplos valores separados por / ou |)
      const valorRaw = row['Valor'] || row['VALUE'] || row['valor'] || row['Valor (R$)'];
      const valorStr = typeof valorRaw === 'string' ? valorRaw : String(valorRaw || '0');

      // Separar responsáveis por / ou |
      const responsaveis = responsavelRaw.split(/[\/|]/).map(r => r.trim()).filter(r => r);
      // Separar valores por / ou |
      const valoresStr = valorStr.split(/[\/|]/).map(v => v.trim()).filter(v => v);
      
      // Converter valores string para número
      const valores = valoresStr.map(v => {
        const n = parseFloat(v.replace(/[^0-9.,-]/g, '').replace(',', '.'));
        return isNaN(n) ? 0 : n;
      });

      // Se não houver responsáveis separados, usar o valor padrão antigo
      if (responsaveis.length === 0) {
        responsaveis.push(getStr(['Equipe','TEAM','equipe']));
      }

      // Se não houver valores separados, usar o valor padrão antigo
      if (valores.length === 0) {
        valores.push(getNum(['Valor','VALUE','valor','Valor (R$)']));
      }

      // Garantir que temos o mesmo número de valores e responsáveis
      // Se tiver menos valores, repetir o último valor
      while (valores.length < responsaveis.length) {
        valores.push(valores[valores.length - 1] || 0);
      }

      // Criar uma atividade para cada responsável/valor
      const osNumber = getStr(['Número OS','OS','os_number','numero_os']);
      const statusNotes = getStr(['Obs. Status','OBS_STATUS','obs_status','Observações Status']);
      const location = getStr(['Localização','Local','LOCATION','localizacao']);
      const notes = getStr(['Observações','NOTES','observacoes']);

      for (let i = 0; i < responsaveis.length; i++) {
        groupedData[date].activities.push({
          team: responsaveis[i],
          osNumber: osNumber,
          value: valores[i],
          status: statusFinal,
          statusNotes: statusNotes,
          location: location,
          notes: notes
        });
      }
    });

    return Object.values(groupedData);
  };

  const formatDate = (dateValue: unknown): string => {
    if (!dateValue) return '';
    
    // Se for um número (data do Excel)
    if (typeof dateValue === 'number') {
      const date = XLSX.SSF.parse_date_code(dateValue);
      return `${date.y}-${date.m.toString().padStart(2, '0')}-${date.d.toString().padStart(2, '0')}`;
    }
    
    // Se for string, tentar converter
    if (typeof dateValue === 'string') {
      const date = new Date(dateValue);
      if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0];
      }
    }
    
    return '';
  };

  // Utilitário reservado para colunas booleanas futuras
  // const parseBoolean = (value: unknown): boolean => {
  //   if (typeof value === 'boolean') return value;
  //   if (typeof value === 'string') {
  //     return value.toLowerCase() === 'sim' || value.toLowerCase() === 'yes' || value === '1';
  //   }
  //   return false;
  // };

  const handleImport = async () => {
    if (!file) return;

    setLoading(true);
    setError('');

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet);

          const processedData = processExcelData(jsonData);
          
          await NetworkMaintenanceService.importFromExcel(processedData);
          
          onImportComplete();
          onClose();
        } catch {
          setError('Erro ao importar dados. Verifique o formato do arquivo.');
        } finally {
          setLoading(false);
        }
      };
      reader.readAsArrayBuffer(file);
    } catch {
      setError('Erro ao processar o arquivo.');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900">Importar Programação do Excel</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Upload Area */}
        <div className="mb-6">
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
            <FileSpreadsheet className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <div className="mb-4">
              <label htmlFor="excel-file" className="cursor-pointer">
                <span className="text-blue-600 hover:text-blue-500">Clique para selecionar</span>
                <span className="text-gray-600"> ou arraste um arquivo Excel aqui</span>
              </label>
              <input
                id="excel-file"
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>
            {file && (
              <p className="text-sm text-gray-600">
                Arquivo selecionado: {file.name}
              </p>
            )}
          </div>
        </div>

        {/* Formato Esperado */}
        <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-medium text-blue-900 mb-2">Formato esperado do Excel:</h3>
          <div className="text-sm text-blue-800 space-y-1">
            <p><strong>Colunas obrigatórias:</strong> Data, Responsável/Equipe, Número OS, Valor, Status, Localização</p>
            <p><strong>Colunas opcionais:</strong> Obs. Status, Observações</p>
            <p className="text-green-700 font-medium mt-2">✅ <strong>MÚLTIPLAS EQUIPES:</strong> Use <code>/</code> ou <code>|</code> para separar equipes e valores</p>
            <p className="ml-4 text-xs">Exemplo: Responsável: &quot;MK 01 | LV 02&quot; e Valor: &quot;1000 | 2000&quot; cria 2 atividades</p>
            <p><strong>Status do SharePoint aceitos:</strong></p>
            <ul className="ml-4 list-disc">
              <li>CONCLUIDO → Executada (EXEC)</li>
              <li>CANCELADO → Cancelada (CANC)</li>
              <li>PARCIAL PLANEJADO → Parcial Planejada (PARP)</li>
              <li>PARCIAL NÃO PLANEJADO → Parcial Não Planejada (PANP)</li>
              <li>PROGRAMADO → Programada (PROG)</li>
            </ul>
            <p className="text-red-700 font-medium mt-2">🚫 Status IGNORADOS: ADIADO, ANTECIPADO e RETIRADO não serão importados</p>
          </div>
        </div>

        {/* Preview */}
        {previewData.length > 0 && (
          <div className="mb-6">
            <h3 className="font-medium text-gray-900 mb-2">Preview dos dados (primeiras 5 linhas):</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full border border-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    {Object.keys(previewData[0]).map(key => (
                      <th key={key} className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        {key}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewData.map((row, index) => (
                    <tr key={index} className="border-t border-gray-200">
                      {Object.values(row).map((value: unknown, cellIndex) => (
                        <td key={cellIndex} className="px-3 py-2 text-sm text-gray-900">
                          {String(value)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center">
              <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
              <span className="text-red-800">{error}</span>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
          >
            Cancelar
          </button>
          <button
            onClick={handleImport}
            disabled={!file || loading}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Importando...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Importar
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}