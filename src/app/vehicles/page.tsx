'use client';

import { PERMISSION_CODES } from '@/hooks/useModularPermissions';
import ProtectedRoute from '@/components/ProtectedRoute';
import { VehiclesPageContent } from './content'

export default function VehiclesPage() {
  return (
    <ProtectedRoute requiredPermissions={[
      PERMISSION_CODES.VEICULOS.DASHBOARD_FROTA,
      PERMISSION_CODES.VEICULOS.RELATORIO_FROTA
    ]}>
      <VehiclesPageContent />
    </ProtectedRoute>
  );
}
