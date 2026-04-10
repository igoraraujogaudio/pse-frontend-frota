// =====================================================
// CONFIGURAÇÃO DE PERMISSÕES POR NÍVEL DE ACESSO
// MANUTENÇÃO PREVENTIVA POR QUILOMETRAGEM
// =====================================================

export interface NivelAcessoPreventiva {
  nivel: string;
  descricao: string;
  funcionalidades: string[];
  restricoes?: string[];
}

export const CONFIGURACAO_PREVENTIVA_POR_NIVEL: Record<string, NivelAcessoPreventiva> = {
  // 👑 DIRETOR - Acesso total ao sistema
  diretor: {
    nivel: 'diretor',
    descricao: 'Acesso total ao sistema de manutenção preventiva',
    funcionalidades: [
      // Dashboard e visualização
      'manutencao.site.dashboard_quilometragem',
      'manutencao.site.alertas_quilometragem',
      'manutencao.site.historico_preventivas_km',
      
      // Configurações e planejamento
      'manutencao.site.configurar_intervalos_preventiva',
      'manutencao.site.configurar_alertas_km',
      'manutencao.site.planejamento_preventivo_km',
      
      // Operações
      'manutencao.site.marcar_preventiva_realizada',
      
      // Relatórios e análises
      'manutencao.site.relatorio_preventivas_km',
      'manutencao.site.analise_utilizacao_frota',
      'manutencao.site.relatorio_eficiencia_preventiva',
      
      // Mobile
      'manutencao.mobile.visualizar_alertas_km',
      'manutencao.mobile.marcar_preventiva_mobile',
      'manutencao.mobile.atualizar_quilometragem',
    ],
    restricoes: []
  },

  // 🏢 GERENTE - Gestão completa da frota
  gerente: {
    nivel: 'gerente',
    descricao: 'Gestão completa da frota e manutenção preventiva',
    funcionalidades: [
      // Dashboard e visualização
      'manutencao.site.dashboard_quilometragem',
      'manutencao.site.alertas_quilometragem',
      'manutencao.site.historico_preventivas_km',
      
      // Configurações e planejamento
      'manutencao.site.configurar_intervalos_preventiva',
      'manutencao.site.configurar_alertas_km',
      'manutencao.site.planejamento_preventivo_km',
      
      // Operações
      'manutencao.site.marcar_preventiva_realizada',
      
      // Relatórios e análises
      'manutencao.site.relatorio_preventivas_km',
      'manutencao.site.analise_utilizacao_frota',
      'manutencao.site.relatorio_eficiencia_preventiva',
      
      // Mobile
      'manutencao.mobile.visualizar_alertas_km',
      'manutencao.mobile.marcar_preventiva_mobile',
      'manutencao.mobile.atualizar_quilometragem',
    ],
    restricoes: []
  },

  // 🚗 GESTOR DE FROTA - Especialista em frota
  gestor_frota: {
    nivel: 'gestor_frota',
    descricao: 'Especialista em gestão de frota e manutenção preventiva',
    funcionalidades: [
      // Dashboard e visualização
      'manutencao.site.dashboard_quilometragem',
      'manutencao.site.alertas_quilometragem',
      'manutencao.site.historico_preventivas_km',
      
      // Configurações e planejamento
      'manutencao.site.configurar_intervalos_preventiva',
      'manutencao.site.configurar_alertas_km',
      'manutencao.site.planejamento_preventivo_km',
      
      // Operações
      'manutencao.site.marcar_preventiva_realizada',
      
      // Relatórios e análises
      'manutencao.site.relatorio_preventivas_km',
      'manutencao.site.analise_utilizacao_frota',
      'manutencao.site.relatorio_eficiencia_preventiva',
      
      // Mobile
      'manutencao.mobile.visualizar_alertas_km',
      'manutencao.mobile.marcar_preventiva_mobile',
      'manutencao.mobile.atualizar_quilometragem',
    ],
    restricoes: []
  },

  // 👨‍💼 ADMINISTRADOR - Acesso administrativo
  admin: {
    nivel: 'admin',
    descricao: 'Acesso administrativo completo ao sistema',
    funcionalidades: [
      // Dashboard e visualização
      'manutencao.site.dashboard_quilometragem',
      'manutencao.site.alertas_quilometragem',
      'manutencao.site.historico_preventivas_km',
      
      // Configurações e planejamento
      'manutencao.site.configurar_intervalos_preventiva',
      'manutencao.site.configurar_alertas_km',
      'manutencao.site.planejamento_preventivo_km',
      
      // Operações
      'manutencao.site.marcar_preventiva_realizada',
      
      // Relatórios e análises
      'manutencao.site.relatorio_preventivas_km',
      'manutencao.site.analise_utilizacao_frota',
      'manutencao.site.relatorio_eficiencia_preventiva',
      
      // Mobile
      'manutencao.mobile.visualizar_alertas_km',
      'manutencao.mobile.marcar_preventiva_mobile',
      'manutencao.mobile.atualizar_quilometragem',
    ],
    restricoes: []
  },

  // 👨‍🔧 COORDENADOR - Supervisão operacional
  coordenador: {
    nivel: 'coordenador',
    descricao: 'Supervisão operacional e aprovação de manutenções',
    funcionalidades: [
      // Apenas funcionalidades básicas de manutenção existentes
      'manutencao.site.dashboard_manutencoes',
      'manutencao.site.planejar_preventivas',
      'manutencao.site.relatorio_custos',
      'manutencao.mobile.aprovar_manutencao',
      'manutencao.mobile.finalizar_manutencao',
    ],
    restricoes: [
      'Não tem acesso às funcionalidades de quilometragem preventiva',
      'Apenas funcionalidades básicas de manutenção'
    ]
  },

  // 👨‍💼 SUPERVISOR - Operações básicas
  supervisor: {
    nivel: 'supervisor',
    descricao: 'Operações básicas de manutenção',
    funcionalidades: [
      // Apenas funcionalidades básicas de manutenção existentes
      'manutencao.mobile.indicar_manutencao',
      'manutencao.mobile.levar_veiculo',
      'manutencao.mobile.buscar_veiculo',
    ],
    restricoes: [
      'Não tem acesso às funcionalidades de quilometragem preventiva',
      'Apenas operações básicas de manutenção'
    ]
  },

  // 👨‍🔧 MECÂNICO - Operações de campo
  mecanico: {
    nivel: 'mecanico',
    descricao: 'Operações de campo',
    funcionalidades: [
      // Sem acesso às funcionalidades de quilometragem preventiva
    ],
    restricoes: [
      'Não tem acesso às funcionalidades de quilometragem preventiva',
      'Apenas funcionalidades básicas de manutenção existentes'
    ]
  },

  // 👨‍💼 OPERADOR - Visualização básica
  operador: {
    nivel: 'operador',
    descricao: 'Visualização básica',
    funcionalidades: [
      // Sem acesso às funcionalidades de quilometragem preventiva
    ],
    restricoes: [
      'Não tem acesso às funcionalidades de quilometragem preventiva',
      'Apenas funcionalidades básicas de manutenção existentes'
    ]
  }
};

// =====================================================
// FUNÇÕES AUXILIARES PARA VERIFICAÇÃO DE PERMISSÕES
// =====================================================

/**
 * Verifica se um usuário tem acesso a uma funcionalidade específica
 */
export function verificarAcessoPreventiva(
  nivelAcesso: string,
  funcionalidade: string
): boolean {
  const config = CONFIGURACAO_PREVENTIVA_POR_NIVEL[nivelAcesso];
  if (!config) return false;
  
  return config.funcionalidades.includes(funcionalidade);
}

/**
 * Retorna todas as funcionalidades disponíveis para um nível de acesso
 */
export function getFuncionalidadesPorNivel(nivelAcesso: string): string[] {
  const config = CONFIGURACAO_PREVENTIVA_POR_NIVEL[nivelAcesso];
  return config ? config.funcionalidades : [];
}

/**
 * Retorna as restrições para um nível de acesso
 */
export function getRestricoesPorNivel(nivelAcesso: string): string[] {
  const config = CONFIGURACAO_PREVENTIVA_POR_NIVEL[nivelAcesso];
  return config ? config.restricoes || [] : [];
}

/**
 * Retorna configuração completa para um nível de acesso
 */
export function getConfiguracaoNivel(nivelAcesso: string): NivelAcessoPreventiva | null {
  return CONFIGURACAO_PREVENTIVA_POR_NIVEL[nivelAcesso] || null;
}

/**
 * Lista todos os níveis de acesso disponíveis
 */
export function getTodosNiveisAcesso(): string[] {
  return Object.keys(CONFIGURACAO_PREVENTIVA_POR_NIVEL);
}

/**
 * Verifica se um nível de acesso pode executar uma operação específica
 */
export function podeExecutarOperacao(
  nivelAcesso: string,
  operacao: 'visualizar' | 'configurar' | 'executar' | 'relatorios' | 'planejamento'
): boolean {
  const config = CONFIGURACAO_PREVENTIVA_POR_NIVEL[nivelAcesso];
  if (!config) return false;

  switch (operacao) {
    case 'visualizar':
      return config.funcionalidades.some(f => 
        f.includes('dashboard') || f.includes('alertas') || f.includes('historico')
      );
    
    case 'configurar':
      return config.funcionalidades.some(f => 
        f.includes('configurar') || f.includes('planejamento')
      );
    
    case 'executar':
      return config.funcionalidades.some(f => 
        f.includes('marcar') || f.includes('atualizar')
      );
    
    case 'relatorios':
      return config.funcionalidades.some(f => 
        f.includes('relatorio') || f.includes('analise')
      );
    
    case 'planejamento':
      return config.funcionalidades.some(f => 
        f.includes('planejamento') || f.includes('configurar_intervalos')
      );
    
    default:
      return false;
  }
}

// =====================================================
// MAPEAMENTO DE PERMISSÕES PARA COMPONENTES
// =====================================================

export const COMPONENTE_PERMISSOES = {
  // Dashboard de Quilometragem
  QuilometragemDashboard: [
    'manutencao.site.dashboard_quilometragem',
    'manutencao.site.alertas_quilometragem'
  ],
  
  // Configuração de Intervalos
  ConfiguracaoIntervalos: [
    'manutencao.site.configurar_intervalos_preventiva',
    'manutencao.site.configurar_alertas_km'
  ],
  
  // Marcar Preventiva Realizada
  MarcarPreventiva: [
    'manutencao.site.marcar_preventiva_realizada',
    'manutencao.mobile.marcar_preventiva_mobile'
  ],
  
  // Relatórios
  RelatoriosPreventiva: [
    'manutencao.site.relatorio_preventivas_km',
    'manutencao.site.analise_utilizacao_frota',
    'manutencao.site.relatorio_eficiencia_preventiva'
  ],
  
  // Atualização de Quilometragem
  AtualizarQuilometragem: [
    'manutencao.mobile.atualizar_quilometragem'
  ],
  
  // Visualização de Alertas
  VisualizarAlertas: [
    'manutencao.site.alertas_quilometragem',
    'manutencao.mobile.visualizar_alertas_km'
  ]
};

/**
 * Verifica se um usuário pode acessar um componente específico
 */
export function podeAcessarComponente(
  nivelAcesso: string,
  componente: keyof typeof COMPONENTE_PERMISSOES
): boolean {
  const permissoesComponente = COMPONENTE_PERMISSOES[componente];
  const funcionalidadesUsuario = getFuncionalidadesPorNivel(nivelAcesso);
  
  return permissoesComponente.some(permissao => 
    funcionalidadesUsuario.includes(permissao)
  );
}
