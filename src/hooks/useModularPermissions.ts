import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import type { 
  FuncionalidadeModular,
  ModuloSistema,
  Plataforma,
  PerfilAcesso,
  UsuarioPermissaoModular
} from '@/types/permissions';

// ============================================================================
// 🚀 CACHE GLOBAL - Permissões carregam UMA VEZ por sessão
// ============================================================================
interface PermissionsCache {
  userId: string;
  funcionalidades: FuncionalidadeModular[];
  modulos: ModuloSistema[];
  plataformas: Plataforma[];
  perfis: PerfilAcesso[];
  userPermissions: UsuarioPermissaoModular[];
  permissionMap: Map<string, boolean>;
  timestamp: number;
}

let globalPermissionsCache: PermissionsCache | null = null;
const CACHE_TTL = 10 * 60 * 1000; // 10 minutos

function isCacheValid(userId: string): boolean {
  if (!globalPermissionsCache) return false;
  if (globalPermissionsCache.userId !== userId) return false;
  if (Date.now() - globalPermissionsCache.timestamp > CACHE_TTL) return false;
  return true;
}

// Exportar para permitir invalidação manual do cache
export function clearPermissionsCache() {
  globalPermissionsCache = null;
}

export interface UseModularPermissionsReturn {
  // Verificação de permissões
  hasPermission: (codigo: string) => boolean;
  hasAnyPermission: (codigos: string[]) => boolean;
  hasAllPermissions: (codigos: string[]) => boolean;
  checkPermission: (codigo: string) => Promise<boolean>;
  checkMultiplePermissions: (codigos: string[]) => Map<string, boolean>;
  
  // Dados do sistema
  funcionalidades: FuncionalidadeModular[];
  modulos: ModuloSistema[];
  plataformas: Plataforma[];
  perfis: PerfilAcesso[];
  
  // Permissões do usuário
  userPermissions: UsuarioPermissaoModular[];
  customPermissions: UsuarioPermissaoModular[];
  
  // Estados
  loading: boolean;
  permissionsLoaded: boolean;
  error: string | null;
  
  // Ações
  refreshPermissions: () => Promise<void>;
  
  // Estatísticas
  getPermissionStats: () => {
    totalCustom: number;
    additionalPermissions: number;
    restrictions: number;
    modulePermissions: Record<string, number>;
    platformPermissions: Record<string, number>;
    hasCustomPermissions: boolean;
  };
}

// ============================================================================
// 🎯 CÓDIGOS DE PERMISSÕES MODULARES - SISTEMA REAL (113 FUNCIONALIDADES)
// ============================================================================

export const PERMISSION_CODES = {
  // 📦 ALMOXARIFADO (34 funcionalidades)
  ALMOXARIFADO: {
    // Site (Sistema Web)
    DASHBOARD_COMPLETO: 'almoxarifado.site.dashboard_completo',
    DASHBOARD_ADMINISTRATIVO: 'almoxarifado.site.dashboard_administrativo',
    RELATORIOS_AVANCADOS: 'almoxarifado.site.relatorios_avancados',
    RELATORIOS_CONSUMO: 'almoxarifado.site.relatorios_consumo',
    CONFIGURAR_CATEGORIAS: 'almoxarifado.site.configurar_categorias',
    GERENCIAR_FORNECEDORES: 'almoxarifado.site.gerenciar_fornecedores',
    CONFIGURAR_FORNECEDORES: 'almoxarifado.site.configurar_fornecedores',
    CONFIGURAR_TIPOS_EPI: 'almoxarifado.site.configurar_tipos_epi',
    DEFINIR_KIT_EPI: 'almoxarifado.site.definir_kit_epi',
    CONFIGURAR_PRAZO_EPI: 'almoxarifado.site.configurar_prazo_epi',
    RELATORIO_CONSUMO_EPI: 'almoxarifado.site.relatorio_consumo_epi',
    RELATORIO_VENCIMENTO_EPI: 'almoxarifado.site.relatorio_vencimento_epi',
    DASHBOARD_EPI: 'almoxarifado.site.dashboard_epi',
    AUDITORIA_EPI: 'almoxarifado.site.auditoria_epi',
    CERTIFICACAO_EPI: 'almoxarifado.site.certificacao_epi',
    CONTROLE_ENTRADA_SAIDA: 'almoxarifado.site.controle_entrada_saida',
    ALERTAS_ESTOQUE: 'almoxarifado.site.alertas_estoque',
    HISTORICO_MOVIMENTACOES: 'almoxarifado.site.historico_movimentacoes',
    INVENTARIO_FISICO: 'almoxarifado.site.inventario_fisico',
    CRIAR_NOVO_INVENTARIO: 'almoxarifado.site.criar_novo_inventario',
    CONTROLE_QUALIDADE: 'almoxarifado.site.controle_qualidade',
    INTEGRACAO_SISTEMAS: 'almoxarifado.site.integracao_sistemas',
    BACKUP_DADOS: 'almoxarifado.site.backup_dados',
    AUDITORIA_LOG: 'almoxarifado.site.auditoria_log',
    CONFIGURACOES_SISTEMA: 'almoxarifado.site.configuracoes_sistema',
    GERENCIAR_USUARIOS: 'almoxarifado.site.gerenciar_usuarios',
    PERMISSOES_ACESSO: 'almoxarifado.site.permissoes_acesso',
    RELATORIO_PERFORMANCE: 'almoxarifado.site.relatorio_performance',
    ANALISE_TENDENCIAS: 'almoxarifado.site.analise_tendencias',
    PREVISAO_DEMANDA: 'almoxarifado.site.previsao_demanda',
    PROCESSAR_DEVOLUCOES: 'almoxarifado.site.processar_devolucoes',
    OTIMIZACAO_ESTOQUE: 'almoxarifado.site.otimizacao_estoque',
    CONTROLE_CUSTOS: 'almoxarifado.site.controle_custos',
    GESTAO_CONTRATOS: 'almoxarifado.site.gestao_contratos',
    CONTROLE_QUALIDADE_AVANCADO: 'almoxarifado.site.controle_qualidade_avancado',
    RASTREAMENTO_LOTE: 'almoxarifado.site.rastreamento_lote',
    CONTROLE_TEMPERATURA: 'almoxarifado.site.controle_temperatura',
    ALERTAS_VENCIMENTO: 'almoxarifado.site.alertas_vencimento',
    CONTROLE_ACESSO_FISICO: 'almoxarifado.site.controle_acesso_fisico',
    INTEGRACAO_RFID: 'almoxarifado.site.integracao_rfid',
    AUTOMACAO_PROCESSOS: 'almoxarifado.site.automacao_processos',
    CRIAR_ALMOXARIFADO: 'almoxarifado.site.criar_almoxarifado',
    GERENCIAR_CATALOGO: 'almoxarifado.site.gerenciar_catalogo',
    VISUALIZAR_CATALOGO: 'almoxarifado.site.visualizar_catalogo',
    RELATORIOS_FINANCEIROS: 'almoxarifado.site.relatorios_financeiros',
    GERENCIAR_COMPRAS: 'almoxarifado.site.gerenciar_compras',
    GERENCIAR_RETESTE: 'almoxarifado.site.gerenciar_reteste',
    
    // Permissões específicas para criação e edição de itens (Web)
    CRIAR_NOVO_ITEM_WEB: 'almoxarifado.web.criar_novo_item',
    EDITAR_QUANTIDADE_ITEM_WEB: 'almoxarifado.web.editar_quantidade_item',
    EDITAR_DADOS_ITEM_WEB: 'almoxarifado.web.editar_dados_item',
    
    // Permissões específicas para Nota Fiscal (Web)
    CADASTRAR_NF_WEB: 'almoxarifado.web.cadastrar_nf',
    PROCESSAR_NF_WEB: 'almoxarifado.web.processar_nf',
    VISUALIZAR_NF_WEB: 'almoxarifado.web.visualizar_nf',
    EXCLUIR_ITEM_WEB: 'almoxarifado.web.excluir_item',
    
    // Mobile (Aplicativo Mobile)
    DASHBOARD: 'almoxarifado.mobile.dashboard',
    VISUALIZAR_ESTOQUE: 'almoxarifado.mobile.visualizar_estoque',
    VISUALIZAR_ESTOQUE_MOBILE: 'almoxarifado.mobile.visualizar_estoque_mobile',
    VISUALIZAR_SOLICITACOES: 'almoxarifado.mobile.visualizar_solicitacoes',
    SOLICITAR_MATERIAL: 'almoxarifado.mobile.solicitar_material',
    SOLICITAR_ITEM: 'almoxarifado.mobile.solicitar_item',
    CADASTRAR_NF: 'almoxarifado.mobile.cadastrar_nf',
    CRIAR_INVENTARIO: 'almoxarifado.mobile.criar_inventario',
    EDITAR_ESTOQUE: 'almoxarifado.mobile.editar_estoque',
    GERENCIAR_ESTOQUE: 'almoxarifado.mobile.gerenciar_estoque',
    ATUALIZAR_INVENTARIO: 'almoxarifado.mobile.atualizar_inventario',
    
    // Permissões específicas para criação e edição de itens (Mobile)
    CRIAR_NOVO_ITEM: 'almoxarifado.mobile.criar_novo_item',
    EDITAR_QUANTIDADE_ITEM: 'almoxarifado.mobile.editar_quantidade_item',
    EDITAR_DADOS_ITEM: 'almoxarifado.mobile.editar_dados_item',
    EXCLUIR_ITEM: 'almoxarifado.mobile.excluir_item',
    APROVAR_SOLICITACOES: 'almoxarifado.mobile.aprovar_solicitacoes',
    APROVAR_SOLICITACAO: 'almoxarifado.mobile.aprovar_solicitacao',
    ENTREGAR_MATERIAL: 'almoxarifado.mobile.entregar_material',
    CONTROLE_ENTREGA: 'almoxarifado.mobile.controle_entrega',
    SOLICITAR_EPI_INDIVIDUAL: 'almoxarifado.mobile.solicitar_epi_individual',
    SOLICITAR_EPI_EQUIPE: 'almoxarifado.mobile.solicitar_epi_equipe',
    SOLICITAR_EPI_EMERGENCIAL: 'almoxarifado.mobile.solicitar_epi_emergencial',
    VERIFICAR_EPI_DISPONIVEL: 'almoxarifado.mobile.verificar_epi_disponivel',
    APROVAR_EPI_BASICO: 'almoxarifado.mobile.aprovar_epi_basico',
    APROVAR_EPI_ESPECIAL: 'almoxarifado.mobile.aprovar_epi_especial',
    APROVAR_EPI_EMERGENCIAL: 'almoxarifado.mobile.aprovar_epi_emergencial',
    ENTREGAR_EPI_INDIVIDUAL: 'almoxarifado.mobile.entregar_epi_individual',
    ENTREGAR_EPI_LOTE: 'almoxarifado.mobile.entregar_epi_lote',
    REGISTRAR_DEVOLUCAO_EPI: 'almoxarifado.mobile.registrar_devolucao_epi',
    CONTROLAR_VENCIMENTO_EPI: 'almoxarifado.mobile.controlar_vencimento_epi',
    HISTORICO_EPI_COLABORADOR: 'almoxarifado.mobile.historico_epi_colaborador',
    SCANNER_CODIGO_BARRAS: 'almoxarifado.mobile.scanner_codigo_barras',
    
    // Visualização de todas as saídas (Web e Mobile)
    VISUALIZAR_TODAS_SAIDAS: 'almoxarifado.visualizar_todas_saidas',
    NOTIFICACOES_PUSH: 'almoxarifado.mobile.notificacoes_push',
    OFFLINE_SYNC: 'almoxarifado.mobile.offline_sync',
    RELATORIO_MOBILE: 'almoxarifado.mobile.relatorio_mobile',
    CONTROLE_LOCALIZACAO: 'almoxarifado.mobile.controle_localizacao',
  },

  // 🛡️ SESMT (Serviços Especializados em Engenharia de Segurança e em Medicina do Trabalho)
  SESMT: {
    // Site (Sistema Web)
    DASHBOARD_SESMT: 'sesmt.site.dashboard_sesmt',
    VISUALIZAR_LAUDOS: 'sesmt.site.visualizar_laudos',
    GERENCIAR_LAUDOS: 'sesmt.site.gerenciar_laudos',
    CONTROLE_VENCIMENTO_LAUDOS: 'sesmt.site.controle_vencimento_laudos',
    RELATORIOS_LAUDOS: 'sesmt.site.relatorios_laudos',
    APROVAR_SOLICITACOES_SESMT: 'sesmt.site.aprovar_solicitacoes_sesmt',
    VISUALIZAR_SOLICITACOES_SESMT: 'sesmt.site.visualizar_solicitacoes_sesmt',
    CONTROLE_HAR_OPERACAO: 'sesmt.site.controle_har_operacao',
    CONTROLE_CNH_OPERACAO: 'sesmt.site.controle_cnh_operacao',
    RELATORIOS_HAR_CNH: 'sesmt.site.relatorios_har_cnh',
    ALERTAS_VENCIMENTO_DOCUMENTOS: 'sesmt.site.alertas_vencimento_documentos',
    AUDITORIA_DOCUMENTOS: 'sesmt.site.auditoria_documentos',
    CONFIGURAR_ALERTAS_SESMT: 'sesmt.site.configurar_alertas_sesmt',
    RELATORIOS_PERFORMANCE_SESMT: 'sesmt.site.relatorios_performance_sesmt',
    
    // Mobile (Aplicativo Mobile)
    DASHBOARD_MOBILE: 'sesmt.mobile.dashboard_mobile',
    VISUALIZAR_LAUDOS_MOBILE: 'sesmt.mobile.visualizar_laudos_mobile',
    APROVAR_SOLICITACOES_MOBILE: 'sesmt.mobile.aprovar_solicitacoes_mobile',
    VISUALIZAR_SOLICITACOES_MOBILE: 'sesmt.mobile.visualizar_solicitacoes_mobile',
    CONTROLE_HAR_MOBILE: 'sesmt.mobile.controle_har_mobile',
    CONTROLE_CNH_MOBILE: 'sesmt.mobile.controle_cnh_mobile',
    NOTIFICACOES_VENCIMENTO_MOBILE: 'sesmt.mobile.notificacoes_vencimento_mobile',
    SCANNER_DOCUMENTOS_MOBILE: 'sesmt.mobile.scanner_documentos_mobile',
    OFFLINE_SYNC_MOBILE: 'sesmt.mobile.offline_sync_mobile',
  },

  // 🚗 VEÍCULOS (16 funcionalidades)
  VEICULOS: {
    // Site (Sistema Web)
    DASHBOARD_FROTA: 'veiculos.site.dashboard_frota',
    RELATORIO_UTILIZACAO: 'veiculos.site.relatorio_utilizacao',
    CADASTRAR_VEICULO: 'veiculos.site.cadastrar_veiculo',
    EDITAR_VEICULO: 'veiculos.site.editar_veiculo',
    DESATIVAR_VEICULO: 'veiculos.site.desativar_veiculo',
    GESTAO_COMPLETA_FROTA: 'veiculos.site.gestao_completa_frota',
    CONFIGURAR_TIPOS_VEICULO: 'veiculos.site.configurar_tipos_veiculo',
    GESTAO_DOCUMENTOS_FROTA: 'veiculos.site.gestao_documentos_frota',
    RELATORIO_CUSTOS_FROTA: 'veiculos.site.relatorio_custos_frota',
    PLANEJAMENTO_RENOVACAO_FROTA: 'veiculos.site.planejamento_renovacao_frota',
    CONTROLE_COMBUSTIVEL: 'veiculos.site.controle_combustivel',
    GESTAO_SEGURO_FROTA: 'veiculos.site.gestao_seguro_frota',
    RELATORIO_FROTA: 'veiculos.site.relatorio_frota',
    
    // Permissões específicas para documentos sensíveis
    VISUALIZAR_APOLICE_CONTRATO_ALUGUEL: 'veiculos.site.visualizar_apolice_contrato_aluguel',
    
    // Permissões específicas para veículos devolvidos/desmobilizados
    VISUALIZAR_DEVOLVIDOS_DESMOBILIZADOS: 'veiculos.site.visualizar_devolvidos_desmobilizados',
    DEVOLVER_VEICULO: 'veiculos.site.devolver_veiculo',
    DESMOBILIZAR_VEICULO: 'veiculos.site.desmobilizar_veiculo',
    BLOQUEAR_VEICULO: 'veiculos.site.bloquear_veiculo',
    DESBLOQUEAR_VEICULO: 'veiculos.site.desbloquear_veiculo',
    REATIVAR_VEICULO: 'veiculos.site.reativar_veiculo',
    
    // Mobile (Aplicativo Mobile)
    LISTAR_VEICULOS: 'veiculos.mobile.listar_veiculos',
    DETALHES_VEICULO: 'veiculos.mobile.detalhes_veiculo',
    HISTORICO_MANUTENCOES: 'veiculos.mobile.historico_manutencoes',
    GESTAO_CAMPO_FROTA: 'veiculos.mobile.gestao_campo_frota',
    VISUALIZAR_APOLICE_CONTRATO_ALUGUEL_MOBILE: 'veiculos.mobile.visualizar_apolice_contrato_aluguel',
  },

  // 🔧 MANUTENÇÃO (20 funcionalidades)
  MANUTENCAO: {
    // Site (Sistema Web)
    VISUALIZAR_MANUTENCOES: 'manutencao.site.visualizar_manutencoes',
    DASHBOARD_MANUTENCOES: 'manutencao.site.dashboard_manutencoes',
    PLANEJAR_PREVENTIVAS: 'manutencao.site.planejar_preventivas',
    GERENCIAR_OFICINAS: 'manutencao.site.gerenciar_oficinas',
    RELATORIO_CUSTOS: 'manutencao.site.relatorio_custos',
    
    // Site - Manutenção Preventiva por Quilometragem (Novas funcionalidades)
    DASHBOARD_QUILOMETRAGEM: 'manutencao.site.dashboard_quilometragem',
    CONFIGURAR_INTERVALOS_PREVENTIVA: 'manutencao.site.configurar_intervalos_preventiva',
    ALERTAS_QUILOMETRAGEM: 'manutencao.site.alertas_quilometragem',
    RELATORIO_PREVENTIVAS_KM: 'manutencao.site.relatorio_preventivas_km',
    MARCAR_PREVENTIVA_REALIZADA: 'manutencao.site.marcar_preventiva_realizada',
    CONFIGURAR_ALERTAS_KM: 'manutencao.site.configurar_alertas_km',
    HISTORICO_PREVENTIVAS_KM: 'manutencao.site.historico_preventivas_km',
    ANALISE_UTILIZACAO_FROTA: 'manutencao.site.analise_utilizacao_frota',
    PLANEJAMENTO_PREVENTIVO_KM: 'manutencao.site.planejamento_preventivo_km',
    RELATORIO_EFICIENCIA_PREVENTIVA: 'manutencao.site.relatorio_eficiencia_preventiva',
    
    // Mobile (Aplicativo Mobile)
    INDICAR_MANUTENCAO: 'manutencao.mobile.indicar_manutencao',
    LEVAR_VEICULO: 'manutencao.mobile.levar_veiculo',
    BUSCAR_VEICULO: 'manutencao.mobile.buscar_veiculo',
    AGENDAR_MANUTENCAO: 'manutencao.mobile.agendar_manutencao',
    APROVAR_MANUTENCAO: 'manutencao.mobile.aprovar_manutencao',
    FINALIZAR_MANUTENCAO: 'manutencao.mobile.finalizar_manutencao',
    
    // Mobile - Manutenção Preventiva por Quilometragem (Novas funcionalidades)
    VISUALIZAR_ALERTAS_KM: 'manutencao.mobile.visualizar_alertas_km',
    MARCAR_PREVENTIVA_MOBILE: 'manutencao.mobile.marcar_preventiva_mobile',
    ATUALIZAR_QUILOMETRAGEM: 'manutencao.mobile.atualizar_quilometragem',
  },

  // 📅 PROGRAMAÇÃO (3 funcionalidades)
  PROGRAMACAO: {
    // Site (Sistema Web)
    VISUALIZAR_CALENDARIO: 'programacao.site.visualizar_calendario',
    SINCRONIZAR_SHAREPOINT: 'programacao.site.sincronizar_sharepoint',
    GERENCIAR_ATIVIDADES: 'programacao.site.gerenciar_atividades',
  },

  // 📋 LAUDOS (5 funcionalidades)
  LAUDOS: {
    // Site (Sistema Web)
    GERENCIAR_LAUDOS: 'laudos.site.gerenciar_laudos',
    ALERTAS_VENCIMENTO: 'laudos.site.alertas_vencimento',
    RELATORIO_CONFORMIDADE: 'laudos.site.relatorio_conformidade',
    
    // Mobile (Aplicativo Mobile)
    VISUALIZAR_LAUDOS: 'laudos.mobile.visualizar_laudos',
    SOLICITAR_RENOVACAO: 'laudos.mobile.solicitar_renovacao',
  },

  // 🛡️ PORTARIA (5 funcionalidades)
  PORTARIA: {
    // Site (Sistema Web)
    RELATORIO_MOVIMENTACOES: 'portaria.site.relatorio_movimentacoes',
    CONFIGURAR_ALERTAS: 'portaria.site.configurar_alertas',
    
    // Mobile (Aplicativo Mobile)
    CONTROLE_CHAVES: 'portaria.mobile.controle_chaves',
    CONTROLE_VEICULOS: 'portaria.mobile.controle_veiculos',
    SCANNER_QR: 'portaria.mobile.scanner_qr',
  },

  // 👥 EQUIPES (7 funcionalidades)
  EQUIPES: {
    // Site (Sistema Web)
    GERENCIAR_EQUIPES: 'equipes.site.gerenciar_equipes',
    ALOCAR_COLABORADORES: 'equipes.site.alocar_colaboradores',
    CRIAR_EQUIPE: 'equipes.site.criar_equipe',
    EDITAR_EQUIPE: 'equipes.site.editar_equipe',
    PARAR_EQUIPE: 'equipes.site.parar_equipe',
    GERENCIAR_VEICULOS_EQUIPE: 'equipes.site.gerenciar_veiculos_equipe',
    
    // Mobile (Aplicativo Mobile)
    VISUALIZAR_EQUIPE: 'equipes.mobile.visualizar_equipe',
  },

  // ✅ CHECKLIST (23 funcionalidades)
  CHECKLIST: {
    // Site (Sistema Web)
    CONFIGURAR_CHECKLISTS: 'checklist.site.configurar_checklists',
    RELATORIO_CONFORMIDADE: 'checklist.site.relatorio_conformidade',
    CONFIGURAR_TIPOS_CHECKLIST: 'checklist.site.configurar_tipos_checklist',
    CONFIGURAR_ITENS_OBRIGATORIOS: 'checklist.site.configurar_itens_obrigatorios',
    CONFIGURAR_FLUXO_APROVACAO: 'checklist.site.configurar_fluxo_aprovacao',
    RELATORIO_CONFORMIDADE_DETALHADO: 'checklist.site.relatorio_conformidade_detalhado',
    RELATORIO_NAO_CONFORMIDADES: 'checklist.site.relatorio_nao_conformidades',
    DASHBOARD_CHECKLIST: 'checklist.site.dashboard_checklist',
    
    // Checklist Veicular - Visualização e Gestão
    VEICULO_VISUALIZAR: 'checklist.veiculo_visualizar',
    VEICULO_REJEITAR: 'checklist.veiculo_rejeitar',
    VEICULO_LIBERAR: 'checklist.veiculo_liberar',
    
    // Mobile (Aplicativo Mobile)
    EXECUTAR_CHECKLIST: 'checklist.mobile.executar_checklist',
    APROVAR_CHECKLIST: 'checklist.mobile.aprovar_checklist',
    CHECKLIST_SEGURANCA: 'checklist.mobile.checklist_seguranca',
    CHECKLIST_VEICULO: 'checklist.mobile.checklist_veiculo',
    CHECKLIST_EPI: 'checklist.mobile.checklist_epi',
    CHECKLIST_FERRAMENTAS: 'checklist.mobile.checklist_ferramentas',
    APROVAR_CHECKLIST_SUPERVISOR: 'checklist.mobile.aprovar_checklist_supervisor',
    APROVAR_CHECKLIST_COORDENADOR: 'checklist.mobile.aprovar_checklist_coordenador',
    APROVAR_CHECKLIST_EMERGENCIAL: 'checklist.mobile.aprovar_checklist_emergencial',
    REGISTRAR_NC: 'checklist.mobile.registrar_nc',
    SOLICITAR_LIBERACAO_NC: 'checklist.mobile.solicitar_liberacao_nc',
    APROVAR_LIBERACAO_NC: 'checklist.mobile.aprovar_liberacao_nc',
    HISTORICO_CHECKLISTS: 'checklist.mobile.historico_checklists',
    CONSULTAR_PENDENCIAS: 'checklist.mobile.consultar_pendencias',
  },

  // 📊 RELATÓRIOS (2 funcionalidades)
  RELATORIOS: {
    // Site (Sistema Web)
    DASHBOARD_EXECUTIVO: 'relatorios.site.dashboard_executivo',
    EXPORTAR_DADOS: 'relatorios.site.exportar_dados',
  },

  // ⚙️ CONFIGURAÇÕES (5 funcionalidades)
  CONFIGURACOES: {
    // Site (Sistema Web)
    GERENCIAR_USUARIOS: 'configuracoes.site.gerenciar_usuarios',
    GERENCIAR_PERMISSOES: 'configuracoes.site.gerenciar_permissoes',
    CONFIGURAR_SISTEMA: 'configuracoes.site.configurar_sistema',
    GERENCIAR_OPERACOES_SUPERVISOR: 'configuracoes.site.gerenciar_operacoes_supervisor',
    GERENCIAR_OPERACOES: 'frota.site.gerenciar_operacoes',
  },

  // 🎯 APRESENTAÇÃO DE EQUIPE (12 funcionalidades)
  APRESENTACAO_EQUIPE: {
    // Site (Sistema Web)
    CONFIGURAR_APRESENTACAO: 'apresentacao_equipe.site.configurar_apresentacao',
    DEFINIR_ESCALAS: 'apresentacao_equipe.site.definir_escalas',
    RELATORIO_PRESENCA: 'apresentacao_equipe.site.relatorio_presenca',
    DASHBOARD_EQUIPES: 'apresentacao_equipe.site.dashboard_equipes',
    
    // Mobile (Aplicativo Mobile)
    INICIAR_APRESENTACAO: 'apresentacao_equipe.mobile.iniciar_apresentacao',
    MARCAR_PRESENCA: 'apresentacao_equipe.mobile.marcar_presenca',
    REGISTRAR_AUSENCIA: 'apresentacao_equipe.mobile.registrar_ausencia',
    DEFINIR_ATIVIDADES: 'apresentacao_equipe.mobile.definir_atividades',
    ALOCAR_VEICULOS: 'apresentacao_equipe.mobile.alocar_veiculos',
    VALIDAR_EPIS: 'apresentacao_equipe.mobile.validar_epis',
    APROVAR_APRESENTACAO: 'apresentacao_equipe.mobile.aprovar_apresentacao',
    VISUALIZAR_EQUIPE_DIA: 'apresentacao_equipe.mobile.visualizar_equipe_dia',
    HISTORICO_APRESENTACOES: 'apresentacao_equipe.mobile.historico_apresentacoes',
  },

  // 👥 FUNCIONÁRIOS (9 funcionalidades)
  FUNCIONARIOS: {
    // Site (Sistema Web)
    VISUALIZAR: 'funcionarios.site.visualizar',
    CRIAR: 'funcionarios.site.criar',
    EDITAR: 'funcionarios.site.editar',
    EDITAR_FUNCIONARIOS: 'funcionarios.site.editar_funcionarios',
    DEMITIR: 'funcionarios.site.demitir',
    DEMITIR_BULK: 'funcionarios.site.demitir_bulk',
    VISUALIZAR_DEMITIDOS: 'funcionarios.site.visualizar_demitidos',
    REATIVAR: 'funcionarios.site.reativar',
    GERENCIAR_CARGOS: 'funcionarios.site.gerenciar_cargos',
    
    // Mobile (Aplicativo Mobile)
    VISUALIZAR_MOBILE: 'funcionarios.mobile.visualizar',
    CRIAR_MOBILE: 'funcionarios.mobile.criar',
    EDITAR_MOBILE: 'funcionarios.mobile.editar',
    DEMITIR_MOBILE: 'funcionarios.mobile.demitir',
    VISUALIZAR_DEMITIDOS_MOBILE: 'funcionarios.mobile.visualizar_demitidos',
    REATIVAR_MOBILE: 'funcionarios.mobile.reativar',
  },

  // 📋 MEDIDAS DISCIPLINARES / AVISOS (8 funcionalidades)
  MEDIDAS: {
    // Site (Sistema Web)
    VISUALIZAR: 'medidas.site.visualizar',
    CRIAR: 'medidas.site.criar',
    EDITAR: 'medidas.site.editar',
    APROVAR: 'medidas.site.aprovar',
    RECUSAR: 'medidas.site.recusar',
    GERAR_PDF: 'medidas.site.gerar_pdf',
    UPLOAD_ARQUIVO: 'medidas.site.upload_arquivo',
    RELATORIOS: 'medidas.site.relatorios',
    
    // Mobile (Aplicativo Mobile)
    VISUALIZAR_MOBILE: 'medidas.mobile.visualizar',
    CRIAR_MOBILE: 'medidas.mobile.criar',
    EDITAR_MOBILE: 'medidas.mobile.editar',
    APROVAR_MOBILE: 'medidas.mobile.aprovar',
    RECUSAR_MOBILE: 'medidas.mobile.recusar',
    GERAR_PDF_MOBILE: 'medidas.mobile.gerar_pdf',
    UPLOAD_ARQUIVO_MOBILE: 'medidas.mobile.upload_arquivo',
    RELATORIOS_MOBILE: 'medidas.mobile.relatorios',
  },

  // 🛡️ SEGURANÇA DO TRABALHO (12 funcionalidades)
  SEGURANCA: {
    // Engenheiro de Segurança
    ENGENHEIRO_VER_LAUDOS_FROTA: 'seguranca.engenheiro.ver_laudos_frota',
    ENGENHEIRO_VER_EQUIPES: 'seguranca.engenheiro.ver_equipes',
    ENGENHEIRO_VER_CHECKLIST: 'seguranca.engenheiro.ver_checklist',
    ENGENHEIRO_INVENTARIO_FUNCIONARIOS: 'seguranca.engenheiro.inventario_funcionarios',
    ENGENHEIRO_INVENTARIO_EQUIPES: 'seguranca.engenheiro.inventario_equipes',
    ENGENHEIRO_VER_HAR: 'seguranca.engenheiro.ver_har',
    
    // Técnico de Segurança do Trabalho (TST)
    TST_VER_LAUDOS_FROTA: 'seguranca.tst.ver_laudos_frota',
    TST_VER_EQUIPES: 'seguranca.tst.ver_equipes',
    TST_VER_CHECKLIST: 'seguranca.tst.ver_checklist',
    TST_INVENTARIO_FUNCIONARIOS: 'seguranca.tst.inventario_funcionarios',
    TST_INVENTARIO_EQUIPES: 'seguranca.tst.inventario_equipes',
    TST_VER_HAR: 'seguranca.tst.ver_har',
  },

  // 📱 GERADOR DE QR CODE (1 funcionalidade)
  QR_GENERATOR: {
    // Site (Sistema Web)
    GERAR_QR_CODE: 'desktop.web.gerar_qr_code',
  },

  // 📱 MDM - Mobile Device Management (5 funcionalidades)
  MDM: {
    // Site (Sistema Web)
    DASHBOARD_MDM: 'mdm.site.dashboard_mdm',
    VISUALIZAR_DISPOSITIVOS: 'mdm.site.visualizar_dispositivos',
    VISUALIZAR_MAPA: 'mdm.site.visualizar_mapa',
    GERENCIAR_DISPOSITIVOS: 'mdm.site.gerenciar_dispositivos',
    CONFIGURAR_DISPOSITIVOS: 'mdm.site.configurar_dispositivos',
  },

  // 🏗️ OBRAS MANUTENÇÃO (7 funcionalidades)
  OBRAS_MANUTENCAO: {
    VISUALIZAR:              'obras_manutencao.site.visualizar',
    CRIAR:                   'obras_manutencao.site.criar',
    EDITAR:                  'obras_manutencao.site.editar',
    EXCLUIR:                 'obras_manutencao.site.excluir',
    MUDAR_STATUS:            'obras_manutencao.site.mudar_status',
    PROGRAMACAO:             'obras_manutencao.site.programacao',
    RETORNO_EXECUCAO:        'obras_manutencao.site.apontamento_execucao',
  },

  // 🚗 DISPONIBILIDADE DE FROTA (5 funcionalidades)
  DISPONIBILIDADE_FROTA: {
    VISUALIZAR: 'DISPONIBILIDADE_FROTA.VISUALIZAR',
    REGISTRAR: 'DISPONIBILIDADE_FROTA.REGISTRAR',
    EDITAR: 'DISPONIBILIDADE_FROTA.EDITAR',
    ENCERRAR_REUNIAO: 'DISPONIBILIDADE_FROTA.ENCERRAR_REUNIAO',
    VISUALIZAR_TODOS_CONTRATOS: 'DISPONIBILIDADE_FROTA.VISUALIZAR_TODOS_CONTRATOS',
    ENVIAR_FORA_HORARIO: 'DISPONIBILIDADE_FROTA.ENVIAR_FORA_HORARIO',
    GERENCIAR_NOTIFICACOES: 'DISPONIBILIDADE_FROTA.GERENCIAR_NOTIFICACOES',
  },
} as const;

// ============================================================================
// 🎯 HOOK PRINCIPAL - SISTEMA MODULAR WEB
// ============================================================================

;export function useModularPermissions(): UseModularPermissionsReturn {
  const { user, loading: authLoading } = useAuth();
  
  // Estados - inicializados DIRETO do cache global se disponível (evita flash de loading)
  const [funcionalidades, setFuncionalidades] = useState<FuncionalidadeModular[]>(
    () => globalPermissionsCache?.funcionalidades ?? []
  );
  const [modulos, setModulos] = useState<ModuloSistema[]>(
    () => globalPermissionsCache?.modulos ?? []
  );
  const [plataformas, setPlataformas] = useState<Plataforma[]>(
    () => globalPermissionsCache?.plataformas ?? []
  );
  const [perfis, setPerfis] = useState<PerfilAcesso[]>(
    () => globalPermissionsCache?.perfis ?? []
  );
  const [userPermissions, setUserPermissions] = useState<UsuarioPermissaoModular[]>(
    () => globalPermissionsCache?.userPermissions ?? []
  );
  const [loading, setLoading] = useState(!globalPermissionsCache);
  const [error, setError] = useState<string | null>(null);

  // Cache de permissões para performance (usando ref para evitar re-renders)
  const permissionCacheRef = useRef<Map<string, boolean>>(
    globalPermissionsCache ? new Map(globalPermissionsCache.permissionMap) : new Map()
  );
  
  // permissionsLoaded = true imediatamente se cache global válido
  const [permissionsLoaded, setPermissionsLoaded] = useState<boolean>(
    () => globalPermissionsCache !== null
  );

  // Carregar dados do sistema modular
  const loadSystemData = useCallback(async () => {
    if (!user?.id || authLoading) return;

    // Se cache global válido, não recarregar
    if (isCacheValid(user.id) && globalPermissionsCache) {
      if (!permissionsLoaded) {
        setFuncionalidades(globalPermissionsCache.funcionalidades);
        setModulos(globalPermissionsCache.modulos);
        setPlataformas(globalPermissionsCache.plataformas);
        setPerfis(globalPermissionsCache.perfis);
        setUserPermissions(globalPermissionsCache.userPermissions);
        permissionCacheRef.current = new Map(globalPermissionsCache.permissionMap);
        setPermissionsLoaded(true);
      }
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Buscar perfil + todos os dados em paralelo (1 round)
      const [
        perfilResult,
        funcionalidadesData,
        modulosData,
        plataformasData,
        perfisData,
        permissionsData,
      ] = await Promise.all([
        supabase.from('perfis_acesso').select('id').eq('codigo', user.nivel_acesso).eq('ativo', true).single(),
        supabase.from('funcionalidades_modulares').select(`*, modulo:modulos_sistema(*), plataforma:plataformas(*)`).eq('ativa', true).order('ordem'),
        supabase.from('modulos_sistema').select('*').eq('ativo', true).order('ordem'),
        supabase.from('plataformas').select('*').eq('ativa', true).order('nome'),
        supabase.from('perfis_acesso').select('*').eq('ativo', true).order('nivel_hierarquia'),
        supabase.from('usuario_permissoes_modulares').select(`*, funcionalidade:funcionalidades_modulares(*)`).eq('usuario_id', user.id).eq('ativo', true).order('criado_em', { ascending: false }),
      ]);

      if (perfilResult.error) throw perfilResult.error;
      if (!perfilResult.data) throw new Error('Perfil não encontrado');

      // Buscar permissões do perfil (depende do perfilData.id)
      const profilePermissionsData = await supabase
        .from('perfil_funcionalidades_padrao')
        .select(`*, funcionalidade:funcionalidades_modulares(*, modulo:modulos_sistema(*), plataforma:plataformas(*)), perfil:perfis_acesso(*)`)
        .eq('perfil_id', perfilResult.data.id)
        .eq('concedido', true)
        .eq('funcionalidade.ativa', true)
        .order('criado_em', { ascending: false });

      if (funcionalidadesData.error) throw funcionalidadesData.error;
      if (modulosData.error) throw modulosData.error;
      if (plataformasData.error) throw plataformasData.error;
      if (perfisData.error) throw perfisData.error;
      if (permissionsData.error) throw permissionsData.error;
      if (profilePermissionsData.error) throw profilePermissionsData.error;


      // Combinar permissões individuais + perfil padrão
      const individualPermissions = (permissionsData.data || []).filter(p => p.usuario_id === user.id);
      const profilePermissions = (profilePermissionsData.data || []).map(p => ({
        ...p,
        usuario_id: user.id,
        tipo_permissao: 'adicional' as const,
        ativo: true,
        concedido: p.concedido
      }));

      const allPermissions = [...individualPermissions, ...profilePermissions];
      
      setFuncionalidades(funcionalidadesData.data || []);
      setModulos(modulosData.data || []);
      setPlataformas(plataformasData.data || []);
      setPerfis(perfisData.data || []);
      setUserPermissions(allPermissions);

      // Limpar cache quando dados mudam
      permissionCacheRef.current.clear();
      
      // Salvar no cache global
      globalPermissionsCache = {
        userId: user.id,
        funcionalidades: funcionalidadesData.data || [],
        modulos: modulosData.data || [],
        plataformas: plataformasData.data || [],
        perfis: perfisData.data || [],
        userPermissions: allPermissions,
        permissionMap: new Map(),
        timestamp: Date.now(),
      };

      // Marcar permissões como carregadas
      setPermissionsLoaded(true);

    } catch (err) {
      console.error('Erro ao carregar sistema modular:', err);
      setError('Erro ao carregar sistema modular');
    } finally {
      setLoading(false);
    }
  }, [user?.id, user?.nivel_acesso, authLoading, permissionsLoaded]);

  // Carregar dados quando usuário muda
  useEffect(() => {
    loadSystemData();
  }, [loadSystemData]);

  // Verificar permissão modular
  const hasPermission = useCallback((codigo: string): boolean => {
    if (!user) return false;

    // Verificar cache primeiro
    if (permissionCacheRef.current.has(codigo)) {
      return permissionCacheRef.current.get(codigo)!;
    }

    let result = false;

    try {
      // Admin e Diretor têm acesso total
      if (['admin', 'diretor'].includes(user.nivel_acesso)) {
        result = true;
      } else {
        // Verificar se há permissão personalizada (PRIORIDADE MÁXIMA)
        const customPermission = userPermissions.find(p => 
          p.funcionalidade?.codigo === codigo && 
          p.usuario_id === user.id &&
          p.ativo &&
          (!p.data_fim || new Date(p.data_fim) >= new Date())
        );

        if (customPermission) {
          result = customPermission.concedido;
        } else {
          // Verificar permissão padrão do perfil
          const profilePermission = userPermissions.find(p => 
            p.funcionalidade?.codigo === codigo && 
            p.usuario_id === user.id &&
            p.tipo_permissao === 'adicional' &&
            p.ativo
          );

          if (profilePermission) {
            result = profilePermission.concedido;
          }
        }
      }
    } catch {
      result = false;
    }

    // Salvar no cache (usando ref para evitar re-renders)
    permissionCacheRef.current.set(codigo, result);
    return result;
  }, [user, userPermissions]);

  // Função otimizada para verificar múltiplas permissões de uma vez
  const checkMultiplePermissions = useCallback((codigos: string[]): Map<string, boolean> => {
    const results = new Map<string, boolean>();
    
    if (!user) {
      codigos.forEach(codigo => results.set(codigo, false));
      return results;
    }

    codigos.forEach(codigo => {
      // Verificar cache primeiro
      if (permissionCacheRef.current.has(codigo)) {
        results.set(codigo, permissionCacheRef.current.get(codigo)!);
        return;
      }

      let result = false;

      try {
        // Admin e Diretor têm acesso total
        if (['admin', 'diretor'].includes(user.nivel_acesso)) {
          result = true;
        } else {
          // Verificar se há permissão personalizada (PRIORIDADE MÁXIMA)
          const customPermission = userPermissions.find(p => 
            p.funcionalidade?.codigo === codigo && 
            p.usuario_id === user.id &&
            p.ativo &&
            (!p.data_fim || new Date(p.data_fim) >= new Date())
          );

          if (customPermission) {
            result = customPermission.concedido;
          } else {
            // Verificar permissão padrão do perfil
            const profilePermission = userPermissions.find(p => 
              p.funcionalidade?.codigo === codigo && 
              p.usuario_id === user.id &&
              p.tipo_permissao === 'adicional' &&
              p.ativo
            );

            if (profilePermission) {
              result = profilePermission.concedido;
            } else {
              // Se não há permissão personalizada nem do perfil, negar acesso
              result = false;
            }
          }
        }
      } catch (err) {
        console.error('Erro ao verificar permissão modular:', err);
        result = false;
      }

      results.set(codigo, result);
    });

    // Atualizar cache com todos os resultados (usando ref para evitar re-renders)
    results.forEach((value, key) => permissionCacheRef.current.set(key, value));

    return results;
  }, [user, userPermissions]);

  // Verificar se tem pelo menos uma das permissões
  const hasAnyPermission = useCallback((codigos: string[]): boolean => {
    return codigos.some(codigo => hasPermission(codigo));
  }, [hasPermission]);

  // Verificar se tem todas as permissões
  const hasAllPermissions = useCallback((codigos: string[]): boolean => {
    return codigos.every(codigo => hasPermission(codigo));
  }, [hasPermission]);

  // Verificar permissão via API
  const checkPermission = useCallback(async (codigo: string): Promise<boolean> => {
    if (!user?.id) return false;

    try {
      // Aqui você pode implementar uma função RPC no Supabase
      // Por enquanto, vamos usar a lógica local
      const result = hasPermission(codigo);
      
      // Atualizar cache (usando ref para evitar re-renders)
      permissionCacheRef.current.set(codigo, result);
      
      return result;
    } catch (err) {
      console.error('Erro ao verificar permissão via API:', err);
      return false;
    }
  }, [user?.id, hasPermission]);

  // Filtrar apenas permissões personalizadas
  const customPermissions = userPermissions.filter(p => 
    p.tipo_permissao === 'adicional' || p.tipo_permissao === 'restricao'
  );

  // Função para recarregar permissões
  const refreshPermissions = useCallback(async () => {
    permissionCacheRef.current.clear(); // Limpar cache local
    globalPermissionsCache = null; // Limpar cache global
    await loadSystemData();
  }, [loadSystemData]);

  // Obter estatísticas das permissões do usuário
  const getPermissionStats = useCallback(() => {
    const totalCustom = customPermissions.length;
    const additionalPermissions = customPermissions.filter(p => p.concedido).length;
    const restrictions = customPermissions.filter(p => !p.concedido).length;
    
    const modulePermissions = customPermissions.reduce((acc, p) => {
      const modulo = p.funcionalidade?.modulo?.nome;
      if (modulo) {
        acc[modulo] = (acc[modulo] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);

    const platformPermissions = customPermissions.reduce((acc, p) => {
      const plataforma = p.funcionalidade?.plataforma?.nome;
      if (plataforma) {
        acc[plataforma] = (acc[plataforma] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);

    return {
      totalCustom,
      additionalPermissions,
      restrictions,
      modulePermissions,
      platformPermissions,
      hasCustomPermissions: user?.permissoes_personalizadas || false,
    };
  }, [customPermissions, user?.permissoes_personalizadas]);

  return {
    // Verificação de permissões
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    checkPermission,
    checkMultiplePermissions,
    
    // Dados do sistema
    funcionalidades,
    modulos,
    plataformas,
    perfis,
    
    // Permissões do usuário
    userPermissions,
    customPermissions,
    
    // Estados
    loading: loading || authLoading,
    permissionsLoaded,
    error,
    
    // Ações
    refreshPermissions,
    
    // Estatísticas
    getPermissionStats,
  };
}

// ============================================================================
// 🎯 HOOKS AUXILIARES
// ============================================================================

// Hook mais simples para componentes que só precisam verificar permissões
export function usePermissionCheck() {
  const { hasPermission, hasAnyPermission, hasAllPermissions, loading } = useModularPermissions();
  
  return {
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    loading
  };
}

// Hook para verificar permissões por módulo
export function useModulePermissions(moduleCode: string) {
  const { funcionalidades, hasPermission, loading } = useModularPermissions();
  
  const moduleFuncionalidades = funcionalidades.filter(f => 
    f.modulo?.codigo === moduleCode
  );
  
  const hasModulePermission = useCallback((codigo: string) => {
    return hasPermission(codigo);
  }, [hasPermission]);
  
  return {
    moduleFuncionalidades,
    hasModulePermission,
    loading
  };
}

// Hook para verificar permissões por plataforma
export function usePlatformPermissions(platformCode: string) {
  const { funcionalidades, hasPermission, loading } = useModularPermissions();
  
  const platformFuncionalidades = funcionalidades.filter(f => 
    f.plataforma?.codigo === platformCode
  );
  
  const hasPlatformPermission = useCallback((codigo: string) => {
    return hasPermission(codigo);
  }, [hasPermission]);
  
  return {
    platformFuncionalidades,
    hasPlatformPermission,
    loading
  };
}


