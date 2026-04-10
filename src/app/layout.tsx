import type { Metadata } from "next";
import "./globals.css";
import { NotificationProvider } from '@/contexts/NotificationContext';
import { AuthProvider } from '@/contexts/AuthContext';
import ReactQueryProvider from '@/components/ReactQueryProvider';
import ClientPasswordRedirect from '@/components/ClientPasswordRedirect';
import AuthWrapper from '@/components/AuthWrapper';
import { Toaster } from 'sonner';

export const metadata: Metadata = {
  title: "PSE App",
  description: "PSE App",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="bg-gray-50 h-screen overflow-hidden">
        <AuthProvider>
          <NotificationProvider>
            <ReactQueryProvider>
              <AuthWrapper>
                <ClientPasswordRedirect />
                {children}
                <Toaster position="top-right" richColors />
              </AuthWrapper>
            </ReactQueryProvider>
          </NotificationProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
