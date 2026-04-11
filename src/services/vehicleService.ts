import { apiClient } from '@/lib/apiClient'
import { Vehicle, VehicleDocument, LaudoAcusticoOS } from '@/types'

export const vehicleService = {
  getAll: async (locationIds?: string[], contratoIds?: string[], baseIds?: string[]): Promise<Vehicle[]> => {
    const params: Record<string, string | undefined> = {}
    // Merge locationIds into contratoIds (legacy compat)
    const cIds = contratoIds?.length ? contratoIds : locationIds
    if (cIds?.length) params.contrato_ids = cIds.join(',')
    if (baseIds?.length) params.base_ids = baseIds.join(',')

    return apiClient.get<Vehicle[]>('/veiculos', { params })
  },

  getById: async (id: string): Promise<Vehicle> => {
    return apiClient.get<Vehicle>(`/veiculos/${id}`)
  },

  getTransferHistory: async (vehicleId: string) => {
    return apiClient.get<Array<{
      id: string
      veiculo_id: string
      base_origem_id: string
      base_destino_id: string
      usuario_id?: string
      data_transferencia: string
      observacoes?: string
      usuario?: { id: string; nome: string }
      contrato_origem?: { id: string; nome: string }
      contrato_destino?: { id: string; nome: string }
    }>>(`/veiculos/${vehicleId}/transferencias`, { silent: true })
  },

  create: async (vehicle: Omit<Vehicle, 'id' | 'criado_em' | 'atualizado_em'>): Promise<Vehicle> => {
    return apiClient.post<Vehicle>('/veiculos', { body: vehicle })
  },

  update: async (id: string, vehicle: Partial<Vehicle>): Promise<Vehicle> => {
    return apiClient.put<Vehicle>(`/veiculos/${id}`, { body: vehicle })
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/veiculos/${id}`)
  },

  getByLocation: async (locationId: string): Promise<Vehicle[]> => {
    return apiClient.get<Vehicle[]>('/veiculos', { params: { contrato_ids: locationId } })
  },

  getByContrato: async (contratoId: string): Promise<Vehicle[]> => {
    return apiClient.get<Vehicle[]>('/veiculos', { params: { contrato_ids: contratoId } })
  },

  getByBase: async (baseId: string): Promise<Vehicle[]> => {
    return apiClient.get<Vehicle[]>('/veiculos', { params: { base_ids: baseId } })
  },

  getByPlaca: async (placa: string): Promise<Vehicle | null> => {
    try {
      const data = await apiClient.get<Vehicle[]>('/veiculos', { params: { placa }, silent: true })
      return data?.[0] ?? null
    } catch {
      return null
    }
  },

  // --- Documentos (via API Rust /documentos) ---

  getDocuments: async (vehicleId: string): Promise<VehicleDocument[]> => {
    return apiClient.get<VehicleDocument[]>('/documentos', { params: { veiculo_id: vehicleId } })
  },

  addDocument: async (document: Omit<VehicleDocument, 'id' | 'criado_em' | 'atualizado_em'>): Promise<VehicleDocument> => {
    return apiClient.post<VehicleDocument>('/documentos', { body: document })
  },

  deleteDocument: async (id: string): Promise<void> => {
    await apiClient.delete(`/documentos/${id}`)
  },

  // --- Ações de veículo ---

  reallocateVehicle: async (vehicleId: string, teamId: string): Promise<Vehicle> => {
    return apiClient.put<Vehicle>(`/veiculos/${vehicleId}`, { body: { equipe_id: teamId } })
  },

  // Upload via Next.js API route (server-side storage), returns storage path (not public URL)
  uploadDocument: async (file: File, vehicleId: string, type: string): Promise<VehicleDocument> => {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('vehicleId', vehicleId)
    formData.append('tipoDocumento', type)
    formData.append('expiraEm', '')

    const response = await fetch('/api/vehicle-documents', {
      method: 'POST',
      body: formData,
    })
    const result = await response.json()
    if (!response.ok) throw new Error(result.error || 'Erro no upload')

    return {
      id: result.id || 'temp-id',
      veiculo_id: vehicleId,
      tipo_documento: type,
      url_arquivo: result.storagePath || result.url,
      expira_em: undefined,
      criado_em: new Date().toISOString(),
      atualizado_em: new Date().toISOString()
    }
  },

  /** Get a signed URL for viewing a storage file */
  getFileUrl: async (storagePath: string): Promise<string> => {
    // If it's already a full URL (legacy public), return as-is
    if (storagePath.startsWith('http')) return storagePath
    // Otherwise get signed URL from backend
    const parts = storagePath.split('/')
    const bucket = parts[0]
    const path = parts.slice(1).join('/')
    return apiClient.getSignedUrl(bucket, path)
  },

  // --- Laudos Acústicos OS (via API Rust /laudos) ---

  getOSLaudoAcustico: async (documentoId: string): Promise<LaudoAcusticoOS[]> => {
    return apiClient.get<LaudoAcusticoOS[]>('/laudos', { params: { documento_id: documentoId, tipo: 'acustico' } })
  },

  addOSLaudoAcustico: async (os: Omit<LaudoAcusticoOS, 'id' | 'criado_em' | 'atualizado_em'>): Promise<LaudoAcusticoOS> => {
    return apiClient.post<LaudoAcusticoOS>('/laudos/acustico', { body: os })
  },

  updateOSLaudoAcustico: async (id: string, os: Partial<LaudoAcusticoOS>): Promise<LaudoAcusticoOS> => {
    return apiClient.put<LaudoAcusticoOS>(`/laudos/acustico/${id}`, { body: os })
  },

  deleteOSLaudoAcustico: async (id: string): Promise<void> => {
    await apiClient.delete(`/laudos/acustico/${id}`)
  },

  // Upload de OS laudo acústico — via Next.js API route (server-side storage)
  uploadOSLaudoAcustico: async (file: File, documentoId: string, numeroOS: string, descricao?: string): Promise<LaudoAcusticoOS> => {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('documentoId', documentoId)
    formData.append('numeroOS', numeroOS)
    if (descricao) formData.append('descricao', descricao)

    const response = await fetch('/api/laudo-acustico-os', {
      method: 'POST',
      body: formData,
    })
    const result = await response.json()
    if (!response.ok) throw new Error(result.error || 'Erro no upload do laudo acústico')

    return result as LaudoAcusticoOS
  }
}
