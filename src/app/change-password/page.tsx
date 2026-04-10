"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

export default function ChangePasswordPage() {
  const { user, refreshUser } = useAuth();
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password !== confirm) {
      setError("As senhas não coincidem.");
      return;
    }
    setLoading(true);
    try {
      // Chame sua API para trocar a senha e atualizar o status do usuário
      if (!user) return;
      
      const response = await fetch("/api/users/change-password", {
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
        throw new Error(data.error || "Erro ao trocar a senha.");
      }

      // Atualizar os dados do usuário no contexto para refletir as mudanças
      await refreshUser();
      
      // Aguardar um pouco para garantir que o contexto foi atualizado
      setTimeout(() => {
        // Redirecione para a página inicial
        router.replace("/");
      }, 100);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Erro ao trocar a senha.";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50">
      <form onSubmit={handleSubmit} className="bg-white p-8 rounded shadow max-w-md w-full flex flex-col gap-4">
        <h1 className="text-2xl font-bold mb-2">Troque sua senha</h1>
        <input
          type="password"
          placeholder="Nova senha"
          className="border rounded px-3 py-2"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Confirme a nova senha"
          className="border rounded px-3 py-2"
          value={confirm}
          onChange={e => setConfirm(e.target.value)}
          required
        />
        {error && <div className="text-red-600 text-sm">{error}</div>}
        <button
          type="submit"
          className="bg-blue-600 text-white rounded px-4 py-2 font-semibold"
          disabled={loading}
        >
          {loading ? "Salvando..." : "Salvar nova senha"}
        </button>
      </form>
    </main>
  );
} 