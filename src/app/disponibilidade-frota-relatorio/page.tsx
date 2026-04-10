'use client';

import { PERMISSION_CODES } from '@/hooks/useModularPermissions';
import ProtectedRoute from '@/components/ProtectedRoute';
import { RelatorioContent } from './content'

export default function RelatorioPage() {
  return (
    <ProtectedRoute requiredPermissions={[PERMISSION_CODES.DISPONIBILIDADE_FROTA.VISUALIZAR]}>
      <RelatorioContent />
    </ProtectedRoute>
  );
}
