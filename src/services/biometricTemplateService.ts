/**
 * Serviço para gerenciar templates biométricos
 * Integra com o desktop app para captura e com o banco de dados para armazenamento
 */

import { captureFingerprint, getApiUrl } from './desktopBiometricIntegration';

export interface BiometricTemplate {
  id: string;
  user_id: string;
  template: string; // Base64 encoded template do SDK
  quality: number;
  finger?: 'left_thumb' | 'right_thumb' | 'left_index' | 'right_index' | 'other';
  image_base64?: string;
  created_at: string;
  created_by?: string;
  metadata?: Record<string, unknown>;
}

export interface CompareResult {
  match: boolean;
  similarity: number; // 0-100
  threshold: number;
  template_id?: string;
  user_id?: string;
  user_name?: string;
}

export interface RegisterTemplateRequest {
  user_id: string;
  template: string;
  quality: number;
  finger?: 'left_thumb' | 'right_thumb' | 'left_index' | 'right_index' | 'other';
  image_base64?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Captura uma digital usando o desktop app
 */
export async function captureFingerprintFromDevice(
  timeout: number = 30000
): Promise<{ template: string; quality: number; image_base64?: string }> {
  const fingerprint = await captureFingerprint(timeout);
  return {
    template: fingerprint.template,
    quality: fingerprint.quality,
    image_base64: fingerprint.image_base64,
  };
}

/**
 * Captura múltiplas digitais e valida a qualidade entre elas
 * Retorna 3 leituras com pelo menos 90% de similaridade entre si
 */
export interface MultiCaptureResult {
  captures: Array<{
    template: string;
    quality: number;
    image_base64?: string;
  }>;
  validated: boolean;
  bestTemplate: {
    template: string;
    quality: number;
    image_base64?: string;
  };
  similarities: number[][]; // Matriz de similaridades entre as capturas
}

export async function captureMultipleFingerprintsWithValidation(
  minReadings: number = 3,
  minSimilarity: number = 90.0,
  maxAttempts: number = 10,
  timeout: number = 30000
): Promise<MultiCaptureResult> {
  const captures: Array<{ template: string; quality: number; image_base64?: string }> = [];
  const similarities: number[][] = [];
  let attempts = 0;

  // Função para comparar dois templates usando o SDK
  async function compareTemplates(template1: string, template2: string): Promise<number> {
    try {
      const apiUrl = await getApiUrl();
      const response = await fetch(`${apiUrl}/templates/compare`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          template1,
          template2,
        }),
        signal: AbortSignal.timeout(5000),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          return data.data.similarity || 0;
        }
      }
    } catch (error) {
      console.warn('Erro ao comparar templates:', error);
    }
    return 0;
  }

  // Matriz de similaridades: similarities[i][j] = similaridade entre captura i e j
  // Armazenar apenas triangular superior (i <= j)
  function getSimilarity(i: number, j: number): number {
    if (i === j) return 100;
    const row = Math.max(i, j);
    const col = Math.min(i, j);
    return similarities[row]?.[col] || 0;
  }

  function setSimilarity(i: number, j: number, value: number): void {
    if (i === j) return;
    const row = Math.max(i, j);
    const col = Math.min(i, j);
    if (!similarities[row]) similarities[row] = [];
    similarities[row][col] = value;
  }

  // Função para verificar se há pelo menos minReadings com minSimilarity entre si
  function hasValidGroup(): boolean {
    if (captures.length < minReadings) return false;

    // Verificar se há um grupo de pelo menos minReadings com similaridade >= minSimilarity entre todos os pares
    for (let start = 0; start <= captures.length - minReadings; start++) {
      const group: number[] = [start];
      
      // Tentar adicionar mais capturas ao grupo
      for (let i = start + 1; i < captures.length; i++) {
        let canAdd = true;
        // Verificar se esta captura tem minSimilarity com todas do grupo
        for (const groupIdx of group) {
          const sim = getSimilarity(i, groupIdx);
          if (sim < minSimilarity) {
            canAdd = false;
            break;
          }
        }
        if (canAdd) {
          group.push(i);
          if (group.length >= minReadings) {
            return true;
          }
        }
      }
    }

    return false;
  }

  // Função para encontrar a melhor captura (maior qualidade média nas comparações)
  function findBestTemplate(): { template: string; quality: number; image_base64?: string } {
    if (captures.length === 0) {
      throw new Error('Nenhuma captura disponível');
    }

    // Se há apenas uma captura, retornar ela
    if (captures.length === 1) {
      return captures[0];
    }

    // Calcular média de similaridade de cada captura com as outras
    const avgSimilarities: number[] = [];
    for (let i = 0; i < captures.length; i++) {
      let sum = 0;
      let count = 0;
      for (let j = 0; j < captures.length; j++) {
        if (i !== j) {
          const sim = getSimilarity(i, j);
          if (sim > 0) {
            sum += sim;
            count++;
          }
        }
      }
      avgSimilarities[i] = count > 0 ? sum / count : 0;
    }

    // Encontrar a captura com maior média de similaridade e maior qualidade
    let bestIndex = 0;
    let bestScore = avgSimilarities[0] * 0.7 + captures[0].quality * 0.3; // 70% similaridade, 30% qualidade

    for (let i = 1; i < captures.length; i++) {
      const score = avgSimilarities[i] * 0.7 + captures[i].quality * 0.3;
      if (score > bestScore) {
        bestScore = score;
        bestIndex = i;
      }
    }

    return captures[bestIndex];
  }

  // Capturar digitais até ter minReadings válidas
  while (captures.length < minReadings && attempts < maxAttempts) {
    attempts++;
    try {
      const captured = await captureFingerprintFromDevice(timeout);
      captures.push(captured);

      // Se temos pelo menos 2 capturas, comparar com as anteriores
      if (captures.length >= 2) {
        const lastIndex = captures.length - 1;
        
        for (let i = 0; i < lastIndex; i++) {
          const similarity = await compareTemplates(
            captures[lastIndex].template,
            captures[i].template
          );
          setSimilarity(lastIndex, i, similarity);
        }
      }
    } catch (error) {
      console.warn(`Erro na captura ${attempts}:`, error);
      // Continuar tentando
    }
  }

  // Validar se temos leituras suficientes com qualidade
  let validated = hasValidGroup();

  // Se não validou, tentar mais leituras até validar ou atingir maxAttempts
  while (!validated && attempts < maxAttempts) {
    attempts++;
    try {
      const captured = await captureFingerprintFromDevice(timeout);
      captures.push(captured);

      // Comparar com todas as anteriores
      const lastIndex = captures.length - 1;
      
      for (let i = 0; i < lastIndex; i++) {
        const similarity = await compareTemplates(
          captures[lastIndex].template,
          captures[i].template
        );
        setSimilarity(lastIndex, i, similarity);
      }

      // Verificar novamente se há grupo válido
      validated = hasValidGroup();
    } catch (error) {
      console.warn(`Erro na captura adicional ${attempts}:`, error);
    }
  }

  // Encontrar a melhor captura
  const bestTemplate = findBestTemplate();

  return {
    captures,
    validated,
    bestTemplate,
    similarities,
  };
}

/**
 * Registra um template biométrico no banco de dados
 */
export async function registerTemplate(
  request: RegisterTemplateRequest
): Promise<BiometricTemplate> {
  const response = await fetch('/api/biometric/templates/register', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Erro ao registrar template');
  }

  const data = await response.json();
  return data.data;
}

/**
 * Lista templates de um usuário específico
 */
export async function getUserTemplates(userId: string): Promise<BiometricTemplate[]> {
  const response = await fetch(`/api/biometric/templates/user/${userId}`, {
    method: 'GET',
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Erro ao listar templates');
  }

  const data = await response.json();
  return data.data || [];
}

/**
 * Compara um template capturado com templates cadastrados
 * SEMPRE busca templates do banco de dados e usa o SDK do desktop app apenas para comparação
 * @param template - Template capturado para comparar
 * @param threshold - Threshold de similaridade (0-100)
 * @param destinatarioId - ID do destinatário para filtrar templates (opcional, mas recomendado para performance)
 */
export async function compareTemplate(
  template: string,
  threshold: number = 80.0,
  destinatarioId?: string
): Promise<CompareResult> {
  // SEMPRE usar a API do servidor que busca templates do banco de dados
  // A API do servidor busca do banco e usa o desktop app apenas para fazer a comparação biométrica via SDK
  const response = await fetch('/api/biometric/templates/compare', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      template,
      threshold,
      ...(destinatarioId && { destinatarioId }), // Incluir destinatarioId se fornecido
    }),
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Erro ao comparar template');
  }

  const data = await response.json();
  return data.data;
}

/**
 * Valida uma digital (captura e compara em um único fluxo)
 * @param threshold - Threshold de similaridade (0-100)
 * @param captureTimeout - Timeout para captura em ms
 * @param destinatarioId - ID do destinatário para filtrar templates (opcional, mas recomendado para performance)
 */
export async function validateFingerprint(
  threshold: number = 80.0,
  captureTimeout: number = 30000,
  destinatarioId?: string
): Promise<{
  captured: { template: string; quality: number; image_base64?: string };
  comparison: CompareResult;
}> {
  // 1. Capturar digital
  const captured = await captureFingerprintFromDevice(captureTimeout);

  // 2. Comparar com templates cadastrados
  const comparison = await compareTemplate(captured.template, threshold, destinatarioId);

  return {
    captured,
    comparison,
  };
}

/**
 * Deleta um template
 */
export async function deleteTemplate(templateId: string): Promise<void> {
  const response = await fetch(`/api/biometric/templates/${templateId}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Erro ao deletar template');
  }
}

