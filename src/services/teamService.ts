import { apiClient } from '@/lib/apiClient'
import { Team } from '@/types/team'
import type { Vehicle } from '@/types'

export const teamService = {
  getAll: async (): Promise<Team[]> => {
    return apiClient.get<Team[]>('/equipes')
  },

  getTeams: async (): Promise<Team[]> => {
    return apiClient.get<Team[]>('/equipes')
  },

  getById: async (id: string): Promise<Team> => {
    return apiClient.get<Team>(`/equipes/${id}`, { silent: true })
  },

  create: async (team: Omit<Team, 'id' | 'criado_em' | 'atualizado_em'>): Promise<Team> => {
    return apiClient.post<Team>('/equipes', { body: team })
  },

  update: async (id: string, team: Partial<Team>): Promise<Team> => {
    return apiClient.put<Team>(`/equipes/${id}`, { body: team })
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/equipes/${id}`)
  },

  getByLocation: async (locationId: string): Promise<Team[]> => {
    return apiClient.get<Team[]>('/equipes', { params: { contrato_id: locationId } })
  },

  getByVehicle: async (vehicleId: string): Promise<Team | null> => {
    try {
      const teams = await apiClient.get<Team[]>('/equipes', { params: { veiculo_id: vehicleId }, silent: true })
      return teams?.[0] ?? null
    } catch {
      return null
    }
  },

  assignToVehicle: async (teamId: string, vehicleId: string): Promise<Team> => {
    return apiClient.put<Team>(`/equipes/${teamId}`, { body: { veiculo_id: vehicleId } })
  },

  removeFromVehicle: async (teamId: string): Promise<Team> => {
    return apiClient.put<Team>(`/equipes/${teamId}`, { body: { veiculo_id: null } })
  },

  stopTeam: async (teamId: string, reason: string): Promise<Team> => {
    return apiClient.put<Team>(`/equipes/${teamId}`, { body: { status: 'parada', motivoParada: reason, veiculo_id: null } })
  },

  activateTeam: async (teamId: string): Promise<Team> => {
    return apiClient.put<Team>(`/equipes/${teamId}`, { body: { status: 'operando', motivoParada: null } })
  },

  updateStatus: async (id: string, status: 'operando' | 'parada', motivoParada?: string): Promise<Team> => {
    return apiClient.put<Team>(`/equipes/${id}`, {
      body: { status, motivoParada: status === 'parada' ? motivoParada : null }
    })
  },

  updateVehicle: async (id: string, vehicleId: string | null): Promise<Team> => {
    return apiClient.put<Team>(`/equipes/${id}`, { body: { veiculo_id: vehicleId } })
  },

  addMember: async (teamId: string, userId: string): Promise<Team> => {
    return apiClient.post<Team>(`/equipes/${teamId}/alocar-veiculo`, { body: { usuario_id: userId } })
  },

  removeMember: async (teamId: string, userId: string): Promise<Team> => {
    return apiClient.post<Team>(`/equipes/${teamId}/desalocar-veiculo`, { body: { usuario_id: userId } })
  },

  /** Aloca um veículo a uma equipe (many-to-many) */
  assignVehicle: async (teamId: string, vehicleId: string): Promise<Team> => {
    return apiClient.post<Team>(`/equipes/${teamId}/alocar-veiculo`, { body: { veiculo_id: vehicleId } })
  },

  /** Remove uma equipe de um veículo específico */
  removeVehicle: async (teamId: string, vehicleId: string): Promise<void> => {
    await apiClient.post(`/equipes/${teamId}/desalocar-veiculo`, { body: { veiculo_id: vehicleId } })
  },

  /** Obtém todas as equipes associadas a um veículo */
  getTeamsByVehicle: async (vehicleId: string): Promise<Team[]> => {
    return apiClient.get<Team[]>('/equipes', { params: { veiculo_id: vehicleId } })
  },

  /** Obtém o mapa de associações veículo->equipes */
  getAllVehicleTeamAssociations: async (): Promise<{ veiculo_id: string; equipe_id: string }[]> => {
    return apiClient.get<{ veiculo_id: string; equipe_id: string }[]>('/equipes', { params: { associations: 'true' } })
  },

  /** Obtém todos os veículos associados a uma equipe */
  getVehiclesByTeam: async (teamId: string): Promise<Vehicle[]> => {
    return apiClient.get<Vehicle[]>('/equipes', { params: { equipe_id: teamId, include_vehicles: 'true' } })
  }
}
