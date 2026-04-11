import { apiClient } from '@/lib/apiClient'

export interface ChecklistGrupo {
  id: string; grupo_nome: string; grupo_descricao?: string
  grupo_categoria: 'epi' | 'ferramental' | 'equipamento' | 'documento' | 'outro'
  requer_laudo: boolean; obrigatorio: boolean; permite_qualquer_item: boolean
  ordem_exibicao: number; ativo: boolean; criado_em: string; atualizado_em: string
}

export interface ChecklistGrupoItem {
  id: string; grupo_id: string; item_catalogo_id: string
  obrigatorio_no_grupo: boolean; ordem_no_grupo: number; ativo: boolean
  criado_em: string; atualizado_em: string
}

export interface ChecklistGrupoCompleto extends ChecklistGrupo {
  itens_do_grupo: Array<{
    id: string; item_catalogo_id: string; item_catalogo_nome: string
    item_catalogo_codigo: string; item_catalogo_descricao?: string
    obrigatorio_no_grupo: boolean; ordem_no_grupo: number; ativo: boolean
  }>
  total_itens_grupo: number
}

export interface FormChecklistGrupo {
  grupo_nome: string; grupo_descricao?: string
  grupo_categoria: 'epi' | 'ferramental' | 'equipamento' | 'documento' | 'outro'
  requer_laudo: boolean; obrigatorio: boolean; permite_qualquer_item: boolean
  ordem_exibicao: number; ativo: boolean
}

export interface FormChecklistGrupoItem {
  grupo_id: string; item_catalogo_id: string
  obrigatorio_no_grupo: boolean; ordem_no_grupo: number; ativo: boolean
}

export interface ItemCatalogo {
  id: string; codigo: string; nome: string; descricao?: string; categoria: string
  subcategoria?: string; unidade_medida: string; valor_unitario?: number
  ativo: boolean; criado_em: string; atualizado_em: string
}

export const checklistGrupoService = {
  async getGruposChecklist(filtros?: { categoria?: string; ativo?: boolean; grupo_nome?: string }): Promise<ChecklistGrupo[]> {
    return apiClient.get<ChecklistGrupo[]>('/checklist-grupos', { params: { categoria: filtros?.categoria, ativo: filtros?.ativo?.toString(), busca: filtros?.grupo_nome } })
  },
  async getGrupoChecklistById(id: string): Promise<ChecklistGrupoCompleto | null> {
    try { return await apiClient.get<ChecklistGrupoCompleto>(`/checklist-grupos/${id}`, { silent: true }) } catch { return null }
  },
  async criarGrupoChecklist(dados: FormChecklistGrupo): Promise<ChecklistGrupo> {
    return apiClient.post<ChecklistGrupo>('/checklist-grupos', { body: dados })
  },
  async atualizarGrupoChecklist(id: string, dados: Partial<FormChecklistGrupo>): Promise<ChecklistGrupo> {
    return apiClient.put<ChecklistGrupo>(`/checklist-grupos/${id}`, { body: dados })
  },
  async excluirGrupoChecklist(id: string): Promise<void> {
    await apiClient.delete(`/checklist-grupos/${id}`)
  },
  async getItensGrupoChecklist(grupoId: string): Promise<ChecklistGrupoItem[]> {
    return apiClient.get<ChecklistGrupoItem[]>(`/checklist-grupos/${grupoId}/itens`)
  },
  async getItemGrupoChecklistById(id: string): Promise<ChecklistGrupoItem | null> {
    try { return await apiClient.get<ChecklistGrupoItem>(`/checklist-grupos/itens/${id}`, { silent: true }) } catch { return null }
  },
  async adicionarItemGrupoChecklist(dados: FormChecklistGrupoItem): Promise<ChecklistGrupoItem> {
    return apiClient.post<ChecklistGrupoItem>(`/checklist-grupos/${dados.grupo_id}/itens`, { body: dados })
  },
  async atualizarItemGrupoChecklist(id: string, dados: Partial<FormChecklistGrupoItem>): Promise<ChecklistGrupoItem> {
    return apiClient.put<ChecklistGrupoItem>(`/checklist-grupos/itens/${id}`, { body: dados })
  },
  async excluirItemGrupoChecklist(id: string): Promise<void> {
    await apiClient.delete(`/checklist-grupos/itens/${id}`)
  },
  async reordenarItensGrupo(grupoId: string, itens: Array<{ id: string; ordem_no_grupo: number }>): Promise<void> {
    await apiClient.put(`/checklist-grupos/${grupoId}/itens/reordenar`, { body: { itens } })
  },
  async getItensCatalogoDisponiveisParaGrupo(grupoId?: string): Promise<ItemCatalogo[]> {
    return apiClient.get<ItemCatalogo[]>('/itens-catalogo', { params: { disponiveis_para_grupo: grupoId } })
  },
  async adicionarGrupoChecklistContrato(dados: { contrato_id: string; grupo_id: string; item_id: string; item_nome: string; item_descricao?: string; item_categoria: string; obrigatorio: boolean; requer_laudo: boolean; requer_inventario: boolean; ordem_exibicao: number }): Promise<void> {
    await apiClient.post('/checklist-items-contrato', { body: { ...dados, ativo: true } })
  }
}
