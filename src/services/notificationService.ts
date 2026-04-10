import { supabase } from '@/lib/supabase'

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
  usuario: {
    id: string
    nome: string
    email: string
  }
}

class NotificationService {
  /**
   * Busca notificações do usuário logado
   */
  async getUserNotifications(userId: string, limit: number = 50): Promise<DatabaseNotification[]> {
    try {
      console.log('🔔 NotificationService - Buscando notificações para usuário:', userId);
      
      const { data, error } = await supabase
        .from('notificacoes')
        .select('*')
        .eq('usuario_id', userId)
        .order('criado_em', { ascending: false })
        .limit(limit)

      if (error) {
        console.error('❌ Erro ao buscar notificações:', error)
        return []
      }

      console.log('🔔 NotificationService - Notificações encontradas:', data?.length || 0);
      return data || []
    } catch (error) {
      console.error('❌ Erro ao buscar notificações:', error)
      return []
    }
  }

  /**
   * Marca notificação como lida
   */
  async markAsRead(notificationId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('notificacoes')
        .update({ 
          lida: true,
          atualizado_em: new Date().toISOString()
        })
        .eq('id', notificationId)

      if (error) {
        console.error('❌ Erro ao marcar notificação como lida:', error)
        return false
      }

      return true
    } catch (error) {
      console.error('❌ Erro ao marcar notificação como lida:', error)
      return false
    }
  }

  /**
   * Marca todas as notificações do usuário como lidas
   */
  async markAllAsRead(userId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('notificacoes')
        .update({ 
          lida: true,
          atualizado_em: new Date().toISOString()
        })
        .eq('usuario_id', userId)
        .eq('lida', false)

      if (error) {
        console.error('❌ Erro ao marcar todas as notificações como lidas:', error)
        return false
      }

      return true
    } catch (error) {
      console.error('❌ Erro ao marcar todas as notificações como lidas:', error)
      return false
    }
  }

  /**
   * Deleta notificação
   */
  async deleteNotification(notificationId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('notificacoes')
        .delete()
        .eq('id', notificationId)

      if (error) {
        console.error('❌ Erro ao deletar notificação:', error)
        return false
      }

      return true
    } catch (error) {
      console.error('❌ Erro ao deletar notificação:', error)
      return false
    }
  }

  /**
   * Deleta todas as notificações do usuário
   */
  async deleteAllNotifications(userId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('notificacoes')
        .delete()
        .eq('usuario_id', userId)

      if (error) {
        console.error('❌ Erro ao deletar todas as notificações:', error)
        return false
      }

      return true
    } catch (error) {
      console.error('❌ Erro ao deletar todas as notificações:', error)
      return false
    }
  }


  /**
   * Conta notificações não lidas do usuário
   */
  async getUnreadCount(userId: string): Promise<number> {
    try {
      // Validar userId
      if (!userId || typeof userId !== 'string') {
        console.warn('⚠️ getUnreadCount: userId inválido:', userId)
        return 0
      }

      const { count, error } = await supabase
        .from('notificacoes')
        .select('*', { count: 'exact', head: true })
        .eq('usuario_id', userId)
        .eq('lida', false)

      if (error) {
        // Serializar erro para melhor visualização
        const errorInfo = {
          message: error.message || 'Erro desconhecido',
          details: error.details || 'Sem detalhes',
          hint: error.hint || 'Sem hint',
          code: error.code || 'Sem código'
        }
        console.error('❌ Erro ao contar notificações não lidas:', JSON.stringify(errorInfo, null, 2))
        return 0
      }

      return count || 0
    } catch (error) {
      // Tratar erros de forma mais informativa
      const errorMessage = error instanceof Error 
        ? error.message 
        : typeof error === 'object' && error !== null
        ? JSON.stringify(error, null, 2)
        : String(error)
      
      console.error('❌ Erro ao contar notificações não lidas (catch):', errorMessage)
      return 0
    }
  }

  /**
   * Busca notificações com informações do usuário (para admin)
   */
  async getAllNotifications(limit: number = 100): Promise<NotificationWithUser[]> {
    try {
      const { data, error } = await supabase
        .from('notificacoes')
        .select(`
          *,
          usuario:usuarios(id, nome, email)
        `)
        .order('criado_em', { ascending: false })
        .limit(limit)

      if (error) {
        console.error('❌ Erro ao buscar todas as notificações:', error)
        return []
      }

      return data || []
    } catch (error) {
      console.error('❌ Erro ao buscar todas as notificações:', error)
      return []
    }
  }

  /**
   * Formata notificação para exibição no frontend
   */
  formatNotificationForDisplay(notification: DatabaseNotification) {
    const data = notification.dados as { type?: string; [key: string]: unknown }
    
    // Determinar ícone baseado no tipo
    let icon = '📢'
    if (data?.type === 'document_expiration') {
      switch (data.documento) {
        case 'aso':
          icon = '🏥'
          break
        case 'cnh':
          icon = '🚗'
          break
        case 'har':
          icon = '⚠️'
          break
      }
    } else if (data?.type === 'vehicle_document_expiration') {
      switch (data.documento) {
        case 'acustico':
          icon = '🔊'
          break
        case 'eletrico':
          icon = '⚡'
          break
        case 'tacografo':
          icon = '📊'
          break
        case 'aet':
          icon = '📋'
          break
        case 'fumaca':
          icon = '💨'
          break
        case 'crlv':
          icon = '📄'
          break
        case 'apolice':
          icon = '🛡️'
          break
        case 'contrato_seguro':
          icon = '📝'
          break
        default:
          icon = '🚛'
          break
      }
    } else if (data?.type === 'maintenance_created') {
      icon = '🔧'
    } else if (data?.type === 'maintenance_ready') {
      icon = '✅'
    }

    // Determinar cor baseada no tipo
    let colorClass = 'text-blue-600'
    if (notification.tipo === 'error') {
      colorClass = 'text-red-600'
    } else if (notification.tipo === 'warning') {
      colorClass = 'text-yellow-600'
    } else if (notification.tipo === 'success') {
      colorClass = 'text-green-600'
    }

    return {
      id: notification.id,
      title: notification.titulo,
      message: notification.mensagem,
      type: notification.tipo,
      icon,
      colorClass,
      read: notification.lida,
      createdAt: notification.criado_em,
      data: notification.dados
    }
  }
}

export const notificationService = new NotificationService()
