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
import { Button } from '@/components/ui/button';
import { modularPermissionService } from '@/services/modularPermissionService';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import type { Cargo } from '@/types/cargos';

interface ApplyPermissionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cargo: Cargo | null;
  perfilId: string;
  perfilNome: string;
  onSuccess: (count: number) => void;
}

export default function ApplyPermissionsDialog({
  open,
  onOpenChange,
  cargo,
  perfilId,
  perfilNome,
  onSuccess,
}: ApplyPermissionsDialogProps) {
  const { user: currentUser } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userCount, setUserCount] = useState<number | null>(null);
  const [loadingCount, setLoadingCount] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Fetch user count when dialog opens
  useEffect(() => {
    if (open && perfilId) {
      fetchUserCount();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, perfilId]);

  const fetchUserCount = async () => {
    setLoadingCount(true);
    setError(null);
    setSuccessMessage(null);

    try {
      // Fetch the profile to get codigo/nome for matching users
      const { data: perfil, error: perfilError } = await supabase
        .from('perfis_acesso')
        .select('codigo, nome')
        .eq('id', perfilId)
        .single();

      if (perfilError) {
        throw new Error('Erro ao buscar dados do perfil');
      }

      // Count users matching the profile's nivel_acesso (same logic as the service)
      const { count, error: countError } = await supabase
        .from('usuarios')
        .select('id', { count: 'exact', head: true })
        .or(`nivel_acesso.eq.${perfil.codigo},nivel_acesso.eq.${perfil.nome}`)
        .eq('status', 'ativo');

      if (countError) {
        throw new Error('Erro ao contar usuários');
      }

      setUserCount(count ?? 0);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Erro ao buscar contagem de usuários.');
      }
      setUserCount(null);
    } finally {
      setLoadingCount(false);
    }
  };

  const handleOpenChange = (value: boolean) => {
    if (!value) {
      setError(null);
      setSubmitting(false);
      setSuccessMessage(null);
      setUserCount(null);
    }
    onOpenChange(value);
  };

  const handleConfirm = async () => {
    if (!cargo || !perfilId) return;

    setSubmitting(true);
    setError(null);
    setSuccessMessage(null);

    try {
      await modularPermissionService.applyProfileDefaultPermissionsToAllUsers(
        perfilId,
        currentUser?.id || null
      );

      const count = userCount ?? 0;
      setSuccessMessage(
        `Permissões do perfil "${perfilNome}" aplicadas com sucesso a ${count} usuário${count !== 1 ? 's' : ''}.`
      );
      onSuccess(count);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Erro ao aplicar permissões. Tente novamente.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Aplicar Permissões em Massa</DialogTitle>
          <DialogDescription>
            {successMessage ? (
              successMessage
            ) : (
              <>
                Aplicar as permissões padrão do perfil{' '}
                <strong>{perfilNome}</strong> a todos os usuários com o cargo{' '}
                <strong>{cargo?.nome}</strong>.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        {!successMessage && (
          <div className="py-2 space-y-3">
            {loadingCount ? (
              <p className="text-sm text-gray-500">
                Carregando contagem de usuários...
              </p>
            ) : userCount !== null ? (
              <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                <p className="text-sm text-blue-800">
                  <strong>{userCount}</strong> usuário{userCount !== 1 ? 's' : ''}{' '}
                  {userCount !== 1 ? 'serão afetados' : 'será afetado'} por esta
                  ação.
                </p>
              </div>
            ) : null}

            {error && (
              <p className="text-sm text-red-500 bg-red-50 p-2 rounded">
                {error}
              </p>
            )}
          </div>
        )}

        {successMessage && (
          <div className="py-2">
            <div className="bg-green-50 border border-green-200 rounded-md p-3">
              <p className="text-sm text-green-800">{successMessage}</p>
            </div>
          </div>
        )}

        <DialogFooter>
          {successMessage ? (
            <Button onClick={() => handleOpenChange(false)}>Fechar</Button>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={submitting}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleConfirm}
                disabled={submitting || loadingCount}
              >
                {submitting ? 'Aplicando...' : 'Aplicar Permissões'}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
