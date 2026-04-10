'use client'

import ProtectedRoute from '@/components/ProtectedRoute'
import { EMPRESTIMOS_TERCEIROS_PERMISSIONS } from '@/constants/permissions-transferencias-emprestimos'
import { EmprestimosTerceirosContent } from './content'

export default function EmprestimosTerceirosPage() {
  return (
    <ProtectedRoute requiredPermissions={[
      EMPRESTIMOS_TERCEIROS_PERMISSIONS.VISUALIZAR
    ]}>
      <EmprestimosTerceirosContent />
    </ProtectedRoute>
  )
}
