'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import type { Cargo } from '@/types/cargos';

interface UnlinkProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cargo: Cargo | null;
  perfilNome: string;
  onSuccess: () => void;
}

export default function UnlinkProfileDialog({
  open,
  onOpenChange,
  cargo,
  perfilNome,
  onSuccess,
}: UnlinkProfileDialogProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleOpenChange = (value: boolean) => {
    if (!value) {
      setError(null);
      setSubmitting(false);
    }
    onOpenChange(value);
  };

  const handleConfirm = async () => {
    if (!cargo) return;

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`/api/cargos/${cargo.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ perfil_acesso_id: null }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(
          data?.error || `Erro ao desvincular perfil (${response.status})`
        );
      }

      onSuccess();
      handleOpenChange(false);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Erro de conexão. Tente novamente.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Desvincular Perfil de Acesso</DialogTitle>
          <DialogDescription>
            Tem certeza que deseja remover a vinculação do perfil{' '}
            <strong>{perfilNome}</strong> do cargo{' '}
            <strong>{cargo?.nome}</strong>? O cargo ficará sem perfil de acesso
            vinculado.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <p className="text-sm text-red-500 bg-red-50 p-2 rounded">
            {error}
          </p>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={submitting}
          >
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={submitting}
          >
            {submitting ? 'Removendo...' : 'Desvincular'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
