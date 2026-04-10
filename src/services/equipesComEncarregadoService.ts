import { supabase } from '@/lib/supabase';

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface EquipeComEncarregado {
  id: string;
  nome: string;
  prefixo: string;
  operacao: string;
  operacaoNome: string;
  setor?: string; // Setor da equipe (ex: Elétrica, Mecânica, Civil)
  encarregadoId?: string | null;
  encarregadoNome?: string | null;
  encarregadoMatricula?: string | null;
  contratoId: string;
  contratoNome: string;
}

export class EquipesComEncarregadoService {
  // Buscar todas as equipes ativas do contrato (filtragem por equipes fixas é feita na página)
  static async getEquipesComEncarregado(contratoId?: string): Promise<EquipeComEncarregado[]> {
    // Usar a view criada no SQL
    let query = supabase
      .from('vw_equipes_completa')
      .select('*')
      .eq('status', 'active')
      .order('nome', { ascending: true });

    if (contratoId) {
      query = query.eq('contrato_id', contratoId);
    }

    const { data, error } = await query;

    if (error) throw error;

    return (data || []).map((equipe: any) => ({
      id: equipe.id,
      nome: equipe.nome,
      prefixo: equipe.prefixo || '',
      operacao: equipe.operacao_codigo || equipe.operacao,
      operacaoNome: equipe.operacao_nome || '',
      setor: equipe.setor || '',
      encarregadoId: equipe.encarregado_id,
      encarregadoNome: equipe.encarregado_nome || '',
      encarregadoMatricula: equipe.encarregado_matricula || '',
      contratoId: equipe.contrato_id,
      contratoNome: equipe.contrato_nome || ''
    }));
  }

  // Buscar equipes por operação que requer encarregado (independente de ter encarregado definido)
  static async getEquipesPorOperacao(operacaoCodigo: string, contratoId?: string): Promise<EquipeComEncarregado[]> {
    let query = supabase
      .from('vw_equipes_completa')
      .select('*')
      .eq('status', 'active')
      .eq('requer_encarregado', true)
      .eq('operacao_codigo', operacaoCodigo)
      .order('nome', { ascending: true });

    if (contratoId) {
      query = query.eq('contrato_id', contratoId);
    }

    const { data, error } = await query;

    if (error) throw error;

    return (data || []).map((equipe: any) => ({
      id: equipe.id,
      nome: equipe.nome,
      prefixo: equipe.prefixo || '',
      operacao: equipe.operacao_codigo || equipe.operacao,
      operacaoNome: equipe.operacao_nome || '',
      setor: equipe.setor || '',
      encarregadoId: equipe.encarregado_id,
      encarregadoNome: equipe.encarregado_nome || '',
      encarregadoMatricula: equipe.encarregado_matricula || '',
      contratoId: equipe.contrato_id,
      contratoNome: equipe.contrato_nome || ''
    }));
  }

  // Buscar todas as operações que requerem encarregado
  static async getOperacoesComEncarregado(contratoId?: string): Promise<any[]> {
    let query = supabase
      .from('operacoes_padrao')
      .select('*')
      .eq('ativo', true)
      .eq('requer_encarregado', true)
      .order('ordem', { ascending: true });

    if (contratoId) {
      query = query.eq('contrato_id', contratoId);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
  }
}
