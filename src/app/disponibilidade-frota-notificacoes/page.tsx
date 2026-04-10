'use client';

import { PERMISSION_CODES } from '@/hooks/useModularPermissions';
import ProtectedRoute from '@/components/ProtectedRoute';
import { NotificacoesContent } from './content'

export default function DisponibilidadeFrotaNotificacoesPage() {
  return (
    <ProtectedRoute requiredPermissions={[PERMISSION_CODES.DISPONIBILIDADE_FROTA.GERENCIAR_NOTIFICACOES]}>
      <NotificacoesContent />
    </ProtectedRoute>
  );
}
