import { PermissionDebugger } from '@/components/debug/PermissionDebugger'

export default function DebugPermissionsPage() {
  return (
    <div className="container mx-auto py-8">
      <h1 className="text-2xl font-bold mb-6">Debug de Permissões</h1>
      <PermissionDebugger />
    </div>
  )
}
