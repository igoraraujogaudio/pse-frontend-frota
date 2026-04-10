'use client';

import { useState, useRef } from 'react';
import { useMutation } from '@tanstack/react-query';
import { DocumentArrowUpIcon, CloudArrowUpIcon, CheckCircleIcon, ExclamationTriangleIcon, XCircleIcon } from '@heroicons/react/24/outline';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
// import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'; // TODO: Use when needed
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { useNotification } from '@/contexts/NotificationContext';
// import { contratoService } from '@/services/contratoService'; // TODO: Use when needed
// import { baseService } from '@/services/baseService'; // TODO: Use when needed
import type { Vehicle } from '@/types';

interface UploadResult {
  success: boolean;
  placa: string;
  contrato?: string;
  action?: 'criado' | 'transferido' | 'atualizado' | 'ignorado';
  error?: string;
  vehicle?: Vehicle;
}

export default function BulkUploadPage() {
  const { notify } = useNotification();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Estados do formulário
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  
  // Estados do upload
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadResults, setUploadResults] = useState<UploadResult[]>([]);
  const [showResults, setShowResults] = useState(false);

  // Mutation para upload em massa
  const bulkUploadMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const response = await fetch('/api/vehicles/bulk-upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Erro no upload');
      }

      return response.json();
    },
    onSuccess: (data) => {
      setUploadResults(data.results);
      setShowResults(true);
      setIsUploading(false);
      setUploadProgress(100);
      
      const successful = data.results.filter((r: UploadResult) => r.success).length;
      const failed = data.results.filter((r: UploadResult) => !r.success).length;
      const created = data.results.filter((r: UploadResult) => r.success && r.action === 'criado').length;
      const transferred = data.results.filter((r: UploadResult) => r.success && r.action === 'transferido').length;
      const updated = data.results.filter((r: UploadResult) => r.success && r.action === 'atualizado').length;
      const ignored = data.results.filter((r: UploadResult) => r.success && r.action === 'ignorado').length;
      
      if (failed === 0) {
        let message = `${successful} veículos processados com sucesso!`;
        if (created > 0) message += ` ${created} criados`;
        if (transferred > 0) message += `, ${transferred} transferidos`;
        if (updated > 0) message += `, ${updated} atualizados`;
        if (ignored > 0) message += `, ${ignored} ignorados`;
        notify(message, "success");
      } else {
        let message = `${successful} veículos processados, ${failed} falharam.`;
        if (created > 0) message += ` ${created} criados`;
        if (transferred > 0) message += `, ${transferred} transferidos`;
        if (updated > 0) message += `, ${updated} atualizados`;
        if (ignored > 0) message += `, ${ignored} ignorados`;
        notify(message, "warning");
      }
    },
    onError: (error) => {
      console.error('Erro no upload:', error);
      notify(error.message || 'Erro no upload em massa', "error");
      setIsUploading(false);
      setUploadProgress(0);
    },
  });

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validar tipo de arquivo
      if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
        notify('Apenas arquivos Excel (.xlsx, .xls) são aceitos', "error");
        return;
      }
      
      setSelectedFile(file);
      setShowResults(false);
      setUploadResults([]);
    }
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (file) {
      if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
        notify('Apenas arquivos Excel (.xlsx, .xls) são aceitos', "error");
        return;
      }
      setSelectedFile(file);
      setShowResults(false);
      setUploadResults([]);
    }
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      notify('Selecione um arquivo Excel', "error");
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    // Simular progresso
    const progressInterval = setInterval(() => {
      setUploadProgress(prev => {
        if (prev >= 90) {
          clearInterval(progressInterval);
          return prev;
        }
        return prev + 10;
      });
    }, 200);

    const formData = new FormData();
    formData.append('file', selectedFile);

    bulkUploadMutation.mutate(formData);
  };

  const resetForm = () => {
    setSelectedFile(null);
    setShowResults(false);
    setUploadResults([]);
    setUploadProgress(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const downloadTemplate = () => {
    // Criar dados do template
    const templateData = [
      {
        contrato: 'Obras São Paulo',
        placa: 'ABC-1234',
        modelo: 'Civic',
        tipo_modelo: 'Sedan',
        ano_fabricacao: 2020,
        ano_modelo: 2020,
        renavam: '123456789',
        chassis: '1HGBH41JXMN123456',
        marca_equipamento: 'Honda',
        tipo_combustivel: 'Flex',
        quilometragem_atual: 50000,
        numero_crlv: 'CRLV123456',
        versao: 'EXL',
        tipo_veiculo: 'Automóvel',
        valor_aluguel: 1500,
        propriedade: 'Próprio',
        condicao: 'Bom',
        giroflex: false,
        camera: true,
        tracker: true,
        rastreador: 'Tracker001',
        operacao_combustivel: 'Operação A',
        prefixo_fixo: 'P001'
      },
      {
        contrato: 'Manutenção SP',
        placa: 'DEF5678',
        modelo: 'Corolla',
        tipo_modelo: 'Sedan',
        ano_fabricacao: 2021,
        ano_modelo: 2021,
        renavam: '987654321',
        chassis: '1HGBH41JXMN789012',
        marca_equipamento: 'Toyota',
        tipo_combustivel: 'Flex',
        quilometragem_atual: 30000,
        numero_crlv: 'CRLV789012',
        versao: 'XEI',
        tipo_veiculo: 'Automóvel',
        valor_aluguel: 1800,
        propriedade: 'Próprio',
        condicao: 'Excelente',
        giroflex: false,
        camera: true,
        tracker: true,
        rastreador: 'Tracker002',
        operacao_combustivel: 'Operação B',
        prefixo_fixo: 'P002'
      }
    ];

    // Converter para CSV
    const headers = Object.keys(templateData[0]);
    const csvContent = [
      headers.join(','),
      ...templateData.map(row => 
        headers.map(header => {
          const value = row[header as keyof typeof row];
          return typeof value === 'string' && value.includes(',') ? `"${value}"` : value;
        }).join(',')
      )
    ].join('\n');

    // Criar e baixar arquivo
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'template-upload-veiculos.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const downloadResults = () => {
    const csvContent = [
      'Placa,Contrato,Ação,Status,Erro',
      ...uploadResults.map(result => 
        `${result.placa},${result.contrato || ''},${result.success ? 
          (result.action === 'criado' ? 'Criado' : 
           result.action === 'transferido' ? 'Transferido' : 
           result.action === 'atualizado' ? 'Atualizado' :
           'Ignorado') : 
          'Erro'},${result.success ? 'Sucesso' : 'Erro'},${result.error || ''}`
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `resultado-upload-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Upload em Massa de Veículos</h1>
          <p className="mt-2 text-gray-600">
            Faça upload de múltiplos veículos através de um arquivo Excel. Suporta múltiplos contratos na mesma planilha!
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Formulário de Configuração */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DocumentArrowUpIcon className="h-5 w-5" />
                Configurações do Upload
              </CardTitle>
              <CardDescription>
                Configure os parâmetros antes de fazer o upload
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Área de Upload */}
              <div className="space-y-2">
                <Label>Arquivo Excel *</Label>
                <div
                  className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-gray-400 transition-colors cursor-pointer"
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <CloudArrowUpIcon className="mx-auto h-12 w-12 text-gray-400" />
                  <div className="mt-4">
                    <p className="text-sm font-medium text-gray-900">
                      {selectedFile ? selectedFile.name : 'Clique para selecionar ou arraste um arquivo Excel'}
                    </p>
                    <p className="text-sm text-gray-500 mt-1">
                      Apenas arquivos .xlsx e .xls são aceitos
                    </p>
                  </div>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </div>

              {/* Botões de Ação */}
              <div className="flex gap-3">
                <Button
                  onClick={handleUpload}
                  disabled={!selectedFile || isUploading}
                  className="flex-1"
                >
                  {isUploading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Processando...
                    </>
                  ) : (
                    <>
                      <DocumentArrowUpIcon className="h-4 w-4 mr-2" />
                      Fazer Upload
                    </>
                  )}
                </Button>
                <Button variant="outline" onClick={downloadTemplate}>
                  <DocumentArrowUpIcon className="h-4 w-4 mr-2" />
                  Baixar Template
                </Button>
                <Button variant="outline" onClick={resetForm} disabled={isUploading}>
                  Limpar
                </Button>
              </div>

              {/* Barra de Progresso */}
              {isUploading && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>Progresso do Upload</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <Progress value={uploadProgress} className="w-full" />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Resultados */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircleIcon className="h-5 w-5" />
                Resultados do Upload
              </CardTitle>
              <CardDescription>
                Visualize o status de cada veículo processado
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!showResults ? (
                <div className="text-center py-8 text-gray-500">
                  <DocumentArrowUpIcon className="mx-auto h-12 w-12 text-gray-300 mb-4" />
                  <p>Faça o upload para ver os resultados</p>
                </div>
              ) : (
                <div className="space-y-4">
                    {/* Resumo */}
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                      <div className="bg-green-50 p-4 rounded-lg">
                        <div className="flex items-center gap-2">
                          <CheckCircleIcon className="h-5 w-5 text-green-600" />
                          <span className="font-medium text-green-800">Criados</span>
                        </div>
                        <p className="text-2xl font-bold text-green-600 mt-1">
                          {uploadResults.filter(r => r.success && r.action === 'criado').length}
                        </p>
                      </div>
                      <div className="bg-blue-50 p-4 rounded-lg">
                        <div className="flex items-center gap-2">
                          <CheckCircleIcon className="h-5 w-5 text-blue-600" />
                          <span className="font-medium text-blue-800">Transferidos</span>
                        </div>
                        <p className="text-2xl font-bold text-blue-600 mt-1">
                          {uploadResults.filter(r => r.success && r.action === 'transferido').length}
                        </p>
                      </div>
                      <div className="bg-purple-50 p-4 rounded-lg">
                        <div className="flex items-center gap-2">
                          <CheckCircleIcon className="h-5 w-5 text-purple-600" />
                          <span className="font-medium text-purple-800">Atualizados</span>
                        </div>
                        <p className="text-2xl font-bold text-purple-600 mt-1">
                          {uploadResults.filter(r => r.success && r.action === 'atualizado').length}
                        </p>
                      </div>
                      <div className="bg-yellow-50 p-4 rounded-lg">
                        <div className="flex items-center gap-2">
                          <CheckCircleIcon className="h-5 w-5 text-yellow-600" />
                          <span className="font-medium text-yellow-800">Ignorados</span>
                        </div>
                        <p className="text-2xl font-bold text-yellow-600 mt-1">
                          {uploadResults.filter(r => r.success && r.action === 'ignorado').length}
                        </p>
                      </div>
                      <div className="bg-red-50 p-4 rounded-lg">
                        <div className="flex items-center gap-2">
                          <XCircleIcon className="h-5 w-5 text-red-600" />
                          <span className="font-medium text-red-800">Falhas</span>
                        </div>
                        <p className="text-2xl font-bold text-red-600 mt-1">
                          {uploadResults.filter(r => !r.success).length}
                        </p>
                      </div>
                    </div>

                  {/* Lista de Resultados */}
                  <div className="max-h-64 overflow-y-auto space-y-2">
                    {uploadResults.map((result, index) => (
                      <div
                        key={index}
                        className={`flex items-center justify-between p-3 rounded-lg ${
                          result.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          {result.success ? (
                            <CheckCircleIcon className="h-4 w-4 text-green-600" />
                          ) : (
                            <ExclamationTriangleIcon className="h-4 w-4 text-red-600" />
                          )}
                          <div>
                            <span className="font-medium">{result.placa}</span>
                            {result.contrato && (
                              <div className="text-xs text-gray-500">{result.contrato}</div>
                            )}
                          </div>
                        </div>
                        <span className={`text-sm ${
                          result.success ? 
                            (result.action === 'criado' ? 'text-green-600' : 
                             result.action === 'transferido' ? 'text-blue-600' : 
                             result.action === 'atualizado' ? 'text-purple-600' :
                             'text-yellow-600') : 
                            'text-red-600'
                        }`}>
                          {result.success ? 
                            (result.action === 'criado' ? 'Criado' : 
                             result.action === 'transferido' ? 'Transferido' : 
                             result.action === 'atualizado' ? 'Atualizado' :
                             'Ignorado') : 
                            'Erro'}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Botão de Download */}
                  <Button variant="outline" onClick={downloadResults} className="w-full">
                    <DocumentArrowUpIcon className="h-4 w-4 mr-2" />
                    Baixar Relatório CSV
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Instruções */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Formato do Arquivo Excel</CardTitle>
            <CardDescription>
              O arquivo deve conter as seguintes colunas (primeira linha como cabeçalho). 
              O sistema irá automaticamente criar novos veículos, transferir veículos existentes de outros contratos, ou ignorar veículos que já estão no contrato correto.
              <strong> Você pode incluir veículos de múltiplos contratos na mesma planilha!</strong>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {/* Comportamento do Sistema */}
                <div className="bg-blue-50 p-4 rounded-lg">
                  <h4 className="font-medium mb-2 text-blue-800">Como funciona o upload:</h4>
                  <ul className="space-y-1 text-sm text-blue-700">
                    <li>• <strong>Criado:</strong> Veículo não existe no sistema - será criado no contrato especificado na planilha</li>
                    <li>• <strong>Transferido:</strong> Veículo existe em outro contrato - será transferido para o contrato especificado na planilha</li>
                    <li>• <strong>Atualizado:</strong> Veículo já existe no contrato correto - será atualizado com chassis e RENAVAM da planilha</li>
                    <li>• <strong>Ignorado:</strong> Veículo já existe no contrato correto e dados são iguais - nenhuma ação será realizada</li>
                    <li>• <strong>Múltiplos Contratos:</strong> Você pode incluir veículos de diferentes contratos na mesma planilha</li>
                  </ul>
                </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <h4 className="font-medium mb-2">Colunas Obrigatórias:</h4>
                  <ul className="space-y-1 text-gray-600">
                    <li>• contrato (nome do contrato)</li>
                    <li>• placa (aceita com ou sem hífen: ABC-1234 ou ABC1234)</li>
                    <li>• modelo</li>
                    <li>• tipo_modelo</li>
                    <li>• ano_fabricacao</li>
                    <li>• ano_modelo</li>
                    <li>• renavam</li>
                    <li>• chassis</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Colunas Opcionais:</h4>
                  <ul className="space-y-1 text-gray-600">
                    <li>• marca_equipamento</li>
                    <li>• tipo_combustivel</li>
                    <li>• quilometragem_atual</li>
                    <li>• numero_crlv</li>
                    <li>• versao</li>
                    <li>• tipo_veiculo</li>
                    <li>• valor_aluguel</li>
                  </ul>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
