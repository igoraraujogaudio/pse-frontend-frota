import { supabase } from '@/lib/supabase';

export type TipoRecursoMO = 'reserva_corrigida' | 'reserva_original' | 'avulso';
export type TipoRecursoMat = 'reserva_corrigida' | 'reserva_original' | 'avulso' | 'retirado';

export interface ProgramacaoMaoDeObra {
  programacaoId: string;
  maoDeObraId?: string | null;
  descricao: string;
  quantidade: number;
  tipo: TipoRecursoMO;
}

export interface ProgramacaoMaterial {
  programacaoId: string;
  materialId?: string | null;
  descricao: string;
  quantidade: number;
  unidade?: string;
  tipo: TipoRecursoMat;
}

export interface ReservaAgregada {
  maoDeObraId: string | null;
  materialId: string | null;
  descricao: string;
  quantidadeReservada: number;
}

export class ObraProgramacaoEquipeRecursosService {
  /**
   * Retorna o total já reservado de MO para uma obra (excluindo a programacaoId atual se fornecida).
   * Chave de agrupamento: mao_de_obra_id (ou descricao para avulsos).
   */
  static async getMOReservadaByObra(obraId: string, excludeProgramacaoId?: string): Promise<ReservaAgregada[]> {
    // Buscar todas as programações da obra
    const { data: progs, error: e1 } = await supabase
      .from('obra_programacao_equipe')
      .select('id')
      .eq('obra_id', obraId);
    if (e1) throw e1;
    const ids = (progs || [])
      .map((p: { id: string }) => p.id)
      .filter((id: string) => id !== excludeProgramacaoId);
    if (!ids.length) return [];

    const { data, error } = await supabase
      .from('obra_programacao_equipe_mao_de_obra')
      .select('mao_de_obra_id, descricao, quantidade')
      .in('programacao_id', ids)
      .in('tipo', ['reserva_corrigida', 'reserva_original']);
    if (error) throw error;

    // Agregar por mao_de_obra_id (null para avulsos agrupa por descricao)
    const map = new Map<string, ReservaAgregada>();
    (data || []).forEach((r: { mao_de_obra_id: string | null; descricao: string; quantidade: number }) => {
      const key = r.mao_de_obra_id ?? `__avulso__${r.descricao}`;
      if (!map.has(key)) {
        map.set(key, { maoDeObraId: r.mao_de_obra_id, materialId: null, descricao: r.descricao, quantidadeReservada: 0 });
      }
      map.get(key)!.quantidadeReservada += Number(r.quantidade);
    });
    return Array.from(map.values());
  }

  /**
   * Retorna o total já reservado de materiais para uma obra (excluindo a programacaoId atual se fornecida).
   */
  static async getMatReservadoByObra(obraId: string, excludeProgramacaoId?: string): Promise<ReservaAgregada[]> {
    const { data: progs, error: e1 } = await supabase
      .from('obra_programacao_equipe')
      .select('id')
      .eq('obra_id', obraId);
    if (e1) throw e1;
    const ids = (progs || [])
      .map((p: { id: string }) => p.id)
      .filter((id: string) => id !== excludeProgramacaoId);
    if (!ids.length) return [];

    const { data, error } = await supabase
      .from('obra_programacao_equipe_material')
      .select('material_id, descricao, quantidade')
      .in('programacao_id', ids)
      .in('tipo', ['reserva_corrigida', 'reserva_original']);
    if (error) throw error;

    const map = new Map<string, ReservaAgregada>();
    (data || []).forEach((r: { material_id: string | null; descricao: string; quantidade: number }) => {
      const key = r.material_id ?? `__avulso__${r.descricao}`;
      if (!map.has(key)) {
        map.set(key, { maoDeObraId: null, materialId: r.material_id, descricao: r.descricao, quantidadeReservada: 0 });
      }
      map.get(key)!.quantidadeReservada += Number(r.quantidade);
    });
    return Array.from(map.values());
  }

  static async saveMaoDeObra(items: ProgramacaoMaoDeObra[]): Promise<void> {
    if (!items.length) return;
    const { error } = await supabase
      .from('obra_programacao_equipe_mao_de_obra')
      .insert(items.map(i => ({
        programacao_id: i.programacaoId,
        mao_de_obra_id: i.maoDeObraId ?? null,
        descricao: i.descricao,
        quantidade: i.quantidade,
        tipo: i.tipo,
      })));
    if (error) throw error;
  }

  static async saveMateriais(items: ProgramacaoMaterial[]): Promise<void> {
    if (!items.length) return;
    const { error } = await supabase
      .from('obra_programacao_equipe_material')
      .insert(items.map(i => ({
        programacao_id: i.programacaoId,
        material_id: i.materialId ?? null,
        descricao: i.descricao,
        quantidade: i.quantidade,
        unidade: i.unidade ?? null,
        tipo: i.tipo,
      })));
    if (error) throw error;
  }
}
