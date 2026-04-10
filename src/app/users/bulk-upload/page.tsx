'use client';

import { useState, useEffect } from 'react';
import { DocumentArrowUpIcon, DocumentTextIcon, CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline';
import ProtectedRoute from '@/components/ProtectedRoute';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { modularPermissionService } from '@/services/modularPermissionService';
import type { PerfilAcesso } from '@/types/permissions';

interface UploadResult {
  success: Array<{
    linha: number;
    usuario: Record<string, unknown>;
    email: string;
    senha: string;
  }>;
  errors: Array<{
    linha: number;
    erro: string;
    dados: Record<string, unknown>;
  }>;
  total: number;
}

interface Contrato {
  id: string;
  nome: string;
  codigo: string;
  status: string;
}

interface Base {
  id: string;
  nome: string;
  codigo: string;
  ativa: boolean;
  contrato_id: string;
}

// Removido NIVEL_ACESSO_OPTIONS estático - agora usando perfis da base de dados

export default function BulkUploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [error, setError] = useState('');
  
  // Novos estados para contrato, base e nível de acesso
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [bases, setBases] = useState<Base[]>([]);
  const [selectedContratoId, setSelectedContratoId] = useState('');
  const [selectedBaseId, setSelectedBaseId] = useState('');
  const [selectedNivelAcesso, setSelectedNivelAcesso] = useState('operacao');
  const [loadingData, setLoadingData] = useState(true);
  
  // Estados para perfis de acesso da base de dados
  const [perfisAcesso, setPerfisAcesso] = useState<PerfilAcesso[]>([]);
  const [loadingPerfis, setLoadingPerfis] = useState(true);
  
  // Carregar perfis de acesso da base de dados
  useEffect(() => {
    const loadPerfisAcesso = async () => {
      try {
        setLoadingPerfis(true);
        const perfis = await modularPermissionService.getPerfisAcesso();
        setPerfisAcesso(perfis);
        console.log('✅ Perfis de acesso carregados:', perfis.length);
      } catch (error) {
        console.error('❌ Erro ao carregar perfis de acesso:', error);
      } finally {
        setLoadingPerfis(false);
      }
    };

    loadPerfisAcesso();
  }, []);

  // Carregar contratos e bases
  useEffect(() => {
    const loadData = async () => {
      try {
        const contratosRes = await fetch('/api/admin/contracts');

        if (contratosRes.ok) {
          const contratosResponse = await contratosRes.json();
          // A API retorna { contracts: [...] }
          const contratosData = contratosResponse.contracts || [];
          setContratos(contratosData.filter((c: Contrato) => c.status === 'ativo'));
        }

        // Buscar bases usando a nova API
        try {
          const basesRes = await fetch('/api/bases');
          if (basesRes.ok) {
            const basesData = await basesRes.json();
            setBases(basesData.filter((b: Base) => b.ativa));
          }
        } catch (error) {
          console.warn('Erro ao carregar bases:', error);
          setBases([]);
        }
      } catch (error) {
        console.error('Erro ao carregar dados:', error);
        setError('Erro ao carregar contratos e bases');
      } finally {
        setLoadingData(false);
      }
    };

    loadData();
  }, []);

  // Filtrar bases baseado no contrato selecionado
  const filteredBases = bases.filter(base => 
    !selectedContratoId || base.contrato_id === selectedContratoId
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setResult(null);
      setError('');
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError('Selecione um arquivo');
      return;
    }

    if (!selectedContratoId) {
      setError('Selecione um contrato');
      return;
    }

    if (!selectedBaseId) {
      setError('Selecione uma base');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('contrato_id', selectedContratoId);
      formData.append('base_id', selectedBaseId);
      formData.append('nivel_acesso', selectedNivelAcesso);

      const response = await fetch('/api/users/bulk-upload', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao processar arquivo');
      }

      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  };

  const downloadTemplate = () => {
    const contratoNome = contratos.find(c => c.id === selectedContratoId)?.nome || 'Contrato';
    const baseNome = bases.find(b => b.id === selectedBaseId)?.nome || 'Base';
    
    const template = [
      ['Nome', 'CPF', 'Matrícula', 'Departamento', 'Cargo', 'Posição', 'Telefone', 'Email', 'Telefone Empresarial', 'Data Admissão', 'Data Nascimento', 'CNH', 'Validade CNH', 'CNH Categoria', 'Data Último Exame ASO', 'Data Agendamento ASO', 'HAR Vencimento', 'Data Demissão', 'Tipo Demissão', 'Observações Demissão'],
      ['João Silva', '12345678900', '12345', 'COMERCIAL', 'ELETRICISTA', 'ELETRICISTA', '(11) 99999-9999', 'joao@pse.srv.br', '(11) 3333-4444', '2024-01-15', '1990-05-20', '12345678901', '2025-12-31', 'B', '2024-01-15', '2025-01-15', '2025-06-30', '', '', ''],
      ['Maria Santos', '98765432100', '67890', 'COMERCIAL', 'INSTALADOR ELETRICO A', 'INSTALADOR ELETRICO A', '(11) 88888-8888', 'maria@pse.srv.br', '(11) 2222-3333', '2024-02-20', '1985-08-10', '', '', '', '2024-02-20', '2025-02-20', '', '', '', '']
    ];

    const csvContent = template.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `template_usuarios_${contratoNome}_${baseNome}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <ProtectedRoute requiredAccessLevel={["admin"]}>
      <main className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
        <div className="max-w-6xl mx-auto py-10 px-4">
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-extrabold text-blue-900 tracking-tight mb-2">
              Upload em Lote de Usuários
            </h1>
            <p className="text-lg text-gray-600">
              Importe múltiplos usuários através de uma planilha Excel ou CSV
            </p>
          </div>

          {/* Configurações */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DocumentTextIcon className="h-6 w-6 text-blue-500" />
                Configurações do Upload
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {loadingData ? (
                <div className="text-center py-4">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="mt-2 text-gray-600">Carregando dados...</p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="contrato-select">Contrato *</Label>
                      <Select value={selectedContratoId} onValueChange={(value) => {
                        setSelectedContratoId(value);
                        setSelectedBaseId(''); // Limpa base quando muda contrato
                      }}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione um contrato" />
                        </SelectTrigger>
                        <SelectContent>
                          {contratos.map(contrato => (
                            <SelectItem key={contrato.id} value={contrato.id}>
                              {contrato.nome} ({contrato.codigo})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="base-select">Base *</Label>
                      <Select 
                        value={selectedBaseId} 
                        onValueChange={setSelectedBaseId}
                        disabled={!selectedContratoId}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione uma base" />
                        </SelectTrigger>
                        <SelectContent>
                          {filteredBases.length === 0 ? (
                            <SelectItem value="no-bases" disabled>
                              {selectedContratoId ? 'Nenhuma base encontrada para este contrato' : 'Selecione um contrato primeiro'}
                            </SelectItem>
                          ) : (
                            filteredBases.map(base => (
                              <SelectItem key={base.id} value={base.id}>
                                {base.nome} ({base.codigo})
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="nivel-select">Nível de Acesso *</Label>
                      <Select value={selectedNivelAcesso} onValueChange={setSelectedNivelAcesso}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {loadingPerfis ? (
                            <SelectItem value="loading" disabled>Carregando perfis...</SelectItem>
                          ) : (
                            perfisAcesso.map(perfil => (
                              <SelectItem key={perfil.id} value={perfil.codigo}>
                                {perfil.nome} ({perfil.codigo})
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <Alert>
                    <AlertDescription>
                      <div className="space-y-2">
                        <p><strong>Instruções:</strong></p>
                        <p>• A planilha deve conter as colunas: <strong>Nome, CPF, Matrícula</strong> (obrigatórias)</p>
                        <p>• Colunas opcionais: <strong>Departamento, Cargo, Posição, Telefone, Email</strong></p>
                        <p>• O CPF deve ser informado apenas com números (ex: 12345678900)</p>
                        <p>• O CPF será validado automaticamente</p>
                        <p>• Se não informado, o email será gerado como: matrícula@pse.srv.br</p>
                        <p>• A senha padrão será: pse2025</p>
                        <p>• Usuários duplicados (mesmo CPF ou matrícula) serão ignorados</p>
                        <p>• Todos os usuários serão associados ao contrato e base selecionados</p>
                      </div>
                    </AlertDescription>
                  </Alert>

                  <div className="flex justify-between items-center">
                    <Button
                      onClick={downloadTemplate}
                      disabled={!selectedContratoId || !selectedBaseId}
                      variant="outline"
                    >
                      Baixar Modelo de Planilha
                    </Button>
                    
                    <div className="text-sm text-gray-600">
                      {selectedContratoId && selectedBaseId && (
                        <span>
                          Contrato: {contratos.find(c => c.id === selectedContratoId)?.nome} | 
                          Base: {bases.find(b => b.id === selectedBaseId)?.nome}
                        </span>
                      )}
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Upload */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DocumentArrowUpIcon className="h-6 w-6 text-blue-500" />
                Upload da Planilha
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="file-upload">Arquivo Excel/CSV</Label>
                <input
                  id="file-upload"
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-blue-400"
                />
                {file && (
                  <p className="text-sm text-gray-600 mt-2">
                    Arquivo selecionado: {file.name}
                  </p>
                )}
              </div>

              <Button
                onClick={handleUpload}
                disabled={!file || !selectedContratoId || !selectedBaseId || loading}
                className="w-full"
                size="lg"
              >
                {loading ? 'Processando...' : 'Processar Planilha'}
              </Button>
            </CardContent>
          </Card>

          {/* Erro */}
          {error && (
            <Alert variant="destructive" className="mb-6">
              <XCircleIcon className="h-4 w-4" />
              <AlertDescription>
                <strong>Erro:</strong> {error}
              </AlertDescription>
            </Alert>
          )}

          {/* Resultados */}
          {result && (
            <div className="space-y-6">
              {/* Resumo */}
              <Card>
                <CardHeader>
                  <CardTitle>Resumo do Processamento</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-blue-50 p-4 rounded-lg">
                      <div className="text-2xl font-bold text-blue-600">{result.total}</div>
                      <div className="text-blue-600">Total de registros</div>
                    </div>
                    <div className="bg-green-50 p-4 rounded-lg">
                      <div className="text-2xl font-bold text-green-600">{result.success.length}</div>
                      <div className="text-green-600">Criados com sucesso</div>
                    </div>
                    <div className="bg-red-50 p-4 rounded-lg">
                      <div className="text-2xl font-bold text-red-600">{result.errors.length}</div>
                      <div className="text-red-600">Erros encontrados</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Sucessos */}
              {result.success.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-green-800">
                      <CheckCircleIcon className="h-5 w-5 text-green-500" />
                      Usuários Criados ({result.success.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left p-2">Linha</th>
                            <th className="text-left p-2">Nome</th>
                            <th className="text-left p-2">Email</th>
                            <th className="text-left p-2">Senha</th>
                          </tr>
                        </thead>
                        <tbody>
                          {result.success.map((item, index) => (
                            <tr key={index} className="border-b">
                              <td className="p-2">{item.linha}</td>
                              <td className="p-2">{String(item.usuario.nome || '')}</td>
                              <td className="p-2">{item.email}</td>
                              <td className="p-2 font-mono">{item.senha}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Erros */}
              {result.errors.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-red-800">
                      <XCircleIcon className="h-5 w-5 text-red-500" />
                      Erros Encontrados ({result.errors.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {result.errors.map((error, index) => (
                        <Alert key={index} variant="destructive">
                          <AlertDescription>
                            <div className="font-medium">
                              Linha {error.linha}: {error.erro}
                            </div>
                            <div className="text-sm mt-1">
                              Dados: {JSON.stringify(error.dados)}
                            </div>
                          </AlertDescription>
                        </Alert>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>
      </main>
    </ProtectedRoute>
  );
}