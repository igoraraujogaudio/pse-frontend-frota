'use client';

import { PERMISSION_CODES } from '@/hooks/useModularPermissions';
import ProtectedRoute from '@/components/ProtectedRoute';
import { DisponibilidadeRotaContent } from './content'

export default function DisponibilidadeRotaPage() {
  return (
    <ProtectedRoute requiredPermissions={[PERMISSION_CODES.DISPONIBILIDADE_FROTA.VISUALIZAR]}>
      <DisponibilidadeRotaContent />
    </ProtectedRoute>
  );
}
