// ============================================================================
// UTILITÁRIOS PARA PERFIS DE ACESSO
// ============================================================================
// Funções para trabalhar com perfis de acesso e níveis de acesso
// ============================================================================

export interface PerfilAcesso {
  id: string;
  codigo: string;
  nome: string;
  descricao?: string;
  nivel_hierarquia: number;
  cor?: string;
  ativo: boolean;
}

// ============================================================================
// FUNÇÕES PRINCIPAIS
// ============================================================================

/**
 * Obtém o nível de acesso (código) pelo ID do perfil
 * @param perfilId - ID do perfil de acesso
 * @param perfisAcesso - Lista de perfis de acesso
 * @returns Código do nível de acesso ou 'operacao' como padrão
 */
export const getNivelAcessoByPerfil = (perfilId: string, perfisAcesso: PerfilAcesso[]): string => {
  const perfil = perfisAcesso.find(p => p.id === perfilId);
  return perfil?.codigo || 'operacao';
};

/**
 * Obtém o nome do perfil pelo ID
 * @param perfilId - ID do perfil de acesso
 * @param perfisAcesso - Lista de perfis de acesso
 * @returns Nome do perfil ou 'N/A' se não encontrado
 */
export const getNomePerfilById = (perfilId: string, perfisAcesso: PerfilAcesso[]): string => {
  const perfil = perfisAcesso.find(p => p.id === perfilId);
  return perfil?.nome || 'N/A';
};

/**
 * Obtém a cor do perfil pelo ID
 * @param perfilId - ID do perfil de acesso
 * @param perfisAcesso - Lista de perfis de acesso
 * @returns Cor do perfil ou cor padrão
 */
export const getCorPerfilById = (perfilId: string, perfisAcesso: PerfilAcesso[]): string => {
  const perfil = perfisAcesso.find(p => p.id === perfilId);
  return perfil?.cor || '#6b7280';
};

/**
 * Obtém o nível de hierarquia do perfil pelo ID
 * @param perfilId - ID do perfil de acesso
 * @param perfisAcesso - Lista de perfis de acesso
 * @returns Nível de hierarquia ou 99 como padrão
 */
export const getNivelHierarquiaByPerfil = (perfilId: string, perfisAcesso: PerfilAcesso[]): number => {
  const perfil = perfisAcesso.find(p => p.id === perfilId);
  return perfil?.nivel_hierarquia || 99;
};

// ============================================================================
// FUNÇÕES DE VALIDAÇÃO
// ============================================================================

/**
 * Verifica se um perfil existe
 * @param perfilId - ID do perfil de acesso
 * @param perfisAcesso - Lista de perfis de acesso
 * @returns true se o perfil existe, false caso contrário
 */
export const perfilExiste = (perfilId: string, perfisAcesso: PerfilAcesso[]): boolean => {
  return perfisAcesso.some(p => p.id === perfilId);
};

/**
 * Verifica se um perfil está ativo
 * @param perfilId - ID do perfil de acesso
 * @param perfisAcesso - Lista de perfis de acesso
 * @returns true se o perfil está ativo, false caso contrário
 */
export const perfilAtivo = (perfilId: string, perfisAcesso: PerfilAcesso[]): boolean => {
  const perfil = perfisAcesso.find(p => p.id === perfilId);
  return perfil?.ativo || false;
};

// ============================================================================
// FUNÇÕES DE FILTRO E BUSCA
// ============================================================================

/**
 * Filtra perfis por nível de hierarquia
 * @param perfisAcesso - Lista de perfis de acesso
 * @param nivelMinimo - Nível mínimo de hierarquia
 * @returns Lista de perfis com hierarquia >= nível mínimo
 */
export const filtrarPerfisPorHierarquia = (perfisAcesso: PerfilAcesso[], nivelMinimo: number): PerfilAcesso[] => {
  return perfisAcesso.filter(p => p.nivel_hierarquia >= nivelMinimo);
};

/**
 * Busca perfis por nome ou código
 * @param perfisAcesso - Lista de perfis de acesso
 * @param termo - Termo de busca
 * @returns Lista de perfis que correspondem ao termo
 */
export const buscarPerfis = (perfisAcesso: PerfilAcesso[], termo: string): PerfilAcesso[] => {
  const termoLower = termo.toLowerCase();
  return perfisAcesso.filter(p => 
    p.nome.toLowerCase().includes(termoLower) ||
    p.codigo.toLowerCase().includes(termoLower) ||
    (p.descricao && p.descricao.toLowerCase().includes(termoLower))
  );
};

// ============================================================================
// FUNÇÕES DE ORDENAÇÃO
// ============================================================================

/**
 * Ordena perfis por nível de hierarquia (crescente)
 * @param perfisAcesso - Lista de perfis de acesso
 * @returns Lista ordenada por hierarquia
 */
export const ordenarPerfisPorHierarquia = (perfisAcesso: PerfilAcesso[]): PerfilAcesso[] => {
  return [...perfisAcesso].sort((a, b) => a.nivel_hierarquia - b.nivel_hierarquia);
};

/**
 * Ordena perfis por nome
 * @param perfisAcesso - Lista de perfis de acesso
 * @returns Lista ordenada por nome
 */
export const ordenarPerfisPorNome = (perfisAcesso: PerfilAcesso[]): PerfilAcesso[] => {
  return [...perfisAcesso].sort((a, b) => a.nome.localeCompare(b.nome));
};

// ============================================================================
// FUNÇÕES DE ESTATÍSTICAS
// ============================================================================

/**
 * Conta quantos perfis únicos existem
 * @param perfisAcesso - Lista de perfis de acesso
 * @returns Número de perfis únicos
 */
export const contarPerfisUnicos = (perfisAcesso: PerfilAcesso[]): number => {
  return new Set(perfisAcesso.map(p => p.codigo)).size;
};

/**
 * Obtém estatísticas dos perfis
 * @param perfisAcesso - Lista de perfis de acesso
 * @returns Estatísticas dos perfis
 */
export const obterEstatisticasPerfis = (perfisAcesso: PerfilAcesso[]) => {
  const ativos = perfisAcesso.filter(p => p.ativo).length;
  const inativos = perfisAcesso.filter(p => !p.ativo).length;
  const hierarquiaMinima = Math.min(...perfisAcesso.map(p => p.nivel_hierarquia));
  const hierarquiaMaxima = Math.max(...perfisAcesso.map(p => p.nivel_hierarquia));
  
  return {
    total: perfisAcesso.length,
    ativos,
    inativos,
    hierarquiaMinima,
    hierarquiaMaxima,
    perfisUnicos: contarPerfisUnicos(perfisAcesso)
  };
};
