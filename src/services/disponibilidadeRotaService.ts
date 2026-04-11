import { apiClient } from '@/lib/apiClient'

export type StatusDisponibilidade = 'disponivel' | 'em_operacao' | 'manutencao'
export type ManutencaoTipo = 'em_manutencao' | 'em_orcamento'
export type ManutencaoComplexidade = 'alta' | 'media' | 'baixa'
export type ManutencaoSetor = 'STCO' | 'O&M' | 'APOIO'

export interface DisponibilidadeRota {
  id: string
  contrato_id: string
  veiculo_id: string
  equipe_id?: string
  data_referencia: string
  status: StatusDisponibilidade
  manutencao_tipo?: ManutencaoTipo
  manutencao_problema?: string
  manutencao_previsao?: string
  manutencao_oficina_id?: string
  manutencao_oficina_nome?: string
  manutencao_complexidade?: ManutencaoComplexidade
  manutencao_setor?: ManutencaoSetor
  manutencao_id?: string
  enviado_por?: string
  enviado_em?: string
  reuniao_encerrada: boolean
  reuniao_encerrada_por?: string
  reuniao_encerrada_em?: string
  observacoes?: string
  criado_em: string
  atualizado_em: string
  contrato?: { id: string; nome: string; codigo?: string }
  veiculo?: { id: string; placa: string; modelo: string; tipo_veiculo?: string }
  equipe?: { id: string; nome: string }
  oficina?: { id: string; nome: string }
  enviado_por_usuario?: { id: string; nome: string }
}

export interface ResumoContrato {
  contrato_id: string
  contrato_nome: string
  contrato_codigo?: string
  total_veiculos: number
  disponiveis: number
  em_operacao: number
  manutencao: number
  nao_informados: number
  reuniao_encerrada: boolean
}

export const disponibilidadeFrotaService = {
  async getByData(dataReferencia: string, contratoIds?: string[]): Promise<DisponibilidadeRota[]> {
    const params: Record<string, string | undefined> = { data: dataReferencia }
    if (contratoIds?.length) params.contrato_ids = contratoIds.join(',')
    return apiClient.get<DisponibilidadeRota[]>('/disponibilidade', { params })
  },

  async getByContratoEData(contratoId: string, dataReferencia: string): Promise<DisponibilidadeRota[]> {
    return apiClient.get<DisponibilidadeRota[]>('/disponibilidade', {
      params: { data: dataReferencia, contrato_ids: contratoId }
    })
  },

  async getVeiculosPorContrato(contratoId: string): Promise<Record<string, unknown>[]> {
    // Veículos ativos de um contrato — usa endpoint de veículos
    return apiClient.get<Record<string, unknown>[]>('/veiculos', { params: { contrato_ids: contratoId } })
  },

  async getContratos(): Promise<Array<{ id: string; nome: string; codigo?: string }>> {
    // Contratos ativos — via Backend Rust API
    return apiClient.get<Array<{ id: string; nome: string; codigo?: string }>>('/contratos', {
      params: { status: 'ativo' }
    })
  },

  async upsert(payload: {
    contrato_id: string
    veiculo_id: string
    equipe_id?: string
    data_referencia: string
    status: StatusDisponibilidade
    manutencao_tipo?: ManutencaoTipo
    manutencao_problema?: string
    manutencao_previsao?: string
    manutencao_oficina_id?: string
    manutencao_oficina_nome?: string
    manutencao_complexidade?: ManutencaoComplexidade
    manutencao_setor?: ManutencaoSetor
    manutencao_id?: string
    observacoes?: string
    enviado_por: string
  }): Promise<DisponibilidadeRota> {
    return apiClient.post<DisponibilidadeRota>('/disponibilidade', { body: payload })
  },

  async getUltimoRegistroPorVeiculo(contratoId: string, veiculoIds: string[]): Promise<Record<string, DisponibilidadeRota>> {
    if (veiculoIds.length === 0) return {}
    const data = await apiClient.get<DisponibilidadeRota[]>('/disponibilidade/historico', {
      params: { contrato_id: contratoId, veiculo_ids: veiculoIds.join(','), limit: '500' }
    })
    const result: Record<string, DisponibilidadeRota> = {}
    for (const reg of data) {
      if (!result[reg.veiculo_id]) result[reg.veiculo_id] = reg
    }
    return result
  },

  async getUltimosRegistrosManutencao(contratoId: string, veiculoIds: string[]): Promise<Record<string, Pick<DisponibilidadeRota, 'veiculo_id' | 'manutencao_tipo' | 'manutencao_problema' | 'manutencao_previsao' | 'manutencao_oficina_id' | 'manutencao_oficina_nome' | 'manutencao_complexidade' | 'manutencao_setor' | 'observacoes' | 'data_referencia'>>> {
    const data = await apiClient.get<DisponibilidadeRota[]>('/disponibilidade/historico', {
      params: { contrato_id: contratoId, veiculo_ids: veiculoIds.join(','), status: 'manutencao', limit: '500' }
    })
    type ManutencaoPick = Pick<DisponibilidadeRota, 'veiculo_id' | 'manutencao_tipo' | 'manutencao_problema' | 'manutencao_previsao' | 'manutencao_oficina_id' | 'manutencao_oficina_nome' | 'manutencao_complexidade' | 'manutencao_setor' | 'observacoes' | 'data_referencia'>
    const result: Record<string, ManutencaoPick> = {}
    for (const reg of data) {
      if (!result[reg.veiculo_id] && reg.manutencao_tipo) result[reg.veiculo_id] = reg
    }
    for (const vid of veiculoIds) {
      if (!result[vid]) {
        result[vid] = { veiculo_id: vid, manutencao_tipo: 'em_manutencao' as ManutencaoTipo, data_referencia: this.getDataHojeBrasilia() }
      }
    }
    return result
  },

  async encerrarReuniao(contratoId: string, dataReferencia: string, usuarioId: string): Promise<void> {
    await apiClient.post('/disponibilidade/encerrar-reuniao', {
      body: { contrato_id: contratoId, data_referencia: dataReferencia, usuario_id: usuarioId }
    })
  },

  async reativarReuniao(contratoId: string, dataReferencia: string): Promise<void> {
    await apiClient.post('/disponibilidade/encerrar-reuniao', {
      body: { contrato_id: contratoId, data_referencia: dataReferencia, reativar: true }
    })
  },

  async getResumoContratos(dataReferencia: string, contratoIds?: string[]): Promise<ResumoContrato[]> {
    const params: Record<string, string | undefined> = { data: dataReferencia }
    if (contratoIds?.length) params.contrato_ids = contratoIds.join(',')
    return apiClient.get<ResumoContrato[]>('/disponibilidade/resumo', { params })
  },

  async getEquipesPorContrato(contratoId: string): Promise<Array<{ id: string; nome: string }>> {
    return apiClient.get<Array<{ id: string; nome: string }>>('/equipes', { params: { contrato_id: contratoId } })
  },

  async getOficinasPorContrato(contratoId: string): Promise<Array<{ id: string; nome: string }>> {
    // Oficinas — via Backend Rust API
    return apiClient.get<Array<{ id: string; nome: string }>>('/oficinas', {
      params: { contrato_id: contratoId, ativo: 'true' }
    })
  },

  async getHistorico(filtros: {
    contratoId?: string
    dataInicio?: string
    dataFim?: string
    status?: StatusDisponibilidade
    veiculoBusca?: string
  }): Promise<DisponibilidadeRota[]> {
    const params: Record<string, string | undefined> = {
      contrato_id: filtros.contratoId,
      data_inicio: filtros.dataInicio,
      data_fim: filtros.dataFim,
      status: filtros.status,
      busca: filtros.veiculoBusca,
    }
    return apiClient.get<DisponibilidadeRota[]>('/disponibilidade/historico', { params })
  },

  async getAnalytics(filtros: { contratoId?: string; dataInicio: string; dataFim: string }): Promise<DisponibilidadeRota[]> {
    return apiClient.get<DisponibilidadeRota[]>('/disponibilidade/historico', {
      params: { contrato_id: filtros.contratoId, data_inicio: filtros.dataInicio, data_fim: filtros.dataFim }
    })
  },

  getHorarioAtual(): { horario: 'manha' | 'tarde' | 'fora'; horasBrasilia: number } {
    const agora = new Date()
    const horasBrasilia = agora.getUTCHours() - 3
    const horasAjustadas = horasBrasilia < 0 ? horasBrasilia + 24 : horasBrasilia
    if (horasAjustadas < 11) return { horario: 'manha', horasBrasilia: horasAjustadas }
    if (horasAjustadas < 17) return { horario: 'tarde', horasBrasilia: horasAjustadas }
    return { horario: 'fora', horasBrasilia: horasAjustadas }
  },

  isForaDoHorario(): boolean {
    return this.getHorarioAtual().horario === 'fora'
  },

  getDataHojeBrasilia(): string {
    const agora = new Date()
    const offsetBrasilia = -3 * 60 * 60 * 1000
    const brasilia = new Date(agora.getTime() + offsetBrasilia)
    return brasilia.toISOString().split('T')[0]
  },

  // --- Notificações por contrato (via API Rust) ---

  async getEmailsPorContrato(contratoId: string) {
    return apiClient.get<Array<{ id: string; email: string; nome: string | null; descricao: string | null; ativo: boolean; usuario_id?: string | null }>>('/notificacoes-disponibilidade/emails', { params: { contrato_id: contratoId } })
  },

  async upsertEmail(payload: { id?: string; contrato_id: string; email: string; nome?: string | null; descricao?: string | null; usuario_id?: string; ativo?: boolean }) {
    if (payload.id) {
      return apiClient.put(`/notificacoes-disponibilidade/emails/${payload.id}`, { body: payload })
    }
    return apiClient.post('/notificacoes-disponibilidade/emails', { body: payload })
  },

  async deleteEmail(id: string) {
    await apiClient.delete(`/notificacoes-disponibilidade/emails/${id}`)
  },

  async getWhatsappPorContrato(contratoId: string) {
    return apiClient.get<Array<{ id: string; numero: string; nome: string | null; descricao: string | null; ativo: boolean }>>('/notificacoes-disponibilidade/whatsapp', { params: { contrato_id: contratoId } })
  },

  async upsertWhatsapp(payload: { id?: string; contrato_id: string; numero: string; nome?: string | null; descricao?: string | null; ativo?: boolean }) {
    if (payload.id) {
      return apiClient.put(`/notificacoes-disponibilidade/whatsapp/${payload.id}`, { body: payload })
    }
    return apiClient.post('/notificacoes-disponibilidade/whatsapp', { body: payload })
  },

  async deleteWhatsapp(id: string) {
    await apiClient.delete(`/notificacoes-disponibilidade/whatsapp/${id}`)
  },

  // --- Notificações multi-contrato ---

  async getAllEmails(contratoIds: string[]) {
    return apiClient.get<Array<{ id: string; contrato_id: string; email: string; nome: string | null; descricao: string | null; ativo: boolean }>>('/notificacoes-disponibilidade/emails', { params: { contrato_ids: contratoIds.join(',') } })
  },

  async getAllWhatsapps(contratoIds: string[]) {
    return apiClient.get<Array<{ id: string; contrato_id: string; numero: string; nome: string | null; descricao: string | null; ativo: boolean }>>('/notificacoes-disponibilidade/whatsapp', { params: { contrato_ids: contratoIds.join(',') } })
  },

  async syncEmailContratos(email: string, nome: string | null, descricao: string | null, contratoIds: string[], allContratoIds: string[]) {
    // Sync via individual API calls (backend handles IDOR)
    const toRemove = allContratoIds.filter(c => !contratoIds.includes(c))
    for (const cid of toRemove) {
      const existing = await this.getEmailsPorContrato(cid)
      const match = existing.find(e => e.email.toLowerCase() === email.toLowerCase())
      if (match) await this.deleteEmail(match.id)
    }
    for (const cid of contratoIds) {
      const existing = await this.getEmailsPorContrato(cid)
      const match = existing.find(e => e.email.toLowerCase() === email.toLowerCase())
      if (match) {
        await this.upsertEmail({ id: match.id, contrato_id: cid, email: email.toLowerCase(), nome, descricao, ativo: true })
      } else {
        await this.upsertEmail({ contrato_id: cid, email: email.toLowerCase(), nome, descricao, ativo: true })
      }
    }
  },

  async syncWhatsappContratos(numero: string, nome: string | null, descricao: string | null, contratoIds: string[], allContratoIds: string[]) {
    const cleanNum = numero.replace(/\D/g, '')
    const toRemove = allContratoIds.filter(c => !contratoIds.includes(c))
    for (const cid of toRemove) {
      const existing = await this.getWhatsappPorContrato(cid)
      const match = existing.find(w => w.numero === cleanNum)
      if (match) await this.deleteWhatsapp(match.id)
    }
    for (const cid of contratoIds) {
      const existing = await this.getWhatsappPorContrato(cid)
      const match = existing.find(w => w.numero === cleanNum)
      if (match) {
        await this.upsertWhatsapp({ id: match.id, contrato_id: cid, numero: cleanNum, nome, descricao, ativo: true })
      } else {
        await this.upsertWhatsapp({ contrato_id: cid, numero: cleanNum, nome, descricao, ativo: true })
      }
    }
  },

  async deleteEmailByAddress(email: string, contratoIds: string[]) {
    for (const cid of contratoIds) {
      const existing = await this.getEmailsPorContrato(cid)
      const match = existing.find(e => e.email.toLowerCase() === email.toLowerCase())
      if (match) await this.deleteEmail(match.id)
    }
  },

  async deleteWhatsappByNumero(numero: string, contratoIds: string[]) {
    const cleanNum = numero.replace(/\D/g, '')
    for (const cid of contratoIds) {
      const existing = await this.getWhatsappPorContrato(cid)
      const match = existing.find(w => w.numero === cleanNum)
      if (match) await this.deleteWhatsapp(match.id)
    }
  },
}
