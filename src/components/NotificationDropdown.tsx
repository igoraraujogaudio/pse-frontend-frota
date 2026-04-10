'use client'

import { useState, useRef, useEffect } from 'react'
import { BellIcon, TrashIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { useNotifications } from '@/hooks/useNotifications'

import { cn } from '@/lib/utils'

interface NotificationDropdownProps {
  className?: string
  collapsed?: boolean
}

export default function NotificationDropdown({ className = '', collapsed = false }: NotificationDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const { 
    notifications, 
    unreadCount, 
    loading, 
    markAsRead, 
    markAllAsRead, 
    deleteAllNotifications,
    deleteNotification 
  } = useNotifications()

  // Fechar dropdown quando clicar fora
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleNotificationClick = async (notification: { id: string; read: boolean; dados: unknown }) => {
    if (!notification.read) {
      await markAsRead(notification.id)
    }
    
    // Aqui você pode adicionar lógica para navegar para a página relevante
    // baseada no tipo de notificação
    const data = notification.dados as { type?: string; [key: string]: unknown }
    
    if (data?.type === 'document_expiration') {
      // Navegar para a página do funcionário
      window.location.href = `/funcionarios/${data.funcionarioId}`
    } else if (data?.type === 'maintenance_created' || data?.type === 'maintenance_ready') {
      // Navegar para a página de manutenções
      window.location.href = `/frota/manutencoes`
    }
  }

  const handleMarkAllAsRead = async () => {
    await markAllAsRead()
  }

  const handleDeleteAllNotifications = async () => {
    if (confirm('Tem certeza que deseja excluir todas as notificações?')) {
      await deleteAllNotifications()
    }
  }

  const handleDeleteNotification = async (e: React.MouseEvent, notificationId: string) => {
    e.stopPropagation()
    if (!confirm('Tem certeza que deseja excluir esta notificação?')) return
    await deleteNotification(notificationId)
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60))
    
    if (diffInHours < 1) {
      return 'Agora mesmo'
    } else if (diffInHours < 24) {
      return `${diffInHours}h atrás`
    } else {
      const diffInDays = Math.floor(diffInHours / 24)
      return `${diffInDays}d atrás`
    }
  }

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {/* Botão do sino */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'relative transition-colors',
          collapsed
            ? 'flex items-center justify-center rounded-md p-2 text-gray-400 hover:bg-gray-50 hover:text-gray-700'
            : 'flex items-center gap-2 rounded-md px-2.5 py-1.5 text-[13px] font-medium text-gray-500 hover:bg-gray-50 hover:text-gray-700 w-full'
        )}
      >
        <BellIcon className={collapsed ? 'h-5 w-5' : 'h-4 w-4 shrink-0'} />
        {!collapsed && <span>Notificações</span>}
        {unreadCount > 0 && (
          <span className={cn(
            'bg-red-500 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center',
            collapsed ? 'absolute -top-0.5 -right-0.5' : 'ml-auto'
          )}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute left-full top-0 ml-2 w-80 max-w-xs rounded-xl bg-white shadow-lg ring-1 ring-black/5 z-50">
          {/* Header */}
          <div className="py-2 px-4 border-b border-gray-100 rounded-t-xl">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-800">Notificações</h3>
              <div className="flex items-center gap-2">
                {notifications.length > 0 && (
                  <button
                    onClick={handleDeleteAllNotifications}
                    className="text-xs text-red-600 hover:text-red-800 font-medium"
                  >
                    Limpar Todas
                  </button>
                )}
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllAsRead}
                    className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                  >
                    Marcar todas como lidas
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XMarkIcon className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Lista de notificações */}
          <div className="max-h-80 overflow-y-auto">
            {loading ? (
              <div className="py-6 text-center text-gray-400 text-sm">
                Carregando...
              </div>
            ) : notifications.length === 0 ? (
              <div className="py-6 text-center text-gray-400 text-sm">
                Sem notificações
              </div>
            ) : (
              <ul className="divide-y divide-gray-100">
                {notifications.map((notification) => (
                  <li
                    key={notification.id}
                    className={`flex items-start gap-3 px-4 py-3 text-sm cursor-pointer hover:bg-gray-50 transition-colors ${
                      !notification.read ? 'bg-blue-50' : ''
                    }`}
                    onClick={() => handleNotificationClick({ ...notification, dados: (notification as unknown as Record<string, unknown>).dados || {} })}
                  >
                    {/* Ícone */}
                    <div className="flex-shrink-0 mt-0.5">
                      <span className="text-lg">{notification.icon}</span>
                    </div>

                    {/* Conteúdo */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className={`font-medium ${notification.colorClass}`}>
                            {notification.title}
                          </p>
                          <p className="text-gray-600 mt-1 line-clamp-2">
                            {notification.message}
                          </p>
                          <p className="text-xs text-gray-400 mt-1">
                            {formatDate(notification.createdAt)}
                          </p>
                        </div>
                        
                        {/* Botão de deletar */}
                        <button
                          onClick={(e) => handleDeleteNotification(e, notification.id)}
                          className="flex-shrink-0 ml-2 text-gray-400 hover:text-red-500 transition-colors"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    {/* Indicador de não lida */}
                    {!notification.read && (
                      <div className="flex-shrink-0 mt-1">
                        <div className="h-2 w-2 bg-blue-500 rounded-full"></div>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="py-2 px-4 border-t border-gray-100 rounded-b-xl">
              <button
                onClick={() => window.location.href = '/notificacoes'}
                className="text-xs text-blue-600 hover:text-blue-800 font-medium w-full text-center"
              >
                Ver todas as notificações
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
