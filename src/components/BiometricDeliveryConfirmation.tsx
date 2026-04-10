'use client';

import { useState, useEffect } from 'react';
import { Fingerprint, Loader2, CheckCircle, XCircle, UserPlus, AlertTriangle } from 'lucide-react';
import { 
  captureFingerprintFromDevice, 
  compareTemplate,
  registerTemplate,
  captureMultipleFingerprintsWithValidation,
  type CompareResult 
} from '@/services/biometricTemplateService';
import { hasBiometricTemplate } from '@/services/biometricDeliveryService';
import { isDesktopAppAvailable } from '@/services/desktopEntregaService';
import { 
  createDesktopCommand, 
  listenToSolicitacaoCommands
} from '@/services/desktopCommandService';
import { useAuth } from '@/contexts/AuthContext';

interface BiometricDeliveryConfirmationProps {
  destinatarioId: string;
  destinatarioNome?: string;
  baseId: string;
  solicitacaoId?: string; // ID da solicitação para iniciar captura no desktop
  onConfirm: (data: {
    template: string;
    quality: number;
    image_base64?: string;
    isNewRegistration: boolean;
  }) => void;
  onCancel: () => void;
  threshold?: number;
  allowRegistration?: boolean;
  // Se fornecido, processa múltiplas leituras já capturadas do desktop
  preCapturedMultiCapture?: Array<{ template: string; quality: number; image_base64?: string }>;
  preCapturedTemplate?: { template: string; quality: number; image_base64?: string };
  // Se true, renderiza inline sem overlay de modal (para uso dentro de Dialog)
  inline?: boolean;
}

export function BiometricDeliveryConfirmation({
  destinatarioId,
  destinatarioNome,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  baseId: _baseId,
  solicitacaoId,
  onConfirm,
  onCancel,
  threshold = 80.0,
  allowRegistration = true,
  preCapturedMultiCapture,
  preCapturedTemplate,
  inline = false,
}: BiometricDeliveryConfirmationProps) {
  const { user } = useAuth();
  const [step, setStep] = useState<'checking' | 'capturing' | 'comparing' | 'registering' | 'validating' | 'success' | 'error'>('checking');
  const [hasTemplate, setHasTemplate] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [comparison, setComparison] = useState<CompareResult | null>(null);
  const [isNewRegistration, setIsNewRegistration] = useState(false);
  const [desktopAvailable, setDesktopAvailable] = useState<boolean | null>(null);
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (preCapturedTemplate || preCapturedMultiCapture) {
      // Processar captura já feita no desktop
      processPreCaptured();
    } else {
      checkTemplate();
    }
    
    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [destinatarioId, preCapturedTemplate, preCapturedMultiCapture]);

  const processPreCaptured = async () => {
    try {
      setStep('checking');
      const has = await hasBiometricTemplate(destinatarioId);
      setHasTemplate(has);
      
      if (preCapturedMultiCapture && !has) {
        // Processar cadastro com múltiplas leituras
        await processMultiCaptureRegistration(preCapturedMultiCapture);
      } else if (preCapturedTemplate && has) {
        // Processar validação
        setStep('comparing');
        const result = await compareTemplate(preCapturedTemplate.template, threshold);
        setComparison(result);
        
        if (result.match) {
          setStep('success');
          setTimeout(() => {
            onConfirm({
              template: preCapturedTemplate.template,
              quality: preCapturedTemplate.quality,
              image_base64: preCapturedTemplate.image_base64,
              isNewRegistration: false,
            });
          }, 1500);
        } else {
          setError(`Digital não corresponde. Similaridade: ${result.similarity.toFixed(2)}% (mínimo: ${threshold}%)`);
          setStep('error');
        }
      } else {
        setError('Dados de captura inválidos');
        setStep('error');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao processar digital';
      setError(errorMessage);
      setStep('error');
    }
  };

  const processMultiCaptureRegistration = async (captures: Array<{ template: string; quality: number; image_base64?: string }>) => {
    try {
      setStep('validating');
      setError(null);
      
      // Validar similaridade entre as capturas usando o SDK
      // (já foi validado no desktop, mas vamos validar novamente aqui para garantir)
      const { getApiUrl } = await import('@/services/desktopBiometricIntegration');
      const apiUrl = await getApiUrl();
      
      // Comparar todas as capturas entre si
      const similarities: number[][] = [];
      for (let i = 0; i < captures.length; i++) {
        similarities[i] = [];
        for (let j = 0; j < captures.length; j++) {
          if (i === j) {
            similarities[i][j] = 100;
          } else if (i < j) {
            try {
              const response = await fetch(`${apiUrl}/templates/compare`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  template1: captures[i].template,
                  template2: captures[j].template,
                }),
              });
              if (response.ok) {
                const data = await response.json();
                similarities[i][j] = data.data?.similarity || 0;
              } else {
                similarities[i][j] = 0;
              }
            } catch {
              similarities[i][j] = 0;
            }
          } else {
            similarities[i][j] = similarities[j][i];
          }
        }
      }
      
      // Verificar se há pelo menos 3 com 90%+ de similaridade
      let validGroup = false;
      for (let start = 0; start <= captures.length - 3; start++) {
        const group = [start];
        for (let i = start + 1; i < captures.length; i++) {
          let canAdd = true;
          for (const groupIdx of group) {
            const sim = similarities[Math.max(i, groupIdx)][Math.min(i, groupIdx)];
            if (sim < 90.0) {
              canAdd = false;
              break;
            }
          }
          if (canAdd) {
            group.push(i);
            if (group.length >= 3) {
              validGroup = true;
              break;
            }
          }
        }
        if (validGroup) break;
      }
      
      if (!validGroup) {
        setError('As leituras não têm similaridade suficiente entre si (mínimo 90%). Tente novamente.');
        setStep('error');
        return;
      }
      
      // Selecionar a melhor captura (maior qualidade)
      const bestCapture = captures.reduce((best, current) => 
        current.quality > best.quality ? current : best
      );
      
      // Registrar template
      setStep('registering');
      await registerTemplate({
        user_id: destinatarioId,
        template: bestCapture.template,
        quality: bestCapture.quality,
        image_base64: bestCapture.image_base64,
        metadata: {
          user_name: destinatarioNome,
          registered_at: new Date().toISOString(),
          registered_by: user?.id,
          registered_in_delivery: true,
          multi_capture_validated: true,
        },
      });
      
      setIsNewRegistration(true);
      setStep('success');
      
      setTimeout(() => {
        onConfirm({
          template: bestCapture.template,
          quality: bestCapture.quality,
          image_base64: bestCapture.image_base64,
          isNewRegistration: true,
        });
      }, 1500);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao cadastrar digital';
      setError(errorMessage);
      setStep('error');
    }
  };

  const checkTemplate = async () => {
    try {
      setStep('checking');
      console.log('🔍 [BIOMETRIC] checkTemplate chamado com destinatarioId:', destinatarioId);
      
      // Verificar se desktop está disponível
      const desktopAvail = await isDesktopAppAvailable();
      setDesktopAvailable(desktopAvail);
      console.log('🖥️ [BIOMETRIC] Desktop disponível:', desktopAvail);
      
      if (!destinatarioId) {
        console.error('❌ [BIOMETRIC] destinatarioId está vazio!');
        setError('ID do destinatário não informado.');
        setStep('error');
        return;
      }
      
      const has = await hasBiometricTemplate(destinatarioId);
      console.log('✅ [BIOMETRIC] Resultado da verificação:', has);
      setHasTemplate(has);
      
      if (!has && !allowRegistration) {
        setError('Usuário não possui digital cadastrada e cadastro na hora não é permitido.');
        setStep('error');
        return;
      }
      
      // Não iniciar automaticamente - sempre mostrar botões para o almoxarife clicar
      // O desktop será usado se estiver disponível, mas o almoxarife precisa iniciar
      setStep('checking');
    } catch (err) {
      console.error('❌ [BIOMETRIC] Erro em checkTemplate:', err);
      const errorMessage = err instanceof Error ? err.message : 'Erro ao verificar template biométrico';
      setError(errorMessage);
      setStep('error');
    }
  };


  const captureForValidation = async () => {
    try {
      setStep('capturing');
      setError(null);
      
      const captured = await captureFingerprintFromDevice(30000);
      
      // Comparar com templates cadastrados
      setStep('comparing');
      const result = await compareTemplate(captured.template, threshold);
      setComparison(result);
      
      if (result.match) {
        // Digital validada com sucesso
        setStep('success');
        setTimeout(() => {
          onConfirm({
            template: captured.template,
            quality: captured.quality,
            image_base64: captured.image_base64,
            isNewRegistration: false,
          });
        }, 1500);
      } else {
        // Digital não corresponde
        setError(`Digital não corresponde. Similaridade: ${result.similarity.toFixed(2)}% (mínimo: ${threshold}%)`);
        setStep('error');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao capturar digital';
      setError(errorMessage);
      setStep('error');
    }
  };

  const captureForRegistration = async () => {
    try {
      setStep('registering');
      setError(null);
      
      // Capturar múltiplas digitais com validação
      const multiCapture = await captureMultipleFingerprintsWithValidation(
        3, // minReadings
        90.0, // minSimilarity
        10, // maxAttempts
        30000 // timeout
      );
      
      if (!multiCapture.validated) {
        setError('Não foi possível capturar digitais com qualidade suficiente. Tente novamente.');
        setStep('error');
        return;
      }
      
      const bestTemplate = multiCapture.bestTemplate;
      
      // Registrar template no banco
      await registerTemplate({
        user_id: destinatarioId,
        template: bestTemplate.template,
        quality: bestTemplate.quality,
        image_base64: bestTemplate.image_base64,
        metadata: {
          user_name: destinatarioNome,
          registered_at: new Date().toISOString(),
          registered_by: user?.id,
          registered_in_delivery: true,
        },
      });
      
      setIsNewRegistration(true);
      setStep('success');
      
      setTimeout(() => {
        onConfirm({
          template: bestTemplate.template,
          quality: bestTemplate.quality,
          image_base64: bestTemplate.image_base64,
          isNewRegistration: true,
        });
      }, 1500);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao cadastrar digital';
      setError(errorMessage);
      setStep('error');
    }
  };

  const handleRetry = async () => {
    console.log('🔄 [BIOMETRIC] Tentando novamente...');
    
    // Limpar polling anterior se existir
    if (pollingInterval) {
      clearInterval(pollingInterval);
      setPollingInterval(null);
    }
    
    setError(null);
    setStep('checking');
    
    if (desktopAvailable && solicitacaoId) {
      // Tentar novamente no desktop usando Supabase Realtime
      await handleStartCaptureDesktop();
    } else {
      // Tentar novamente localmente
      if (hasTemplate) {
        captureForValidation();
      } else {
        captureForRegistration();
      }
    }
  };

  const handleStartCaptureDesktop = async () => {
    if (!solicitacaoId) return;

    try {
      setStep('capturing');
      setError(null);

      console.log('🚀 [BIOMETRIC] Iniciando captura via Supabase Realtime...');
      
      // Criar comando via Supabase Realtime
      const command = await createDesktopCommand({
        solicitacaoId,
        commandType: 'start_capture',
        destinatarioId,
        isNewRegistration: !hasTemplate,
      });

      console.log('✅ [BIOMETRIC] Comando criado:', command.id);

      // Escutar atualizações do comando
      const unsubscribe = listenToSolicitacaoCommands(solicitacaoId, {
        onAcknowledged: () => {
          console.log('✅ [BIOMETRIC] Desktop confirmou recebimento');
          setStep('capturing');
        },
        onProcessing: () => {
          console.log('🔄 [BIOMETRIC] Desktop está processando...');
          setStep('capturing');
        },
        onCompleted: async (cmd) => {
          console.log('✅ [BIOMETRIC] Captura completada!');
          
          if (cmd.biometric_data) {
            // Processar dados biométricos
            if (cmd.biometric_data.isNewRegistration && cmd.biometric_data.multiCapture) {
              await processMultiCaptureRegistration(cmd.biometric_data.multiCapture);
            } else {
              // Validação bem-sucedida
              setStep('success');
              setComparison({
                match: true,
                similarity: cmd.biometric_data.similarity || 100,
                threshold: threshold,
              });
              
              setTimeout(() => {
                onConfirm({
                  template: cmd.biometric_data!.template,
                  quality: cmd.biometric_data!.quality,
                  image_base64: cmd.biometric_data!.image_base64,
                  isNewRegistration: cmd.biometric_data!.isNewRegistration || false,
                });
              }, 1500);
            }
          }
          
          unsubscribe();
        },
        onError: (cmd) => {
          console.error('❌ [BIOMETRIC] Erro recebido:', cmd.error_message);
          setError(cmd.error_message || 'Erro desconhecido');
          setStep('error');
          unsubscribe();
        },
        onTimeout: () => {
          console.warn('⏱️ [BIOMETRIC] Timeout');
          setError('Timeout: Desktop não respondeu');
          setStep('error');
          unsubscribe();
        },
      });

      // Timeout de segurança
      setTimeout(() => {
        unsubscribe();
        if (step === 'capturing') {
          setError('Timeout: Desktop não respondeu em 30 segundos');
          setStep('error');
        }
      }, 30000);

    } catch (error) {
      console.error('❌ [BIOMETRIC] Erro ao iniciar captura:', error);
      setError(error instanceof Error ? error.message : 'Erro ao iniciar captura');
      setStep('error');
    }
  };

  const content = (
    <div className={inline ? 'w-full' : 'bg-white rounded-lg shadow-xl max-w-md w-full p-6'}>
      {!inline && (
        <div className="flex items-center gap-3 mb-6">
          <Fingerprint className="w-8 h-8 text-green-600" />
          <h2 className="text-2xl font-bold text-gray-900">
            {hasTemplate === false ? 'Cadastro de Digital' : 'Confirmação Biométrica'}
          </h2>
        </div>
      )}

        {destinatarioNome && (
          <div className="mb-4 p-3 bg-blue-50 rounded-lg">
            <div className="flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-blue-600" />
              <span className="text-sm font-medium text-blue-900">
                {destinatarioNome}
              </span>
            </div>
          </div>
        )}

        {step === 'checking' && hasTemplate === null && (
          <div className="text-center py-8">
            <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-blue-600" />
            <p className="text-gray-600">Verificando digital cadastrada...</p>
          </div>
        )}

        {step === 'capturing' && hasTemplate && (
          <div className="text-center py-8">
            <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-blue-600" />
            <p className="text-gray-600 font-medium mb-2">
              Coloque o dedo no leitor
            </p>
            <p className="text-sm text-gray-500">
              Validando digital cadastrada...
            </p>
          </div>
        )}

        {step === 'comparing' && (
          <div className="text-center py-8">
            <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-green-600" />
            <p className="text-gray-600 font-medium mb-2">
              Comparando digital...
            </p>
            {comparison && (
              <p className="text-sm text-gray-500">
                Similaridade: {comparison.similarity.toFixed(2)}%
              </p>
            )}
          </div>
        )}

        {step === 'validating' && (
          <div className="text-center py-8">
            <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-purple-600" />
            <p className="text-gray-600 font-medium mb-2">
              Validando múltiplas leituras...
            </p>
            <p className="text-sm text-gray-500">
              Verificando similaridade entre as 3 leituras capturadas
            </p>
          </div>
        )}

        {step === 'registering' && (
          <div className="text-center py-8">
            <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-purple-600" />
            <p className="text-gray-600 font-medium mb-2">
              Cadastrando digital...
            </p>
            <p className="text-sm text-gray-500">
              Salvando template validado no banco de dados
            </p>
          </div>
        )}

        {step === 'success' && (
          <div className="text-center py-8">
            <CheckCircle className="w-16 h-16 mx-auto mb-4 text-green-600" />
            <p className="text-lg font-semibold text-green-900 mb-2">
              {isNewRegistration ? 'Digital cadastrada com sucesso!' : 'Digital validada com sucesso!'}
            </p>
            {comparison && !isNewRegistration && (
              <p className="text-sm text-gray-600">
                Similaridade: {comparison.similarity.toFixed(2)}%
              </p>
            )}
          </div>
        )}

        {step === 'error' && (
          <div className="py-6">
            <div className="flex items-start gap-3 mb-4">
              <XCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-1" />
              <div className="flex-1">
                <p className="text-red-800 font-medium mb-2">Erro</p>
                <p className="text-sm text-red-600">{error}</p>
              </div>
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={handleRetry}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
              >
                Tentar Novamente
              </button>
              <button
                onClick={onCancel}
                className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 font-medium"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {step === 'checking' && hasTemplate === false && allowRegistration && (
          <div className="py-6">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-yellow-900 mb-1">
                    Digital não cadastrada
                  </p>
                  <p className="text-xs text-yellow-800">
                    Será necessário cadastrar a digital agora para confirmar a entrega.
                    {desktopAvailable === false && ' Use o leitor conectado ao computador.'}
                    {desktopAvailable === true && solicitacaoId && ' A captura será feita no desktop.'}
                  </p>
                </div>
              </div>
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={async () => {
                  if (desktopAvailable && solicitacaoId) {
                    // Iniciar captura no desktop via Supabase Realtime
                    await handleStartCaptureDesktop();
                  } else {
                    // Captura local
                    await captureForRegistration();
                  }
                }}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium flex items-center justify-center gap-2"
              >
                <Fingerprint className="w-5 h-5" />
                {desktopAvailable && solicitacaoId ? 'Iniciar Cadastro no Desktop' : 'Cadastrar Digital'}
              </button>
              <button
                onClick={onCancel}
                className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 font-medium"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {step === 'checking' && hasTemplate === true && (
          <div className="py-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <div className="flex items-start gap-3">
                <Fingerprint className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-blue-900 mb-1">
                    Digital cadastrada
                  </p>
                  <p className="text-xs text-blue-800">
                    Clique no botão abaixo para validar a digital do funcionário.
                    {desktopAvailable === false && ' Use o leitor conectado ao computador.'}
                    {desktopAvailable === true && solicitacaoId && ' A validação será feita no desktop.'}
                  </p>
                </div>
              </div>
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={async () => {
                  if (desktopAvailable && solicitacaoId) {
                    // Iniciar validação no desktop via Supabase Realtime
                    await handleStartCaptureDesktop();
                  } else {
                    // Validação local
                    await captureForValidation();
                  }
                }}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium flex items-center justify-center gap-2"
              >
                <Fingerprint className="w-5 h-5" />
                {desktopAvailable && solicitacaoId ? 'Iniciar Validação no Desktop' : 'Validar Digital'}
              </button>
              <button
                onClick={onCancel}
                className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 font-medium"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {step === 'checking' && hasTemplate === false && !allowRegistration && (
          <div className="py-6">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
              <div className="flex items-start gap-3">
                <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-red-900 mb-1">
                    Digital não cadastrada
                  </p>
                  <p className="text-xs text-red-800">
                    Cadastro na hora não é permitido para esta base. O usuário deve cadastrar a digital antes da entrega.
                  </p>
                </div>
              </div>
            </div>
            
            <button
              onClick={onCancel}
              className="w-full px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 font-medium"
            >
              Fechar
            </button>
          </div>
        )}
    </div>
  );

  if (inline) {
    return content;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      {content}
    </div>
  );
}

