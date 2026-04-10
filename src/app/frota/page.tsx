'use client'

import { VehiclesPageContent } from '@/app/vehicles/content'
import ProtectedRoute from '@/components/ProtectedRoute'
import { PERMISSION_CODES } from '@/hooks/useModularPermissions'

export default function FrotaPage() {
  return (
    <ProtectedRoute requiredPermissions={[
      PERMISSION_CODES.VEICULOS.DASHBOARD_FROTA,
      PERMISSION_CODES.VEICULOS.RELATORIO_FROTA,
    ]}>
      <VehiclesPageContent />
    </ProtectedRoute>
  )
}
