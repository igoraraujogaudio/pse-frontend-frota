import type { PerfilAcesso } from '@/types/permissions';

// ============================================================================
// Interfaces
// ============================================================================

export interface PerfilAcessoInput {
  codigo: string;
  nome: string;
  descricao?: string;
  nivel_hierarquia: number;
  cor?: string;
}

export interface PerfilFormData {
  codigo: string;
  nome: string;
  descricao: string;
  nivel_hierarquia: number | '';
  cor: string;
}

export interface PerfilFormErrors {
  codigo?: string;
  nome?: string;
  nivel_hierarquia?: string;
  api?: string;
}

// ============================================================================
// Validação
// ============================================================================

export function validatePerfilForm(data: PerfilFormData): PerfilFormErrors {
  const errors: PerfilFormErrors = {};

  if (data.codigo && !/^[a-z0-9_]+$/.test(data.codigo)) {
    errors.codigo = 'Código deve conter apenas letras minúsculas, números e underscores';
  }

  if (data.nome && (data.nome.length < 3 || data.nome.length > 100)) {
    errors.nome = 'Nome deve ter entre 3 e 100 caracteres';
  }

  if (data.nivel_hierarquia !== '' && data.nivel_hierarquia !== undefined) {
    const val = data.nivel_hierarquia;
    if (!Number.isInteger(val) || val <= 0) {
      errors.nivel_hierarquia = 'Nível hierárquico deve ser um número inteiro positivo';
    }
  }

  return errors;
}

export function isFormValid(data: PerfilFormData, errors: PerfilFormErrors): boolean {
  const hasEmptyRequired =
    !data.codigo ||
    !data.nome ||
    data.nivel_hierarquia === '' ||
    data.nivel_hierarquia === undefined;

  const hasErrors =
    !!errors.codigo || !!errors.nome || !!errors.nivel_hierarquia;

  return !hasEmptyRequired && !hasErrors;
}


// ============================================================================
// Serviço de API
// ============================================================================

export const perfilAcessoService = {
  async create(data: PerfilAcessoInput): Promise<PerfilAcesso> {
    const response = await fetch('/api/perfis-acesso', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    const json = await response.json();

    if (!response.ok) {
      throw json;
    }

    return json.perfil;
  },

  async update(id: string, data: PerfilAcessoInput): Promise<PerfilAcesso> {
    const response = await fetch(`/api/perfis-acesso/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    const json = await response.json();

    if (!response.ok) {
      throw json;
    }

    return json.perfil;
  },

  async delete(id: string): Promise<PerfilAcesso> {
    const response = await fetch(`/api/perfis-acesso/${id}`, {
      method: 'DELETE',
    });

    const json = await response.json();

    if (!response.ok) {
      throw json;
    }

    return json.perfil;
  },
};
