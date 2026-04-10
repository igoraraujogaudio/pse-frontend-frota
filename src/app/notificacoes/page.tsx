'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useNotification } from '@/contexts/NotificationContext'
import { useNotifications } from '@/hooks/useNotifications'
import { TrashIcon, CheckIcon } from '@heroicons/react/24/outline'
import { useRouter } from 'next/navigation'

export default function NotificacoesPage() {
  const { user } = useAuth()
  const router = useRouter()
  const { notify } = useNotification()
  const { 
    notifications, 
    loading, 
    markAsRead, 
    markAllAsRead, 
    deleteNotification,
    deleteAllNotifications,
    refreshNotifications 
  } = useNotifications()

  const [filter, setFilter] = useState<'all' | 'unread' | 'read'>('all')
  const [selectedNotifications, setSelectedNotifications] = useState<string[]>([])

  // Redirecionar se não estiver logado
  useEffect(() => {
    if (!user) {
      router.push('/login')
    }
  }, [user, router])

  const filteredNotifications = notifications.filter(notification => {
    if (filter === 'unread') return !notification.read
    if (filter === 'read') return notification.read
    return true
  })

  const handleSelectAll = () => {
    if (selectedNotifications.length === filteredNotifications.length) {
      setSelectedNotifications([])
    } else {
      setSelectedNotifications(filteredNotifications.map(n => n.id))
    }
  }

  const handleSelectNotification = (notificationId: string) => {
    setSelectedNotifications(prev => 
      prev.includes(notificationId) 
        ? prev.filter(id => id !== notificationId)
        : [...prev, notificationId]
    )
  }

  const handleMarkSelectedAsRead = async () => {
    for (const notificationId of selectedNotifications) {
      await markAsRead(notificationId)
    }
    setSelectedNotifications([])
  }

  const handleDeleteSelected = async () => {
    if (!confirm('Tem certeza que deseja excluir as notificações selecionadas?')) return
    for (const notificationId of selectedNotifications) {
      await deleteNotification(notificationId)
    }
    setSelectedNotifications([])
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  // const getTypeColor = (type: string) => {
  //   switch (type) {
  //     case 'error':
  //       return 'text-red-600 bg-red-50 border-red-200'
  //     case 'warning':
  //       return 'text-yellow-600 bg-yellow-50 border-yellow-200'
  //     case 'success':
  //       return 'text-green-600 bg-green-50 border-green-200'
  //     default:
  //       return 'text-blue-600 bg-blue-50 border-blue-200'
  //   }
  // }

  if (!user) {
    return null
  }

  return (
    <div className="bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Notificações</h1>
          <p className="mt-2 text-gray-600">
            Gerencie suas notificações e mantenha-se atualizado
          </p>
        </div>

        {/* Filtros e ações */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            {/* Filtros */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700">Filtrar:</label>
                <select
                  value={filter}
                  onChange={(e) => setFilter(e.target.value as 'all' | 'unread' | 'read')}
                  className="text-sm border border-gray-300 rounded-md px-3 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">Todas</option>
                  <option value="unread">Não lidas</option>
                  <option value="read">Lidas</option>
                </select>
              </div>
            </div>

            {/* Ações */}
            <div className="flex items-center gap-2">
              {selectedNotifications.length > 0 && (
                <>
                  <button
                    onClick={handleMarkSelectedAsRead}
                    className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 transition-colors"
                  >
                    <CheckIcon className="h-4 w-4" />
                    Marcar como lidas
                  </button>
                  <button
                    onClick={handleDeleteSelected}
                    className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-red-600 bg-red-50 border border-red-200 rounded-md hover:bg-red-100 transition-colors"
                  >
                    <TrashIcon className="h-4 w-4" />
                    Deletar
                  </button>
                </>
              )}
              <button
                onClick={markAllAsRead}
                className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 bg-gray-50 border border-gray-200 rounded-md hover:bg-gray-100 transition-colors"
              >
                <CheckIcon className="h-4 w-4" />
                Marcar todas como lidas
              </button>
              <button
                onClick={async () => {
                  if (!confirm('Tem certeza que deseja excluir todas as notificações?')) return
                  try {
                    await deleteAllNotifications()
                    notify('Todas as notificações foram excluídas com sucesso', 'success')
                  } catch {
                    notify('Erro ao excluir notificações', 'error')
                  }
                }}
                disabled={notifications.length === 0}
                className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-red-600 bg-red-50 border border-red-200 rounded-md hover:bg-red-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <TrashIcon className="h-4 w-4" />
                Limpar Todas
              </button>
              <button
                onClick={refreshNotifications}
                className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 bg-gray-50 border border-gray-200 rounded-md hover:bg-gray-100 transition-colors"
              >
                Atualizar
              </button>
            </div>
          </div>
        </div>

        {/* Lista de notificações */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          {loading ? (
            <div className="py-12 text-center text-gray-400">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-2">Carregando notificações...</p>
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div className="py-12 text-center text-gray-400">
              <p>Nenhuma notificação encontrada</p>
            </div>
          ) : (
            <>
              {/* Header da lista */}
              <div className="px-6 py-3 border-b border-gray-200 bg-gray-50 rounded-t-lg">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={selectedNotifications.length === filteredNotifications.length && filteredNotifications.length > 0}
                    onChange={handleSelectAll}
                    className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    {filteredNotifications.length} notificação(ões)
                  </span>
                </div>
              </div>

              {/* Notificações */}
              <div className="divide-y divide-gray-200">
                {filteredNotifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`p-6 hover:bg-gray-50 transition-colors ${
                      !notification.read ? 'bg-blue-50' : ''
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      {/* Checkbox */}
                      <input
                        type="checkbox"
                        checked={selectedNotifications.includes(notification.id)}
                        onChange={() => handleSelectNotification(notification.id)}
                        className="mt-1 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />

                      {/* Ícone */}
                      <div className="flex-shrink-0">
                        <span className="text-2xl">{notification.icon}</span>
                      </div>

                      {/* Conteúdo */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h3 className={`text-lg font-semibold ${notification.colorClass}`}>
                                {notification.title}
                              </h3>
                              {!notification.read && (
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                  Nova
                                </span>
                              )}
                            </div>
                            <p className="text-gray-700 mb-3">{notification.message}</p>
                            <p className="text-sm text-gray-500">
                              {formatDate(notification.createdAt)}
                            </p>
                          </div>

                          {/* Ações */}
                          <div className="flex items-center gap-2 ml-4">
                            {!notification.read && (
                              <button
                                onClick={() => markAsRead(notification.id)}
                                className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                              >
                                Marcar como lida
                              </button>
                            )}
                            <button
                              onClick={() => {
                                if (!confirm('Tem certeza que deseja excluir esta notificação?')) return
                                deleteNotification(notification.id)
                              }}
                              className="text-red-600 hover:text-red-800"
                            >
                              <TrashIcon className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
