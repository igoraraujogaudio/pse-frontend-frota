import { apiClient } from '@/lib/apiClient'

export interface Document {
  id: string; veiculo_id: string; tipo_documento: string; url_arquivo: string | null
  expira_em: string | null; criado_em: string; atualizado_em: string
  veiculo?: { id: string; placa: string; modelo: string }
}

export const reportService = {
  async getAll(): Promise<Document[]> {
    return apiClient.get<Document[]>('/documentos')
  },
  async getById(id: string): Promise<Document> {
    return apiClient.get<Document>(`/documentos/${id}`)
  },
  async getByVehicle(vehicleId: string): Promise<Document[]> {
    return apiClient.get<Document[]>('/documentos', { params: { veiculo_id: vehicleId } })
  },
  async create(document: Omit<Document, 'id' | 'criado_em' | 'atualizado_em'>): Promise<Document> {
    return apiClient.post<Document>('/documentos', { body: document })
  },
  async update(id: string, updates: Partial<Document>): Promise<Document> {
    return apiClient.put<Document>(`/documentos/${id}`, { body: updates })
  },
  async delete(id: string): Promise<void> {
    await apiClient.delete(`/documentos/${id}`)
  },
  async uploadFile(file: File, vehicleId: string, documentType: string): Promise<Document> {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('vehicleId', vehicleId)
    formData.append('tipoDocumento', documentType)
    const res = await fetch('/api/vehicle-documents', { method: 'POST', body: formData })
    if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || 'Erro no upload') }
    return res.json()
  },
  async getExpiringDocuments(days: number = 30): Promise<Document[]> {
    return apiClient.get<Document[]>('/documentos/vencendo', { params: { dias: days } })
  },
  async getExpiredDocuments(): Promise<Document[]> {
    return apiClient.get<Document[]>('/documentos/vencidos')
  }
}
