'use client'

import { Sidebar } from '@/components/navigation/Sidebar'
import { Breadcrumb } from '@/components/navigation/Breadcrumb'
import { useModularPermissions, PERMISSION_CODES } from '@/hooks/useModularPermissions'
import type { NavLink } from '@/types/navigation'
import {
  Users,
  Upload,
  UserX,
  FileHeart,
  AlertTriangle,
} from 'lucide-react'

type NavLinkWithPermission = NavLink & {
  permissionCheck?: (ctx: {
    hasPermission: (code: string) => boolean
    hasAnyPermission: (codes: string[]) => boolean
  }) => boolean
}

const allNavLinks: NavLinkWithPermission[] = [
  {
    href: '/funcionarios',
    label: 'Lista de Funcionários',
    icon: Users,
  },
  {
    href: '/funcionarios/bulk-upload',
    label: 'Upload em Lote',
    icon: Upload,
    permissionCheck: ({ hasAnyPermission }) =>
      hasAnyPermission([PERMISSION_CODES.FUNCIONARIOS.CRIAR]),
  },
  {
    href: '/users/dismissed',
    label: 'Funcionários Demitidos',
    icon: UserX,
    permissionCheck: ({ hasAnyPermission }) =>
      hasAnyPermission([PERMISSION_CODES.FUNCIONARIOS.VISUALIZAR_DEMITIDOS]),
  },
  {
    href: '/funcionarios/controle-aso',
    label: 'Controle de ASO',
    icon: FileHeart,
  },
  {
    href: '/avisos',
    label: 'Medidas Disciplinares',
    icon: AlertTriangle,
    permissionCheck: ({ hasAnyPermission }) =>
      hasAnyPermission([PERMISSION_CODES.MEDIDAS.VISUALIZAR]),
  },
]

export default function AvisosLayout({ children }: { children: React.ReactNode }) {
  const { hasPermission, hasAnyPermission } = useModularPermissions()

  const navLinks: NavLink[] = allNavLinks
    .filter(link => {
      if (!link.permissionCheck) return true
      return link.permissionCheck({ hasPermission, hasAnyPermission })
    })
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    .map(({ permissionCheck: _pc, ...rest }) => rest)

  return (
    <div className="flex h-screen">
      <Sidebar navLinks={navLinks} />
      <main className="flex-1 overflow-y-auto p-4 md:p-6 md:ml-16">
        <Breadcrumb navLinks={navLinks} />
        {children}
      </main>
    </div>
  )
}
