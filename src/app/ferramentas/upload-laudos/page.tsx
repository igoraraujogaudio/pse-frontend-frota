'use client';

import { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Upload, FileText, CheckCircle, XCircle, AlertCircle, Download } from 'lucide-react';
import { ProcessedLaudo } from '@/services/uploadLaudosService';
import { useUploadLaudos } from '@/hooks/useUploadLaudos';

interface UploadedFile {
  id: string;
  file: File;
  name: string;
  size: number;
  status: 'pending' | 'processing' | 'success' | 'error';
  progress: number;
  message?: string;
  resultado?: ProcessedLaudo;
}

const TIPOS_LAUDO = [
  { value: 'acustico', label: 'Laudo Acústico', color: 'bg-blue-100 text-blue-800' },
  { value: 'crlv', label: 'CRLV', color: 'bg-green-100 text-green-800' },
  { value: 'eletrico', label: 'Laudo Elétrico', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'aet', label: 'AET', color: 'bg-purple-100 text-purple-800' },
  { value: 'fumaca', label: 'Laudo de Fumaça', color: 'bg-orange-100 text-orange-800' },
  { value: 'tacografo', label: 'Tacógrafo', color: 'bg-red-100 text-red-800' },
  { value: 'apolice', label: 'Apólice', color: 'bg-indigo-100 text-indigo-800' },
  { value: 'contrato_seguro', label: 'Contrato de Aluguel', color: 'bg-pink-100 text-pink-800' }
];

const SUBTIPOS_LAUDO_ELETRICO = [
  { value: 'lanca_isolada', label: 'Lança Isolada', color: 'bg-blue-100 text-blue-800' },
  { value: 'liner', label: 'Liner', color: 'bg-green-100 text-green-800' },
  { value: 'geral', label: 'Geral', color: 'bg-gray-100 text-gray-800' }
];

export default function UploadLaudosPage() {
  const [tipoLaudo, setTipoLaudo] = useState<string>('');
  const [subtipoLaudoEletrico, setSubtipoLaudoEletrico] = useState<string>('');
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const { isUploading, uploadProgress, currentProcessing, processarLote, resetState } = useUploadLaudos();

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files || []);
    
    const newFiles: UploadedFile[] = selectedFiles.map((file, index) => ({
      id: `${Date.now()}-${index}`,
      file,
      name: file.name,
      size: file.size,
      status: 'pending',
      progress: 0
    }));

    setFiles(prev => [...prev, ...newFiles]);
  };

  const removeFile = (fileId: string) => {
    setFiles(prev => prev.filter(file => file.id !== fileId));
  };

  const clearAllFiles = () => {
    setFiles([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    resetState();
  };

  // Resetar subtipo quando tipo de laudo mudar
  const handleTipoLaudoChange = (value: string) => {
    setTipoLaudo(value);
    setSubtipoLaudoEletrico(''); // Resetar subtipo quando mudar o tipo
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'processing':
        return <AlertCircle className="h-4 w-4 text-yellow-600" />;
      default:
        return <FileText className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'text-green-600';
      case 'error':
        return 'text-red-600';
      case 'processing':
        return 'text-yellow-600';
      default:
        return 'text-gray-400';
    }
  };

  const handleUpload = async () => {
    if (!tipoLaudo) {
      return;
    }

    // Para laudos elétricos, verificar se subtipo foi selecionado
    if (tipoLaudo === 'eletrico' && !subtipoLaudoEletrico) {
      return;
    }

    if (files.length === 0) {
      return;
    }

    // Filtra apenas arquivos pendentes
    const filesToProcess = files.filter(f => f.status === 'pending');
    
    if (filesToProcess.length === 0) {
      return;
    }

    // Processa os arquivos em lote
    const resultados = await processarLote(
      filesToProcess.map(f => f.file),
      tipoLaudo,
      tipoLaudo === 'eletrico' ? subtipoLaudoEletrico : undefined
    );

    // Atualiza os resultados dos arquivos
    setFiles(prev => prev.map(file => {
      const resultado = resultados.find(r => r.nomeArquivo === file.name);
      if (resultado) {
        return {
          ...file,
          status: resultado.status,
          progress: 100,
          message: resultado.message,
          resultado
        };
      }
      return file;
    }));
  };

  const successCount = files.filter(f => f.status === 'success').length;
  const errorCount = files.filter(f => f.status === 'error').length;
  const pendingCount = files.filter(f => f.status === 'pending').length;
  const processingCount = files.filter(f => f.status === 'processing').length;

  const downloadResults = () => {
    const resultados = files
      .filter(f => f.resultado)
      .map(f => ({
        nomeArquivo: f.name,
        placa: f.resultado?.placa || 'N/A',
        tipoLaudo: f.resultado?.tipoLaudo || 'N/A',
        dataValidade: f.resultado?.dataValidade || 'N/A',
        status: f.resultado?.status || 'N/A',
        message: f.resultado?.message || 'N/A'
      }));

    const csvContent = [
      ['Nome do Arquivo', 'Placa', 'Tipo de Laudo', 'Data de Validade', 'Status', 'Mensagem'],
      ...resultados.map(r => [r.nomeArquivo, r.placa, r.tipoLaudo, r.dataValidade, r.status, r.message])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `resultados_upload_${tipoLaudo}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Upload em Massa de Laudos</h1>
          <p className="text-gray-600 mt-2">
            Faça upload de múltiplos laudos de uma vez, organizados por tipo
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Seleção de Tipo de Laudo */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Tipo de Laudo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={tipoLaudo} onValueChange={handleTipoLaudoChange}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o tipo de laudo" />
              </SelectTrigger>
              <SelectContent>
                {TIPOS_LAUDO.map((tipo) => (
                  <SelectItem key={tipo.value} value={tipo.value}>
                    <div className="flex items-center gap-2">
                      <Badge className={tipo.color}>{tipo.label}</Badge>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            {/* Campo de subtipo para laudos elétricos */}
            {tipoLaudo === 'eletrico' && (
              <div className="mt-4 p-4 border-2 border-blue-300 bg-blue-50 rounded-lg">
                <label className="block text-sm font-medium text-blue-900 mb-2">
                  ⚡ Subtipo do Laudo Elétrico *
                </label>
                <div className="mb-2">
                  <span className="text-xs text-blue-700">
                    Valor atual: {subtipoLaudoEletrico || 'Nenhum selecionado'}
                  </span>
                </div>
                <Select value={subtipoLaudoEletrico} onValueChange={setSubtipoLaudoEletrico}>
                  <SelectTrigger className="border-blue-300">
                    <SelectValue placeholder="Selecione o subtipo do laudo elétrico" />
                  </SelectTrigger>
                  <SelectContent>
                    {SUBTIPOS_LAUDO_ELETRICO.map((subtipo) => (
                      <SelectItem key={subtipo.value} value={subtipo.value}>
                        <div className="flex items-center gap-2">
                          <Badge className={subtipo.color}>{subtipo.label}</Badge>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-blue-600 mt-2 font-medium">
                  Para veículos como cestos duplos, você pode ter múltiplos laudos elétricos com diferentes tipos e datas de vencimento.
                </p>
              </div>
            )}

            {tipoLaudo && (
              <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600">
                  <strong>Tipo selecionado:</strong> {TIPOS_LAUDO.find(t => t.value === tipoLaudo)?.label}
                  {tipoLaudo === 'eletrico' && subtipoLaudoEletrico && (
                    <span className="ml-2">
                      - {SUBTIPOS_LAUDO_ELETRICO.find(s => s.value === subtipoLaudoEletrico)?.label}
                    </span>
                  )}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Os arquivos serão processados automaticamente conforme o padrão deste tipo de laudo
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Estatísticas */}
        <Card>
          <CardHeader>
            <CardTitle>Estatísticas do Upload</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Total de arquivos:</span>
                <Badge variant="outline">{files.length}</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Pendentes:</span>
                <Badge variant="outline" className="text-yellow-600">{pendingCount}</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Processando:</span>
                <Badge variant="outline" className="text-blue-600">{processingCount}</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Sucesso:</span>
                <Badge variant="outline" className="text-green-600">{successCount}</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Erros:</span>
                <Badge variant="outline" className="text-red-600">{errorCount}</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Upload de Arquivos */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Seleção de Arquivos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Área de Upload */}
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf"
                onChange={handleFileSelect}
                className="hidden"
              />
              
              <Button
                onClick={() => fileInputRef.current?.click()}
                disabled={!tipoLaudo || (tipoLaudo === 'eletrico' && !subtipoLaudoEletrico)}
                className="mb-4"
              >
                <Upload className="h-4 w-4 mr-2" />
                Selecionar PDFs
              </Button>
              
              <p className="text-sm text-gray-600">
                {!tipoLaudo 
                  ? 'Selecione um tipo de laudo primeiro'
                  : tipoLaudo === 'eletrico' && !subtipoLaudoEletrico
                  ? 'Selecione o subtipo do laudo elétrico primeiro'
                  : `Selecione os arquivos PDF para ${TIPOS_LAUDO.find(t => t.value === tipoLaudo)?.label}${
                      tipoLaudo === 'eletrico' && subtipoLaudoEletrico 
                        ? ` - ${SUBTIPOS_LAUDO_ELETRICO.find(s => s.value === subtipoLaudoEletrico)?.label}`
                        : ''
                    }`
                }
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Arraste e solte ou clique para selecionar múltiplos arquivos
              </p>
            </div>

            {/* Botões de Ação */}
            {files.length > 0 && (
              <div className="flex gap-2">
                <Button
                  onClick={handleUpload}
                  disabled={isUploading || !tipoLaudo || (tipoLaudo === 'eletrico' && !subtipoLaudoEletrico) || pendingCount === 0}
                  className="flex-1"
                >
                  {isUploading ? 'Processando...' : 'Processar Todos os Arquivos'}
                </Button>
                <Button
                  variant="outline"
                  onClick={clearAllFiles}
                  disabled={isUploading}
                >
                  Limpar Todos
                </Button>
                {successCount > 0 && (
                  <Button
                    variant="outline"
                    onClick={downloadResults}
                    className="flex items-center gap-2"
                  >
                    <Download className="h-4 w-4" />
                    Baixar Resultados
                  </Button>
                )}
              </div>
            )}

            {/* Progresso Geral */}
            {isUploading && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Progresso geral:</span>
                  <span>{Math.round(uploadProgress)}%</span>
                </div>
                <Progress value={uploadProgress} className="w-full" />
                {currentProcessing && (
                  <p className="text-xs text-gray-600">
                    Processando: {currentProcessing}
                  </p>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Lista de Arquivos */}
      {files.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Arquivos Selecionados ({files.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {files.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex items-center gap-3 flex-1">
                    {getStatusIcon(file.status)}
                    <div className="flex-1">
                      <p className={`text-sm font-medium ${getStatusColor(file.status)}`}>
                        {file.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatFileSize(file.size)}
                        {file.message && (
                          <span className={`ml-2 ${file.status === 'error' ? 'text-red-600' : 'text-green-600'}`}>
                            • {file.message}
                          </span>
                        )}
                      </p>
                      {file.resultado && (
                        <div className="mt-1 text-xs text-gray-600">
                          <span className="mr-3">Placa: {file.resultado.placa}</span>
                          <span className="mr-3">Validade: {file.resultado.dataValidade}</span>
                          {file.resultado.subtipoLaudo && (
                            <span className="mr-3">Subtipo: {file.resultado.subtipoLaudo}</span>
                          )}
                          {file.resultado.veiculoId && (
                            <span>ID Veículo: {file.resultado.veiculoId}</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    {file.status === 'processing' && (
                      <div className="w-20">
                        <Progress value={file.progress} className="w-full" />
                      </div>
                    )}
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFile(file.id)}
                      disabled={isUploading}
                    >
                      <XCircle className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Alertas */}
      {!tipoLaudo && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Selecione um tipo de laudo para começar o upload em massa.
          </AlertDescription>
        </Alert>
      )}

      {files.length > 0 && !tipoLaudo && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Arquivos selecionados, mas tipo de laudo não definido. Selecione o tipo para continuar.
          </AlertDescription>
        </Alert>
      )}

      {tipoLaudo === 'eletrico' && !subtipoLaudoEletrico && files.length > 0 && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Para laudos elétricos, é obrigatório selecionar um subtipo (Lança Isolada, Liner ou Geral).
          </AlertDescription>
        </Alert>
      )}

      {successCount > 0 && (
        <Alert className="border-green-200 bg-green-50">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">
            {successCount} arquivo(s) processado(s) com sucesso! 
            {errorCount > 0 && ` ${errorCount} arquivo(s) com erro.`}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
