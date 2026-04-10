'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  CheckCircle, 
  XCircle, 
  UserPlus, 
  UserCheck, 
  UserMinus, 
  AlertTriangle,
  Download,
  BarChart3,
  TrendingUp,
  FileText,
  Users,
  Building,
  Briefcase
} from 'lucide-react';
import * as XLSX from 'xlsx';

interface BulkUploadResult {
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

interface BulkUploadAnalysisProps {
  result: BulkUploadResult;
  onExportReport?: () => void;
}

export default function BulkUploadAnalysis({ result, onExportReport }: BulkUploadAnalysisProps) {
  const [activeTab, setActiveTab] = useState('overview');

  // Calcular estatísticas
  const successRate = result.total > 0 ? Math.round(((result.criados + result.atualizados + result.demitidos) / result.total) * 100) : 0;
  const errorRate = result.total > 0 ? Math.round((result.erros / result.total) * 100) : 0;

  // Análise por operação
  const operacoesStats = result.detalhes.criados.concat(result.detalhes.atualizados).reduce((acc: Record<string, number>, item) => {
    const operacao = String(item.dados.operacao || 'N/A');
    acc[operacao] = (acc[operacao] || 0) + 1;
    return acc;
  }, {});

  // Análise por cargo
  const cargosStats = result.detalhes.criados.concat(result.detalhes.atualizados).reduce((acc: Record<string, number>, item) => {
    const cargo = String(item.dados.cargo || 'N/A');
    acc[cargo] = (acc[cargo] || 0) + 1;
    return acc;
  }, {});

  // Análise por status
  const statusStats = result.detalhes.criados.concat(result.detalhes.atualizados).reduce((acc: Record<string, number>, item) => {
    const status = String(item.dados.status || 'ativo');
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {});

  // Exportar relatório detalhado
  const exportDetailedReport = () => {
    // Criar workbook
    const wb = XLSX.utils.book_new();
    
    // Aba 1: Resumo
    const resumoData = [
      ['Métrica', 'Valor'],
      ['Total de Registros', result.total],
      ['Funcionários Criados', result.criados],
      ['Funcionários Atualizados', result.atualizados],
      ['Funcionários Demitidos', result.demitidos],
      ['Erros', result.erros],
      ['Taxa de Sucesso', `${successRate}%`],
      ['Taxa de Erro', `${errorRate}%`]
    ];
    const wsResumo = XLSX.utils.aoa_to_sheet(resumoData);
    XLSX.utils.book_append_sheet(wb, wsResumo, 'Resumo');

    // Aba 2: Criados
    if (result.detalhes.criados.length > 0) {
      const criadosData = result.detalhes.criados.map(item => ({
        'Linha': item.linha,
        'Nome': item.funcionario.nome,
        'Matrícula': item.funcionario.matricula,
        'CPF': item.funcionario.cpf,
        'Cargo': item.funcionario.cargo,
        'Operação': item.funcionario.operacao,
        'Status': item.funcionario.status,
        'Email': item.funcionario.email
      }));
      const wsCriados = XLSX.utils.json_to_sheet(criadosData);
      XLSX.utils.book_append_sheet(wb, wsCriados, 'Criados');
    }

    // Aba 3: Atualizados
    if (result.detalhes.atualizados.length > 0) {
      const atualizadosData = result.detalhes.atualizados.map(item => ({
        'Linha': item.linha,
        'Nome': item.funcionario.nome,
        'Matrícula': item.funcionario.matricula,
        'CPF': item.funcionario.cpf,
        'Cargo': item.funcionario.cargo,
        'Operação': item.funcionario.operacao,
        'Status': item.funcionario.status,
        'Email': item.funcionario.email
      }));
      const wsAtualizados = XLSX.utils.json_to_sheet(atualizadosData);
      XLSX.utils.book_append_sheet(wb, wsAtualizados, 'Atualizados');
    }

    // Aba 4: Demitidos
    if (result.detalhes.demitidos.length > 0) {
      const demitidosData = result.detalhes.demitidos.map(item => ({
        'Linha': item.linha,
        'Nome': item.funcionario.nome,
        'Matrícula': item.funcionario.matricula,
        'CPF': item.funcionario.cpf,
        'Cargo': item.funcionario.cargo,
        'Operação': item.funcionario.operacao,
        'Status': item.funcionario.status,
        'Data Demissão': item.funcionario.data_demissao
      }));
      const wsDemitidos = XLSX.utils.json_to_sheet(demitidosData);
      XLSX.utils.book_append_sheet(wb, wsDemitidos, 'Demitidos');
    }

    // Aba 5: Erros
    if (result.detalhes.erros.length > 0) {
      const errosData = result.detalhes.erros.map(item => ({
        'Linha': item.linha,
        'Erro': item.erro,
        'Nome': item.dados.nome || 'N/A',
        'Matrícula': item.dados.matricula || 'N/A',
        'CPF': item.dados.cpf || 'N/A',
        'Cargo': item.dados.cargo || 'N/A',
        'Operação': item.dados.operacao || 'N/A'
      }));
      const wsErros = XLSX.utils.json_to_sheet(errosData);
      XLSX.utils.book_append_sheet(wb, wsErros, 'Erros');
    }

    // Download
    const fileName = `Relatorio_BulkUpload_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, fileName);
    
    if (onExportReport) {
      onExportReport();
    }
  };

  return (
    <div className="space-y-6">
      {/* Header com métricas principais */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-600">Total Processado</p>
                <p className="text-3xl font-bold text-blue-700">{result.total}</p>
                <p className="text-xs text-blue-500">registros</p>
              </div>
              <FileText className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-600">Taxa de Sucesso</p>
                <p className="text-3xl font-bold text-green-700">{successRate}%</p>
                <p className="text-xs text-green-500">{result.criados + result.atualizados + result.demitidos} sucessos</p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-orange-600">Novos Funcionários</p>
                <p className="text-3xl font-bold text-orange-700">{result.criados}</p>
                <p className="text-xs text-orange-500">criados</p>
              </div>
              <UserPlus className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-50 to-red-100 border-red-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-red-600">Erros</p>
                <p className="text-3xl font-bold text-red-700">{result.erros}</p>
                <p className="text-xs text-red-500">{errorRate}% do total</p>
              </div>
              <XCircle className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Barra de progresso visual */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Progresso do Processamento
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex justify-between text-sm text-gray-600">
              <span>Progresso Geral</span>
              <span>{successRate}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-4">
              <div 
                className="bg-gradient-to-r from-green-500 via-blue-500 to-purple-500 h-4 rounded-full transition-all duration-1000 ease-out"
                style={{ width: `${successRate}%` }}
              ></div>
            </div>
            
            {/* Breakdown visual */}
            <div className="grid grid-cols-4 gap-2 mt-4">
              <div className="text-center">
                <div className="w-full h-2 bg-green-500 rounded mb-1"></div>
                <p className="text-xs text-green-600 font-medium">{result.criados} Criados</p>
              </div>
              <div className="text-center">
                <div className="w-full h-2 bg-blue-500 rounded mb-1"></div>
                <p className="text-xs text-blue-600 font-medium">{result.atualizados} Atualizados</p>
              </div>
              <div className="text-center">
                <div className="w-full h-2 bg-purple-500 rounded mb-1"></div>
                <p className="text-xs text-purple-600 font-medium">{result.demitidos} Demitidos</p>
              </div>
              <div className="text-center">
                <div className="w-full h-2 bg-red-500 rounded mb-1"></div>
                <p className="text-xs text-red-600 font-medium">{result.erros} Erros</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs com análises detalhadas */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="operations">Por Operação</TabsTrigger>
          <TabsTrigger value="positions">Por Cargo</TabsTrigger>
          <TabsTrigger value="status">Por Status</TabsTrigger>
          <TabsTrigger value="errors">Erros</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Funcionários Criados */}
            {result.criados > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-green-600">
                    <UserPlus className="h-5 w-5" />
                    Novos Funcionários ({result.criados})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {result.detalhes.criados.map((item, index) => (
                      <div key={index} className="flex items-center gap-2 p-2 bg-green-50 rounded border border-green-200">
                        <UserPlus className="h-4 w-4 text-green-600" />
                        <div className="text-sm flex-1">
                          <div className="font-medium">{String((item.funcionario as Record<string, unknown>)?.nome || 'N/A')}</div>
                          <div className="text-green-600 text-xs">
                            {String((item.funcionario as Record<string, unknown>)?.matricula || 'N/A')} • {String((item.funcionario as Record<string, unknown>)?.cargo || 'N/A')}
                          </div>
                        </div>
                        <Badge variant="outline" className="text-xs">Linha {item.linha}</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Funcionários Atualizados */}
            {result.atualizados > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-blue-600">
                    <UserCheck className="h-5 w-5" />
                    Atualizados ({result.atualizados})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {result.detalhes.atualizados.map((item, index) => (
                      <div key={index} className="flex items-center gap-2 p-2 bg-blue-50 rounded border border-blue-200">
                        <UserCheck className="h-4 w-4 text-blue-600" />
                        <div className="text-sm flex-1">
                          <div className="font-medium">{String((item.funcionario as Record<string, unknown>)?.nome || 'N/A')}</div>
                          <div className="text-blue-600 text-xs">
                            {String((item.funcionario as Record<string, unknown>)?.matricula || 'N/A')} • {String((item.funcionario as Record<string, unknown>)?.cargo || 'N/A')}
                          </div>
                        </div>
                        <Badge variant="outline" className="text-xs">Linha {item.linha}</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Funcionários Demitidos */}
            {result.demitidos > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-red-600">
                    <UserMinus className="h-5 w-5" />
                    Demitidos ({result.demitidos})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {result.detalhes.demitidos.map((item, index) => (
                      <div key={index} className="flex items-center gap-2 p-2 bg-red-50 rounded border border-red-200">
                        <UserMinus className="h-4 w-4 text-red-600" />
                        <div className="text-sm flex-1">
                          <div className="font-medium">{String((item.funcionario as Record<string, unknown>)?.nome || 'N/A')}</div>
                          <div className="text-red-600 text-xs">
                            {String((item.funcionario as Record<string, unknown>)?.matricula || 'N/A')} • {String((item.funcionario as Record<string, unknown>)?.cargo || 'N/A')}
                          </div>
                        </div>
                        <Badge variant="outline" className="text-xs">Linha {item.linha}</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="operations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building className="h-5 w-5" />
                Distribuição por Operação
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {Object.entries(operacoesStats).map(([operacao, count]) => (
                  <div key={operacao} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <Building className="h-4 w-4 text-gray-500" />
                      <span className="font-medium">{operacao}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-20 bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-blue-500 h-2 rounded-full"
                          style={{ width: `${(count / Math.max(...Object.values(operacoesStats))) * 100}%` }}
                        ></div>
                      </div>
                      <Badge variant="secondary">{count}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="positions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Briefcase className="h-5 w-5" />
                Distribuição por Cargo
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {Object.entries(cargosStats)
                  .sort(([,a], [,b]) => b - a)
                  .slice(0, 10)
                  .map(([cargo, count]) => (
                  <div key={cargo} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <Briefcase className="h-4 w-4 text-gray-500" />
                      <span className="font-medium text-sm">{cargo}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-20 bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-green-500 h-2 rounded-full"
                          style={{ width: `${(count / Math.max(...Object.values(cargosStats))) * 100}%` }}
                        ></div>
                      </div>
                      <Badge variant="secondary">{count}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="status" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Distribuição por Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                {Object.entries(statusStats).map(([status, count]) => {
                  const colors = {
                    'ativo': 'bg-green-500',
                    'demitido': 'bg-red-500',
                    'ferias': 'bg-yellow-500',
                    'afastado': 'bg-orange-500',
                    'suspenso': 'bg-purple-500'
                  };
                  
                  return (
                    <div key={status} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${colors[status as keyof typeof colors] || 'bg-gray-500'}`}></div>
                        <span className="font-medium capitalize">{status}</span>
                      </div>
                      <Badge variant="secondary">{count}</Badge>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="errors" className="space-y-4">
          {result.erros > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-red-600">
                  <AlertTriangle className="h-5 w-5" />
                  Erros Encontrados ({result.erros})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {result.detalhes.erros.map((erro, index) => (
                    <Alert key={index} variant="destructive">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        <div className="font-medium mb-1">
                          Linha {erro.linha}: {erro.erro}
                        </div>
                        <div className="text-sm text-gray-600">
                          <strong>Nome:</strong> {String((erro.dados as Record<string, unknown>)?.nome || 'N/A')} • 
                          <strong> Matrícula:</strong> {String((erro.dados as Record<string, unknown>)?.matricula || 'N/A')} • 
                          <strong> CPF:</strong> {String((erro.dados as Record<string, unknown>)?.cpf || 'N/A')}
                        </div>
                      </AlertDescription>
                    </Alert>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-8 text-center">
                <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-green-600 mb-2">Nenhum Erro Encontrado!</h3>
                <p className="text-gray-600">Todos os registros foram processados com sucesso.</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Botão de exportação */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Relatório Detalhado</h3>
              <p className="text-gray-600">Exporte um relatório completo em Excel com todos os detalhes do processamento</p>
            </div>
            <Button onClick={exportDetailedReport} className="flex items-center gap-2">
              <Download className="h-4 w-4" />
              Exportar Relatório
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
