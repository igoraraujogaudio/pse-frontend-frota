"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useNotification } from "@/contexts/NotificationContext";
import Image from "next/image";

interface ForcedPasswordChangeProps {
  user: {
    id: string;
    nome: string;
    email: string;
    deve_mudar_senha?: boolean;
    forcar_mudanca_senha?: boolean;
    auth_usuario_id?: string;
  };
}

export default function ForcedPasswordChange({ user }: ForcedPasswordChangeProps) {
  const router = useRouter();
  const { notify } = useNotification();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const isForcedByAdmin = user.forcar_mudanca_senha;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    // Validações
    if (!password.trim()) {
      setError("Por favor, digite uma senha.");
      return;
    }

    if (password.length < 6) {
      setError("A senha deve ter pelo menos 6 caracteres.");
      return;
    }

    if (password !== confirmPassword) {
      setError("As senhas não coincidem.");
      return;
    }

    // Validação adicional de segurança
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);

    if (!hasUpperCase || !hasLowerCase || !hasNumbers) {
      setError("A senha deve conter pelo menos uma letra maiúscula, uma minúscula e um número.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/users/forced-password-change", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          userId: user.id, 
          newPassword: password,
          authUserId: user.auth_usuario_id 
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Erro ao alterar senha");
      }

      notify("Senha alterada com sucesso! Redirecionando...", "success");
      
      // Aguardar um pouco para mostrar a mensagem de sucesso
      setTimeout(() => {
        router.replace("/");
      }, 1500);

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Erro ao alterar senha";
      setError(errorMessage);
      notify(errorMessage, "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <Image
            src="/logo.png"
            alt="Logo"
            width={120}
            height={120}
            className="h-20 w-auto"
          />
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          {isForcedByAdmin ? "Alteração de Senha Obrigatória" : "Primeiro Acesso"}
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          {isForcedByAdmin 
            ? "O administrador solicitou que você altere sua senha por motivos de segurança."
            : "Por motivos de segurança, você deve alterar sua senha no primeiro acesso."
          }
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Nova Senha
              </label>
              <div className="mt-1">
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  placeholder="Digite sua nova senha"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
                Confirmar Nova Senha
              </label>
              <div className="mt-1">
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  required
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  placeholder="Confirme sua nova senha"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
            </div>

            {/* Informações sobre requisitos da senha */}
            <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
              <h4 className="text-sm font-medium text-blue-800 mb-2">Requisitos da senha:</h4>
              <ul className="text-xs text-blue-700 space-y-1">
                <li>• Mínimo de 6 caracteres</li>
                <li>• Pelo menos uma letra maiúscula</li>
                <li>• Pelo menos uma letra minúscula</li>
                <li>• Pelo menos um número</li>
              </ul>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-md p-4">
                <div className="text-sm text-red-600">{error}</div>
              </div>
            )}

            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Alterando..." : "Alterar Senha"}
              </button>
            </div>
          </form>

          {/* Informações adicionais */}
          <div className="mt-6 text-center">
            <div className="text-sm text-gray-600">
              <p className="mb-2">
                <strong>Usuário:</strong> {user.nome}
              </p>
              <p className="mb-2">
                <strong>Email:</strong> {user.email}
              </p>
              {isForcedByAdmin && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 mt-4">
                  <p className="text-sm text-yellow-800">
                    <strong>⚠️ Atenção:</strong> Esta alteração foi solicitada pelo administrador do sistema.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
