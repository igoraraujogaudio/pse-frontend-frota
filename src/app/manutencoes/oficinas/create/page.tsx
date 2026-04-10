"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import WorkshopForm from "../../WorkshopForm";

export default function OficinaCreatePage() {
  const router = useRouter();
  const [, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (formData: {name: string; address: string; phone: string; contact_person: string; email?: string; specialties: string[]; city?: string; state?: string; cnpj?: string; active: boolean; contrato_id?: string; base_id?: string}) => {
    setError("");
    if (!formData.name || !formData.address || !formData.phone || !formData.contact_person) {
      setError("Preencha todos os campos obrigatórios.");
      return;
    }
    
    setSaving(true);
    try {
             const { error: supaError } = await supabase.from("oficinas").insert({
               nome: formData.name,
               endereco: formData.address,
               telefone: formData.phone,
               email: formData.email || null,
               pessoa_contato: formData.contact_person,
               especialidades: formData.specialties,
               cidade: formData.city || null,
               estado: formData.state || null,
               cnpj: formData.cnpj || null,
               ativo: formData.active,
               contrato_id: formData.contrato_id || null,
               base_id: formData.base_id || null,
             });
      
      if (supaError) {
        setError(supaError.message);
        return;
      }
      
      router.push("/manutencoes/oficinas");
    } catch (err) {
      setError("Erro ao cadastrar oficina.");
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    router.push("/manutencoes/oficinas");
  };

  return (
    <main className="min-h-screen bg-gray-50 py-10">
      <div className="max-w-4xl mx-auto px-4">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-extrabold text-blue-900">Cadastrar Oficina</h1>
        </div>
        
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        )}
        
        <div className="flex justify-center">
          <WorkshopForm
            onSubmit={handleSubmit}
            onCancel={handleCancel}
          />
        </div>
      </div>
    </main>
  );
} 