'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { ChevronLeft, ChevronRight, X, Menu } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { type NavLink, isLinkActive } from '@/types/navigation'
import { UserPopover } from '@/components/navigation/UserPopover'
import NotificationDropdown from '@/components/NotificationDropdown'

interface SidebarProps {
  navLinks: NavLink[]
}

export function Sidebar({ navLinks }: SidebarProps) {
  const pathname = usePathname()
  const [expanded, setExpanded] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const sidebarRef = useRef<HTMLElement>(null)

  // Close expanded sidebar when clicking outside (desktop only)
  useEffect(() => {
    if (!expanded) return

    function handleClickOutside(e: MouseEvent) {
      if (sidebarRef.current && !sidebarRef.current.contains(e.target as Node)) {
        setExpanded(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [expanded])

  return (
    <>
      {/* Hamburger button — mobile only */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed top-3 left-2 z-40 md:hidden rounded-md border bg-white p-1.5 shadow-sm"
        aria-label="Abrir menu"
      >
        <Menu className="h-5 w-5 text-gray-600" />
      </button>

      {/* Dark overlay — mobile only */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-20 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        ref={sidebarRef}
        className={cn(
          'fixed top-2 left-2 bottom-2 rounded-xl border bg-white shadow-sm z-30 flex flex-col transition-all duration-200',
          // Desktop: always visible, toggle width
          expanded ? 'md:w-56' : 'md:w-16',
          // Mobile: hidden by default, slide in when open
          mobileOpen
            ? 'max-md:translate-x-0 w-56'
            : 'max-md:translate-x-[calc(-100%-1rem)]'
        )}
      >
        {/* Expand/Collapse toggle — desktop only, on the right edge */}
        <button
          onClick={() => setExpanded(prev => !prev)}
          className="hidden md:flex absolute -right-3 top-5 z-40 h-6 w-6 items-center justify-center rounded-full border bg-white shadow-sm hover:bg-gray-50 transition-colors"
          aria-label={expanded ? 'Colapsar menu' : 'Expandir menu'}
        >
          {expanded ? (
            <ChevronLeft className="h-3.5 w-3.5 text-gray-500" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-gray-500" />
          )}
        </button>

        {/* Top section: Logo */}
        <div className={cn(
          'flex items-center border-b px-2 py-2 gap-1 overflow-hidden',
          !(expanded || mobileOpen) && 'justify-center'
        )}>
          <Link
            href="/"
            className={cn(
              'flex items-center rounded-md transition-colors hover:bg-gray-50 shrink-0',
              (expanded || mobileOpen) ? 'px-2 py-1' : 'justify-center p-1.5'
            )}
          >
            {(expanded || mobileOpen) ? (
              <Image src="/logo_pse.png" alt="Logo PSE" height={24} width={78} className="h-6 w-auto" priority />
            ) : (
              <Image src="/logo_pse.png" alt="Logo PSE" height={24} width={36} className="h-6 max-w-[2.5rem] object-contain" priority />
            )}
          </Link>

          {(expanded || mobileOpen) && <span className="flex-1" />}

          {/* Close button — mobile only */}
          {mobileOpen && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 md:hidden shrink-0"
              onClick={() => setMobileOpen(false)}
              aria-label="Fechar menu"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Notifications — right below the top section */}
        <div className={cn(
          'px-1.5 py-1.5 border-b',
          !(expanded || mobileOpen) && 'flex justify-center'
        )}>
          <NotificationDropdown collapsed={!expanded && !mobileOpen} />
        </div>

        {/* Nav section: Links */}
        <nav className="flex-1 overflow-y-auto px-1.5 py-1.5 space-y-0.5" style={{ scrollbarWidth: 'thin', scrollbarColor: '#d1d5db transparent' }}>
          {navLinks.map(link => {
            const active = isLinkActive(pathname, link.href, link.exactMatch)
            const Icon = link.icon

            if (expanded || mobileOpen) {
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    'flex items-center gap-2 rounded-md px-2.5 py-1.5 text-[13px] font-medium transition-colors',
                    active
                      ? 'bg-gray-100 text-gray-900'
                      : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {link.label}
                </Link>
              )
            }

            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'flex items-center justify-center rounded-md p-2 transition-colors w-full',
                  active
                    ? 'bg-gray-100 text-gray-900'
                    : 'text-gray-400 hover:bg-gray-50 hover:text-gray-700'
                )}
                title={link.label}
              >
                <Icon className="h-5 w-5" />
              </Link>
            )
          })}
        </nav>

        {/* Footer section: UserPopover */}
        <div className={cn(
          'border-t px-1.5 py-1.5 space-y-0.5',
          !(expanded || mobileOpen) && 'flex justify-center'
        )}>
          <UserPopover collapsed={!expanded && !mobileOpen} />
        </div>
      </aside>
    </>
  )
}
