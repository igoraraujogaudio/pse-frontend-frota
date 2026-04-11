import { apiClient } from '@/lib/apiClient'
import { MaintenanceAttachment } from '@/types'

export class MaintenanceAttachmentService {
  static async addAttachment(maintenanceId: string, attachment: Omit<MaintenanceAttachment, 'id' | 'criado_em' | 'criado_por'>): Promise<MaintenanceAttachment> {
    return apiClient.post<MaintenanceAttachment>(`/manutencoes/${maintenanceId}/anexos`, { body: attachment })
  }

  static async removeAttachment(attachmentId: string): Promise<boolean> {
    await apiClient.delete(`/manutencoes/anexos/${attachmentId}`)
    return true
  }

  static async getAttachmentsByMaintenance(maintenanceId: string): Promise<MaintenanceAttachment[]> {
    return apiClient.get<MaintenanceAttachment[]>(`/manutencoes/${maintenanceId}/anexos`)
  }

  static async getAttachmentById(attachmentId: string): Promise<MaintenanceAttachment> {
    return apiClient.get<MaintenanceAttachment>(`/manutencoes/anexos/${attachmentId}`)
  }

  static async updateAttachment(attachmentId: string, updates: Partial<Pick<MaintenanceAttachment, 'nome' | 'descricao' | 'categoria'>>): Promise<MaintenanceAttachment> {
    return apiClient.put<MaintenanceAttachment>(`/manutencoes/anexos/${attachmentId}`, { body: updates })
  }

  static async uploadFile(file: File, maintenanceId: string, category: string): Promise<{ url: string; path: string }> {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('maintenanceId', maintenanceId)
    formData.append('category', category)
    const res = await fetch('/api/maintenance-attachments/upload', { method: 'POST', body: formData })
    if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || 'Erro no upload') }
    return res.json()
  }

  static async removeFileFromStorage(filePath: string): Promise<boolean> {
    try { await apiClient.delete('/storage/file', { body: { path: filePath, bucket: 'maintenance-attachments' } }); return true } catch { return false }
  }

  static async uploadAndAddAttachment(file: File, maintenanceId: string, category: string, description?: string): Promise<MaintenanceAttachment> {
    const { url } = await this.uploadFile(file, maintenanceId, category)
    return this.addAttachment(maintenanceId, { nome: file.name, url, tipo: file.type, tamanho: file.size, categoria: category as 'imagem' | 'nota_fiscal' | 'documento' | 'outros', descricao: description })
  }

  static async removeAttachmentAndFile(attachmentId: string): Promise<boolean> {
    const attachment = await this.getAttachmentById(attachmentId)
    await this.removeAttachment(attachmentId)
    if (attachment.url.includes('storage')) {
      const urlParts = attachment.url.split('/')
      const filePath = urlParts.slice(urlParts.indexOf('maintenance-attachments')).join('/')
      await this.removeFileFromStorage(filePath)
    }
    return true
  }

  static async getAttachmentStats(maintenanceId: string) {
    const attachments = await this.getAttachmentsByMaintenance(maintenanceId)
    const stats = { total: attachments.length, byCategory: {} as Record<string, number>, totalSize: 0 }
    attachments.forEach(a => { stats.byCategory[a.categoria] = (stats.byCategory[a.categoria] || 0) + 1; stats.totalSize += a.tamanho })
    return stats
  }
}
