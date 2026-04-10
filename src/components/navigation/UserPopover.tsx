'use client'

import { useState, useRef, useEffect } from 'react'
import { LogOut, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'

interface UserPopoverProps {
  collapsed: boolean
}

/**
 * Extracts initials from a user name.
 * - "João Silva" → "JS"
 * - "Maria" → "M"
 * - "" or undefined → "?"
 */
export function getInitials(name: string | undefined | null): string {
  if (!name || !name.trim()) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0][0].toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function UserPopover({ collapsed }: UserPopoverProps) {
  const { user, signOut } = useAuth()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (open && ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  if (!user) return null

  const initials = getInitials(user.nome)

  const handleSignOut = async () => {
    setOpen(false)
    try {
      await signOut()
    } catch {
      // signOut already handles redirect
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(prev => !prev)}
        className={cn(
          'flex items-center gap-2 rounded-md w-full transition-colors',
          collapsed
            ? 'justify-center p-2 hover:bg-gray-50'
            : 'px-2.5 py-1.5 hover:bg-gray-50'
        )}
        aria-label="Menu do usuário"
      >
        {/* Avatar with initials */}
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-200 text-xs font-semibold text-gray-700">
          {initials}
        </span>

        {!collapsed && (
          <>
            <span className="flex-1 truncate text-left text-[13px] font-medium text-gray-700">
              {user.nome}
            </span>
            <ChevronUp
              className={cn(
                'h-3.5 w-3.5 shrink-0 text-gray-400 transition-transform',
                open && 'rotate-180'
              )}
            />
          </>
        )}
      </button>

      {/* Popover dropdown */}
      {open && (
        <div className="absolute bottom-full left-0 mb-1 w-48 rounded-lg border bg-white shadow-lg z-50">
          <div className="py-1">
            <button
              onClick={handleSignOut}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-red-600 transition-colors"
            >
              <LogOut className="h-4 w-4" />
              Sair
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
