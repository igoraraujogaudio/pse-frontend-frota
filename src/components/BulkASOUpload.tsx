'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { DocumentArrowUpIcon, DocumentTextIcon } from '@heroicons/react/24/outline';
import * as XLSX from 'xlsx';

interface BulkASOUploadProps {
  onSuccess?: () => void;
}

export default function BulkASOUpload({ onSuccess }: BulkASOUploadProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const downloadTemplate = () => {
    // Criar planilha de exemplo
    const templateData = [
      ['matrícula', 'data_aso'],
      ['12345', '2024-10-13'],
      ['67890', '15/10/2024'],
      ['11186', '45922'], // Formato Excel (número)
    ];

    const ws = XLSX.utils.aoa_to_sheet(templateData);
    
    // Definir formato de data para a coluna data_aso
    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
    for (let row = 1; row <= range.e.r; row++) {
      const cellAddress = XLSX.utils.encode_cell({ r: row, c: 1 }); // Coluna B (data_aso)
      if (ws[cellAddress]) {
        ws[cellAddress].z = 'dd/mm/yyyy';
      }
    }

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template ASO');
    XLSX.writeFile(wb, 'template_upload_aso.xlsx');

    toast.success('Template baixado com sucesso!');
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/funcionarios/bulk-upload-aso', {
        method: 'POST',
        body: formData
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Erro ao processar arquivo');
      }

      // Mostrar resultado
      const { results } = result;
      
      if (results.erros.length === 0) {
        toast.success(
          `✅ Upload concluído com sucesso!\n${results.atualizados.length} ASOs atualizados`,
          { duration: 5000 }
        );
      } else if (results.atualizados.length > 0) {
        toast.warning(
          `⚠️ Upload parcialmente concluído\n✅ ${results.atualizados.length} atualizados\n❌ ${results.erros.length} erros`,
          { duration: 7000 }
        );
      } else {
        toast.error(
          `❌ Nenhum ASO foi atualizado\n${results.erros.length} erros encontrados`,
          { duration: 7000 }
        );
      }

      // Log detalhado no console
      console.log('📊 Resultado do Upload de ASO:', {
        total: results.total,
        atualizados: results.atualizados.length,
        erros: results.erros.length,
        detalhes: results
      });

      // Mostrar erros específicos se houver
      if (results.erros.length > 0 && results.erros.length <= 5) {
        results.erros.forEach((erro: { linha: number; erro: string; matricula?: string }) => {
          toast.error(
            `Linha ${erro.linha}: ${erro.erro}`,
            { duration: 5000 }
          );
        });
      }

      setIsOpen(false);
      if (onSuccess) onSuccess();

    } catch (error) {
      console.error('Erro no upload:', error);
      toast.error(
        error instanceof Error ? error.message : 'Erro ao fazer upload'
      );
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <DocumentArrowUpIcon className="h-5 w-5" />
          Upload ASO em Bulk
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <DocumentTextIcon className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <DialogTitle>Upload de ASO em Bulk</DialogTitle>
              <DialogDescription>
                Atualize as datas de ASO de múltiplos funcionários de uma vez
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Instruções */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold text-blue-900 mb-2">📋 Como funciona:</h3>
            <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
              <li>Faça upload de um arquivo Excel (.xlsx)</li>
              <li>O arquivo deve conter as colunas: <strong>matrícula</strong> e <strong>data_aso</strong></li>
              <li>A data do ASO pode estar em vários formatos (YYYY-MM-DD, DD/MM/YYYY ou número do Excel)</li>
              <li>O sistema calcula automaticamente a <strong>validade do ASO</strong> (1 ano após o exame)</li>
            </ul>
          </div>

          {/* Formato das Colunas */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 mb-3">📊 Colunas do arquivo:</h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-start gap-2">
                <span className="font-mono bg-white px-2 py-1 rounded border">matrícula</span>
                <span className="text-gray-600">- Matrícula do funcionário (obrigatório)</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="font-mono bg-white px-2 py-1 rounded border">data_aso</span>
                <span className="text-gray-600">- Data do último exame ASO (obrigatório)</span>
              </div>
            </div>
          </div>

          {/* Exemplo */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 mb-3">📝 Exemplo:</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border border-gray-300 px-4 py-2 text-left font-mono">matrícula</th>
                    <th className="border border-gray-300 px-4 py-2 text-left font-mono">data_aso</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border border-gray-300 px-4 py-2">12345</td>
                    <td className="border border-gray-300 px-4 py-2">2024-10-13</td>
                  </tr>
                  <tr>
                    <td className="border border-gray-300 px-4 py-2">67890</td>
                    <td className="border border-gray-300 px-4 py-2">15/10/2024</td>
                  </tr>
                  <tr>
                    <td className="border border-gray-300 px-4 py-2">11186</td>
                    <td className="border border-gray-300 px-4 py-2">45922</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Botões */}
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={downloadTemplate}
              className="flex-1 gap-2"
            >
              <DocumentArrowUpIcon className="h-5 w-5" />
              Baixar Template
            </Button>

            <div className="flex-1">
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileChange}
                disabled={isUploading}
                className="hidden"
                id="bulk-aso-upload-input"
              />
              <label htmlFor="bulk-aso-upload-input" className="block">
                <Button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="w-full gap-2"
                >
                  {isUploading ? (
                    <>
                      <span className="animate-spin">⏳</span>
                      Processando...
                    </>
                  ) : (
                    <>
                      <DocumentArrowUpIcon className="h-5 w-5" />
                      Selecionar Arquivo
                    </>
                  )}
                </Button>
              </label>
            </div>
          </div>

          {/* Avisos */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
            <p className="text-sm text-yellow-800">
              <strong>⚠️ Importante:</strong> Esta ação irá atualizar a data do último exame ASO e a validade do ASO dos funcionários listados no arquivo.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}



