import { useModularPermissions } from './useModularPermissions'
import { PERMISSION_CODES } from './useModularPermissions'

export const useWebAlmoxarifadoPermissions = () => {
  const { hasPermission, hasAnyPermission, hasAllPermissions, loading, permissionsLoaded } = useModularPermissions()

  return {
    // Permissões básicas
    canViewDashboard: () => hasPermission(PERMISSION_CODES.ALMOXARIFADO.DASHBOARD),
    canViewStock: () => hasPermission(PERMISSION_CODES.ALMOXARIFADO.VISUALIZAR_ESTOQUE),
    canViewRequests: () => hasPermission(PERMISSION_CODES.ALMOXARIFADO.VISUALIZAR_SOLICITACOES),
    
    // Permissões específicas para criação e edição de itens (Web)
    canCreateNewItem: () => hasPermission(PERMISSION_CODES.ALMOXARIFADO.CRIAR_NOVO_ITEM_WEB),
    canEditItemQuantity: () => hasPermission(PERMISSION_CODES.ALMOXARIFADO.EDITAR_QUANTIDADE_ITEM_WEB),
    canEditItemData: () => hasPermission(PERMISSION_CODES.ALMOXARIFADO.EDITAR_DADOS_ITEM_WEB),
    canDeleteItem: () => hasPermission(PERMISSION_CODES.ALMOXARIFADO.EXCLUIR_ITEM_WEB),
    
    // Permissões específicas para criação e edição de itens (Mobile)
    canCreateNewItemMobile: () => hasPermission(PERMISSION_CODES.ALMOXARIFADO.CRIAR_NOVO_ITEM),
    canEditItemQuantityMobile: () => hasPermission(PERMISSION_CODES.ALMOXARIFADO.EDITAR_QUANTIDADE_ITEM),
    canEditItemDataMobile: () => hasPermission(PERMISSION_CODES.ALMOXARIFADO.EDITAR_DADOS_ITEM),
    canDeleteItemMobile: () => hasPermission(PERMISSION_CODES.ALMOXARIFADO.EXCLUIR_ITEM),
    
    // Permissões de estoque geral
    canEditStock: () => hasPermission(PERMISSION_CODES.ALMOXARIFADO.EDITAR_QUANTIDADE_ITEM_WEB),
    canManageStock: () => hasPermission(PERMISSION_CODES.ALMOXARIFADO.CRIAR_NOVO_ITEM_WEB),
    canCreateInventory: () => hasPermission(PERMISSION_CODES.ALMOXARIFADO.CRIAR_INVENTARIO),
    canUpdateInventory: () => hasPermission(PERMISSION_CODES.ALMOXARIFADO.ATUALIZAR_INVENTARIO),
    
    // Permissões de solicitações
    canRequestMaterial: () => hasPermission(PERMISSION_CODES.ALMOXARIFADO.SOLICITAR_MATERIAL),
    canRequestItem: () => hasPermission(PERMISSION_CODES.ALMOXARIFADO.SOLICITAR_ITEM),
    canApproveRequests: () => hasPermission(PERMISSION_CODES.ALMOXARIFADO.APROVAR_SOLICITACOES),
    canApproveRequest: () => hasPermission(PERMISSION_CODES.ALMOXARIFADO.APROVAR_SOLICITACAO),
    canDeliverMaterial: () => hasPermission(PERMISSION_CODES.ALMOXARIFADO.ENTREGAR_MATERIAL),
    canControlDelivery: () => hasPermission(PERMISSION_CODES.ALMOXARIFADO.CONTROLE_ENTREGA),
    
    // Permissões de NF
    canRegisterNF: () => hasPermission(PERMISSION_CODES.ALMOXARIFADO.CADASTRAR_NF_WEB),
    
    // Permissões de EPI
    canRequestIndividualEPI: () => hasPermission(PERMISSION_CODES.ALMOXARIFADO.SOLICITAR_EPI_INDIVIDUAL),
    canRequestTeamEPI: () => hasPermission(PERMISSION_CODES.ALMOXARIFADO.SOLICITAR_EPI_EQUIPE),
    canRequestEmergencyEPI: () => hasPermission(PERMISSION_CODES.ALMOXARIFADO.SOLICITAR_EPI_EMERGENCIAL),
    canCheckEPIAvailable: () => hasPermission(PERMISSION_CODES.ALMOXARIFADO.VERIFICAR_EPI_DISPONIVEL),
    canApproveBasicEPI: () => hasPermission(PERMISSION_CODES.ALMOXARIFADO.APROVAR_EPI_BASICO),
    canApproveSpecialEPI: () => hasPermission(PERMISSION_CODES.ALMOXARIFADO.APROVAR_EPI_ESPECIAL),
    canApproveEmergencyEPI: () => hasPermission(PERMISSION_CODES.ALMOXARIFADO.APROVAR_EPI_EMERGENCIAL),
    canDeliverIndividualEPI: () => hasPermission(PERMISSION_CODES.ALMOXARIFADO.ENTREGAR_EPI_INDIVIDUAL),
    canDeliverBatchEPI: () => hasPermission(PERMISSION_CODES.ALMOXARIFADO.ENTREGAR_EPI_LOTE),
    canRegisterEPIReturn: () => hasPermission(PERMISSION_CODES.ALMOXARIFADO.REGISTRAR_DEVOLUCAO_EPI),
    canControlEPIExpiry: () => hasPermission(PERMISSION_CODES.ALMOXARIFADO.CONTROLAR_VENCIMENTO_EPI),
    canViewEPIHistory: () => hasPermission(PERMISSION_CODES.ALMOXARIFADO.HISTORICO_EPI_COLABORADOR),
    
    // Permissões de funcionalidades avançadas
    canScanBarcode: () => hasPermission(PERMISSION_CODES.ALMOXARIFADO.SCANNER_CODIGO_BARRAS),
    canReceivePushNotifications: () => hasPermission(PERMISSION_CODES.ALMOXARIFADO.NOTIFICACOES_PUSH),
    canSyncOffline: () => hasPermission(PERMISSION_CODES.ALMOXARIFADO.OFFLINE_SYNC),
    canViewMobileReports: () => hasPermission(PERMISSION_CODES.ALMOXARIFADO.RELATORIO_MOBILE),
    canControlLocation: () => hasPermission(PERMISSION_CODES.ALMOXARIFADO.CONTROLE_LOCALIZACAO),
    
    // Permissões combinadas
    canManageStockCompletely: () => hasAnyPermission([
      PERMISSION_CODES.ALMOXARIFADO.CRIAR_NOVO_ITEM_WEB,
      PERMISSION_CODES.ALMOXARIFADO.EDITAR_QUANTIDADE_ITEM_WEB,
      PERMISSION_CODES.ALMOXARIFADO.EDITAR_DADOS_ITEM_WEB,
      PERMISSION_CODES.ALMOXARIFADO.EXCLUIR_ITEM_WEB
    ]),
    
    canFullStockManagement: () => hasAllPermissions([
      PERMISSION_CODES.ALMOXARIFADO.CRIAR_NOVO_ITEM_WEB,
      PERMISSION_CODES.ALMOXARIFADO.EDITAR_DADOS_ITEM_WEB,
      PERMISSION_CODES.ALMOXARIFADO.EXCLUIR_ITEM_WEB
    ]),
    
    canOnlyEditQuantity: () => hasPermission(PERMISSION_CODES.ALMOXARIFADO.EDITAR_QUANTIDADE_ITEM_WEB) && 
      !hasPermission(PERMISSION_CODES.ALMOXARIFADO.CRIAR_NOVO_ITEM_WEB) &&
      !hasPermission(PERMISSION_CODES.ALMOXARIFADO.EDITAR_DADOS_ITEM_WEB) &&
      !hasPermission(PERMISSION_CODES.ALMOXARIFADO.EXCLUIR_ITEM_WEB),
    
    // Verificar se tem acesso básico ao almoxarifado
    hasAlmoxarifadoAccess: () => hasAnyPermission([
      PERMISSION_CODES.ALMOXARIFADO.DASHBOARD,
      PERMISSION_CODES.ALMOXARIFADO.VISUALIZAR_ESTOQUE,
      PERMISSION_CODES.ALMOXARIFADO.VISUALIZAR_SOLICITACOES,
      PERMISSION_CODES.ALMOXARIFADO.SOLICITAR_MATERIAL
    ]),
    
    // Estados de carregamento
    loading,
    permissionsLoaded
  }
}
