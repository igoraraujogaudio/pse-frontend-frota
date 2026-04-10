// ============================================================================
// MAPEAMENTO DE CARGOS PARA NÍVEIS DE ACESSO
// ============================================================================
// Utilitário para mapear automaticamente cargos para níveis de acesso
// ============================================================================

// import { createClient } from '@supabase/supabase-js';

// Mapeamento simplificado - agora usa apenas a tabela cargos
// Se não encontrar na tabela, usa 'operacao' como padrão

/**
 * Mapeia um cargo para um nível de acesso
 * @param cargo Nome do cargo
 * @param supabaseClient Cliente Supabase para consultar tabela de cargos
 * @returns Nível de acesso mapeado
 */
export async function mapearCargoParaNivelAcesso(
  cargo: string, 
  supabaseClient: unknown
): Promise<string> {
  if (!cargo || cargo.trim() === '') {
    return 'operacao'; // Padrão para cargo vazio
  }

  const cargoNormalizado = cargo.trim().toUpperCase();

  try {
    // 1. Primeiro, tenta buscar na tabela de cargos
    const { data: cargoData, error } = await (supabaseClient as unknown as { from: (table: string) => { select: (fields: string) => { eq: (field: string, value: unknown) => { eq: (field: string, value: unknown) => { single: () => Promise<{ data: unknown, error: unknown }> } } } } })
      .from('cargos')
      .select('nivel_acesso')
      .eq('nome', cargoNormalizado)
      .eq('ativo', true)
      .single();

    if (!error && cargoData) {
      console.log(`✅ Cargo encontrado na tabela: ${cargo} → ${(cargoData as Record<string, unknown>).nivel_acesso}`);
      return (cargoData as Record<string, unknown>).nivel_acesso as string;
    }

    // 2. Se não encontrou, usar padrão operacional
    console.log(`⚠️ Cargo não encontrado na tabela, usando padrão: ${cargo} → operacao`);
    return 'operacao';

  } catch (error) {
    console.error('❌ Erro ao mapear cargo:', error);
    return 'operacao'; // Fallback seguro
  }
}

/**
 * Valida se um nível de acesso é válido
 * @param nivelAcesso Nível de acesso a ser validado
 * @returns true se válido, false caso contrário
 */
export function validarNivelAcesso(nivelAcesso: string): boolean {
  const niveisValidos = [
    'admin', 'diretor', 'manager', 'gerente', 'gestor_frota', 
    'gestor', 'gestor_almoxarifado', 'coordenador', 'supervisor', 
    'operacao', 'RH', 'portaria', 'almoxarifado', 'tst'
  ];
  
  return niveisValidos.includes(nivelAcesso);
}

/**
 * Obtém a descrição de um nível de acesso
 * @param nivelAcesso Nível de acesso
 * @returns Descrição do nível de acesso
 */
export function obterDescricaoNivelAcesso(nivelAcesso: string): string {
  const descricoes: Record<string, string> = {
    'admin': 'Administrador - Acesso total ao sistema',
    'diretor': 'Diretor - Acesso executivo e estratégico',
    'manager': 'Manager - Gerente geral de operações',
    'gerente': 'Gerente - Gerente de área específica',
    'gestor_frota': 'Gestor de Frota - Gestão da frota de veículos',
    'gestor': 'Gestor - Gestão de recursos e equipes',
    'gestor_almoxarifado': 'Gestor de Almoxarifado - Gestão completa do almoxarifado',
    'coordenador': 'Coordenador - Coordenação de equipes e processos',
    'supervisor': 'Supervisor - Supervisão e aprovação operacional',
    'operacao': 'Operação - Execução operacional em campo',
    'RH': 'RH - Recursos Humanos',
    'portaria': 'Portaria - Controle de acesso e registro',
    'almoxarifado': 'Almoxarifado - Gestão de estoque e materiais'
  };
  
  return descricoes[nivelAcesso] || 'Nível de acesso não reconhecido';
}

/**
 * Obtém todos os níveis de acesso válidos
 * @returns Array com todos os níveis de acesso
 */
export function obterNiveisAcessoValidos(): string[] {
  return [
    'admin', 'diretor', 'manager', 'gerente', 'gestor_frota', 
    'gestor', 'gestor_almoxarifado', 'coordenador', 'supervisor', 
    'operacao', 'RH', 'portaria', 'almoxarifado', 'tst'
  ];
}

/**
 * Obtém a hierarquia de níveis de acesso (do maior para o menor)
 * @returns Array ordenado por hierarquia
 */
export function obterHierarquiaNiveisAcesso(): string[] {
  return [
    'admin',
    'diretor', 
    'manager',
    'gerente',
    'gestor_frota',
    'gestor',
    'gestor_almoxarifado',
    'coordenador',
    'supervisor',
    'RH',
    'tst',
    'portaria',
    'almoxarifado',
    'operacao'
  ];
}

/**
 * Verifica se um nível de acesso tem hierarquia superior a outro
 * @param nivel1 Primeiro nível
 * @param nivel2 Segundo nível
 * @returns true se nivel1 tem hierarquia superior a nivel2
 */
export function temHierarquiaSuperior(nivel1: string, nivel2: string): boolean {
  const hierarquia = obterHierarquiaNiveisAcesso();
  const posicao1 = hierarquia.indexOf(nivel1);
  const posicao2 = hierarquia.indexOf(nivel2);
  
  // Se algum nível não for encontrado, retorna false
  if (posicao1 === -1 || posicao2 === -1) {
    return false;
  }
  
  // Menor posição = maior hierarquia
  return posicao1 < posicao2;
}

