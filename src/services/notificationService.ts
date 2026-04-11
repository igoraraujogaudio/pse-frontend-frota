import { apiClient } from '@/lib/apiClient'

export interface DatabaseNotification {
  id: string
  usuario_id: string
  titulo: string
  mensagem: string
  tipo: 'info' | 'warning' | 'error' | 'success'
  dados: Record<string, unknown>
  lida: boolean
  criado_em: string
  atualizado_em: string
}

export interface NotificationWithUser extends DatabaseNotification {
  usuario: { id: string; nome: string; email: string }
}

class NotificationService {
  async getUserNotifications(userId: string, limit: number = 50): Promise<DatabaseNotification[]> {
    try {
      return await apiClient.get<DatabaseNotification[]>('/notificacoes', { params: { usuario_id: userId, limit }, silent: true })
    } catch { return [] }
  }

  async markAsRead(notificationId: string): Promise<boolean> {
    try { await apiClient.put(`/notificacoes/${notificationId}/lida`); return true } catch { return false }
  }

  async markAllAsRead(userId: string): Promise<boolean> {
    try { await apiClient.put('/notificacoes/marcar-todas-lidas', { body: { usuario_id: userId } }); return true } catch { return false }
  }

  async deleteNotification(notificationId: string): Promise<boolean> {
    try { await apiClient.delete(`/notificacoes/${notificationId}`); return true } catch { return false }
  }

  async deleteAllNotifications(userId: string): Promise<boolean> {
    try { await apiClient.delete('/notificacoes', { body: { usuario_id: userId } }); return true } catch { return false }
  }

  async getUnreadCount(userId: string): Promise<number> {
    if (!userId) return 0
    try {
      const data = await apiClient.get<{ count: number }>('/notificacoes/nao-lidas', { params: { usuario_id: userId }, silent: true })
      return data.count ?? 0
    } catch { return 0 }
  }

  async getAllNotifications(limit: number = 100): Promise<NotificationWithUser[]> {
    try { return await apiClient.get<NotificationWithUser[]>('/notificacoes/todas', { params: { limit }, silent: true }) } catch { return [] }
  }

  formatNotificationForDisplay(notification: DatabaseNotification) {
    const data = notification.dados as { type?: string; [key: string]: unknown }
    let icon = '📢'
    if (data?.type === 'document_expiration') {
      switch (data.documento) { case 'aso': icon = '🏥'; break; case 'cnh': icon = '🚗'; break; case 'har': icon = '⚠️'; break }
    } else if (data?.type === 'vehicle_document_expiration') {
      const docIcons: Record<string, string> = { acustico: '🔊', eletrico: '⚡', tacografo: '📊', aet: '📋', fumaca: '💨', crlv: '📄', apolice: '🛡️', contrato_seguro: '📝' }
      icon = docIcons[data.documento as string] ?? '🚛'
    } else if (data?.type === 'maintenance_created') { icon = '🔧' }
    else if (data?.type === 'maintenance_ready') { icon = '✅' }

    let colorClass = 'text-blue-600'
    if (notification.tipo === 'error') colorClass = 'text-red-600'
    else if (notification.tipo === 'warning') colorClass = 'text-yellow-600'
    else if (notification.tipo === 'success') colorClass = 'text-green-600'

    return { id: notification.id, title: notification.titulo, message: notification.mensagem, type: notification.tipo, icon, colorClass, read: notification.lida, createdAt: notification.criado_em, data: notification.dados }
  }
}

export const notificationService = new NotificationService()
