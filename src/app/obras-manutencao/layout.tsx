'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useModularPermissions } from '@/hooks/useModularPermissions'
import { UserPopover } from '@/components/navigation/UserPopover'
import NotificationDropdown from '@/components/NotificationDropdown'
import type { NavLink } from '@/types/navigation'
import { isLinkActive } from '@/types/navigation'
import {
  HardHat,
  CalendarClock,
  Package,
  Undo2,
} from 'lucide-react'

type NavLinkWithPermission = NavLink & {
  permissionCheck?: (ctx: {
    hasPermission: (code: string) => boolean
    hasAnyPermission: (codes: string[]) => boolean
  }) => boolean
}

const allNavLinks: NavLinkWithPermission[] = [
  {
    href: '/obras-manutencao',
    label: 'Obras e Manutenção',
    icon: HardHat,
    exactMatch: true,
  },
  {
    href: '/obras-manutencao/programacao',
    label: 'Programação',
    icon: CalendarClock,
  },
  {
    href: '/almoxarifado/entregas-obra',
    label: 'Entrega de Material',
    icon: Package,
  },
  {
    href: '/almoxarifado/devolucoes-obra',
    label: 'Devolução de Material',
    icon: Undo2,
  },
]

export default function ObrasManutencaoLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { hasPermission, hasAnyPermission } = useModularPermissions()

  const navLinks: NavLink[] = allNavLinks
    .filter(link => {
      if (!link.permissionCheck) return true
      return link.permissionCheck({ hasPermission, hasAnyPermission })
    })
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    .map(({ permissionCheck: _pc, ...rest }) => rest)

  return (
    <div className="flex flex-col h-screen">
      {/* Header com navegação */}
      <header className="shrink-0 border-b bg-white shadow-sm z-30">
        <div className="flex items-center justify-between px-4 h-12">
          {/* Logo + Nav links */}
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center shrink-0">
              <Image src="/logo_pse.png" alt="Logo PSE" height={24} width={78} className="h-6 w-auto" priority />
            </Link>

            <nav className="flex items-center gap-1">
              {navLinks.map(link => {
                const active = isLinkActive(pathname, link.href, link.exactMatch)
                const Icon = link.icon
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={cn(
                      'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors',
                      active
                        ? 'bg-gray-100 text-gray-900'
                        : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {link.label}
                  </Link>
                )
              })}
            </nav>
          </div>

          {/* Notificações + Usuário */}
          <div className="flex items-center gap-2">
            <NotificationDropdown collapsed={false} />
            <UserPopover collapsed={false} />
          </div>
        </div>
      </header>

      {/* Conteúdo com largura total */}
      <main className="flex-1 overflow-y-auto p-4 md:p-6">
        {children}
      </main>
    </div>
  )
}
