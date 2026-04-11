import { apiClient } from '@/lib/apiClient'

export interface DocumentInfo {
  id: string; user_id: string; tipo: 'har' | 'cnh'; numero: string; arquivo_url: string
  nome_arquivo: string; vencimento: string; status: 'vigente' | 'vencendo' | 'vencido'
  criado_em: string; atualizado_em: string
  usuarios?: { id: string; nome: string; email: string; equipe: string }
}

export interface DocumentUpload { user_id: string; tipo: 'har' | 'cnh'; numero: string; arquivo: File; vencimento: string }

export const documentService = {
  async uploadDocument(upload: DocumentUpload): Promise<DocumentInfo> {
    const formData = new FormData()
    formData.append('file', upload.arquivo)
    formData.append('user_id', upload.user_id)
    formData.append('tipo', upload.tipo)
    formData.append('numero', upload.numero)
    formData.append('vencimento', upload.vencimento)
    const res = await fetch('/api/user-documents/upload', { method: 'POST', body: formData })
    if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || 'Erro no upload') }
    return res.json()
  },

  async updateDocument(id: string, updates: Partial<DocumentInfo>): Promise<DocumentInfo> {
    return apiClient.put<DocumentInfo>(`/user-documents/${id}`, { body: updates })
  },

  async deleteDocument(id: string): Promise<void> {
    await apiClient.delete(`/user-documents/${id}`)
  },

  async getDocumentsByUser(userId: string): Promise<DocumentInfo[]> {
    return apiClient.get<DocumentInfo[]>('/user-documents', { params: { user_id: userId } })
  },

  async getAllDocuments(): Promise<DocumentInfo[]> {
    return apiClient.get<DocumentInfo[]>('/user-documents')
  },

  async getExpiringDocuments(): Promise<DocumentInfo[]> {
    return apiClient.get<DocumentInfo[]>('/user-documents/vencendo')
  },

  async getExpiredDocuments(): Promise<DocumentInfo[]> {
    return apiClient.get<DocumentInfo[]>('/user-documents/vencidos')
  },

  calculateStatus(vencimento: string): 'vigente' | 'vencendo' | 'vencido' {
    const now = new Date()
    const exp = new Date(vencimento)
    const days = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    if (days < 0) return 'vencido'
    if (days <= 30) return 'vencendo'
    return 'vigente'
  },

  async downloadDocument(filePath: string): Promise<Blob> {
    const parts = filePath.split('/')
    const bucket = parts[0]
    const path = parts.slice(1).join('/')
    const signedUrl = await apiClient.getSignedUrl(bucket, path)
    const res = await fetch(signedUrl)
    if (!res.ok) throw new Error('Erro no download')
    return res.blob()
  }
}
