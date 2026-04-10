import { apiClient } from '@/lib/apiClient'
import { Maintenance, Workshop } from '@/types'

export const maintenanceService = {
  async getAll(): Promise<Maintenance[]> {
    return apiClient.get<Maintenance[]>('/manutencoes')
  },

  async getById(id: string): Promise<Maintenance> {
    return apiClient.get<Maintenance>(`/manutencoes/${id}`)
  },

  async getByVehicle(vehicleId: string): Promise<Maintenance[]> {
    return apiClient.get<Maintenance[]>('/manutencoes', { params: { veiculo_id: vehicleId } })
  },

  async getActiveByVehicle(vehicleId: string): Promise<Maintenance | null> {
    try {
      const data = await apiClient.get<Maintenance[]>('/manutencoes', {
        params: { veiculo_id: vehicleId, status: 'em_manutencao' },
        silent: true
      })
      return data?.[0] ?? null
    } catch {
      return null
    }
  },

  async create(maintenance: Omit<Maintenance, 'id' | 'criado_em'>): Promise<Maintenance> {
    return apiClient.post<Maintenance>('/manutencoes', { body: maintenance })
  },

  async update(id: string, updates: Partial<Maintenance>): Promise<Maintenance> {
    return apiClient.put<Maintenance>(`/manutencoes/${id}`, { body: updates })
  },

  async delete(id: string): Promise<void> {
    await apiClient.delete(`/manutencoes/${id}`)
  },

  async approve(id: string, workshopId: string, estimatedCompletion: string): Promise<Maintenance> {
    return apiClient.put<Maintenance>(`/manutencoes/${id}`, {
      body: { status: 'aprovada', oficina_id: workshopId, estimated_completion: estimatedCompletion }
    })
  },

  async start(id: string): Promise<Maintenance> {
    return apiClient.put<Maintenance>(`/manutencoes/${id}`, {
      body: { status: 'em_manutencao', em_manutencao_em: new Date().toISOString() }
    })
  },

  async complete(id: string): Promise<Maintenance> {
    return apiClient.post<Maintenance>(`/manutencoes/${id}/finalizar`)
  },

  async cancel(id: string, reason: string): Promise<Maintenance> {
    return apiClient.put<Maintenance>(`/manutencoes/${id}`, {
      body: { status: 'cancelada', motivo_cancelamento: reason }
    })
  },

  async deliver(id: string): Promise<Maintenance> {
    return apiClient.put<Maintenance>(`/manutencoes/${id}`, {
      body: { status: 'entregue', entregue_em: new Date().toISOString() }
    })
  },

  async quote(id: string, workshopId: string, valor: number, descricao: string): Promise<Maintenance> {
    return apiClient.put<Maintenance>(`/manutencoes/${id}`, {
      body: { status: 'em_orcamento', oficina_id: workshopId, custo_estimado: valor, observacoes: descricao }
    })
  },

  async ready(id: string): Promise<Maintenance> {
    return apiClient.put<Maintenance>(`/manutencoes/${id}`, {
      body: { status: 'pronto_retirada', pronto_em: new Date().toISOString() }
    })
  },

  // Métodos em português

  async aprovarManutencao(id: string, workshopId: string): Promise<Maintenance> {
    return apiClient.put<Maintenance>(`/manutencoes/${id}`, {
      body: { status: 'aprovada', oficina_id: workshopId }
    })
  },

  async entregarNaOficina(id: string): Promise<Maintenance> {
    return apiClient.put<Maintenance>(`/manutencoes/${id}`, {
      body: { status: 'entregue', entregue_em: new Date().toISOString() }
    })
  },

  async informarOrcamento(id: string, valor: number, descricao: string): Promise<Maintenance> {
    return apiClient.put<Maintenance>(`/manutencoes/${id}`, {
      body: { status: 'em_orcamento', custo_estimado: valor, observacoes: descricao }
    })
  },

  async prontoParaRetirada(id: string): Promise<Maintenance> {
    return apiClient.put<Maintenance>(`/manutencoes/${id}`, {
      body: { status: 'pronto_retirada' }
    })
  },

  async marcarRetornado(id: string): Promise<Maintenance> {
    return apiClient.post<Maintenance>(`/manutencoes/${id}/finalizar`)
  },

  async cancelarManutencao(id: string, motivo: string): Promise<Maintenance> {
    return apiClient.put<Maintenance>(`/manutencoes/${id}`, {
      body: { status: 'cancelada', motivo_cancelamento: motivo }
    })
  },

  async aprovarManutencaoComTipo(
    id: string,
    aprovadorId: string,
    tipoServico: 'interno' | 'externo',
    oficinaId?: string,
    custoEstimado?: number,
    observacoes?: string
  ): Promise<Maintenance> {
    return apiClient.put<Maintenance>(`/manutencoes/${id}`, {
      body: {
        status: 'aprovada',
        tipo_servico: tipoServico,
        oficina_id: tipoServico === 'externo' ? oficinaId : null,
        custo_estimado: tipoServico === 'externo' ? custoEstimado : null,
        observacoes,
        aprovador_id: aprovadorId,
      }
    })
  },

  async buscarOficinasDisponiveis(): Promise<Workshop[]> {
    // Oficinas are a shared resource — use API if available, fallback to direct query
    return apiClient.get<Workshop[]>('/manutencoes/resumo', { params: { oficinas: 'true' }, silent: true })
      .catch(() => [])
  },

  async validarAprovacaoManutencao(
    maintenanceId: string,
    tipoServico: 'interno' | 'externo',
    oficinaId?: string,
    custoEstimado?: number
  ): Promise<{ valid: boolean; errors?: string[] }> {
    const errors: string[] = []
    if (tipoServico === 'externo') {
      if (!oficinaId) errors.push('Serviço externo requer seleção de oficina')
      if (!custoEstimado || custoEstimado <= 0) errors.push('Serviço externo requer custo estimado válido')
    }
    if (tipoServico === 'interno') {
      if (oficinaId) errors.push('Serviço interno não deve ter oficina selecionada')
      if (custoEstimado) errors.push('Serviço interno não deve ter custo estimado')
    }
    return { valid: errors.length === 0, errors: errors.length > 0 ? errors : undefined }
  },

  async rejeitarManutencao(id: string, motivo: string, rejeitadorId: string): Promise<Maintenance> {
    return apiClient.put<Maintenance>(`/manutencoes/${id}`, {
      body: { status: 'rejeitada', motivo_rejeicao: motivo, rejeitador_id: rejeitadorId }
    })
  },

  async iniciarManutencao(id: string): Promise<Maintenance> {
    return apiClient.put<Maintenance>(`/manutencoes/${id}`, {
      body: { status: 'em_manutencao' }
    })
  },
}
