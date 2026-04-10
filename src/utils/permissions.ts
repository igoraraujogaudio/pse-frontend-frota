// Definição dos níveis de acesso e suas hierarquias
export const ACCESS_LEVELS = {
  ADMIN: 'admin',
  DIRETOR: 'diretor',
  MANAGER: 'manager',
  GERENTE: 'gerente',
  GESTOR_FROTA: 'gestor_frota',
  GESTOR: 'gestor',
  COORDENADOR: 'coordenador',
  ENG_SEGURANCA: 'eng_seguranca',
  SUPERVISOR: 'supervisor',
  TST: 'tst',
  PORTARIA: 'portaria',
  ALMOXARIFADO: 'almoxarifado',
  GESTOR_ALMOXARIFADO: 'gestor_almoxarifado',
  OPERACAO: 'operacao',
  RH: 'RH',
} as const;

// Opções completas de níveis de acesso para interfaces
export const NIVEL_ACESSO_OPTIONS = [
  { value: 'admin', label: 'Administrador', description: 'Acesso total ao sistema' },
  { value: 'diretor', label: 'Diretor', description: 'Acesso executivo e estratégico' },
  { value: 'manager', label: 'Manager', description: 'Gerente geral de operações' },
  { value: 'gerente', label: 'Gerente', description: 'Gerente de área específica' },
  { value: 'gestor_frota', label: 'Gestor de Frota', description: 'Gestão da frota de veículos' },
  { value: 'gestor', label: 'Gestor', description: 'Gestão de recursos e equipes' },
  { value: 'gestor_almoxarifado', label: 'Gestor de Almoxarifado', description: 'Gestão completa do almoxarifado' },
  { value: 'coordenador', label: 'Coordenador', description: 'Coordenação de equipes e processos' },
  { value: 'eng_seguranca', label: 'Engenheiro de Segurança', description: 'Engenharia de segurança do trabalho' },
  { value: 'supervisor', label: 'Supervisor', description: 'Supervisão e aprovação operacional' },
  { value: 'tst', label: 'TST', description: 'Técnico em Segurança do Trabalho' },
  { value: 'RH', label: 'RH', description: 'Recursos Humanos' },
  { value: 'portaria', label: 'Portaria', description: 'Controle de acesso e registro de entrada/saída' },
  { value: 'almoxarifado', label: 'Almoxarifado', description: 'Gestão de estoque e materiais' },
  { value: 'operacao', label: 'Operação', description: 'Execução operacional em campo' },
] as const;

// Hierarquia de permissões (do maior para o menor)
export const PERMISSION_HIERARCHY = [
  ACCESS_LEVELS.ADMIN,
  ACCESS_LEVELS.DIRETOR,
  ACCESS_LEVELS.MANAGER,
  ACCESS_LEVELS.GERENTE,
  ACCESS_LEVELS.GESTOR_FROTA,
  ACCESS_LEVELS.GESTOR,
  ACCESS_LEVELS.GESTOR_ALMOXARIFADO,
  ACCESS_LEVELS.COORDENADOR,
  ACCESS_LEVELS.ENG_SEGURANCA,
  ACCESS_LEVELS.SUPERVISOR,
  ACCESS_LEVELS.TST,
  ACCESS_LEVELS.RH,
  ACCESS_LEVELS.PORTARIA,
  ACCESS_LEVELS.ALMOXARIFADO,
  ACCESS_LEVELS.OPERACAO,
];

/**
 * Verifica se o usuário tem permissão para acessar uma funcionalidade
 * @param userLevel - Nível de acesso do usuário
 * @param requiredLevel - Nível mínimo necessário
 * @returns true se o usuário tem permissão
 */
export function hasPermission(userLevel: string | undefined, requiredLevel: string): boolean {
  if (!userLevel) return false;

  const userIndex = PERMISSION_HIERARCHY.indexOf(userLevel as (typeof PERMISSION_HIERARCHY)[number]);
  const requiredIndex = PERMISSION_HIERARCHY.indexOf(requiredLevel as (typeof PERMISSION_HIERARCHY)[number]);

  // Se não encontrou o nível, nega acesso
  if (userIndex === -1 || requiredIndex === -1) return false;

  // Quanto menor o índice, maior a permissão
  return userIndex <= requiredIndex;
}

/**
 * Verifica se o usuário é gestor ou superior (manager, gestor_frota, admin)
 */
export function isManagerOrAbove(userLevel: string | undefined): boolean {
  return hasPermission(userLevel, ACCESS_LEVELS.MANAGER);
}

/**
 * Verifica se o usuário é supervisor ou superior
 */
export function isSupervisorOrAbove(userLevel: string | undefined): boolean {
  return hasPermission(userLevel, ACCESS_LEVELS.SUPERVISOR);
}

/**
 * Verifica se o usuário pode acessar o controle de usuários
 */
export function canAccessUserManagement(userLevel: string | undefined): boolean {
  return isManagerOrAbove(userLevel);
}

/**
 * Verifica se o usuário pode ver todas as funcionalidades do sistema
 */
export function canAccessAllFeatures(userLevel: string | undefined): boolean {
  return isSupervisorOrAbove(userLevel);
}

/**
 * Verifica se o usuário tem acesso total ao almoxarifado
 */
export function hasFullAlmoxarifadoAccess(userLevel: string | undefined): boolean {
  const allowedLevels = [
    ACCESS_LEVELS.ADMIN,
    ACCESS_LEVELS.DIRETOR,
    ACCESS_LEVELS.MANAGER,
    ACCESS_LEVELS.GESTOR_ALMOXARIFADO,
    ACCESS_LEVELS.ALMOXARIFADO
  ] as const;
  return allowedLevels.includes(userLevel as (typeof allowedLevels)[number]);
}

/**
 * Verifica se o usuário pode visualizar dados do almoxarifado
 */
export function canViewAlmoxarifado(userLevel: string | undefined): boolean {
  const allowedLevels = [
    ACCESS_LEVELS.ADMIN,
    ACCESS_LEVELS.DIRETOR,
    ACCESS_LEVELS.MANAGER,
    ACCESS_LEVELS.GESTOR_ALMOXARIFADO,
    ACCESS_LEVELS.ALMOXARIFADO,
    ACCESS_LEVELS.SUPERVISOR
  ] as const;
  return allowedLevels.includes(userLevel as (typeof allowedLevels)[number]);
}

/**
 * Verifica se o usuário pode solicitar EPI (apenas supervisores, coordenadores e superiores)
 */
export function canRequestEPI(userLevel: string | undefined): boolean {
  const allowedLevels = [
    ACCESS_LEVELS.ADMIN,
    ACCESS_LEVELS.DIRETOR,
    ACCESS_LEVELS.MANAGER,
    ACCESS_LEVELS.GERENTE,
    ACCESS_LEVELS.GESTOR_FROTA,
    ACCESS_LEVELS.GESTOR,
    ACCESS_LEVELS.GESTOR_ALMOXARIFADO,
    ACCESS_LEVELS.COORDENADOR,
    ACCESS_LEVELS.SUPERVISOR
  ] as const;
  return allowedLevels.includes(userLevel as (typeof allowedLevels)[number]);
}

/**
 * Verifica se o usuário é coordenador ou superior
 */
export function isCoordenadorOrAbove(userLevel: string | undefined): boolean {
  return hasPermission(userLevel, ACCESS_LEVELS.COORDENADOR);
}

/**
 * Verifica se o usuário é coordenador especificamente
 */
export function isCoordenador(userLevel: string | undefined): boolean {
  return userLevel === ACCESS_LEVELS.COORDENADOR;
}

/**
 * Verifica se o usuário pode ver todas as operações (coordenador ou superior)
 */
export function canViewAllOperations(userLevel: string | undefined): boolean {
  return isCoordenadorOrAbove(userLevel);
}

/**
 * Verifica se o usuário pode aprovar checklists de todas as operações (coordenador ou superior)
 */
export function canApproveAllChecklists(userLevel: string | undefined): boolean {
  return isCoordenadorOrAbove(userLevel);
}

/**
 * Verifica se o usuário pode ver todas as solicitações de EPI (coordenador ou superior)
 */
export function canViewAllEPIRequests(userLevel: string | undefined): boolean {
  return isCoordenadorOrAbove(userLevel);
}

/**
 * Verifica se um usuário pode gerenciar outro usuário baseado na hierarquia
 * @param managerLevel - Nível do usuário que quer gerenciar
 * @param targetLevel - Nível do usuário alvo
 * @returns true se o manager pode gerenciar o target
 */
export function canManageUser(managerLevel: string | undefined, targetLevel: string | undefined): boolean {
  if (!managerLevel || !targetLevel) return false;

  const managerIndex = PERMISSION_HIERARCHY.indexOf(managerLevel as (typeof PERMISSION_HIERARCHY)[number]);
  const targetIndex = PERMISSION_HIERARCHY.indexOf(targetLevel as (typeof PERMISSION_HIERARCHY)[number]);

  // Se não encontrou os níveis, nega acesso
  if (managerIndex === -1 || targetIndex === -1) return false;

  // Manager deve ter nível superior (índice menor) que o target
  return managerIndex < targetIndex;
}

/**
 * Filtra usuários que o usuário atual pode gerenciar
 * @param currentUserLevel - Nível do usuário atual
 * @param users - Lista de usuários
 * @returns Lista filtrada de usuários
 */
export function filterManageableUsers<T extends { nivel_acesso: string }>(
  currentUserLevel: string | undefined,
  users: T[]
): T[] {
  if (!currentUserLevel) return [];

  // Admin pode ver todos
  if (currentUserLevel === ACCESS_LEVELS.ADMIN) return users;

  return users.filter(user => canManageUser(currentUserLevel, user.nivel_acesso));
}

/**
 * Verifica se o usuário é Engenheiro de Segurança do Trabalho ou superior
 */
export function isEngSegurancaOrAbove(userLevel: string | undefined): boolean {
  return hasPermission(userLevel, ACCESS_LEVELS.ENG_SEGURANCA);
}

/**
 * Verifica se o usuário é Engenheiro de Segurança do Trabalho especificamente
 */
export function isEngSeguranca(userLevel: string | undefined): boolean {
  return userLevel === ACCESS_LEVELS.ENG_SEGURANCA;
}

/**
 * Verifica se o usuário é TST ou superior
 */
export function isTSTOrAbove(userLevel: string | undefined): boolean {
  return hasPermission(userLevel, ACCESS_LEVELS.TST);
}

/**
 * Verifica se o usuário é TST especificamente
 */
export function isTST(userLevel: string | undefined): boolean {
  return userLevel === ACCESS_LEVELS.TST;
}

/**
 * Verifica se o usuário pode acessar funcionalidades de segurança do trabalho
 */
export function canAccessSeguranca(userLevel: string | undefined): boolean {
  const allowedLevels = [
    ACCESS_LEVELS.ADMIN,
    ACCESS_LEVELS.DIRETOR,
    ACCESS_LEVELS.MANAGER,
    ACCESS_LEVELS.GERENTE,
    ACCESS_LEVELS.COORDENADOR,
    ACCESS_LEVELS.ENG_SEGURANCA,
    ACCESS_LEVELS.SUPERVISOR,
    ACCESS_LEVELS.TST
  ] as const;
  return allowedLevels.includes(userLevel as (typeof allowedLevels)[number]);
}

/**
 * Verifica se o usuário pode aprovar procedimentos de segurança
 */
export function canApproveSegurancaProcedures(userLevel: string | undefined): boolean {
  const allowedLevels = [
    ACCESS_LEVELS.ADMIN,
    ACCESS_LEVELS.DIRETOR,
    ACCESS_LEVELS.MANAGER,
    ACCESS_LEVELS.GERENTE,
    ACCESS_LEVELS.COORDENADOR,
    ACCESS_LEVELS.ENG_SEGURANCA
  ] as const;
  return allowedLevels.includes(userLevel as (typeof allowedLevels)[number]);
}

/**
 * Verifica se o usuário pode realizar análises de risco
 */
export function canPerformRiskAnalysis(userLevel: string | undefined): boolean {
  const allowedLevels = [
    ACCESS_LEVELS.ADMIN,
    ACCESS_LEVELS.DIRETOR,
    ACCESS_LEVELS.MANAGER,
    ACCESS_LEVELS.GERENTE,
    ACCESS_LEVELS.COORDENADOR,
    ACCESS_LEVELS.ENG_SEGURANCA
  ] as const;
  return allowedLevels.includes(userLevel as (typeof allowedLevels)[number]);
}

/**
 * Verifica se o usuário pode realizar inspeções de segurança
 */
export function canPerformSafetyInspections(userLevel: string | undefined): boolean {
  const allowedLevels = [
    ACCESS_LEVELS.ADMIN,
    ACCESS_LEVELS.DIRETOR,
    ACCESS_LEVELS.MANAGER,
    ACCESS_LEVELS.GERENTE,
    ACCESS_LEVELS.COORDENADOR,
    ACCESS_LEVELS.ENG_SEGURANCA,
    ACCESS_LEVELS.SUPERVISOR,
    ACCESS_LEVELS.TST
  ] as const;
  return allowedLevels.includes(userLevel as (typeof allowedLevels)[number]);
}