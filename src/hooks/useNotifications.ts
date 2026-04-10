import { useState, useEffect, useCallback } from 'react'
import { notificationService } from '@/services/notificationService'
import { useAuth } from '@/contexts/AuthContext'

export interface FormattedNotification {
  id: string
  title: string
  message: string
  type: 'info' | 'warning' | 'error' | 'success'
  icon: string
  colorClass: string
  read: boolean
  createdAt: string
  data: Record<string, unknown>
}

export function useNotifications() {
  const { user } = useAuth()
  const [notifications, setNotifications] = useState<FormattedNotification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Carregar notificações
  const loadNotifications = useCallback(async () => {
    if (!user?.id) {
      setNotifications([])
      setUnreadCount(0)
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)
      
      // Usar Promise.allSettled para não falhar completamente se uma das chamadas falhar
      const [notificationsResult, unreadCountResult] = await Promise.allSettled([
        notificationService.getUserNotifications(user.id, 50),
        notificationService.getUnreadCount(user.id)
      ])

      // Processar resultado das notificações
      if (notificationsResult.status === 'fulfilled') {
        const formattedNotifications = notificationsResult.value.map(notification => 
          notificationService.formatNotificationForDisplay(notification)
        )
        setNotifications(formattedNotifications)
      } else {
        console.error('❌ Erro ao carregar notificações:', notificationsResult.reason)
        setNotifications([])
      }

      // Processar resultado do contador
      if (unreadCountResult.status === 'fulfilled') {
        setUnreadCount(unreadCountResult.value)
      } else {
        console.error('❌ Erro ao contar notificações não lidas:', unreadCountResult.reason)
        setUnreadCount(0)
      }
    } catch (err) {
      const errorMessage = err instanceof Error 
        ? err.message 
        : typeof err === 'object' && err !== null
        ? JSON.stringify(err, null, 2)
        : String(err)
      
      console.error('❌ Erro ao carregar notificações (catch):', errorMessage)
      setError('Erro ao carregar notificações')
      setNotifications([])
      setUnreadCount(0)
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  // Marcar notificação como lida
  const markAsRead = useCallback(async (notificationId: string) => {
    try {
      const success = await notificationService.markAsRead(notificationId)
      
      if (success) {
        setNotifications(prev => 
          prev.map(notification => 
            notification.id === notificationId 
              ? { ...notification, read: true }
              : notification
          )
        )
        setUnreadCount(prev => Math.max(0, prev - 1))
      }
    } catch (err) {
      console.error('❌ Erro ao marcar notificação como lida:', err)
    }
  }, [])

  // Marcar todas como lidas
  const markAllAsRead = useCallback(async () => {
    if (!user?.id) return

    try {
      const success = await notificationService.markAllAsRead(user.id)
      
      if (success) {
        setNotifications(prev => 
          prev.map(notification => ({ ...notification, read: true }))
        )
        setUnreadCount(0)
      }
    } catch (err) {
      console.error('❌ Erro ao marcar todas as notificações como lidas:', err)
    }
  }, [user?.id])

  // Deletar todas as notificações
  const deleteAllNotifications = useCallback(async () => {
    if (!user?.id) return

    try {
      const success = await notificationService.deleteAllNotifications(user.id)

      if (success) {
        setNotifications([])
        setUnreadCount(0)
      }
    } catch (err) {
      console.error('❌ Erro ao deletar todas as notificações:', err)
    }
  }, [user?.id])


  // Deletar notificação
  const deleteNotification = useCallback(async (notificationId: string) => {
    try {
      const success = await notificationService.deleteNotification(notificationId)
      
      if (success) {
        setNotifications(prev => {
          const notification = prev.find(n => n.id === notificationId)
          const newNotifications = prev.filter(n => n.id !== notificationId)
          
          // Se a notificação deletada não estava lida, decrementar contador
          if (notification && !notification.read) {
            setUnreadCount(prev => Math.max(0, prev - 1))
          }
          
          return newNotifications
        })
      }
    } catch (err) {
      console.error('❌ Erro ao deletar notificação:', err)
    }
  }, [])

  // Atualizar notificações
  const refreshNotifications = useCallback(() => {
    loadNotifications()
  }, [loadNotifications])

  // Carregar notificações quando o usuário mudar
  useEffect(() => {
    loadNotifications()
  }, [loadNotifications])

  // Atualizar notificações a cada 30 segundos
  useEffect(() => {
    if (!user?.id) return

    const interval = setInterval(() => {
      loadNotifications()
    }, 30000) // 30 segundos

    return () => clearInterval(interval)
  }, [loadNotifications, user?.id])

  return {
    notifications,
    unreadCount,
    loading,
    error,
    markAsRead,
    markAllAsRead,
    deleteAllNotifications,
    deleteNotification,
    refreshNotifications
  }
}
