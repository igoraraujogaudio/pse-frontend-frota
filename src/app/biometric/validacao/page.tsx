'use client';

import { useState, useEffect } from 'react';
import { Fingerprint, CheckCircle, XCircle, Loader2, AlertTriangle, User } from 'lucide-react';
import {
  validateFingerprint,
  type CompareResult,
} from '@/services/biometricTemplateService';
import { checkDesktopAvailability } from '@/services/desktopBiometricIntegration';

export default function BiometricValidacaoPage() {
  const [available, setAvailable] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(true);
  const [validating, setValidating] = useState(false);
  const [result, setResult] = useState<{
    captured: { template: string; quality: number; image_base64?: string };
    comparison: CompareResult;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [threshold, setThreshold] = useState(80.0);

  useEffect(() => {
    checkAvailability();
  }, []);

  const checkAvailability = async () => {
    setChecking(true);
    const isAvailable = await checkDesktopAvailability();
    setAvailable(isAvailable);
    setChecking(false);
  };

  const handleValidate = async () => {
    setValidating(true);
    setError(null);
    setResult(null);

    try {
      const validationResult = await validateFingerprint(threshold, 30000);
      setResult(validationResult);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao validar digital';
      setError(errorMessage);
    } finally {
      setValidating(false);
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600">Verificando disponibilidade do serviço...</p>
        </div>
      </div>
    );
  }

  if (available === false) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-2xl mx-auto">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
            <div className="flex items-start gap-4">
              <AlertTriangle className="w-6 h-6 text-yellow-600 flex-shrink-0 mt-1" />
              <div>
                <h2 className="text-lg font-semibold text-yellow-900 mb-2">
                  Serviço não disponível
                </h2>
                <p className="text-yellow-800 mb-4">
                  O aplicativo desktop não está rodando ou a API local não está acessível.
                </p>
                <button
                  onClick={checkAvailability}
                  className="px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700"
                >
                  Tentar novamente
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="flex items-center gap-3 mb-6">
            <Fingerprint className="w-8 h-8 text-green-600" />
            <h1 className="text-3xl font-bold text-gray-900">
              Validação de Digital Biométrica
            </h1>
          </div>

          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
              <XCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
              <p className="text-red-800">{error}</p>
            </div>
          )}

          {/* Configuração de Threshold */}
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <label className="block text-sm font-medium text-blue-700 mb-2">
              Threshold de Similaridade: {threshold}%
            </label>
            <input
              type="range"
              min="50"
              max="100"
              step="1"
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
              className="w-full"
            />
            <p className="text-xs text-blue-600 mt-1">
              Ajuste o nível de similaridade necessário para considerar uma correspondência (50-100%)
            </p>
          </div>

          {/* Botão de Validação */}
          <div className="mb-6">
            <button
              onClick={handleValidate}
              disabled={validating}
              className="w-full px-6 py-4 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-lg font-semibold"
            >
              {validating ? (
                <>
                  <Loader2 className="w-6 h-6 animate-spin" />
                  Validando digital... Coloque o dedo no leitor (máx. 30s)
                </>
              ) : (
                <>
                  <Fingerprint className="w-6 h-6" />
                  Validar Digital
                </>
              )}
            </button>
          </div>

          {/* Resultado da Validação */}
          {result && (
            <div className={`p-6 rounded-lg border-2 ${
              result.comparison.match
                ? 'bg-green-50 border-green-500'
                : 'bg-red-50 border-red-500'
            }`}>
              <div className="flex items-center gap-3 mb-4">
                {result.comparison.match ? (
                  <CheckCircle className="w-8 h-8 text-green-600" />
                ) : (
                  <XCircle className="w-8 h-8 text-red-600" />
                )}
                <h3 className={`text-2xl font-bold ${
                  result.comparison.match ? 'text-green-900' : 'text-red-900'
                }`}>
                  {result.comparison.match ? '✓ Digital Validada!' : '✗ Digital Não Encontrada'}
                </h3>
              </div>

              {result.comparison.match && (
                <div className="space-y-2 mb-4">
                  <div className="flex items-center gap-2">
                    <User className="w-5 h-5 text-green-700" />
                    <p className="text-green-900">
                      <strong>Usuário:</strong> {result.comparison.user_name || 'Não informado'}
                    </p>
                  </div>
                  {result.comparison.user_id && (
                    <p className="text-sm text-green-700">
                      <strong>ID:</strong> {result.comparison.user_id}
                    </p>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <p className="text-sm text-gray-600">Similaridade</p>
                  <p className={`text-2xl font-bold ${
                    result.comparison.match ? 'text-green-700' : 'text-red-700'
                  }`}>
                    {result.comparison.similarity.toFixed(2)}%
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Threshold</p>
                  <p className="text-2xl font-bold text-gray-700">
                    {result.comparison.threshold}%
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Qualidade da Captura</p>
                  <p className="text-2xl font-bold text-gray-700">
                    {result.captured.quality}/100
                  </p>
                </div>
              </div>

              {result.captured.image_base64 && (
                <div className="mt-4">
                  <p className="text-sm text-gray-600 mb-2">Imagem Capturada:</p>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`data:image/png;base64,${result.captured.image_base64}`}
                    alt="Digital capturada"
                    className="max-w-xs h-auto border border-gray-300 rounded shadow-md"
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

