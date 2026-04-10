'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Sidebar } from '@/components/navigation/Sidebar'
import { useModularPermissions, PERMISSION_CODES } from '@/hooks/useModularPermissions'
import type { NavLink } from '@/types/navigation'
import {
  Package,
  Boxes,
  ClipboardList,
  AlertTriangle,
  ArrowRightLeft,
  PackageOpen,
  BookMarked,
  FileText,
  RotateCcw,
  FileInput,
  ArrowLeftRight,
  BarChart3,
  FlaskConical,
  ShoppingCart,
} from 'lucide-react'

type NavLinkWithPermission = NavLink & {
  permissionCheck?: (ctx: {
    hasPermission: (code: string) => boolean
    hasAnyPermission: (codes: string[]) => boolean
  }) => boolean
}

const allNavLinks: NavLinkWithPermission[] = [
  {
    href: '/almoxarifado/estoque',
    label: 'Estoque',
    icon: Package,
  },
  {
    href: '/almoxarifado/estoque-materiais',
    label: 'Estoque Cliente',
    icon: Boxes,
  },
  {
    href: '/almoxarifado/solicitacoes',
    label: 'Solicitações',
    icon: FileText,
  },
  {
    href: '/almoxarifado/devolucoes',
    label: 'Devoluções',
    icon: RotateCcw,
  },
  {
    href: '/almoxarifado/entrada-materiais',
    label: 'Entrada de Materiais',
    icon: FileInput,
  },
  {
    href: '/almoxarifado/reteste',
    label: 'Reteste',
    icon: FlaskConical,
    permissionCheck: ({ hasPermission }) =>
      hasPermission(PERMISSION_CODES.ALMOXARIFADO.GERENCIAR_RETESTE),
  },
  {
    href: '/almoxarifado/transferencias-emprestimos',
    label: 'Transferências',
    icon: ArrowLeftRight,
  },
  {
    href: '/almoxarifado/saidas-materiais',
    label: 'Saídas de Materiais',
    icon: PackageOpen,
    permissionCheck: ({ hasPermission }) =>
      hasPermission(PERMISSION_CODES.ALMOXARIFADO.VISUALIZAR_TODAS_SAIDAS),
  },
  {
    href: '/almoxarifado/inventarios',
    label: 'Inventários',
    icon: ClipboardList,
  },
  {
    href: '/almoxarifado/pedido-compra',
    label: 'Pedido de Compra',
    icon: ShoppingCart,
    permissionCheck: ({ hasPermission }) =>
      hasPermission(PERMISSION_CODES.ALMOXARIFADO.GERENCIAR_COMPRAS),
  },
  {
    href: '/almoxarifado/movimentacoes',
    label: 'Movimentações',
    icon: ArrowRightLeft,
  },
  {
    href: '/almoxarifado/relatorios',
    label: 'Relatórios',
    icon: BarChart3,
    permissionCheck: ({ hasAnyPermission }) =>
      hasAnyPermission([
        PERMISSION_CODES.ALMOXARIFADO.RELATORIOS_AVANCADOS,
        PERMISSION_CODES.ALMOXARIFADO.RELATORIO_CONSUMO_EPI,
        PERMISSION_CODES.ALMOXARIFADO.RELATORIO_VENCIMENTO_EPI,
      ]),
  },
  {
    href: '/almoxarifado/inventarios/laudos-vencendo',
    label: 'Laudos Vencendo',
    icon: AlertTriangle,
  },
  {
    href: '/almoxarifado/catalogo',
    label: 'Catálogo de Itens',
    icon: BookMarked,
    permissionCheck: ({ hasPermission }) =>
      hasPermission(PERMISSION_CODES.ALMOXARIFADO.GERENCIAR_CATALOGO) ||
      hasPermission(PERMISSION_CODES.ALMOXARIFADO.VISUALIZAR_CATALOGO),
  },
]

export default function AlmoxarifadoLayout({ children }: { children: React.ReactNode }) {
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
    if (pathname === '/almoxarifado' && navLinks.length === 1) {
      router.replace(navLinks[0].href)
    } else if (pathname === '/almoxarifado' && navLinks.length > 1) {
      const hasRoot = navLinks.some(l => l.href === '/almoxarifado' && l.exactMatch)
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
