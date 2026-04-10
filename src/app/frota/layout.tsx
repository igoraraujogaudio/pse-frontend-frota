'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Sidebar } from '@/components/navigation/Sidebar'
import { useModularPermissions, PERMISSION_CODES } from '@/hooks/useModularPermissions'
import type { NavLink } from '@/types/navigation'
import {
  Truck,
  FileText,
  ShieldCheck,
  Users,
  Wrench,
  Activity,
  BarChart3,
  FileBarChart,
  Receipt,
  ClipboardList,
} from 'lucide-react'

type NavLinkWithPermission = NavLink & {
  permissionCheck?: (ctx: {
    hasPermission: (code: string) => boolean
    hasAnyPermission: (codes: string[]) => boolean
  }) => boolean
}

const allNavLinks: NavLinkWithPermission[] = [
  {
    href: '/frota',
    label: 'Veículos',
    icon: Truck,
    exactMatch: true,
  },
  {
    href: '/frota/laudos-documentos',
    label: 'Laudos e Regras',
    icon: FileText,
    permissionCheck: ({ hasPermission }) =>
      hasPermission(PERMISSION_CODES.LAUDOS.VISUALIZAR_LAUDOS),
  },
  {
    href: '/frota/disponibilidade-geral',
    label: 'Disponibilidade',
    icon: Activity,
    permissionCheck: ({ hasAnyPermission }) =>
      hasAnyPermission([
        PERMISSION_CODES.DISPONIBILIDADE_FROTA.VISUALIZAR,
        PERMISSION_CODES.DISPONIBILIDADE_FROTA.REGISTRAR,
      ]),
  },
  {
    href: '/frota/ordens-desconto',
    label: 'Ordens de Desconto',
    icon: Receipt,
  },
  {
    href: '/frota/portaria-veiculos',
    label: 'Portaria',
    icon: ShieldCheck,
  },
  {
    href: '/frota/dashboard-disponibilidade',
    label: 'Dashboard Frota',
    icon: BarChart3,
    permissionCheck: ({ hasAnyPermission }) =>
      hasAnyPermission([
        PERMISSION_CODES.DISPONIBILIDADE_FROTA.VISUALIZAR,
        PERMISSION_CODES.DISPONIBILIDADE_FROTA.REGISTRAR,
      ]),
  },
  {
    href: '/frota/relatorio-disponibilidade',
    label: 'Relatório Frota',
    icon: FileBarChart,
    permissionCheck: ({ hasAnyPermission }) =>
      hasAnyPermission([
        PERMISSION_CODES.DISPONIBILIDADE_FROTA.VISUALIZAR,
        PERMISSION_CODES.DISPONIBILIDADE_FROTA.REGISTRAR,
      ]),
  },
  {
    href: '/frota/manutencoes-geral',
    label: 'Manutenções',
    icon: Wrench,
  },
  {
    href: '/frota/equipes-geral',
    label: 'Equipes',
    icon: Users,
  },
  {
    href: '/frota/operacoes',
    label: 'Operações',
    icon: ClipboardList,
  },
]

export default function FrotaLayout({ children }: { children: React.ReactNode }) {
  const { hasPermission, hasAnyPermission } = useModularPermissions()
  const pathname = usePathname()
  const router = useRouter()

  const navLinks: NavLink[] = allNavLinks
    .filter(link => {
      if (!link.permissionCheck) return true
      return link.permissionCheck({ hasPermission, hasAnyPermission })
    })
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    .map(({ permissionCheck: _pc, ...rest }) => rest)

  useEffect(() => {
    if (pathname === '/frota' && navLinks.length === 1) {
      router.replace(navLinks[0].href)
    } else if (pathname === '/frota' && navLinks.length > 1) {
      const hasRoot = navLinks.some(l => l.href === '/frota' && l.exactMatch)
      if (!hasRoot) router.replace(navLinks[0].href)
    }
  }, [pathname, navLinks, router])

  return (
    <div className="flex h-screen">
      <Sidebar navLinks={navLinks} />
      <main className="flex-1 overflow-y-auto p-4 md:p-6 md:ml-16">
        {children}
      </main>
    </div>
  )
}
