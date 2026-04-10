import type { LucideIcon } from 'lucide-react'

export interface NavLink {
  href: string
  label: string
  icon: LucideIcon
  exactMatch?: boolean
}

export function isLinkActive(pathname: string, href: string, exactMatch?: boolean): boolean {
  if (exactMatch) return pathname === href
  return pathname === href || pathname.startsWith(href + '/')
}
