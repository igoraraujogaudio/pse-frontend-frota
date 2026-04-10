import type { NavLink } from '@/types/navigation'

export interface BreadcrumbItem {
  label: string
  href: string
  isLast: boolean
}

export function generateBreadcrumbs(pathname: string, navLinks: NavLink[]): BreadcrumbItem[] {
  const segments = pathname.split('/').filter(Boolean)

  if (segments.length === 0) {
    return [{ label: 'Início', href: '/', isLast: true }]
  }

  const items: BreadcrumbItem[] = [{ label: 'Início', href: '/', isLast: false }]

  let currentPath = ''
  segments.forEach((segment, index) => {
    currentPath += '/' + segment
    const navLink = navLinks.find(nl => nl.href === currentPath)
    const label = navLink?.label ?? segment.replace(/-/g, ' ').replace(/^\w/, c => c.toUpperCase())
    items.push({
      label,
      href: currentPath,
      isLast: index === segments.length - 1,
    })
  })

  return items
}
