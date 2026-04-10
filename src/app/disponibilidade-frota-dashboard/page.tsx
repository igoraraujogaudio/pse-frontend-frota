'use client';

import { PERMISSION_CODES } from '@/hooks/useModularPermissions';
import ProtectedRoute from '@/components/ProtectedRoute';
import { DashboardContent } from './content'

export default function DashboardPage() {
  return (
    <ProtectedRoute requiredPermissions={[PERMISSION_CODES.DISPONIBILIDADE_FROTA.VISUALIZAR]}>
      <DashboardContent />
    </ProtectedRoute>
  );
}
