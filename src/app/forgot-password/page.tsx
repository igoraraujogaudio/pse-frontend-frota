'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNotification } from '@/contexts/NotificationContext';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';

export default function ForgotPasswordPage() {
  const { resetPassword } = useAuth();
  const { notify } = useNotification();
  const router = useRouter();
  const [identifier, setIdentifier] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [countdown, setCountdown] = useState(5);

  // Redirecionar automaticamente após envio do email
  useEffect(() => {
    if (sent) {
      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            router.push('/login');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [sent, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      let email = identifier;
      
      // Se não for um email, assume matrícula e busca o email correspondente
      if (!identifier.includes('@')) {
        const response = await fetch('/api/auth/get-email-by-matricula', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ matricula: identifier }),
        });

        if (!response.ok) {
          throw new Error('Matrícula não encontrada');
        }

        const { email: foundEmail } = await response.json();
        email = foundEmail;
      }

      await resetPassword(email);
      setSent(true);
      notify('Email de recuperação enviado com sucesso!', 'success');
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Erro ao enviar email de recuperação';
      notify(errorMessage, 'error');
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="flex justify-center">
            <Image
              src="/logo.png"
              alt="Logo"
              width={180}
              height={60}
              className="h-26 w-auto"
            />
          </div>
          <h2 className="mt-4 text-center text-2xl font-extrabold text-gray-900">
            Email Enviado
          </h2>
        </div>

        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
                <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Verifique seu email
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                Enviamos um link de recuperação de senha para o seu email. 
                Clique no link para redefinir sua senha.
              </p>
              <p className="text-sm text-blue-600 font-medium mb-6">
                Redirecionando para o login em {countdown} segundo{countdown !== 1 ? 's' : ''}...
              </p>
              <div className="space-y-3">
                <Link
                  href="/login"
                  className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Ir para o Login Agora
                </Link>
                <button
                  onClick={() => {
                    setSent(false);
                    setIdentifier('');
                    setCountdown(5);
                  }}
                  className="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Enviar Novamente
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <Image
            src="/logo.png"
            alt="Logo"
            width={180}
            height={60}
            className="h-26 w-auto"
          />
        </div>
        <h2 className="mt-4 text-center text-2xl font-extrabold text-gray-900">
          Recuperar Senha
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          Digite sua matrícula ou email para receber um link de recuperação
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="identifier" className="block text-sm font-medium text-gray-700">
                Matrícula ou Email
              </label>
              <div className="mt-1">
                <input
                  id="identifier"
                  name="identifier"
                  type="text"
                  autoComplete="username"
                  required
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="Digite sua matrícula ou email"
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Enviando...' : 'Enviar Link de Recuperação'}
              </button>
            </div>

            <div className="text-center">
              <Link
                href="/login"
                className="font-medium text-blue-600 hover:text-blue-500 text-sm"
              >
                Voltar ao Login
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}