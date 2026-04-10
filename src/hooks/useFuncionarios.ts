import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { Base, Contrato } from '@/types';
import { contratoService } from '@/services/contratoService';

// Tipos
interface Funcionario {
  id: string;
  nome: string;
  email: string;
  matricula: string;
  cpf?: string;
  telefone?: string;
  cargo: string;
  posicao?: string;
  operacao: string;
  base_id?: string;
  contrato_id?: string;
  departamento?: string;
  status: string;
  nivel_acesso: string;
  criado_em: string;
  atualizado_em: string;
  base_nome?: string;
  contrato_nome?: string;
  cnh?: string;
  validade_cnh?: string;
  cnh_categoria?: string;
  data_ultimo_exame_aso?: string;
  data_agendamento_aso?: string;
  har_vencimento?: string;
}

interface FuncionarioCompleto extends Funcionario {
  base?: {
    id: string;
    nome: string;
    codigo: string;
    cidade?: string;
    estado?: string;
  };
  contrato?: {
    id: string;
    nome: string;
    codigo: string;
  };
  vencimentos: {
    cnh: {
      status: string;
      dias_vencimento: number | null;
      data_vencimento?: string;
    };
    aso: {
      status: string;
      dias_vencimento: number | null;
      data_ultimo?: string;
      data_agendamento?: string;
      agendamento_status?: string;
      data_vencimento?: string;
    };
    har: {
      status: string;
      dias_vencimento: number | null;
      data_vencimento?: string;
    };
  };
}


// Query Keys
export const queryKeys = {
  funcionarios: ['funcionarios'] as const,
  funcionario: (id: string) => ['funcionario', id] as const,
  bases: ['bases'] as const,
  contratos: ['contratos'] as const,
};

// Hooks para Funcionários
export function useFuncionarios() {
  return useQuery({
    queryKey: queryKeys.funcionarios,
    queryFn: async (): Promise<Funcionario[]> => {
      const response = await fetch('/api/users');
      if (!response.ok) {
        throw new Error('Erro ao carregar funcionários');
      }
      const data = await response.json();
      const usuarios = data.usuarios || [];
      
      // Remove duplicates based on ID to prevent React key conflicts
      return usuarios.filter((funcionario: Funcionario, index: number, self: Funcionario[]) => 
        index === self.findIndex(f => f.id === funcionario.id)
      );
    },
    staleTime: 5 * 60 * 1000, // 5 minutos
    gcTime: 10 * 60 * 1000, // 10 minutos
  });
}

export function useFuncionario(id: string) {
  return useQuery({
    queryKey: queryKeys.funcionario(id),
    queryFn: async (): Promise<FuncionarioCompleto> => {
      const response = await fetch(`/api/users/${id}`);
      if (!response.ok) {
        throw new Error('Erro ao buscar dados do funcionário');
      }
      const data = await response.json();
      return data.funcionario;
    },
    enabled: !!id,
    staleTime: 2 * 60 * 1000, // 2 minutos
    gcTime: 5 * 60 * 1000, // 5 minutos
  });
}

// Hooks para Bases e Contratos
export function useBases() {
  return useQuery({
    queryKey: queryKeys.bases,
    queryFn: async (): Promise<Base[]> => {
      const response = await fetch('/api/bases');
      if (!response.ok) {
        throw new Error('Erro ao carregar bases');
      }
      const data = await response.json();
      return data.bases || [];
    },
    staleTime: 10 * 60 * 1000, // 10 minutos
    gcTime: 30 * 60 * 1000, // 30 minutos
  });
}

export function useContratos() {
  return useQuery({
    queryKey: queryKeys.contratos,
    queryFn: async (): Promise<Contrato[]> => {
      return contratoService.getContratosAtivos();
    },
    staleTime: 10 * 60 * 1000, // 10 minutos
    gcTime: 30 * 60 * 1000, // 30 minutos
  });
}

// Mutations
export function useUpdateFuncionario() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<FuncionarioCompleto> }) => {
      const response = await fetch(`/api/users/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error('Erro ao salvar alterações');
      }

      return response.json();
    },
    onSuccess: (data, variables) => {
      // Invalidate and refetch funcionarios list
      queryClient.invalidateQueries({ queryKey: queryKeys.funcionarios });
      
      // Update the specific funcionario cache
      queryClient.setQueryData(queryKeys.funcionario(variables.id), data.usuario);
      
      toast.success('Funcionário atualizado com sucesso!');
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Erro ao salvar');
    },
  });
}

export function useCreateFuncionario() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Partial<FuncionarioCompleto>) => {
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao criar funcionário');
      }

      return response.json();
    },
    onSuccess: () => {
      // Invalidate funcionarios list to refetch
      queryClient.invalidateQueries({ queryKey: queryKeys.funcionarios });
      toast.success('Funcionário criado com sucesso!');
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Erro ao criar funcionário');
    },
  });
}

export function useDismissFuncionario() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { usuario_id: string; data_demissao: string; tipo_demissao: string; observacoes: string }) => {
      const response = await fetch('/api/users/dismiss', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        if (error.itens_pendentes) {
          throw new Error(`Demissão bloqueada: funcionário possui ${error.total_itens} item(ns) no inventário que devem ser devolvidos`);
        }
        throw new Error(error.error || 'Erro ao demitir funcionário');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.funcionarios });
      toast.success('Funcionário demitido com sucesso!');
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Erro ao demitir funcionário');
    },
  });
}

export function useDeleteFuncionario() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/users/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Erro ao excluir funcionário');
      }

      return response.json();
    },
    onSuccess: () => {
      // Invalidate funcionarios list to refetch
      queryClient.invalidateQueries({ queryKey: queryKeys.funcionarios });
      toast.success('Funcionário excluído com sucesso!');
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Erro ao excluir funcionário');
    },
  });
}


