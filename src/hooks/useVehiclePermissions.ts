import { useModularPermissions, PERMISSION_CODES } from './useModularPermissions';
import { useCallback } from 'react';

/**
 * Hook otimizado para permissões de veículos
 * Pré-carrega e cacheia as permissões mais comuns relacionadas a veículos
 */
export function useVehiclePermissions() {
  const { hasPermission, permissionsLoaded, loading } = useModularPermissions();

  // Funções otimizadas para verificar permissões específicas
  const hasVehiclePermission = useCallback((codigo: string): boolean => {
    return hasPermission(codigo);
  }, [hasPermission]);

  const hasAnyVehiclePermission = useCallback((codigos: string[]): boolean => {
    return codigos.some(codigo => hasPermission(codigo));
  }, [hasPermission]);

  const hasAllVehiclePermissions = useCallback((codigos: string[]): boolean => {
    return codigos.every(codigo => hasPermission(codigo));
  }, [hasPermission]);

  return {
    // Estados
    loading: loading || !permissionsLoaded,
    permissionsLoaded,
    
    // Verificações otimizadas
    hasVehiclePermission,
    hasAnyVehiclePermission,
    hasAllVehiclePermissions,
    
    // Permissões específicas pré-carregadas (SITE WEB)
    canViewDashboard: hasVehiclePermission(PERMISSION_CODES.VEICULOS.DASHBOARD_FROTA),
    canCreateVehicle: hasVehiclePermission(PERMISSION_CODES.VEICULOS.CADASTRAR_VEICULO),
    canEditVehicle: hasVehiclePermission(PERMISSION_CODES.VEICULOS.EDITAR_VEICULO),
    canViewReports: hasVehiclePermission(PERMISSION_CODES.VEICULOS.RELATORIO_FROTA),
    canViewDevolved: hasVehiclePermission(PERMISSION_CODES.VEICULOS.VISUALIZAR_DEVOLVIDOS_DESMOBILIZADOS),
    canDevolveVehicle: hasVehiclePermission(PERMISSION_CODES.VEICULOS.DEVOLVER_VEICULO),
    canDismobilizeVehicle: hasVehiclePermission(PERMISSION_CODES.VEICULOS.DESMOBILIZAR_VEICULO),
    canReactivateVehicle: hasVehiclePermission(PERMISSION_CODES.VEICULOS.REATIVAR_VEICULO),
    canManageComplete: hasVehiclePermission(PERMISSION_CODES.VEICULOS.GESTAO_COMPLETA_FROTA),
    canConfigureTypes: hasVehiclePermission(PERMISSION_CODES.VEICULOS.CONFIGURAR_TIPOS_VEICULO),
    canManageDocuments: hasVehiclePermission(PERMISSION_CODES.VEICULOS.GESTAO_DOCUMENTOS_FROTA),
    canViewCostReports: hasVehiclePermission(PERMISSION_CODES.VEICULOS.RELATORIO_CUSTOS_FROTA),
    canPlanRenewal: hasVehiclePermission(PERMISSION_CODES.VEICULOS.PLANEJAMENTO_RENOVACAO_FROTA),
    canControlFuel: hasVehiclePermission(PERMISSION_CODES.VEICULOS.CONTROLE_COMBUSTIVEL),
    canManageInsurance: hasVehiclePermission(PERMISSION_CODES.VEICULOS.GESTAO_SEGURO_FROTA),
  };
}
