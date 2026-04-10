import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

interface Contract {
  id: string;
  nome: string;
  codigo: string;
  status: string;
  total_veiculos?: number;
}

// Hook para obter contratos filtrados por usuário
export const useUserContracts = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['user-contracts', user?.id],
    queryFn: async (): Promise<Contract[]> => {
      if (!user) {
        throw new Error('Usuário não autenticado');
      }

      // Obter token de sessão
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Token de acesso não encontrado');
      }

      const response = await fetch('/api/admin/contracts', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'x-user-level': user.nivel_acesso || '',
          'x-user-id': user.id || ''
        }
      });
      
      if (!response.ok) {
        throw new Error('Erro ao buscar contratos');
      }
      
      const data = await response.json();
      return data.contracts || [];
    },
    enabled: !!user,
    staleTime: 10 * 60 * 1000, // 10 minutos
  });
};




