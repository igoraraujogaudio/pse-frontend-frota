'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { modularPermissionService } from '@/services/modularPermissionService';

export default function DatabaseTestComponent() {
  const [testResults, setTestResults] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(false);

  const runTests = async () => {
    setLoading(true);
    const results: Record<string, unknown> = {};

    try {
      console.log('🧪 Iniciando testes do banco de dados...');
      
      // Teste 1: Funcionalidades Modulares
      try {
        const funcionalidades = await modularPermissionService.getFuncionalidadesModulares();
        results.funcionalidadesModulares = {
          success: true,
          count: funcionalidades.length,
          data: funcionalidades.slice(0, 3) // Primeiros 3 para debug
        };
      } catch (error) {
        results.funcionalidadesModulares = {
          success: false,
          error: error
        };
      }

      // Teste 2: Módulos do Sistema
      try {
        const modulos = await modularPermissionService.getModulosSistema();
        results.modulosSistema = {
          success: true,
          count: modulos.length,
          data: modulos.slice(0, 3)
        };
      } catch (error) {
        results.modulosSistema = {
          success: false,
          error: error
        };
      }

      // Teste 3: Plataformas
      try {
        const plataformas = await modularPermissionService.getPlataformas();
        results.plataformas = {
          success: true,
          count: plataformas.length,
          data: plataformas.slice(0, 3)
        };
      } catch (error) {
        results.plataformas = {
          success: false,
          error: error
        };
      }

      // Teste 4: Perfis de Acesso
      try {
        const perfis = await modularPermissionService.getPerfisAcesso();
        results.perfisAcesso = {
          success: true,
          count: perfis.length,
          data: perfis.slice(0, 3)
        };
      } catch (error) {
        results.perfisAcesso = {
          success: false,
          error: error
        };
      }

      // Teste 5: Permissões de Usuários
      try {
        const permissoes = await modularPermissionService.getAllUsuarioPermissoesModulares();
        results.usuarioPermissoesModulares = {
          success: true,
          count: permissoes.length,
          data: permissoes.slice(0, 3)
        };
      } catch (error) {
        results.usuarioPermissoesModulares = {
          success: false,
          error: error
        };
      }

      console.log('🧪 Testes concluídos:', results);
      setTestResults(results);

    } catch (error) {
      console.error('❌ Erro geral nos testes:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            🧪 Teste do Banco de Dados Modular
          </CardTitle>
          <CardDescription>
            Verificar se as tabelas modulares existem e têm dados
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Button 
              onClick={runTests} 
              disabled={loading}
              className="w-full"
            >
              {loading ? '🔄 Testando...' : '🧪 Executar Testes'}
            </Button>

            {Object.keys(testResults).length > 0 && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Resultados dos Testes:</h3>
                
                {Object.entries(testResults).map(([key, result]) => {
                  const typedResult = result as { success: boolean; count?: number; data?: unknown; error?: string };
                  return (
                  <Card key={key}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-semibold">{key}</h4>
                        <Badge variant={typedResult.success ? "default" : "destructive"}>
                          {typedResult.success ? `✅ ${typedResult.count} registros` : '❌ Erro'}
                        </Badge>
                      </div>
                      
                      {typedResult.success ? (
                        <div className="text-sm text-gray-600">
                          <p>Total: {typedResult.count} registros</p>
                          {(() => {
                            if (typedResult.data && Array.isArray(typedResult.data) && typedResult.data.length > 0) {
                              return (
                                <div className="mt-2">
                                  <p className="font-medium">Primeiros registros:</p>
                                  <pre className="bg-gray-100 p-2 rounded text-xs overflow-x-auto">
                                    {JSON.stringify(typedResult.data, null, 2)}
                                  </pre>
                                </div>
                              );
                            }
                            return null;
                          })()}
                        </div>
                      ) : (
                        <div className="text-sm text-red-600">
                          <p className="font-medium">Erro:</p>
                          <pre className="bg-red-50 p-2 rounded text-xs overflow-x-auto">
                            {JSON.stringify(typedResult.error, null, 2)}
                          </pre>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                  );
                })}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

