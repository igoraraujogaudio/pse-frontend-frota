// ============================================================================
// HOOK PARA GERENCIAR PERFIS DE ACESSO
// ============================================================================
// Hook personalizado para gerenciar perfis de acesso e níveis de acesso
// ============================================================================

import { useState, useEffect } from 'react';
import { 
  getNivelAcessoByPerfil,
  getNomePerfilById,
  getCorPerfilById,
  obterEstatisticasPerfis,
  perfilExiste,
  perfilAtivo
} from '@/utils/perfilUtils';

export interface PerfilAcesso {
  id: string;
  codigo: string;
  nome: string;
  descricao?: string;
  nivel_hierarquia: number;
  cor?: string;
  ativo: boolean;
}

// ============================================================================
// HOOK PRINCIPAL
// ============================================================================

export const usePerfisAcesso = () => {
  const [perfisAcesso, setPerfisAcesso] = useState<PerfilAcesso[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ============================================================================
  // CARREGAR DADOS
  // ============================================================================

  const loadPerfisAcesso = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/perfis-acesso');
      if (response.ok) {
        const data = await response.json();
        setPerfisAcesso(data);
      } else {
        throw new Error('Erro ao carregar perfis de acesso');
      }
    } catch (err) {
      console.error('Erro ao carregar perfis de acesso:', err);
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  };

  // ============================================================================
  // OPERAÇÕES CRUD
  // ============================================================================

  const createPerfil = async (perfilData: Omit<PerfilAcesso, 'id' | 'ativo'>) => {
    try {
      const response = await fetch('/api/perfis-acesso', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(perfilData)
      });
      
      if (response.ok) {
        await loadPerfisAcesso();
        return { success: true };
      } else {
        const error = await response.json();
        return { success: false, error: error.error || 'Erro ao criar perfil' };
      }
    } catch (err) {
      console.error('Erro ao criar perfil:', err);
      return { success: false, error: 'Erro ao criar perfil' };
    }
  };

  const updatePerfil = async (perfilId: string, perfilData: Partial<PerfilAcesso>) => {
    try {
      const response = await fetch(`/api/perfis-acesso/${perfilId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(perfilData)
      });
      
      if (response.ok) {
        await loadPerfisAcesso();
        return { success: true };
      } else {
        const error = await response.json();
        return { success: false, error: error.error || 'Erro ao atualizar perfil' };
      }
    } catch (err) {
      console.error('Erro ao atualizar perfil:', err);
      return { success: false, error: 'Erro ao atualizar perfil' };
    }
  };

  const deletePerfil = async (perfilId: string) => {
    try {
      const response = await fetch(`/api/perfis-acesso/${perfilId}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        await loadPerfisAcesso();
        return { success: true };
      } else {
        const error = await response.json();
        return { success: false, error: error.error || 'Erro ao deletar perfil' };
      }
    } catch (err) {
      console.error('Erro ao deletar perfil:', err);
      return { success: false, error: 'Erro ao deletar perfil' };
    }
  };

  // ============================================================================
  // FUNÇÕES UTILITÁRIAS
  // ============================================================================

  const getNivelAcesso = (perfilId: string) => {
    return getNivelAcessoByPerfil(perfilId, perfisAcesso);
  };

  const getNomePerfil = (perfilId: string) => {
    return getNomePerfilById(perfilId, perfisAcesso);
  };

  const getCorPerfil = (perfilId: string) => {
    return getCorPerfilById(perfilId, perfisAcesso);
  };

  const verificarPerfilExiste = (perfilId: string) => {
    return perfilExiste(perfilId, perfisAcesso);
  };

  const verificarPerfilAtivo = (perfilId: string) => {
    return perfilAtivo(perfilId, perfisAcesso);
  };

  const obterEstatisticas = () => {
    return obterEstatisticasPerfis(perfisAcesso);
  };

  // ============================================================================
  // FILTROS E BUSCA
  // ============================================================================

  const buscarPerfilPorCodigo = (codigo: string) => {
    return perfisAcesso.find(p => p.codigo === codigo);
  };

  const buscarPerfilPorNome = (nome: string) => {
    return perfisAcesso.find(p => p.nome === nome);
  };

  const filtrarPerfisAtivos = () => {
    return perfisAcesso.filter(p => p.ativo);
  };

  const filtrarPerfisInativos = () => {
    return perfisAcesso.filter(p => !p.ativo);
  };

  // ============================================================================
  // VALIDAÇÕES
  // ============================================================================

  const validarCodigoUnico = (codigo: string, excludeId?: string) => {
    return !perfisAcesso.some(p => p.codigo === codigo && p.id !== excludeId);
  };

  const validarNomeUnico = (nome: string, excludeId?: string) => {
    return !perfisAcesso.some(p => p.nome === nome && p.id !== excludeId);
  };

  // ============================================================================
  // EFEITOS
  // ============================================================================

  useEffect(() => {
    loadPerfisAcesso();
  }, []);

  // ============================================================================
  // RETORNO DO HOOK
  // ============================================================================

  return {
    // Estado
    perfisAcesso,
    loading,
    error,
    
    // Operações CRUD
    loadPerfisAcesso,
    createPerfil,
    updatePerfil,
    deletePerfil,
    
    // Funções utilitárias
    getNivelAcesso,
    getNomePerfil,
    getCorPerfil,
    verificarPerfilExiste,
    verificarPerfilAtivo,
    obterEstatisticas,
    
    // Filtros e busca
    buscarPerfilPorCodigo,
    buscarPerfilPorNome,
    filtrarPerfisAtivos,
    filtrarPerfisInativos,
    
    // Validações
    validarCodigoUnico,
    validarNomeUnico
  };
};
