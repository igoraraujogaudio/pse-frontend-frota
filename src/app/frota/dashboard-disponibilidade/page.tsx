'use client'

import { DashboardContent } from '@/app/disponibilidade-frota-dashboard/content'
import { PERMISSION_CODES } from '@/hooks/useModularPermissions'
import ProtectedRoute from '@/components/ProtectedRoute'

export default function DashboardDisponibilidadePage() {
  return (
    <ProtectedRoute requiredPermissions={[PERMISSION_CODES.DISPONIBILIDADE_FROTA.VISUALIZAR]}>
      <DashboardContent />
    </ProtectedRoute>
  )
}
