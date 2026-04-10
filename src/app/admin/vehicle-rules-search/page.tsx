'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Search, Car, FileText, AlertTriangle, CheckCircle, Clock, XCircle } from 'lucide-react';

interface VehicleInfo {
  id: string;
  placa: string;
  tipo_veiculo: string;
  contrato: {
    id: string;
    nome: string;
    codigo: string;
  } | null;
}

interface AppliedRule {
  documentos_obrigatorios: string[];
  documentos_opcionais: string[];
  origem: string;
  descricao: string;
}

interface CandidateRule {
  id: string;
  tipo_veiculo: string | null;
  prefixo_placa: string | null;
  prefixos_placa: string[] | null;
  placa_especifica: string | null;
  contrato_id: string | null;
  documentos_obrigatorios: string[];
  documentos_opcionais: string[];
  descricao: string;
  ativa: boolean;
  criado_em: string;
  contrato: {
    id: string;
    nome: string;
    codigo: string;
  } | null;
}

interface ExistingDocument {
  tipo_documento: string;
  numero_documento: string | null;
  data_emissao: string;
  data_vencimento: string | null;
  ativo: boolean;
}

interface SearchResult {
  veiculo: VehicleInfo;
  regra_aplicada: AppliedRule | null;
  regras_candidatas: CandidateRule[];
  documentos_existentes: ExistingDocument[];
}

const DOCUMENT_TYPES = {
  crlv: 'CRLV',
  tacografo: 'Laudo Tacógrafo',
  fumaca: 'Laudo de Fumaça',
  eletrico: 'Laudo Elétrico',
  acustico: 'Laudo Acústico',
  aet: 'AET',
  apolice: 'Apólice',
  contrato_seguro: 'Contrato de Aluguel'
};

export default function VehicleRulesSearchPage() {
  const [placa, setPlaca] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async () => {
    if (!placa.trim()) {
      setError('Digite uma placa para pesquisar');
      return;
    }

    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch(`/api/vehicles/search-rules?placa=${encodeURIComponent(placa.trim())}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        
        if (response.status === 404) {
          throw new Error('Veículo não encontrado. Verifique se a placa está correta.');
        } else {
          throw new Error(errorData.error || 'Erro ao buscar informações');
        }
      }

      const data = await response.json();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao buscar informações');
    } finally {
      setIsLoading(false);
    }
  };

  const getRuleType = (rule: CandidateRule): string => {
    if (rule.placa_especifica) return 'Placa Específica';
    if (rule.prefixos_placa && rule.prefixos_placa.length > 0) return 'Múltiplos Prefixos';
    if (rule.contrato_id) return 'Contrato Específico';
    if (rule.tipo_veiculo) return 'Tipo de Veículo';
    if (rule.prefixo_placa) return 'Prefixo de Placa';
    return 'Regra Geral';
  };

  const getRuleDescription = (rule: CandidateRule): string => {
    if (rule.placa_especifica) return `Placa: ${rule.placa_especifica}`;
    if (rule.prefixos_placa && rule.prefixos_placa.length > 0) return `Prefixos: ${rule.prefixos_placa.join(', ')}`;
    if (rule.contrato) return `Contrato: ${rule.contrato.nome} (${rule.contrato.codigo})`;
    if (rule.tipo_veiculo) return `Tipo: ${rule.tipo_veiculo}`;
    if (rule.prefixo_placa) return `Prefixo: ${rule.prefixo_placa}`;
    return 'Regra geral';
  };

  const isDocumentRequired = (docType: string, appliedRule: AppliedRule | null): boolean => {
    if (!appliedRule) return false;
    return appliedRule.documentos_obrigatorios.includes(docType);
  };

  const isDocumentOptional = (docType: string, appliedRule: AppliedRule | null): boolean => {
    if (!appliedRule) return false;
    return appliedRule.documentos_opcionais.includes(docType);
  };

  const hasDocument = (docType: string, existingDocs: ExistingDocument[]): boolean => {
    return existingDocs.some(doc => doc.tipo_documento === docType && doc.ativo);
  };

  const getDocumentStatus = (docType: string, appliedRule: AppliedRule | null, existingDocs: ExistingDocument[]) => {
    const isRequired = isDocumentRequired(docType, appliedRule);
    const isOptional = isDocumentOptional(docType, appliedRule);
    const exists = hasDocument(docType, existingDocs);

    if (isRequired && exists) return { status: 'ok', label: 'Obrigatório - Presente', color: 'bg-green-100 text-green-800' };
    if (isRequired && !exists) return { status: 'missing', label: 'Obrigatório - Ausente', color: 'bg-red-100 text-red-800' };
    if (isOptional && exists) return { status: 'optional', label: 'Opcional - Presente', color: 'bg-blue-100 text-blue-800' };
    if (isOptional && !exists) return { status: 'optional-missing', label: 'Opcional - Ausente', color: 'bg-gray-100 text-gray-800' };
    return { status: 'not-applicable', label: 'Não aplicável', color: 'bg-gray-100 text-gray-500' };
  };

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Pesquisa de Regras por Placa</h1>
          <p className="text-gray-600">Descubra quais regras se aplicam a um veículo específico e verifique a conformidade dos documentos</p>
        </div>
      </div>

      {/* Search Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Pesquisar Veículo
          </CardTitle>
          <CardDescription>
            Digite a placa do veículo para verificar quais regras se aplicam
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <Label htmlFor="placa">Placa do Veículo</Label>
              <Input
                id="placa"
                placeholder="Ex: ABC-1234"
                value={placa}
                onChange={(e) => setPlaca(e.target.value.toUpperCase())}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              />
            </div>
            <div className="flex items-end">
              <Button 
                onClick={handleSearch} 
                disabled={isLoading}
                className="flex items-center gap-2"
              >
                <Search className="h-4 w-4" />
                {isLoading ? 'Pesquisando...' : 'Pesquisar'}
              </Button>
            </div>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Results */}
      {result && (
        <div className="space-y-6">
          {/* Vehicle Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Car className="h-5 w-5" />
                Informações do Veículo
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label className="text-sm font-medium text-gray-500">Placa</Label>
                  <p className="text-lg font-semibold">{result.veiculo.placa}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-500">Tipo de Veículo</Label>
                  <p className="text-lg font-semibold">{result.veiculo.tipo_veiculo}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-500">Contrato</Label>
                  <p className="text-lg font-semibold">
                    {result.veiculo.contrato 
                      ? `${result.veiculo.contrato.nome} (${result.veiculo.contrato.codigo})`
                      : 'Sem contrato'
                    }
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Applied Rule */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                Regra Aplicada
              </CardTitle>
              <CardDescription>
                A regra que está sendo aplicada a este veículo (maior prioridade)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {result.regra_aplicada ? (
                <div className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Origem da Regra</Label>
                    <p className="text-lg font-semibold">{result.regra_aplicada.origem}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Descrição</Label>
                    <p className="text-sm">{result.regra_aplicada.descricao}</p>
                  </div>
                  
                  {/* Required Documents */}
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Documentos Obrigatórios</Label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {result.regra_aplicada.documentos_obrigatorios.map((doc) => {
                        const status = getDocumentStatus(doc, result.regra_aplicada, result.documentos_existentes);
                        return (
                          <Badge key={doc} className={status.color}>
                            {DOCUMENT_TYPES[doc as keyof typeof DOCUMENT_TYPES] || doc}
                            {status.status === 'ok' && <CheckCircle className="h-3 w-3 ml-1" />}
                            {status.status === 'missing' && <XCircle className="h-3 w-3 ml-1" />}
                          </Badge>
                        );
                      })}
                    </div>
                  </div>

                  {/* Optional Documents */}
                  {result.regra_aplicada.documentos_opcionais.length > 0 && (
                    <div>
                      <Label className="text-sm font-medium text-gray-500">Documentos Opcionais</Label>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {result.regra_aplicada.documentos_opcionais.map((doc) => {
                          const status = getDocumentStatus(doc, result.regra_aplicada, result.documentos_existentes);
                          return (
                            <Badge key={doc} className={status.color}>
                              {DOCUMENT_TYPES[doc as keyof typeof DOCUMENT_TYPES] || doc}
                              {status.status === 'optional' && <CheckCircle className="h-3 w-3 ml-1" />}
                            </Badge>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Nenhuma regra específica encontrada. O veículo está usando as regras padrão do sistema.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          {/* Candidate Rules */}
          {result.regras_candidatas.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-blue-600" />
                  Regras Candidatas
                </CardTitle>
                <CardDescription>
                  Outras regras que poderiam se aplicar a este veículo (ordenadas por prioridade)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {result.regras_candidatas.map((rule, index) => (
                    <div key={rule.id} className="border rounded-lg p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">#{index + 1}</Badge>
                          <span className="font-medium">{getRuleType(rule)}</span>
                        </div>
                        <Badge variant={rule.id === result.regra_aplicada?.origem ? 'default' : 'secondary'}>
                          {rule.id === result.regra_aplicada?.origem ? 'Aplicada' : 'Não aplicada'}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600">{getRuleDescription(rule)}</p>
                      <p className="text-sm">{rule.descricao}</p>
                      <div className="flex flex-wrap gap-1">
                        {rule.documentos_obrigatorios.map((doc) => (
                          <Badge key={doc} variant="destructive" className="text-xs">
                            {DOCUMENT_TYPES[doc as keyof typeof DOCUMENT_TYPES] || doc}
                          </Badge>
                        ))}
                        {rule.documentos_opcionais.map((doc) => (
                          <Badge key={doc} variant="secondary" className="text-xs">
                            {DOCUMENT_TYPES[doc as keyof typeof DOCUMENT_TYPES] || doc}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Existing Documents */}
          {result.documentos_existentes.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-purple-600" />
                  Documentos Existentes
                </CardTitle>
                <CardDescription>
                  Documentos já cadastrados para este veículo
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {result.documentos_existentes.map((doc, index) => (
                    <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <span className="font-medium">
                          {DOCUMENT_TYPES[doc.tipo_documento as keyof typeof DOCUMENT_TYPES] || doc.tipo_documento}
                        </span>
                        {doc.numero_documento && (
                          <span className="text-sm text-gray-500 ml-2">({doc.numero_documento})</span>
                        )}
                      </div>
                      <div className="text-sm text-gray-500">
                        Emissão: {new Date(doc.data_emissao).toLocaleDateString('pt-BR')}
                        {doc.data_vencimento && (
                          <span className="ml-2">
                            Vencimento: {new Date(doc.data_vencimento).toLocaleDateString('pt-BR')}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
