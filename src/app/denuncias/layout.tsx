'use client';

import { NotificationProvider } from '@/contexts/NotificationContext';
import { AuthProvider } from '@/contexts/AuthContext';
import ReactQueryProvider from '@/components/ReactQueryProvider';
import { Toaster } from 'sonner';

export default function DenunciasLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <NotificationProvider>
        <ReactQueryProvider>
          {/* Página pública sem Header */}
          {children}
          <Toaster position="top-right" richColors />
        </ReactQueryProvider>
      </NotificationProvider>
    </AuthProvider>
  );
}

