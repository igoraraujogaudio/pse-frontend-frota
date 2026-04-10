'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Sidebar } from '@/components/navigation/Sidebar'
import { useModularPermissions, PERMISSION_CODES } from '@/hooks/useModularPermissions'
import type { NavLink } from '@/types/navigation'
import {
  LayoutDashboard,
  CheckCircle,
  ClipboardList,
  FileText,
  ShieldCheck,
} from 'lucide-react'

type NavLinkWithPermission = NavLink & {
  permissionCheck?: (ctx: {
    hasPermission: (code: string) => boolean
    hasAnyPermission: (codes: string[]) => boolean
  }) => boolean
}

const allNavLinks: NavLinkWithPermission[] = [
  {
    href: '/sesmt',
    label: 'Dashboard',
    icon: LayoutDashboard,
    exactMatch: true,
    permissionCheck: ({ hasPermission }) =>
      hasPermission(PERMISSION_CODES.SESMT.DASHBOARD_SESMT),
  },
  {
    href: '/sesmt/aprovacao',
    label: 'Aprovação',
    icon: CheckCircle,
    permissionCheck: ({ hasAnyPermission }) =>
      hasAnyPermission([
        PERMISSION_CODES.SESMT.APROVAR_SOLICITACOES_SESMT,
        PERMISSION_CODES.SESMT.VISUALIZAR_SOLICITACOES_SESMT,
      ]),
  },
  {
    href: '/sesmt/inventarios',
    label: 'Inventários',
    icon: ClipboardList,
    permissionCheck: ({ hasAnyPermission }) =>
      hasAnyPermission([
        PERMISSION_CODES.SESMT.VISUALIZAR_SOLICITACOES_SESMT,
        PERMISSION_CODES.SESMT.APROVAR_SOLICITACOES_SESMT,
      ]),
  },
  {
    href: '/sesmt/laudos',
    label: 'Laudos',
    icon: FileText,
    permissionCheck: ({ hasAnyPermission }) =>
      hasAnyPermission([
        PERMISSION_CODES.SESMT.GERENCIAR_LAUDOS,
        PERMISSION_CODES.SESMT.VISUALIZAR_LAUDOS,
        PERMISSION_CODES.SESMT.CONTROLE_VENCIMENTO_LAUDOS,
        PERMISSION_CODES.SESMT.RELATORIOS_LAUDOS,
      ]),
  },
  {
    href: '/sesmt/portaria',
    label: 'Portaria',
    icon: ShieldCheck,
    permissionCheck: ({ hasAnyPermission }) =>
      hasAnyPermission([
        PERMISSION_CODES.PORTARIA.RELATORIO_MOVIMENTACOES,
      ]),
  },
]

export default function SESMTLayout({ children }: { children: React.ReactNode }) {
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

  // Se o usuário está na raiz /sesmt e só tem acesso a uma página, redireciona direto
  useEffect(() => {
    if (pathname === '/sesmt' && navLinks.length === 1) {
      router.replace(navLinks[0].href)
    } else if (pathname === '/sesmt' && navLinks.length > 1) {
      const hasDashboard = navLinks.some(l => l.href === '/sesmt' && l.exactMatch)
      if (!hasDashboard) {
        router.replace(navLinks[0].href)
      }
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
