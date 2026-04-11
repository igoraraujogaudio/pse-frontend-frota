import { apiClient } from '@/lib/apiClient'

export interface VehicleDocumentExpirationData {
  veiculoId: string; veiculoPlaca: string; veiculoModelo: string; contratoId: string; contratoNome: string
  documento: 'acustico' | 'eletrico' | 'tacografo' | 'aet' | 'fumaca' | 'crlv' | 'apolice' | 'contrato_seguro'
  dataVencimento: string; diasParaVencimento: number; status: 'vencendo' | 'atencao' | 'vencido'; documentoId: string
}

export interface VehicleDocumentNotificationUser { id: string; nome: string; email: string; nivel_acesso: string }

class VehicleDocumentNotificationService {
  async getExpiringVehicleDocuments(): Promise<VehicleDocumentExpirationData[]> {
    try { return await apiClient.get<VehicleDocumentExpirationData[]>('/documentos/vencendo', { params: { dias: 60, tipo: 'veiculo' }, silent: true }) } catch { return [] }
  }

  async getVehicleDocumentNotificationRecipients(): Promise<VehicleDocumentNotificationUser[]> {
    try { return await apiClient.get<VehicleDocumentNotificationUser[]>('/notificacoes/destinatarios', { params: { funcionalidade: 'veiculos.site.editar_veiculo' }, silent: true }) } catch { return [] }
  }

  private async createNotification(n: { userId: string; title: string; message: string; type: 'info' | 'warning' | 'error' | 'success'; data: Record<string, unknown> }) {
    try { await apiClient.post('/notificacoes', { body: { usuario_id: n.userId, titulo: n.title, mensagem: n.message, tipo: n.type, dados: n.data }, silent: true }) } catch { /* best effort */ }
  }

  async processVehicleDocumentExpirationNotifications(): Promise<void> {
    try {
      const docs = await this.getExpiringVehicleDocuments()
      const recipients = await this.getVehicleDocumentNotificationRecipients()
      if (!docs.length || !recipients.length) return

      for (const recipient of recipients) {
        for (const doc of docs) {
          let tipo: 'info' | 'warning' | 'error' = 'info', titulo = '', mensagem = ''
          switch (doc.status) {
            case 'vencido': tipo = 'error'; titulo = `🚨 Laudo ${doc.documento.toUpperCase()} Vencido`; mensagem = `Veículo ${doc.veiculoPlaca} (${doc.veiculoModelo}) - Contrato: ${doc.contratoNome} - Laudo ${doc.documento.toUpperCase()} venceu em ${doc.dataVencimento}`; break
            case 'atencao': tipo = 'warning'; titulo = `⚠️ Laudo ${doc.documento.toUpperCase()} Vencendo em ${doc.diasParaVencimento} dias`; mensagem = `Veículo ${doc.veiculoPlaca} (${doc.veiculoModelo}) - Contrato: ${doc.contratoNome} - Laudo ${doc.documento.toUpperCase()} vence em ${doc.diasParaVencimento} dias (${doc.dataVencimento})`; break
            case 'vencendo': titulo = `📅 Laudo ${doc.documento.toUpperCase()} Vencendo em ${doc.diasParaVencimento} dias`; mensagem = `Veículo ${doc.veiculoPlaca} (${doc.veiculoModelo}) - Contrato: ${doc.contratoNome} - Laudo ${doc.documento.toUpperCase()} vence em ${doc.diasParaVencimento} dias (${doc.dataVencimento})`; break
          }
          await this.createNotification({ userId: recipient.id, title: titulo, message: mensagem, type: tipo, data: { type: 'vehicle_document_expiration', veiculoId: doc.veiculoId, veiculoPlaca: doc.veiculoPlaca, documento: doc.documento, documentoId: doc.documentoId, dataVencimento: doc.dataVencimento, diasParaVencimento: doc.diasParaVencimento, status: doc.status, action: 'vehicle_document_expiration_alert' } })
        }
      }
    } catch (error) { console.error('Erro ao processar notificações de documentos de veículos:', error) }
  }
}

export const vehicleDocumentNotificationService = new VehicleDocumentNotificationService()
