'use client'

import { RelatorioContent } from '@/app/disponibilidade-frota-relatorio/content'
import { PERMISSION_CODES } from '@/hooks/useModularPermissions'
import ProtectedRoute from '@/components/ProtectedRoute'

export default function RelatorioDisponibilidadePage() {
  return (
    <ProtectedRoute requiredPermissions={[PERMISSION_CODES.DISPONIBILIDADE_FROTA.VISUALIZAR]}>
      <RelatorioContent />
    </ProtectedRoute>
  )
}
