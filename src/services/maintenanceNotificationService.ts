import { supabase } from '@/lib/supabase'

export interface MaintenanceNotificationData {
  maintenanceId: string
  vehicleId: string
  vehiclePlate: string
  contractId: string
  contractName: string
  workshopId?: string
  workshopName?: string
  requesterId: string
  requesterName: string
  rejectorName?: string
  rejectionReason?: string
  status: string
  action: 'created' | 'approved' | 'workshop_assigned' | 'ready_for_pickup' | 'picked_up' | 'returned' | 'rejected'
}

export interface MaintenanceNotificationUser {
  id: string
  nome: string
  email: string
}

class MaintenanceNotificationService {
  /**
   * Busca usuários com permissão de aprovação de manutenção no mesmo contrato
   * APENAS por funcionalidade modular (não usa mais nível de acesso)
   */
  async getMaintenanceApprovers(contractId: string): Promise<MaintenanceNotificationUser[]> {
    console.log('🔔 MaintenanceNotificationService - Buscando aprovadores para contrato:', contractId)
    
    try {
      // Buscar APENAS usuários com permissão modular específica
      // NÃO buscar mais por nível de acesso!
      const { data: modularUsers, error: modularError } = await supabase
        .from('usuario_permissoes_modulares')
        .select(`
          usuario_id,
          usuario:usuarios!usuario_permissoes_modulares_usuario_id_fkey(
            id,
            nome,
            email,
            status,
            usuario_contratos!inner(
              contrato_id,
              ativo
            )
          ),
          funcionalidade:funcionalidades_modulares!usuario_permissoes_modulares_funcionalidade_id_fkey(
            codigo
          )
        `)
        .eq('funcionalidade.codigo', 'manutencao.mobile.aprovar_manutencao')
        .eq('ativo', true)
        .eq('concedido', true)
        .eq('usuario.status', 'ativo')
        .eq('usuario.usuario_contratos.contrato_id', contractId)
        .eq('usuario.usuario_contratos.ativo', true)

      if (modularError) {
        console.error('❌ Erro ao buscar aprovadores por funcionalidade:', modularError)
        return []
      }

      if (!modularUsers || modularUsers.length === 0) {
        console.log('⚠️ Nenhum aprovador encontrado para o contrato:', contractId)
        console.log('   Certifique-se de que há usuários com a funcionalidade: manutencao.mobile.aprovar_manutencao')
        return []
      }

      const approvers: MaintenanceNotificationUser[] = []

      for (const modularUser of modularUsers) {
        const user = Array.isArray(modularUser.usuario) ? modularUser.usuario[0] : modularUser.usuario
        if (!user) continue

        approvers.push({
          id: user.id,
          nome: user.nome,
          email: user.email
        })
      }

      console.log('✅ Aprovadores encontrados (por funcionalidade):', approvers.length)
      return approvers
    } catch (error) {
      console.error('❌ Erro geral ao buscar aprovadores:', error)
      return []
    }
  }

  /**
   * Busca informações do solicitante da manutenção
   */
  async getMaintenanceRequester(requesterId: string): Promise<MaintenanceNotificationUser | null> {
    const { data, error } = await supabase
      .from('usuarios')
      .select('id, nome, email')
      .eq('id', requesterId)
      .eq('status', 'ativo')
      .single()

    if (error) {
      console.error('❌ Erro ao buscar solicitante:', error)
      return null
    }

    return {
      id: data.id,
      nome: data.nome,
      email: data.email
    }
  }

  /**
   * Notifica aprovadores quando uma manutenção é criada por usuário sem permissão de aprovação
   */
  async notifyApproversOnCreation(notificationData: MaintenanceNotificationData): Promise<void> {
    console.log('🔔 Notificando aprovadores sobre nova manutenção:', notificationData.maintenanceId)
    
    const approvers = await this.getMaintenanceApprovers(notificationData.contractId)
    
    if (approvers.length === 0) {
      console.log('⚠️ Nenhum aprovador encontrado para o contrato:', notificationData.contractId)
      return
    }

    const message = `Nova manutenção solicitada para ${notificationData.vehiclePlate} por ${notificationData.requesterName}. Aguardando aprovação.`
    
    // Criar notificações para cada aprovador
    for (const approver of approvers) {
      await this.createNotification({
        userId: approver.id,
        title: 'Nova Manutenção Pendente',
        message,
        type: 'warning',
        data: {
          type: 'maintenance_created',
          maintenanceId: notificationData.maintenanceId,
          vehicleId: notificationData.vehicleId,
          contractId: notificationData.contractId,
          requesterId: notificationData.requesterId,
          action: 'created'
        }
      })
    }

    console.log('✅ Notificações enviadas para', approvers.length, 'aprovadores')
  }

  /**
   * Notifica o solicitante quando a oficina é definida
   */
  async notifyRequesterOnWorkshopAssignment(notificationData: MaintenanceNotificationData): Promise<void> {
    console.log('🔔 Notificando solicitante sobre oficina definida:', notificationData.maintenanceId)
    
    const requester = await this.getMaintenanceRequester(notificationData.requesterId)
    
    if (!requester) {
      console.log('⚠️ Solicitante não encontrado:', notificationData.requesterId)
      return
    }

    const message = `Manutenção do veículo ${notificationData.vehiclePlate} foi aprovada e oficina ${notificationData.workshopName} foi definida.`
    
    await this.createNotification({
      userId: requester.id,
      title: 'Oficina Definida',
      message,
      type: 'info',
      data: {
        type: 'maintenance_workshop_assigned',
        maintenanceId: notificationData.maintenanceId,
        vehicleId: notificationData.vehicleId,
        workshopId: notificationData.workshopId,
        action: 'workshop_assigned'
      }
    })

    console.log('✅ Notificação enviada para solicitante')
  }

  /**
   * Notifica o solicitante quando a manutenção está pronta para busca
   */
  async notifyRequesterOnReadyForPickup(notificationData: MaintenanceNotificationData): Promise<void> {
    console.log('🔔 Notificando solicitante sobre manutenção pronta:', notificationData.maintenanceId)
    
    const requester = await this.getMaintenanceRequester(notificationData.requesterId)
    
    if (!requester) {
      console.log('⚠️ Solicitante não encontrado:', notificationData.requesterId)
      return
    }

    const message = `Manutenção do veículo ${notificationData.vehiclePlate} está pronta para retirada na oficina ${notificationData.workshopName}.`
    
    await this.createNotification({
      userId: requester.id,
      title: 'Manutenção Pronta',
      message,
      type: 'success',
      data: {
        type: 'maintenance_ready',
        maintenanceId: notificationData.maintenanceId,
        vehicleId: notificationData.vehicleId,
        workshopId: notificationData.workshopId,
        action: 'ready_for_pickup'
      }
    })

    console.log('✅ Notificação enviada para solicitante')
  }

  /**
   * Notifica TODOS os aprovadores quando o veículo sai da oficina
   */
  async notifyApproversOnPickup(notificationData: MaintenanceNotificationData): Promise<void> {
    console.log('🔔 Notificando aprovadores sobre retirada:', notificationData.maintenanceId)
    
    const approvers = await this.getMaintenanceApprovers(notificationData.contractId)
    
    if (approvers.length === 0) {
      console.log('⚠️ Nenhum aprovador encontrado para o contrato:', notificationData.contractId)
      return
    }

    const message = `Veículo ${notificationData.vehiclePlate} foi retirado da oficina ${notificationData.workshopName} por ${notificationData.requesterName}.`
    
    // Criar notificações para cada aprovador
    for (const approver of approvers) {
      await this.createNotification({
        userId: approver.id,
        title: 'Veículo Retirado da Oficina',
        message,
        type: 'info',
        data: {
          type: 'maintenance_picked_up',
          maintenanceId: notificationData.maintenanceId,
          vehicleId: notificationData.vehicleId,
          contractId: notificationData.contractId,
          requesterId: notificationData.requesterId,
          action: 'picked_up'
        }
      })
    }

    console.log('✅ Notificações enviadas para', approvers.length, 'aprovadores sobre retirada')
  }

  /**
   * Notifica o solicitante quando o veículo retorna à operação
   */
  async notifyRequesterOnReturn(notificationData: MaintenanceNotificationData): Promise<void> {
    console.log('🔔 Notificando solicitante sobre retorno:', notificationData.maintenanceId)
    
    const requester = await this.getMaintenanceRequester(notificationData.requesterId)
    
    if (!requester) {
      console.log('⚠️ Solicitante não encontrado:', notificationData.requesterId)
      return
    }

    const message = `Veículo ${notificationData.vehiclePlate} retornou à operação após manutenção.`
    
    await this.createNotification({
      userId: requester.id,
      title: 'Veículo Retornou',
      message,
      type: 'success',
      data: {
        type: 'maintenance_returned',
        maintenanceId: notificationData.maintenanceId,
        vehicleId: notificationData.vehicleId,
        action: 'returned'
      }
    })

    console.log('✅ Notificação enviada para solicitante')
  }

  /**
   * Notifica o solicitante quando a manutenção é rejeitada
   */
  async notifyRequesterOnRejection(notificationData: MaintenanceNotificationData): Promise<void> {
    console.log('🔔 Notificando solicitante sobre rejeição:', notificationData.maintenanceId)
    
    const requester = await this.getMaintenanceRequester(notificationData.requesterId)
    
    if (!requester) {
      console.log('⚠️ Solicitante não encontrado:', notificationData.requesterId)
      return
    }

    const rejectorName = notificationData.rejectorName || 'Gestor'
    const reason = notificationData.rejectionReason || 'Não informado'
    const message = `Solicitação de manutenção para ${notificationData.vehiclePlate} foi rejeitada por ${rejectorName}. Motivo: ${reason}`
    
    await this.createNotification({
      userId: requester.id,
      title: 'Manutenção Rejeitada',
      message,
      type: 'error',
      data: {
        type: 'maintenance_rejected',
        maintenanceId: notificationData.maintenanceId,
        vehicleId: notificationData.vehicleId,
        rejectionReason: reason,
        action: 'rejected'
      }
    })

    console.log('✅ Notificação de rejeição enviada para solicitante')
  }

  /**
   * Cria notificação no banco de dados
   */
  private async createNotification(notification: {
    userId: string
    title: string
    message: string
    type: 'info' | 'warning' | 'error' | 'success'
    data: Record<string, unknown>
  }): Promise<void> {
    try {
      const { error } = await supabase
        .from('notificacoes')
        .insert([{
          usuario_id: notification.userId,
          titulo: notification.title,
          mensagem: notification.message,
          tipo: notification.type,
          dados: notification.data,
          lida: false,
          criado_em: new Date().toISOString()
        }])

      if (error) {
        console.error('❌ Erro ao criar notificação:', error)
      } else {
        console.log('✅ Notificação criada no banco')
      }
    } catch (error) {
      console.error('❌ Erro ao criar notificação:', error)
    }
  }

  /**
   * Método principal para processar notificações baseado na ação da manutenção
   */
  async processMaintenanceNotification(
    maintenanceId: string,
    action: 'created' | 'approved' | 'workshop_assigned' | 'ready_for_pickup' | 'picked_up' | 'returned' | 'rejected'
  ): Promise<void> {
    try {
      // Buscar dados da manutenção
      const { data: maintenance, error } = await supabase
        .from('maintenances')
        .select(`
          *,
          veiculo:veiculos(id, placa, contrato:contratos(id, nome)),
          oficina:oficinas(id, nome),
          solicitante:usuarios(id, nome),
          rejeitador:usuarios!maintenances_rejeitador_id_fkey(id, nome)
        `)
        .eq('id', maintenanceId)
        .single()

      if (error || !maintenance) {
        console.error('❌ Erro ao buscar manutenção:', error)
        return
      }

      const notificationData: MaintenanceNotificationData = {
        maintenanceId: maintenance.id,
        vehicleId: maintenance.veiculo_id,
        vehiclePlate: maintenance.veiculo.placa,
        contractId: maintenance.veiculo.contrato.id,
        contractName: maintenance.veiculo.contrato.nome,
        workshopId: maintenance.oficina_id,
        workshopName: maintenance.oficina?.nome,
        requesterId: maintenance.solicitante_id,
        requesterName: maintenance.solicitante?.nome || 'Usuário',
        rejectorName: maintenance.rejeitador?.nome,
        rejectionReason: maintenance.motivo_rejeicao,
        status: maintenance.status,
        action
      }

      // Processar notificação baseada na ação
      switch (action) {
        case 'created':
          await this.notifyApproversOnCreation(notificationData)
          break
        case 'workshop_assigned':
          await this.notifyRequesterOnWorkshopAssignment(notificationData)
          break
        case 'ready_for_pickup':
          await this.notifyRequesterOnReadyForPickup(notificationData)
          break
        case 'picked_up':
          await this.notifyApproversOnPickup(notificationData)
          break
        case 'returned':
          await this.notifyRequesterOnReturn(notificationData)
          break
        case 'rejected':
          await this.notifyRequesterOnRejection(notificationData)
          break
        default:
          console.log('⚠️ Ação de notificação não implementada:', action)
      }

    } catch (error) {
      console.error('❌ Erro ao processar notificação de manutenção:', error)
    }
  }
}

export const maintenanceNotificationService = new MaintenanceNotificationService()


