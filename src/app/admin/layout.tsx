'use client'

import { Sidebar } from '@/components/navigation/Sidebar'
import { Breadcrumb } from '@/components/navigation/Breadcrumb'
import { useAuth } from '@/contexts/AuthContext'
import type { NavLink } from '@/types/navigation'
import {
  ShieldCheck,
  Users,
  UserPlus,
  Upload,
  RotateCcw,
  MapPin,
  ClipboardList,
  Building2,
  Briefcase,
} from 'lucide-react'

type NavLinkWithPermission = NavLink & {
  permissionCheck?: (ctx: { isAdmin: boolean }) => boolean
}

const allNavLinks: NavLinkWithPermission[] = [
  {
    href: '/admin/access-control',
    label: 'Controle de Acesso',
    icon: ShieldCheck,
  },
  {
    href: '/admin/cargos',
    label: 'Cargos e Níveis de Acesso',
    icon: Users,
  },
  {
    href: '/users/create',
    label: 'Novo Usuário',
    icon: UserPlus,
  },
  {
    href: '/users/bulk-upload',
    label: 'Upload em Lote',
    icon: Upload,
  },
  {
    href: '/users/reset-logs',
    label: 'Logs de Reset',
    icon: RotateCcw,
  },
  {
    href: '/admin/bases',
    label: 'Gestão de Bases',
    icon: MapPin,
    permissionCheck: ({ isAdmin }) => isAdmin,
  },
  {
    href: '/users/manage-all-contratos',
    label: 'Gestão Completa',
    icon: ClipboardList,
    permissionCheck: ({ isAdmin }) => isAdmin,
  },
  {
    href: '/users/manage-contratos',
    label: 'Contratos & Bases',
    icon: Building2,
    permissionCheck: ({ isAdmin }) => isAdmin,
  },
  {
    href: '/users/manage-contratos-origem',
    label: 'Contratos de Origem',
    icon: Briefcase,
    permissionCheck: ({ isAdmin }) => isAdmin,
  },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const isAdmin = user?.nivel_acesso === 'admin'

  const navLinks: NavLink[] = allNavLinks
    .filter(link => {
      if (!link.permissionCheck) return true
      return link.permissionCheck({ isAdmin })
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
