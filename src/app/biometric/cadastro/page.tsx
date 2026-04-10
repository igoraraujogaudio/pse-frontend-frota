'use client';

import { useState, useEffect, useCallback } from 'react';
import { Fingerprint, User, CheckCircle, XCircle, Loader2, AlertTriangle } from 'lucide-react';
import {
  captureMultipleFingerprintsWithValidation,
  registerTemplate,
  getUserTemplates,
  deleteTemplate,
  type BiometricTemplate,
} from '@/services/biometricTemplateService';
import { checkDesktopAvailability } from '@/services/desktopBiometricIntegration';
import { UserSearchBox } from '@/components/biometric/UserSearchBox';
import type { User as UserType } from '@/types';

export default function BiometricCadastroPage() {
  const [available, setAvailable] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(true);
  const [capturing, setCapturing] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserType | null>(null);
  const [userId, setUserId] = useState('');
  const [userName, setUserName] = useState('');
  const [finger, setFinger] = useState<'left_thumb' | 'right_thumb' | 'left_index' | 'right_index' | 'other'>('other');
  const [capturedTemplate, setCapturedTemplate] = useState<{
    template: string;
    quality: number;
    image_base64?: string;
  } | null>(null);
  const [multiCapture, setMultiCapture] = useState<{
    captures: Array<{ template: string; quality: number; image_base64?: string }>;
    validated: boolean;
    currentReading: number;
    totalReadings: number;
    similarities: number[][];
  } | null>(null);
  const [templates, setTemplates] = useState<BiometricTemplate[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadUserTemplates = useCallback(async () => {
    if (!userId) return;
    try {
      const userTemplates = await getUserTemplates(userId);
      setTemplates(userTemplates);
    } catch (err) {
      console.error('Erro ao carregar templates:', err);
    }
  }, [userId]);

  useEffect(() => {
    checkAvailability();
  }, []);

  useEffect(() => {
    if (userId) {
      loadUserTemplates();
    }
  }, [userId, loadUserTemplates]);

  const handleUserSelect = (user: UserType | null) => {
    if (user) {
      setSelectedUser(user);
      setUserId(user.id);
      setUserName(user.nome || '');
    } else {
      setSelectedUser(null);
      setUserId('');
      setUserName('');
      setTemplates([]);
    }
  };

  const checkAvailability = async () => {
    setChecking(true);
    const isAvailable = await checkDesktopAvailability();
    setAvailable(isAvailable);
    setChecking(false);
  };

  const handleCapture = async () => {
    setCapturing(true);
    setError(null);
    setSuccess(null);
    setCapturedTemplate(null);
    setMultiCapture(null);

    try {
      // Iniciar captura múltipla com validação
      setMultiCapture({
        captures: [],
        validated: false,
        currentReading: 0,
        totalReadings: 3,
        similarities: [],
      });

      const result = await captureMultipleFingerprintsWithValidation(
        3, // mínimo de 3 leituras
        90.0, // 90% de similaridade mínima
        10, // máximo de 10 tentativas
        30000 // timeout de 30s por captura
      );

      if (result.validated) {
        setCapturedTemplate(result.bestTemplate);
        setSuccess(
          `✓ ${result.captures.length} leituras validadas! Similaridade média acima de 90%.`
        );
      } else {
        setError(
          `Não foi possível validar ${result.captures.length} leituras com 90% de similaridade. Tente novamente.`
        );
      }

      setMultiCapture({
        captures: result.captures,
        validated: result.validated,
        currentReading: result.captures.length,
        totalReadings: result.captures.length,
        similarities: result.similarities,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao capturar digital';
      setError(errorMessage);
      setMultiCapture(null);
    } finally {
      setCapturing(false);
    }
  };

  const handleRegister = async () => {
    if (!capturedTemplate || !userId) {
      setError('Capture uma digital e informe o ID do usuário');
      return;
    }

    setRegistering(true);
    setError(null);
    setSuccess(null);

    try {
      await registerTemplate({
        user_id: userId,
        template: capturedTemplate.template,
        quality: capturedTemplate.quality,
        finger,
        image_base64: capturedTemplate.image_base64,
        metadata: {
          user_name: userName,
          captured_at: new Date().toISOString(),
        },
      });

      setSuccess('Digital cadastrada com sucesso!');
      setCapturedTemplate(null);
      // Manter usuário selecionado para cadastrar mais digitais
      // setSelectedUser(null);
      // setUserId('');
      // setUserName('');
      setFinger('other');
      await loadUserTemplates();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao cadastrar digital';
      setError(errorMessage);
    } finally {
      setRegistering(false);
    }
  };

  const handleDelete = async (templateId: string) => {
    if (!confirm('Tem certeza que deseja deletar este template?')) {
      return;
    }

    try {
      await deleteTemplate(templateId);
      setSuccess('Template deletado com sucesso!');
      await loadUserTemplates();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao deletar template';
      setError(errorMessage);
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
            <Fingerprint className="w-8 h-8 text-blue-600" />
            <h1 className="text-3xl font-bold text-gray-900">
              Cadastro de Digital Biométrica
            </h1>
          </div>

          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
              <XCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
              <p className="text-red-800">{error}</p>
            </div>
          )}

          {success && (
            <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
              <p className="text-green-800">{success}</p>
            </div>
          )}

          {/* Formulário de Cadastro */}
          <div className="mb-6 p-6 bg-blue-50 border border-blue-200 rounded-lg">
            <h2 className="text-xl font-semibold text-blue-900 mb-4">Informações do Usuário</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-blue-700 mb-2">
                  Buscar Funcionário *
                </label>
                <UserSearchBox
                  onSelectUser={handleUserSelect}
                  selectedUser={selectedUser}
                  placeholder="Digite nome ou matrícula do funcionário..."
                />
                {selectedUser && (
                  <div className="mt-2 p-3 bg-white border border-blue-200 rounded-lg">
                    <div className="flex items-center gap-2">
                      <User className="w-5 h-5 text-blue-600" />
                      <div>
                        <p className="font-medium text-gray-900">{selectedUser.nome}</p>
                        <div className="text-sm text-gray-600">
                          {selectedUser.matricula && <span>Matrícula: {selectedUser.matricula}</span>}
                          {selectedUser.email && <span className="ml-2">• {selectedUser.email}</span>}
                        </div>
                        {selectedUser.cargo && (
                          <p className="text-xs text-gray-500">{selectedUser.cargo}</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-blue-700 mb-2">
                    ID do Usuário (preenchido automaticamente)
                  </label>
                  <input
                    type="text"
                    value={userId}
                    readOnly
                    placeholder="Selecione um funcionário acima"
                    className="w-full px-4 py-2 border border-blue-300 rounded-lg bg-gray-100 text-gray-600 cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-blue-700 mb-2">
                    Dedo
                  </label>
                  <select
                    value={finger}
                    onChange={(e) => setFinger(e.target.value as 'other' | 'left_thumb' | 'right_thumb' | 'left_index' | 'right_index')}
                    className="w-full px-4 py-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="other">Não especificado</option>
                    <option value="left_thumb">Polegar Esquerdo</option>
                    <option value="right_thumb">Polegar Direito</option>
                    <option value="left_index">Indicador Esquerdo</option>
                    <option value="right_index">Indicador Direito</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Captura de Digital */}
          <div className="mb-6">
            <button
              onClick={handleCapture}
              disabled={capturing}
              className="w-full px-6 py-4 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-lg font-semibold"
            >
              {capturing ? (
                <>
                  <Loader2 className="w-6 h-6 animate-spin" />
                  {multiCapture ? (
                    <>
                      Leitura {multiCapture.currentReading + 1} de {multiCapture.totalReadings}...
                      {multiCapture.validated ? ' ✓ Validação concluída!' : ' Aguardando digital...'}
                    </>
                  ) : (
                    'Aguardando digital... Coloque o dedo no leitor (máx. 30s)'
                  )}
                </>
              ) : (
                <>
                  <Fingerprint className="w-6 h-6" />
                  Capturar Digital (Múltiplas Leituras)
                </>
              )}
            </button>
            {multiCapture && (
              <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h4 className="font-semibold text-blue-900 mb-2">
                  Progresso da Captura
                </h4>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-blue-700">Leituras capturadas:</span>
                    <span className="font-medium text-blue-900">
                      {multiCapture.captures.length}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-blue-700">Status:</span>
                    <span
                      className={`font-medium ${
                        multiCapture.validated ? 'text-green-600' : 'text-yellow-600'
                      }`}
                    >
                      {multiCapture.validated
                        ? '✓ Validado (3+ leituras com 90%+ similaridade)'
                        : '⏳ Aguardando validação...'}
                    </span>
                  </div>
                  {multiCapture.captures.length >= 2 && (
                    <div className="mt-3">
                      <p className="text-xs text-blue-600 mb-2">Similaridades entre leituras:</p>
                      <div className="space-y-1">
                        {multiCapture.captures.map((_, i) => {
                          // Função auxiliar para obter similaridade da matriz triangular
                          const getSim = (row: number, col: number) => {
                            if (row === col) return 100;
                            const r = Math.max(row, col);
                            const c = Math.min(row, col);
                            return multiCapture.similarities[r]?.[c] || 0;
                          };

                          // Calcular similaridades com leituras anteriores
                          const prevSimilarities: number[] = [];
                          for (let j = 0; j < i; j++) {
                            prevSimilarities.push(getSim(i, j));
                          }

                          return (
                            <div key={i} className="text-xs text-blue-700">
                              Leitura {i + 1}: Qualidade {multiCapture.captures[i].quality}/100
                              {prevSimilarities.length > 0 && (
                                <span className="ml-2">
                                  (vs anteriores: {prevSimilarities
                                    .map((sim) => `${sim.toFixed(1)}%`)
                                    .join(', ')})
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Resultado da Captura */}
          {capturedTemplate && (
            <div className="mb-6 p-6 bg-gray-50 border border-gray-200 rounded-lg">
              <h3 className="font-semibold text-gray-900 mb-4">Digital Capturada</h3>
              <div className="space-y-3">
                <div>
                  <span className="text-sm text-gray-600">Qualidade:</span>{' '}
                  <span className="font-medium text-gray-900">
                    {capturedTemplate.quality}/100
                  </span>
                </div>
                {capturedTemplate.image_base64 && (
                  <div>
                    <span className="text-sm text-gray-600">Imagem:</span>
                    <div className="mt-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`data:image/png;base64,${capturedTemplate.image_base64}`}
                        alt="Digital capturada"
                        className="max-w-xs h-auto border border-gray-300 rounded shadow-md"
                      />
                    </div>
                  </div>
                )}
                <button
                  onClick={handleRegister}
                  disabled={registering || !userId}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {registering ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Cadastrando...
                    </>
                  ) : (
                    <>
                      <User className="w-4 h-4" />
                      Cadastrar Digital
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Lista de Templates do Usuário */}
          {userId && templates.length > 0 && (
            <div className="mt-6 p-6 bg-gray-50 border border-gray-200 rounded-lg">
              <h3 className="font-semibold text-gray-900 mb-4">
                Templates Cadastrados ({templates.length})
              </h3>
              <div className="space-y-2">
                {templates.map((template) => (
                  <div
                    key={template.id}
                    className="p-3 bg-white border border-gray-300 rounded flex items-center justify-between"
                  >
                    <div>
                      <p className="font-medium text-gray-900">
                        Dedo: {template.finger === 'other' ? 'Não especificado' : template.finger}
                      </p>
                      <p className="text-sm text-gray-600">
                        Qualidade: {template.quality}/100
                      </p>
                      <p className="text-xs text-gray-500">
                        Cadastrado em: {new Date(template.created_at).toLocaleString('pt-BR')}
                      </p>
                    </div>
                    <button
                      onClick={() => handleDelete(template.id)}
                      className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700"
                    >
                      Deletar
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

