'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, Upload, FileText, AlertCircle } from 'lucide-react';
import ProtectedRoute from '@/components/ProtectedRoute';

interface UsuarioData {
  matricula: string;
  cpf?: string;
  data_nascimento?: string;
  data_admissao?: string;
}

interface ResultadoUpload {
  matricula: string;
  nome: string;
  cpf: string;
  data_nascimento: string;
  data_admissao: string;
  status: 'sucesso' | 'erro';
  mensagem: string;
}

export default function UploadCPFTestPage() {
  const [dados, setDados] = useState('');
  const [loading, setLoading] = useState(false);
  const [resultados, setResultados] = useState<{
    sucesso: number;
    erros: number;
    detalhes: ResultadoUpload[];
  } | null>(null);

  const processarDados = (texto: string): UsuarioData[] => {
    const linhas = texto.trim().split('\n');
    const usuarios: UsuarioData[] = [];

    for (const linha of linhas) {
      const partes = linha.split(',').map(p => p.trim());
      if (partes.length >= 2) {
        usuarios.push({
          matricula: partes[0],
          cpf: partes[1] || undefined,
          data_nascimento: partes[2] || undefined,
          data_admissao: partes[3] || undefined
        });
      }
    }

    return usuarios;
  };

  const handleUpload = async () => {
    if (!dados.trim()) {
      alert('Por favor, insira os dados dos usuários');
      return;
    }

    setLoading(true);
    setResultados(null);

    try {
      const usuarios = processarDados(dados);
      
      if (usuarios.length === 0) {
        alert('Nenhum usuário válido encontrado nos dados');
        return;
      }

      console.log('📤 Enviando dados:', usuarios);

      const response = await fetch('/api/users/upload-cpf-test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ usuarios }),
      });

      const result = await response.json();
      console.log('📥 Resposta:', result);

      if (!response.ok) {
        throw new Error(result.error || 'Erro no upload');
      }

      setResultados(result.resultados);
    } catch (error) {
      console.error('❌ Erro no upload:', error);
      alert(`Erro no upload: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    } finally {
      setLoading(false);
    }
  };

  const exemploFormato = `10763, 123.456.789-00, 15/04/1985, 15/01/2020
10246, 987.654.321-11, 22/08/1990, 22/03/2019
10764, 111.222.333-44, 10/12/1988, 10/07/2021`;

  return (
    <ProtectedRoute requiredAccessLevel={["admin"]}>
      <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">🧪 Teste de Upload de Dados (SEM AUTENTICAÇÃO)</h1>
        <p className="text-gray-600 mt-2">
          Versão de teste para diagnosticar problemas de autenticação
        </p>
      </div>

      <div className="grid gap-6">
        {/* Instruções */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Formato dos Dados
            </CardTitle>
            <CardDescription>
              Insira os dados no formato: Matrícula, CPF, Data de Nascimento, Data de Admissão (um por linha)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="font-medium mb-2">Exemplo:</p>
              <pre className="text-sm text-gray-700">{exemploFormato}</pre>
            </div>
            <div className="mt-4 space-y-2">
              <p className="text-sm text-gray-600">
                • A matrícula deve corresponder exatamente à matrícula no sistema
              </p>
              <p className="text-sm text-gray-600">
                • O CPF pode estar formatado ou não (será validado automaticamente)
              </p>
              <p className="text-sm text-gray-600">
                • As datas devem estar no formato DD/MM/AAAA (ex: 15/04/1985)
              </p>
              <p className="text-sm text-gray-600">
                • Campos opcionais podem ser deixados em branco (ex: 10763, , 15/04/1985, )
              </p>
              <p className="text-sm text-gray-600">
                • Dados existentes serão atualizados com os novos valores
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Área de input */}
        <Card>
          <CardHeader>
            <CardTitle>Dados dos Usuários</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="Cole aqui os dados dos usuários..."
              value={dados}
              onChange={(e) => setDados(e.target.value)}
              rows={10}
              className="mb-4"
            />
            <Button 
              onClick={handleUpload} 
              disabled={loading || !dados.trim()}
              className="w-full"
            >
              <Upload className="h-4 w-4 mr-2" />
              {loading ? 'Processando...' : 'Fazer Upload (TESTE)'}
            </Button>
          </CardContent>
        </Card>

        {/* Resultados */}
        {resultados && (
          <Card>
            <CardHeader>
              <CardTitle>Resultados do Upload</CardTitle>
              <div className="flex gap-4">
                <Badge variant="default" className="bg-green-500">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  {resultados.sucesso} sucessos
                </Badge>
                <Badge variant="destructive">
                  <XCircle className="h-3 w-3 mr-1" />
                  {resultados.erros} erros
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {resultados.detalhes.map((item, index) => (
                  <Alert key={index} variant={item.status === 'sucesso' ? 'default' : 'destructive'}>
                    <div className="flex items-center gap-2">
                      {item.status === 'sucesso' ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-red-500" />
                      )}
                      <div className="flex-1">
                        <div className="font-medium">{item.nome} (Mat: {item.matricula})</div>
                        <div className="text-sm text-gray-600">
                          CPF: {item.cpf} | Nascimento: {item.data_nascimento} | Admissão: {item.data_admissao}
                        </div>
                      </div>
                    </div>
                    <AlertDescription className="mt-2">
                      {item.mensagem}
                    </AlertDescription>
                  </Alert>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
    </ProtectedRoute>
  );
}