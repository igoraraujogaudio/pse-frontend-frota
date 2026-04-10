'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { 
  DocumentArrowUpIcon, 
  CheckCircleIcon, 
  XCircleIcon
} from '@heroicons/react/24/outline';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';

interface BulkDismissResult {
  sucessos: Array<{
    matricula: string;
    nome: string;
    data_demissao?: string;
    operacao?: string;
    cargo?: string;
    tipo_demissao?: string;
  }>;
  erros: Array<{
    matricula: string;
    erro: string;
    detalhes?: string;
  }>;
  total: number;
}

interface BulkDismissUploadProps {
  onUploadComplete?: (result: BulkDismissResult) => void;
}

export default function BulkDismissUpload({ onUploadComplete }: BulkDismissUploadProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<BulkDismissResult | null>(null);
  const [showResult, setShowResult] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      toast.error('Por favor, selecione um arquivo Excel (.xlsx ou .xls)');
      return;
    }

    setIsProcessing(true);
    try {
      // Enviar arquivo para API
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/users/dismiss-bulk', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao processar demissões');
      }

      const data = await response.json();
      setResult(data.resultados);
      setShowResult(true);
      
      toast.success(data.message);
      
      if (onUploadComplete) {
        onUploadComplete(data.resultados);
      }

    } catch (error) {
      console.error('Erro no upload:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao processar arquivo');
    } finally {
      setIsProcessing(false);
    }
  };

  // Unused functions removed

  const downloadTemplate = () => {
    // Criar dados para o template Excel
    const data = [
      ['matrícula', 'data_demissão', 'operação', 'cargo', 'tipo_demissão', 'observações'],
      ['12345', 45310, 'Reserva', 'Operador', 'sem_justa_causa', 'Demissão por fim de contrato'], // 45310 = 2024-01-15
      ['67890', 45315, 'Manutenção', 'Técnico', 'pedido_demissao', 'Solicitação do próprio funcionário'] // 45315 = 2024-01-20
    ];

    // Criar workbook e worksheet
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(data);
    
    // Definir formato de data para a coluna data_demissão
    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
    for (let row = 1; row <= range.e.r; row++) { // Pular header (linha 0)
      const cellAddress = XLSX.utils.encode_cell({ r: row, c: 1 }); // Coluna B (data_demissão)
      if (!ws[cellAddress]) continue;
      
      // Definir como número (data serial do Excel)
      ws[cellAddress].t = 'n'; // number type
      ws[cellAddress].z = 'yyyy-mm-dd'; // formato de exibição
    }
    
    XLSX.utils.book_append_sheet(wb, ws, 'Demissões');

    // Baixar arquivo
    XLSX.writeFile(wb, 'template_demissao_bulk.xlsx');
  };

  const resetUpload = () => {
    setResult(null);
    setShowResult(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <>
      <Button 
        onClick={() => setIsOpen(true)}
        variant="outline"
        className="flex items-center gap-2 bg-white/90 hover:bg-white text-gray-800 hover:text-gray-900 border-white/50 font-semibold shadow-lg"
      >
        <DocumentArrowUpIcon className="h-4 w-4" />
        Demissão em Bulk
      </Button>

      <Dialog open={isOpen} onOpenChange={(open) => {
        if (!open) {
          setIsOpen(false);
          resetUpload();
        }
      }}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Demissão em Bulk</DialogTitle>
            <DialogDescription>
              Faça upload de um arquivo Excel (.xlsx) para demitir múltiplos funcionários de uma vez
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Instruções */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Formato do Excel</CardTitle>
                <CardDescription>
                  O arquivo deve conter as seguintes colunas:
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><strong>matrícula</strong> - Matrícula do funcionário (obrigatório)</div>
                  <div><strong>data_demissão</strong> - Data da demissão (opcional - aceita formato YYYY-MM-DD ou número do Excel)</div>
                  <div><strong>operação</strong> - Operação do funcionário (opcional - atualiza se informado)</div>
                  <div><strong>cargo</strong> - Cargo do funcionário (opcional - atualiza se informado)</div>
                  <div><strong>tipo_demissão</strong> - Tipo: sem_justa_causa, com_justa_causa, pedido_demissao, aposentadoria, falecimento, outros</div>
                  <div><strong>observações</strong> - Observações adicionais</div>
                </div>
                <div className="mt-2 p-2 bg-blue-50 rounded text-xs text-blue-700">
                  <strong>💡 Dica sobre datas:</strong> O Excel armazena datas como números. Você pode usar formato de data (15/01/2024) ou número do Excel (45310). 
                  Se não informar, será usada a data atual.
                </div>
              </CardContent>
            </Card>

            {/* Upload */}
            <div className="space-y-4">
              <div className="flex gap-2">
                <Button onClick={downloadTemplate} variant="outline" size="sm">
                  Baixar Template
                </Button>
              </div>
              
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileUpload}
                  disabled={isProcessing}
                  className="hidden"
                />
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isProcessing}
                  variant="outline"
                >
                  {isProcessing ? 'Processando...' : 'Selecionar Arquivo Excel'}
                </Button>
                <p className="text-sm text-gray-500 mt-2">
                  Selecione um arquivo Excel (.xlsx) com os dados dos funcionários
                </p>
              </div>
            </div>

            {/* Resultados */}
            {showResult && result && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Resultado do Processamento</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex gap-4">
                      <Badge variant="default" className="bg-green-500">
                        <CheckCircleIcon className="h-3 w-3 mr-1" />
                        {result.sucessos.length} Sucessos
                      </Badge>
                      <Badge variant="destructive">
                        <XCircleIcon className="h-3 w-3 mr-1" />
                        {result.erros.length} Erros
                      </Badge>
                      <Badge variant="outline">
                        Total: {result.total}
                      </Badge>
                    </div>

                    {result.sucessos.length > 0 && (
                      <div>
                        <h4 className="font-medium text-green-700 mb-2">Funcionários Demitidos:</h4>
                        <div className="max-h-32 overflow-y-auto space-y-1">
                          {result.sucessos.map((sucesso, index) => (
                            <div key={index} className="text-sm text-green-600">
                              {sucesso.matricula} - {sucesso.nome}
                              {sucesso.data_demissao && ` (${sucesso.data_demissao})`}
                              {sucesso.operacao && ` - ${sucesso.operacao}`}
                              {sucesso.cargo && ` - ${sucesso.cargo}`}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {result.erros.length > 0 && (
                      <div>
                        <h4 className="font-medium text-red-700 mb-2">Erros:</h4>
                        <div className="max-h-32 overflow-y-auto space-y-1">
                          {result.erros.map((erro, index) => (
                            <div key={index} className="text-sm text-red-600">
                              {erro.matricula}: {erro.erro}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
