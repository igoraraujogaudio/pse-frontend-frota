'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useNotification } from '@/contexts/NotificationContext';
import { 
  ArrowPathIcon,
  CheckCircleIcon,
  XCircleIcon
} from '@heroicons/react/24/outline';

interface DetalhesOrdem {
  usuarioNome?: string;
  usuarioMatricula?: string;
  baseNome?: string;
  contratoNome?: string;
  contratoCodigo?: string;
  dataAssinatura?: string;
  status: 'assinada' | 'recusada';
  valorTotal?: number;
  descricao?: string;
}

interface Resultado {
  ordemId: string;
  success: boolean;
  destinatarios: number;
  error?: string;
  detalhes?: DetalhesOrdem;
}

export default function ReenviarEmailsOrdensDescontoPage() {
  const { notify } = useNotification();
  const [dataInicio, setDataInicio] = useState('2025-12-22');
  const [dataFim, setDataFim] = useState('2026-01-06');
  const [dryRun, setDryRun] = useState(true);
  const [processando, setProcessando] = useState(false);
  const [resultado, setResultado] = useState<{
    total: number;
    enviados: number;
    erros: number;
    resultados: Resultado[];
  } | null>(null);

  const handleReenviar = async () => {
    if (!dataInicio || !dataFim) {
      notify('Informe as datas de início e fim', 'error');
      return;
    }

    setProcessando(true);
    setResultado(null);

    try {
      const response = await fetch('/api/admin/reenviar-emails-ordens-desconto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dataInicio,
          dataFim,
          dryRun
        })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setResultado({
          total: data.total,
          enviados: data.enviados,
          erros: data.erros,
          resultados: data.resultados || []
        });
        
        if (dryRun) {
          notify(`Dry run: ${data.total} ordens seriam processadas`, 'info');
        } else {
          notify(
            `Reenvio concluído: ${data.enviados} emails enviados, ${data.erros} erros`,
            data.erros === 0 ? 'success' : 'warning'
          );
        }
      } else {
        notify(data.error || 'Erro ao reenviar emails', 'error');
      }
    } catch (error) {
      console.error('Erro ao reenviar emails:', error);
      notify('Erro ao reenviar emails', 'error');
    } finally {
      setProcessando(false);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Reenviar Emails de Ordens de Desconto</h1>
        <p className="text-gray-600 mt-1">
          Reenvia emails de ordens de desconto que tiveram upload feito em um período específico
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Configuração do Reenvio</CardTitle>
          <CardDescription>
            Selecione o período e execute o reenvio de emails
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Data Início *
              </label>
              <input
                type="date"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Data Fim *
              </label>
              <input
                type="date"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
          </div>

          <div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={dryRun}
                onChange={(e) => setDryRun(e.target.checked)}
              />
              <span className="text-sm font-medium text-gray-700">
                Modo Dry Run (simular sem enviar)
              </span>
            </label>
            <p className="text-xs text-gray-500 mt-1">
              Se marcado, apenas simula o envio sem enviar os emails realmente
            </p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleReenviar}
              disabled={processando}
              className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ArrowPathIcon className={`w-5 h-5 ${processando ? 'animate-spin' : ''}`} />
              {processando 
                ? 'Processando...' 
                : dryRun 
                  ? 'Simular Reenvio' 
                  : 'Reenviar Emails'}
            </button>
          </div>
        </CardContent>
      </Card>

      {resultado && (
        <Card>
          <CardHeader>
            <CardTitle>Resultado do Reenvio</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="p-4 bg-blue-50 rounded-lg">
                  <div className="text-sm text-gray-600">Total de Ordens</div>
                  <div className="text-2xl font-bold text-blue-600">{resultado.total}</div>
                </div>
                <div className="p-4 bg-green-50 rounded-lg">
                  <div className="text-sm text-gray-600">Emails Enviados</div>
                  <div className="text-2xl font-bold text-green-600">{resultado.enviados}</div>
                </div>
                <div className="p-4 bg-red-50 rounded-lg">
                  <div className="text-sm text-gray-600">Erros</div>
                  <div className="text-2xl font-bold text-red-600">{resultado.erros}</div>
                </div>
              </div>

              {resultado.resultados.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-4">Detalhes por Ordem:</h3>
                  <div className="max-h-96 overflow-y-auto space-y-3">
                    {resultado.resultados.map((r, index) => (
                      <div
                        key={index}
                        className={`p-4 rounded-lg border ${
                          r.success
                            ? 'bg-green-50 border-green-200'
                            : 'bg-red-50 border-red-200'
                        }`}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-2">
                            {r.success ? (
                              <CheckCircleIcon className="w-5 h-5 text-green-600" />
                            ) : (
                              <XCircleIcon className="w-5 h-5 text-red-600" />
                            )}
                            <div>
                              <span className="font-mono text-sm font-semibold">
                                {r.ordemId.substring(0, 8)}...
                              </span>
                              {r.detalhes?.status && (
                                <span className={`ml-2 px-2 py-1 rounded text-xs font-medium ${
                                  r.detalhes.status === 'assinada'
                                    ? 'bg-green-100 text-green-800'
                                    : 'bg-red-100 text-red-800'
                                }`}>
                                  {r.detalhes.status === 'assinada' ? '✅ Assinada' : '❌ Recusada'}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="text-sm text-right">
                            {r.success ? (
                              <span className="text-green-600 font-medium">
                                {r.destinatarios} destinatário(s)
                              </span>
                            ) : (
                              <span className="text-red-600">{r.error}</span>
                            )}
                          </div>
                        </div>

                        {r.detalhes && (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm border-t pt-3 mt-3">
                            {r.detalhes.usuarioNome && (
                              <div>
                                <span className="font-medium text-gray-600">Funcionário:</span>{' '}
                                <span className="text-gray-900">
                                  {r.detalhes.usuarioNome}
                                  {r.detalhes.usuarioMatricula && ` (${r.detalhes.usuarioMatricula})`}
                                </span>
                              </div>
                            )}
                            {r.detalhes.baseNome && (
                              <div>
                                <span className="font-medium text-gray-600">Base:</span>{' '}
                                <span className="text-gray-900">{r.detalhes.baseNome}</span>
                              </div>
                            )}
                            {r.detalhes.contratoNome && (
                              <div>
                                <span className="font-medium text-gray-600">Contrato:</span>{' '}
                                <span className="text-gray-900">
                                  {r.detalhes.contratoNome}
                                  {r.detalhes.contratoCodigo && ` (${r.detalhes.contratoCodigo})`}
                                </span>
                              </div>
                            )}
                            {r.detalhes.dataAssinatura && (
                              <div>
                                <span className="font-medium text-gray-600">Data Assinatura:</span>{' '}
                                <span className="text-gray-900">
                                  {new Date(r.detalhes.dataAssinatura).toLocaleString('pt-BR')}
                                </span>
                              </div>
                            )}
                            {r.detalhes.valorTotal !== undefined && r.detalhes.valorTotal !== null && (
                              <div>
                                <span className="font-medium text-gray-600">Valor Total:</span>{' '}
                                <span className="text-gray-900 font-semibold">
                                  R$ {r.detalhes.valorTotal.toLocaleString('pt-BR', {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2
                                  })}
                                </span>
                              </div>
                            )}
                            {r.detalhes.descricao && (
                              <div className="md:col-span-2">
                                <span className="font-medium text-gray-600">Descrição:</span>{' '}
                                <span className="text-gray-900">{r.detalhes.descricao}</span>
                              </div>
                            )}
                          </div>
                        )}
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
  );
}
