'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface Rule {
  id?: string;
  criterio: string;
  valor_criterio: string;
  tipos_documento: string[];
  obrigatorio: boolean;
  total_veiculos_afetados?: number;
  descricao?: string;
  documentos_obrigatorios?: string[];
  documentos_opcionais?: string[];
}

interface Contract {
  id?: string;
  nome: string;
  codigo: string;
  total_veiculos: number;
}

interface DebugInfo {
  apiResponse?: { rules?: Rule[] };
  apiError?: string;
  contractsResponse?: { contracts?: Contract[] };
  contractsError?: string;
}

export default function DocumentRulesDebugPage() {
  const [debugInfo, setDebugInfo] = useState<DebugInfo>({});
  const [loading, setLoading] = useState(false);

  const testAPIs = async () => {
    setLoading(true);
    const info: DebugInfo = {};

    // Testar API de regras
    try {
      console.log('🔍 Testando API /api/admin/document-rules...');
      const rulesResponse = await fetch('/api/admin/document-rules');
      const rulesText = await rulesResponse.text();
      
      console.log('📊 Status da resposta:', rulesResponse.status);
      console.log('📊 Headers da resposta:', Object.fromEntries(rulesResponse.headers.entries()));
      console.log('📊 Texto da resposta:', rulesText);
      
      if (rulesResponse.ok) {
        try {
          info.apiResponse = JSON.parse(rulesText);
          console.log('✅ API de regras funcionando:', info.apiResponse);
        } catch (parseError) {
          console.error('❌ Erro ao fazer parse do JSON:', parseError);
          info.apiError = `Erro de parse: ${parseError}. Resposta: ${rulesText}`;
        }
      } else {
        info.apiError = `HTTP ${rulesResponse.status}: ${rulesText}`;
        console.error('❌ Erro na API de regras:', info.apiError);
      }
    } catch (error: unknown) {
      info.apiError = `Erro de rede: ${error instanceof Error ? error.message : 'Erro desconhecido'}`;
      console.error('❌ Erro de rede na API de regras:', error);
    }

    // Testar API de contratos
    try {
      console.log('🔍 Testando API /api/admin/contracts...');
      const contractsResponse = await fetch('/api/admin/contracts');
      const contractsText = await contractsResponse.text();
      
      console.log('📊 Status da resposta contratos:', contractsResponse.status);
      console.log('📊 Texto da resposta contratos:', contractsText);
      
      if (contractsResponse.ok) {
        try {
          info.contractsResponse = JSON.parse(contractsText);
          console.log('✅ API de contratos funcionando:', info.contractsResponse);
        } catch (parseError) {
          console.error('❌ Erro ao fazer parse do JSON contratos:', parseError);
          info.contractsError = `Erro de parse: ${parseError}. Resposta: ${contractsText}`;
        }
      } else {
        info.contractsError = `HTTP ${contractsResponse.status}: ${contractsText}`;
        console.error('❌ Erro na API de contratos:', info.contractsError);
      }
    } catch (error: unknown) {
      info.contractsError = `Erro de rede: ${error instanceof Error ? error.message : 'Erro desconhecido'}`;
      console.error('❌ Erro de rede na API de contratos:', error);
    }

    setDebugInfo(info);
    setLoading(false);
  };

  useEffect(() => {
    testAPIs();
  }, []);

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Debug - Document Rules</h1>
          <p className="text-gray-600">Diagnóstico da página de regras de documentação</p>
        </div>
        <Button onClick={testAPIs} disabled={loading}>
          {loading ? 'Testando...' : 'Testar APIs'}
        </Button>
      </div>

      {/* API de Regras */}
      <Card>
        <CardHeader>
          <CardTitle>API de Regras (/api/admin/document-rules)</CardTitle>
          <CardDescription>Resultado do teste da API principal</CardDescription>
        </CardHeader>
        <CardContent>
          {debugInfo.apiError ? (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <h4 className="font-medium text-red-800 mb-2">❌ Erro na API</h4>
              <pre className="text-sm text-red-700 whitespace-pre-wrap">
                {debugInfo.apiError}
              </pre>
            </div>
          ) : debugInfo.apiResponse ? (
            <div className="space-y-4">
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <h4 className="font-medium text-green-800 mb-2">✅ API Funcionando</h4>
                <p className="text-sm text-green-700">
                  {debugInfo.apiResponse.rules?.length || 0} regras encontradas
                </p>
              </div>
              
              <div>
                <h4 className="font-medium mb-2">Resposta da API:</h4>
                <pre className="text-xs bg-gray-100 p-3 rounded-lg overflow-auto max-h-64">
                  {JSON.stringify(debugInfo.apiResponse, null, 2)}
                </pre>
              </div>

              {debugInfo.apiResponse.rules && debugInfo.apiResponse.rules.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">Regras Encontradas:</h4>
                  <div className="space-y-2">
                    {debugInfo.apiResponse.rules.map((rule: Rule, index: number) => (
                      <div key={rule.id || index} className="border rounded p-3">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline">{rule.criterio}</Badge>
                          <span className="font-medium">{rule.valor_criterio}</span>
                          <span className="text-sm text-gray-500">
                            ({rule.total_veiculos_afetados} veículos)
                          </span>
                        </div>
                        <p className="text-sm text-gray-600">{rule.descricao}</p>
                        <div className="text-xs text-gray-500 mt-1">
                          Obrigatórios: {rule.documentos_obrigatorios?.length || 0} | 
                          Opcionais: {rule.documentos_opcionais?.length || 0}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-yellow-800">⏳ Carregando...</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* API de Contratos */}
      <Card>
        <CardHeader>
          <CardTitle>API de Contratos (/api/admin/contracts)</CardTitle>
          <CardDescription>Resultado do teste da API de contratos</CardDescription>
        </CardHeader>
        <CardContent>
          {debugInfo.contractsError ? (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <h4 className="font-medium text-red-800 mb-2">❌ Erro na API</h4>
              <pre className="text-sm text-red-700 whitespace-pre-wrap">
                {debugInfo.contractsError}
              </pre>
            </div>
          ) : debugInfo.contractsResponse ? (
            <div className="space-y-4">
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <h4 className="font-medium text-green-800 mb-2">✅ API Funcionando</h4>
                <p className="text-sm text-green-700">
                  {debugInfo.contractsResponse.contracts?.length || 0} contratos encontrados
                </p>
              </div>
              
              <div>
                <h4 className="font-medium mb-2">Resposta da API:</h4>
                <pre className="text-xs bg-gray-100 p-3 rounded-lg overflow-auto max-h-64">
                  {JSON.stringify(debugInfo.contractsResponse, null, 2)}
                </pre>
              </div>

              {debugInfo.contractsResponse.contracts && debugInfo.contractsResponse.contracts.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">Contratos Encontrados:</h4>
                  <div className="space-y-2">
                    {debugInfo.contractsResponse.contracts.map((contract: Contract, index: number) => (
                      <div key={contract.id || index} className="border rounded p-3">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium">{contract.nome}</span>
                          <Badge variant="outline">{contract.codigo}</Badge>
                          <span className="text-sm text-gray-500">
                            ({contract.total_veiculos} veículos)
                          </span>
                        </div>
                        <div className="text-xs text-gray-500">
                          ID: {contract.id}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-yellow-800">⏳ Carregando...</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Informações do Console */}
      <Card>
        <CardHeader>
          <CardTitle>Console do Navegador</CardTitle>
          <CardDescription>Abra o console do navegador (F12) para ver logs detalhados</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h4 className="font-medium text-blue-800 mb-2">🔍 Instruções</h4>
            <ol className="text-sm text-blue-700 space-y-1 list-decimal list-inside">
              <li>Abra as ferramentas de desenvolvedor (F12)</li>
              <li>Vá para a aba &quot;Console&quot;</li>
              <li>Clique no botão &quot;Testar APIs&quot; acima</li>
              <li>Verifique as mensagens de log no console</li>
              <li>Procure por erros em vermelho ou avisos em amarelo</li>
            </ol>
          </div>
        </CardContent>
      </Card>

      {/* Links úteis */}
      <Card>
        <CardHeader>
          <CardTitle>Links de Debug</CardTitle>
          <CardDescription>Acesso direto às APIs para teste manual</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div>
              <a 
                href="/api/admin/document-rules" 
                target="_blank" 
                className="text-blue-600 hover:underline"
              >
                📊 /api/admin/document-rules
              </a>
              <span className="text-sm text-gray-500 ml-2">- API principal de regras</span>
            </div>
            <div>
              <a 
                href="/api/admin/contracts" 
                target="_blank" 
                className="text-blue-600 hover:underline"
              >
                🏢 /api/admin/contracts
              </a>
              <span className="text-sm text-gray-500 ml-2">- API de contratos</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
