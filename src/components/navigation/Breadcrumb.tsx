'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronRight } from 'lucide-react'
import type { NavLink } from '@/types/navigation'
import { generateBreadcrumbs } from '@/utils/breadcrumb'

interface BreadcrumbProps {
  navLinks: NavLink[]
}

export function Breadcrumb({ navLinks }: BreadcrumbProps) {
  const pathname = usePathname()
  const crumbs = generateBreadcrumbs(pathname, navLinks)

  if (crumbs.length <= 1) return null

  return (
    <nav aria-label="Breadcrumb" className="mb-4 flex items-center gap-1 text-sm text-gray-500">
      {crumbs.map((crumb, index) => (
        <span key={crumb.href} className="flex items-center gap-1">
          {index > 0 && <ChevronRight className="h-3.5 w-3.5 text-gray-400" />}
          {crumb.isLast ? (
            <span className="font-medium text-gray-700">{crumb.label}</span>
          ) : (
            <Link
              href={crumb.href}
              className="hover:text-gray-700 transition-colors"
            >
              {crumb.label}
            </Link>
          )}
        </span>
      ))}
    </nav>
  )
}
