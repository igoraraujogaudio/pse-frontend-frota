'use client';

import { PERMISSION_CODES } from '@/hooks/useModularPermissions';
import ProtectedRoute from '@/components/ProtectedRoute';
import { ManutencoesContent } from './content'

export default function ManutencoesPage() {
  return (
    <ProtectedRoute requiredPermissions={[
      PERMISSION_CODES.MANUTENCAO.VISUALIZAR_MANUTENCOES
    ]}>
      <ManutencoesContent />
    </ProtectedRoute>
  );
}
