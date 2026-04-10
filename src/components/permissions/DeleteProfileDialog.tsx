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
import { perfilAcessoService } from '@/services/perfilAcessoService';
import type { PerfilAcesso } from '@/types/permissions';

interface DeleteProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  perfil: PerfilAcesso | null;
  onSuccess: () => void;
}

export default function DeleteProfileDialog({
  open,
  onOpenChange,
  perfil,
  onSuccess,
}: DeleteProfileDialogProps) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cargosVinculados, setCargosVinculados] = useState<string[]>([]);

  const resetState = () => {
    setError(null);
    setCargosVinculados([]);
    setDeleting(false);
  };

  const handleOpenChange = (value: boolean) => {
    if (!value) {
      resetState();
    }
    onOpenChange(value);
  };

  const handleDelete = async () => {
    if (!perfil) return;

    setDeleting(true);
    setError(null);
    setCargosVinculados([]);

    try {
      await perfilAcessoService.delete(perfil.id);
      resetState();
      onSuccess();
      onOpenChange(false);
    } catch (err: unknown) {
      const error = err as Record<string, unknown>;

      if (Array.isArray(error?.cargos)) {
        setCargosVinculados(error.cargos as string[]);
        setError(String(error.error));
      } else if (error?.error) {
        setError(String(error.error));
      } else {
        setError('Erro de conexão. Tente novamente.');
      }
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Excluir Perfil</DialogTitle>
          <DialogDescription>
            Tem certeza que deseja excluir o perfil{' '}
            <strong>{perfil?.nome}</strong>? Esta ação irá desativar o perfil.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="space-y-2">
            <p className="text-sm text-red-500 bg-red-50 p-2 rounded">
              {error}
            </p>
            {cargosVinculados.length > 0 && (
              <div className="text-sm bg-red-50 p-2 rounded">
                <p className="font-medium text-red-700 mb-1">
                  Cargos vinculados:
                </p>
                <ul className="list-disc list-inside text-red-600">
                  {cargosVinculados.map((cargo) => (
                    <li key={cargo}>{cargo}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={deleting}
          >
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={deleting}
          >
            {deleting ? 'Excluindo...' : 'Excluir'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
