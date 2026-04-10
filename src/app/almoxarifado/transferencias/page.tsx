'use client'

import ProtectedRoute from '@/components/ProtectedRoute'
import { TRANSFERENCIAS_PERMISSIONS } from '@/constants/permissions-transferencias-emprestimos'
import { TransferenciasBasesContent } from './content'

export default function TransferenciasBasesPage() {
  return (
    <ProtectedRoute requiredPermissions={[
      TRANSFERENCIAS_PERMISSIONS.VISUALIZAR
    ]}>
      <TransferenciasBasesContent />
    </ProtectedRoute>
  )
}
