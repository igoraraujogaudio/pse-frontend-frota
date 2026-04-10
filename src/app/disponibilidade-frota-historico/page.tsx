'use client';

import { PERMISSION_CODES } from '@/hooks/useModularPermissions';
import ProtectedRoute from '@/components/ProtectedRoute';
import { HistoricoContent } from './content'

export default function DisponibilidadeFrotaHistoricoPage() {
  return (
    <ProtectedRoute requiredPermissions={[PERMISSION_CODES.DISPONIBILIDADE_FROTA.VISUALIZAR]}>
      <HistoricoContent />
    </ProtectedRoute>
  );
}
