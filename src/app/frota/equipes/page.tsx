'use client';

import { PERMISSION_CODES } from '@/hooks/useModularPermissions';
import ProtectedRoute from '@/components/ProtectedRoute';
import { FrotaEquipesContent } from './content'

export default function FrotaEquipesPage() {
  return (
    <ProtectedRoute requiredPermissions={[
      PERMISSION_CODES.EQUIPES.GERENCIAR_EQUIPES,
      PERMISSION_CODES.EQUIPES.ALOCAR_COLABORADORES,
      PERMISSION_CODES.EQUIPES.VISUALIZAR_EQUIPE
    ]}>
      <FrotaEquipesContent />
    </ProtectedRoute>
  );
}
