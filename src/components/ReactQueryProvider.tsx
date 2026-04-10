'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode, useState } from 'react';

export default function ReactQueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000, // 5 minutos
        gcTime: 10 * 60 * 1000, // 10 minutos
        retry: 1,
        refetchOnWindowFocus: false, // Evita recarregar ao trocar de aba
        refetchOnMount: false, // Evita recarregar ao montar componente
        refetchOnReconnect: true, // Recarrega apenas quando reconectar
      },
      mutations: {
        retry: 1,
      },
    },
  }));
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
} 