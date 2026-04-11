import { apiClient } from '@/lib/apiClient'

export interface DocumentExpirationData {
  funcionarioId: string; funcionarioNome: string; funcionarioEmail: string
  documento: 'aso' | 'cnh' | 'har'; dataVencimento: string; diasParaVencimento: number
  status: 'vencendo' | 'atencao' | 'vencido'
}

export interface DocumentNotificationUser { id: string; nome: string; email: string; nivel_acesso: string }

class DocumentNotificationService {
  async getExpiringDocuments(): Promise<DocumentExpirationData[]> {
    try { return await apiClient.get<DocumentExpirationData[]>('/documentos/vencendo', { params: { dias: 60, tipo: 'funcionario' }, silent: true }) }
    catch { return [] }
  }

  async getNotificationRecipients(): Promise<DocumentNotificationUser[]> {
    try { return await apiClient.get<DocumentNotificationUser[]>('/notificacoes/destinatarios', { params: { funcionalidade: 'funcionarios.visualizar' }, silent: true }) }
    catch { return [] }
  }

  private async createNotification(n: { userId: string; title: string; message: string; type: 'info' | 'warning' | 'error' | 'success'; data: Record<string, unknown> }) {
    try { await apiClient.post('/notificacoes', { body: { usuario_id: n.userId, titulo: n.title, mensagem: n.message, tipo: n.type, dados: n.data }, silent: true }) }
    catch { /* best effort */ }
  }

  async processDocumentExpirationNotifications(): Promise<void> {
    try {
      const docs = await this.getExpiringDocuments()
      const recipients = await this.getNotificationRecipients()
      if (!docs.length || !recipients.length) return

      for (const recipient of recipients) {
        for (const doc of docs) {
          let tipo: 'info' | 'warning' | 'error' = 'info', titulo = '', mensagem = ''
          switch (doc.status) {
            case 'vencido': tipo = 'error'; titulo = `🚨 ${doc.documento.toUpperCase()} Vencido`; mensagem = `${doc.funcionarioNome} - ${doc.documento.toUpperCase()} venceu em ${doc.dataVencimento}`; break
            case 'atencao': tipo = 'warning'; titulo = `⚠️ ${doc.documento.toUpperCase()} Vencendo em ${doc.diasParaVencimento} dias`; mensagem = `${doc.funcionarioNome} - ${doc.documento.toUpperCase()} vence em ${doc.diasParaVencimento} dias (${doc.dataVencimento})`; break
            case 'vencendo': titulo = `📅 ${doc.documento.toUpperCase()} Vencendo em ${doc.diasParaVencimento} dias`; mensagem = `${doc.funcionarioNome} - ${doc.documento.toUpperCase()} vence em ${doc.diasParaVencimento} dias (${doc.dataVencimento})`; break
          }
          await this.createNotification({ userId: recipient.id, title: titulo, message: mensagem, type: tipo, data: { type: 'document_expiration', funcionarioId: doc.funcionarioId, funcionarioNome: doc.funcionarioNome, documento: doc.documento, dataVencimento: doc.dataVencimento, diasParaVencimento: doc.diasParaVencimento, status: doc.status, action: 'expiration_alert' } })
        }
      }
    } catch (error) { console.error('Erro ao processar notificações de vencimento:', error) }
  }
}

export const documentNotificationService = new DocumentNotificationService()
