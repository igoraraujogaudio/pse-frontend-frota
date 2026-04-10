// =============================================
// Tipos para Sistema de Almoxarifado - Inventário
// =============================================

// Tipo de item (categorização)
export interface TipoItem {
  id: string
  codigo: string
  nome: string
  descricao?: string
  categoria: 'epi' | 'ferramental' | 'consumivel' | 'equipamento' | 'ferramenta_especializada'
  subcategoria?: string
  unidade_medida: string
  requer_certificacao: boolean
  requer_laudo: boolean
  frequencia_laudo?: number // em dias
  observacoes?: string
  criado_em: string
  atualizado_em: string
}

// Inventário por funcionário
export interface InventarioFuncionario {
  id: string
  funcionario_id: string
  item_estoque_id: string
  quantidade: number
  data_entrega: string
  data_devolucao?: string
  data_vencimento?: string
  status: 'em_uso' | 'devolvido' | 'perdido' | 'danificado' | 'vencido' | 'em_manutencao'
  condicao_entrega?: 'novo' | 'usado_bom' | 'usado_regular' | 'danificado'
  condicao_atual?: 'bom' | 'regular' | 'danificado' | 'perdido'
  observacoes_entrega?: string
  observacoes_devolucao?: string
  responsavel_entrega: string
  responsavel_devolucao?: string
  local_entrega?: string
  local_atual?: string
  numero_laudo?: string
  validade_laudo?: string
  base_origem_id?: string
  criado_em: string
  atualizado_em: string

  // Campos relacionados
  funcionario?: {
    id?: string
    nome: string
    matricula: string
    departamento?: string
  }
  tipo_item?: TipoItem
  item_estoque?: {
    id?: string
    nome?: string
    codigo?: string
    categoria?: string
  }

  responsavel_entrega_info?: {
    nome: string
  }
  responsavel_devolucao_info?: {
    nome: string
  }
}


// Inventário por equipe
export interface InventarioEquipe {
  id: string
  equipe_id: string
  item_estoque_id: string
  quantidade_total: number
  quantidade_disponivel: number
  quantidade_em_uso: number
  data_entrega: string
  data_devolucao?: string
  status: 'ativo' | 'inativo' | 'em_manutencao' | 'descontinuado'
  local_armazenamento?: string
  responsavel_equipe: string
  observacoes?: string
  numero_laudo?: string
  validade_laudo?: string
  criado_em: string
  atualizado_em: string

  // Campos relacionados
  equipe?: {
    nome: string
    status: string
  }
  tipo_item?: TipoItem
  item_estoque?: {
    id?: string
    nome?: string
    codigo?: string
    categoria?: string
  }
  responsavel_equipe_info?: {
    nome: string
  }
}

// Item específico da equipe
export interface ItemEquipe {
  id: string
  equipe_id: string
  tipo_item_id: string
  codigo_patrimonio?: string
  numero_serie?: string
  modelo?: string
  fabricante?: string
  data_aquisicao?: string
  valor_aquisicao?: number
  localizacao_atual?: string
  status: 'ativo' | 'inativo' | 'em_manutencao' | 'descontinuado' | 'emprestado'
  condicao_atual: 'excelente' | 'bom' | 'regular' | 'ruim' | 'danificado'
  responsavel_atual?: string
  observacoes?: string
  criado_em: string
  atualizado_em: string

  // Campos relacionados
  equipe?: {
    nome: string
    status: string
  }
  tipo_item?: TipoItem
  responsavel_atual_info?: {
    nome: string
  }
}

// Laudo técnico para item da equipe
export interface LaudoItemEquipe {
  id: string
  item_equipe_id: string
  tipo_laudo: 'calibracao' | 'inspecao' | 'manutencao' | 'certificacao' | 'outro'
  numero_laudo?: string
  data_laudo: string
  data_vencimento: string
  responsavel_laudo?: string
  empresa_laudo?: string
  resultado: 'aprovado' | 'reprovado' | 'condicional' | 'pendente'
  observacoes?: string
  arquivo_laudo?: string
  proxima_inspecao?: string
  criado_em: string
  atualizado_em: string

  // Campos relacionados
  item_equipe?: ItemEquipe
}

// Histórico de movimentações dos itens da equipe
export interface HistoricoMovimentacaoItemEquipe {
  id: string
  item_equipe_id: string
  tipo_movimentacao: 'entrega' | 'devolucao' | 'transferencia' | 'emprestimo' | 'devolucao_emprestimo' | 'manutencao' | 'calibracao'
  usuario_origem?: string
  usuario_destino?: string
  local_origem?: string
  local_destino?: string
  data_movimentacao: string
  motivo?: string
  observacoes?: string
  responsavel_movimentacao: string
  criado_em: string

  // Campos relacionados
  item_equipe?: ItemEquipe
  usuario_origem_info?: {
    nome: string
  }
  usuario_destino_info?: {
    nome: string
  }
  responsavel_movimentacao_info?: {
    nome: string
  }
}

// Resumo do inventário por funcionário
export interface InventarioFuncionarioResumo {
  funcionario_id: string
  funcionario_nome: string
  matricula: string
  departamento: string
  total_itens_em_uso: number
  itens_em_uso: number
  itens_devolvidos: number
  itens_perdidos: number
  itens_danificados: number
  itens_vencidos: number
  itens_vencendo_30_dias: number
  ultima_entrega?: string
  ultima_atualizacao?: string
}

// Resumo do inventário por equipe
export interface InventarioEquipeResumo {
  equipe_id: string
  equipe_nome: string
  status_equipe: string
  local_equipe?: string
  tipos_itens_diferentes: number
  total_itens: number
  itens_disponiveis: number
  itens_em_uso: number
  itens_ativos: number
  itens_manutencao: number
  ultima_atualizacao?: string
}

// Item da equipe com informações de laudo
export interface ItemEquipeComLaudo {
  item_id: string
  codigo_patrimonio?: string
  numero_serie?: string
  modelo?: string
  fabricante?: string
  equipe_nome: string
  tipo_item: string
  categoria: string
  status_item: string
  condicao_atual: string
  responsavel_atual?: string
  ultimo_laudo?: string
  vencimento_laudo?: string
  resultado_ultimo_laudo?: string
  status_laudo: 'sem_laudo' | 'vencido' | 'vencendo' | 'valido'
  criado_em: string
  atualizado_em: string
}

// Estatísticas do inventário
export interface EstatisticasInventario {
  total_funcionarios_com_itens: number
  total_equipes_com_itens: number
  total_itens_em_uso_funcionarios: number
  total_itens_equipes: number
  itens_vencendo_30_dias: number
  laudos_vencendo_30_dias: number
  itens_por_categoria: Record<string, number>
  equipe_especifica?: {
    nome_equipe: string
    total_itens: number
    itens_ativos: number
    itens_manutencao: number
    laudos_vencendo: number
  }
}

// Formulário para criar/editar tipo de item
export interface FormTipoItem {
  codigo?: string
  nome: string
  descricao?: string
  categoria: 'epi' | 'ferramental' | 'consumivel' | 'equipamento' | 'ferramenta_especializada'
  subcategoria?: string
  unidade_medida: string
  requer_certificacao: boolean
  requer_laudo: boolean
  frequencia_laudo?: number
  observacoes?: string
}

// Formulário para inventário de funcionário
export interface FormInventarioFuncionario {
  funcionario_id: string
  tipo_item_id: string
  quantidade: number
  data_entrega: string
  data_vencimento?: string
  condicao_entrega?: 'novo' | 'usado_bom' | 'usado_regular' | 'danificado'
  observacoes_entrega?: string
  local_entrega?: string
}

// Formulário para inventário de equipe
export interface FormInventarioEquipe {
  equipe_id: string
  tipo_item_id: string
  quantidade_total: number
  local_armazenamento?: string
  observacoes?: string
}

// Formulário para item da equipe
export interface FormItemEquipe {
  equipe_id: string
  tipo_item_id: string
  codigo_patrimonio?: string
  numero_serie?: string
  modelo?: string
  fabricante?: string
  data_aquisicao?: string
  valor_aquisicao?: number
  localizacao_atual?: string
  condicao_atual: 'excelente' | 'bom' | 'regular' | 'ruim' | 'danificado'
  responsavel_atual?: string
  observacoes?: string
}

// Formulário para laudo
export interface FormLaudoItemEquipe {
  item_equipe_id: string
  tipo_laudo: 'calibracao' | 'inspecao' | 'manutencao' | 'certificacao' | 'outro'
  numero_laudo?: string
  data_laudo: string
  data_vencimento: string
  responsavel_laudo?: string
  empresa_laudo?: string
  resultado: 'aprovado' | 'reprovado' | 'condicional' | 'pendente'
  observacoes?: string
  arquivo_laudo?: string
  proxima_inspecao?: string
}

// Filtros para consultas
export interface FiltrosInventarioFuncionario {
  funcionario_id?: string
  tipo_item_id?: string
  status?: string
  data_inicio?: string
  data_fim?: string
  categoria?: string
}

export interface FiltrosInventarioEquipe {
  equipe_id?: string
  tipo_item_id?: string
  status?: string
  categoria?: string
}

export interface FiltrosItensEquipe {
  equipe_id?: string
  tipo_item_id?: string
  status?: string
  condicao_atual?: string
  status_laudo?: string
}

// Resposta da API
export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

// Paginação
export interface PaginationParams {
  page: number
  limit: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

export interface PaginatedResponse<T> {
  data: T[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}
