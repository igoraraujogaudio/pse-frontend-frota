/**
 * Serviço para gerenciar confirmação biométrica na entrega de itens
 */

import { supabase } from '@/lib/supabase';

export interface BiometricDeliveryConfig {
  biometria_obrigatoria_entrega: boolean;
  permitir_cadastro_na_hora: boolean;
  threshold_similaridade: number;
}

export interface BiometricDeliveryLog {
  id: string;
  solicitacao_id: string;
  destinatario_id: string;
  entregador_id: string;
  base_id: string;
  template: string;
  qualidade: number;
  imagem_base64?: string;
  item_id: string;
  quantidade_entregue: number;
  condicao_entrega?: string;
  observacoes_entrega?: string;
  criado_em: string;
}

/**
 * Verifica se biometria está habilitada para uma base
 */
export async function isBiometricEnabledForBase(baseId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('bases')
      .select('habilitar_biometria_entrega')
      .eq('id', baseId)
      .single();

    if (error) {
      console.warn('Erro ao verificar biometria da base:', error);
      return false;
    }

    return data?.habilitar_biometria_entrega || false;
  } catch (error) {
    console.error('Erro ao verificar biometria da base:', error);
    return false;
  }
}

/**
 * Obtém configuração de biometria de uma base (mantido para compatibilidade)
 */
export async function getBiometricConfig(baseId: string): Promise<BiometricDeliveryConfig> {
  const enabled = await isBiometricEnabledForBase(baseId);
  
  return {
    biometria_obrigatoria_entrega: enabled,
    permitir_cadastro_na_hora: true,
    threshold_similaridade: 80.0,
  };
}

/**
 * Verifica se um usuário tem digital cadastrada
 * Usa a API route para evitar problemas de RLS
 */
export async function hasBiometricTemplate(userId: string): Promise<boolean> {
  try {
    console.log('🔍 [BIOMETRIC] Verificando template para userId:', userId);
    
    if (!userId) {
      console.warn('⚠️ [BIOMETRIC] userId está vazio ou undefined');
      return false;
    }

    // Usar API route que usa service role key (bypass RLS)
    const apiUrl = `/api/biometric/templates/user/${encodeURIComponent(userId)}`;
    console.log('🌐 [BIOMETRIC] Chamando API:', apiUrl);
    
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Erro desconhecido');
      console.error('❌ [BIOMETRIC] Erro na resposta da API:', {
        status: response.status,
        statusText: response.statusText,
        url: apiUrl,
        error: errorText
      });
      return false;
    }

    const result = await response.json();
    console.log('📦 [BIOMETRIC] Resposta da API:', result);
    
    // A API retorna { success: true, data: [...] }
    const templates = result.data || result;
    const hasTemplate = Array.isArray(templates) && templates.length > 0;
    
    console.log(`✅ [BIOMETRIC] Template encontrado: ${hasTemplate}`, {
      templatesCount: Array.isArray(templates) ? templates.length : 0,
      templates: templates
    });
    
    return hasTemplate;
  } catch (error) {
    console.error('❌ [BIOMETRIC] Erro ao verificar template biométrico:', error);
    return false;
  }
}

/**
 * Registra log de entrega biométrica
 */
export async function logBiometricDelivery(
  solicitacaoId: string,
  destinatarioId: string,
  entregadorId: string,
  baseId: string,
  template: string,
  qualidade: number,
  itemId: string,
  quantidadeEntregue: number,
  imagemBase64?: string,
  condicaoEntrega?: string,
  observacoesEntrega?: string
): Promise<BiometricDeliveryLog> {
  try {
    const { data, error } = await supabase
      .from('log_entregas_biometricas')
      .insert({
        solicitacao_id: solicitacaoId,
        destinatario_id: destinatarioId,
        entregador_id: entregadorId,
        base_id: baseId,
        template,
        qualidade,
        imagem_base64: imagemBase64 || null,
        item_id: itemId,
        quantidade_entregue: quantidadeEntregue,
        condicao_entrega: condicaoEntrega || null,
        observacoes_entrega: observacoesEntrega || null,
      })
      .select()
      .single();

    if (error) {
      console.error('Erro ao registrar log de entrega biométrica:', error);
      throw error;
    }

    return data as BiometricDeliveryLog;
  } catch (error) {
    console.error('Erro ao registrar log de entrega biométrica:', error);
    throw error;
  }
}

/**
 * Atualiza solicitação com confirmação biométrica
 */
export async function updateSolicitacaoWithBiometric(
  solicitacaoId: string,
  template: string,
  qualidade: number,
  imagemBase64?: string,
  confirmadoPor?: string
): Promise<void> {
  try {
    const { error } = await supabase
      .from('solicitacoes_itens')
      .update({
        confirmacao_biometrica_template: template,
        confirmacao_biometrica_qualidade: qualidade,
        confirmacao_biometrica_imagem_base64: imagemBase64 || null,
        confirmacao_biometrica_em: new Date().toISOString(),
        confirmacao_biometrica_por: confirmadoPor || null,
      })
      .eq('id', solicitacaoId);

    if (error) {
      console.error('Erro ao atualizar solicitação com confirmação biométrica:', error);
      throw error;
    }
  } catch (error) {
    console.error('Erro ao atualizar solicitação com confirmação biométrica:', error);
    throw error;
  }
}

