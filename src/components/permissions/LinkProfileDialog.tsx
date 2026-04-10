'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import type { Cargo } from '@/types/cargos';
import type { PerfilAcesso } from '@/types/permissions';

interface LinkProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cargo: Cargo | null;
  perfisAcesso: PerfilAcesso[];
  onSuccess: () => void;
}

export default function LinkProfileDialog({
  open,
  onOpenChange,
  cargo,
  perfisAcesso,
  onSuccess,
}: LinkProfileDialogProps) {
  const [selectedPerfilId, setSelectedPerfilId] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset state and pre-select current profile when dialog opens
  useEffect(() => {
    if (open && cargo) {
      setSelectedPerfilId(cargo.perfil_acesso_id || '');
      setError(null);
      setSubmitting(false);
    }
  }, [open, cargo]);

  const handleSubmit = async () => {
    if (!cargo || !selectedPerfilId) return;

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`/api/cargos/${cargo.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ perfil_acesso_id: selectedPerfilId }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(
          data?.error || `Erro ao vincular perfil (${response.status})`
        );
      }

      onSuccess();
      onOpenChange(false);
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

  const perfisAtivos = perfisAcesso.filter((p) => p.ativo);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Vincular Perfil de Acesso</DialogTitle>
          <DialogDescription>
            Selecione o perfil de acesso para o cargo{' '}
            <strong>{cargo?.nome}</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <Label htmlFor="perfil-select">Perfil de Acesso</Label>
            <Select value={selectedPerfilId} onValueChange={setSelectedPerfilId}>
              <SelectTrigger id="perfil-select" className="w-full">
                <SelectValue placeholder="Selecione um perfil" />
              </SelectTrigger>
              <SelectContent>
                {perfisAtivos.map((perfil) => (
                  <SelectItem key={perfil.id} value={perfil.id}>
                    <span className="flex items-center gap-2">
                      {perfil.cor && (
                        <span
                          className="inline-block h-3 w-3 rounded-full"
                          style={{ backgroundColor: perfil.cor }}
                        />
                      )}
                      {perfil.nome}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {error && (
            <p className="text-sm text-red-500 bg-red-50 p-2 rounded">
              {error}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!selectedPerfilId || submitting}
          >
            {submitting ? 'Salvando...' : 'Vincular'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
