import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

interface RequiredDocument {
  tipo: string;
  obrigatorio: boolean;
  origem_regra: string;
  label: string;
}

interface ComplianceDocument {
  documento_tipo: string;
  obrigatorio: boolean;
  possui_documento: boolean;
  documento_valido: boolean;
  data_vencimento: string | null;
  dias_para_vencer: number | null;
  status_conformidade: string;
  origem_regra: string;
  prioridade: 'CRÍTICO' | 'ATENÇÃO' | 'OK';
  label: string;
}

interface ComplianceResponse {
  veiculo_id: string;
  veiculo_placa: string;
  conformidade: ComplianceDocument[];
  resumo: {
    total_documentos: number;
    obrigatorios: number;
    opcionais: number;
    conformes: number;
    nao_conformes: number;
    criticos: number;
    atencao: number;
  };
}

interface DocumentRule {
  id?: string;
  tipo_veiculo?: string[]; // CORRIGIDO: agora é array para múltiplos tipos
  prefixo_placa?: string;
  prefixos_placa?: string[]; // múltiplos prefixos
  placa_especifica?: string;
  contrato_id?: string;
  documentos_obrigatorios: string[];
  documentos_opcionais: string[];
  descricao: string;
  ativa: boolean;
}

interface RuleReport {
  id: string;
  criterio: string;
  valor_criterio: string;
  documentos_obrigatorios: string[];
  documentos_opcionais: string[];
  total_veiculos_afetados: number;
  descricao: string;
  contrato_id?: string;
}

// Hook para obter documentos obrigatórios de um veículo
export const useVehicleRequiredDocuments = (vehicleId: string) => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['vehicle-required-docs', vehicleId],
    queryFn: async (): Promise<RequiredDocument[]> => {
      console.log('🔍 Buscando documentos obrigatórios para veículo:', vehicleId);
      
      const response = await fetch(`/api/vehicles/${vehicleId}/required-documents`, {
        headers: {
          'x-user-level': user?.nivel_acesso || ''
        }
      });
      
      console.log('📡 Resposta da API required-documents:', response.status, response.statusText);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Erro na API required-documents:', errorText);
        throw new Error('Erro ao buscar documentos obrigatórios');
      }
      
      const data = await response.json();
      console.log('📄 Dados recebidos da API required-documents:', data);
      return data.documents;
    },
    enabled: !!vehicleId,
    staleTime: 5 * 60 * 1000, // 5 minutos
  });
};

// Hook para verificar conformidade de documentos de um veículo
export const useVehicleCompliance = (vehicleId: string) => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['vehicle-compliance', vehicleId, user?.nivel_acesso],
    queryFn: async (): Promise<ComplianceResponse> => {
      console.log('🔍 Verificando conformidade para veículo:', vehicleId);
      
      const response = await fetch(`/api/vehicles/${vehicleId}/compliance`, {
        headers: {
          'x-user-level': user?.nivel_acesso || ''
        }
      });
      
      console.log('📡 Resposta da API compliance:', response.status, response.statusText);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Erro na API compliance:', errorText);
        throw new Error('Erro ao verificar conformidade');
      }
      
      const data = await response.json();
      console.log('📄 Dados recebidos da API compliance:', data);
      return data;
    },
    enabled: !!vehicleId,
    staleTime: 2 * 60 * 1000, // 2 minutos (dados mais dinâmicos)
  });
};

// Hook para gerenciar regras de documentação (frota)
export const useDocumentRules = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const {
    data: rules,
    isLoading,
    error
  } = useQuery({
    queryKey: ['fleet-document-rules'],
    queryFn: async (): Promise<RuleReport[]> => {
      if (!user) {
        throw new Error('Usuário não autenticado');
      }

      // Obter token de sessão
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Token de acesso não encontrado');
      }

      const response = await fetch('/api/admin/document-rules', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'x-user-level': user.nivel_acesso || '',
          'x-user-id': user.id || ''
        }
      });
      
      if (!response.ok) {
        throw new Error('Erro ao buscar regras de documentação');
      }
      
      const data = await response.json();
      return data.rules;
    },
    staleTime: 10 * 60 * 1000, // 10 minutos
  });

  const createRuleMutation = useMutation({
    mutationFn: async (rule: DocumentRule): Promise<void> => {
      if (!user) {
        throw new Error('Usuário não autenticado');
      }

      // Obter token de sessão
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Token de acesso não encontrado');
      }

      console.log('📤 Enviando regra para API:', {
        contrato_id: rule.contrato_id,
        placa_especifica: rule.placa_especifica,
        prefixo_placa: rule.prefixo_placa,
        prefixos_placa: rule.prefixos_placa,
        tipo_veiculo: rule.tipo_veiculo,
        documentos_obrigatorios: rule.documentos_obrigatorios,
        documentos_opcionais: rule.documentos_opcionais
      });

      const response = await fetch('/api/admin/document-rules', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'x-user-level': user.nivel_acesso || '',
          'x-user-id': user.id || ''
        },
        body: JSON.stringify(rule),
      });

      console.log('📡 Resposta da API:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('❌ Erro da API:', errorData);
        
        // Mostrar erro detalhado se disponível
        const errorMessage = errorData.details 
          ? `${errorData.error}: ${errorData.details}${errorData.hint ? ` (${errorData.hint})` : ''}`
          : errorData.error || 'Erro ao criar regra';
        
        throw new Error(errorMessage);
      }

      const successData = await response.json();
      console.log('✅ Regra criada com sucesso:', successData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fleet-document-rules'] });
      // Invalidar também cache de documentos obrigatórios e conformidade
      queryClient.invalidateQueries({ queryKey: ['vehicle-required-docs'] });
      queryClient.invalidateQueries({ queryKey: ['vehicle-compliance'] });
    },
  });

  const updateRuleMutation = useMutation({
    mutationFn: async (rule: DocumentRule & { id: string }): Promise<void> => {
      if (!user) {
        throw new Error('Usuário não autenticado');
      }

      // Obter token de sessão
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Token de acesso não encontrado');
      }

      const response = await fetch('/api/admin/document-rules', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'x-user-level': user.nivel_acesso || '',
          'x-user-id': user.id || ''
        },
        body: JSON.stringify(rule),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao atualizar regra');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fleet-document-rules'] });
      queryClient.invalidateQueries({ queryKey: ['vehicle-required-docs'] });
      queryClient.invalidateQueries({ queryKey: ['vehicle-compliance'] });
    },
  });

  const deleteRuleMutation = useMutation({
    mutationFn: async (ruleId: string): Promise<void> => {
      if (!user) {
        throw new Error('Usuário não autenticado');
      }

      // Obter token de sessão
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Token de acesso não encontrado');
      }

      const response = await fetch(`/api/admin/document-rules?id=${ruleId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'x-user-level': user.nivel_acesso || '',
          'x-user-id': user.id || ''
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao remover regra');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fleet-document-rules'] });
      queryClient.invalidateQueries({ queryKey: ['vehicle-required-docs'] });
      queryClient.invalidateQueries({ queryKey: ['vehicle-compliance'] });
    },
  });

  return {
    rules,
    isLoading,
    error,
    createRule: createRuleMutation.mutate,
    updateRule: updateRuleMutation.mutate,
    deleteRule: deleteRuleMutation.mutate,
    isCreating: createRuleMutation.isPending,
    isUpdating: updateRuleMutation.isPending,
    isDeleting: deleteRuleMutation.isPending,
  };
};

// Hook combinado para dados completos de documentação de um veículo
export const useVehicleDocumentationData = (vehicleId: string) => {
  const requiredDocsQuery = useVehicleRequiredDocuments(vehicleId);
  const complianceQuery = useVehicleCompliance(vehicleId);

  return {
    requiredDocuments: requiredDocsQuery.data,
    compliance: complianceQuery.data,
    isLoading: requiredDocsQuery.isLoading || complianceQuery.isLoading,
    error: requiredDocsQuery.error || complianceQuery.error,
    refetch: () => {
      requiredDocsQuery.refetch();
      complianceQuery.refetch();
    }
  };
};

// Utility functions para trabalhar com os dados
export const documentRulesUtils = {
  // Obter documentos obrigatórios de uma lista de conformidade
  getRequiredDocuments: (compliance: ComplianceDocument[]) => 
    compliance.filter(doc => doc.obrigatorio),

  // Obter documentos opcionais de uma lista de conformidade
  getOptionalDocuments: (compliance: ComplianceDocument[]) => 
    compliance.filter(doc => !doc.obrigatorio),

  // Obter documentos críticos (obrigatórios ausentes ou vencidos)
  getCriticalDocuments: (compliance: ComplianceDocument[]) => 
    compliance.filter(doc => doc.prioridade === 'CRÍTICO'),

  // Obter documentos que precisam de atenção (vencendo em 30 dias)
  getAttentionDocuments: (compliance: ComplianceDocument[]) => 
    compliance.filter(doc => doc.prioridade === 'ATENÇÃO'),

  // Verificar se veículo está em conformidade
  isVehicleCompliant: (compliance: ComplianceDocument[]) => 
    !compliance.some(doc => doc.prioridade === 'CRÍTICO'),

  // Obter próximos vencimentos
  getUpcomingExpirations: (compliance: ComplianceDocument[], days: number = 30) =>
    compliance
      .filter(doc => 
        doc.dias_para_vencer !== null && 
        doc.dias_para_vencer <= days && 
        doc.dias_para_vencer > 0
      )
      .sort((a, b) => (a.dias_para_vencer || 0) - (b.dias_para_vencer || 0)),

  // Formatar status de conformidade para exibição
  formatComplianceStatus: (status: string) => {
    const statusMap: { [key: string]: { text: string; color: string } } = {
      'CONFORME': { text: 'Conforme', color: 'green' },
      'CONFORME - SEM VENCIMENTO': { text: 'Conforme', color: 'green' },
      'NÃO CONFORME - VENCIDO': { text: 'Vencido', color: 'red' },
      'NÃO CONFORME - DOCUMENTO OBRIGATÓRIO AUSENTE': { text: 'Ausente', color: 'red' },
      'OPCIONAL - NÃO FORNECIDO': { text: 'Opcional', color: 'gray' }
    };

    if (status.includes('ATENÇÃO - VENCE EM')) {
      return { text: status.replace('ATENÇÃO - ', ''), color: 'yellow' };
    }

    return statusMap[status] || { text: status, color: 'gray' };
  }
};

export type {
  RequiredDocument,
  ComplianceDocument,
  ComplianceResponse,
  DocumentRule,
  RuleReport
};
