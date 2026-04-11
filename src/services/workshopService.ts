import { apiClient } from '@/lib/apiClient'
import { Workshop } from '@/types'

export const workshopService = {
  async getAll(): Promise<Workshop[]> {
    return apiClient.get<Workshop[]>('/oficinas')
  },
  async getById(id: string): Promise<Workshop> {
    return apiClient.get<Workshop>(`/oficinas/${id}`)
  },
  async create(workshop: Omit<Workshop, 'id' | 'criado_em' | 'atualizado_em'>): Promise<Workshop> {
    return apiClient.post<Workshop>('/oficinas', { body: workshop })
  },
  async update(id: string, updates: Partial<Omit<Workshop, 'id' | 'criado_em' | 'atualizado_em'>>): Promise<Workshop> {
    return apiClient.put<Workshop>(`/oficinas/${id}`, { body: updates })
  },
  async delete(id: string): Promise<void> {
    await apiClient.delete(`/oficinas/${id}`)
  },
  async getBySpecialty(specialty: string): Promise<Workshop[]> {
    return apiClient.get<Workshop[]>('/oficinas', { params: { especialidade: specialty } })
  }
}
