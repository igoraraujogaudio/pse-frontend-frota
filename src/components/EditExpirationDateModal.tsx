import React, { useState } from 'react';
import { CalendarIcon, PencilIcon } from '@heroicons/react/24/outline';
import type { VehicleDocument } from '@/types';

interface EditExpirationDateModalProps {
  open: boolean;
  onClose: () => void;
  document: VehicleDocument | null;
  onUpdateSuccess?: () => void;
}

export function EditExpirationDateModal({
  open,
  onClose,
  document,
  onUpdateSuccess
}: EditExpirationDateModalProps) {
  const [newExpirationDate, setNewExpirationDate] = useState('');
  const [updating, setUpdating] = useState(false);

  // Inicializar a data quando o modal abrir
  React.useEffect(() => {
    if (open && document?.expira_em) {
      // Converter a data para o formato YYYY-MM-DD para o input date
      const formattedDate = new Date(document.expira_em).toISOString().split('T')[0];
      setNewExpirationDate(formattedDate);
    }
  }, [open, document]);

  if (!open || !document) return null;

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!newExpirationDate) {
      alert('Selecione uma data de validade');
      return;
    }

    try {
      setUpdating(true);

      const response = await fetch(`/api/vehicle-documents/${document!.id}/expiration-date`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          expira_em: newExpirationDate
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Erro ao atualizar data');
      }

      alert('Data de expiração atualizada com sucesso!');
      if (onUpdateSuccess) onUpdateSuccess();
      onClose();

    } catch (error) {
      console.error('Erro ao atualizar data de expiração:', error);
      alert(`Erro ao atualizar data: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    } finally {
      setUpdating(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="relative bg-white/80 backdrop-blur-xl shadow-2xl rounded-2xl max-w-md w-full p-8 border border-gray-200">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors text-xl font-bold focus:outline-none"
          aria-label="Fechar"
        >
          ×
        </button>
        
        <div className="mb-6 flex flex-col items-center gap-1">
          <div className="flex items-center gap-2 text-orange-700 text-base font-semibold">
            <PencilIcon className="h-5 w-5" />
            Editar Data de Expiração
          </div>
          <div className="text-gray-700 text-sm mt-1 text-center">
            <span className="font-medium">{document.tipo_documento.toUpperCase()}</span>
          </div>
        </div>
        
        <div className="mb-4 flex justify-center">
          <div className="flex items-center justify-center w-14 h-14 rounded-full bg-orange-100">
            <CalendarIcon className="h-7 w-7 text-orange-600" />
          </div>
        </div>
        
        <h3 className="text-2xl font-semibold text-gray-900 mb-2 text-center">
          Atualizar Data de Validade
        </h3>
        <p className="text-gray-500 text-sm mb-6 text-center">
          Selecione a nova data de validade para este documento.
        </p>
        
        <form className="space-y-5" onSubmit={handleUpdate}>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nova Data de Validade
            </label>
            <div className="flex items-center gap-2 bg-white/70 border border-gray-200 rounded-lg px-3 py-2 shadow-sm focus-within:ring-2 focus-within:ring-orange-400 transition">
              <CalendarIcon className="h-5 w-5 text-orange-500" />
              <input
                type="date"
                value={newExpirationDate}
                onChange={e => setNewExpirationDate(e.target.value)}
                className="flex-1 bg-transparent border-none outline-none text-gray-700 text-sm placeholder-gray-400"
                required
              />
            </div>
          </div>
          
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 rounded-full text-sm font-medium text-gray-700 bg-white/80 border border-gray-300 hover:bg-gray-100 transition focus:outline-none focus:ring-2 focus:ring-orange-400"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={updating}
              className="px-6 py-2 rounded-full text-sm font-semibold text-white bg-orange-600 hover:bg-orange-700 shadow-md transition focus:outline-none focus:ring-2 focus:ring-orange-400 disabled:opacity-60"
            >
              {updating ? 'Atualizando...' : 'Atualizar Data'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
