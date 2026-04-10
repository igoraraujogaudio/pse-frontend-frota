// =============================================
// CÓDIGOS DE PERMISSÕES - TRANSFERÊNCIAS E EMPRÉSTIMOS
// =============================================
// Códigos das funcionalidades modulares para controle de acesso
// =============================================

export const TRANSFERENCIAS_PERMISSIONS = {
  // Visualização
  VISUALIZAR: 'ALMOXARIFADO.TRANSFERENCIAS.VISUALIZAR',
  
  // Criar/Solicitar
  CRIAR: 'ALMOXARIFADO.TRANSFERENCIAS.CRIAR',
  
  // Aprovar
  APROVAR: 'ALMOXARIFADO.TRANSFERENCIAS.APROVAR',
  
  // Enviar/Despachar
  ENVIAR: 'ALMOXARIFADO.TRANSFERENCIAS.ENVIAR',
  
  // Receber
  RECEBER: 'ALMOXARIFADO.TRANSFERENCIAS.RECEBER',
  
  // Cancelar
  CANCELAR: 'ALMOXARIFADO.TRANSFERENCIAS.CANCELAR',
  
  // Editar
  EDITAR: 'ALMOXARIFADO.TRANSFERENCIAS.EDITAR',
  
  // Histórico
  HISTORICO: 'ALMOXARIFADO.TRANSFERENCIAS.HISTORICO',
  
  // Relatórios
  RELATORIOS: 'ALMOXARIFADO.TRANSFERENCIAS.RELATORIOS',
  
  // Estatísticas
  ESTATISTICAS: 'ALMOXARIFADO.TRANSFERENCIAS.ESTATISTICAS',
} as const

export const EMPRESTIMOS_TERCEIROS_PERMISSIONS = {
  // Visualização
  VISUALIZAR: 'ALMOXARIFADO.EMPRESTIMOS_TERCEIROS.VISUALIZAR',
  
  // Criar Empréstimo
  CRIAR: 'ALMOXARIFADO.EMPRESTIMOS_TERCEIROS.CRIAR',
  
  // Registrar Devolução
  DEVOLVER: 'ALMOXARIFADO.EMPRESTIMOS_TERCEIROS.DEVOLVER',
  
  // Baixar/Cancelar
  BAIXAR: 'ALMOXARIFADO.EMPRESTIMOS_TERCEIROS.BAIXAR',
  
  // Gerenciar Empresas
  GERENCIAR_EMPRESAS: 'ALMOXARIFADO.EMPRESTIMOS_TERCEIROS.GERENCIAR_EMPRESAS',
  
  // Logs
  LOGS: 'ALMOXARIFADO.EMPRESTIMOS_TERCEIROS.LOGS',
  
  // Relatórios
  RELATORIOS: 'ALMOXARIFADO.EMPRESTIMOS_TERCEIROS.RELATORIOS',
  
  // Estatísticas
  ESTATISTICAS: 'ALMOXARIFADO.EMPRESTIMOS_TERCEIROS.ESTATISTICAS',
} as const

// Tipo helper para TypeScript
export type TransferenciasPermission = typeof TRANSFERENCIAS_PERMISSIONS[keyof typeof TRANSFERENCIAS_PERMISSIONS]
export type EmprestimosTerceirosPermission = typeof EMPRESTIMOS_TERCEIROS_PERMISSIONS[keyof typeof EMPRESTIMOS_TERCEIROS_PERMISSIONS]

// Array com todas as permissões de transferências (útil para verificação múltipla)
export const ALL_TRANSFERENCIAS_PERMISSIONS = Object.values(TRANSFERENCIAS_PERMISSIONS)

// Array com todas as permissões de empréstimos (útil para verificação múltipla)
export const ALL_EMPRESTIMOS_TERCEIROS_PERMISSIONS = Object.values(EMPRESTIMOS_TERCEIROS_PERMISSIONS)

// Exemplo de uso:
// import { TRANSFERENCIAS_PERMISSIONS } from '@/constants/permissions-transferencias-emprestimos'
// import { useModularPermissions } from '@/hooks/useModularPermissions'
//
// const { hasPermission } = useModularPermissions()
//
// if (hasPermission(TRANSFERENCIAS_PERMISSIONS.CRIAR)) {
//   // Mostrar botão de criar transferência
// }




