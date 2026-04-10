'use client';

import { Suspense } from 'react';
import { PERMISSION_CODES } from '@/hooks/useModularPermissions';
import ProtectedRoute from '@/components/ProtectedRoute';
import { LaudosContent } from './content'

export default function LaudosPage() {
  return (
    <ProtectedRoute requiredPermissions={[
      PERMISSION_CODES.LAUDOS.GERENCIAR_LAUDOS,
      PERMISSION_CODES.LAUDOS.ALERTAS_VENCIMENTO,
      PERMISSION_CODES.LAUDOS.RELATORIO_CONFORMIDADE,
      PERMISSION_CODES.LAUDOS.VISUALIZAR_LAUDOS
    ]}>
      <Suspense fallback={<div>Carregando...</div>}>
        <LaudosContent />
      </Suspense>
    </ProtectedRoute>
  );
}
