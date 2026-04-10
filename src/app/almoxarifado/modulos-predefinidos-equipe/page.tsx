import ProtectedRoute from '@/components/ProtectedRoute'
import ModulosPredefinidosEquipeContent from './ModulosPredefinidosEquipeContent'

export default function ModulosPredefinidosEquipePage() {
  return (
    <ProtectedRoute>
      <ModulosPredefinidosEquipeContent />
    </ProtectedRoute>
  )
}
