'use client'

import { Sidebar } from '@/components/navigation/Sidebar'
import { Breadcrumb } from '@/components/navigation/Breadcrumb'
import { useModularPermissions, PERMISSION_CODES } from '@/hooks/useModularPermissions'
import { useAuth } from '@/contexts/AuthContext'
import type { NavLink } from '@/types/navigation'
import {
  QrCode,
  Calendar,
  LayoutDashboard,
  GitBranch,
  Shield,
} from 'lucide-react'

type NavLinkWithPermission = NavLink & {
  permissionCheck?: (ctx: {
    hasPermission: (code: string) => boolean
    hasAnyPermission: (codes: string[]) => boolean
    isAdmin: boolean
  }) => boolean
}

const allNavLinks: NavLinkWithPermission[] = [
  {
    href: '/qr-generator',
    label: 'Gerador de QR Codes',
    icon: QrCode,
    permissionCheck: ({ hasPermission }) =>
      hasPermission(PERMISSION_CODES.QR_GENERATOR.GERAR_QR_CODE),
  },
  {
    href: '/programacao-manutencoes',
    label: 'Programação',
    icon: Calendar,
    permissionCheck: ({ isAdmin, hasPermission }) =>
      isAdmin && hasPermission(PERMISSION_CODES.PROGRAMACAO.VISUALIZAR_CALENDARIO),
  },
  {
    href: '/dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
    permissionCheck: ({ isAdmin }) => isAdmin,
  },
  {
    href: '/app-versions',
    label: 'Controle de Versões',
    icon: GitBranch,
    permissionCheck: ({ isAdmin }) => isAdmin,
  },
  {
    href: '/admin',
    label: 'Painel Admin',
    icon: Shield,
    permissionCheck: ({ isAdmin }) => isAdmin,
  },
]

export default function FerramentasLayout({ children }: { children: React.ReactNode }) {
  const { hasPermission, hasAnyPermission } = useModularPermissions()
  const { user } = useAuth()
  const isAdmin = user?.nivel_acesso === 'admin'

  const navLinks: NavLink[] = allNavLinks
    .filter(link => {
      if (!link.permissionCheck) return true
      return link.permissionCheck({ hasPermission, hasAnyPermission, isAdmin })
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
