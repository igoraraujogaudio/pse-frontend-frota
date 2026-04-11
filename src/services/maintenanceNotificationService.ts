import { apiClient } from '@/lib/apiClient'

export interface MaintenanceNotificationData {
  maintenanceId: string; vehicleId: string; vehiclePlate: string; contractId: string; contractName: string
  workshopId?: string; workshopName?: string; requesterId: string; requesterName: string
  rejectorName?: string; rejectionReason?: string; status: string
  action: 'created' | 'approved' | 'workshop_assigned' | 'ready_for_pickup' | 'picked_up' | 'returned' | 'rejected'
}

export interface MaintenanceNotificationUser { id: string; nome: string; email: string }

class MaintenanceNotificationService {
  async getMaintenanceApprovers(contractId: string): Promise<MaintenanceNotificationUser[]> {
    try { return await apiClient.get<MaintenanceNotificationUser[]>('/manutencoes/aprovadores', { params: { contrato_id: contractId }, silent: true }) } catch { return [] }
  }

  async getMaintenanceRequester(requesterId: string): Promise<MaintenanceNotificationUser | null> {
    try { return await apiClient.get<MaintenanceNotificationUser>(`/usuarios/${requesterId}`, { silent: true }) } catch { return null }
  }

  private async createNotification(n: { userId: string; title: string; message: string; type: 'info' | 'warning' | 'error' | 'success'; data: Record<string, unknown> }) {
    try { await apiClient.post('/notificacoes', { body: { usuario_id: n.userId, titulo: n.title, mensagem: n.message, tipo: n.type, dados: n.data }, silent: true }) } catch { /* best effort */ }
  }

  async notifyApproversOnCreation(d: MaintenanceNotificationData) {
    const approvers = await this.getMaintenanceApprovers(d.contractId)
    for (const a of approvers) await this.createNotification({ userId: a.id, title: 'Nova Manutenção Pendente', message: `Nova manutenção solicitada para ${d.vehiclePlate} por ${d.requesterName}. Aguardando aprovação.`, type: 'warning', data: { type: 'maintenance_created', maintenanceId: d.maintenanceId, vehicleId: d.vehicleId, contractId: d.contractId, requesterId: d.requesterId, action: 'created' } })
  }

  async notifyRequesterOnWorkshopAssignment(d: MaintenanceNotificationData) {
    const r = await this.getMaintenanceRequester(d.requesterId); if (!r) return
    await this.createNotification({ userId: r.id, title: 'Oficina Definida', message: `Manutenção do veículo ${d.vehiclePlate} foi aprovada e oficina ${d.workshopName} foi definida.`, type: 'info', data: { type: 'maintenance_workshop_assigned', maintenanceId: d.maintenanceId, vehicleId: d.vehicleId, workshopId: d.workshopId, action: 'workshop_assigned' } })
  }

  async notifyRequesterOnReadyForPickup(d: MaintenanceNotificationData) {
    const r = await this.getMaintenanceRequester(d.requesterId); if (!r) return
    await this.createNotification({ userId: r.id, title: 'Manutenção Pronta', message: `Manutenção do veículo ${d.vehiclePlate} está pronta para retirada na oficina ${d.workshopName}.`, type: 'success', data: { type: 'maintenance_ready', maintenanceId: d.maintenanceId, vehicleId: d.vehicleId, workshopId: d.workshopId, action: 'ready_for_pickup' } })
  }

  async notifyApproversOnPickup(d: MaintenanceNotificationData) {
    const approvers = await this.getMaintenanceApprovers(d.contractId)
    for (const a of approvers) await this.createNotification({ userId: a.id, title: 'Veículo Retirado da Oficina', message: `Veículo ${d.vehiclePlate} foi retirado da oficina ${d.workshopName} por ${d.requesterName}.`, type: 'info', data: { type: 'maintenance_picked_up', maintenanceId: d.maintenanceId, vehicleId: d.vehicleId, contractId: d.contractId, requesterId: d.requesterId, action: 'picked_up' } })
  }

  async notifyRequesterOnReturn(d: MaintenanceNotificationData) {
    const r = await this.getMaintenanceRequester(d.requesterId); if (!r) return
    await this.createNotification({ userId: r.id, title: 'Veículo Retornou', message: `Veículo ${d.vehiclePlate} retornou à operação após manutenção.`, type: 'success', data: { type: 'maintenance_returned', maintenanceId: d.maintenanceId, vehicleId: d.vehicleId, action: 'returned' } })
  }

  async notifyRequesterOnRejection(d: MaintenanceNotificationData) {
    const r = await this.getMaintenanceRequester(d.requesterId); if (!r) return
    const reason = d.rejectionReason || 'Não informado'
    await this.createNotification({ userId: r.id, title: 'Manutenção Rejeitada', message: `Solicitação de manutenção para ${d.vehiclePlate} foi rejeitada por ${d.rejectorName || 'Gestor'}. Motivo: ${reason}`, type: 'error', data: { type: 'maintenance_rejected', maintenanceId: d.maintenanceId, vehicleId: d.vehicleId, rejectionReason: reason, action: 'rejected' } })
  }

  async processMaintenanceNotification(maintenanceId: string, action: MaintenanceNotificationData['action']) {
    try {
      // Fetch maintenance data via API
      const maintenance = await apiClient.get<Record<string, unknown>>(`/manutencoes/${maintenanceId}`, { silent: true })
      if (!maintenance) return
      const v = maintenance.veiculo as Record<string, unknown> | undefined
      const c = (v?.contrato ?? {}) as Record<string, unknown>
      const o = maintenance.oficina as Record<string, unknown> | undefined
      const s = maintenance.solicitante as Record<string, unknown> | undefined
      const rej = maintenance.rejeitador as Record<string, unknown> | undefined

      const d: MaintenanceNotificationData = {
        maintenanceId: maintenance.id as string, vehicleId: maintenance.veiculo_id as string,
        vehiclePlate: (v?.placa as string) ?? '', contractId: (c.id as string) ?? '', contractName: (c.nome as string) ?? '',
        workshopId: maintenance.oficina_id as string | undefined, workshopName: (o?.nome as string) ?? undefined,
        requesterId: maintenance.solicitante_id as string, requesterName: (s?.nome as string) ?? 'Usuário',
        rejectorName: (rej?.nome as string) ?? undefined, rejectionReason: maintenance.motivo_rejeicao as string | undefined,
        status: maintenance.status as string, action
      }

      switch (action) {
        case 'created': await this.notifyApproversOnCreation(d); break
        case 'workshop_assigned': await this.notifyRequesterOnWorkshopAssignment(d); break
        case 'ready_for_pickup': await this.notifyRequesterOnReadyForPickup(d); break
        case 'picked_up': await this.notifyApproversOnPickup(d); break
        case 'returned': await this.notifyRequesterOnReturn(d); break
        case 'rejected': await this.notifyRequesterOnRejection(d); break
      }
    } catch (error) { console.error('Erro ao processar notificação de manutenção:', error) }
  }
}

export const maintenanceNotificationService = new MaintenanceNotificationService()
