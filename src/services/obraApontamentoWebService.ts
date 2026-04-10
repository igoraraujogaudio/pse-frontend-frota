import { supabase } from '@/lib/supabase';

export type StatusApontamento = 'pendente' | 'aprovado' | 'reprovado';

export interface ApontamentoMaterial {
  id: string;
  materialId?: string | null;
  descricao: string;
  quantidade: number;
  unidade?: string;
  tipo: 'reserva_corrigida' | 'reserva_original' | 'avulso';
}

export interface ApontamentoMaoDeObra {
  id: string;
  maoDeObraId?: string | null;
  descricao: string;
  quantidade: number;
  tipo: 'reserva_corrigida' | 'reserva_original' | 'avulso';
}

export interface ApontamentoExecucaoWeb {
  id: string;
  programacaoId: string;
  encarregadoId?: string | null;
  encarregadoNome?: string | null;
  observacoes?: string;
  status: StatusApontamento;
  createdAt: string;
  materiais: ApontamentoMaterial[];
  maoDeObra: ApontamentoMaoDeObra[];
  programacao?: {
    data: string;
    etapa?: string;
    equipeNome?: string;
  };
}

export class ObraApontamentoWebService {
  /**
   * Busca todos os apontamentos de execução de uma obra
   */
  static async getByObra(obraId: string): Promise<ApontamentoExecucaoWeb[]> {
    // Buscar programações da obra
    const { data: progs, error: e1 } = await supabase
      .from('obra_programacao_equipe')
      .select('id, data, etapa, equipe:equipes(id, nome)')
      .eq('obra_id', obraId);
    if (e1) throw e1;
    if (!progs || progs.length === 0) return [];

    const progIds = progs.map((p: Record<string, unknown>) => p.id);

    // Buscar apontamentos com materiais e MO
    const { data: aponts, error: e2 } = await supabase
      .from('obra_apontamento_execucao')
      .select(`
        id, programacao_id, encarregado_id, observacoes, status, created_at,
        encarregado:usuarios!obra_apontamento_execucao_encarregado_id_fkey(id, nome),
        materiais:obra_apontamento_material(id, material_id, descricao, quantidade, unidade, tipo),
        mao_de_obra:obra_apontamento_mao_de_obra(id, mao_de_obra_id, descricao, quantidade, tipo)
      `)
      .in('programacao_id', progIds)
      .order('created_at', { ascending: false });
    if (e2) throw e2;

    return (aponts || []).map((a: Record<string, unknown>) => {
      const prog = progs.find((p: Record<string, unknown>) => p.id === a.programacao_id);
      const equipeRaw = Array.isArray(prog?.equipe) ? (prog.equipe as Record<string, unknown>[])[0] : prog?.equipe as Record<string, unknown> | undefined;
      const encRaw = Array.isArray(a.encarregado) ? (a.encarregado as Record<string, unknown>[])[0] : a.encarregado as Record<string, unknown> | undefined;
      return {
        id: a.id as string,
        programacaoId: a.programacao_id as string,
        encarregadoId: (a.encarregado_id as string) ?? null,
        encarregadoNome: (encRaw?.nome as string) ?? null,
        observacoes: a.observacoes as string | undefined,
        status: a.status as StatusApontamento,
        createdAt: a.created_at as string,
        materiais: ((a.materiais as Record<string, unknown>[]) || []).map((m: Record<string, unknown>) => ({
          id: m.id as string,
          materialId: (m.material_id as string) ?? null,
          descricao: m.descricao as string,
          quantidade: Number(m.quantidade),
          unidade: m.unidade as string | undefined,
          tipo: m.tipo as ApontamentoMaterial['tipo'],
        })),
        maoDeObra: ((a.mao_de_obra as Record<string, unknown>[]) || []).map((m: Record<string, unknown>) => ({
          id: m.id as string,
          maoDeObraId: (m.mao_de_obra_id as string) ?? null,
          descricao: m.descricao as string,
          quantidade: Number(m.quantidade),
          tipo: m.tipo as ApontamentoMaoDeObra['tipo'],
        })),
        programacao: prog ? {
          data: prog.data as string,
          etapa: prog.etapa as string | undefined,
          equipeNome: equipeRaw?.nome as string | undefined,
        } : undefined,
      };
    });
  }

  /**
   * Aprova um apontamento de execução (marca como aprovado)
   */
  static async aprovar(apontamentoId: string): Promise<void> {
    const { error } = await supabase
      .from('obra_apontamento_execucao')
      .update({ status: 'aprovado', updated_at: new Date().toISOString() })
      .eq('id', apontamentoId);
    if (error) throw error;
  }

  /**
   * Reprova um apontamento de execução
   */
  static async reprovar(apontamentoId: string): Promise<void> {
    const { error } = await supabase
      .from('obra_apontamento_execucao')
      .update({ status: 'reprovado', updated_at: new Date().toISOString() })
      .eq('id', apontamentoId);
    if (error) throw error;
  }

  /**
   * Aprova todos os apontamentos pendentes de uma obra de uma vez
   */
  static async aprovarTodos(obraId: string): Promise<number> {
    // Buscar programações da obra
    const { data: progs } = await supabase
      .from('obra_programacao_equipe')
      .select('id')
      .eq('obra_id', obraId);
    if (!progs || progs.length === 0) return 0;

    const progIds = progs.map((p: Record<string, unknown>) => p.id);

    const { data: pendentes } = await supabase
      .from('obra_apontamento_execucao')
      .select('id')
      .in('programacao_id', progIds)
      .eq('status', 'pendente');

    if (!pendentes || pendentes.length === 0) return 0;

    const ids = pendentes.map((p: Record<string, unknown>) => p.id);
    const { error } = await supabase
      .from('obra_apontamento_execucao')
      .update({ status: 'aprovado', updated_at: new Date().toISOString() })
      .in('id', ids);
    if (error) throw error;

    return ids.length;
  }
}
