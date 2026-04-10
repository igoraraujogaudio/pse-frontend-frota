'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Upload, Download, FileSpreadsheet, XCircle, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import PermissionGuard from '@/components/PermissionGuard';
import BulkUploadAnalysis from '@/components/BulkUploadAnalysis';
import { PERMISSION_CODES } from '@/hooks/useModularPermissions';

interface Contrato {
  id: string;
  nome: string;
  codigo: string;
  status: string;
}

interface ResultadoProcessamento {
  message: string;
  total: number;
  sucessos: number;
  erros: number;
  atualizados: number;
  criados: number;
  demitidos: number;
  detalhes: {
    sucessos: Array<{ linha: number; funcionario: string; dados: Record<string, unknown> }>;
    erros: Array<{ linha: number; erro: string; dados: Record<string, unknown> }>;
    atualizados: Array<{ linha: number; funcionario: Record<string, unknown>; dados: Record<string, unknown> }>;
    criados: Array<{ linha: number; funcionario: Record<string, unknown>; dados: Record<string, unknown> }>;
    demitidos: Array<{ linha: number; funcionario: Record<string, unknown>; dados: Record<string, unknown> }>;
  };
}

export default function FuncionariosBulkUploadPage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [selectedContratoId, setSelectedContratoId] = useState<string>('');
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingContratos, setLoadingContratos] = useState(true);
  const [error, setError] = useState('');
  const [result, setResult] = useState<ResultadoProcessamento | null>(null);

  // Carrega contratos ativos
  useEffect(() => {
    const fetchContratos = async () => {
      try {
        const response = await fetch('/api/contratos');
        if (response.ok) {
          const data = await response.json();
          // A API retorna { contratos: [...] }, então acessamos data.contratos
          if (data.contratos && Array.isArray(data.contratos)) {
            setContratos(data.contratos.filter((c: Contrato) => c.status === 'ativo'));
          } else {
            console.error('Resposta da API não contém array de contratos:', data);
            setContratos([]);
          }
        }
      } catch (error) {
        console.error('Erro ao carregar contratos:', error);
        setContratos([]);
      } finally {
        setLoadingContratos(false);
      }
    };

    fetchContratos();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
          selectedFile.type === 'application/vnd.ms-excel') {
        setFile(selectedFile);
        setError('');
      } else {
        setError('Por favor, selecione um arquivo Excel (.xlsx ou .xls)');
      }
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError('Selecione um arquivo');
      return;
    }

    // Validação: se não selecionar "Todos os Contratos", precisa selecionar um contrato
    if (selectedContratoId !== 'todos' && !selectedContratoId) {
      setError('Selecione um contrato ou "Todos os Contratos"');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('file', file);
      // Se for "todos", envia string vazia (modo automático)
      // Senão, envia o contrato_id selecionado
      if (selectedContratoId === 'todos') {
        formData.append('contrato_id', '');
      } else {
        formData.append('contrato_id', selectedContratoId);
      }

      const response = await fetch('/api/funcionarios/bulk-upload', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao processar arquivo');
      }

      setResult(data);
      toast.success('Upload realizado com sucesso!');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
      toast.error('Erro ao fazer upload do arquivo');
    } finally {
      setLoading(false);
    }
  };

  const downloadTemplate = async () => {
    const contratoNome = contratos.find(c => c.id === selectedContratoId)?.nome || 'Contrato';
    
    // Cria dados de exemplo para o template
    const templateData = [
      {
        nome: 'João Silva',
        email: 'joao.silva@empresa.com',
        matricula: '12345',
        cpf: '123.456.789-00',
        telefone: '(11) 99999-9999',
        telefone_empresarial: '(11) 3333-4444',
        cargo: 'Motorista',
        posicao: 'Operador',
        operacao: 'FROTA',
        departamento: 'Operações',
        status: 'ativo',
        cnh: '12345678901',
        validade_cnh: '2025-12-31',
        cnh_categoria: 'B',
        data_ultimo_exame_aso: '2024-01-15',
        data_agendamento_aso: '2025-01-15',
        validade_aso: '2025-01-15',
        har_vencimento: '2025-06-30',
        data_admissao: '2024-01-15',
        data_nascimento: '1990-05-20',
        data_demissao: '',
        tipo_demissao: '',
        observacoes_demissao: ''
      },
      {
        nome: 'Maria Santos',
        email: 'maria.santos@empresa.com',
        matricula: '12346',
        cpf: '987.654.321-00',
        telefone: '(11) 88888-8888',
        telefone_empresarial: '(11) 2222-3333',
        cargo: 'Supervisor',
        posicao: 'Supervisor',
        operacao: 'ALMOXARIFADO',
        departamento: 'Logística',
        status: 'ferias',
        cnh: '',
        validade_cnh: '',
        cnh_categoria: '',
        data_ultimo_exame_aso: '2024-02-20',
        data_agendamento_aso: '2025-02-20',
        validade_aso: '2025-02-20',
        har_vencimento: '',
        data_admissao: '2024-02-20',
        data_nascimento: '1985-08-10',
        data_demissao: '',
        tipo_demissao: '',
        observacoes_demissao: ''
      }
    ];

    try {
      // Importa XLSX dinamicamente
      const XLSX = await import('xlsx');
      
      // Cria workbook
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(templateData);
      
      // Adiciona worksheet ao workbook
      XLSX.utils.book_append_sheet(wb, ws, 'Funcionarios');
      
      // Gera arquivo Excel
      const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([excelBuffer], { 
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
      });
      
      // Download
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Template_Funcionarios_${contratoNome.replace(/\s+/g, '_')}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      toast.success('Template baixado com sucesso!');
    } catch (error) {
      console.error('Erro ao gerar template:', error);
      toast.error('Erro ao gerar template');
    }
  };

  return (
    <PermissionGuard 
      requiredPermissions={[PERMISSION_CODES.FUNCIONARIOS.CRIAR]}
      fallbackMessage="Você não tem permissão para fazer upload de funcionários."
    >
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 rounded-2xl p-8 text-white shadow-2xl">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-4xl font-bold mb-2">Upload em Lote - Funcionários</h1>
              <p className="text-blue-100 text-lg">Importe funcionários através de planilha Excel</p>
            </div>
            <Button 
              variant="secondary"
              onClick={() => router.back()}
              className="bg-white/90 hover:bg-white text-gray-800 hover:text-gray-900 border-white/50 font-semibold shadow-lg"
            >
              Voltar
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Upload Form */}
          <Card className="shadow-xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Upload de Funcionários
              </CardTitle>
              <CardDescription>
                Selecione um contrato específico ou &quot;Todos os Contratos&quot; para mapeamento automático pela coluna C.Custo
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Seleção de Contrato */}
              <div className="space-y-2">
                <Label htmlFor="contrato">Contrato *</Label>
                {loadingContratos ? (
                  <div className="flex items-center gap-2 p-3 border rounded-md bg-gray-50">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                    <span className="text-sm text-gray-600">Carregando contratos...</span>
                  </div>
                ) : (
                  <Select value={selectedContratoId} onValueChange={setSelectedContratoId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um contrato ou 'Todos os Contratos'" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos" className="font-semibold text-blue-600">
                        🌐 Todos os Contratos (Automático por C.Custo)
                      </SelectItem>
                      {contratos.length > 0 && (
                        <>
                          <div className="h-px bg-gray-200 my-1 mx-2" />
                          {contratos.map(contrato => (
                            <SelectItem key={contrato.id} value={contrato.id}>
                              {contrato.nome} ({contrato.codigo})
                            </SelectItem>
                          ))}
                        </>
                      )}
                      {contratos.length === 0 && (
                        <SelectItem value="no-contratos" disabled>
                          Nenhum contrato ativo encontrado
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                )}
                {selectedContratoId === 'todos' && (
                  <Alert className="mt-2">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="text-sm">
                      <strong>Modo Automático:</strong> A planilha deve conter a coluna <strong>&quot;Descrição (C.Custo)&quot;</strong> 
                      para que o sistema determine automaticamente o contrato de cada funcionário.
                    </AlertDescription>
                  </Alert>
                )}
              </div>

              {/* Upload de Arquivo */}
              <div className="space-y-2">
                <Label htmlFor="file">Arquivo Excel *</Label>
                <Input
                  id="file"
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileChange}
                  className="cursor-pointer"
                />
                <p className="text-sm text-gray-500">
                  Formatos aceitos: .xlsx, .xls
                </p>
              </div>

              {/* Botões */}
              <div className="flex gap-3">
                <Button 
                  onClick={handleUpload}
                  disabled={!file || (!selectedContratoId || selectedContratoId === '') || loading}
                  className="flex-1"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Processando...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Fazer Upload
                    </>
                  )}
                </Button>
                <Button 
                  variant="outline"
                  onClick={downloadTemplate}
                  disabled={(!selectedContratoId || selectedContratoId === 'todos' || selectedContratoId === '') || loadingContratos}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Template
                </Button>
              </div>

              {/* Error */}
              {error && (
                <Alert variant="destructive">
                  <XCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          {/* Instructions */}
          <Card className="shadow-xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5" />
                Instruções
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-semibold mb-2">Campos Obrigatórios:</h4>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• nome</li>
                  <li>• matricula</li>
                  <li>• cargo</li>
                  <li>• <strong>Descrição (C.Custo)</strong> <span className="text-blue-600">* (obrigatório quando usar &quot;Todos os Contratos&quot;)</span></li>
                </ul>
              </div>
              
              <Separator />
              
              <Alert className="bg-blue-50 border-blue-200">
                <AlertCircle className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-sm">
                  <strong className="text-blue-900">Modo &quot;Todos os Contratos&quot;:</strong> Quando selecionar esta opção, 
                  cada funcionário será automaticamente associado ao contrato correto baseado na coluna <strong>&quot;Descrição (C.Custo)&quot;</strong> 
                  da planilha. Os mapeamentos suportados são: ADMINISTRATIVO/GOIAS, COMERCIAL GOIAS, ENEL NITERÓI-RJ, 
                  MAGE-RJ, MAUÁ TMA, MOOCA TMA, OBRAS CRASH, SERVIÇOS LIGHT/RJ e TECNICOS GOIAS.
                </AlertDescription>
              </Alert>

              <Separator />

              <div>
                <h4 className="font-semibold mb-2">Campos Opcionais:</h4>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• operacao (padrão: GERAL se não informado)</li>
                  <li>• cpf</li>
                  <li>• telefone</li>
                  <li>• telefone_empresarial</li>
                  <li>• posicao</li>
                  <li>• departamento</li>
                  <li>• status (ativo, demitido, ferias, afastado)</li>
                  <li>• cnh</li>
                  <li>• validade_cnh</li>
                  <li>• cnh_categoria</li>
                  <li>• data_ultimo_exame_aso</li>
                  <li>• data_agendamento_aso</li>
                  <li>• validade_aso</li>
                  <li>• har_vencimento</li>
                  <li>• data_admissao</li>
                  <li>• data_nascimento</li>
                  <li>• data_demissao</li>
                  <li>• tipo_demissao</li>
                  <li>• observacoes_demissao</li>
                </ul>
              </div>

              <Separator />

              <div>
                <h4 className="font-semibold mb-2">Operações:</h4>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• ALMOXARIFADO</li>
                  <li>• ASG</li>
                  <li>• COD</li>
                  <li>• COMERCIAL</li>
                  <li>• EMERGENCIA</li>
                  <li>• FATURAMENTO</li>
                  <li>• FROTA</li>
                  <li>• GERAL</li>
                  <li>• MONITORIA</li>
                  <li>• RH</li>
                  <li>• SEG TRAB</li>
                  <li>• TÉCNICA LM</li>
                  <li>• TÉCNICA LV</li>
                </ul>
              </div>

              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Importante:</strong> Se um funcionário já existir (mesmo CPF ou matrícula), 
                  os dados serão atualizados. Caso contrário, um novo funcionário será criado.
                </AlertDescription>
              </Alert>

              <Separator />


              <div>
                <h4 className="font-semibold mb-2">Cálculo Automático de Validade ASO:</h4>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• Se o campo <strong>validade_aso</strong> estiver vazio, será calculado automaticamente</li>
                  <li>• Fórmula: <strong>validade_aso = data_ultimo_exame_aso + 1 ano</strong></li>
                  <li>• Se não houver data_ultimo_exame_aso, validade_aso ficará vazio</li>
                  <li>• O sistema atualiza automaticamente quando data_ultimo_exame_aso for alterada</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Results */}
        {result && (
          <BulkUploadAnalysis 
            result={result} 
            onExportReport={() => toast.success('Relatório exportado com sucesso!')}
          />
        )}
      </div>
    </PermissionGuard>
  );
}
